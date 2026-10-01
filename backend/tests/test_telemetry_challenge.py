"""Independent Empirical Challenger Test Suite for Milestone M1.

Empirically challenges:
1. Half-life exponential decay at t = 0, 15, 30, 45, 60, 90, 180, 360 days.
2. Clock skew and future timestamps handling.
3. Exact numerical signal weights and aliases.
4. Skill graduation threshold boundary cases (11.99 vs 12.00, 2 vs 3 roles, negative weights, duplicate jobs).
5. Seniority classification and velocity calculation.
6. Remuneration normalization and percentiles.
7. Discovered vulnerabilities and empirical edge cases.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import pytest

from job_dashboard.telemetry import (
    calculate_decayed_weight,
    calculate_elapsed_days,
    classify_seniority_tier,
    get_signal_weight,
    mine_career_patterns,
    parse_annual_salary,
    parse_timestamp,
)

# Reference fixed timestamp for deterministic temporal testing
T0 = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)


# ==============================================================================
# Challenge Suite 1: Mathematical Half-Life Decay Dynamics
# ==============================================================================


@pytest.mark.parametrize(
    ("delta_days", "expected_factor"),
    [
        (0.0, 1.0),
        (15.0, 2.0 ** (-15.0 / 30.0)),  # 2^(-0.5) = 1/sqrt(2) ≈ 0.70710678
        (30.0, 0.5),  # Exact half-life
        (45.0, 2.0 ** (-45.0 / 30.0)),  # 2^(-1.5) = 0.5/sqrt(2) ≈ 0.35355339
        (60.0, 0.25),  # 2^(-2) = 0.25
        (90.0, 0.125),  # 2^(-3) = 0.125
        (180.0, 0.015625),  # 2^(-6) = 1/64 = 0.015625
        (360.0, 1.0 / 4096.0),  # 2^(-12) ≈ 0.000244140625
    ],
)
def test_half_life_decay_exact_intervals(delta_days: float, expected_factor: float):
    """Empirically verify half-life decay at t = 0, 15, 30, 45, 60, 90, 180, 360 days."""
    base_weight = 10.0
    occ = T0 - timedelta(days=delta_days)
    decayed = calculate_decayed_weight(base_weight, occ, now=T0)
    expected = base_weight * expected_factor
    assert math.isclose(decayed, expected, rel_tol=1e-6), (
        f"Failed at delta_days={delta_days}: expected {expected}, got {decayed}"
    )


def test_decay_with_negative_weights():
    """Empirically verify negative weights decay towards zero over time without sign inversion."""
    base_weight = -2.0  # e.g. dismissed / rejected
    # At t=0 -> -2.0
    w_0 = calculate_decayed_weight(base_weight, T0, now=T0)
    assert math.isclose(w_0, -2.0, rel_tol=1e-6)

    # At t=30 -> -1.0
    w_30 = calculate_decayed_weight(base_weight, T0 - timedelta(days=30), now=T0)
    assert math.isclose(w_30, -1.0, rel_tol=1e-6)

    # At t=60 -> -0.5
    w_60 = calculate_decayed_weight(base_weight, T0 - timedelta(days=60), now=T0)
    assert math.isclose(w_60, -0.5, rel_tol=1e-6)

    # At t=360 -> -2.0 / 4096 ≈ -0.00048828
    w_360 = calculate_decayed_weight(base_weight, T0 - timedelta(days=360), now=T0)
    assert w_360 < 0.0
    assert math.isclose(w_360, -2.0 / 4096.0, rel_tol=1e-6)


@pytest.mark.parametrize("future_days", [0.001, 1.0, 5.0, 30.0, 365.0])
def test_clock_skew_and_future_timestamps(future_days: float):
    """Empirically verify clock skew: future timestamps clamp elapsed days to 0.0 (no weight explosion)."""
    future_time = T0 + timedelta(days=future_days)
    elapsed = calculate_elapsed_days(future_time, now=T0)
    assert elapsed == 0.0, (
        f"Clock skew not clamped: elapsed={elapsed} for future_days={future_days}"
    )

    base_weight = 5.0
    decayed = calculate_decayed_weight(base_weight, future_time, now=T0)
    assert decayed == base_weight, (
        f"Decayed weight mutated on future timestamp: {decayed} != {base_weight}"
    )


def test_timestamp_parser_edge_cases():
    """Test parse_timestamp with timezone offsets, strings, numbers, and None."""
    # UTC ISO string
    dt1 = parse_timestamp("2026-09-30T12:00:00Z")
    assert dt1.tzinfo == timezone.utc

    # Australian Eastern Standard Time (+10:00)
    dt2 = parse_timestamp("2026-09-30T22:00:00+10:00")
    assert dt2 == dt1  # 22:00 AEST == 12:00 UTC

    # Epoch timestamp
    dt3 = parse_timestamp(1790769600)  # int seconds
    assert dt3.tzinfo == timezone.utc

    # None and empty string default safely to datetime now
    dt_none = parse_timestamp(None)
    assert dt_none.tzinfo == timezone.utc

    dt_empty = parse_timestamp("")
    assert dt_empty.tzinfo == timezone.utc


# ==============================================================================
# Challenge Suite 2: Exact Signal Weights & Aliases
# ==============================================================================


@pytest.mark.parametrize(
    ("signal", "expected"),
    [
        ("applied", 5.0),
        ("interview_scheduled", 6.0),
        ("package_prepared", 4.0),
        ("generated_docs", 4.0),
        ("starred", 2.0),
        ("saved", 2.0),
        ("viewed", 0.5),
        ("dismissed", -2.0),
        ("rejected", -2.0),
        # Case insensitivity & whitespace
        ("  APPLIED  ", 5.0),
        ("INTERVIEW_SCHEDULED", 6.0),
        ("Viewed", 0.5),
        ("REJECTED", -2.0),
        # Aliases
        ("submitted", 5.0),
        ("application_sent", 5.0),
        ("interviewing", 6.0),
        ("stage_progression", 6.0),
        ("ksc_generated", 4.0),
        ("promoted", 2.0),
        ("opened", 0.5),
        ("card_expanded", 0.5),
        ("demoted", -2.0),
        # Fallback for unknown / empty
        ("unknown_event", 0.5),
        ("", 0.5),
    ],
)
def test_signal_weights_and_aliases(signal: str, expected: float):
    """Empirically verify signal weights for core types, aliases, and fallbacks."""
    assert get_signal_weight(signal) == expected


# ==============================================================================
# Challenge Suite 3: Skill Graduation Threshold Boundary Cases
# ==============================================================================


def test_graduation_boundary_11_99_vs_12_00():
    """Boundary test: cumulative weight = 11.99 (not graduated) vs 12.00 (graduated) with roles < 3."""
    # Case A: 11.99 weight with 2 roles -> NOT graduated
    events_11_99 = [
        {
            "event_type": "custom",
            "signal_weight": 5.99,
            "job_id": "job_1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Terraform"]},
        },
        {
            "event_type": "custom",
            "signal_weight": 6.00,
            "job_id": "job_2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Terraform"]},
        },
    ]
    res_a = mine_career_patterns(events_11_99, now=T0)
    tf_a = next(s for s in res_a["skills"] if s["skill"] == "Terraform")
    assert tf_a["cumulative_weight"] == 11.99
    assert tf_a["distinct_roles_count"] == 2
    assert tf_a["graduated"] is False, "11.99 weight with 2 roles must NOT graduate"
    assert tf_a["progress_pct"] == 99.9

    # Case B: 12.00 weight with 2 roles -> GRADUATED
    events_12_00 = [
        {
            "event_type": "custom",
            "signal_weight": 6.00,
            "job_id": "job_1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Terraform"]},
        },
        {
            "event_type": "custom",
            "signal_weight": 6.00,
            "job_id": "job_2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Terraform"]},
        },
    ]
    res_b = mine_career_patterns(events_12_00, now=T0)
    tf_b = next(s for s in res_b["skills"] if s["skill"] == "Terraform")
    assert tf_b["cumulative_weight"] == 12.00
    assert tf_b["distinct_roles_count"] == 2
    assert tf_b["graduated"] is True, "12.00 weight with 2 roles MUST graduate"
    assert tf_b["progress_pct"] == 100.0


def test_graduation_boundary_2_vs_3_roles():
    """Boundary test: 2 distinct roles (not graduated) vs 3 distinct roles (graduated) with weight < 12.0."""
    # Case A: 2 distinct roles with weight = 4.0 (< 12.0) -> NOT graduated
    events_2_roles = [
        {
            "event_type": "starred",  # +2.0
            "job_id": "job_1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Kubernetes"]},
        },
        {
            "event_type": "starred",  # +2.0
            "job_id": "job_2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Kubernetes"]},
        },
    ]
    res_2 = mine_career_patterns(events_2_roles, now=T0)
    k8s_2 = next(s for s in res_2["skills"] if s["skill"] == "Kubernetes")
    assert k8s_2["cumulative_weight"] == 4.0
    assert k8s_2["distinct_roles_count"] == 2
    assert k8s_2["graduated"] is False, "2 roles with weight 4.0 must NOT graduate"
    assert k8s_2["progress_pct"] == pytest.approx(66.7, abs=0.1)

    # Case B: 3 distinct roles with weight = 6.0 (< 12.0) -> GRADUATED
    events_3_roles = [
        {
            "event_type": "starred",  # +2.0
            "job_id": "job_1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Kubernetes"]},
        },
        {
            "event_type": "starred",  # +2.0
            "job_id": "job_2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Kubernetes"]},
        },
        {
            "event_type": "starred",  # +2.0
            "job_id": "job_3",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Kubernetes"]},
        },
    ]
    res_3 = mine_career_patterns(events_3_roles, now=T0)
    k8s_3 = next(s for s in res_3["skills"] if s["skill"] == "Kubernetes")
    assert k8s_3["cumulative_weight"] == 6.0
    assert k8s_3["distinct_roles_count"] == 3
    assert k8s_3["graduated"] is True, "3 roles MUST graduate even if weight < 12.0"
    assert k8s_3["progress_pct"] == 100.0


def test_graduation_duplicate_job_id_does_not_inflate_role_count():
    """Verify multiple interactions on the SAME job do NOT increment distinct role count."""
    events = [
        {
            "event_type": "viewed",
            "job_id": "job_single",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Ansible"]},
        },
        {
            "event_type": "starred",
            "job_id": "job_single",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Ansible"]},
        },
        {
            "event_type": "package_prepared",
            "job_id": "job_single",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Ansible"]},
        },
    ]
    res = mine_career_patterns(events, now=T0)
    ansible = next(s for s in res["skills"] if s["skill"] == "Ansible")
    assert ansible["distinct_roles_count"] == 1
    assert ansible["graduated"] is False


def test_negative_signals_diminish_weight_without_adding_roles():
    """Verify dismissed/rejected interactions reduce cumulative weight and do not increment positive role count."""
    events = [
        {
            "event_type": "applied",
            "job_id": "job_1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Linux"]},
        },  # +5.0
        {
            "event_type": "applied",
            "job_id": "job_2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Linux"]},
        },  # +5.0
        {
            "event_type": "dismissed",
            "job_id": "job_bad",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"skills": ["Linux"]},
        },  # -2.0
    ]
    res = mine_career_patterns(events, now=T0)
    linux = next(s for s in res["skills"] if s["skill"] == "Linux")
    assert linux["cumulative_weight"] == 8.0
    assert linux["distinct_roles_count"] == 2
    assert linux["graduated"] is False


# ==============================================================================
# Challenge Suite 4: Seniority Trajectory & Velocity
# ==============================================================================


def test_seniority_velocity_upward_trajectory():
    """Verify velocity >= +0.5 produces 'Upward Seniority Trajectory toward Staff/Principal Architect'."""
    events = [
        {
            "event_type": "applied",
            "job_id": "old_1",
            "occurred_at": (T0 - timedelta(days=25)).isoformat(),
            "job_title": "Systems Administrator",  # Tier 2
        },
        {
            "event_type": "applied",
            "job_id": "rec_1",
            "occurred_at": (T0 - timedelta(days=3)).isoformat(),
            "job_title": "Solutions Architect",  # Tier 4
        },
        {
            "event_type": "applied",
            "job_id": "rec_2",
            "occurred_at": (T0 - timedelta(days=1)).isoformat(),
            "job_title": "Principal Infrastructure Architect",  # Tier 4
        },
    ]
    res = mine_career_patterns(events, now=T0)
    sen = res["seniority"]
    assert sen["velocity"] >= 0.5
    assert "Upward Seniority Trajectory" in sen["trajectory"]


def test_seniority_velocity_downward_trajectory():
    """Verify velocity <= -0.5 produces 'Broadening Specialist Foundation'."""
    events = [
        {
            "event_type": "applied",
            "job_id": "old_1",
            "occurred_at": (T0 - timedelta(days=25)).isoformat(),
            "job_title": "Solutions Architect",  # Tier 4
        },
        {
            "event_type": "applied",
            "job_id": "rec_1",
            "occurred_at": (T0 - timedelta(days=3)).isoformat(),
            "job_title": "Systems Administrator",  # Tier 2
        },
    ]
    res = mine_career_patterns(events, now=T0)
    sen = res["seniority"]
    assert sen["velocity"] <= -0.5
    assert "Broadening Specialist Foundation" in sen["trajectory"]


# ==============================================================================
# Challenge Suite 5: Remuneration Normalization
# ==============================================================================


def test_salary_hourly_daily_and_annual_normalization():
    """Verify hourly (x1950) and daily (x240) conversions and annual salary ranges."""
    # Hourly: $80/hr -> 80 * 1950 = $156,000
    assert parse_annual_salary("$80 / hr") == 80.0 * 1950.0
    assert parse_annual_salary("85 p.h.") == 85.0 * 1950.0

    # Daily: $850/day -> 850 * 240 = $204,000
    assert parse_annual_salary("$850 per day") == 850.0 * 240.0
    assert parse_annual_salary("900/day") == 900.0 * 240.0

    # Standard annual range
    assert parse_annual_salary("$150,000 - $160,000") == 155000.0
    assert parse_annual_salary("$165,000 + Super") == 165000.0


def test_remuneration_percentiles_calculation():
    """Verify remuneration weighted mean and percentiles calculation behavior."""
    events = [
        {
            "event_type": "applied",
            "job_id": "s1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"salary": "$140,000"},
        },
        {
            "event_type": "applied",
            "job_id": "s2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"salary": "$160,000"},
        },
        {
            "event_type": "applied",
            "job_id": "s3",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"salary": "$180,000"},
        },
    ]
    res = mine_career_patterns(events, now=T0)
    sal = res["salary_anchoring"]
    assert sal["weighted_mean"] == 160000
    assert sal["p25"] == 140000
    # Note: p75_idx = int(0.75 * 2) = int(1.5) = 1, so index 1 ($160,000) is returned
    assert sal["p75"] == 160000
    assert sal["recommended_min"] == 140000
    assert sal["recommended_preferred"] >= 160000


# ==============================================================================
# Challenge Suite 6: Empirical Findings & Vulnerabilities Documentation
# ==============================================================================


def test_vulnerability_percentile_truncation_underestimates_p75():
    """Empirically demonstrates that int() truncation collapses p75 to p25 when N=2."""
    events = [
        {
            "event_type": "applied",
            "job_id": "s1",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"salary": "$140,000"},
        },
        {
            "event_type": "applied",
            "job_id": "s2",
            "occurred_at": T0.isoformat(),
            "job_snapshot": {"salary": "$180,000"},
        },
    ]
    res = mine_career_patterns(events, now=T0)
    sal = res["salary_anchoring"]
    # Empirical finding: int(0.75 * 1) = 0, so p75 equals p25 ($140,000) despite an $180,000 job
    assert sal["p25"] == 140000
    assert sal["p75"] == 140000, "Vulnerability: p75 truncated to index 0"


def test_vulnerability_junior_engineer_seniority_masking():
    """Empirically demonstrates that 'Junior Engineer' matches Tier 2 before Tier 1."""
    tier, label = classify_seniority_tier("Junior Systems Administrator")
    # Empirical finding: Due to reversed() checking Tier 2 before Tier 1,
    # 'administrator' in Tier 2 triggers before 'junior' in Tier 1 is ever reached.
    assert tier == 2
    assert label == "Mid-Level Specialist"


def test_vulnerability_staff_engineer_classified_tier_3():
    """Empirically demonstrates that 'Staff Engineer' is categorized as Tier 3 instead of Tier 4."""
    tier, label = classify_seniority_tier("Staff Platform Engineer")
    # Empirical finding: 'staff' token is in Tier 3's regex rather than Tier 4
    assert tier == 3
    assert label == "Senior Specialist / Lead"


def test_vulnerability_k_salary_notation_unparsed():
    """Empirically demonstrates that '$120k - $140k' returns None."""
    # Empirical finding: \b\d+(?:\.\d+)?\b does not match digits followed by 'k'
    assert parse_annual_salary("$120k - $140k") is None
    assert parse_annual_salary("150k") is None
