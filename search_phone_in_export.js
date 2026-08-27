const ExcelJS = require('exceljs');
const path = require('path');

async function searchPhoneInExport() {
  const filePath = path.join(__dirname, 'exports', 'export-6a8c85546fe5e6c2cfef885a.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet('Exported Accounts');
  let phoneFoundCount = 0;
  const samplePhones = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim();
      // Kiểm tra xem có giá trị nào là số điện thoại (bắt đầu bằng 84 hoặc 03, 05, 07, 08, 09 và dài 10-12 số)
      if (/^(84|0)[35789]\d{8}$/.test(val)) {
        phoneFoundCount++;
        if (samplePhones.length < 5) {
          samplePhones.push({
            row: rowNumber,
            col: colNumber,
            header: worksheet.getRow(1).getCell(colNumber).value,
            value: val
          });
        }
      }
    });
  });

  console.log('====================================================');
  console.log(`📑 TỔNG SỐ Ô CHỨA SĐT TRONG FILE XUẤT CŨ: ${phoneFoundCount} / ${worksheet.rowCount} dòng`);
  console.log('====================================================');
  console.log('Mẫu các ô chứa SĐT tìm thấy:', samplePhones);
}

searchPhoneInExport();
