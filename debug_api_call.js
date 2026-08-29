const http = require('http');

async function checkSanitationStats() {
  const loginData = JSON.stringify({ username: 'owner', password: 'password123' });
  const loginReq = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(loginData);
    req.end();
  });

  const token = loginReq.access_token;

  const stats = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 4000,
      path: '/api/accounts/sanitation/stats',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });

  console.log('Sanitation Hub Stats Response:', stats);
}

checkSanitationStats().catch(console.error);
