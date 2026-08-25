import re
from collections.abc import Mapping
from typing import Any

from .models import Job
from .score import score_job


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")[:80]


def generate_documents(job: Job, profile: Mapping[str, Any]) -> dict[str, str]:
    """Generate grounded Markdown documents from verified profile facts only."""
    audit = score_job(job, profile)
    personal = profile.get("personal", {})
    name = personal.get("full_name", "Candidate")
    location = personal.get("location", {})
    contact = " | ".join(filter(None, [personal.get("email"), personal.get("phone"), location.get("city")]))
    all_experience = profile.get("experience", [])
    matched = set(audit.matched_skills)
    ranked = sorted(all_experience, key=lambda item: sum(skill in " ".join(item.get("achievements", [])).lower() for skill in matched), reverse=True)
    skills = [skill for skill in profile.get("technical_expertise", {}).values() for skill in skill]
    skills_text = ", ".join(dict.fromkeys(skills))
    summary = profile.get("professional_summary", "")
    resume_lines = [f"# {name}", contact, "", f"## Target Role: {job.title}", "", "## Professional Summary", summary, "", "## Relevant Skills", skills_text, "", "## Professional Experience"]
    for experience in ranked:
        resume_lines.extend([f"### {experience.get('title', '')} | {experience.get('company', '')}", experience.get("period", ""), *[f"- {item}" for item in experience.get("achievements", [])], ""])
    resume_lines.extend(["## Certifications", *[f"- {item}" for item in profile.get("certifications", [])], "", "## Education", *[f"- {item}" for item in profile.get("education", [])]])
    evidence = ranked[0].get("achievements", ["relevant enterprise experience"])[0] if ranked else "relevant experience"
    cover = "\n\n".join([
        f"# Cover Letter: {job.title}",
        f"Dear Hiring Manager,\n\nI am applying for the {job.title} position with {job.company}. My background aligns with this role through {', '.join(audit.matched_skills[:3]) or 'enterprise technology experience'}.",
        f"In my recent work, I {evidence.lower()}. I would bring careful delivery, clear communication, and experience working through operational requirements.",
        f"I would welcome the opportunity to discuss how my experience could support {job.company}. Thank you for considering my application.\n\nKind regards,\n{name}",
    ])
    return {"resume": "\n".join(resume_lines).strip() + "\n", "cover_letter": cover.strip() + "\n", "application_id": f"{_slug(job.company)}_{_slug(job.title)}"}
