"""
Autonomous Candidate Profile Synthesizer (Backend)
Parses uploaded resumes (PDF, DOCX, Text) and automatically constructs a structured
candidate profile JSON for high-relevance job matching and document generation.
"""

import io
import re
from typing import Any
import pypdf
from .logging import get_logger

logger = get_logger("job_dashboard.profile_builder")

COMMON_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js", "AWS", "Azure", "GCP",
    "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux", "SQL", "PostgreSQL",
    "MongoDB", "Redis", "Git", "GitHub Actions", "FastAPI", "Django", "Flask",
    "Next.js", "Vue", "Angular", "HTML", "CSS", "Tailwind", "REST API", "GraphQL",
    "Microsoft 365", "Active Directory", "Intune", "PowerShell", "Bash", "ITIL",
    "Agile", "Scrum", "Jira", "Prometheus", "Grafana", "Cybersecurity", "Network Security"
]


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from PDF bytes using pypdf."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                pages_text.append(t.strip())
        return "\n\n".join(pages_text)
    except Exception as exc:
        logger.error(f"Failed to extract text from PDF: {exc}")
        return ""


def synthesize_profile_from_text(raw_text: str) -> dict[str, Any]:
    """Parse text heuristically into a structured candidate profile."""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return {
            "name": "",
            "title": "Software Engineer",
            "target_titles": ["Software Engineer"],
            "skills": [],
            "experience_years": 3,
            "location": "Australia",
            "summary": ""
        }

    # Extract name (typically first line if short and alphabetical)
    name = ""
    name_line_idx = -1
    for idx, candidate in enumerate(lines[:3]):
        if re.match(r"^[A-Za-z\s\.\-']{3,40}$", candidate) and not any(
            candidate.lower().startswith(w) for w in ["resume", "curriculum", "page", "cv", "summary", "senior", "lead", "staff", "principal"]
        ):
            name = candidate
            name_line_idx = idx
            break

    # Extract title (skip the name line)
    title = ""
    title_keywords = ["engineer", "developer", "architect", "manager", "lead", "specialist", "consultant", "analyst", "administrator", "designer"]
    for idx, line in enumerate(lines[:8]):
        if idx == name_line_idx and len(line.split()) <= 2:
            continue
        if any(kw in line.lower() for kw in title_keywords) and len(line) < 60:
            title = line.strip()
            break
    if not title:
        title = "Senior Systems & Software Specialist"

    # Extract years of experience
    exp_years = 3
    exp_matches = re.findall(r"(\d+)\+?\s+years?", raw_text, re.IGNORECASE)
    if exp_matches:
        try:
            years = [int(m) for m in exp_matches if 0 < int(m) < 40]
            if years:
                exp_years = max(years)
        except ValueError:
            pass

    # Extract location
    location = "Australia"
    loc_matches = re.findall(r"(Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra|Gold Coast|Australia)", raw_text, re.IGNORECASE)
    if loc_matches:
        location = loc_matches[0].title()

    # Extract skills
    found_skills = set()
    raw_lower = raw_text.lower()
    for skill in COMMON_SKILLS:
        pattern = rf"\b{re.escape(skill.lower())}\b"
        if re.search(pattern, raw_lower):
            found_skills.add(skill)

    # Extract summary/bio
    summary = ""
    summary_start = False
    summary_lines = []
    for line in lines:
        if re.match(r"^(summary|about|profile|professional summary|objective)[:\s]*$", line, re.IGNORECASE):
            summary_start = True
            continue
        if summary_start:
            if re.match(r"^(skills|experience|employment|education|projects|certifications)[:\s]*$", line, re.IGNORECASE):
                break
            summary_lines.append(line)
            if len(summary_lines) >= 4:
                break
    if summary_lines:
        summary = " ".join(summary_lines)
    else:
        # Fallback summary
        summary = f"Accomplished {title} with {exp_years}+ years of enterprise experience across modern technologies."

    target_titles = [title]
    if "Senior" not in title and exp_years >= 5:
        target_titles.append(f"Senior {title}")

    return {
        "name": name,
        "title": title,
        "target_titles": target_titles,
        "skills": sorted(list(found_skills)),
        "experience_years": exp_years,
        "location": location,
        "summary": summary
    }


def build_candidate_profile(raw_input: str | bytes, filename: str = "") -> dict[str, Any]:
    """Top-level entry point handling both raw text and binary PDF uploads."""
    if isinstance(raw_input, bytes):
        text = extract_text_from_pdf(raw_input)
    else:
        text = str(raw_input)
    return synthesize_profile_from_text(text)
