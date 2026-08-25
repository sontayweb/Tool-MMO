import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { Team, TeamSchema } from './schemas/team.schema.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Team.name, schema: TeamSchema }]),
    AuditModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
