/**
 * ==============================================================================
 * PHÂN HỆ ĐỘC LẬP: TEST DRY-RUN SHOPEE DRIVE INGRESS (HYBRID ENGINE CHỐNG LỖI)
 * ==============================================================================
 * Mục đích:
 * 1. Quét toàn bộ Google Drive bóc tách các file Shopee.
 * 2. Đọc Hybrid: Sheets API v4 batchGet (chống lỗi exportSizeLimitExceeded) + Stream XLSX fallback.
 * 3. Sử dụng AccountParser đã được chuẩn hóa với Cookie SPC_F / SPC_EC.
 * 4. 🛡️ TUYỆT ĐỐI KHÔNG GHI VÀO DATABASE - CHỈ XUẤT NHẬT KÝ ĐỐI SOÁT.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');
const { AccountParser } = require('./packages/shared/dist/index.js');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchViaSheetsApi(sheetsApi, fileId, retries = 5) {
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
        const tabTitle = sheetTitles[idx] || `Sheet${idx + 1}`;
        const rows = vr.values || [];
        if (rows.length > 0) {
          tabs.push({ sheetName: tabTitle, rows: rows });
        }
      });
      return tabs;
    } catch (err) {
      if (err.message && err.message.includes('Quota exceeded') && attempt < retries) {
        process.stdout.write(` [Quota - Đợi 6s nhả quota lần ${attempt}/${retries}...] `);
        await sleep(6000);
      } else if (attempt === retries) {
        throw err;
      }
    }
  }
}

async function fetchViaDriveExport(drive, file) {
  let stream;
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { responseType: 'stream' }
    );
    stream = res.data;
  } else {
    const res = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
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
          val = val.text || val.result || JSON.stringify(val);
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

async function getFileTabsHybrid(drive, sheetsApi, file) {
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    try {
      return await fetchViaSheetsApi(sheetsApi, file.id);
    } catch (apiErr) {
      try {
        return await fetchViaDriveExport(drive, file);
      } catch (exportErr) {
        throw apiErr;
      }
    }
  } else {
    return await fetchViaDriveExport(drive, file);
  }
}

async function runShopeeDryRun() {
  console.log('================================================================');
  console.log('🛒 [PHÂN HỆ SHOPEE] BẮT ĐẦU QUÉT THỬ & GHI LOG (DRY-RUN HYBRID)');
  console.log('🛡️ CAM KẾT: CÔ LẬP 100% - CHỈ QUÉT FILE SHOPEE, KHÔNG GHI DATABASE');
  console.log('================================================================\n');

  const files = fs.readdirSync(__dirname);
  const credFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json')) || 'google_credentials.json';
  const tokenPath = path.join(__dirname, 'google_token.json');

  if (!fs.existsSync(tokenPath)) {
    console.error('❌ Lỗi: Không tìm thấy google_token.json!');
    return;
  }

  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, credFile), 'utf8'));
  const clientInfo = creds.installed || creds.web;
  const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

  const oauth2Client = new google.auth.OAuth2(clientInfo.client_id, clientInfo.client_secret, 'http://localhost:3005');
  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client });

  // 1. Quét tìm danh sách file Shopee trên Drive (Đã loại trừ file TikTok)
  console.log('🔍 Đang tìm kiếm các file Shopee trên Google Drive (đã loại trừ kho TikTok)...');
  let allFiles = [];
  let pageToken = undefined;

  do {
    const res = await drive.files.list({
      q: "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx') and trashed = false",
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken: pageToken
    });

    const batch = (res.data.files || []).filter(f => !f.name?.startsWith('~') && !f.name?.startsWith('.'));
    allFiles = allFiles.concat(batch);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  // Bộ lọc loại trừ TikTok và chọn file Shopee
  const isTikTokFile = (name) => {
    const n = (name || '').toLowerCase();
    return n.includes('tiktok') || n.includes('700 acc') || n.includes('farm') || n.includes('boxphone') || n.startsWith('tt_');
  };

  const shopeeFiles = allFiles.filter(f => !isTikTokFile(f.name));

  console.log(`📂 Tìm thấy: ${shopeeFiles.length} file tài nguyên Shopee hợp lệ trên Drive.\n`);

  const report = {
    subsystem: 'SHOPEE',
    scan_time: new Date().toLocaleString('vi-VN'),
    total_shopee_files: shopeeFiles.length,
    total_accounts_found: 0,
    total_valid_shopee: 0,
    total_with_cookie: 0,
    total_with_phone: 0,
    total_with_email: 0,
    files_detail: []
  };

  for (let i = 0; i < shopeeFiles.length; i++) {
    const file = shopeeFiles[i];
    console.log(`[${i + 1}/${shopeeFiles.length}] 🛒 Đang đọc file Shopee: "${file.name}" (ID: ${file.id})...`);

    const fileDetail = {
      file_name: file.name,
      file_id: file.id,
      tabs: [],
      accounts_count: 0,
      valid_shopee_count: 0
    };

    try {
      const tabsPayload = await getFileTabsHybrid(drive, sheetsApi, file);

      if (tabsPayload && tabsPayload.length > 0) {
        tabsPayload.forEach(tab => {
          let tabRows = 0;
          let tabShopeeRows = 0;

          tab.rows.forEach((row, rowIdx) => {
            if (rowIdx === 0 && row.some(c => String(c).toLowerCase().includes('user') || String(c).toLowerCase().includes('pass') || String(c).toLowerCase().includes('cookie'))) {
              return; // Bỏ qua Header
            }

            const parsed = AccountParser.parseRow(row, rowIdx + 1, { source_file: file.name, source_tab: tab.sheetName });
            if (parsed.is_valid && parsed.username) {
              tabRows++;
              report.total_accounts_found++;

              if (parsed.platform === 'SHOPEE' || parsed.cookie?.includes('SPC_F=') || parsed.cookie?.includes('SPC_EC=')) {
                tabShopeeRows++;
                report.total_valid_shopee++;
                if (parsed.cookie) report.total_with_cookie++;
                if (parsed.phone) report.total_with_phone++;
                if (parsed.email) report.total_with_email++;
              }
            }
          });

          fileDetail.tabs.push({ tab_name: tab.sheetName, total_rows: tabRows, shopee_rows: tabShopeeRows });
          fileDetail.accounts_count += tabRows;
          fileDetail.valid_shopee_count += tabShopeeRows;
        });

        console.log(`    ↳ Bóc tách được: ${fileDetail.tabs.length} tab | ${fileDetail.valid_shopee_count} nick Shopee chuẩn (Cookie SPC_F).`);
      } else {
        console.log(`    ⏭️ File trống hoặc không có dòng dữ liệu.`);
      }

    } catch (err) {
      console.log(`    ⚠️ Lỗi đọc file: ${err.message}`);
      fileDetail.error = err.message;
    }

    report.files_detail.push(fileDetail);
    await sleep(600);
  }

  // Ghi nhật ký riêng cho Shopee
  const logPath = path.join(__dirname, 'LOG_SCAN_SHOPEE_DRY_RUN.txt');
  let logContent = `================================================================================\n`;
  logContent += `🛒 BÁO CÁO ĐỐI SOÁT PHÂN HỆ SHOPEE DRIVE (DRY-RUN HYBRID CHỈ ĐỌC)\n`;
  logContent += `Thời gian quét: ${report.scan_time}\n`;
  logContent += `Tổng số file Shopee quét: ${report.total_shopee_files} file\n`;
  logContent += `Tổng số tài khoản Shopee chuẩn phát hiện: ${report.total_valid_shopee} nick\n`;
  logContent += `• Có Cookie Shopee (.shopee.vn / SPC_F / SPC_EC): ${report.total_with_cookie}\n`;
  logContent += `• Có Số điện thoại (84...): ${report.total_with_phone}\n`;
  logContent += `• Có Hotmail / Outlook: ${report.total_with_email}\n`;
  logContent += `================================================================================\n\n`;

  report.files_detail.forEach((f, idx) => {
    logContent += `[File ${idx + 1}] "${f.file_name}"\n`;
    logContent += `  - Tổng nick Shopee: ${f.valid_shopee_count}/${f.accounts_count}\n`;
    logContent += `  - Chi tiết tab: ${f.tabs.map(t => `${t.tab_name} (${t.shopee_rows} nick Shopee)`).join(' | ')}\n`;
    if (f.error) logContent += `  - Lỗi: ${f.error}\n`;
    logContent += `--------------------------------------------------------------------------------\n`;
  });

  fs.writeFileSync(logPath, logContent, 'utf8');

  console.log('\n================================================================');
  console.log('🎉 HOÀN TẤT QUÉT PHÂN HỆ SHOPEE!');
  console.log(`📄 Nhật ký đã lưu vào: ${logPath}`);
  console.log('🛡️ XÁC NHẬN: Không lưu bất kỳ dữ liệu nào vào MongoDB.');
  console.log('================================================================\n');
}

runShopeeDryRun().catch(err => console.error(err));
