/**
 * ==============================================================================
 * PHÂN HỆ ĐỘC LẬP 1: TEST DRY-RUN TIKTOK DRIVE INGRESS (CHỈ ĐỌC & GHI LOG)
 * ==============================================================================
 * Mục đích:
 * 1. Chỉ tìm kiếm và quét các file thuộc Phân Hệ TikTok trên Google Drive.
 * 2. Bóc tách chuyên sâu các trường: Cookie ttwid, Mail gốc, Pass Mail, Dàn Boxphone.
 * 3. 🛡️ TUYỆT ĐỐI KHÔNG GHI VÀO DATABASE - CHỈ XUẤT NHẬT KÝ ĐỐI SOÁT.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ExcelJS = require('exceljs');

async function runTikTokDryRun() {
  console.log('================================================================');
  console.log('🎵 [PHÂN HỆ TIKTOK] BẮT ĐẦU QUÉT THỬ & GHI LOG (DRY-RUN)');
  console.log('🛡️ CAM KẾT: CÔ LẬP 100% - CHỈ QUÉT FILE TIKTOK, KHÔNG GHI DATABASE');
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

  // 1. Quét tìm danh sách file TikTok trên Drive
  console.log('🔍 Đang tìm kiếm các file TikTok trên Google Drive...');
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

  // Bộ lọc nghiêm ngặt TikTok
  const isTikTokFile = (name) => {
    const n = (name || '').toLowerCase();
    return n.includes('tiktok') || n.includes('700 acc') || n.includes('farm') || n.includes('boxphone') || n.startsWith('tt_');
  };

  const tiktokFiles = allFiles.filter(f => isTikTokFile(f.name));

  console.log(`📂 Tìm thấy: ${tiktokFiles.length} file tài nguyên TikTok trên Google Drive.\n`);

  const report = {
    subsystem: 'TIKTOK_MMO',
    scan_time: new Date().toLocaleString('vi-VN'),
    total_tiktok_files: tiktokFiles.length,
    total_accounts_found: 0,
    total_with_cookie: 0,
    total_with_email: 0,
    boxphone_machines: {},
    files_detail: []
  };

  for (let i = 0; i < tiktokFiles.length; i++) {
    const file = tiktokFiles[i];
    console.log(`[${i + 1}/${tiktokFiles.length}] 🎵 Đang đọc file TikTok: "${file.name}" (ID: ${file.id})...`);

    const fileDetail = {
      file_name: file.name,
      file_id: file.id,
      tabs: [],
      accounts_count: 0
    };

    try {
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

      workbook.eachSheet((worksheet) => {
        let tabRows = 0;
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return; // Bỏ qua header
          tabRows++;
          report.total_accounts_found++;

          const rowValues = row.values ? row.values.slice(1) : [];
          const rowStr = JSON.stringify(rowValues).toLowerCase();

          if (rowStr.includes('ttwid=') || rowStr.includes('sessionid=')) {
            report.total_with_cookie++;
          }
          if (rowStr.includes('@hotmail') || rowStr.includes('@gmail') || rowStr.includes('@outlook')) {
            report.total_with_email++;
          }

          // Bóc tách mã máy
          rowValues.forEach(val => {
            const strVal = String(val || '').trim();
            if (/^(m\.c\d+|p\d+k\d+|máy\s*\d+|box\s*\d+)$/i.test(strVal)) {
              report.boxphone_machines[strVal] = (report.boxphone_machines[strVal] || 0) + 1;
            }
          });
        });

        fileDetail.tabs.push({ tab_name: worksheet.name, rows: tabRows });
        fileDetail.accounts_count += tabRows;
      });

      console.log(`    ↳ Bóc tách được: ${fileDetail.tabs.length} tab | ${fileDetail.accounts_count} nick TikTok.`);
    } catch (err) {
      console.log(`    ⚠️ Lỗi đọc file: ${err.message}`);
      fileDetail.error = err.message;
    }

    report.files_detail.push(fileDetail);
    await new Promise(r => setTimeout(r, 600));
  }

  // Ghi nhật ký riêng cho TikTok
  const logPath = path.join(__dirname, 'LOG_SCAN_TIKTOK_DRY_RUN.txt');
  let logContent = `================================================================================\n`;
  logContent += `🎵 BÁO CÁO ĐỐI SOÁT PHÂN HỆ TIKTOK DRIVE (DRY-RUN CHỈ ĐỌC)\n`;
  logContent += `Thời gian quét: ${report.scan_time}\n`;
  logContent += `Tổng số file TikTok: ${report.total_tiktok_files} file\n`;
  logContent += `Tổng số tài khoản TikTok phát hiện: ${report.total_accounts_found} nick\n`;
  logContent += `• Có Cookie (ttwid / sessionid): ${report.total_with_cookie} (${report.total_accounts_found > 0 ? Math.round((report.total_with_cookie / report.total_accounts_found) * 100) : 0}%)\n`;
  logContent += `• Có Hotmail / Outlook gốc: ${report.total_with_email} (${report.total_accounts_found > 0 ? Math.round((report.total_with_email / report.total_accounts_found) * 100) : 0}%)\n`;
  logContent += `• Dàn máy nuôi Boxphone: ${Object.keys(report.boxphone_machines).length} dàn (${Object.keys(report.boxphone_machines).join(', ')})\n`;
  logContent += `================================================================================\n\n`;

  report.files_detail.forEach((f, idx) => {
    logContent += `[File ${idx + 1}] "${f.file_name}"\n`;
    logContent += `  - Tổng nick: ${f.accounts_count}\n`;
    logContent += `  - Chi tiết tab: ${f.tabs.map(t => `${t.tab_name} (${t.rows} dòng)`).join(' | ')}\n`;
    if (f.error) logContent += `  - Lỗi: ${f.error}\n`;
    logContent += `--------------------------------------------------------------------------------\n`;
  });

  fs.writeFileSync(logPath, logContent, 'utf8');

  console.log('\n================================================================');
  console.log('🎉 HOÀN TẤT QUÉT PHÂN HỆ TIKTOK!');
  console.log(`📄 Nhật ký đã lưu vào: ${logPath}`);
  console.log('🛡️ XÁC NHẬN: Không lưu bất kỳ dữ liệu nào vào MongoDB.');
  console.log('================================================================\n');
}

runTikTokDryRun().catch(err => console.error(err));
