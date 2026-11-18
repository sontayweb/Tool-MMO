const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
const { AccountParser } = require('../../../../packages/shared/dist/account.parser.js');
const { UsernameNormalizer } = require('../../../../packages/shared/dist/username.normalizer.js');
const { PlatformRules } = require('../../../../packages/shared/dist/domain-rules.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms';

async function deepRecoveryAnalysis() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const accounts = db.collection('accounts');

    const numericAccs = await accounts.find({ username: { $regex: /^\d{1,4}$/ } }).toArray();

    let unfixableJunk = 0;
    let alreadyInAvailable = 0;
    let trulyRecoverable = 0;
    let otherBlacklisted = 0;
    const recoverableSamples = [];

    for (const acc of numericAccs) {
      const raw = acc.raw?.raw_text || (acc.raw?.values ? acc.raw.values.join(' | ') : '');
      const parsed = AccountParser.parseLine(raw);
      if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
        unfixableJunk++;
        continue;
      }

      const norm = UsernameNormalizer.normalize(parsed.username);
      const existing = await accounts.findOne({
        _id: { $ne: acc._id },
        username_normalized: norm,
        platform: parsed.platform || acc.platform || 'SHOPEE'
      });

      if (existing) {
        if (existing.status === 'AVAILABLE') {
          alreadyInAvailable++;
        } else {
          otherBlacklisted++;
        }
      } else {
        trulyRecoverable++;
        if (recoverableSamples.length < 5) {
          recoverableSamples.push({
            id: acc._id,
            oldUser: acc.username,
            newUser: parsed.username,
            password: parsed.password,
            email: parsed.email,
            cookie: !!parsed.cookie,
            source: acc.metadata?.source_file
          });
        }
      }
    }

    console.log('========================================================================');
    console.log('📊 KẾT QUẢ ĐỐI SOÁT CHUYÊN SÂU 467 TÀI KHOẢN USERNAME LÀ SỐ THỨ TỰ:');
    console.log('========================================================================');
    console.log(`1. Rác thuần túy (Dòng rỗng Excel chỉ có STT 114, 115...): ${unfixableJunk} tài khoản`);
    console.log(`2. ĐÃ CÓ trong kho AVAILABLE (Trùng lặp an toàn, không mất dữ liệu): ${alreadyInAvailable} tài khoản`);
    console.log(`3. Trùng lặp với bản ghi khác trong Blacklist: ${otherBlacklisted} tài khoản`);
    console.log(`4. 🌟 CỨU HỘ ĐƯỢC 100% (Chưa từng có trong AVAILABLE, thất thoát thật): ${trulyRecoverable} tài khoản`);
    console.log('------------------------------------------------------------------------');
    if (recoverableSamples.length > 0) {
      console.log('Mẫu tài khoản cứu hộ được (chưa có trong kho):');
      recoverableSamples.forEach((s, idx) => {
        console.log(`   [${idx + 1}] ID: ${s.id} | Old STT: "${s.oldUser}" ➔ New User: "${s.newUser}" | Pass: ${s.password} | Has Cookie: ${s.cookie} | Source: ${s.source}`);
      });
    }

    // Kiểm tra tương tự cho nhóm Token thiết bị (M.C...)
    const tokenAccs = await accounts.find({ username: { $regex: /^M\.C/i } }).toArray();
    let tokenRecoverable = 0;
    let tokenDuplicate = 0;
    let tokenJunk = 0;
    const tokenSamples = [];

    for (const acc of tokenAccs) {
      const raw = acc.raw?.raw_text || (acc.raw?.values ? acc.raw.values.join(' | ') : '');
      const parsed = AccountParser.parseLine(raw);
      if (!parsed || !parsed.username || !PlatformRules.isValidUsername(parsed.platform || acc.platform, parsed.username)) {
        tokenJunk++;
        continue;
      }
      const norm = UsernameNormalizer.normalize(parsed.username);
      const existing = await accounts.findOne({
        _id: { $ne: acc._id },
        username_normalized: norm,
        platform: parsed.platform || acc.platform || 'SHOPEE'
      });
      if (existing) {
        tokenDuplicate++;
      } else {
        tokenRecoverable++;
        if (tokenSamples.length < 3) {
          tokenSamples.push({
            id: acc._id,
            newUser: parsed.username,
            password: parsed.password,
            email: parsed.email,
            source: acc.metadata?.source_file
          });
        }
      }
    }

    console.log('\n========================================================================');
    console.log('📊 KẾT QUẢ ĐỐI SOÁT 106 TÀI KHOẢN USERNAME LÀ TOKEN THIẾT BỊ (M.C...):');
    console.log('========================================================================');
    console.log(`1. Rác thuần túy (chỉ chứa token, không có nick thật): ${tokenJunk} tài khoản`);
    console.log(`2. ĐÃ CÓ trong kho (Trùng lặp): ${tokenDuplicate} tài khoản`);
    console.log(`3. 🌟 CỨU HỘ ĐƯỢC 100% (Nick Full Info chưa có trong kho): ${tokenRecoverable} tài khoản`);
    if (tokenSamples.length > 0) {
      console.log('Mẫu tài khoản token cứu hộ được:');
      tokenSamples.forEach((s, idx) => {
        console.log(`   [${idx + 1}] ID: ${s.id} ➔ New User: "${s.newUser}" | Pass: ${s.password} | Email: ${s.email}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

deepRecoveryAnalysis();
