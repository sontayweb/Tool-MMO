import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser, IAccount } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<IUser>,
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly auditService: AuditService
  ) {}

  /**
   * Lấy danh sách nhân viên
   */
  async listUsers() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).lean().exec();
    return users.map(u => ({
      id: u._id,
      username: u.username,
      role: u.role,
      team: u.team || 'ALL',
      display_name: u.display_name || u.username,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
  }

  /**
   * Tạo tài khoản nhân viên mới
   */
  async createUser(payload: {
    username: string;
    password: string;
    role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | 'AUDITOR';
    team: string;
    display_name?: string;
  }, actor: { username: string; role: string }) {
    const cleanUsername = payload.username.toLowerCase().trim();
    
    const existing = await this.userModel.findOne({ username: cleanUsername }).exec();
    if (existing) {
      throw new BadRequestException(`Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống`);
    }

    const doc = await this.userModel.create({
      username: cleanUsername,
      password_hash: payload.password,
      role: payload.role || 'MEMBER',
      team: payload.team || 'ALL',
      display_name: payload.display_name || cleanUsername,
      status: 'ACTIVE'
    });

    await this.auditService.record({
      action: 'USER_CREATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        new_username: doc.username,
        role: doc.role,
        team: doc.team
      }
    });

    return {
      success: true,
      user: {
        id: doc._id,
        username: doc.username,
        role: doc.role,
        team: doc.team,
        display_name: doc.display_name
      }
    };
  }

  /**
   * Cập nhật thông tin nhân viên (đổi team, đổi mật khẩu, khóa tài khoản)
   */
  async updateUser(id: string, payload: {
    password?: string;
    role?: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | 'AUDITOR';
    team?: string;
    display_name?: string;
    status?: 'ACTIVE' | 'DISABLED';
  }, actor: { username: string; role: string }) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (payload.password) user.password_hash = payload.password;
    if (payload.role) user.role = payload.role;
    if (payload.team) user.team = payload.team;
    if (payload.display_name) user.display_name = payload.display_name;
    if (payload.status) user.status = payload.status;

    await user.save();

    await this.auditService.record({
      action: 'USER_UPDATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        target_user: user.username,
        changes: payload
      }
    });

    return {
      success: true,
      message: `Đã cập nhật thành công tài khoản ${user.username}`
    };
  }

  /**
   * Xóa tài khoản nhân viên
   */
  async deleteUser(id: string, actor: { username: string; role: string }) {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.auditService.record({
      action: 'USER_DELETED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { deleted_username: user.username }
    });

    return { success: true, message: `Đã xóa tài khoản ${user.username}` };
  }

  /**
   * Lấy danh sách các Đội nhóm (Teams) kèm thống kê số lượng tài khoản
   */
  async listTeams() {
    const [teamAccountsAgg, userTeams] = await Promise.all([
      this.accountModel.aggregate([
        { $match: { 'metadata.team': { $ne: null } } },
        { 
          $group: { 
            _id: '$metadata.team', 
            total_accounts: { $sum: 1 },
            available_count: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
            sold_count: { $sum: { $cond: [{ $eq: ['$status', 'SOLD'] }, 1, 0] } }
          } 
        }
      ]),
      this.userModel.distinct('team').exec()
    ]);

    const knownTeams = new Set([
      'ALL',
      'TEAM_HA_NOI',
      'TEAM_SAI_GON',
      'TEAM_TIKTOK_US',
      'TEAM_SHOPEE_AFFILIATE',
      'KHO_TONG',
      ...userTeams
    ]);

    const teamsMap = new Map();
    knownTeams.forEach(t => {
      if (t) teamsMap.set(t, { team_code: t, total_accounts: 0, available_count: 0, sold_count: 0 });
    });

    teamAccountsAgg.forEach(a => {
      if (a._id) {
        teamsMap.set(a._id, {
          team_code: a._id,
          total_accounts: a.total_accounts,
          available_count: a.available_count,
          sold_count: a.sold_count
        });
      }
    });

    return Array.from(teamsMap.values());
  }
}
