import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getTeams() {
    return this.teamsService.findAll();
  }

  @Get(':code')
  async getTeam(@Param('code') code: string) {
    return this.teamsService.findOne(code);
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  async createTeam(
    @Body() body: { code: string; display_name: string; description?: string; color?: string },
    @Request() req: any
  ) {
    return this.teamsService.createTeam(body, req.user);
  }

  @Patch(':code')
  @Roles('OWNER', 'MANAGER')
  async updateTeam(
    @Param('code') code: string,
    @Body() body: { display_name?: string; description?: string; color?: string; is_active?: boolean },
    @Request() req: any
  ) {
    return this.teamsService.updateTeam(code, body, req.user);
  }

  @Delete(':code')
  @Roles('OWNER')
  async deleteTeam(@Param('code') code: string, @Request() req: any) {
    return this.teamsService.deleteTeam(code, req.user);
  }
}
