import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import * as ExcelJS from 'exceljs';
import { IAccount, AccountParser, CryptoService, UsernameNormalizer } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

export interface SyncProgress {
  is_running: boolean;
  stage: 'IDLE' | 'SCANNING_DRIVE' | 'PROCESSING_FILES' | 'COMPLETED' | 'ERROR';
  current_file?: string;
  files_total: number;
  files_processed: number;
  accounts_total_found: number;
  accounts_inserted: number;
  accounts_updated: number;
  accounts_errors: number;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  logs: string[];
}

@Injectable()
export class ShopeeDriveService {
  private readonly logger = new Logger(ShopeeDriveService.name);
  private oauth2Client: any = null;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private autoSyncEnabled = false;
  private syncIntervalMinutes = 60;

  private progress: SyncProgress = {
    is_running: false,
    stage: 'IDLE',
    files_total: 0,
    files_processed: 0,
    accounts_total_found: 0,
    accounts_inserted: 0,
    accounts_updated: 0,
    accounts_errors: 0,
    logs: []
  };

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService
  ) {
    this.initOAuthClient();
  }

  private initOAuthClient() {
    try {
      const rootDir = path.resolve(process.cwd(), process.cwd().endsWith('api') ? '../..' : '.');
      const files = fs.readdirSync(rootDir);
      const credFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json')) || 'google_credentials.json';
      const credPath = path.join(rootDir, credFile);
      const tokenPath = path.join(rootDir, 'google_token.json');

      if (fs.existsSync(credPath)) {
        const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        const clientInfo = creds.installed || creds.web;
        if (clientInfo) {
          this.oauth2Client = new google.auth.OAuth2(
            clientInfo.client_id,
            clientInfo.client_secret,
            'http://localhost:3005'
          );

          if (fs.existsSync(tokenPath)) {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            this.oauth2Client.setCredentials(tokens);

            this.oauth2Client.on('tokens', (newTokens: any) => {
              const merged = { ...tokens, ...newTokens };
              fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2), 'utf8');
              this.logger.log('Google OAuth tokens refreshed & persisted automatically.');
            });
            this.logger.log('Shopee Drive OAuth2 Client initialized successfully.');
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not initialize Shopee Drive OAuth: ${err.message}`);
    }
  }

  async getStatus() {
    const rootDir = path.resolve(process.cwd(), process.cwd().endsWith('api') ? '../..' : '.');
    const tokenPath = path.join(rootDir, 'google_token.json');
    const hasToken = fs.existsSync(tokenPath);

    return {
      connected: hasToken && !!this.oauth2Client,
      auto_sync_enabled: this.autoSyncEnabled,
      sync_interval_minutes: this.syncIntervalMinutes,
      progress: this.progress
    };
  }

  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new BadRequestException('Chưa cấu hình file client_secret JSON trong thư mục dự án.');
    }
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
      prompt: 'consent'
    });
  }

  updateSettings(settings: { auto_sync_enabled?: boolean; sync_interval_minutes?: number }) {
    if (settings.auto_sync_enabled !== undefined) {
      this.autoSyncEnabled = settings.auto_sync_enabled;
      if (this.autoSyncInterval) {
        clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
      }
      if (this.autoSyncEnabled) {
        const intervalMs = (settings.sync_interval_minutes || this.syncIntervalMinutes) * 60 * 1000;
        this.autoSyncInterval = setInterval(() => {
          this.triggerSync({ actor: 'SYSTEM_CRON' }).catch(e => this.logger.error(e));
        }, intervalMs);
        this.logger.log(`Auto Sync Cron activated: every ${settings.sync_interval_minutes || this.syncIntervalMinutes} minutes.`);
      }
    }
    if (settings.sync_interval_minutes) {
      this.syncIntervalMinutes = settings.sync_interval_minutes;
    }
    return { success: true, auto_sync_enabled: this.autoSyncEnabled, sync_interval_minutes: this.syncIntervalMinutes };
  }

  async triggerSync(options: { actor?: string }) {
    if (this.progress.is_running) {
      throw new BadRequestException('Tiến trình đồng bộ Shopee Drive đang chạy. Vui lòng chờ hoàn tất.');
    }

    // Reset progress state
    this.progress = {
      is_running: true,
      stage: 'SCANNING_DRIVE',
      files_total: 0,
      files_processed: 0,
      accounts_total_found: 0,
      accounts_inserted: 0,
      accounts_updated: 0,
      accounts_errors: 0,
      started_at: new Date(),
      logs: [`[${new Date().toLocaleTimeString()}] Bắt đầu khởi động tiến trình quét Shopee Drive...`]
    };

    // Run in background without blocking response
    this.executeDriveIngress(options.actor || 'ADMIN').catch(err => {
      this.logger.error('Shopee Drive Ingress Failed:', err);
      this.progress.is_running = false;
      this.progress.stage = 'ERROR';
      this.progress.error_message = err.message;
      this.progress.logs.push(`[${new Date().toLocaleTimeString()}] ❌ LỖI: ${err.message}`);
    });

    return { message: 'Đã kích hoạt tiến trình đồng bộ Shopee Drive thành công!', started_at: this.progress.started_at };
  }

  private async executeDriveIngress(actor: string) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth2 chưa được cấu hình. Vui lòng kiểm tra file client_secret và token.');
    }

    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Step 1: Scan all Google Drive & Shared Drives with full pagination
    this.progress.logs.push(`[${new Date().toLocaleTimeString()}] 🔍 Đang quét toàn bộ Google Drive & Shared Drives...`);
    let allFiles: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await drive.files.list({
        q: "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx') and trashed = false",
        fields: 'nextPageToken, files(id, name, modifiedTime, owners, webViewLink, mimeType)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken
      });

      const filesBatch = res.data.files || [];
      allFiles = allFiles.concat(filesBatch);
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    const isTikTokFile = (name: string) => {
      const n = (name || '').toLowerCase();
      return n.includes('tiktok') || n.includes('700 acc') || n.includes('boxphone') || n.startsWith('tt_');
    };

    // Lọc danh sách file thuộc phân hệ Shopee (bỏ qua file thuộc kho TikTok)
    const validFiles = allFiles
      .filter(f => !f.name?.startsWith('~') && !f.name?.startsWith('.'))
      .filter(f => !isTikTokFile(f.name));

    this.progress.files_total = validFiles.length;
    this.progress.stage = 'PROCESSING_FILES';
    this.progress.logs.push(`[${new Date().toLocaleTimeString()}] 📂 Tìm thấy ${validFiles.length} file tài nguyên Shopee hợp lệ trên Google Drive.`);

    // Ghi nhận Audit Log bắt đầu
    await this.auditService.record({
      action: 'DRIVE_SYNC_STARTED',
      actor_id: actor,
      actor_username: actor,
      target_type: 'SHOPEE_DRIVE',
      details: {
        total_files_to_scan: validFiles.length,
        started_at: new Date()
      }
    });

    for (let fIdx = 0; fIdx < validFiles.length; fIdx++) {
      const file = validFiles[fIdx];
      this.progress.current_file = file.name || 'Untitled';
      this.progress.logs.push(`[${new Date().toLocaleTimeString()}] [${fIdx + 1}/${validFiles.length}] Đang xử lý file Shopee: "${file.name}"...`);

      try {
        await this.processDriveFile(drive, file);
      } catch (fileErr: any) {
        this.progress.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ Bỏ qua file "${file.name}" do lỗi: ${fileErr.message}`);
      }

      this.progress.files_processed++;
      // Nghỉ ngắn giữa các file để giữ nhịp Quota luôn an toàn
      await new Promise(r => setTimeout(r, 800));
    }

    // Step 3: Complete
    this.progress.is_running = false;
    this.progress.stage = 'COMPLETED';
    this.progress.completed_at = new Date();
    this.progress.logs.push(
      `[${new Date().toLocaleTimeString()}] 🎉 HOÀN THÀNH ĐỒNG BỘ SHOPEE! Tổng cộng: ${this.progress.accounts_total_found} phát hiện (+${this.progress.accounts_inserted} mới, +${this.progress.accounts_updated} cập nhật).`
    );

    // Audit Log
    await this.auditService.record({
      action: 'DRIVE_AUTO_SYNC_COMPLETED',
      actor_id: actor,
      actor_username: actor,
      target_type: 'SHOPEE_DRIVE',
      details: {
        files_scanned: this.progress.files_processed,
        total_accounts: this.progress.accounts_total_found,
        inserted: this.progress.accounts_inserted,
        updated: this.progress.accounts_updated,
        errors: this.progress.accounts_errors
      }
    });
  }

  private async getFileTabsHybrid(drive: any, file: any): Promise<Array<{ sheetName: string; rows: any[][] }>> {
    const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });

    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      try {
        const ssMeta = await sheetsApi.spreadsheets.get({
          spreadsheetId: file.id,
          fields: 'sheets(properties(title))'
        });
        const sheetTitles = (ssMeta.data.sheets || []).map((s: any) => s.properties.title);
        if (sheetTitles.length === 0) return [];

        const safeRanges = sheetTitles.map((t: string) => `'${t.replace(/'/g, "''")}'!A1:Z3000`);
        const batchData = await sheetsApi.spreadsheets.values.batchGet({
          spreadsheetId: file.id,
          ranges: safeRanges
        });

        const valueRanges = batchData.data.valueRanges || [];
        const tabs: Array<{ sheetName: string; rows: any[][] }> = [];
        valueRanges.forEach((vr: any, idx: number) => {
          const tabTitle = sheetTitles[idx] || `Sheet${idx + 1}`;
          const rows = vr.values || [];
          if (rows.length > 0) {
            tabs.push({ sheetName: tabTitle, rows });
          }
        });
        return tabs;
      } catch (apiErr: any) {
        this.logger.warn(`Sheets API failed for ${file.name}, trying Drive export stream...`);
      }
    }

    // Fallback Drive Export XLSX stream
    try {
      let stream: any;
      if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        const res = await drive.files.export(
          {
            fileId: file.id,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          { responseType: 'stream' }
        );
        stream = res.data;
      } else {
        const res = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        );
        stream = res.data;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.read(stream);

      const tabs: Array<{ sheetName: string; rows: any[][] }> = [];
      for (const worksheet of workbook.worksheets) {
        const rows: any[][] = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const rowArray: string[] = [];
          row.eachCell({ includeEmpty: true }, (c) => {
            let val: any = c.value;
            if (val && typeof val === 'object') {
              val = val.text || val.result || JSON.stringify(val);
            }
            rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
          });
          if (rowArray.some(v => v.length > 0)) {
            rows.push(rowArray);
          }
        });
        if (rows.length > 0) {
          tabs.push({ sheetName: worksheet.name, rows });
        }
      }
      return tabs;
    } catch (err: any) {
      throw err;
    }
  }

  private async processDriveFile(drive: any, file: any) {
    const tabsPayload = await this.getFileTabsHybrid(drive, file);

    for (const tab of tabsPayload) {
      const tabName = tab.sheetName;
      const bulkOps: any[] = [];

      tab.rows.forEach((rowArray, rIdx) => {
        if (rIdx === 0 && rowArray.some((c: string) => c.toLowerCase().includes('user') || c.toLowerCase().includes('pass') || c.toUpperCase().includes('STT'))) {
          return;
        }

        const parsed = AccountParser.parseRow(rowArray, rIdx, {
          source_file: file.name,
          source_tab: tabName
        });

        if (!parsed.is_valid || !parsed.username) {
          this.progress.accounts_errors++;
          return;
        }

        this.progress.accounts_total_found++;

        const password_enc = parsed.password ? this.cryptoService.encrypt(parsed.password) : undefined;
        const cookie_enc = parsed.cookie ? this.cryptoService.encrypt(parsed.cookie) : undefined;
        const token_enc = parsed.token ? this.cryptoService.encrypt(parsed.token) : undefined;
        const session_token_enc = parsed.session_token ? this.cryptoService.encrypt(parsed.session_token) : undefined;
        const email_password_enc = parsed.email_password ? this.cryptoService.encrypt(parsed.email_password) : undefined;

        const targetPlatform = parsed.platform || 'SHOPEE';

        const setFields: any = {
          username: parsed.username,
          username_normalized: parsed.username_normalized,
          platform: targetPlatform,
          'metadata.source_file': file.name,
          'metadata.source_sheet': tabName,
          'metadata.last_scan_at': new Date(),
          quality: {
            has_cookie: !!parsed.cookie,
            has_token: !!(parsed.token || parsed.session_token),
            has_email: !!parsed.email,
            parse_errors: []
          },
          tags: [targetPlatform.toLowerCase(), 'drive_ingress', tabName.toLowerCase()],
          updatedAt: new Date()
        };

        if (password_enc) setFields.password_enc = password_enc;
        if (cookie_enc) setFields.cookie_enc = cookie_enc;
        if (token_enc) setFields.token_enc = token_enc;
        if (session_token_enc) setFields.session_token = session_token_enc;
        if (parsed.machine_id) setFields.machine_id = parsed.machine_id;
        if (parsed.phone) setFields.phone = parsed.phone;
        if (parsed.custom_metadata?.coins) setFields.coins = parsed.custom_metadata.coins;
        if (parsed.email) setFields.email = parsed.email;
        if (email_password_enc) setFields.email_password_enc = email_password_enc;
        if (parsed.custom_metadata) setFields.custom_metadata = parsed.custom_metadata;
        setFields.raw = {
          row_number: rIdx + 1,
          values: rowArray,
          raw_text: rowArray.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').join(' | ')
        };

        bulkOps.push({
          updateOne: {
            filter: {
              platform: targetPlatform,
              username_normalized: parsed.username_normalized
            },
            update: {
              $set: setFields,
              $setOnInsert: {
                status: 'AVAILABLE',
                createdAt: new Date(),
                history: [{
                  action: 'SHOPEE_DRIVE_INGRESS',
                  actor_id: 'SHOPEE_DRIVE_SERVICE',
                  timestamp: new Date()
                }]
              }
            },
            upsert: true
          }
        });
      });

      if (bulkOps.length > 0) {
        try {
          const res = await this.accountModel.bulkWrite(bulkOps, { ordered: false });
          this.progress.accounts_inserted += res.upsertedCount || 0;
          this.progress.accounts_updated += res.modifiedCount || 0;
          this.progress.logs.push(
            `[${new Date().toLocaleTimeString()}]   ↳ Tab "${tabName}": +${res.upsertedCount || 0} mới, +${res.modifiedCount || 0} cập nhật cookie/data.`
          );
        } catch (bulkErr: any) {
          // Khi dùng ordered: false, MongoDB vẫn nạp thành công các item không lỗi
          const inserted = bulkErr.result?.nUpserted || bulkErr.result?.upsertedCount || 0;
          const modified = bulkErr.result?.nModified || bulkErr.result?.modifiedCount || 0;
          this.progress.accounts_inserted += inserted;
          this.progress.accounts_updated += modified;
          this.progress.accounts_errors += (bulkErr.writeErrors?.length || 1);
          this.progress.logs.push(
            `[${new Date().toLocaleTimeString()}]   ⚠️ Tab "${tabName}": +${inserted} mới, +${modified} cập nhật, ${bulkErr.writeErrors?.length || 1} dòng lỗi format.`
          );
        }
      }
    }
  }
}
