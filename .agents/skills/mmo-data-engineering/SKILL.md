---
name: mmo-data-engineering
description: Chuyên gia kỹ thuật dữ liệu MMO, bóc tách Shopee/TikTok, bảo vệ tính toàn vẹn dữ liệu, chống rác và chuẩn hóa tài khoản.
---

# MMO Data Engineering Skill

## 1. Nguyên Tắc Bóc Tách Dữ Liệu (Account Parsing)
- **Nhận diện đúng bản chất**: Không bao giờ nhầm lẫn giữa Token phiên thiết bị (`M.C506...`, Base64, UUID) và Username thật của tài khoản.
- **Quy tắc Username chuẩn**:
  - Phải có độ dài từ 2 đến 35 ký tự.
  - Không được là số nguyên thuần túy (như `66`, `69`, `71`...).
  - Không được bắt đầu bằng `M.C`, `http://`, `https://`, hoặc chứa `spc_f=`.
- **Phân định rõ ràng**:
  - Dữ liệu tài khoản: `Username`, `Password`, `Email`, `Pass Mail`, `Cookie`.
  - Dữ liệu thiết bị/dàn máy: `Machine ID`, `Device UUID`, `Session Artifact`. Không được nhét thông tin thiết bị vào trường tài khoản.

## 2. Chuẩn Hóa Cứu Hộ Dữ Liệu (Data Recovery / Sanitation)
- Chỉ được tính là Cứu Hộ Thành Công (`fixed`) khi bản ghi thực sự có đầy đủ `Password` HOẶC `Cookie` sống hợp lệ.
- Bản ghi nào là rác không thể cứu (như dòng token lẻ trong file máy), BẮT BUỘC phải chuyển sang `BLACKLISTED` với nhãn `unfixable`. Tuyệt đối không để nguyên ở `AVAILABLE`.
