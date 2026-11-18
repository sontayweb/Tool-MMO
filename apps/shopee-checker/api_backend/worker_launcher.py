import asyncio
from typing import Dict, List
from checker_engine.worker import CheckerWorker
from checker_engine.logger import get_logger

logger = get_logger()

class WorkerLauncher:
    def __init__(self):
        self.active_workers: Dict[str, List[CheckerWorker]] = {}
        self.worker_tasks: Dict[str, List[asyncio.Task]] = {}

    async def launch_workers_for_job(
        self,
        job_id: str,
        worker_count: int = 10,
        delay_ms: int = 500,
        proxy_enabled: bool = False,
        rotate_provider: str = None,
        rotate_api_key: str = None,
        rotate_after_n: int = 50
    ):
        """Khởi chạy N worker tasks cho job."""
        workers = []
        tasks = []

        logger.info(f"[Launcher] Khởi chạy {worker_count} workers cho Job {job_id} (Proxy: {proxy_enabled}, Rotate: {rotate_provider})...")
        for i in range(1, worker_count + 1):
            w = CheckerWorker(
                delay_ms=delay_ms,
                proxy_enabled=proxy_enabled,
                rotate_provider=rotate_provider,
                rotate_api_key=rotate_api_key,
                rotate_after_n=rotate_after_n
            )
            connected = await w.connect()
            if connected:
                workers.append(w)
                t = asyncio.create_task(w.run_queue_worker(worker_id=i))
                tasks.append(t)

        self.active_workers[job_id] = workers
        self.worker_tasks[job_id] = tasks
        return len(workers)


    async def stop_workers_for_job(self, job_id: str):
        """Dừng tất cả workers của job."""
        if job_id in self.active_workers:
            for w in self.active_workers[job_id]:
                w.stop()
                await w.disconnect()
            for t in self.worker_tasks.get(job_id, []):
                t.cancel()
            del self.active_workers[job_id]
            if job_id in self.worker_tasks:
                del self.worker_tasks[job_id]
            logger.info(f"[Launcher] Đã dừng tất cả workers của Job {job_id}")

launcher = WorkerLauncher()
