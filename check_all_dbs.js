const { MongoClient } = require('mongodb');

async function checkAllDbs() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('====================================================');
    console.log('📑 TẤT CẢ CÁC DATABASE TRONG MONGODB:');
    console.log('====================================================\n');
    
    for (const d of dbs.databases) {
      const db = client.db(d.name);
      const cols = await db.listCollections().toArray();
      console.log(`📂 Database: "${d.name}" (Size: ${(d.sizeOnDisk/1024/1024).toFixed(2)} MB)`);
      for (const col of cols) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   ↳ Collection: "${col.name}" -> ${count} documents`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

checkAllDbs();
