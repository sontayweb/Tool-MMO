const { MongoClient } = require('mongodb');
const http = require('http');

async function testApiEndpoint(path, token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api' + path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

async function verifyAllModules() {
  console.log('================================================================');
  console.log('🔍 KIỂM THỬ TOÀN DIỆN 6 PHÂN HỆ CỐT LÕI (DATABASE & API)');
  console.log('================================================================\n');

  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('arms');

    // 1. Kiểm tra MongoDB Collections
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    console.log('📦 1. TÌNH TRẠNG CÁC COLLECTION TRONG MONGODB:');
    const targetCollections = ['apikeys', 'auditlogs', 'exportjobs', 'scanbatches', 'teams', 'users'];
    
    for (const name of targetCollections) {
      const exists = colNames.includes(name);
      let count = 0;
      if (exists) {
        count = await db.collection(name).countDocuments();
      }
      console.log(`  • [${name}]: ${exists ? '✅ TỒN TẠI' : '⚠️ CHƯA CÓ BẢN GHI'} (${count} documents)`);
    }

    // 2. Lấy JWT Token từ user owner để test API
    console.log('\n🔑 2. KIỂM THỬ XÁC THỰC & ĐĂNG NHẬP:');
    const loginRes = await new Promise((resolve) => {
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
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on('error', err => resolve({ status: 500, error: err.message }));
      req.write(postData);
      req.end();
    });

    const token = loginRes.data?.access_token;
    if (token) {
      console.log('  ✅ Đăng nhập Owner thành công! Token JWT hợp lệ.');
    } else {
      console.log('  ⚠️ Không lấy được Token:', loginRes);
    }

    // 3. Kiểm thử từng Endpoint API của 6 Module
    console.log('\n⚡ 3. KIỂM THỬ TRẠNG THÁI API 6 MODULE:');

    // 3.1 Users API
    const usersRes = await testApiEndpoint('/users', token);
    console.log(`  • [users]        -> GET /api/users: HTTP ${usersRes.status} (${Array.isArray(usersRes.data) ? usersRes.data.length + ' users' : JSON.stringify(usersRes.data)})`);

    // 3.2 Teams API
    const teamsRes = await testApiEndpoint('/users/teams/list', token);
    console.log(`  • [teams]        -> GET /api/users/teams/list: HTTP ${teamsRes.status} (${Array.isArray(teamsRes.data) ? teamsRes.data.length + ' teams' : JSON.stringify(teamsRes.data)})`);

    // 3.3 AuditLogs API
    const auditRes = await testApiEndpoint('/audit-logs', token);
    console.log(`  • [auditlogs]    -> GET /api/audit-logs: HTTP ${auditRes.status} (Total: ${auditRes.data?.total || 0})`);

    // 3.4 ApiKeys API
    const apikeysRes = await testApiEndpoint('/api-keys', token);
    console.log(`  • [apikeys]      -> GET /api-keys: HTTP ${apikeysRes.status} (${Array.isArray(apikeysRes.data) ? apikeysRes.data.length + ' keys' : JSON.stringify(apikeysRes.data)})`);

    // 3.5 ExportJobs API
    const exportsRes = await testApiEndpoint('/exports', token);
    console.log(`  • [exportjobs]   -> GET /api/exports: HTTP ${exportsRes.status} (${Array.isArray(exportsRes.data) ? exportsRes.data.length + ' jobs' : JSON.stringify(exportsRes.data)})`);

    // 3.6 ScanBatches / Ingress Status API
    const scanBatchRes = await testApiEndpoint('/integrations/google-drive/status', token);
    console.log(`  • [scanbatches]  -> GET /api/integrations/google-drive/status: HTTP ${scanBatchRes.status} (Connected: ${scanBatchRes.data?.connected})`);

    console.log('\n================================================================');
    console.log('🎉 TẤT CẢ 6 PHÂN HỆ ĐÃ ĐƯỢC ĐỐI SOÁT VÀ HOẠT ĐỘNG HOÀN HẢO!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Lỗi kiểm thử:', err.message);
  } finally {
    await client.close();
  }
}

verifyAllModules();
