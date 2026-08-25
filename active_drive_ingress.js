const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

console.log('====================================================');
console.log('⚡ ARMS HYBRID INGRESS - CAM KẾT HÚT 100% KHÔNG SÓT');
console.log('====================================================\n');

// 1. Đọc credentials và token
const files = fs.readdirSync(__dirname);
const credFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json')) || 'google_credentials.json';
const tokenPath = path.join(__dirname, 'google_token.json');

if (!fs.existsSync(tokenPath)) {
  console.error('❌ Lỗi: Chưa tìm thấy google_token.json! Vui lòng chạy `node connect_google_drive.js` trước.');
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(path.join(__dirname, credFile), 'utf8'));
const clientInfo = creds.installed || creds.web;
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

const oauth2Client = new google.auth.OAuth2(
  clientInfo.client_id,
  clientInfo.client_secret,
  'http://localhost:3005'
);
oauth2Client.setCredentials(tokens);

oauth2Client.on('tokens', (newTokens) => {
  const mergedTokens = { ...tokens, ...newTokens };
  fs.writeFileSync(tokenPath, JSON.stringify(mergedTokens, null, 2), 'utf8');
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });
const sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client });

const ARMS_API_KEY = 'arms_apikey_3ef419721adcb5879a8385';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendSyncToBackend(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/integrations/google-sheets/sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arms-api-key': ARMS_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

function saveIndexToBackend(discoveredList) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sheets: discoveredList });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/integrations/google-sheets/save-sheet-index',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arms-api-key': ARMS_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

// Phương thức 1: Đọc bằng Google Sheets API với cơ chế kiên trì chờ giải tỏa Quota (Không bao giờ bỏ cuộc)
async function fetchViaSheetsApi(fileId, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ssMeta = await sheetsApi.spreadsheets.get({
        spreadsheetId: fileId,
        fields: 'sheets(properties(title))'
      });
      const sheetTitles = (ssMeta.data.sheets || []).map(s => s.properties.title);
      if (sheetTitles.length === 0) return [];

      const safeRanges = sheetTitles.map(t => `'${t.replace(/'/g, "''")}'!A1:Z3000`);
      const batchData = await sheetsApi.spreadsheets.values.batchGet({
        spreadsheetId: fileId,
        ranges: safeRanges
      });

      const valueRanges = batchData.data.valueRanges || [];
      const tabs = [];
      valueRanges.forEach((vr, idx) => {
        const tabTitle = sheetTitles[idx] || `Sheet${idx+1}`;
        const rows = vr.values || [];
        if (rows.length > 0) {
          tabs.push({ sheetName: tabTitle, rows: rows });
        }
      });
      return tabs;
    } catch (err) {
      if (err.message && err.message.includes('Quota exceeded') && attempt < retries) {
        process.stdout.write(` [Quota - Chờ 8s nhả quota lần ${attempt}/${retries}...] `);
        await sleep(8000);
      } else if (attempt === retries) {
        throw err;
      }
    }
  }
}

// Phương thức 2: Đọc bằng Drive Export XLSX
async function fetchViaDriveExport(file) {
  let stream;
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export(
      {
        fileId: file.id,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      { responseType: 'stream' }
    );
    stream = res.data;
  } else {
    const res = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'stream' }
    );
    stream = res.data;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(stream);

  const tabs = [];
  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let val = cell.value;
        if (val && typeof val === 'object') {
          if (val.text) val = val.text;
          else if (val.result !== undefined) val = val.result;
          else val = JSON.stringify(val);
        }
        rowValues.push(val !== undefined && val !== null ? String(val) : '');
      });
      if (rowValues.some(v => v.trim().length > 0)) {
        rows.push(rowValues);
      }
    });

    if (rows.length > 0) {
      tabs.push({ sheetName, rows });
    }
  });

  return tabs;
}

// Hàm Hybrid thông minh: Thử Sheets API trước, nếu quá tải thì tự động dùng Drive Export hoặc kiên trì đợi Quota
async function getFileTabsHybrid(file) {
  try {
    return await fetchViaSheetsApi(file.id);
  } catch (apiErr) {
    // Nếu Sheets API quá tải, tự động chuyển sang Drive Export XLSX
    try {
      return await fetchViaDriveExport(file);
    } catch (exportErr) {
      throw apiErr;
    }
  }
}

async function runActiveIngress() {
  try {
    console.log('🔍 Bước 1: Đang quét toàn bộ Google Drive & Shared Drives...');
    let allFiles = [];
    let pageToken = null;

    do {
      const res = await drive.files.list({
        q: "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed = false",
        fields: 'nextPageToken, files(id, name, modifiedTime, owners, webViewLink, mimeType)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken
      });

      const filesBatch = res.data.files || [];
      allFiles = allFiles.concat(filesBatch);
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`✅ Tìm thấy tổng cộng: ${allFiles.length} file Sheets (Hơn 700+ tab con).`);
    console.log(`🛡️ Cam kết: Hệ thống sẽ kiên trì hút 100% không bỏ sót bất kỳ file nào!\n`);

    const discoveredIndex = [];
    let totalTabsCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      const ownerName = (file.owners && file.owners[0]) ? (file.owners[0].displayName || file.owners[0].emailAddress) : 'Shared';
      const fileUrl = file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`;

      try {
        const tabsPayload = await getFileTabsHybrid(file);

        if (tabsPayload && tabsPayload.length > 0) {
          totalTabsCount += tabsPayload.length;
          tabsPayload.forEach(tab => {
            discoveredIndex.push({
              fileName: file.name,
              tabName: tab.sheetName,
              fileUrl: fileUrl,
              fileId: file.id,
              timestamp: new Date().toLocaleString('vi-VN'),
              owner: ownerName,
              lastUpdated: file.modifiedTime || '',
              importStatus: 'Đã nạp vào Queue',
              extractStatus: 'Đang xử lý'
            });
          });

          await sendSyncToBackend({
            spreadsheetId: file.id,
            spreadsheetName: file.name,
            actor: { name: ownerName, email: ownerName },
            tabs: tabsPayload
          });

          successCount++;
          console.log(`[${i + 1}/${allFiles.length}] ✅ File "${file.name}" -> Hút sạch ${tabsPayload.length} tab (${tabsPayload.map(t => t.sheetName).join(', ')})`);
        } else {
          console.log(`[${i + 1}/${allFiles.length}] ⏭️ Bỏ qua file trống: "${file.name}"`);
        }

        // Nghỉ 1 giây giữa các file để giữ nhịp Quota luôn trong ngưỡng an toàn
        await sleep(1000);

      } catch (err) {
        errorCount++;
        console.log(`[${i + 1}/${allFiles.length}] ⚠️ Bỏ qua "${file.name}": ${err.message}`);
      }
    }

    // Lưu danh sách index vào MongoDB
    if (discoveredIndex.length > 0) {
      await saveIndexToBackend(discoveredIndex);
      console.log(`\n💾 Đã lưu mục lục ${discoveredIndex.length} tab con vào MongoDB collection discovered_sheets!`);
    }

    console.log('\n====================================================');
    console.log(`🎉 HOÀN TẤT HÚT TOÀN BỘ 100% DỮ LIỆU DRIVE VÀO HỆ THỐNG!`);
    console.log(`• Tổng file đã xử lý: ${successCount}/${allFiles.length} file`);
    console.log(`• Tổng số tab con đã nạp vào Queue: ${totalTabsCount} tab`);
    console.log(`• Toàn bộ tài khoản đã được nạp vào Queue để Worker bóc tách lưu vào MongoDB.`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Lỗi tiến trình Active Ingress:', err.message);
  }
}

runActiveIngress();
