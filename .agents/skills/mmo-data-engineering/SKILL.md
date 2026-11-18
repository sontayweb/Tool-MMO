---
name: mmo-data-engineering
description: Chuyên gia kỹ thuật dữ liệu MMO, bóc tách Shopee/TikTok, bảo vệ tính toàn vẹn dữ liệu, chống rác và chuẩn hóa tài khoản.
---

# MMO Data Engineering Skill (ARMS Expert Edition)

Skill này đúc kết toàn bộ kinh nghiệm thực chiến từ việc quản lý và làm sạch hơn 50.000 tài khoản MMO Shopee, TikTok, Facebook trên hệ thống ARMS Data Warehouse.

---

## 1. Bản Chất Các Dạng Dữ Liệu Nguồn MMO (Raw Ingress Intelligence)

1. **Phân biệt rạch ròi 3 tầng dữ liệu**:
   - **Tài nguyên tài khoản (Account Credentials)**: `Username`, `Password`, `Email`, `Pass Mail`, `Cookie` (`SPC_F=`, `.shopee.vn`, `sessionid=`, `ttwid=`).
   - **Tài nguyên phần cứng / Dàn máy (Machine & Session Artifacts)**: `Machine ID` (p2k1, máy 1, box 3), `Device UUID` (dạng `8-4-4-4-12`), Token phiên thiết bị (`M.C506...|UUID`).
   - **Rác bảng tính Excel thừa đuôi (Trailing Empty Row Artifacts)**: Các dòng chỉ có số thứ tự tự động (`114`, `115`, `116`...), `#VALUE!`, `#REF!`, `-`, `--`, `zz`.

2. **Quy tắc vàng phân tích cấu trúc nạp (Column Shift Detection)**:
   - **Shopee 6-cột chuẩn**: `Username | Pass | Phone | Email | PassMail | Cookie`.
   - **Shopee 6-cột kèm STT**: `STT | Username | Pass | Email | PassMail | Cookie`. (Cột 0 là số nguyên `^\d+$`, Cột 3 chứa `@` email, Cột 5 chứa `SPC_F=` hoặc `.shopee.vn`).
   - **Shopee Double STT**: `STT_Nhom | STT_Con | Username | Pass | Phone | Email | PassMail | Cookie`.
   - **TikTok Boxphone**: `Phone | [ ] | Username | Email | Pass | M.C...|UUID` HOẶC `STT | Username | Pass | Email | PassMail | M.C...|UUID`.
   - **TUYỆT ĐỐI KHÔNG**: Nhặt Token `M.C...`, chuỗi Base64 dài > 35 ký tự, hoặc số STT thuần túy (`66`, `69`...) làm Username.

---

## 2. Quy Chuẩn Domain Rules Cho Từng Nền Tảng (Strict Validation)

1. **Shopee**:
   - Username: 4 đến 30 ký tự, `^[a-zA-Z0-9._]{4,30}$`, **CẤM số nguyên thuần túy** (`/^\d+$/`).
   - Cookie: Bắt buộc chứa `SPC_F=[a-zA-Z0-9_-]{15,45}` hoặc `.shopee.vn`.
   - Password: 6 đến 50 ký tự, không chứa dấu cách.
2. **TikTok**:
   - Username: 2 đến 24 ký tự, `^[a-zA-Z0-9._]{2,24}$`, không được là số nguyên thuần túy.
   - Cookie: Phải chứa `ttwid=` hoặc `sessionid=`.
3. **Facebook**:
   - Username / UID: Chữ số UID từ 10-20 ký tự HOẶC username `^[a-zA-Z0-9.]{5,50}$`.
   - Cookie: Chứa `c_user=` và `xs=`. Token bắt đầu bằng `EAA...`.

---

## 3. Chiến Lược Cứu Hộ & Chống Trùng Lặp Kho Hàng (Sanitation & Deduplication)

1. **Định nghĩa Cứu Hộ Thành Công (`fixed`)**:
   - Chỉ được tính là Cứu Hộ Thành Công và chuyển sang `AVAILABLE` khi:
     - Bóc tách được Username hợp lệ theo Domain Rules.
     - **VÀ** có ít nhất `Password` hợp lệ HOẶC `Cookie` sống.
     - **VÀ** tài khoản đó **chưa từng tồn tại** trong kho `AVAILABLE` (chống bán trùng 2 lần).

2. **Chiến lược xử lý Trùng lặp Thông minh (Intelligent Duplicate Resolution)**:
   - Khi chạy Auto-Fix, nếu một dòng dữ liệu bóc tách được Username hợp lệ nhưng Username đó **ĐÃ CÓ trong kho `AVAILABLE`** (ví dụ từ file `SHOPI 20-12` nạp trước, nay gặp lại ở file `Chia nick shopper`):
     - **Bảo vệ tài nguyên**: Giữ bản ghi chính ở `AVAILABLE`.
     - **Cập nhật thông tin tốt hơn**: Nếu bản ghi trùng lặp có Cookie mới hơn hoặc Password mới hơn, hợp nhất (merge) vào bản ghi chính.
     - **Chuẩn hóa nhãn bản ghi phụ**: BẮT BUỘC phải đổi `username` của bản ghi phụ thành dạng `dup_<username_normalized>_<id4>` và gắn tag `fix_failed_duplicate`.
     - **Ý nghĩa sống còn**: Ngăn chặn bộ đếm Domain Rules tiếp tục quét trúng số STT cũ (`"56"`), làm sạch triệt để chỉ số báo lỗi trên Sanitation Hub.

3. **Phân loại Rác Không Thể Cứu (`unfixable`)**:
   - Bản ghi nào là rác Excel thừa đuôi (dòng chỉ có `114`, `115`, `#VALUE!`, `-`):
     - BẮT BUỘC chuẩn hóa `username` thành `junk_stt_<number>_<id4>` hoặc giữ trong `BLACKLISTED`/`TRASH` với nhãn `unfixable_excel_empty_row`.
     - Tuyệt đối không để nguyên `username: "114"` ở trạng thái lơ lửng.

---

## 4. Quy Trình Kiểm Toán & Đối Soát 3 Bước (3-Step Audit Verification)

Trước khi kết luận hệ thống có lỗi hay kho dữ liệu bị thất thoát:
1. **Bước 1 (Check Ingress & Raw)**: Trích xuất `raw.raw_text` và `raw.values` đối soát với `username` hiện tại trong DB để xem có bị lệch cột STT hay không.
2. **Bước 2 (Check Existence in AVAILABLE)**: Kiểm tra xem username thật đã có bản ghi nào ở trạng thái `AVAILABLE` chưa. Nếu đã có ➔ Đây là trường hợp **Trùng lặp an toàn (Duplicate Protection)**, không phải thất thoát.
3. **Bước 3 (Sanitation Tagging)**: Kiểm tra `history` và `tags` (`fix_failed_duplicate`, `unfixable_invalid_username`) để xác định đúng nguyên nhân gốc rễ.
