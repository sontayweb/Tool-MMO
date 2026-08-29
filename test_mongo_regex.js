const mongoose = require('mongoose');

async function testRegex() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  // Test 1: $not with RegExp object
  const count1 = await Account.countDocuments({ username: { $not: /^[a-zA-Z0-9._\-@+]{3,35}$/ } });
  console.log('Count with $not RegExp:', count1);

  // Test 2: $not with $regex
  const count2 = await Account.countDocuments({ username: { $not: { $regex: '^[a-zA-Z0-9._\\-@+]{3,35}$' } } });
  console.log('Count with $not $regex:', count2);

  // Test 3: Positive matching corrupted
  const count3 = await Account.countDocuments({
    $or: [
      { username: { $regex: 'M\\.C', $options: 'i' } },
      { username: { $regex: '^\\s*[0-9]{1,4}\\s*$' } },
      { username: { $regex: '.{36,}' } },
      { username: { $in: [null, ''] } }
    ]
  });
  console.log('Count with specific positive corrupted regex:', count3);

  await mongoose.disconnect();
}

testRegex().catch(console.error);
