import re
from collections.abc import Mapping
from typing import Any

from .models import Job
from .score import score_job


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")[:80]


def generate_documents(job: Job, profile: Mapping[str, Any]) -> dict[str, str]:
    """Generate a polished, grounded application pack without an external provider."""
    audit = score_job(job, profile)
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
    resume_lines = [f"# {name}", personal.get('title', 'Infrastructure & M365 Engineer'), contact, links, "", "## Target Role", job.title, "", "## Professional Summary", summary, "", "## Technical Expertise", skills_text, "", "## Professional Experience"]
    for experience in ranked:
        resume_lines.extend([f"### {experience.get('title', '')} | {experience.get('company', '')}", experience.get("period", ""), *[f"- {item}" for item in experience.get("achievements", [])], ""])
    resume_lines.extend(["## Certifications", *[f"- {item}" for item in profile.get("certifications", [])], "", "## Education", *[f"- {item}" for item in profile.get("education", [])], "", "## Additional Information", "Australian citizen · Unrestricted Australian work rights"])
    evidence = ranked[0].get("achievements", ["delivering reliable operational outcomes"])[0] if ranked else "delivering reliable operational outcomes"
    evidence = evidence.rstrip(" .")
    evidence_sentence = evidence[0].lower() + evidence[1:] if evidence else "delivering reliable operational outcomes"
    matched_text = ", ".join(audit.matched_skills[:3]) or "operational coordination and documentation"
    cover = "\n\n".join([
        f"# Cover Letter: {job.title}",
        f"Dear Hiring Manager,\n\nI am pleased to apply for the {job.title} position with {job.company}. The role's focus on {matched_text} aligns with the operational discipline and client-facing delivery I have developed across enterprise technology environments.",
        f"In my recent work, I have {evidence_sentence}. This has required clear documentation, careful coordination, sound judgement, and consistent follow-through across competing priorities. I would bring that same structured approach to supporting your team and maintaining a high standard of service.",
        f"The opportunity to contribute to {job.company} appeals to me because the position combines practical administration with dependable stakeholder support. I would welcome the opportunity to discuss how my experience can contribute to the role. Thank you for considering my application.\n\nKind regards,\n{name}",
    ])
    return {"resume": "\n".join(resume_lines).strip() + "\n", "cover_letter": cover.strip() + "\n", "application_id": f"{_slug(job.company)}_{_slug(job.title)}"}
