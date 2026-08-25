import { Module } from '@nestjs/common';
import { ScanService } from './scan.service.js';
import { ScanController } from './scan.controller.js';

@Module({
  providers: [ScanService],
  controllers: [ScanController],
  exports: [ScanService]
})
export class ScanModule {}
