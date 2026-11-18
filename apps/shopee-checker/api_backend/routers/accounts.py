from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File

from checker_engine.config import ACCOUNTS_COLLECTION, AccountStatus
from checker_engine.account_parser import parse_text_content, parse_excel_file
from api_backend.database import get_db
from api_backend.models import AccountsListResponse, AccountDetailResponse
import tempfile
from pathlib import Path

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=AccountsListResponse)
async def list_accounts(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db=Depends(get_db)
):
    query = {}
    if job_id:
        query["job_id"] = job_id
    if status and status != "ALL":
        query["status"] = status
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}}
        ]

    total = await db[ACCOUNTS_COLLECTION].count_documents(query)
    skip = (page - 1) * page_size

    cursor = db[ACCOUNTS_COLLECTION].find(query).sort("last_checked_at", -1).skip(skip).limit(page_size)
    items = []
    async for doc in cursor:
        items.append(AccountDetailResponse(
            email=doc.get("email", ""),
            username=doc.get("username", ""),
            password_plain=doc.get("password_plain", ""),
            status=doc.get("status", AccountStatus.PENDING.value),
            error_code=doc.get("error_code", -1),
            error_msg=doc.get("error_msg", ""),
            has_cookies=bool(doc.get("cookies")),
            ivs_flow_no=doc.get("ivs_flow_no"),
            last_used_proxy=doc.get("last_used_proxy"),
            last_checked_at=doc.get("last_checked_at"),
            xu_balance=doc.get("xu_balance", 0),
            display_name=doc.get("display_name", ""),
            phone_masked=doc.get("phone_masked", ""),
            account_level=doc.get("account_level", 0),
            is_seller=doc.get("is_seller", False)
        ))


    return AccountsListResponse(
        accounts=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("/import-preview")
async def preview_import_file(file: UploadFile = File(...)):
    """Upload và xem trước danh sách tài khoản được bóc tách."""
    content = await file.read()
    suffix = Path(file.filename).suffix.lower()

    if suffix in [".xlsx", ".xls"]:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
        accounts = parse_excel_file(tmp_path)
        tmp_path.unlink(missing_ok=True)
    else:
        text_content = content.decode("utf-8", errors="ignore")
        accounts = parse_text_content(text_content)

    return {
        "filename": file.filename,
        "total_parsed": len(accounts),
        "sample": accounts[:10],
        "accounts": accounts
    }


@router.post("/{email}/fetch-details")
async def fetch_account_details_on_demand(
    email: str,
    db=Depends(get_db)
):
    """
    [LUỒNG RIÊNG THEO YÊU CẦU]
    Chỉ bóc tách chi tiết Số dư Shopee Xu và Lịch sử Đơn hàng khi người dùng chủ động yêu cầu.
    Không ảnh hưởng đến tốc độ của luồng Check Live/Die thông thường.
    """
    import asyncio
    from datetime import datetime
    from checker_engine.shopee_api import get_user_coins_summary_sync, get_order_checkout_list_sync, get_account_info_sync
    from checker_engine.header_pool import HeaderPoolManager

    doc = await db[ACCOUNTS_COLLECTION].find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản trong Database")

    cookies = doc.get("cookies")
    if not cookies:
        raise HTTPException(status_code=400, detail="Tài khoản chưa có Cookie đăng nhập hợp lệ (chưa Live)")

    header_mgr = HeaderPoolManager()
    headers, _, _ = header_mgr.get_next()
    proxy = doc.get("last_used_proxy")

    # 1. Bóc thông tin basic
    basic_info = await asyncio.to_thread(
        get_account_info_sync,
        email=email,
        cookies=cookies,
        headers=headers,
        proxy=proxy
    )

    # 2. Bóc chi tiết Shopee Xu
    coins_summary = await asyncio.to_thread(
        get_user_coins_summary_sync,
        email=email,
        cookies=cookies,
        headers=headers,
        proxy=proxy
    )

    # 3. Bóc danh sách đơn hàng gần nhất
    order_summary = await asyncio.to_thread(
        get_order_checkout_list_sync,
        email=email,
        cookies=cookies,
        headers=headers,
        proxy=proxy,
        limit=5
    )

    now = datetime.now()
    update_data = {
        "detail_fetched_at": now,
        "updated_at": now
    }
    if basic_info:
        update_data.update(basic_info)
    if coins_summary:
        update_data["coins_detail"] = coins_summary
        if "user_coins" in coins_summary:
            update_data["xu_balance"] = coins_summary["user_coins"]
    if order_summary:
        update_data["order_summary"] = order_summary

    await db[ACCOUNTS_COLLECTION].update_one(
        {"email": email},
        {"$set": update_data}
    )

    return {
        "success": True,
        "email": email,
        "basic_info": basic_info,
        "coins_summary": coins_summary,
        "order_summary": order_summary,
        "updated_at": now.strftime("%Y-%m-%d %H:%M:%S")
    }


class LoginTokenRequest(BaseModel):
    email: str
    password: str
    proxy: Optional[str] = None
    auto_verify_via_outlook: bool = True


@router.post("/login-harvest-token")
async def login_harvest_token(
    req: LoginTokenRequest,
    db=Depends(get_db)
):
    """
    [LUỒNG ĐĂNG NHẬP LẤY TOKEN ĐỘC LẬP]
    Chỉ đăng nhập và thu thập Session Cookies/Token (Bypass IVS tự động qua Outlook nếu có).
    Không gọi thêm các API phụ (Xu / Đơn hàng) để tối ưu thời gian.
    Trả về định dạng Token/Cookies dùng được ngay cho các Tool khác.
    """
    import asyncio
    import time
    from datetime import datetime
    from pymongo import MongoClient
    from checker_engine.shopee_api import check_account_sync, send_email_verify_request_sync
    from checker_engine.header_pool import HeaderPoolManager
    from outlook_tool.mail_reader import read_inbox_full, verify_shopee_email_link

    email = req.email.strip()
    password = req.password.strip()

    header_mgr = HeaderPoolManager()
    headers, cookies, header_idx = header_mgr.get_next()

    # 1. Gửi request Login
    res = await asyncio.to_thread(
        check_account_sync,
        email=email,
        password_plain=password,
        headers=headers,
        cookies=cookies,
        proxy=req.proxy,
        header_idx=header_idx
    )

    now = datetime.now()
    captured_cookies = res.cookies or {}

    # 2. Xử lý trường hợp dính IVS (error 98)
    if res.status == AccountStatus.IVS_VERIFY and req.auto_verify_via_outlook:
        # Bắn email verify
        await asyncio.to_thread(
            send_email_verify_request_sync,
            v_token=res.ivs_token,
            request_id=res.ivs_flow_no,
            cookies=res.cookies,
            headers=headers,
            proxy=req.proxy
        )
        # Chờ 4s và mở Outlook đọc mail
        await asyncio.sleep(4)
        mongo_sync = MongoClient("mongodb://127.0.0.1:27017")
        ol_acc = mongo_sync["outlook_db"]["accounts"].find_one({"email": email})
        if ol_acc and ol_acc.get("sessionState"):
            shopee_mail = await asyncio.to_thread(
                read_inbox_full,
                email=email,
                session_state=ol_acc["sessionState"],
                platform="Shopee",
                unread_only=False,
                max_emails=5
            )
            if shopee_mail and shopee_mail.get("verification_link"):
                ok, final_url = await asyncio.to_thread(verify_shopee_email_link, shopee_mail["verification_link"])
                if ok:
                    res.status = AccountStatus.LIVE
                    res.error_code = 0
                    res.error_msg = "IVS Verified via Outlook"

    # 3. Format cookie string
    cookie_str = "; ".join([f"{k}={v}" for k, v in captured_cookies.items()])

    # 4. Cập nhật vào Database
    doc = {
        "email": email,
        "username": email.split("@")[0],
        "password_plain": password,
        "status": res.status.value,
        "error_code": res.error_code,
        "error_msg": res.error_msg,
        "cookies": captured_cookies,
        "cookie_string": cookie_str,
        "last_checked_at": now,
        "cookie_captured_at": now if captured_cookies else None,
        "updated_at": now
    }
    await db[ACCOUNTS_COLLECTION].update_one(
        {"email": email},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )

    return {
        "success": res.status == AccountStatus.LIVE,
        "email": email,
        "status": res.status.value,
        "error_code": res.error_code,
        "error_msg": res.error_msg,
        "cookies": captured_cookies,
        "cookie_string": cookie_str,
        "captured_at": now.strftime("%Y-%m-%d %H:%M:%S")
    }


