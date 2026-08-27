const { MongoClient } = require('mongodb');

async function checkDistinctFiles() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const collection = db.collection('accounts');

    console.log('========================================================================');
    console.log('📑 ĐỐI SOÁT CÁC TỆP NGUỒN ĐÃ NẠP TRONG DATABASE:');
    console.log('========================================================================\n');

    const files = await collection.distinct('metadata.source_file');
    console.log(`📂 Tổng số tệp nguồn Google Drive đã được nạp: ${files.length} files`);
    
    // Thống kê số lượng tài khoản theo từng file
    const fileStats = await collection.aggregate([
      { $group: { _id: '$metadata.source_file', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\nTop 15 file có nhiều tài khoản nhất:');
    fileStats.slice(0, 15).forEach((f, i) => {
      console.log(`  [${i + 1}] "${f._id}": ${f.count.toLocaleString()} tài khoản`);
    });

  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    await client.close();
  }
}

checkDistinctFiles();
