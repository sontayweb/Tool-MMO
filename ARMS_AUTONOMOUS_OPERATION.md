# ARMS — Lộ Trình Tự Động Hóa End-to-End
> Đã xác minh từ: Reddit, Google Developers, StackOverflow, Cloudflare Docs, PM2 Docs | 2026-08-24

---

## 🔴 SỰ THẬT TỪ NGHIÊN CỨU — Những Điều Cần Biết Trước Khi Làm

### Google Apps Script — Giới Hạn Thực Tế (2026)

| Giới hạn | Tài khoản Gmail (free) | Google Workspace |
|---|---|---|
| **Thời gian tối đa/lần chạy** | **6 phút** (cứng, không thể vượt) | **6 phút** (cứng) |
| **Tổng runtime trigger/ngày** | **90 phút** | **6 giờ** |
| **Số trigger tối đa/script** | **20 trigger** | **20 trigger** |
| **Script chạy đồng thời** | 30 | 30 |

> ⚠️ **Hàm ý quan trọng:** Nếu bạn dùng tài khoản Gmail thông thường, trigger 5 phút × 18 lần = 90 phút/ngày. Tức là hệ thống chỉ tự chạy được **tối đa 18 lần mỗi ngày**. Đủ cho hầu hết tác vụ bình thường.

---

### Tunnel — So Sánh Thực Tế Tất Cả Options

| Tool | URL Cố Định? | Miễn Phí? | Timeout | Kết Luận |
|---|---|---|---|---|
| **Serveo** (đang dùng) | ❌ Có thể random | ✅ | Thường ngắt | Không ổn định |
| **Localtunnel** | ❌ Random | ✅ | Thỉnh thoảng ngắt | Chỉ test |
| **Cloudflare TryCloudflare** | ❌ Random (đổi khi restart) | ✅ | Không timeout | Tốt hơn nhưng URL đổi |
| **Cloudflare Named Tunnel** | ✅ Cố định | ✅ (cần domain) | Không timeout | **TỐT NHẤT** |
| **Pinggy Free** | ❌ Random | ✅ | **60 phút** rồi die | Tệ hơn cả |
| **Ngrok Free** | ❌ Random | ✅ | Không timeout | Ổn |
| **localhost.run** | ❌ Random | ✅ | Không timeout | Ổn, dùng SSH |

> **Kết luận tunnel:** Chỉ có **Cloudflare Named Tunnel** (có domain riêng) là giải pháp duy nhất FREE + URL cố định + không timeout.

---

### Docker Desktop trên Windows — Hạn Chế Thực Tế

> ⚠️ Docker Desktop là công cụ **development**, KHÔNG phải production. Nó chỉ khởi động khi user đăng nhập Windows. **Nếu máy restart không có ai đăng nhập, Docker không khởi động được.**

**Giải pháp thực tế cho Windows:**
- `restart: unless-stopped` trong docker-compose → container tự restart khi Docker running
- Docker Desktop → Settings → "Start Docker Desktop when you log in" → Cần user login
- Hoặc: **Dùng WSL2 + Docker Engine** (chạy như system service, không cần login)

---

## ✅ KIẾN TRÚC ĐÚNG ĐẮN — Đã Xác Minh Từ Các Nguồn

### Pattern Được Google Khuyến Nghị Chính Thức Cho GAS

```
Lần chạy 1 (click thủ công):
  → setPendingJob() lưu trạng thái vào PropertiesService
  → Xử lý batch đầu tiên (5.5 phút)
  → ScriptApp.newTrigger('myFunc').timeBased().after(60000).create()
  → return; ← PHẢI thoát, không chạy tiếp

60 giây sau, trigger tự gọi:
  → Đọc PropertiesService, lấy cursor từ chỗ dừng
  → Xử lý batch tiếp theo
  → Nếu chưa xong: tạo trigger mới, return
  → Nếu xong: xóa PropertiesService, KHÔNG tạo trigger mới
```

### ⚠️ Lỗi Quan Trọng Cần Tránh

1. **Không xóa trigger cũ trước khi tạo mới** → Tích lũy đến 20 trigger → Script bị block
2. **Tạo trigger everyMinutes(5) thường trực** → Lãng phí 90 phút quota/ngày ngay cả khi không có việc
3. **Dùng `after()` thay vì `everyMinutes()`** → Trigger chỉ fire 1 lần khi cần, tiết kiệm quota

---

## 📋 KẾ HOẠCH TRIỂN KHAI — 4 BƯỚC THEO THỨ TỰ ƯU TIÊN

---

### BƯỚC 1: Fix GAS (Quan trọng nhất, làm ngay)

**Thêm code vào Code.gs — Pattern chuẩn từ Google:**

```javascript
// ============================================================
// QUẢN LÝ TRIGGER TỰ ĐỘNG - PATTERN CHÍNH THỨC CỦA GOOGLE
// ============================================================

/**
 * Tạo 1 trigger one-shot sau 60 giây để tiếp tục job.
 * Tự động xóa trigger cũ cùng tên trước khi tạo mới.
 */
function scheduleResume_(handlerName) {
  // Xóa trigger cũ để tránh tích lũy (giới hạn 20 trigger/script)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Tạo trigger one-shot sau 60 giây
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(60 * 1000) // 60 giây
    .create();
    
  console.log('Trigger tiếp tục đã được lên lịch sau 60 giây: ' + handlerName);
}

/**
 * Xóa tất cả trigger của một hàm (gọi khi job hoàn thành).
 */
function cancelResume_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

// ============================================================
// TRẠNG THÁI JOB - LƯU/ĐỌC/XÓA
// ============================================================

function saveJobState_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value));
}

function loadJobState_(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  return val ? JSON.parse(val) : null;
}

function clearJobState_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}
```

**Sửa `findOldShopeeAccountSheets` để tự động resume (phần quan trọng nhất):**

```javascript
function findOldShopeeAccountSheets() {
  const startTime = new Date().getTime();
  const SAFE_LIMIT_MS = 300000; // 5 phút (giữ 1 phút buffer)
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  
  // Đọc trạng thái cũ (nếu có - được gọi bởi trigger resume)
  const savedToken = props.getProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
  const isAutoResume = !!savedToken && props.getProperty('DRIVE_SCAN_AUTO_MODE') === 'true';
  
  // Nếu là lần chạy đầu (thủ công), hỏi chế độ và reset
  if (!isAutoResume) {
    // ... [code hỏi người dùng chọn fast/detail như cũ] ...
    props.setProperty('DRIVE_SCAN_AUTO_MODE', 'true'); // Bật chế độ auto resume
  }
  
  // Lấy iterator (mới hoặc tiếp tục)
  let files;
  if (savedToken) {
    files = DriveApp.continueFileIterator(savedToken);
  } else {
    files = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and fullText contains 'SPC_F='");
  }
  
  let count = 0;
  while (files.hasNext()) {
    // ⭐ CHECKPOINT: Kiểm tra thời gian còn lại
    if (new Date().getTime() - startTime > SAFE_LIMIT_MS) {
      // Lưu token và lên lịch chạy tiếp
      props.setProperty('DRIVE_SCAN_CONTINUATION_TOKEN', files.getContinuationToken());
      scheduleResume_('findOldShopeeAccountSheets'); // Tự gọi lại sau 60 giây
      activeSs.toast('Tạm dừng để tránh timeout. Tự tiếp tục sau 60 giây...', 'ARMS Auto', 5);
      return; // BẮT BUỘC phải return để thoát
    }
    
    const file = files.next();
    // ... [xử lý file như cũ] ...
    count++;
  }
  
  // Hoàn thành - dọn dẹp
  props.deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
  props.deleteProperty('DRIVE_SCAN_AUTO_MODE');
  cancelResume_('findOldShopeeAccountSheets');
  activeSs.toast('Quét Drive hoàn tất tự động!', 'ARMS Done', 5);
}
```

**Tương tự áp dụng cho `importDiscoveredSheetsToArms` và `extractAccountsToMasterSheet`.**

---

### BƯỚC 2: Fix Tunnel (Ưu tiên cao)

#### Option A: Bạn có domain riêng → Cloudflare Named Tunnel (KHUYẾN NGHỊ)

```powershell
# Tải cloudflared
# Vào: https://github.com/cloudflare/cloudflared/releases/latest
# Tải: cloudflared-windows-amd64.msi → Cài đặt

# Đăng nhập (mở trình duyệt)
cloudflared tunnel login

# Tạo tunnel tên cố định
cloudflared tunnel create arms-production

# Gán subdomain (ví dụ: api.yourdomain.com → localhost:4000)
cloudflared tunnel route dns arms-production api.yourdomain.com

# Tạo config file: C:\Users\HOANGHIEP\.cloudflared\config.yml
```

```yaml
# C:\Users\HOANGHIEP\.cloudflared\config.yml
tunnel: arms-production
credentials-file: C:\Users\HOANGHIEP\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

```powershell
# Chạy tunnel (cố định, không bao giờ đổi URL)
cloudflared tunnel run arms-production

# → Nhập URL https://api.yourdomain.com vào Google Sheet: ARMS → Setup Wizard
```

#### Option B: Không có domain → localhost.run (Miễn phí, dùng SSH, không cài gì)

```powershell
# Chạy 1 lệnh (cần OpenSSH đã có sẵn trên Windows 10/11)
ssh -R 80:localhost:4000 nokey@localhost.run

# Output: https://xxxxxxxxxx.localhost.run → Dùng URL này
# ⚠️ URL đổi khi restart terminal, nhưng KHÔNG timeout trong phiên chạy
```

#### Option C: Script tự động cập nhật URL vào Google Sheet khi tunnel restart

```javascript
// Thêm endpoint /api/health vào NestJS trả về thông tin tunnel hiện tại
// GAS Script: Mỗi sáng check endpoint để lấy URL mới
// → Tự động cập nhật ARMS_API_BASE_URL trong ScriptProperties
```

---

### BƯỚC 3: Ổn Định Backend (PM2 + Docker)

#### 3.1 Docker — Cấu hình đúng cho Windows

```yaml
# docker-compose.yml — Thêm restart policy
version: '3.8'
services:
  mongo:
    image: mongo:6.0
    container_name: arms-mongo
    restart: unless-stopped   # ← THÊM DÒNG NÀY
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    ...

  redis:
    image: redis:7.0-alpine
    container_name: arms-redis
    restart: unless-stopped   # ← THÊM DÒNG NÀY
    ports:
      - "6380:6379"
    ...
```

```powershell
# Docker Desktop → Settings → General
# ☑ Start Docker Desktop when you log in
# ☑ Start Docker Desktop on startup with WSL 2 (nếu dùng WSL2)

# Khởi động lại containers với policy mới
docker-compose down && docker-compose up -d
```

#### 3.2 PM2 — Chạy NestJS như Windows Service

```powershell
# Cài PM2 và Windows Service manager
npm install -g pm2
npm install -g pm2-windows-service

# Đặt biến môi trường cố định cho PM2 (quan trọng!)
# Chạy PowerShell với quyền Administrator:
[System.Environment]::SetEnvironmentVariable('PM2_HOME', 'C:\pm2', 'Machine')
# → Restart terminal sau lệnh này

mkdir C:\pm2
```

```javascript
// ecosystem.config.js — Tạo tại d:\sontayweb\toolMMO\
module.exports = {
  apps: [
    {
      name: 'arms-api',
      cwd: 'd:/sontayweb/toolMMO/apps/api',
      script: 'node',
      args: 'dist/main.js',
      watch: false,            // KHÔNG watch file trong production
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
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
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

```powershell
# Build production
cd d:\sontayweb\toolMMO\apps\api && npm run build
cd d:\sontayweb\toolMMO\apps\worker && npm run build
cd d:\sontayweb\toolMMO

# Start PM2
pm2 start ecosystem.config.js
pm2 save  # Lưu danh sách process

# Cài Windows Service (cần chạy PowerShell với quyền Admin)
pm2-service-install  # Trả lời YES khi hỏi

# Cài log rotation (tránh đầy disk)
pm2 install pm2-logrotate

# Kiểm tra
pm2 status
# → Cả 2 apps phải ở trạng thái "online"
```

---

### BƯỚC 4: Kiểm Tra End-to-End

```powershell
# Kiểm tra backend
Invoke-WebRequest -Uri "http://localhost:4000/api" -Method GET
# → Phải trả về response

# Kiểm tra MongoDB
docker exec arms-mongo mongosh --eval "db.runCommand({ping:1})"
# → {"ok": 1}

# Kiểm tra Redis
docker exec arms-redis redis-cli ping
# → PONG

# Kiểm tra PM2
pm2 status
# → arms-api: online | arms-worker: online
```

Trong Google Sheet:
1. ARMS → Kiểm tra kết nối API → Phải báo "Thành công"
2. Chạy Chức năng 4 (Quét Drive) → Thoát khỏi Sheet
3. Sau 60-90 giây → Mở lại Sheet → Thấy dữ liệu mới trong FOUND_SHOPEE_SHEETS

---

## ⚡ THỰC TẾ VỀ QUOTA — Lập Kế Hoạch Hợp Lý

### Tài khoản Gmail (miễn phí):

```
90 phút quota/ngày ÷ 6 phút/lần = 15 lần tối đa mỗi ngày

Tức là: 15 batch × ~1000 file/batch = ~15,000 file có thể quét/ngày
Với tốc độ đó: Quét toàn bộ Drive trong 2-3 ngày tự động hoàn toàn
```

### Tài khoản Google Workspace:

```
6 giờ quota/ngày ÷ 6 phút/lần = 60 lần tối đa mỗi ngày
→ Thực tế không bao giờ chạm giới hạn với workload bình thường
```

---

## 🗺️ SƠ ĐỒ LUỒNG CUỐI CÙNG (Sau Triển Khai)

```
NGƯỜI DÙNG:
  └─ Click "Quét Drive" (1 lần duy nhất)
       ↓
GAS LẦN 1 (0-5 phút):
  └─ Quét 50 file → HẾT GIỜ
  └─ Lưu token vào PropertiesService
  └─ ScriptApp.newTrigger().after(60s).create()
  └─ return ← thoát
       ↓ (60 giây tự động)
GAS LẦN 2 (trigger tự gọi):
  └─ Đọc token → Quét 50 file tiếp → HẾT GIỜ
  └─ Lưu token mới
  └─ Tạo trigger mới
  └─ return
       ↓ (60 giây tự động)
... LẶP LẠI ĐẾN KHI XONG ...
       ↓
GAS LẦN N (hoàn thành):
  └─ Xóa token
  └─ KHÔNG tạo trigger mới
  └─ Toast "Hoàn tất!"
       ↓
BACKEND (song song, tự động):
  └─ BullMQ nhận jobs từ GAS gọi API
  └─ Worker xử lý, ghi MongoDB
  └─ Callback về Google Sheet cập nhật LIVE/DIE
       ↓
KẾT QUẢ:
  └─ Sheet tự động có đầy đủ dữ liệu
  └─ KHÔNG CẦN NGƯỜI NGỒI CANH
```

---

## 📌 TÓM TẮT THỰC HÀNH — Thứ Tự Làm Ngay

| Thứ tự | Việc cần làm | Thời gian | Tác động |
|---|---|---|---|
| **1** | Thêm `scheduleResume_()` + sửa 3 hàm nặng trong Code.gs | 30 phút | Giải quyết hoàn toàn vấn đề 6 phút |
| **2** | Thêm `restart: unless-stopped` vào docker-compose.yml | 2 phút | Docker tự restart khi crash |
| **3** | Tạo `ecosystem.config.js` + cài PM2 service | 20 phút | API/Worker tự restart |
| **4** | Cài Cloudflare Tunnel (có domain) hoặc dùng localhost.run | 30 phút | Tunnel không còn die nữa |
| **5** | Test end-to-end: chạy rồi thoát, chờ kết quả | 10 phút | Xác nhận hệ thống tự hoàn thiện |

---

*Nguồn: appscript.dev, developers.google.com, cloudflare.com/docs, github.com/Unitech/pm2, stackoverflow.com*
