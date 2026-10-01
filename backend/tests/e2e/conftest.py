"""Pytest fixtures and test harness for E2E acceptance tests.

Provides:
- Isolated SQLite WAL database per test
- Seed fixtures for jobs, applications, and events
- FastAPI TestClient integration with automatic dependency overrides
- Direct repository access for DB state assertions
"""

from __future__ import annotations

import json
import sqlite3
import tempfile
from collections.abc import Generator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from job_dashboard.db import init_db
from job_dashboard.fastapi_app import create_app
from job_dashboard.repository import JobRepository


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Provide an isolated temporary directory for test database and artifacts."""
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


@pytest.fixture
def db_path(temp_dir: Path) -> str:
    """Return path to isolated SQLite database."""
    return str(temp_dir / "test_e2e.sqlite3")


@pytest.fixture
def repo(db_path: str) -> JobRepository:
    """Initialize and return a JobRepository bound to test database."""
    conn = sqlite3.connect(db_path)
    init_db(conn)
    conn.commit()
    conn.close()
    return JobRepository(db_path)


class E2ETestHarness:
    """Unified test harness dispatching HTTP requests and asserting database state."""

    def __init__(self, client: TestClient, repo: JobRepository, db_path: str):
        self.client = client
        self.repo = repo
        self.db_path = db_path

    def seed_job(
        self,
        job_id: str,
        title: str = "Staff Cloud Architect",
        company: str = "Enterprise Melbourne",
        score: int = 95,
        location: str = "Melbourne, VIC",
        data_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Seed a job record in SQLite database."""
        now = datetime.now(timezone.utc).isoformat()
        job_data = {
            "id": job_id,
            "title": title,
            "company": company,
            "score": score,
            "location": location,
            "source": "seek",
            "url": f"https://example.com/jobs/{job_id}",
            "created_at": now,
            "updated_at": now,
            "data_json": json.dumps(
                data_json or {"skills": ["Terraform", "AWS", "Kubernetes"]}
            ),
        }
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO jobs (id, title, company, score, location, source, url, created_at, updated_at, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_data["id"],
                    job_data["title"],
                    job_data["company"],
                    job_data["score"],
                    job_data["location"],
                    job_data["source"],
                    job_data["url"],
                    job_data["created_at"],
                    job_data["updated_at"],
                    job_data["data_json"],
                ),
            )
            conn.commit()
        return job_data

    def seed_application(
        self,
        job_id: str,
        user_id: str = "default_user",
        macro_stage: str = "LEAD",
        version: int = 1,
        status: str = "sourced",
    ) -> dict[str, Any]:
        """Seed a candidate application record in SQLite database."""
        now = datetime.now(timezone.utc).isoformat()
        app_id = f"app-{job_id}-{user_id}"
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO user_applications
                (id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                 resume_url, cover_letter_url, applied_at, job_data_json, macro_stage, version, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    app_id,
                    user_id,
                    job_id,
                    status,
                    "Automated E2E test application",
                    "",
                    "",
                    "",
                    "",
                    None,
                    json.dumps({"stage": macro_stage}),
                    macro_stage,
                    version,
                    now,
                ),
            )
            conn.commit()
        return {
            "id": app_id,
            "user_id": user_id,
            "job_id": job_id,
            "macro_stage": macro_stage,
            "version": version,
            "status": status,
        }

    def patch_event(
        self,
        job_id: str,
        event_type: str,
        expected_version: int | None = 1,
        idempotency_key: str | None = None,
        new_macro_stage: str | None = None,
        payload: dict[str, Any] | None = None,
        user_id: str = "default_user",
        extra_headers: dict[str, str] | None = None,
        endpoint_override: str | None = None,
    ):
        """Dispatch PATCH request to event endpoint."""
        endpoint = endpoint_override or f"/api/v1/jobs/{job_id}/events"
        headers = {
            "Content-Type": "application/json",
            "X-User-Id": user_id,
        }
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key
        if extra_headers:
            headers.update(extra_headers)

        body: dict[str, Any] = {
            "event_type": event_type,
        }
        if expected_version is not None:
            body["expected_version"] = expected_version
        if new_macro_stage is not None:
            body["new_macro_stage"] = new_macro_stage
        if payload is not None:
            body["payload"] = payload
            body["payload_json"] = json.dumps(payload)

        return self.client.patch(endpoint, headers=headers, json=body)

    def get_events(self, job_id: str, user_id: str = "default_user"):
        """Query application timeline events."""
        headers = {"X-User-Id": user_id}
        # Check both modern v1 and legacy applications route
        res = self.client.get(f"/api/applications/{job_id}/events", headers=headers)
        return res

    def get_queue(
        self, limit: int = 50, offset: int = 0, user_id: str = "default_user"
    ):
        """Query prioritized action queue."""
        headers = {"X-User-Id": user_id}
        return self.client.get(
            f"/api/v1/jobs/queue?limit={limit}&offset={offset}", headers=headers
        )

    def get_raw_events_count(self, idempotency_key: str | None = None) -> int:
        """Direct database count of events in user_application_events."""
        with sqlite3.connect(self.db_path) as conn:
            if idempotency_key:
                cur = conn.execute(
                    "SELECT COUNT(*) FROM user_application_events WHERE idempotency_key = ?",
                    (idempotency_key,),
                )
            else:
                cur = conn.execute("SELECT COUNT(*) FROM user_application_events")
            return cur.fetchone()[0]

    def get_raw_application(
        self, user_id: str, job_id: str
    ) -> dict[str, Any] | None:
        """Direct database read of user_applications."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM user_applications WHERE user_id = ? AND job_id = ?",
                (user_id, job_id),
            ).fetchone()
            return dict(row) if row else None


@pytest.fixture
def e2e_harness(
    temp_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[E2ETestHarness, None, None]:
    """Provide instantiated E2ETestHarness bound to FastAPI TestClient and isolated DB."""
    db_file = temp_dir / "jobs.sqlite3"
    monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(temp_dir))

    # Initialize tables
    conn = sqlite3.connect(str(db_file))
    init_db(conn)
    conn.commit()
    conn.close()

    app = create_app()
    with TestClient(app) as test_client:
        repo_instance = JobRepository(str(db_file))
        harness = E2ETestHarness(
            client=test_client, repo=repo_instance, db_path=str(db_file)
        )
        yield harness
