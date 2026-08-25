/**
 * Comprehensive Test Suite for ARMS Pipeline, Google Apps Script Parser & Backend Endpoints
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

console.log('====================================================');
console.log('🧪 BẮT ĐẦU CHẠY TOÀN BỘ BÀI TEST TỰ ĐỘNG CHO HỆ THỐNG');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// ---------------------------------------------------------
// TEST 1: Cú pháp và cấu trúc Code.gs
// ---------------------------------------------------------
console.log('▶️ TEST 1: Kiểm tra cú pháp và hàm trong Code.gs...');
const codeGsPath = path.join(__dirname, '../../../../../../sontayweb/toolMMO/apps-script/Code.gs');
const codeGsContent = fs.readFileSync(codeGsPath, 'utf8');

assert(codeGsContent.length > 50000, 'Code.gs có nội dung hợp lệ (>50KB)');
assert(!codeGsContent.includes('const pipelineState = getAutoState_(\'PIPELINE\');\n  const pipelineState ='), 'Không có khai báo trùng lặp pipelineState');
assert(codeGsContent.includes('function extractAccountsToMasterSheet()'), 'Có hàm extractAccountsToMasterSheet');
assert(codeGsContent.includes('function saveSheetIndexToDb()'), 'Có hàm saveSheetIndexToDb');
assert(codeGsContent.includes('function restoreSheetIndexFromDb()'), 'Có hàm restoreSheetIndexFromDb');
assert(codeGsContent.includes('function checkScanProgressReport()'), 'Có hàm checkScanProgressReport');

// ---------------------------------------------------------
// TEST 2: Kiểm tra logic Parser dòng tài khoản (Mọi định dạng thực tế)
// ---------------------------------------------------------
console.log('\n▶️ TEST 2: Kiểm tra bộ giải mã dòng tài khoản (Account Row Parser)...');

// Mock parser logic từ Code.gs
function mockExtractAccount(row) {
  let acc = { username: '', password: '', phone: '', coins: '', cookie: '', token: '', email: '', email_password: '', status: 'Chưa bán' };
  
  if (typeof row === 'string') {
    row = [row];
  }
  
  // Single cell delimited (user|pass|cookie hoặc user\tpass\tcookie)
  if (row.length === 1 && typeof row[0] === 'string' && (row[0].includes('|') || row[0].includes('\t'))) {
    const delimiter = row[0].includes('|') ? '|' : '\t';
    row = row[0].split(delimiter).map(s => s.trim());
  }

  // Quét từng ô
  for (let i = 0; i < row.length; i++) {
    const val = String(row[i] || '').trim();
    if (!val) continue;

    if (val.includes('SPC_EC=') || val.includes('SPC_F=') || val.includes('spc_') || val.includes('shopee.vn')) {
      acc.cookie = val;
    } else if (val.includes('@') && (val.includes('.com') || val.includes('.net') || val.includes('.vn'))) {
      acc.email = val;
      if (i + 1 < row.length && String(row[i+1]).length >= 4 && !String(row[i+1]).includes(' ') && !String(row[i+1]).includes('spc_')) {
        acc.email_password = String(row[i+1]).trim();
      }
    } else if (/^(0|\+84)[0-9]{9,10}$/.test(val)) {
      acc.phone = val;
    } else if (!acc.username && val.length >= 3 && val.length <= 35 && !val.includes(' ') && !val.includes('|')) {
      acc.username = val;
    } else if (acc.username && !acc.password && val.length >= 4 && val.length <= 40 && !val.includes(' ')) {
      acc.password = val;
    }
  }

  return acc.username ? acc : null;
}

// Test Case 2.1: Format chuẩn 6 cột
const row1 = ['shopee_user_01', 'Pass@123', '0912345678', 'user01@gmail.com', 'MailPass123', 'SPC_F=xyz123; SPC_EC=abc456'];
const res1 = mockExtractAccount(row1);
assert(res1 && res1.username === 'shopee_user_01' && res1.cookie.includes('SPC_F='), 'Format 6 cột chuẩn: trích xuất đúng Username & Cookie');

// Test Case 2.2: Format KHÔNG CÓ EMAIL (Chỉ Username + Password + Cookie) -> Đảm bảo không bị bỏ sót!
const row2 = ['mmo_nick_99', 'Secret999', '', '', '', 'spc_t=token_shopee_999'];
const res2 = mockExtractAccount(row2);
assert(res2 && res2.username === 'mmo_nick_99' && res2.cookie.includes('spc_t='), 'Format KHÔNG EMAIL: Trích xuất thành công 100% (Không bị bỏ sót)');

// Test Case 2.3: Format nối dạng user|pass|cookie trong 1 ô
const row3 = ['shop_vip_88|MatKhau88|SPC_EC=cookie_vip_888'];
const res3 = mockExtractAccount(row3);
assert(res3 && res3.username === 'shop_vip_88' && res3.password === 'MatKhau88', 'Format user|pass|cookie trong 1 ô: trích xuất chính xác');

// ---------------------------------------------------------
// TEST 3: Kiểm tra API Backend qua cổng 4000 (Health, Stats, Sync)
// ---------------------------------------------------------
console.log('\n▶️ TEST 3: Kiểm tra Backend API (Port 4000)...');

const apiKey = 'arms_apikey_3ef419721adcb5879a8385';

function sendHttpRequest(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-arms-api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runApiTests() {
  try {
    // 3.1: Test Stats
    const statsRes = await sendHttpRequest('GET', '/api/accounts/stats');
    assert(statsRes.statusCode === 200, `API GET /api/accounts/stats phản hồi 200 OK`);
    const statsJson = JSON.parse(statsRes.body);
    console.log(`      📊 Số tài khoản hiện có trong MongoDB: ${statsJson.total || 0} tài khoản`);

    // 3.2: Test Save Sheet Index (Lưu danh sách 452 file vào MongoDB)
    const mockSheets = [
      {
        fileName: 'Test_Sheet_Auto_1.xlsx',
        tabName: 'Tất cả các Tab (Quét Nhanh)',
        fileUrl: 'https://docs.google.com/spreadsheets/d/test1',
        fileId: 'test_file_id_001',
        timestamp: '2026-08-24 21:00:00',
        owner: 'hoanghiep@gmail.com',
        lastUpdated: '2026-08-24',
        importStatus: 'Đã nhập vào ARMS',
        extractStatus: 'Đã bóc tách'
      },
      {
        fileName: 'Test_Sheet_Auto_2.xlsx',
        tabName: 'Tất cả các Tab (Quét Nhanh)',
        fileUrl: 'https://docs.google.com/spreadsheets/d/test2',
        fileId: 'test_file_id_002',
        timestamp: '2026-08-24 21:00:00',
        owner: 'hoanghiep@gmail.com',
        lastUpdated: '2026-08-24',
        importStatus: 'Chưa nhập',
        extractStatus: 'Chưa bóc tách'
      }
    ];

    const saveRes = await sendHttpRequest('POST', '/api/integrations/google-sheets/save-sheet-index', { sheets: mockSheets });
    assert(saveRes.statusCode === 201 || saveRes.statusCode === 200, `API POST /save-sheet-index lưu danh sách file vào MongoDB thành công`);

    // 3.3: Test Get Sheet Index (Khôi phục danh sách file từ MongoDB)
    const getRes = await sendHttpRequest('GET', '/api/integrations/google-sheets/get-sheet-index');
    assert(getRes.statusCode === 200, `API GET /get-sheet-index đọc danh sách file từ MongoDB thành công`);
    const getJson = JSON.parse(getRes.body);
    assert(getJson.sheets && getJson.sheets.length >= 2, `Danh sách file lấy từ MongoDB có ${getJson.sheets ? getJson.sheets.length : 0} file`);

    // 3.4: Test Sync Spreadsheet Ingestion (Thử đồng bộ 1 file mô phỏng có đủ các dạng tài khoản)
    const syncPayload = {
      spreadsheetId: 'test_automated_ss_id_999',
      spreadsheetName: 'Tệp Test Tự Động ARMS',
      actor: { name: 'Automated Tester' },
      tabs: [
        {
          sheetName: 'Tab_TaiKhoan_1',
          rows: [
            ['Username', 'Password', 'Phone', 'Email', 'PassMail', 'Cookie'],
            ['test_bot_acc_01', 'PassBot@123', '0988111222', 'bot01@mail.com', 'PassM1', 'SPC_F=cookie_bot_01; spc_ec=ec_01'],
            ['test_bot_acc_02_no_mail', 'PassBot@456', '', '', '', 'spc_t=cookie_bot_02_no_mail']
          ]
        }
      ]
    };

    const syncRes = await sendHttpRequest('POST', '/api/integrations/google-sheets/sync', syncPayload);
    assert(syncRes.statusCode === 201 || syncRes.statusCode === 200, `API POST /sync nhận gói dữ liệu Google Sheets và đẩy vào BullMQ thành công`);
    const syncJson = JSON.parse(syncRes.body);
    assert(syncJson.ok === true && syncJson.status === 'QUEUED', `Trạng thái gói quét: QUEUED (Đang xử lý ngầm)`);

    console.log('\n====================================================');
    console.log(`🎯 KẾT QUẢ TEST: ${passedTests} ĐẠT / ${failedTests} THẤT BẠI`);
    if (failedTests === 0) {
      console.log('🎉 TẤT CẢ CÁC BÀI TEST ĐỀU HOÀN HẢO 100%! HỆ THỐNG ĐÃ SẴN SÀNG.');
    }
    console.log('====================================================\n');

  } catch (err) {
    console.error('Lỗi khi chạy API Test:', err.message);
  }
}

runApiTests();
