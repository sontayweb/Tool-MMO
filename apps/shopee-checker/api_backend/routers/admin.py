from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pathlib import Path
import json

from checker_engine.config import HEADER_POOL_PATH
from checker_engine.header_refresher import HeaderRefresher
from checker_engine.logger import get_logger

logger = get_logger()
router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/headers")
async def list_headers():
    """Lấy danh sách các bộ headers trong pool hiện tại."""
    if not HEADER_POOL_PATH.exists():
        return []
    try:
        with open(HEADER_POOL_PATH, "r", encoding="utf-8") as f:
            headers = json.load(f) or []
        return headers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc header pool: {e}")

@router.post("/refresh-headers")
async def trigger_refresh_headers():
    """Kích hoạt Playwright để tự động bắt headers bảo mật mới từ Shopee."""
    try:
        refresher = HeaderRefresher()
        result = await refresher.capture_one_session(label="WebAdmin_Manual_Trigger")
        if result:
            return {
                "status": "success",
                "message": "Đã bắt và lưu thành công bộ headers bảo mật mới từ Shopee!",
                "data": {
                    "label": result.get("label"),
                    "captured_at": result.get("captured_at"),
                    "has_sap_sec": bool(result.get("x_sap_sec")),
                    "has_sz_token": bool(result.get("af_ac_enc_sz_token"))
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Không thể trích xuất headers từ Shopee. Vui lòng kiểm tra lại môi trường Playwright.")
    except Exception as e:
        logger.error(f"[Admin API] Lỗi refresh headers: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi thực thi: {str(e)}")
