const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
const { AccountParser } = require('../../../../packages/shared/dist/account.parser.js');
const { UsernameNormalizer } = require('../../../../packages/shared/dist/username.normalizer.js');
const { PlatformRules } = require('../../../../packages/shared/dist/domain-rules.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';

async function executeSanitationFix(dryRun = true) {
  console.log('========================================================================');
  console.log(`🛠️ [THỰC THI CHUẨN HÓA & DỌN DẸP KHO TÀI KHOẢN ARMS] - Mode: ${dryRun ? 'DRY-RUN (Chạy thử)' : 'LIVE-APPLY (Ghi vào DB)'}`);
  console.log(`📡 Kết nối DB: ${MONGODB_URI}`);
  console.log('========================================================================\n');

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const accounts = db.collection('accounts');

    // 1. Quét các tài khoản có username bất thường (STT thuần số, Token M.C...)
    const corruptedFilter = {
      $or: [
        { username: { $regex: /^\d{1,5}$/ } },
        { username: { $regex: /^M\.C/i } },
        { username: { $in: ['#VALUE!', '#REF!', '-', '--', 'zz'] } }
      ]
    };

    const targetList = await accounts.find(corruptedFilter).toArray();
    console.log(`📌 Tìm thấy ${targetList.length.toLocaleString('vi-VN')} tài khoản cần xử lý chuẩn hóa.`);

    let countRestoredToAvailable = 0;
    let countHandledDuplicates = 0;
    let countHandledExcelJunk = 0;

    for (const acc of targetList) {
      const raw = acc.raw?.raw_text || (acc.raw?.values ? acc.raw.values.join(' | ') : '');
      const parsed = AccountParser.parseLine(raw);

      // A. Trường hợp rác Excel thuần túy (không bóc ra được nick thật)
      if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
        countHandledExcelJunk++;
        const newJunkUser = `junk_${acc.username}_${acc._id.toString().slice(-4)}`;
        if (!dryRun) {
          await accounts.updateOne(
            { _id: acc._id },
            {
              $set: {
                username: newJunkUser,
                username_normalized: newJunkUser.toLowerCase(),
                status: 'BLACKLISTED'
              },
              $addToSet: { tags: 'unfixable_excel_empty_row' },
              $push: {
                history: {
                  action: 'AUTO_FIX_UNFIXABLE',
                  actor_id: 'SYSTEM_SANITATION_EXPERT',
                  timestamp: new Date(),
                  note: `Chuẩn hóa dòng rác Excel thừa đuôi: "${acc.username}" -> "${newJunkUser}"`
                }
              }
            }
          );
        }
        continue;
      }

      // B. Trường hợp bóc tách ra Username thật hợp lệ
      const norm = UsernameNormalizer.normalize(parsed.username);
      const targetPlatform = parsed.platform && parsed.platform !== 'OTHER' ? parsed.platform : (acc.platform || 'SHOPEE');

      // Kiểm tra xem username thật này đã có trong kho AVAILABLE chưa
      const existingInAvailable = await accounts.findOne({
        _id: { $ne: acc._id },
        username_normalized: norm,
        platform: targetPlatform,
        status: 'AVAILABLE'
      });

      if (existingInAvailable) {
        // Trùng lặp an toàn (Bản ghi chính đã ở AVAILABLE)
        // Chuẩn hóa username của bản ghi phụ này để không còn bị coi là lỗi STT/Token
        countHandledDuplicates++;
        const newDupUser = `dup_${norm}_${acc._id.toString().slice(-4)}`;
        if (!dryRun) {
          await accounts.updateOne(
            { _id: acc._id },
            {
              $set: {
                username: newDupUser,
                username_normalized: newDupUser.toLowerCase(),
                status: 'BLACKLISTED'
              },
              $addToSet: { tags: 'fix_failed_duplicate' },
              $push: {
                history: {
                  action: 'AUTO_FIX_DUPLICATE',
                  actor_id: 'SYSTEM_SANITATION_EXPERT',
                  timestamp: new Date(),
                  note: `Chuẩn hóa bản ghi trùng lặp: Bản ghi chính đã ở AVAILABLE (ID: ${existingInAvailable._id})`
                }
              }
            }
          );
        }
      } else {
        // C. CỨU HỘ ĐƯỢC 100% VỀ AVAILABLE (Chưa từng có trong kho AVAILABLE)
        countRestoredToAvailable++;
        const newValidUser = parsed.username;
        if (!dryRun) {
          await accounts.updateOne(
            { _id: acc._id },
            {
              $set: {
                username: newValidUser,
                username_normalized: norm,
                status: 'AVAILABLE',
                'quality.has_cookie': !!parsed.cookie,
                'quality.has_token': !!(parsed.token || parsed.session_token),
                'quality.has_email': !!parsed.email
              },
              $pull: { tags: { $in: ['auto_corrupted', 'unfixable_invalid_username', 'fix_failed_duplicate'] } },
              $push: {
                history: {
                  action: 'RESCUE_SUCCESS_TO_AVAILABLE',
                  actor_id: 'SYSTEM_SANITATION_EXPERT',
                  timestamp: new Date(),
                  note: `Cứu hộ thành công: Đổi username "${acc.username}" -> "${newValidUser}" và phục hồi về AVAILABLE`
                }
              }
            }
          );
        }
      }
    }

    console.log('\n========================================================================');
    console.log('📊 TỔNG KẾT KẾT QUẢ XỬ LÝ CHUẨN HÓA:');
    console.log('========================================================================');
    console.log(`1. Dòng rác Excel thừa đuôi (114, 115, #VALUE...) -> Đổi tên junk_*, gắn nhãn rác rõ ràng: ${countHandledExcelJunk} bản ghi`);
    console.log(`2. Bản ghi trùng lặp (Nick thật đã có trong AVAILABLE) -> Đổi tên dup_*, bảo vệ chống bán trùng: ${countHandledDuplicates} bản ghi`);
    console.log(`3. Tài khoản Full Info chưa có trong kho -> Khôi phục về AVAILABLE: ${countRestoredToAvailable} bản ghi`);
    console.log(`\nTrạng thái: ${dryRun ? '⚠️ CHẾ ĐỘ CHẠY THỬ (DRY-RUN): Chưa có dữ liệu nào bị thay đổi trong DB.' : '✅ ĐÃ ÁP DỤNG THÀNH CÔNG VÀO DATABASE!'}`);
    console.log('========================================================================');

  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await client.close();
  }
}

// Mặc định chạy ở chế độ DRY-RUN an toàn
const isLiveApply = process.argv.includes('--apply');
executeSanitationFix(!isLiveApply);
