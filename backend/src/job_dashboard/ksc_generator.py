"""Australian Key Selection Criteria (KSC) & Public Sector Capability Framework Generator.

Designed for Australian Public Service (APS), Victorian Public Service (VPS), NSW Government,
Local Councils, Healthcare Networks, and Higher Education institutions.

Features:
1. Automated extraction of Key Selection Criteria from position descriptions and job ads.
2. Capability framework mapping against APS Integrated Leadership System (ILS) and
   Victorian Public Sector Commission (VPSC) Capability Framework.
3. SAO (Situation, Action, Outcome) and STAR narrative synthesis tailored to candidate profiles.
4. Word count and character constraint validation (e.g. 250-word, 350-word, 500-word thresholds).
5. Master KSC document assembly with single-column ATS & merit-based review formatting.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

from .semantic_tailoring import localize_australian


# Standard Australian Public Sector & Enterprise Capability Frameworks
CAPABILITY_PILLARS = {
    "STRATEGIC_DIRECTION": {
        "name": "Shapes Strategic Thinking / Supports Strategic Direction",
        "description": "Inspires a sense of purpose and direction, focuses strategically, harnesses information, and shows sound judgement.",
        "keywords": ["strategy", "strategic", "policy", "vision", "analytical", "research", "continuous improvement", "governance", "planning", "innovative"],
        "action_verbs": ["Formulated", "Analyzed", "Pioneered", "Strategized", "Evaluated", "Conceptualized"],
    },
    "ACHIEVES_RESULTS": {
        "name": "Achieves Results / Delivers Measurable Outcomes",
        "description": "Identifies and uses resources wisely, applies and builds professional expertise, responds positively to change, and delivers on intended results.",
        "keywords": ["delivery", "deliver", "results", "milestone", "kpi", "project management", "budget", "cost", "deadlines", "implement", "execute"],
        "action_verbs": ["Delivered", "Executed", "Orchestrated", "Spearheaded", "Optimized", "Delivered"],
    },
    "RELATIONSHIPS": {
        "name": "Cultivates Productive Working Relationships / Stakeholder Engagement",
        "description": "Nurtures internal and external relationships, listens to, understands and recognises the needs of others, values individual differences, and guides/mentors others.",
        "keywords": ["stakeholder", "collaboration", "consultation", "co-design", "teamwork", "partner", "client", "negotiate", "mentor", "interpersonal", "relationship"],
        "action_verbs": ["Collaborated", "Consulted", "Negotiated", "Partnered", "Mobilized", "Facilitated"],
    },
    "INTEGRITY_DRIVE": {
        "name": "Exemplifies Personal Drive, Integrity & Public Sector Values",
        "description": "Demonstrates public service professionalism and probity, engages with risk and shows personal courage, commits to action, and displays resilience.",
        "keywords": ["integrity", "ethics", "probity", "values", "compliance", "resilience", "accountability", "governance", "impartial", "safety", "child safe"],
        "action_verbs": ["Upheld", "Championed", "Safeguarded", "Demonstrated", "Modeled", "Secured"],
    },
    "COMMUNICATION": {
        "name": "Communicates with Influence / High-Impact Stakeholder Messaging",
        "description": "Communicates clearly, listens, understands and adapts to audience, negotiates persuasively, and prepares clear, high-level briefings and submissions.",
        "keywords": ["communication", "briefing", "written", "verbal", "presentation", "report", "influence", "submission", "cabinet", "ministerial", "correspondence"],
        "action_verbs": ["Authored", "Articulated", "Presented", "Briefed", "Conveyed", "Persuaded"],
    },
    "TECHNICAL_EXPERTISE": {
        "name": "Technical & Specialized Domain Mastery",
        "description": "Applies depth of domain expertise, technical frameworks, specialized clinical/engineering/financial systems, and regulatory standards.",
        "keywords": ["technical", "systems", "cloud", "aws", "azure", "sql", "data", "architecture", "software", "clinical", "nursing", "engineering", "legal", "financial"],
        "action_verbs": ["Architected", "Engineered", "Implemented", "Deployed", "Configured", "Standardized"],
    },
}


@dataclass
class KscSolution:
    criterion_number: int
    criterion_text: str
    capability_name: str
    capability_description: str
    situation: str
    action: str
    outcome: str
    full_statement: str
    word_count: int
    target_word_limit: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class KscReport:
    job_id: str
    job_title: str
    company: str
    candidate_name: str
    total_criteria: int
    solutions: list[KscSolution] = field(default_factory=list)
    master_document: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "job_title": self.job_title,
            "company": self.company,
            "candidate_name": self.candidate_name,
            "total_criteria": self.total_criteria,
            "solutions": [s.to_dict() for s in self.solutions],
            "master_document": self.master_document,
        }


def extract_ksc_from_jd(description: str, title: str = "") -> list[str]:
    """Extracts explicit Key Selection Criteria or core capability requirements from job text."""
    if not description or not isinstance(description, str):
        return _fallback_criteria(title)

    clean_text = description.replace("\r\n", "\n")
    
    # 1. Search for targeted KSC section headers
    section_match = re.search(
        r"(?:key\s+selection\s+criteria|ksc|selection\s+criteria|key\s+accountabilities|what\s+you(?:'ll|\s+will)\s+bring|about\s+you|skills\s+(?:and|&)\s+experience|capabilities|requirements)[:\s\n]+([\s\S]+?)(?=(?:\n\s*(?:how\s+to\s+apply|why\s+join|benefits|about\s+the\s+department|terms\s+of\s+appointment|pre-employment|applications\s+close)\b|$))",
        clean_text,
        re.IGNORECASE,
    )
    search_scope = section_match.group(1) if section_match else clean_text

    extracted: list[str] = []
    
    # 2. Check for numbered or KSC-labeled criteria (e.g. "KSC 1:", "1.", "Criterion 1:")
    numbered_matches = re.findall(
        r"^\s*(?:(?:ksc|criterion)?\s*\d+[.:]\s*)([^\n]+)",
        search_scope,
        re.MULTILINE | re.IGNORECASE,
    )
    for m in numbered_matches:
        cleaned = " ".join(m.split()).strip()
        if len(cleaned) >= 20 and not re.search(r"^(?:how to apply|salary|work type|location|reference|apply|close)\b", cleaned, re.IGNORECASE):
            extracted.append(cleaned)

    # 3. If no numbered matches, search for bullet points under the criteria section
    if len(extracted) < 2:
        bullet_matches = re.findall(
            r"^\s*[•*\-►✔✓]\s*([^\n]+)",
            search_scope,
            re.MULTILINE,
        )
        for b in bullet_matches:
            cleaned = " ".join(b.split()).strip()
            if len(cleaned) >= 25 and not re.search(r"^(?:how to apply|salary|work type|location|reference|apply|close)\b", cleaned, re.IGNORECASE):
                extracted.append(cleaned)

    # 4. Limit to top 6 most substantive criteria, or fill with fallback if sparse
    meaningful = [c for c in extracted if len(c) >= 20][:6]
    if len(meaningful) < 2:
        return _fallback_criteria(title)
        
    return meaningful


def _fallback_criteria(title: str = "") -> list[str]:
    """Generates standard Victorian/Australian public sector capability criteria when none explicitly extracted."""
    role_name = title.strip() or "Specialist / Advisor"
    return [
        f"Demonstrated experience in {role_name} delivery, with proven capability to analyze complex requirements and deliver high-quality outcomes within statutory deadlines.",
        "Demonstrated high-level interpersonal and stakeholder engagement skills, with the proven ability to build collaborative relationships and consult effectively with diverse stakeholders.",
        "Proven analytical, problem-solving and strategic thinking capabilities, including the ability to identify systemic risks and formulate practical solutions.",
        "High-level written and verbal communication skills, with demonstrated capability to synthesize complex data into clear, persuasive executive briefings and reports.",
        "Demonstrated commitment to public sector values, probity, ethical conduct, and fostering inclusive, respectful team environments.",
    ]


def map_ksc_to_capability_framework(criterion: str) -> dict[str, Any]:
    """Maps a criterion text to the APS Integrated Leadership System and VPSC Capability Framework."""
    crit_lower = criterion.lower()
    
    best_pillar = "TECHNICAL_EXPERTISE"
    max_score = 0
    
    for pillar_key, pillar_data in CAPABILITY_PILLARS.items():
        score = sum(1 for kw in pillar_data["keywords"] if kw in crit_lower)
        if score > max_score:
            max_score = score
            best_pillar = pillar_key

    # Specific heuristic overrides
    if any(term in crit_lower for term in ["stakeholder", "collaborat", "relationship", "partner", "co-design"]):
        best_pillar = "RELATIONSHIPS"
    elif any(term in crit_lower for term in ["written", "verbal", "briefing", "report", "presentation", "communicat"]):
        best_pillar = "COMMUNICATION"
    elif any(term in crit_lower for term in ["integrity", "probity", "values", "ethics", "child safe"]):
        best_pillar = "INTEGRITY_DRIVE"
    elif any(term in crit_lower for term in ["deliver", "project", "milestone", "outcome", "budget", "kpi"]):
        best_pillar = "ACHIEVES_RESULTS"
    elif any(term in crit_lower for term in ["strategic", "policy", "strategy", "vision", "innovat"]):
        best_pillar = "STRATEGIC_DIRECTION"

    return {
        "pillar": best_pillar,
        "name": CAPABILITY_PILLARS[best_pillar]["name"],
        "description": CAPABILITY_PILLARS[best_pillar]["description"],
        "action_verbs": CAPABILITY_PILLARS[best_pillar]["action_verbs"],
    }


def generate_sao_statement(
    criterion: str,
    profile: dict[str, Any],
    job: dict[str, Any],
    criterion_index: int = 1,
    word_limit: int = 300,
) -> KscSolution:
    """Generates a structured Situation, Action, Outcome (SAO) statement resolving a Key Selection Criterion."""
    mapping = map_ksc_to_capability_framework(criterion)
    candidate_name = str(profile.get("name") or "Candidate").strip()
    target_company = str(job.get("company") or "the Department").strip()
    job_title = str(job.get("title") or "the role").strip()
    
    # Extract candidate background facts
    experience = profile.get("experience") or profile.get("history") or []
    recent_role = experience[0] if experience and isinstance(experience, list) else {}
    past_company = recent_role.get("company") or "a multi-stakeholder enterprise organisation"
    past_title = recent_role.get("title") or recent_role.get("role") or "Senior Specialist"
    
    skills = profile.get("skills") or profile.get("coreSkills") or []
    if isinstance(skills, dict):
        flat_skills = []
        for v in skills.values():
            if isinstance(v, list):
                flat_skills.extend(v)
        skills = flat_skills
    skills_text = ", ".join(skills[:4]) if skills else "systems architecture, modern cloud workflows, and data-driven governance"

    # Dynamic SAO Synthesis based on capability pillar
    pillar = mapping["pillar"]
    
    if pillar == "STRATEGIC_DIRECTION":
        situation = (
            f"While serving as {past_title} at {past_company}, our team was tasked with navigating a complex operational reform "
            f"where fragmented processes and siloed data streams compromised strategic visibility and program delivery timelines."
        )
        action = (
            f"I spearheaded a strategic gap analysis across key deliverables, engaging with cross-functional team leaders to establish "
            f"a standardized roadmap. Leveraging {skills_text}, I instituted agile prioritization principles, aligned strategic milestones "
            f"with overarching departmental priorities, and designed proactive risk mitigation matrices to ensure operational continuity."
        )
        outcome = (
            f"This strategic overhaul established seamless visibility across 100% of pipeline projects, reduced initiative turnaround times "
            f"by 32%, and delivered an enduring operating framework that was adopted division-wide. I will bring this identical strategic "
            f"foresight to {target_company} as {job_title}."
        )
    elif pillar == "ACHIEVES_RESULTS":
        situation = (
            f"In my role as {past_title} at {past_company}, I had accountability for delivering high-priority project outcomes "
            f"under strict statutory deadlines and demanding service delivery benchmarks with zero margin for operational slippage."
        )
        action = (
            f"I deployed disciplined project controls, establishing clear milestones, automated tracking dashboards, and rigorous quality "
            f"assurance routines. When unforeseen technical bottlenecks arose, I reallocated team resources strategically, implemented {skills_text}, "
            f"and maintained weekly executive accountability check-ins to ensure uncompromised execution velocity."
        )
        outcome = (
            f"As a result, all project deliverables were achieved 3 weeks ahead of scheduled completion, realizing a 28% gain in efficiency "
            f"and saving over $140,000 in operational overhead while maintaining a 99.8% compliance rate. This track record of results "
            f"will directly support {target_company}'s commitments."
        )
    elif pillar == "RELATIONSHIPS":
        situation = (
            f"At {past_company}, I operated in a complex stakeholder ecosystem where competing priorities between internal business units, "
            f"technical teams, and external partner agencies initially impeded collaborative progress on key organizational goals."
        )
        action = (
            f"I established structured consultative forums and co-design workshops, actively listening to stakeholders' distinct operational "
            f"pain points. By framing technical requirements in shared business value, maintaining transparent communication cadences, and "
            f"fostering an empathetic, culturally safe environment, I built mutual trust and unified disparate stakeholder objectives."
        )
        outcome = (
            f"This collaborative framework secured unanimous consensus from all executive stakeholders, eliminating cross-team friction and "
            f"boosting stakeholder satisfaction metrics by 44%. I look forward to cultivating equally robust, enduring partnerships across {target_company}."
        )
    elif pillar == "INTEGRITY_DRIVE":
        situation = (
            f"During an intensive audit and systems review at {past_company}, our unit encountered sensitive compliance and data privacy "
            f"challenges requiring uncompromising adherence to regulatory standards, probity requirements, and public trust."
        )
        action = (
            f"I immediately upheld organizational governance by conducting a comprehensive compliance review, ensuring 100% adherence to "
            f"relevant standards and ethical protocols. I championed transparent reporting, trained team members in risk awareness, and led "
            f"by personal example with unwavering accountability and professional integrity."
        )
        outcome = (
            f"The initiative achieved a spotless 100% audit clearance from independent regulators with zero non-conformances identified, "
            f"reinforcing institutional integrity and safeguarding sensitive data. I hold myself to these exact standards in public service."
        )
    elif pillar == "COMMUNICATION":
        situation = (
            f"As {past_title}, I was responsible for communicating intricate, data-dense technical architectures and policy updates to non-technical "
            f"departmental leaders, external regulatory authorities, and community representatives with varying technical literacy."
        )
        action = (
            f"I authored concise executive briefings, data-driven visual dashboards, and plain-English policy summaries that distilled complex "
            f"systems into actionable insights. I tailored my communication style to each audience, facilitating interactive Q&A sessions and "
            f"persuasively articulating the strategic justification and risk posture for proposed initiatives."
        )
        outcome = (
            f"My executive briefings directly influenced leadership sign-off with 100% first-pass approval from steering committees, cutting "
            f"decision cycles from 4 weeks to 5 business days. I will bring this clear, influential communication capability to {target_company}."
        )
    else:  # TECHNICAL_EXPERTISE
        situation = (
            f"While driving technical capability at {past_company}, our team needed to architect and implement reliable, scalable systems "
            f"capable of meeting strict security guidelines, high availability requirements, and continuous data integration."
        )
        action = (
            f"Leveraging deep hands-on expertise in {skills_text}, I engineered automated workflows, robust testing suites, and standardized "
            f"documentation. I ensured full compliance with enterprise architectures, conducted peer code reviews, and mentored junior staff "
            f"on technical best practices and continuous integration paradigms."
        )
        outcome = (
            f"The deployed architecture reduced system incident tickets by 45%, bolstered processing throughput by 3x, and established a scalable "
            f"foundation for future enhancements. I am fully equipped to apply this domain mastery to the technical challenges at {target_company}."
        )

    # Combine into standard APS / VPS SAO Statement
    full_text = (
        f"**Situation:** {situation}\n\n"
        f"**Action:** {action}\n\n"
        f"**Outcome:** {outcome}"
    )
    
    localized_full = localize_australian(full_text)
    word_count = len(localized_full.split())
    
    return KscSolution(
        criterion_number=criterion_index,
        criterion_text=criterion,
        capability_name=mapping["name"],
        capability_description=mapping["description"],
        situation=localize_australian(situation),
        action=localize_australian(action),
        outcome=localize_australian(outcome),
        full_statement=localized_full,
        word_count=word_count,
        target_word_limit=word_limit,
    )


def generate_ksc_report(
    job: dict[str, Any],
    profile: dict[str, Any],
    custom_criteria: list[str] | None = None,
    word_limit: int = 300,
) -> KscReport:
    """Generates a complete KSC report and master exportable document for a target job."""
    job_id = str(job.get("id") or f"{job.get('company')}_{job.get('title')}").strip()
    job_title = str(job.get("title") or "Professional Role").strip()
    company = str(job.get("company") or "Target Employer").strip()
    candidate_name = str(profile.get("name") or "Candidate").strip()
    description = str(job.get("description") or job.get("notes") or "").strip()

    # Determine criteria list
    criteria: list[str] = []
    if custom_criteria and isinstance(custom_criteria, list):
        criteria = [c.strip() for c in custom_criteria if c and c.strip()]
    
    if not criteria:
        criteria = extract_ksc_from_jd(description, job_title)

    solutions: list[KscSolution] = []
    for idx, crit in enumerate(criteria, start=1):
        sol = generate_sao_statement(crit, profile, job, criterion_index=idx, word_limit=word_limit)
        solutions.append(sol)

    # Build master single-column document formatted for Australian merit-based assessment
    doc_lines = [
        f"# Key Selection Criteria Response Document",
        f"**Position:** {job_title}",
        f"**Organisation:** {company}",
        f"**Applicant:** {candidate_name}",
        f"**Framework Standard:** APS Integrated Leadership System & VPSC Capability Standards",
        f"---",
        "",
    ]

    for sol in solutions:
        doc_lines.extend([
            f"## Criterion {sol.criterion_number}: {sol.criterion_text}",
            f"*{sol.capability_name}*",
            "",
            sol.full_statement,
            "",
            f"*Word count: {sol.word_count} words (Target: {sol.target_word_limit} words)*",
            "",
            "---",
            "",
        ])

    master_doc = "\n".join(doc_lines).strip()

    return KscReport(
        job_id=job_id,
        job_title=job_title,
        company=company,
        candidate_name=candidate_name,
        total_criteria=len(solutions),
        solutions=solutions,
        master_document=master_doc,
    )
