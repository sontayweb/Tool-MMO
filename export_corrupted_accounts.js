const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { PlatformRules } = require('./packages/shared/dist/domain-rules.js');

async function exportCorruptedAccounts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  console.log('Connecting to MongoDB:', uri);
  await mongoose.connect(uri);
  const Account = mongoose.connection.collection('accounts');

  const filter = PlatformRules.getCorruptedMongoFilter(undefined, true);
  console.log('Fetching corrupted accounts matching Domain Rules...');

  const total = await Account.countDocuments(filter);
  console.log(`Found ${total} corrupted accounts.`);

  const cursor = Account.find(filter).sort({ createdAt: -1 });
  const outputFile = path.join(__dirname, 'DANH_SACH_TAI_KHOAN_LOI.txt');
  const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

  writeStream.write('========================================================================================\n');
  writeStream.write(`DANH SÁCH TOÀN BỘ TÀI KHOẢN LỖI / RÁC TRÍCH XUẤT TỪ HỆ THỐNG ARMS (TỔNG SỐ: ${total})\n`);
  writeStream.write(`Thời gian trích xuất: ${new Date().toLocaleString('vi-VN')}\n`);
  writeStream.write(`Bộ lọc áp dụng: Domain Rule Engine (Loại bỏ Token M.C..., STT, Ký tự lạ, Độ dài bất thường)\n`);
  writeStream.write('========================================================================================\n\n');

  let index = 1;
  while (await cursor.hasNext()) {
    const acc = await cursor.next();
    const u = acc.username || '';
    
    let reason = 'Sai định dạng quy luật';
    if (/M\.C/i.test(u)) reason = 'Chứa Session Token thiết bị Boxphone (M.C...)';
    else if (/^\s*[0-9]{1,4}\s*$/.test(u)) reason = 'Số thứ tự / Mã dòng thuần túy (STT)';
    else if (u.length > 35) reason = 'Độ dài chuỗi quá lớn (> 35 ký tự)';
    else if (!u) reason = 'Tên đăng nhập rỗng/null';
    else if (/[\*\!\=\/\:\s]/.test(u)) reason = 'Chứa ký tự cấm (*, !, =, /, khoảng trắng)';

    writeStream.write(`[#${index++}] USERNAME: "${u}"\n`);
    writeStream.write(`     - Lý do vi phạm : ${reason}\n`);
    writeStream.write(`     - Nền tảng      : ${acc.platform || 'OTHER'}\n`);
    writeStream.write(`     - Trạng thái    : ${acc.status || 'BLACKLISTED'}\n`);
    writeStream.write(`     - Email         : ${acc.email || 'N/A'}\n`);
    writeStream.write(`     - File nguồn    : ${acc.metadata?.source_file || 'N/A'}\n`);
    writeStream.write(`     - Tab nguồn     : ${acc.metadata?.source_sheet || 'N/A'}\n`);
    writeStream.write(`     - Dữ liệu gốc   : ${JSON.stringify(acc.raw?.values || acc.raw?.raw_text || [])}\n`);
    writeStream.write('----------------------------------------------------------------------------------------\n');
  }

  writeStream.end();
  await new Promise(resolve => writeStream.on('finish', resolve));

  console.log(`\n Xuất thành công toàn bộ ${total} tài khoản lỗi ra file: ${outputFile}`);
  await mongoose.disconnect();
}

exportCorruptedAccounts().catch(console.error);
