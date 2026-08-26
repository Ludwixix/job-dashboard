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
    # Keep the fallback output aligned with the canonical profile rather than
    # copying wording from the job listing.
    skills_rows = []
    for category, values in profile.get("technical_expertise", {}).items():
        skills = [str(skill) for skill in values if str(skill).strip()]
        if skills:
            skills_rows.append(f"{category}: {', '.join(dict.fromkeys(skills))}")
    skills_text = "\n".join(skills_rows)
    summary = profile.get("professional_summary", "").strip()
    # The fallback uses the profile's facts, but its structure is deliberately
    # independent of the Master Resume's source-document layout.
    resume_lines = [f"# {name}", personal.get('title', 'Infrastructure & M365 Engineer'), contact, links, "", "## Target Role", job.title, "", "## Professional Summary", summary, "", "## Technical Expertise", skills_text, "", "## Professional Experience"]
    for experience in ranked:
        resume_lines.extend([f"### {experience.get('title', '')} | {experience.get('company', '')}", experience.get("period", ""), *[f"- {item}" for item in experience.get("achievements", [])], ""])
    projects = profile.get("projects", []) or profile.get("selected_projects", [])
    if projects:
        project_lines = [f"- {item}" if isinstance(item, str) else f"- {item.get('name', '')}: {item.get('description', '')}" for item in projects]
        resume_lines.extend(["## Key Projects & Automation Tools", *project_lines, ""])
    resume_lines.extend(["## Education & Certifications", *[f"- {item}" for item in profile.get("certifications", [])], *[f"- {item}" for item in profile.get("education", [])]])
    evidence = ranked[0].get("achievements", ["delivering reliable operational outcomes"])[0] if ranked else "delivering reliable operational outcomes"
    evidence = evidence.rstrip(" .")
    evidence_sentence = evidence[0].lower() + evidence[1:] if evidence else "delivering reliable operational outcomes"
    matched_text = ", ".join(audit.matched_skills[:3]) or "operational coordination and documentation"
    listing_detail = job.description.split(".", 1)[0].strip() or f"the {job.title} responsibilities"
    cover = "\n\n".join([
        f"# Cover Letter: {job.title}",
        f"Dear Hiring Manager,\n\nI am applying for the {job.title} position with {job.company}. The listing's focus on {listing_detail.lower()} is a practical match for the work I have delivered across enterprise technology environments. I am particularly interested in a role where dependable technical delivery, clear communication, and thoughtful service operations matter as much as the tools themselves.",
        f"My background includes {evidence_sentence}. I have built that experience through hands-on work with {matched_text}, supporting stakeholders, documenting decisions, and resolving issues with care. I approach technical work by clarifying the outcome first, then choosing a proportionate solution that can be maintained by the wider team. That approach has helped me work effectively across competing priorities while keeping users informed and outcomes measurable.",
        f"This opportunity appeals to me because it combines the specific responsibilities described in the listing with the kind of structured, service-focused delivery I value. I would bring a calm approach to incidents and change, accurate documentation, and a willingness to work across teams when an issue crosses technical or organisational boundaries. I also value environments where continuous improvement is grounded in evidence rather than broad claims: small automations, clearer processes, and reliable follow-through can make a meaningful difference to users and colleagues.",
        f"I would welcome the opportunity to discuss how my experience could contribute to {job.company}, particularly in relation to the role's stated requirements and priorities. Thank you for considering my application.\n\nKind regards,\n{name}",
    ])
    return {"resume": "\n".join(resume_lines).strip() + "\n", "cover_letter": cover.strip() + "\n", "application_id": f"{_slug(job.company)}_{_slug(job.title)}"}
