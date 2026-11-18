import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AccountsSanitationService } from './accounts-sanitation.service.js';
import { AccountsExportService } from './accounts-export.service.js';
import { AccountsCheckerService } from './accounts-checker.service.js';
import { AccountsController } from './accounts.controller.js';
import { BackupModule } from '../backup/backup.module.js';

@Module({
  imports: [BackupModule],
  providers: [AccountsService, AccountsSanitationService, AccountsExportService, AccountsCheckerService],
  controllers: [AccountsController],
  exports: [AccountsService, AccountsSanitationService, AccountsExportService, AccountsCheckerService]
})
export class AccountsModule {}

