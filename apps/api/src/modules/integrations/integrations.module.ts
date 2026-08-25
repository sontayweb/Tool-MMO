import { Module } from '@nestjs/common';
import { ScanModule } from '../scan/scan.module.js';
import { GoogleSheetsController } from './google-sheets.controller.js';

@Module({
  imports: [ScanModule],
  controllers: [GoogleSheetsController]
})
export class IntegrationsModule {}
