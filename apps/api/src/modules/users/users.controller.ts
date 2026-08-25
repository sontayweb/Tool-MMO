import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('OWNER', 'MANAGER')
  async listUsers() {
    return this.usersService.listUsers();
  }

  @Post()
  @Roles('OWNER')
  async createUser(
    @Body() body: {
      username: string;
      password: string;
      role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | 'AUDITOR';
      team: string;
      display_name?: string;
    },
    @Request() req: any
  ) {
    return this.usersService.createUser(
      body,
      { username: req.user.username, role: req.user.role }
    );
  }

  @Patch(':id')
  @Roles('OWNER')
  async updateUser(
    @Param('id') id: string,
    @Body() body: {
      password?: string;
      role?: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | 'AUDITOR';
      team?: string;
      display_name?: string;
      status?: 'ACTIVE' | 'DISABLED';
    },
    @Request() req: any
  ) {
    return this.usersService.updateUser(
      id,
      body,
      { username: req.user.username, role: req.user.role }
    );
  }

  @Delete(':id')
  @Roles('OWNER')
  async deleteUser(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.usersService.deleteUser(
      id,
      { username: req.user.username, role: req.user.role }
    );
  }

  @Get('teams/list')
  @Roles('OWNER', 'MANAGER', 'MEMBER')
  async listTeams() {
    return this.usersService.listTeams();
  }
}
