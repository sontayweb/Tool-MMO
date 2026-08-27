const ExcelJS = require('exceljs');
const path = require('path');
const { AccountParser } = require('./packages/shared/dist/index.js');

async function testParseShopee() {
  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const shopeeSheet = wb.getWorksheet('tong ac shopee');
  console.log('================================================================');
  console.log('🧪 KIỂM THỬ BÓC TÁCH ACCOUNT PARSER TRÊN TAB "tong ac shopee"');
  console.log('================================================================\n');

  let tested = 0;
  shopeeSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (tested < 5) {
      const rawVals = row.values ? row.values.slice(1) : [];
      if (rawVals.some(v => v !== null && v !== undefined && String(v).trim().length > 0)) {
        const parsed = AccountParser.parseRow(rawVals, rowNumber, { source_file: '700 Acc tiktok', source_tab: 'tong ac shopee' });
        console.log(`[Dòng ${rowNumber}] -> Platform: ${parsed.platform} | User: ${parsed.username} | Pass: ${parsed.password} | Phone: ${parsed.phone} | Mail: ${parsed.email} | Cookie: ${parsed.cookie ? parsed.cookie.substring(0, 35) + '...' : 'None'}`);
        tested++;
      }
    }
  });
}

testParseShopee().catch(err => console.error(err));
