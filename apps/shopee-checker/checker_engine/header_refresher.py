"""
Auto Header Pool Refresher — Tự động thu thập headers bảo mật Shopee
bằng cách mở browser Playwright và bắt network request.
"""
import asyncio
import json
import time
from pathlib import Path
from typing import Dict, Optional, Any
from playwright.async_api import async_playwright, Request
from checker_engine.config import HEADER_POOL_PATH
from checker_engine.logger import get_logger

logger = get_logger()

class HeaderRefresher:
    def __init__(self, pool_path: str | Path = HEADER_POOL_PATH):
        self.pool_path = Path(pool_path)

    async def capture_one_session(self, label: Optional[str] = None) -> Dict[str, Any]:
        """
        Mở shopee.vn/buyer/login qua Playwright headless.
        Nhập dummy credentials để trigger JavaScript SDK của Shopee sinh headers bảo mật (x-sap-sec, sz-token),
        bắt lấy headers và lưu vào data/header_pool.json.
        """
        label = label or f"Auto_Capture_{time.strftime('%Y%m%d_%H%M%S')}"
        intercepted_headers = {}
        intercepted_cookies = {}

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
                )
                context = await browser.new_context(
                    viewport={"width": 1366, "height": 768},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = await context.new_page()

                # Lắng nghe network requests
                async def handle_request(request: Request):
                    if "/api/v4/account/" in request.url and request.method == "POST":
                        hdrs = dict(request.headers)
                        if "x-sap-sec" in hdrs or "af-ac-enc-sz-token" in hdrs:
                            intercepted_headers.update(hdrs)
                            cookies = await context.cookies()
                            for c in cookies:
                                intercepted_cookies[c["name"]] = c["value"]
                            logger.info("[HeaderRefresher] ✅ Đã bắt thành công Security Headers từ Shopee API request!")

                page.on("request", handle_request)

                logger.info("[HeaderRefresher] Đang mở https://shopee.vn/buyer/login...")
                await page.goto("https://shopee.vn/buyer/login", wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2000)

                # Điền thông tin dummy để kích hoạt nút Đăng nhập
                try:
                    login_input = page.locator('input[name="loginKey"], input[type="text"]').first
                    if await login_input.is_visible(timeout=5000):
                        await login_input.fill("test_probe@gmail.com")
                        await page.wait_for_timeout(300)

                    pass_input = page.locator('input[type="password"]').first
                    if await pass_input.is_visible(timeout=5000):
                        await pass_input.fill("ProbePassword123!")
                        await page.wait_for_timeout(300)

                    submit_btn = page.locator('button[type="submit"], button:has-text("Đăng nhập")').first
                    if await submit_btn.is_visible(timeout=5000):
                        await submit_btn.click()
                        await page.wait_for_timeout(4000)
                except Exception as ex:
                    logger.debug(f"[HeaderRefresher] Form interaction note: {ex}")

                # Nếu chưa bắt được từ POST, lấy ít nhất cookies và token trên context
                if not intercepted_cookies:
                    cookies = await context.cookies()
                    for c in cookies:
                        intercepted_cookies[c["name"]] = c["value"]

                await browser.close()
        except Exception as e:
            logger.error(f"[HeaderRefresher] Lỗi khi chạy Playwright: {e}")
            return {}

        if not intercepted_headers and not intercepted_cookies:
            logger.warning("[HeaderRefresher] Không thể trích xuất headers từ phiên này.")
            return {}

        # Xây dựng cookie base string
        cookie_base_str = "; ".join([f"{k}={v}" for k, v in intercepted_cookies.items()])

        new_entry = {
            "idx": int(time.time()),
            "label": label,
            "is_active": True,
            "user_agent": intercepted_headers.get("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
            "sec_ch_ua": intercepted_headers.get("sec-ch-ua", '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'),
            "af_ac_enc_dat": intercepted_headers.get("af-ac-enc-dat", ""),
            "af_ac_enc_sz_token": intercepted_headers.get("af-ac-enc-sz-token", ""),
            "x_sap_sec": intercepted_headers.get("x-sap-sec", ""),
            "x_csrftoken": intercepted_headers.get("x-csrftoken", intercepted_cookies.get("csrftoken", "")),
            "cookie_csrf_token": intercepted_cookies.get("csrftoken", ""),
            "cookie_shopee_web_unique_ccd": intercepted_cookies.get("shopee_webUnique_ccd", ""),
            "cookie_spc_f": intercepted_cookies.get("SPC_F", ""),
            "cookie_base": cookie_base_str,
            "security_device_fingerprint": intercepted_headers.get("af-ac-enc-sz-token", ""),
            "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # Nạp pool hiện tại và bổ sung
        existing_pool = []
        if self.pool_path.exists():
            try:
                with open(self.pool_path, "r", encoding="utf-8") as f:
                    existing_pool = json.load(f) or []
            except Exception:
                existing_pool = []

        # Dedup nếu x_sap_sec trùng
        if new_entry.get("x_sap_sec"):
            existing_pool = [h for h in existing_pool if h.get("x_sap_sec") != new_entry["x_sap_sec"]]
        
        existing_pool.append(new_entry)

        with open(self.pool_path, "w", encoding="utf-8") as f:
            json.dump(existing_pool, f, ensure_ascii=False, indent=2)

        logger.info(f"[HeaderRefresher] ✅ Đã lưu bộ header mới ({label}) vào {self.pool_path} (Tổng: {len(existing_pool)} headers)")
        return new_entry
