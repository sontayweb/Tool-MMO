const mongoose = require('mongoose');
const { PlatformRules } = require('./packages/shared/dist/domain-rules.js');
const { AccountParser } = require('./packages/shared/dist/account.parser.js');
const { UsernameNormalizer } = require('./packages/shared/dist/username.normalizer.js');

async function analyzeErrorAccounts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';
  await mongoose.connect(uri);
  const accountsColl = mongoose.connection.collection('accounts');

  const filter = PlatformRules.getCorruptedMongoFilter(undefined, true);
  const total = await accountsColl.countDocuments(filter);

  console.log(`========================================================================`);
  console.log(`🔍 PHÂN TÍCH CHUYÊN SÂU ${total} TÀI KHOẢN TRONG DANH SÁCH LỖI`);
  console.log(`========================================================================\n`);

  const cursor = accountsColl.find(filter);

  let rescuableNew = 0;
  let rescuableDup = 0;
  let proxyCount = 0;
  let pureNumbersCount = 0;
  let emptyOrFormulaCount = 0;
  let otherJunkCount = 0;
  let hiddenNickCount = 0;
  let trueNotesAndJunkCount = 0;
  let unfixableNoCreds = 0;

  const samplesRescuable = [];
  const samplesExcel = [];
  const samplesNoUsername = [];

  while (await cursor.hasNext()) {
    const acc = await cursor.next();
    const platformCtx = { default_platform: acc.platform || 'SHOPEE' };
    let parsed = null;

    if (acc.raw?.values && Array.isArray(acc.raw.values) && acc.raw.values.length > 0) {
      parsed = AccountParser.parseRow(acc.raw.values, 0, platformCtx);
    } else if (acc.raw?.raw_text) {
      parsed = AccountParser.parseLine(acc.raw.raw_text, 0, platformCtx);
    } else if (typeof acc.raw === 'string' && acc.raw.trim()) {
      parsed = AccountParser.parseLine(acc.raw, 0, platformCtx);
    }

    const rawStr = JSON.stringify(acc.raw?.values || acc.raw?.raw_text || acc.raw || '');
    const u = acc.username || '';

    if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/.test(u) || acc.metadata?.source_sheet?.toLowerCase().includes('proxy')) {
        proxyCount++;
      } else if (/^\d{1,5}$/.test(u)) {
        pureNumbersCount++;
      } else if (['#VALUE!', '#REF!', '-', '--', 'zz'].includes(u.toLowerCase()) || rawStr.includes('#VALUE!') || rawStr.includes('#REF!')) {
        emptyOrFormulaCount++;
      } else {
        // Kiểm tra xem trong các cell có cell nào chứa username + password hợp lệ không
        const allCells = acc.raw?.values || (acc.raw?.raw_text ? acc.raw.raw_text.split('|') : []);
        let foundHiddenNick = false;
        for (let i = 0; i < allCells.length; i++) {
          const cell = String(allCells[i] || '').trim();
          if (cell.includes('|')) {
            const parts = cell.split('|').map(s => s.trim());
            if (parts.length >= 2 && PlatformRules.isValidUsername(acc.platform || 'SHOPEE', parts[0]) && parts[1].length >= 6) {
              foundHiddenNick = true;
              break;
            }
          } else if (PlatformRules.isValidUsername(acc.platform || 'SHOPEE', cell)) {
            const nextCell = String(allCells[i+1] || '').trim();
            if (nextCell && nextCell.length >= 6 && !nextCell.includes('@') && !nextCell.startsWith('M.C')) {
              foundHiddenNick = true;
              break;
            }
          }
        }

        if (foundHiddenNick) {
          hiddenNickCount++;
        } else {
          trueNotesAndJunkCount++;
        }
        otherJunkCount++;
      }
      continue;
    }

    // Has valid username
    const hasCoreCreds = !!(parsed.password || parsed.cookie || parsed.token || parsed.session_token);
    if (!hasCoreCreds) {
      unfixableNoCreds++;
      continue;
    }

    // Check duplicate in DB
    const normalized = UsernameNormalizer.normalize(parsed.username);
    const targetPlatform = parsed.platform || acc.platform || 'SHOPEE';
    const exists = await accountsColl.countDocuments({
      _id: { $ne: acc._id },
      username_normalized: normalized,
      platform: targetPlatform
    });

    if (exists > 0) {
      rescuableDup++;
    } else {
      rescuableNew++;
      if (samplesRescuable.length < 5) {
        samplesRescuable.push({
          corruptedUser: acc.username,
          realUser: parsed.username,
          hasPass: !!parsed.password,
          hasCookie: !!parsed.cookie,
          email: parsed.email || 'N/A',
          file: acc.metadata?.source_file,
          sheet: acc.metadata?.source_sheet
        });
      }
    }
  }

  const totalRescuable = rescuableNew + rescuableDup;
  const totalUnfixable = proxyCount + emptyOrFormulaCount + pureNumbersCount + otherJunkCount + unfixableNoCreds;

  console.log(`📊 TỔNG KẾT KẾT QUẢ PHÂN TÍCH:`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`1. 🟢 NICK CÓ THỂ CỨU HỘ: ${totalRescuable}`);
  console.log(`\n2. 🔴 CHI TIẾT NGUYÊN NHÂN 2.568 DÒNG LỖI THẬT:`);

  // Phân tích nguồn gốc và đặc điểm
  const junkBySource = {};
  const sampleJunkTypes = {
    proxy: [],
    notes: [],
    formula: [],
    empty: []
  };

  const cursor2 = accountsColl.find(filter);
  while (await cursor2.hasNext()) {
    const acc = await cursor2.next();
    const platformCtx = { default_platform: acc.platform || 'SHOPEE' };
    let parsed = null;
    if (acc.raw?.values && Array.isArray(acc.raw.values) && acc.raw.values.length > 0) {
      parsed = AccountParser.parseRow(acc.raw.values, 0, platformCtx);
    } else if (acc.raw?.raw_text) {
      parsed = AccountParser.parseLine(acc.raw.raw_text, 0, platformCtx);
    }

    if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
      const src = `${acc.metadata?.source_file || 'Không rõ'} [Tab: ${acc.metadata?.source_sheet || 'Không rõ'}]`;
      junkBySource[src] = (junkBySource[src] || 0) + 1;

      const u = acc.username || '';
      const rawStr = JSON.stringify(acc.raw?.values || acc.raw?.raw_text || '');
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/.test(u) || (acc.metadata?.source_sheet || '').toLowerCase().includes('proxy')) {
        if (sampleJunkTypes.proxy.length < 3) sampleJunkTypes.proxy.push({ user: u, raw: rawStr, src });
      } else if (['#VALUE!', '#REF!', '-', '--', 'zz'].includes(u.toLowerCase()) || rawStr.includes('#VALUE!')) {
        if (sampleJunkTypes.formula.length < 3) sampleJunkTypes.formula.push({ user: u, raw: rawStr, src });
      } else {
        if (sampleJunkTypes.notes.length < 8) sampleJunkTypes.notes.push({ user: u, raw: rawStr, src });
      }
    }
  }

  console.log(`\n📂 PHÂN BỔ 2.568 DÒNG RÁC THEO TỪNG FILE & TAB EXCEL:`);
  Object.entries(junkBySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([src, count]) => {
      console.log(`   • ${count.toString().padStart(4, ' ')} dòng: ${src}`);
    });

  console.log(`\n📌 1. MẪU DÒNG PROXY (1.042 dòng):`);
  sampleJunkTypes.proxy.forEach(s => console.log(`   - IP: "${s.user}" | Nguồn: ${s.src}`));

  console.log(`\n📌 2. MẪU DÒNG GHI CHÚ / TEXT RÁC (1.521 dòng):`);
  sampleJunkTypes.notes.forEach(s => console.log(`   - Nội dung: ${s.raw.slice(0, 100)} | Nguồn: ${s.src}`));

  console.log(`\n📌 3. MẪU DÒNG CÔNG THỨC EXCEL (5 dòng):`);
  sampleJunkTypes.formula.forEach(s => console.log(`   - Lỗi: "${s.user}" | Nguồn: ${s.src}`));

  await mongoose.disconnect();
}

analyzeErrorAccounts().catch(console.error);
