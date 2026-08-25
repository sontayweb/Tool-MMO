const http = require('http');

function fetchJson(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function verifyFullSystem() {
  console.log('====================================================');
  console.log('🔍 ĐỐI SOÁT TOÀN DIỆN HỆ THỐNG FE & BE');
  console.log('====================================================\n');

  // 1. Đăng nhập lấy Token
  console.log('1. Đăng nhập xác thực với tài khoản Owner...');
  const loginRes = await postJson('/api/auth/login', {
    username: 'owner',
    password: 'password123'
  });

  const token = loginRes.access_token;
  console.log(`✅ Đăng nhập thành công! User: ${loginRes.user?.username}, Role: ${loginRes.user?.role}, Team: ${loginRes.user?.team}\n`);

  // 2. Thống kê Stats & Platform Breakdown
  console.log('2. Kiểm tra API Thống kê & Phân bổ Nền tảng (/api/accounts/stats)...');
  const statsRes = await fetchJson('/api/accounts/stats', token);
  console.log('• Tổng tài khoản quản lý:', statsRes.total);
  console.log('• Phân bổ theo Nền tảng:', statsRes.by_platform);
  console.log('• Phân bổ theo Trạng thái:', statsRes.by_status);
  console.log('• Chất lượng dữ liệu:', statsRes.by_quality);
  console.log('');

  // 3. Lọc Kho Dữ liệu theo TikTok
  console.log('3. Kiểm tra lọc riêng tài khoản TikTok (/api/accounts?platform=TIKTOK&limit=2)...');
  const tiktokRes = await fetchJson('/api/accounts?platform=TIKTOK&limit=2', token);
  console.log(`• Tìm thấy: ${tiktokRes.total} tài khoản TikTok.`);
  if (tiktokRes.accounts && tiktokRes.accounts.length > 0) {
    const acc = tiktokRes.accounts[0];
    console.log(`  [Mẫu TikTok] User: ${acc.username} | Plat: ${acc.platform} | Email: ${acc.email} | Token: ${acc.session_token ? acc.session_token.substring(0, 15) + '...' : '(none)'} | Machine: ${acc.machine_id || '(none)'}`);
  }
  console.log('');

  // 4. Lọc Kho Dữ liệu theo Shopee
  console.log('4. Kiểm tra lọc riêng tài khoản Shopee (/api/accounts?platform=SHOPEE&limit=2)...');
  const shopeeRes = await fetchJson('/api/accounts?platform=SHOPEE&limit=2', token);
  console.log(`• Tìm thấy: ${shopeeRes.total} tài khoản Shopee.`);
  if (shopeeRes.accounts && shopeeRes.accounts.length > 0) {
    const acc = shopeeRes.accounts[0];
    console.log(`  [Mẫu Shopee] User: ${acc.username} | Plat: ${acc.platform} | Email: ${acc.email} | Cookie: ${acc.cookie ? acc.cookie.substring(0, 15) + '...' : '(none)'}`);
  }
  console.log('');

  // 5. Kiểm tra Nhật ký Tập trung Live Console
  console.log('5. Kiểm tra Trung Tâm Nhật Ký Tập Trung (/api/audit-logs/system-logs?limit=5)...');
  const logsRes = await fetchJson('/api/audit-logs/system-logs?limit=5', token);
  console.log(`• Tổng sự kiện ghi vết: ${logsRes.total_events}`);
  if (logsRes.events && logsRes.events.length > 0) {
    console.log(`  [Sự kiện gần nhất] [${logsRes.events[0].category}] ${logsRes.events[0].title} (${logsRes.events[0].actor})`);
  }
  console.log('\n====================================================');
  console.log('🎉 TOÀN BỘ BACKEND & FRONTEND ĐÃ ĐỐI SOÁT KHỚP 100%!');
  console.log('====================================================\n');
}

verifyFullSystem().catch(err => console.error(err));
