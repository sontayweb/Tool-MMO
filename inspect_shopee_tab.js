const ExcelJS = require('exceljs');
const path = require('path');

async function findData() {
  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const shopeeSheet = wb.getWorksheet('tong ac shopee');
  console.log('Searching non-empty rows in "tong ac shopee"...');

  let count = 0;
  shopeeSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (count < 15) {
      const vals = row.values ? row.values.slice(1) : [];
      if (vals.some(v => v !== null && v !== undefined && String(v).trim().length > 0)) {
        console.log(`Dòng ${rowNumber}:`, JSON.stringify(vals));
        count++;
      }
    }
  });
}

findData().catch(err => console.error(err));
