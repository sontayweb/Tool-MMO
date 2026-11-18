---
name: system-audit-scanner
description: Chuyên gia kiểm toán kiến trúc hệ thống, rà soát tính toàn vẹn DTO, hiệu năng chỉ mục MongoDB và bảo mật mã hóa cho hệ thống ARMS MMO.
---

# System Audit Scanner Skill (ARMS Architecture & Pipeline Auditor)

## 1. Mục Đích & Phạm Vi Kiểm Toán
Skill này cung cấp các công cụ và quy chuẩn tự động hóa để rà soát, đánh giá chuyên sâu hệ thống ARMS Data Warehouse theo định kỳ hoặc sau mỗi lần cập nhật lớn:
1. **Kiểm tra Tính toàn vẹn DTO (DTO & Data Pipeline Integrity)**:
   - Đối soát liên tục giữa Mongoose Schema (`packages/shared/src/schemas.ts`), hàm mapper API (`apps/api/src/modules/accounts/accounts.service.ts`), và giao diện Frontend (`apps/web`).
   - Ngăn chặn triệt để tình trạng rơi rụng trường dữ liệu (như `raw`, `phone`, `coins`, `session_token`, `custom_metadata`).
2. **Kiểm tra Chỉ Mục & Hiệu Năng Cơ Sở Dữ Liệu (MongoDB Index & Query Profiling)**:
   - Phát hiện tất cả các câu truy vấn `find()`, `countDocuments()` chứa `$regex` hoặc filter trường chưa có Compound Index, ngăn ngừa tắc nghẽn CPU khi dữ liệu đạt hàng triệu records.
3. **Kiểm toán Bảo Mật & Rò Rỉ Bí Mật (Security & Secret Leak Prevention)**:
   - Rà soát việc mã hóa AES-256 đối với mật khẩu, cookie, token trước khi lưu vào DB.
   - Ngăn chặn việc in log console chứa chuỗi nhạy cảm (plain-text passwords / private keys).
4. **Kiểm tra Ranh Giới Miền Dữ Liệu (Domain Boundary & Isolation)**:
   - Đảm bảo 100% dữ liệu Shopee và TikTok được xử lý qua bộ lọc phân định độc lập, có khóa kép `{ platform: 1, username_normalized: 1 }`.

## 2. Các Lệnh & Script Thực Thi Nhanh
- **Quét rơi rụng DTO**:
  `node .agents/skills/system-audit-scanner/scripts/scan_dto_integrity.js`
- **Quét thiếu Index DB**:
  `node .agents/skills/system-audit-scanner/scripts/scan_database_indexes.js`
- **Quét phụ thuộc kiến trúc**:
  `node .agents/skills/system-audit-scanner/scripts/scan_architecture_deps.js`
- **Xuất báo cáo kiến trúc Markdown**:
  `node .agents/skills/system-audit-scanner/scripts/generate_audit_report.js`
