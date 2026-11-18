from motor.motor_asyncio import AsyncIOMotorClient
from checker_engine.config import MONGO_URI, MONGO_DB_NAME, ACCOUNTS_COLLECTION, JOBS_COLLECTION
from checker_engine.logger import get_logger

logger = get_logger()

class AsyncDatabase:
    client: AsyncIOMotorClient = None
    db = None

db_instance = AsyncDatabase()

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(MONGO_URI)
        db_instance.db = db_instance.client[MONGO_DB_NAME]
        
        # Tạo index
        await db_instance.db[ACCOUNTS_COLLECTION].create_index("email", unique=True)
        await db_instance.db[ACCOUNTS_COLLECTION].create_index("job_id")
        await db_instance.db[ACCOUNTS_COLLECTION].create_index("status")
        await db_instance.db[JOBS_COLLECTION].create_index("job_id", unique=True)
        
        logger.info(f"[FastAPI DB] Đã kết nối Async MongoDB ({MONGO_DB_NAME})")
    except Exception as e:
        logger.error(f"[FastAPI DB] Lỗi kết nối MongoDB: {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("[FastAPI DB] Đã đóng kết nối MongoDB")

def get_db():
    if db_instance.db is None:
        db_instance.client = AsyncIOMotorClient(MONGO_URI)
        db_instance.db = db_instance.client[MONGO_DB_NAME]
    return db_instance.db
