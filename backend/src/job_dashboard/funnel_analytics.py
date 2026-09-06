"""Multi-Sector Application Analytics, Funnel Conversion & Pipeline Velocity Engine.

Analyzes candidate job tracking pipelines across lifecycle stages, calculates conversion
velocities and cycle times, flags stalled applications, benchmarks metrics against Australian
industry standards (Technology, Healthcare, Finance, Trades, Legal), and computes pipeline health.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


STAGE_ORDER = [
    "sourced",
    "shortlisted",
    "applied",
    "interviewing",
    "offer",
    "accepted",
]

# Australian industry conversion benchmarks
AU_SECTOR_BENCHMARKS: Dict[str, Dict[str, Any]] = {
    "technology": {
        "sector_label": "Technology & Engineering",
        "apply_to_interview_pct": 12.0,
        "interview_to_offer_pct": 22.0,
        "overall_yield_pct": 2.6,
        "avg_days_to_interview": 14,
        "avg_cycle_days": 28,
        "market_summary": "High screening volume, technical take-home/coding rounds, standard 28-day hiring loop.",
    },
    "healthcare": {
        "sector_label": "Healthcare & Nursing",
        "apply_to_interview_pct": 28.0,
        "interview_to_offer_pct": 45.0,
        "overall_yield_pct": 12.6,
        "avg_days_to_interview": 8,
        "avg_cycle_days": 18,
        "market_summary": "Credential-driven fast recruitment with high vacancy pressure and rapid interviews.",
    },
    "finance": {
        "sector_label": "Banking, Finance & Accounting",
        "apply_to_interview_pct": 15.0,
        "interview_to_offer_pct": 24.0,
        "overall_yield_pct": 3.6,
        "avg_days_to_interview": 16,
        "avg_cycle_days": 32,
        "market_summary": "Multi-stage partner/MD reviews, background checks, and conservative cadence.",
    },
    "trades": {
        "sector_label": "Trades, Construction & Logistics",
        "apply_to_interview_pct": 35.0,
        "interview_to_offer_pct": 52.0,
        "overall_yield_pct": 18.2,
        "avg_days_to_interview": 5,
        "avg_cycle_days": 12,
        "market_summary": "Immediate site ticket verification, trial days, direct superintendent phone screens.",
    },
    "legal": {
        "sector_label": "Legal & Professional Services",
        "apply_to_interview_pct": 18.0,
        "interview_to_offer_pct": 28.0,
        "overall_yield_pct": 5.0,
        "avg_days_to_interview": 18,
        "avg_cycle_days": 35,
        "market_summary": "Structured partner interviews, writing sample audits, compliance clearances.",
    },
}

DEFAULT_BENCHMARK = AU_SECTOR_BENCHMARKS["technology"]


def _parse_iso_date(date_str: Any) -> Optional[datetime]:
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _get_job_stage(status_val: Any) -> str:
    status = str(status_val or "new").strip().lower()
    if status in ("accepted", "hired"):
        return "accepted"
    if status in ("offer", "offered"):
        return "offer"
    if status in ("interviewing", "interview", "screening", "technical_interview", "final_interview"):
        return "interviewing"
    if status in ("applied", "submitted", "in_review"):
        return "applied"
    if status in ("saved", "shortlist", "shortlisted"):
        return "shortlisted"
    return "sourced"


def detect_stalled_applications(
    jobs: List[Dict[str, Any]],
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Identifies applications that have remained in an active stage beyond expected thresholds."""
    current_time = now or datetime.now(timezone.utc)
    stalled_list = []

    for job in jobs:
        status = str(job.get("status") or "new").strip().lower()
        if status not in ("applied", "interviewing", "shortlisted", "saved"):
            continue

        applied_dt = _parse_iso_date(job.get("applied_date") or job.get("date_applied"))
        updated_dt = _parse_iso_date(job.get("updated_at") or job.get("last_updated"))
        shortlisted_dt = _parse_iso_date(job.get("date_shortlisted") or job.get("date_added"))

        days_in_stage = 0
        threshold = 14
        stage = status

        if status == "applied":
            threshold = 14
            ref_dt = applied_dt or updated_dt
            if ref_dt:
                days_in_stage = max(0, (current_time - ref_dt).days)
            else:
                continue

            if days_in_stage >= threshold:
                severity = "critical" if days_in_stage >= 24 else "warning"
                stalled_list.append({
                    "id": job.get("id"),
                    "title": job.get("title", "Unknown Role"),
                    "company": job.get("company", "Unknown Employer"),
                    "stage": "applied",
                    "days_in_stage": days_in_stage,
                    "threshold_days": threshold,
                    "severity": severity,
                    "action_recommendation": f"Application pending for {days_in_stage} days without response. Send a polite 14-day check-in email to the hiring manager or recruiter.",
                })

        elif status in ("interviewing", "interview"):
            threshold = 21
            ref_dt = updated_dt or _parse_iso_date(job.get("interview_date")) or applied_dt
            if ref_dt:
                days_in_stage = max(0, (current_time - ref_dt).days)
            else:
                continue

            if days_in_stage >= threshold:
                severity = "critical" if days_in_stage >= 30 else "warning"
                stalled_list.append({
                    "id": job.get("id"),
                    "title": job.get("title", "Unknown Role"),
                    "company": job.get("company", "Unknown Employer"),
                    "stage": "interviewing",
                    "days_in_stage": days_in_stage,
                    "threshold_days": threshold,
                    "severity": severity,
                    "action_recommendation": f"Interview stage has had no updates in {days_in_stage} days. Request feedback on interview panel deliberations or check next round timelines.",
                })

        elif status in ("shortlisted", "saved"):
            threshold = 30
            ref_dt = shortlisted_dt or updated_dt
            if ref_dt:
                days_in_stage = max(0, (current_time - ref_dt).days)
                if days_in_stage >= threshold:
                    stalled_list.append({
                        "id": job.get("id"),
                        "title": job.get("title", "Unknown Role"),
                        "company": job.get("company", "Unknown Employer"),
                        "stage": "shortlisted",
                        "days_in_stage": days_in_stage,
                        "threshold_days": threshold,
                        "severity": "warning",
                        "action_recommendation": f"Job shortlisted {days_in_stage} days ago without applying. Check if listing is still active and submit application or archive.",
                    })

    stalled_list.sort(key=lambda x: (x["severity"] == "critical", x["days_in_stage"]), reverse=True)
    return stalled_list


def calculate_pipeline_velocity(
    jobs: List[Dict[str, Any]],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Computes average duration (in days) between stages."""
    current_time = now or datetime.now(timezone.utc)

    days_to_interview_samples: List[float] = []
    days_interview_to_offer_samples: List[float] = []
    total_cycle_samples: List[float] = []

    for job in jobs:
        applied_dt = _parse_iso_date(job.get("applied_date") or job.get("date_applied"))
        interview_dt = _parse_iso_date(job.get("interview_date"))
        offer_dt = _parse_iso_date(job.get("offer_date"))
        accepted_dt = _parse_iso_date(job.get("accepted_date"))

        # Days to interview
        if applied_dt and interview_dt and interview_dt >= applied_dt:
            days = (interview_dt - applied_dt).total_seconds() / 86400.0
            days_to_interview_samples.append(days)

        # Days interview to offer
        if interview_dt and offer_dt and offer_dt >= interview_dt:
            days = (offer_dt - interview_dt).total_seconds() / 86400.0
            days_interview_to_offer_samples.append(days)

        # Overall cycle time (applied to offer/accepted)
        end_dt = accepted_dt or offer_dt
        if applied_dt and end_dt and end_dt >= applied_dt:
            days = (end_dt - applied_dt).total_seconds() / 86400.0
            total_cycle_samples.append(days)

    avg_days_to_interview = (
        sum(days_to_interview_samples) / len(days_to_interview_samples)
        if days_to_interview_samples
        else None
    )
    avg_days_interview_to_offer = (
        sum(days_interview_to_offer_samples) / len(days_interview_to_offer_samples)
        if days_interview_to_offer_samples
        else None
    )
    avg_cycle_days = (
        sum(total_cycle_samples) / len(total_cycle_samples)
        if total_cycle_samples
        else None
    )

    return {
        "avg_days_to_interview": avg_days_to_interview,
        "avg_days_interview_to_offer": avg_days_interview_to_offer,
        "avg_cycle_days": avg_cycle_days,
        "interview_samples_count": len(days_to_interview_samples),
        "offer_samples_count": len(days_interview_to_offer_samples),
    }


def calculate_conversion_rates(stage_counts: Dict[str, int]) -> Dict[str, float]:
    """Calculates percentage progression between consecutive stages."""
    sourced = stage_counts.get("sourced", 0)
    shortlisted = stage_counts.get("shortlisted", 0)
    applied = stage_counts.get("applied", 0)
    interviewing = stage_counts.get("interviewing", 0)
    offer = stage_counts.get("offer", 0)
    accepted = stage_counts.get("accepted", 0)

    sourced_to_shortlist = (shortlisted / sourced * 100.0) if sourced > 0 else 0.0
    shortlist_to_apply = (applied / shortlisted * 100.0) if shortlisted > 0 else 0.0
    apply_to_interview = (interviewing / applied * 100.0) if applied > 0 else 0.0
    interview_to_offer = (offer / interviewing * 100.0) if interviewing > 0 else 0.0
    offer_to_accepted = (accepted / offer * 100.0) if offer > 0 else 0.0
    overall_yield = (accepted / sourced * 100.0) if sourced > 0 else 0.0

    return {
        "sourced_to_shortlist_pct": round(sourced_to_shortlist, 1),
        "shortlist_to_apply_pct": round(shortlist_to_apply, 1),
        "apply_to_interview_pct": round(apply_to_interview, 1),
        "interview_to_offer_pct": round(interview_to_offer, 1),
        "offer_to_accepted_pct": round(offer_to_accepted, 1),
        "overall_yield_pct": round(overall_yield, 1),
    }


def compute_funnel_analytics(
    jobs: List[Dict[str, Any]],
    sector: str = "technology",
    now_iso: Optional[str] = None,
) -> Dict[str, Any]:
    """Aggregates all job tracking data into a complete funnel analytics report."""
    now = _parse_iso_date(now_iso) if now_iso else datetime.now(timezone.utc)
    sector_key = (sector or "technology").lower().strip()
    benchmark = AU_SECTOR_BENCHMARKS.get(sector_key, DEFAULT_BENCHMARK)

    total_jobs = len(jobs)

    # Initialize cumulative stage trackers
    # Funnel logic: any job that reached stage N is also counted in stages < N
    sourced_count = total_jobs
    shortlisted_jobs = []
    applied_jobs = []
    interviewing_jobs = []
    offer_jobs = []
    accepted_jobs = []
    rejected_count = 0
    active_pipeline_count = 0

    for job in jobs:
        status = str(job.get("status") or "new").strip().lower()

        is_accepted = status in ("accepted", "hired")
        is_offer = is_accepted or status in ("offer", "offered")
        is_interview = is_offer or status in ("interviewing", "interview", "screening", "technical_interview", "final_interview")
        is_applied = is_interview or status in ("applied", "submitted", "in_review", "rejected")
        is_shortlisted = is_applied or status in ("saved", "shortlist", "shortlisted")

        if status == "rejected":
            rejected_count += 1

        if is_shortlisted:
            shortlisted_jobs.append(job)
        if is_applied:
            applied_jobs.append(job)
        if is_interview:
            interviewing_jobs.append(job)
        if is_offer:
            offer_jobs.append(job)
        if is_accepted:
            accepted_jobs.append(job)

        if status in ("saved", "shortlisted", "applied", "interviewing", "offer"):
            active_pipeline_count += 1

    stage_counts = {
        "sourced": sourced_count,
        "shortlisted": len(shortlisted_jobs),
        "applied": len(applied_jobs),
        "interviewing": len(interviewing_jobs),
        "offer": len(offer_jobs),
        "accepted": len(accepted_jobs),
    }

    conversion_rates = calculate_conversion_rates(stage_counts)
    stalled = detect_stalled_applications(jobs, now=now)
    velocity = calculate_pipeline_velocity(jobs, now=now)

    # 30-Day Pipeline Forecast
    # Predicted interviews = active applied * benchmark or candidate apply_to_interview rate
    active_applied_count = sum(1 for j in jobs if str(j.get("status", "")).lower() == "applied")
    active_interview_count = sum(1 for j in jobs if str(j.get("status", "")).lower() in ("interviewing", "interview"))

    est_apply_rate = (conversion_rates["apply_to_interview_pct"] or benchmark["apply_to_interview_pct"]) / 100.0
    est_offer_rate = (conversion_rates["interview_to_offer_pct"] or benchmark["interview_to_offer_pct"]) / 100.0

    forecast_interviews = max(0, round(active_applied_count * est_apply_rate, 1))
    forecast_offers = max(0, round(active_interview_count * est_offer_rate, 1))

    # Health Score Calculation (0 - 100)
    # 1. Pipeline Depth (0-25)
    depth_score = min(25, (active_pipeline_count / 10.0) * 25)
    # 2. Conversion Performance vs Benchmark (0-35)
    user_conv = conversion_rates["apply_to_interview_pct"]
    mkt_conv = benchmark["apply_to_interview_pct"]
    conv_ratio = (user_conv / mkt_conv) if mkt_conv > 0 else 1.0
    conv_score = min(35, max(5, conv_ratio * 25))
    # 3. Low Stall Ratio (0-25)
    stall_ratio = (len(stalled) / max(1, active_pipeline_count))
    stall_score = max(0, 25 - (stall_ratio * 30))
    # 4. Activity Momentum (0-15)
    momentum_score = 15 if active_pipeline_count >= 3 else (active_pipeline_count * 5)

    health_score = int(min(100, max(0, depth_score + conv_score + stall_score + momentum_score)))

    if health_score >= 80:
        health_label = "Thriving"
        health_badge = "emerald"
    elif health_score >= 65:
        health_label = "Healthy"
        health_badge = "cyan"
    elif health_score >= 45:
        health_label = "Needs Momentum"
        health_badge = "amber"
    else:
        health_label = "At Risk / Stalled"
        health_badge = "rose"

    # Actionable Recommendations
    recommendations = []
    if len(stalled) > 0:
        recommendations.append({
            "type": "stalled_alert",
            "title": f"Unstick {len(stalled)} Stalled Applications",
            "description": f"You have {len(stalled)} applications waiting beyond standard SLA response windows. Follow up with recruiters or hiring managers.",
            "priority": "high",
        })
    if stage_counts["applied"] > 0 and conversion_rates["apply_to_interview_pct"] < benchmark["apply_to_interview_pct"] * 0.7:
        recommendations.append({
            "type": "resume_tailoring",
            "title": "Optimize Resume Alignment",
            "description": f"Your application-to-interview conversion ({conversion_rates['apply_to_interview_pct']}%) is below market average ({benchmark['apply_to_interview_pct']}%). Run the Semantic Gap Analyzer on upcoming applications.",
            "priority": "medium",
        })
    if active_pipeline_count < 5:
        recommendations.append({
            "type": "pipeline_depth",
            "title": "Build Pipeline Buffer",
            "description": f"Active pipeline has only {active_pipeline_count} opportunities. Expand your search query to maintain interview momentum.",
            "priority": "medium",
        })

    return {
        "total_jobs": total_jobs,
        "active_pipeline_count": active_pipeline_count,
        "rejected_count": rejected_count,
        "sector": sector_key,
        "health_score": health_score,
        "health_label": health_label,
        "health_badge": health_badge,
        "stages": {
            "sourced": {"count": stage_counts["sourced"], "label": "Sourced / Discovered"},
            "shortlisted": {"count": stage_counts["shortlisted"], "label": "Shortlisted"},
            "applied": {"count": stage_counts["applied"], "label": "Applied"},
            "interviewing": {"count": stage_counts["interviewing"], "label": "Interviewing"},
            "offer": {"count": stage_counts["offer"], "label": "Offer Received"},
            "accepted": {"count": stage_counts["accepted"], "label": "Accepted / Hired"},
        },
        "conversion_rates": conversion_rates,
        "velocity": velocity,
        "stalled_applications": stalled,
        "forecast_30d": {
            "estimated_interviews": forecast_interviews,
            "estimated_offers": forecast_offers,
            "active_applied_count": active_applied_count,
            "active_interview_count": active_interview_count,
        },
        "benchmark": {
            "sector": sector_key,
            "sector_label": benchmark["sector_label"],
            "market_apply_to_interview_pct": benchmark["apply_to_interview_pct"],
            "market_interview_to_offer_pct": benchmark["interview_to_offer_pct"],
            "market_overall_yield_pct": benchmark["overall_yield_pct"],
            "market_avg_cycle_days": benchmark["avg_cycle_days"],
            "market_summary": benchmark["market_summary"],
            "delta_apply_to_interview": round(conversion_rates["apply_to_interview_pct"] - benchmark["apply_to_interview_pct"], 1),
        },
        "recommendations": recommendations,
        "timestamp": now.isoformat(),
    }

