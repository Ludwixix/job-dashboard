import io
import json
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import DashboardApp, make_handler


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


def test_repository_user_crud_and_migration():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_jobs.db"
        repo = JobRepository(db_path)

        # 1. Create user
        user = repo.create_user(
            user_id="usr_test_1",
            email="test@example.com",
            password_hash="$2b$12$dummyhashfortestingonly",
            name="Test User"
        )
        assert user["id"] == "usr_test_1"
        assert user["email"] == "test@example.com"

        # 2. Lookup user
        found = repo.get_user_by_email("test@example.com")
        assert found is not None
        assert found["id"] == "usr_test_1"
        assert found["name"] == "Test User"

        found_by_id = repo.get_user_by_id("usr_test_1")
        assert found_by_id is not None
        assert found_by_id["email"] == "test@example.com"

        # 3. Seed data under 'default_user'
        repo.upsert_user_application("default_user", "job_1", {"status": "applied", "notes": "initial note"})
        repo.upsert_user_profile("default_user", {"title": "Full Stack Dev", "skills": ["Python", "React"]})
        repo.upsert_user_preferences("default_user", {"min_salary": 120000})
        repo.upsert_generated_document("default_user", "job_1", "resume", "Custom resume text")

        # Verify default_user data exists
        assert len(repo.get_user_applications("default_user")) == 1
        assert repo.get_user_profile("default_user")["title"] == "Full Stack Dev"
        assert repo.get_user_preferences("default_user")["min_salary"] == 120000
        assert repo.get_generated_document("default_user", "job_1", "resume")["content_text"] == "Custom resume text"

        # 4. Perform migration
        migrated_count = repo.migrate_default_user("usr_test_1")
        assert migrated_count >= 4

        # 5. Verify default_user data is gone and usr_test_1 now owns it
        assert len(repo.get_user_applications("default_user")) == 0
        assert repo.get_user_profile("default_user") == {}
        assert repo.get_user_preferences("default_user").get("min_salary") is None
        assert repo.get_generated_document("default_user", "job_1", "resume") is None

        assert len(repo.get_user_applications("usr_test_1")) == 1
        assert repo.get_user_profile("usr_test_1")["title"] == "Full Stack Dev"
        assert repo.get_user_preferences("usr_test_1")["min_salary"] == 120000
        assert repo.get_generated_document("usr_test_1", "job_1", "resume")["content_text"] == "Custom resume text"


def test_api_register_auto_migrates_default_user_data(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    repo = app.repository

    # Seed data for 'default_user'
    repo.upsert_user_application("default_user", "job_xyz", {"status": "interviewing", "notes": "phone screen"})
    repo.upsert_user_profile("default_user", {"title": "Software Engineer", "experience": "5 years"})

    handler_cls = make_handler(app)

    reg_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"email": "newuser@example.com", "password": "ComplexPassword123!", "name": "New User"}
    )
    reg_handler.do_POST()
    assert reg_handler.send_response.call_args[0][0] == 200
    res_data = parse_response(reg_handler)
    new_uid = res_data["user"]["id"]

    # Verify default_user applications are migrated to new_uid
    assert len(repo.get_user_applications("default_user")) == 0
    new_apps = repo.get_user_applications(new_uid)
    assert len(new_apps) == 1
    assert new_apps[0]["job_id"] == "job_xyz"
    assert new_apps[0]["status"] == "interviewing"
