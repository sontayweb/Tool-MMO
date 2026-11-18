import asyncio
import random
import time
from typing import Optional
from checker_engine.logger import get_logger

logger = get_logger()

class RateLimiter:
    def __init__(self, base_delay_ms: int = 500, jitter_ms: int = 150):
        self.base_delay_ms = base_delay_ms
        self.jitter_ms = jitter_ms
        self._last_call_time = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        """Đảm bảo khoảng cách an toàn ngẫu nhiên giữa các request."""
        async with self._lock:
            now = time.time()
            elapsed_ms = (now - self._last_call_time) * 1000
            
            jitter = random.randint(-self.jitter_ms, self.jitter_ms)
            target_delay_ms = max(50, self.base_delay_ms + jitter)

            if elapsed_ms < target_delay_ms:
                wait_time_sec = (target_delay_ms - elapsed_ms) / 1000.0
                await asyncio.sleep(wait_time_sec)

            self._last_call_time = time.time()
