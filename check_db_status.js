const { MongoClient } = require('mongodb');

async function checkDb() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const accounts = db.collection('accounts');
    
    const total = await accounts.countDocuments();
    const byPlatform = await accounts.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]).toArray();

    const sampleTikTok = await accounts.findOne({ platform: 'TIKTOK' });
    const sampleShopee = await accounts.findOne({ platform: 'SHOPEE' });

    console.log('====================================================');
    console.log('📊 BÁO CÁO DỮ LIỆU THỰC TẾ TRONG MONGODB');
    console.log('====================================================\n');
    console.log('• TỔNG SỐ TÀI KHOẢN HIỆN CÓ:', total);
    console.log('• PHÂN BỔ THEO NỀN TẢNG:', byPlatform);
    if (sampleTikTok) {
      console.log('\n[MẪU 1 TÀI KHOẢN TIKTOK TRONG DB]:');
      console.log({
        username: sampleTikTok.username,
        platform: sampleTikTok.platform,
        email: sampleTikTok.email,
        machine_id: sampleTikTok.machine_id,
        custom_metadata: sampleTikTok.custom_metadata,
        has_session_token: !!sampleTikTok.session_token,
        has_cookie: !!sampleTikTok.cookie_enc,
        source_file: sampleTikTok.metadata ? sampleTikTok.metadata.source_file : null
      });
    }
    if (sampleShopee) {
      console.log('\n[MẪU 1 TÀI KHOẢN SHOPEE TRONG DB]:');
      console.log({
        username: sampleShopee.username,
        platform: sampleShopee.platform,
        email: sampleShopee.email,
        has_cookie: !!sampleShopee.cookie_enc,
        source_file: sampleShopee.metadata ? sampleShopee.metadata.source_file : null
      });
    }
    console.log('\n====================================================');
  } catch (err) {
    console.error('Error connecting to DB:', err.message);
  } finally {
    await client.close();
  }
}

checkDb();
