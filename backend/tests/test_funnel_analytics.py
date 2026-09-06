"""Unit tests for the Talent Funnel Analytics & Pipeline Velocity Engine."""

from datetime import datetime, timezone, timedelta
import pytest

from job_dashboard.funnel_analytics import (
    compute_funnel_analytics,
    AU_SECTOR_BENCHMARKS,
    STAGE_ORDER,
    detect_stalled_applications,
    calculate_pipeline_velocity,
    calculate_conversion_rates,
)


def test_empty_jobs_returns_clean_default_analytics():
    """An empty job list returns safe zeroed metrics without crashing."""
    result = compute_funnel_analytics([], sector="technology")

    assert result["total_jobs"] == 0
    assert result["health_score"] >= 0
    assert result["stages"]["sourced"]["count"] == 0
    assert result["stages"]["applied"]["count"] == 0
    assert result["conversion_rates"]["overall_yield_pct"] == 0.0
    assert len(result["stalled_applications"]) == 0
    assert result["sector"] == "technology"
    assert "benchmark" in result


def test_stage_aggregation_and_conversion_rates():
    """Verifies that jobs are correctly partitioned into lifecycle stages and conversion rates computed."""
    base_time = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)
    now_iso = (base_time + timedelta(days=10)).isoformat()

    sample_jobs = [
        # 3 Sourced / New
        {"id": "j1", "title": "DevOps Engineer", "status": "new", "date_added": (base_time - timedelta(days=2)).isoformat()},
        {"id": "j2", "title": "Cloud Architect", "status": "new", "date_added": (base_time - timedelta(days=3)).isoformat()},
        {"id": "j3", "title": "Site Reliability Eng", "status": "new", "date_added": (base_time - timedelta(days=1)).isoformat()},
        # 2 Shortlisted / Saved
        {"id": "j4", "title": "Platform Engineer", "status": "saved", "date_added": (base_time - timedelta(days=5)).isoformat(), "date_shortlisted": (base_time - timedelta(days=4)).isoformat()},
        {"id": "j5", "title": "Systems Engineer", "status": "shortlisted", "date_added": (base_time - timedelta(days=5)).isoformat()},
        # 3 Applied
        {"id": "j6", "title": "Lead Infrastructure Eng", "status": "applied", "applied_date": (base_time + timedelta(days=1)).isoformat()},
        {"id": "j7", "title": "Senior Cloud Engineer", "status": "applied", "applied_date": (base_time + timedelta(days=2)).isoformat()},
        {"id": "j8", "title": "Azure Consultant", "status": "applied", "applied_date": (base_time + timedelta(days=3)).isoformat()},
        # 2 Interviewing
        {"id": "j9", "title": "Staff Platform Eng", "status": "interviewing", "applied_date": (base_time - timedelta(days=10)).isoformat(), "interview_date": (base_time + timedelta(days=4)).isoformat()},
        {"id": "j10", "title": "Principal Architect", "status": "interviewing", "applied_date": (base_time - timedelta(days=12)).isoformat()},
        # 1 Offer
        {"id": "j11", "title": "VP of Engineering", "status": "offer", "applied_date": (base_time - timedelta(days=20)).isoformat(), "offer_date": (base_time + timedelta(days=8)).isoformat()},
        # 1 Accepted
        {"id": "j12", "title": "Director of Technology", "status": "accepted", "applied_date": (base_time - timedelta(days=25)).isoformat()},
        # 1 Rejected
        {"id": "j13", "title": "Junior Admin", "status": "rejected", "applied_date": (base_time - timedelta(days=15)).isoformat()},
    ]

    result = compute_funnel_analytics(sample_jobs, sector="technology", now_iso=now_iso)

    assert result["total_jobs"] == 13
    assert result["active_pipeline_count"] > 0
    # Sourced: all jobs in funnel (13)
    assert result["stages"]["sourced"]["count"] == 13
    # Shortlisted: saved + applied + interviewing + offer + accepted + rejected (10)
    assert result["stages"]["shortlisted"]["count"] == 10
    # Applied: applied + interviewing + offer + accepted + rejected (8)
    assert result["stages"]["applied"]["count"] == 8
    # Interviewing: interviewing + offer + accepted (4)
    assert result["stages"]["interviewing"]["count"] == 4
    # Offer: offer + accepted (2)
    assert result["stages"]["offer"]["count"] == 2
    # Accepted (1)
    assert result["stages"]["accepted"]["count"] == 1

    conversions = result["conversion_rates"]
    # Apply to Interview: 4 / 8 = 50.0%
    assert conversions["apply_to_interview_pct"] == 50.0
    # Interview to Offer: 2 / 4 = 50.0%
    assert conversions["interview_to_offer_pct"] == 50.0
    # Overall Yield: 1 / 13 ~ 7.7%
    assert round(conversions["overall_yield_pct"], 1) == 7.7


def test_detect_stalled_applications():
    """Applications exceeding threshold days in applied or interviewing stage are flagged with severity."""
    now = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    now_iso = now.isoformat()

    stalled_jobs = [
        {
            "id": "stalled-1",
            "title": "Stalled Senior Engineer",
            "company": "Slow Corp",
            "status": "applied",
            # Applied 18 days ago (threshold is 14 days)
            "applied_date": (now - timedelta(days=18)).isoformat(),
        },
        {
            "id": "recent-apply",
            "title": "Fresh Application",
            "company": "Fast Corp",
            "status": "applied",
            # Applied 3 days ago (not stalled)
            "applied_date": (now - timedelta(days=3)).isoformat(),
        },
        {
            "id": "stalled-interview",
            "title": "Ghosted Interview",
            "company": "Ghost Inc",
            "status": "interviewing",
            # Interviewing with last update 25 days ago (threshold is 21 days)
            "applied_date": (now - timedelta(days=40)).isoformat(),
            "updated_at": (now - timedelta(days=25)).isoformat(),
        },
    ]

    stalled = detect_stalled_applications(stalled_jobs, now=now)

    assert len(stalled) == 2
    ids = [item["id"] for item in stalled]
    assert "stalled-1" in ids
    assert "stalled-interview" in ids
    assert "recent-apply" not in ids

    # Check alert details
    stalled_one = next(item for item in stalled if item["id"] == "stalled-1")
    assert stalled_one["days_in_stage"] == 18
    assert stalled_one["threshold_days"] == 14
    assert stalled_one["stage"] == "applied"
    assert "action_recommendation" in stalled_one


def test_pipeline_velocity_and_cycle_times():
    """Validates computation of average days across stages."""
    now = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)

    jobs = [
        {
            "id": "v1",
            "status": "interviewing",
            "applied_date": (now - timedelta(days=14)).isoformat(),
            "interview_date": (now - timedelta(days=7)).isoformat(),  # 7 days to interview
        },
        {
            "id": "v2",
            "status": "offer",
            "applied_date": (now - timedelta(days=24)).isoformat(),
            "interview_date": (now - timedelta(days=14)).isoformat(),  # 10 days to interview
            "offer_date": (now - timedelta(days=4)).isoformat(),       # 10 days from interview to offer
        },
    ]

    velocity = calculate_pipeline_velocity(jobs, now=now)

    assert velocity["avg_days_to_interview"] is not None
    assert round(velocity["avg_days_to_interview"], 1) == 8.5  # (7 + 10) / 2 = 8.5
    assert velocity["avg_days_interview_to_offer"] is not None
    assert round(velocity["avg_days_interview_to_offer"]) == 10


def test_au_sector_benchmarks_comparison():
    """Verifies that conversion metrics are benchmarked against selected AU industry track."""
    jobs = [
        {"id": f"j{i}", "status": "applied", "applied_date": "2026-09-01T00:00:00Z"}
        for i in range(10)
    ]
    # 2 interviewing
    jobs[0]["status"] = "interviewing"
    jobs[1]["status"] = "interviewing"

    tech_analytics = compute_funnel_analytics(jobs, sector="technology")
    health_analytics = compute_funnel_analytics(jobs, sector="healthcare")

    assert tech_analytics["sector"] == "technology"
    assert tech_analytics["benchmark"]["market_apply_to_interview_pct"] == AU_SECTOR_BENCHMARKS["technology"]["apply_to_interview_pct"]
    assert health_analytics["sector"] == "healthcare"
    assert health_analytics["benchmark"]["market_apply_to_interview_pct"] == AU_SECTOR_BENCHMARKS["healthcare"]["apply_to_interview_pct"]
