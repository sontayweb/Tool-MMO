import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountSchema, ScanBatchSchema, ExportJobSchema, AuditLogSchema, UserSchema } from '@arms/shared';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Account', schema: AccountSchema },
      { name: 'ScanBatch', schema: ScanBatchSchema },
      { name: 'ExportJob', schema: ExportJobSchema },
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'User', schema: UserSchema }
    ])
  ],
  exports: [MongooseModule]
})
export class DbModule {}
