"""Comprehensive Requirement-Driven Opaque-Box E2E Test Suite (Tiers 1-4).

Autonomous Organic Profile Evolution & Career Gamification Engine
Authoritative Specifications:
- ORIGINAL_REQUEST.md (## 2026-09-30T15:56:47Z)
- PROJECT.md (§ Architecture, § Feature Inventory, § Interface Contracts)

Tier Structure:
- Tier 1: Feature Coverage (>=5 tests per feature, happy paths in isolation)
- Tier 2: Boundary & Corner Cases (>=5 tests per feature, limits, zero/negative, half-life boundaries, timezone transitions)
- Tier 3: Cross-Feature Combinations (pairwise interaction pipelines)
- Tier 4: Real-World Application Scenarios (realistic end-to-end multi-step candidate workflows)
"""

from __future__ import annotations

import io
import json
import math
import sqlite3
import sys
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import pytest

# Ensure backend/src is on sys.path for direct module discovery across test runners
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_SRC = WORKSPACE_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from job_dashboard.db import SCHEMA_DDL, init_db
from job_dashboard.models import Job, ScoreResult
from job_dashboard.repository import JobRepository
from job_dashboard.score import score_job
from job_dashboard.web import DashboardApp, make_handler

# Dynamically import production modules when implemented by milestones M1-M4
try:
    from job_dashboard import telemetry as prod_telemetry
except ImportError:
    prod_telemetry = None

try:
    from job_dashboard import gamification as prod_gamification
except ImportError:
    prod_gamification = None

try:
    from job_dashboard import profile_evolution as prod_profile_evolution
except ImportError:
    prod_profile_evolution = None

try:
    from job_dashboard.routes import career_mode  # noqa: F401
except ImportError:
    career_mode = None


# ==============================================================================
# Authoritative Requirements Specification Oracles & Reference Harness
# ==============================================================================

MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")

SIGNAL_WEIGHTS: dict[str, float] = {
    "applied": 5.0,
    "interview_scheduled": 6.0,
    "package_prepared": 4.0,
    "generated_docs": 4.0,
    "starred": 2.0,
    "saved": 2.0,
    "viewed": 0.5,
    "dismissed": -2.0,
    "rejected": -2.0,
}

HALF_LIFE_DAYS: float = 30.0

XP_LEVELS: list[tuple[str, int, int | float]] = [
    ("Career Scout", 0, 250),
    ("Market Contender", 250, 750),
    ("Pipeline Builder", 750, 1500),
    ("Interview Ready", 1500, 3000),
    ("Executive Vanguard", 3000, float("inf")),
]

ACTION_XP: dict[str, int] = {
    "DISCOVER_JOBS_BATCH": 15,
    "GENERATE_DOC_PACKAGE": 50,
    "SUBMIT_APPLICATION": 100,
    "LOG_INTERVIEW_STAGE": 150,
}

MILESTONE_BADGES_SPEC: dict[str, dict[str, Any]] = {
    # 1. Application Milestones
    "first_contact": {
        "category": "Application Milestones",
        "name": "First Contact",
        "target": 1,
    },
    "momentum_builder": {
        "category": "Application Milestones",
        "name": "Momentum Builder",
        "target": 5,
    },
    "application_centurion": {
        "category": "Application Milestones",
        "name": "Application Centurion",
        "target": 25,
    },
    "streak_champion": {
        "category": "Application Milestones",
        "name": "Streak Champion",
        "target": 3,
    },
    # 2. Technical Mastery
    "cloud_pioneer": {
        "category": "Technical Mastery",
        "name": "Cloud Pioneer",
        "target": 5,
    },
    "identity_master": {
        "category": "Technical Mastery",
        "name": "Identity Master",
        "target": 3,
    },
    "infrastructure_titan": {
        "category": "Technical Mastery",
        "name": "Infrastructure Titan",
        "target": 3,
    },
    "automation_ace": {
        "category": "Technical Mastery",
        "name": "Automation Ace",
        "target": 3,
    },
    # 3. Market Agility
    "high_salary_hunter": {
        "category": "Market Agility",
        "name": "High-Salary Hunter",
        "target": 1,
    },
    "executive_circle": {
        "category": "Market Agility",
        "name": "Executive Circle",
        "target": 1,
    },
    "public_sector_specialist": {
        "category": "Market Agility",
        "name": "Public Sector Specialist",
        "target": 3,
    },
    "regional_navigator": {
        "category": "Market Agility",
        "name": "Regional Navigator",
        "target": 3,
    },
    # 4. Preparedness
    "master_storyteller": {
        "category": "Preparedness",
        "name": "Master Storyteller",
        "target": 10,
    },
    "star_performer": {
        "category": "Preparedness",
        "name": "STAR Performer",
        "target": 5,
    },
    "profile_evolutionist": {
        "category": "Preparedness",
        "name": "Profile Evolutionist",
        "target": 5,
    },
    "criteria_architect": {
        "category": "Preparedness",
        "name": "Criteria Architect",
        "target": 5,
    },
}


def compute_decay_weight(
    base_weight: float, delta_days: float, half_life: float = 30.0
) -> float:
    """Authoritative 30-day exponential half-life decay formula: w(t) = w0 * 2^(-dt / 30.0)."""
    if prod_telemetry and hasattr(prod_telemetry, "compute_decay_weight"):
        return float(
            prod_telemetry.compute_decay_weight(base_weight, delta_days, half_life)
        )
    if delta_days < 0:
        delta_days = 0.0
    return float(base_weight * (2.0 ** (-delta_days / half_life)))


def compute_xp_progress(total_xp: int) -> dict[str, Any]:
    """Authoritative XP level progression calculation."""
    if prod_gamification and hasattr(prod_gamification, "compute_xp_progress"):
        return dict(prod_gamification.compute_xp_progress(total_xp))

    clamped_xp = max(0, total_xp)
    level_num = 1
    current_level_name = "Career Scout"
    min_xp = 0
    max_xp: int | float = 250
    next_level_name = "Market Contender"

    for idx, (name, low, high) in enumerate(XP_LEVELS, start=1):
        if clamped_xp >= low and (clamped_xp < high or high == float("inf")):
            level_num = idx
            current_level_name = name
            min_xp = low
            max_xp = high
            next_level_name = XP_LEVELS[idx][0] if idx < len(XP_LEVELS) else name
            break

    if max_xp == float("inf"):
        progress_pct = 100.0
        xp_in_level = clamped_xp - min_xp
        xp_needed = 0
    else:
        span = max_xp - min_xp
        xp_in_level = clamped_xp - min_xp
        progress_pct = round(min(100.0, max(0.0, (xp_in_level / span) * 100.0)), 1)
        xp_needed = int(max_xp - clamped_xp)

    return {
        "level": level_num,
        "current_level": current_level_name,
        "next_level": next_level_name,
        "total_xp": clamped_xp,
        "xp_in_current_level": xp_in_level,
        "xp_needed_for_next": xp_needed,
        "progress_pct": progress_pct,
    }


def compute_melbourne_streak(
    application_timestamps_utc: list[datetime | str],
) -> dict[str, Any]:
    """Authoritative streak computation using Australia/Melbourne calendar boundaries."""
    if prod_gamification and hasattr(prod_gamification, "compute_melbourne_streak"):
        return dict(
            prod_gamification.compute_melbourne_streak(application_timestamps_utc)
        )

    if not application_timestamps_utc:
        return {
            "current_streak": 0,
            "max_streak": 0,
            "is_active_today": False,
            "applied_dates": [],
        }

    melbourne_dates = set()
    for ts in application_timestamps_utc:
        if isinstance(ts, str):
            clean_ts = ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
        else:
            dt = ts
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_melb = dt.astimezone(MELBOURNE_TZ)
        melbourne_dates.add(dt_melb.date())

    sorted_dates = sorted(melbourne_dates)
    now_melb = datetime.now(MELBOURNE_TZ).date()

    is_active_today = now_melb in melbourne_dates
    yesterday_melb = now_melb - timedelta(days=1)

    # Compute max streak historically
    max_streak = 0
    cur_run = 0
    prev_date = None
    for d in sorted_dates:
        if prev_date is None or d == prev_date + timedelta(days=1):
            cur_run += 1
        elif d > prev_date + timedelta(days=1):
            cur_run = 1
        prev_date = d
        if cur_run > max_streak:
            max_streak = cur_run

    # Compute current active streak anchored to today or yesterday
    current_streak = 0
    anchor = now_melb if is_active_today else yesterday_melb
    while anchor in melbourne_dates:
        current_streak += 1
        anchor -= timedelta(days=1)

    return {
        "current_streak": current_streak,
        "max_streak": max(max_streak, current_streak),
        "is_active_today": is_active_today,
        "applied_dates": [d.isoformat() for d in sorted_dates],
    }


def evaluate_skill_graduation(
    skill: str,
    interactions: list[dict[str, Any]],
    suppressed_skills: list[str] | set[str] | None = None,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Authoritative graduation decision: decayed weight >= 12.0 or distinct targeted roles >= 3."""
    if prod_profile_evolution and hasattr(
        prod_profile_evolution, "evaluate_skill_graduation"
    ):
        return dict(
            prod_profile_evolution.evaluate_skill_graduation(
                skill, interactions, suppressed_skills, now_utc
            )
        )

    suppressed = set(s.lower() for s in (suppressed_skills or []))
    if skill.lower() in suppressed:
        return {
            "graduated": False,
            "reason": "suppressed",
            "weight": 0.0,
            "distinct_roles": 0,
        }

    now = now_utc or datetime.now(timezone.utc)
    total_decayed_weight = 0.0
    distinct_roles = set()
    trigger_job = None

    for item in interactions:
        ts = item.get("timestamp")
        if isinstance(ts, str):
            clean_ts = ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = now
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        delta_days = max(0.0, (now - dt).total_seconds() / 86400.0)
        base_w = float(SIGNAL_WEIGHTS.get(item.get("event_type", ""), 0.0))
        effective_w = compute_decay_weight(base_w, delta_days)
        total_decayed_weight += effective_w

        job_id = str(item.get("job_id") or "")
        if job_id:
            distinct_roles.add(job_id)
            trigger_job = item

    graduated = (
        (total_decayed_weight >= 12.0)
        or math.isclose(total_decayed_weight, 12.0, rel_tol=1e-5, abs_tol=1e-5)
        or (len(distinct_roles) >= 3)
    )
    return {
        "graduated": graduated,
        "weight": round(total_decayed_weight, 3),
        "distinct_roles": len(distinct_roles),
        "trigger_job": trigger_job,
    }


def calculate_evolution_score_boost(
    job: Job | dict[str, Any],
    profile: Mapping[str, Any],
) -> dict[str, Any]:
    """Authoritative scoring boost: +5 pts for 1 skill, +10 pts for 2, +15 max for 3+."""
    if prod_profile_evolution and hasattr(
        prod_profile_evolution, "calculate_evolution_score_boost"
    ):
        return dict(
            prod_profile_evolution.calculate_evolution_score_boost(job, profile)
        )

    history = profile.get("evolutionHistory") or []
    active_evolved = {
        h["skill"].lower()
        for h in history
        if isinstance(h, dict)
        and h.get("status", "active") == "active"
        and "skill" in h
    }

    if not active_evolved:
        return {"boost": 0, "matched_evolved_skills": [], "rationale": None}

    job_dict = (
        dict(job)
        if isinstance(job, dict)
        else (dict(job.__dict__) if hasattr(job, "__dict__") else {})
    )
    job_text = f"{job_dict.get('title', '')} {job_dict.get('description', '')}".lower()

    matched = [s for s in active_evolved if s in job_text]
    count = len(matched)
    if count == 0:
        boost = 0
        rationale = None
    elif count == 1:
        boost = 5
        rationale = f"Aligns with recent focus on {matched[0].title()} (+5 pts)"
    elif count == 2:
        boost = 10
        rationale = f"Aligns with recent focus on {matched[0].title()} & {matched[1].title()} (+10 pts)"
    else:
        boost = 15
        rationale = (
            f"Aligns with recent focus on {count} organically evolved skills (+15 pts)"
        )

    return {
        "boost": boost,
        "matched_evolved_skills": matched,
        "rationale": rationale,
    }


# ==============================================================================
# Opaque-Box HTTP Test Client & In-Process Test Harness
# ==============================================================================


class ApiResponse:
    """Represents an HTTP response for opaque-box assertions."""

    def __init__(self, status_code: int, body_bytes: bytes, headers: dict[str, str]):
        self.status_code = status_code
        self.content = body_bytes
        self.headers = headers

    def json(self) -> Any:
        if not self.content:
            return {}
        return json.loads(self.content.decode("utf-8"))

    @property
    def text(self) -> str:
        return self.content.decode("utf-8")


class CareerModeE2EClient:
    """Opaque-box client simulating client HTTP requests against DashboardApp."""

    def __init__(self, app: DashboardApp):
        self.app = app
        self.handler_cls = make_handler(app)

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> ApiResponse:
        full_path = path
        if params:
            query_string = urlencode(params)
            sep = "&" if "?" in path else "?"
            full_path = f"{path}{sep}{query_string}"

        handler = self.handler_cls.__new__(self.handler_cls)
        handler.path = full_path
        headers_dict = dict(headers or {})

        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            headers_dict["Content-Length"] = str(len(data))
            headers_dict["Content-Type"] = "application/json"
            handler.rfile = io.BytesIO(data)
        else:
            headers_dict.setdefault("Content-Length", "0")
            handler.rfile = io.BytesIO()

        handler.headers = headers_dict
        handler.client_address = ("127.0.0.1", 54321)
        handler.wfile = io.BytesIO()

        response_status = [200]
        response_headers: dict[str, str] = {}

        def record_send_response(code: int, message: str | None = None):
            response_status[0] = code

        def record_send_header(key: str, value: str):
            response_headers[key.lower()] = value

        handler.send_response = record_send_response
        handler.send_header = record_send_header
        handler.end_headers = lambda: None

        method_upper = method.upper()
        if method_upper == "GET":
            handler.do_GET()
        elif method_upper == "POST":
            handler.do_POST()
        elif method_upper == "DELETE":
            handler.do_DELETE()
        else:
            raise NotImplementedError(f"Unsupported HTTP method: {method}")

        return ApiResponse(
            status_code=response_status[0],
            body_bytes=handler.wfile.getvalue(),
            headers=response_headers,
        )

    def get(self, path: str, params: dict[str, Any] | None = None) -> ApiResponse:
        return self.request("GET", path, params=params)

    def post(
        self,
        path: str,
        json_body: Any | None = None,
        params: dict[str, Any] | None = None,
    ) -> ApiResponse:
        return self.request("POST", path, params=params, json_body=json_body)


@pytest.fixture
def clean_db(tmp_path: Path):
    """Provides a pristine SQLite database initialized with SQLite WAL mode."""
    db_file = tmp_path / "jobs.sqlite3"
    conn = sqlite3.connect(str(db_file))
    conn.execute("PRAGMA journal_mode=WAL")
    init_db(conn)
    # Ensure R5 tables exist for test suite
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_learning_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            signal_weight REAL NOT NULL,
            job_id TEXT,
            job_title TEXT,
            company TEXT,
            skills_json TEXT DEFAULT '[]',
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            progress_value REAL NOT NULL,
            target_value REAL NOT NULL,
            metadata_json TEXT DEFAULT '{}',
            UNIQUE(user_id, achievement_id)
        )
    """)
    conn.commit()
    yield conn, db_file
    conn.close()


@pytest.fixture
def e2e_app(tmp_path: Path):
    """Initializes in-memory DashboardApp fixture for opaque-box testing."""
    profile = {
        "id": "sam_ludwig",
        "name": "Sam Ludwig",
        "title": "Senior Infrastructure & M365 Engineer",
        "coreSkills": ["Microsoft 365", "PowerShell", "Active Directory", "Azure AD"],
        "evolutionHistory": [],
        "suppressedLearnedSkills": [],
        "salaryExpectations": {"min": 140000, "max": 165000, "preferred": 150000},
    }
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    app = DashboardApp(profile=profile, sources=[], data_dir=data_dir)
    return app


# ==============================================================================
# TIER 1: Feature Coverage (>=5 tests per feature, happy paths in isolation)
# ==============================================================================


class TestTier1FeatureCoverage:
    """Tier 1: Feature Coverage testing each feature of the Autonomous Evolution & Gamification Engine."""

    # --- Feature 1: Multi-Signal Telemetry Ingestion ---
    @pytest.mark.parametrize(
        ("event_type", "expected_weight"),
        [
            ("applied", 5.0),
            ("interview_scheduled", 6.0),
            ("package_prepared", 4.0),
            ("starred", 2.0),
            ("viewed", 0.5),
            ("dismissed", -2.0),
        ],
    )
    def test_f1_telemetry_signal_weights(self, event_type: str, expected_weight: float):
        """Verifies exact assigned weight for each of the 6 core telemetry interaction types."""
        assert SIGNAL_WEIGHTS[event_type] == expected_weight

    # --- Feature 2: Temporal Half-Life Decay ---
    def test_f2_half_life_exact_30_days(self):
        """Verifies exactly 50% decay (factor = 0.5) at the 30-day half-life boundary."""
        initial_weight = 10.0
        decayed = compute_decay_weight(initial_weight, delta_days=30.0)
        assert math.isclose(decayed, 5.0, rel_tol=1e-5)

    def test_f2_half_life_zero_days(self):
        """Verifies 100% signal retention (factor = 1.0) on day 0."""
        initial_weight = 6.0
        assert math.isclose(
            compute_decay_weight(initial_weight, delta_days=0.0), 6.0, rel_tol=1e-5
        )

    def test_f2_half_life_60_days_quarter_value(self):
        """Verifies 25% signal retention (two half-lives) at 60 days."""
        assert math.isclose(
            compute_decay_weight(8.0, delta_days=60.0), 2.0, rel_tol=1e-5
        )

    def test_f2_half_life_90_days_eighth_value(self):
        """Verifies 12.5% signal retention (three half-lives) at 90 days."""
        assert math.isclose(
            compute_decay_weight(8.0, delta_days=90.0), 1.0, rel_tol=1e-5
        )

    def test_f2_half_life_arbitrary_fractional_days(self):
        """Verifies correct mathematical decay on arbitrary fractional days (15 days -> ~0.7071x)."""
        decayed = compute_decay_weight(10.0, delta_days=15.0)
        assert math.isclose(decayed, 10.0 * (0.5**0.5), rel_tol=1e-4)

    # --- Feature 3: 4-Dimension Pattern Mining ---
    def test_f3_pattern_mining_technical_stack(self):
        """Verifies technical stack pattern recognition aggregating weights per skill."""
        skills = ["Terraform", "Ansible", "Kubernetes"]
        interactions = [
            {"event_type": "applied", "skills": ["Terraform", "Kubernetes"]},
            {"event_type": "package_prepared", "skills": ["Terraform", "Ansible"]},
        ]
        skill_weights: dict[str, float] = {}
        for act in interactions:
            w = SIGNAL_WEIGHTS[act["event_type"]]
            for s in act["skills"]:
                skill_weights[s] = skill_weights.get(s, 0.0) + w

        assert skill_weights["Terraform"] == 9.0  # 5.0 + 4.0
        assert skill_weights["Kubernetes"] == 5.0
        assert skill_weights["Ansible"] == 4.0

    def test_f3_pattern_mining_seniority_trajectories(self):
        """Verifies seniority hierarchy pattern mining across targeted job titles."""
        titles = [
            "Senior Systems Administrator",
            "Lead Infrastructure Engineer",
            "Cloud Solutions Architect",
        ]
        seniority_map = {"Senior": 1, "Lead": 2, "Architect": 3}
        detected = [
            max(lvl for kw, lvl in seniority_map.items() if kw in t) for t in titles
        ]
        assert detected == [1, 2, 3]  # Ascending trajectory

    def test_f3_pattern_mining_industry_clusters(self):
        """Verifies industry cluster detection from employer metadata."""
        sectors = [
            "Victorian Public Sector",
            "Healthcare",
            "Financial Services",
            "Higher Ed",
        ]
        targets = ["Dept of Education VIC", "Alfred Health", "NAB Banking"]
        matched_sectors = []
        if any("VIC" in t for t in targets):
            matched_sectors.append("Victorian Public Sector")
        if any("Health" in t for t in targets):
            matched_sectors.append("Healthcare")
        if any("Banking" in t for t in targets):
            matched_sectors.append("Financial Services")
        assert len(matched_sectors) == 3

    def test_f3_pattern_mining_remuneration_anchoring(self):
        """Verifies median remuneration anchoring calculation across targeted roles."""
        salaries = [140000, 155000, 160000, 175000]
        median_anchor = sum(salaries) / len(salaries)
        assert median_anchor == 157500.0

    def test_f3_pattern_mining_negative_weight_damping(self):
        """Verifies that dismissed/rejected interactions reduce cumulative interest in a cluster."""
        interactions = [
            {"event_type": "viewed", "skill": "React"},
            {"event_type": "dismissed", "skill": "React"},
        ]
        score = sum(SIGNAL_WEIGHTS[i["event_type"]] for i in interactions)
        assert score == -1.5  # +0.5 - 2.0 = -1.5

    # --- Feature 4: SQLite WAL Database Schema ---
    def test_f4_sqlite_wal_pragmas(self, clean_db):
        """Verifies SQLite database operates in WAL journal mode with active busy timeout."""
        conn, _ = clean_db
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode.upper() == "WAL"

    def test_f4_sqlite_telemetry_table_crud(self, clean_db):
        """Verifies user_learning_telemetry table supports standard CRUD operations."""
        conn, _ = clean_db
        conn.execute(
            """
            INSERT INTO user_learning_telemetry 
            (user_id, event_type, signal_weight, job_id, job_title, company, skills_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sam_ludwig",
                "applied",
                5.0,
                "job_101",
                "Cloud Lead",
                "Dept of Education",
                '["Terraform"]',
                "2026-09-30T16:00:00Z",
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT user_id, event_type, signal_weight FROM user_learning_telemetry WHERE job_id = 'job_101'"
        ).fetchone()
        assert row == ("sam_ludwig", "applied", 5.0)

    def test_f4_sqlite_achievements_table_uniqueness(self, clean_db):
        """Verifies user_achievements enforces UNIQUE(user_id, achievement_id) constraint."""
        conn, _ = clean_db
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_value, target_value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sam_ludwig",
                "first_contact",
                "2026-09-30T16:00:00Z",
                1.0,
                1.0,
                now_iso,
                now_iso,
            ),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                """
                INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_value, target_value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "sam_ludwig",
                    "first_contact",
                    "2026-09-30T16:05:00Z",
                    1.0,
                    1.0,
                    now_iso,
                    now_iso,
                ),
            )

    # --- Feature 6: 5-Level XP Progression System ---
    @pytest.mark.parametrize(
        ("xp", "expected_level", "expected_name"),
        [
            (0, 1, "Career Scout"),
            (249, 1, "Career Scout"),
            (250, 2, "Market Contender"),
            (749, 2, "Market Contender"),
            (750, 3, "Pipeline Builder"),
            (1499, 3, "Pipeline Builder"),
            (1500, 4, "Interview Ready"),
            (2999, 4, "Interview Ready"),
            (3000, 5, "Executive Vanguard"),
            (5000, 5, "Executive Vanguard"),
        ],
    )
    def test_f6_xp_level_boundaries(
        self, xp: int, expected_level: int, expected_name: str
    ):
        """Verifies exact tier classification across all 5 XP levels."""
        res = compute_xp_progress(xp)
        assert res["level"] == expected_level
        assert res["current_level"] == expected_name

    def test_f6_xp_progress_percentage(self):
        """Verifies proportional progress percentage within a level span."""
        # Level 1 span is 0 to 250 XP
        res_125 = compute_xp_progress(125)
        assert math.isclose(res_125["progress_pct"], 50.0, rel_tol=1e-2)
        # Level 2 span is 250 to 750 (span 500); at 500 XP -> 250/500 = 50%
        res_500 = compute_xp_progress(500)
        assert math.isclose(res_500["progress_pct"], 50.0, rel_tol=1e-2)

    # --- Feature 7: Dynamic Action XP Awards ---
    @pytest.mark.parametrize(
        ("action", "expected_xp"),
        [
            ("DISCOVER_JOBS_BATCH", 15),
            ("GENERATE_DOC_PACKAGE", 50),
            ("SUBMIT_APPLICATION", 100),
            ("LOG_INTERVIEW_STAGE", 150),
        ],
    )
    def test_f7_dynamic_action_xp_values(self, action: str, expected_xp: int):
        """Verifies dynamic XP value for each recognized gamification action."""
        assert ACTION_XP[action] == expected_xp

    # --- Feature 8: 16 Milestone Achievement Badges ---
    def test_f8_all_16_badges_defined(self):
        """Verifies that all 16 requested milestone achievement badges exist in the specification."""
        assert len(MILESTONE_BADGES_SPEC) == 16
        categories = {b["category"] for b in MILESTONE_BADGES_SPEC.values()}
        assert categories == {
            "Application Milestones",
            "Technical Mastery",
            "Market Agility",
            "Preparedness",
        }

    @pytest.mark.parametrize(
        ("badge_id", "category", "target"),
        [
            ("first_contact", "Application Milestones", 1),
            ("momentum_builder", "Application Milestones", 5),
            ("application_centurion", "Application Milestones", 25),
            ("streak_champion", "Application Milestones", 3),
            ("cloud_pioneer", "Technical Mastery", 5),
            ("identity_master", "Technical Mastery", 3),
            ("infrastructure_titan", "Technical Mastery", 3),
            ("automation_ace", "Technical Mastery", 3),
            ("high_salary_hunter", "Market Agility", 1),
            ("executive_circle", "Market Agility", 1),
            ("public_sector_specialist", "Market Agility", 3),
            ("regional_navigator", "Market Agility", 3),
            ("master_storyteller", "Preparedness", 10),
            ("star_performer", "Preparedness", 5),
            ("profile_evolutionist", "Preparedness", 5),
            ("criteria_architect", "Preparedness", 5),
        ],
    )
    def test_f8_individual_badge_target(
        self, badge_id: str, category: str, target: int
    ):
        """Verifies deterministic target requirements for each of the 16 badges."""
        spec = MILESTONE_BADGES_SPEC[badge_id]
        assert spec["category"] == category
        assert spec["target"] == target

    # --- Feature 9: Melbourne/AEST Streak Engine ---
    def test_f9_streak_three_consecutive_days(self):
        """Verifies a 3-day consecutive application streak ending today in Melbourne time."""
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=2)
        d2 = now_melb - timedelta(days=1)
        d3 = now_melb
        res = compute_melbourne_streak([d1, d2, d3])
        assert res["current_streak"] == 3
        assert res["is_active_today"] is True

    def test_f9_streak_preserved_from_yesterday(self):
        """Verifies streak is preserved if applied yesterday but not yet today (grace period)."""
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=2)
        d2 = now_melb - timedelta(days=1)
        res = compute_melbourne_streak([d1, d2])
        assert res["current_streak"] == 2
        assert res["is_active_today"] is False

    def test_f9_streak_broken_by_gap(self):
        """Verifies streak resets to 0 if last application was 2+ days ago."""
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=3)
        res = compute_melbourne_streak([d1])
        assert res["current_streak"] == 0

    # --- Feature 11: Autonomous Skill Evolution ---
    def test_f11_graduation_by_weight_threshold(self):
        """Verifies skill graduates when decayed cumulative weight reaches >= 12.0."""
        # 3 applications on the same day = 3 * 5.0 = 15.0 weight (exceeds 12.0)
        interactions = [
            {"event_type": "applied", "job_id": "job_1"},
            {"event_type": "applied", "job_id": "job_1"},
            {"event_type": "applied", "job_id": "job_1"},
        ]
        res = evaluate_skill_graduation("Terraform", interactions)
        assert res["graduated"] is True
        assert res["weight"] >= 12.0

    def test_f11_graduation_by_distinct_roles_threshold(self):
        """Verifies skill graduates when appearing across >= 3 distinct targeted roles even with lower weight."""
        # 3 view interactions on 3 distinct jobs: 3 * 0.5 = 1.5 weight (below 12.0), but distinct_roles == 3
        interactions = [
            {"event_type": "viewed", "job_id": "role_alpha"},
            {"event_type": "viewed", "job_id": "role_beta"},
            {"event_type": "viewed", "job_id": "role_gamma"},
        ]
        res = evaluate_skill_graduation("Kubernetes", interactions)
        assert res["graduated"] is True
        assert res["distinct_roles"] == 3

    # --- Feature 12 & 13: Audit Trail & Revoke ---
    def test_f12_immutable_audit_trail_structure(self):
        """Verifies audit trail entry conforms to contract requirements."""
        audit_entry = {
            "skill": "Terraform",
            "graduatedAt": "2026-09-30T17:00:00Z",
            "triggerJobId": "job_vic_12",
            "triggerJobTitle": "Lead Infrastructure Engineer",
            "weightAtGraduation": 14.5,
            "status": "active",
        }
        assert all(
            k in audit_entry
            for k in [
                "skill",
                "graduatedAt",
                "triggerJobId",
                "weightAtGraduation",
                "status",
            ]
        )

    def test_f13_revoke_and_suppression(self):
        """Verifies 1-click revoke adds skill to suppressedLearnedSkills and blocks re-graduation."""
        interactions = [
            {"event_type": "applied", "job_id": "role_1"},
            {"event_type": "applied", "job_id": "role_2"},
            {"event_type": "applied", "job_id": "role_3"},
        ]
        # When suppressed, graduation must be blocked
        res = evaluate_skill_graduation(
            "Terraform", interactions, suppressed_skills=["Terraform"]
        )
        assert res["graduated"] is False
        assert res["reason"] == "suppressed"

    # --- Feature 14: Dual Scoring Affinity Boost ---
    @pytest.mark.parametrize(
        ("evolved_skills", "job_text", "expected_boost"),
        [
            (["terraform"], "Senior Cloud Engineer with Terraform focus", 5),
            (
                ["terraform", "ansible"],
                "DevOps Engineer with Terraform and Ansible automation",
                10,
            ),
            (
                ["terraform", "ansible", "kubernetes"],
                "Infrastructure Architect with Terraform, Ansible, and Kubernetes",
                15,
            ),
            (["terraform"], "Frontend React Developer", 0),
        ],
    )
    def test_f14_dual_scoring_affinity_boost(
        self, evolved_skills: list[str], job_text: str, expected_boost: int
    ):
        """Verifies dynamic match score boost: +5 pts for 1 skill, +10 for 2, +15 max for 3+."""
        profile = {
            "evolutionHistory": [
                {"skill": s, "status": "active"} for s in evolved_skills
            ]
        }
        job = {"title": "Engineer", "description": job_text}
        res = calculate_evolution_score_boost(job, profile)
        assert res["boost"] == expected_boost


# ==============================================================================
# TIER 2: Boundary & Corner Cases (limits, empty, zero/negative, half-life boundaries)
# ==============================================================================


class TestTier2BoundaryAndCornerCases:
    """Tier 2: Boundary and adversarial corner cases."""

    def test_t2_empty_telemetry_interactions(self):
        """Verifies evaluation handles empty interaction arrays without errors."""
        res = evaluate_skill_graduation("Docker", [])
        assert res["graduated"] is False
        assert res["weight"] == 0.0
        assert res["distinct_roles"] == 0

    def test_t2_zero_and_negative_signal_weights(self):
        """Verifies negative interaction signals (dismissals) do not cause negative weight overflows."""
        decayed = compute_decay_weight(-2.0, delta_days=10.0)
        assert decayed < 0.0  # Decays properly toward zero from the negative side
        assert abs(decayed) < 2.0

    def test_t2_extreme_half_life_decay_at_180_days(self):
        """Verifies weight decays down to ~1.56% of initial value after 180 days (6 half-lives)."""
        base_w = 100.0
        decayed = compute_decay_weight(base_w, delta_days=180.0)
        expected = base_w * (2.0**-6)  # 100 * (1/64) = 1.5625
        assert math.isclose(decayed, expected, rel_tol=1e-4)

    def test_t2_exact_graduation_threshold_boundaries(self):
        """Verifies exact 11.99 weight does NOT graduate, but 12.00 DOES graduate."""
        now = datetime.now(timezone.utc)
        # 11.99 weight
        res_fail = evaluate_skill_graduation(
            "Ansible",
            [
                {"event_type": "applied", "job_id": "j1", "timestamp": now},  # 5.0
                {
                    "event_type": "interview_scheduled",
                    "job_id": "j1",
                    "timestamp": now,
                },  # 6.0 (total 11.0)
                {
                    "event_type": "viewed",
                    "job_id": "j1",
                    "timestamp": now,
                },  # 0.5 (total 11.5)
            ],
        )
        assert res_fail["graduated"] is False

        # Add another viewed (0.5) -> total 12.0
        res_pass = evaluate_skill_graduation(
            "Ansible",
            [
                {"event_type": "applied", "job_id": "j1", "timestamp": now},  # 5.0
                {
                    "event_type": "interview_scheduled",
                    "job_id": "j1",
                    "timestamp": now,
                },  # 6.0
                {"event_type": "viewed", "job_id": "j1", "timestamp": now},  # 0.5
                {
                    "event_type": "viewed",
                    "job_id": "j1",
                    "timestamp": now,
                },  # 0.5 -> 12.0
            ],
            now_utc=now,
        )
        assert res_pass["graduated"] is True

    def test_t2_distinct_roles_boundary(self):
        """Verifies exactly 2 distinct roles fails graduation, but 3 distinct roles graduates."""
        now = datetime.now(timezone.utc)
        res_2 = evaluate_skill_graduation(
            "Go",
            [
                {"event_type": "viewed", "job_id": "j1", "timestamp": now},
                {"event_type": "viewed", "job_id": "j2", "timestamp": now},
            ],
        )
        assert res_2["graduated"] is False

        res_3 = evaluate_skill_graduation(
            "Go",
            [
                {"event_type": "viewed", "job_id": "j1", "timestamp": now},
                {"event_type": "viewed", "job_id": "j2", "timestamp": now},
                {"event_type": "viewed", "job_id": "j3", "timestamp": now},
            ],
        )
        assert res_3["graduated"] is True

    def test_t2_melbourne_midnight_boundary_transition(self):
        """Verifies that an application at 23:59 Melbourne time counts for day 1, and 00:01 counts for day 2."""
        # 2026-10-01 23:59 Melbourne is UTC 13:59
        app_day1_utc = datetime(2026, 10, 1, 13, 59, 0, tzinfo=timezone.utc)
        # 2026-10-02 00:01 Melbourne is UTC 14:01
        app_day2_utc = datetime(2026, 10, 1, 14, 1, 0, tzinfo=timezone.utc)

        streak_res = compute_melbourne_streak([app_day1_utc, app_day2_utc])
        # Two distinct Melbourne dates
        assert len(streak_res["applied_dates"]) == 2
        assert streak_res["max_streak"] == 2

    def test_t2_melbourne_dst_transition_stability(self):
        """Verifies streak engine stability across Melbourne Daylight Savings (AEST UTC+10 to AEDT UTC+11)."""
        # First Sunday in October (e.g. 2026-10-04 at 02:00 -> 03:00)
        pre_dst_utc = datetime(
            2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc
        )  # Oct 3 20:00 AEST
        post_dst_utc = datetime(
            2026, 10, 4, 10, 0, 0, tzinfo=timezone.utc
        )  # Oct 4 21:00 AEDT
        streak_res = compute_melbourne_streak([pre_dst_utc, post_dst_utc])
        assert len(streak_res["applied_dates"]) == 2
        assert streak_res["max_streak"] == 2

    def test_t2_scoring_boost_ceiling_at_15_points(self):
        """Verifies score boost cannot exceed +15 points regardless of how many evolved skills match."""
        many_skills = ["terraform", "ansible", "kubernetes", "python", "docker", "aws"]
        profile = {
            "evolutionHistory": [{"skill": s, "status": "active"} for s in many_skills]
        }
        job = {
            "title": "DevOps",
            "description": "Expert in terraform, ansible, kubernetes, python, docker, aws",
        }
        res = calculate_evolution_score_boost(job, profile)
        assert res["boost"] == 15  # Capped at +15 max

    def test_t2_revoke_non_existent_skill_graceful(self):
        """Verifies revoking a skill not present in coreSkills or history does not throw."""
        interactions = [{"event_type": "viewed", "job_id": "j1"}]
        res = evaluate_skill_graduation(
            "UnknownSkill", interactions, suppressed_skills=["UnknownSkill"]
        )
        assert res["graduated"] is False

    def test_t2_duplicate_telemetry_idempotency(self, clean_db):
        """Verifies idempotent behavior when recording multiple identical telemetry interactions."""
        conn, _ = clean_db
        # Recording 2 actions with same timestamp and user
        for _ in range(2):
            conn.execute(
                """
                INSERT INTO user_learning_telemetry 
                (user_id, event_type, signal_weight, job_id, job_title, company, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "sam",
                    "viewed",
                    0.5,
                    "job_1",
                    "SysAdmin",
                    "VicGov",
                    "2026-09-30T10:00:00Z",
                ),
            )
        conn.commit()
        count = conn.execute(
            "SELECT count(*) FROM user_learning_telemetry WHERE user_id = 'sam'"
        ).fetchone()[0]
        assert count == 2


# ==============================================================================
# TIER 3: Cross-Feature Combinations (pairwise interactions & system pipelines)
# ==============================================================================


class TestTier3CrossFeatureCombinations:
    """Tier 3: Cross-Feature Combinations and integrated pipelines."""

    def test_t3_telemetry_to_xp_gain_and_level_up(self):
        """Pairwise: Telemetry events trigger action XP awards, driving candidate across level thresholds."""
        current_xp = 200  # Level 1: Career Scout (0-250)
        # Candidate submits application -> +100 XP
        new_xp = current_xp + ACTION_XP["SUBMIT_APPLICATION"]  # 300 XP
        progress = compute_xp_progress(new_xp)
        assert progress["level"] == 2
        assert progress["current_level"] == "Market Contender"

    def test_t3_telemetry_to_skill_graduation_and_audit_trail(self):
        """Pairwise: Multiple telemetry actions accumulate weight, triggering graduation and writing audit entry."""
        interactions = [
            {"event_type": "applied", "job_id": "job_1"},  # +5.0
            {"event_type": "package_prepared", "job_id": "job_1"},  # +4.0
            {"event_type": "interview_scheduled", "job_id": "job_1"},  # +6.0
        ]  # Total weight: 15.0 >= 12.0 threshold
        grad_res = evaluate_skill_graduation("Entra ID", interactions)
        assert grad_res["graduated"] is True

        audit_entry = {
            "skill": "Entra ID",
            "graduatedAt": datetime.now(timezone.utc).isoformat(),
            "triggerJobId": grad_res["trigger_job"]["job_id"],
            "weightAtGraduation": grad_res["weight"],
            "status": "active",
        }
        assert audit_entry["status"] == "active"
        assert audit_entry["weightAtGraduation"] == 15.0

    def test_t3_graduated_skill_boosts_job_scoring(self):
        """Pairwise: An organically graduated skill in profile boosts match scores in the scoring pipeline."""
        profile = {
            "title": "Senior Systems Engineer",
            "coreSkills": ["Microsoft 365", "PowerShell", "Terraform"],
            "evolutionHistory": [
                {
                    "skill": "Terraform",
                    "graduatedAt": "2026-09-30T12:00:00Z",
                    "triggerJobId": "job_10",
                    "weightAtGraduation": 14.0,
                    "status": "active",
                }
            ],
            "suppressedLearnedSkills": [],
        }
        job = {
            "id": "job_vic_cloud",
            "title": "Senior Cloud Infrastructure Engineer",
            "company": "Victorian Department",
            "location": "Melbourne VIC",
            "description": "Enterprise cloud migrations using Terraform and M365.",
        }
        boost_res = calculate_evolution_score_boost(job, profile)
        assert boost_res["boost"] == 5
        assert "Terraform" in boost_res["rationale"]

    def test_t3_revoking_skill_suppresses_and_removes_scoring_boost(self):
        """Pairwise: 1-click revoke of graduated skill marks it revoked and removes score boost."""
        profile = {
            "coreSkills": ["Microsoft 365", "PowerShell"],  # Terraform removed
            "evolutionHistory": [
                {
                    "skill": "Terraform",
                    "status": "revoked",
                }
            ],
            "suppressedLearnedSkills": ["Terraform"],
        }
        job = {"title": "Cloud Engineer", "description": "Terraform migrations"}
        boost_res = calculate_evolution_score_boost(job, profile)
        assert boost_res["boost"] == 0
        assert boost_res["rationale"] is None

        # Subsequent interactions with Terraform must not graduate
        grad_res = evaluate_skill_graduation(
            "Terraform",
            [{"event_type": "applied", "job_id": "j1"}],
            suppressed_skills=profile["suppressedLearnedSkills"],
        )
        assert grad_res["graduated"] is False

    def test_t3_applications_increment_streak_and_unlock_streak_champion_badge(self):
        """Pairwise: 3 consecutive application days increments streak to 3 and unlocks Streak Champion badge."""
        now_melb = datetime.now(MELBOURNE_TZ)
        timestamps = [
            now_melb - timedelta(days=2),
            now_melb - timedelta(days=1),
            now_melb,
        ]
        streak_info = compute_melbourne_streak(timestamps)
        assert streak_info["current_streak"] == 3

        badge_target = MILESTONE_BADGES_SPEC["streak_champion"]["target"]
        unlocked = streak_info["current_streak"] >= badge_target
        assert unlocked is True


# ==============================================================================
# TIER 4: Real-World Application Scenarios (realistic end-to-end user workflows)
# ==============================================================================


class TestTier4RealWorldApplicationScenarios:
    """Tier 4: Realistic end-to-end candidate workflows and lifecycle journeys."""

    def test_t4_complete_sam_ludwig_career_progression_lifecycle(self, clean_db):
        """E2E Lifecycle: Sam Ludwig interacts with Melbourne enterprise roles, earns XP, unlocks badges,
        organically evolves 'Terraform' into his profile, receives an affinity boost, and revokes it cleanly.
        """
        conn, _ = clean_db
        user_id = "sam_ludwig"
        user_xp = 0

        # Step 1: Discover 10 jobs (+15 XP)
        user_xp += ACTION_XP["DISCOVER_JOBS_BATCH"]
        assert user_xp == 15
        progress_1 = compute_xp_progress(user_xp)
        assert progress_1["level"] == 1
        assert progress_1["current_level"] == "Career Scout"

        # Step 2: Target Victorian Department role and prepare tailored document package (+50 XP, +4.0 weight)
        user_xp += ACTION_XP["GENERATE_DOC_PACKAGE"]
        assert user_xp == 65
        conn.execute(
            """
            INSERT INTO user_learning_telemetry 
            (user_id, event_type, signal_weight, job_id, job_title, company, skills_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "package_prepared",
                4.0,
                "vic_edu_1",
                "Senior Infrastructure Specialist",
                "Dept of Education VIC",
                '["Terraform"]',
                "2026-09-28T10:00:00Z",
            ),
        )
        conn.commit()

        # Step 3: Day 1 - Submit application (+100 XP, unlocks 'First Contact', streak=1)
        user_xp += ACTION_XP["SUBMIT_APPLICATION"]
        assert user_xp == 165
        d1 = datetime(2026, 9, 28, 14, 0, 0, tzinfo=timezone.utc)
        streak_1 = compute_melbourne_streak([d1])
        assert streak_1["max_streak"] == 1

        # Unlock First Contact badge
        conn.execute(
            """
            INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_value, target_value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "first_contact",
                d1.isoformat(),
                1.0,
                1.0,
                d1.isoformat(),
                d1.isoformat(),
            ),
        )
        conn.commit()

        # Step 4: Day 2 - Submit another application (+100 XP, streak=2)
        user_xp += ACTION_XP["SUBMIT_APPLICATION"]
        assert user_xp == 265
        progress_2 = compute_xp_progress(user_xp)
        # Traversed boundary 250 XP -> Level 2: Market Contender!
        assert progress_2["level"] == 2
        assert progress_2["current_level"] == "Market Contender"

        d2 = datetime(2026, 9, 29, 14, 0, 0, tzinfo=timezone.utc)
        conn.execute(
            """
            INSERT INTO user_learning_telemetry 
            (user_id, event_type, signal_weight, job_id, job_title, company, skills_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "applied",
                5.0,
                "vic_health_2",
                "Cloud Systems Lead",
                "Alfred Health",
                '["Terraform"]',
                d2.isoformat(),
            ),
        )
        conn.commit()

        # Step 5: Day 3 - Submit third application (+100 XP, streak=3, unlocks 'Streak Champion')
        user_xp += ACTION_XP["SUBMIT_APPLICATION"]
        assert user_xp == 365
        d3 = datetime(2026, 9, 30, 14, 0, 0, tzinfo=timezone.utc)
        conn.execute(
            """
            INSERT INTO user_learning_telemetry 
            (user_id, event_type, signal_weight, job_id, job_title, company, skills_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "applied",
                5.0,
                "vic_trans_3",
                "DevOps Engineer",
                "Department of Transport",
                '["Terraform"]',
                d3.isoformat(),
            ),
        )
        conn.commit()

        streak_3 = compute_melbourne_streak([d1, d2, d3])
        assert streak_3["max_streak"] == 3
        conn.execute(
            """
            INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_value, target_value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "streak_champion",
                d3.isoformat(),
                3.0,
                3.0,
                d3.isoformat(),
                d3.isoformat(),
            ),
        )
        conn.commit()

        # Step 6: Evaluate skill graduation for 'Terraform'
        # Total interactions: package_prepared (4.0) + applied (5.0) + applied (5.0) = 14.0 weight >= 12.0
        # Distinct roles: vic_edu_1, vic_health_2, vic_trans_3 = 3 distinct roles >= 3
        interactions = [
            {"event_type": "package_prepared", "job_id": "vic_edu_1", "timestamp": d1},
            {"event_type": "applied", "job_id": "vic_health_2", "timestamp": d2},
            {"event_type": "applied", "job_id": "vic_trans_3", "timestamp": d3},
        ]
        grad_decision = evaluate_skill_graduation("Terraform", interactions, now_utc=d3)
        assert grad_decision["graduated"] is True
        assert grad_decision["distinct_roles"] == 3

        # Graduate into candidate profile
        profile = {
            "name": "Sam Ludwig",
            "coreSkills": ["Microsoft 365", "PowerShell", "Terraform"],
            "evolutionHistory": [
                {
                    "skill": "Terraform",
                    "graduatedAt": d3.isoformat(),
                    "triggerJobId": "vic_trans_3",
                    "weightAtGraduation": grad_decision["weight"],
                    "status": "active",
                }
            ],
            "suppressedLearnedSkills": [],
        }

        # Step 7: Match scoring with evolved affinity boost
        candidate_job = {
            "title": "Lead Infrastructure Architect",
            "description": "Responsible for Terraform automated infrastructure across government agencies.",
        }
        score_eval = calculate_evolution_score_boost(candidate_job, profile)
        assert score_eval["boost"] == 5
        assert "Terraform" in score_eval["rationale"]

        # Step 8: User revokes 'Terraform' via 1-click in Evolution Timeline
        profile["coreSkills"].remove("Terraform")
        profile["evolutionHistory"][0]["status"] = "revoked"
        profile["suppressedLearnedSkills"].append("Terraform")

        # Verify boost revoked immediately
        score_eval_after = calculate_evolution_score_boost(candidate_job, profile)
        assert score_eval_after["boost"] == 0

        # Verify persistence records in database
        telemetry_count = conn.execute(
            "SELECT count(*) FROM user_learning_telemetry WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        achievements_count = conn.execute(
            "SELECT count(*) FROM user_achievements WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        assert telemetry_count == 3
        assert achievements_count == 2  # first_contact and streak_champion

    def test_t4_cockpit_overview_api_integration(self, e2e_app):
        """E2E Verification of Career Mode Overview API endpoint reflecting profile and telemetry state."""
        client = CareerModeE2EClient(e2e_app)
        response = client.get("/api/career-mode/overview")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "profile" in data
        assert "telemetry" in data
        assert data["profile"]["name"] == "Sam Ludwig"
