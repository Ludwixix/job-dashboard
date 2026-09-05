import re
from collections.abc import Mapping
from functools import lru_cache
from typing import Any

from .models import Job, ScoreResult
from .types import ScoringError

SKILL_ALIASES = {
    "azure": ("azure", "microsoft azure", "azure ad", "entra"),
    "microsoft 365": ("m365", "microsoft 365", "office 365", "modern workplace"),
    "sharepoint": ("sharepoint", "sharepoint online"),
    "exchange": ("exchange", "exchange online"),
    "intune": ("intune", "endpoint manager", "mdm"),
    "powershell": ("powershell", "pwsh"),
    "python": ("python", "python3"),
    "windows": ("windows", "windows server"),
    "linux": ("linux", "ubuntu", "redhat"),
    "networking": ("network", "networking", "tcp/ip", "dns", "dhcp", "vpn"),
    "servicenow": ("servicenow", "service now"),
    "itil": ("itil", "incident management", "change management"),
    "cybersecurity": ("cybersecurity", "security", "infosec", "iso 27001"),
    "data centre": ("data centre", "data center", "server room", "rack"),
    "customer service": ("customer service", "customer support", "user support", "help desk"),
    "documentation": ("documentation", "technical writing", "runbooks"),
}

_LEVEL_WEIGHT = {"expert": 1.0, "advanced": 0.8, "intermediate": 0.6, "basic": 0.4}
_CLUSTER_WEIGHT = {"primary": 1.0, "secondary": 0.45}
_PRIMARY_SKILLS = {"sharepoint", "microsoft 365", "exchange", "intune", "azure", "powershell", "windows", "networking", "servicenow", "itil", "customer service"}
_SECONDARY_SKILLS = {"linux", "cybersecurity", "data centre", "documentation", "python"}
_DATA_ROLE_TERMS = ("data engineer", "data warehouse", "data warehousing", "etl", "extract transform load", "data model", "dimensional model", "sql developer")
_DATA_SPECIFIC_TERMS = ("data warehouse", "data warehousing", "etl", "extract transform load", "dimensional model", "data pipeline", "sql modeling", "data modelling")
# Fallback IT title terms used only when the profile has no targetTitles/experience configured.
_IT_TITLE_TERMS = (
    "sharepoint", "microsoft 365", "m365", "infrastructure",
    "systems administrator", "powershell", "azure", "cloud",
)



@lru_cache(maxsize=128)
def _profile_skills_cached(profile_hash: str, profile_data: str) -> dict[str, str]:
    """Cached version of profile skills extraction."""
    import json
    profile = json.loads(profile_data)
    if isinstance(profile, Mapping) and "profile" in profile and isinstance(profile["profile"], Mapping):
        profile = profile["profile"]
    raw = profile.get("skills", {})
    values: dict[str, str] = {}
    if isinstance(raw, Mapping):
        values.update({str(name).lower(): str(value).lower() for name, value in raw.items()})
    elif raw:
        values.update({str(skill).lower(): "intermediate" for skill in raw})
    for group in profile.get("technical_expertise", {}).values():
        values.update({str(skill).lower(): "intermediate" for skill in group})
    # coreSkills is the field the live product actually stores resume-derived
    # skills under (any industry, not just the curated IT alias list below);
    # without this, scoring never sees a candidate's own skills at all for
    # profiles created via the current resume-parsing/onboarding flow.
    for skill in profile.get("coreSkills", []) or []:
        key = str(skill).strip().lower()
        if key and key not in values:
            values[key] = "intermediate"

    canonical: dict[str, str] = {}
    for skill, aliases in SKILL_ALIASES.items():
        for profile_skill, level in values.items():
            if any(re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", profile_skill) for alias in aliases):
                canonical[skill] = level
                break
    # Retain every other candidate skill term verbatim (any industry) so it can
    # still be matched directly against job text even when it falls outside
    # the curated IT alias groups above.
    for term, level in values.items():
        canonical.setdefault(term, level)
    return canonical


def _profile_skills(profile: Mapping[str, Any]) -> dict[str, str]:
    """Extract and normalize skills from profile."""
    try:
        import hashlib
        import json
        profile_json = json.dumps(profile, sort_keys=True)
        profile_hash = hashlib.md5(profile_json.encode()).hexdigest()[:16]
        return _profile_skills_cached(profile_hash, profile_json)
    except Exception as e:
        raise ScoringError(f"Failed to extract profile skills: {e!s}", {"error": str(e)}) from e


def _job_skills(job: Job, extra_terms: tuple[str, ...] = ()) -> dict[str, float]:
    """Match the curated IT alias groups plus any candidate-specific skill
    terms (any industry) directly against the job text, so scoring isn't
    limited to a fixed Microsoft/IT vocabulary.
    """
    fields = {"title": job.title, "tags": " ".join(job.tags), "why": job.why, "description": job.description}
    text = job.text().lower()
    found: dict[str, float] = {}

    def _match(skill_key: str, aliases: tuple[str, ...]) -> None:
        for alias in aliases:
            if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", text):
                confidence = 0.6
                if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", fields["title"].lower()):
                    confidence = 1.0
                elif alias in fields["tags"].lower():
                    confidence = 0.9
                elif alias in fields["why"].lower():
                    confidence = 0.8
                found[skill_key] = confidence
                return

    for skill, aliases in SKILL_ALIASES.items():
        _match(skill, aliases)

    for term in extra_terms:
        term = term.strip().lower()
        if term and term not in found and len(term) > 2:
            _match(term, (term,))

    return found


def _experience_level(job: Job) -> str:
    text = f"{job.title} {job.description} {job.why}".lower()
    for level, patterns in {
        "junior": ("junior", "graduate", "trainee", "apprentice"),
        "senior": ("senior", "lead", "principal", "architect"),
        "executive": ("director", "head of", "vp", "cto", "cio"),
    }.items():
        if any(pattern in text for pattern in patterns):
            return level
    return "mid"


def _seniority_penalty(job: Job) -> float:
    level = _experience_level(job)
    if level in {"senior", "executive"}:
        return 0.18
    if level == "junior":
        return 0.04
    return 0.0


def _role_domain(job: Job) -> str:
    text = job.text().lower()
    if any(term in text for term in _DATA_ROLE_TERMS):
        return "data"
    return "it"


def _skill_cluster(skill: str, profile_skills: Mapping[str, Any] | None = None) -> str:
    if profile_skills and skill in profile_skills:
        return "primary"
    return "primary" if skill in _PRIMARY_SKILLS else "secondary"


def _title_category(job: Job, profile: Mapping[str, Any]) -> float:
    """Compute a title-alignment score using the candidate's own target/experience titles.

    Priority:
    1. If the profile has ``targetTitles`` or ``experience[].title`` entries, match
       against those using word-level overlap — industry-agnostic and correct for any
       profession (nurse, lawyer, engineer, …).
    2. If the profile provides no title hints, fall back to the original IT-specific
       heuristic so existing IT users are unaffected.
    """
    target_titles = [str(t).lower().strip() for t in (profile.get("targetTitles") or []) if t]
    exp_titles = [
        str(e.get("title", "")).lower().strip()
        for e in (profile.get("experience") or [])
        if e.get("title")
    ]
    candidate_titles = set(target_titles + exp_titles)

    job_title_lower = job.title.lower()

    if candidate_titles:
        job_words = {w for w in re.split(r"\W+", job_title_lower) if len(w) > 3}
        for ct in candidate_titles:
            ct_words = {w for w in re.split(r"\W+", ct) if len(w) > 3}
            if ct_words and ct_words & job_words:
                return 1.0
        # Profile is set up but this job's title doesn't match — neutral penalty, not punished
        return 0.55

    # Fallback: original IT-specific heuristic (backward compatible for IT profiles)
    return 1.0 if any(term in job_title_lower for term in _IT_TITLE_TERMS) else 0.45



def explain_score(result: ScoreResult) -> dict[str, Any]:
    """Return a stable, data-derived explanation suitable for API clients."""
    strengths = list(result.strengths)
    gaps = [f"Missing: {skill}" for skill in result.missing_skills[:3]]
    if result.dimensions.get("location_fit", 0) >= 90:
        strengths.append("Location or work mode aligns with your preferences")
    if result.dimensions.get("experience_fit", 0) < 70:
        gaps.append("Seniority may not align with your current experience")
    explanation: dict[str, Any] = {
        "tier": result.fit,
        "score": result.score,
        "confidence": result.confidence,
        "matched_skills": list(result.matched_skills),
        "missing_skills": list(result.missing_skills),
        "strengths": strengths[:3],
        "gaps": gaps[:3],
        "dimensions": result.dimensions,
        "relevance": result.relevance,
    }
    if result.semantic_score is not None:
        explanation["semantic_score"] = result.semantic_score
    if result.rule_score is not None:
        explanation["rule_score"] = result.rule_score
    return explanation


def score_job(job: Job, profile: Mapping[str, Any]) -> ScoreResult:
    """Calculate a deterministic fit audit from a job and injected profile."""
    try:
        profile_skills = _profile_skills(profile)
        skills = _job_skills(job, extra_terms=tuple(profile_skills.keys()))
        domain = _role_domain(job)
        matched = tuple(
            skill for skill, confidence in skills.items()
            if confidence >= 0.6 and skill in profile_skills
        )
        missing = tuple(skill for skill in skills if skill not in profile_skills)
        total_weight = sum(
            _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill, profile_skills)]
            for skill in skills
        )
        matched_weight = sum(
            _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill, profile_skills)] * skills[skill]
            for skill in matched
        )
        skill_match = matched_weight / total_weight if total_weight else 0.0
        experience = {"junior": 0.7, "mid": 1.0, "senior": 0.9, "executive": 0.3}[_experience_level(job)]
        location = 1.0 if job.remote or re.search(r"remote|melbourne|vic", job.location, re.IGNORECASE) else 0.5
        company = 0.9 if re.search(r"government|council|bank|university|health|technology|cloud", job.company, re.IGNORECASE) else 0.7
        growth = 0.9 if re.search(r"trainee|graduate|junior|entry[- ]level", job.text(), re.IGNORECASE) else 0.8 if re.search(r"training|mentorship|development|progression|leadership|upskill|cloud|azure|devops", job.text(), re.IGNORECASE) else 0.5
        seniority_penalty = _seniority_penalty(job)
        title_category = _title_category(job, profile)
        recency = 1.0 if getattr(job, "posted", "") else 0.5
        dimensions = {"skill_match": round(skill_match * 100), "title_category_match": round(title_category * 100), "location_fit": round(location * 100), "recency_weight": round(recency * 100), "experience_fit": round(experience * 100), "company_fit": round(company * 100), "growth_potential": round(growth * 100)}
        total = skill_match * 0.6 + title_category * 0.12 + location * 0.08 + experience * 0.08 + company * 0.04 + growth * 0.03 + recency * 0.05 - seniority_penalty
        is_data_candidate = any("data" in t or "analytics" in t or "sql" in t for t in profile_skills.keys())
        if domain == "data" and not is_data_candidate and not any(term in job.text().lower() for term in _DATA_SPECIFIC_TERMS):
            total = min(total, 0.5)
        total = max(0.0, min(1.0, total))
        fit = "No skill match" if not matched else "Excellent fit" if total >= 0.85 else "Strong fit" if total >= 0.7 else "Good fit" if total >= 0.55 else "Partial fit"
        confidence = min(1.0, 0.5 + (0.2 if job.description else 0) + (0.1 if job.tags else 0) + (0.1 if job.why else 0) + (0.1 if len(skills) > 3 else 0))
        strengths = ("Strong skill alignment", "Experience level matches role requirements", "Ideal location match")[:1 + (experience >= 0.8) + (location >= 0.9)]
        risks = ((f"Missing skills: {', '.join(missing[:3])}",) if missing else ()) + ("Verify exact requirements before applying",)
        relevance = "No match" if domain == "trade" else "Strong"
        return ScoreResult(round(total * 100), fit, dimensions, matched, missing, strengths, risks[:3], round(confidence, 2), _experience_level(job), relevance, dimensions)
    except Exception as e:
        raise ScoringError(f"Failed to score job: {e!s}", {
            "job_id": job.id,
            "title": job.title,
            "company": job.company,
            "error": str(e)
        }) from e


def score_job_hybrid(job: Job, profile: Mapping[str, Any], semantic_weight: float = 0.25) -> ScoreResult:
    """Calculate a hybrid score blending deterministic rules with semantic vector similarity."""
    from .semantic_scoring import score_job_hybrid as _score_hybrid
    return _score_hybrid(job, profile, semantic_weight=semantic_weight)

