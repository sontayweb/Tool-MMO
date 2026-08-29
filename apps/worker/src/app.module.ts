import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DbModule } from './common/database/db.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { QueueModule } from './common/queue/queue.module.js';
import { ScanProcessor } from './scan.processor.js';
import { ExportProcessor } from './export.processor.js';
import { SanitizationProcessor } from './sanitization.processor.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/arms?replicaSet=rs0'),
    DbModule,
    CryptoModule,
    QueueModule,
    ScheduleModule.forRoot()
  ],
  providers: [ScanProcessor, ExportProcessor, SanitizationProcessor]
})
export class AppModule {}
