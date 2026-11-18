# 🗺️ LỘ TRÌNH PHÁT TRIỂN TIẾP THEO
**Dự án:** `shopee_checker_project` — Thức Sơn Tool MMO Ecosystem  
**Phiên bản:** 1.0.0 | **Cập nhật:** 2026-08-23  
**Trạng thái:** Sprint 0–4 hoàn thành ✅ | Sprint 5+ chuẩn bị triển khai

---

## 📑 MỤC LỤC

1. [P1 — Auto IVS: Giai Đoạn 2 Outlook Integration](#1-p1--auto-ivs-giai-đoạn-2-outlook-integration)
2. [P2 — Bóc Tách Số Dư Shopee Xu và Thông Tin Nick](#2-p2--bóc-tách-số-dư-shopee-xu-và-thông-tin-nick)
3. [P3 — Auto Header Pool Refresher](#3-p3--auto-header-pool-refresher)
4. [P4 — Tích Hợp Proxy API Xoay IP Tự Động](#4-p4--tích-hợp-proxy-api-xoay-ip-tự-động)
5. [P5 — Central MMO Dashboard](#5-p5--central-mmo-dashboard)

---

## 1. P1 — AUTO IVS: GIAI ĐOẠN 2 OUTLOOK INTEGRATION

### 1.1. Mô Tả Nghiệp Vụ

Khi Shopee API trả về `error: 98` (IVS_VERIFY), tài khoản **đúng mật khẩu** nhưng Shopee
yêu cầu click link xác minh gửi về email để hoàn tất đăng nhập. Hiện tool dừng ở
`IVS_VERIFY`. Mục tiêu Phase 2: **tự động hoá 100%** bước này qua `outlook_auto_tool_python`.

```
Luồng mong muốn:
  Shopee error=98
      ↓
  Outlook Tool đọc hộp thư → bóc link xác minh
      ↓
  Click link → Thu Cookie Shopee đầy đủ
      ↓
  Trạng thái LIVE + Cookie ghi vào MongoDB
```

### 1.2. Điều Kiện Tiên Quyết

| Điều kiện | Kiểm tra |
| :--- | :---: |
| Tài khoản Shopee đăng ký bằng Hotmail/Outlook | ✅ |
| Tài khoản Outlook đã có `sessionState` trong `outlook_db.accounts` | ✅ |
| `outlook_auto_tool_python` đang chạy 24/7 | ✅ |
| MongoDB instance chung (port 27017) | ✅ |

### 1.3. Kiến Trúc Giao Tiếp Giữa 2 Tool (Shared MongoDB Bus)

```
MongoDB (port 27017)
│
├── outlook_db.accounts           ← Managed by Outlook Tool
│   └── { email, sessionState }
│
└── ShopeeTool
    ├── accounts                  ← Managed by Shopee Checker
    └── ivs_queue  [MỚI]
        ├── status: PENDING_VERIFY
        │           ↕ (Outlook Tool poll mỗi 30s)
        └── status: VERIFIED
```

### 1.4. Database Schema: `ShopeeTool.ivs_queue`

```javascript
{
  "_id": ObjectId,
  "shopee_email": "user@hotmail.com",
  "outlook_email": "user@hotmail.com",
  "ivs_flow_no": "4306209a-7f90-4468-bf1e-e9cb4e043037",
  "ivs_token": "U2FsdGVkX1+5mp...",
  "shopee_login_cookies": { "csrftoken": "...", "SPC_F": "..." },

  // PENDING_VERIFY → PROCESSING → VERIFIED | FAILED | EXPIRED
  "status": "PENDING_VERIFY",
  "retry_count": 0,

  "verification_link": null,
  "shopee_cookies_full": null,   // { SPC_ST, SPC_EC, SPC_F, SPC_U }

  "created_at": ISODate("2026-08-23T01:00:00Z"),
  "expires_at": ISODate("2026-08-23T01:15:00Z"),   // TTL 15 phút
  "processed_at": null,
  "completed_at": null
}

// Indexes:
db.ivs_queue.createIndex({ "shopee_email": 1, "status": 1 })
db.ivs_queue.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
```

### 1.5. Luồng Kỹ Thuật — Phía Shopee Checker

**File sửa:** `checker_engine/worker.py`

```python
# Khi result.status == IVS_VERIFY:
if result.status == AccountStatus.IVS_VERIFY:
    from datetime import timedelta
    ivs_doc = {
        "shopee_email": email,
        "outlook_email": email,
        "ivs_flow_no": result.ivs_flow_no,
        "ivs_token": result.ivs_token,
        "shopee_login_cookies": result.cookies,
        "status": "PENDING_VERIFY",
        "retry_count": 0,
        "verification_link": None,
        "shopee_cookies_full": None,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(minutes=15),
        "processed_at": None,
        "completed_at": None
    }
    self.db["ivs_queue"].insert_one(ivs_doc)
    logger.info(f"[IVS] Đã đẩy task IVS cho {email} vào hàng đợi")

# Background task: poll_ivs_completions() — chạy mỗi 30s
async def poll_ivs_completions(self):
    while self._running:
        await asyncio.sleep(30)
        completed = list(self.db["ivs_queue"].find({
            "status": "VERIFIED",
            "shopee_cookies_full": {"$ne": None}
        }))
        for task in completed:
            self.db["accounts"].update_one(
                {"email": task["shopee_email"]},
                {"$set": {
                    "status": AccountStatus.LIVE.value,
                    "cookies": task["shopee_cookies_full"],
                    "ivs_resolved": True,
                    "cookie_captured_at": datetime.now()
                }}
            )
            self.db["ivs_queue"].delete_one({"_id": task["_id"]})
```

### 1.6. Luồng Kỹ Thuật — Phía Outlook Auto Tool

**File tạo mới:** `LoginOutlook/outlook_auto_tool_python/outlook_tool/ivs_listener.py`

```python
class IVSListener:
    """
    Lắng nghe ShopeeTool.ivs_queue, tự động bóc link xác minh từ
    hộp thư Outlook và click xác minh để thu Cookie Shopee đầy đủ.
    Chạy song song với luồng TikTok OTP — không xung đột.
    """
    POLL_INTERVAL_SEC = 30

    def __init__(self, mongo_uri: str):
        self.client = MongoClient(mongo_uri)
        self.col_ivs    = self.client["ShopeeTool"]["ivs_queue"]
        self.col_ol_acc = self.client["outlook_db"]["accounts"]

    async def _process_pending_tasks(self):
        pending = list(self.col_ivs.find({
            "status": "PENDING_VERIFY",
            "expires_at": {"$gt": datetime.now()}
        }))
        for task in pending:
            outlook_acc = self.col_ol_acc.find_one({"email": task["outlook_email"]})
            if not outlook_acc or not outlook_acc.get("sessionState"):
                continue  # chưa có session Outlook → bỏ qua

            # Đánh dấu PROCESSING (tránh race condition)
            self.col_ivs.update_one({"_id": task["_id"]},
                {"$set": {"status": "PROCESSING", "processed_at": datetime.now()}})

            # Bóc link xác minh từ hộp thư
            link = await self._read_shopee_verify_link(
                email=task["outlook_email"],
                session_state=outlook_acc["sessionState"]
            )
            if not link:
                self.col_ivs.update_one({"_id": task["_id"]},
                    {"$set": {"status": "PENDING_VERIFY",
                              "retry_count": task["retry_count"] + 1}})
                continue

            # Click link → thu Cookie Shopee
            cookies = await self._click_verify_link(link, task.get("shopee_login_cookies", {}))
            status  = "VERIFIED" if cookies else "FAILED"
            self.col_ivs.update_one({"_id": task["_id"]}, {"$set": {
                "status": status,
                "verification_link": link,
                "shopee_cookies_full": cookies,
                "completed_at": datetime.now()
            }})

    async def _read_shopee_verify_link(self, email, session_state) -> str | None:
        """Mở Outlook qua Playwright headless, regex bóc link Shopee."""
        async with async_playwright() as p:
            ctx = await (await p.chromium.launch(headless=True)).new_context(
                storage_state=session_state)
            page = await ctx.new_page()
            await page.goto("https://outlook.live.com/mail/0/inbox")
            await page.wait_for_timeout(2000)
            # Tìm và click mail Shopee → regex bóc link
            shopee_mail = page.locator('[role="option"]:has-text("Shopee")').first
            if await shopee_mail.is_visible(timeout=10000):
                await shopee_mail.click()
                body = await page.inner_text('[role="main"]')
                m = re.search(r'https://shopee\.vn/[^\s"<>]*verify[^\s"<>]+', body)
                if m:
                    return m.group(0)
        return None
```

**Tích hợp GUI Outlook Tool:**

```python
# Thêm checkbox vào tab cấu hình
self.chk_ivs = QCheckBox("🔗 Bật IVS Listener (Tự động xác minh Shopee qua Mail)")
# Khi bật → IVSListener.start(), khi tắt → IVSListener.stop()
```

### 1.7. Files Cần Tạo / Sửa

| File | Hành động | Ghi chú |
| :--- | :---: | :--- |
| `checker_engine/worker.py` | ✏️ Sửa | Ghi `ivs_queue` khi `error=98` + background poll |
| `checker_engine/config.py` | ✏️ Sửa | Thêm `IVS_QUEUE_COLLECTION = "ivs_queue"` |
| `outlook_tool/ivs_listener.py` | ➕ Mới | Class `IVSListener` hoàn chỉnh |
| `outlook_tool/gui.py` | ✏️ Sửa | Checkbox bật/tắt IVS Listener |
| `web_dashboard/AccountTable.tsx` | ✏️ Sửa | Badge `✅ Cookie Verified` khi `ivs_resolved=true` |

### 1.8. Ước Tính Thời Gian

| Task | Ước tính |
| :--- | :---: |
| Setup `ivs_queue` + TTL Index MongoDB | 30 phút |
| Sửa `worker.py` phía Shopee Checker | 1 giờ |
| Tạo `ivs_listener.py` cho Outlook Tool | 2 giờ |
| Test E2E: IVS → Outlook → Cookie | 2 giờ |
| **Tổng** | **~5.5 giờ** |

---

## 2. P2 — BÓC TÁCH SỐ DƯ SHOPEE XU VÀ THÔNG TIN NICK

### 2.1. Mô Tả

Ngay sau khi tài khoản `LIVE` và có Cookie session, gọi API nội bộ Shopee để bóc:
- **Số dư Shopee Xu** (Coins balance)
- **Tên hiển thị** / **SĐT ẩn** (`+84 *** 628`)
- **Ngày tạo tài khoản**, **Level**, **Là seller không**

### 2.2. API Endpoint

```
GET https://shopee.vn/api/v4/account/basic
Headers:
  Cookie: [session cookies]
  x-csrftoken: [csrftoken]
  x-api-source: pc

Response:
{
  "data": {
    "shopid": 123456789,
    "username": "khaphanyq51",
    "phone": "+84 *** 628",
    "point": 1250,          ← Shopee Xu
    "level": 2,
    "ctime": 1620000000,
    "is_seller": false
  }
}
```

### 2.3. Implementation

**Thêm vào `checker_engine/shopee_api.py`:**

```python
def get_account_info_sync(email, cookies, headers, timeout=10) -> dict:
    csrf = cookies.get("csrftoken", "")
    try:
        resp = cffi_requests.get(
            "https://shopee.vn/api/v4/account/basic",
            headers={**headers, "x-csrftoken": csrf, "x-api-source": "pc"},
            cookies=cookies,
            impersonate="chrome120",
            timeout=timeout
        )
        d = resp.json().get("data", {})
        return {
            "shopid": d.get("shopid"),
            "display_name": d.get("name") or d.get("username"),
            "phone_masked": d.get("phone", ""),
            "xu_balance": d.get("point", 0),
            "account_level": d.get("level", 0),
            "is_seller": d.get("is_seller", False),
            "account_created_at": d.get("ctime")
        }
    except Exception:
        return {}
```

**Sau khi LIVE trong `worker.py`:**

```python
if result.status == AccountStatus.LIVE and result.cookies:
    info = await asyncio.to_thread(
        get_account_info_sync, email, result.cookies, headers)
    doc.update(info)
```

### 2.4. Hiển Thị Trên Dashboard

| Cột mới | Ví dụ |
| :--- | :--- |
| Shopee Xu | 🪙 **1,250 Xu** |
| Số ĐT | 📱 `+84 *** 628` |
| Level | ⭐ Level 2 |
| Seller? | 🏪 Có / 🛒 Không |
| Ngày tạo | 📅 2021-05-03 |

### 2.5. Files Cần Tạo / Sửa

| File | Hành động |
| :--- | :---: |
| `checker_engine/shopee_api.py` | ✏️ Thêm `get_account_info_sync()` |
| `checker_engine/worker.py` | ✏️ Gọi sau khi LIVE |
| `api_backend/models.py` | ✏️ Thêm fields mới |
| `checker_engine/excel_handler.py` | ✏️ Thêm cột Xu vào Excel export |
| `web_dashboard/AccountTable.tsx` | ✏️ Thêm cột Xu + Level |

**Ước tính: ~2 giờ**

---

## 3. P3 — AUTO HEADER POOL REFRESHER

### 3.1. Vấn Đề

Header `x-sap-sec` và `af-ac-enc-sz-token` được Shopee sinh phía client bởi SDK
chống bot `sz.js`. Hiện phải copy tay từ F12 DevTools. Header hết hạn sau **2–6 giờ**
→ `error: 1` tăng đột biến.

**Không thể reverse engineer** thuật toán SDK → dùng Playwright bắt (intercept)
network request thật từ browser headless.

### 3.2. Kiến Trúc

```
playwright_header_refresher.py
│
├── Mở Chromium headless → shopee.vn/buyer/login
├── Intercept POST request đến /api/v4/account/
│   └── Bắt headers: x-sap-sec, af-ac-enc-sz-token, af-ac-enc-dat
├── Bắt cookies: SPC_F, csrftoken, shopee_webUnique_ccd
└── Ghi vào data/header_pool.json (append + dedup)
```

### 3.3. Implementation

**File mới:** `checker_engine/header_refresher.py`

```python
class HeaderRefresher:
    async def capture_one_session(self, label: str = None) -> dict:
        """
        Mở shopee.vn login → nhập dummy account → trigger API call
        → intercept headers bảo mật → ghi vào header_pool.json
        """
        intercepted = {}
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                user_agent="Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            async def on_request(request):
                if "/api/v4/account/" in request.url and request.method == "POST":
                    hdrs = dict(request.headers)
                    if "x-sap-sec" in hdrs:
                        intercepted.update(hdrs)
                        cookies = await context.cookies()
                        intercepted["_cookies"] = {c["name"]: c["value"] for c in cookies}

            page.on("request", on_request)
            await page.goto("https://shopee.vn/buyer/login")
            await page.wait_for_timeout(2000)

            # Trigger: nhập dummy → click login → SDK sinh header
            await page.fill('input[name="loginKey"]', "trigger@test.com")
            await page.fill('input[type="password"]', "Trigger123!")
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)
            await browser.close()

        if not intercepted:
            return {}

        # Build header entry
        new_header = {
            "label": label or f"AutoRefresh_{int(time.time())}",
            "is_active": True,
            "x_sap_sec": intercepted.get("x-sap-sec", ""),
            "af_ac_enc_sz_token": intercepted.get("af-ac-enc-sz-token", ""),
            "af_ac_enc_dat": intercepted.get("af-ac-enc-dat", ""),
            "user_agent": intercepted.get("user-agent", ""),
            "x_csrftoken": intercepted.get("x-csrftoken", ""),
            "cookie_spc_f": intercepted["_cookies"].get("SPC_F", ""),
            "cookie_csrf_token": intercepted["_cookies"].get("csrftoken", ""),
            "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # Append vào pool (không xóa pool cũ, dedup theo x_sap_sec)
        pool = json.loads(self.pool_path.read_text(encoding="utf-8")) if self.pool_path.exists() else []
        pool = [h for h in pool if h.get("x_sap_sec") != new_header["x_sap_sec"]]
        pool.append(new_header)
        self.pool_path.write_text(json.dumps(pool, ensure_ascii=False, indent=2), encoding="utf-8")
        return new_header

    async def auto_refresh_loop(self, interval_hours: float = 2.0):
        """Tự động refresh mỗi N giờ."""
        while True:
            await self.capture_one_session()
            await asyncio.sleep(interval_hours * 3600)
```

**API Endpoint FastAPI mới:**

```python
# api_backend/routers/admin.py
@router.post("/api/admin/refresh-headers")
async def refresh_header_pool():
    refresher = HeaderRefresher()
    result = await refresher.capture_one_session(label="WebDashboard_Manual")
    if result:
        return {"status": "ok", "captured_at": result["captured_at"]}
    raise HTTPException(status_code=500, detail="Không bắt được header từ Shopee")
```

### 3.4. Files Cần Tạo / Sửa

| File | Hành động |
| :--- | :---: |
| `checker_engine/header_refresher.py` | ➕ Mới |
| `api_backend/routers/admin.py` | ➕ Mới |
| `api_backend/main.py` | ✏️ Include admin router |
| `web_dashboard/HeaderPoolPanel.tsx` | ➕ Mới — nút Refresh |

**Phụ thuộc thêm:** `pip install playwright && playwright install chromium`

**Ước tính: ~3 giờ**

---

## 4. P4 — TÍCH HỢP PROXY API XOAY IP TỰ ĐỘNG

### 4.1. Vấn Đề

Check >500 tài khoản/ngày trên 1 IP public → Shopee áp `error: 1` / `HTTP 429`
/ block IP tạm thời 10–30 phút.

### 4.2. Nhà Cung Cấp Proxy Việt Nam

| Nhà cung cấp | API Xoay IP | Loại |
| :--- | :--- | :--- |
| **TMProxy** | `GET http://api.tmproxy.com/api/changeip?token=XXX` | Residential VN |
| **ShopLike** | REST API | Mobile 4G |
| **WWProxy** | `GET http://proxy.wwproxy.com/changeip?token=XXX` | ISP |
| **Dcom Hilink** | ADB Airplane Mode script | USB 4G |

### 4.3. Nâng Cấp `checker_engine/proxy_manager.py`

```python
class ProxyManager:
    PROVIDER_API = {
        "tmproxy":  "http://api.tmproxy.com/api/changeip?token={api_key}",
        "shoplike": "http://api.shoplike.vn/change?token={api_key}",
        "wwproxy":  "http://proxy.wwproxy.com/changeip?token={api_key}"
    }

    def __init__(self, ..., rotate_provider=None, rotate_api_key=None,
                 rotate_after_n_requests=50):
        self.rotate_provider = rotate_provider
        self.rotate_api_key  = rotate_api_key
        self.rotate_after_n  = rotate_after_n_requests
        self._request_count  = 0

    async def maybe_rotate_ip(self):
        """Gọi sau mỗi request — tự xoay khi đạt ngưỡng."""
        self._request_count += 1
        if self._request_count % self.rotate_after_n == 0:
            await self._call_rotate_api()

    async def force_rotate_on_error(self):
        """Gọi ngay khi phát hiện error:1 hoặc HTTP 429."""
        logger.warning("[Proxy] Phát hiện block → xoay IP ngay!")
        await self._call_rotate_api()
        await asyncio.sleep(5)

    async def _call_rotate_api(self):
        url = self.PROVIDER_API[self.rotate_provider].format(api_key=self.rotate_api_key)
        cffi_requests.get(url, timeout=5)
```

### 4.4. UI Cấu Hình Proxy (Dashboard)

```
Nhà cung cấp Proxy: [Dropdown: Direct / File / TMProxy / ShopLike / WWProxy]
API Key:            [Password input — chỉ hiện khi chọn API provider]
Xoay sau N request: [Number input — mặc định: 50]
```

**Ước tính: ~1.5 giờ**

---

## 5. P5 — CENTRAL MMO DASHBOARD

### 5.1. Tầm Nhìn

Thay vì 3 tool độc lập, xây **1 Web Dashboard trung tâm** giám sát và điều khiển
toàn bộ ecosystem từ bất kỳ đâu (điện thoại, iPad, VPS remote).

### 5.2. Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────┐
│               CENTRAL MMO DASHBOARD (Next.js 14)         │
│  Tab 1: Shopee   Tab 2: Outlook   Tab 3: TikTok   Tab 4: Health │
└────────────────────────┬─────────────────────────────────┘
                         │ REST API + WebSocket
┌────────────────────────▼─────────────────────────────────┐
│           CENTRAL API GATEWAY (FastAPI, Port 8000)        │
│   /api/shopee/*     /api/outlook/*     /api/tiktok/*      │
└──────────┬────────────────┬──────────────────┬───────────┘
           │                │                  │
  shopee_checker    outlook_tool         tiktok_tool
  (Python)          (Python)             (Python + ADB)
           │                │                  │
           └────────────────┼──────────────────┘
                            │
                 MongoDB:27017 + Redis:6379
```

### 5.3. Nội Dung Từng Tab

#### Tab 1: Shopee Account Manager
- Hiện tại đã có (Sprint 0–4) ✅
- Bổ sung: cột Xu, badge IVS Verified, bulk export nâng cao

#### Tab 2: Outlook Mail & Session Manager
- Danh sách tài khoản Outlook từ `outlook_db.accounts`
- Status Session: 🟢 Active / 🔴 Hết hạn / 🟡 Chưa đăng nhập
- Nút **"Đăng nhập lại từ xa"** trigger Playwright headless
- Bảng OTP TikTok mới nhất từ `TikTokTool.otps`

#### Tab 3: TikTok Farm Monitor
- Danh sách thiết bị ADB đang kết nối
- Trạng thái từng tài khoản TikTok
- Nút Khởi chạy / Dừng / Reset

#### Tab 4: System Health
- Ping: MongoDB ✅ / Redis ✅ / Internet ✅
- Counter ngày hôm nay: LIVE / Die / IVS / Error
- Biểu đồ tốc độ check theo giờ (Recharts)
- Cảnh báo khi header pool cần refresh

### 5.4. API Gateway Pattern

```python
# central_api/main.py
app.include_router(shopee_jobs.router,      prefix="/api/shopee")
app.include_router(outlook_accounts.router, prefix="/api/outlook")
app.include_router(tiktok_devices.router,   prefix="/api/tiktok")
```

**Ước tính: ~15 giờ (dự án lớn — nên chia thành nhiều sprint)**

---

## 📊 MA TRẬN ƯU TIÊN & LỘ TRÌNH SPRINT

| # | Tính Năng | Giá Trị | Độ Phức Tạp | Thời Gian | Ưu Tiên |
| :---: | :--- | :---: | :---: | :---: | :---: |
| P4 | Proxy API Xoay IP | ⭐⭐⭐ | Thấp | ~1.5h | 🟢 Nên làm trước |
| P2 | Bóc Shopee Xu & Thông Tin | ⭐⭐⭐⭐ | Thấp | ~2h | 🟡 Trung bình |
| P3 | Auto Header Refresher | ⭐⭐⭐⭐ | Trung bình | ~3h | 🟡 Trung bình |
| P1 | Auto IVS → Cookie đầy đủ | ⭐⭐⭐⭐⭐ | Cao | ~5.5h | 🔴 Cao nhất |
| P5 | Central MMO Dashboard | ⭐⭐⭐⭐⭐ | Rất cao | ~15h | 🔵 Dài hạn |

### 🎯 Thứ Tự Sprint Đề Xuất

```
Sprint 5 (tuần này):   P4 — Proxy xoay IP      → Check số lượng lớn ổn định ngay
Sprint 6 (tuần sau):   P2 — Bóc Xu & thông tin → Tăng giá trị dữ liệu đầu ra
Sprint 7:              P3 — Auto Header Refresh → Loại bỏ thủ công hoàn toàn
Sprint 8:              P1 — Auto IVS Outlook    → Cần P3 + Outlook Tool hoàn chỉnh
Sprint 9+:             P5 — Central Dashboard   → Tầm nhìn dài hạn
```

---

*Tài liệu này là kế hoạch phát triển roadmap kỹ thuật.*
*Cần review và xác nhận trước mỗi sprint triển khai.*
