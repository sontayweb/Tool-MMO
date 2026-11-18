# 🏗️ KIẾN TRÚC HỆ THỐNG — SHOPEE ACCOUNT LIVE/DIE CHECKER
**Dự án:** `shopee_checker_project`  
**Thuộc hệ sinh thái:** Thức Sơn Tool MMO Ecosystem  
**Phiên bản tài liệu:** 2.0.0  
**Cập nhật:** 2026-08-23

---

## 📑 MỤC LỤC

1. [Tổng Quan Hệ Thống](#1-tổng-quan)
2. [Kiến Trúc 3 Tầng](#2-kiến-trúc-3-tầng)
3. [Phân Tích Kỹ Thuật Shopee API](#3-shopee-api)
4. [Luồng Dữ Liệu](#4-luồng-dữ-liệu)
5. [Database Schema](#5-database-schema)
6. [API Contract](#6-api-contract)
7. [Thiết Kế Dashboard](#7-dashboard)
8. [Chiến Lược Bypass & Anti-Detection](#8-bypass)
9. [Sprint Task List](#9-sprint-tasks)
10. [Dependencies](#10-dependencies)
11. [🔗 Giai Đoạn 2 — Tích Hợp Outlook Auto Tool](#11-giai-đoạn-2)

---

## 1. TỔNG QUAN

### 1.1. Mục Tiêu Nghiệp Vụ
Kiểm tra trạng thái **sống/chết (Live/Die)** của hàng nghìn tài khoản Shopee bằng cách gọi API đăng nhập chính thức (`/api/v4/account/login_by_password`), phân loại kết quả và lưu trữ có cấu trúc phục vụ các tool khác trong hệ sinh thái.

### 1.2. Phạm Vi MVP (Giai Đoạn 1)
- ✅ Check Live/Die bằng Email + Password (hash SHA256(MD5))  
- ✅ Phân loại 6 trạng thái: LIVE, IVS_VERIFY, WRONG_PASS, FAILED, CAPTCHA, RATE_LIMIT  
- ✅ Web Dashboard (Next.js 14) + API (FastAPI) + MongoDB + Redis Docker  
- ✅ Import Excel/TXT, xuất kết quả Excel  
- ⏳ Giai đoạn 2: Đấu Outlook Tool → auto-verify IVS → lấy Cookie đầy đủ

### 1.3. Sơ Đồ Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────┐
│                WEB DASHBOARD (Next.js 14)                   │
│  UploadPanel │ StatsBar │ AccountTable │ ProgressLog        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS REST + WSS WebSocket
┌────────────────────────▼────────────────────────────────────┐
│              API BACKEND (FastAPI + Uvicorn)                │
│  /api/jobs  │  /api/accounts  │  /api/export  │  /ws/      │
│              ConnectionManager (WebSocket Hub)              │
└──────┬──────────────────────────────┬───────────────────────┘
       │ BLPUSH / BRPOP               │ Pub/Sub
┌──────▼──────┐                ┌──────▼──────────────────────┐
│   REDIS     │                │         MONGODB              │
│  Queue      │                │  ShopeeTool.accounts         │
│  Rate Limit │                │  ShopeeTool.jobs             │
│  Cooldown   │                │  ShopeeTool.header_pool      │
│  Pub/Sub    │                └─────────────────────────────-┘
└──────┬──────┘
       │ BRPOP (blocking pull)
┌──────▼──────────────────────────────────────────────────────┐
│           CHECKER WORKERS (Python asyncio)                  │
│   Worker1  │  Worker2  │  ...  │  WorkerN  (curl_cffi)     │
│                  Proxy Pool Manager                         │
└─────────────────────────────────────────────────────────────┘
                         │ HTTPS
                  ┌──────▼──────┐
                  │ shopee.vn   │
                  │ /api/v4/    │
                  │ account/    │
                  │ login_by_   │
                  │ password    │
                  └─────────────┘
```

---

## 2. KIẾN TRÚC 3 TẦNG

### 2.1. Tầng 1 — Checker Engine (Python)

| Module | File | Trách Nhiệm |
| :--- | :--- | :--- |
| Config | `config.py` | Constants, Error code enum, Collection names |
| Hasher | `hasher.py` | `SHA256(MD5(plaintext))` password hashing |
| Account Parser | `account_parser.py` | Đọc file đa định dạng, deduplicate |
| Header Pool | `header_pool.py` | Quản lý và xoay vòng header bảo mật Shopee |
| Shopee API | `shopee_api.py` | curl_cffi login, parse response, map error code |
| Proxy Manager | `proxy_manager.py` | Proxy pool, xoay IP |
| Rate Limiter | `rate_limiter.py` | Redis Leaky Bucket giới hạn tốc độ |
| Worker | `worker.py` | asyncio loop, pull queue, retry logic, Cooldown |
| Excel Handler | `excel_handler.py` | Import/Export Excel với openpyxl |

### 2.2. Tầng 2 — API Backend (FastAPI)

| Router | Endpoints | Trách Nhiệm |
| :--- | :--- | :--- |
| Jobs | `POST /api/jobs` | Tạo job, đẩy accounts vào Redis Queue |
| Jobs | `GET /api/jobs` | Danh sách jobs + tiến độ |
| Jobs | `POST /api/jobs/{id}/stop` | Dừng job |
| Accounts | `GET /api/accounts` | Phân trang, filter theo status/job |
| Accounts | `POST /api/accounts/import` | Upload Excel/TXT |
| Export | `GET /api/export/{job_id}` | Tải file Excel kết quả |
| WebSocket | `WS /ws/{job_id}` | Push realtime: progress + per-account |

### 2.3. Tầng 3 — Web Dashboard (Next.js 14)

| Component | Trách Nhiệm |
| :--- | :--- |
| `StatsBar` | Tổng, Live, IVS, Die, Captcha, Queue, % tiến độ + tốc độ (acc/min) |
| `UploadPanel` | Drag-drop file Excel/TXT, Paste textarea, config Workers/Delay |
| `AccountTable` | Bảng 10 cột, màu sắc theo status, phân trang, copy, sort |
| `JobControls` | Start/Pause/Stop/Export buttons + job selector |
| `ProgressLog` | Terminal-style log feed từ WebSocket realtime |
| `JobHistory` | Danh sách lần check trước, click xem lại |

---

## 3. SHOPEE API

### 3.1. Endpoint
```
POST https://shopee.vn/api/v4/account/login_by_password
Content-Type: application/json
```

### 3.2. Thuật Toán Hash Mật Khẩu (Đã xác định từ test_hash.py)

```python
import hashlib

def hash_shopee_password(plaintext: str) -> str:
    """
    Bước 1: MD5(plaintext)
    Bước 2: SHA256(md5_hex_string)
    
    Ví dụ: 'Thuthuanqr73'
        → MD5  → 'a95a1c5604b178067fa6965f1020978f'
        → SHA256 → 'c086507a4d4aac2385fc96e70e1dc33a7b21e65b33bfe9e0fb80cff68c129c81'
    """
    md5_hash = hashlib.md5(plaintext.encode('utf-8')).hexdigest()
    return hashlib.sha256(md5_hash.encode('utf-8')).hexdigest()
```

### 3.3. Request Body
```json
{
  "email": "user@hotmail.com",
  "password": "SHA256(MD5(plaintext_password))",
  "support_ivs": true,
  "stay_logged_in": true,
  "client_identifier": {
    "security_device_fingerprint": "{af-ac-enc-sz-token_value}"
  }
}
```

### 3.4. Bảng Header Bảo Mật (Phân tích từ toolshopee.txt)

```
Headers tĩnh (không đổi):
  accept: application/json
  content-type: application/json
  origin: https://shopee.vn
  x-api-source: pc
  x-requested-with: XMLHttpRequest
  x-shopee-language: vi
  x-sz-sdk-version: 1.12.40

Headers bảo mật (lấy từ pool, xoay vòng):
  x-sap-sec:          {~3KB device fingerprint — từ pool}
  x-sap-ri:           {52 ký tự hex — auto-generate random mỗi request}
  x-csrftoken:        {đồng bộ với Cookie csrftoken}
  af-ac-enc-dat:      {8 ký tự hex — từ pool}
  af-ac-enc-sz-token: {token — đồng bộ với Cookie shopee_webUnique_ccd}

Cookies (đồng bộ với header pool):
  shopee_webUnique_ccd: {URL-encoded của af-ac-enc-sz-token}
  csrftoken:            {đồng bộ với x-csrftoken}
  SPC_F, REC_T_ID, ... (session cookies cơ bản của session)
```

### 3.5. Error Code Mapping

| `error` | Enum Status | Ý Nghĩa | Hành Động Tool |
| :---: | :--- | :--- | :--- |
| `0` | `LIVE` | Đăng nhập thành công | Lưu Cookie, ghi LIVE ✅ |
| `98` | `IVS_VERIFY` | Đúng pass, cần xác minh Email | Ghi LIVE_IVS (tương lai: đấu Outlook) |
| `2` | `WRONG_PASS` | Sai tài khoản/mật khẩu | Ghi DIE ❌ |
| `1` | `FAILED` | IP/Fingerprint bị chặn | Retry 3x, đổi header → FAILED |
| `89` | `CAPTCHA` | Dính Puzzle Captcha | Cooldown Queue 5 phút → retry |
| HTTP `429` | `RATE_LIMIT` | Vượt giới hạn tần suất | Cooldown 10 phút → retry |
| Timeout | `TIMEOUT` | Không kết nối được | Retry với proxy khác |

### 3.6. Response LIVE (error=0) — Bóc Cookie
Trích từ `Set-Cookie` response headers:
- `SPC_ST` — Session token chính
- `SPC_EC` — Encrypted credential  
- `SPC_F` — Device fingerprint bound
- `SPC_U` — User ID

### 3.7. Response IVS (error=98)
```json
{
  "data": {
    "userid": null,
    "ivs_flow_no": "4306209a-7f90-4468-bf1e-e9cb4e043037",
    "ivs_token": "U2FsdGVkX1+5mp...",
    "encrypted_phone": null
  }
}
```
Lưu `ivs_flow_no` + `ivs_token` → Giai đoạn 2 đấu với Outlook Tool.

---

## 4. LUỒNG DỮ LIỆU

### 4.1. Upload & Khởi Tạo Job
```
User Upload File (Excel/TXT hoặc Paste text)
    → AccountParser.parse() [tự nhận dạng delimiter, dedup theo email]
    → POST /api/jobs (FastAPI)
    → Tạo Job trong MongoDB (status=QUEUED)
    → BLPUSH N tasks vào Redis: shopee:checker:queue
    → Response: { job_id, total, status: "QUEUED" }
```

### 4.2. Worker Processing Loop
```
Worker.run() [asyncio]
    → BRPOP shopee:checker:queue (blocking 5s timeout)
    → Deserialize task {job_id, email, password_plain}
    → hasher.hash_shopee_password(password_plain)
    → rate_limiter.acquire(proxy_ip)   [Redis Leaky Bucket]
    → header_pool.get_next()           [Round-robin]
    → proxy_manager.get_proxy()
    → shopee_api.check_account(email, hashed_pass, headers, proxy)
    
    Kết quả:
    ├── error=0  → LIVE   → bóc Cookie → MongoDB upsert
    ├── error=98 → IVS    → lưu ivs_token → MongoDB upsert
    ├── error=2  → DIE    → MongoDB upsert
    ├── error=1  → retry_count < 3? retry : FAILED
    ├── error=89 → ZADDNX shopee:checker:cooldown (score=now+5min)
    └── HTTP 429 → ZADDNX shopee:checker:cooldown (score=now+10min)
    
    → MongoDB.upsert(ShopeeTool.accounts)
    → MongoDB.update_job_stats(job_id)
    → Redis.PUBLISH shopee:checker:results:{job_id} {result_json}
```

### 4.3. Cooldown Scheduler
```
Background task (mỗi 30 giây):
    ZRANGEBYSCORE shopee:checker:cooldown 0 {now}
    → Lấy tasks đã hết cooldown
    → BLPUSH lại vào shopee:checker:queue
    → ZREM khỏi cooldown set
```

### 4.4. WebSocket Realtime Pipeline
```
Redis PUBLISH → FastAPI ws_manager Subscribe
    → Parse result JSON
    → ConnectionManager.broadcast(job_id, {
          type: "account_result" | "stats_update" | "job_completed",
          data: {...}
      })
    → Dashboard AccountTable row update (không reload trang)
```

---

## 5. DATABASE SCHEMA

### 5.1. ShopeeTool.accounts

```javascript
{
  "_id": ObjectId,
  
  // Identity
  "username": "xic3p9jukv",
  "email": "yenvya315956@hotmail.com",    // Unique key
  "password_plain": "Khaphanyq51",
  "password_hash": "c086507a...",          // SHA256(MD5(plain))
  "phone": "84996540628",
  "recovery_email": "",
  
  // Check Result
  "status": "LIVE",     // LIVE|IVS_VERIFY|WRONG_PASS|FAILED|CAPTCHA|PENDING
  "error_code": 0,
  "last_checked_at": ISODate,
  "check_count": 3,
  "job_id": "uuid-string",
  
  // IVS Data (khi error=98, dùng cho giai đoạn 2)
  "ivs_flow_no": "4306209a-...",
  "ivs_token": "U2FsdGVk...",
  
  // Session Cookies (khi LIVE)
  "cookies": { "SPC_ST": "...", "SPC_EC": "...", "SPC_F": "...", "SPC_U": "..." },
  "cookie_captured_at": ISODate,
  
  // Tracking
  "last_used_proxy": "103.x.x.x:8080",
  "last_header_pool_idx": 2,
  "source_file": "accounts_batch_001.xlsx",
  "created_at": ISODate,
  "updated_at": ISODate
}

Indexes: { email: 1 } UNIQUE, { status: 1 }, { job_id: 1, status: 1 }
```

### 5.2. ShopeeTool.jobs

```javascript
{
  "_id": ObjectId,
  "job_id": "uuid-string",
  "name": "Batch_2026-08-23_001",
  "status": "RUNNING",   // QUEUED|RUNNING|PAUSED|COMPLETED|STOPPED
  
  // Progress stats
  "total": 5000,  "processed": 1234,
  "live": 456,    "ivs_verify": 123,
  "wrong_pass": 234, "failed": 50,
  "captcha": 12,  "pending": 3766,
  
  // Config
  "worker_count": 10, "delay_between_requests_ms": 500,
  "proxy_enabled": false, "header_pool_size": 8,
  
  // Timing
  "created_at": ISODate, "started_at": ISODate,
  "completed_at": null, "source_file": "accounts_batch_001.xlsx",
  "export_file": null
}
```

### 5.3. ShopeeTool.header_pool

```javascript
{
  "_id": ObjectId,
  "idx": 0, "label": "Chrome152_Win_Set1",
  "is_active": true, "use_count": 45, "success_rate": 0.87,
  
  // Header values (lấy từ Chrome DevTools)
  "x_sap_sec": "bIIUIxgN...",
  "af_ac_enc_sz_token": "dnu/Qyv...|zTZxXFrJ8...|uvIntdBn|08|3",
  "af_ac_enc_dat": "599ad71a",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  
  // Cookie values (đồng bộ với header)
  "cookie_shopee_web_unique_ccd": "dnu%2FQyv...",
  "cookie_csrf_token": "BM6HjbYw...",
  "cookie_spc_f": "sA2VdMrh...",
  "cookie_base": "language=vi; ssr-tz=Asia/Saigon; ...",
  
  // Body fingerprint
  "security_device_fingerprint": "dnu/QyvVBRsR3MFhKsxNZg==|zTZxXFrJ8...",
  
  "created_at": ISODate, "last_used_at": ISODate
}
```

---

## 6. API CONTRACT

### POST /api/jobs — Tạo Job
```json
Request: {
  "accounts": [{"email":"...", "password":"...", "username":"..."}],
  "config": {"worker_count": 10, "delay_ms": 500, "proxy_enabled": false}
}
Response: { "job_id": "4e2a1f3c-...", "total": 5000, "status": "QUEUED" }
```

### GET /api/accounts — Lấy Tài Khoản
```
Query: ?job_id=...&status=LIVE&page=1&page_size=50&q=email_search
Response: { "accounts": [...], "total": 456, "page": 1 }
```

### GET /api/export/{job_id}?status=live
```
Response: application/vnd.openxmlformats... (binary Excel file download)
```

### WS /ws/{job_id} — Realtime Messages
```json
// Account được check xong
{ "type": "account_result", "data": { "email":"...", "status":"LIVE", "error_code":0 } }

// Cập nhật thống kê tổng
{ "type": "stats_update", "data": { "live":456, "die":234, "progress_pct":24.68, "rate_per_min":48 } }

// Job hoàn tất
{ "type": "job_completed", "data": { "job_id":"...", "export_url":"/api/export/..." } }
```

---

## 7. DASHBOARD

### 7.1. Design Tokens (Dark Theme)
```css
--bg-primary:     #0f172a;   /* Nền chính */
--bg-secondary:   #1e293b;   /* Card/Panel */
--status-live:    #10b981;   /* LIVE — Xanh neon */
--status-ivs:     #38bdf8;   /* IVS — Xanh trời (đúng pass!) */
--status-die:     #ef4444;   /* DIE — Đỏ */
--status-captcha: #c084fc;   /* CAPTCHA — Tím */
--status-failed:  #f59e0b;   /* FAILED — Vàng */
--status-pending: #64748b;   /* PENDING — Xám */
```

### 7.2. Bảng Tài Khoản 10 Cột

| # | Cột | Mô Tả |
| :---: | :--- | :--- |
| 1 | `☑` | Checkbox chọn hàng loạt |
| 2 | `STT` | Số thứ tự |
| 3 | `Tài Khoản` | Username Shopee |
| 4 | `Email` | Email đăng nhập (stretch width) |
| 5 | `Mật Khẩu` | `••••••••` (hover để lộ) |
| 6 | `Trạng Thái` | Badge màu: 🟢 LIVE / 🔵 IVS / 🔴 DIE... |
| 7 | `Mã Lỗi` | Raw error code từ Shopee |
| 8 | `Cookie` | `✅ Có` / `❌ Không` |
| 9 | `Lần Check Cuối` | Timestamp |
| 10 | `Ghi Chú` | Chi tiết lỗi, số retry |

---

## 8. BYPASS & ANTI-DETECTION

### 8.1. curl_cffi — TLS Fingerprint Impersonation
```python
from curl_cffi import requests as cffi_requests

response = cffi_requests.post(
    url="https://shopee.vn/api/v4/account/login_by_password",
    json=payload,
    headers=headers,
    cookies=cookies,
    impersonate="chrome152",   # JA3/JA4 fingerprint giống Chrome thật
    proxy=proxy_url,
    timeout=30
)
```

### 8.2. Static Header Pool Rotation
Pool N bộ header từ Chrome DevTools, round-robin rotation.  
Auto-generate `x-sap-ri`: `secrets.token_hex(26)` (52 chars hex).

### 8.3. Retry & Cooldown Logic
```
error 1 (FAILED):
  Retry 1 → delay 2s + đổi header pool slot
  Retry 2 → delay 4s + đổi header pool slot
  Retry 3 → delay 8s + đổi header pool slot
  → Vẫn fail → mark FAILED

error 89 (CAPTCHA):  → Cooldown Queue 5 phút → retry
HTTP 429 (RATE LIMIT): → Cooldown Queue 10 phút → retry

Cooldown Queue: Redis Sorted Set (score = unix timestamp khi được phép retry)
Scheduler: Mỗi 30s scan, đưa tasks hết cooldown về main queue
```

### 8.4. Random Jitter Delay
```python
delay_ms = base_ms + random.randint(-jitter_ms, +jitter_ms)
await asyncio.sleep(delay_ms / 1000)
```

---

## 9. SPRINT TASKS

> **Quy tắc:** Mỗi Sprint phải test được độc lập trước khi sang Sprint tiếp theo.

---

### 🏁 SPRINT 0 — Chuẩn Bị Môi Trường (0.5 ngày)
**Mục tiêu:** Thư mục, Docker, Python env, dữ liệu test sẵn sàng.

| # | Task | Done |
| :--- | :--- | :---: |
| S0-1 | Tạo cấu trúc thư mục `shopee_checker_project/` | ☐ |
| S0-2 | Tạo `requirements.txt` | ☐ |
| S0-3 | `pip install -r requirements.txt` | ☐ |
| S0-4 | Xác nhận Docker MongoDB đang chạy (`docker ps`) | ☐ |
| S0-5 | Xác nhận Docker Redis đang chạy (`docker ps`) | ☐ |
| S0-6 | Tạo `data/header_pool.json` với 2 bộ header từ toolshopee.txt | ☐ |
| S0-7 | Tạo `data/accounts_test.txt` với 10 tài khoản test biết trước kết quả | ☐ |
| S0-8 | Tạo `.env` với các biến môi trường | ☐ |

**✅ Tiêu chí Done:** MongoDB + Redis accessible, có dữ liệu test sẵn.

---

### 🔧 SPRINT 1 — Checker Engine Core (1-2 ngày)
**Mục tiêu:** Có thể check 1 account từ CLI, kết quả ghi vào MongoDB đúng.

#### Sprint 1A — Foundation
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S1A-1 | Viết `config.py` — Enum AccountStatus, Constants | `checker_engine/config.py` | ☐ |
| S1A-2 | Viết `logger.py` — Loguru, màu sắc terminal | `checker_engine/logger.py` | ☐ |
| S1A-3 | Viết `hasher.py` — `hash_shopee_password(plaintext)` | `checker_engine/hasher.py` | ☐ |
| S1A-4 | **Test hasher**: `Thuthuanqr73` → `c086507a...` ✅ | `tests/test_hasher.py` | ☐ |
| S1A-5 | Viết `account_parser.py` — multi-delimiter, dedup | `checker_engine/account_parser.py` | ☐ |
| S1A-6 | **Test parser**: File với Tab, \|, :, , delimiter | `tests/test_parser.py` | ☐ |

#### Sprint 1B — Shopee API Engine
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S1B-1 | Viết `header_pool.py` — load JSON, round-robin, gen x-sap-ri | `checker_engine/header_pool.py` | ☐ |
| S1B-2 | Viết `shopee_api.py` — curl_cffi POST, parse response | `checker_engine/shopee_api.py` | ☐ |
| S1B-3 | Implement `CheckResult` dataclass | `checker_engine/shopee_api.py` | ☐ |
| S1B-4 | Implement Cookie extraction khi LIVE (error=0) | `checker_engine/shopee_api.py` | ☐ |
| S1B-5 | Implement IVS data extraction (error=98) | `checker_engine/shopee_api.py` | ☐ |
| S1B-6 | **Test thực tế**: Check 1 account LIVE → nhận error=0 | Manual | ☐ |
| S1B-7 | **Test thực tế**: Check 1 account DIE → nhận error=2 | Manual | ☐ |

#### Sprint 1C — Worker & Rate Limiter
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S1C-1 | Viết `rate_limiter.py` — Redis Leaky Bucket async | `checker_engine/rate_limiter.py` | ☐ |
| S1C-2 | Viết `proxy_manager.py` — load proxies, rotation | `checker_engine/proxy_manager.py` | ☐ |
| S1C-3 | Viết `worker.py` — asyncio, BRPOP, retry logic, Cooldown | `checker_engine/worker.py` | ☐ |
| S1C-4 | Viết `excel_handler.py` — import/export openpyxl | `checker_engine/excel_handler.py` | ☐ |
| S1C-5 | **Test tích hợp**: Đẩy 5 tasks vào Redis → Worker xử lý → MongoDB OK | Integration | ☐ |

**✅ Tiêu chí Done Sprint 1:** `python -m checker_engine.worker` check 10 accounts test ghi kết quả đúng MongoDB.

---

### ⚡ SPRINT 2 — API Backend (FastAPI) (1 ngày)
**Mục tiêu:** REST API + WebSocket hoạt động. Có thể tạo job và nhận realtime updates.

| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S2-1 | Setup FastAPI app, CORS, lifespan events | `api_backend/main.py` | ☐ |
| S2-2 | Viết `database.py` — Motor async MongoDB connection | `api_backend/database.py` | ☐ |
| S2-3 | Viết `redis_client.py` — aioredis | `api_backend/redis_client.py` | ☐ |
| S2-4 | Viết `models.py` — Pydantic schemas Job/Account/Config | `api_backend/models.py` | ☐ |
| S2-5 | Router `jobs.py` — POST/GET /api/jobs, POST stop | `api_backend/routers/jobs.py` | ☐ |
| S2-6 | Router `accounts.py` — GET phân trang, POST import | `api_backend/routers/accounts.py` | ☐ |
| S2-7 | Router `export.py` — GET → trả file Excel binary | `api_backend/routers/export.py` | ☐ |
| S2-8 | Viết `ws_manager.py` — WebSocket Manager + Redis Pub/Sub | `api_backend/ws_manager.py` | ☐ |
| S2-9 | Router `websocket.py` — WS /ws/{job_id} | `api_backend/routers/websocket.py` | ☐ |
| S2-10 | Viết `worker_launcher.py` — Spawn N worker processes | `api_backend/worker_launcher.py` | ☐ |
| S2-11 | **Test API**: Swagger UI `/docs` đầy đủ endpoints | Manual | ☐ |
| S2-12 | **Test WebSocket**: wscat /ws/{id} nhận realtime events | Manual | ☐ |

**✅ Tiêu chí Done Sprint 2:** `uvicorn api_backend.main:app` chạy, tạo job qua Swagger, nhận realtime qua WebSocket.

---

### 🎨 SPRINT 3 — Web Dashboard Next.js 14 (1-2 ngày)
**Mục tiêu:** Giao diện thương mại cao cấp, Dark theme, toàn bộ tính năng hoạt động.

#### Sprint 3A — Setup & Design System
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S3A-1 | Init Next.js 14 project | `web_dashboard/` | ☐ |
| S3A-2 | Cài dependencies: axios, lucide-react, recharts | `package.json` | ☐ |
| S3A-3 | Viết `globals.css` — Dark theme design tokens | `src/styles/globals.css` | ☐ |
| S3A-4 | Viết `src/lib/api.ts` — Axios client | `src/lib/api.ts` | ☐ |
| S3A-5 | Viết `src/lib/useWebSocket.ts` — Custom hook + auto-reconnect | `src/lib/useWebSocket.ts` | ☐ |

#### Sprint 3B — Components
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S3B-1 | `StatsBar.tsx` — counters + progress bar animated | `components/StatsBar.tsx` | ☐ |
| S3B-2 | `UploadPanel.tsx` — drag-drop + paste + config | `components/UploadPanel.tsx` | ☐ |
| S3B-3 | `AccountTable.tsx` — 10 cột, màu status, phân trang | `components/AccountTable.tsx` | ☐ |
| S3B-4 | `JobControls.tsx` — Start/Pause/Stop/Export | `components/JobControls.tsx` | ☐ |
| S3B-5 | `ProgressLog.tsx` — Terminal-style scrolling log | `components/ProgressLog.tsx` | ☐ |
| S3B-6 | `JobHistory.tsx` — Danh sách jobs đã chạy | `components/JobHistory.tsx` | ☐ |

#### Sprint 3C — Pages & Integration
| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S3C-1 | `app/page.tsx` — Dashboard chính + WebSocket connection | `src/app/page.tsx` | ☐ |
| S3C-2 | `app/layout.tsx` — Sidebar navigation | `src/app/layout.tsx` | ☐ |
| S3C-3 | `app/jobs/page.tsx` — Job history page | `src/app/jobs/page.tsx` | ☐ |
| S3C-4 | **Test E2E**: Upload Excel → Start Job → Xem bảng realtime | Full test | ☐ |
| S3C-5 | **Test Export**: Bấm Export → Tải Excel kết quả OK | Manual | ☐ |

**✅ Tiêu chí Done Sprint 3:** Giao diện đẹp, không lỗi console, realtime update mượt mà.

---

### 🐳 SPRINT 4 — Docker & Integration (0.5 ngày)
**Mục tiêu:** Toàn bộ stack chạy qua `docker-compose up`.

| # | Task | File | Done |
| :--- | :--- | :--- | :---: |
| S4-1 | `Dockerfile` cho `api_backend` | `api_backend/Dockerfile` | ☐ |
| S4-2 | `Dockerfile` cho `web_dashboard` | `web_dashboard/Dockerfile` | ☐ |
| S4-3 | `Dockerfile` cho `checker_engine` worker | `checker_engine/Dockerfile` | ☐ |
| S4-4 | `docker-compose.yml` đầy đủ (5 services) | `docker-compose.yml` | ☐ |
| S4-5 | `docker-compose up --build` chạy toàn bộ | Integration | ☐ |
| S4-6 | **Test E2E đầy đủ**: Upload 100 accounts → Check → Export Excel | Full E2E | ☐ |

**✅ Tiêu chí Done Sprint 4:** `http://localhost:3000` truy cập được, check 100 accounts thực tế OK.

---

### 🚀 SPRINT 5 — Tối Ưu & Mở Rộng (tùy nhu cầu)

| # | Task | Ghi Chú | Done |
| :--- | :--- | :--- | :---: |
| S5-1 | Script extract header từ cURL string (parse toolshopee.txt format) | Cập nhật pool nhanh | ☐ |
| S5-2 | Tích hợp Proxy API (TMProxy/ShopLike/TinSoft) | Khi scale > 500 acc/ngày | ☐ |
| S5-3 | Dashboard: Biểu đồ thống kê (Recharts) | UX nâng cao | ☐ |
| S5-4 | Chuẩn bị interface `IVS_VERIFY → Outlook OTP Tool` | Giai đoạn 2 | ☐ |
| S5-5 | Script auto-refresh header pool (Playwright lấy header mới) | Tự động hóa | ☐ |

---

## 10. DEPENDENCIES

### Python (`requirements.txt`)
```
curl_cffi>=0.7.0        # HTTP với TLS fingerprint impersonation
motor>=3.3.0            # Async MongoDB driver
aioredis>=2.0.0         # Async Redis
fastapi>=0.115.0        # API Backend
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9 # File upload
pydantic>=2.0.0
openpyxl>=3.1.0         # Excel read/write
python-dotenv>=1.0.0
loguru>=0.7.0           # Structured logging
```

### Node.js (`package.json` — web_dashboard)
```json
{
  "dependencies": {
    "next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0",
    "axios": "^1.7.0", "lucide-react": "^0.400.0", "recharts": "^2.12.0"
  }
}
```

### Docker Services

| Service | Image | Port | Volume |
| :--- | :--- | :--- | :--- |
| `mongodb` | `mongo:7.0` | `27017` | `./data/mongo:/data/db` |
| `redis` | `redis:7.2-alpine` | `6379` | - |
| `api` | Build `api_backend/` | `8000` | - |
| `dashboard` | Build `web_dashboard/` | `3000` | - |
| `worker` | Build `checker_engine/` | - | `./data:/app/data` |

### Environment Variables (`.env`)
```env
MONGO_URI=mongodb://mongodb:27017
MONGO_DB_NAME=ShopeeTool
REDIS_URL=redis://redis:6379/0
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
WORKER_COUNT=10
WORKER_DELAY_MS=500
HEADER_POOL_PATH=/app/data/header_pool.json
```

---

## 📋 CHECKLIST TRƯỚC KHI BẮT ĐẦU CODE

- [ ] Docker MongoDB đang chạy port 27017
- [ ] Docker Redis đang chạy port 6379
- [ ] File `data/header_pool.json` có ít nhất **2 bộ header** hợp lệ
- [ ] Có ít nhất **10 tài khoản test** (biết trước LIVE/DIE)
- [ ] Python 3.11+ được cài đặt
- [ ] Node.js 20+ được cài đặt
- [ ] Thống nhất số Worker mặc định: **10 workers**

---

## 11. 🔗 GIAI ĐOẠN 2 — TÍCH HỢP OUTLOOK AUTO TOOL

> **Mục tiêu Giai Đoạn 2:** Khi Shopee trả về `error=98` (IVS_VERIFY — đúng password nhưng cần xác minh Email), tự động kích hoạt **Outlook Auto Tool** để mở hộp thư Outlook, lấy link xác minh từ mail Shopee gửi về, click link đó và thu về Cookie đăng nhập đầy đủ.

### 11.1. Tổng Quan Tích Hợp

```
┌─────────────────────────────────────────────────────────────────┐
│              SHOPEE CHECKER (Tool này)                          │
│   check_account() → error=98 (IVS_VERIFY)                      │
│   Lưu vào ShopeeTool.accounts:                                  │
│     { status: "IVS_VERIFY",                                     │
│       ivs_flow_no: "4306209a-...",                              │
│       ivs_token: "U2FsdGVk...",                                 │
│       shopee_email: "user@hotmail.com" }                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Ghi tín hiệu vào MongoDB shared bus
                            │
                            ▼
        ┌─────────────────────────────────────────┐
        │  MongoDB (Shared Data Bus)               │
        │                                         │
        │  Database: ShopeeTool                   │
        │  Collection: ivs_queue                  │
        │  {                                      │
        │    email: "user@hotmail.com",            │
        │    ivs_flow_no: "4306209a-...",          │
        │    ivs_token: "U2FsdGVk...",            │
        │    shopee_login_cookies: {...},          │
        │    status: "PENDING_VERIFY",             │
        │    created_at: ISODate                  │
        │  }                                      │
        └──────────────┬──────────────────────────┘
                       │ Outlook Tool polling mỗi 30s
                       │ (hoặc Redis Pub/Sub tức thì)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│               OUTLOOK AUTO TOOL (Tool hiện có)                   │
│   outlook_db.accounts → Tìm account có email=user@hotmail.com   │
│   Lấy sessionState (Playwright Cookies) của Outlook account      │
│   Mở Inbox headless → Tìm mail từ Shopee                        │
│   mail_reader.read_inbox_full(email, sessionState,               │
│       platform="Shopee", filter_keyword="xác minh")             │
│   Lấy verification_link từ kết quả                              │
│   → Click link xác minh (Playwright) → Thu Cookie Shopee        │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Ghi kết quả về MongoDB
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              SHOPEE CHECKER (Tool này)                          │
│   Poll ShopeeTool.ivs_queue status = "VERIFIED"                │
│   Lấy Cookie Shopee đầy đủ → Cập nhật ShopeeTool.accounts:     │
│     { status: "LIVE",                                           │
│       cookies: { SPC_ST, SPC_EC, SPC_F, SPC_U },               │
│       cookie_captured_at: ISODate }                             │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2. Điều Kiện Tiên Quyết

Để Giai Đoạn 2 hoạt động, cần đảm bảo:

| Điều kiện | Nguồn | Ghi chú |
| :--- | :--- | :--- |
| Outlook account `user@hotmail.com` đã có **Session Cookies** trong Outlook Tool DB | `outlook_db.accounts.sessionState` | Chạy Outlook Auto Tool login trước |
| Email Shopee dùng để đăng ký = Email Outlook có Session | Khớp 1-1 | Tài khoản Shopee dùng Hotmail/Outlook |
| Outlook Tool đang chạy ở chế độ **24/7 Listener** | Auto Listener (polling 10s) | Hoặc được trigger theo tín hiệu |

### 11.3. MongoDB Collections Cần Thêm

#### Collection mới: `ShopeeTool.ivs_queue`

```javascript
// ShopeeTool.ivs_queue — Hàng đợi xác minh IVS
{
  "_id": ObjectId,

  // Identity
  "shopee_email": "user@hotmail.com",   // Email Shopee (= email Outlook)
  "outlook_email": "user@hotmail.com",  // Email Outlook Tool sẽ dùng để đọc mail

  // IVS Data từ Shopee (lưu khi error=98)
  "ivs_flow_no": "4306209a-7f90-4468-bf1e-e9cb4e043037",
  "ivs_token": "U2FsdGVkX1+5mp...",

  // Cookies Shopee hiện tại của session đã đăng nhập (cần gửi kèm khi click link)
  "shopee_login_cookies": {
    "csrftoken": "J6YZMNEq...",
    "SPC_F": "wYaKliHy...",
    // ... các cookie cơ bản từ response lần đăng nhập IVS
  },

  // Trạng thái xử lý
  "status": "PENDING_VERIFY",  // PENDING_VERIFY | PROCESSING | VERIFIED | FAILED | EXPIRED
  "retry_count": 0,

  // Kết quả (điền bởi Outlook Tool sau khi xử lý)
  "verification_link": null,   // Link từ hộp thư Shopee
  "shopee_cookies_full": null, // Cookie Shopee sau khi click link xác minh thành công

  // Thời gian
  "created_at": ISODate,
  "expires_at": ISODate,       // TTL: 15 phút (Shopee link expire)
  "processed_at": null,
  "completed_at": null
}

Indexes:
  { shopee_email: 1, status: 1 }
  { expires_at: 1 }  ← TTL index tự xóa sau 15 phút
```

### 11.4. Luồng Kỹ Thuật Chi Tiết

#### Bước 1 — Shopee Checker ghi IVS Request

```python
# checker_engine/shopee_api.py — Khi nhận error=98
if result.error_code == 98:
    db.ivs_queue.insert_one({
        "shopee_email": email,
        "outlook_email": email,   # Giả định email Shopee = email Outlook
        "ivs_flow_no": data["ivs_flow_no"],
        "ivs_token": data["ivs_token"],
        "shopee_login_cookies": current_session_cookies,
        "status": "PENDING_VERIFY",
        "expires_at": datetime.now() + timedelta(minutes=15),
        "created_at": datetime.now()
    })
```

#### Bước 2 — Outlook Tool lắng nghe và xử lý

```python
# Outlook Auto Tool — module ivs_listener.py (CẦN TẠO MỚI)
# Polling MongoDB ShopeeTool.ivs_queue mỗi 30s

def process_ivs_queue(db_shopee, db_outlook):
    pending = db_shopee.ivs_queue.find(
        {"status": "PENDING_VERIFY", "expires_at": {"$gt": datetime.now()}}
    )
    for task in pending:
        email = task["outlook_email"]

        # 1. Lấy Session Cookies Outlook của email này
        outlook_acc = db_outlook.outlook_db.accounts.find_one({"email": email})
        if not outlook_acc or not outlook_acc.get("sessionState"):
            continue  # Chưa có session Outlook → bỏ qua

        # 2. Mở Inbox Headless → Tìm mail Shopee
        result = read_inbox_full(
            email=email,
            session_state=outlook_acc["sessionState"],
            platform="Shopee",
            custom_keywords=["xác minh", "verify", "shopee"]
        )

        if result and result["verification_link"]:
            # 3. Click link xác minh → Thu Cookie Shopee
            shopee_cookies = click_shopee_verify_link(
                link=result["verification_link"],
                existing_cookies=task["shopee_login_cookies"]
            )

            # 4. Ghi kết quả về ShopeeTool.ivs_queue
            db_shopee.ivs_queue.update_one(
                {"_id": task["_id"]},
                {"$set": {
                    "status": "VERIFIED",
                    "verification_link": result["verification_link"],
                    "shopee_cookies_full": shopee_cookies,
                    "completed_at": datetime.now()
                }}
            )
```

#### Bước 3 — Shopee Checker poll kết quả

```python
# checker_engine/worker.py — Background task
async def poll_ivs_completions():
    """Mỗi 30s kiểm tra các IVS task đã được verify xong"""
    completed = db.ivs_queue.find({"status": "VERIFIED"})
    for task in completed:
        # Cập nhật ShopeeTool.accounts
        db.accounts.update_one(
            {"email": task["shopee_email"]},
            {"$set": {
                "status": "LIVE",
                "cookies": task["shopee_cookies_full"],
                "cookie_captured_at": datetime.now()
            }}
        )
        # Xóa task khỏi ivs_queue
        db.ivs_queue.delete_one({"_id": task["_id"]})
```

### 11.5. Hàm Cần Thêm Vào Outlook Auto Tool

#### Module mới cần tạo: `ivs_listener.py`

```
LoginOutlook/outlook_auto_tool_python/outlook_tool/
└── ivs_listener.py    ← Module mới cho Giai đoạn 2
```

**Chức năng của `ivs_listener.py`:**
- `IVSListener` class với `start()` / `stop()` methods
- Polling `ShopeeTool.ivs_queue` mỗi 30 giây
- Gọi `mail_reader.read_inbox_full()` với platform="Shopee"
- Hàm `click_shopee_verify_link(link, cookies)` dùng Playwright click link + lấy cookie
- Ghi kết quả về `ShopeeTool.ivs_queue.status = "VERIFIED"`

#### Hàm mới cần thêm vào `mail_reader.py`

```python
def click_verification_link_and_get_cookies(
    link: str,
    existing_cookies: dict,
    headless: bool = True
) -> dict:
    """
    Giai đoạn 2: Playwright mở link xác minh Shopee → Thu Cookie đăng nhập.
    Args:
        link: URL xác minh từ email Shopee
        existing_cookies: Cookie Shopee hiện có (từ IVS response)
    Returns:
        dict: Cookie Shopee đầy đủ sau khi xác minh (SPC_ST, SPC_EC, SPC_F, SPC_U)
    """
```

### 11.6. Cấu Hình MongoDB Kết Nối Chéo

```python
# Outlook Tool cần đọc ShopeeTool DB (cross-DB access)
# Cả 2 tool dùng CÙNG MongoDB instance → không cần thêm kết nối mới

# Trong IVSListener.__init__():
self.client = MongoClient(MONGO_URI)
self.db_outlook  = self.client["outlook_db"]     # DB của Outlook Tool
self.db_shopee   = self.client["ShopeeTool"]     # DB của Shopee Checker
self.col_ivs     = self.db_shopee["ivs_queue"]   # Collection mới
self.col_accounts_ol = self.db_outlook["accounts"]  # Outlook sessions
self.col_accounts_sh = self.db_shopee["accounts"]   # Shopee accounts
```

### 11.7. Sprint Giai Đoạn 2 (Kế Hoạch Tương Lai)

| # | Task | Tool Cần Sửa/Thêm | Ưu Tiên |
| :--- | :--- | :--- | :---: |
| P2-1 | Tạo collection `ShopeeTool.ivs_queue` + TTL index | Shopee Checker | 🔴 Cao |
| P2-2 | Shopee Checker: Ghi vào `ivs_queue` khi `error=98` | `checker_engine/worker.py` | 🔴 Cao |
| P2-3 | Shopee Checker: Background poll `ivs_queue VERIFIED` → update accounts | `checker_engine/worker.py` | 🔴 Cao |
| P2-4 | Tạo `ivs_listener.py` trong Outlook Tool | `outlook_tool/ivs_listener.py` | 🔴 Cao |
| P2-5 | Thêm `click_verification_link_and_get_cookies()` vào Outlook Tool | `outlook_tool/mail_reader.py` | 🔴 Cao |
| P2-6 | Tích hợp `IVSListener` vào Outlook GUI (checkbox bật/tắt) | `outlook_tool/gui.py` | 🟡 Vừa |
| P2-7 | Dashboard: Hiển thị cột "Cookie Shopee" + badge `✅ Đã có Cookie` | `web_dashboard/` | 🟡 Vừa |
| P2-8 | Test E2E: Shopee IVS → Outlook verify link → Cookie ghi vào DB | Full E2E test | 🔴 Cao |

### 11.8. Sơ Đồ Database Kết Nối Chéo

```
MongoDB Instance (Shared)
│
├── outlook_db                       ← Outlook Auto Tool
│   └── accounts
│       ├── email: "user@hotmail.com"
│       ├── password: "..."
│       └── sessionState: {...}       ← PLAYWRIGHT COOKIES Outlook
│
└── ShopeeTool                       ← Shopee Checker
    ├── accounts
    │   ├── email: "user@hotmail.com"
    │   ├── status: "IVS_VERIFY" → "LIVE"  (cập nhật sau khi verify)
    │   ├── ivs_flow_no: "..."
    │   ├── ivs_token: "..."
    │   └── cookies: { SPC_ST, SPC_EC, ... }  ← COOKIE SHOPEE ĐẦY ĐỦ
    │
    ├── jobs
    │   └── { job_id, stats, status, ... }
    │
    ├── header_pool
    │   └── { x_sap_sec, af_ac_enc_sz_token, ... }
    │
    └── ivs_queue                     ← Collection Giai Đoạn 2 (MỚI)
        ├── shopee_email: "user@hotmail.com"
        ├── ivs_flow_no, ivs_token
        ├── shopee_login_cookies
        ├── status: PENDING → PROCESSING → VERIFIED
        ├── verification_link: "https://shopee.vn/verify?..."
        └── shopee_cookies_full: { SPC_ST, SPC_EC, SPC_F, SPC_U }
```

---

*Tài liệu này là nguồn sự thật duy nhất (Single Source of Truth). Mọi thay đổi kiến trúc phải cập nhật vào đây trước khi triển khai.*
