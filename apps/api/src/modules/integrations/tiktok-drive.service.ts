import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import * as ExcelJS from 'exceljs';
import { IAccount, AccountParser, CryptoService, UsernameNormalizer } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';
import { BackupService } from '../backup/backup.service.js';

export interface TikTokSyncProgress {
  is_running: boolean;
  stage: 'IDLE' | 'SCANNING_TIKTOK_FILES' | 'PARSING_TIKTOK_DATA' | 'COMPLETED' | 'ERROR';
  current_file?: string;
  current_tab?: string;
  files_total: number;
  files_processed: number;
  tabs_processed: number;
  accounts_found: number;
  accounts_inserted: number;
  accounts_updated: number;
  accounts_with_cookie: number;
  accounts_with_email: number;
  accounts_with_machine: number;
  machines_detected: Record<string, number>;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  logs: string[];
}

@Injectable()
export class TikTokDriveService {
  private readonly logger = new Logger(TikTokDriveService.name);
  private oauth2Client: any = null;

  private progress: TikTokSyncProgress = {
    is_running: false,
    stage: 'IDLE',
    files_total: 0,
    files_processed: 0,
    tabs_processed: 0,
    accounts_found: 0,
    accounts_inserted: 0,
    accounts_updated: 0,
    accounts_with_cookie: 0,
    accounts_with_email: 0,
    accounts_with_machine: 0,
    machines_detected: {},
    logs: []
  };

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
    private readonly backupService: BackupService
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
            });
            this.logger.log('TikTok Drive Ingress OAuth2 ready.');
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not initialize Google Drive OAuth for TikTok Ingress: ${err.message}`);
    }
  }

  async getStatus() {
    const rootDir = path.resolve(process.cwd(), process.cwd().endsWith('api') ? '../..' : '.');
    const tokenPath = path.join(rootDir, 'google_token.json');
    const hasToken = fs.existsSync(tokenPath);

    return {
      connected: hasToken && !!this.oauth2Client,
      progress: this.progress
    };
  }

  async triggerSync(options: { actor?: string }) {
    if (this.progress.is_running) {
      throw new BadRequestException('Tiến trình đồng bộ kho TikTok đang chạy. Vui lòng chờ hoàn tất.');
    }

    // 🛡️ BẢO VỆ DỮ LIỆU: Bắt buộc tạo Snapshot Backup trước khi nạp đợt TikTok mới
    const actorInfo = { username: options.actor || 'TIKTOK_INGRESS_ADMIN', role: 'OWNER' };
    await this.backupService.ensurePreDestructiveSnapshot('Đồng bộ kho tài khoản TikTok từ Google Drive', actorInfo);

    // Reset progress state
    this.progress = {
      is_running: true,
      stage: 'SCANNING_TIKTOK_FILES',
      files_total: 0,
      files_processed: 0,
      tabs_processed: 0,
      accounts_found: 0,
      accounts_inserted: 0,
      accounts_updated: 0,
      accounts_with_cookie: 0,
      accounts_with_email: 0,
      accounts_with_machine: 0,
      machines_detected: {},
      started_at: new Date(),
      logs: [`[${new Date().toLocaleTimeString()}] 🚀 Bắt đầu phân hệ cào và chuẩn hóa kho TikTok từ Google Drive...`]
    };

    // Run in background
    this.executeTikTokIngress(options.actor || 'ADMIN').catch(err => {
      this.logger.error('TikTok Drive Ingress Failed:', err);
      this.progress.is_running = false;
      this.progress.stage = 'ERROR';
      this.progress.error_message = err.message;
      this.progress.logs.push(`[${new Date().toLocaleTimeString()}] ❌ LỖI: ${err.message}`);
    });

    return {
      message: 'Đã kích hoạt phân hệ cào TikTok từ Google Drive thành công!',
      started_at: this.progress.started_at
    };
  }

  private async executeTikTokIngress(actor: string) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth2 chưa được cấu hình. Vui lòng kiểm tra file client_secret và token.');
    }

    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    this.progress.logs.push(`[${new Date().toLocaleTimeString()}] 🔍 Đang quét toàn bộ Google Drive & Shared Drives để tìm file TikTok...`);

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

    // Strict TikTok filter
    const isTikTokFile = (name: string) => {
      const n = (name || '').toLowerCase();
      return n.includes('tiktok') || n.includes('700 acc') || n.includes('farm') || n.includes('boxphone') || n.startsWith('tt_');
    };

    const targetFiles = allFiles
      .filter(f => !f.name?.startsWith('~') && !f.name?.startsWith('.'))
      .filter(f => isTikTokFile(f.name));

    this.progress.files_total = targetFiles.length;
    this.progress.stage = 'PARSING_TIKTOK_DATA';
    this.progress.logs.push(`[${new Date().toLocaleTimeString()}] 📂 Tìm thấy ${targetFiles.length} file tài nguyên TikTok hợp lệ trên Drive.`);

    for (let fIdx = 0; fIdx < targetFiles.length; fIdx++) {
      const file = targetFiles[fIdx];
      this.progress.current_file = file.name || 'Untitled';
      this.progress.logs.push(`[${new Date().toLocaleTimeString()}] [${fIdx + 1}/${targetFiles.length}] Bóc tách file TikTok: "${file.name}"...`);

      try {
        await this.processTikTokFile(drive, file);
      } catch (fileErr: any) {
        this.progress.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ Bỏ qua file "${file.name}" do lỗi: ${fileErr.message}`);
      }

      this.progress.files_processed++;
      await new Promise(r => setTimeout(r, 800));
    }

    // Finish
    this.progress.is_running = false;
    this.progress.stage = 'COMPLETED';
    this.progress.completed_at = new Date();
    this.progress.logs.push(
      `[${new Date().toLocaleTimeString()}] 🎉 HOÀN TẤT ĐỒNG BỘ KHO TIKTOK! Đã bóc tách: ${this.progress.accounts_found} nick (+${this.progress.accounts_inserted} mới, +${this.progress.accounts_updated} cập nhật). Cookie: ${this.progress.accounts_with_cookie}, Mail: ${this.progress.accounts_with_email}, Dàn máy: ${Object.keys(this.progress.machines_detected).length} máy.`
    );

    // Audit
    await this.auditService.record({
      action: 'TIKTOK_INGRESS_COMPLETED',
      actor_id: actor,
      actor_username: actor,
      target_type: 'TIKTOK_DRIVE',
      details: {
        files_scanned: this.progress.files_processed,
        tabs_processed: this.progress.tabs_processed,
        total_accounts: this.progress.accounts_found,
        inserted: this.progress.accounts_inserted,
        updated: this.progress.accounts_updated,
        with_cookie: this.progress.accounts_with_cookie,
        with_email: this.progress.accounts_with_email,
        machines_count: Object.keys(this.progress.machines_detected).length
      }
    });
  }

  private async processTikTokFile(drive: any, file: any) {
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

    for (const worksheet of workbook.worksheets) {
      const tabName = worksheet.name;
      this.progress.current_tab = tabName;
      this.progress.tabs_processed++;

      const bulkOps: any[] = [];

      worksheet.eachRow((row, rIdx) => {
        if (rIdx === 1 && String(row.getCell(1).value || '').toUpperCase().includes('STT')) return;

        const rowArray: string[] = [];
        row.eachCell({ includeEmpty: true }, (c) => {
          let val: any = c.value;
          if (val && typeof val === 'object') {
            val = val.text || val.result || JSON.stringify(val);
          }
          rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
        });

        // Parse specifically as TikTok
        const parsed = AccountParser.parseRow(rowArray, rIdx, {
          source_file: file.name,
          source_tab: tabName
        });

        if (!parsed.is_valid || !parsed.username) return;

        this.progress.accounts_found++;
        if (parsed.cookie) this.progress.accounts_with_cookie++;
        if (parsed.email) this.progress.accounts_with_email++;
        if (parsed.machine_id) {
          this.progress.accounts_with_machine++;
          const mKey = parsed.machine_id.toUpperCase();
          this.progress.machines_detected[mKey] = (this.progress.machines_detected[mKey] || 0) + 1;
        }

        const password_enc = parsed.password ? this.cryptoService.encrypt(parsed.password) : undefined;
        const cookie_enc = parsed.cookie ? this.cryptoService.encrypt(parsed.cookie) : undefined;
        const token_enc = parsed.token ? this.cryptoService.encrypt(parsed.token) : undefined;
        const session_token_enc = parsed.session_token ? this.cryptoService.encrypt(parsed.session_token) : undefined;
        const email_password_enc = parsed.email_password ? this.cryptoService.encrypt(parsed.email_password) : undefined;

        const setFields: any = {
          username: parsed.username,
          username_normalized: parsed.username_normalized,
          platform: 'TIKTOK', // Đảm bảo luôn gán chuẩn TIKTOK
          'metadata.source_file': file.name,
          'metadata.source_sheet': tabName,
          'metadata.last_scan_at': new Date(),
          quality: {
            has_cookie: !!parsed.cookie,
            has_token: !!(parsed.token || parsed.session_token),
            has_email: !!parsed.email,
            parse_errors: []
          },
          tags: ['tiktok', 'drive_ingress', tabName.toLowerCase()],
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
        if (parsed.custom_metadata) setFields.custom_metadata = parsed.custom_metadata;
        setFields.raw = {
          row_number: rIdx + 1,
          values: rowArray,
          raw_text: rowArray.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').join(' | ')
        };

        // Upsert theo khóa định danh kép: { platform: 'TIKTOK', username_normalized }
        bulkOps.push({
          updateOne: {
            filter: {
              platform: 'TIKTOK',
              username_normalized: parsed.username_normalized
            },
            update: {
              $set: setFields,
              $setOnInsert: {
                status: 'AVAILABLE',
                createdAt: new Date(),
                history: [{
                  action: 'TIKTOK_DRIVE_INGRESS',
                  actor_id: 'TIKTOK_DRIVE_SERVICE',
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
          const inserted = bulkErr.result?.nUpserted || bulkErr.result?.upsertedCount || 0;
          const modified = bulkErr.result?.nModified || bulkErr.result?.modifiedCount || 0;
          this.progress.accounts_inserted += inserted;
          this.progress.accounts_updated += modified;
          this.progress.logs.push(
            `[${new Date().toLocaleTimeString()}]   ⚠️ Tab "${tabName}": +${inserted} mới, +${modified} cập nhật, ${bulkErr.writeErrors?.length || 1} dòng lỗi format.`
          );
        }
      }
    }
  }
}
