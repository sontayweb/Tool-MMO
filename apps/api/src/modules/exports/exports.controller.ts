import { Controller, Post, Get, Param, Body, Query, UseGuards, Request, Res, BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { ExportsService } from './exports.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @Roles('OWNER', 'MANAGER')
  async createExport(
    @Body() body: { filter: any; format: string; columns?: string[] },
    @Request() req: any
  ) {
    return this.exportsService.createJob(
      body.filter || {},
      body.format || 'txt_all',
      body.columns || [],
      req.user.username
    );
  }

  @Get()
  async getExports(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    return this.exportsService.getJobs(parsedLimit, parsedSkip);
  }

  @Get(':id')
  async getExport(@Param('id') id: string) {
    return this.exportsService.getJob(id);
  }

  @Get(':id/download')
  @Roles('OWNER', 'MANAGER')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const job = await this.exportsService.getJob(id);
    if (job.status !== 'COMPLETED' || !job.file_path) {
      throw new BadRequestException('Tệp xuất dữ liệu chưa sẵn sàng');
    }
    if (!fs.existsSync(job.file_path)) {
      throw new NotFoundException('Không tìm thấy tệp trên ổ đĩa');
    }
    res.download(job.file_path);
  }
}
