const mongoose = require('mongoose');
const { PlatformRules } = require('./packages/shared/dist/domain-rules.js');

async function testDirect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  // Case 1: Corrupted
  const corruptedFilter = PlatformRules.getCorruptedMongoFilter();
  console.log('1. Corrupted Filter:', JSON.stringify(corruptedFilter));
  const countCorrupted = await Account.countDocuments(corruptedFilter);
  console.log('Corrupted count:', countCorrupted);

  // Case 2: Missing core
  const missingFilter = PlatformRules.getMissingCoreMongoFilter();
  console.log('2. Missing Filter:', JSON.stringify(missingFilter));
  const countMissing = await Account.countDocuments(missingFilter);
  console.log('Missing core count:', countMissing);

  // Case 3: Full info
  const fullFilter = PlatformRules.getFullInfoMongoFilter();
  console.log('3. Full Filter:', JSON.stringify(fullFilter));
  const countFull = await Account.countDocuments(fullFilter);
  console.log('Full info count:', countFull);

  await mongoose.disconnect();
}

testDirect().catch(console.error);
