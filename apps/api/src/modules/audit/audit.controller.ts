import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('OWNER', 'AUDITOR', 'MANAGER', 'VIEWER')
  async getLogs(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    return this.auditService.getLogs(parsedLimit, parsedSkip);
  }

  @Get('system-logs')
  async getSystemLogs(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 150;
    return this.auditService.getUnifiedSystemLogs(parsedLimit);
  }
}
