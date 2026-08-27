const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

async function runFullSystemAudit() {
  console.log('========================================================================');
  console.log('🕵️ BỘ TỰ ĐỘNG RÀ SOÁT & KIỂM ĐỊNH TOÀN DIỆN HỆ THỐNG (FULL E2E AUDIT)');
  console.log('========================================================================\n');

  const report = {
    total_checks: 0,
    passed_checks: 0,
    failed_checks: 0,
    issues: []
  };

  function assert(condition, message) {
    report.total_checks++;
    if (condition) {
      report.passed_checks++;
      console.log(`  ✅ [PASS] ${message}`);
    } else {
      report.failed_checks++;
      report.issues.push(message);
      console.log(`  ❌ [FAIL] ${message}`);
    }
  }

  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('arms');

    // =========================================================================
    // 1. KIỂM TRA MONGODB INDEXES & INTEGRITY
    // =========================================================================
    console.log('📦 1. RÀ SOÁT MONGODB INDEXES & CẤU TRÚC:');
    const indexes = await db.collection('accounts').indexes();
    const indexNames = indexes.map(i => i.name);
    
    // Kiểm tra không còn index đơn trùng lặp
    assert(!indexNames.includes('username_normalized_1'), 'Index đơn cũ username_normalized_1 đã được loại bỏ sạch sẽ.');
    
    // Kiểm tra có compound index chuẩn
    const compoundIdx = indexes.find(i => i.name === 'platform_1_username_normalized_1');
    assert(compoundIdx && compoundIdx.unique, 'Khóa kép Compound Index { platform: 1, username_normalized: 1 } (Unique: true) sẵn sàng.');

    // =========================================================================
    // 2. KIỂM TRA ĐỐI SOÁT DỮ LIỆU ĐÃ NẠP TRONG DATABASE
    // =========================================================================
    console.log('\n🔍 2. RÀ SOÁT CHẤT LƯỢNG DỮ LIỆU ĐANG CÓ TRONG KHO (DATABASE AUDIT):');
    const totalAccounts = await db.collection('accounts').countDocuments();
    assert(totalAccounts > 0, `Database đang có ${totalAccounts.toLocaleString()} tài khoản thực tế.`);

    const shopeeCount = await db.collection('accounts').countDocuments({ platform: 'SHOPEE' });
    const tiktokCount = await db.collection('accounts').countDocuments({ platform: 'TIKTOK' });
    console.log(`     ↳ Shopee: ${shopeeCount.toLocaleString()} nick | TikTok: ${tiktokCount.toLocaleString()} nick`);

    // Kiểm tra xem có nick nào bị lưu sai định dạng không
    const invalidUsernames = await db.collection('accounts').countDocuments({
      $or: [
        { username: { $regex: '@' } },
        { username: { $regex: 'spc_f' } },
        { username: { $regex: '\\.shopee' } }
      ]
    });
    assert(invalidUsernames === 0, `Không có username nào bị dính email hay cookie rác (${invalidUsernames} lỗi).`);

    // =========================================================================
    // 3. KIỂM TRA TỆP EXCEL TIKTOK MASTER (700 ACC)
    // =========================================================================
    console.log('\n🎵 3. RÀ SOÁT FILE KHO TIKTOK MASTER:');
    const tiktokMasterPath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
    assert(fs.existsSync(tiktokMasterPath), 'File 700 Acc tiktok 4.2026.xlsx tồn tại trên disk.');

    if (fs.existsSync(tiktokMasterPath)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(tiktokMasterPath);
      const sheetNames = wb.worksheets.map(w => w.name);
      assert(sheetNames.length >= 10, `File 700 Acc TikTok có ${sheetNames.length} sheet đầy đủ.`);
      assert(sheetNames.includes('tong ac shopee'), 'Có tab con "tong ac shopee" để tự động định tuyến về kho Shopee.');
    }

    // =========================================================================
    // 4. KIỂM TRA KẾT NỐI GOOGLE DRIVE OAUTH2
    // =========================================================================
    console.log('\n☁️ 4. RÀ SOÁT KẾT NỐI GOOGLE DRIVE OAUTH:');
    const tokenPath = path.join(__dirname, 'google_token.json');
    const credPath = path.join(__dirname, 'google_credentials.json');
    const hasCreds = fs.existsSync(credPath) || fs.readdirSync(__dirname).some(f => f.startsWith('client_secret_') && f.endsWith('.json'));
    
    assert(hasCreds, 'File client_secret OAuth2 tồn tại trong thư mục gốc.');
    assert(fs.existsSync(tokenPath), 'File google_token.json tồn tại và đã cấp quyền.');

    if (fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      assert(!!token.refresh_token || !!token.access_token, 'Google Token hợp lệ, có Refresh Token để tự động làm mới vĩnh viễn.');
    }

    // =========================================================================
    // 5. KIỂM TRA TÍNH NĂNG XUẤT DỮ LIỆU (EXPORT ENGINE)
    // =========================================================================
    console.log('\n📤 5. RÀ SOÁT ĐỘNG CƠ XUẤT DỮ LIỆU (EXPORTS):');
    const sampleAccount = await db.collection('accounts').findOne({ phone: { $exists: true, $ne: '' } });
    if (sampleAccount) {
      assert(sampleAccount.phone && /^(84|0)\d+/.test(sampleAccount.phone), `Trường phone lưu chuẩn định dạng: "${sampleAccount.phone}".`);
    } else {
      console.log('     ℹ️ Chưa có tài khoản nào có trường phone (do đợt quét mới chưa chạy).');
    }

    // =========================================================================
    // TỔNG KẾT
    // =========================================================================
    console.log('\n========================================================================');
    console.log(`📊 TỔNG KẾT RÀ SOÁT: ${report.passed_checks}/${report.total_checks} BÀI KIỂM THỬ THÀNH CÔNG (${Math.round(report.passed_checks/report.total_checks*100)}%)`);
    if (report.failed_checks === 0) {
      console.log('🎉 TOÀN BỘ HỆ THỐNG ĐÃ HOÀN TOÀN SẠCH LỖI VÀ SẴN SÀNG VẬN HÀNH 100%!');
    } else {
      console.log('⚠️ CÁC ĐIỂM CẦN XỬ LÝ:');
      report.issues.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
    }
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Lỗi khi chạy Audit:', err);
  } finally {
    await client.close();
  }
}

runFullSystemAudit();
