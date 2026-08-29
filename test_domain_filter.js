const mongoose = require('mongoose');
const { PlatformRules } = require('./packages/shared/dist/domain-rules.js');

async function testFilter() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  const corruptedFilter = PlatformRules.getCorruptedMongoFilter();
  console.log('Query Filter:', JSON.stringify(corruptedFilter));

  const totalCorrupted = await Account.countDocuments(corruptedFilter);
  console.log('Total Corrupted Accounts Found in DB:', totalCorrupted);

  const samples = await Account.find(corruptedFilter).limit(5).toArray();
  console.log('Sample Corrupted Accounts:');
  samples.forEach(s => console.log(`- Username: "${s.username}" | Platform: ${s.platform} | Status: ${s.status}`));

  await mongoose.disconnect();
}

testFilter().catch(console.error);
