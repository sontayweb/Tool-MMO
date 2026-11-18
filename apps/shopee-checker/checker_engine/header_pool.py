import json
import secrets
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from checker_engine.config import HEADER_POOL_PATH
from checker_engine.logger import get_logger

logger = get_logger()

def gen_x_sap_ri() -> str:
    """Tự động sinh 52 ký tự hex cho header x-sap-ri."""
    return secrets.token_hex(26)

class HeaderPoolManager:
    def __init__(self, pool_path: str | Path = HEADER_POOL_PATH):
        self.pool_path = Path(pool_path)
        self.headers_list: List[Dict] = []
        self._current_idx = 0
        self.load_pool()

    def load_pool(self) -> int:
        if not self.pool_path.exists():
            logger.warning(f"[HeaderPool] File không tồn tại: {self.pool_path}")
            self.headers_list = []
            return 0

        try:
            with open(self.pool_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    self.headers_list = data
                else:
                    self.headers_list = [data]
            logger.info(f"[HeaderPool] Đã nạp thành công {len(self.headers_list)} bộ header.")
            return len(self.headers_list)
        except Exception as e:
            logger.error(f"[HeaderPool] Lỗi khi nạp file pool: {e}")
            self.headers_list = []
            return 0

    def get_next(self) -> Tuple[Dict, Dict, int]:
        """
        Lấy bộ header và cookies tiếp theo theo vòng tròn (Round-Robin).
        Returns: (headers_dict, cookies_dict, pool_index)
        """
        if not self.headers_list:
            # Fallback nếu chưa có pool
            return self._get_fallback_header()

        idx = self._current_idx % len(self.headers_list)
        self._current_idx += 1
        raw = self.headers_list[idx]

        headers = {
            "accept": "application/json",
            "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/json",
            "origin": "https://shopee.vn",
            "referer": "https://shopee.vn/buyer/login?next=https%3A%2F%2Fshopee.vn%2F",
            "priority": "u=1, i",
            "sec-ch-ua": raw.get("sec_ch_ua", '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"'),
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": raw.get("user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"),
            "x-api-source": "pc",
            "x-requested-with": "XMLHttpRequest",
            "x-shopee-language": "vi",
            "x-sz-sdk-version": "1.12.40",
            "af-ac-enc-dat": raw.get("af_ac_enc_dat", ""),
            "af-ac-enc-sz-token": raw.get("af_ac_enc_sz-token", raw.get("af_ac_enc_sz_token", "")),
            "x-csrftoken": raw.get("x_csrftoken", raw.get("cookie_csrf_token", "")),
            "x-sap-ri": gen_x_sap_ri(),
            "x-sap-sec": raw.get("x_sap_sec", "")
        }

        # Parse Cookie Base
        cookies = {}
        cookie_base_str = raw.get("cookie_base", "")
        for item in cookie_base_str.split(";"):
            if "=" in item:
                k, v = item.strip().split("=", 1)
                cookies[k.strip()] = v.strip()

        if "cookie_csrf_token" in raw:
            cookies["csrftoken"] = raw["cookie_csrf_token"]
        if "cookie_shopee_web_unique_ccd" in raw:
            cookies["shopee_webUnique_ccd"] = raw["cookie_shopee_web_unique_ccd"]
        if "cookie_spc_f" in raw:
            cookies["SPC_F"] = raw["cookie_spc_f"]

        return headers, cookies, idx

    def _get_fallback_header(self) -> Tuple[Dict, Dict, int]:
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "origin": "https://shopee.vn",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
            "x-api-source": "pc",
            "x-requested-with": "XMLHttpRequest",
            "x-shopee-language": "vi",
            "x-sz-sdk-version": "1.12.40",
            "x-sap-ri": gen_x_sap_ri()
        }
        return headers, {}, -1
