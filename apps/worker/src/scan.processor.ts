import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job } from 'bullmq';
import { IAccount, IScanBatch, UsernameNormalizer, HeaderMapper, AccountParser, CryptoService } from '@arms/shared';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import Redis from 'ioredis';

@Processor('scan-queue')
export class ScanProcessor extends WorkerHost {
  private redisClient: Redis | null = null;

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    @InjectModel('ScanBatch') private readonly batchModel: Model<IScanBatch>,
    private readonly cryptoService: CryptoService
  ) {
    super();
    // Connect to Redis for caching
    try {
      this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    } catch (err) {
      console.warn('Redis connection failed in worker. Proceeding without Redis set cache:', err);
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { batchId, filePath, managedBy } = job.data;
    console.log(`Processing scan job for batch ${batchId}, file: ${filePath}`);

    const batch = await this.batchModel.findById(batchId);
    if (!batch) {
      throw new Error(`ScanBatch with ID ${batchId} not found`);
    }

    // Update status to RUNNING
    batch.status = 'RUNNING';
    await batch.save();

    if (!fs.existsSync(filePath)) {
      const errorMsg = `File not found at: ${filePath}`;
      batch.status = 'FAILED';
      batch.error_message = errorMsg;
      batch.completed_at = new Date();
      await batch.save();
      throw new Error(errorMsg);
    }

    try {
      // 1. Preload existing username set from Mongo
      const existingUsernames = new Set<string>();
      const dbUsernames = await this.accountModel.find().distinct('username_normalized').exec();
      dbUsernames.forEach((u: string) => existingUsernames.add(u));

      // 2. Open workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      let totalRows = 0;
      let totalValid = 0;
      let totalNew = 0;
      let totalDuplicate = 0;
      let totalError = 0;

      const sheetsStats: any[] = [];
      const rowErrors: any[] = [];
      const bulkOps: any[] = [];
      const sheetUpdates: any[] = []; // Cần để gửi callback ngược lại Google Sheet

      // Process each sheet
      for (const worksheet of workbook.worksheets) {
        const sheetName = worksheet.name;
        console.log(`Scanning sheet: ${sheetName}`);

        let sheetTotal = 0;
        let sheetValid = 0;
        let sheetNew = 0;
        let sheetDuplicate = 0;
        let sheetError = 0;

        // Try to identify header row
        let headerRowIndex = 1;
        let columnMap: Record<number, string> = {};
        let hasHeaders = false;

        // Scan first 5 rows to detect headers
        for (let i = 1; i <= Math.min(5, worksheet.rowCount); i++) {
          const row = worksheet.getRow(i);
          const tempMap: Record<number, string> = {};
          let matchedCols = 0;

          row.eachCell((cell, colNumber) => {
            const val = cell.text;
            if (val) {
              const mapped = HeaderMapper.mapHeader(val);
              if (mapped) {
                tempMap[colNumber] = mapped;
                if (mapped === 'username') matchedCols++;
              }
            }
          });

          if (matchedCols > 0) {
            columnMap = tempMap;
            headerRowIndex = i;
            hasHeaders = true;
            break;
          }
        }

        const startRow = hasHeaders ? headerRowIndex + 1 : 1;

        // Read all rows
        for (let r = startRow; r <= worksheet.rowCount; r++) {
          const row = worksheet.getRow(r);
          
          // Check if row is empty
          let isEmpty = true;
          row.eachCell((cell) => {
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
              isEmpty = false;
            }
          });

          if (isEmpty) continue;

          sheetTotal++;
          totalRows++;

          // Extract values
          let username = '';
          let password = '';
          let cookie = '';
          let token = '';
          let email = '';
          let emailPassword = '';
          const rawValues: Record<string, any> = {};

          row.eachCell((cell, colNumber) => {
            rawValues[`col_${colNumber}`] = cell.value;
          });

          const rowArray: any[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            let val = cell.value;
            if (val && typeof val === 'object') {
              val = (val as any).text || (val as any).result || JSON.stringify(val);
            }
            rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
          });

          // Sử dụng Universal AccountParser nhận diện thông minh
          const parsed = AccountParser.parseRow(rowArray, r, {
            source_file: batch.file_name,
            source_tab: sheetName
          });

          // Lấy dòng gốc từ Google Sheets
          let originalRowNo = r;
          const rowVals = Array.isArray(row.values) ? row.values.filter(v => v !== undefined && v !== null) : Object.values(row.values || {});
          if (rowVals.length > 0) {
            const lastVal = parseInt(String(rowVals[rowVals.length - 1]), 10);
            if (!isNaN(lastVal)) {
              originalRowNo = lastVal;
            }
          }

          // Validate username
          if (!parsed.username) {
            sheetError++;
            totalError++;
            rowErrors.push({
              sheet: sheetName,
              row_number: r,
              raw_line: Object.values(rawValues).join(' | ').substring(0, 100),
              reason: 'MISSING_USERNAME'
            });
            sheetUpdates.push({
              sheetName: sheetName,
              row: originalRowNo,
              status: 'DIE',
              message: 'Thiếu Username/Tài khoản'
            });
            continue;
          }

          const usernameNorm = parsed.username_normalized;
          if (!parsed.is_valid) {
            sheetError++;
            totalError++;
            rowErrors.push({
              sheet: sheetName,
              row_number: r,
              raw_line: Object.values(rawValues).join(' | ').substring(0, 100),
              reason: 'INVALID_USERNAME'
            });
            sheetUpdates.push({
              sheetName: sheetName,
              row: originalRowNo,
              status: 'DIE',
              message: 'Username chứa ký tự không hợp lệ'
            });
            continue;
          }

          sheetValid++;
          totalValid++;

          // Encrypt secrets
          const password_enc = parsed.password ? this.cryptoService.encrypt(parsed.password) : undefined;
          const cookie_enc = parsed.cookie ? this.cryptoService.encrypt(parsed.cookie) : undefined;
          const token_enc = parsed.token ? this.cryptoService.encrypt(parsed.token) : undefined;
          const email_password_enc = parsed.email_password ? this.cryptoService.encrypt(parsed.email_password) : undefined;
          const session_token_enc = parsed.session_token ? this.cryptoService.encrypt(parsed.session_token) : undefined;

          const setFields: any = {
            platform: parsed.platform || 'SHOPEE',
            'metadata.last_scan_at': new Date(),
            'metadata.source_sheet': sheetName,
            'metadata.source_file': batch.file_name,
            'metadata.batch_id': batch._id
          };
          if (password_enc) setFields.password_enc = password_enc;
          if (cookie_enc) setFields.cookie_enc = cookie_enc;
          if (token_enc) setFields.token_enc = token_enc;
          if (session_token_enc) setFields.session_token = session_token_enc;
          if (parsed.machine_id) setFields.machine_id = parsed.machine_id;
          if (parsed.email) setFields.email = parsed.email;
          if (email_password_enc) setFields.email_password_enc = email_password_enc;
          if (parsed.custom_metadata) setFields.custom_metadata = parsed.custom_metadata;

          // Quality indicators
          setFields.quality = {
            has_cookie: !!parsed.cookie,
            has_token: !!(parsed.token || parsed.session_token),
            has_email: !!parsed.email,
            parse_errors: []
          };

          const isDuplicate = existingUsernames.has(usernameNorm);

          if (isDuplicate) {
            sheetDuplicate++;
            totalDuplicate++;
            bulkOps.push({
              updateOne: {
                filter: { username_normalized: usernameNorm },
                update: {
                  $set: setFields,
                  $push: {
                    history: {
                      action: 'UPDATED_FROM_SCAN',
                      actor_id: managedBy,
                      timestamp: new Date(),
                      batch_id: batch._id
                    }
                  }
                }
              }
            });
            sheetUpdates.push({
              sheetName: sheetName,
              row: originalRowNo,
              status: 'LIVE',
              message: 'Cập nhật thành công (Trùng lặp)'
            });
          } else {
            sheetNew++;
            totalNew++;
            existingUsernames.add(usernameNorm);
            
            // Add to Redis (fire & forget)
            if (this.redisClient) {
              this.redisClient.sadd('arms:account:usernames:v1', usernameNorm).catch(() => {});
            }

            bulkOps.push({
              updateOne: {
                filter: { username_normalized: usernameNorm },
                update: {
                  $setOnInsert: {
                    username: username,
                    username_normalized: usernameNorm,
                    status: 'AVAILABLE',
                    'metadata.first_scan_at': new Date(),
                    tags: []
                  },
                  $set: setFields,
                  $push: {
                    history: {
                      action: 'CREATED_FROM_SCAN',
                      actor_id: managedBy,
                      timestamp: new Date(),
                      batch_id: batch._id
                    }
                  }
                },
                upsert: true
              }
            });
            sheetUpdates.push({
              sheetName: sheetName,
              row: originalRowNo,
              status: 'LIVE',
              message: 'Nhập mới thành công'
            });
          }

          // Commit to DB in chunks of 1000
          if (bulkOps.length >= 1000) {
            await this.accountModel.bulkWrite(bulkOps, { ordered: false });
            bulkOps.length = 0;
          }
        }

        sheetsStats.push({
          name: sheetName,
          total: sheetTotal,
          valid: sheetValid,
          new: sheetNew,
          duplicate: sheetDuplicate,
          error: sheetError
        });
      }

      // Flush remaining operations
      if (bulkOps.length > 0) {
        await this.accountModel.bulkWrite(bulkOps, { ordered: false });
      }

      // 3. Update ScanBatch metadata
      batch.status = 'COMPLETED';
      batch.sheets = sheetsStats;
      batch.total_rows = totalRows;
      batch.valid_rows = totalValid;
      batch.new_accounts = totalNew;
      batch.duplicate_accounts = totalDuplicate;
      batch.error_rows = totalError;
      batch.row_errors = rowErrors;
      batch.completed_at = new Date();

      await batch.save();
      console.log(`Scan job completed successfully for batch ${batchId}. New: ${totalNew}, Dup: ${totalDuplicate}, Err: ${totalError}`);

      // Gửi phản hồi ngược lại Google Sheet nếu có callback_url
      if (batch.callback_url && sheetUpdates.length > 0) {
        console.log(`Sending callback status updates back to Google Sheet: ${batch.callback_url}`);
        try {
          const res = await fetch(batch.callback_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'update_status',
              spreadsheetId: batch.spreadsheet_id,
              apiKey: process.env.ARMS_API_KEY,
              updates: sheetUpdates
            })
          });
          const text = await res.text();
          console.log(`Google Sheet Callback Response: ${res.status} - ${text}`);
        } catch (e: any) {
          console.error(`Failed to send status updates back to Google Sheet:`, e.message);
        }
      }

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn(`Failed to delete temp file ${filePath}:`, e);
      }

      return {
        totalRows,
        totalValid,
        totalNew,
        totalDuplicate,
        totalError
      };
    } catch (err: any) {
      console.error(`Error processing scan job for batch ${batchId}:`, err);
      batch.status = 'FAILED';
      batch.error_message = err?.message || 'Unknown processing error';
      batch.completed_at = new Date();
      await batch.save();
      throw err;
    }
  }
}
