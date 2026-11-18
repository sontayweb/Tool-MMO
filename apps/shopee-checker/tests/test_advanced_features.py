import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api_backend.main import app
from checker_engine.proxy_manager import ProxyManager
from checker_engine.shopee_api import get_account_info_sync, CheckResult
from checker_engine.config import AccountStatus

client = TestClient(app)

def test_admin_headers_endpoint():
    response = client.get("/api/admin/headers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_proxy_manager_rotation_logic():
    pm = ProxyManager(
        rotate_provider="tmproxy",
        rotate_api_key="test_token_123",
        rotate_after_n_requests=3
    )
    assert pm.rotate_provider == "tmproxy"
    assert pm.rotate_api_key == "test_token_123"
    assert pm.rotate_after_n == 3

    # Test URL template formation
    url = pm.PROVIDER_API["tmproxy"].format(api_key=pm.rotate_api_key)
    assert "token=test_token_123" in url

@pytest.mark.asyncio
async def test_proxy_manager_maybe_rotate_ip():
    pm = ProxyManager(
        rotate_provider="tmproxy",
        rotate_api_key="mock_key",
        rotate_after_n_requests=2
    )

    with patch.object(pm, "rotate_ip", return_value=True) as mock_rotate:
        # 1st request -> should not rotate
        rotated1 = await pm.maybe_rotate_ip()
        assert not rotated1
        assert mock_rotate.call_count == 0

        # 2nd request -> reaches threshold 2 -> should rotate
        rotated2 = await pm.maybe_rotate_ip()
        assert rotated2
        assert mock_rotate.call_count == 1

def test_get_account_info_sync_mock():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": {
            "shopid": 987654321,
            "username": "tester_shopee",
            "name": "Nguyen Van Test",
            "phone": "+84 *** 999",
            "point": 5000,
            "level": 3,
            "is_seller": True,
            "ctime": 1600000000
        }
    }

    with patch("curl_cffi.requests.get", return_value=mock_resp):
        info = get_account_info_sync(
            email="test@domain.com",
            cookies={"csrftoken": "mock_csrf"},
            headers={"user-agent": "test-agent"}
        )
        assert info["xu_balance"] == 5000
        assert info["display_name"] == "Nguyen Van Test"
        assert info["phone_masked"] == "+84 *** 999"
        assert info["account_level"] == 3
        assert info["is_seller"] is True
