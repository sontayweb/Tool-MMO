import { Controller, Post, Get, Param, Query, UseGuards, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ScanService } from './scan.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Setup uploads folder
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('upload')
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
      })
    })
  )
  async uploadFile(@UploadedFile() file: any, @Request() req: any) {
    const actor = req.user;
    return this.scanService.createBatch(
      file.originalname,
      file.size,
      actor.username,
      file.path
    );
  }

  @Post('upload-offline')
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, 'offline-' + uniqueSuffix + path.extname(file.originalname));
        }
      })
    })
  )
  async uploadOffline(
    @UploadedFile() file: any,
    @Request() req: any
  ) {
    const actor = req.user;
    const mode = (req.body?.mode === 'commit') ? 'commit' : 'preview';
    return this.scanService.processOfflineFile(
      file.path,
      file.originalname,
      actor.username,
      mode
    );
  }

  @Get('batches')
  async getBatches(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    return this.scanService.getBatches(parsedLimit, parsedSkip);
  }

  @Get('batches/:id')
  async getBatch(@Param('id') id: string) {
    return this.scanService.getBatch(id);
  }

  @Get('batches/:id/errors')
  async getBatchErrors(@Param('id') id: string) {
    return this.scanService.getBatchErrors(id);
  }
}
