import pytest
import string
from unittest.mock import MagicMock, patch
from shopee_arms_sync import (
    gen_random_token,
    ShopeeArmsSyncWorker
)

def test_gen_random_token_default_length():
    token = gen_random_token()
    assert len(token) == 32
    assert all(c in string.ascii_letters + string.digits for c in token)

def test_gen_random_token_custom_length():
    token16 = gen_random_token(16)
    token64 = gen_random_token(64)
    assert len(token16) == 16
    assert len(token64) == 64

def test_gen_random_token_uniqueness():
    tokens = {gen_random_token(32) for _ in range(100)}
    assert len(tokens) == 100, "100 generated tokens must all be distinct"

def test_build_shopee_request():
    worker = ShopeeArmsSyncWorker()
    base_header = {
        "user_agent": "TestUserAgent/1.0",
        "sec_ch_ua": '"Test";v="1.0"',
        "x_sap_sec": "sec_dummy_token",
        "af_ac_enc_sz_token": "sz_dummy_token"
    }

    req_headers, req_cookies, spc_f, csrf = worker.build_shopee_request(base_header)

    # 1. Kiểm tra SPC_F và csrftoken
    assert len(spc_f) == 32
    assert len(csrf) == 32
    assert req_cookies["SPC_F"] == spc_f
    assert req_cookies["csrftoken"] == csrf
    assert req_headers["x-csrftoken"] == csrf

    # 2. Kiểm tra các header bắt buộc chống bot của Shopee
    assert req_headers["origin"] == "https://shopee.vn"
    assert "buyer/login" in req_headers["referer"]
    assert req_headers["user-agent"] == "TestUserAgent/1.0"
    assert req_headers["x-sap-sec"] == "sec_dummy_token"
    assert req_headers["af-ac-enc-sz-token"] == "sz_dummy_token"
    assert req_headers["x-api-source"] == "pc"

def test_build_shopee_request_rotating():
    worker = ShopeeArmsSyncWorker()
    _, cookies1, spc1, csrf1 = worker.build_shopee_request({})
    _, cookies2, spc2, csrf2 = worker.build_shopee_request({})

    assert spc1 != spc2
    assert csrf1 != csrf2

def test_lease_accounts_success():
    worker = ShopeeArmsSyncWorker(api_url="http://test-server/api", api_key="test_key")
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "session_id": "CHK-001",
        "is_running": True,
        "accounts": [{"username": "user1", "email": "u1@shopee.vn", "password": "pass"}]
    }

    with patch("shopee_arms_sync.cffi_requests.post", return_value=mock_resp) as mock_post:
        res = worker.lease_accounts(batch_size=5)
        assert res is not None
        assert res["session_id"] == "CHK-001"
        assert len(res["accounts"]) == 1
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["headers"]["x-arms-api-key"] == "test_key"
        assert kwargs["json"] == {"batch_size": 5}

def test_lease_accounts_auth_error():
    worker = ShopeeArmsSyncWorker()
    mock_resp = MagicMock()
    mock_resp.status_code = 401

    with patch("shopee_arms_sync.cffi_requests.post", return_value=mock_resp):
        res = worker.lease_accounts(batch_size=5)
        assert res is None

def test_lease_accounts_network_error():
    worker = ShopeeArmsSyncWorker()
    with patch("shopee_arms_sync.cffi_requests.post", side_effect=Exception("Connection refused")):
        res = worker.lease_accounts(batch_size=5)
        assert res is None

def test_report_single_success():
    worker = ShopeeArmsSyncWorker()
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    payload = {
        "username": "user1",
        "status": "LIVE",
        "error_code": 0,
        "coins": 2500
    }

    with patch("shopee_arms_sync.cffi_requests.post", return_value=mock_resp) as mock_post:
        success = worker.report_single(payload)
        assert success is True
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        assert kwargs["json"]["coins"] == 2500

def test_report_single_failure():
    worker = ShopeeArmsSyncWorker()
    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch("shopee_arms_sync.cffi_requests.post", return_value=mock_resp):
        success = worker.report_single({"username": "user1"})
        assert success is False

def test_run_once_empty_password_handling():
    worker = ShopeeArmsSyncWorker()
    lease_data = {
        "session_id": "CHK-002",
        "is_running": True,
        "accounts": [
            {"username": "acc_no_pass", "email": "nopass@shopee.vn", "password": ""}
        ]
    }

    with patch.object(worker, "lease_accounts", return_value=lease_data):
        with patch.object(worker, "report_single", return_value=True) as mock_report:
            with patch("shopee_arms_sync.check_account_sync") as mock_check:
                processed = worker.run_once()
                assert processed == 1
                # Không được gọi API Shopee nếu thiếu mật khẩu
                mock_check.assert_not_called()
                # Phải tự động báo cáo WRONG_PASS / code: 2
                mock_report.assert_called_once()
                report_payload = mock_report.call_args[0][0]
                assert report_payload["status"] == "WRONG_PASS"
                assert report_payload["error_code"] == 2
                assert report_payload["username"] == "acc_no_pass"

def test_send_heartbeat():
    worker = ShopeeArmsSyncWorker(concurrency=4)
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("shopee_arms_sync.cffi_requests.post", return_value=mock_resp) as mock_post:
        res = worker.send_heartbeat()
        assert res is True
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        assert kwargs["json"]["active_threads"] == 4

def test_run_once_multithreading():
    worker = ShopeeArmsSyncWorker(concurrency=3)
    lease_data = {
        "session_id": "CHK-003",
        "is_running": True,
        "accounts": [
            {"username": "acc1", "password": "p1"},
            {"username": "acc2", "password": "p2"},
            {"username": "acc3", "password": "p3"}
        ]
    }

    with patch.object(worker, "lease_accounts", return_value=lease_data):
        with patch.object(worker, "check_single_account", return_value=True) as mock_check:
            processed = worker.run_once()
            assert processed == 3
            assert mock_check.call_count == 3

