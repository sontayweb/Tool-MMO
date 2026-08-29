const mongoose = require('mongoose');

async function testRecycleBin() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  // Find a sample account to test
  const sample = await Account.findOne({ status: 'AVAILABLE' });
  if (!sample) {
    console.log('No available account to test.');
    await mongoose.disconnect();
    return;
  }

  const testUsername = sample.username;
  const testNorm = sample.username_normalized;
  console.log(`Testing with account: "${testUsername}" (Status: ${sample.status})`);

  // 1. Simulate Move To Trash (Soft Delete)
  await Account.updateOne(
    { username_normalized: testNorm },
    { $set: { status: 'TRASH', deleted_at: new Date(), deleted_by: 'TEST_AGENT' } }
  );

  const trashDoc = await Account.findOne({ username_normalized: testNorm });
  console.log(`1. After Move To Trash -> Status: ${trashDoc.status}, Deleted At: ${trashDoc.deleted_at}`);

  // 2. Query normal inventory (should NOT include TRASH)
  const countActive = await Account.countDocuments({ username_normalized: testNorm, status: { $ne: 'TRASH' } });
  console.log(`2. Visible in active inventory (status != TRASH): ${countActive === 0 ? 'NO (Hidden successfully!)' : 'YES (Error!)'}`);

  // 3. Simulate Restore
  await Account.updateOne(
    { username_normalized: testNorm, status: 'TRASH' },
    { $set: { status: 'AVAILABLE' }, $unset: { deleted_at: 1, deleted_by: 1 } }
  );

  const restoredDoc = await Account.findOne({ username_normalized: testNorm });
  console.log(`3. After Restore -> Status: ${restoredDoc.status}, Deleted At: ${restoredDoc.deleted_at || 'NULL (Cleaned up!)'}`);

  await mongoose.disconnect();
}

testRecycleBin().catch(console.error);
