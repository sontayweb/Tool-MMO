import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import openpyxl

def detect_delimiter(line: str) -> str:
    """Tự động phát hiện dấu phân tách trong dòng text."""
    delimiters = ["\t", "|", ":", ",", " "]
    for d in delimiters:
        if d in line:
            return d
    return "\t"

def parse_single_line(line: str) -> Optional[Dict[str, str]]:
    """
    Parse một dòng tài khoản:
    Hỗ trợ các dạng:
    1. Pass [Tab] Email  (hoặc Email [Tab] Pass)
    2. Username [Tab] Pass [Tab] SĐT [Tab] Mail [Tab] PassMail
    3. User|Pass|Mail|...
    4. User:Pass
    """
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    delimiter = detect_delimiter(line)
    parts = [p.strip() for p in line.split(delimiter) if p.strip()]
    if not parts:
        return None

    # Tìm phần tử là email
    email_idx = -1
    email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    for i, p in enumerate(parts):
        if re.match(email_pattern, p):
            email_idx = i
            break

    username = ""
    password = ""
    phone = ""
    email = ""
    recovery_email = ""

    if email_idx != -1:
        email = parts[email_idx]
        # Nếu có cột trước email hoặc sau email là mật khẩu
        if email_idx == 0 and len(parts) > 1:
            password = parts[1]
            if len(parts) > 2:
                username = parts[2]
        elif email_idx == 1 and len(parts) == 2:
            password = parts[0]
            username = email.split("@")[0]
        elif email_idx == 3 and len(parts) >= 4:
            # Dạng Excel: Username \t Pass \t SĐT \t Mail \t PassMail
            username = parts[0]
            password = parts[1]
            phone = parts[2] if len(parts) > 2 else ""
            if len(parts) > 4:
                recovery_email = parts[4]
        else:
            # Fallback nếu email ở vị trí khác
            for idx, p in enumerate(parts):
                if idx != email_idx:
                    if not password:
                        password = p
                    elif not username:
                        username = p
    else:
        # Nếu không có email định dạng chuẩn, lấy dạng user / pass
        if len(parts) >= 2:
            username = parts[0]
            password = parts[1]
            email = username
        elif len(parts) == 1:
            username = parts[0]
            password = ""
            email = username

    if not email:
        return None

    return {
        "username": username or email.split("@")[0],
        "email": email.strip(),
        "password": password.strip(),
        "phone": phone.strip(),
        "recovery_email": recovery_email.strip()
    }

def parse_text_content(content: str) -> List[Dict[str, str]]:
    """Phân tách nội dung văn bản thành danh sách tài khoản, tự động lọc trùng email."""
    lines = content.splitlines()
    accounts = []
    seen_emails = set()

    for line in lines:
        parsed = parse_single_line(line)
        if parsed:
            email_key = parsed["email"].lower()
            if email_key not in seen_emails:
                seen_emails.add(email_key)
                accounts.append(parsed)

    return accounts

def parse_accounts_file(file_path: str | Path) -> List[Dict[str, str]]:
    """Đọc và parse file tài khoản .txt, .csv hoặc .xlsx"""
    path = Path(file_path)
    if not path.exists():
        return []

    if path.suffix.lower() in [".xlsx", ".xls"]:
        return parse_excel_file(path)
    else:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return parse_text_content(content)

def parse_excel_file(file_path: Path) -> List[Dict[str, str]]:
    """Đọc file Excel và trích xuất tài khoản."""
    wb = openpyxl.load_workbook(file_path, data_only=True)
    ws = wb.active
    accounts = []
    seen_emails = set()

    for row in ws.iter_rows(values_only=True):
        if not row or not any(row):
            continue
        row_str = "\t".join([str(cell).strip() for cell in row if cell is not None])
        parsed = parse_single_line(row_str)
        if parsed:
            email_key = parsed["email"].lower()
            if email_key not in seen_emails:
                seen_emails.add(email_key)
                accounts.append(parsed)

    return accounts
