import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TikTokDriveService } from './tiktok-drive.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/tiktok-drive')
export class TikTokDriveController {
  constructor(private readonly tikTokDriveService: TikTokDriveService) {}

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái và tiến trình cào kho TikTok từ Google Drive thời gian thực' })
  async getStatus() {
    return this.tikTokDriveService.getStatus();
  }

  @Post('sync-now')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Kích hoạt cào và chuẩn hóa toàn bộ kho TikTok từ Google Drive' })
  async triggerSync(@Request() req: any) {
    const actor = req.user?.display_name || req.user?.username || 'ADMIN';
    return this.tikTokDriveService.triggerSync({ actor });
  }
}
