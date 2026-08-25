import { Controller, Post, Get, Body, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ScanService } from '../scan/scan.service.js';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Controller('integrations/google-sheets')
export class GoogleSheetsController {
  constructor(
    private readonly scanService: ScanService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  @Post('sync')
  async syncSheets(@Headers() headers: Record<string, string>, @Body() body: any) {
    this.verifyAuthentication(headers, body);

    const { spreadsheetId, spreadsheetName, tabs } = body;

    if (!spreadsheetId || !spreadsheetName || !tabs || !Array.isArray(tabs)) {
      throw new BadRequestException('Invalid payload. Missing spreadsheetId, spreadsheetName, or tabs.');
    }

    // Create ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    const existingNames = new Set<string>();

    for (let tIdx = 0; tIdx < tabs.length; tIdx++) {
      const tab = tabs[tIdx];
      if (!tab.sheetName || !tab.rows || !Array.isArray(tab.rows)) {
        continue;
      }
      // Clean forbidden characters and cap at 31 chars
      let safeName = String(tab.sheetName)
        .replace(/[*?:\\/\[\]]/g, '-')
        .trim()
        .substring(0, 31);
      
      if (!safeName) safeName = `Tab_${tIdx + 1}`;
      if (existingNames.has(safeName)) {
        safeName = `${safeName.substring(0, 26)}_${tIdx + 1}`;
      }
      existingNames.add(safeName);

      const worksheet = workbook.addWorksheet(safeName);
      
      for (const row of tab.rows) {
        worksheet.addRow(row);
      }
    }

    // Save to temp file
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const tempFileName = `google-sheets-${uniqueSuffix}.xlsx`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, tempFileName);
    await workbook.xlsx.writeFile(filePath);
    
    const stats = fs.statSync(filePath);

    // Trigger scanning batch
    const managedBy = body.actor?.name || 'Google Sheets';
    const batch = await this.scanService.createBatch(
      `Google Sheets: ${spreadsheetName}`,
      stats.size,
      managedBy,
      filePath,
      {
        callbackUrl: body.callbackUrl,
        spreadsheetId: spreadsheetId
      }
    );

    // Count received stats
    const receivedTabs = tabs.length;
    let receivedRows = 0;
    for (const tab of tabs) {
      receivedRows += tab.rows ? tab.rows.length : 0;
    }

    return {
      ok: true,
      batchId: batch._id.toString(),
      status: 'QUEUED',
      summary: {
        receivedTabs,
        receivedRows,
        acceptedRows: receivedRows,
        rejectedRows: 0
      },
      message: 'Scan batch queued successfully'
    };
  }

  @Post('save-sheet-index')
  async saveSheetIndex(@Headers() headers: Record<string, string>, @Body() body: any) {
    this.verifyAuthentication(headers, body);
    const { sheets } = body;
    if (!sheets || !Array.isArray(sheets)) {
      throw new BadRequestException('Missing sheets array in body');
    }

    if (!this.connection.db) {
      throw new BadRequestException('Database connection not ready');
    }

    const collection = this.connection.db.collection('discovered_sheets');
    const bulkOps = sheets.map((item) => ({
      updateOne: {
        filter: { fileId: item.fileId, tabName: item.tabName },
        update: {
          $set: {
            fileName: item.fileName,
            tabName: item.tabName,
            fileUrl: item.fileUrl,
            fileId: item.fileId,
            timestamp: item.timestamp,
            owner: item.owner,
            lastUpdated: item.lastUpdated,
            importStatus: item.importStatus || 'Chưa nhập',
            extractStatus: item.extractStatus || 'Chưa bóc tách',
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
    }

    return { ok: true, savedCount: sheets.length };
  }

  @Get('get-sheet-index')
  async getSheetIndex(@Headers() headers: Record<string, string>) {
    this.verifyAuthentication(headers, {});
    if (!this.connection.db) {
      throw new BadRequestException('Database connection not ready');
    }
    const collection = this.connection.db.collection('discovered_sheets');
    const sheets = await collection.find({}).sort({ updatedAt: -1 }).toArray();
    return { ok: true, sheets };
  }

  private verifyAuthentication(headers: Record<string, string>, body: any) {
    const signatureHeader = headers['x-arms-signature'];
    const timestampHeader = headers['x-arms-timestamp'];
    const apiKeyHeader = headers['x-arms-api-key'];

    const hmacSecret = process.env.ARMS_HMAC_SECRET;
    const apiKey = process.env.ARMS_API_KEY;

    if (hmacSecret) {
      if (!signatureHeader || !timestampHeader) {
        throw new UnauthorizedException('Missing X-ARMS-Signature or X-ARMS-Timestamp headers');
      }

      // Validate timestamp window (5 minutes)
      const timestampMs = new Date(timestampHeader).getTime();
      if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        throw new UnauthorizedException('Request timestamp is outside the allowed 5-minute window');
      }

      // Re-create the message and check signature
      const message = timestampHeader + '.' + JSON.stringify(body);
      const computedHex = crypto.createHmac('sha256', hmacSecret).update(message).digest('hex');
      const expectedSignature = 'sha256=' + computedHex;

      if (signatureHeader !== expectedSignature) {
        throw new UnauthorizedException('Invalid HMAC signature');
      }
    } else if (apiKey) {
      if (apiKeyHeader !== apiKey) {
        throw new UnauthorizedException('Invalid API Key');
      }
    } else {
      throw new UnauthorizedException('Authentication secrets (ARMS_HMAC_SECRET or ARMS_API_KEY) not configured on the server');
    }
  }
}
