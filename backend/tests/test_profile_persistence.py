import io
import json
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import make_handler, DashboardApp

@pytest.fixture
def test_app_and_handler(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo

    # Ensure users and user_profiles table exist
    with repo.get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                email_verified INTEGER DEFAULT 0,
                email_verification_code TEXT,
                email_verification_expires_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                profile_data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()

    handler_cls = make_handler(app)
    return app, handler_cls

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

def test_auth_profile_persistence_lifecycle(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    # 1. Register new user
    reg_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"email": "candidate@example.com", "password": "SecurePassword123!", "name": "Jane Doe"}
    )
    reg_handler.do_POST()
    assert reg_handler.send_response.call_args[0][0] == 200
    reg_data = parse_response(reg_handler)
    assert reg_data["success"] is True
    assert reg_data["profile"] is None
    assert reg_data["has_profile"] is False
    token = reg_data["token"]
    user_id = reg_data["user"]["id"]

    # 2. Verify Session initially has no profile
    session_handler = create_mock_handler(
        handler_cls,
        "GET",
        "/api/session",
        headers={"Authorization": f"Bearer {token}"}
    )
    session_handler.do_GET()
    assert session_handler.send_response.call_args[0][0] == 200
    session_data = parse_response(session_handler)
    assert session_data["has_profile"] is False
    assert session_data["profile"] is None

    # 3. Upsert User Profile
    profile_payload = {
        "id": user_id,
        "name": "Jane Doe",
        "title": "Lead Software Architect",
        "industry": "Engineering & Technology",
        "seniority": "Lead",
        "skills": ["Python", "React", "Docker", "Kubernetes", "AWS"]
    }
    profile_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/profile",
        body=profile_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    profile_handler.do_POST()
    assert profile_handler.send_response.call_args[0][0] == 200
    prof_resp = parse_response(profile_handler)
    assert prof_resp["success"] is True
    assert prof_resp["profile"]["industry"] == "Engineering & Technology"

    # 4. Login now returns persisted profile & has_profile=True
    login_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/login",
        body={"email": "candidate@example.com", "password": "SecurePassword123!"}
    )
    login_handler.do_POST()
    assert login_handler.send_response.call_args[0][0] == 200
    login_data = parse_response(login_handler)
    assert login_data["has_profile"] is True
    assert login_data["profile"]["seniority"] == "Lead"
    assert "Kubernetes" in login_data["profile"]["skills"]

    # 5. Session also returns persisted profile
    session_handler2 = create_mock_handler(
        handler_cls,
        "GET",
        "/api/session",
        headers={"Authorization": f"Bearer {login_data['token']}"}
    )
    session_handler2.do_GET()
    assert session_handler2.send_response.call_args[0][0] == 200
    session_data2 = parse_response(session_handler2)
    assert session_data2["has_profile"] is True
    assert session_data2["profile"]["title"] == "Lead Software Architect"


def test_gcs_backup_includes_profile_and_query_files():
    from job_dashboard.gcs_backup import BACKUP_FILENAMES
    assert "job_profile.json" in BACKUP_FILENAMES
    assert "search_queries.json" in BACKUP_FILENAMES
    assert "jobs.sqlite3" in BACKUP_FILENAMES


def test_profile_multi_sink_persistence(test_app_and_handler):
    app, handler_cls = test_app_and_handler
    user_id = "sam_ludwig"

    profile_data = {
        "id": user_id,
        "name": "Sam Ludwig",
        "title": "Principal Cloud Architect",
        "industry": "Technology",
        "coreSkills": ["Kubernetes", "Azure", "Terraform", "Python"]
    }

    handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/profile",
        body=profile_data,
        headers={"X-User-Id": user_id}
    )
    handler.do_POST()
    assert handler.send_response.call_args[0][0] == 200
    res = parse_response(handler)
    assert res["success"] is True
    assert res["profile"]["title"] == "Principal Cloud Architect"

    # Verify sink 1: SQLite database
    persisted_db = app.repository.get_user_profile(user_id)
    assert persisted_db["title"] == "Principal Cloud Architect"
    assert "Terraform" in persisted_db["coreSkills"]

    # Verify sink 2: in-memory dashboard profile
    assert app.dashboard.profile["title"] == "Principal Cloud Architect"

    # Verify sink 3: data_dir / job_profile.json file on disk
    json_path = Path(app.data_dir) / "job_profile.json"
    assert json_path.exists()
    disk_profile = json.loads(json_path.read_text(encoding="utf-8"))
    assert disk_profile["title"] == "Principal Cloud Architect"
    assert disk_profile["name"] == "Sam Ludwig"


def test_get_profile_fallback_cascade(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    # Seed the database with an active profile
    app.repository.upsert_user_profile("candidate_user", {
        "name": "Sam Ludwig",
        "title": "Enterprise Cloud Engineer",
        "industry": "Cloud Infrastructure"
    })

    # Query with a different user_id that doesn't exist yet
    handler = create_mock_handler(
        handler_cls,
        "GET",
        "/api/profile",
        headers={"X-User-Id": "new_unmatched_user"}
    )
    handler.do_GET()
    assert handler.send_response.call_args[0][0] == 200
    res = parse_response(handler)
    assert res["success"] is True
    # Falls back to latest database profile
    assert res["profile"]["name"] == "Sam Ludwig"
    assert res["profile"]["title"] == "Enterprise Cloud Engineer"

