import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IAccount } from '@arms/shared';

@Injectable()
export class SanitizationProcessor {
  private readonly logger = new Logger(SanitizationProcessor.name);

  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sanitizeDatabase() {
    this.logger.log('Bắt đầu tiến trình dọn dẹp Database (Sanitization Cronjob)...');

    try {
      // Find accounts that are AVAILABLE but have suspicious usernames
      // Example criteria: username starts with M.C, or contains |, or is excessively long
      const corruptedQuery = {
        status: 'AVAILABLE',
        $or: [
          { username: { $regex: /^M\.C/i } },
          { username: { $regex: /\|/ } },
          { $expr: { $gt: [{ $strLenCP: "$username" }, 60] } }
        ]
      };

      const result = await this.accountModel.updateMany(corruptedQuery, {
        $set: {
          status: 'ERROR',
          'quality.has_cookie': false,
          'quality.has_token': false,
          'quality.last_check_at': new Date(),
          'quality.last_check_result': 'Auto-detected as corrupted during nightly sanitization'
        },
        $addToSet: {
          'quality.parse_errors': 'Corrupted username format detected',
          tags: 'auto_corrupted'
        }
      });

      this.logger.log(`Hoàn tất dọn dẹp! Đã cô lập ${result.modifiedCount} tài khoản lỗi.`);
    } catch (error: any) {
      this.logger.error(`Lỗi trong tiến trình dọn dẹp: ${error.message}`, error.stack);
    }
  }
}
