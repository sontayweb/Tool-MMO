const http = require('http');

async function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
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
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('1. Logging in as OWNER...');
  const loginRes = await makeRequest('/api/auth/login', 'POST', { username: 'owner', password: 'password123' });
  const token = loginRes.body.access_token;
  console.log('Login Status:', loginRes.status, '| Token received:', !!token);

  console.log('\n2. Testing filter: data_quality=corrupted_username');
  const corruptedRes = await makeRequest('/api/accounts?data_quality=corrupted_username&limit=5', 'GET', null, token);
  console.log('Status:', corruptedRes.status);
  console.log('Total Corrupted Accounts Found:', corruptedRes.body.total);
  if (corruptedRes.body.accounts && corruptedRes.body.accounts.length > 0) {
    console.log('Sample Accounts:');
    corruptedRes.body.accounts.forEach(a => console.log(`  - Username: "${a.username}" | Platform: ${a.platform} | Status: ${a.status} | Source: "${a.metadata?.source_file || ''}"`));
  }

  console.log('\n3. Testing filter: data_quality=missing_core');
  const missingRes = await makeRequest('/api/accounts?data_quality=missing_core&limit=5', 'GET', null, token);
  console.log('Status:', missingRes.status);
  console.log('Total Missing Core Accounts Found:', missingRes.body.total);

  console.log('\n4. Testing filter: data_quality=full_info');
  const fullRes = await makeRequest('/api/accounts?data_quality=full_info&limit=5', 'GET', null, token);
  console.log('Status:', fullRes.status);
  console.log('Total Full Info Accounts Found:', fullRes.body.total);
}

runTest().catch(console.error);
