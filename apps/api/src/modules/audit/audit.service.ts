import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { IAuditLog } from '@arms/shared';

export interface AuditQueryParams {
  action?: string;
  actor?: string;
  platform?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  target_type?: string;
  category?: string;
  level?: string;
  limit?: number;
  skip?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel('AuditLog') private readonly auditModel: Model<IAuditLog>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async record(params: {
    action: string;
    actor_id: string;
    actor_username?: string;
    ip_address?: string;
    target_type?: string;
    target_id?: string;
    platform?: string;
    details?: any;
  }) {
    try {
      const details = { ...params.details };
      if (params.platform && !details.platform) {
        details.platform = params.platform;
      }
      return await this.auditModel.create({
        ...params,
        details,
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getLogs(query: AuditQueryParams = {}) {
    const limit = query.limit || 100;
    const skip = query.skip || 0;
    const filter: any = {};

    if (query.action && query.action !== 'ALL') {
      filter.action = query.action;
    }
    if (query.actor) {
      filter.$or = [
        { actor_username: { $regex: query.actor, $options: 'i' } },
        { actor_id: { $regex: query.actor, $options: 'i' } }
      ];
    }
    if (query.platform && query.platform !== 'ALL') {
      const platRegex = new RegExp(`^${query.platform}$`, 'i');
      filter.$or = filter.$or || [];
      filter.$or.push(
        { 'details.platform': platRegex },
        { target_type: platRegex }
      );
    }
    if (query.target_type && query.target_type !== 'ALL') {
      filter.target_type = query.target_type;
    }
    if (query.date_from || query.date_to) {
      filter.timestamp = {};
      if (query.date_from) filter.timestamp.$gte = new Date(query.date_from);
      if (query.date_to) {
        const to = new Date(query.date_to);
        to.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = to;
      }
    }
    if (query.search) {
      const s = query.search;
      const searchOr = [
        { action: { $regex: s, $options: 'i' } },
        { actor_username: { $regex: s, $options: 'i' } },
        { target_id: { $regex: s, $options: 'i' } },
        { 'details.sold_to': { $regex: s, $options: 'i' } },
        { 'details.order_id': { $regex: s, $options: 'i' } },
        { 'details.file_name': { $regex: s, $options: 'i' } },
        { 'details.category': { $regex: s, $options: 'i' } }
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const total = await this.auditModel.countDocuments(filter);
    const logs = await this.auditModel.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();

    return { logs, total, limit, skip };
  }

  async getUnifiedSystemLogs(query: AuditQueryParams = {}) {
    const limit = query.limit || 150;

    // 1. Xây dựng filter MongoDB cho audit
    const auditFilter: any = {};
    if (query.action && query.action !== 'ALL') {
      auditFilter.action = query.action;
    }
    if (query.actor) {
      auditFilter.$or = [
        { actor_username: { $regex: query.actor, $options: 'i' } },
        { actor_id: { $regex: query.actor, $options: 'i' } }
      ];
    }
    if (query.date_from || query.date_to) {
      auditFilter.timestamp = {};
      if (query.date_from) auditFilter.timestamp.$gte = new Date(query.date_from);
      if (query.date_to) {
        const to = new Date(query.date_to);
        to.setHours(23, 59, 59, 999);
        auditFilter.timestamp.$lte = to;
      }
    }

    // 2. Lấy audit logs
    const auditLogs = await this.auditModel.find(auditFilter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    // 3. Lấy danh sách Ingress Batch
    let batches: any[] = [];
    if (this.connection.models['ScanBatch']) {
      const batchFilter: any = {};
      if (query.actor) {
        batchFilter.managed_by = { $regex: query.actor, $options: 'i' };
      }
      batches = await this.connection.models['ScanBatch'].find(batchFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();
    }

    // 4. Lấy mục lục Google Drive discovered_sheets
    let discovered: any[] = [];
    if (this.connection.db) {
      discovered = await this.connection.db.collection('discovered_sheets')
        .find()
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray();
    }

    // 5. Gom thống nhất thành Timeline Stream chuẩn hóa
    const unifiedEvents: any[] = [];

    // Nạp Audit logs
    auditLogs.forEach(log => {
      let level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO';
      const act = log.action || '';
      if (act.includes('COMPLETED') || act.includes('SUCCESS') || act.includes('MARK_SOLD') || act.includes('RESTORE')) {
        level = 'SUCCESS';
      } else if (act.includes('FAIL') || act.includes('ERROR') || act.includes('HARD_DELETE') || act.includes('UNFIXABLE')) {
        level = 'ERROR';
      } else if (act.includes('WARN') || act.includes('BLACKLIST') || act.includes('TRASH') || act.includes('CLEAN')) {
        level = 'WARN';
      }

      // Title nhân hóa tiếng Việt rõ ràng
      let actionLabel = act;
      if (act === 'AUTH_LOGIN') actionLabel = 'Đăng nhập hệ thống';
      else if (act === 'DRIVE_SYNC_STARTED') actionLabel = 'Kích hoạt đồng bộ Google Drive Shopee';
      else if (act === 'DRIVE_AUTO_SYNC_COMPLETED') actionLabel = 'Hoàn thành đồng bộ Shopee Drive';
      else if (act === 'TIKTOK_INGRESS_STARTED') actionLabel = 'Kích hoạt cào kho TikTok Drive';
      else if (act === 'TIKTOK_INGRESS_COMPLETED') actionLabel = 'Hoàn tất đồng bộ kho TikTok Drive';
      else if (act === 'SANITATION_AUTO_FIX') actionLabel = 'Cứu hộ tự động dữ liệu vi phạm';
      else if (act === 'SANITATION_CLEAN') actionLabel = 'Làm sạch kho tài khoản';
      else if (act === 'MARK_SOLD') actionLabel = `Xuất kho bán hàng (${log.details?.count || log.details?.modified_count || 0} nick)`;
      else if (act === 'EXPORT_EXCEL') actionLabel = `Xuất file Excel (${log.details?.count || 0} nick)`;
      else if (act === 'IMPORT_FILE_COMMIT') actionLabel = `Nạp tệp tài khoản (${log.details?.file_name || ''})`;
      else if (act === 'BLACKLIST' || act === 'BULK_BLACKLIST') actionLabel = 'Khóa danh sách Blacklist';
      else if (act === 'MOVE_TO_TRASH' || act === 'BULK_MOVE_TO_TRASH') actionLabel = 'Chuyển nick vào Thùng Rác';
      else if (act === 'RESTORE_FROM_TRASH') actionLabel = 'Khôi phục nick từ Thùng Rác';
      else if (act === 'EMPTY_TRASH') actionLabel = 'Dọn sạch vĩnh viễn Thùng Rác';

      unifiedEvents.push({
        id: log._id.toString(),
        timestamp: log.timestamp || (log as any).createdAt,
        category: 'AUDIT',
        action: log.action,
        level,
        actor: log.actor_username || log.actor_id || 'System',
        title: actionLabel,
        ip_address: log.ip_address || '',
        platform: log.details?.platform || log.target_type || '',
        details: log.details || {},
        target: log.target_type ? `${log.target_type} #${log.target_id || ''}` : 'System'
      });
    });

    // Nạp Batch Ingress logs
    batches.forEach(b => {
      const isSuccess = b.status === 'COMPLETED';
      unifiedEvents.push({
        id: b._id.toString(),
        timestamp: b.createdAt || b.updatedAt,
        category: 'INGRESS',
        action: 'BATCH_INGRESS',
        level: isSuccess ? 'SUCCESS' : (b.status === 'FAILED' ? 'ERROR' : 'WARN'),
        actor: b.managed_by || 'Google Ingress Engine',
        title: `Đợt quét tệp: ${b.file_name}`,
        details: {
          status: b.status,
          total_rows: b.total_rows || 0,
          valid_rows: b.valid_rows || 0,
          error_rows: b.error_rows || 0,
          duplicate_rows: b.duplicate_rows || 0
        },
        target: `File: ${b.file_name}`
      });
    });

    // Lọc theo các trường
    let filtered = unifiedEvents;
    if (query.category && query.category !== 'ALL') {
      filtered = filtered.filter(e => e.category === query.category);
    }
    if (query.level && query.level !== 'ALL') {
      filtered = filtered.filter(e => e.level === query.level);
    }
    if (query.platform && query.platform !== 'ALL') {
      const p = query.platform.toUpperCase();
      filtered = filtered.filter(e => (e.platform || '').toUpperCase() === p || (e.target || '').toUpperCase().includes(p));
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.title || '').toLowerCase().includes(s) ||
        (e.actor || '').toLowerCase().includes(s) ||
        (e.action || '').toLowerCase().includes(s) ||
        (e.target || '').toLowerCase().includes(s) ||
        JSON.stringify(e.details || {}).toLowerCase().includes(s)
      );
    }

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      total_events: filtered.length,
      events: filtered.slice(0, limit),
      discovered_summary: {
        total_discovered_sheets: discovered.length,
        recent: discovered.slice(0, 10)
      }
    };
  }
}
