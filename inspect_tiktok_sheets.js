const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function analyze() {
  const filePath = path.join(__dirname, '700 Acc tiktok 4.2026.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('File not found at:', filePath);
    return;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log('Total worksheets:', wb.worksheets.length);

  const patterns = {
    standard_4col: [], // User | Pass | Mail | PassMail
    standard_with_meta: [], // User | Pass | Mail | PassMail | Product | Machine | Date
    pipe_delimited: [], // user|pass|...
    mail_only: [],
    custom_layout: []
  };

  let totalRows = 0;
  const tabReports = [];

  wb.worksheets.forEach((ws, idx) => {
    const rowCount = ws.actualRowCount;
    totalRows += rowCount;
    const sampleRows = [];
    ws.eachRow((r, rIdx) => {
      if (rIdx <= 5) {
        const rowVals = [];
        r.eachCell({ includeEmpty: true }, (c) => {
          let val = c.value;
          if (val && typeof val === 'object') {
            val = val.text || val.result || JSON.stringify(val);
          }
          rowVals.push(val ? String(val).trim() : '');
        });
        sampleRows.push(rowVals);
      }
    });

    // Detect format
    let detectedType = 'custom_layout';
    if (sampleRows.length > 0) {
      const row1 = sampleRows[0];
      const hasPipe = row1.some(c => c && c.includes('|'));
      const hasEmailInCol3 = row1[2] && row1[2].includes('@');
      const hasMachineCode = row1.some(c => c && /p\d+k\d+|máy/i.test(c));

      if (hasPipe) {
        detectedType = 'pipe_delimited';
        patterns.pipe_delimited.push(ws.name);
      } else if (hasEmailInCol3 && hasMachineCode) {
        detectedType = 'standard_with_meta';
        patterns.standard_with_meta.push(ws.name);
      } else if (hasEmailInCol3) {
        detectedType = 'standard_4col';
        patterns.standard_4col.push(ws.name);
      } else {
        patterns.custom_layout.push(ws.name);
      }
    }

    tabReports.push({
      tabIndex: idx + 1,
      tabName: ws.name,
      rowCount: rowCount,
      detectedType: detectedType,
      sample: sampleRows.slice(0, 2)
    });
  });

  const summary = {
    fileName: '700 Acc tiktok 4.2026.xlsx',
    totalTabs: wb.worksheets.length,
    totalRowsEstimated: totalRows,
    patternsSummary: {
      standard_4col: patterns.standard_4col.length,
      standard_with_meta: patterns.standard_with_meta.length,
      pipe_delimited: patterns.pipe_delimited.length,
      custom_layout: patterns.custom_layout.length
    },
    tabs: tabReports
  };

  fs.writeFileSync(path.join(__dirname, 'tiktok_analysis_data.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('SUCCESS! Summary written to tiktok_analysis_data.json');
  console.log(`Total tabs: ${summary.totalTabs}, Total rows approx: ${totalRows}`);
  console.log('Pattern distribution:', summary.patternsSummary);
}

analyze().catch(err => console.error('Error:', err));
