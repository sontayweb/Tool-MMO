import asyncio
import sys
from pathlib import Path
from checker_engine.config import DATA_DIR
from checker_engine.account_parser import parse_accounts_file
from checker_engine.worker import CheckerWorker
from checker_engine.excel_handler import export_accounts_to_excel
from checker_engine.logger import get_logger

logger = get_logger()

async def run_cli():
    print("""
========================================================================
   SHOPEE ACCOUNT LIVE/DIE & SESSION CHECKER ENGINE (CLI MODE)
========================================================================
    """)
    default_input = DATA_DIR / "accounts_test.txt"
    file_input = input(f"Nhập đường dẫn file tài khoản (Enter để dùng mặc định '{default_input}'): ").strip()
    path = Path(file_input) if file_input else default_input

    if not path.exists():
        print(f"❌ Không tìm thấy file: {path}")
        return

    accounts = parse_accounts_file(path)
    print(f"✅ Đã nạp và lọc trùng {len(accounts)} tài khoản từ file.")

    worker = CheckerWorker(delay_ms=500, proxy_enabled=False)
    connected = await worker.connect()
    if not connected:
        print("❌ Không thể kết nối MongoDB/Redis. Vui lòng kiểm tra Docker đang bật.")
        return

    print("\n🚀 BẮT ĐẦU TIẾN TRÌNH CHECK TÀI KHOẢN...")
    results = []
    for idx, acc in enumerate(accounts, start=1):
        print(f"\n--- [{idx}/{len(accounts)}] Kiểm tra: {acc['email']} ---")
        task = {
            "email": acc["email"],
            "password": acc["password"],
            "username": acc.get("username", "")
        }
        res = await worker.process_single_task(task)
        if res:
            results.append({
                "email": acc["email"],
                "username": acc.get("username", ""),
                "password_plain": acc["password"],
                "status": res.status.value,
                "error_code": res.error_code,
                "error_msg": res.error_msg,
                "cookies": res.cookies,
                "last_checked_at": None,
                "last_used_proxy": "Direct"
            })

    # Xuất Excel
    output_excel = DATA_DIR / "shopee_check_results.xlsx"
    export_accounts_to_excel(results, output_excel)
    print(f"\n🎉 HOÀN TẤT! Đã xuất kết quả ra file: {output_excel}")
    await worker.disconnect()

if __name__ == "__main__":
    asyncio.run(run_cli())
