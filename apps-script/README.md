# Hướng Dẫn Cấu Hình Google Apps Script & Đồng Bộ ARMS

Tài liệu này hướng dẫn chi tiết cách cấu hình **Google Apps Script** trên Google Sheets để:
1. Đồng bộ hóa dữ liệu tài khoản tự động về hệ thống **ARMS**.
2. Tự động tìm kiếm các Sheet chứa tài khoản Shopee cũ trên Google Drive.
3. Tự động gom toàn bộ các file Sheet con trong cùng thư mục về 1 file duy nhất.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Mở trình soạn thảo Google Apps Script
1. Mở file Google Sheet của bạn (file bạn muốn dùng làm **Sheet Tổng Hợp**).
2. Trên thanh công cụ, bấm vào **Extensions (Tiện ích mở rộng)** > **Apps Script**.
3. Một giao diện lập trình sẽ được mở ra trong tab mới.

### Bước 2: Dán mã nguồn tích hợp
1. Tại danh sách tệp bên trái trình soạn thảo, mở tệp `Code.gs` (mặc định đã có sẵn).
2. Xóa toàn bộ nội dung cũ của tệp `Code.gs`.
3. Mở tệp **[Code.gs](file:///d:/sontayweb/toolMMO/apps-script/Code.gs)** trong dự án này, copy toàn bộ nội dung và dán vào trình soạn thảo Google Apps Script.
4. Bấm biểu tượng **Save (Lưu tệp)** 💾 (hoặc nhấn `Ctrl + S`).

### Bước 3: Cấu hình khóa kết nối bảo mật (Script Properties)
Để gửi dữ liệu về server ARMS an toàn, bạn cần cấu hình các biến bảo mật như sau:
1. Ở menu bên trái trình soạn thảo Apps Script, bấm vào biểu tượng bánh răng **Project Settings (Cài đặt dự án)** ⚙️.
2. Cuộn xuống dưới cùng tìm mục **Script Properties (Thuộc tính tập lệnh)** và bấm **Add script property**.
3. Nhập các thuộc tính sau:

| Khóa (Property Key) | Giá trị mẫu | Giải thích |
| :--- | :--- | :--- |
| `ARMS_API_BASE_URL` | `http://localhost:4000` | Đường dẫn API server ARMS của bạn. Nếu dùng online thì điền domain thật. |
| `ARMS_MANAGED_BY` | `Admin Sơn Tây` | Tên người quản trị thực hiện đồng bộ (dùng để ghi log/actor). |
| `ARMS_HMAC_SECRET` | `arms_hmacsecret_8fa7210bc93ea61f7d29bc` | Khóa bí mật dùng để ký và xác thực request (Lấy trong file `.env`). |
| `ARMS_API_KEY` | *(Để trống nếu đã dùng HMAC)* | Key dự phòng nếu bạn không thiết lập HMAC. |

4. Bấm **Save script properties** để lưu lại.

---

## ⚡ HƯỚNG DẪN SỬ DỤNG CÁC TÍNH NĂNG

F5 lại trang Google Sheet của bạn. Bạn sẽ thấy một Menu mới mang tên **`ARMS`** xuất hiện bên cạnh nút Help.

### 1. Đồng bộ hóa về hệ thống ARMS
* **Đồng bộ Tab hiện tại**: Quét tab bạn đang xem và đẩy dữ liệu về server ARMS xử lý.
* **Đồng bộ tất cả các Tab**: Quét toàn bộ các tab trong file và gửi về ARMS (tự động loại trừ các tab phụ như `README`, `CONFIG`, `SUMMARY`, `REPORT`, `FOUND_SHOPEE_SHEETS`, `MASTER_ACCOUNTS` hoặc tab bắt đầu bằng dấu gạch dưới `_`).

### 2. Tự động tìm Sheet tài khoản cũ trên Drive
Nếu bạn có rất nhiều file sheet cũ lưu trên Google Drive nhưng không nhớ ở đâu:
1. Bấm **`ARMS`** > **`4. Quét Tìm Sheet tài khoản Shopee cũ trên Drive`**.
2. Hệ thống sẽ tự động quét tối đa 150 file Sheet trên Drive của bạn.
3. Code sẽ tự kiểm tra nội dung bên trong các file đó, nếu chứa ký tự đặc trưng như Cookie Shopee (`SPC_F=`, `.shopee.vn`) và định dạng Email (`@hotmail.com`, `@gmail.com`), nó sẽ tự ghi nhận lại.
4. Một tab mới tên là `FOUND_SHOPEE_SHEETS` sẽ tự động được tạo ra trong sheet của bạn, liệt kê: **Tên File**, **Tên Tab con**, **Đường link mở trực tiếp**, **ID file**.

### 3. Tự động gom nhiều file Sheet con về 1 Sheet tập trung
Nếu bạn có nhiều file sheet con và muốn tập hợp tất cả tài khoản về 1 file tổng:
1. Tạo một Thư mục trên Google Drive của bạn (ví dụ: `Thư mục Shopee`).
2. Di chuyển **File tổng hợp** (file đang chạy Script này) và tất cả **File Sheet con** chứa tài khoản vào thư mục đó.
3. Bấm **`ARMS`** > **`3. Tự động gom Sheet con cùng Thư mục`**.
4. Script sẽ tự quét toàn bộ thư mục cha, đọc từng file sheet con, bỏ qua các tab trống/tab nháp và gom sạch tài khoản vào tab **`MASTER_ACCOUNTS`** trên file tổng này.

---

## 🔒 LƯU Ý BẢO MẬT QUAN TRỌNG

1. **Tuyệt đối không dán Key trực tiếp vào code**: Việc lưu key trong mã nguồn sẽ khiến người khác xem được mã nguồn của bạn thấy được Key. Luôn luôn sử dụng **Script Properties**.
2. **Cấp quyền an toàn**: Khi chạy lần đầu, Google sẽ cảnh báo bảo mật vì Script này tự động kết nối mạng và duyệt file Drive của bạn. Điều này hoàn toàn bình thường do nhu cầu gửi dữ liệu về ARMS API và quét tìm file của bạn. Hãy bấm *Advanced* > *Go to project (unsafe)* để xác nhận cấp quyền.
