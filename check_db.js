const mongoose = require('mongoose');

async function checkDb() {
  await mongoose.connect('mongodb://localhost:27017/arms-test-1');
  const Account = mongoose.connection.collection('accounts');
  
  // Find accounts where username contains M.C
  const badAccounts = await Account.find({ username: { $regex: /^M\.C/ } }).limit(5).toArray();
  console.log('Bad accounts count:', await Account.countDocuments({ username: { $regex: /^M\.C/ } }));
  console.log('Sample bad account:', JSON.stringify(badAccounts[0], null, 2));

  // Find correct accounts
  const goodAccounts = await Account.find({ username: 'jviw159zdu' }).toArray();
  console.log('Good accounts:', JSON.stringify(goodAccounts, null, 2));
  
  await mongoose.disconnect();
}

checkDb().catch(console.error);
