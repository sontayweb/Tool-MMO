import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { IAccount, UsernameNormalizer, CryptoService } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

export interface CheckResultDto {
  username: string;
  email?: string;
  status: 'LIVE' | 'WRONG_PASS' | 'BANNED' | 'CAPTCHA' | 'FAILED' | 'IVS_VERIFY';
  error_code: number;
  error_msg?: string;
  coins?: number;
  elapsed_ms?: number;
  raw_response?: any;
}

export interface CheckerSessionState {
  id: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED';
  total: number;
  checked: number;
  live_count: number;
  error_count: number;
  banned_count: number;
  wrong_pass_count: number;
  ivs_count: number;
  total_coins: number;
  started_at: Date | null;
  target_filter: any;
  target_usernames?: string[];
  leased_usernames: Set<string>;
  recent_results: Array<CheckResultDto & { checked_at: Date }>;
}

@Injectable()
export class AccountsCheckerService {
  private readonly logger = new Logger(AccountsCheckerService.name);

  private session: CheckerSessionState = {
    id: '',
    status: 'IDLE',
    total: 0,
    checked: 0,
    live_count: 0,
    error_count: 0,
    banned_count: 0,
    wrong_pass_count: 0,
    ivs_count: 0,
    total_coins: 0,
    started_at: null,
    target_filter: {},
    leased_usernames: new Set<string>(),
    recent_results: []
  };

  private lastWorkerHeartbeat: {
    timestamp: number;
    worker_name?: string;
    active_threads?: number;
    delay?: number;
  } | null = null;

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService
  ) {}

  // ----------------------------------------------------------------
  // 0. WORKER HEARTBEAT: Cập nhật nhịp tim trực chiến của Python Worker
  // ----------------------------------------------------------------
  recordHeartbeat(dto: { worker_name?: string; active_threads?: number; delay?: number }) {
    this.lastWorkerHeartbeat = {
      timestamp: Date.now(),
      worker_name: dto.worker_name || 'Shopee_ARMS_Worker',
      active_threads: dto.active_threads || 1,
      delay: dto.delay
    };
    return {
      success: true,
      timestamp: this.lastWorkerHeartbeat.timestamp,
      active_threads: this.lastWorkerHeartbeat.active_threads
    };
  }

  // ----------------------------------------------------------------
  // 1. START SESSION: Khởi tạo phiên kiểm tra ngầm
  // ----------------------------------------------------------------
  async startSession(
    params: {
      usernames?: string[];
      mode?: 'SELECTED' | 'ALL_SHOPEE' | 'UNVERIFIED' | 'ERRORS_ONLY';
      team?: string;
    },
    actor: { username: string; role: string; team?: string }
  ) {
    const sessionId = `CHK-${Date.now().toString().slice(-6)}`;
    let filter: any = { platform: 'SHOPEE', status: { $ne: 'TRASH' } };

    if (actor.role !== 'OWNER' && actor.role !== 'MANAGER' && actor.team && actor.team !== 'ALL') {
      filter['metadata.team'] = actor.team;
    }

    let targetUsernames: string[] | undefined;

    if (params.usernames && params.usernames.length > 0) {
      const normalizedList = params.usernames
        .map(u => UsernameNormalizer.normalize(u))
        .filter(Boolean);
      filter.username_normalized = { $in: normalizedList };
      targetUsernames = normalizedList;
    } else if (params.mode === 'UNVERIFIED') {
      filter.health_status = 'UNKNOWN';
    } else if (params.mode === 'ERRORS_ONLY') {
      filter.status = 'ERROR';
    }

    const total = await this.accountModel.countDocuments(filter);

    this.session = {
      id: sessionId,
      status: total > 0 ? 'RUNNING' : 'COMPLETED',
      total,
      checked: 0,
      live_count: 0,
      error_count: 0,
      banned_count: 0,
      wrong_pass_count: 0,
      ivs_count: 0,
      total_coins: 0,
      started_at: new Date(),
      target_filter: filter,
      target_usernames: targetUsernames,
      leased_usernames: new Set<string>(),
      recent_results: []
    };

    await this.auditService.record({
      action: 'SHOPEE_CHECK_SESSION_START',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        session_id: sessionId,
        total,
        mode: params.mode || (params.usernames ? 'SELECTED' : 'ALL_SHOPEE')
      }
    });

    this.logger.log(`[ShopeeChecker] Khởi động phiên ${sessionId} với ${total} tài khoản.`);
    return this.getSessionStatus();
  }

  // ----------------------------------------------------------------
  // 2. LEASE ACCOUNTS: Cấp lô tài khoản cho Worker (Giải mã Password an toàn trong RAM)
  // ----------------------------------------------------------------
  async leaseAccounts(batchSize: number = 10) {
    if (this.session.status !== 'RUNNING') {
      return {
        session_id: this.session.id,
        status: this.session.status,
        is_running: false,
        accounts: []
      };
    }

    const leasedArr = Array.from(this.session.leased_usernames);
    const query: any = { ...this.session.target_filter };

    if (this.session.target_usernames && this.session.target_usernames.length > 0) {
      query.username_normalized = {
        $in: this.session.target_usernames,
        $nin: leasedArr
      };
    } else if (leasedArr.length > 0) {
      query.username_normalized = { $nin: leasedArr };
    }

    const docs = await this.accountModel
      .find(query)
      .select('username username_normalized email password_enc platform health_status status')
      .limit(batchSize)
      .lean();

    if (!docs || docs.length === 0) {
      this.session.status = 'COMPLETED';
      this.logger.log(`[ShopeeChecker] Phiên ${this.session.id} đã hoàn tất kiểm tra toàn bộ kho!`);
      return {
        session_id: this.session.id,
        status: this.session.status,
        is_running: false,
        accounts: []
      };
    }

    const leasedList: Array<{ username: string; email: string; password: string }> = [];

    for (const doc of docs) {
      this.session.leased_usernames.add(doc.username_normalized);

      let plainPassword = '';
      if (doc.password_enc) {
        try {
          plainPassword = this.cryptoService.decrypt(doc.password_enc);
        } catch {
          plainPassword = '';
        }
      }

      leasedList.push({
        username: doc.username,
        email: doc.email || doc.username,
        password: plainPassword
      });
    }

    return {
      session_id: this.session.id,
      status: this.session.status,
      is_running: true,
      batch_size: leasedList.length,
      accounts: leasedList
    };
  }

  // ----------------------------------------------------------------
  // 3. REPORT SINGLE RESULT: Lưu kết quả từng nick ngay lập tức vào MongoDB
  // ----------------------------------------------------------------
  async reportSingleResult(
    dto: CheckResultDto,
    actor: { username: string; role?: string }
  ) {
    const normalized = UsernameNormalizer.normalize(dto.username);
    if (!normalized) {
      return { success: false, reason: 'Invalid username' };
    }

    const timestamp = new Date();
    const updateSet: any = {
      health_checked_at: timestamp,
      'quality.last_check_at': timestamp,
      'custom_metadata.check_response': dto.raw_response || {}
    };

    const updateOps: any = {
      $set: updateSet,
      $push: {
        history: {
          action: 'SHOPEE_HEALTH_CHECK',
          actor_id: actor.username || 'SHOPEE_WORKER',
          timestamp,
          note: `Trạng thái: ${dto.status} (Code: ${dto.error_code}, Latency: ${dto.elapsed_ms || 0}ms)`
        }
      }
    };

    // Phân loại trạng thái theo User Rules (CẤM ĐẨY VÀO BLACKLISTED)
    if (dto.status === 'LIVE' || dto.error_code === 0) {
      updateSet.status = 'AVAILABLE';
      updateSet.health_status = 'LIVE';
      updateSet.coins = dto.coins || 0;
      updateSet['quality.last_check_result'] = 'LIVE';

      // Loại bỏ tag lỗi trước để tránh xung đột field 'tags' trong 1 lệnh update MongoDB
      await this.accountModel.updateOne(
        { platform: 'SHOPEE', username_normalized: normalized },
        { $pull: { tags: { $in: ['shopee_check_error', 'shopee_check_banned'] } } }
      );

      updateOps.$addToSet = { tags: 'shopee_checked_live' };

      this.session.live_count++;
      this.session.total_coins += dto.coins || 0;
    } else if (dto.status === 'WRONG_PASS' || dto.error_code === 2) {
      updateSet.status = 'ERROR';
      updateSet.health_status = 'DEAD';
      updateSet['quality.last_check_result'] = 'WRONG_PASS';

      updateOps.$addToSet = { tags: 'shopee_check_error' };
      this.session.error_count++;
      this.session.wrong_pass_count++;
    } else if (dto.status === 'BANNED' || dto.error_code === 9) {
      updateSet.status = 'ERROR';
      updateSet.health_status = 'DEAD';
      updateSet['quality.last_check_result'] = 'BANNED_F02';

      updateOps.$addToSet = { tags: 'shopee_check_banned' };
      this.session.error_count++;
      this.session.banned_count++;
    } else if (dto.status === 'IVS_VERIFY' || dto.error_code === 98) {
      updateSet.status = 'ERROR';
      updateSet.health_status = 'IVS_PENDING';
      updateSet['quality.last_check_result'] = 'IVS_EMAIL_OTP';

      updateOps.$addToSet = { tags: 'shopee_check_ivs' };
      this.session.error_count++;
      this.session.ivs_count++;
    } else {
      // Các lỗi khác (Code 1, Timeout, Rate limit...)
      updateSet.status = 'ERROR';
      updateSet.health_status = 'DEAD';
      updateSet['quality.last_check_result'] = dto.error_msg || `FAILED_CODE_${dto.error_code}`;

      updateOps.$addToSet = { tags: 'shopee_check_error' };
      this.session.error_count++;
    }

    await this.accountModel.updateOne(
      { platform: 'SHOPEE', username_normalized: normalized },
      updateOps
    );

    // Cập nhật bộ đếm phiên và đệm hiển thị Streaming trực tiếp
    this.session.checked++;
    this.session.recent_results.unshift({
      ...dto,
      checked_at: timestamp
    });

    // Giữ tối đa 500 kết quả mới nhất trong RAM để giao diện hiển thị streaming mượt mà
    if (this.session.recent_results.length > 500) {
      this.session.recent_results = this.session.recent_results.slice(0, 500);
    }

    return {
      success: true,
      username: dto.username,
      status: dto.status,
      session_progress: {
        checked: this.session.checked,
        total: this.session.total
      }
    };
  }

  // ----------------------------------------------------------------
  // 4. GET SESSION STATUS: Trả về trạng thái tiến trình thời gian thực
  // ----------------------------------------------------------------
  getSessionStatus() {
    const total = this.session.total || 0;
    const checked = this.session.checked || 0;
    const progress_pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    let elapsed_sec = 0;
    if (this.session.started_at) {
      elapsed_sec = Math.round((Date.now() - new Date(this.session.started_at).getTime()) / 1000);
    }

    const speed_per_sec = elapsed_sec > 0 ? (checked / elapsed_sec).toFixed(1) : '0';

    const isWorkerAlive = this.lastWorkerHeartbeat
      ? Date.now() - this.lastWorkerHeartbeat.timestamp < 12000
      : false;

    return {
      id: this.session.id,
      status: this.session.status,
      is_running: this.session.status === 'RUNNING',
      total,
      checked,
      progress_pct,
      live_count: this.session.live_count,
      error_count: this.session.error_count,
      banned_count: this.session.banned_count,
      wrong_pass_count: this.session.wrong_pass_count,
      ivs_count: this.session.ivs_count,
      total_coins: this.session.total_coins,
      elapsed_sec,
      speed_per_sec,
      worker_status: {
        is_alive: isWorkerAlive,
        worker_name: this.lastWorkerHeartbeat?.worker_name || null,
        active_threads: this.lastWorkerHeartbeat?.active_threads || 0,
        last_heartbeat_at: this.lastWorkerHeartbeat?.timestamp || null
      },
      recent_results: this.session.recent_results
    };
  }

  // ----------------------------------------------------------------
  // 5. STOP SESSION: Dừng phiên kiểm tra ngầm
  // ----------------------------------------------------------------
  async stopSession(actor: { username: string }) {
    this.session.status = 'STOPPED';
    this.logger.log(`[ShopeeChecker] Người dùng ${actor.username} đã dừng phiên ${this.session.id}`);

    await this.auditService.record({
      action: 'SHOPEE_CHECK_SESSION_STOP',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        session_id: this.session.id,
        checked: this.session.checked,
        total: this.session.total
      }
    });

    return this.getSessionStatus();
  }

  // ----------------------------------------------------------------
  // 6. EXPORT CLAIM REPORT: Xuất file khiếu nại tài khoản lỗi gửi shop
  // ----------------------------------------------------------------
  async exportClaimReport(
    params: {
      session_id?: string;
      usernames?: string[];
      format?: 'EXCEL' | 'TXT';
    },
    actor: { username: string; role?: string; team?: string },
    res: any
  ) {
    const filter: any = { platform: 'SHOPEE', status: 'ERROR' };

    if (params.usernames && params.usernames.length > 0) {
      const normList = params.usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
      filter.username_normalized = { $in: normList };
    } else if (this.session.recent_results && this.session.recent_results.length > 0) {
      const errorUsernames = this.session.recent_results
        .filter(r => r.status !== 'LIVE')
        .map(r => UsernameNormalizer.normalize(r.username));
      if (errorUsernames.length > 0) {
        filter.username_normalized = { $in: errorUsernames };
      }
    }

    const docs = await this.accountModel
      .find(filter)
      .select('username username_normalized email password_enc platform health_status quality custom_metadata metadata health_checked_at tags')
      .lean();

    const timestamp = Date.now();

    await this.auditService.record({
      action: 'SHOPEE_CLAIM_EXPORT',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        total_exported: docs.length,
        format: params.format || 'EXCEL'
      }
    });

    if (params.format === 'TXT') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="khieu_nai_shopee_${timestamp}.txt"`);

      let txtContent = '';
      for (const doc of docs) {
        let plainPass = '';
        if (doc.password_enc) {
          try {
            plainPass = this.cryptoService.decrypt(doc.password_enc);
          } catch {
            plainPass = '';
          }
        }
        const errType = doc.quality?.last_check_result || doc.health_status || 'ERROR';
        const rawMsg = doc.custom_metadata?.check_response?.message || doc.custom_metadata?.check_response?.error_msg || '';
        txtContent += `${doc.username}|${plainPass}|${errType}|${rawMsg}\n`;
      }

      res.send(txtContent);
      return;
    }

    // Default: EXCEL (.xlsx)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khiếu Nại Lỗi Shopee');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Tài khoản (Username)', key: 'username', width: 24 },
      { header: 'Mật khẩu', key: 'password', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phân loại lỗi', key: 'error_type', width: 20 },
      { header: 'Mã lỗi', key: 'error_code', width: 12 },
      { header: 'Chi tiết phản hồi từ Shopee', key: 'proof_message', width: 45 },
      { header: 'Nguồn File / Sheet', key: 'source', width: 25 },
      { header: 'Thời gian kiểm tra', key: 'checked_at', width: 22 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let stt = 1;
    for (const doc of docs) {
      let plainPass = '';
      if (doc.password_enc) {
        try {
          plainPass = this.cryptoService.decrypt(doc.password_enc);
        } catch {
          plainPass = '';
        }
      }

      const rawResp = doc.custom_metadata?.check_response || {};
      const proofMsg = rawResp.message || rawResp.error_msg || doc.quality?.last_check_result || 'Lỗi kiểm tra login';
      const errorCode = rawResp.error !== undefined ? rawResp.error : (doc.tags?.includes('shopee_check_banned') ? 9 : 2);
      const source = doc.metadata?.source_sheet || doc.metadata?.source_file || 'Kho Shopee DWH';
      const checkTime = doc.health_checked_at ? new Date(doc.health_checked_at).toLocaleString('vi-VN') : '';

      worksheet.addRow({
        stt: stt++,
        username: doc.username,
        password: plainPass,
        email: doc.email || '',
        error_type: doc.quality?.last_check_result || (errorCode === 9 ? 'BANNED_F02' : 'WRONG_PASS'),
        error_code: errorCode,
        proof_message: proofMsg,
        source,
        checked_at: checkTime
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="khieu_nai_shopee_${timestamp}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
