const ExcelJS = require('exceljs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { AccountParser, CryptoService } = require('./packages/shared/dist/index.js');

async function ingestAll() {
  console.log('====================================================');
  console.log('🚀 NẠP TRỰC TIẾP TOÀN BỘ TIKTOK VÀO MONGODB');
  console.log('====================================================\n');

  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('arms');
  const accountsCol = db.collection('accounts');
  const encKey = process.env.ENCRYPTION_KEY_BASE64 || 'H0dTb4DmjdI8Gp7j34qIrhf6fXDHzdOZYKGABwPJwUA=';
  const cryptoService = new CryptoService(encKey);

  // 1. Cập nhật nhãn SHOPEE cho các tài khoản hiện có chưa có platform
  console.log('1. Đang chuẩn hóa nhãn SHOPEE cho 13,501 tài khoản hiện có trong DB...');
  const shopeeUpdate = await accountsCol.updateMany(
    { $or: [{ platform: { $exists: false } }, { platform: null }] },
    { $set: { platform: 'SHOPEE' } }
  );
  console.log(`✅ Đã chuẩn hóa ${shopeeUpdate.modifiedCount} tài khoản thành [SHOPEE]!\n`);

  // 2. Đọc file TikTok 700 Acc tiktok 4.2026.xlsx
  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  console.log('2. Đang nạp workbook TikTok: 700 Acc tiktok 4.2026.xlsx...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log(`📂 Tìm thấy: ${wb.worksheets.length} Tabs. Bắt đầu bóc tách & nạp vào MongoDB...`);

  let totalParsed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (let tIdx = 0; tIdx < wb.worksheets.length; tIdx++) {
    const ws = wb.worksheets[tIdx];
    const tabName = ws.name;
    const bulkOps = [];

    ws.eachRow((row, rIdx) => {
      if (rIdx === 1 && String(row.getCell(1).value || '').toUpperCase().includes('STT')) return;

      const rowArray = [];
      row.eachCell({ includeEmpty: true }, (c) => {
        let val = c.value;
        if (val && typeof val === 'object') {
          val = val.text || val.result || JSON.stringify(val);
        }
        rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
      });

      const parsed = AccountParser.parseRow(rowArray, rIdx, {
        source_file: '700 Acc tiktok 4.2026.xlsx',
        source_tab: tabName
      });

      if (!parsed.is_valid || !parsed.username) {
        totalErrors++;
        return;
      }

      totalParsed++;

      const password_enc = parsed.password ? cryptoService.encrypt(parsed.password) : undefined;
      const cookie_enc = parsed.cookie ? cryptoService.encrypt(parsed.cookie) : undefined;
      const token_enc = parsed.token ? cryptoService.encrypt(parsed.token) : undefined;
      const session_token_enc = parsed.session_token ? cryptoService.encrypt(parsed.session_token) : undefined;
      const email_password_enc = parsed.email_password ? cryptoService.encrypt(parsed.email_password) : undefined;

      const setFields = {
        username: parsed.username,
        username_normalized: parsed.username_normalized,
        platform: parsed.platform || 'TIKTOK',
        status: 'AVAILABLE',
        'metadata.source_file': '700 Acc tiktok 4.2026.xlsx',
        'metadata.source_sheet': tabName,
        'metadata.last_scan_at': new Date(),
        quality: {
          has_cookie: !!parsed.cookie,
          has_token: !!(parsed.token || parsed.session_token),
          has_email: !!parsed.email,
          parse_errors: []
        },
        tags: ['tiktok', tabName.toLowerCase()],
        updatedAt: new Date()
      };

      if (password_enc) setFields.password_enc = password_enc;
      if (cookie_enc) setFields.cookie_enc = cookie_enc;
      if (token_enc) setFields.token_enc = token_enc;
      if (session_token_enc) setFields.session_token = session_token_enc;
      if (parsed.machine_id) setFields.machine_id = parsed.machine_id;
      if (parsed.email) setFields.email = parsed.email;
      if (email_password_enc) setFields.email_password_enc = email_password_enc;
      if (parsed.custom_metadata) setFields.custom_metadata = parsed.custom_metadata;

      bulkOps.push({
        updateOne: {
          filter: { username_normalized: parsed.username_normalized },
          update: {
            $set: setFields,
            $setOnInsert: {
              createdAt: new Date(),
              history: [{
                action: 'INGEST_FROM_TIKTOK_FILE',
                actor_id: 'SYSTEM',
                timestamp: new Date()
              }]
            }
          },
          upsert: true
        }
      });
    });

    if (bulkOps.length > 0) {
      const res = await accountsCol.bulkWrite(bulkOps);
      totalInserted += res.upsertedCount;
      totalUpdated += res.modifiedCount;
      process.stdout.write(`  [${tIdx + 1}/${wb.worksheets.length}] Tab "${tabName}" -> Nạp ${bulkOps.length} acc (+${res.upsertedCount} mới)\r`);
    }
  }

  const finalTotal = await accountsCol.countDocuments();
  const byPlatform = await accountsCol.aggregate([
    { $group: { _id: '$platform', count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n\n====================================================');
  console.log('🎉 NẠP TOÀN BỘ KHO DỮ LIỆU VÀO MONGODB THÀNH CÔNG RỰC RỠ!');
  console.log('• TỔNG SỐ TÀI KHOẢN TRONG KHO MONGODB:', finalTotal);
  console.log('• THỐNG KÊ THEO TỪNG NỀN TẢNG:', byPlatform);
  console.log(`• Số tài khoản TikTok mới nạp: +${totalInserted} nick mới (+${totalUpdated} cập nhật)`);
  console.log('====================================================\n');

  await client.close();
}

ingestAll().catch(err => console.error(err));
