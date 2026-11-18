import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
from checker_engine.config import REDIS_RESULTS_CHANNEL_PREFIX
from checker_engine.logger import get_logger

logger = get_logger()

class WebSocketManager:
    def __init__(self):
        # job_id -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.subscribed_channels: Set[str] = set()
        self._listener_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
        logger.info(f"[WebSocket] Client kết nối vào Job {job_id} (Tổng: {len(self.active_connections[job_id])})")

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        logger.info(f"[WebSocket] Client ngắt kết nối khỏi Job {job_id}")

    async def broadcast_to_job(self, job_id: str, message: Dict):
        if job_id in self.active_connections:
            dead_sockets = set()
            for ws in list(self.active_connections[job_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.disconnect(ws, job_id)

    async def start_redis_listener(self, redis_client):
        """Lắng nghe tất cả các kênh pubsub shopee:checker:results:* và chuyển tiếp qua WebSocket."""
        try:
            pubsub = redis_client.pubsub()
            await pubsub.psubscribe(f"{REDIS_RESULTS_CHANNEL_PREFIX}:*")
            logger.info("[WebSocket Hub] Đã bật listener Redis Pub/Sub")

            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    job_id = channel.split(":")[-1]
                    try:
                        data = json.loads(message["data"])
                        await self.broadcast_to_job(job_id, data)
                    except Exception as e:
                        logger.error(f"[WebSocket Hub] Lỗi giải mã message: {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[WebSocket Hub] Lỗi Redis Pub/Sub listener: {e}")

ws_manager = WebSocketManager()
