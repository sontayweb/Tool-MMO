# 📋 ARMS DWH v4.0 — Tài Liệu Nâng Cấp Toàn Diện
### Phiên bản: v3.1 → v4.0 (Market-Ready Enterprise Edition)
### Cập nhật: Phân tích sâu từ góc nhìn người dùng vận hành MMO thực tế

---

## 🧭 PHẦN 0: BẢN ĐỒ HÀNH TRÌNH NGƯỜI DÙNG (User Journey Map)

> Trước khi nâng cấp kỹ thuật, cần hiểu **người dùng thực sự làm gì hàng ngày**.

### 0.1 Chân Dung Người Dùng (User Personas)

| Persona | Vai trò | Việc họ làm hàng ngày | Nỗi đau lớn nhất |
|---------|---------|----------------------|-----------------|
| **Chủ kho (Owner)** | Tổng quản | Xem báo cáo, duyệt xuất kho, kiểm tra tồn | Không biết kho thực tế còn bao nhiêu nick SỐNG |
| **Quản lý (Manager)** | Trưởng nhóm | Phân công, xác nhận đơn bán, theo dõi team | Phải copy-paste thủ công giao nick cho khách |
| **Nhân viên kho (Member)** | Thủ kho | Import file từ Zalo, tra cứu, xuất file | Import sai format, không biết nick có bị trùng không |
| **Nhân viên bán hàng (Viewer)** | Bán hàng | Tra nick trước bán, báo giá khách | Phải hỏi kho qua chat → chậm, mất khách |
| **Tool Developer** | Tích hợp API | Viết tool Python/Node lấy nick tự động | Không có docs API → mò mẫm mất cả ngày |

### 0.2 Hành Trình Vận Hành Hàng Ngày (As-Is vs To-Be)

#### Quy trình NHẬP KHO hiện tại (AS-IS — nhiều bước thủ công):
```
Nhân viên lấy file từ Zalo/Drive
  → Mở trang web ARMS → Tab Nhập File
  → Upload file TXT/Excel
  → Xem trước (Preview)
  → Xác nhận bằng confirm() popup xấu
  → Chờ thông báo thành công
  → Xem lại kho để kiểm tra
  ⚠️ Vấn đề: Không biết nick vừa nhập còn sống không
```

#### Quy trình NHẬP KHO mong muốn (TO-BE):
```
Nhân viên upload file
  → Hệ thống tự Preview + kiểm tra trùng
  → Sau commit: Worker tự ping Live/Die check
  → Dashboard cập nhật real-time (WebSocket)
  → Thông báo Telegram: "Nhập thành công 500 nick, 480 LIVE 🟢"
  ✅ Tiết kiệm 15-20 phút/ngày/nhân viên
```

#### Quy trình BÁN HÀNG hiện tại (AS-IS — chậm và dễ sai):
```
Khách hỏi giá → Manager hỏi thủ kho
  → Thủ kho mở ARMS → Xem tab Overview
  → Trả lời số lượng (không biết còn SỐNG không)
  → Khách chốt → Manager chọn tay từng nick
  → Copy paste vào Zalo gửi khách
  ⚠️ Vấn đề: 10-15 phút/đơn, dễ bán nhầm nick đã SOLD/DEAD
```

#### Quy trình BÁN HÀNG mong muốn (TO-BE):
```
Khách hỏi → Manager mở ARMS
  → Click "Bán Nhanh": chọn số lượng + loại + khách
  → Hệ thống tự lấy nick AVAILABLE + LIVE
  → 1-click tạo file TXT + mark SOLD + ghi CRM
  ✅ < 2 phút/đơn, không bao giờ bán nhầm
```

---

## 🔍 PHẦN 1: ĐÁNH GIÁ HIỆN TRẠNG

### 1.1 Kiến Trúc Tổng Quan

```
Monorepo (npm workspaces)
├── apps/api       — NestJS + MongoDB + BullMQ (Port 4000)
├── apps/worker    — NestJS Worker (BullMQ Consumer)
├── apps/web       — Next.js 14 (CẢNH BÁO: page.tsx 2797 dòng)
└── packages/shared — Shared types
```

**Stack:** NestJS v10 · MongoDB Mongoose · BullMQ/Redis · JWT RBAC · Next.js 14 · TailwindCSS

### 1.2 Tính Năng Đã Có ✅

| Module | Tính năng | Đánh giá |
|--------|----------|----------|
| Auth | JWT + RBAC 4 roles | ✅ Tốt |
| Dashboard | KPI cards, Top buyers, Quality score | ⚠️ Thiếu chart & trend |
| Accounts DB | Filter 8 trường, pagination, bulk actions | ✅ Tốt |
| Import Offline | TXT/Excel preview + commit | ✅ Tốt |
| Quick Lookup | Paste list bulk check | ✅ Rất hữu ích |
| Export Center | TXT/Excel + mark-used | ✅ Tốt |
| Backup/Restore | Snapshot + 14 ngày retention | ✅ Tốt |
| API Keys | Service key + 3 scopes | ✅ Tốt |
| Team RBAC | Multi-team isolation | ✅ Nền tảng tốt |
| System Logs | Live terminal stream | ✅ Rất professional |
| Duplicate Scanner | Scan + auto-merge | ✅ Tốt |
| Bulk Actions | Sold/Used/Blacklist + Copy | ✅ Tốt |

### 1.3 Pain Points Phân Tích Sâu — Góc Nhìn Người Dùng Thực Tế

#### 🔴 NHÓM 1: Chặn người dùng hoàn thành công việc (Blocker)

**Pain #1 — Không biết nick vừa nhập còn sống không**
> Nhân viên import 500 nick, commit xong. Không biết cookie còn sống bao nhiêu.
> Chỉ biết khi khách báo "nick chết" — lúc đó đã ảnh hưởng uy tín.
> → **Giải pháp:** Worker auto ping Live/Die check sau commit. Badge "480 LIVE / 20 DEAD" ngay trên batch.

**Pain #2 — Bán nhầm nick đã SOLD (race condition)**
> Khi 2 nhân viên cùng filter AVAILABLE và lấy nick → bán cùng 1 nick cho 2 khách.
> → **Giải pháp:** Locking mechanism: khi click "Bán Nhanh" → reserve batch nick, lock 5 phút.

**Pain #3 — Không xem được nick theo từng máy Boxphone**
> Muốn xem "Máy p2k1 đang chứa những nick nào, product gì" → phải filter machine_id thủ công.
> → **Giải pháp:** Tab "Farm Matrix" — grid view từng máy, click vào xem nick trong máy.

**Pain #4 — Export nick mất quá nhiều bước**
> Xuất 50 nick TikTok AVAILABLE: Tab Accounts → filter → select → export → tải → gửi. Mất 5-10 phút.
> → **Giải pháp:** "Smart Export" dialog — chọn loại + số lượng + format → 1 click → download.

**Pain #5 — Không có thông báo khi kho sắp hết**
> Chủ kho đang bận, không biết kho Shopee còn 100 nick. Khách đặt 200 → hết hàng, mất deal.
> → **Giải pháp:** Alert threshold → push Telegram + email cho Owner tự động.

**Pain #6 — Không tra cứu nick nhanh từ điện thoại**
> Nhân viên bán hàng phải mở trình duyệt → đăng nhập → tab Lookup → paste → chờ.
> → **Giải pháp:** Telegram Bot: /check nick_username → trả lời trong 1 giây.

#### 🟡 NHÓM 2: Làm chậm công việc (Friction)

| # | Pain Point | Giải pháp |
|---|------------|-----------|
| 7 | Không có lịch sử thay đổi của nick | Audit trail per account |
| 8 | Không quản lý doanh thu/công nợ | Module CRM + Kế toán |
| 9 | Dùng browser confirm()/prompt() xấu | Custom Modal component |
| 10 | Sidebar không responsive (mobile bể) | Collapsible + Mobile drawer |
| 11 | Số liệu không tự refresh | WebSocket real-time |
| 12 | Table không sort được | Column sort + Virtual scroll |
| 13 | Team list hardcode trong code | Teams CRUD động |
| 14 | Không có chart biểu đồ | Recharts Area + Donut |
| 15 | file page.tsx 2797 dòng | Tách thành 10+ components |

---

## 🚀 PHẦN 2: 5 TÍNH NĂNG ĐẶC THÙ NGHIỆP VỤ MMO

> Đây là các tính năng nghiệp vụ **không có ở bất kỳ tool nào khác** — là lợi thế cạnh tranh độc đáo của ARMS.

### 2.1 🔄 Google Drive Auto-Sync Engine ⭐⭐⭐⭐⭐

**Vấn đề:** Nhân viên vẫn đang thêm nick hàng ngày vào Google Sheet. Không thể bắt họ dừng. Phải tự động hút dữ liệu về.

**Giải pháp:**
```
Cronjob mỗi 1-2 tiếng:
  → Kiểm tra modifiedTime trên Google Drive
  → File nào vừa thay đổi → tự hút dữ liệu mới
  → BullMQ queue → ScanProcessor → upsert MongoDB
  → Cập nhật stats Dashboard (WebSocket)
  → Telegram: "+127 nick mới từ 3 file Drive"
```

**UI cần thêm (tab Import):**
```
┌────────────────────────────────────┐
│  Google Drive Auto-Sync           │
│  Trạng thái: ● BẬT               │
│  Tần suất: [Mỗi 1 giờ ▾]        │
│  Lần sync gần nhất: 14:30 +42    │
│  [Đồng bộ ngay bây giờ]         │
└────────────────────────────────────┘
```

---

### 2.2 🛡️ Live/Die Health Checker qua Proxy ⭐⭐⭐⭐⭐

**Vấn đề:** Kho 51,000 nick TikTok nhưng không biết bao nhiêu cookie còn sống. Bán nick chết → mất uy tín.

**Giải pháp:**
```
Worker chạy nền:
  → Lấy batch 50 nick từ Queue
  → Ping qua Proxy Pool (xoay IP)
  → Phân loại:
    🟢 LIVE       — Cookie/Token hợp lệ
    🟡 SOFT_DEAD  — Cần đăng nhập lại
    🔴 DEAD       — Bị khóa/checkpoint
  → Cập nhật health_status + last_checked_at
```

**Dashboard bổ sung:**
```
┌─────────────────────────────────┐
│  🛡️ Sức Khỏe Kho (Live/Die)   │
│  🟢 LIVE:      41,200 (80.6%) │
│  🟡 SOFT_DEAD:  6,800 (13.3%) │
│  🔴 DEAD:       3,000 (5.9%)  │
│  [🔄 Chạy Health Check Ngay]  │
└─────────────────────────────────┘
```

---

### 2.3 🤖 Telegram Bot Quản Lý & Xuất Kho ⭐⭐⭐⭐⭐

**Commands:**
```
/kho              → Tồn kho tổng (Shopee + TikTok)
/kho tiktok       → Tồn kho TikTok chi tiết
/check username   → Kiểm tra trạng thái 1 nick
/get tiktok 50    → Lấy 50 nick TikTok LIVE → file TXT + mark SOLD
/baocao ngay      → Doanh thu hôm nay
/baocao thang     → Doanh thu tháng này
/alert 500        → Cảnh báo khi kho < 500 nick
```

---

### 2.4 📱 Farm Machine Center — Dàn Máy Boxphone ⭐⭐⭐⭐

**Vấn đề:** DB có field machine_id (p2k1, p2k2...) và product (10 gói milo...) nhưng không có UI trực quan.

**UI Tab "Dàn Máy (Farm Matrix)":**
```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  p2k1   │ │  p2k2   │ │  MÁY 3  │ │  MÁY 4  │
│ 🟢 12 TK│ │ 🟢  8 TK│ │ 🔴 15 TK│ │ 🟡  6 TK│
│ Shopee  │ │ TikTok  │ │ TikTok  │ │ Shopee  │
│[Chi tiết│ │[Chi tiết│ │[Chi tiết│ │[Chi tiết│
└─────────┘ └─────────┘ └─────────┘ └─────────┘

Quick Push: [Chọn máy ▾] → [Số nick] → [Đẩy sang Browser]
```

---

### 2.5 💰 CRM & Module Kế Toán Doanh Thu ⭐⭐⭐⭐

**Vấn đề:** Cuối tháng tổng hợp thủ công: bán bao nhiêu, cho ai, giá bao nhiêu. Không biết khách nào nợ tiền.

**Tính năng:**
- Quản lý danh sách Khách Hàng (Customer CRM)
- Giao dịch bán hàng (nick + giá + khách)
- Doanh thu theo ngày/tháng/khách hàng
- Công nợ: ai còn nợ bao nhiêu
- Bảo hành tự động: khách báo lỗi X nick → 1 click xuất bù X nick mới + thu hồi nick lỗi

---

## 🏗️ PHẦN 3: KIẾN TRÚC KỸ THUẬT NÂNG CẤP

### 3.1 Cấu Trúc File Frontend Mới

```
apps/web/src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               ← Sidebar + Header + Auth guard
│   │   ├── page.tsx                 ← Overview
│   │   ├── accounts/page.tsx
│   │   ├── import/page.tsx          ← Import + Drive Sync
│   │   ├── lookup/page.tsx
│   │   ├── exports/page.tsx
│   │   ├── backups/page.tsx
│   │   ├── api-keys/page.tsx
│   │   ├── teams/page.tsx
│   │   ├── logs/page.tsx
│   │   ├── farm/page.tsx            ← [NEW] Farm Machine Center
│   │   ├── crm/page.tsx             ← [NEW] CRM & Kế toán
│   │   └── settings/page.tsx        ← [NEW] Settings
│   └── landing/page.tsx             ← [NEW] Landing + Pricing
├── components/
│   ├── ui/
│   │   ├── Modal.tsx                ← [NEW]
│   │   ├── ConfirmDialog.tsx        ← [NEW] thay confirm()
│   │   ├── InputDialog.tsx          ← [NEW] thay prompt()
│   │   ├── Skeleton.tsx             ← [NEW]
│   │   ├── DataTable.tsx            ← [NEW] sortable
│   │   └── charts/
│   │       ├── AreaChart.tsx        ← [NEW] Recharts
│   │       ├── DonutChart.tsx       ← [NEW]
│   │       └── BarChart.tsx         ← [NEW]
│   ├── layout/
│   │   ├── Sidebar.tsx              ← [EXTRACT] Collapsible
│   │   ├── TopBar.tsx               ← [NEW]
│   │   └── MobileDrawer.tsx         ← [NEW]
│   ├── accounts/
│   │   ├── AccountsTable.tsx        ← [EXTRACT + virtual scroll]
│   │   ├── AccountDetailModal.tsx   ← [EXTRACT + edit mode]
│   │   ├── AccountFilters.tsx       ← [EXTRACT + debounce]
│   │   ├── BulkActionBar.tsx        ← [EXTRACT]
│   │   ├── SmartExportDialog.tsx    ← [NEW]
│   │   └── HealthBadge.tsx          ← [NEW] LIVE/DEAD badge
│   ├── dashboard/
│   │   ├── KPICard.tsx              ← [EXTRACT + trend %]
│   │   ├── SalesChart.tsx           ← [NEW]
│   │   ├── HealthOverview.tsx       ← [NEW]
│   │   └── QuickActions.tsx         ← [NEW]
│   ├── farm/
│   │   ├── MachineGrid.tsx          ← [NEW]
│   │   └── MachineDetailPanel.tsx   ← [NEW]
│   └── crm/
│       ├── RevenueChart.tsx         ← [NEW]
│       └── CustomerTable.tsx        ← [NEW]
├── hooks/
│   ├── useAccounts.ts               ← React Query
│   ├── useWebSocket.ts              ← Socket.IO
│   ├── useConfirmDialog.ts          ← thay confirm()
│   └── useInputDialog.ts            ← thay prompt()
├── stores/
│   ├── authStore.ts                 ← Zustand
│   └── uiStore.ts                   ← Sidebar state
└── lib/
    ├── api.ts                       ← [EXISTING + extend]
    └── queryClient.ts               ← [NEW]
```

### 3.2 Backend Modules Mới

```
apps/api/src/modules/
├── teams/          ← [NEW] CRUD Teams động
├── health-check/   ← [NEW] Live/Die checker
├── telegram/       ← [NEW] Telegram Bot
├── machines/       ← [NEW] Farm management
├── customers/      ← [NEW] CRM
├── sales/          ← [NEW] Giao dịch
├── notifications/  ← [NEW] Webhook + threshold
├── dashboard/      ← [NEW] Time-series data
└── events/         ← [NEW] WebSocket gateway
```

### 3.3 Tất Cả API Endpoints Mới

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| PATCH | /accounts/:username | Edit account |
| GET | /accounts/timeline/:username | Audit trail |
| GET | /dashboard/time-series | Chart data |
| GET/POST/PATCH/DELETE | /teams | CRUD Teams |
| GET/POST | /integrations/drive/schedule | Drive sync config |
| POST | /integrations/drive/sync-now | Sync thủ công |
| POST | /health-check/run | Chạy check ngay |
| POST | /telegram/webhook | Telegram webhook |
| GET/POST | /telegram/config | Bot config |
| GET | /machines | List machines |
| GET | /machines/:id/accounts | Nick trong máy |
| POST | /machines/:id/push-to-browser | Push antidetect |
| GET/POST/PATCH | /customers | CRM |
| GET/POST | /sales | Giao dịch |
| GET | /sales/revenue | Báo cáo doanh thu |
| POST | /sales/:id/warranty | Bảo hành auto |
| GET/POST | /notifications/webhooks | Webhook config |
| GET | /health | Health check |

---

## 🎨 PHẦN 4: THIẾT KẾ UI/UX CHI TIẾT

### 4.1 Dashboard Overview V2 — Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] ARMS DWH        Overview              👤 Owner  [🌙]    │
├──────────────────────────────────────────────────────────────┤
│                                              [7D][30D][90D]  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────┐   │
│ │ 63,284  │ │ 58,100  │ │  4,100  │ │ 🛡️ Sức Khỏe Kho │   │
│ │  Tổng   │ │Available│ │  Sold   │ │ 🟢 80.6% LIVE    │   │
│ │ ▲ +2.3% │ │ ▲ +1.1% │ │ ▲ +15% │ │ 🔴 5.9%  DEAD    │   │
│ └─────────┘ └─────────┘ └─────────┘ └──────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 📊 Doanh Thu 30 Ngày (Area Chart)                       │ │
│ │ ~~~~~~~~~~~~~~~~~~~~/\/\/\/\/\/\/\___                   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────┐ ┌────────────────────────────────────┐ │
│ │ 🥧 Phân Loại Kho │ │ 🏆 Top Khách Hàng                 │ │
│ │ [Donut Chart]    │ │ 1. Anh Tuấn  500TK  2.5M VNĐ     │ │
│ │ Shopee: 19.3%    │ │ 2. Shop ABC  320TK  1.6M VNĐ     │ │
│ │ TikTok: 80.7%    │ │                                    │ │
│ └──────────────────┘ └────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ⚡ Thao Tác Nhanh:                                     │   │
│ │ [📥 Import] [📤 Xuất Nhanh] [📦 Backup] [🔄 Health]  │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Smart Export Dialog

```
┌──────────────────────────────────────────┐
│  ⚡ Xuất Nhanh cho Khách                 │
│ ──────────────────────────────────────── │
│  Khách hàng:  [Chọn khách ▾] [+ Mới]    │
│  Platform:    ○ TikTok  ● Shopee         │
│  Chỉ LIVE:    ☑ Chỉ lấy nick còn sống   │
│  Số lượng:    [50    ]                   │
│  Định dạng:   ● TXT  ○ Excel             │
│  Giá/nick:    [5,000 VNĐ]               │
│ ──────────────────────────────────────── │
│  Dự kiến: 50 nick × 5,000đ = 250,000đ  │
│  ☑ Tự động đánh dấu SOLD               │
│  ☑ Ghi vào lịch sử giao dịch           │
│  ☑ Thông báo Telegram cho Owner         │
│ ──────────────────────────────────────── │
│  [Hủy]          [⬇ Tạo & Tải File]     │
└──────────────────────────────────────────┘
```

### 4.3 Sidebar V2 Collapsible

```
EXPANDED (256px)               COLLAPSED (64px)
┌─────────────────────┐        ┌──────┐
│ [≡] ARMS DWH v4     │        │ [≡]  │
├─────────────────────┤        ├──────┤
│ 👤 Owner | ALL      │        │  👤  │
│ 🟢 Đang hoạt động  │        │      │
├─────────────────────┤        ├──────┤
│ 📊 Tổng quan        │        │  📊  │
│ 👥 Kho Dữ Liệu      │        │  👥  │
│ 📥 Nhập Kho         │        │  📥  │
│ 🔍 Tra Cứu Nhanh    │        │  🔍  │
│ 📤 Xuất Kho         │        │  📤  │
│ ─── Hạ Tầng ──────  │        │  ─── │
│ 📦 Sao Lưu          │        │  📦  │
│ 🔑 API Keys         │        │  🔑  │
│ 📋 Nhật Ký      [3] │        │ 📋3  │
│ 👥 Đội Nhóm         │        │  👥  │
│ ─── MMO Chuyên ───  │        │  ─── │
│ 🖥️ Dàn Máy Farm    │        │  🖥️  │
│ 💰 CRM & Kế Toán    │        │  💰  │
│ ─────────────────── │        │  ─── │
│  Cài đặt          │        │    │
│ 🌙 Chế độ sáng      │        │  🌙  │
│ 🚪 Đăng xuất        │        │  🚪  │
└─────────────────────┘        └──────┘
```

### 4.4 Custom Modal — Thay confirm()/prompt()

```tsx
// Thay:   confirm('Xác nhận xóa?')
// Bằng:
const ok = await confirmDialog({
  title: 'Xác nhận xóa',
  message: `Sẽ xóa vĩnh viễn "${name}". Không thể hoàn tác.`,
  confirmText: 'Xóa',
  variant: 'danger',
});

// Thay:   prompt('Nhập tên khách hàng:')
// Bằng:
const soldTo = await inputDialog({
  title: '⚡ Bán Nhanh & Copy',
  label: 'Tên khách hàng',
  placeholder: 'VD: Anh Tuấn...',
  required: true,
  confirmText: 'Bán & Copy',
  variant: 'success',
});
```

---

##  PHẦN 5: NÂNG CẤP BACKEND

### 5.1 Swagger API Docs

```typescript
// apps/api/src/main.ts
const config = new DocumentBuilder()
  .setTitle('ARMS Data Warehouse API v4.0')
  .setVersion('4.0')
  .addBearerAuth()
  .addApiKey({ type: 'apiKey', name: 'x-arms-service-key', in: 'header' })
  .addTag('accounts', 'Quản lý tài khoản MMO')
  .addTag('health-check', 'Live/Die checker qua Proxy')
  .addTag('telegram', 'Telegram bot tích hợp')
  .addTag('crm', 'CRM & doanh thu')
  .addTag('machines', 'Farm machine center')
  .build();
// → http://localhost:4000/api/docs
```

### 5.2 Health Status Schema Bổ Sung

```typescript
// Thêm vào AccountSchema:
health_status: {
  type: String,
  enum: ['UNKNOWN', 'LIVE', 'SOFT_DEAD', 'DEAD'],
  default: 'UNKNOWN',
  index: true
},
last_health_check: { type: Date, index: true },
health_fail_count: { type: Number, default: 0 }
```

### 5.3 Performance — MongoDB Indexes

```typescript
AccountSchema.index({ status: 1, platform: 1 });
AccountSchema.index({ health_status: 1 });
AccountSchema.index({ 'metadata.team': 1, status: 1 });
AccountSchema.index({ last_health_check: 1 });
// Dùng cursor-based pagination thay skip (nhanh 10x với 50k+ docs)
```

### 5.4 Security Improvements

| Vấn đề | Giải pháp | Priority |
|--------|-----------|----------|
| Token trong localStorage | httpOnly cookie + refresh token | 🔴 High |
| enableCors() rộng | Whitelist origins từ env | 🔴 High |
| Thiếu rate limiting | @nestjs/throttler per endpoint | 🔴 High |
| Input validation không đồng nhất | class-validator tất cả DTOs | 🔴 High |
| Backup không mã hóa | AES-256-GCM encrypt | 🟡 Medium |
| Lộ thông tin qua error | Custom ExceptionFilter | 🟡 Medium |

---

## 📦 PHẦN 6: KẾ HOẠCH THỰC THI — 8 PHASES

### Phase 1 — Refactor Architecture ⏱️ 2-3 ngày [BẮT BUỘC ĐẦU TIÊN]
- [ ] Next.js App Router multi-page structure
- [ ] Extract Sidebar.tsx + Layout.tsx
- [ ] ConfirmDialog + InputDialog (thay confirm/prompt)
- [ ] Zustand auth store + React Query
- [ ] Loading Skeleton + Error Boundary

### Phase 2 — Dashboard & Charts ⏱️ 2 ngày
- [ ] Recharts: Area Chart doanh thu, Donut Platform Split
- [ ] KPI Cards với trend % (so sánh tuần trước)
- [ ] Health Overview panel
- [ ] Quick Actions panel
- [ ] WebSocket real-time stats

### Phase 3 — Accounts Table UX ⏱️ 2 ngày
- [ ] Column sort
- [ ] Real-time search debounce 300ms
- [ ] react-virtual scroll
- [ ] Account edit modal + PATCH endpoint
- [ ] Smart Export Dialog
- [ ] HealthBadge hiển thị

### Phase 4 — Live/Die Health Checker ⏱️ 2-3 ngày [DIFFERENTIATOR]
- [ ] HealthCheck Worker queue
- [ ] Proxy pool config
- [ ] Scheduler (hàng đêm tự check)
- [ ] API + Dashboard panel
- [ ] Filter theo health status

### Phase 5 — Telegram Bot ⏱️ 2 ngày [DIFFERENTIATOR]
- [ ] NestJS TelegramModule
- [ ] Commands: /kho, /get, /check, /baocao
- [ ] Webhook notifications (kho thấp, import mới)
- [ ] User mapping + Rate limiting

### Phase 6 — Farm Machine Center ⏱️ 1-2 ngày
- [ ] Machine schema + CRUD
- [ ] MachineGrid UI
- [ ] Antidetect browser push

### Phase 7 — CRM & Kế Toán ⏱️ 2-3 ngày
- [ ] Customer + Sale schema
- [ ] Revenue analytics + chart
- [ ] Warranty auto-replacement
- [ ] Export báo cáo Excel

### Phase 8 — Go-to-Market ⏱️ 2 ngày [ƯU TIÊN #2]
- [ ] Swagger docs đầy đủ
- [ ] Settings page (Profile, Teams dynamic, Notifications)
- [ ] Landing page + Pricing table
- [ ] License key system
- [ ] Demo account cho khách thử

---

## 💰 PHẦN 7: CHIẾN LƯỢC BÁN SẢN PHẨM

### 7.1 Pricing

| Gói | Giá | Tính năng chính |
|-----|-----|----------------|
| **Starter** | 500K/tháng | 1 team, 20K accounts, Backup 3 ngày |
| **Pro** | 1.5M/tháng | 5 teams, 200K accounts, Telegram Bot, API Keys |
| **Enterprise** | 3M+/tháng | Unlimited, Live/Die Checker, CRM, Farm Center, On-premise |

### 7.2 So Sánh Với Đối Thủ

| Tính năng | ARMS v4 | Tool khác trên thị trường |
|-----------|---------|--------------------------|
| Multi-team isolation | ✅ | ❌ |
| Live/Die Checker tích hợp | ✅ | ❌ (tool riêng lẻ) |
| Telegram Bot xuất kho | ✅ | ❌ |
| Farm Machine Center | ✅ | ❌ |
| API Gateway cho tool ngoại vi | ✅ | ❌ |
| Audit trail per account | ✅ | ❌ |
| CRM + Kế toán | ✅ | ❌ (phải Excel riêng) |
| Drive Auto-Sync | ✅ | ❌ |

---

## 🚦 PHẦN 8: THỨ TỰ ƯU TIÊN THỰC HIỆN

> **Cảnh báo:** File page.tsx 2797 dòng — nguy cơ lớn nhất. Phải refactor Phase 1 trước.
> **MVP bán được** = Phase 1 + Phase 2 + Phase 8 (~7-8 ngày)
> **Differentiator mạnh nhất** = Phase 4 (Live/Die) + Phase 5 (Telegram Bot)

```
Sprint 1 (Tuần 1-2): Phase 1 + Phase 8  → MVP sẵn sàng bán
Sprint 2 (Tuần 3):   Phase 2 + Phase 3  → UX chuyên nghiệp
Sprint 3 (Tuần 4):   Phase 4 + Phase 5  → Differentiator
Sprint 4 (Tuần 5-6): Phase 6 + Phase 7  → Enterprise complete

✅ Bán được từ: cuối tuần 2
🚀 Enterprise hoàn chỉnh: cuối tuần 6
```

---

*📅 Cập nhật: 2026-08-25 | Phân tích từ: codebase review + phát triển.md + user research*

---

## 🌐 PHẦN 9: BẢN ĐỒ HỆ SINH THÁI & KẾ HOẠCH TÍCH HỢP PIPELINE

> Phần này mô tả vị trí của ARMS trong toàn bộ hệ sinh thái MMO Tool, bao gồm shopee_checker_project (kiểm tra nick), dichvutaikhoanao (web shop bán lẻ) và các tool nuôi nick. ARMS đóng vai trò **Data Hub trung tâm** điều phối toàn bộ pipeline từ nguồn đến đích.

### 9.1 Sơ Đồ Pipeline Tổng Thể (3 Tầng)

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

