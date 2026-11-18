from pathlib import Path
from typing import List, Dict, Any
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from checker_engine.logger import get_logger

logger = get_logger()

STATUS_COLOR_MAP = {
    "LIVE": "10B981",         # Xanh neon
    "IVS_VERIFY": "38BDF8",   # Xanh trời
    "WRONG_PASS": "EF4444",   # Đỏ
    "BANNED": "DC2626",       # Đỏ đậm
    "FAILED": "F59E0B",       # Vàng
    "CAPTCHA": "C084FC",      # Tím
    "RATE_LIMIT": "FB923C",   # Cam
    "PENDING": "94A3B8"       # Xám
}

def export_accounts_to_excel(accounts: List[Dict[str, Any]], output_path: str | Path) -> str:
    """Xuất danh sách kết quả check ra file Excel đẹp mắt."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "Shopee Accounts"

    headers = [
        "STT", "Tài khoản", "Email", "Mật khẩu", "Trạng thái",
        "Shopee Xu", "Tên hiển thị", "Số ĐT", "Level",
        "Mã lỗi", "Cookie", "Proxy", "Lần check cuối", "Ghi chú"
    ]
    ws.append(headers)

    # Style Header
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # Ghi dữ liệu
    for idx, acc in enumerate(accounts, start=1):
        status = acc.get("status", "PENDING")
        has_cookie = "✅ Có" if acc.get("cookies") else "❌ Không"
        last_check = acc.get("last_checked_at", "")
        if hasattr(last_check, "strftime"):
            last_check = last_check.strftime("%Y-%m-%d %H:%M:%S")

        xu_val = acc.get("xu_balance", 0)
        phone_val = acc.get("phone_masked", "")
        name_val = acc.get("display_name", "")
        level_val = acc.get("account_level", 0)

        row = [
            idx,
            acc.get("username", ""),
            acc.get("email", ""),
            acc.get("password_plain", ""),
            status,
            xu_val,
            name_val,
            phone_val,
            f"Level {level_val}" if level_val else "",
            acc.get("error_code", ""),
            has_cookie,
            acc.get("last_used_proxy", "") or "Direct",
            str(last_check),
            acc.get("error_msg", "")
        ]
        ws.append(row)
        current_row = idx + 1


        # Format màu trạng thái
        status_color = STATUS_COLOR_MAP.get(status, "FFFFFF")
        status_cell = ws.cell(row=current_row, column=5)
        status_cell.font = Font(bold=True, color=status_color)

        for col_num in range(1, len(headers) + 1):
            c = ws.cell(row=current_row, column=col_num)
            c.border = thin_border
            if col_num in [1, 5, 6, 7, 9]:
                c.alignment = Alignment(horizontal="center", vertical="center")

    # Tự căn chỉnh độ rộng cột
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    wb.save(path)
    logger.info(f"[Excel] Đã xuất thành công {len(accounts)} tài khoản ra file: {path}")
    return str(path)
