const ExcelJS = require('exceljs');
const path = require('path');
const { AccountParser } = require('./packages/shared/dist/index.js');

async function testUniversalTikTokParser() {
  console.log('====================================================');
  console.log('🧪 TEST UNIVERSAL TIKTOK & MULTI-PLATFORM PARSER');
  console.log('====================================================\n');

  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log(`📂 Đã nạp workbook: 700 Acc tiktok 4.2026.xlsx (${wb.worksheets.length} tabs)`);

  let totalParsed = 0;
  let tiktokCount = 0;
  let tokenCount = 0;
  let machineCount = 0;
  let emailCount = 0;

  const testTabs = ['200acc 55', '2552026', 'TOÀN', 'LONG', 'Sheet151'];

  for (const tabName of testTabs) {
    const ws = wb.getWorksheet(tabName);
    if (!ws) {
      console.log(`Tab ${tabName} not found, skipping.`);
      continue;
    }

    console.log(`\n🔍 Kiểm tra Tab "${tabName}" (${ws.actualRowCount} rows):`);
    let tabSampleCount = 0;

    ws.eachRow((row, rIdx) => {
      if (rIdx === 1 && String(row.getCell(1).value || '').toUpperCase().includes('STT')) return;

      const rowArray = [];
      row.eachCell({ includeEmpty: true }, (c) => {
        let val = c.value;
        if (val && typeof val === 'object') {
          val = val.text || val.result || JSON.stringify(val);
        }
        rowArray.push(val !== undefined && val !== null ? String(val).trim() : '');
      });

      const parsed = AccountParser.parseRow(rowArray, rIdx, {
        source_file: '700 Acc tiktok 4.2026.xlsx',
        source_tab: tabName
      });

      if (parsed.is_valid) {
        totalParsed++;
        if (parsed.platform === 'TIKTOK') tiktokCount++;
        if (parsed.session_token || parsed.token) tokenCount++;
        if (parsed.machine_id) machineCount++;
        if (parsed.email) emailCount++;

        if (tabSampleCount < 2) {
          tabSampleCount++;
          console.log(`  Row ${rIdx}: [${parsed.platform}] User: ${parsed.username} | Pass: ${parsed.password ? '***' : '(none)'} | Email: ${parsed.email || '(none)'} | Token: ${parsed.session_token ? parsed.session_token.substring(0, 20) + '...' : '(none)'} | Machine: ${parsed.machine_id || '(none)'} | Metadata: ${JSON.stringify(parsed.custom_metadata || {})}`);
        }
      }
    });
  }

  console.log('\n----------------------------------------------------');
  console.log(`📊 TỔNG KẾT TEST MẪU TRÊN 5 TABS:`);
  console.log(`• Tổng tài khoản bóc tách hợp lệ: ${totalParsed}`);
  console.log(`• Nhận diện đúng Platform TIKTOK: ${tiktokCount}/${totalParsed} (${Math.round(tiktokCount/totalParsed*100)}%)`);
  console.log(`• Tài khoản bóc tách được Session Token/Artifact: ${tokenCount}`);
  console.log(`• Tài khoản bóc tách được Mã Máy Boxphone: ${machineCount}`);
  console.log(`• Tài khoản bóc tách được Email: ${emailCount}`);
  console.log('====================================================\n');
}

testUniversalTikTokParser().catch(err => console.error(err));
