import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { IAuditLog } from '@arms/shared';
import * as fs from 'fs';
import * as path from 'path';

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
    details?: any;
  }) {
    try {
      return await this.auditModel.create({
        ...params,
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getLogs(limit = 100, skip = 0) {
    const total = await this.auditModel.countDocuments();
    const logs = await this.auditModel.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
    return { logs, total };
  }

  async getUnifiedSystemLogs(limit = 150) {
    // 1. Lấy audit logs người dùng
    const auditLogs = await this.auditModel.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    // 2. Lấy danh sách các đợt Ingress Batch
    let batches: any[] = [];
    if (this.connection.models['ScanBatch']) {
      batches = await this.connection.models['ScanBatch'].find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();
    }

    // 3. Lấy mục lục Google Drive discovered_sheets
    let discovered: any[] = [];
    if (this.connection.db) {
      discovered = await this.connection.db.collection('discovered_sheets')
        .find()
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray();
    }

    // 4. Định dạng thống nhất thành Timeline Stream
    const unifiedEvents: any[] = [];

    // Nạp Audit logs
    auditLogs.forEach(log => {
      unifiedEvents.push({
        id: log._id.toString(),
        timestamp: log.timestamp || (log as any).createdAt,
        category: 'AUDIT',
        level: 'INFO',
        actor: log.actor_username || log.actor_id || 'System',
        title: `Hành động: ${log.action}`,
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
        level: isSuccess ? 'SUCCESS' : (b.status === 'FAILED' ? 'ERROR' : 'WARN'),
        actor: b.managed_by || 'Google Ingress Engine',
        title: `Đợt quét: ${b.file_name}`,
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

    // Sắp xếp giảm dần theo thời gian
    unifiedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      total_events: unifiedEvents.length,
      events: unifiedEvents.slice(0, limit),
      discovered_summary: {
        total_discovered_sheets: discovered.length,
        recent: discovered.slice(0, 10)
      }
    };
  }
}
