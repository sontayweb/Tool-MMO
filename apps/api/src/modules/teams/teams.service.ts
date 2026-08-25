import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class TeamsService implements OnModuleInit {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    private readonly auditService: AuditService
  ) {}

  async onModuleInit() {
    // Tự động gieo mầm các Đội nhóm mặc định nếu chưa có
    const count = await this.teamModel.countDocuments();
    if (count === 0) {
      const defaultTeams = [
        { code: 'TEAM_HA_NOI', display_name: 'Team Hà Nội', color: '#10b981', description: 'Đội ngũ phụ trách kho Hà Nội' },
        { code: 'TEAM_TIKTOK_US', display_name: 'Team TikTok US', color: '#06b6d4', description: 'Đội ngũ nuôi tài khoản TikTok US' },
        { code: 'TEAM_SAI_GON', display_name: 'Team Sài Gòn', color: '#f59e0b', description: 'Đội ngũ kinh doanh Sài Gòn' },
        { code: 'TEAM_SHOPEE_AFFILIATE', display_name: 'Team Shopee Affiliate', color: '#ec4899', description: 'Đội ngũ Shopee Affiliate' },
        { code: 'KHO_TONG', display_name: 'Kho Tổng Trung Tâm', color: '#8b5cf6', description: 'Kho lưu trữ tập trung dữ liệu toàn công ty' },
      ];
      await this.teamModel.insertMany(defaultTeams);
      console.log('✅ Đã khởi tạo 5 Đội Nhóm mặc định trong MongoDB');
    }
  }

  async findAll() {
    const teams = await this.teamModel.find().sort({ createdAt: 1 }).lean().exec();
    return { teams };
  }

  async findOne(code: string) {
    const team = await this.teamModel.findOne({ code: code.toUpperCase() }).lean().exec();
    if (!team) {
      throw new NotFoundException(`Không tìm thấy đội nhóm: ${code}`);
    }
    return team;
  }

  async createTeam(
    payload: { code: string; display_name: string; description?: string; color?: string },
    actor: { username: string; role: string }
  ) {
    const normalizedCode = payload.code.trim().toUpperCase();
    const existing = await this.teamModel.findOne({ code: normalizedCode });
    if (existing) {
      throw new ConflictException(`Mã đội nhóm "${normalizedCode}" đã tồn tại.`);
    }

    const team = await this.teamModel.create({
      code: normalizedCode,
      display_name: payload.display_name.trim(),
      description: payload.description || '',
      color: payload.color || '#8b5cf6',
      created_by: actor.username,
    });

    await this.auditService.record({
      action: 'TEAM_CREATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { code: team.code, display_name: team.display_name },
    });

    return team;
  }

  async updateTeam(
    code: string,
    payload: { display_name?: string; description?: string; color?: string; is_active?: boolean },
    actor: { username: string; role: string }
  ) {
    const normalizedCode = code.trim().toUpperCase();
    const team = await this.teamModel.findOne({ code: normalizedCode });
    if (!team) {
      throw new NotFoundException(`Không tìm thấy đội nhóm: ${code}`);
    }

    if (payload.display_name !== undefined) team.display_name = payload.display_name.trim();
    if (payload.description !== undefined) team.description = payload.description;
    if (payload.color !== undefined) team.color = payload.color;
    if (payload.is_active !== undefined) team.is_active = payload.is_active;

    await team.save();

    await this.auditService.record({
      action: 'TEAM_UPDATED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { code: team.code, changes: payload },
    });

    return team;
  }

  async deleteTeam(code: string, actor: { username: string; role: string }) {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode === 'KHO_TONG') {
      throw new ConflictException('Không thể xóa Kho Tổng mặc định của hệ thống.');
    }

    const team = await this.teamModel.findOneAndDelete({ code: normalizedCode });
    if (!team) {
      throw new NotFoundException(`Không tìm thấy đội nhóm: ${code}`);
    }

    await this.auditService.record({
      action: 'TEAM_DELETED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { code: normalizedCode, display_name: team.display_name },
    });

    return { success: true, message: `Đã xóa đội nhóm ${team.display_name} (${normalizedCode})` };
  }
}
