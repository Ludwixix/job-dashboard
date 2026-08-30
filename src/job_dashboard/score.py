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
_TRADE_TERMS = ("hvac", "building management", "bms", "mechanical", "electrical", "plumbing", "refrigeration")
_DATA_ROLE_TERMS = ("data engineer", "data warehouse", "data warehousing", "etl", "extract transform load", "data model", "dimensional model", "sql developer")
_DATA_SPECIFIC_TERMS = ("data warehouse", "data warehousing", "etl", "extract transform load", "dimensional model", "data pipeline", "sql modeling", "data modelling")


@lru_cache(maxsize=128)
def _profile_skills_cached(profile_hash: str, profile_data: str) -> dict[str, str]:
    """Cached version of profile skills extraction."""
    import json
    profile = json.loads(profile_data)
    raw = profile.get("skills", {})
    values: dict[str, str] = {}
    if isinstance(raw, Mapping):
        values.update({str(name).lower(): str(value).lower() for name, value in raw.items()})
    else:
        values.update({str(skill).lower(): "intermediate" for skill in raw})
    for group in profile.get("technical_expertise", {}).values():
        values.update({str(skill).lower(): "intermediate" for skill in group})

    canonical: dict[str, str] = {}
    for skill, aliases in SKILL_ALIASES.items():
        for profile_skill, level in values.items():
            if any(re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", profile_skill) for alias in aliases):
                canonical[skill] = level
                break
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


def _job_skills(job: Job) -> dict[str, float]:
    fields = {"title": job.title, "tags": " ".join(job.tags), "why": job.why, "description": job.description}
    text = job.text().lower()
    found: dict[str, float] = {}
    for skill, aliases in SKILL_ALIASES.items():
        for alias in aliases:
            if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", text):
                confidence = 0.6
                if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", fields["title"].lower()):
                    confidence = 1.0
                elif alias in fields["tags"].lower():
                    confidence = 0.9
                elif alias in fields["why"].lower():
                    confidence = 0.8
                found[skill] = confidence
                break
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
    if any(term in text for term in _TRADE_TERMS) and re.search(r"bms|building management|hvac|mechanical|electrical|plumbing", text):
        return "trade"
    if any(term in text for term in _DATA_ROLE_TERMS):
        return "data"
    return "it"


def _skill_cluster(skill: str) -> str:
    return "primary" if skill in _PRIMARY_SKILLS else "secondary"


def score_job(job: Job, profile: Mapping[str, Any]) -> ScoreResult:
    """Calculate a deterministic fit audit from a job and injected profile."""
    try:
        skills = _job_skills(job)
        profile_skills = _profile_skills(profile)
        domain = _role_domain(job)
        matched = tuple(
            skill for skill, confidence in skills.items()
            if confidence >= 0.6 and skill in profile_skills and domain != "trade"
        )
        missing = tuple(skill for skill in skills if skill not in profile_skills)
        total_weight = sum(
            _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill)]
            for skill in skills
        )
        matched_weight = sum(
            _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill)] * skills[skill]
            for skill in matched
        )
        skill_match = matched_weight / total_weight if total_weight else 0.0
        experience = {"junior": 0.7, "mid": 1.0, "senior": 0.9, "executive": 0.3}[_experience_level(job)]
        location = 1.0 if job.remote or re.search(r"remote|melbourne|vic", job.location, re.IGNORECASE) else 0.5
        company = 0.9 if re.search(r"government|council|bank|university|health|technology|cloud", job.company, re.IGNORECASE) else 0.7
        growth = 0.9 if re.search(r"trainee|graduate|junior|training", job.text(), re.IGNORECASE) else 0.8 if re.search(r"cloud|azure|devops", job.text(), re.IGNORECASE) else 0.5
        seniority_penalty = _seniority_penalty(job)
        title_category = 1.0 if any(term in job.title.lower() for term in ("sharepoint", "microsoft 365", "m365", "infrastructure", "systems administrator", "powershell", "azure", "cloud")) else 0.45
        recency = 1.0 if getattr(job, "posted", "") else 0.5
        dimensions = {"skill_match": round(skill_match * 100), "title_category_match": round(title_category * 100), "location_fit": round(location * 100), "recency_weight": round(recency * 100), "experience_fit": round(experience * 100), "company_fit": round(company * 100), "growth_potential": round(growth * 100)}
        total = skill_match * 0.6 + title_category * 0.12 + location * 0.08 + experience * 0.08 + company * 0.04 + growth * 0.03 + recency * 0.05 - seniority_penalty
        if domain == "data" and not any(term in job.text().lower() for term in _DATA_SPECIFIC_TERMS):
            total = min(total, 0.5)
        if domain == "trade":
            total = min(total, 0.35)
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
