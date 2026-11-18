const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
const OUTPUT_FILE = path.join(__dirname, '../../../../audit_corrupted_accounts.txt');

async function exportCorruptedAccounts() {
  console.log('📡 Đang kết nối MongoDB...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const accounts = db.collection('accounts');

    const outStream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });

    const writeLine = (text = '') => outStream.write(text + '\n');

    writeLine('========================================================================================');
    writeLine('DANH SÁCH TÀI KHOẢN BẤT THƯỜNG / LỖI BÓC TÁCH TRONG DATABASE ARMS ĐỂ ĐỐI SOÁT THỰC TẾ');
    writeLine(`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`);
    writeLine('Chế độ: Read-Only trích xuất từ MongoDB collection "accounts"');
    writeLine('========================================================================================\n');

    // -------------------------------------------------------------
    // PHẦN 1: USERNAME LÀ SỐ THỨ TỰ (STT 1-4 chữ số: 1, 10, 11, 114...)
    // -------------------------------------------------------------
    writeLine('----------------------------------------------------------------------------------------');
    writeLine('PHẦN 1: TÀI KHOẢN CÓ USERNAME LÀ SỐ THỨ TỰ THUẦN TÚY (STT: 1, 2, 10, 11, 114...)');
    writeLine('Ghi chú: Giúp đối soát tài khoản nào có Full Info bị bóc nhầm vs dòng STT rác của Excel');
    writeLine('----------------------------------------------------------------------------------------');

    const numericCursor = accounts.find({ username: { $regex: /^\d{1,4}$/ } });
    let countNumeric = 0;
    while (await numericCursor.hasNext()) {
      countNumeric++;
      const acc = await numericCursor.next();
      const raw = acc.raw?.raw_text || (acc.raw?.values ? JSON.stringify(acc.raw.values) : 'KHONG_CO_RAW');
      writeLine(`[#${countNumeric}] ID: ${acc._id} | Platform: ${acc.platform || 'N/A'} | DB_User: "${acc.username}" | Status: ${acc.status} | Source: ${acc.metadata?.source_file || 'N/A'}`);
      writeLine(`    >>> RAW_DATA: ${raw}\n`);
    }
    writeLine(`=> TỔNG CỘNG PHẦN 1: ${countNumeric} tài khoản.\n\n`);

    // -------------------------------------------------------------
    // PHẦN 2: USERNAME BẮT ĐẦU BẰNG TOKEN THIẾT BỊ (M.C...)
    // -------------------------------------------------------------
    writeLine('----------------------------------------------------------------------------------------');
    writeLine('PHẦN 2: TÀI KHOẢN CÓ USERNAME LÀ TOKEN PHIÊN THIẾT BỊ (M.C...)');
    writeLine('Ghi chú: Token thiết bị bị bóc nhầm vào cột Username');
    writeLine('----------------------------------------------------------------------------------------');

    const tokenCursor = accounts.find({ username: { $regex: /^M\.C/i } });
    let countToken = 0;
    while (await tokenCursor.hasNext()) {
      countToken++;
      const acc = await tokenCursor.next();
      const raw = acc.raw?.raw_text || (acc.raw?.values ? JSON.stringify(acc.raw.values) : 'KHONG_CO_RAW');
      writeLine(`[#${countToken}] ID: ${acc._id} | Platform: ${acc.platform || 'N/A'} | DB_User: "${acc.username.substring(0, 40)}..." | Status: ${acc.status}`);
      writeLine(`    >>> RAW_DATA: ${raw}\n`);
    }
    writeLine(`=> TỔNG CỘNG PHẦN 2: ${countToken} tài khoản.\n\n`);

    // -------------------------------------------------------------
    // PHẦN 3: USERNAME BỊ LẪN COOKIE / URL (spc_f=, http...)
    // -------------------------------------------------------------
    writeLine('----------------------------------------------------------------------------------------');
    writeLine('PHẦN 3: TÀI KHOẢN CÓ USERNAME BỊ LẪN COOKIE HOẶC URL (spc_f=, http://, https://, ttwid=)');
    writeLine('Ghi chú: Dòng dữ liệu bị lệch cột khiến chuỗi cookie tràn sang cột Username');
    writeLine('----------------------------------------------------------------------------------------');

    const urlCursor = accounts.find({
      $or: [
        { username: { $regex: /spc_f=/i } },
        { username: { $regex: /^https?:\/\//i } },
        { username: { $regex: /ttwid=/i } }
      ]
    });
    let countUrl = 0;
    while (await urlCursor.hasNext()) {
      countUrl++;
      const acc = await urlCursor.next();
      const raw = acc.raw?.raw_text || (acc.raw?.values ? JSON.stringify(acc.raw.values) : 'KHONG_CO_RAW');
      writeLine(`[#${countUrl}] ID: ${acc._id} | Platform: ${acc.platform || 'N/A'} | DB_User: "${acc.username.substring(0, 50)}..." | Status: ${acc.status}`);
      writeLine(`    >>> RAW_DATA: ${raw}\n`);
    }
    writeLine(`=> TỔNG CỘNG PHẦN 3: ${countUrl} tài khoản.\n\n`);

    // -------------------------------------------------------------
    // PHẦN 4: TÀI KHOẢN TRONG BLACKLISTED NHƯNG CHỨA PASSWORD HOẶC COOKIE TRONG RAW (CỨU HỘ ĐƯỢC)
    // -------------------------------------------------------------
    writeLine('----------------------------------------------------------------------------------------');
    writeLine('PHẦN 4: TÀI KHOẢN ĐANG Ở BLACKLISTED NHƯNG CHỨA COOKIE HOẶC PASSWORD TRONG RAW (CÓ THỂ CỨU HỘ)');
    writeLine('Ghi chú: Các tài khoản có giá trị cao bị phân loại nhầm vào Blacklist do parser cũ');
    writeLine('----------------------------------------------------------------------------------------');

    // Lọc trong BLACKLISTED các tài khoản mà raw_text có chứa @ (email), hoặc SPC_F=, hoặc .shopee.vn, hoặc pass
    const rescueCursor = accounts.find({
      status: 'BLACKLISTED',
      $or: [
        { 'raw.raw_text': { $regex: /SPC_F=/i } },
        { 'raw.raw_text': { $regex: /\.shopee\.vn/i } },
        { 'raw.raw_text': { $regex: /sessionid=/i } }
      ]
    });

    let countRescue = 0;
    while (await rescueCursor.hasNext()) {
      countRescue++;
      const acc = await rescueCursor.next();
      const raw = acc.raw?.raw_text || '';
      writeLine(`[#${countRescue}] ID: ${acc._id} | DB_User: "${acc.username}" | Platform: ${acc.platform || 'N/A'}`);
      writeLine(`    >>> RAW_DATA: ${raw}\n`);
    }
    writeLine(`=> TỔNG CỘNG PHẦN 4 (CÓ COOKIE SỐNG CÓ THỂ CỨU HỘ): ${countRescue} tài khoản.\n\n`);

    writeLine('========================================================================================');
    writeLine('KẾT THÚC BÁO CÁO TRÍCH XUẤT ĐỐI SOÁT');
    writeLine('========================================================================================');

    outStream.end();

    console.log(`✅ Đã xuất thành công toàn bộ tài khoản bất thường ra file: ${OUTPUT_FILE}`);
    console.log(`📊 Thống kê đã xuất:`);
    console.log(`   - Số thứ tự (STT thuần): ${countNumeric}`);
    console.log(`   - Token thiết bị (M.C...): ${countToken}`);
    console.log(`   - Lẫn Cookie/URL: ${countUrl}`);
    console.log(`   - Blacklist có Cookie sống có thể cứu: ${countRescue}`);

  } catch (err) {
    console.error('❌ Lỗi khi xuất file:', err);
  } finally {
    await client.close();
  }
}

exportCorruptedAccounts();
