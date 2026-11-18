import pytest
from fastapi.testclient import TestClient
from api_backend.main import app

client = TestClient(app)

def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_import_preview_txt():
    content = b"xic3p9jukv|Khaphanyq51|84996540628|yenvya315956@hotmail.com|yenvypsu625\n"
    files = {"file": ("accounts.txt", content, "text/plain")}
    response = client.post("/api/accounts/import-preview", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total_parsed"] == 1
    assert data["accounts"][0]["email"] == "yenvya315956@hotmail.com"

def test_list_accounts_empty_query():
    response = client.get("/api/accounts?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "accounts" in data
    assert "total" in data
