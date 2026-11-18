import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IScanBatch, IAccount, AccountParser, UsernameNormalizer, CryptoService } from '@arms/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service.js';

export interface IOfflineProcessResult {
  mode: 'preview' | 'commit';
  file_name: string;
  total_parsed?: number;
  inserted?: number;
  updated?: number;
  summary: {
    total_parsed: number;
    new_count: number;
    update_available_count: number;
    alert_sold_count: number;
    alert_used_count: number;
    alert_blacklisted_count: number;
    invalid_count: number;
  };
  batch_id?: string;
  preview?: {
    new_accounts: any[];
    update_available: any[];
    alert_sold: any[];
    alert_used: any[];
    alert_blacklisted: any[];
    invalid: any[];
  };
  details?: {
    inserted: number;
    updated: number;
    protected: number;
    errors: number;
  };
}

@Injectable()
export class ScanService {
  constructor(
    @InjectModel('ScanBatch') private readonly batchModel: Model<IScanBatch>,
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    @InjectQueue('scan-queue') private readonly scanQueue: Queue,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService
  ) {}

  async createBatch(
    fileName: string, 
    fileSize: number, 
    managedBy: string, 
    filePath: string,
    extraData?: { callbackUrl?: string; spreadsheetId?: string }
  ) {
    const batch = await this.batchModel.create({
      status: 'PENDING',
      file_name: fileName,
      file_size: fileSize,
      total_rows: 0,
      valid_rows: 0,
      new_accounts: 0,
      duplicate_accounts: 0,
      error_rows: 0,
      sheets: [],
      row_errors: [],
      managed_by: managedBy,
      callback_url: extraData?.callbackUrl,
      spreadsheet_id: extraData?.spreadsheetId,
      started_at: new Date()
    });

    await this.scanQueue.add('scan-excel', {
      batchId: batch._id.toString(),
      filePath,
      managedBy
    });

    return batch;
  }

  async getBatches(limit = 20, skip = 0) {
    const total = await this.batchModel.countDocuments();
    const batches = await this.batchModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
    return { batches, total };
  }

  async getBatch(id: string) {
    const batch = await this.batchModel.findById(id).exec();
    if (!batch) {
      throw new NotFoundException('Không tìm thấy batch scan');
    }
    return batch;
  }

  async getBatchErrors(id: string) {
    const batch = await this.getBatch(id);
    return batch.row_errors || [];
  }

  // ----------------------------------------------------------------
  // SMART OFFLINE FILE PROCESSOR (Preview & Commit)
  // ----------------------------------------------------------------
  async processOfflineFile(
    filePath: string,
    originalName: string,
    managedBy: string,
    mode: 'preview' | 'commit' = 'preview',
    platform = 'SHOPEE'
  ): Promise<IOfflineProcessResult> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Không tìm thấy file tải lên tại: ${filePath}`);
    }

    const targetPlatform = (platform || 'SHOPEE').toUpperCase();
    const ext = path.extname(originalName).toLowerCase();
    const parsedLines: any[] = [];

    if (ext === '.txt' || ext === '.csv' || ext === '.tsv') {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = AccountParser.parseText(content, { source_file: originalName, source_tab: 'Offline Import', default_platform: targetPlatform });
      lines.forEach(l => parsedLines.push({ ...l, source_sheet: 'Offline Import' }));
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      for (const worksheet of workbook.worksheets) {
        const sheetName = worksheet.name || 'Offline Import';
        worksheet.eachRow((row, rowNumber) => {
          const rowArray: string[] = [];
          row.eachCell({ includeEmpty: true }, (c) => {
            let val: any = c.value;
            if (val && typeof val === 'object') {
              val = val.text || val.result || JSON.stringify(val);
            }
            rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
          });

          if (rowNumber === 1 && worksheet.rowCount > 1) {
            const joinedHeader = rowArray.join(' ').toLowerCase();
            if (joinedHeader.includes('user') || joinedHeader.includes('tài khoản') || joinedHeader.includes('pass') || rowArray[0]?.toUpperCase() === 'STT') {
              return; // skip header
            }
          }

          if (rowArray.length > 0 && rowArray.some(v => v.length > 0)) {
            const parsed = AccountParser.parseRow(rowArray, rowNumber, {
              source_file: originalName,
              source_tab: sheetName,
              default_platform: targetPlatform
            });
            parsedLines.push({ ...parsed, source_sheet: sheetName, row_values: rowArray });
          }
        });
      }
    } else {
      // Fallback text parser
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = AccountParser.parseText(content, { source_file: originalName, source_tab: 'Offline Import', default_platform: targetPlatform });
      lines.forEach(l => parsedLines.push({ ...l, source_sheet: 'Offline Import' }));
    }

    if (parsedLines.length === 0) {
      throw new BadRequestException('File không chứa dữ liệu tài khoản hợp lệ.');
    }

    // Lookup all valid normalized usernames in MongoDB scoped by platform
    const validLines = parsedLines.filter(l => l.is_valid && l.username_normalized);
    const validUsernames = validLines.map(l => l.username_normalized);

    const existingAccounts = await this.accountModel.find({
      platform: targetPlatform,
      username_normalized: { $in: validUsernames }
    }).exec();

    const existingMap = new Map<string, IAccount>();
    existingAccounts.forEach(acc => existingMap.set(acc.username_normalized, acc));

    // Categorization
    const newAccounts: any[] = [];
    const updateAvailable: any[] = [];
    const alertSold: any[] = [];
    const alertUsed: any[] = [];
    const alertBlacklisted: any[] = [];
    const invalidAccounts: any[] = [];

    parsedLines.forEach(item => {
      if (!item.is_valid) {
        invalidAccounts.push({
          line_number: item.line_number,
          raw: item.raw.substring(0, 80),
          reason: item.error_reason || 'INVALID'
        });
        return;
      }

      const existing = existingMap.get(item.username_normalized);
      if (!existing) {
        newAccounts.push({
          line_number: item.line_number,
          raw: item.raw,
          row_values: item.row_values,
          source_sheet: item.source_sheet || 'Offline Import',
          platform: targetPlatform,
          username: item.username,
          username_normalized: item.username_normalized,
          has_password: !!item.password,
          has_cookie: !!item.cookie,
          has_email: !!item.email,
          has_token: !!(item.token || item.session_token),
          phone: item.phone,
          email: item.email,
          password: item.password,
          cookie: item.cookie,
          token: item.token,
          session_token: item.session_token,
          machine_id: item.machine_id,
          coins: item.custom_metadata?.coins,
          custom_metadata: item.custom_metadata,
          email_password: item.email_password,
          status: 'AVAILABLE'
        });
      } else {
        const detail = {
          line_number: item.line_number,
          raw: item.raw,
          row_values: item.row_values,
          source_sheet: item.source_sheet || 'Offline Import',
          platform: targetPlatform,
          username: existing.username,
          username_normalized: existing.username_normalized,
          current_status: existing.status,
          source_file: existing.metadata?.source_file || 'N/A',
          first_scan_at: existing.metadata?.first_scan_at,
          sold_to: existing.consumption?.sold_to,
          sold_at: existing.consumption?.sold_at,
          new_data: {
            has_cookie: !!item.cookie,
            has_email: !!item.email,
            has_password: !!item.password
          },
          phone: item.phone,
          password: item.password,
          cookie: item.cookie,
          token: item.token,
          session_token: item.session_token,
          machine_id: item.machine_id,
          coins: item.custom_metadata?.coins,
          custom_metadata: item.custom_metadata,
          email: item.email,
          email_password: item.email_password
        };

        if (existing.status === 'AVAILABLE') {
          updateAvailable.push(detail);
        } else if (existing.status === 'SOLD') {
          alertSold.push(detail);
        } else if (existing.status === 'USED') {
          alertUsed.push(detail);
        } else if (existing.status === 'BLACKLISTED') {
          alertBlacklisted.push(detail);
        } else {
          updateAvailable.push(detail);
        }
      }
    });

    const summary = {
      total_parsed: parsedLines.length,
      new_count: newAccounts.length,
      update_available_count: updateAvailable.length,
      alert_sold_count: alertSold.length,
      alert_used_count: alertUsed.length,
      alert_blacklisted_count: alertBlacklisted.length,
      invalid_count: invalidAccounts.length
    };

    // If PREVIEW MODE -> return without database writes
    if (mode === 'preview') {
      return {
        mode: 'preview',
        file_name: originalName,
        total_parsed: summary.total_parsed,
        summary,
        preview: {
          new_accounts: newAccounts.slice(0, 30).map(a => ({ ...a, password: a.password ? '******' : '', cookie: a.cookie ? a.cookie.substring(0, 25) + '...' : '' })),
          update_available: updateAvailable.slice(0, 30).map(a => ({ ...a, password: '******', cookie: a.cookie ? a.cookie.substring(0, 25) + '...' : '' })),
          alert_sold: alertSold.slice(0, 30).map(a => ({ ...a, password: '******', cookie: a.cookie ? a.cookie.substring(0, 25) + '...' : '' })),
          alert_used: alertUsed.slice(0, 30),
          alert_blacklisted: alertBlacklisted.slice(0, 30),
          invalid: invalidAccounts.slice(0, 30)
        }
      };
    }

    // COMMIT MODE -> Execute atomic bulkWrite to MongoDB
    const batch = await this.batchModel.create({
      status: 'RUNNING',
      file_name: `[OFFLINE] ${originalName}`,
      file_size: fs.statSync(filePath).size,
      total_rows: parsedLines.length,
      valid_rows: newAccounts.length + updateAvailable.length + alertSold.length + alertUsed.length + alertBlacklisted.length,
      new_accounts: newAccounts.length,
      duplicate_accounts: updateAvailable.length + alertSold.length + alertUsed.length + alertBlacklisted.length,
      error_rows: invalidAccounts.length,
      managed_by: managedBy,
      started_at: new Date()
    });

    const bulkOps: any[] = [];
    const timestamp = new Date();

    // 1. Insert NEW accounts
    for (const item of newAccounts) {
      const setFields: any = {
        platform: targetPlatform,
        'metadata.source_file': originalName,
        'metadata.source_sheet': item.source_sheet || 'Offline Import',
        'metadata.managed_by': managedBy,
        'metadata.batch_id': batch._id,
        'metadata.last_scan_at': timestamp,
        'metadata.first_scan_at': timestamp,
        raw: {
          row_number: item.line_number,
          values: item.row_values,
          raw_text: item.raw || ''
        },
        quality: {
          has_cookie: !!item.cookie,
          has_token: !!(item.token || item.session_token),
          has_email: !!item.email,
          parse_errors: []
        }
      };

      if (item.phone) setFields.phone = item.phone;
      if (item.password) setFields.password_enc = this.cryptoService.encrypt(item.password);
      if (item.cookie) setFields.cookie_enc = this.cryptoService.encrypt(item.cookie);
      if (item.token) setFields.token_enc = this.cryptoService.encrypt(item.token);
      if (item.session_token) setFields.session_token = this.cryptoService.encrypt(item.session_token);
      if (item.machine_id) setFields.machine_id = item.machine_id;
      if (item.coins !== undefined) setFields.coins = item.coins;
      if (item.custom_metadata) setFields.custom_metadata = item.custom_metadata;
      if (item.email) setFields.email = item.email;
      if (item.email_password) setFields.email_password_enc = this.cryptoService.encrypt(item.email_password);

      bulkOps.push({
        updateOne: {
          filter: { platform: targetPlatform, username_normalized: item.username_normalized },
          update: {
            $setOnInsert: {
              username: item.username,
              username_normalized: item.username_normalized,
              platform: targetPlatform,
              status: 'AVAILABLE'
            },
            $set: setFields,
            $addToSet: {
              tags: { $each: item.phone ? [targetPlatform.toLowerCase(), 'offline_import', `phone:${item.phone}`] : [targetPlatform.toLowerCase(), 'offline_import'] }
            },
            $push: {
              history: {
                action: 'CREATED_FROM_OFFLINE_FILE',
                actor_id: managedBy,
                timestamp: timestamp,
                note: `Nhập mới từ file: ${originalName} (${item.source_sheet || 'Offline Import'})`
              }
            }
          },
          upsert: true
        }
      });
    }

    // 2. Update AVAILABLE accounts (Consensus Merge: preserve existing rich fields, only overwrite when incoming has data)
    for (const item of updateAvailable) {
      const setFields: any = {
        'metadata.last_scan_at': timestamp,
        'metadata.batch_id': batch._id,
        'raw.row_number': item.line_number,
        'raw.raw_text': item.raw || ''
      };
      if (item.row_values) setFields['raw.values'] = item.row_values;
      if (item.phone) setFields.phone = item.phone;
      if (item.password) setFields.password_enc = this.cryptoService.encrypt(item.password);
      if (item.cookie) {
        setFields.cookie_enc = this.cryptoService.encrypt(item.cookie);
        setFields['quality.has_cookie'] = true;
      }
      if (item.token) {
        setFields.token_enc = this.cryptoService.encrypt(item.token);
        setFields['quality.has_token'] = true;
      }
      if (item.session_token) {
        setFields.session_token = this.cryptoService.encrypt(item.session_token);
        setFields['quality.has_token'] = true;
      }
      if (item.machine_id) setFields.machine_id = item.machine_id;
      if (item.coins !== undefined) setFields.coins = item.coins;
      if (item.email) {
        setFields.email = item.email;
        setFields['quality.has_email'] = true;
      }
      if (item.email_password) setFields.email_password_enc = this.cryptoService.encrypt(item.email_password);

      bulkOps.push({
        updateOne: {
          filter: { platform: targetPlatform, username_normalized: item.username_normalized },
          update: {
            $set: setFields,
            $push: {
              history: {
                action: 'UPDATED_FROM_OFFLINE_FILE',
                actor_id: managedBy,
                timestamp: timestamp,
                note: `Cập nhật đồng thuận từ file: ${originalName}`
              }
            }
          }
        }
      });
    }

    // 3. Protect SOLD / USED / BLACKLISTED accounts (record history only)
    const protectedAccounts = [...alertSold, ...alertUsed, ...alertBlacklisted];
    for (const item of protectedAccounts) {
      bulkOps.push({
        updateOne: {
          filter: { platform: targetPlatform, username_normalized: item.username_normalized },
          update: {
            $set: { 'metadata.last_scan_at': timestamp },
            $push: {
              history: {
                action: 'DUPLICATE_OFFLINE_PROTECTED',
                actor_id: managedBy,
                timestamp: timestamp,
                note: `Tài khoản xuất hiện trong file offline ${originalName}. Bảo vệ giữ nguyên trạng thái ${item.current_status}.`
              }
            }
          }
        }
      });
    }

    // Execute bulk write
    if (bulkOps.length > 0) {
      await this.accountModel.bulkWrite(bulkOps, { ordered: false });
    }

    // Update batch to COMPLETED
    batch.status = 'COMPLETED';
    batch.completed_at = new Date();
    await batch.save();

    await this.auditService.record({
      action: 'IMPORT_FILE_COMMIT',
      actor_id: managedBy || 'ADMIN',
      actor_username: managedBy || 'ADMIN',
      platform: platform || 'SHOPEE',
      target_type: 'OFFLINE_FILE',
      details: {
        file_name: originalName,
        platform: platform || 'SHOPEE',
        batch_id: batch._id.toString(),
        total_parsed: summary.total_parsed,
        inserted: newAccounts.length,
        updated: updateAvailable.length,
        protected: protectedAccounts.length,
        invalid: invalidAccounts.length
      }
    });

    // Clean up file
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}

    return {
      mode: 'commit',
      file_name: originalName,
      batch_id: batch._id.toString(),
      total_parsed: summary.total_parsed,
      inserted: newAccounts.length,
      updated: updateAvailable.length,
      summary,
      details: {
        inserted: newAccounts.length,
        updated: updateAvailable.length,
        protected: protectedAccounts.length,
        errors: invalidAccounts.length
      }
    };
  }
}

