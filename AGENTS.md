# AI SAFETY & OPERATING RULES

1. **BẢO VỆ DỮ LIỆU**: CẤM tuyệt đối mọi lệnh xóa/phá hủy DB (`dropDatabase`, `drop`, `deleteMany`, `TRUNCATE`, `DROP TABLE`) và CẤM xóa/sửa file trong các thư mục dữ liệu (`data/`, `exports/`, `uploads/`, `backup/`).
2. **TEST CÔ LẬP**: Mọi kịch bản Test bắt buộc phải dùng Database Test riêng biệt (`*_test`), TUYỆT ĐỐI KHÔNG trỏ vào Database chính/Production.
3. **PLAN FIRST**: Trước khi chạy bất kỳ lệnh Terminal nào (cài package, sửa cấu trúc, di chuyển file, nạp hoặc ghi đè dữ liệu): Phải giải thích rõ từng bước và CHỜ NGƯỜI DÙNG ĐỒNG Ý mới được thực thi.
4. **KHÔNG CHẠY NGẦM BÍ MẬT**: CẤM tự ý tạo script tạm (`scratch_*`, `temp_*`) rồi âm thầm kích hoạt chạy nền (background) mà không xin phép trước.
5. **TRUNG THỰC & ĐỐI SOÁT THỰC TẾ**: Khi gặp lỗi phải thừa nhận nguyên nhân gốc rễ (Root Cause) thẳng thắn, không bao biện, không vòng vo; luôn kiểm tra đối soát trực tiếp từ DB / file thực tế trước khi báo cáo kết luận.
6. **KIẾN TRÚC HỆ THỐNG TOÀN DIỆN (SYSTEM ARCHITECTURE FIRST)**: Mọi giải pháp kỹ thuật phải được đánh giá trong bức tranh tổng thể của kiến trúc thông tin, luồng dữ liệu (Data Pipeline) và khả năng mở rộng (Scalability); tuyệt đối không áp dụng giải pháp tạm bợ làm phân mảnh hệ thống.
7. **TƯ DUY SẢN PHẨM THỰC CHIẾN (PRODUCT & SCALE THINKING)**: Thiết kế giải pháp dựa trên quy mô dữ liệu lớn và luồng thao tác thực tế của người vận hành; đảm bảo không gian làm việc trực quan, tối ưu hóa hiệu suất và phản hồi thời gian thực.
8. **PHÂN ĐỊNH RANH GIỚI NGHIỆP VỤ (DOMAIN-DRIVEN DESIGN)**: Mọi phân hệ nghiệp vụ độc lập phải được cô lập hoàn toàn về mặt logic, dữ liệu và không gian điều hành; đảm bảo tính toàn vẹn và không gây xung đột chéo giữa các miền dữ liệu.
9. **NGUYÊN TẮC THIẾT KẾ UX/UI THỰC CHIẾN (PRAGMATIC & ZERO-CLUTTER UX)**:
   - CẤM thiết kế rườm rà, máy móc (Over-Engineering).
   - CẤM dùng dropdown/select option cho các trường nhị phân (Có / Không). Luôn dùng Checkbox hoặc Toggle Chip trực quan.
   - Luôn thiết kế các bộ lọc nhanh 1-Click theo đúng gói nghiệp vụ thực tế (Nick Full Info, Nick có Cookie, Nick lỗi rác cần xóa...).
   - Mọi nút bấm thao tác hàng loạt phải có trạng thái Loading Spinner + Toast thông báo rõ ràng, không làm đơ giao diện.
10. **CHUẨN HÓA DỮ LIỆU & LÀM SẠCH TẬN GỐC (STRICT DATA INTEGRITY)**:
   - CẤM lưu các chuỗi Token phiên thiết bị (`M.C...`), chuỗi Base64 dài > 35 ký tự, hoặc số STT thuần túy (`66`, `69`...) làm Username.
   - Toàn bộ dữ liệu nạp vào phải được kiểm duyệt nghiêm ngặt qua `UsernameNormalizer.isValid` ngay tại cửa vào Ingestion.
   - Logic Cứu Hộ / Auto-Fix CHỈ ĐƯỢC TÍNH là cứu thành công khi tài khoản có đầy đủ Password hoặc Cookie sống; các bản ghi rác không thể cứu phải bị chuyển vào `BLACKLISTED` với nhãn `unfixable`, tuyệt đối không để nguyên ở `AVAILABLE`.
11. **KIỂM CHỨNG TOÀN DIỆN TRƯỚC KHI BÀN GIAO (END-TO-END VERIFICATION)**:
   - Trước khi báo cáo hoàn thành, phải đối soát toàn bộ chuỗi: Giao diện (FE) ➔ API Endpoint ➔ Xử lý Logic Backend ➔ Truy vấn MongoDB ➔ File Xuất / Tải về thực tế.
   - Kiểm tra kỹ các module CommonJS / ESM để tránh lỗi crash runtime.
12. **XỬ LÝ LỆCH CỘT STT & CHỐNG TRÙNG LẶP KHO HÀNG (INGRESS RESILIENCE & SMART DEDUPLICATION)**:
   - Parser bắt buộc phải nhận diện linh hoạt cột STT (`^\d+$`) ở vị trí đầu tiên của bảng tính Shopee/TikTok để bóc tách đúng Username ở Cột 1 và Password ở Cột 2.
   - Khi chạy Cứu Hộ / Auto-Fix, nếu Username đã tồn tại trong kho `AVAILABLE` (Duplicate an toàn từ nhiều nguồn nạp), BẮT BUỘC phải đổi Username bản ghi phụ thành `dup_<username>_<id4>` và gắn tag `fix_failed_duplicate`, tuyệt đối không để nguyên số STT rác (`56`, `60`...) làm sai lệch bộ đếm Domain Rules.
   - Các dòng rác Excel kéo dài thừa đuôi (`114`, `115`, `#VALUE!`, `-`) phải được gắn nhãn `unfixable_excel_empty_row` và cô lập triệt để.
13. **QUY TẮC VÀNG NHẬN DIỆN NỀN TẢNG (PLATFORM DETECTION GOLDEN RULE)**:
   - THỨ TỰ ƯU TIÊN BẤT BIẾN (từ cao xuống thấp): `default_platform` từ Nguồn Nạp → Cookie Độc Quyền → Tên File/Sheet → Fallback `'SHOPEE'`.
   - `default_platform` từ Nguồn Nạp là **TỐI THƯỢNG**: Một khi ShopeeDriveService đã truyền `default_platform: 'SHOPEE'`, KHÔNG CÓ bất kỳ điều kiện nào được lật lại quyết định đó.
   - CẤM dùng các dấu hiệu dùng chung để suy luận platform: Domain mail `@smvmail.com`, `@fviainboxes.com` (dùng cho cả Shopee lẫn TikTok), Token thiết bị Boxphone `M.C...` (không phải dấu hiệu riêng nền tảng nào).
   - Chỉ Cookie MÃ HÓA ĐỘC QUYỀN mới được dùng để nhận diện: Shopee (`SPC_F=`, `.shopee.vn`), TikTok (`ttwid=`, `odin_tt=`), Facebook (`c_user=` kết hợp `xs=`).
   - `PLATFORM_FALLBACK_DEFAULT = 'SHOPEE'` (hằng số trong `domain-rules.ts`): Toàn bộ service phải import hằng số này, CẤM hardcode string `'TIKTOK'` làm giá trị fallback.
   - Auto-Fix khi tái xử lý raw data PHẢI kế thừa `platform` từ bản ghi DB gốc làm `default_platform`, không để parser tự đoán lại từ đầu.
