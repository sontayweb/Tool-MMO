import { Module } from '@nestjs/common';
import { ScanModule } from '../scan/scan.module.js';
import { BackupModule } from '../backup/backup.module.js';
import { GoogleSheetsController } from './google-sheets.controller.js';
import { ShopeeDriveService } from './shopee-drive.service.js';
import { ShopeeDriveController } from './shopee-drive.controller.js';
import { TikTokDriveService } from './tiktok-drive.service.js';
import { TikTokDriveController } from './tiktok-drive.controller.js';

@Module({
  imports: [ScanModule, BackupModule],
  controllers: [GoogleSheetsController, ShopeeDriveController, TikTokDriveController],
  providers: [ShopeeDriveService, TikTokDriveService],
  exports: [ShopeeDriveService, TikTokDriveService]
})
export class IntegrationsModule {}
