import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { IApiKeyDocument } from './schemas/api-key.schema.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel('ApiKey') private readonly apiKeyModel: Model<IApiKeyDocument>,
    private readonly auditService: AuditService
  ) {}

  /**
   * Tạo API Key mới cho Tool MMO ngoại vi
   */
  async createKey(payload: {
    name: string;
    scopes?: string[];
    expires_in_days?: number;
  }, actor: { username: string; role: string }) {
    // Generate secure random key: arms_live_<32 hex chars>
    const randomSecret = crypto.randomBytes(24).toString('hex');
    const fullKey = `arms_live_${randomSecret}`;
    const keyPrefix = fullKey.substring(0, 14); // e.g. "arms_live_a1b2"
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const scopes = payload.scopes && payload.scopes.length > 0
      ? payload.scopes
      : ['READ_ACCOUNTS'];

    let expiresAt: Date | undefined;
    if (payload.expires_in_days && payload.expires_in_days > 0) {
      expiresAt = new Date(Date.now() + payload.expires_in_days * 24 * 60 * 60 * 1000);
    }

    const doc = await this.apiKeyModel.create({
      name: payload.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      status: 'ACTIVE',
      created_by: actor.username,
      expires_at: expiresAt
    });

    await this.auditService.record({
      action: 'API_KEY_CREATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { keyId: doc._id, name: payload.name, scopes }
    });

    // Trả về fullKey CHỈ 1 LẦN DUY NHẤT để người dùng sao chép
    return {
      id: doc._id,
      name: doc.name,
      full_key: fullKey,
      key_prefix: doc.key_prefix,
      scopes: doc.scopes,
      created_by: doc.created_by,
      expires_at: doc.expires_at,
      createdAt: doc.createdAt
    };
  }

  /**
   * Liệt kê danh sách các API Key
   */
  async listKeys() {
    const keys = await this.apiKeyModel.find().sort({ createdAt: -1 }).lean().exec();
    return keys.map(k => ({
      id: k._id,
      name: k.name,
      key_prefix: `${k.key_prefix}••••••••`,
      scopes: k.scopes,
      status: k.status,
      created_by: k.created_by,
      last_used_at: k.last_used_at,
      expires_at: k.expires_at,
      createdAt: k.createdAt
    }));
  }

  /**
   * Thu hồi / Hủy kích hoạt API Key
   */
  async revokeKey(id: string, actor: { username: string; role: string }) {
    const key = await this.apiKeyModel.findById(id);
    if (!key) {
      throw new NotFoundException('Không tìm thấy API Key');
    }

    key.status = 'REVOKED';
    await key.save();

    await this.auditService.record({
      action: 'API_KEY_REVOKED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { keyId: id, name: key.name }
    });

    return { success: true, message: `Đã thu hồi API Key ${key.name}` };
  }

  /**
   * Xác thực Service API Key khi Tool gọi vào
   */
  async validateKey(rawKey: string, requiredScope?: string): Promise<IApiKeyDocument> {
    if (!rawKey || !rawKey.startsWith('arms_live_')) {
      throw new UnauthorizedException('Khóa API không hợp lệ hoặc thiếu tiền tố arms_live_');
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyModel.findOne({ key_hash: keyHash, status: 'ACTIVE' }).exec();

    if (!apiKey) {
      throw new UnauthorizedException('Khóa API không tồn tại hoặc đã bị thu hồi');
    }

    if (apiKey.expires_at && new Date() > new Date(apiKey.expires_at)) {
      throw new UnauthorizedException('Khóa API đã hết hạn sử dụng');
    }

    if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
      throw new UnauthorizedException(`Khóa API thiếu quyền: ${requiredScope}`);
    }

    // Cập nhật last_used_at ngầm
    this.apiKeyModel.updateOne({ _id: apiKey._id }, { $set: { last_used_at: new Date() } }).exec();

    return apiKey;
  }
}
