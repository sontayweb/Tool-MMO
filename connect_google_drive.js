const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');

console.log('====================================================');
console.log('   ARMS - KẾT NỐI GOOGLE DRIVE OAUTH 2.0 TỰ ĐỘNG     ');
console.log('====================================================\n');

// 1. Tìm file credentials
const files = fs.readdirSync(__dirname);
const credFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json')) || 'google_credentials.json';

if (!fs.existsSync(path.join(__dirname, credFile))) {
  console.error('❌ Lỗi: Không tìm thấy file client_secret JSON trong thư mục!');
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(path.join(__dirname, credFile), 'utf8'));
const clientInfo = creds.installed || creds.web;

if (!clientInfo) {
  console.error('❌ Lỗi: Định dạng file client_secret không hợp lệ!');
  process.exit(1);
}

const PORT = 3005;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oauth2Client = new google.auth.OAuth2(
  clientInfo.client_id,
  clientInfo.client_secret,
  REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('👉 BƯỚC 1: Hãy mở đường link bên dưới bằng trình duyệt để đăng nhập tài khoản Google:\n');
console.log(authUrl);
console.log('\n----------------------------------------------------');
console.log(`Đang chờ bạn xác thực trên trình duyệt tại cổng ${PORT}...`);

// Tạo server mini để tự động hứng mã code từ Google
const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = url.parse(req.url, true);
    if (reqUrl.pathname === '/') {
      const code = reqUrl.query.code;
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #10b981;">🎉 XÁC THỰC GOOGLE DRIVE THÀNH CÔNG!</h1>
            <p style="font-size: 18px; color: #374151;">Hệ thống ARMS đã kết nối thành công với Google Drive của bạn.</p>
            <p style="color: #6b7280;">Bạn có thể đóng tab trình duyệt này và quay lại màn hình làm việc.</p>
          </div>
        `);

        console.log('\n✅ Đã nhận mã xác thực từ Google! Đang tạo Refresh Token...');
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Lưu tokens vào file google_token.json
        fs.writeFileSync(path.join(__dirname, 'google_token.json'), JSON.stringify(tokens, null, 2), 'utf8');
        console.log('💾 Đã lưu Refresh Token vào file: google_token.json (Vĩnh viễn không cần đăng nhập lại!)');

        // Test đọc danh sách Google Drive ngay lập tức
        console.log('\n🚀 Đang chạy Test quét danh sách Google Sheets trên Drive của bạn...');
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const driveRes = await drive.files.list({
          q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
          fields: 'nextPageToken, files(id, name, modifiedTime, owners)',
          pageSize: 10
        });

        console.log(`\n🎉 KẾT NỐI DRIVE THÀNH CÔNG RỰC RỠ!`);
        console.log(`📊 Tìm thấy một số file mẫu đầu tiên trên Drive của bạn:`);
        const filesList = driveRes.data.files || [];
        filesList.forEach((f, idx) => {
          console.log(`  ${idx + 1}. [${f.name}] (ID: ${f.id})`);
        });

        console.log('\n====================================================');
        console.log('✅ HỆ THỐNG ACTIVE INGRESS DRIVE ĐÃ SẴN SÀNG 100%!');
        console.log('====================================================\n');

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 2000);
      }
    }
  } catch (err) {
    console.error('❌ Lỗi xác thực OAuth:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Lỗi xác thực: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Server xác thực mini đang lắng nghe tại: ${REDIRECT_URI}`);
});
