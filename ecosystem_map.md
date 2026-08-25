# 🗺️ ARMS DWH — Bản Đồ Hệ Sinh Thái MMO Tool & Kế Hoạch Tích Hợp Pipeline

## Phiên bản: v4.0 — Ecosystem Integration Edition
## Cập nhật: 2026-08-25 | Phân tích toàn bộ pipeline từ nguồn đến đích

---

## 🌐 PHẦN 0: BỨC TRANH TOÀN CẢNH HỆ SINH THÁI

### Sơ Đồ Pipeline Tổng Thể

```
╔══════════════════════════════════════════════════════════════════╗
║              HỆ SINH THÁI MMO TOOL — TOÀN BỘ PIPELINE           ║
╚══════════════════════════════════════════════════════════════════╝

 TẦNG 1: THU THẬP & XỬ LÝ DATA
 ┌─────────────────────────────────────────────────────────────────┐
 │  D:\sontayweb\nhat-xu-shopee\shopee_checker_project             │
 │  ┌─────────────────────────────────────────────────────────┐    │
 │  │  Shopee Checker Engine (Python + FastAPI)               │    │
 │  │  • checker_engine/worker.py  — Queue xử lý hàng loạt   │    │
 │  │  • checker_engine/shopee_api.py — Gọi Shopee API        │    │
 │  │  • checker_engine/proxy_manager.py — Xoay IP proxy      │    │
 │  │  • checker_engine/hasher.py — Hash/fingerprint          │    │
 │  │  Database: MongoDB ShopeeTool.accounts                  │    │
 │  │  Status sau check: LIVE / IVS_VERIFY / DEAD             │    │
 │  └─────────────────────────────────────────────────────────┘    │
 │         │                          │                            │
 │         ▼                          ▼                            │
 │  ┌──────────────┐        ┌──────────────────────┐              │
 │  │ LoginOutlook │        │ zalo_auto_leave_proj  │              │
 │  │ (IVS Verify) │        │ (Thoát nhóm Zalo)    │              │
 │  │ Python Tool  │        │ Python + Playwright   │              │
 │  └──────────────┘        └──────────────────────┘              │
 │         │                                                        │
 │         │  ◄── IVS Queue: MongoDB ShopeeTool.ivs_queue          │
 │         │      (Shared MongoDB bus giữa 2 tool)                  │
 └─────────┼────────────────────────────────────────────────────────┘
           │
           ▼ (Nick LIVE với Cookie đầy đủ)
 
 TẦNG 2: KHO TẬP TRUNG — ARMS DWH ← ĐÂY LÀ VỊ TRÍ CỦA ARMS
 ┌─────────────────────────────────────────────────────────────────┐
 │  D:\sontayweb\toolMMO                                           │
 │  ┌─────────────────────────────────────────────────────────┐    │
 │  │  ARMS Data Warehouse (NestJS + Next.js + MongoDB)       │    │
 │  │                                                         │    │
 │  │  NHẬN VÀO:                                             │    │
 │  │  • File TXT/Excel từ Zalo (import offline)              │    │
 │  │  • Auto-sync Google Drive (GAS pipeline)                │    │
 │  │  • [CẦN THÊM] API nhận từ shopee_checker_project        │    │
 │  │                                                         │    │
 │  │  XỬ LÝ:                                                │    │
 │  │  • Dedup, Encrypt AES-256, Team RBAC                    │    │
 │  │  • Health Status sync với ShopeeTool.accounts           │    │
 │  │  • Bulk actions: mark SOLD/USED/BLACKLIST               │    │
 │  │                                                         │    │
 │  │  XUẤT RA:                                               │    │
 │  │  • API Key Service (REST cho tool ngoại vi)             │    │
 │  │  • Export TXT/Excel                                     │    │
 │  └─────────────────────────────────────────────────────────┘    │
 └─────────────────────────────────────────────────────────────────┘
           │                           │
     ┌─────┘                           └─────┐
     ▼                                       ▼
 TẦNG 3: TIÊU THỤ & BÁN RA                TẦNG 3B: TOOL NUÔI
 ┌────────────────────────────┐       ┌──────────────────────────┐
 │ D:\Support\dichvutaikhoanao│       │ nhat-xu-shopee/           │
 │ Web Shop Bán Lẻ            │       │ shopee_tool_project       │
 │ (Next.js + MongoDB)        │       │ tiktok_auto_tool_project  │
 │                            │       │ (Nuôi nick, seeding)      │
 │ • Khách tự order online    │       │                           │
 │ • PayOS QR thanh toán      │       │ • Nhận nick từ ARMS API   │
 │ • Tự động giao hàng        │       │ • Push sang Antidetect    │
 │ • Balance/ví tiền          │       │ • Farm Boxphone           │
 └────────────────────────────┘       └──────────────────────────┘
```

---

## 🔍 PHẦN 1: PHÂN TÍCH TỪNG TẦNG HỆ SINH THÁI

### 1.1 Tầng 1 — shopee_checker_project (Nguồn Data)

**Vị trí:** `D:\sontayweb\nhat-xu-shopee\shopee_checker_project`
**Stack:** Python + FastAPI + MongoDB (ShopeeTool) + Redis + Playwright
**Nhiệm vụ:** Nhận danh sách nick raw, kiểm tra còn sống không, lấy Cookie

**Quy trình xử lý:**
```
Nick raw (email + pass)
  → shopee_api.py gọi Shopee Login API qua Proxy Pool
  → Kết quả:
    LIVE            → Lấy Cookie SPC_ST, SPC_EC, SPC_F, SPC_U
    IVS_VERIFY      → Ghi vào ivs_queue → Outlook Tool xử lý
    DEAD/CHECKPOINT → Đánh dấu loại
  → Ghi vào ShopeeTool.accounts
```

**Sub-tools trong nhat-xu-shopee:**
| Tool | Mục đích |
|------|---------|
| `shopee_checker_project` | Kiểm tra live/die nick Shopee qua API |
| `LoginOutlook` | Đọc mail Outlook để lấy link IVS verify |
| `tiktok_auto_tool_project` | Tool tự động TikTok |
| `shopee_tool_project` | Tool tự động Shopee |
| `zalo_auto_leave_project` | Tự động thoát nhóm Zalo |
| `CheckLoginShopee` | Kiểm tra đăng nhập Shopee |
| `license_dashboard_project` | Quản lý license |

**Database riêng của shopee_checker:**
```
MongoDB: ShopeeTool
├── accounts          ← Nick Shopee + status + cookie sau check
├── jobs              ← Batch check jobs
├── header_pool       ← Header fingerprint pool
└── ivs_queue         ← Hàng đợi IVS verify (bus giao tiếp với Outlook Tool)
```

---

### 1.2 Tầng 2 — ARMS DWH (Kho Tập Trung)

**Vị trí:** `D:\sontayweb\toolMMO`
**Stack:** NestJS + Next.js + MongoDB (arms_db) + BullMQ/Redis
**Nhiệm vụ:** Kho lưu trữ trung tâm, quản lý team, phân phối nick ra

**❗ Vấn đề hiện tại — ARMS chưa kết nối với shopee_checker_project:**
- Nick sau khi check LIVE ở ShopeeTool.accounts → chưa tự động đẩy vào arms_db
- Hiện tại còn phải export file từ shopee_checker → import thủ công vào ARMS
- ARMS không biết health_status thực tế từ shopee_checker

---

### 1.3 Tầng 3A — dichvutaikhoanao (Kênh Bán Lẻ)

**Vị trí:** `D:\Support\dichvutaikhoanao`
**Stack:** Next.js 16 + MongoDB + PayOS + Radix UI + Recharts + Sonner
**Nhiệm vụ:** Web shop bán tài khoản lẻ cho khách hàng tự order

**Tính năng hiện có:**
- Khách đăng ký, nạp tiền (PayOS QR hoặc thủ công)
- Duyệt sản phẩm và mua tài khoản online
- Hệ thống giao hàng tự động sau thanh toán
- Webhook PayOS nhận thanh toán
- Vai trò: customer / admin / seller
- Balance wallet, bonus percentage, VIP

**❗ Vấn đề — dichvutaikhoanao lấy hàng từ đâu?**
- Hiện tại có `ExtProvider` — kết nối API nhà cung cấp ngoài
- Chưa kết nối trực tiếp với ARMS DWH API
- Cần ARMS xuất API Service Key → dichvutaikhoanao gọi lấy nick

---

## 🔗 PHẦN 2: CÁC ĐIỂM TÍCH HỢP CẦN XÂY DỰNG

### 2.1 Integration Point A: shopee_checker → ARMS

**Hiện trạng:** Thủ công (export file → import)
**Mục tiêu:** Tự động hoàn toàn

**Giải pháp — 2 cách tiếp cận:**

#### Cách 1: Push từ shopee_checker vào ARMS (Recommended)
```python
# Trong checker_engine/worker.py — sau khi check LIVE thành công:
import requests

if result.status == 'LIVE':
    # Đẩy trực tiếp vào ARMS qua API
    arms_response = requests.post(
        f"{ARMS_API_URL}/api/accounts/ingest",
        headers={"x-arms-service-key": ARMS_SERVICE_KEY},
        json={
            "username": account.email,
            "password": account.password,
            "platform": "SHOPEE",
            "cookie": result.cookies.get("SPC_F"),
            "session_token": result.cookies.get("SPC_ST"),
            "health_status": "LIVE",
            "source": "shopee_checker_auto"
        }
    )
```

**API cần thêm vào ARMS:**
```typescript
// POST /accounts/ingest — nhận từ các tool ngoại vi có API key
@Post('ingest')
@UseGuards(ServiceKeyGuard)  // Dùng x-arms-service-key thay JWT
async ingestAccount(
  @Body() body: IngestAccountDto,
  @ServiceKey() key: ApiKey
) {
  // Tự động upsert, set health_status, track nguồn
}
```

#### Cách 2: ARMS chủ động poll ShopeeTool.accounts (MongoDB cross-DB)
```typescript
// ARMS Scheduler — mỗi 5 phút sync nick LIVE từ ShopeeTool
@Cron('*/5 * * * *')
async syncFromShopeeChecker() {
  const shopeeDb = await this.mongoService.getExternalDb('ShopeeTool');
  const newLiveAccounts = await shopeeDb.collection('accounts')
    .find({ 
      status: 'LIVE',
      arms_synced: { $ne: true }  // Chưa sync sang ARMS
    }).toArray();
  
  for (const acc of newLiveAccounts) {
    await this.accountsService.upsert(mapShopeeToArms(acc));
    await shopeeDb.collection('accounts')
      .updateOne({ _id: acc._id }, { $set: { arms_synced: true }});
  }
}
```

---

### 2.2 Integration Point B: ARMS → dichvutaikhoanao

**Hiện trạng:** dichvutaikhoanao dùng `ExtProvider` — API nhà cung cấp cố định
**Mục tiêu:** ARMS trở thành `ExtProvider` chính thức cho dichvutaikhoanao

**Cần làm ở ARMS:**
```typescript
// API mới: POST /accounts/consume
// Dùng cho dichvutaikhoanao — tiêu thụ tự động khi có đơn hàng
@Post('consume')
@UseGuards(ServiceKeyGuard)
async consumeAccounts(
  @Body() body: ConsumeAccountDto  
  // { platform, quantity, health_status: 'LIVE', team? }
) {
  // 1. Lấy danh sách nick AVAILABLE + LIVE theo filter
  // 2. Lock batch (tránh race condition)
  // 3. Mark SOLD
  // 4. Return accounts list với credentials đầy đủ
  // 5. Ghi audit log: ai lấy, lấy bao nhiêu
}
```

**Cần làm ở dichvutaikhoanao:**
```typescript
// Trong ExtProvider config — thêm ARMS provider:
const ARMS_PROVIDER = {
  name: 'ARMS DWH',
  endpoint: process.env.ARMS_API_URL + '/accounts/consume',
  apiKey: process.env.ARMS_SERVICE_KEY,
  mapResponse: (arms_accounts) => arms_accounts.map(acc => ({
    username: acc.username,
    password: acc.password,
    cookie: acc.cookie,
    // ... map sang format dichvutaikhoanao cần
  }))
};
```

---

### 2.3 Integration Point C: ARMS → shopee_tool / tiktok_auto_tool

**Mục tiêu:** Tool nuôi nick lấy tài khoản từ ARMS thay vì file thủ công

```python
# Trong shopee_tool_project hoặc tiktok_auto_tool_project:
# Thay vì đọc file TXT:
# accounts = open('accounts.txt').readlines()

# Gọi ARMS API:
response = requests.post(
    f"{ARMS_URL}/api/accounts/consume",
    headers={"x-arms-service-key": KEY},
    json={"platform": "TIKTOK", "quantity": 50, "team": "TEAM_HA_NOI"}
)
accounts = response.json()["accounts"]
```

---

## 🏗️ PHẦN 3: KIẾN TRÚC ARMS SAU TÍCH HỢP

### 3.1 ARMS Cần Thêm — Integration Layer

```
apps/api/src/modules/
├── integrations/
│   ├── shopee-checker/
│   │   ├── shopee-checker.service.ts   ← Poll ShopeeTool MongoDB
│   │   └── shopee-checker.scheduler.ts ← Cron job 5 phút
│   ├── google-drive/                   ← Đã có
│   └── [NEW] ingest/
│       ├── ingest.controller.ts        ← POST /accounts/ingest
│       └── ingest.service.ts           ← Nhận push từ tool ngoại vi
├── accounts/
│   └── [MODIFY] consume endpoint       ← POST /accounts/consume
└── guards/
    └── [NEW] service-key.guard.ts      ← Auth cho x-arms-service-key
```

### 3.2 Schema Mở Rộng

```typescript
// Account Schema — thêm fields để track nguồn & health từ shopee_checker
{
  // ... fields hiện có ...
  
  // Source tracking
  source_system: String,       // 'google_drive' | 'shopee_checker' | 'manual'
  source_job_id: String,       // Job ID từ shopee_checker
  
  // Health từ shopee_checker (thay thế internal health check)
  health_status: {
    type: String,
    enum: ['UNKNOWN', 'LIVE', 'SOFT_DEAD', 'DEAD', 'IVS_PENDING']
  },
  health_checked_at: Date,
  health_checker_version: String,  // Phiên bản checker engine
  
  // Cookie Shopee đầy đủ (từ shopee_checker sau IVS verify)
  shopee_cookies: {
    SPC_ST: String,
    SPC_EC: String,
    SPC_F: String,
    SPC_U: String
  },
  
  // Consumption tracking
  consumed_by_system: String,   // 'dichvutaikhoanao' | 'shopee_tool' | ...
  consumed_at: Date,
  consume_order_id: String,     // ID đơn hàng ở dichvutaikhoanao
}
```

### 3.3 Flow Tích Hợp Hoàn Chỉnh

```
┌────────────────────────────────────────────────────────────────┐
│               LUỒNG DỮ LIỆU SAU TÍCH HỢP                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. shopee_checker kiểm tra nick                              │
│     → Nick LIVE → POST /arms/accounts/ingest (tự động)        │
│     → ARMS lưu với health_status=LIVE + full cookies          │
│                                                                │
│  2. Google Drive / Import thủ công                            │
│     → Nick vào ARMS với health_status=UNKNOWN                 │
│     → Scheduler ARMS gọi shopee_checker để check              │
│                    (hoặc dùng internal proxy checker)         │
│                                                                │
│  3. dichvutaikhoanao có đơn hàng                             │
│     → POST /arms/accounts/consume                             │
│     → ARMS trả về nick LIVE → dichvutaikhoanao giao hàng     │
│     → ARMS mark SOLD + ghi audit + notify Telegram           │
│                                                                │
│  4. shopee_tool / tiktok_auto_tool cần nick để nuôi           │
│     → POST /arms/accounts/consume (scope: FARM_ACCOUNTS)     │
│     → ARMS mark USED (không phải SOLD)                       │
│     → Tool nuôi hoàn thành → update status về ARMS           │
│                                                                │
│  5. Dashboard ARMS                                            │
│     → Hiển thị tổng hợp toàn pipeline                        │
│     → Bao nhiêu nick đang check ở shopee_checker             │
│     → Bao nhiêu nick đã bán qua dichvutaikhoanao             │
│     → Bao nhiêu nick đang nuôi ở farm                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PHẦN 4: ARMS LÀ "TRUNG TÂM THẦN KINH" CỦA TOÀN HỆ SINH THÁI

### 4.1 Vị Trí Chiến Lược của ARMS

```
ARMS không chỉ là "kho lưu nick" —
ARMS là Data Hub điều phối toàn bộ ecosystem:

  shopee_checker  ──push LIVE nick──▶  ARMS DWH  ──consume──▶  dichvutaikhoanao
  tiktok_checker  ──push LIVE nick──▶    (Kho)   ──consume──▶  shopee_tool
  Google Drive    ──auto sync──────▶    trung     ──consume──▶  tiktok_auto_tool
  Manual import   ──upload file───▶     tâm      ──API Key───▶  Khách mua buôn
                                         │
                                    Telegram Bot
                                    Dashboard
                                    Audit Logs
                                    CRM/Revenue
```

### 4.2 API Scope Hệ Sinh Thái Đầy Đủ

| Scope API Key | Ai dùng | Quyền |
|-------------|---------|-------|
| `INGEST_ACCOUNTS` | shopee_checker, tiktok_checker | Push nick vào ARMS |
| `READ_ACCOUNTS` | dichvutaikhoanao, tool nuôi | Xem danh sách |
| `CONSUME_ACCOUNTS` | dichvutaikhoanao | Lấy nick + mark SOLD |
| `FARM_ACCOUNTS` | shopee_tool, tiktok_auto_tool | Lấy nick + mark USED |
| `WRITE_ACCOUNTS` | Internal tools | Cập nhật cookie/status |
| `READ_STATS` | Dashboard ngoài | Xem thống kê |

### 4.3 Dashboard ARMS — Tầm Nhìn Ecosystem

```
Overview Dashboard (sau khi tích hợp)
┌────────────────────────────────────────────────────────────────┐
│  📊 Tổng Quan Ecosystem                        [7D][30D][90D] │
├────────────────────────────────────────────────────────────────┤
│  Pipeline Stats:                                               │
│  ┌──────────┐ ──push──▶ ┌──────────┐ ──sell──▶ ┌──────────┐  │
│  │  Checker  │           │  ARMS    │            │  Shop    │  │
│  │  Đang xử  │           │  Tồn kho │            │  Doanh   │  │
│  │  lý: 200  │           │  58,100  │            │  thu:    │  │
│  │  LIVE: 42K│           │  LIVE:80%│            │ 2.5M/T   │  │
│  └──────────┘           └──────────┘            └──────────┘  │
├────────────────────────────────────────────────────────────────┤
│  Kênh tiêu thụ hôm nay:                                       │
│  dichvutaikhoanao: 150 nick (750K VNĐ)                        │
│  Bán buôn trực tiếp:  500 nick (1.5M VNĐ)                    │
│  Farm (đang nuôi):    120 nick                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📦 PHẦN 5: KẾ HOẠCH TÍCH HỢP — PRIORITY ORDER

### Sprint 0: Foundation (Hiện tại — Phase 1 cũ)
**Refactor page.tsx + Setup routing + Modal system**
- Không thay đổi — vẫn phải làm trước

### Sprint 1: Tích Hợp shopee_checker → ARMS (NEW — ƯU TIÊN)
- [ ] Tạo `POST /accounts/ingest` endpoint + ServiceKeyGuard
- [ ] Thêm `INGEST_ACCOUNTS` scope vào API Keys
- [ ] Thêm `source_system`, `health_status` vào Account schema
- [ ] Cross-DB scheduler poll ShopeeTool.accounts mỗi 5 phút (backup)
- [ ] Thêm code push vào `checker_engine/worker.py` (shopee_checker side)

### Sprint 2: Tích Hợp ARMS → dichvutaikhoanao (NEW — DOANH THU)
- [ ] Tạo `POST /accounts/consume` endpoint (secure, locked)
- [ ] Thêm `CONSUME_ACCOUNTS` scope
- [ ] Cấu hình dichvutaikhoanao dùng ARMS làm ExtProvider
- [ ] Test E2E: đơn hàng dichvutaikhoanao → ARMS consume → giao hàng tự động

### Sprint 3: Dashboard Ecosystem View
- [ ] Panel hiển thị pipeline stats (checker → ARMS → shop)
- [ ] Theo dõi nick đang ở tầng nào (checking / warehouse / sold / farming)
- [ ] Doanh thu theo kênh (shop lẻ vs bán buôn vs farm)

### Sprint 4: Tool Farm Integration
- [ ] `FARM_ACCOUNTS` scope
- [ ] shopee_tool + tiktok_auto_tool gọi ARMS thay vì đọc file
- [ ] Callback khi tool nuôi xong: update status về ARMS

---

## 💡 PHẦN 6: INSIGHTS — ARMS LÀ SẢN PHẨM B2B, KHÔNG CHỈ B2C

### Nhận Định Mới

Sau khi phân tích toàn hệ sinh thái, **ARMS không nên bán cho người dùng cuối (end-user)** mà nên định vị là **B2B Infrastructure Tool** cho các cơ sở kinh doanh MMO:

| Đối tượng khách hàng | Nhu cầu | Giá trị ARMS mang lại |
|---------------------|---------|----------------------|
| **Cơ sở MMO có đội nhóm** | Quản lý kho 50K+ nick nhiều người | Multi-team RBAC + Dashboard |
| **Web shop bán tài khoản** | Nguồn hàng tự động, không hết | ARMS làm nhà cung cấp API |
| **Developer tool MMO** | Kho nick ổn định cho tool chạy | API Gateway với scopes |
| **Reseller bán buôn** | Xuất file nhanh, không bán trùng | Smart Export + Lock mechanism |

### Chiến Lược Bán Hàng Điều Chỉnh

Thay vì bán ARMS standalone → **Bán ARMS như một platform với ecosystem tích hợp sẵn:**

```
Gói "Full MMO Stack":
  ARMS DWH +
  shopee_checker_project (đã tích hợp) +
  dichvutaikhoanao (web shop sẵn) +
  Hướng dẫn cấu hình pipeline end-to-end

Giá: 5-10M VNĐ/tháng (thuê hosting + maintenance)
     hoặc 30-50M VNĐ/lần (mua source code license)
```

---

*📅 Tài liệu này tổng hợp toàn bộ hệ sinh thái:*
*• D:\sontayweb\toolMMO (ARMS DWH)*
*• D:\sontayweb\nhat-xu-shopee (Checker + Tool suite)*
*• D:\Support\dichvutaikhoanao (Web Shop)*
*Cập nhật: 2026-08-25*
