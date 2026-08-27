/**
 * ==============================================================================
 * DRY-RUN GOOGLE DRIVE INSPECTOR & LOG AUDIT (KHÔNG GHI VÀO DATABASE)
 * ==============================================================================
 * Mục đích:
 * 1. Quét toàn bộ Google Drive / Shared Drives.
 * 2. Phân loại chính xác từng file (TikTok vs Shopee).
 * 3. Đọc thử cấu trúc các tab và đếm số lượng tài khoản, Cookie, Mail, Dàn máy.
 * 4. Ghi toàn bộ nhật ký chi tiết ra file log JSON & TXT để bạn kiểm tra đối soát.
 * 5. 🛡️ TUYỆT ĐỐI KHÔNG GHI / SỬA / XÓA BẤT KỲ DỮ LIỆU NÀO TRONG MONGODB.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

async function runDryRunScan() {
  console.log('================================================================');
  console.log('🔍 BẮT ĐẦU CHẾ ĐỘ QUÉT THỬ & GHI LOG GOOGLE DRIVE (DRY-RUN)');
  console.log('🛡️ CAM KẾT: CHỈ ĐỌC & GHI LOG, TUYỆT ĐỐI KHÔNG LƯU VÀO DATABASE');
  console.log('================================================================\n');

  // 1. Kiểm tra Token & Client Secret
  const files = fs.readdirSync(__dirname);
  const credFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json')) || 'google_credentials.json';
  const tokenPath = path.join(__dirname, 'google_token.json');

  if (!fs.existsSync(tokenPath)) {
    console.error('❌ Lỗi: Không tìm thấy file google_token.json! Vui lòng kiểm tra file token.');
    return;
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

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  console.log('📡 Đang kết nối Google Drive API...');

  // 2. Quét danh sách toàn bộ file Sheets & XLSX (Hỗ trợ phân trang pageToken)
  let allDriveFiles = [];
  let pageToken = undefined;

  do {
    const res = await drive.files.list({
      q: "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx') and trashed = false",
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, owners)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken: pageToken
    });

    const batch = (res.data.files || []).filter(f => !f.name?.startsWith('~') && !f.name?.startsWith('.'));
    allDriveFiles = allDriveFiles.concat(batch);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`📂 Tổng cộng tìm thấy: ${allDriveFiles.length} file bảng tính trên Google Drive.\n`);

  const scanReport = {
    scan_time: new Date().toLocaleString('vi-VN'),
    total_files_found: allDriveFiles.length,
    tiktok_files_count: 0,
    shopee_files_count: 0,
    files_detail: []
  };

  const isTikTokFile = (name) => {
    const n = (name || '').toLowerCase();
    return n.includes('tiktok') || n.includes('700 acc') || n.includes('farm') || n.includes('boxphone') || n.startsWith('tt_');
  };

  for (let i = 0; i < allDriveFiles.length; i++) {
    const file = allDriveFiles[i];
    const detectedSubsystem = isTikTokFile(file.name) ? 'TIKTOK' : 'SHOPEE';
    if (detectedSubsystem === 'TIKTOK') scanReport.tiktok_files_count++;
    else scanReport.shopee_files_count++;

    console.log(`[${i + 1}/${allDriveFiles.length}] 📄 [${detectedSubsystem}] File: "${file.name}" (ID: ${file.id})`);

    const fileInfo = {
      index: i + 1,
      file_id: file.id,
      file_name: file.name,
      subsystem: detectedSubsystem,
      mime_type: file.mimeType,
      modified_time: file.modifiedTime,
      tabs: [],
      total_rows: 0,
      has_cookie_sample: false,
      has_email_sample: false,
      has_boxphone_sample: false
    };

    try {
      // Đọc luồng stream qua Drive Export
      let stream;
      if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        const res = await drive.files.export(
          { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
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

      workbook.eachSheet((worksheet) => {
        let tabRowsCount = 0;
        let sampleRow = null;

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          tabRowsCount++;
          if (rowNumber === 2 && !sampleRow) {
            sampleRow = row.values;
          }
          // Kiểm tra mẫu dữ liệu
          const rowStr = JSON.stringify(row.values || '').toLowerCase();
          if (rowStr.includes('ttwid=') || rowStr.includes('spc_ec=') || rowStr.includes('sessionid=')) {
            fileInfo.has_cookie_sample = true;
          }
          if (rowStr.includes('@hotmail') || rowStr.includes('@gmail') || rowStr.includes('@outlook')) {
            fileInfo.has_email_sample = true;
          }
          if (rowStr.includes('m.c') || rowStr.includes('p2k') || rowStr.includes('box')) {
            fileInfo.has_boxphone_sample = true;
          }
        });

        fileInfo.total_rows += tabRowsCount;
        fileInfo.tabs.push({
          tab_name: worksheet.name,
          row_count: tabRowsCount,
          sample_headers: worksheet.getRow(1).values ? worksheet.getRow(1).values.slice(1, 8) : []
        });
      });

      console.log(`    ↳ Đọc được: ${fileInfo.tabs.length} tab (${fileInfo.tabs.map(t => t.tab_name).join(', ')}) | Tổng ~${fileInfo.total_rows} dòng`);
      console.log(`    ↳ Nhận diện đặc trưng: Cookie: ${fileInfo.has_cookie_sample ? '✅' : '❌'} | Email: ${fileInfo.has_email_sample ? '✅' : '❌'} | Dàn máy: ${fileInfo.has_boxphone_sample ? '✅' : '❌'}`);

    } catch (readErr) {
      console.log(`    ⚠️ Không thể đọc nội dung file: ${readErr.message}`);
      fileInfo.read_error = readErr.message;
    }

    scanReport.files_detail.push(fileInfo);

    // Nghỉ 500ms để giữ an toàn Quota
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Ghi báo cáo ra file JSON và TXT
  const jsonReportPath = path.join(__dirname, 'DRIVE_SCAN_DRY_RUN_REPORT.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(scanReport, null, 2), 'utf8');

  const txtReportPath = path.join(__dirname, 'DRIVE_SCAN_DRY_RUN_REPORT.txt');
  let txtContent = `================================================================================\n`;
  txtContent += `📊 BÁO CÁO KẾT QUẢ QUÉT THỬ GOOGLE DRIVE (DRY-RUN LOG AUDIT)\n`;
  txtContent += `Thời gian quét: ${scanReport.scan_time}\n`;
  txtContent += `Tổng số file phát hiện: ${scanReport.total_files_found} file\n`;
  txtContent += `• Phân hệ TikTok: ${scanReport.tiktok_files_count} file\n`;
  txtContent += `• Phân hệ Shopee / Tổng thể: ${scanReport.shopee_files_count} file\n`;
  txtContent += `================================================================================\n\n`;

  scanReport.files_detail.forEach((f) => {
    txtContent += `[File ${f.index}] [${f.subsystem}] "${f.file_name}"\n`;
    txtContent += `  - ID: ${f.file_id}\n`;
    txtContent += `  - Tổng số tab: ${f.tabs.length} tab | Tổng số dòng: ~${f.total_rows} dòng\n`;
    txtContent += `  - Đặc trưng: Cookie: ${f.has_cookie_sample ? 'Có' : 'Không'} | Mail: ${f.has_email_sample ? 'Có' : 'Không'} | Boxphone: ${f.has_boxphone_sample ? 'Có' : 'Không'}\n`;
    if (f.tabs.length > 0) {
      txtContent += `  - Danh sách tab: ${f.tabs.map(t => `${t.tab_name} (${t.row_count} dòng)`).join(' | ')}\n`;
    }
    if (f.read_error) {
      txtContent += `  - Lỗi đọc: ${f.read_error}\n`;
    }
    txtContent += `--------------------------------------------------------------------------------\n`;
  });

  fs.writeFileSync(txtReportPath, txtContent, 'utf8');

  console.log('\n================================================================');
  console.log('🎉 ĐÃ HOÀN TẤT TIẾN TRÌNH QUÉT THỬ & GHI NHẬT KÝ (DRY-RUN)!');
  console.log(`📄 Đã lưu báo cáo chi tiết vào: ${txtReportPath}`);
  console.log(`📄 Đã lưu dữ liệu JSON vào: ${jsonReportPath}`);
  console.log('🛡️ XÁC NHẬN: Không có bất kỳ dòng nào được lưu/ghi đè vào Database.');
  console.log('================================================================\n');
}

runDryRunScan().catch(err => {
  console.error('❌ Lỗi tiến trình Dry-Run:', err.message);
});
