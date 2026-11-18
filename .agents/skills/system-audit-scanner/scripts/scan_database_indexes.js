const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function runIndexScan() {
  const rootDir = path.resolve(__dirname, '../../../..');
  console.log('🔍 [SYSTEM AUDIT] BẮT ĐẦU QUÉT CHỈ MỤC & TRUY VẤN MONGODB...\n');

  // 1. Phân tích Schemas
  const schemaPath = path.join(rootDir, 'packages/shared/src/schemas.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Trích xuất các dòng index
  const indexMatches = schemaContent.match(/AccountSchema\.index\([^)]+\);/g) || [];
  console.log('📌 CÁC CHỈ MỤC (INDEXES) ĐÃ ĐƯỢC KHAI BÁO TRONG CODE:');
  indexMatches.forEach((idx, i) => console.log(`  ${i + 1}. ${idx.trim()}`));

  // 2. Phân tích các trường lọc trong accounts.service.ts
  const servicePath = path.join(rootDir, 'apps/api/src/modules/accounts/accounts.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  const queryIssues = [];

  // Kiểm tra Text Index
  const hasTextIndex = schemaContent.includes('account_text_search_idx');

  if (serviceContent.includes('$regex: query.search')) {
    if (!hasTextIndex) {
      queryIssues.push({
        type: 'COLLSCAN_RISK_HIGH',
        location: 'accounts.service.ts: findAll() search filter',
        detail: 'Sử dụng $regex với $options: "i" trên 5 trường (username, email, notes, source_file, source_sheet) mà không có Text Index. Khi DB > 100k records sẽ gây nghẽn CPU và quét toàn bộ bảng (Full Collection Scan).'
      });
    }
  }

  // 3. Kiểm tra kết nối MongoDB thực tế
  let dbIndexes = [];
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('arms');
    dbIndexes = await db.collection('accounts').indexes();
    await client.close();

    console.log('\n📊 CÁC CHỈ MỤC THỰC TẾ ĐANG HOẠT ĐỘNG TRONG MONGODB:');
    dbIndexes.forEach((idx, i) => {
      console.log(`  ${i + 1}. Key: ${JSON.stringify(idx.key)} | Tên: ${idx.name} ${idx.unique ? '(UNIQUE)' : ''}`);
    });
  } catch (err) {
    console.log('\n⚠️ Không thể kết nối trực tiếp tới MongoDB (dùng kết quả phân tích tĩnh):', err.message);
  }

  console.log('\n----------------------------------------------------');
  console.log('🚨 PHÁT HIỆN RỦI RO HIỆU NĂNG TRUY VẤN:');
  console.log('----------------------------------------------------');
  if (queryIssues.length === 0) {
    console.log('✅ Chưa phát hiện rủi ro nghiêm trọng.');
  } else {
    queryIssues.forEach((issue, idx) => {
      console.log(`[Vấn đề #${idx + 1}] [${issue.type}] tại ${issue.location}`);
      console.log(`  ↳ Chi tiết: ${issue.detail}\n`);
    });
  }

  return { declaredIndexes: indexMatches, dbIndexes, queryIssues };
}

if (require.main === module) {
  runIndexScan();
}

module.exports = { runIndexScan };
