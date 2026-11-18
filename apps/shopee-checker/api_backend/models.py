from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from checker_engine.config import AccountStatus, JobStatus

class AccountItem(BaseModel):
    email: str
    password: str
    username: Optional[str] = ""
    phone: Optional[str] = ""

class JobConfig(BaseModel):
    worker_count: int = Field(default=10, ge=1, le=50)
    delay_ms: int = Field(default=500, ge=50, le=5000)
    proxy_enabled: bool = False
    rotate_provider: Optional[str] = None   # "tmproxy" | "shoplike" | "wwproxy"
    rotate_api_key: Optional[str] = None
    rotate_after_n: int = Field(default=50, ge=1, le=500)

class CreateJobRequest(BaseModel):
    name: Optional[str] = ""
    accounts: List[AccountItem]
    config: Optional[JobConfig] = None

class JobResponse(BaseModel):
    job_id: str
    name: str
    status: JobStatus
    total: int
    processed: int
    live: int
    ivs_verify: int
    wrong_pass: int
    failed: int
    captcha: int
    pending: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class AccountDetailResponse(BaseModel):
    email: str
    username: str
    password_plain: Optional[str] = ""
    status: AccountStatus
    error_code: int
    error_msg: Optional[str] = ""
    has_cookies: bool = False
    ivs_flow_no: Optional[str] = None
    last_used_proxy: Optional[str] = None
    last_checked_at: Optional[datetime] = None
    xu_balance: Optional[int] = 0
    display_name: Optional[str] = ""
    phone_masked: Optional[str] = ""
    account_level: Optional[int] = 0
    is_seller: Optional[bool] = False

class AccountsListResponse(BaseModel):
    accounts: List[AccountDetailResponse]
    total: int
    page: int
    page_size: int

