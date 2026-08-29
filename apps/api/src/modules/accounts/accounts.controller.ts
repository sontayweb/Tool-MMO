import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, Request, Res } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AccountsSanitationService } from './accounts-sanitation.service.js';
import { AccountsExportService } from './accounts-export.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly sanitationService: AccountsSanitationService,
    private readonly exportService: AccountsExportService
  ) {}

  @Get('stats')
  async getStats() {
    return this.accountsService.getAnalyticsSummary();
  }

  @Get('analytics')
  @Roles('OWNER', 'MANAGER')
  async getAnalytics() {
    return this.accountsService.getAnalyticsSummary();
  }

  // ----------------------------------------------------------------
  // SANITATION HUB: Dọn dẹp & Cứu hộ
  // ----------------------------------------------------------------
  @Get('sanitation/stats')
  @Roles('OWNER', 'MANAGER')
  async getSanitationStats() {
    return this.sanitationService.getSanitationStats();
  }

  @Post('sanitation/clean')
  @Roles('OWNER', 'MANAGER')
  async cleanSanitation(
    @Body() body: { category: string; action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' },
    @Request() req: any
  ) {
    return this.sanitationService.cleanSanitation(body.category, body.action, req.user);
  }

  @Post('auto-fix')
  @Roles('OWNER', 'MANAGER')
  async autoFixCorrupted(
    @Body() body: { usernames: string[] },
    @Request() req: any
  ) {
    return this.sanitationService.autoFixCorrupted(body.usernames || [], req.user);
  }

  // ----------------------------------------------------------------
  // EXPORT EXCEL STREAMING
  // ----------------------------------------------------------------
  @Get('export/excel')
  async exportExcel(
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
    @Query('data_quality') data_quality?: string,
    @Query('tags') tags?: string,
    @Request() req?: any,
    @Res() res?: any
  ) {
    const user = req?.user || { username: 'GUEST', role: 'VIEWER', team: 'ALL' };
    return this.exportService.exportExcelStream({
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
      data_quality,
      tags
    }, user, res);
  }

  // ----------------------------------------------------------------
  // ACCOUNTS QUERY & CRUD
  // ----------------------------------------------------------------
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
    @Query('data_quality') data_quality?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Request() req?: any
  ) {
    const user = req.user || { role: 'VIEWER', team: 'ALL' };
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    console.log('[CONTROLLER GET ACCOUNTS] Query:', { platform, data_quality, status, limit, skip });

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
      data_quality,
      tags,
      limit: parsedLimit,
      skip: parsedSkip
    }, user);
  }

  @Get(':username')
  async getAccount(@Param('username') username: string, @Request() req: any) {
    return this.accountsService.findOne(username, req.user);
  }

  @Patch(':username')
  @Roles('OWNER', 'MANAGER')
  async updateAccount(
    @Param('username') username: string,
    @Body() body: any,
    @Request() req: any
  ) {
    return this.accountsService.updateAccount(username, body, req.user);
  }

  @Delete(':username')
  @Roles('OWNER', 'MANAGER')
  async deleteAccount(@Param('username') username: string, @Request() req: any) {
    return this.accountsService.deleteAccount(username, req.user);
  }

  // ----------------------------------------------------------------
  // BULK OPERATIONS
  // ----------------------------------------------------------------
  @Post('bulk-sold')
  @Roles('OWNER', 'MANAGER')
  async bulkMarkSold(
    @Body() body: { usernames: string[]; sold_to?: string; order_id?: string },
    @Request() req: any
  ) {
    return this.accountsService.bulkMarkSold(body.usernames || [], req.user, body.sold_to, body.order_id);
  }

  @Post('bulk-used')
  @Roles('OWNER', 'MANAGER')
  async bulkMarkUsed(
    @Body() body: { usernames: string[]; used_for?: string },
    @Request() req: any
  ) {
    return this.accountsService.bulkMarkUsed(body.usernames || [], req.user, body.used_for);
  }

  @Post('bulk-blacklist')
  @Roles('OWNER', 'MANAGER')
  async bulkBlacklist(
    @Body() body: { usernames: string[]; note?: string },
    @Request() req: any
  ) {
    return this.accountsService.bulkBlacklist(body.usernames || [], req.user, body.note);
  }

  @Post('bulk-delete')
  @Roles('OWNER', 'MANAGER')
  async bulkDelete(
    @Body() body: { usernames: string[] },
    @Request() req: any
  ) {
    return this.accountsService.bulkDelete(body.usernames || [], req.user);
  }

  // ----------------------------------------------------------------
  // RECYCLE BIN ENDPOINTS
  // ----------------------------------------------------------------
  @Post('trash/restore')
  @Roles('OWNER', 'MANAGER')
  async restoreFromTrash(
    @Body() body: { usernames: string[] },
    @Request() req: any
  ) {
    return this.accountsService.restoreFromTrash(body.usernames || [], req.user);
  }

  @Post('trash/empty')
  @Roles('OWNER')
  async emptyTrash(@Request() req: any) {
    return this.accountsService.emptyTrash(req.user);
  }

  // ----------------------------------------------------------------
  // INGEST API
  // ----------------------------------------------------------------
  @Post('ingest')
  async ingestAccounts(
    @Body() body: any,
    @Request() req: any
  ) {
    const actor = req.user || { username: 'API_INGEST', role: 'MANAGER' };
    const accounts = Array.isArray(body) ? body : (body.accounts || [body]);
    return this.accountsService.ingestAccounts(accounts, actor);
  }
}
