import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
      if (!filter.$and) {
        filter.$and = [];
      }
      if (filter.$or) {
        filter.$and.push({ $or: filter.$or });
        delete filter.$or;
      }
      if (corruptedFilter.$and) {
        filter.$and.push(...corruptedFilter.$and);
      } else if (corruptedFilter.$or) {
        filter.$and.push({ $or: corruptedFilter.$or });
      }
      delete filter.status;
    } else if (query.data_quality === 'missing_core') {
      const missingFilter = PlatformRules.getMissingCoreMongoFilter(query.platform);
      if (!filter.$and) filter.$and = [];
      filter.$and.push(...missingFilter.$and);
    } else if (query.data_quality === 'full_info') {
      const fullInfoFilter = PlatformRules.getFullInfoMongoFilter(query.platform);
      if (!filter.$and) filter.$and = [];
      filter.$and.push(fullInfoFilter);
    } else if (query.data_quality === 'has_cookie') {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: [{ 'quality.has_cookie': true }, { cookie_enc: { $nin: [null, ''] } }] });
    } else if (query.data_quality === 'has_token') {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: [{ 'quality.has_token': true }, { token_enc: { $nin: [null, ''] } }, { session_token: { $nin: [null, ''] } }] });
    } else if (query.data_quality === 'has_email') {
      filter.email = { $nin: [null, ''] };
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
  async bulkMarkSold(usernames: string[], actor: { username: string; role: string }, sold_to?: string, order_id?: string, unit_price?: number) {
    const normalized = usernames.map(u => UsernameNormalizer.normalize(u)).filter(Boolean);
    if (normalized.length === 0) return { modified_count: 0 };

    const actualSoldTo = sold_to || 'Khách Mua Nhanh';
    const actualOrderId = order_id || `ORD-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date();

    const result = await this.accountModel.updateMany(
      { username_normalized: { $in: normalized } },
      {
        $set: {
          status: 'SOLD',
          'consumption.sold_to': actualSoldTo,
          'consumption.sold_at': timestamp,
          'consumption.order_id': actualOrderId,
          'consumption.note': unit_price ? `Đơn giá: ${unit_price.toLocaleString('vi-VN')} đ` : undefined
        },
        $push: {
          history: {
            action: 'SOLD',
            actor_id: actor.username,
            timestamp: timestamp,
            note: `Bán cho: ${actualSoldTo}, Đơn: ${actualOrderId}`
          }
        }
      }
    );

    await this.auditService.record({
      action: 'MARK_SOLD',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { count: usernames.length, modified_count: result.modifiedCount, sold_to: actualSoldTo, order_id: actualOrderId }
    });

    return { modified_count: result.modifiedCount, order_id: actualOrderId, sold_to: actualSoldTo };
  }

  // ----------------------------------------------------------------
  // CREATE SINGLE ACCOUNT (Thêm 1 tài khoản lẻ thủ công)
  // ----------------------------------------------------------------
  async createSingleAccount(payload: {
    username: string;
    platform?: string;
    password?: string;
    email?: string;
    email_password?: string;
    cookie?: string;
    token?: string;
    session_token?: string;
    machine_id?: string;
    phone?: string;
    coins?: any;
    custom_metadata?: any;
    tags?: string[];
  }, actor: { username: string; role: string; team?: string }) {
    if (!payload.username) {
      throw new BadRequestException('Tên đăng nhập không được để trống.');
    }

    const platform = payload.platform || 'SHOPEE';
    if (!PlatformRules.isValidUsername(platform, payload.username)) {
      throw new BadRequestException(`Tên đăng nhập "${payload.username}" không hợp lệ cho nền tảng ${platform}.`);
    }

    const normalized = UsernameNormalizer.normalize(payload.username);

    // Kiểm tra trùng
    const existing = await this.accountModel.findOne({ platform, username_normalized: normalized });
    if (existing) {
      throw new BadRequestException(`Tài khoản "${payload.username}" (${platform}) đã tồn tại trong kho.`);
    }

    const timestamp = new Date();
    const setFields: any = {
      username: payload.username.trim(),
      username_normalized: normalized,
      platform: platform,
      status: 'AVAILABLE',
      phone: payload.phone ? payload.phone.trim() : undefined,
      coins: payload.coins,
      email: payload.email ? payload.email.trim() : undefined,
      machine_id: payload.machine_id ? payload.machine_id.trim() : undefined,
      custom_metadata: payload.custom_metadata || {},
      tags: payload.tags || [],
      metadata: {
        source_file: 'Thủ công (Web UI)',
        source_sheet: 'Nhập lẻ',
        managed_by: actor.username,
        team: actor.team || 'ALL',
        first_scan_at: timestamp,
        last_scan_at: timestamp
      },
      raw: {
        row_number: 1,
        raw_text: `${payload.username}|${payload.password || ''}|${payload.cookie || ''}|${payload.email || ''}`
      },
      quality: {
        has_cookie: !!payload.cookie,
        has_token: !!(payload.token || payload.session_token),
        has_email: !!payload.email,
        parse_errors: []
      },
      history: [{
        action: 'CREATED_MANUALLY',
        actor_id: actor.username,
        timestamp: timestamp,
        note: `Tạo thủ công bởi ${actor.username}`
      }]
    };

    if (payload.password) setFields.password_enc = this.cryptoService.encrypt(payload.password);
    if (payload.cookie) setFields.cookie_enc = this.cryptoService.encrypt(payload.cookie);
    if (payload.token) setFields.token_enc = this.cryptoService.encrypt(payload.token);
    if (payload.session_token) setFields.session_token = this.cryptoService.encrypt(payload.session_token);
    if (payload.email_password) setFields.email_password_enc = this.cryptoService.encrypt(payload.email_password);

    const newAcc = await this.accountModel.create(setFields);

    await this.auditService.record({
      action: 'CREATE_MANUAL_ACCOUNT',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { username: newAcc.username, platform: newAcc.platform }
    });

    return this.formatAccount(newAcc, actor.role);
  }

  // ----------------------------------------------------------------
  // CRM & SALES ANALYTICS
  // ----------------------------------------------------------------
  async getCrmStats() {
    const [totalSold, totalAvailable, customerAgg, recentSold] = await Promise.all([
      this.accountModel.countDocuments({ status: 'SOLD' }),
      this.accountModel.countDocuments({ status: 'AVAILABLE' }),
      this.accountModel.aggregate([
        { $match: { status: 'SOLD' } },
        {
          $group: {
            _id: { $ifNull: ['$consumption.sold_to', 'Khách Vãng Lai'] },
            total_purchased: { $sum: 1 },
            last_purchased_at: { $max: { $ifNull: ['$consumption.sold_at', '$updatedAt'] } },
            shopee_count: { $sum: { $cond: [{ $eq: ['$platform', 'SHOPEE'] }, 1, 0] } },
            tiktok_count: { $sum: { $cond: [{ $eq: ['$platform', 'TIKTOK'] }, 1, 0] } }
          }
        },
        { $sort: { total_purchased: -1 } },
        { $limit: 20 }
      ]),
      this.accountModel.find({ status: 'SOLD' })
        .sort({ 'consumption.sold_at': -1, updatedAt: -1 })
        .limit(100)
        .select('username platform consumption createdAt updatedAt')
        .lean()
    ]);

    // Nhóm recentSold theo order_id
    const ordersMap = new Map<string, any>();
    recentSold.forEach((acc: any) => {
      const orderId = acc.consumption?.order_id || 'ORD-BAN-LE';
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          order_id: orderId,
          sold_to: acc.consumption?.sold_to || 'Khách Vãng Lai',
          sold_at: acc.consumption?.sold_at || acc.updatedAt,
          count: 0,
          platform: acc.platform,
          usernames: []
        });
      }
      const order = ordersMap.get(orderId);
      order.count++;
      if (order.usernames.length < 5) order.usernames.push(acc.username);
    });

    const recentOrders = Array.from(ordersMap.values()).slice(0, 20);
    const estimatedRevenue = totalSold * 5000;

    return {
      total_sold: totalSold,
      total_available: totalAvailable,
      total_customers: customerAgg.length,
      estimated_revenue: estimatedRevenue,
      top_customers: customerAgg.map(c => ({
        customer_name: c._id,
        total_accounts: c.total_purchased,
        last_purchased_at: c.last_purchased_at,
        shopee_count: c.shopee_count,
        tiktok_count: c.tiktok_count,
        estimated_spend: c.total_purchased * 5000
      })),
      recent_orders: recentOrders
    };
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
  // ANALYTICS SUMMARY (Zero-Discrepancy: Exclude TRASH from active inventory totals)
  // ----------------------------------------------------------------
  async getAnalyticsSummary() {
    const activeMatch = { status: { $ne: 'TRASH' } };
    const [statusStats, platformStats, qualityStats, total] = await Promise.all([
      this.accountModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.accountModel.aggregate([{ $match: activeMatch }, { $group: { _id: '$platform', count: { $sum: 1 } } }]),
      this.accountModel.aggregate([
        { $match: activeMatch },
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
      this.accountModel.countDocuments(activeMatch)
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
  // INGEST RAW / API BATCH (BulkWrite + Platform Isolation + Status Protection)
  // ----------------------------------------------------------------
  async ingestAccounts(rawList: any[], actor: { username: string; role: string; team?: string }) {
    const bulkOps: any[] = [];
    const now = new Date();

    for (const item of rawList) {
      const targetPlatform = (item.platform || 'SHOPEE').toUpperCase();
      if (!item.username || !PlatformRules.isValidUsername(targetPlatform, item.username)) {
        continue;
      }

      const normalized = UsernameNormalizer.normalize(item.username);
      const password_enc = item.password ? this.cryptoService.encrypt(item.password) : undefined;
      const cookie_enc = item.cookie ? this.cryptoService.encrypt(item.cookie) : undefined;
      const token_enc = item.token ? this.cryptoService.encrypt(item.token) : undefined;
      const session_token = item.session_token ? this.cryptoService.encrypt(item.session_token) : undefined;
      const email_password_enc = item.email_password ? this.cryptoService.encrypt(item.email_password) : undefined;

      const setFields: any = {
        username: item.username,
        username_normalized: normalized,
        platform: targetPlatform,
        'metadata.team': actor.team || 'ALL',
        'metadata.managed_by': actor.username,
        'metadata.last_scan_at': now
      };

      if (item.status) setFields.status = item.status;
      if (password_enc) setFields.password_enc = password_enc;
      if (cookie_enc) {
        setFields.cookie_enc = cookie_enc;
        setFields['quality.has_cookie'] = true;
      }
      if (token_enc) {
        setFields.token_enc = token_enc;
        setFields['quality.has_token'] = true;
      }
      if (session_token) {
        setFields.session_token = session_token;
        setFields['quality.has_token'] = true;
      }
      if (item.email) {
        setFields.email = item.email;
        setFields['quality.has_email'] = true;
      }
      if (email_password_enc) setFields.email_password_enc = email_password_enc;
      if (item.phone) setFields.phone = item.phone;
      if (item.coins !== undefined) setFields.coins = item.coins;
      if (item.machine_id) setFields.machine_id = item.machine_id;
      if (item.custom_metadata) setFields.custom_metadata = item.custom_metadata;
      if (item.raw) setFields.raw = item.raw;

      const updateDoc: any = {
        $set: setFields,
        $setOnInsert: {
          status: item.status || 'AVAILABLE',
          'metadata.first_scan_at': now
        }
      };

      if (item.tags && item.tags.length > 0) {
        updateDoc.$addToSet = { tags: { $each: item.tags } };
      }

      bulkOps.push({
        updateOne: {
          filter: { platform: targetPlatform, username_normalized: normalized },
          update: updateDoc,
          upsert: true
        }
      });
    }

    let inserted = 0;
    let updated = 0;
    if (bulkOps.length > 0) {
      const res = await this.accountModel.bulkWrite(bulkOps, { ordered: false });
      inserted = res.upsertedCount || 0;
      updated = res.modifiedCount || 0;
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
    let session_token = '';

    if (role === 'OWNER' || role === 'MANAGER' || role === 'MEMBER') {
      if (account.password_enc) password = this.cryptoService.decrypt(account.password_enc);
      if (account.cookie_enc) cookie = this.cryptoService.decrypt(account.cookie_enc);
      if (account.token_enc) token = this.cryptoService.decrypt(account.token_enc);
      if (account.email_password_enc) email_password = this.cryptoService.decrypt(account.email_password_enc);
      if (account.session_token) {
        try {
          session_token = this.cryptoService.decrypt(account.session_token);
        } catch {
          session_token = account.session_token;
        }
      }
    }

    return {
      _id: account._id,
      username: account.username,
      platform: account.platform,
      machine_id: account.machine_id,
      phone: account.phone || '',
      coins: account.coins,
      email: account.email,
      status: account.status,
      health_status: account.health_status,
      quality: account.quality || {},
      metadata: account.metadata || {},
      custom_metadata: account.custom_metadata || {},
      raw: account.raw || null,
      tags: account.tags || [],
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      password,
      cookie,
      token,
      session_token,
      email_password
    };
  }
}
