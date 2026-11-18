import asyncio
import random
import time
from pathlib import Path
from typing import List, Optional
from curl_cffi import requests as cffi_requests
from checker_engine.config import PROXIES_PATH
from checker_engine.logger import get_logger

logger = get_logger()

class ProxyManager:
    PROVIDER_API = {
        "tmproxy": "http://api.tmproxy.com/api/changeip?token={api_key}",
        "shoplike": "http://api.shoplike.vn/change?token={api_key}",
        "wwproxy": "http://proxy.wwproxy.com/changeip?token={api_key}"
    }

    def __init__(
        self,
        proxies_file: str | Path = PROXIES_PATH,
        rotate_provider: Optional[str] = None,
        rotate_api_key: Optional[str] = None,
        rotate_after_n_requests: int = 50
    ):
        self.proxies_file = Path(proxies_file)
        self.proxies: List[str] = []
        self._current_idx = 0
        self.rotate_provider = rotate_provider.lower() if rotate_provider else None
        self.rotate_api_key = rotate_api_key
        self.rotate_after_n = rotate_after_n_requests
        self._request_count = 0
        self._last_rotate_time = 0.0
        self.current_rotating_proxy: Optional[str] = None
        self.load_proxies()

    def load_proxies(self) -> int:
        if not self.proxies_file.exists():
            self.proxies = []
            return 0

        try:
            with open(self.proxies_file, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]
            
            # Chuẩn hóa format http://ip:port hoặc http://user:pass@ip:port
            formatted_proxies = []
            for p in lines:
                if not p.startswith("http://") and not p.startswith("https://") and not p.startswith("socks5://"):
                    p = f"http://{p}"
                formatted_proxies.append(p)

            self.proxies = formatted_proxies
            logger.info(f"[ProxyManager] Đã tải {len(self.proxies)} proxies từ file.")
            return len(self.proxies)
        except Exception as e:
            logger.error(f"[ProxyManager] Lỗi khi nạp proxy: {e}")
            self.proxies = []
            return 0

    def get_proxy(self) -> Optional[str]:
        if self.current_rotating_proxy:
            return self.current_rotating_proxy
        if not self.proxies:
            return None
        proxy = self.proxies[self._current_idx % len(self.proxies)]
        self._current_idx += 1
        return proxy

    def get_random_proxy(self) -> Optional[str]:
        if self.current_rotating_proxy:
            return self.current_rotating_proxy
        if not self.proxies:
            return None
        return random.choice(self.proxies)

    async def maybe_rotate_ip(self) -> bool:
        """Tự động xoay IP sau N requests nếu có cấu hình API xoay."""
        if not self.rotate_provider or not self.rotate_api_key:
            return False
        self._request_count += 1
        if self._request_count >= self.rotate_after_n:
            self._request_count = 0
            return await self.rotate_ip()
        return False

    async def force_rotate_on_error(self) -> bool:
        """Xoay IP khẩn cấp khi gặp Rate Limit 429 hoặc Error 1 (Blocked)."""
        if not self.rotate_provider or not self.rotate_api_key:
            return False
        # Debounce: Không xoay quá nhanh trong vòng 5 giây
        if time.time() - self._last_rotate_time < 5:
            return False
        logger.warning(f"[ProxyManager] Phát hiện Rate Limit / Block. Đang xoay IP ({self.rotate_provider})...")
        return await self.rotate_ip()

    async def rotate_ip(self) -> bool:
        """Gọi API xoay IP tương ứng."""
        if not self.rotate_provider or not self.rotate_api_key:
            return False

        url_template = self.PROVIDER_API.get(self.rotate_provider)
        if not url_template:
            logger.error(f"[ProxyManager] Nhà cung cấp không hợp lệ: {self.rotate_provider}")
            return False

        url = url_template.format(api_key=self.rotate_api_key)
        try:
            resp = await asyncio.to_thread(cffi_requests.get, url, timeout=8)
            self._last_rotate_time = time.time()
            data = resp.text
            logger.info(f"[ProxyManager] Kết quả xoay IP ({self.rotate_provider}): {data[:100]}")
            
            # Nếu API trả về proxy dạng json/text, thử bóc tách
            try:
                json_data = resp.json()
                # TMProxy / Shoplike / WWProxy thường trả về proxy: { "data": { "proxy": "ip:port" } } hoặc { "proxy": "ip:port" }
                proxy_str = None
                if isinstance(json_data, dict):
                    if "data" in json_data and isinstance(json_data["data"], dict):
                        proxy_str = json_data["data"].get("proxy") or json_data["data"].get("http")
                    elif "proxy" in json_data:
                        proxy_str = json_data["proxy"]
                    elif "http" in json_data:
                        proxy_str = json_data["http"]
                
                if proxy_str:
                    if not proxy_str.startswith("http://") and not proxy_str.startswith("socks5://"):
                        proxy_str = f"http://{proxy_str}"
                    self.current_rotating_proxy = proxy_str
                    logger.info(f"[ProxyManager] Đã cập nhật proxy xoay mới: {self.current_rotating_proxy}")
            except Exception:
                pass

            return True
        except Exception as e:
            logger.error(f"[ProxyManager] Lỗi gọi API xoay IP: {e}")
            return False

