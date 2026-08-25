# ARMS Implementation Checklist

File kien truc chinh: [docs/ARMS_ARCHITECTURE.md](docs/ARMS_ARCHITECTURE.md)

File tich hop Google Apps Script: [docs/GOOGLE_APPS_SCRIPT_INTEGRATION.md](docs/GOOGLE_APPS_SCRIPT_INTEGRATION.md)

## Nguyen tac bat buoc

- Chi quan ly tai khoan hop le, co quyen so huu/uy quyen va tuan thu dieu khoan nen tang.
- Khong log password, cookie, token, email password.
- Tat ca secret phai ma hoa truoc khi ghi database.
- MongoDB unique index tren `username_normalized` la lop chong trung cuoi cung.
- Redis chi dung tang toc, khong duoc coi la nguon dung duy nhat.

## Phase 1 - Nen tang backend

- [ ] Scaffold monorepo TypeScript.
- [ ] Tao `apps/api`, `apps/web`, `apps/worker`, `packages/shared`.
- [ ] Setup MongoDB + Redis bang Docker Compose.
- [ ] Tao `.env.example`.
- [ ] Tao schemas: `Account`, `ScanBatch`, `ExportJob`, `AuditLog`.
- [ ] Implement `CryptoService` AES-256-GCM.
- [ ] Implement `UsernameNormalizer`.
- [ ] Implement RBAC roles: `OWNER`, `MANAGER`, `VIEWER`, `AUDITOR`.

## Phase 2 - Smart Scan Engine

- [ ] Tao endpoint `POST /api/scan/upload`.
- [ ] Luu file upload vao storage tam thoi.
- [ ] Tao `ScanBatch` status `PENDING`.
- [ ] Day job vao BullMQ.
- [ ] Worker doc Excel bang ExcelJS streaming.
- [ ] Map header theo alias tieng Viet/Anh.
- [ ] Ho tro fallback parser cho data dang tab-separated:
  `username | password/display | cookie | email | email_password | cookie_repeat`.
- [ ] Normalize username va loai row loi.
- [ ] Bulk upsert account theo `username_normalized`.
- [ ] Ghi stats: total, valid, new, duplicate, error theo tung sheet.
- [ ] Ghi row error report.

## Phase 3 - Dashboard inventory

- [ ] Tao Next.js admin layout.
- [ ] Tao overview: tong account theo status/source/date.
- [ ] Tao scan batch list.
- [ ] Tao batch detail: sheet stats + errors.
- [ ] Tao accounts table co pagination.
- [ ] Filter theo status, source file, sheet, managed_by, date range.
- [ ] Mask secret tren UI theo role.

## Phase 4 - Sold/Used/Blacklist

- [ ] Tao paste-list parser.
- [ ] Tao preview endpoint: matched, not found, already sold/used.
- [ ] Tao confirm endpoint `POST /api/accounts/mark-sold`.
- [ ] Tao confirm endpoint `POST /api/accounts/mark-used`.
- [ ] Tao confirm endpoint `POST /api/accounts/blacklist`.
- [ ] Ghi account history va audit log cho bulk action.

## Phase 5 - Export Center

- [ ] Tao export template config.
- [ ] Tao endpoint `POST /api/exports`.
- [ ] Worker export `.txt`, `.csv`, `.xlsx`.
- [ ] Mac dinh chi export `AVAILABLE`.
- [ ] Option sau export: giu nguyen hoac mark `USED`.
- [ ] Ghi history `EXPORTED`.
- [ ] Tao download endpoint co kiem tra role.

## Phase 6 - Production hardening

- [ ] Google Sheets import.
- [ ] Redis warmup username set.
- [ ] Rate limit upload/export.
- [ ] Structured logging voi secret redaction.
- [ ] Health checks `/health`, `/health/mongo`, `/health/redis`.
- [ ] Backup/restore MongoDB.
- [ ] Unit/integration/e2e tests.
- [ ] CI lint/test/build.

## Prompt mau de giao cho vibe code

```text
Doc docs/ARMS_ARCHITECTURE.md va implement Phase 1 cho ARMS.
Yeu cau: TypeScript, production-ready, co tests cho CryptoService va UsernameNormalizer,
khong log secret, khong bo qua unique index username_normalized.
Sau khi code xong hay chay test/build va bao cao file da thay doi.
```

```text
Doc docs/ARMS_ARCHITECTURE.md va implement Phase 2 Smart Scan Engine.
Yeu cau: upload Excel, tao ScanBatch, day BullMQ job, ExcelJS streaming parser,
header aliases, fallback parser cho format username/password/cookie/email/email_password,
bulkWrite upsert, row error report, duplicate stats.
```

```text
Doc docs/ARMS_ARCHITECTURE.md va implement Phase 4 Sold/Used/Blacklist.
Yeu cau: paste-list parser, preview matched/not-found/already-used,
confirm bulk update, account history, audit log, test integration.
```
