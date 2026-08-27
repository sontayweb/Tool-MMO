const { AccountParser, UsernameNormalizer } = require('./packages/shared/dist/index.js');

console.log('================================================================');
console.log('🧪 BỘ KIỂM THỬ TOÀN DIỆN MỌI QUY TẮC NGHIỆP VỤ (SHOPEE & TIKTOK)');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failCount++;
  }
}

// 1. Kiểm thử Shopee 6 cột chuẩn
const shopee6Col = AccountParser.parseRow(
  ['shopee_user_1', 'pass123', '84996618902', 'test@hotmail.com', 'mailpass456', '.shopee.vn=SPC_F=ABC123XYZ', '15000 xu'],
  1,
  { source_file: 'Danh sach acc.xlsx', source_tab: 'Acc ngon' }
);
assert(shopee6Col.platform === 'SHOPEE', '1. Nhận diện Platform SHOPEE từ Cookie SPC_F');
assert(shopee6Col.username === 'shopee_user_1', '1.1 Trích xuất Username Shopee');
assert(shopee6Col.phone === '84996618902', '1.2 Trích xuất Phone Shopee');
assert(shopee6Col.cookie === '.shopee.vn=SPC_F=ABC123XYZ', '1.3 Trích xuất Cookie SPC_F');
assert(shopee6Col.custom_metadata?.coins === '15000 xu', '1.4 Trích xuất Số xu Shopee');

// 2. Kiểm thử Shopee 7 cột có STT
const shopee7Col = AccountParser.parseRow(
  ['1', 'shopee_user_2', 'pass123', '84815789342', 'test2@hotmail.com', 'mailpass456', 'spc_f=DEF456UVW', '50000'],
  2,
  { source_file: 'Shopee Tong.xlsx', source_tab: 'T1' }
);
assert(shopee7Col.platform === 'SHOPEE', '2. Nhận diện Platform SHOPEE có cột STT');
assert(shopee7Col.username === 'shopee_user_2', '2.1 Trích xuất Username bỏ qua STT');
assert(shopee7Col.phone === '84815789342', '2.2 Trích xuất Phone Shopee có STT');

// 3. Kiểm thử TikTok 7 cột có Boxphone & Sản phẩm
const tiktok7Col = AccountParser.parseRow(
  ['tiktok_user_1', 'pass123', 'hotm@hotmail.com', 'passmail', '10 gói milo', 'p2k1', 'Nuôi acc'],
  3,
  { source_file: '700 Acc tiktok 4.2026.xlsx', source_tab: 'p2k1' }
);
assert(tiktok7Col.platform === 'TIKTOK', '3. Nhận diện Platform TIKTOK');
assert(tiktok7Col.machine_id === 'p2k1', '3.1 Trích xuất Mã Dàn Máy Boxphone p2k1');
assert(tiktok7Col.custom_metadata?.product === '10 gói milo', '3.2 Trích xuất Sản phẩm Seeding');

// 4. Kiểm thử Tab "tong ac shopee" nằm bên trong File TikTok
const tabShopeeInTiktokFile = AccountParser.parseRow(
  ['shopee_in_tt', 'pass123', '84996618154', 'shopeett@hotmail.com', 'passmail', '.shopee.vn=SPC_F=ZXC999'],
  4,
  { source_file: '700 Acc tiktok 4.2026.xlsx', source_tab: 'tong ac shopee' }
);
assert(tabShopeeInTiktokFile.platform === 'SHOPEE', '4. Tự động định tuyến tab "tong ac shopee" về SHOPEE dù file tên TikTok');

// 5. Kiểm thử Loại trừ Username dính Email/Cookie rác (Code.gs line 1348)
const invalidUserRow = AccountParser.parseRow(
  ['bad_user@hotmail.com', 'pass123', '84996618154', 'test@hotmail.com', 'passmail', 'spc_f=123'],
  5,
  { source_file: 'Test.xlsx', source_tab: 'Sheet1' }
);
assert(invalidUserRow.is_valid === false, '5. Loại trừ username rác bị dính ký tự @');

console.log('\n================================================================');
console.log(`📊 TỔNG KẾT: ${passCount} PASSED / ${failCount} FAILED`);
if (failCount === 0) {
  console.log('🎉 100% CÁC QUY TẮC NGHIỆP VỤ ĐÃ ĐƯỢC BẢO ĐẢM HOÀN HẢO!');
}
console.log('================================================================\n');
