import re
from collections.abc import Mapping
from typing import Any

from .models import Job, ScoreResult

SKILL_ALIASES = {
    "azure": ("azure", "microsoft azure", "azure ad", "entra"),
    "microsoft 365": ("m365", "microsoft 365", "office 365", "modern workplace"),
    "sharepoint": ("sharepoint", "sharepoint online"),
    "exchange": ("exchange", "exchange online"),
    "intune": ("intune", "endpoint manager", "mdm"),
    "powershell": ("powershell", "pwsh", "automation"),
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


def _profile_skills(profile: Mapping[str, Any]) -> dict[str, str]:
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


def score_job(job: Job, profile: Mapping[str, Any]) -> ScoreResult:
    """Calculate a deterministic fit audit from a job and injected profile."""
    skills = _job_skills(job)
    profile_skills = _profile_skills(profile)
    matched = tuple(skill for skill, confidence in skills.items() if confidence >= 0.6 and skill in profile_skills)
    missing = tuple(skill for skill in skills if skill not in profile_skills)
    total_weight = sum(_LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) for skill in skills)
    matched_weight = sum(_LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * skills[skill] for skill in matched)
    skill_match = matched_weight / total_weight if total_weight else 0.5
    experience = {"junior": 0.7, "mid": 1.0, "senior": 0.9, "executive": 0.3}[_experience_level(job)]
    location = 1.0 if job.remote or re.search(r"remote|melbourne|vic", job.location, re.I) else 0.5
    company = 0.9 if re.search(r"government|council|bank|university|health|technology|cloud", job.company, re.I) else 0.7
    growth = 0.9 if re.search(r"trainee|graduate|junior|training", job.text(), re.I) else 0.8 if re.search(r"cloud|azure|devops", job.text(), re.I) else 0.5
    seniority_penalty = _seniority_penalty(job)
    dimensions = {"skill_match": round(skill_match * 100), "experience_fit": round(experience * 100), "location_fit": round(location * 100), "company_fit": round(company * 100), "growth_potential": round(growth * 100)}
    total = skill_match * 0.4 + experience * 0.25 + location * 0.15 + company * 0.1 + growth * 0.1 - seniority_penalty
    total = max(0.0, min(1.0, total))
    fit = "Excellent fit" if total >= 0.85 else "Strong fit" if total >= 0.7 else "Good fit" if total >= 0.55 else "Partial fit" if total >= 0.4 else "Weak fit"
    confidence = min(1.0, 0.5 + (0.2 if job.description else 0) + (0.1 if job.tags else 0) + (0.1 if job.why else 0) + (0.1 if len(skills) > 3 else 0))
    strengths = ("Strong skill alignment", "Experience level matches role requirements", "Ideal location match")[:1 + (experience >= 0.8) + (location >= 0.9)]
    risks = ((f"Missing skills: {', '.join(missing[:3])}",) if missing else ()) + ("Verify exact requirements before applying",)
    return ScoreResult(round(total * 100), fit, dimensions, matched, missing, strengths, risks[:3], round(confidence, 2), _experience_level(job))
