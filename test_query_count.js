const mongoose = require('mongoose');
const { PlatformRules } = require('./packages/shared/dist/domain-rules.js');

async function testFilterCount() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  // Let's trace how filter is built
  const filter = {};
  const data_quality = 'corrupted_username';

  if (data_quality === 'corrupted_username') {
    const corruptedFilter = PlatformRules.getCorruptedMongoFilter(undefined);
    console.log('corruptedFilter:', JSON.stringify(corruptedFilter));
    filter.$or = corruptedFilter.$or;
  }

  console.log('Final filter:', JSON.stringify(filter));

  const total = await Account.countDocuments(filter);
  console.log('Account.countDocuments(filter):', total);

  // What about using Mongoose model vs native collection?
  const AccountModel = mongoose.model('AccountTest', new mongoose.Schema({
    username: String,
    platform: String,
    status: String
  }), 'accounts');

  const totalModel = await AccountModel.countDocuments(filter);
  console.log('AccountModel.countDocuments(filter):', totalModel);

  await mongoose.disconnect();
}

testFilterCount().catch(console.error);
