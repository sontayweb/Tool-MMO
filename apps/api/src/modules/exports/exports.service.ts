import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IExportJob } from '@arms/shared';

@Injectable()
export class ExportsService {
  constructor(
    @InjectModel('ExportJob') private readonly exportJobModel: Model<IExportJob>,
    @InjectQueue('export-queue') private readonly exportQueue: Queue
  ) {}

  async createJob(
    filter: any,
    format: string,
    columns: string[],
    managedBy: string
  ) {
    const fileFormat = format.startsWith('txt') ? 'TXT' : 'XLSX';
    const job = await this.exportJobModel.create({
      status: 'PENDING',
      file_format: fileFormat,
      template_format: format,
      filters: { criteria: filter, columns },
      total_rows: 0,
      file_path: '',
      managed_by: managedBy,
      started_at: new Date()
    });

    // Enqueue export job
    await this.exportQueue.add('export-accounts', {
      jobId: job._id.toString(),
      filter,
      format,
      columns,
      managedBy
    });

    return job;
  }

  async getJobs(limit = 20, skip = 0) {
    const total = await this.exportJobModel.countDocuments();
    const jobs = await this.exportJobModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
    return { jobs, total };
  }

  async getJob(id: string) {
    const job = await this.exportJobModel.findById(id).exec();
    if (!job) {
      throw new NotFoundException('Không tìm thấy yêu cầu xuất dữ liệu');
    }
    return job;
  }
}
