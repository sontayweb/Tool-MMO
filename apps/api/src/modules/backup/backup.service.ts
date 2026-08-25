import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { IAccount, IScanBatch, IAuditLog } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.resolve(process.cwd(), '../../data/backups');

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    @InjectModel('ScanBatch') private readonly batchModel: Model<IScanBatch>,
    @InjectModel('AuditLog') private readonly auditModel: Model<IAuditLog>,
    private readonly auditService: AuditService
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Tạo bản Snapshot nén toàn bộ dữ liệu Data Warehouse
   */
  async createSnapshot(actor: { username: string; role: string }, note?: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `arms_dwh_snapshot_${timestamp}.json.gz`;
    const filePath = path.join(this.backupDir, fileName);

    const [accounts, batches, auditLogs] = await Promise.all([
      this.accountModel.find().lean().exec(),
      this.batchModel.find().lean().exec(),
      this.auditModel.find().lean().exec()
    ]);

    const snapshotData = {
      version: '2.0.0',
      type: 'ARMS_DWH_FULL_SNAPSHOT',
      createdAt: new Date().toISOString(),
      createdBy: actor.username,
      note: note || 'Sao lưu tức thì từ Web UI',
      stats: {
        total_accounts: accounts.length,
        total_batches: batches.length,
        total_audit_logs: auditLogs.length
      },
      data: {
        accounts,
        batches,
        auditLogs
      }
    };

    const jsonStr = JSON.stringify(snapshotData);
    const compressed = zlib.gzipSync(jsonStr);
    fs.writeFileSync(filePath, compressed);

    await this.auditService.record({
      action: 'DWH_BACKUP_CREATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        fileName,
        size_bytes: compressed.length,
        accounts_count: accounts.length
      }
    });

    // Cleanup backups older than 14 days
    this.cleanOldBackups(14);

    return {
      success: true,
      fileName,
      size_bytes: compressed.length,
      size_mb: (compressed.length / (1024 * 1024)).toFixed(2),
      stats: snapshotData.stats,
      createdAt: snapshotData.createdAt
    };
  }

  /**
   * Lấy danh sách các bản sao lưu hiện có
   */
  async listBackups() {
    if (!fs.existsSync(this.backupDir)) {
      return { backups: [], total: 0 };
    }

    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.json.gz') || f.endsWith('.tar.gz') || f.endsWith('.json'));

    const backups = files.map(file => {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      return {
        fileName: file,
        size_bytes: stats.size,
        size_mb: (stats.size / (1024 * 1024)).toFixed(2),
        createdAt: stats.birthtime || stats.mtime,
        modifiedAt: stats.mtime
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      backups,
      total: backups.length
    };
  }

  /**
   * Lấy đường dẫn file để tải về
   */
  getBackupFilePath(fileName: string): string {
    const safeName = path.basename(fileName);
    const filePath = path.join(this.backupDir, safeName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Không tìm thấy file backup: ${fileName}`);
    }
    return filePath;
  }

  /**
   * Xóa một bản sao lưu
   */
  async deleteBackup(fileName: string, actor: { username: string; role: string }) {
    const filePath = this.getBackupFilePath(fileName);
    fs.unlinkSync(filePath);

    await this.auditService.record({
      action: 'DWH_BACKUP_DELETED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { fileName }
    });

    return { success: true, message: `Đã xóa file backup ${fileName}` };
  }

  /**
   * Phục hồi CSDL từ bản sao lưu
   */
  async restoreSnapshot(fileName: string, actor: { username: string; role: string }) {
    const filePath = this.getBackupFilePath(fileName);
    const compressed = fs.readFileSync(filePath);
    const jsonStr = zlib.gunzipSync(compressed).toString('utf8');
    const snapshot = JSON.parse(jsonStr);

    if (!snapshot.data || !Array.isArray(snapshot.data.accounts)) {
      throw new Error('Định dạng tệp sao lưu không hợp lệ');
    }

    const { accounts, batches } = snapshot.data;

    let restoredAccounts = 0;
    const bulkOps = accounts.map((acc: any) => ({
      updateOne: {
        filter: { username_normalized: acc.username_normalized },
        update: { $set: acc },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      const res = await this.accountModel.bulkWrite(bulkOps);
      restoredAccounts = (res.upsertedCount || 0) + (res.modifiedCount || 0);
    }

    if (batches && batches.length > 0) {
      const batchOps = batches.map((b: any) => ({
        updateOne: {
          filter: { _id: b._id },
          update: { $set: b },
          upsert: true
        }
      }));
      await this.batchModel.bulkWrite(batchOps);
    }

    await this.auditService.record({
      action: 'DWH_BACKUP_RESTORED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        fileName,
        restored_accounts: restoredAccounts
      }
    });

    return {
      success: true,
      fileName,
      restored_accounts: restoredAccounts,
      restored_batches: batches?.length || 0
    };
  }

  /**
   * Tự động xóa các bản sao lưu cũ quá số ngày chỉ định
   */
  private cleanOldBackups(retentionDays = 14) {
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(this.backupDir);
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        if (new Date(stats.mtime).getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned old backup file: ${file}`);
        }
      }
    } catch (err) {
      this.logger.error('Failed to clean old backups', err);
    }
  }
}
