const http = require('http');
const { MongoClient } = require('mongodb');

async function checkSyncProgressDetails() {
  console.log('========================================================================');
  console.log('🔬 ĐỐI SOÁT CHI TIẾT TIẾN TRÌNH ĐỒNG BỘ SHOPEE DRIVE (FORENSIC AUDIT)');
  console.log('========================================================================\n');

  // 1. Đăng nhập lấy token
  const token = await new Promise((resolve) => {
    const postData = JSON.stringify({ username: 'owner', password: 'password123' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).access_token);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });

  // 2. Gọi API lấy status của Shopee Drive
  const statusRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/integrations/shopee-drive/status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.end();
  });

  console.log('📊 1. TRẠNG THÁI HIỆN TẠI CỦA SHOPEE DRIVE SERVICE:');
  const prog = statusRes.progress || {};
  console.log(`  • Trạng thái (Stage): ${prog.stage}`);
  console.log(`  • Đang chạy (is_running): ${prog.is_running}`);
  console.log(`  • Tiến độ file: ${prog.files_processed} / ${prog.files_total} files (${Math.round((prog.files_processed/(prog.files_total||1))*100)}%)`);
  console.log(`  • Tổng tài khoản tìm thấy: ${prog.accounts_total_found?.toLocaleString()} dòng`);
  console.log(`  • Thêm mới (Inserted): +${prog.accounts_inserted?.toLocaleString()} nick`);
  console.log(`  • Cập nhật đè (Updated): +${prog.accounts_updated?.toLocaleString()} nick`);
  console.log(`  • Lỗi format: ${prog.accounts_errors?.toLocaleString()}`);
  console.log(`  • Bắt đầu: ${prog.started_at ? new Date(prog.started_at).toLocaleTimeString('vi-VN') : 'N/A'}`);
  console.log(`  • Kết thúc: ${prog.completed_at ? new Date(prog.completed_at).toLocaleTimeString('vi-VN') : 'Chưa kết thúc'}`);

  console.log('\n📑 2. 15 DÒNG NHẬT KÝ CUỐI CÙNG:');
  const logs = prog.logs || [];
  logs.slice(-15).forEach(l => console.log('  ' + l));

  // 3. Kiểm tra DB
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('arms');
  const total = await db.collection('accounts').countDocuments();
  console.log(`\n📦 3. THỰC TẾ TRONG DATABASE MONGODB: ${total.toLocaleString()} tài khoản`);
  await client.close();
}

checkSyncProgressDetails();
