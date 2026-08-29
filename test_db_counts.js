const mongoose = require('mongoose');

async function testCounts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  const total = await Account.countDocuments({});
  console.log('Total accounts in DB:', total);

  const hasPass = await Account.countDocuments({ password_enc: { $nin: [null, ''] } });
  console.log('Accounts with password_enc:', hasPass);

  const hasCookie = await Account.countDocuments({ cookie_enc: { $nin: [null, ''] } });
  console.log('Accounts with cookie_enc:', hasCookie);

  const validUsernames = await Account.countDocuments({ username: { $regex: /^[a-zA-Z0-9._]{4,30}$/ } });
  console.log('Accounts with valid Shopee username format:', validUsernames);

  const mcAccounts = await Account.countDocuments({ username: { $regex: /M\.C/i } });
  console.log('Accounts with M.C in username:', mcAccounts);

  await mongoose.disconnect();
}

testCounts().catch(console.error);
