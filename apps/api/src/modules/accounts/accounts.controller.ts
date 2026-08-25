import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('stats')
  async getStats() {
    return this.accountsService.getStats();
  }

  @Post('lookup-bulk')
  async lookupBulk(
    @Body() body: { usernames: string[] },
    @Request() req: any
  ) {
    const role = req.user.role;
    const usernames = Array.isArray(body.usernames) ? body.usernames : [];
    return this.accountsService.lookupBulk(usernames, role);
  }

  @Get()
  async getAccounts(
    @Query('platform') platform?: string,
    @Query('machine_id') machine_id?: string,
    @Query('status') status?: string,
    @Query('source_file') source_file?: string,
    @Query('source_sheet') source_sheet?: string,
    @Query('managed_by') managed_by?: string,
    @Query('team') team?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('batch_id') batch_id?: string,
    @Query('search') search?: string,
    @Query('has_cookie') has_cookie?: string,
    @Query('has_email') has_email?: string,
    @Query('has_token') has_token?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Request() req?: any
  ) {
    const user = req.user || { role: 'VIEWER', team: 'ALL' };
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    
    return this.accountsService.findAll({
      platform,
      machine_id,
      status,
      source_file,
      source_sheet,
      managed_by,
      team,
      date_from,
      date_to,
      batch_id,
      search,
      has_cookie,
      has_email,
      has_token,
      tags,
      limit: parsedLimit,
      skip: parsedSkip
    }, user);
  }

  @Get('analytics')
  @Roles('OWNER', 'MANAGER')
  async getAnalytics() {
    return this.accountsService.getAnalyticsSummary();
  }

  @Get('analytics/time-series')
  @Roles('OWNER', 'MANAGER')
  async getTimeSeriesAnalytics(@Query('period') period?: '7d' | '30d' | '90d') {
    return this.accountsService.getTimeSeriesAnalytics(period);
  }

  @Get('duplicates/scan')
  @Roles('OWNER', 'MANAGER')
  async scanDuplicates() {
    return this.accountsService.scanDuplicates();
  }

  @Post('duplicates/clean')
  @Roles('OWNER')
  async cleanDuplicates(@Request() req: any) {
    return this.accountsService.cleanDuplicates({
      username: req.user.username,
      role: req.user.role
    });
  }

  @Get(':username')
  async getAccount(
    @Param('username') username: string,
    @Request() req: any
  ) {
    const role = req.user.role;
    return this.accountsService.getByUsername(username, role);
  }

  @Post('mark-sold')
  @Roles('OWNER', 'MANAGER')
  async markSold(
    @Body() body: { usernames: string[]; sold_to?: string; order_id?: string; note?: string },
    @Request() req: any
  ) {
    return this.accountsService.markSold(body.usernames || [], body, req.user);
  }

  @Post('mark-used')
  @Roles('OWNER', 'MANAGER')
  async markUsed(
    @Body() body: { usernames: string[]; note?: string },
    @Request() req: any
  ) {
    return this.accountsService.markUsed(body.usernames || [], body.note || '', req.user);
  }

  @Post('blacklist')
  @Roles('OWNER', 'MANAGER')
  async blacklist(
    @Body() body: { usernames: string[]; note?: string },
    @Request() req: any
  ) {
    return this.accountsService.blacklist(body.usernames || [], body.note || '', req.user);
  }

  @Post('bulk-tag')
  @Roles('OWNER', 'MANAGER')
  async bulkTag(
    @Body() body: { usernames: string[]; tags: string[]; operation?: 'ADD' | 'REMOVE' | 'SET' },
    @Request() req: any
  ) {
    return this.accountsService.bulkTag(
      body.usernames || [],
      body.tags || [],
      body.operation || 'ADD',
      req.user
    );
  }

  // ----------------------------------------------------------------
  // INGEST API: Dành cho shopee_checker_project & tool ngoại vi
  // ----------------------------------------------------------------
  @Post('ingest')
  async ingestAccounts(
    @Body() body: any,
    @Request() req: any
  ) {
    const actor = req.user || { username: 'API_INGEST', role: 'MANAGER' };
    const accounts = Array.isArray(body) ? body : (body.accounts || [body]);
    return this.accountsService.ingestAccounts({ accounts }, actor);
  }

  // ----------------------------------------------------------------
  // CONSUME API: Dành cho Web Shop bán lẻ (dichvutaikhoanao)
  // ----------------------------------------------------------------
  @Post('consume')
  async consumeAccounts(
    @Body() body: {
      platform?: string;
      quantity: number;
      health_status?: string;
      team?: string;
      sold_to?: string;
      order_id?: string;
      note?: string;
    },
    @Request() req: any
  ) {
    const actor = req.user || { username: 'API_CONSUMER', role: 'MANAGER' };
    return this.accountsService.consumeAccounts(body, actor);
  }

  // ----------------------------------------------------------------
  // PATCH: Cập nhật thông tin 1 tài khoản
  // ----------------------------------------------------------------
  @Patch(':username')
  @Roles('OWNER', 'MANAGER')
  async updateAccount(
    @Param('username') username: string,
    @Body() body: any,
    @Request() req: any
  ) {
    return this.accountsService.updateAccount(username, body, req.user);
  }
}


