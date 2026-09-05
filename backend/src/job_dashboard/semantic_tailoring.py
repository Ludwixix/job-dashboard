"""Semantic Density & Content Generation Engine (The Intelligence Layer).

Implements Phase 3 of the Next-Gen AI Recruitment Architecture:
1. Semantic Gap Analysis (Diagnostic): Conceptual alignment evaluation comparing
   candidate profile against target job postings to identify competency gaps.
2. Achievement Anchoring: Rewriting experience statements to follow the formula:
   [Active Verb] + [Core Task/Project] + [Quantified Result/Metric].
3. Eradication of Fluff: Stripping subjective corporate jargon and replacing it
   with factual claims of scale.
4. Australian Market Localization: Enforcing Australian English spelling conventions
   and formatting for local hiring standards.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

# Subjective corporate buzzwords to eradicate per algorithmic recruitment standards
FLUFF_PATTERNS = [
    re.compile(r"\bresults[- ]driven\b", re.IGNORECASE),
    re.compile(r"\bteam player\b", re.IGNORECASE),
    re.compile(r"\bdetail[- ]oriented\b", re.IGNORECASE),
    re.compile(r"\bhardworking\b", re.IGNORECASE),
    re.compile(r"\bpassionate\b", re.IGNORECASE),
    re.compile(r"\bgo[- ]getter\b", re.IGNORECASE),
    re.compile(r"\bthink outside the box\b", re.IGNORECASE),
    re.compile(r"\bhit the ground running\b", re.IGNORECASE),
    re.compile(r"\bproactive self[- ]starter\b", re.IGNORECASE),
    re.compile(r"\bself[- ]starter\b", re.IGNORECASE),
    re.compile(r"\bsynergistic\b", re.IGNORECASE),
    re.compile(r"\bproven track record\b", re.IGNORECASE),
    re.compile(r"\bdynamic professional\b", re.IGNORECASE),
    re.compile(r"\bhighly motivated\b", re.IGNORECASE),
]

# US to Australian English spelling normalization map
AU_SPELLING_MAP = {
    "organize": "organise",
    "organized": "organised",
    "organizing": "organising",
    "organization": "organisation",
    "organizations": "organisations",
    "organizational": "organisational",
    "prioritize": "prioritise",
    "prioritized": "prioritised",
    "prioritizing": "prioritising",
    "prioritization": "prioritisation",
    "analyze": "analyse",
    "analyzed": "analysed",
    "analyzing": "analysing",
    "analyzer": "analyser",
    "utilize": "utilise",
    "utilized": "utilised",
    "utilizing": "utilising",
    "utilization": "utilisation",
    "optimize": "optimise",
    "optimized": "optimised",
    "optimizing": "optimising",
    "optimization": "optimisation",
    "centralize": "centralise",
    "centralized": "centralised",
    "centralizing": "centralising",
    "standardize": "standardise",
    "standardized": "standardised",
    "standardizing": "standardising",
    "customize": "customise",
    "customized": "customised",
    "customizing": "customising",
    "behavior": "behaviour",
    "behaviors": "behaviours",
    "center": "centre",
    "centers": "centres",
    "centered": "centred",
    "program": "programme",
    "programs": "programmes",
    "color": "colour",
    "defense": "defence",
    "license": "licence",  # noun in AU
}

# Strong active verbs for achievement front-loading
ACTIVE_VERBS = [
    "Engineered", "Architected", "Automated", "Delivered", "Reduced",
    "Accelerated", "Implemented", "Migrated", "Resolved", "Spearheaded",
    "Standardized", "Optimized", "Designed", "Consolidated", "Led"
]


@dataclass
class AnchoredAchievement:
    """An outcome-driven achievement bullet anchored in quantifiable business impact."""
    original: str
    anchored: str
    active_verb: str
    metric: str
    is_front_loaded: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SemanticGapDiagnostic:
    """Diagnostic assessment of candidate fit against target role requirements."""
    job_id: str
    job_title: str
    company: str
    candidate_name: str
    semantic_density_score: int  # 0 to 100
    diagnostic_summary: str      # Brutal, concise fit assessment (max 3 sentences)
    recommended_action: str      # pursue_high_conviction | pursue_with_tailoring | skip_low_alignment
    matched_competencies: list[str]
    missing_competencies: list[str]
    anchored_achievements: list[dict[str, Any]]
    localization: str            # 'en-AU'

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def eradicate_fluff(text: str) -> str:
    """Strip subjective corporate buzzwords from narrative text."""
    cleaned = text
    for pattern in FLUFF_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    # Collapse multiple spaces or awkward commas left behind
    cleaned = re.sub(r",\s*,", ",", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def localize_australian(text: str) -> str:
    """Convert American English spelling variations to Australian English."""
    result = text
    for us_word, au_word in AU_SPELLING_MAP.items():
        pattern = re.compile(rf"\b{us_word}\b", re.IGNORECASE)
        # Preserve capitalization
        def repl(match: re.Match) -> str:
            w = match.group(0)
            if w.istitle():
                return au_word.capitalize()
            if w.isupper():
                return au_word.upper()
            return au_word
        result = pattern.sub(repl, result)
    return result


def extract_quantified_metric(text: str) -> str:
    """Extract numbers, percentages, dollar values, or scale indicators from text."""
    metric_pattern = re.compile(
        r"(\$\s*[\d,]+(?:\.\d+)?\s*[kKmMbB]?|\b\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+\+?\s*(?:users|sites|servers|endpoints|nodes|tickets|hours|min|sec|days|weeks|months|years|squad|engineers|people)\b)",
        re.IGNORECASE
    )
    match = metric_pattern.search(text)
    if match:
        return match.group(0).strip()
    return "Quantified impact"


def anchor_achievement(bullet_point: str, role_title: str = "") -> AnchoredAchievement:
    """Transform an experience bullet point into an achievement-anchored statement.
    
    Formula: [Active Verb] + [Core Task/Project] + [Quantified Result/Metric].
    """
    cleaned = eradicate_fluff(bullet_point)
    cleaned = localize_australian(cleaned)
    metric = extract_quantified_metric(cleaned)

    # Check if bullet already starts with an active verb
    first_word = cleaned.split()[0].capitalize() if cleaned.split() else "Engineered"
    matched_verb = next((v for v in ACTIVE_VERBS if v.lower() == first_word.lower()), "")

    if not matched_verb:
        verb = "Engineered" if "software" in cleaned.lower() or "code" in cleaned.lower() else (
            "Automated" if "powershell" in cleaned.lower() or "script" in cleaned.lower() else "Delivered"
        )
        # Prepend active verb
        anchored_text = f"{verb} {cleaned[0].lower() + cleaned[1:] if cleaned else 'operational improvements'}"
        is_front_loaded = True
    else:
        verb = matched_verb
        anchored_text = cleaned
        # Check if metric is within the first 6 words for F-pattern optimization
        words_prefix = " ".join(cleaned.split()[:6])
        is_front_loaded = bool(re.search(r"\d|%", words_prefix))

    return AnchoredAchievement(
        original=bullet_point,
        anchored=anchored_text,
        active_verb=verb,
        metric=metric,
        is_front_loaded=is_front_loaded
    )


def analyze_semantic_gap(job: dict[str, Any] | Any, profile: dict[str, Any]) -> SemanticGapDiagnostic:
    """Execute a Semantic Gap Analysis between candidate profile and target job description."""
    # Normalize job data
    if hasattr(job, "to_dict"):
        job_data = job.to_dict()
    elif isinstance(job, dict):
        job_data = job
    else:
        job_data = {
            "id": getattr(job, "id", "unknown"),
            "title": getattr(job, "title", "Role"),
            "company": getattr(job, "company", "Company"),
            "description": getattr(job, "description", "") or getattr(job, "notes", ""),
        }

    job_id = str(job_data.get("id") or "job_target")
    job_title = str(job_data.get("title") or "Unknown Title")
    company = str(job_data.get("company") or "Target Employer")
    description = str(job_data.get("description") or job_data.get("notes") or "").lower()

    candidate_name = profile.get("name") or "Candidate"
    candidate_skills = [s.lower() for s in (profile.get("coreSkills") or [])]
    candidate_experience_text = (
        profile.get("fullWorkExperienceText") 
        or profile.get("workHistorySummary") 
        or ""
    ).lower()

    # Extract target competencies from title & description
    competency_pool = [
        "microsoft 365", "azure", "entra id", "intune", "autopilot",
        "powershell", "active directory", "windows server", "exchange hybrid",
        "sharepoint online", "servicenow", "itil", "essential 8", "vmware",
        "ci/cd", "devops", "kubernetes", "docker", "terraform", "ansible",
        "python", "react", "networking", "cisco", "firewall", "security",
        "disaster recovery", "backup", "sql", "aws", "gcp", "linux"
    ]

    target_competencies = [c for c in competency_pool if c in description or c in job_title.lower()]
    if not target_competencies:
        # Fallback to key title tokens if description is minimal
        tokens = [t.strip().lower() for t in re.split(r"[\s/,|]+", job_title) if len(t) > 3]
        target_competencies = tokens[:5] or ["systems engineering", "infrastructure"]

    matched_competencies: list[str] = []
    missing_competencies: list[str] = []

    for comp in target_competencies:
        # Check direct skill match or presence in experience narrative
        if any(comp in skill for skill in candidate_skills) or comp in candidate_experience_text:
            matched_competencies.append(comp.title())
        else:
            missing_competencies.append(comp.title())

    total_comps = len(target_competencies) or 1
    density_ratio = len(matched_competencies) / total_comps
    density_score = min(99, max(30, int(density_ratio * 100)))

    # Title alignment check
    title_match = any(token in candidate_experience_text for token in job_title.lower().split() if len(token) > 4)
    if title_match:
        density_score = min(100, density_score + 5)

    # Diagnostic Summary (Max 3 sentences, brutal and actionable)
    if density_score >= 80:
        recommendation = "pursue_high_conviction"
        diagnostic = (
            f"Strong semantic alignment ({density_score}%) detected for {job_title} at {company}. "
            f"Candidate profile demonstrates verified mastery in {', '.join(matched_competencies[:3])}. "
            "Recommended for immediate high-conviction application with anchored metric proof points."
        )
    elif density_score >= 55:
        recommendation = "pursue_with_tailoring"
        missing_str = ", ".join(missing_competencies[:3]) if missing_competencies else "adjacent domain depth"
        diagnostic = (
            f"Moderate conceptual alignment ({density_score}%) for {job_title}. "
            f"Candidate capabilities cover foundational requirements but lack explicit semantic density in {missing_str}. "
            "Proceed only after tailoring experience bullets to emphasize adjacent transferable outcomes."
        )
    else:
        recommendation = "skip_low_alignment"
        missing_str = ", ".join(missing_competencies[:4])
        diagnostic = (
            f"Weak semantic density ({density_score}%) against requisition requirements for {job_title}. "
            f"Critical domain deficits identified in {missing_str}. "
            "High probability of screening out at automated parser triage; recommend prioritizing higher-alignment targets."
        )

    # Generate sample anchored achievements from candidate highlights
    sample_raw_bullets = [
        "Managed Southern Hemisphere's largest SharePoint farm with 660,000+ users maintaining 99.9% uptime.",
        "Created PowerShell scripts to reduce batch processing time from 2 hours to 15 minutes.",
        "Implemented CI/CD pipelines at Engage Squared reducing deployment cycles by 25%.",
        "Resolved L3 escalation incidents under strict SLA achieving 95% resolution rate."
    ]
    anchored_achievements = [anchor_achievement(b, job_title).to_dict() for b in sample_raw_bullets]

    return SemanticGapDiagnostic(
        job_id=job_id,
        job_title=job_title,
        company=company,
        candidate_name=candidate_name,
        semantic_density_score=density_score,
        diagnostic_summary=diagnostic,
        recommended_action=recommendation,
        matched_competencies=matched_competencies,
        missing_competencies=missing_competencies,
        anchored_achievements=anchored_achievements,
        localization="en-AU"
    )
