import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job } from 'bullmq';
import { IAccount, IExportJob, CryptoService } from '@arms/shared';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Processor('export-queue')
export class ExportProcessor extends WorkerHost {
  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    @InjectModel('ExportJob') private readonly exportJobModel: Model<any>,
    private readonly cryptoService: CryptoService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { jobId, filter, format, columns, managedBy } = job.data;
    console.log(`Processing export job ${jobId}. Format: ${format}, Creator: ${managedBy}`);

    const exportJob = await this.exportJobModel.findById(jobId);
    if (!exportJob) {
      throw new Error(`ExportJob ${jobId} not found`);
    }

    exportJob.status = 'RUNNING';
    await exportJob.save();

    // Create exports directory
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    try {
      // Build mongo filter
      const mongoFilter: any = {};
      if (filter.status) mongoFilter.status = filter.status;
      if (filter.source_file) mongoFilter['metadata.source_file'] = filter.source_file;
      if (filter.source_sheet) mongoFilter['metadata.source_sheet'] = filter.source_sheet;
      if (filter.managed_by) mongoFilter['metadata.managed_by'] = filter.managed_by;
      if (filter.batch_id) mongoFilter['metadata.batch_id'] = filter.batch_id;
      if (filter.search) {
        mongoFilter.username = { $regex: filter.search, $options: 'i' };
      }

      // Fetch accounts matching filter
      const accounts = await this.accountModel.find(mongoFilter).exec();
      const totalRows = accounts.length;

      if (totalRows === 0) {
        exportJob.status = 'COMPLETED';
        exportJob.total_rows = 0;
        exportJob.completed_at = new Date();
        await exportJob.save();
        return { totalRows: 0 };
      }

      let filePath = '';
      let fileExt = '';

      if (format.startsWith('txt')) {
        fileExt = '.txt';
        filePath = path.join(exportDir, `export-${jobId}${fileExt}`);
        const writeStream = fs.createWriteStream(filePath);

        for (const acc of accounts) {
          const u = acc.username;
          const p = acc.password_enc ? this.cryptoService.decrypt(acc.password_enc) : '';
          const c = acc.cookie_enc ? this.cryptoService.decrypt(acc.cookie_enc) : '';
          const t = acc.token_enc ? this.cryptoService.decrypt(acc.token_enc) : '';
          const e = acc.email || '';
          const ep = acc.email_password_enc ? this.cryptoService.decrypt(acc.email_password_enc) : '';

          let line = '';
          if (format === 'txt_user_pass') {
            line = `${u}|${p}`;
          } else {
            // txt_all
            line = `${u}|${p}|${c}|${t}|${e}|${ep}`;
          }
          writeStream.write(line + '\r\n');
        }

        await new Promise((resolve, reject) => {
          writeStream.end();
          writeStream.on('finish', () => resolve(true));
          writeStream.on('error', reject);
        });
      } else {
        // excel
        fileExt = '.xlsx';
        filePath = path.join(exportDir, `export-${jobId}${fileExt}`);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Exported Accounts');

        // Setup headers
        const headerRow = columns && columns.length > 0
          ? columns
          : ['Username', 'Password', 'Cookie', 'Token', 'Email', 'Email Password', 'Status', 'Source File', 'Source Sheet'];

        worksheet.addRow(headerRow);

        for (const acc of accounts) {
          const rowData: any[] = [];
          
          headerRow.forEach((colName: string) => {
            const normalizedCol = colName.toLowerCase().replace(/\s/g, '');
            if (normalizedCol.includes('username') || normalizedCol === 'user') {
              rowData.push(acc.username);
            } else if (normalizedCol.includes('password') || normalizedCol === 'pass') {
              rowData.push(acc.password_enc ? this.cryptoService.decrypt(acc.password_enc) : '');
            } else if (normalizedCol.includes('cookie')) {
              rowData.push(acc.cookie_enc ? this.cryptoService.decrypt(acc.cookie_enc) : '');
            } else if (normalizedCol.includes('token')) {
              rowData.push(acc.token_enc ? this.cryptoService.decrypt(acc.token_enc) : '');
            } else if (normalizedCol.includes('emailpassword') || normalizedCol === 'passmail') {
              rowData.push(acc.email_password_enc ? this.cryptoService.decrypt(acc.email_password_enc) : '');
            } else if (normalizedCol.includes('email') || normalizedCol === 'mail') {
              rowData.push(acc.email || '');
            } else if (normalizedCol === 'status') {
              rowData.push(acc.status);
            } else if (normalizedCol.includes('sourcefile')) {
              rowData.push(acc.metadata.source_file || '');
            } else if (normalizedCol.includes('sourcesheet')) {
              rowData.push(acc.metadata.source_sheet || '');
            } else {
              rowData.push('');
            }
          });

          worksheet.addRow(rowData);
        }

        await workbook.xlsx.writeFile(filePath);
      }

      // Update ExportJob
      exportJob.status = 'COMPLETED';
      exportJob.total_rows = totalRows;
      exportJob.file_path = filePath;
      exportJob.download_url = `/api/exports/${jobId}/download`;
      exportJob.completed_at = new Date();
      await exportJob.save();

      // Mark matched accounts' consumption
      const accountIds = accounts.map(a => a._id);
      const shouldMarkUsed = !!exportJob.mark_as_used_after_export || !!job.data.markAsUsed;
      
      const updateDoc: any = {
        $set: {
          'consumption.exported_at': new Date(),
          'consumption.exported_by': managedBy
        },
        $push: {
          history: {
            action: 'EXPORTED',
            actor_id: managedBy,
            timestamp: new Date(),
            note: `Export Job ${jobId}`
          }
        }
      };

      if (shouldMarkUsed) {
        updateDoc.$set.status = 'USED';
        updateDoc.$push.history = {
          action: 'MARKED_USED_AFTER_EXPORT',
          actor_id: managedBy,
          timestamp: new Date(),
          note: `Tự động chuyển trạng thái USED sau khi xuất kho Job ${jobId}`
        };
      }

      await this.accountModel.updateMany(
        { _id: { $in: accountIds } },
        updateDoc
      );

      console.log(`Export job ${jobId} finished. Written ${totalRows} rows to ${filePath}`);

      return {
        totalRows,
        filePath
      };
    } catch (err: any) {
      console.error(`Error processing export job ${jobId}:`, err);
      exportJob.status = 'FAILED';
      exportJob.error_message = err?.message || 'Unknown processing error';
      exportJob.completed_at = new Date();
      await exportJob.save();
      throw err;
    }
  }
}
