import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from '@arms/shared';

export interface UserPayload {
  username: string;
  role: string;
  team: string;
  display_name?: string;
}

@Injectable()
export class AuthService {
  // Built-in seed presets for rapid local/dev usage
  private readonly defaultUsers = [
    { username: 'owner', password: 'password123', role: 'OWNER', team: 'ALL', display_name: 'Quản Lý Tổng (Owner)' },
    { username: 'manager', password: 'password123', role: 'MANAGER', team: 'ALL', display_name: 'Giám Sát Viên' },
    { username: 'nv_hanoi', password: 'password123', role: 'MEMBER', team: 'TEAM_HA_NOI', display_name: 'Nhân Viên Team Hà Nội' },
    { username: 'nv_tiktok', password: 'password123', role: 'MEMBER', team: 'TEAM_TIKTOK_US', display_name: 'Nhân Viên Team TikTok' },
    { username: 'viewer', password: 'password123', role: 'VIEWER', team: 'ALL', display_name: 'Khách Xem' },
    { username: 'auditor', password: 'password123', role: 'AUDITOR', team: 'ALL', display_name: 'Kiểm Toán Viên' }
  ];

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel('User') private readonly userModel: Model<IUser>
  ) {}

  async login(username: string, pass: string) {
    const cleanUser = username.toLowerCase().trim();

    // 1. Check dynamic DB user first
    let dbUser = await this.userModel.findOne({ username: cleanUser, status: 'ACTIVE' }).exec();
    
    // 2. Check predefined defaults if not in DB or matched preset
    const preset = this.defaultUsers.find(
      (u) => u.username === cleanUser && u.password === pass
    );

    let finalRole = 'MEMBER';
    let finalTeam = 'ALL';
    let finalDisplayName = cleanUser;

    if (dbUser && dbUser.password_hash === pass) {
      finalRole = dbUser.role;
      finalTeam = dbUser.team || 'ALL';
      finalDisplayName = dbUser.display_name || dbUser.username;
    } else if (preset) {
      finalRole = preset.role;
      finalTeam = preset.team;
      finalDisplayName = preset.display_name;
    } else {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const payload: UserPayload = { 
      username: cleanUser, 
      role: finalRole, 
      team: finalTeam,
      display_name: finalDisplayName 
    };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        username: cleanUser,
        role: finalRole,
        team: finalTeam,
        display_name: finalDisplayName
      }
    };
  }

  async validateUser(payload: UserPayload) {
    return { 
      username: payload.username, 
      role: payload.role, 
      team: payload.team || 'ALL',
      display_name: payload.display_name 
    };
  }
}
