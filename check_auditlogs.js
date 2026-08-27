const { MongoClient } = require('mongodb');

async function checkAuditLogs() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const auditLogs = db.collection('auditlogs');
    
    const count = await auditLogs.countDocuments();
    const latestLogs = await auditLogs.find().sort({ timestamp: -1 }).limit(10).toArray();

    console.log('====================================================');
    console.log(`📑 TỔNG SỐ BẢN GHI TRONG COLLECTION AUDITLOGS: ${count}`);
    console.log('====================================================\n');
    
    latestLogs.forEach((log, idx) => {
      console.log(`[${idx + 1}] [${log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : 'N/A'}] Action: ${log.action} | Actor: ${log.actor_username || log.actor_id}`);
      if (log.details) console.log('   ↳ Details:', JSON.stringify(log.details));
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

checkAuditLogs();
