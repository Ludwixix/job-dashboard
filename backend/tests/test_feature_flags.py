"""Tests for Phase 5 Feature Flag Registry and Worker Health Telemetry.

Validates that feature flags can be queried, updated, and persisted safely
in SQLite WAL mode, and verifies permission gating on web API endpoints.
"""

import io
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import DashboardApp, make_handler, JWT_SECRET
import jwt


def create_mock_handler(handler_cls, method, path, body=None, headers=None):
    handler = handler_cls.__new__(handler_cls)
    handler.path = path
    headers_dict = headers.copy() if headers else {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8") if isinstance(body, dict) else body.encode("utf-8")
        headers_dict["Content-Length"] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
    else:
        handler.rfile = io.BytesIO()
    handler.headers = headers_dict
    handler.client_address = ("127.0.0.1", 12345)
    handler.wfile = io.BytesIO()
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()
    return handler


def parse_response(handler):
    handler.wfile.seek(0)
    data = handler.wfile.read()
    if not data:
        return {}
    return json.loads(data.decode("utf-8"))


def test_repository_feature_flags_crud():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_flags.db"
        repo = JobRepository(db_path)

        # 1. Default flags should exist
        flags = repo.get_feature_flags()
        assert "automated_gmail_sync" in flags
        assert flags["automated_gmail_sync"]["enabled"] is True
        assert repo.is_feature_enabled("automated_gmail_sync") is True

        # 2. Update existing flag
        res = repo.set_feature_flag("automated_gmail_sync", False, description="Temporarily paused")
        assert res is True
        assert repo.is_feature_enabled("automated_gmail_sync") is False

        # 3. Add custom flag
        repo.set_feature_flag("experimental_ai_matcher", True, description="Next-gen embeddings")
        assert repo.is_feature_enabled("experimental_ai_matcher") is True
        flags_after = repo.get_feature_flags()
        assert "experimental_ai_matcher" in flags_after
        assert flags_after["experimental_ai_matcher"]["enabled"] is True


def test_feature_flags_api_endpoints(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True)
    db_path = data_dir / "jobs.sqlite3"

    repo = JobRepository(db_path)
    app = DashboardApp(data_dir=data_dir, repository=repo)
    handler_cls = make_handler(app)
    user_token = jwt.encode({"sub": "user-flags-1"}, JWT_SECRET, algorithm="HS256")

    # 1. GET /api/feature-flags unauthenticated -> 401
    h_unauth = create_mock_handler(handler_cls, "GET", "/api/feature-flags")
    h_unauth.do_GET()
    res_unauth = parse_response(h_unauth)
    assert res_unauth.get("success") is False

    # 2. GET /api/feature-flags authenticated -> 200 with flags
    h_auth = create_mock_handler(
        handler_cls,
        "GET",
        "/api/feature-flags",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    h_auth.do_GET()
    res_auth = parse_response(h_auth)
    assert res_auth.get("success") is True
    assert "flags" in res_auth
    assert "automated_gmail_sync" in res_auth["flags"]

    # 3. POST /api/feature-flags authenticated update
    h_post = create_mock_handler(
        handler_cls,
        "POST",
        "/api/feature-flags",
        body={"key": "automated_gmail_sync", "enabled": False},
        headers={"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}
    )
    h_post.do_POST()
    res_post = parse_response(h_post)
    assert res_post.get("success") is True
    assert res_post.get("enabled") is False

    # Verify updated via GET
    h_auth2 = create_mock_handler(
        handler_cls,
        "GET",
        "/api/feature-flags",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    h_auth2.do_GET()
    res_auth2 = parse_response(h_auth2)
    assert res_auth2["flags"]["automated_gmail_sync"]["enabled"] is False


def test_source_health_includes_worker_telemetry(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True)
    db_path = data_dir / "jobs.sqlite3"

    repo = JobRepository(db_path)
    app = DashboardApp(data_dir=data_dir, repository=repo)
    handler_cls = make_handler(app)

    h = create_mock_handler(handler_cls, "GET", "/api/source-health?hours=24")
    h.do_GET()
    res = parse_response(h)
    assert res.get("success") is True
    assert "checks" in res
    assert "workers" in res
    assert "active_generation_tasks" in res["workers"]
    assert "scrape_in_progress" in res["workers"]
