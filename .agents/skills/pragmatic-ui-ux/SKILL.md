---
name: pragmatic-ui-ux
description: Nguyên tắc thiết kế giao diện thực chiến cho hệ thống quản lý MMO, loại bỏ rườm rà, tối ưu 1-click thao tác.
---

# Pragmatic UI/UX for MMO Operators

## 1. Triệt Tiêu Over-Engineering
- **CẤM** tạo Dropdown / Select Option cho các trường nhị phân (Có / Không). Bắt buộc dùng Checkbox hoặc Toggle Chip trực quan.
- **Tập trung vào 1-Click Presets**: Người vận hành luôn cần thao tác nhanh nhất (1-click lọc Nick Full Info, 1-click lọc Nick có Cookie, 1-click lọc Nick lỗi để xóa).

## 2. Phản Hồi Thời Gian Thực & Không Gián Đoạn (Zero-Lag UI)
- Mọi nút bấm tác vụ hàng loạt (Xóa, Đổi trạng thái, Xuất file, Cứu hộ) bắt buộc phải có Loading Spinner và Toast thông báo rõ ràng.
- Không để giao diện bị đơ (freeze) khi thực hiện các tác vụ nặng. Luôn stream dữ liệu hoặc xử lý bất đồng bộ.

## 3. Xác Thực Hai Chiều (Two-Way Safety Guard)
- Thao tác xóa hoặc tác động lớn phải có Modal Confirm rõ ràng, hiển thị đúng số lượng tài khoản bị ảnh hưởng trước khi bấm xác nhận.
- Cung cấp nút "Xem Danh Sách" để người dùng kiểm tra đối soát trực quan trước khi bấm các nút nguy hiểm.
