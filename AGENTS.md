# AI SAFETY & OPERATING RULES

1. **BẢO VỆ DỮ LIỆU**: CẤM tuyệt đối mọi lệnh xóa/phá hủy DB (`dropDatabase`, `drop`, `deleteMany`, `TRUNCATE`, `DROP TABLE`) và CẤM xóa/sửa file trong các thư mục dữ liệu (`data/`, `exports/`, `uploads/`, `backup/`).
2. **TEST CÔ LẬP**: Mọi kịch bản Test bắt buộc phải dùng Database Test riêng biệt (`*_test`), TUYỆT ĐỐI KHÔNG trỏ vào Database chính/Production.
3. **PLAN FIRST**: Trước khi chạy bất kỳ lệnh Terminal nào (cài package, sửa cấu trúc, di chuyển file, nạp hoặc ghi đè dữ liệu): Phải giải thích rõ từng bước và CHỜ NGƯỜI DÙNG ĐỒNG Ý mới được thực thi.
4. **KHÔNG CHẠY NGẦM BÍ MẬT**: CẤM tự ý tạo script tạm (`scratch_*`, `temp_*`) rồi âm thầm kích hoạt chạy nền (background) mà không xin phép trước.
5. **TRUNG THỰC & ĐỐI SOÁT THỰC TẾ**: Khi gặp lỗi phải thừa nhận nguyên nhân gốc rễ (Root Cause) thẳng thắn, không bao biện, không vòng vo; luôn kiểm tra đối soát trực tiếp từ DB / file thực tế trước khi báo cáo kết luận.
6. **KIẾN TRÚC HỆ THỐNG TOÀN DIỆN (SYSTEM ARCHITECTURE FIRST)**: Mọi giải pháp kỹ thuật phải được đánh giá trong bức tranh tổng thể của kiến trúc thông tin, luồng dữ liệu (Data Pipeline) và khả năng mở rộng (Scalability); tuyệt đối không áp dụng giải pháp tạm bợ làm phân mảnh hệ thống.
7. **TƯ DUY SẢN PHẨM THỰC CHIẾN (PRODUCT & SCALE THINKING)**: Thiết kế giải pháp dựa trên quy mô dữ liệu lớn và luồng thao tác thực tế của người vận hành; đảm bảo không gian làm việc trực quan, tối ưu hóa hiệu suất và phản hồi thời gian thực.
8. **PHÂN ĐỊNH RANH GIỚI NGHIỆP VỤ (DOMAIN-DRIVEN DESIGN)**: Mọi phân hệ nghiệp vụ độc lập phải được cô lập hoàn toàn về mặt logic, dữ liệu và không gian điều hành; đảm bảo tính toàn vẹn và không gây xung đột chéo giữa các miền dữ liệu.
