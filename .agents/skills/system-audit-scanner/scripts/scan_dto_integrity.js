const fs = require('fs');
const path = require('path');

function runDtoScan() {
  const rootDir = path.resolve(__dirname, '../../../..');
  console.log('🔍 [SYSTEM AUDIT] BẮT ĐẦU QUÉT TÍNH TOÀN VẸN DTO & DATA PIPELINE...\n');

  // 1. Đọc Account Schema
  const schemaPath = path.join(rootDir, 'packages/shared/src/schemas.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // 2. Đọc Accounts Service
  const servicePath = path.join(rootDir, 'apps/api/src/modules/accounts/accounts.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  // 3. Đọc Frontend AccountDetailModal
  const modalPath = path.join(rootDir, 'apps/web/src/components/accounts/AccountDetailModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // 4. Đọc Scan Service
  const scanServicePath = path.join(rootDir, 'apps/api/src/modules/scan/scan.service.ts');
  const scanServiceContent = fs.readFileSync(scanServicePath, 'utf8');

  // Trích xuất phần return trong formatAccount
  const formatAccountStart = serviceContent.indexOf('private formatAccount');
  const returnObjMatch = formatAccountStart !== -1 
    ? serviceContent.substring(formatAccountStart).match(/return\s*\{([\s\S]*?)\n\s*\};/)
    : null;
  const formatBody = returnObjMatch ? returnObjMatch[1] : '';

  // Danh sách các trường dữ liệu cốt lõi của Account
  const coreFields = [
    'username', 'platform', 'machine_id', 'phone', 'coins', 'email', 
    'password', 'cookie', 'token', 'session_token', 'email_password',
    'status', 'health_status', 'quality', 'metadata', 'raw', 'custom_metadata', 'tags'
  ];

  const results = {
    schemaFields: coreFields,
    apiExposed: [],
    apiMissing: [],
    feUsedButMissingInApi: [],
    scanOfflineMissingRaw: false
  };

  coreFields.forEach(field => {
    // Kiểm tra API formatAccount có trả về trường này không (cả dạng field: và shorthand field,)
    const regex = new RegExp(`\\b${field}\\b(\\s*:|\\s*,|\\s*\\}|\\s*$)`, 'im');
    if (regex.test(formatBody)) {
      results.apiExposed.push(field);
    } else {
      results.apiMissing.push(field);
    }
  });

  // Kiểm tra frontend sử dụng những trường nào
  results.apiMissing.forEach(missingField => {
    if (modalContent.includes(`account.${missingField}`)) {
      results.feUsedButMissingInApi.push(missingField);
    }
  });

  // Kiểm tra scan offline có lưu raw không
  if (!scanServiceContent.includes('raw:') && !scanServiceContent.includes("'raw':")) {
    results.scanOfflineMissingRaw = true;
  }

  console.log('----------------------------------------------------');
  console.log('📋 KẾT QUẢ QUÉT TÍNH TOÀN VẸN DTO:');
  console.log('----------------------------------------------------');
  console.log('• Tổng số trường Schema định nghĩa:', coreFields.length);
  console.log('• Các trường API đã trả về:', results.apiExposed.join(', '));
  console.log('• ⚠️ CÁC TRƯỜNG BỊ RƠI RỤNG TẠI API (accounts.service.ts):', results.apiMissing.join(', '));
  console.log('• 🚨 CÁC TRƯỜNG GIAO DIỆN FE CẦN NHƯNG API BỎ QUÊN:', results.feUsedButMissingInApi.join(', '));
  console.log('• ⚠️ QUÉT SCAN OFFLINE LƯU RAW:', results.scanOfflineMissingRaw ? 'CẢNH BÁO: scan.service.ts CHƯA LƯU trường raw!' : 'ĐÃ ĐẦY ĐỦ');
  console.log('----------------------------------------------------\n');

  return results;
}

if (require.main === module) {
  runDtoScan();
}

module.exports = { runDtoScan };
