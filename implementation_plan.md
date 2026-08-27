# Kế Hoạch: Đưa Toàn Bộ Tài Khoản Vào MongoDB (End-to-End Tự Động)

## Mục Tiêu

Thay thế quản lý tài khoản rải rác trên nhiều Google Sheet bằng một nguồn dữ liệu duy nhất trên MongoDB — tự động chạy hoàn toàn, không cần người ngồi canh.

## Tổng Quan Luồng Dữ Liệu

```
Google Drive (nhiều Sheet lẻ)
       ↓  [GAS: findOldShopeeAccountSheets → auto-resume trigger]
FOUND_SHOPEE_SHEETS (danh sách file)
       ↓  [GAS: importDiscoveredSheetsToArms → auto-resume trigger]
POST /api/integrations/google-sheets/sync (NestJS API)
       ↓  [BullMQ queue job]
ScanProcessor Worker (parse + deduplicate + encrypt)
       ↓  [bulkWrite upsert by username_normalized]
MongoDB Collection: accounts (nguồn dữ liệu tập trung)
       ↓  [callback POST → Google Sheet Web App]
Sheet gốc (cập nhật cột Trạng thái: LIVE/DIE)
```

---

## Phân Tích Hiện Trạng

### ✅ Đã có sẵn (không cần làm lại)
- `POST /api/integrations/google-sheets/sync` — nhận dữ liệu từ GAS
- `ScanProcessor` — parse Excel, encrypt, bulkWrite upsert MongoDB
- `AccountSchema` — schema đầy đủ với `username_normalized` unique index
- `AccountsService` — findAll, markSold, markUsed, blacklist
- `doPost()` trong GAS — callback receiver cập nhật màu LIVE/DIE

### ❌ Vấn đề cốt lõi (cần fix)
1. **GAS timeout 6 phút** — hàm dừng giữa chừng, phải click lại tay
2. **Tunnel chết** — API URL hỏng, GAS không gọi được backend
3. **Backend không auto-start** — API/Worker chết khi máy restart

---

## Phase 1: Fix Google Apps Script — Trigger Tự Động Resume

> **File cần sửa:** `d:\sontayweb\toolMMO\apps-script\Code.gs`

### 1A. Thêm Engine Quản Lý Trigger (code mới hoàn toàn)

Thêm vào cuối file `Code.gs`:

```javascript
// ================================================================
//   ARMS AUTO-RESUME ENGINE
//   Giải quyết giới hạn 6 phút của Google Apps Script
//   Pattern: Checkpoint → Lưu token → Tạo one-shot trigger → Return
// ================================================================

/**
 * Lên lịch trigger one-shot để tự gọi lại hàm sau 70 giây.
 * Tự xóa trigger cũ cùng tên trước khi tạo mới (tránh tích lũy 20 trigger).
 */
function scheduleResume_(handlerName) {
  // Xóa trigger cũ cùng tên
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Tạo one-shot trigger sau 70 giây
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(70 * 1000)
    .create();
}

/**
 * Hủy tất cả trigger của một hàm (gọi khi job hoàn thành).
 */
function cancelResume_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function setAutoState_(key, value) {
  PropertiesService.getScriptProperties().setProperty(
    'AUTO_' + key, JSON.stringify(value)
  );
}

function getAutoState_(key) {
  const v = PropertiesService.getScriptProperties().getProperty('AUTO_' + key);
  return v ? JSON.parse(v) : null;
}

function clearAutoState_(key) {
  PropertiesService.getScriptProperties().deleteProperty('AUTO_' + key);
}
```

### 1B. Sửa `onOpen()` — Thêm menu tự động hóa

```javascript
// Thay thế hàm onOpen() hiện tại
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ARMS')
    .addItem('1. Đồng bộ Tab hiện tại (Sync Current)', 'syncCurrentTab')
    .addItem('2. Đồng bộ Tất cả các Tab (Sync All)', 'syncAllTabs')
    .addSeparator()
    .addItem('3. Gom tài khoản các Sheet con chung Thư mục', 'aggregateFolderSheetsAutomatically')
    .addItem('4. Quét Tìm Sheet tài khoản Shopee cũ trên Drive', 'findOldShopeeAccountSheets')
    .addItem('5. Nhập kho tài khoản từ các Sheet đã tìm được', 'importDiscoveredSheetsToArms')
    .addItem('6. Trích xuất tài khoản chi tiết ra trang tính hiện tại', 'extractAccountsToMasterSheet')
    .addSeparator()
    .addItem('🚀 [AUTO] Chạy Toàn Bộ Pipeline (4→5→6)', 'runFullPipeline')
    .addSeparator()
    .addItem('⚡ Kiểm tra kết nối API (Test Connection)', 'testConnection')
    .addItem(' Cấu hình thông tin kết nối (Setup Wizard)', 'runSetupWizard')
    .addToUi();
}
```

### 1C. Thêm hàm `runFullPipeline()` — Chạy 1 lần, tự hoàn thành toàn bộ

```javascript
/**
 * PIPELINE ĐẦY ĐỦ: Quét Drive → Nhập kho → Bóc tách
 * Người dùng chỉ cần click 1 lần, hệ thống tự hoàn thành.
 */
function runFullPipeline() {
  const ui = SpreadsheetApp.getUi();
  const state = getAutoState_('PIPELINE');
  
  // Nếu đang chạy dở, hỏi có muốn reset không
  if (state) {
    const resp = ui.alert(
      'PIPELINE ĐANG CHẠY',
      'Phát hiện pipeline đang chạy dở ở bước: ' + state.step + '\n\n' +
      '• YES: Tiếp tục từ chỗ dừng\n' +
      '• NO: Hủy và bắt đầu lại từ đầu',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) {
      clearAutoState_('PIPELINE');
      PropertiesService.getScriptProperties().deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
      PropertiesService.getScriptProperties().deleteProperty('ARMS_IMPORT_LAST_ROW');
      cancelResume_('resumePipeline');
    }
  }
  
  // Khởi động
  setAutoState_('PIPELINE', { step: 'SCAN_DRIVE', startedAt: new Date().toISOString() });
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Pipeline khởi động! Hệ thống sẽ tự chạy đến khi hoàn thành.',
    'ARMS AutoPipeline', 5
  );
  
  // Bắt đầu bước 1
  resumePipeline();
}

/**
 * Hàm resume được trigger gọi tự động.
 * Đọc trạng thái và tiếp tục từ bước đang dở.
 */
function resumePipeline() {
  const state = getAutoState_('PIPELINE');
  if (!state) return; // Không có pipeline đang chạy
  
  switch (state.step) {
    case 'SCAN_DRIVE':
      runPipelineStep_ScanDrive_();
      break;
    case 'IMPORT':
      runPipelineStep_Import_();
      break;
    case 'EXTRACT':
      runPipelineStep_Extract_();
      break;
    case 'DONE':
      cancelResume_('resumePipeline');
      clearAutoState_('PIPELINE');
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '🎉 Pipeline hoàn tất! Toàn bộ tài khoản đã về MongoDB.',
        'ARMS Done', 10
      );
      break;
  }
}
```

### 1D. Sửa `findOldShopeeAccountSheets()` — Tích hợp auto-resume

Thay thế phần cuối của hàm (sau khi scan xong) với logic checkpoint:

```javascript
// Thêm vào ĐẦU hàm findOldShopeeAccountSheets():
const SAFE_LIMIT_MS = 300000; // 5 phút (buffer 1 phút)

// Thay vì maxAllowedTimeMs = 270000 hiện tại, dùng 300000
// Thay vì ui.alert() khi hasMore, dùng:
if (hasMore) {
  const nextToken = files.getContinuationToken();
  props.setProperty('DRIVE_SCAN_CONTINUATION_TOKEN', nextToken);
  scheduleResume_('resumePipeline'); // ← tự gọi lại sau 70s
  activeSs.toast('Tạm dừng, tự tiếp tục sau 70 giây...', 'ARMS Auto', 5);
  return; // BẮT BUỘC return ngay
}
// Khi không còn hasMore:
props.deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
// Chuyển sang bước tiếp theo của pipeline
const pipelineState = getAutoState_('PIPELINE');
if (pipelineState) {
  setAutoState_('PIPELINE', { ...pipelineState, step: 'IMPORT' });
  scheduleResume_('resumePipeline');
}
```

### 1E. Sửa `importDiscoveredSheetsToArms()` — Lưu progress theo rowIndex

```javascript
// Thêm vào ĐẦU hàm importDiscoveredSheetsToArms():
// Đọc lastRow đã xử lý từ lần trước (nếu có)
const lastProcessedRow = parseInt(
  PropertiesService.getScriptProperties().getProperty('ARMS_IMPORT_LAST_ROW') || '0'
);

// Chỉ xử lý các pendingRows từ lastProcessedRow trở đi
// (thay vì lọc theo status "Đã nhập" như hiện tại)

// Thêm CHECKPOINT trong vòng lặp file:
if (new Date().getTime() - startTime > SAFE_LIMIT_MS) {
  PropertiesService.getScriptProperties().setProperty(
    'ARMS_IMPORT_LAST_ROW', String(currentRowIndex)
  );
  scheduleResume_('resumePipeline');
  activeSs.toast('Tạm dừng import, tự tiếp tục sau 70 giây...', 'ARMS Auto', 5);
  return;
}

// Khi hoàn thành:
PropertiesService.getScriptProperties().deleteProperty('ARMS_IMPORT_LAST_ROW');
const pipelineState = getAutoState_('PIPELINE');
if (pipelineState) {
  setAutoState_('PIPELINE', { ...pipelineState, step: 'DONE' });
  scheduleResume_('resumePipeline');
}
```

---

## Phase 2: Ổn Định Backend

> **Files cần thay đổi:** `docker-compose.yml`, tạo `ecosystem.config.js`

### 2A. Sửa `docker-compose.yml`

```yaml
# Thêm "restart: unless-stopped" cho cả 2 service
version: '3.8'
services:
  mongo:
    restart: unless-stopped   # ← THÊM
    ...
  redis:
    restart: unless-stopped   # ← THÊM
    ...
```

### 2B. Tạo `ecosystem.config.js`

```javascript
// Tạo file: d:\sontayweb\toolMMO\ecosystem.config.js
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
      restart_delay: 3000
    }
  ]
};
```

---

## Phase 3: Giải Quyết Tunnel — Script Tự Cập Nhật URL

Vì không có domain riêng, tạo script PowerShell tự khởi động tunnel và cập nhật URL vào GAS:

### 3A. Script `start-tunnel.ps1`

```powershell
# Tạo: d:\sontayweb\toolMMO\start-tunnel.ps1
# Khởi động localhost.run, lấy URL, cập nhật vào file .env.tunnel

while ($true) {
    Write-Host "[TUNNEL] Khởi động tunnel..."
    
    # Dùng localhost.run (không cần cài gì, dùng SSH có sẵn)
    $proc = Start-Process ssh -ArgumentList "-R 80:localhost:4000 nokey@localhost.run" `
        -RedirectStandardOutput "$PSScriptRoot\.tunnel-url.txt" `
        -PassThru -NoNewWindow
    
    Start-Sleep -Seconds 5
    
    # Đọc URL từ output
    $url = Get-Content "$PSScriptRoot\.tunnel-url.txt" | 
        Select-String "https://.*\.localhost\.run" | 
        ForEach-Object { $_.Matches[0].Value }
    
    if ($url) {
        Write-Host "[TUNNEL] URL mới: $url"
        # Lưu URL vào file để GAS có thể đọc qua endpoint
        Set-Content -Path "$PSScriptRoot\.current-tunnel-url" -Value $url
    }
    
    # Chờ cho đến khi tunnel chết
    $proc | Wait-Process
    Write-Host "[TUNNEL] Tunnel ngắt! Khởi động lại sau 10 giây..."
    Start-Sleep -Seconds 10
}
```

### 3B. Thêm endpoint `/api/tunnel-url` vào NestJS (optional)

Để GAS tự đọc URL mới khi tunnel restart mà không cần người cập nhật thủ công.

---

## Phase 4: Kế Hoạch Thực Thi Theo Thứ Tự

### Bước 1 — Khởi động Infrastructure (5 phút)
```powershell
cd d:\sontayweb\toolMMO
docker-compose up -d
# Kiểm tra: docker ps → mongodb + redis running
```

### Bước 2 — Build + Start Backend (10 phút)
```powershell
cd apps/api && npm run build && cd ../..
cd apps/worker && npm run build && cd ../..

npm install -g pm2 pm2-windows-service
pm2 start ecosystem.config.js
pm2 save
# Chạy PowerShell với quyền Admin:
pm2-service-install
```

### Bước 3 — Khởi động Tunnel (2 phút)
```powershell
# Cửa sổ PowerShell riêng (giữ mở):
ssh -R 80:localhost:4000 nokey@localhost.run
# Lấy URL hiển thị → copy
```

### Bước 4 — Cấu hình Google Sheet (3 phút)
```
ARMS → Setup Wizard → Nhập URL tunnel mới
ARMS → Kiểm tra kết nối API → Phải thấy "Thành công"
```

### Bước 5 — Code GAS (30 phút)
Thêm code theo Phase 1 ở trên vào Code.gs, Save (Ctrl+S)

### Bước 6 — Chạy Pipeline (click 1 lần)
```
ARMS → 🚀 [AUTO] Chạy Toàn Bộ Pipeline (4→5→6)
→ Đóng Sheet, làm việc khác
→ Sau vài giờ mở lại kiểm tra MongoDB
```

---

## Kết Quả Mong Đợi Sau Triển Khai

```
MongoDB collection: accounts
{
  username: "shopeevn123",
  username_normalized: "shopeevn123",
  email: "abc@gmail.com",
  status: "AVAILABLE",        ← Có thể filter: AVAILABLE / SOLD / USED
  quality: {
    has_cookie: true,
    has_email: true
  },
  metadata: {
    source_file: "Shopee xu 286",
    source_sheet: "8/5/2026",
    managed_by: "Admin Sơn Tây",
    last_scan_at: "2026-08-24T..."
  },
  password_enc: "...",        ← Mã hóa AES-256
  cookie_enc: "...",          ← Mã hóa AES-256
  email_password_enc: "..."   ← Mã hóa AES-256
}

→ Tổng: hàng chục nghìn tài khoản, không trùng lặp,
  có thể query theo bất kỳ tiêu chí nào,
  bảo mật hơn sheet rất nhiều.
```

---

## Open Questions

> [!IMPORTANT]
> **Bạn có muốn tôi code và deploy ngay không?**  
> Nếu có, tôi sẽ thực hiện theo thứ tự:
> 1. Sửa `Code.gs` (thêm auto-resume engine + pipeline)
> 2. Sửa `docker-compose.yml` (thêm restart policy)
> 3. Tạo `ecosystem.config.js` (PM2 config)
> 4. Chạy build + start infrastructure

> [!WARNING]
> **Về Tunnel:** Nếu bạn không có domain riêng, mỗi khi tunnel restart, cần cập nhật URL trong Setup Wizard. Đây là điểm duy nhất vẫn cần thao tác thủ công. Có muốn tôi tự động hóa luôn bước này không?
