import re
from collections.abc import Mapping
from typing import Any

from .models import Job
from .score import score_job


class RelevanceError(ValueError):
    """Raised when document generation is requested for an excluded role."""


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")[:80]


def generate_documents(job: Job, profile: Mapping[str, Any]) -> dict[str, str]:
    """Generate a polished, grounded application pack without an external provider."""
    audit = score_job(job, profile)
    if audit.relevance == "No match" or not audit.matched_skills:
        raise RelevanceError(f"Resume not generated: {audit.fit} for {job.title}")
    personal = profile.get("personal", {})
    name = personal.get("full_name", "Candidate")
    location = personal.get("location", {})
    contact = " · ".join(filter(None, [personal.get("email"), personal.get("phone"), location.get("city")] ))
    links = " · ".join(filter(None, [personal.get("linkedin_url"), personal.get("portfolio_url"), personal.get("github_url")]))
    all_experience = profile.get("experience", [])
    matched = set(audit.matched_skills)
    ranked = sorted(all_experience, key=lambda item: sum(skill in " ".join(item.get("achievements", [])).lower() for skill in matched), reverse=True)
    skills = [skill for skill in profile.get("technical_expertise", {}).values() for skill in skill]
    # Keep the fallback output aligned with the canonical profile rather than
    # copying wording from the job listing.
    skills = [str(skill) for skill in skills if str(skill).strip()]
    skills_text = " · ".join(dict.fromkeys(skills))
    summary = profile.get("professional_summary", "").strip()
    # The fallback uses the profile's facts, but its structure is deliberately
    # independent of the Master Resume's source-document layout.
    candidate_title = personal.get('title') or profile.get('title') or job.title or 'Professional Specialist'
    resume_lines = [f"# {name}", candidate_title, contact, links, "", "## Target Role", job.title, "", "## Professional Summary", summary, "", "## Technical Expertise", skills_text, "", "## Professional Experience"]
    for experience in ranked:
        resume_lines.extend([f"### {experience.get('title', '')} | {experience.get('company', '')}", experience.get("period", ""), *[f"- {item}" for item in experience.get("achievements", [])], ""])
    resume_lines.extend(["## Certifications", *[f"- {item}" for item in profile.get("certifications", [])], "", "## Education", *[f"- {item}" for item in profile.get("education", [])], "", "## Additional Information", "Australian citizen · Unrestricted Australian work rights"])
    evidence = ranked[0].get("achievements", ["delivering reliable operational outcomes"])[0] if ranked else "delivering reliable operational outcomes"
    evidence = evidence.rstrip(" .")
    evidence_sentence = evidence[0].lower() + evidence[1:] if evidence else "delivering reliable operational outcomes"
    matched_text = ", ".join(audit.matched_skills[:3]) or "operational coordination and documentation"
    cover = "\n\n".join([
        f"# Cover Letter: {job.title}",
        f"Dear {job.company} Hiring Team,\n\nDelivering high-impact outcomes for {job.company} requires consistent operational rigor and proactive problem resolution. The requirements for {job.title} closely mirror the professional discipline and domain expertise I have developed across demanding environments, particularly in {matched_text}.",
        f"In my recent work, I have {evidence_sentence}. Delivering this required structured execution, sound professional judgement, and diligent follow-through across competing business priorities. I bring that same disciplined focus to advancing {job.company}'s organizational mission and maintaining rigorous standards of excellence.",
        f"I welcome the opportunity to discuss how my practical experience and background will directly support {job.company} in the {job.title} role. Thank you for considering my application.\n\nKind regards,\n{name}",
    ])
    return {"resume": "\n".join(resume_lines).strip() + "\n", "cover_letter": cover.strip() + "\n", "application_id": f"{_slug(job.company)}_{_slug(job.title)}"}
