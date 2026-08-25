import { 
  Controller, Get, Post, Delete, Param, Body, Res, 
  UseGuards, Request, StreamableFile 
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { BackupService } from './backup.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  @Roles('OWNER', 'MANAGER')
  async createSnapshot(
    @Body() body: { note?: string },
    @Request() req: any
  ) {
    return this.backupService.createSnapshot(
      { username: req.user.username, role: req.user.role },
      body?.note
    );
  }

  @Get('list')
  @Roles('OWNER', 'MANAGER')
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('download/:fileName')
  @Roles('OWNER', 'MANAGER')
  async downloadBackup(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const filePath = this.backupService.getBackupFilePath(fileName);
    const fileStream = fs.createReadStream(filePath);
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(fileStream);
  }

  @Post('restore/:fileName')
  @Roles('OWNER')
  async restoreSnapshot(
    @Param('fileName') fileName: string,
    @Request() req: any
  ) {
    return this.backupService.restoreSnapshot(
      fileName,
      { username: req.user.username, role: req.user.role }
    );
  }

  @Delete(':fileName')
  @Roles('OWNER')
  async deleteBackup(
    @Param('fileName') fileName: string,
    @Request() req: any
  ) {
    return this.backupService.deleteBackup(
      fileName,
      { username: req.user.username, role: req.user.role }
    );
  }
}
