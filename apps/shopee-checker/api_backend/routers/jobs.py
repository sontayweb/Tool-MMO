import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from checker_engine.config import JOBS_COLLECTION, REDIS_QUEUE_KEY, JobStatus
from api_backend.database import get_db
from api_backend.redis_client import get_redis
from api_backend.models import CreateJobRequest, JobResponse
from api_backend.worker_launcher import launcher
from checker_engine.logger import get_logger

logger = get_logger()
router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.post("", response_model=JobResponse)
async def create_job(req: CreateJobRequest, db=Depends(get_db), redis=Depends(get_redis)):
    if not req.accounts:
        raise HTTPException(status_code=400, detail="Danh sách tài khoản rỗng")

    job_id = str(uuid.uuid4())
    now = datetime.now()
    job_name = req.name or f"Job_{now.strftime('%Y%m%d_%H%M%S')}"

    config = req.config
    worker_count = config.worker_count if config else 10
    delay_ms = config.delay_ms if config else 500
    proxy_enabled = config.proxy_enabled if config else False
    rotate_provider = config.rotate_provider if config else None
    rotate_api_key = config.rotate_api_key if config else None
    rotate_after_n = config.rotate_after_n if config else 50

    total = len(req.accounts)
    job_doc = {
        "job_id": job_id,
        "name": job_name,
        "status": JobStatus.RUNNING.value,
        "total": total,
        "processed": 0,
        "live": 0,
        "ivs_verify": 0,
        "wrong_pass": 0,
        "failed": 0,
        "captcha": 0,
        "pending": total,
        "worker_count": worker_count,
        "delay_ms": delay_ms,
        "proxy_enabled": proxy_enabled,
        "rotate_provider": rotate_provider,
        "rotate_api_key": rotate_api_key,
        "rotate_after_n": rotate_after_n,
        "created_at": now,
        "started_at": now,
        "completed_at": None
    }

    # 1. Lưu Job vào MongoDB
    await db[JOBS_COLLECTION].insert_one(job_doc)

    # 2. Đẩy tasks vào Redis Queue
    pipe = redis.pipeline()
    for acc in req.accounts:
        task = {
            "job_id": job_id,
            "email": acc.email,
            "password": acc.password,
            "username": acc.username or acc.email.split("@")[0]
        }
        pipe.lpush(REDIS_QUEUE_KEY, json.dumps(task))
    await pipe.execute()

    # 3. Khởi chạy worker pool cho job
    await launcher.launch_workers_for_job(
        job_id=job_id,
        worker_count=worker_count,
        delay_ms=delay_ms,
        proxy_enabled=proxy_enabled,
        rotate_provider=rotate_provider,
        rotate_api_key=rotate_api_key,
        rotate_after_n=rotate_after_n
    )

    logger.info(f"[Job API] Đã tạo Job {job_id} ({job_name}) với {total} tài khoản (Proxy: {proxy_enabled}, Rotate: {rotate_provider})")
    return JobResponse(**job_doc)


@router.get("", response_model=List[JobResponse])
async def list_jobs(limit: int = 20, db=Depends(get_db)):
    cursor = db[JOBS_COLLECTION].find({}).sort("created_at", -1).limit(limit)
    jobs = []
    async for doc in cursor:
        doc.pop("_id", None)
        jobs.append(JobResponse(**doc))
    return jobs

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db=Depends(get_db)):
    doc = await db[JOBS_COLLECTION].find_one({"job_id": job_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job")
    doc.pop("_id", None)
    return JobResponse(**doc)

@router.post("/{job_id}/stop")
async def stop_job(job_id: str, db=Depends(get_db)):
    await launcher.stop_workers_for_job(job_id)
    await db[JOBS_COLLECTION].update_one(
        {"job_id": job_id},
        {"$set": {"status": JobStatus.STOPPED.value, "completed_at": datetime.now()}}
    )
    return {"status": "success", "message": f"Đã dừng Job {job_id}"}
