import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './common/database/db.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { QueueModule } from './common/queue/queue.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { ScanModule } from './modules/scan/scan.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { BackupModule } from './modules/backup/backup.module.js';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/arms?replicaSet=rs0'),
    DbModule,
    CryptoModule,
    QueueModule,
    AuthModule,
    AuditModule,
    ScanModule,
    AccountsModule,
    ExportsModule,
    IntegrationsModule,
    BackupModule,
    ApiKeysModule,
    UsersModule,
    TeamsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
