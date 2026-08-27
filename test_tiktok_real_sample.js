const ExcelJS = require('exceljs');
const path = require('path');
const { AccountParser } = require('./packages/shared/dist/index.js');

async function testTikTokParser() {
  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('========================================================================');
  console.log('🎵 KIỂM THỬ THỰC TẾ BÓC TÁCH FILE 700 ACC TIKTOK:');
  console.log('========================================================================\n');

  let totalParsed = 0;
  let totalNumericUsernames = 0;
  const samples = [];

  // Quét qua 5 sheet đầu tiên của TikTok
  for (let sIdx = 0; sIdx < Math.min(10, wb.worksheets.length); sIdx++) {
    const ws = wb.worksheets[sIdx];
    if (ws.name === 'tong ac shopee') continue;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = [];
      row.eachCell({ includeEmpty: true }, c => {
        let v = c.value;
        if (v && typeof v === 'object') v = v.text || '';
        values.push(String(v || '').trim());
      });

      if (values.filter(x => x.length > 0).length < 2) return;

      const parsed = AccountParser.parseRow(values, rowNumber, 'TIKTOK');
      if (parsed.is_valid && parsed.username) {
        totalParsed++;
        if (/^\d+$/.test(parsed.username)) {
          totalNumericUsernames++;
        }
        if (samples.length < 5) {
          samples.push({
            sheet: ws.name,
            row: rowNumber,
            user: parsed.username,
            pass: parsed.password,
            email: parsed.email,
            cookie: parsed.cookie ? (parsed.cookie.substring(0, 20) + '...') : 'N/A',
            machine: parsed.machine_id || 'N/A',
            raw: values.join(' | ')
          });
        }
      }
    });
  }

  console.log(`📊 Tổng số nick TikTok bóc tách thành công: ${totalParsed}`);
  console.log(`⚠️ Số nick bị dính STT làm Username: ${totalNumericUsernames} (Kỳ vọng = 0)`);
  console.log('\n👀 MẪU 5 DÒNG TIKTOK ĐÃ BÓC TÁCH:');
  samples.forEach((s, i) => {
    console.log(`\n[Mẫu #${i + 1}] Sheet: "${s.sheet}" (Dòng ${s.row})`);
    console.log(`  • Username: "${s.user}"`);
    console.log(`  • Password: "${s.pass}"`);
    console.log(`  • Email:    "${s.email || 'N/A'}"`);
    console.log(`  • Cookie:   "${s.cookie}"`);
    console.log(`  • Máy dàn:  "${s.machine}"`);
    console.log(`  • Raw gốc:  "${s.raw}"`);
  });
}

testTikTokParser();
