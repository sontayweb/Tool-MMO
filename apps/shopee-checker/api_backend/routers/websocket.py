from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from api_backend.ws_manager import ws_manager
from checker_engine.logger import get_logger

logger = get_logger()
router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await ws_manager.connect(websocket, job_id)
    try:
        while True:
            # Nhận ping/heartbeat từ client
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, job_id)
    except Exception as e:
        logger.debug(f"[WebSocket] Lỗi kết nối client {job_id}: {e}")
        ws_manager.disconnect(websocket, job_id)
