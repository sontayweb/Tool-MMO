import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShopeeDriveService } from './shopee-drive.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['integrations/shopee-drive', 'integrations/google-drive'])
export class ShopeeDriveController {
  constructor(private readonly shopeeDriveService: ShopeeDriveService) {}

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái kết nối và tiến trình đồng bộ Shopee Drive thời gian thực' })
  async getStatus() {
    return this.shopeeDriveService.getStatus();
  }

  @Get('auth-url')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Tạo URL OAuth 2.0 để liên kết tài khoản Google Drive mới' })
  async getAuthUrl() {
    const url = this.shopeeDriveService.getAuthUrl();
    return { auth_url: url };
  }

  @Post('sync-now')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Kích hoạt quét và đồng bộ toàn bộ file Shopee từ Google Drive' })
  async triggerSync(@Request() req: any) {
    const actor = req.user?.display_name || req.user?.username || 'ADMIN';
    return this.shopeeDriveService.triggerSync({ actor });
  }

  @Post('settings')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Cập nhật cấu hình tự động quét theo lịch (Auto Sync Shopee)' })
  async updateSettings(@Body() body: { auto_sync_enabled?: boolean; sync_interval_minutes?: number }) {
    return this.shopeeDriveService.updateSettings(body);
  }
}
