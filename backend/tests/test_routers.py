"""Tests for modular FastAPI domain routers."""

import pytest
from fastapi.testclient import TestClient
from job_dashboard.fastapi_app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(tmp_path))
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_health_routes(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("healthy", "degraded")
    assert "jobs_count" in data["services"]

    res_alias = client.get("/api/health")
    assert res_alias.status_code == 200
    assert res_alias.json()["status"] == data["status"]


def test_metrics_routes(client):
    res = client.get("/api/metrics/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data

    res_stats = client.get("/api/stats")
    assert res_stats.status_code == 200
    assert res_stats.json()["total"] == data["total"]


def test_jobs_router(client):
    res = client.get("/api/jobs?pageSize=10")
    assert res.status_code == 200
    data = res.json()
    assert "jobs" in data
    assert "total" in data
    assert "pageSize" in data
    assert data["pageSize"] == 10


def test_search_criteria_router(client):
    res = client.get("/api/search-criteria")
    assert res.status_code == 200
    data = res.json()
    assert "queries" in data
    assert isinstance(data["queries"], list)


def test_auth_routes(client):
    res = client.get("/api/session")
    assert res.status_code == 401

    passkey_res = client.post(
        "/api/passkey-login",
        json={"email": "tester@example.com", "name": "Tester"},
    )
    assert passkey_res.status_code == 200
    data = passkey_res.json()
    assert data["success"] is True
    assert "token" in data

    token = data["token"]
    session_res = client.get(
        "/api/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session_res.status_code == 200
    assert session_res.json()["authenticated"] is True


def test_digest_routes(client):
    res = client.get("/api/digest/preview?min_score=80&limit=3")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "digest" in data
    assert "slack_blocks" in data
    assert "markdown" in data

    # Test dry-run dispatch
    dispatch_res = client.post(
        "/api/digest/dispatch",
        json={"min_score": 80, "limit": 3},
    )
    assert dispatch_res.status_code == 200
    dispatch_data = dispatch_res.json()
    assert dispatch_data["status"] == "dry_run"
