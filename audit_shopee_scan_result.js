const { MongoClient } = require('mongodb');

async function auditScanResult() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');

    console.log('========================================================================');
    console.log('🔍 ĐỐI SOÁT CHI TIẾT KẾT QUẢ QUÉT SHOPEE TRONG DATABASE MONGODB');
    console.log('========================================================================\n');

    // 1. Tổng số document trong DB
    const totalInDb = await db.collection('accounts').countDocuments();
    console.log(`📦 1. TỔNG SỐ NICK DUY NHẤT TRONG DATABASE: ${totalInDb.toLocaleString()} tài khoản`);

    // 2. Phân loại theo Platform
    const shopeeCount = await db.collection('accounts').countDocuments({ platform: 'SHOPEE' });
    const tiktokCount = await db.collection('accounts').countDocuments({ platform: 'TIKTOK' });
    console.log(`   ↳ Shopee: ${shopeeCount.toLocaleString()} nick`);
    console.log(`   ↳ TikTok: ${tiktokCount.toLocaleString()} nick`);

    // 3. Thống kê chất lượng dữ liệu
    const withCookie = await db.collection('accounts').countDocuments({ 'quality.has_cookie': true });
    const withPhone = await db.collection('accounts').countDocuments({ phone: { $exists: true, $ne: '' } });
    const withCoins = await db.collection('accounts').countDocuments({ coins: { $exists: true, $ne: '' } });
    const withEmail = await db.collection('accounts').countDocuments({ 'quality.has_email': true });
    const withRaw = await db.collection('accounts').countDocuments({ 'raw.raw_text': { $exists: true } });

    console.log('\n📊 2. THỐNG KÊ CHI TIẾT CÁC TRƯỜNG DỮ LIỆU ĐÃ NẠP:');
    console.log(`   • Có Cookie: ${withCookie.toLocaleString()} nick (${((withCookie/totalInDb)*100).toFixed(1)}%)`);
    console.log(`   • Có Số điện thoại: ${withPhone.toLocaleString()} nick (${((withPhone/totalInDb)*100).toFixed(1)}%)`);
    console.log(`   • Có Số xu Shopee: ${withCoins.toLocaleString()} nick (${((withCoins/totalInDb)*100).toFixed(1)}%)`);
    console.log(`   • Có Email liên kết: ${withEmail.toLocaleString()} nick (${((withEmail/totalInDb)*100).toFixed(1)}%)`);
    console.log(`   • Có Bản ghi dòng thô (Raw): ${withRaw.toLocaleString()} nick (${((withRaw/totalInDb)*100).toFixed(1)}%)`);

    // 4. Đọc Audit Log mới nhất để xem các chỉ số quét
    console.log('\n📑 3. NHẬT KÝ QUÉT (AUDIT LOG) MỚI NHẤT:');
    const latestLogs = await db.collection('auditlogs').find().sort({ timestamp: -1 }).limit(5).toArray();
    latestLogs.forEach(l => {
      console.log(`   [${l.timestamp ? new Date(l.timestamp).toLocaleTimeString('vi-VN') : ''}] Action: ${l.action} | Target: ${l.target_type}`);
      if (l.details) console.log('     ↳ Chi tiết:', JSON.stringify(l.details));
    });

    // 5. Mẫu 3 tài khoản vừa nạp
    console.log('\n👀 4. MẪU 3 TÀI KHOẢN VỪA NẠP GẦN ĐÂY NHẤT:');
    const samples = await db.collection('accounts').find().sort({ updatedAt: -1 }).limit(3).toArray();
    samples.forEach((s, idx) => {
      console.log(`   [Nick #${idx + 1}] User: "${s.username}" | Phone: "${s.phone || 'N/A'}" | Coins: "${s.coins || 'N/A'}" | Source: "${s.metadata?.source_file}" (${s.metadata?.source_sheet})`);
      if (s.raw) console.log(`     ↳ Raw: "${s.raw.raw_text}"`);
    });

  } catch (err) {
    console.error('Lỗi đối soát:', err.message);
  } finally {
    await client.close();
  }
}

auditScanResult();
