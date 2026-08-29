import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAccount, CryptoService, AccountParser, UsernameNormalizer, PlatformRules } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';
import { BackupService } from '../backup/backup.service.js';

@Injectable()
export class AccountsSanitationService {
  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
    private readonly backupService: BackupService
  ) {}

  /**
   * Get real-time health and sanitation statistics
   */
  async getSanitationStats() {
    const [missingCoreCount, corruptedCount, blacklistedCount, duplicatesCount, trashCount] = await Promise.all([
      // 1. Missing Core Data (No Cookie AND No Password)
      this.accountModel.countDocuments(PlatformRules.getMissingCoreMongoFilter()),
      // 2. Corrupted / Junk records violating Domain Rules
      this.accountModel.countDocuments(PlatformRules.getCorruptedMongoFilter()),
      // 3. Blacklisted
      this.accountModel.countDocuments({ status: 'BLACKLISTED' }),
      // 4. Duplicates
      this.accountModel.aggregate([
        {
          $group: {
            _id: { platform: '$platform', username_normalized: '$username_normalized' },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 }, '_id.username_normalized': { $ne: null } } },
        { $count: 'total_groups' }
      ]).then(res => res[0]?.total_groups || 0),
      // 5. Trash
      this.accountModel.countDocuments({ status: 'TRASH' })
    ]);

    return {
      missing_core: missingCoreCount,
      corrupted: corruptedCount,
      blacklisted: blacklistedCount,
      duplicates: duplicatesCount,
      trash: trashCount
    };
  }

  /**
   * Bulk clean or auto-fix corrupted accounts
   */
  async cleanSanitation(
    category: string,
    action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' | 'HARD_DELETE',
    actor: { username: string; role: string }
  ) {
    await this.backupService.ensurePreDestructiveSnapshot(`Sanitation clean: ${category}`, actor);

    let filter: Record<string, any> = {};
    if (category === 'missing_core') {
      filter = PlatformRules.getMissingCoreMongoFilter();
    } else if (category === 'corrupted' || category === 'corrupted_username') {
      filter = PlatformRules.getCorruptedMongoFilter();
    } else if (category === 'blacklisted') {
      filter = { status: 'BLACKLISTED' };
    } else if (category === 'trash') {
      filter = { status: 'TRASH' };
    } else {
      throw new Error(`Category ${category} not supported for bulk action`);
    }

    let resultCount = 0;
    if (action === 'DELETE') {
      // Soft delete to TRASH
      const result = await this.accountModel.updateMany(filter, {
        $set: { status: 'TRASH', deleted_at: new Date(), deleted_by: actor.username }
      });
      resultCount = result.modifiedCount;
    } else if (action === 'HARD_DELETE') {
      const result = await this.accountModel.deleteMany(filter);
      resultCount = result.deletedCount;
    } else if (action === 'BLACKLIST') {
      const result = await this.accountModel.updateMany(filter, { $set: { status: 'BLACKLISTED' } });
      resultCount = result.modifiedCount;
    } else if (action === 'AUTO_FIX') {
      const docsToFix = await this.accountModel.find(filter, { username: 1 }).lean();
      const usernames = docsToFix.map(doc => doc.username);
      if (usernames.length > 0) {
        const fixResult = await this.autoFixCorrupted(usernames, actor);
        resultCount = fixResult.fixed + fixResult.failed_duplicate + fixResult.failed_parse;

        await this.auditService.record({
          action: 'SANITATION_AUTO_FIX',
          actor_id: actor.username,
          actor_username: actor.username,
          details: { category, action, count: usernames.length, fixResult }
        });

        return { success: true, category, action, count: resultCount, details: fixResult };
      }
      return { success: true, category, action, count: 0 };
    }

    await this.auditService.record({
      action: 'SANITATION_CLEAN',
      actor_id: actor.username,
      actor_username: actor.username,
      details: { category, action, count: resultCount }
    });

    return { success: true, category, action, count: resultCount };
  }

  /**
   * On-Demand Auto Fix Algorithm for unparsed / corrupted rows
   */
  async autoFixCorrupted(usernames: string[], actor: { username: string; role: string }) {
    if (!usernames || usernames.length === 0) return { fixed: 0, failed_duplicate: 0, failed_parse: 0 };

    const accounts = await this.accountModel.find({ username: { $in: usernames } });
    if (accounts.length === 0) return { fixed: 0, failed_duplicate: 0, failed_parse: 0 };

    let fixedCount = 0;
    let failedDuplicateCount = 0;
    let failedParseCount = 0;

    for (const acc of accounts) {
      if (!acc.raw || !acc.raw.values) {
        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: { status: 'BLACKLISTED' },
            $addToSet: { tags: 'unfixable_no_raw' }
          }
        );
        failedParseCount++;
        continue;
      }

      // 1. Chạy lại bộ bóc tách thông minh
      const parsed = AccountParser.parseRow(acc.raw.values);
      if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
        // Dòng này chỉ chứa Token session / STT hoặc dữ liệu rác, không chứa Username thực
        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: { status: 'BLACKLISTED' },
            $addToSet: { tags: 'unfixable_invalid_username' },
            $push: {
              history: {
                action: 'AUTO_FIX_UNFIXABLE',
                actor_id: actor.username,
                timestamp: new Date(),
                note: `Không thể khôi phục do dòng dữ liệu gốc không chứa Username hợp lệ theo quy luật nền tảng`
              }
            }
          }
        );
        failedParseCount++;
        continue;
      }

      // 2. Chuẩn hóa lại username
      const newNormalized = UsernameNormalizer.normalize(parsed.username);
      if (!newNormalized) {
        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: { status: 'BLACKLISTED' },
            $addToSet: { tags: 'unfixable_invalid_username' }
          }
        );
        failedParseCount++;
        continue;
      }

      // 3. Kiểm tra xem username khôi phục này đã có trong kho chưa (tránh trùng khóa)
      const exists = await this.accountModel.exists({
        _id: { $ne: acc._id },
        username_normalized: newNormalized,
        platform: parsed.platform || acc.platform
      });

      if (exists) {
        // Trùng lặp với nick đã có -> Đưa vào blacklist để dọn dẹp
        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: { status: 'BLACKLISTED' },
            $addToSet: { tags: 'fix_failed_duplicate' },
            $push: {
              history: {
                action: 'AUTO_FIX_DUPLICATE',
                actor_id: actor.username,
                timestamp: new Date(),
                note: `Khôi phục thất bại do trùng lặp với username: ${parsed.username}`
              }
            }
          }
        );
        failedDuplicateCount++;
      } else {
        const hasCoreCreds = !!(parsed.password || parsed.cookie || parsed.token);
        const targetStatus = hasCoreCreds ? 'AVAILABLE' : 'BLACKLISTED';

        const updateData: any = {
          $set: {
            username: parsed.username,
            username_normalized: newNormalized,
            platform: parsed.platform || acc.platform,
            status: targetStatus,
            'quality.has_cookie': !!parsed.cookie,
            'quality.has_token': !!parsed.token,
            'quality.has_email': !!parsed.email
          },
          $pull: { tags: 'auto_corrupted' },
          $push: {
            history: {
              action: hasCoreCreds ? 'AUTO_FIX_SUCCESS' : 'AUTO_FIX_NO_CREDS',
              actor_id: actor.username,
              timestamp: new Date(),
              note: hasCoreCreds
                ? `Cứu hộ thành công. Cập nhật lại username từ ${acc.username} thành ${parsed.username}`
                : `Dữ liệu không có Password/Cookie/Token, tự động đưa vào Blacklist`
            }
          }
        };

        if (parsed.cookie) updateData.$set.cookie_enc = this.cryptoService.encrypt(parsed.cookie);
        if (parsed.token) updateData.$set.token_enc = this.cryptoService.encrypt(parsed.token);
        if (parsed.password) updateData.$set.password_enc = this.cryptoService.encrypt(parsed.password);

        await this.accountModel.updateOne({ _id: acc._id }, updateData);
        if (hasCoreCreds) {
          fixedCount++;
        } else {
          failedParseCount++;
        }
      }
    }

    await this.auditService.record({
      action: 'AUTO_FIX_CORRUPTED',
      actor_id: actor.username,
      actor_username: actor.username,
      details: {
        input_count: usernames.length,
        fixed: fixedCount,
        failed_duplicate: failedDuplicateCount,
        failed_parse: failedParseCount
      }
    });

    return {
      total_processed: accounts.length,
      fixed: fixedCount,
      failed_duplicate: failedDuplicateCount,
      failed_parse: failedParseCount
    };
  }
}
