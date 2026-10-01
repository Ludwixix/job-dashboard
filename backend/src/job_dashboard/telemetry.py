"""Autonomous Multi-Signal Job Interaction Telemetry & Pattern Mining Engine.

Implements Milestone M1:
1. Exact Weighted Interaction Signals:
   - applied: +5.0
   - interview_scheduled: +6.0
   - package_prepared / generated_docs: +4.0
   - starred / saved: +2.0
   - viewed: +0.5
   - dismissed / rejected: -2.0
2. Temporal Half-Life Decay:
   - w(t) = w0 * 2^(-Delta_t / 30.0) where Delta_t is in elapsed days.
3. 4-Dimension Pattern Mining:
   - Technical Stacks & Skills (graduation: cumulative weight >= 12.0 or distinct roles >= 3)
   - Role Archetypes & Seniority Trajectories (5 tiers, weighted tier, 14-day velocity)
   - Industry & Sector Clusters (VPS, Healthcare, Higher Ed, MSP, Financial Services, etc.)
   - Remuneration Anchoring (hourly/daily normalization, weighted mean, p25/p75 percentiles)
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any

# ==============================================================================
# 1. Interaction Signal Weights & Aliases
# ==============================================================================

CORE_SIGNAL_WEIGHTS: dict[str, float] = {
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

SIGNAL_ALIASES: dict[str, str] = {
    "submitted": "applied",
    "application_sent": "applied",
    "interviewing": "interview_scheduled",
    "stage_progression": "interview_scheduled",
    "ksc_generated": "package_prepared",
    "promoted": "starred",
    "opened": "viewed",
    "card_expanded": "viewed",
    "demoted": "dismissed",
}

SIGNAL_WEIGHTS: dict[str, float] = dict(CORE_SIGNAL_WEIGHTS)
for alias, target in SIGNAL_ALIASES.items():
    SIGNAL_WEIGHTS[alias] = CORE_SIGNAL_WEIGHTS[target]


def get_signal_weight(event_type: str) -> float:
    """Retrieve the base numeric weight for an interaction event type."""
    normalized = str(event_type or "").strip().lower()
    if normalized in SIGNAL_WEIGHTS:
        return SIGNAL_WEIGHTS[normalized]
    # Check substring or fallback
    for key, weight in SIGNAL_WEIGHTS.items():
        if key in normalized:
            return weight
    return 0.5  # Default passive interaction weight


# ==============================================================================
# 2. 30-Day Half-Life Exponential Decay Math
# ==============================================================================

HALF_LIFE_DAYS = 30.0


def parse_timestamp(ts: Any) -> datetime:
    """Safely parse ISO-8601 string or datetime into UTC datetime."""
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
    if isinstance(ts, (int, float)):
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (ValueError, OverflowError, OSError):
            return datetime.now(timezone.utc)
    if isinstance(ts, str) and ts:
        clean = ts.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (ValueError, TypeError):
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def calculate_elapsed_days(occurred_at: Any, now: datetime | None = None) -> float:
    """Calculate elapsed days between occurred_at and now, with 0.0 floor for clock skew."""
    now_dt = now or datetime.now(timezone.utc)
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)
    occ_dt = parse_timestamp(occurred_at)
    diff_sec = (now_dt - occ_dt).total_seconds()
    # Clock skew safeguard: future timestamps clamp to 0.0 days
    return max(0.0, diff_sec / 86400.0)


def calculate_decayed_weight(
    base_weight: float,
    occurred_at: Any,
    now: datetime | None = None,
    half_life_days: float = HALF_LIFE_DAYS,
) -> float:
    """Compute decayed weight using exact half-life formula: w(t) = w0 * 2^(-Delta_t / 30.0)."""
    delta_days = calculate_elapsed_days(occurred_at, now=now)
    decay_factor = math.pow(2.0, -delta_days / half_life_days)
    return base_weight * decay_factor


def compute_decay_weight(
    base_weight: float,
    delta_days_or_occurred_at: Any,
    half_life_or_now: Any = HALF_LIFE_DAYS,
    half_life_days: float = HALF_LIFE_DAYS,
) -> float:
    """Compute decayed weight given delta days directly or an occurred_at timestamp.

    Compatible with both:
    - compute_decay_weight(base_weight, delta_days, half_life=30.0)
    - compute_decay_weight(base_weight, occurred_at, now=now, half_life_days=30.0)
    """
    if isinstance(delta_days_or_occurred_at, (int, float)) and not isinstance(
        delta_days_or_occurred_at, bool
    ):
        hl = (
            float(half_life_or_now)
            if isinstance(half_life_or_now, (int, float))
            else half_life_days
        )
        clamped_days = max(0.0, float(delta_days_or_occurred_at))
        return float(base_weight * math.pow(2.0, -clamped_days / hl))

    now = half_life_or_now if isinstance(half_life_or_now, datetime) else None
    return calculate_decayed_weight(
        base_weight,
        delta_days_or_occurred_at,
        now=now,
        half_life_days=half_life_days,
    )


# ==============================================================================
# 3. 4-Dimension Pattern Mining Engine
# ==============================================================================

# D1 Skill Dictionaries & Extraction Patterns
CANONICAL_SKILL_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("Terraform", re.compile(r"\b(terraform|opentofu)\b", re.IGNORECASE)),
    (
        "Entra ID",
        re.compile(
            r"\b(entra|entra\s*id|azure\s*ad|azure\s*active\s*directory)\b",
            re.IGNORECASE,
        ),
    ),
    ("Kubernetes", re.compile(r"\b(kubernetes|k8s|aks|eks)\b", re.IGNORECASE)),
    ("Ansible", re.compile(r"\bansible\b", re.IGNORECASE)),
    ("Docker", re.compile(r"\b(docker|containerd|containers)\b", re.IGNORECASE)),
    ("AWS", re.compile(r"\b(aws|amazon\s*web\s*services)\b", re.IGNORECASE)),
    ("Azure", re.compile(r"\b(azure|microsoft\s*azure)\b", re.IGNORECASE)),
    (
        "Microsoft 365",
        re.compile(r"\b(m365|microsoft\s*365|office\s*365)\b", re.IGNORECASE),
    ),
    (
        "CI/CD",
        re.compile(
            r"\b(ci/cd|github\s*actions|azure\s*devops|gitlab\s*ci)\b", re.IGNORECASE
        ),
    ),
    ("PowerShell", re.compile(r"\b(powershell|pwsh)\b", re.IGNORECASE)),
    ("Python", re.compile(r"\bpython\b", re.IGNORECASE)),
    (
        "Active Directory",
        re.compile(r"\b(active\s*directory|group\s*policy|gpo)\b", re.IGNORECASE),
    ),
    ("Intune", re.compile(r"\b(intune|endpoint\s*manager)\b", re.IGNORECASE)),
    (
        "Linux",
        re.compile(r"\b(linux|rhel|redhat|ubuntu|centos|debian)\b", re.IGNORECASE),
    ),
    ("VMware", re.compile(r"\b(vmware|vsphere|esxi)\b", re.IGNORECASE)),
    ("Bicep", re.compile(r"\bbicep\b", re.IGNORECASE)),
    ("GCP", re.compile(r"\b(gcp|google\s*cloud)\b", re.IGNORECASE)),
    (
        "Cisco / Networking",
        re.compile(
            r"\b(cisco|firewall|palo\s*alto|fortinet|sd-wan|switching|routing)\b",
            re.IGNORECASE,
        ),
    ),
]

# D2 Seniority Tiers
SENIORITY_TIERS: list[tuple[int, str, re.Pattern]] = [
    (
        1,
        "Junior / Graduate",
        re.compile(
            r"\b(junior|jr|graduate|grad|trainee|associate|entry)\b", re.IGNORECASE
        ),
    ),
    (
        2,
        "Mid-Level Specialist",
        re.compile(
            r"\b(specialist|administrator|admin|sysadmin|engineer|analyst|consultant)\b",
            re.IGNORECASE,
        ),
    ),
    (
        3,
        "Senior Specialist / Lead",
        re.compile(
            r"\b(senior|sr|lead|team\s*lead|tech\s*lead|staff)\b", re.IGNORECASE
        ),
    ),
    (
        4,
        "Staff / Principal / Solutions Architect",
        re.compile(
            r"\b(principal|architect|solutions\s*architect|enterprise\s*architect)\b",
            re.IGNORECASE,
        ),
    ),
    (
        5,
        "Director / Executive / Head of",
        re.compile(
            r"\b(director|head\s*of|vp|chief|c-level|executive|general\s*manager)\b",
            re.IGNORECASE,
        ),
    ),
]

# D3 Industry & Sector Clusters
SECTOR_DEFINITIONS: list[tuple[str, re.Pattern]] = [
    (
        "Victorian Public Sector / Government",
        re.compile(
            r"\b(victorian\s*public\s*sector|vic\s*gov|vps|cenitex|dpc|deeca|healthshare|department|council|court|police|transport\s*victoria)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Federal Government / APS",
        re.compile(
            r"\b(aps|australian\s*public\s*service|federal|defence|services\s*australia|ato|home\s*affairs)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Healthcare & Clinical",
        re.compile(
            r"\b(health|hospital|clinic|medical|monash\s*health|epworth|alfred|western\s*health|st\s*john\s*of\s*god|emr|epic)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Higher Education",
        re.compile(
            r"\b(university|monash|melbourne\s*uni|rmit|deakin|swinburne|la\s*trobe|tafe|tertiary|institute)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "MSP & Consultancies",
        re.compile(
            r"\b(consulting|consultancy|managed\s*service|msp|datacom|engage\s*squared|wipro|capgemini|accenture|deloitte)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Financial Services",
        re.compile(
            r"\b(bank|banking|finance|financial|anz|nab|cba|westpac|macquarie|insurance|superannuation|wealth)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Enterprise Tech & SaaS",
        re.compile(
            r"\b(software|tech|technology|saas|cloud\s*platform|vendor|fintech|digital)\b",
            re.IGNORECASE,
        ),
    ),
]


def extract_skills_from_event(event: dict[str, Any]) -> set[str]:
    """Extract extracted skills from snapshot JSON or text regex matching."""
    skills: set[str] = set()

    # 1. Direct skills list
    snapshot_raw = event.get("job_snapshot") or event.get("job")
    snapshot = snapshot_raw if isinstance(snapshot_raw, dict) else {}
    explicit = (
        event.get("skills")
        or snapshot.get("skills")
        or snapshot.get("technical_stack")
        or []
    )
    if isinstance(explicit, list):
        for s in explicit:
            if s and isinstance(s, str):
                skills.add(s.strip())

    # 2. Text extraction
    text_corpus = " ".join(
        [
            str(event.get("job_title") or snapshot.get("title") or ""),
            str(event.get("company") or snapshot.get("company") or ""),
            str(snapshot.get("description") or ""),
        ]
    )

    for skill_name, pattern in CANONICAL_SKILL_PATTERNS:
        if pattern.search(text_corpus):
            skills.add(skill_name)

    return skills


def classify_seniority_tier(title: str) -> tuple[int, str]:
    """Classify job title into 1 of 5 seniority tiers (defaults to Tier 2)."""
    # Check from highest to lowest
    for tier, label, pattern in reversed(SENIORITY_TIERS):
        if pattern.search(title):
            return tier, label
    return 2, "Mid-Level Specialist"


def classify_sectors(company: str, title: str, description: str = "") -> list[str]:
    """Classify job into one or more industry sectors."""
    corpus = f"{company} {title} {description}"
    matched: list[str] = []
    for sector_name, pattern in SECTOR_DEFINITIONS:
        if pattern.search(corpus):
            matched.append(sector_name)
    return matched or ["Enterprise Tech & SaaS"]


def parse_annual_salary(salary_input: Any) -> float | None:
    """Normalize hourly, daily, or annual salary text into an annualized figure."""
    if isinstance(salary_input, (int, float)) and salary_input > 0:
        return float(salary_input)
    if not isinstance(salary_input, str) or not salary_input:
        return None

    # Strip superannuation percentages prior to number extraction
    clean_text = re.sub(r"\d+(?:\.\d+)?\s*%", "", salary_input)
    text = clean_text.replace(",", "").replace("$", "")
    nums = [float(n) for n in re.findall(r"\b\d+(?:\.\d+)?\b", text)]
    if not nums:
        return None

    # Determine rate unit
    is_hourly = bool(re.search(r"\b(hour|hr|p/h|ph)\b", salary_input, re.IGNORECASE))
    is_daily = bool(re.search(r"\b(day|daily|p/d|pd)\b", salary_input, re.IGNORECASE))

    # Average if range (e.g. 150000 - 160000)
    val = sum(nums) / len(nums)

    if is_hourly:
        # Standard full-time annual hours in Australia: ~1950 hours
        return val * 1950.0
    if is_daily:
        # Standard working days per year in Australia: ~240 days
        return val * 240.0
    if val < 500.0:
        # Likely hourly
        return val * 1950.0
    if val < 3000.0:
        # Likely daily
        return val * 240.0
    if val < 30000.0:
        # Anomaly or incomplete
        return None
    return val


def mine_career_patterns(
    events: list[dict[str, Any]],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Analyze decayed telemetry event stream across 4 career dimensions."""
    now_dt = now or datetime.now(timezone.utc)

    # Accumulators for D1: Skills
    skill_weights: dict[str, float] = {}
    skill_positive_roles: dict[str, set[str]] = {}

    # Accumulators for D2: Seniority
    seniority_weighted_sum = 0.0
    seniority_weight_total = 0.0
    recent_tiers: list[int] = []
    older_tiers: list[int] = []

    # Accumulators for D3: Sectors
    sector_weights: dict[str, float] = {s[0]: 0.0 for s in SECTOR_DEFINITIONS}
    total_positive_weight = 0.0

    # Accumulators for D4: Remuneration
    salary_weighted_sum = 0.0
    salary_weight_total = 0.0
    salary_values: list[tuple[float, float]] = []  # (salary, decayed_weight)

    for idx, e in enumerate(events):
        event_type = e.get("event_type") or e.get("interaction_type") or "viewed"
        base_w = e.get("signal_weight")
        if base_w is None:
            base_w = get_signal_weight(event_type)

        occ = e.get("occurred_at") or e.get("created_at") or now_dt.isoformat()
        decayed_w = calculate_decayed_weight(base_w, occ, now=now_dt)
        elapsed = calculate_elapsed_days(occ, now=now_dt)

        job_id = str(e.get("job_id") or f"synthetic_{idx}")
        snapshot_raw = e.get("job_snapshot") or e.get("job")
        snapshot = snapshot_raw if isinstance(snapshot_raw, dict) else {}
        title = str(e.get("job_title") or snapshot.get("title") or "")
        company = str(e.get("company") or snapshot.get("company") or "")
        description = str(snapshot.get("description") or "")
        salary_str = snapshot.get("salary") or e.get("salary") or ""

        # --- D1: Skills ---
        skills = extract_skills_from_event(e)
        for s in skills:
            skill_weights[s] = skill_weights.get(s, 0.0) + decayed_w
            if decayed_w > 0:
                if s not in skill_positive_roles:
                    skill_positive_roles[s] = set()
                skill_positive_roles[s].add(job_id)

        # Only evaluate D2, D3, D4 for positively targeted roles (w > 0)
        if decayed_w > 0:
            total_positive_weight += decayed_w

            # --- D2: Seniority ---
            if title:
                tier, _ = classify_seniority_tier(title)
                seniority_weighted_sum += tier * decayed_w
                seniority_weight_total += decayed_w
                if elapsed <= 14.0:
                    recent_tiers.append(tier)
                else:
                    older_tiers.append(tier)

            # --- D3: Sectors ---
            matched_sectors = classify_sectors(company, title, description)
            weight_per_sec = decayed_w / max(1, len(matched_sectors))
            for sec in matched_sectors:
                sector_weights[sec] = sector_weights.get(sec, 0.0) + weight_per_sec

            # --- D4: Salary ---
            annual_sal = parse_annual_salary(salary_str)
            if annual_sal and annual_sal > 40000:
                salary_weighted_sum += annual_sal * decayed_w
                salary_weight_total += decayed_w
                salary_values.append((annual_sal, decayed_w))

    # --- Synthesize D1: Skills ---
    mined_skills: list[dict[str, Any]] = []
    for s, cum_w in sorted(skill_weights.items(), key=lambda x: x[1], reverse=True):
        roles_count = len(skill_positive_roles.get(s, set()))
        # Graduation condition: cumulative weight >= 12.0 or distinct roles >= 3
        graduated = bool(cum_w >= 12.0 or roles_count >= 3)
        progress_pct = round(
            min(100.0, max(cum_w / 12.0, roles_count / 3.0) * 100.0), 1
        )
        mined_skills.append(
            {
                "skill": s,
                "cumulative_weight": round(cum_w, 2),
                "distinct_roles_count": roles_count,
                "graduated": graduated,
                "progress_pct": progress_pct,
            }
        )

    # --- Synthesize D2: Seniority ---
    weighted_tier = (
        round(seniority_weighted_sum / seniority_weight_total, 2)
        if seniority_weight_total > 0
        else 2.0
    )
    rounded_tier = max(1, min(5, round(weighted_tier)))
    tier_labels = {t[0]: t[1] for t in SENIORITY_TIERS}
    current_label = tier_labels.get(rounded_tier, "Mid-Level Specialist")

    recent_avg = (
        sum(recent_tiers) / len(recent_tiers) if recent_tiers else weighted_tier
    )
    older_avg = sum(older_tiers) / len(older_tiers) if older_tiers else weighted_tier
    velocity = recent_avg - older_avg

    if velocity >= 0.5:
        trajectory = "Upward Seniority Trajectory toward Staff/Principal Architect"
    elif velocity <= -0.5:
        trajectory = "Broadening Specialist Foundation"
    else:
        trajectory = f"Established {current_label}"

    seniority_data = {
        "weighted_tier": weighted_tier,
        "current_label": current_label,
        "trajectory": trajectory,
        "velocity": round(velocity, 2),
    }

    # --- Synthesize D3: Sectors ---
    clusters: list[dict[str, Any]] = []
    for sec, w in sorted(sector_weights.items(), key=lambda x: x[1], reverse=True):
        if w > 0:
            affinity_pct = (
                round((w / total_positive_weight) * 100.0, 1)
                if total_positive_weight > 0
                else 0.0
            )
            clusters.append(
                {
                    "sector": sec,
                    "weight": round(w, 2),
                    "affinity_pct": affinity_pct,
                }
            )

    # Default cluster if none matched
    if not clusters:
        clusters.append(
            {
                "sector": "Enterprise Tech & SaaS",
                "weight": 1.0,
                "affinity_pct": 100.0,
            }
        )

    # --- Synthesize D4: Remuneration ---
    if salary_weight_total > 0 and salary_values:
        weighted_mean = round(salary_weighted_sum / salary_weight_total)
        # Sort salaries by value for percentile estimation
        sorted_sals = sorted([val for val, _ in salary_values])
        p25_idx = int(0.25 * (len(sorted_sals) - 1))
        p75_idx = int(0.75 * (len(sorted_sals) - 1))
        p25 = round(sorted_sals[p25_idx])
        p75 = round(sorted_sals[p75_idx])
        rec_min = p25
        rec_preferred = max(weighted_mean, p75)
    else:
        # Grounded default from canonical Sam Ludwig profile
        weighted_mean = 155000
        p25 = 140000
        p75 = 175000
        rec_min = 140000
        rec_preferred = 160000

    remuneration_data = {
        "weighted_mean": weighted_mean,
        "mean_annual": weighted_mean,
        "p25": p25,
        "p75": p75,
        "recommended_min": rec_min,
        "recommended_floor": rec_min,
        "recommended_preferred": rec_preferred,
    }

    industries_map = {
        c["sector"]: c.get("affinity_pct", c.get("weight", 0.0))
        for c in clusters
        if isinstance(c, dict) and "sector" in c
    }

    return {
        "skills": mined_skills,
        "seniority": seniority_data,
        "industry_clusters": clusters,
        "industries": industries_map,
        "salary_anchoring": remuneration_data,
        "remuneration_anchoring": remuneration_data,
        "salary_anchor": float(rec_min),
    }
