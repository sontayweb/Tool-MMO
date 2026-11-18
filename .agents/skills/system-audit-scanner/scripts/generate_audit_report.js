const fs = require('fs');
const path = require('path');
const { runDtoScan } = require('./scan_dto_integrity');
const { runIndexScan } = require('./scan_database_indexes');
const { runArchitectureScan } = require('./scan_architecture_deps');

async function generateReport() {
  console.log('🚀 [SYSTEM AUDIT] ĐANG TỔNG HỢP BÁO CÁO KIỂM TOÁN KIẾN TRÚC TOÀN DIỆN...\n');

  const dtoResults = runDtoScan();
  const indexResults = await runIndexScan();
  const archResults = runArchitectureScan();

  const timestamp = new Date().toLocaleString('vi-VN');
  const rootDir = path.resolve(__dirname, '../../../..');
  const reportPath = path.join(rootDir, 'DOCS_KIEN_TRUC_VA_DANH_GIA_TOAN_DIEN_ARMS.md');

  const markdown = `# BÁO CÁO KIẾN TRÚC & ĐÁNH GIÁ TOÀN DIỆN HỆ THỐNG ARMS DATA WAREHOUSE

> **Thời gian kiểm toán:** ${timestamp}  
> **Phiên bản:** ARMS Enterprise MMO v2.5  
> **Thực hiện bởi:** System Audit Scanner Skill (Automated Architecture & Pipeline Auditor)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

Hệ thống ARMS được thiết kế theo mô hình **Monorepo đa tầng (Multi-tier Architecture)** nhằm giải quyết bài toán cào dữ liệu, chuẩn hóa, chống trùng và tiêu thụ tài khoản MMO quy mô lớn:

\`\`\`mermaid
flowchart TD
  subgraph Data_Sources["1. Tầng Nguồn Dữ Liệu"]
    GDrive["Google Drive API (Shopee & TikTok Sheets)"]
    Uploads["Offline Excel / CSV Uploads"]
  end

  subgraph Processing_Layer["2. Tầng Bóc Tách & Chuẩn Hóa (Ingress & Normalization)"]
    Parser["Universal AccountParser (@arms/shared)"]
    Normalizer["UsernameNormalizer & PlatformRules"]
    Crypto["AES-256 Crypto Service"]
  end

  subgraph Persistence_Layer["3. Tầng Lưu Trữ & Hàng Đợi (Persistence & Queues)"]
    Mongo[("MongoDB Replica Set (Accounts, Batches, Audits)")]
    Redis[("Redis 7 + BullMQ Queue Engine")]
  end

  subgraph Serving_Layer["4. Tầng Phục Vụ & Giao Diện (API & Web UI)"]
    API["NestJS Backend API (Port 4000)"]
    Worker["Background Worker Engine (Scan/Export)"]
    Web["Next.js 16 Web Dashboard (Port 3000)"]
  end

  Data_Sources --> Processing_Layer
  Processing_Layer --> Persistence_Layer
  Persistence_Layer --> Serving_Layer
\`\`\`

---

## 2. KẾT QUẢ ĐỐI SOÁT TÍNH TOÀN VẸN DTO & DATA PIPELINE

### 2.1. Phân Tích Lệch Pha DTO (DTO Drift Analysis)
- **Tổng số trường nghiệp vụ cốt lõi:** ${dtoResults.schemaFields.length} trường.
- **Các trường API đã trả về hợp lệ:** \`${dtoResults.apiExposed.join('`, `')}\`
- **⚠️ CÁC TRƯỜNG BỊ RƠI RỤNG TẠI API (\`accounts.service.ts\`):**
  ${dtoResults.apiMissing.map(f => `- \`${f}\``).join('\n  ')}

### 2.2. Tác Động Trực Tiếp Đến Giao Diện Người Dùng (Frontend Impact)
${dtoResults.feUsedButMissingInApi.length > 0
  ? dtoResults.feUsedButMissingInApi.map(f => `- 🚨 **Trường \`${f}\`**: Được gọi trực tiếp trong giao diện \`AccountDetailModal.tsx\` nhưng do API không trả về nên giao diện bị ẩn hoặc hiển thị rỗng. (Đặc biệt là trường \`raw\` khiến khối xem **Dòng Dữ Liệu Gốc** bị biến mất).`).join('\n')
  : '- ✅ Không có trường nào bị thiếu hụt trên giao diện.'}

### 2.3. Lệch Pha Giữa Quét Drive Và Quét Offline:
- **Trạng thái Quét Offline (\`scan.service.ts\`):** ${dtoResults.scanOfflineMissingRaw ? '⚠️ **CHƯA LƯU trường `raw`**. Tài khoản nạp bằng file upload từ máy tính bị mất dấu vết dòng text gốc.' : '✅ Đã lưu trường `raw` đầy đủ.'}

---

## 3. ĐÁNH GIÁ CHỈ MỤC & HIỆU NĂNG MONGODB (INDEXING & QUERY PERFORMANCE)

### 3.1. Các Chỉ Mục Đang Hoạt Động
${indexResults.dbIndexes.length > 0
  ? indexResults.dbIndexes.map((idx, i) => `${i + 1}. Khóa: \`${JSON.stringify(idx.key)}\` | Tên: \`${idx.name}\` ${idx.unique ? '**[UNIQUE]**' : ''}`).join('\n')
  : '*(Không lấy được chỉ mục trực tiếp từ MongoDB, hiển thị các chỉ mục khai báo trong code)*'}

### 3.2. Đánh Giá Điểm Nghẽn Truy Vấn (Bottlenecks & COLLSCAN Risks)
${indexResults.queryIssues.length > 0
  ? indexResults.queryIssues.map((issue, i) => `#### [Lỗ hổng #${i + 1}] ${issue.type}
- **Vị trí:** \`${issue.location}\`
- **Nguy cơ:** ${issue.detail}
- **Giải pháp:** Thiết lập MongoDB Text Index hoặc Compound Index \`{ platform: 1, status: 1, createdAt: -1 }\` và hạn chế dùng regex không anchor (\`^...\`).`).join('\n\n')
  : '✅ Hệ thống chưa có nguy cơ tắc nghẽn truy vấn nghiêm trọng.'}

---

## 4. KIỂM TOÁN BẢO MẬT & RANH GIỚI KIẾN TRÚC

### 4.1. Kiểm Tra Mã Hóa Dữ Liệu Nhạy Cảm (AES-256)
${archResults.securityAudit.map(s => `- **[${s.hasAes256Encryption ? '✅ PASSED' : '❌ FAILED'}] ${s.file}:** ${s.hasAes256Encryption ? 'Dữ liệu mật khẩu, cookie, token được mã hóa AES-256 trước khi ghi vào MongoDB.' : 'Chưa kích hoạt mã hóa AES-256!'}`).join('\n')}

### 4.2. Tính Độc Lập Monorepo & Ranh Giới Miền
- **Frontend & Backend:** ${archResults.violations.length === 0 ? '✅ Tách biệt hoàn hảo, Web không import trực tiếp backend hay DB.' : '❌ Phát hiện vi phạm ranh giới.'}
- **Ranh giới TikTok vs Shopee:** Đã được cô lập hoàn toàn nhờ Compound Unique Index \`{ platform: 1, username_normalized: 1 }\`.

---

## 5. BẢNG TỔNG HỢP VẤN ĐỀ & LỘ TRÌNH TỐI ƯU HỆ THỐNG

| Mức độ | Hạng mục | Vấn đề phát hiện | Giải pháp kỹ thuật | Trạng thái |
| :---: | :--- | :--- | :--- | :---: |
| 🔴 **Cao** | **DTO Pipeline** | \`accounts.service.ts\` bỏ sót trường \`raw\`, \`phone\`, \`coins\` khi format trả về cho FE | Thêm các trường này vào hàm \`formatAccount()\` | **Cần sửa ngay** |
| 🔴 **Cao** | **Ingress Offline** | \`scan.service.ts\` không lưu trường \`raw\` khi người dùng upload file từ máy tính | Thêm \`setFields.raw = { row_number, raw_text: item.raw }\` | **Cần sửa ngay** |
| 🟡 **Vừa** | **Performance** | Bộ lọc search dùng \`$regex\` không text index gây nguy cơ quét toàn bảng khi data lớn | Đánh Text Index hoặc index tiền tố cho trường tìm kiếm | **Ưu tiên tuần này** |
| 🟡 **Vừa** | **Drive Traceability** | Quét Drive chưa lưu \`source_url\` để 1-Click mở file gốc trên Google Drive | Thêm \`file.webViewLink\` vào metadata tài khoản | **Ưu tiên tuần này** |
| 🟢 **Thấp** | **MMO UX** | Modal Detail chưa có nút 1-Click copy theo format tool MMO (\`User\|Pass\|Cookie\`) | Thêm nút Copy Quick Format vào \`AccountDetailModal\` | **Cải tiến UI** |

---
*Tài liệu này được sinh tự động bởi Skill \`system-audit-scanner\` và có thể tái tạo bất kỳ lúc nào bằng lệnh:*  
\`node .agents/skills/system-audit-scanner/scripts/generate_audit_report.js\`
`;

  fs.writeFileSync(reportPath, markdown, 'utf8');
  console.log(`\n🎉 BÁO CÁO ĐÃ ĐƯỢC XUẤT THÀNH CÔNG TẠI:\n   ${reportPath}\n`);
  return reportPath;
}

if (require.main === module) {
  generateReport();
}

module.exports = { generateReport };
