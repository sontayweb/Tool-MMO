import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @Roles('OWNER', 'MANAGER')
  async listKeys() {
    return this.apiKeysService.listKeys();
  }

  @Post()
  @Roles('OWNER')
  async createKey(
    @Body() body: { name: string; scopes?: string[]; expires_in_days?: number },
    @Request() req: any
  ) {
    return this.apiKeysService.createKey(
      body,
      { username: req.user.username, role: req.user.role }
    );
  }

  @Delete(':id')
  @Roles('OWNER')
  async revokeKey(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.apiKeysService.revokeKey(
      id,
      { username: req.user.username, role: req.user.role }
    );
  }
}
