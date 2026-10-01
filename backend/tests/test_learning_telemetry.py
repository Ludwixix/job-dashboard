"""Unit and Integration Tests for Milestone M1: Telemetry Pipeline & Database Schema.

Validates:
1. SQLite WAL DDL & Schema Migration Idempotency.
2. Exact Signal Weights (6 core signals + aliases).
3. 30-Day Half-Life Exponential Decay Math: w(t) = w0 * 2^(-Delta_t / 30.0).
4. 4-Dimension Pattern Mining:
   - Technical Stacks & Skills (graduation threshold: weight >= 12.0 or roles >= 3)
   - Role Archetypes & Seniority (weighted tier and trajectory velocity)
   - Industry & Sector Clusters (affinity percentages)
   - Remuneration Anchoring (hourly/daily normalization, weighted mean, p25/p75)
5. Repository Telemetry & Achievement Persistence.
6. REST API Endpoints:
   - POST /api/telemetry/events
   - GET /api/learning/patterns
"""

from __future__ import annotations

import io
import json
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
from urllib.parse import urlencode

import pytest

from job_dashboard.db import SCHEMA_DDL, init_db
from job_dashboard.repository import JobRepository
from job_dashboard.telemetry import (
    calculate_decayed_weight,
    compute_decay_weight,
    extract_skills_from_event,
    get_signal_weight,
    mine_career_patterns,
    parse_annual_salary,
    parse_timestamp,
)
from job_dashboard.web import DashboardApp, make_handler

# ==============================================================================
# 1. Database Schema & WAL Mode Tests
# ==============================================================================


def test_schema_ddl_contains_telemetry_and_achievements():
    """Verify SCHEMA_DDL defines both user_learning_telemetry and user_achievements."""
    assert "user_learning_telemetry" in SCHEMA_DDL
    assert "user_achievements" in SCHEMA_DDL
    assert "idx_telemetry_user" in SCHEMA_DDL
    assert "idx_achievements_user" in SCHEMA_DDL


def test_db_init_creates_tables_and_wal_mode():
    """Verify init_db initializes tables in WAL mode without error."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_jobs.sqlite3"
        conn = sqlite3.connect(str(db_path))
        init_db(conn)

        # Check WAL mode
        mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        assert mode.lower() == "wal"

        # Check tables exist
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table';"
            ).fetchall()
        }
        assert "user_learning_telemetry" in tables
        assert "user_achievements" in tables

        conn.close()


def test_repository_migration_idempotent_on_existing_db():
    """Verify JobRepository._init_schema safely migrates an existing legacy DB."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "legacy.sqlite3"
        # Create a valid pre-M1 database with jobs and users without M1 tables
        conn = sqlite3.connect(str(db_path))
        conn.execute("""
            CREATE TABLE jobs (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
                location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
                remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
                data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
                password_hash TEXT NOT NULL, created_at TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE TABLE user_applications (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, job_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'sourced', notes TEXT DEFAULT '',
                resume_text TEXT DEFAULT '', cover_letter_text TEXT DEFAULT '',
                resume_url TEXT DEFAULT '', cover_letter_url TEXT DEFAULT '',
                applied_at TEXT, job_data_json TEXT DEFAULT '{}', updated_at TEXT NOT NULL,
                UNIQUE(user_id, job_id)
            );
        """)
        conn.commit()
        conn.close()

        # Instantiate JobRepository which executes _init_schema
        repo = JobRepository(str(db_path))
        with repo.get_connection() as c:
            tables = {
                row[0]
                for row in c.execute(
                    "SELECT name FROM sqlite_master WHERE type='table';"
                ).fetchall()
            }
            assert "user_learning_telemetry" in tables
            assert "user_achievements" in tables

        # Re-running _init_schema must not raise OperationalError
        repo._init_schema()


# ==============================================================================
# 2. Signal Weights & Half-Life Decay Tests
# ==============================================================================


def test_exact_signal_weights():
    """Verify exact numerical weights for the 6 core signals and their aliases."""
    # Core 6 signals required by user specification:
    # applied: +5.0
    # interview_scheduled: +6.0
    # package_prepared / generated_docs: +4.0
    # starred / saved: +2.0
    # viewed: +0.5
    # dismissed / rejected: -2.0
    assert get_signal_weight("applied") == 5.0
    assert get_signal_weight("interview_scheduled") == 6.0
    assert get_signal_weight("package_prepared") == 4.0
    assert get_signal_weight("generated_docs") == 4.0
    assert get_signal_weight("starred") == 2.0
    assert get_signal_weight("saved") == 2.0
    assert get_signal_weight("viewed") == 0.5
    assert get_signal_weight("dismissed") == -2.0
    assert get_signal_weight("rejected") == -2.0

    # Aliases
    assert get_signal_weight("submitted") == 5.0
    assert get_signal_weight("interviewing") == 6.0
    assert get_signal_weight("ksc_generated") == 4.0
    assert get_signal_weight("card_expanded") == 0.5


def test_half_life_exponential_decay_math():
    """Verify w(t) = w0 * 2^(-Delta_t / 30.0)."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Delta_t = 0 days -> factor is 1.0 (w = w0)
    w_0d = calculate_decayed_weight(5.0, now, now=now)
    assert pytest.approx(w_0d, rel=1e-5) == 5.0

    # 2. Delta_t = 30 days -> factor is 0.5 (w = w0 * 0.5)
    t_30d = now - timedelta(days=30)
    w_30d = calculate_decayed_weight(5.0, t_30d, now=now)
    assert pytest.approx(w_30d, rel=1e-5) == 2.5

    # 3. Delta_t = 60 days -> factor is 0.25 (w = w0 * 0.25)
    t_60d = now - timedelta(days=60)
    w_60d = calculate_decayed_weight(4.0, t_60d, now=now)
    assert pytest.approx(w_60d, rel=1e-5) == 1.0

    # 4. Delta_t = 90 days -> factor is 0.125
    t_90d = now - timedelta(days=90)
    w_90d = calculate_decayed_weight(6.0, t_90d, now=now)
    assert pytest.approx(w_90d, rel=1e-5) == 0.75

    # 5. Negative weight decays towards 0 (e.g. -2.0 -> -1.0 at 30 days)
    w_neg_30d = calculate_decayed_weight(-2.0, t_30d, now=now)
    assert pytest.approx(w_neg_30d, rel=1e-5) == -1.0

    # 6. Future timestamp (clock skew safeguard): Delta_t clamped to 0.0 -> factor is 1.0
    t_future = now + timedelta(days=5)
    w_future = calculate_decayed_weight(5.0, t_future, now=now)
    assert pytest.approx(w_future, rel=1e-5) == 5.0


# ==============================================================================
# 3. 4-Dimension Pattern Mining Tests
# ==============================================================================


def test_pattern_mining_skills_and_graduation():
    """Verify technical skill extraction, cumulative weight, and graduation threshold."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    # 3 distinct roles with Terraform applied (+5.0 each at t=0 -> sum = 15.0 >= 12.0 and roles = 3)
    events = [
        {
            "event_type": "applied",
            "job_id": "job_1",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Cloud Infrastructure Engineer",
                "skills": ["Terraform", "Azure"],
            },
        },
        {
            "event_type": "applied",
            "job_id": "job_2",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Lead DevOps Engineer",
                "skills": ["Terraform", "Kubernetes"],
            },
        },
        {
            "event_type": "applied",
            "job_id": "job_3",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Senior Platform Engineer",
                "skills": ["Terraform", "Ansible"],
            },
        },
        # Ansible only has 1 event (+5.0, roles=1) -> not graduated
    ]

    patterns = mine_career_patterns(events, now=now)
    skills = {item["skill"]: item for item in patterns["skills"]}

    assert "Terraform" in skills
    tf = skills["Terraform"]
    assert pytest.approx(tf["cumulative_weight"], rel=1e-4) == 15.0
    assert tf["distinct_roles_count"] == 3
    assert tf["graduated"] is True
    assert tf["progress_pct"] == 100.0

    assert "Ansible" in skills
    ansible = skills["Ansible"]
    assert pytest.approx(ansible["cumulative_weight"], rel=1e-4) == 5.0
    assert ansible["distinct_roles_count"] == 1
    assert ansible["graduated"] is False
    assert ansible["progress_pct"] < 100.0


def test_pattern_mining_seniority_and_velocity():
    """Verify role seniority tier mapping and trajectory velocity."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    # Older event: Mid-level Systems Administrator (Tier 2) 20 days ago
    # Recent events: Senior / Principal Cloud Architect (Tier 3 & 4) 2 days ago
    events = [
        {
            "event_type": "applied",
            "job_id": "job_old",
            "occurred_at": (now - timedelta(days=20)).isoformat(),
            "job_snapshot": {"title": "Systems Administrator"},
        },
        {
            "event_type": "applied",
            "job_id": "job_recent_1",
            "occurred_at": (now - timedelta(days=2)).isoformat(),
            "job_snapshot": {"title": "Senior Cloud Infrastructure Engineer"},
        },
        {
            "event_type": "applied",
            "job_id": "job_recent_2",
            "occurred_at": (now - timedelta(days=1)).isoformat(),
            "job_snapshot": {"title": "Principal Solutions Architect"},
        },
    ]

    patterns = mine_career_patterns(events, now=now)
    seniority = patterns["seniority"]
    assert seniority["weighted_tier"] >= 2.5
    assert "trajectory" in seniority
    assert "Upward" in seniority["trajectory"] or "Senior" in seniority["current_label"]


def test_pattern_mining_industry_clusters():
    """Verify sector clustering and affinity breakdown."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    events = [
        {
            "event_type": "applied",
            "job_id": "job_vps",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Cloud Engineer",
                "company": "Victorian Public Sector",
            },
        },
        {
            "event_type": "applied",
            "job_id": "job_health",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Systems Engineer",
                "company": "Monash Health Hospital",
            },
        },
    ]

    patterns = mine_career_patterns(events, now=now)
    clusters = {c["sector"]: c for c in patterns["industry_clusters"]}

    assert "Victorian Public Sector / Government" in clusters
    assert "Healthcare & Clinical" in clusters
    assert clusters["Victorian Public Sector / Government"]["affinity_pct"] > 0


def test_pattern_mining_remuneration_anchoring():
    """Verify salary extraction, hourly/daily conversion, and percentiles."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    events = [
        {
            "event_type": "applied",
            "job_id": "job_sal_1",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Senior Cloud Engineer",
                "salary": "$150,000 - $160,000",
            },
        },
        {
            "event_type": "applied",
            "job_id": "job_sal_2",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Lead Infrastructure Engineer",
                "salary": "$170,000 - $180,000 package",
            },
        },
        {
            "event_type": "applied",
            "job_id": "job_sal_daily",
            "occurred_at": now.isoformat(),
            "job_snapshot": {
                "title": "Cloud Consultant Contract",
                "salary": "$800 per day",  # 800 * 240 = $192,000
            },
        },
    ]

    patterns = mine_career_patterns(events, now=now)
    salary = patterns["salary_anchoring"]

    assert salary["weighted_mean"] >= 150000
    assert salary["p25"] >= 140000
    assert salary["p75"] <= 200000
    assert salary["recommended_min"] > 0


# ==============================================================================
# 4. Repository Telemetry & Achievement Persistence Tests
# ==============================================================================


def test_repository_telemetry_and_achievements_crud():
    """Verify repository methods for telemetry ingestion and achievement persistence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_repo.sqlite3"
        repo = JobRepository(str(db_path))

        # 1. Insert telemetry event
        event_data = {
            "user_id": "sam_ludwig",
            "event_type": "applied",
            "job_id": "job_999",
            "job_title": "Senior Cloud Platform Engineer",
            "company": "Victorian Public Sector",
            "skills": ["Terraform", "Azure", "Kubernetes"],
            "job_snapshot": {"title": "Senior Cloud Platform Engineer"},
            "metadata": {"source": "seek"},
        }
        event_id = repo.insert_telemetry_event(event_data)
        assert isinstance(event_id, int)
        assert event_id > 0

        # 2. Query telemetry events
        events = repo.get_telemetry_events("sam_ludwig")
        assert len(events) == 1
        assert events[0]["event_type"] == "applied"
        assert events[0]["signal_weight"] == 5.0
        assert "Terraform" in events[0]["skills"]

        # 3. Batch insert
        batch_events = [
            {
                "user_id": "sam_ludwig",
                "event_type": "starred",
                "job_id": "job_888",
                "skills": ["AWS", "Python"],
            },
            {
                "user_id": "sam_ludwig",
                "event_type": "interview_scheduled",
                "job_id": "job_777",
                "skills": ["Kubernetes"],
            },
        ]
        inserted_ids = repo.batch_insert_telemetry(batch_events)
        assert len(inserted_ids) == 2

        all_events = repo.get_telemetry_events("sam_ludwig")
        assert len(all_events) == 3

        # 4. Upsert user achievement
        ach = repo.upsert_user_achievement(
            user_id="sam_ludwig",
            achievement_id="first_contact",
            progress=1.0,
            target=1.0,
            unlocked=True,
            unlocked_at=datetime.now(timezone.utc).isoformat(),
            metadata={"title": "First Contact", "category": "Application"},
        )
        assert ach["unlocked"] == 1
        assert ach["achievement_id"] == "first_contact"

        # 5. Get user achievements
        achievements = repo.get_user_achievements("sam_ludwig")
        assert len(achievements) == 1
        assert achievements[0]["achievement_id"] == "first_contact"


# ==============================================================================
# 5. REST Route Handlers Integration Tests
# ==============================================================================


class MockHttpClient:
    """Helper client to dispatch HTTP requests against DashboardApp handler."""

    def __init__(self, app: DashboardApp):
        self.app = app
        self.handler_cls = make_handler(app)

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
    ) -> tuple[int, dict[str, Any]]:
        full_path = path
        if params:
            sep = "&" if "?" in path else "?"
            full_path = f"{path}{sep}{urlencode(params)}"

        handler = self.handler_cls.__new__(self.handler_cls)
        handler.path = full_path

        headers: dict[str, str] = {}
        if json_body is not None:
            body_bytes = json.dumps(json_body).encode("utf-8")
            headers["Content-Length"] = str(len(body_bytes))
            headers["Content-Type"] = "application/json"
            handler.rfile = io.BytesIO(body_bytes)
        else:
            headers["Content-Length"] = "0"
            handler.rfile = io.BytesIO()

        handler.headers = headers
        handler.client_address = ("127.0.0.1", 12345)
        handler.wfile = io.BytesIO()

        status_box = [200]

        def record_status(code: int, message: str | None = None):
            status_box[0] = code

        handler.send_response = record_status
        handler.send_header = lambda k, v: None
        handler.end_headers = MagicMock()

        method_upper = method.upper()
        if method_upper == "GET":
            handler.do_GET()
        elif method_upper == "POST":
            handler.do_POST()
        else:
            raise NotImplementedError(method)

        response_bytes = handler.wfile.getvalue()
        try:
            sep_idx = response_bytes.find(b"\r\n\r\n")
            body_part = (
                response_bytes[sep_idx + 4 :] if sep_idx != -1 else response_bytes
            )
            data = json.loads(body_part.decode("utf-8")) if body_part else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            data = {"raw": response_bytes.decode("utf-8", errors="replace")}

        return status_box[0], data


def test_post_telemetry_events_and_get_patterns_route():
    """Verify POST /api/telemetry/events and GET /api/learning/patterns REST API."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_api.sqlite3"
        app = DashboardApp()
        app.repository = JobRepository(str(db_path))
        client = MockHttpClient(app)

        # 1. Post telemetry event
        event_payload = {
            "user_id": "sam_ludwig",
            "event_type": "applied",
            "job_id": "job_vic_101",
            "job": {
                "title": "Lead Cloud Infrastructure Specialist",
                "company": "Victorian Public Sector",
                "salary": "$165,000",
                "skills": ["Terraform", "Azure", "Kubernetes"],
            },
        }
        status, resp = client.request(
            "POST", "/api/telemetry/events", json_body=event_payload
        )
        assert status == 200
        assert resp.get("status") == "recorded" or resp.get("success") is True
        assert resp.get("event_id") is not None

        # 2. Post batch of events
        batch_payload = {
            "user_id": "sam_ludwig",
            "events": [
                {
                    "event_type": "interview_scheduled",
                    "job_id": "job_vic_102",
                    "job": {
                        "title": "Senior DevOps Engineer",
                        "company": "Victorian Public Sector",
                        "skills": ["Terraform", "CI/CD"],
                    },
                },
                {
                    "event_type": "package_prepared",
                    "job_id": "job_vic_103",
                    "job": {
                        "title": "Cloud Platform Architect",
                        "company": "Department of Premier and Cabinet",
                        "skills": ["Terraform", "AWS"],
                    },
                },
            ],
        }
        status, batch_resp = client.request(
            "POST", "/api/telemetry/events", json_body=batch_payload
        )
        assert status == 200
        assert batch_resp.get("success") is True
        assert batch_resp.get("ingested_count") == 2

        # 3. GET /api/learning/patterns
        status, patterns_resp = client.request(
            "GET", "/api/learning/patterns", params={"user_id": "sam_ludwig"}
        )
        assert status == 200
        assert "skills" in patterns_resp
        assert "seniority" in patterns_resp
        assert "industry_clusters" in patterns_resp
        assert "industries" in patterns_resp
        assert isinstance(patterns_resp["industries"], dict)
        assert "Victorian Public Sector / Government" in patterns_resp["industries"]
        assert "salary_anchoring" in patterns_resp
        assert "salary_anchor" in patterns_resp
        assert isinstance(patterns_resp["salary_anchor"], (int, float))
        assert patterns_resp["salary_anchor"] > 0

        # Terraform was targeted in all 3 jobs -> should be present and graduated!
        skill_names = [s["skill"] for s in patterns_resp["skills"]]
        assert "Terraform" in skill_names
        tf_skill = next(s for s in patterns_resp["skills"] if s["skill"] == "Terraform")
        assert tf_skill["graduated"] is True


def test_empty_and_invalid_telemetry_payload_rejected_with_400():
    """Verify empty or malformed telemetry payloads return HTTP 400 instead of logging phantom records."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_empty.sqlite3"
        app = DashboardApp()
        app.repository = JobRepository(str(db_path))
        client = MockHttpClient(app)

        # 1. Empty dict {}
        status, resp = client.request("POST", "/api/telemetry/events", json_body={})
        assert status == 400
        assert resp.get("success") is False

        # 2. Only user_id without event data
        status, resp = client.request(
            "POST", "/api/telemetry/events", json_body={"user_id": "sam_ludwig"}
        )
        assert status == 400
        assert resp.get("success") is False

        # 3. Empty events list
        status, resp = client.request(
            "POST", "/api/telemetry/events", json_body={"events": []}
        )
        assert status == 400
        assert resp.get("success") is False

        # 4. Events list with empty dict
        status, resp = client.request(
            "POST", "/api/telemetry/events", json_body={"events": [{}]}
        )
        assert status == 400
        assert resp.get("success") is False

        # 5. Events list with invalid object
        status, resp = client.request(
            "POST", "/api/telemetry/events", json_body={"events": [{"foo": "bar"}]}
        )
        assert status == 400
        assert resp.get("success") is False

        # Confirm 0 records inserted in database
        events = app.repository.get_telemetry_events("sam_ludwig")
        assert len(events) == 0


def test_compute_decay_weight_alias_and_signatures():
    """Verify compute_decay_weight supports both delta_days and occurred_at signatures."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Numeric delta_days directly: w = w0 * 2^(-dt / 30.0)
    w_0d = compute_decay_weight(5.0, 0.0, 30.0)
    assert pytest.approx(w_0d, rel=1e-5) == 5.0

    w_30d = compute_decay_weight(5.0, 30.0, 30.0)
    assert pytest.approx(w_30d, rel=1e-5) == 2.5

    w_60d = compute_decay_weight(4.0, 60.0, 30.0)
    assert pytest.approx(w_60d, rel=1e-5) == 1.0

    # Negative delta days (clock skew) clamped to 0.0
    w_skew = compute_decay_weight(5.0, -10.0, 30.0)
    assert pytest.approx(w_skew, rel=1e-5) == 5.0

    # 2. Timestamp-based invocation (backward compatibility)
    t_30d = now - timedelta(days=30)
    w_dt = compute_decay_weight(5.0, t_30d, half_life_or_now=now)
    assert pytest.approx(w_dt, rel=1e-5) == 2.5


def test_robustness_non_dict_job_snapshot():
    """Verify non-dict job_snapshot values do not trigger AttributeError."""
    # 1. extract_skills_from_event with string snapshot
    skills = extract_skills_from_event(
        {"job_snapshot": "invalid_string", "job_title": "Terraform Specialist"}
    )
    assert "Terraform" in skills

    # 2. mine_career_patterns with corrupted event snapshot
    events = [
        {"event_type": "viewed", "job_snapshot": "not_a_dict"},
        {"event_type": "viewed", "job_snapshot": 12345},
        {"event_type": "viewed", "job_snapshot": None},
    ]
    patterns = mine_career_patterns(events)
    assert isinstance(patterns, dict)
    assert "skills" in patterns

    # 3. JobRepository.insert_telemetry_event with non-dict snapshot
    with tempfile.TemporaryDirectory() as tmpdir:
        repo = JobRepository(str(Path(tmpdir) / "test_robust.sqlite3"))
        ev_id = repo.insert_telemetry_event(
            {
                "user_id": "test_user",
                "event_type": "applied",
                "job_snapshot": "malformed_string",
                "job_title": "Cloud Architect",
            }
        )
        assert ev_id > 0
        retrieved = repo.get_telemetry_events("test_user")
        assert len(retrieved) == 1
        assert retrieved[0]["job_snapshot"] == {}


def test_robustness_datetime_metadata_serialization():
    """Verify datetime objects in metadata are serialized safely via default=str."""
    with tempfile.TemporaryDirectory() as tmpdir:
        repo = JobRepository(str(Path(tmpdir) / "test_datetime.sqlite3"))

        # 1. Telemetry insertion with datetime in metadata
        ev_id = repo.insert_telemetry_event(
            {
                "user_id": "sam_ludwig",
                "event_type": "applied",
                "job_id": "job_1",
                "metadata": {"timestamp": datetime.now(timezone.utc), "active": True},
            }
        )
        assert ev_id > 0
        events = repo.get_telemetry_events("sam_ludwig")
        assert len(events) == 1
        assert "timestamp" in events[0]["metadata"]

        # 2. Achievement upsert with datetime in metadata
        ach = repo.upsert_user_achievement(
            user_id="sam_ludwig",
            achievement_id="first_contact",
            progress=1.0,
            target=1.0,
            unlocked=True,
            metadata={"unlocked_date": datetime.now(timezone.utc)},
        )
        assert ach["unlocked"] == 1
        achievements = repo.get_user_achievements("sam_ludwig")
        assert len(achievements) == 1
        assert "unlocked_date" in achievements[0]["metadata"]


def test_salary_parsing_superannuation_stripping():
    """Verify superannuation percentages are stripped so salaries are not distorted."""
    sal = parse_annual_salary("$150,000 - $180,000 + 11.5% super")
    assert sal is not None
    assert pytest.approx(sal, rel=1e-3) == 165000.0

    sal_pkg = parse_annual_salary("$140000 + 11% superannuation package")
    assert sal_pkg is not None
    assert pytest.approx(sal_pkg, rel=1e-3) == 140000.0


def test_robustness_signal_weight_and_parse_timestamp():
    """Verify get_signal_weight and parse_timestamp handle non-string / extreme values safely."""
    # Non-string event_type
    assert get_signal_weight(123) == 0.5
    assert get_signal_weight(None) == 0.5

    # Out of range / special float timestamps
    dt_nan = parse_timestamp(float("nan"))
    assert isinstance(dt_nan, datetime)

    dt_inf = parse_timestamp(float("inf"))
    assert isinstance(dt_inf, datetime)

    dt_extreme = parse_timestamp(-100000000000)
    assert isinstance(dt_extreme, datetime)
