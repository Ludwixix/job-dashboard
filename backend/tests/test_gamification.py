"""Unit and Integration Tests for Career Gamification, XP Progression & 16-Badge Engine.

Authoritative Requirements:
- ORIGINAL_REQUEST.md (## 2026-09-30T15:56:47Z § R3)
- PROJECT.md (§ Architecture, § Feature Inventory, § Interface Contracts)
"""

from __future__ import annotations

import math
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from job_dashboard.db import init_db
from job_dashboard.gamification import (
    ACTION_XP,
    MELBOURNE_TZ,
    MILESTONE_BADGES_SPEC,
    classify_job_for_badges,
    compute_decay_weight,
    compute_melbourne_streak,
    compute_xp_progress,
    evaluate_action_xp,
    evaluate_badges,
    get_melbourne_date_str,
    parse_job_salary,
    recalculate_user_gamification,
)
from job_dashboard.repository import JobRepository

# ==============================================================================
# Fixtures
# ==============================================================================


@pytest.fixture
def temp_db(tmp_path: Path):
    """Provides a fresh SQLite database initialized with WAL and gamification tables."""
    db_file = tmp_path / "test_gamification.sqlite3"
    conn = sqlite3.connect(str(db_file))
    conn.execute("PRAGMA journal_mode=WAL")
    init_db(conn)
    conn.close()

    repo = JobRepository(db_file)
    return repo, db_file


# ==============================================================================
# 1. 5-Level XP Progression Tests
# ==============================================================================


class TestXpProgression:
    """Tests for XP progression, boundary conditions, and level calculations."""

    @pytest.mark.parametrize(
        ("xp", "expected_level", "expected_name", "expected_next"),
        [
            (0, 1, "Career Scout", "Market Contender"),
            (100, 1, "Career Scout", "Market Contender"),
            (249, 1, "Career Scout", "Market Contender"),
            (250, 2, "Market Contender", "Pipeline Builder"),
            (500, 2, "Market Contender", "Pipeline Builder"),
            (749, 2, "Market Contender", "Pipeline Builder"),
            (750, 3, "Pipeline Builder", "Interview Ready"),
            (1000, 3, "Pipeline Builder", "Interview Ready"),
            (1499, 3, "Pipeline Builder", "Interview Ready"),
            (1500, 4, "Interview Ready", "Executive Vanguard"),
            (2000, 4, "Interview Ready", "Executive Vanguard"),
            (2999, 4, "Interview Ready", "Executive Vanguard"),
            (3000, 5, "Executive Vanguard", "Executive Vanguard"),
            (5000, 5, "Executive Vanguard", "Executive Vanguard"),
        ],
    )
    def test_level_boundaries(
        self, xp: int, expected_level: int, expected_name: str, expected_next: str
    ):
        res = compute_xp_progress(xp)
        assert res["level"] == expected_level
        assert res["current_level"] == expected_name
        assert res["next_level"] == expected_next
        assert res["total_xp"] == xp

    def test_negative_xp_clamped(self):
        res = compute_xp_progress(-50)
        assert res["level"] == 1
        assert res["total_xp"] == 0
        assert res["current_level"] == "Career Scout"

    def test_level_progress_percentage_and_xp_needed(self):
        # Level 1: 0 - 250 (span 250). At 125 XP -> 50%
        res = compute_xp_progress(125)
        assert math.isclose(res["progress_pct"], 50.0, rel_tol=1e-2)
        assert res["xp_needed_for_next"] == 125
        assert res["xp_in_current_level"] == 125
        assert res["is_max_level"] is False

        # Level 2: 250 - 750 (span 500). At 500 XP -> (250/500) = 50%
        res = compute_xp_progress(500)
        assert math.isclose(res["progress_pct"], 50.0, rel_tol=1e-2)
        assert res["xp_needed_for_next"] == 250
        assert res["xp_in_current_level"] == 250

        # Level 5: Cap reached
        res = compute_xp_progress(3500)
        assert res["progress_pct"] == 100.0
        assert res["xp_needed_for_next"] == 0
        assert res["is_max_level"] is True


# ==============================================================================
# 2. Dynamic Action XP & Anti-Exploit Idempotency Tests
# ==============================================================================


class TestActionXpAndIdempotency:
    """Tests for dynamic action awards and anti-exploit duplicate prevention."""

    def test_action_xp_constants(self):
        assert ACTION_XP["DISCOVER_JOBS_BATCH"] == 15
        assert ACTION_XP["GENERATE_DOC_PACKAGE"] == 50
        assert ACTION_XP["SUBMIT_APPLICATION"] == 100
        assert ACTION_XP["LOG_INTERVIEW_STAGE"] == 150
        assert ACTION_XP["ACHIEVEMENT_UNLOCKED"] == 50

    def test_discover_jobs_batch_threshold(self):
        # Batch under 10 jobs yields 0 XP
        xp, awarded, _ = evaluate_action_xp(
            "DISCOVER_JOBS_BATCH", metadata={"count": 5}
        )
        assert awarded is False
        assert xp == 0

        # Batch of 10+ jobs awards +15 XP
        xp, awarded, _ = evaluate_action_xp(
            "DISCOVER_JOBS_BATCH", metadata={"count": 10}
        )
        assert awarded is True
        assert xp == 15

    def test_generate_doc_package_idempotency(self):
        history = [{"action_type": "GENERATE_DOC_PACKAGE", "job_id": "job_melb_1"}]
        # Same job_id again must be rejected
        xp, awarded, reason = evaluate_action_xp(
            "GENERATE_DOC_PACKAGE",
            metadata={"job_id": "job_melb_1"},
            action_history=history,
        )
        assert awarded is False
        assert xp == 0
        assert "idempotent" in reason

        # Different job_id is awarded
        xp, awarded, _ = evaluate_action_xp(
            "GENERATE_DOC_PACKAGE",
            metadata={"job_id": "job_melb_2"},
            action_history=history,
        )
        assert awarded is True
        assert xp == 50

    def test_submit_application_idempotency(self):
        history = [{"action_type": "SUBMIT_APPLICATION", "job_id": "job_vic_10"}]
        # Duplicate submission gives 0 XP
        xp, awarded, _ = evaluate_action_xp(
            "SUBMIT_APPLICATION",
            metadata={"job_id": "job_vic_10"},
            action_history=history,
        )
        assert awarded is False
        assert xp == 0

        # Fresh job gives 100 XP
        xp, awarded, _ = evaluate_action_xp(
            "SUBMIT_APPLICATION",
            metadata={"job_id": "job_vic_11"},
            action_history=history,
        )
        assert awarded is True
        assert xp == 100

    def test_log_interview_stage_idempotency(self):
        history = [{"action_type": "LOG_INTERVIEW_STAGE", "key": "job_1:round1"}]
        # Duplicate round gives 0 XP
        xp, awarded, _ = evaluate_action_xp(
            "LOG_INTERVIEW_STAGE",
            metadata={"job_id": "job_1", "stage": "round1"},
            action_history=history,
        )
        assert awarded is False
        assert xp == 0

        # Different round gives 150 XP
        xp, awarded, _ = evaluate_action_xp(
            "LOG_INTERVIEW_STAGE",
            metadata={"job_id": "job_1", "stage": "round2"},
            action_history=history,
        )
        assert awarded is True
        assert xp == 150


# ==============================================================================
# 3. 16 Milestone Achievement Badges Tests
# ==============================================================================


class TestMilestoneBadges:
    """Tests for all 16 milestone achievement badge evaluations across 4 categories."""

    def test_all_16_badges_exist(self):
        assert len(MILESTONE_BADGES_SPEC) == 16
        categories = {b["category"] for b in MILESTONE_BADGES_SPEC.values()}
        assert categories == {
            "Application Milestones",
            "Technical Mastery",
            "Market Agility",
            "Preparedness",
        }

    def test_application_milestones_evaluation(self):
        # 1 app unlocks first_contact
        badges = evaluate_badges({"total_applications": 1, "current_streak": 1})
        badge_map = {b["id"]: b for b in badges}
        assert badge_map["first_contact"]["unlocked"] is True
        assert badge_map["momentum_builder"]["unlocked"] is False
        assert badge_map["application_centurion"]["unlocked"] is False
        assert badge_map["streak_champion"]["unlocked"] is False

        # 5 apps unlocks momentum_builder
        badges_5 = evaluate_badges({"total_applications": 5, "current_streak": 2})
        b_map_5 = {b["id"]: b for b in badges_5}
        assert b_map_5["first_contact"]["unlocked"] is True
        assert b_map_5["momentum_builder"]["unlocked"] is True
        assert b_map_5["application_centurion"]["unlocked"] is False

        # 25 apps and 3-day streak unlocks centurion and streak champion
        badges_25 = evaluate_badges({"total_applications": 25, "current_streak": 3})
        b_map_25 = {b["id"]: b for b in badges_25}
        assert b_map_25["application_centurion"]["unlocked"] is True
        assert b_map_25["streak_champion"]["unlocked"] is True

    def test_technical_mastery_evaluation(self):
        stats = {
            "cloud_roles_count": 5,
            "identity_roles_count": 3,
            "infrastructure_roles_count": 3,
            "automation_roles_count": 3,
        }
        badges = evaluate_badges(stats)
        b_map = {b["id"]: b for b in badges}
        assert b_map["cloud_pioneer"]["unlocked"] is True
        assert b_map["identity_master"]["unlocked"] is True
        assert b_map["infrastructure_titan"]["unlocked"] is True
        assert b_map["automation_ace"]["unlocked"] is True

    def test_market_agility_evaluation(self):
        stats = {
            "high_salary_targeted": True,
            "executive_targeted": True,
            "public_sector_count": 3,
            "regional_count": 3,
        }
        badges = evaluate_badges(stats)
        b_map = {b["id"]: b for b in badges}
        assert b_map["high_salary_hunter"]["unlocked"] is True
        assert b_map["executive_circle"]["unlocked"] is True
        assert b_map["public_sector_specialist"]["unlocked"] is True
        assert b_map["regional_navigator"]["unlocked"] is True

    def test_preparedness_evaluation(self):
        stats = {
            "cover_letters_generated": 10,
            "interviews_simulated": 5,
            "skills_evolved_count": 5,
            "ksc_packs_generated": 5,
        }
        badges = evaluate_badges(stats)
        b_map = {b["id"]: b for b in badges}
        assert b_map["master_storyteller"]["unlocked"] is True
        assert b_map["star_performer"]["unlocked"] is True
        assert b_map["profile_evolutionist"]["unlocked"] is True
        assert b_map["criteria_architect"]["unlocked"] is True


# ==============================================================================
# 4. Job Classification for Badges Tests
# ==============================================================================


class TestJobClassification:
    """Tests for classifying jobs against technical and market agility criteria."""

    def test_classify_cloud_and_auto(self):
        job = {
            "title": "Cloud DevOps Engineer",
            "description": "Managing AWS and Azure with Terraform and Python CI/CD pipelines.",
            "company": "Tech Corp",
            "location": "Melbourne VIC",
            "salary": "$150k",
        }
        res = classify_job_for_badges(job)
        assert res["is_cloud"] is True
        assert res["is_auto"] is True
        assert res["is_high_salary"] is True
        assert res["is_exec_salary"] is False

    def test_classify_identity_and_infra(self):
        job = {
            "title": "Senior Systems Engineer",
            "description": "Enterprise VMware, Cisco networking, Windows Server, and Entra ID migration.",
            "company": "Melbourne Health",
            "location": "Melbourne VIC",
            "salary": "$185,000",
        }
        res = classify_job_for_badges(job)
        assert res["is_identity"] is True
        assert res["is_infra"] is True
        assert res["is_exec_salary"] is True

    def test_classify_public_sector_and_remote(self):
        job = {
            "title": "Senior Cloud Specialist",
            "source": "careers_vic",
            "description": "Victorian Public Sector hybrid role. 3 days WFH.",
            "remote": 1,
        }
        res = classify_job_for_badges(job)
        assert res["is_public_sector"] is True
        assert res["is_regional"] is True

    def test_parse_job_salary_formats(self):
        assert parse_job_salary({"salary": "$160,000"}) == 160000.0
        assert parse_job_salary({"salary": "$140k"}) == 140000.0
        assert parse_job_salary({"salary_max": 180000}) == 180000.0
        assert parse_job_salary({"remuneration": "$190k base"}) == 190000.0
        # Hourly rate ($80/hr -> $156,000)
        assert parse_job_salary({"salary": 80}) == 156000.0


# ==============================================================================
# 5. Melbourne / AEST Daily Streak Engine Tests
# ==============================================================================


class TestMelbourneStreakEngine:
    """Tests for timezone boundary resilience and streak calculations."""

    def test_empty_dates(self):
        res = compute_melbourne_streak([])
        assert res["current_streak"] == 0
        assert res["max_streak"] == 0
        assert res["is_active_today"] is False

    def test_three_consecutive_days_ending_today(self):
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=2)
        d2 = now_melb - timedelta(days=1)
        d3 = now_melb
        res = compute_melbourne_streak([d1, d2, d3])
        assert res["current_streak"] == 3
        assert res["max_streak"] == 3
        assert res["is_active_today"] is True

    def test_grace_period_applied_yesterday(self):
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=2)
        d2 = now_melb - timedelta(days=1)
        res = compute_melbourne_streak([d1, d2])
        assert res["current_streak"] == 2
        assert res["is_active_today"] is False

    def test_streak_broken_by_two_day_gap(self):
        now_melb = datetime.now(MELBOURNE_TZ)
        d1 = now_melb - timedelta(days=3)
        res = compute_melbourne_streak([d1])
        assert res["current_streak"] == 0
        assert res["max_streak"] == 1

    def test_midnight_crossing_in_melbourne(self):
        # 23:59 Melbourne time Oct 1 vs 00:01 Melbourne time Oct 2
        t1 = datetime(2026, 10, 1, 13, 59, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 10, 1, 14, 1, 0, tzinfo=timezone.utc)
        ref = datetime(2026, 10, 2, 14, 1, 0, tzinfo=timezone.utc)
        res = compute_melbourne_streak([t1, t2], ref_date=ref)
        assert len(res["applied_dates"]) == 2
        assert res["max_streak"] == 2

    def test_melbourne_date_string_conversion(self):
        dt_utc = datetime(2026, 9, 30, 23, 0, 0, tzinfo=timezone.utc)
        # In Melbourne (UTC+10), 23:00 on Sep 30 is 09:00 on Oct 1
        date_str = get_melbourne_date_str(dt_utc)
        assert date_str == "2026-10-01"

    def test_decay_weight_formula(self):
        assert math.isclose(compute_decay_weight(10.0, 0.0), 10.0)
        assert math.isclose(compute_decay_weight(10.0, 30.0), 5.0)
        assert math.isclose(compute_decay_weight(10.0, 60.0), 2.5)


# ==============================================================================
# 6. Database Persistence & Full Recalculation Tests
# ==============================================================================


class TestGamificationPersistence:
    """Tests for database storage and historical recalculation."""

    def test_upsert_and_retrieve_user_gamification(self, temp_db):
        repo, _ = temp_db
        user_id = "test_candidate"

        record = repo.upsert_user_gamification(
            user_id=user_id,
            total_xp=450,
            current_level=2,
            current_streak=3,
            longest_streak=5,
            last_applied_date_melbourne="2026-09-30",
        )
        assert record["total_xp"] == 450
        assert record["current_level"] == 2

        fetched = repo.get_user_gamification(user_id)
        assert fetched is not None
        assert fetched["total_xp"] == 450
        assert fetched["current_streak_days"] == 3
        assert fetched["longest_streak_days"] == 5

    def test_recalculate_user_gamification_workflow(self, temp_db):
        repo, _ = temp_db
        user_id = "sam_ludwig"

        # Record telemetry event for applied role
        repo.insert_telemetry_event(
            {
                "user_id": user_id,
                "event_type": "applied",
                "signal_weight": 5.0,
                "job_id": "job_vic_1",
                "job_title": "Lead Cloud Engineer",
                "company": "Victorian Gov",
                "skills": ["Terraform", "Azure"],
                "job_snapshot": {"title": "Lead Cloud Engineer", "salary": "$150k"},
            }
        )

        profile = {
            "name": "Sam Ludwig",
            "evolutionHistory": [
                {"skill": "Terraform", "status": "active"},
                {"skill": "Ansible", "status": "active"},
            ],
        }

        recalc = recalculate_user_gamification(
            user_id=user_id, repository=repo, profile=profile
        )
        assert recalc["user_id"] == user_id
        assert recalc["xp"]["total_xp"] >= 100
        assert recalc["streak"]["max_streak"] >= 1
        assert recalc["unlocked_count"] >= 1  # at least first_contact

        # Check DB reflects state
        stored_gam = repo.get_user_gamification(user_id)
        assert stored_gam is not None
        assert stored_gam["total_xp"] == recalc["xp"]["total_xp"]
