const ExcelJS = require('exceljs');
const path = require('path');

async function inspectExportFile() {
  const filePath = path.join(__dirname, 'exports', 'export-6a8c85546fe5e6c2cfef885a.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('====================================================');
  console.log('📑 KIỂM TRA FILE XUẤT EXCEL CŨ: export-6a8c85546fe5e6c2cfef885a.xlsx');
  console.log('====================================================\n');

  workbook.eachSheet((worksheet) => {
    console.log(`- Sheet Name: "${worksheet.name}" | Total Rows: ${worksheet.rowCount}`);
    
    // In header row (row 1)
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => headers.push(cell.value));
    console.log('  ↳ Các cột Header (Dòng 1):', headers);

    // In 3 dòng dữ liệu đầu tiên
    for (let r = 2; r <= Math.min(4, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let v = cell.value;
        if (v && typeof v === 'object') v = v.text || JSON.stringify(v);
        values.push(v);
      });
      console.log(`  ↳ Dòng ${r}:`, values);
    }
  });
}

inspectExportFile();
