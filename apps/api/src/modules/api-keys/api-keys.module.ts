import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeySchema } from './schemas/api-key.schema.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeysController } from './api-keys.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ApiKey', schema: ApiKeySchema }
    ]),
    AuditModule
  ],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService]
})
export class ApiKeysModule {}
