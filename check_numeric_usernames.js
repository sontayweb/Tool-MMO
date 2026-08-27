const { MongoClient } = require('mongodb');

async function checkNumericUsernames() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');
    const numericAccounts = await db.collection('accounts').countDocuments({
      username: { $regex: '^[0-9]+$' }
    });
    console.log(`Số tài khoản bị gán nhầm STT làm Username: ${numericAccounts.toLocaleString()} nick`);
  } finally {
    await client.close();
  }
}

checkNumericUsernames();
