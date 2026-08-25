import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service.js';
import { ExportsController } from './exports.controller.js';

@Module({
  providers: [ExportsService],
  controllers: [ExportsController],
  exports: [ExportsService]
})
export class ExportsModule {}
