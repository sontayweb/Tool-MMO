import redis.asyncio as aioredis
from checker_engine.config import REDIS_URL
from checker_engine.logger import get_logger

logger = get_logger()

class AsyncRedis:
    client = None

redis_instance = AsyncRedis()

async def connect_to_redis():
    try:
        redis_instance.client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await redis_instance.client.ping()
        logger.info("[FastAPI Redis] Đã kết nối Async Redis thành công")
    except Exception as e:
        logger.error(f"[FastAPI Redis] Lỗi kết nối Redis: {e}")

async def close_redis_connection():
    if redis_instance.client:
        await redis_instance.client.close()
        logger.info("[FastAPI Redis] Đã đóng kết nối Redis")

def get_redis():
    if redis_instance.client is None:
        redis_instance.client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return redis_instance.client
