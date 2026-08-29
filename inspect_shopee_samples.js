const mongoose = require('mongoose');

async function inspectShopeeSamples() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');
  
  // Lấy 5 tài khoản Shopee chuẩn (đầy đủ credentials)
  const samples = await Account.find({ 
    platform: 'SHOPEE', 
    username: { $regex: /^[a-zA-Z0-9._]{4,30}$/ },
    password_enc: { $nin: [null, ''] } 
  }).limit(5).toArray();

  console.log('=== 5 MẪU TÀI KHOẢN SHOPEE CHUẨN TRONG DB ===');
  samples.forEach((acc, idx) => {
    console.log(`\n--- Mẫu #${idx + 1} ---`);
    console.log(`Username: "${acc.username}"`);
    console.log(`Has Password Enc: ${!!acc.password_enc}`);
    console.log(`Has Cookie Enc: ${!!acc.cookie_enc}`);
    console.log(`Has Email: "${acc.email || ''}"`);
    console.log(`Raw Values:`, JSON.stringify(acc.raw?.values || []));
    console.log(`Source File: "${acc.metadata?.source_file || ''}"`);
  });

  await mongoose.disconnect();
}

inspectShopeeSamples().catch(console.error);
