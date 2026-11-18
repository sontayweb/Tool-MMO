import pytest
import asyncio
from pathlib import Path
from checker_engine.config import MONGO_URI, MONGO_DB_NAME, REDIS_URL
from checker_engine.hasher import hash_shopee_password
from checker_engine.account_parser import parse_text_content
from checker_engine.header_pool import HeaderPoolManager
from checker_engine.excel_handler import export_accounts_to_excel
from checker_engine.shopee_api import check_account_sync, AccountStatus
from pymongo import MongoClient
import redis

def test_full_system_components():
    # 1. Test Hasher
    hashed = hash_shopee_password("Thuthuanqr73")
    assert hashed == "c086507a4d4aac2385fc96e70e1dc33a7b21e65b33bfe9e0fb80cff68c129c81"

    # 2. Test Parser
    sample_text = "xic3p9jukv|Khaphanyq51|84996540628|yenvya315956@hotmail.com|yenvypsu625\n"
    parsed = parse_text_content(sample_text)
    assert len(parsed) == 1
    assert parsed[0]["email"] == "yenvya315956@hotmail.com"
    assert parsed[0]["password"] == "Khaphanyq51"

    # 3. Test Header Pool
    mgr = HeaderPoolManager()
    headers, cookies, idx = mgr.get_next()
    assert "x-sap-sec" in headers
    assert "x-sap-ri" in headers
    assert len(headers["x-sap-ri"]) == 52

    # 4. Test Excel Export
    dummy_results = [
        {
            "username": "user1",
            "email": "test1@gmail.com",
            "password_plain": "pass123",
            "status": "LIVE",
            "error_code": 0,
            "error_msg": "OK",
            "cookies": {"SPC_ST": "abc"},
            "last_checked_at": None,
            "last_used_proxy": "Direct"
        },
        {
            "username": "user2",
            "email": "test2@gmail.com",
            "password_plain": "pass456",
            "status": "WRONG_PASS",
            "error_code": 2,
            "error_msg": "Sai Pass",
            "cookies": {},
            "last_checked_at": None,
            "last_used_proxy": "Direct"
        }
    ]
    test_excel_path = Path("data/test_output.xlsx")
    export_accounts_to_excel(dummy_results, test_excel_path)
    assert test_excel_path.exists()
    assert test_excel_path.stat().st_size > 1000
    test_excel_path.unlink(missing_ok=True)

def test_mongodb_connection():
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        assert True
    except Exception as e:
        pytest.skip(f"MongoDB local service chưa bật: {e}")

def test_redis_connection():
    try:
        r = redis.from_url(REDIS_URL, socket_timeout=2)
        r.ping()
        assert True
    except Exception as e:
        pytest.skip(f"Redis local service chưa bật: {e}")
