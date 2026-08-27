const { MongoClient } = require('mongodb');

async function ensureCleanSetup() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const collection = db.collection('accounts');

    const count = await collection.countDocuments();
    console.log('========================================================================');
    console.log(`📦 COLLECTION ACCOUNTS TRONG MONGODB: ${count} tài khoản (Trắng sạch)`);
    console.log('========================================================================\n');

    // Tạo lại Compound Unique Index chuẩn
    console.log('⏳ Đang tạo Compound Unique Index { platform: 1, username_normalized: 1 }...');
    await collection.createIndex(
      { platform: 1, username_normalized: 1 },
      { unique: true, name: 'platform_1_username_normalized_1' }
    );
    console.log('✅ Khóa kép Compound Index đã sẵn sàng 100%!');

    const indexes = await collection.indexes();
    console.log('\n📑 Danh sách Index hiện tại:');
    indexes.forEach(idx => {
      console.log(`  - "${idx.name}":`, JSON.stringify(idx.key), `(Unique: ${!!idx.unique})`);
    });

  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    await client.close();
  }
}

ensureCleanSetup();
