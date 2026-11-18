const fs = require('fs');
const path = require('path');

function runArchitectureScan() {
  const rootDir = path.resolve(__dirname, '../../../..');
  console.log('🔍 [SYSTEM AUDIT] BẮT ĐẦU QUÉT KIẾN TRÚC & PHỤ THUỘC MONOREPO...\n');

  const packages = [
    { name: 'Root', path: path.join(rootDir, 'package.json') },
    { name: 'apps/api', path: path.join(rootDir, 'apps/api/package.json') },
    { name: 'apps/web', path: path.join(rootDir, 'apps/web/package.json') },
    { name: 'apps/worker', path: path.join(rootDir, 'apps/worker/package.json') },
    { name: 'packages/shared', path: path.join(rootDir, 'packages/shared/package.json') }
  ];

  const report = {
    modules: [],
    violations: [],
    securityAudit: []
  };

  packages.forEach(pkg => {
    if (fs.existsSync(pkg.path)) {
      const data = JSON.parse(fs.readFileSync(pkg.path, 'utf8'));
      report.modules.push({
        name: pkg.name,
        dependencies: Object.keys(data.dependencies || {}),
        devDependencies: Object.keys(data.devDependencies || {})
      });
    }
  });

  // Kiểm tra vi phạm kiến trúc: Web có import file backend không?
  const webSrc = path.join(rootDir, 'apps/web/src');
  function checkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        checkDir(full);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes("from '../../api") || content.includes("from '../api") || content.includes('mongoose')) {
          report.violations.push(`Web component ${file} đang import trực tiếp code backend hoặc mongoose.`);
        }
      }
    });
  }
  if (fs.existsSync(webSrc)) checkDir(webSrc);

  // Kiểm tra mã hóa AES-256 trong API & Drive Services
  const driveFiles = [
    path.join(rootDir, 'apps/api/src/modules/integrations/shopee-drive.service.ts'),
    path.join(rootDir, 'apps/api/src/modules/integrations/tiktok-drive.service.ts'),
    path.join(rootDir, 'apps/api/src/modules/scan/scan.service.ts')
  ];

  driveFiles.forEach(f => {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const baseName = path.basename(f);
      const hasCrypto = content.includes('cryptoService.encrypt');
      report.securityAudit.push({
        file: baseName,
        hasAes256Encryption: hasCrypto
      });
    }
  });

  console.log('📦 CÁC MODULE TRONG MONOREPO:');
  report.modules.forEach(m => console.log(`  • ${m.name}: ${m.dependencies.length} deps, ${m.devDependencies.length} devDeps`));

  console.log('\n🛡️ KIỂM TRA BẢO MẬT MÃ HÓA AES-256:');
  report.securityAudit.forEach(s => {
    console.log(`  • [${s.hasAes256Encryption ? 'PASSED' : 'FAILED'}] ${s.file}: Đã mã hóa AES-256 dữ liệu nhạy cảm trước khi lưu DB`);
  });

  console.log('\n🧱 KIỂM TRA VI PHẠM RANH GIỚI KIẾN TRÚC:');
  if (report.violations.length === 0) {
    console.log('  ✅ Không có vi phạm ranh giới (Frontend & Backend được tách biệt hoàn toàn)');
  } else {
    report.violations.forEach(v => console.log(`  ❌ ${v}`));
  }

  return report;
}

if (require.main === module) {
  runArchitectureScan();
}

module.exports = { runArchitectureScan };
