import os
import sys
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

# Reconfigure stdout for Windows terminal if available
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"

# MongoDB & Redis Settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "ShopeeTool")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Collections
ACCOUNTS_COLLECTION = "accounts"
JOBS_COLLECTION = "jobs"
HEADER_POOL_COLLECTION = "header_pool"
IVS_QUEUE_COLLECTION = "ivs_queue"

# Redis Keys
REDIS_QUEUE_KEY = "shopee:checker:queue"
REDIS_COOLDOWN_KEY = "shopee:checker:cooldown"
REDIS_RESULTS_CHANNEL_PREFIX = "shopee:checker:results"

# API & Execution Defaults
DEFAULT_WORKER_COUNT = int(os.getenv("DEFAULT_WORKER_COUNT", "10"))
DEFAULT_DELAY_MS = int(os.getenv("DEFAULT_DELAY_MS", "500"))
HEADER_POOL_PATH = BASE_DIR / os.getenv("HEADER_POOL_PATH", "data/header_pool.json")
PROXIES_PATH = BASE_DIR / os.getenv("PROXIES_PATH", "data/proxies.txt")

SHOPEE_LOGIN_URL = "https://shopee.vn/api/v4/account/login_by_password"

class AccountStatus(str, Enum):
    PENDING = "PENDING"
    LIVE = "LIVE"
    IVS_VERIFY = "IVS_VERIFY"
    WRONG_PASS = "WRONG_PASS"
    BANNED = "BANNED"
    FAILED = "FAILED"
    CAPTCHA = "CAPTCHA"
    RATE_LIMIT = "RATE_LIMIT"
    TIMEOUT = "TIMEOUT"

class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    STOPPED = "STOPPED"
