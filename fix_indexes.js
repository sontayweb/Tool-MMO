const { MongoClient } = require('mongodb');

async function fixIndexes() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const collection = db.collection('accounts');

    console.log('====================================================');
    console.log('🔧 TIẾN TRÌNH XỬ LÝ INDEX MONGODB:');
    console.log('====================================================\n');

    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some(idx => idx.name === 'username_normalized_1');

    if (hasOldIndex) {
      console.log('⏳ Đang xóa index đơn cũ: "username_normalized_1"...');
      await collection.dropIndex('username_normalized_1');
      console.log('✅ Đã xóa thành công index cũ "username_normalized_1"!');
    } else {
      console.log('ℹ️ Không tìm thấy index "username_normalized_1" (đã được xóa trước đó).');
    }

    // Đảm bảo Compound Unique Index { platform: 1, username_normalized: 1 } tồn tại
    console.log('⏳ Đảm bảo Khóa Kép Compound Index { platform: 1, username_normalized: 1 }...');
    await collection.createIndex(
      { platform: 1, username_normalized: 1 },
      { unique: true, name: 'platform_1_username_normalized_1' }
    );
    console.log('✅ Khóa kép Compound Index { platform: 1, username_normalized: 1 } đã sẵn sàng 100%!');

    const updatedIndexes = await collection.indexes();
    console.log('\n📑 DANH SÁCH INDEX SAU KHI TỐI ƯU:');
    updatedIndexes.forEach(idx => {
      console.log(`- "${idx.name}" ->`, JSON.stringify(idx.key), `(Unique: ${!!idx.unique})`);
    });

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  } finally {
    await client.close();
  }
}

fixIndexes();
