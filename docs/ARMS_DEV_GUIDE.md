# ARMS — Account Resource Management System
## Tài Liệu Phát Triển Toàn Diện

> **Version:** 2.1.0 | **Cập nhật:** 2026-08-24
> **Mục tiêu:** Đưa toàn bộ tài khoản Shopee từ nhiều Google Sheets lẻ rời vào MongoDB để quản lý tập trung, tự động, bảo mật.

---

## Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan)
2. [Kiến Trúc Kỹ Thuật](#2-kiến-trúc-kỹ-thuật)
3. [Luồng Dữ Liệu End-to-End](#3-luồng-dữ-liệu)
4. [Cấu Trúc Codebase](#4-cấu-trúc-codebase)
5. [Google Apps Script — Code.gs](#5-google-apps-script)
6. [Backend API — NestJS](#6-backend-api)
7. [Worker — BullMQ Processor](#7-worker)
8. [Database Schema — MongoDB](#8-database-schema)
9. [Auto-Resume Engine (Giải Pháp 6-Phút Timeout)](#9-auto-resume-engine)
10. [Cấu Hình Môi Trường](#10-cấu-hình-môi-trường)
11. [Hướng Dẫn Triển Khai](#11-hướng-dẫn-triển-khai)
12. [Tunnel & Kết Nối Ngoài](#12-tunnel)
13. [Vận Hành & Giám Sát](#13-vận-hành)
14. [Vấn Đề Đã Biết & Cách Xử Lý](#14-vấn-đề-đã-biết)
15. [Roadmap Các Phase Tiếp Theo](#15-roadmap)

---

## 1. Tổng Quan

### Vấn Đề Cần Giải Quyết

Tài khoản Shopee (username, password, cookie, email) đang phân tán trên hàng trăm Google Sheets riêng lẻ trên Drive. Điều này gây ra:

- **Không thể tìm kiếm** tập trung — phải mở từng file thủ công
- **Dữ liệu trùng lặp** — cùng tài khoản xuất hiện ở nhiều file
- **Không bảo mật** — password/cookie lưu plain text
- **Không theo dõi được** trạng thái AVAILABLE / SOLD / USED
- **Không thể phân quyền** — ai cũng xem/sửa được

### Giải Pháp

ARMS tự động:
1. **Quét** toàn bộ Drive tìm Sheets chứa tài khoản Shopee
2. **Nhập kho** — gửi dữ liệu về backend qua API
3. **Xử lý** — deduplicate, mã hóa AES-256, lưu MongoDB
4. **Phản hồi** — cập nhật trạng thái LIVE/DIE về Sheet gốc
5. **Quản lý** — tra cứu, mark-sold, export theo định dạng

### Các Thành Phần Chính

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Google Apps Script** | JavaScript (GAS) | UI trên Sheet, quét Drive, gọi API |
| **API Server** | NestJS + TypeScript | Nhận dữ liệu, xác thực, queue jobs |
| **Worker** | NestJS + BullMQ | Xử lý async: parse, deduplicate, lưu DB |
| **Database** | MongoDB 6.0 (ReplicaSet) | Lưu tài khoản, batch, audit log |
| **Cache** | Redis 7.0 | Queue jobs, cache username set |
| **Tunnel** | localhost.run / Cloudflare | Expose localhost ra internet cho GAS |

---

## 2. Kiến Trúc Kỹ Thuật

### Sơ Đồ Tổng Thể

```
LAYER 1: GOOGLE ECOSYSTEM
─────────────────────────────────────────────────────────────
 Google Drive                     Google Sheets (Master)
 ┌──────────────────┐             ┌──────────────────────────┐
 │ Sheet_A.xlsx     │             │  Menu ARMS               │
 │ Sheet_B.xlsx     │──GAS Script▶│  FOUND_SHOPEE_SHEETS     │
 │ ...hàng trăm...  │             │  DANH_SACH_TAI_KHOAN     │
 └──────────────────┘             └────────────┬─────────────┘
                                               │ HTTPS (Tunnel)
                                               │ POST /api/integrations/
                                               ▼ google-sheets/sync

LAYER 2: BACKEND (localhost)
─────────────────────────────────────────────────────────────
 ┌─────────────────────────────────────────────────────────┐
 │  NestJS API  :4000                                      │
 │  ┌──────────┐  ┌───────────────────┐  ┌─────────────┐  │
 │  │ Auth JWT │  │ GoogleSheets Ctrl │  │ Accounts    │  │
 │  │ RBAC     │  │ ScanService       │  │ Controller  │  │
 │  └──────────┘  └─────────┬─────────┘  └─────────────┘  │
 │                          │ BullMQ enqueue               │
 └──────────────────────────┼──────────────────────────────┘
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │  NestJS Worker (scan-queue)                             │
 │  1. Parse Excel → 2. Normalize → 3. Encrypt             │
 │  4. bulkWrite upsert → MongoDB                          │
 │  5. Callback → GAS Web App (cập nhật LIVE/DIE)          │
 └───────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                        ▼
 ┌─────────────┐        ┌──────────────┐
 │  MongoDB    │        │  Redis       │
 │  :27017     │        │  :6380       │
 │  - accounts │        │  scan-queue  │
 │  - batches  │        │  export-queue│
 │  - auditlog │        │  username set│
 └─────────────┘        └──────────────┘
```

### Stack Công Nghệ

```
Monorepo (npm workspaces):
├── apps/api         NestJS 10, TypeScript 5, port 4000
├── apps/worker      NestJS 10, BullMQ processors
└── packages/shared  Schemas, CryptoService, UsernameNormalizer

Database:
  MongoDB 6.0 + ReplicaSet rs0 (cần cho transactions)
  Redis 7.0 Alpine (BullMQ backend)

Security:
  JWT HS256 (24h expiry)
  AES-256-GCM (password, cookie, token, email_password)
  RBAC: OWNER > MANAGER > VIEWER > AUDITOR
  API Key xác thực GAS → API
```

---

## 3. Luồng Dữ Liệu

### Pipeline Tự Động (Sau Khi Triển Khai)

```
NGƯỜI DÙNG: Click "🚀 [AUTO] Toàn Bộ Pipeline → MongoDB"
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ BƯỚC 1: QUÉT DRIVE (findOldShopeeAccountSheets)     │
│                                                     │
│ Tìm Sheets có cookie Shopee (SPC_F=) trên Drive     │
│ → Ghi vào tab FOUND_SHOPEE_SHEETS                   │
│                                                     │
│ ⏱️  Quá 5 phút → lưu token → trigger 70s → resume  │
│ ✅ Xong → tự chuyển Bước 2                          │
└─────────────────────────────────────────────────────┘
                │ (trigger tự động 70 giây)
                ▼
┌─────────────────────────────────────────────────────┐
│ BƯỚC 2: NHẬP KHO (importDiscoveredSheetsToArms)     │
│                                                     │
│ Với mỗi file trong FOUND_SHOPEE_SHEETS:             │
│ → Đọc dữ liệu tab Shopee                           │
│ → POST /api/integrations/google-sheets/sync         │
│ → API tạo ScanBatch → BullMQ job                   │
│ → Ghi "Đã nhập vào ARMS" vào cột Trạng thái        │
│                                                     │
│ ⏱️  Quá 5 phút → lưu progress → trigger 70s        │
│ ✅ Xong → tự chuyển Bước 3                          │
└─────────────────────────────────────────────────────┘
                │ (song song: Worker xử lý async)
                │
        ┌───────┴──────────────────────────────────┐
        │ WORKER: ScanProcessor (không giới hạn)   │
        │                                          │
        │ Parse Excel → Normalize → Encrypt        │
        │ bulkWrite upsert MongoDB (1000/batch)    │
        │ Callback → Sheet (LIVE/DIE per row)      │
        └──────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ BƯỚC 3: TRÍCH XUẤT (extractAccountsToMasterSheet)   │
│                                                     │
│ Bóc tách từng file → ghi ra DANH_SACH_TAI_KHOAN    │
│ (Optional — dùng để kiểm tra trực tiếp trên Sheet) │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ KẾT QUẢ: MongoDB collection "accounts"              │
│                                                     │
│ Hàng chục nghìn tài khoản:                         │
│ ✅ Không trùng lặp (unique: username_normalized)    │
│ ✅ Mã hóa AES-256 (password, cookie, token)        │
│ ✅ Metadata đầy đủ (nguồn, thời gian, batch)       │
│ ✅ Trạng thái: AVAILABLE / SOLD / USED / ERROR      │
│ ✅ Query, filter, export bất cứ lúc nào             │
└─────────────────────────────────────────────────────┘
```

---

## 4. Cấu Trúc Codebase

```
d:\sontayweb\toolMMO\
│
├── .env                           # Biến môi trường (KHÔNG commit)
├── .env.example                   # Template
├── docker-compose.yml             # MongoDB + Redis
├── ecosystem.config.js            # PM2 process manager
├── package.json                   # Monorepo root
│
├── apps-script/
│   └── Code.gs                    # GAS script (1600+ dòng)
│                                  # Copy vào Google Apps Script Editor
│
├── apps/
│   ├── api/                       # NestJS REST API (:4000)
│   │   └── src/
│   │       ├── main.ts            # Bootstrap, CORS, validation pipe
│   │       ├── app.module.ts      # Root module
│   │       ├── common/
│   │       │   ├── crypto/        # CryptoModule (AES-256-GCM)
│   │       │   ├── database/      # DbModule (register Mongoose schemas)
│   │       │   └── queue/         # QueueModule (BullMQ + Redis config)
│   │       └── modules/
│   │           ├── auth/          # JWT login, RBAC Guards, Decorators
│   │           ├── accounts/      # GET accounts, mark-sold/used/blacklist
│   │           ├── scan/          # POST upload, GET batches
│   │           ├── exports/       # POST export, GET download
│   │           ├── audit/         # AuditService (ghi log thao tác)
│   │           └── integrations/  # GoogleSheetsController ← Entry point GAS
│   │
│   └── worker/                    # NestJS Worker (background jobs)
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── scan.processor.ts  # Processor: scan-queue
│           └── export.processor.ts # Processor: export-queue
│
└── packages/
    └── shared/
        └── src/
            ├── schemas.ts          # Mongoose Schemas (Account, ScanBatch...)
            ├── crypto.service.ts   # AES-256-GCM encrypt/decrypt
            ├── username.normalizer.ts # Normalize + validate username
            └── index.ts            # Re-exports
```

---

## 5. Google Apps Script

### Script Properties (Persistent Storage)

| Key | Mô tả | Ví dụ |
|---|---|---|
| `ARMS_API_BASE_URL` | URL backend server | `https://xxx.localhost.run` |
| `ARMS_API_KEY` | API Key bảo mật | `arms_apikey_3ef419...` |
| `ARMS_WEB_APP_URL` | URL Web App nhận callback | `https://script.google.com/...` |
| `ARMS_MANAGED_BY` | Tên người quản lý | `Admin Sơn Tây` |
| `DRIVE_SCAN_CONTINUATION_TOKEN` | Token tiếp tục quét Drive | binary token |
| `AUTO_PIPELINE` | State pipeline đang chạy | `{"step":"IMPORT","startedAt":"..."}` |
| `ARMS_IMPORT_SKIP_DONE` | Flag skip rows đã import | `true` |

### Các Hàm Quan Trọng

| Hàm | Loại trigger | Mô tả |
|---|---|---|
| `onOpen()` | Simple (mở Sheet) | Tạo menu ARMS |
| `runSetupWizard()` | User click | Wizard 4 bước cấu hình |
| `testConnection()` | User click | Ping API server |
| `findOldShopeeAccountSheets()` | User/Pipeline | Quét Drive tìm Sheets Shopee |
| `importDiscoveredSheetsToArms()` | User/Pipeline | Nhập kho từ danh sách |
| `extractAccountsToMasterSheet()` | User/Pipeline | Bóc tách chi tiết |
| `runFullPipeline()` | User click | Khởi động pipeline 4+5+6 |
| `resumePipeline()` | **Time Trigger (70s)** | Tự tiếp tục từ bước dang dở |
| `stopPipeline()` | User click | Dừng pipeline thủ công |
| `doPost(e)` | HTTP POST (Callback) | Nhận kết quả từ Worker, cập nhật LIVE/DIE |
| `scheduleResume_(name)` | Internal | Tạo one-shot trigger 70s |
| `cancelResume_(name)` | Internal | Hủy trigger khi xong |
| `setAutoState_(key, val)` | Internal | Lưu pipeline state |
| `getAutoState_(key)` | Internal | Đọc pipeline state |
| `clearAutoState_(key)` | Internal | Xóa pipeline state |

### Request Headers GAS → API

```javascript
{
  'Content-Type': 'application/json',
  'X-ARMS-API-Key': 'arms_apikey_xxx',
  'X-ARMS-Client': 'google-apps-script',
  'X-ARMS-Timestamp': '2026-08-24T00:00:00.000Z',
  'Bypass-Tunnel-Reminder': 'true'   // Bỏ qua trang warning của tunnel
}
```

---

## 6. Backend API

### Endpoints

```
POST /api/auth/login
     Body: { username, password }
     Response: { access_token, user: { username, role } }

GET  /api/accounts
     Auth: Bearer JWT
     Query: status, source_file, source_sheet, search, limit, skip
     Response: { accounts: [...], total }

POST /api/accounts/mark-sold        (OWNER, MANAGER only)
     Body: { usernames: [], sold_to, order_id, note }

POST /api/accounts/mark-used
     Body: { usernames: [], note }

POST /api/accounts/blacklist
     Body: { usernames: [], note }

GET  /api/scan/batches              # Danh sách batch xử lý
GET  /api/scan/batches/:id          # Chi tiết batch
GET  /api/scan/batches/:id/errors   # Các dòng lỗi

POST /api/integrations/google-sheets/sync    ← GAS gọi vào đây
     Auth: X-ARMS-API-Key header
     Body: { spreadsheetId, spreadsheetName, callbackUrl, tabs }
     Response: { ok: true, batchId, status: 'QUEUED' }

POST /api/exports
     Body: { format: TXT|CSV|XLSX, filters, mark_as_used_after_export }

GET  /api/exports/:id/download      # Download file export
```

### GoogleSheetsController — Entry Point Chính

```typescript
// Khi GAS gọi POST /api/integrations/google-sheets/sync:
// 1. Verify API Key
// 2. Tạo ExcelJS workbook từ dữ liệu rows
// 3. Lưu file tạm vào /uploads/
// 4. Tạo ScanBatch document (status: PENDING)
// 5. Enqueue job vào BullMQ scan-queue
// 6. Trả về { ok: true, batchId, status: 'QUEUED' }
```

---

## 7. Worker

### ScanProcessor (scan-queue)

```
Job: { batchId, filePath, managedBy }

Quy trình:
1.  Tìm ScanBatch → set status = RUNNING
2.  Load existing usernames từ MongoDB vào Set (tránh N+1)
3.  Mở file Excel bằng ExcelJS (streaming, tiết kiệm RAM)
4.  Với mỗi worksheet:
    a. Scan 5 dòng đầu để detect header
    b. Map cột theo alias (tiếng Việt + Anh + các biến thể)
    c. Với mỗi dòng:
       → Validate username (không rỗng, ký tự hợp lệ)
       → Normalize: lowercase, trim, bỏ dấu
       → Encrypt: AES-256-GCM cho password/cookie/token/email_pass
       → Check duplicate: existingUsernames.has(normalized)
       → Queue bulkOp (upsert by username_normalized)
    d. Flush bulkWrite mỗi 1000 records
5.  Cập nhật ScanBatch: COMPLETED + stats (new/dup/error)
6.  POST callback → callbackUrl (Google Sheet Web App)
    → Cập nhật từng dòng: status LIVE hoặc DIE
7.  Xóa file tạm
```

### ExportProcessor (export-queue)

```
Job: { jobId, filter, format, managedBy }

Quy trình:
1. Query MongoDB theo filter (status, source_file, ...)
2. Decrypt secrets (AES-256-GCM)
3. Tạo file:
   TXT:  username|password|cookie|email|email_password
   CSV:  comma-separated + header row
   XLSX: ExcelJS workbook với column headers
4. Lưu /exports/
5. Update ExportJob: COMPLETED + file_path
6. (Optional) Mark accounts → USED
```

---

## 8. Database Schema

### Collection: accounts

```typescript
{
  _id: ObjectId,
  username: String,                    // "shopee.user123"
  username_normalized: String,         // "shopeeuser123" ← UNIQUE INDEX

  // Secrets (mã hóa AES-256-GCM, format: "iv:authTag:ciphertext")
  password_enc: String,
  cookie_enc: String,
  token_enc: String,
  email: String,                       // Plain (dùng để search)
  email_password_enc: String,

  status: "AVAILABLE" | "SOLD" | "USED" | "ERROR" | "BLACKLISTED",

  metadata: {
    source_file: String,               // Tên file Sheet nguồn
    source_sheet: String,              // Tên tab trong file
    managed_by: String,
    batch_id: ObjectId,
    first_scan_at: Date,
    last_scan_at: Date
  },

  consumption: {                       // Khi SOLD
    sold_to: String,
    sold_at: Date,
    order_id: String,
    note: String
  },

  quality: {
    has_cookie: Boolean,
    has_token: Boolean,
    has_email: Boolean,
    parse_errors: [String]
  },

  tags: [String],

  history: [{                          // Lịch sử thay đổi (append-only)
    action: String,                    // CREATED_FROM_SCAN | MARKED_SOLD | ...
    actor_id: String,
    timestamp: Date,
    batch_id: ObjectId
  }],

  createdAt: Date,
  updatedAt: Date
}

// Indexes:
username_normalized    → unique
status + last_scan_at  → compound (query filter thường gặp)
source_sheet + status  → compound
batch_id               → index
email                  → sparse
```

### Collection: scanbatches

```typescript
{
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED",
  file_name: String,
  sheets: [{ name, total, valid, new, duplicate, error }],
  total_rows: Number,
  new_accounts: Number,
  duplicate_accounts: Number,
  error_rows: Number,
  row_errors: [{ sheet, row_number, raw_line, reason }],
  managed_by: String,
  callback_url: String,       // GAS Web App URL để callback
  spreadsheet_id: String,
  started_at: Date,
  completed_at: Date,
  error_message: String
}
```

---

## 9. Auto-Resume Engine

### Vấn Đề

Google Apps Script giới hạn cứng **6 phút/lần chạy**. Hàng nghìn file không thể xử lý trong 1 lần.

| Tài khoản | Runtime trigger/ngày | Max trigger/script |
|---|---|---|
| Gmail (free) | 90 phút | 20 |
| Google Workspace | 6 giờ | 20 |

### Giải Pháp: One-Shot Chained Trigger

```
Lần chạy 1 (click thủ công)
│
├── Xử lý batch 1 (5 phút)
├── [CHECKPOINT: HẾT GIỜ]
├── Lưu cursor/token vào PropertiesService
├── ScriptApp.newTrigger('resumePipeline').after(70000).create()
└── return ← BẮT BUỘC thoát

    ↓ 70 giây sau (Google tự gọi trigger)

Lần chạy 2
│
├── Đọc cursor từ PropertiesService
├── Xóa trigger cũ (cancelResume_)
├── Tạo trigger mới (scheduleResume_)
├── Xử lý batch 2 (5 phút)
└── [CHECKPOINT] → lặp lại...

    ↓ Khi hết dữ liệu

Lần chạy N (hoàn thành)
│
├── Xóa PropertiesService (clearAutoState_)
├── KHÔNG tạo trigger mới (cancelResume_)
└── Chuyển sang bước tiếp trong pipeline
```

### Pipeline State Machine

```
Lưu trong ScriptProperties key: AUTO_PIPELINE
Value: { step: "SCAN_DRIVE"|"IMPORT"|"EXTRACT"|"DONE" }

Chuyển trạng thái:
  SCAN_DRIVE ──quét Drive xong──▶ IMPORT
  IMPORT     ──nhập kho xong──▶  EXTRACT
  EXTRACT    ──bóc tách xong──▶  DONE
  DONE       ──resumePipeline──▶ [xóa state, toast "Hoàn tất!"]
```

### Core Functions (đã có trong Code.gs)

```javascript
// Tạo one-shot trigger (tự xóa trigger cũ cùng tên)
function scheduleResume_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(handlerName).timeBased().after(70 * 1000).create();
}

// Hủy trigger khi hoàn thành
function cancelResume_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

// Pipeline state helpers
function setAutoState_(key, value) {
  PropertiesService.getScriptProperties()
    .setProperty('AUTO_' + key, JSON.stringify(value));
}
function getAutoState_(key) {
  var v = PropertiesService.getScriptProperties().getProperty('AUTO_' + key);
  return v ? JSON.parse(v) : null;
}
function clearAutoState_(key) {
  PropertiesService.getScriptProperties().deleteProperty('AUTO_' + key);
}
```

### Checkpoint Pattern (áp dụng trong mọi hàm nặng)

```javascript
var SAFE_LIMIT_MS = 300000; // 5 phút (buffer 1 phút)
var startTime = new Date().getTime();

while (hasMoreData) {
  // ⭐ CHECKPOINT — kiểm tra mỗi vòng lặp
  if (new Date().getTime() - startTime > SAFE_LIMIT_MS) {
    saveCurrentPosition(cursor);
    var pipeline = getAutoState_('PIPELINE');
    if (pipeline) {
      scheduleResume_('resumePipeline');
      activeSs.toast('Tạm dừng, tự tiếp tục sau 70 giây...', 'ARMS Auto', 5);
    }
    return; // BẮT BUỘC return
  }
  // ... xử lý data ...
}

// Hoàn thành → chuyển bước hoặc kết thúc
var pipeline = getAutoState_('PIPELINE');
if (pipeline) {
  setAutoState_('PIPELINE', { step: 'NEXT_STEP' });
  scheduleResume_('resumePipeline');
} else {
  ui.alert('Hoàn tất!');
}
```

---

## 10. Cấu Hình Môi Trường

### File `.env`

```env
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/arms?replicaSet=rs0
REDIS_URL=redis://localhost:6380

# Cryptography (Base64 encoded 32-byte key)
ENCRYPTION_KEY_BASE64=H0dTb4DmjdI8Gp7j34qIrhf6fXDHzdOZYKGABwPJwUA=

# JWT
JWT_SECRET=393854a08c0c08a6dd1ea131dbded3ec6a700337e2010fbe7f7500715d723b13
JWT_EXPIRES_IN=24h

# Upload / Export
UPLOAD_MAX_MB=100
EXPORT_MAX_ROWS=50000

# Integration
ARMS_API_KEY=arms_apikey_3ef419721adcb5879a8385
```

### docker-compose.yml (Cấu hình đúng)

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:6.0
    container_name: arms-mongo
    restart: unless-stopped       # Auto-restart khi crash / máy khởi động
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7.0-alpine
    container_name: arms-redis
    restart: unless-stopped
    ports:
      - "6380:6379"
    volumes:
      - redis-data:/data
```

### ecosystem.config.js (PM2)

```javascript
module.exports = {
  apps: [
    {
      name: 'arms-api',
      cwd: 'd:/sontayweb/toolMMO/apps/api',
      script: 'node',
      args: 'dist/main.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PORT: 4000 }
    },
    {
      name: 'arms-worker',
      cwd: 'd:/sontayweb/toolMMO/apps/worker',
      script: 'node',
      args: 'dist/main.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

---

## 11. Hướng Dẫn Triển Khai

### Lần Đầu Triển Khai

```powershell
# 1. Khởi động Infrastructure
cd d:\sontayweb\toolMMO
docker-compose up -d
docker ps    # Kiểm tra: arms-mongo + arms-redis đều Up

# 2. Build Backend
cd apps/api && npm run build && cd ../..
cd apps/worker && npm run build && cd ../..

# 3. Cài PM2 (PowerShell với quyền Admin)
npm install -g pm2 pm2-windows-service
[System.Environment]::SetEnvironmentVariable('PM2_HOME', 'C:\pm2', 'Machine')
mkdir C:\pm2
# Restart terminal sau lệnh này

# 4. Start PM2
pm2 start ecosystem.config.js
pm2 save
pm2-service-install    # Trả lời YES
pm2 install pm2-logrotate

# Kiểm tra:
pm2 status    # arms-api: online | arms-worker: online

# 5. Khởi động Tunnel
ssh -R 80:localhost:4000 nokey@localhost.run
# Copy URL hiện ra: https://xxxxx.localhost.run

# 6. Cấu hình Google Sheet
# ARMS → Setup Wizard → Nhập URL tunnel
# ARMS → Kiểm tra kết nối API → Phải thấy "THÀNH CÔNG"

# 7. Chạy Pipeline lần đầu
# ARMS → 🚀 [AUTO] Toàn Bộ Pipeline → MongoDB
# → Đóng Sheet, làm việc khác
# → Hệ thống tự chạy đến khi hoàn thành
```

### Mỗi Lần Restart Máy

```powershell
# Docker Desktop tự start (nếu đã bật "Start on login")
# PM2 tự start (Windows Service)

# Chỉ cần restart tunnel:
ssh -R 80:localhost:4000 nokey@localhost.run
# ARMS → Setup Wizard → Cập nhật URL tunnel mới
```

---

## 12. Tunnel

### So Sánh Options

| Tool | URL Cố Định | Free | Ổn định | Kết luận |
|---|---|---|---|---|
| **Serveo** | Tùy | ✅ | ❌ Ngắt thường | Không dùng |
| **localhost.run** | ❌ Đổi khi restart | ✅ | ✅ Trong phiên | **Dùng cho dev** |
| **Cloudflare TryCloudflare** | ❌ Đổi khi restart | ✅ | ✅ | Ổn hơn |
| **Cloudflare Named Tunnel** | ✅ Cố định | ✅ (cần domain) | ✅ | **Tốt nhất** |
| **Ngrok Free** | ❌ | ✅ | ✅ | Ổn |

### Dùng localhost.run (Khuyến Nghị Dev)

```powershell
ssh -R 80:localhost:4000 nokey@localhost.run
# Hiện URL dạng: https://xxxxx.localhost.run
# → Dùng URL này trong Setup Wizard
# ⚠️ URL đổi khi terminal bị đóng → cập nhật lại Setup Wizard
```

### Dùng Cloudflare Named Tunnel (Khuyến Nghị Production)

```powershell
# Cần domain riêng (~$10/năm) và Cloudflare account (free)
winget install Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create arms-production
cloudflared tunnel route dns arms-production api.yourdomain.com
cloudflared tunnel run arms-production
# → URL cố định: https://api.yourdomain.com (không bao giờ đổi)
```

---

## 13. Vận Hành

### Lệnh Kiểm Tra Nhanh

```powershell
# PM2
pm2 status
pm2 logs arms-api --lines 50
pm2 logs arms-worker --lines 50
pm2 restart all

# Docker
docker ps
docker-compose logs -f mongo

# MongoDB stats
docker exec arms-mongo mongosh arms --eval "db.accounts.countDocuments()"
docker exec arms-mongo mongosh arms --eval `
  "db.accounts.aggregate([{'\$group':{_id:'\$status',count:{'\$sum':1}}}]).toArray()"

# Test API
Invoke-WebRequest -Uri "http://localhost:4000/api" -Method GET
```

### Logs Location (PM2)

```
C:\pm2\logs\
├── arms-api-out.log
├── arms-api-error.log
├── arms-worker-out.log
└── arms-worker-error.log
```

---

## 14. Vấn Đề Đã Biết

| Vấn đề | Nguyên nhân | Giải pháp |
|---|---|---|
| GAS timeout 6 phút | Giới hạn Google cứng | ✅ Auto-Resume Engine đã fix |
| "Chưa cấu hình API URL" | Tunnel URL đã đổi | ARMS → Setup Wizard → Nhập URL mới |
| Worker không xử lý job | Redis/MongoDB chết | `pm2 restart arms-worker` + `docker ps` |
| MongoDB connect timeout | ReplicaSet chưa init | `docker-compose restart mongo` |
| "Invalid API Key" | Key không khớp | So sánh `.env` với GAS ScriptProperties |
| Trigger tích lũy > 20 | Quên xóa trigger cũ | ✅ `scheduleResume_()` tự xóa trước khi tạo |
| Tài khoản trùng lặp | Nhiều file cùng acc | ✅ `username_normalized` unique index |
| Cookie/password lộ | Plain text trên Sheet | ✅ AES-256-GCM trong MongoDB |
| File > 10MB | Quá nhiều dữ liệu/lần | GAS tự cảnh báo, hỏi trước khi gửi |
| "Không tìm thấy tab phù hợp" | Format không phải Shopee | Kiểm tra cột có chứa `SPC_F=` không |

---

## 15. Roadmap

### Đã Hoàn Thành ✅

- [x] Google Apps Script integration suite (v2.1.0)
- [x] NestJS API với JWT + RBAC
- [x] BullMQ Worker với ExcelJS streaming parser
- [x] MongoDB schema + AES-256-GCM encryption
- [x] Auto-Resume Engine (giải quyết 6-phút timeout)
- [x] Callback update LIVE/DIE về Sheet gốc
- [x] Full Pipeline: Quét Drive → Nhập kho → Bóc tách (tự động)

### Phase 3: Dashboard Web UI

- [ ] Next.js admin panel
- [ ] Trang tổng quan: tổng TK, thống kê theo status/source/date
- [ ] Bảng accounts: pagination + filter + mask secrets theo role
- [ ] Trang scan batch: list + detail + error report
- [ ] Trang export history

### Phase 4: Sold/Used/Blacklist UI

- [ ] Paste-list parser (clipboard → danh sách username)
- [ ] Preview: matched / not-found / already-used
- [ ] Confirm bulk mark sold/used/blacklist
- [ ] Account history timeline
- [ ] Audit log viewer

### Phase 5: Export Center

- [ ] Template config (tuỳ chỉnh định dạng output)
- [ ] Export TXT / CSV / XLSX với filter tùy ý
- [ ] Tự động mark USED sau export (optional)
- [ ] Download với kiểm tra role

### Phase 6: Production Hardening

- [ ] Endpoint `/api/tunnel-status` → GAS tự cập nhật URL (không cần thủ công)
- [ ] Rate limit upload/export
- [ ] Structured logging với secret redaction
- [ ] Health checks: `/health`, `/health/mongo`, `/health/redis`
- [ ] MongoDB backup tự động (Windows Task Scheduler)
- [ ] Unit/integration/e2e tests (Jest)
- [ ] CI/CD: lint + test + build (GitHub Actions)

---

## Thông Tin Kỹ Thuật

```
Project    : ARMS - Account Resource Management System
Version    : 2.1.0
Path       : d:\sontayweb\toolMMO\
API Port   : 4000
MongoDB    : localhost:27017 (ReplicaSet rs0)
Redis      : localhost:6380
GAS Version: 2.0.0 (apps-script/Code.gs)
```

---

*Tài liệu được tạo từ phân tích toàn bộ codebase. Cập nhật sau mỗi phase triển khai.*
