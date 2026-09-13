"""Algorithmic ATS Parsing Simulator & Cognitive Screening Triage Engine.

Implements the technical specification from 'docs/Resume_Optimization.md':
1. Mechanical Parsing Simulator & Topological Flattening (Textkernel / Sovren emulation).
2. ATS Platform Ingestion Profiles (Workday, Greenhouse, Taleo, JobAdder).
3. STAR Metric Density & Cognitive Apex Triage.
4. Australian Regional Compliance & Fair Work Anti-Discrimination Sanitization.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

# Standard ATS canonical section taxonomies
STANDARD_SECTIONS = {
    "summary": [
        r"professional\s+summary",
        r"executive\s+summary",
        r"summary",
        r"profile",
        r"about\s+me",
    ],
    "experience": [
        r"work\s+experience",
        r"professional\s+experience",
        r"employment\s+history",
        r"experience",
        r"career\s+history",
    ],
    "skills": [
        r"skills",
        r"technical\s+skills",
        r"core\s+competencies",
        r"areas\s+of\s+expertise",
        r"technologies",
    ],
    "education": [
        r"education",
        r"academic\s+background",
        r"qualifications",
        r"degrees",
    ],
    "referees": [
        r"referees?",
        r"professional\s+references?",
        r"references?",
    ],
}

# Non-standard creative headers that fail taxonomy mapping in legacy parsers (e.g. Workday)
NON_STANDARD_HEADERS = [
    r"my\s+journey",
    r"core\s+strengths",
    r"what\s+i\s+bring",
    r"story",
    r"passions",
    r"accomplishments",
    r"capabilities",
]

# Corporate buzzwords and un-anchored fluff
FLUFF_PATTERNS = [
    re.compile(r"\bresults-driven\b", re.IGNORECASE),
    re.compile(r"\bthought\s+leader\b", re.IGNORECASE),
    re.compile(r"\bteam\s+player\b", re.IGNORECASE),
    re.compile(r"\bdynamic\s+self-starter\b", re.IGNORECASE),
    re.compile(r"\bhard\s+worker\b", re.IGNORECASE),
    re.compile(r"\bproven\s+track\s+record\s+of\s+being\b", re.IGNORECASE),
    re.compile(r"\bfast-paced\s+environment\b", re.IGNORECASE),
    re.compile(r"\bgo-getter\b", re.IGNORECASE),
    re.compile(r"\bsynergy\b", re.IGNORECASE),
    re.compile(r"\bdetail-oriented\b", re.IGNORECASE),
]

# Quantified metric patterns in bullet points
METRIC_PATTERNS = [
    re.compile(r"\b\d+(\.\d+)?%\b"),                         # 38%, 99.99%
    re.compile(r"\$[\d,]+(\.\d+)?(\s*[kKmMbB])?\b"),         # $450k, $12,000
    re.compile(r"\b\d+\s*(k|K|m|M|b|B)\b"),                  # 45M, 600k
    re.compile(r"\b\d+[-–]\s*(minute|hour|day|week|month|year|node|server|team|person)\b", re.IGNORECASE), # 15-minute RPO
    re.compile(r"\b\d+\+?\s*(virtual\s+machines|microservices|servers|engineers|users|clients|branch\s+offices|minutes|hours|days|weeks|months|years|tickets|squad)\b", re.IGNORECASE),
    re.compile(r"\b(squad|team)\s+of\s+\d+\b", re.IGNORECASE), # squad of 6
    re.compile(r"\b(reduced|slashed|cut|decreased|increased|boosted|accelerated|improved)\s+by\s+\d+", re.IGNORECASE),
    re.compile(r"\bfrom\s+\d+.*?\s+to\s+\d+", re.IGNORECASE), # from 4 hours to 18 minutes
]

# Australian demographic risk patterns (prohibited under Fair Work / EEO anti-discrimination)
AU_DEMOGRAPHIC_PATTERNS = [
    (re.compile(r"\bdate\s+of\s+birth\b", re.IGNORECASE), "Date of Birth (age discrimination risk)"),
    (re.compile(r"\bd\.?o\.?b\.?\b", re.IGNORECASE), "Date of Birth acronym (age discrimination risk)"),
    (re.compile(r"\bmarital\s+status\b", re.IGNORECASE), "Marital Status (family status discrimination risk)"),
    (re.compile(r"\bnationality\b", re.IGNORECASE), "Nationality (nationality/citizenship bias risk)"),
    (re.compile(r"\breligion\b", re.IGNORECASE), "Religion (religious discrimination risk)"),
    (re.compile(r"\bphoto|headshot\b", re.IGNORECASE), "Photo/Headshot reference (physical appearance bias risk)"),
]


def extract_bullets(text: str) -> list[str]:
    """Extracts bullet points or list items from resume text."""
    bullets = []
    lines = text.split("\n")
    for line in lines:
        stripped = line.strip()
        if re.match(r"^[-*•–—►]\s+", stripped):
            clean_bullet = re.sub(r"^[-*•–—►]\s+", "", stripped)
            if clean_bullet:
                bullets.append(clean_bullet)
    return bullets


def calculate_star_metric_density(resume_text: str) -> dict[str, Any]:
    """Calculates the STAR Metric Density score and flags corporate buzzwords."""
    if not resume_text:
        return {
            "total_bullets": 0,
            "quantified_bullets": 0,
            "density_percentage": 0.0,
            "fluff_count": 0,
            "fluff_phrases": [],
            "bullets": [],
        }

    raw_bullets = extract_bullets(resume_text)
    total_bullets = len(raw_bullets)

    quantified_count = 0
    analyzed_bullets = []

    for b in raw_bullets:
        has_metric = any(pat.search(b) for pat in METRIC_PATTERNS)
        if has_metric:
            quantified_count += 1

        # Check for weak passive openers
        has_weak_start = bool(re.match(r"^(worked\s+on|helped\s+with|responsible\s+for|assisted\s+with|attended)\b", b, re.IGNORECASE))

        analyzed_bullets.append({
            "text": b,
            "quantified": has_metric,
            "has_weak_opener": has_weak_start,
        })

    density_pct = round((quantified_count / total_bullets * 100), 1) if total_bullets > 0 else 0.0

    # Scan for corporate fluff across entire text
    found_fluff = []
    for pat in FLUFF_PATTERNS:
        matches = pat.findall(resume_text)
        if matches:
            found_fluff.extend(list(set(matches)))

    return {
        "total_bullets": total_bullets,
        "quantified_bullets": quantified_count,
        "density_percentage": density_pct,
        "fluff_count": len(found_fluff),
        "fluff_phrases": found_fluff,
        "bullets": analyzed_bullets,
    }


def audit_regional_compliance_au(resume_text: str) -> dict[str, Any]:
    """Audits Australian recruitment standards: Referees presence, demographic risk absence, A4 format."""
    text_lower = resume_text.lower()

    # Check for Referees section
    has_referees = bool(re.search(r"\b(referees?|references?)\b", text_lower))

    # Check for demographic risks
    demographic_risks = []
    for pat, label in AU_DEMOGRAPHIC_PATTERNS:
        if pat.search(resume_text):
            demographic_risks.append(label)

    is_compliant = has_referees and len(demographic_risks) == 0

    return {
        "compliant": is_compliant,
        "has_referees": has_referees,
        "demographic_risks": demographic_risks,
        "standards": {
            "referees_required": True,
            "demographics_prohibited": True,
            "recommended_length": "2-3 pages for mid-to-senior Australian roles",
            "paper_size": "A4 (210 x 297 mm)",
        },
    }


def audit_ats_compliance(resume_text: str) -> dict[str, Any]:
    """Audits resume text against Workday, Greenhouse, Taleo, and JobAdder parsers."""
    text_lower = resume_text.lower()
    lines = [line.strip() for line in resume_text.split("\n") if line.strip()]

    # Detect canonical sections
    detected_sections = {
        "summary": any(re.search(rf"\b{pat}\b", text_lower) for pat in STANDARD_SECTIONS["summary"]),
        "work_experience": any(re.search(rf"\b{pat}\b", text_lower) for pat in STANDARD_SECTIONS["experience"]),
        "skills": any(re.search(rf"\b{pat}\b", text_lower) for pat in STANDARD_SECTIONS["skills"]),
        "education": any(re.search(rf"\b{pat}\b", text_lower) for pat in STANDARD_SECTIONS["education"]),
        "referees": any(re.search(rf"\b{pat}\b", text_lower) for pat in STANDARD_SECTIONS["referees"]),
    }

    # Detect non-standard headers
    taxonomy_warnings = []
    for pat in NON_STANDARD_HEADERS:
        match = re.search(rf"\b({pat})\b", text_lower)
        if match:
            taxonomy_warnings.append(f"Non-standard section header detected: '{match.group(1).title()}' (may fail parser mapping)")

    # Multi-column risk detection (pipes or tab characters dividing columns)
    column_risk = False
    for line in lines[:15]:
        if line.count("|") >= 4 or "\t\t" in line:
            column_risk = True
            break

    # Workday Evaluation: Highly rigid, fails on non-standard headers or missing experience
    workday_pass = detected_sections["work_experience"] and detected_sections["education"] and len(taxonomy_warnings) == 0
    workday_status = "passed" if workday_pass else ("warning" if detected_sections["work_experience"] else "failed")

    # Greenhouse Evaluation: Structured fields mapping, likes explicit skills section
    greenhouse_pass = detected_sections["skills"] and detected_sections["work_experience"]
    greenhouse_status = "passed" if greenhouse_pass else "warning"

    # Taleo / iCIMS Evaluation: Sensitive to formatting tables and column risks
    taleo_status = "warning" if column_risk else "passed"

    # JobAdder Evaluation: AU-friendly, likes contact info and referees
    has_contact = bool(re.search(r"[\w\.-]+@[\w\.-]+", resume_text))
    jobadder_status = "passed" if (has_contact and detected_sections["work_experience"]) else "warning"

    # Calculate overall ATS compliance score (0-100)
    score = 100
    if not detected_sections["work_experience"]:
        score -= 30
    if not detected_sections["skills"]:
        score -= 15
    if not detected_sections["education"]:
        score -= 15
    if not detected_sections["summary"]:
        score -= 10
    if not detected_sections["referees"]:
        score -= 5
    if taxonomy_warnings:
        score -= min(20, len(taxonomy_warnings) * 10)
    if column_risk:
        score -= 15

    overall_score = max(20, min(100, score))

    return {
        "overall_score": overall_score,
        "detected_sections": detected_sections,
        "taxonomy_warnings": taxonomy_warnings,
        "column_risk": column_risk,
        "workday": {
            "status": workday_status,
            "details": "Requires rigid 4-part taxonomy ('Work Experience', 'Education', 'Skills', 'Summary')." if workday_pass else "Flagged: Non-standard headers or missing sections risk Textkernel mapping failure in Workday.",
        },
        "greenhouse": {
            "status": greenhouse_status,
            "details": "Structured candidate extraction confirmed for core competencies." if greenhouse_pass else "Missing explicit Skills or Work Experience section for structured indexing.",
        },
        "taleo": {
            "status": taleo_status,
            "details": "Clean linear layout detected." if not column_risk else "Risk of text-layer scrambling from multi-column structure.",
        },
        "jobadder": {
            "status": jobadder_status,
            "details": "Compliant with Australian CRM parser parsing format." if jobadder_status == "passed" else "Missing contact email or core employment history.",
        },
    }


def simulate_topological_flattening(resume_text: str) -> dict[str, Any]:
    """Simulates what an ATS database parser (Textkernel/Sovren) extracts from the document."""
    lines = [line.strip() for line in resume_text.split("\n") if line.strip()]

    # Extract Candidate Name (usually top non-empty line)
    candidate_name = lines[0] if lines else "Unknown Candidate"

    # Extract Contact Information
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", resume_text)
    phone_match = re.search(r"(\+?61\s?|0)[2-478](\s?\d){8}", resume_text)
    linkedin_match = re.search(r"linkedin\.com/in/[\w\-]+", resume_text, re.IGNORECASE)

    # Extract recognized technical skill tokens
    potential_skills = [
        "AWS", "Azure", "Google Cloud", "GCP", "Kubernetes", "Docker", "Terraform",
        "Ansible", "Python", "Bash", "PowerShell", "CI/CD", "Linux", "SQL",
        "Git", "ArgoCD", "React", "Node.js", "TypeScript", "JavaScript",
        "M365", "Active Directory", "Entra ID", "Intune", "Cybersecurity",
    ]
    extracted_skills = []
    for skill in potential_skills:
        if re.search(rf"\b{re.escape(skill)}\b", resume_text, re.IGNORECASE):
            extracted_skills.append(skill)

    # Flatten into unstyled raw stream (what recruiters view in plain text mode)
    raw_stream = re.sub(r"[ \t]+", " ", resume_text).strip()

    return {
        "candidate_name": candidate_name,
        "contact_info": {
            "email": email_match.group(0) if email_match else None,
            "phone": phone_match.group(0) if phone_match else None,
            "linkedin": linkedin_match.group(0) if linkedin_match else None,
        },
        "extracted_skills": extracted_skills,
        "raw_text_stream": raw_stream,
    }


def generate_ats_diagnostic_report(resume_text: str, job: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Generates the comprehensive Phase 20 ATS Sentinel diagnostic report."""
    star_density = calculate_star_metric_density(resume_text)
    compliance = audit_ats_compliance(resume_text)
    regional = audit_regional_compliance_au(resume_text)
    flattening = simulate_topological_flattening(resume_text)

    # Calculate overall composite ATS score
    # 40% compliance + 40% STAR density + 20% regional standards
    composite_score = int(
        (compliance["overall_score"] * 0.4) +
        (star_density["density_percentage"] * 0.4) +
        (100 if regional["compliant"] else 50) * 0.2
    )

    recommendations = []
    if compliance["taxonomy_warnings"]:
        recommendations.extend(compliance["taxonomy_warnings"])
    if star_density["density_percentage"] < 50:
        recommendations.append(f"STAR Metric Density is low ({star_density['density_percentage']}%). Re-anchor achievement bullets using the formula [Active Verb] + [Project] + [Quantified Result].")
    if star_density["fluff_phrases"]:
        recommendations.append(f"Eradicate {len(star_density['fluff_phrases'])} un-anchored corporate buzzwords: {', '.join(star_density['fluff_phrases'][:3])}.")
    if not regional["has_referees"]:
        recommendations.append("Append a 'Referees' section with 2-3 verified contacts (mandatory for Australian applications).")
    if regional["demographic_risks"]:
        recommendations.append(f"Remove demographic risks to comply with Australian Fair Work anti-bias standards: {', '.join(regional['demographic_risks'])}.")

    return {
        "ats_score": max(15, min(100, composite_score)),
        "ats_compliance": compliance,
        "star_density": star_density,
        "regional_au": regional,
        "topological_flattening": flattening,
        "actionable_recommendations": recommendations,
        "target_job": {
            "title": job.get("title", "Target Role") if job else "General Target Role",
            "company": job.get("company", "Target Employer") if job else "Target Employer",
        },
    }
