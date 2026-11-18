import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_backend.database import connect_to_mongo, close_mongo_connection
from api_backend.redis_client import connect_to_redis, close_redis_connection, get_redis
from api_backend.ws_manager import ws_manager
from api_backend.routers import jobs, accounts, export, websocket, admin
from checker_engine.logger import get_logger

logger = get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("[FastAPI] Khởi động ứng dụng...")
    await connect_to_mongo()
    await connect_to_redis()

    redis_client = get_redis()
    listener_task = None
    if redis_client:
        listener_task = asyncio.create_task(ws_manager.start_redis_listener(redis_client))

    yield

    # Shutdown
    logger.info("[FastAPI] Tắt ứng dụng...")
    if listener_task:
        listener_task.cancel()
    await close_redis_connection()
    await close_mongo_connection()

app = FastAPI(
    title="Shopee Account Live/Die Checker API",
    description="Hệ thống Backend REST API & WebSocket Realtime cho Shopee Account Checker",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(jobs.router)
app.include_router(accounts.router)
app.include_router(export.router)
app.include_router(websocket.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Shopee Account Checker API",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("api_backend.main:app", host=host, port=port, reload=True)
