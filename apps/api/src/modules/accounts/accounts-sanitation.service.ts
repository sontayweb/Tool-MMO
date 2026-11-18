import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAccount, CryptoService, AccountParser, UsernameNormalizer, PlatformRules, MailRules } from '@arms/shared';
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
    const rawCorruptedFilter: any = PlatformRules.getCorruptedMongoFilter();
    const corruptedFilter: any = {
      $and: [
        rawCorruptedFilter.$or ? { $or: rawCorruptedFilter.$or } : (rawCorruptedFilter.$and ? { $and: rawCorruptedFilter.$and } : rawCorruptedFilter),
        { status: { $nin: ['BLACKLISTED', 'TRASH'] } }
      ]
    };

    const [missingCoreCount, corruptedCount, blacklistedCount, duplicatesCount, trashCount] = await Promise.all([
      // 1. Missing Core Data (No Cookie AND No Password)
      this.accountModel.countDocuments(PlatformRules.getMissingCoreMongoFilter()),
      // 2. Corrupted / Junk records violating Domain Rules
      this.accountModel.countDocuments(corruptedFilter),
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
    action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' | 'HARD_DELETE' | 'RESTORE',
    actor: { username: string; role: string }
  ) {
    await this.backupService.ensurePreDestructiveSnapshot(`Sanitation clean: ${category}`, actor);

    let filter: Record<string, any> = {};
    if (category === 'missing_core') {
      filter = PlatformRules.getMissingCoreMongoFilter();
    } else if (category === 'corrupted' || category === 'corrupted_username') {
      const rawCorruptedFilter: any = PlatformRules.getCorruptedMongoFilter();
      filter = {
        $and: [
          rawCorruptedFilter.$or ? { $or: rawCorruptedFilter.$or } : (rawCorruptedFilter.$and ? { $and: rawCorruptedFilter.$and } : rawCorruptedFilter),
          { status: { $nin: ['BLACKLISTED', 'TRASH'] } }
        ]
      };
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
    } else if (action === 'RESTORE') {
      // Restore from TRASH to AVAILABLE
      const result = await this.accountModel.updateMany(filter, {
        $set: { status: 'AVAILABLE' },
        $unset: { deleted_at: 1, deleted_by: 1 }
      });
      resultCount = result.modifiedCount;
    } else if (action === 'HARD_DELETE') {
      const result = await this.accountModel.deleteMany(filter);
      resultCount = result.deletedCount;
    } else if (action === 'BLACKLIST') {
      const result = await this.accountModel.updateMany(filter, { $set: { status: 'BLACKLISTED' } });
      resultCount = result.modifiedCount;
    } else if (action === 'AUTO_FIX') {
      const fixResult = await this.autoFixByFilter(filter, actor);
      resultCount = fixResult.fixed + fixResult.failed_duplicate + fixResult.failed_parse;

      await this.auditService.record({
        action: 'SANITATION_AUTO_FIX',
        actor_id: actor.username,
        actor_username: actor.username,
        details: { category, action, count: fixResult.total, fixResult }
      });

      return { success: true, category, action, count: resultCount, details: fixResult };
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
   * Universal On-Demand Auto Fix Algorithm by filter (Streaming Cursor, no memory overflow)
   */
  async autoFixByFilter(filter: Record<string, any>, actor: { username: string; role: string }) {
    const cursor = this.accountModel.find(filter).cursor({ batchSize: 200 });

    let fixedCount = 0;
    let failedDuplicateCount = 0;
    let failedParseCount = 0;
    let totalProcessed = 0;

    for await (const acc of cursor) {
      totalProcessed++;
      let parsed: any = null;
      // Kế thừa platform từ bản ghi DB làm default_platform — TỐI THƯỢNG
      // Tránh parser tự đoán sai khi re-parse lại raw data
      const platformCtx = { default_platform: (acc as any).platform || 'SHOPEE' };
      if (acc.raw?.values && Array.isArray(acc.raw.values) && acc.raw.values.length > 0) {
        parsed = AccountParser.parseRow(acc.raw.values, 0, platformCtx);
      } else if (acc.raw?.raw_text) {
        parsed = AccountParser.parseLine(acc.raw.raw_text, 0, platformCtx);
      } else if (typeof (acc.raw as any) === 'string' && (acc.raw as any).trim()) {
        parsed = AccountParser.parseLine(acc.raw as any, 0, platformCtx);
      } else if (typeof (acc.raw as any)?.text === 'string' && (acc.raw as any).text.trim()) {
        parsed = AccountParser.parseLine((acc.raw as any).text, 0, platformCtx);
      }

      if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
        // Dòng này chỉ chứa Token session / STT hoặc dữ liệu rác, không chứa Username thực
        const isExcelJunk = /^\d{1,5}$/.test(acc.username) || ['#VALUE!', '#REF!', '-', '--', 'zz'].includes(acc.username);
        const junkTag = isExcelJunk ? 'unfixable_excel_empty_row' : 'unfixable_invalid_username';
        const cleanJunkUser = isExcelJunk ? `junk_${acc.username}_${acc._id.toString().slice(-4)}` : acc.username;

        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: {
              status: 'BLACKLISTED',
              username: cleanJunkUser,
              username_normalized: cleanJunkUser.toLowerCase()
            },
            $addToSet: { tags: junkTag },
            $push: {
              history: {
                action: 'AUTO_FIX_UNFIXABLE',
                actor_id: actor.username,
                timestamp: new Date(),
                note: isExcelJunk
                  ? `Dòng rác bảng tính Excel kéo dài thừa đuôi (${acc.username})`
                  : `Không thể khôi phục do dòng dữ liệu gốc không chứa Username hợp lệ theo quy luật nền tảng`
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
      // Ưu tiên platform đã được parser xác định; fallback về platform gốc của bản ghi DB;
      // CẤM fallback về 'TIKTOK' — system default là 'SHOPEE'
      const targetPlatform = (parsed.platform && parsed.platform !== 'OTHER') ? parsed.platform : ((acc as any).platform || 'SHOPEE');
      const existingTarget = await this.accountModel.findOne({
        _id: { $ne: acc._id },
        username_normalized: newNormalized,
        platform: targetPlatform
      });

      if (existingTarget) {
        // ĐỒNG THUẬN TỰ CHỮA LÀNH (CONSENSUS MERGE):
        // Trước khi cô lập bản ghi trùng, kiểm tra xem bản ghi phụ có thông tin nào bản ghi chính đang thiếu không để bơm sang
        const healFields: any = {};
        if (!existingTarget.password_enc) {
          const pwEnc = parsed.password ? this.cryptoService.encrypt(parsed.password) : acc.password_enc;
          if (pwEnc) healFields.password_enc = pwEnc;
        }
        if (!existingTarget.cookie_enc) {
          const ckEnc = parsed.cookie ? this.cryptoService.encrypt(parsed.cookie) : acc.cookie_enc;
          if (ckEnc) {
            healFields.cookie_enc = ckEnc;
            healFields['quality.has_cookie'] = true;
          }
        }
        if (!existingTarget.token_enc) {
          const tkEnc = parsed.token ? this.cryptoService.encrypt(parsed.token) : acc.token_enc;
          if (tkEnc) {
            healFields.token_enc = tkEnc;
            healFields['quality.has_token'] = true;
          }
        }
        if (!existingTarget.session_token) {
          const stEnc = parsed.session_token ? this.cryptoService.encrypt(parsed.session_token) : acc.session_token;
          if (stEnc) {
            healFields.session_token = stEnc;
            healFields['quality.has_token'] = true;
          }
        }
        if (!existingTarget.email) {
          const candidateEmail = (parsed.email && MailRules.isValidEmail(parsed.email)) ? parsed.email : (acc.email && MailRules.isValidEmail(acc.email) ? acc.email : undefined);
          if (candidateEmail) {
            healFields.email = candidateEmail;
            healFields['quality.has_email'] = true;
          }
        }
        if (!existingTarget.email_password_enc) {
          const epEnc = parsed.email_password ? this.cryptoService.encrypt(parsed.email_password) : acc.email_password_enc;
          if (epEnc) healFields.email_password_enc = epEnc;
        }
        if (!existingTarget.phone && (parsed.phone || acc.phone)) {
          healFields.phone = parsed.phone || acc.phone;
        }
        if (!existingTarget.machine_id && (parsed.machine_id || acc.machine_id)) {
          healFields.machine_id = parsed.machine_id || acc.machine_id;
        }
        if (existingTarget.coins === undefined && (parsed.custom_metadata?.coins !== undefined || acc.coins !== undefined)) {
          healFields.coins = parsed.custom_metadata?.coins ?? acc.coins;
        }

        const healedKeys = Object.keys(healFields);
        if (healedKeys.length > 0) {
          await this.accountModel.updateOne(
            { _id: existingTarget._id },
            {
              $set: healFields,
              $push: {
                history: {
                  action: 'CONSENSUS_HEALED_FROM_DUPLICATE',
                  actor_id: actor.username,
                  timestamp: new Date(),
                  note: `Hợp nhất đồng thuận bổ sung trường [${healedKeys.join(', ')}] từ bản ghi ${acc.username}`
                }
              }
            }
          );
        }

        // Trùng lặp với nick đã có trong kho -> Đưa bản ghi phụ vào blacklist để chống bán trùng
        // Luôn chuẩn hóa username thành dup_<user>_<id4> để không bị bộ lọc Corrupted bắt nhầm là số STT hoặc Token rác
        const isInvalidOldUser = !PlatformRules.isValidUsername(acc.platform, acc.username);
        const dupUsername = isInvalidOldUser || /^\d+$/.test(acc.username) || /^M\.C/i.test(acc.username)
          ? `dup_${newNormalized}_${acc._id.toString().slice(-4)}`
          : acc.username;

        await this.accountModel.updateOne(
          { _id: acc._id },
          {
            $set: {
              status: 'BLACKLISTED',
              username: dupUsername,
              username_normalized: dupUsername.toLowerCase()
            },
            $addToSet: { tags: 'fix_failed_duplicate' },
            $push: {
              history: {
                action: 'AUTO_FIX_DUPLICATE',
                actor_id: actor.username,
                timestamp: new Date(),
                note: healedKeys.length > 0
                  ? `Đã đồng thuận hợp nhất [${healedKeys.join(', ')}] sang nick chính ${existingTarget.username}, cô lập bản sao`
                  : `Bản ghi trùng lặp với tài khoản đã tồn tại trong kho: ${parsed.username}`
              }
            }
          }
        );
        failedDuplicateCount++;
      } else {
        const hasPassword = !!(parsed.password || acc.password_enc);
        const hasCookie = !!(parsed.cookie || acc.cookie_enc);
        const hasToken = !!(parsed.token || parsed.session_token || acc.token_enc || acc.session_token);
        const validParsedEmail = (parsed.email && MailRules.isValidEmail(parsed.email)) ? parsed.email : undefined;
        const validExistingEmail = (acc.email && MailRules.isValidEmail(acc.email)) ? acc.email : undefined;
        const finalEmail = validParsedEmail || validExistingEmail;

        const hasCoreCreds = hasPassword || hasCookie || hasToken;
        const targetStatus = hasCoreCreds ? 'AVAILABLE' : 'BLACKLISTED';

        const updateData: any = {
          $set: {
            username: parsed.username,
            username_normalized: newNormalized,
            platform: targetPlatform,
            status: targetStatus,
            'quality.has_cookie': hasCookie,
            'quality.has_token': hasToken,
            'quality.has_email': !!finalEmail
          },
          $pull: { tags: { $in: ['auto_corrupted', 'unfixable_invalid_username', 'fix_failed_duplicate'] } },
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
        if (parsed.session_token) updateData.$set.session_token = this.cryptoService.encrypt(parsed.session_token);
        if (parsed.password) updateData.$set.password_enc = this.cryptoService.encrypt(parsed.password);
        if (finalEmail) {
          updateData.$set.email = finalEmail;
        } else {
          updateData.$unset = { email: 1 };
        }
        if (parsed.email_password) updateData.$set.email_password_enc = this.cryptoService.encrypt(parsed.email_password);
        if (parsed.phone) updateData.$set.phone = parsed.phone;
        if (parsed.machine_id) updateData.$set.machine_id = parsed.machine_id;
        if (parsed.custom_metadata) updateData.$set.custom_metadata = parsed.custom_metadata;

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
        total_processed: totalProcessed,
        fixed: fixedCount,
        failed_duplicate: failedDuplicateCount,
        failed_parse: failedParseCount
      }
    });

    return {
      total: totalProcessed,
      fixed: fixedCount,
      failed_duplicate: failedDuplicateCount,
      failed_parse: failedParseCount
    };
  }

  /**
   * Legacy wrapper for autoFixCorrupted by usernames
   */
  async autoFixCorrupted(usernames: string[], actor: { username: string; role: string }) {
    if (!usernames || usernames.length === 0) return { fixed: 0, failed_duplicate: 0, failed_parse: 0, total: 0 };
    return this.autoFixByFilter({ username: { $in: usernames } }, actor);
  }
}
