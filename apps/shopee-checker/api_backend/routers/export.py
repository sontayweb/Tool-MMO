import tempfile
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from checker_engine.config import ACCOUNTS_COLLECTION
from checker_engine.excel_handler import export_accounts_to_excel
from api_backend.database import get_db

router = APIRouter(prefix="/api/export", tags=["Export"])

@router.get("/{job_id}")
async def export_job_results(
    job_id: str,
    status: Optional[str] = Query(None),
    db=Depends(get_db)
):
    query = {"job_id": job_id}
    if status and status != "ALL":
        query["status"] = status

    cursor = db[ACCOUNTS_COLLECTION].find(query).sort("last_checked_at", -1)
    accounts = []
    async for doc in cursor:
        doc.pop("_id", None)
        accounts.append(doc)

    if not accounts:
        raise HTTPException(status_code=404, detail="Không có tài khoản nào phù hợp để xuất Excel")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp_path = tmp.name

    export_accounts_to_excel(accounts, tmp_path)
    return FileResponse(
        path=tmp_path,
        filename=f"Shopee_CheckResult_{job_id[:8]}_{status or 'ALL'}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
