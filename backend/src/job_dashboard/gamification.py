"""Career Gamification, XP Progression & 16-Badge Milestone Achievement Engine.

Authoritative Specifications:
- ORIGINAL_REQUEST.md (## 2026-09-30T15:56:47Z § R3)
- PROJECT.md (§ Architecture, § Feature Inventory, § Interface Contracts)
- Explorer Survey Analysis (§ 2, § 3, § 4, § 7)

Features:
1. 5-Level XP Progression System:
   - Level 1: Career Scout (0 - 249 XP)
   - Level 2: Market Contender (250 - 749 XP)
   - Level 3: Pipeline Builder (750 - 1,499 XP)
   - Level 4: Interview Ready (1,500 - 2,999 XP)
   - Level 5: Executive Vanguard (3,000+ XP)
2. Dynamic Action XP Awards with Anti-Exploit Idempotency:
   - DISCOVER_JOBS_BATCH: +15 XP per 10 unique jobs
   - GENERATE_DOC_PACKAGE: +50 XP per unique job
   - SUBMIT_APPLICATION: +100 XP per unique job
   - LOG_INTERVIEW_STAGE: +150 XP per unique job stage/simulation
3. 16 Milestone Achievement Badges across 4 Categories:
   - Application Milestones: First Contact (1), Momentum Builder (5), Application Centurion (25), Streak Champion (3)
   - Technical Mastery: Cloud Pioneer (5), Identity Master (3), Infrastructure Titan (3), Automation Ace (3)
   - Market Agility: High-Salary Hunter (1), Executive Circle (1), Public Sector Specialist (3), Regional Navigator (3)
   - Preparedness: Master Storyteller (10), STAR Performer (5), Profile Evolutionist (5), Criteria Architect (5)
4. Melbourne/AEST Daily Streak Engine:
   - Anchored to Australia/Melbourne calendar days
   - Previous-day grace period
   - Timezone & DST boundary resilient
"""

from __future__ import annotations

import logging
import re
import sqlite3
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger("job_dashboard.gamification")

# ==============================================================================
# 1. Constants & Specification Dictionaries
# ==============================================================================

MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")

HALF_LIFE_DAYS = 30.0

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
    "ACHIEVEMENT_UNLOCKED": 50,
}

MILESTONE_BADGES_SPEC: dict[str, dict[str, Any]] = {
    # 1. Application Milestones
    "first_contact": {
        "category": "Application Milestones",
        "name": "First Contact",
        "description": "Submit your very first job application through the platform.",
        "icon": "🚀",
        "color": "#10b981",
        "target": 1,
    },
    "momentum_builder": {
        "category": "Application Milestones",
        "name": "Momentum Builder",
        "description": "Submit 5 job applications across the market.",
        "icon": "🔥",
        "color": "#f59e0b",
        "target": 5,
    },
    "application_centurion": {
        "category": "Application Milestones",
        "name": "Application Centurion",
        "description": "Submit 25 job applications across the market.",
        "icon": "🛡️",
        "color": "#8b5cf6",
        "target": 25,
    },
    "streak_champion": {
        "category": "Application Milestones",
        "name": "Streak Champion",
        "description": "Submit applications on 3 consecutive calendar days in Melbourne/AEST time.",
        "icon": "⚡",
        "color": "#eab308",
        "target": 3,
    },
    # 2. Technical Mastery
    "cloud_pioneer": {
        "category": "Technical Mastery",
        "name": "Cloud Pioneer",
        "description": "Target 5 Cloud or DevOps engineering opportunities.",
        "icon": "☁️",
        "color": "#0ea5e9",
        "target": 5,
    },
    "identity_master": {
        "category": "Technical Mastery",
        "name": "Identity Master",
        "description": "Target 3 opportunities emphasizing Microsoft 365, Entra ID, or Identity Governance.",
        "icon": "🪪",
        "color": "#6366f1",
        "target": 3,
    },
    "infrastructure_titan": {
        "category": "Technical Mastery",
        "name": "Infrastructure Titan",
        "description": "Target 3 opportunities focusing on Systems, Virtualization, and Network Infrastructure.",
        "icon": "🖥️",
        "color": "#64748b",
        "target": 3,
    },
    "automation_ace": {
        "category": "Technical Mastery",
        "name": "Automation Ace",
        "description": "Target 3 opportunities requiring PowerShell, Python, or CI/CD Automation.",
        "icon": "🤖",
        "color": "#14b8a6",
        "target": 3,
    },
    # 3. Market Agility
    "high_salary_hunter": {
        "category": "Market Agility",
        "name": "High-Salary Hunter",
        "description": "Target a role offering $140,000+ base remuneration.",
        "icon": "💎",
        "color": "#06b6d4",
        "target": 1,
    },
    "executive_circle": {
        "category": "Market Agility",
        "name": "Executive Circle",
        "description": "Target an elite senior or executive role offering $180,000+ remuneration.",
        "icon": "👑",
        "color": "#f43f5e",
        "target": 1,
    },
    "public_sector_specialist": {
        "category": "Market Agility",
        "name": "Public Sector Specialist",
        "description": "Target 3 Victorian Public Sector (VPS) or Australian Government (APS) roles.",
        "icon": "🏛️",
        "color": "#475569",
        "target": 3,
    },
    "regional_navigator": {
        "category": "Market Agility",
        "name": "Regional Navigator",
        "description": "Target 3 hybrid or remote flexible roles.",
        "icon": "🧭",
        "color": "#059669",
        "target": 3,
    },
    # 4. Preparedness
    "master_storyteller": {
        "category": "Preparedness",
        "name": "Master Storyteller",
        "description": "Synthesize 10 tailored, grounded cover letters for target roles.",
        "icon": "📜",
        "color": "#7c3aed",
        "target": 10,
    },
    "star_performer": {
        "category": "Preparedness",
        "name": "STAR Performer",
        "description": "Complete 5 interview preparation simulations or study sessions.",
        "icon": "⭐",
        "color": "#d97706",
        "target": 5,
    },
    "profile_evolutionist": {
        "category": "Preparedness",
        "name": "Profile Evolutionist",
        "description": "Organically evolve 5 new skills into your candidate profile through targeted interactions.",
        "icon": "🧬",
        "color": "#d946ef",
        "target": 5,
    },
    "criteria_architect": {
        "category": "Preparedness",
        "name": "Criteria Architect",
        "description": "Synthesize 5 Australian Key Selection Criteria (KSC) STAR response packs.",
        "icon": "🎯",
        "color": "#4f46e5",
        "target": 5,
    },
}

# Regex classifiers for domain targeting
RE_CLOUD = re.compile(
    r"\b(aws|azure|gcp|cloud|kubernetes|k8s|terraform|docker|devops|cloud architect|cloud engineer)\b",
    re.IGNORECASE,
)
RE_IDENTITY = re.compile(
    r"\b(entra id|azure ad|m365|microsoft 365|office 365|active directory|identity management|iam|pam|okta|intune)\b",
    re.IGNORECASE,
)
RE_INFRA = re.compile(
    r"\b(systems engineer|systems administrator|infrastructure engineer|vmware|esxi|cisco|networking|datacenter|storage|san|nas|windows server)\b",
    re.IGNORECASE,
)
RE_AUTO = re.compile(
    r"\b(powershell|posh|python|ci\/cd|pipeline|ansible|github actions|gitlab ci|jenkins|scripting|bash|automation engineer)\b",
    re.IGNORECASE,
)
RE_PUBLIC_SECTOR = re.compile(
    r"\b(vps|aps|government|department of|vicgov|commonwealth|public sector|careers vic|aps jobs)\b",
    re.IGNORECASE,
)
RE_REGIONAL = re.compile(
    r"\b(remote|hybrid|wfh|work from home|flexible work)\b",
    re.IGNORECASE,
)


# ==============================================================================
# 2. Date & Time Helpers
# ==============================================================================


def parse_datetime_to_melbourne(dt_input: Any) -> datetime:
    """Parse various datetime representations and convert to Melbourne timezone."""
    if isinstance(dt_input, datetime):
        if dt_input.tzinfo is None:
            dt = dt_input.replace(tzinfo=timezone.utc)
        else:
            dt = dt_input
        return dt.astimezone(MELBOURNE_TZ)

    if isinstance(dt_input, (int, float)):
        return datetime.fromtimestamp(dt_input, tz=timezone.utc).astimezone(
            MELBOURNE_TZ
        )

    if isinstance(dt_input, str) and dt_input:
        clean = dt_input.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(MELBOURNE_TZ)
        except (ValueError, TypeError):
            pass

    return datetime.now(MELBOURNE_TZ)


def get_melbourne_date_str(dt: datetime | str | None = None) -> str:
    """Return YYYY-MM-DD string in Australia/Melbourne timezone."""
    if dt is None:
        return datetime.now(MELBOURNE_TZ).strftime("%Y-%m-%d")
    return parse_datetime_to_melbourne(dt).strftime("%Y-%m-%d")


def compute_decay_weight(
    base_weight: float, delta_days: float, half_life: float = HALF_LIFE_DAYS
) -> float:
    """Compute 30-day exponential half-life decay: w(t) = w0 * 2^(-dt / 30.0)."""
    if delta_days < 0:
        delta_days = 0.0
    return float(base_weight * (2.0 ** (-delta_days / half_life)))


# ==============================================================================
# 3. XP Progression & Level Math
# ==============================================================================


def compute_xp_progress(total_xp: int) -> dict[str, Any]:
    """Calculate candidate level progression based on 5 executive tiers.

    Tiers:
    - Level 1: Career Scout (0 - 249 XP)
    - Level 2: Market Contender (250 - 749 XP)
    - Level 3: Pipeline Builder (750 - 1,499 XP)
    - Level 4: Interview Ready (1,500 - 2,999 XP)
    - Level 5: Executive Vanguard (3,000+ XP)
    """
    clamped_xp = max(0, int(total_xp or 0))
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

    is_max_level = max_xp == float("inf")
    if is_max_level:
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
        "is_max_level": is_max_level,
    }


# ==============================================================================
# 4. Melbourne / AEST Daily Application Streak Engine
# ==============================================================================


def compute_melbourne_streak(
    application_timestamps_utc: list[datetime | str],
    ref_date: datetime | str | None = None,
) -> dict[str, Any]:
    """Calculate consecutive daily application streak anchored to Australia/Melbourne timezone.

    Rules:
    - Normalizes all timestamps into Melbourne calendar dates (YYYY-MM-DD).
    - Preserves streak if application was logged today or yesterday (grace period).
    - Resets current streak to 0 if last application was 2+ calendar days ago.
    - Computes all-time longest streak historically.
    """
    if not application_timestamps_utc:
        return {
            "current_streak": 0,
            "max_streak": 0,
            "is_active_today": False,
            "applied_dates": [],
        }

    melbourne_dates: set[date] = set()
    for ts in application_timestamps_utc:
        dt_melb = parse_datetime_to_melbourne(ts)
        melbourne_dates.add(dt_melb.date())

    if not melbourne_dates:
        return {
            "current_streak": 0,
            "max_streak": 0,
            "is_active_today": False,
            "applied_dates": [],
        }

    sorted_dates = sorted(melbourne_dates)

    if ref_date is not None:
        now_melb = parse_datetime_to_melbourne(ref_date).date()
    else:
        now_melb = datetime.now(MELBOURNE_TZ).date()

    is_active_today = now_melb in melbourne_dates
    yesterday_melb = now_melb - timedelta(days=1)

    # Compute historical maximum streak
    max_streak = 0
    cur_run = 0
    prev_d: date | None = None
    for d in sorted_dates:
        if prev_d is None or d == prev_d + timedelta(days=1):
            cur_run += 1
        elif d > prev_d + timedelta(days=1):
            cur_run = 1
        prev_d = d
        max_streak = max(max_streak, cur_run)

    # Compute current active streak anchored to today (if applied today) or yesterday (grace period)
    current_streak = 0
    if is_active_today:
        anchor = now_melb
    elif yesterday_melb in melbourne_dates:
        anchor = yesterday_melb
    else:
        anchor = None

    if anchor is not None:
        while anchor in melbourne_dates:
            current_streak += 1
            anchor -= timedelta(days=1)

    return {
        "current_streak": current_streak,
        "max_streak": max(max_streak, current_streak),
        "is_active_today": is_active_today,
        "applied_dates": [d.isoformat() for d in sorted_dates],
    }


# ==============================================================================
# 5. Job & Context Classification for Badges
# ==============================================================================


def parse_job_salary(job: dict[str, Any] | Any) -> float:
    """Extract or normalize annual AUD salary from a job card/dict."""
    job_dict = (
        dict(job)
        if isinstance(job, dict)
        else (dict(job.__dict__) if hasattr(job, "__dict__") else {})
    )

    # Check explicit fields
    for field in ("salary_max", "salary_min", "salary_raw", "salary", "remuneration"):
        val = job_dict.get(field)
        if val is None:
            continue
        if isinstance(val, (int, float)) and val > 0:
            if val < 500:  # Hourly rate
                return val * 1950.0
            if val < 2000:  # Daily rate
                return val * 240.0
            return float(val)
        if isinstance(val, str):
            # Parse $150k or $150,000
            m_k = re.search(r"\$?\s*(\d+(?:\.\d+)?)\s*k\b", val, re.IGNORECASE)
            if m_k:
                return float(m_k.group(1)) * 1000.0
            m_full = re.search(r"\$?\s*(\d{2,3}),(\d{3})", val)
            if m_full:
                return float(m_full.group(1) + m_full.group(2))

    # Parse text
    text = f"{job_dict.get('title', '')} {job_dict.get('description', '')}".lower()
    m_k = re.search(r"\$(\d{2,3})\s*k\b", text)
    if m_k:
        return float(m_k.group(1)) * 1000.0

    return 0.0


def classify_job_for_badges(job: dict[str, Any] | Any) -> dict[str, bool]:
    """Classify a job against Technical Mastery and Market Agility badge criteria."""
    job_dict = (
        dict(job)
        if isinstance(job, dict)
        else (dict(job.__dict__) if hasattr(job, "__dict__") else {})
    )

    title = str(job_dict.get("title") or "")
    desc = str(job_dict.get("description") or "")
    source = str(job_dict.get("source") or "").lower()
    location = str(job_dict.get("location") or "")
    company = str(job_dict.get("company") or "")

    full_text = f"{title} {desc} {company} {location}".lower()

    # Remote detection
    is_remote = bool(
        job_dict.get("remote") in (1, True, "1", "true")
        or RE_REGIONAL.search(full_text)
    )

    # Public sector detection
    is_public_sector = bool(
        source in ("careers_vic", "aps_jobs", "vicgov", "aps")
        or RE_PUBLIC_SECTOR.search(full_text)
    )

    salary = parse_job_salary(job_dict)

    return {
        "is_cloud": bool(RE_CLOUD.search(full_text)),
        "is_identity": bool(RE_IDENTITY.search(full_text)),
        "is_infra": bool(RE_INFRA.search(full_text)),
        "is_auto": bool(RE_AUTO.search(full_text)),
        "is_high_salary": salary >= 140000.0,
        "is_exec_salary": salary >= 180000.0,
        "is_public_sector": is_public_sector,
        "is_regional": is_remote,
    }


# ==============================================================================
# 6. 16 Milestone Achievement Badges Rules Engine
# ==============================================================================


def evaluate_badges(
    stats: dict[str, Any],
    historical_actions: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Deterministically evaluate all 16 milestone achievement badges against user statistics."""
    stats = stats or {}
    results = []

    for badge_id, spec in MILESTONE_BADGES_SPEC.items():
        target = spec["target"]
        progress = 0

        # Category 1: Application Milestones
        if badge_id in ("first_contact", "momentum_builder", "application_centurion"):
            progress = int(
                stats.get("total_applications")
                or stats.get("totalApplications")
                or stats.get("applications_count")
                or 0
            )
        elif badge_id == "streak_champion":
            progress = int(
                stats.get("current_streak")
                or stats.get("currentStreak")
                or stats.get("max_streak")
                or 0
            )

        # Category 2: Technical Mastery
        elif badge_id == "cloud_pioneer":
            progress = int(
                stats.get("cloud_roles_count") or stats.get("cloudRolesCount") or 0
            )
        elif badge_id == "identity_master":
            progress = int(
                stats.get("identity_roles_count")
                or stats.get("identityRolesCount")
                or 0
            )
        elif badge_id == "infrastructure_titan":
            progress = int(
                stats.get("infrastructure_roles_count")
                or stats.get("infrastructureRolesCount")
                or 0
            )
        elif badge_id == "automation_ace":
            progress = int(
                stats.get("automation_roles_count")
                or stats.get("automationRolesCount")
                or 0
            )

        # Category 3: Market Agility
        elif badge_id == "high_salary_hunter":
            val = stats.get("high_salary_targeted") or stats.get("highSalaryTargeted")
            progress = 1 if val else 0
        elif badge_id == "executive_circle":
            val = stats.get("executive_targeted") or stats.get("executiveTargeted")
            progress = 1 if val else 0
        elif badge_id == "public_sector_specialist":
            progress = int(
                stats.get("public_sector_count") or stats.get("publicSectorCount") or 0
            )
        elif badge_id == "regional_navigator":
            progress = int(
                stats.get("regional_count") or stats.get("regionalCount") or 0
            )

        # Category 4: Preparedness
        elif badge_id == "master_storyteller":
            progress = int(
                stats.get("cover_letters_generated")
                or stats.get("coverLettersGenerated")
                or 0
            )
        elif badge_id == "star_performer":
            progress = int(
                stats.get("interviews_simulated")
                or stats.get("interviewsSimulated")
                or 0
            )
        elif badge_id == "profile_evolutionist":
            progress = int(
                stats.get("skills_evolved_count")
                or stats.get("skillsEvolvedCount")
                or 0
            )
        elif badge_id == "criteria_architect":
            progress = int(
                stats.get("ksc_packs_generated") or stats.get("kscPacksGenerated") or 0
            )

        unlocked = progress >= target
        capped_progress = min(progress, target)
        progress_pct = round(
            min(100.0, (capped_progress / target) * 100.0) if target > 0 else 100.0,
            1,
        )

        results.append(
            {
                "id": badge_id,
                "achievement_id": badge_id,
                "name": spec["name"],
                "category": spec["category"],
                "description": spec["description"],
                "icon": spec["icon"],
                "color": spec["color"],
                "unlocked": unlocked,
                "unlocked_at": (
                    datetime.now(timezone.utc).isoformat() if unlocked else None
                ),
                "progress": capped_progress,
                "progress_value": float(capped_progress),
                "target": target,
                "target_value": float(target),
                "progress_pct": progress_pct,
            }
        )

    return results


# ==============================================================================
# 7. Action XP Award with Anti-Exploit Idempotency
# ==============================================================================


def evaluate_action_xp(
    action_type: str,
    metadata: dict[str, Any] | None = None,
    action_history: list[dict[str, Any]] | None = None,
) -> tuple[int, bool, str]:
    """Calculate XP for an action and verify anti-exploit idempotency.

    Returns:
    (xp_awarded, is_awarded, rationale)
    """
    metadata = metadata or {}
    action_history = action_history or []
    norm_action = str(action_type or "").strip().upper()

    if norm_action not in ACTION_XP:
        return 0, False, f"Unknown gamification action: {action_type}"

    base_xp = ACTION_XP[norm_action]
    job_id = str(metadata.get("job_id") or metadata.get("jobId") or "")

    # Anti-exploit checks:
    if norm_action == "DISCOVER_JOBS_BATCH":
        # Discovered jobs: +15 XP awarded per 10 unique jobs
        # Compute how many unique jobs have been seen so far
        previously_seen = set()
        prev_awarded_batches = 0
        for h in action_history:
            if h.get("action_type") == "DISCOVER_JOBS_BATCH":
                prev_awarded_batches += 1
                for jid in h.get("job_ids", []):
                    previously_seen.add(str(jid))

        new_jobs = metadata.get("job_ids") or []
        if not new_jobs and "count" in metadata:
            # Batch increment directly requested
            count = int(metadata["count"] or 0)
            if count >= 10:
                return (
                    base_xp,
                    True,
                    f"Discovered batch of {count} jobs (+{base_xp} XP)",
                )
            return 0, False, "Batch size under threshold of 10 jobs"

        unique_new = [str(j) for j in new_jobs if str(j) not in previously_seen]
        if (
            len(unique_new) >= 10
            or (len(previously_seen) + len(unique_new)) // 10 > prev_awarded_batches
        ):
            return base_xp, True, f"Discovered 10 unique jobs (+{base_xp} XP)"
        return 0, False, "Insufficient new unique jobs to reach next 10-job milestone"

    if norm_action == "GENERATE_DOC_PACKAGE":
        if not job_id:
            return (
                base_xp,
                True,
                f"Generated tailored application package (+{base_xp} XP)",
            )
        # Check idempotency per job_id
        for h in action_history:
            if (
                h.get("action_type") == "GENERATE_DOC_PACKAGE"
                and str(h.get("job_id")) == job_id
            ):
                return (
                    0,
                    False,
                    f"Package already prepared for job {job_id} (idempotent)",
                )
        return (
            base_xp,
            True,
            f"Prepared application package for job {job_id} (+{base_xp} XP)",
        )

    if norm_action == "SUBMIT_APPLICATION":
        if not job_id:
            return base_xp, True, f"Submitted application (+{base_xp} XP)"
        # Check idempotency per job_id
        for h in action_history:
            if (
                h.get("action_type") == "SUBMIT_APPLICATION"
                and str(h.get("job_id")) == job_id
            ):
                return (
                    0,
                    False,
                    f"Application already logged for job {job_id} (idempotent)",
                )
        return base_xp, True, f"Submitted application for job {job_id} (+{base_xp} XP)"

    if norm_action == "LOG_INTERVIEW_STAGE":
        stage = str(metadata.get("stage") or "interview")
        session_id = str(metadata.get("session_id") or "")
        key = f"{job_id}:{stage}" if job_id else session_id
        if key:
            for h in action_history:
                if (
                    h.get("action_type") == "LOG_INTERVIEW_STAGE"
                    and h.get("key") == key
                ):
                    return (
                        0,
                        False,
                        f"Interview stage already recorded for {key} (idempotent)",
                    )
        return base_xp, True, f"Logged interview stage (+{base_xp} XP)"

    return base_xp, True, f"Awarded {base_xp} XP for {norm_action}"


# ==============================================================================
# 8. User Gamification Recalculation Engine
# ==============================================================================


def recalculate_user_gamification(
    user_id: str,
    repository: Any,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Rebuild complete user XP, level, streak, and 16 badges from database history."""
    profile = profile or {}
    user_id = str(user_id or "sam_ludwig")

    # 1. Gather all applications
    applications = []
    if repository and hasattr(repository, "list_applications"):
        try:
            applications = repository.list_applications(user_id=user_id)
        except (
            sqlite3.Error,
            ValueError,
            KeyError,
            TypeError,
            AttributeError,
            RuntimeError,
        ) as e:
            logger.debug(f"Error fetching applications: {e}")

    # Gather telemetry events
    telemetry_events = []
    if repository and hasattr(repository, "get_telemetry_events"):
        try:
            telemetry_events = repository.get_telemetry_events(
                user_id=user_id, limit=1000
            )
        except (
            sqlite3.Error,
            ValueError,
            KeyError,
            TypeError,
            AttributeError,
            RuntimeError,
        ) as e:
            logger.debug(f"Error fetching telemetry: {e}")

    # 2. Extract application timestamps and distinct targeted jobs
    application_timestamps = []
    applied_job_ids = set()
    cloud_roles_count = 0
    identity_roles_count = 0
    infrastructure_roles_count = 0
    automation_roles_count = 0
    high_salary_targeted = False
    executive_targeted = False
    public_sector_count = 0
    regional_count = 0
    cover_letters_count = 0
    ksc_packs_count = 0
    interviews_count = 0

    # Inspect applications
    for app in applications:
        app_dict = (
            dict(app)
            if isinstance(app, dict)
            else (dict(app.__dict__) if hasattr(app, "__dict__") else {})
        )
        status = str(app_dict.get("status") or "").lower()
        applied_at = (
            app_dict.get("applied_at")
            or app_dict.get("created_at")
            or app_dict.get("updated_at")
        )
        job_id = str(app_dict.get("job_id") or app_dict.get("id") or "")

        if status in (
            "applied",
            "submitted",
            "interviewing",
            "interview",
            "offered",
            "offer",
            "accepted",
        ):
            if applied_at:
                application_timestamps.append(applied_at)
            if job_id:
                applied_job_ids.add(job_id)

        if status in ("interviewing", "interview"):
            interviews_count += 1

        # Classify job attributes
        classification = classify_job_for_badges(app_dict)
        if classification["is_cloud"]:
            cloud_roles_count += 1
        if classification["is_identity"]:
            identity_roles_count += 1
        if classification["is_infra"]:
            infrastructure_roles_count += 1
        if classification["is_auto"]:
            automation_roles_count += 1
        if classification["is_high_salary"]:
            high_salary_targeted = True
        if classification["is_exec_salary"]:
            executive_targeted = True
        if classification["is_public_sector"]:
            public_sector_count += 1
        if classification["is_regional"]:
            regional_count += 1

        if app_dict.get("cover_letter_text") or app_dict.get("coverLetter"):
            cover_letters_count += 1
        if app_dict.get("ksc_report") or app_dict.get("ksc"):
            ksc_packs_count += 1

    # Inspect telemetry events
    for evt in telemetry_events:
        evt_type = str(evt.get("event_type") or "").lower()
        job_id = str(evt.get("job_id") or "")
        created_at = evt.get("created_at") or evt.get("occurred_at")

        if evt_type in ("applied", "submitted") and created_at:
            application_timestamps.append(created_at)
            if job_id:
                applied_job_ids.add(job_id)

        if evt_type in ("interview_scheduled", "interviewing"):
            interviews_count += 1

        if evt_type in ("package_prepared", "generated_docs"):
            cover_letters_count += 1
            ksc_packs_count += 1

        # Check job classification from telemetry metadata or title
        classification = classify_job_for_badges(
            {
                "title": evt.get("job_title", ""),
                "company": evt.get("company", ""),
                "source": evt.get("source", ""),
                "description": evt.get("metadata", {}).get("description", ""),
            }
        )
        if classification["is_cloud"]:
            cloud_roles_count += 1
        if classification["is_identity"]:
            identity_roles_count += 1
        if classification["is_infra"]:
            infrastructure_roles_count += 1
        if classification["is_auto"]:
            automation_roles_count += 1
        if classification["is_high_salary"]:
            high_salary_targeted = True
        if classification["is_exec_salary"]:
            executive_targeted = True
        if classification["is_public_sector"]:
            public_sector_count += 1
        if classification["is_regional"]:
            regional_count += 1

    # 3. Calculate streak
    streak_info = compute_melbourne_streak(application_timestamps)

    # 4. Check evolved skills from profile
    evolution_history = profile.get("evolutionHistory") or []
    skills_evolved_count = len(
        [
            h
            for h in evolution_history
            if isinstance(h, dict) and h.get("status", "active") == "active"
        ]
    )

    # 5. Compute XP from actions with anti-exploit
    total_xp = (
        len(applied_job_ids) * ACTION_XP["SUBMIT_APPLICATION"]
        + (cover_letters_count) * ACTION_XP["GENERATE_DOC_PACKAGE"]
        + (interviews_count) * ACTION_XP["LOG_INTERVIEW_STAGE"]
    )

    # 6. Evaluate badges
    stats = {
        "total_applications": max(len(applied_job_ids), len(applications)),
        "current_streak": streak_info["current_streak"],
        "max_streak": streak_info["max_streak"],
        "cloud_roles_count": cloud_roles_count,
        "identity_roles_count": identity_roles_count,
        "infrastructure_roles_count": infrastructure_roles_count,
        "automation_roles_count": automation_roles_count,
        "high_salary_targeted": high_salary_targeted,
        "executive_targeted": executive_targeted,
        "public_sector_count": public_sector_count,
        "regional_count": regional_count,
        "cover_letters_generated": cover_letters_count,
        "interviews_simulated": interviews_count,
        "skills_evolved_count": skills_evolved_count,
        "ksc_packs_generated": ksc_packs_count,
    }

    evaluated_badges = evaluate_badges(stats)

    # Award bonus XP for unlocked badges (+50 XP per unlocked badge)
    unlocked_badge_count = sum(1 for b in evaluated_badges if b["unlocked"])
    total_xp += unlocked_badge_count * ACTION_XP["ACHIEVEMENT_UNLOCKED"]

    # 7. Compute level
    level_progress = compute_xp_progress(total_xp)

    # 8. Sync to database if repository available
    if repository and hasattr(repository, "batch_upsert_achievements"):
        try:
            repository.batch_upsert_achievements(user_id, evaluated_badges)
        except (
            sqlite3.Error,
            ValueError,
            KeyError,
            TypeError,
            AttributeError,
            RuntimeError,
        ) as e:
            logger.debug(f"Error persisting achievements: {e}")

    if repository and hasattr(repository, "upsert_user_gamification"):
        try:
            repository.upsert_user_gamification(
                user_id=user_id,
                total_xp=total_xp,
                current_level=level_progress["level"],
                current_streak=streak_info["current_streak"],
                longest_streak=streak_info["max_streak"],
                last_applied_date_melbourne=streak_info["applied_dates"][-1]
                if streak_info["applied_dates"]
                else "",
            )
        except (
            sqlite3.Error,
            ValueError,
            KeyError,
            TypeError,
            AttributeError,
            RuntimeError,
        ) as e:
            logger.debug(f"Error persisting user gamification state: {e}")

    return {
        "user_id": user_id,
        "xp": level_progress,
        "streak": streak_info,
        "stats": stats,
        "badges": evaluated_badges,
        "unlocked_count": unlocked_badge_count,
        "total_badges": len(evaluated_badges),
    }
