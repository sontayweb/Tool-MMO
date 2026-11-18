const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';

async function checkBlacklistCauses() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const accounts = db.collection('accounts');

    console.log('--- 1. CÁC HÀNH ĐỘNG GHI TRONG LỊCH SỬ CỦA TÀI KHOẢN BLACKLISTED ---');
    const historyActions = await accounts.aggregate([
      { $match: { status: 'BLACKLISTED' } },
      { $unwind: '$history' },
      { $group: { _id: '$history.action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log(JSON.stringify(historyActions, null, 2));
    return;

    console.log('\n--- 2. CÁC TAGS CỦA TÀI KHOẢN BLACKLISTED ---');
    const tagsAgg = await accounts.aggregate([
      { $match: { status: 'BLACKLISTED' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log(tagsAgg);

    console.log('\n--- 3. NGUỒN GỐC (SOURCE_FILE) CỦA CÁC TÀI KHOẢN BLACKLISTED ---');
    const sources = await accounts.aggregate([
      { $match: { status: 'BLACKLISTED' } },
      { $group: { _id: '$metadata.source_file', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    console.log(sources);

    console.log('\n--- 4. MẪU LỊCH SỬ CHI TIẾT CỦA 3 TÀI KHOẢN BLACKLISTED BẤT KỲ ---');
    const samples = await accounts.find({ status: 'BLACKLISTED' }).limit(3).toArray();
    samples.forEach((s, idx) => {
      console.log(`\n[Mẫu ${idx + 1}] ID: ${s._id} | User: ${s.username} | Platform: ${s.platform}`);
      console.log('   History:', JSON.stringify(s.history, null, 2));
      console.log('   Tags:', s.tags);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

checkBlacklistCauses();
