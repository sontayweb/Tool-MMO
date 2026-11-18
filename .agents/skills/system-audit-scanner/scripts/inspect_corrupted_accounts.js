const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';

async function inspectCorruptedAccounts() {
  console.log('========================================================================');
  console.log('🔍 [AUDIT KIỂM TOÁN TÀI KHOẢN LỖI TRONG DATABASE - READ ONLY]');
  console.log(`📡 Kết nối DB: ${MONGODB_URI}`);
  console.log('========================================================================\n');

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const accounts = db.collection('accounts');

    // 1. Tổng số tài khoản và phân bố trạng thái
    const totalAccounts = await accounts.countDocuments({});
    console.log(`📌 TỔNG SỐ BẢN GHI TRONG COLLECTION 'accounts': ${totalAccounts.toLocaleString('vi-VN')}`);

    const statusCounts = await accounts.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n📊 1. PHÂN BỐ THEO TRẠNG THÁI (STATUS):');
    statusCounts.forEach(s => {
      console.log(`   - Trạng thái '${s._id || 'NULL'}': ${s.count.toLocaleString('vi-VN')} tài khoản`);
    });

    // 2. Tài khoản có status = 'ERROR'
    const errorCount = await accounts.countDocuments({ status: 'ERROR' });
    console.log(`\n🚨 2. TÀI KHOẢN CÓ STATUS = 'ERROR': ${errorCount.toLocaleString('vi-VN')}`);
    if (errorCount > 0) {
      const errorSamples = await accounts.find({ status: 'ERROR' }).limit(5).toArray();
      console.log('   --- MẪU TÀI KHOẢN STATUS = ERROR (Tối đa 5) ---');
      errorSamples.forEach((acc, i) => {
        console.log(`   [Mẫu ${i + 1}] ID: ${acc._id} | Platform: ${acc.platform} | User: ${acc.username}`);
        console.log(`      Has Pass: ${!!acc.password_enc} | Has Cookie: ${!!acc.cookie_enc} | Has Token: ${!!acc.token_enc}`);
        console.log(`      Parse Errors: ${JSON.stringify(acc.quality?.parse_errors || [])}`);
        console.log(`      Raw Text: ${acc.raw?.raw_text ? acc.raw.raw_text.substring(0, 100) + '...' : (acc.raw?.values ? JSON.stringify(acc.raw.values).substring(0, 100) : 'N/A')}`);
        console.log(`      Source: ${acc.metadata?.source_file || 'N/A'} (Sheet: ${acc.metadata?.source_sheet || 'N/A'})`);
      });
    }

    // 3. Tài khoản vi phạm Domain Rules (Username rác / Token / STT thuần số / Base64 dài)
    console.log('\n🔎 3. KIỂM TRA USERNAME DẠNG RÁC / BẤT THƯỜNG TRONG KHO (BẤT KỂ STATUS):');

    const tokenUsernames = await accounts.countDocuments({
      username: { $regex: /^M\.C/i }
    });
    console.log(`   - Username bắt đầu bằng Token thiết bị ('M.C...'): ${tokenUsernames.toLocaleString('vi-VN')}`);

    const numericUsernames = await accounts.countDocuments({
      username: { $regex: /^\d{1,4}$/ }
    });
    console.log(`   - Username là số STT thuần túy (1-4 chữ số: 1, 66, 69...): ${numericUsernames.toLocaleString('vi-VN')}`);

    const longBase64Usernames = await accounts.countDocuments({
      username: { $regex: /^[A-Za-z0-9+/=_-]{36,}$/ }
    });
    console.log(`   - Username có độ dài bất thường (> 35 ký tự / chuỗi mã hóa/hash): ${longBase64Usernames.toLocaleString('vi-VN')}`);

    const urlUsernames = await accounts.countDocuments({
      $or: [
        { username: { $regex: /spc_f=/i } },
        { username: { $regex: /^https?:\/\//i } },
        { username: { $regex: /ttwid=/i } }
      ]
    });
    console.log(`   - Username bị lẫn URL / Cookie string (spc_f=, http, ttwid): ${urlUsernames.toLocaleString('vi-VN')}`);

    // Mẫu tài khoản có username rác
    const corruptedUsernames = await accounts.find({
      $or: [
        { username: { $regex: /^M\.C/i } },
        { username: { $regex: /^\d{1,4}$/ } },
        { username: { $regex: /^[A-Za-z0-9+/=_-]{36,}$/ } },
        { username: { $regex: /spc_f=/i } }
      ]
    }).limit(5).toArray();

    if (corruptedUsernames.length > 0) {
      console.log('   --- MẪU USERNAME BẤT THƯỜNG (Tối đa 5) ---');
      corruptedUsernames.forEach((acc, i) => {
        console.log(`   [Mẫu ${i + 1}] ID: ${acc._id} | Status: ${acc.status} | Platform: ${acc.platform}`);
        console.log(`      Username: "${acc.username}" (Length: ${acc.username?.length})`);
        console.log(`      Raw Text: ${acc.raw?.raw_text ? acc.raw.raw_text.substring(0, 100) + '...' : 'N/A'}`);
      });
    }

    // 4. Tài khoản thiếu Core Credentials (Không Pass VÀ Không Cookie VÀ Không Token)
    console.log('\n🔒 4. KIỂM TRA TÀI KHOẢN THIẾU THÔNG TIN CỐT LÕI (MISSING CORE CREDENTIALS):');
    const missingCoreFilter = {
      $and: [
        { $or: [{ password_enc: { $exists: false } }, { password_enc: null }, { password_enc: '' }] },
        { $or: [{ cookie_enc: { $exists: false } }, { cookie_enc: null }, { cookie_enc: '' }] },
        { $or: [{ token_enc: { $exists: false } }, { token_enc: null }, { token_enc: '' }] },
        { $or: [{ session_token: { $exists: false } }, { session_token: null }, { session_token: '' }] }
      ]
    };
    const missingCoreTotal = await accounts.countDocuments(missingCoreFilter);
    const missingCoreAvailable = await accounts.countDocuments({
      ...missingCoreFilter,
      status: 'AVAILABLE'
    });
    console.log(`   - Tổng tài khoản hoàn toàn KHÔNG CÓ Password, Cookie hay Token: ${missingCoreTotal.toLocaleString('vi-VN')}`);
    console.log(`   - Trong đó tài khoản vẫn đang gắn nhãn 'AVAILABLE' (NGUY HIỂM BÁN NHẦM): ${missingCoreAvailable.toLocaleString('vi-VN')}`);

    if (missingCoreAvailable > 0) {
      const sampleMissing = await accounts.find({ ...missingCoreFilter, status: 'AVAILABLE' }).limit(3).toArray();
      console.log('   --- MẪU THIẾU CORE NHƯNG VẪN AVAILABLE (Tối đa 3) ---');
      sampleMissing.forEach((acc, i) => {
        console.log(`   [Mẫu ${i + 1}] ID: ${acc._id} | Platform: ${acc.platform} | User: ${acc.username}`);
        console.log(`      Source: ${acc.metadata?.source_file || 'N/A'} (Tab: ${acc.metadata?.source_sheet || 'N/A'})`);
        console.log(`      Raw: ${acc.raw?.raw_text ? acc.raw.raw_text.substring(0, 100) : 'N/A'}`);
      });
    }

    // 5. Kiểm tra lỗi parse (quality.parse_errors)
    console.log('\n⚠️ 5. KIỂM TRA TÀI KHOẢN CÓ GHI NHẬN PARSE ERRORS:');
    const parseErrorsCount = await accounts.countDocuments({
      'quality.parse_errors.0': { $exists: true }
    });
    console.log(`   - Số bản ghi có parse_errors: ${parseErrorsCount.toLocaleString('vi-VN')}`);
    if (parseErrorsCount > 0) {
      const parseErrorSamples = await accounts.find({
        'quality.parse_errors.0': { $exists: true }
      }).limit(3).toArray();
      parseErrorSamples.forEach((acc, i) => {
        console.log(`   [Mẫu ${i + 1}] User: ${acc.username} | Errors: ${JSON.stringify(acc.quality.parse_errors)}`);
      });
    }

    // 6. Kiểm tra tài khoản Trùng lặp (Duplicates)
    console.log('\n👥 6. KIỂM TRA TRÙNG LẶP TRONG KHO:');
    const duplicatesGroup = await accounts.aggregate([
      {
        $group: {
          _id: { platform: '$platform', username_normalized: '$username_normalized' },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 }, '_id.username_normalized': { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();

    const totalDuplicateGroups = await accounts.aggregate([
      {
        $group: {
          _id: { platform: '$platform', username_normalized: '$username_normalized' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 }, '_id.username_normalized': { $ne: null } } },
      { $count: 'total' }
    ]).toArray();

    const dupCount = totalDuplicateGroups[0]?.total || 0;
    console.log(`   - Số nhóm tài khoản bị trùng lặp ({ platform, username_normalized }): ${dupCount.toLocaleString('vi-VN')}`);
    if (duplicatesGroup.length > 0) {
      console.log('   --- TOP 5 NHÓM TRÙNG LẶP NHIỀU NHẤT ---');
      duplicatesGroup.forEach((g, i) => {
        console.log(`   [Nhóm ${i + 1}] Platform: ${g._id.platform} | Username: "${g._id.username_normalized}" | Số bản ghi trùng: ${g.count}`);
      });
    }

    // 7. Khả năng Cứu hộ (Rescue / Auto-Fix Analysis)
    console.log('\n🛠️ 7. PHÂN TÍCH KHẢ NĂNG CỨU HỘ DỮ LIỆU (AUTO-FIX AUDIT):');
    const corruptedFilter = {
      $or: [
        { status: 'ERROR' },
        { username: { $regex: /^M\.C/i } },
        { username: { $regex: /^\d{1,4}$/ } },
        { username: { $regex: /spc_f=/i } }
      ]
    };
    const corruptedWithRaw = await accounts.countDocuments({
      ...corruptedFilter,
      $or: [
        { 'raw.raw_text': { $exists: true, $ne: '' } },
        { 'raw.values': { $exists: true, $ne: null } }
      ]
    });
    console.log(`   - Số tài khoản lỗi CÓ LƯU DỮ LIỆU GỐC (raw_text hoặc values): ${corruptedWithRaw.toLocaleString('vi-VN')}`);
    console.log(`   - Nhận định: Có thể dùng parser mới để giải mã và cứu hộ lại các tài khoản này.`);

    console.log('\n========================================================================');
    console.log('✅ HOÀN THÀNH KIỂM TOÁN TÀI KHOẢN LỖI (CHỈ ĐỌC 100% - KHÔNG THAY ĐỔI DB)');
    console.log('========================================================================');

  } catch (err) {
    console.error('❌ Lỗi kiểm toán:', err);
  } finally {
    await client.close();
  }
}

inspectCorruptedAccounts();
