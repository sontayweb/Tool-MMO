import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAccount, UsernameNormalizer, CryptoService, PlatformRules } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
  ) {}

  // ----------------------------------------------------------------
  // FIND ALL: Lấy danh sách tài khoản theo bộ lọc chuyên sâu
  // ----------------------------------------------------------------
  async findAll(query: {
    platform?: string;
    machine_id?: string;
    status?: string;
    source_file?: string;
    source_sheet?: string;
    managed_by?: string;
    team?: string;
    date_from?: string;
    date_to?: string;
    batch_id?: string;
    search?: string;
    data_quality?: string;
    tags?: string;
    limit?: number;
    skip?: number;
  }, user: { username: string; role: string; team?: string }) {
    const filter: any = {};

    // Team Data Isolation Enforcement
    if (user.role !== 'OWNER' && user.role !== 'MANAGER' && user.team && user.team !== 'ALL') {
      filter['metadata.team'] = user.team;
    } else if (query.team && query.team !== 'ALL') {
      filter['metadata.team'] = query.team;
    }

    if (query.platform && query.platform !== 'ALL') filter.platform = query.platform;
    if (query.machine_id) filter.machine_id = query.machine_id;
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    } else {
      filter.status = { $ne: 'TRASH' };
    }
    if (query.source_file) filter['metadata.source_file'] = query.source_file;
    if (query.source_sheet) filter['metadata.source_sheet'] = query.source_sheet;
    if (query.managed_by) filter['metadata.managed_by'] = query.managed_by;
    if (query.batch_id) filter['metadata.batch_id'] = query.batch_id;

    if (query.date_from || query.date_to) {
      filter['metadata.last_scan_at'] = {};
      if (query.date_from) filter['metadata.last_scan_at'].$gte = new Date(query.date_from);
      if (query.date_to) filter['metadata.last_scan_at'].$lte = new Date(query.date_to);
    }

    if (query.search) {
      filter.$or = [
        { username: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { 'metadata.notes': { $regex: query.search, $options: 'i' } },
        { 'metadata.source_file': { $regex: query.search, $options: 'i' } },
        { 'metadata.source_sheet': { $regex: query.search, $options: 'i' } }
      ];
    }

    // Domain Rule Engine - Data Quality Filtering
    if (query.data_quality === 'corrupted' || query.data_quality === 'corrupted_username') {
      const corruptedFilter = PlatformRules.getCorruptedMongoFilter(query.platform);
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: corruptedFilter.$or }];
        delete filter.$or;
      } else {
        filter.$or = corruptedFilter.$or;
      }
    } else if (query.data_quality === 'missing_core') {
      const missingFilter = PlatformRules.getMissingCoreMongoFilter();
      if (filter.$and) {
        filter.$and.push(...missingFilter.$and);
      } else {
        filter.$and = missingFilter.$and;
      }
    } else if (query.data_quality === 'full_info') {
      const fullInfoFilter = PlatformRules.getFullInfoMongoFilter();
      Object.assign(filter, fullInfoFilter);
    }

    if (query.tags) {
      const tagList = query.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (tagList.length > 0) filter.tags = { $all: tagList };
    }

    const limit = query.limit || 20;
    const skip = query.skip || 0;

    const total = await this.accountModel.countDocuments(filter);
    console.log(`[API MONGODB TRUY VẤN] Filter:`, JSON.stringify(filter), `| Đếm được từ DB:`, total);
    const accounts = await this.accountModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const formatted = accounts.map((acc: any) => this.formatAccount(acc, user.role));

    return {
      accounts: formatted,
      total,
      limit,
      skip,
      page: Math.floor(skip / limit) + 1,
      total_pages: Math.ceil(total / limit) || 1
    };
  }

  // ----------------------------------------------------------------
  // FIND ONE: Xem chi tiết 1 tài khoản
  // ----------------------------------------------------------------
  async findOne(username: string, user: { username: string; role: string; team?: string }) {
    const normalized = UsernameNormalizer.normalize(username);
    const account = await this.accountModel.findOne({ username_normalized: normalized }).lean();
    if (!account) {
      throw new NotFoundException(`Không tìm thấy tài khoản: ${username}`);
    }

    if (user.role !== 'OWNER' && user.role !== 'MANAGER' && user.team && user.team !== 'ALL') {
      if (account.metadata?.team && account.metadata.team !== user.team) {
        throw new NotFoundException(`Bạn không có quyền truy cập tài khoản thuộc đội nhóm khác`);
      }
    }

    return this.formatAccount(account, user.role);
  }

  // ----------------------------------------------------------------
  // UPDATE ACCOUNT
  // ----------------------------------------------------------------
  async updateAccount(
    username: string,
    payload: {
      password?: string;
      email?: string;
      email_password?: string;
      cookie?: string;
      session_token?: string;
      machine_id?: string;
      status?: any;
      health_status?: any;
      custom_metadata?: any;
      tags?: string[];
    },
    actor: { username: string; role: string }
  ) {
    const normalized = UsernameNormalizer.normalize(username);
    const account = await this.accountModel.findOne({ username_normalized: normalized });
    if (!account) {
      throw new NotFoundException(`Không tìm thấy tài khoản: ${username}`);
    }

    if (payload.password) account.password_enc = this.cryptoService.encrypt(payload.password);
    if (payload.cookie) account.cookie_enc = this.cryptoService.encrypt(payload.cookie);
    if (payload.session_token) account.session_token = this.cryptoService.encrypt(payload.session_token);
    if (payload.email !== undefined) account.email = payload.email;
    if (payload.email_password) account.email_password_enc = this.cryptoService.encrypt(payload.email_password);
    if (payload.machine_id !== undefined) account.machine_id = payload.machine_id;
    if (payload.status) account.status = payload.status;
    if (payload.health_status) account.health_status = payload.health_status;
    if (payload.custom_metadata) account.custom_metadata = { ...account.custom_metadata, ...payload.custom_metadata };
    if (payload.tags) account.tags = payload.tags;

    await account.save();

    await this.auditService.record({
      action: 'UPDATE_ACCOUNT',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { username: account.username }
    });

    return this.formatAccount(account, actor.role);
  }

  // ----------------------------------------------------------------
  // BULK ACTIONS
  // ----------------------------------------------------------------
  async bulkMarkSold(usernames: string[], actor: { username: string; role: string }, sold_to?: string, order_id?: string) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { modified_count: 0 };

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized } },
      {
        $set: { status: 'SOLD' },
        $push: { history: { action: 'SOLD', actor_id: actor.username, timestamp: new Date(), note: `Bán cho: ${sold_to || 'N/A'}, Đơn: ${order_id || 'N/A'}` } }
      }
    );

    await this.auditService.record({
      action: 'MARK_SOLD', actor_id: actor.username, actor_username: actor.username,
      details: { count: usernames.length, modified_count: result.modifiedCount, sold_to, order_id }
    });

    return { modified_count: result.modifiedCount };
  }

  async bulkMarkUsed(usernames: string[], actor: { username: string; role: string }, used_for?: string) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { modified_count: 0 };

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized } },
      {
        $set: { status: 'USED' },
        $push: { history: { action: 'USED', actor_id: actor.username, timestamp: new Date(), note: used_for || 'Used for workflow' } }
      }
    );

    await this.auditService.record({
      action: 'MARK_USED', actor_id: actor.username, actor_username: actor.username,
      details: { count: usernames.length, modified_count: result.modifiedCount, used_for }
    });

    return { modified_count: result.modifiedCount };
  }

  async bulkBlacklist(usernames: string[], actor: { username: string; role: string }, note?: string) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { modified_count: 0 };

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized } },
      {
        $set: { status: 'BLACKLISTED' },
        $push: { history: { action: 'BLACKLISTED', actor_id: actor.username, timestamp: new Date(), note: note || 'Bulk blacklist' } }
      }
    );

    await this.auditService.record({
      action: 'BLACKLIST', actor_id: actor.username, actor_username: actor.username,
      details: { count: usernames.length, modified_count: result.modifiedCount, note }
    });

    return { modified_count: result.modifiedCount };
  }

  // ----------------------------------------------------------------
  // RECYCLE BIN & SOFT DELETE
  // ----------------------------------------------------------------
  async deleteAccount(username: string, actor: { username: string; role: string }) {
    const normalized = UsernameNormalizer.normalize(username);
    const account = await this.accountModel.findOneAndUpdate(
      { username_normalized: normalized },
      {
        $set: { status: 'TRASH', deleted_at: new Date(), deleted_by: actor.username },
        $push: { history: { action: 'MOVE_TO_TRASH', actor_id: actor.username, timestamp: new Date(), note: 'Đã chuyển vào Thùng Rác' } }
      },
      { new: true }
    );
    if (!account) throw new NotFoundException(`Không tìm thấy tài khoản: ${username}`);

    await this.auditService.record({
      action: 'MOVE_TO_TRASH', actor_id: actor.username, actor_username: actor.username,
      details: { username: account.username, platform: account.platform }
    });

    return { success: true, message: `Đã chuyển tài khoản ${username} vào Thùng Rác` };
  }

  async bulkDelete(usernames: string[], actor: { username: string; role: string }) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { deleted_count: 0 };

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized } },
      {
        $set: { status: 'TRASH', deleted_at: new Date(), deleted_by: actor.username },
        $push: { history: { action: 'BULK_MOVE_TO_TRASH', actor_id: actor.username, timestamp: new Date(), note: 'Chuyển hàng loạt vào Thùng Rác' } }
      }
    );

    await this.auditService.record({
      action: 'BULK_MOVE_TO_TRASH', actor_id: actor.username, actor_username: actor.username,
      details: { count: usernames.length, deleted_count: result.modifiedCount }
    });

    return { deleted_count: result.modifiedCount };
  }

  async restoreFromTrash(usernames: string[], actor: { username: string; role: string }) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { restored_count: 0 };

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized }, status: 'TRASH' },
      {
        $set: { status: 'AVAILABLE' },
        $unset: { deleted_at: 1, deleted_by: 1 },
        $push: { history: { action: 'RESTORE_FROM_TRASH', actor_id: actor.username, timestamp: new Date(), note: 'Khôi phục từ Thùng Rác về kho AVAILABLE' } }
      }
    );

    await this.auditService.record({
      action: 'RESTORE_FROM_TRASH', actor_id: actor.username, actor_username: actor.username,
      details: { count: usernames.length, restored_count: result.modifiedCount }
    });

    return { restored_count: result.modifiedCount };
  }

  async emptyTrash(actor: { username: string; role: string }) {
    const result = await this.accountModel.deleteMany({ status: 'TRASH' });

    await this.auditService.record({
      action: 'EMPTY_TRASH', actor_id: actor.username, actor_username: actor.username,
      details: { permanently_deleted_count: result.deletedCount }
    });

    return { success: true, permanently_deleted_count: result.deletedCount };
  }

  // ----------------------------------------------------------------
  // ANALYTICS SUMMARY
  // ----------------------------------------------------------------
  async getAnalyticsSummary() {
    const [statusStats, platformStats, qualityStats, total] = await Promise.all([
      this.accountModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.accountModel.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }]),
      this.accountModel.aggregate([
        {
          $group: {
            _id: null,
            has_cookie: { $sum: { $cond: ['$quality.has_cookie', 1, 0] } },
            has_email: { $sum: { $cond: ['$quality.has_email', 1, 0] } },
            has_token: { $sum: { $cond: ['$quality.has_token', 1, 0] } },
            has_password: { $sum: { $cond: [{ $ifNull: ['$password_enc', false] }, 1, 0] } }
          }
        }
      ]),
      this.accountModel.countDocuments({})
    ]);

    const by_status: Record<string, number> = {};
    statusStats.forEach(s => { by_status[s._id || 'UNKNOWN'] = s.count; });

    const by_platform: Record<string, number> = {};
    platformStats.forEach(p => { by_platform[p._id || 'OTHER'] = p.count; });

    const quality = qualityStats[0] || { has_cookie: 0, has_email: 0, has_token: 0, has_password: 0 };

    return {
      total,
      by_status,
      by_platform,
      quality: {
        has_cookie: quality.has_cookie,
        has_email: quality.has_email,
        has_token: quality.has_token,
        has_password: quality.has_password
      }
    };
  }

  // ----------------------------------------------------------------
  // INGEST RAW / API BATCH
  // ----------------------------------------------------------------
  async ingestAccounts(rawList: any[], actor: { username: string; role: string; team?: string }) {
    let inserted = 0;
    let updated = 0;

    for (const item of rawList) {
      if (!item.username || !PlatformRules.isValidUsername(item.platform, item.username)) {
        continue;
      }

      const normalized = UsernameNormalizer.normalize(item.username);
      const password_enc = item.password ? this.cryptoService.encrypt(item.password) : undefined;
      const cookie_enc = item.cookie ? this.cryptoService.encrypt(item.cookie) : undefined;
      const token_enc = item.token ? this.cryptoService.encrypt(item.token) : undefined;
      const session_token = item.session_token ? this.cryptoService.encrypt(item.session_token) : undefined;
      const email_password_enc = item.email_password ? this.cryptoService.encrypt(item.email_password) : undefined;

      const updateDoc: any = {
        $set: {
          username: item.username,
          username_normalized: normalized,
          platform: item.platform || 'SHOPEE',
          status: item.status || 'AVAILABLE',
          'quality.has_cookie': !!item.cookie,
          'quality.has_email': !!item.email,
          'quality.has_token': !!item.token,
          'metadata.team': actor.team || 'ALL',
          'metadata.managed_by': actor.username
        }
      };

      if (password_enc) updateDoc.$set.password_enc = password_enc;
      if (cookie_enc) updateDoc.$set.cookie_enc = cookie_enc;
      if (token_enc) updateDoc.$set.token_enc = token_enc;
      if (session_token) updateDoc.$set.session_token = session_token;
      if (item.email) updateDoc.$set.email = item.email;
      if (email_password_enc) updateDoc.$set.email_password_enc = email_password_enc;
      if (item.machine_id) updateDoc.$set.machine_id = item.machine_id;
      if (item.custom_metadata) updateDoc.$set.custom_metadata = item.custom_metadata;
      if (item.tags && item.tags.length > 0) {
        updateDoc.$addToSet = { tags: { $each: item.tags } };
      }

      const res = await this.accountModel.updateOne(
        { username_normalized: normalized },
        updateDoc,
        { upsert: true }
      );

      if (res.upsertedCount > 0) inserted++;
      else updated++;
    }

    await this.auditService.record({
      action: 'API_INGEST_ACCOUNTS',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { total_requested: rawList.length, inserted, updated }
    });

    return { success: true, total_ingested: inserted + updated, inserted, updated };
  }

  // ----------------------------------------------------------------
  // FORMAT ACCOUNT DTO FOR CLIENT
  // ----------------------------------------------------------------
  private formatAccount(account: any, role: string) {
    let password = '';
    let cookie = '';
    let token = '';
    let email_password = '';

    if (role === 'OWNER' || role === 'MANAGER' || role === 'MEMBER') {
      if (account.password_enc) password = this.cryptoService.decrypt(account.password_enc);
      if (account.cookie_enc) cookie = this.cryptoService.decrypt(account.cookie_enc);
      if (account.token_enc) token = this.cryptoService.decrypt(account.token_enc);
      if (account.email_password_enc) email_password = this.cryptoService.decrypt(account.email_password_enc);
    }

    return {
      _id: account._id,
      username: account.username,
      platform: account.platform,
      machine_id: account.machine_id,
      email: account.email,
      status: account.status,
      health_status: account.health_status,
      quality: account.quality || {},
      metadata: account.metadata || {},
      tags: account.tags || [],
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      password,
      cookie,
      token,
      email_password
    };
  }
}
