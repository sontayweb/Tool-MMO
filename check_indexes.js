const { MongoClient } = require('mongodb');

async function checkIndexes() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const indexes = await db.collection('accounts').indexes();
    console.log('====================================================');
    console.log('📑 CÁC INDEX HIỆN TẠI TRONG COLLECTION ACCOUNTS:');
    console.log('====================================================\n');
    indexes.forEach(idx => {
      console.log(`- Tên Index: "${idx.name}" | Keys:`, JSON.stringify(idx.key), `| Unique:`, !!idx.unique);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

checkIndexes();
