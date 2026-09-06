"""Strategic Career Roadmap & Skills Gap Forecasting Engine.

Evaluates candidate experience across 5 sector tracks (Technology, Healthcare, Finance,
Trades, Legal), forecasts skills deltas between current and target seniority tiers,
recommends Australian industry credentials, models salary band progression, and
generates 6–12 month career execution milestones.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


SENIORITY_LEVELS = ["entry_mid", "senior_lead", "staff_principal", "executive"]

LEVEL_LABELS = {
    "entry_mid": "Entry / Mid-Level Specialist",
    "senior_lead": "Senior Specialist / Lead",
    "staff_principal": "Staff / Principal / Management Consultant",
    "executive": "Director / Executive / Partner",
}

SECTOR_CAREER_TRACKS: Dict[str, Dict[str, Any]] = {
    "technology": {
        "sector_label": "Technology & Engineering",
        "entry_mid": {
            "title": "Systems / DevOps Engineer",
            "salary_range": (95000, 135000, 115000),
            "skills": [
                "Linux Administration",
                "Python/Bash Scripting",
                "CI/CD Pipelines",
                "Containerization (Docker)",
                "Cloud Fundamentals (AWS/Azure)",
                "Git Version Control",
            ],
        },
        "senior_lead": {
            "title": "Senior Cloud & Platform Engineer",
            "salary_range": (145000, 185000, 165000),
            "skills": [
                "Kubernetes & EKS/AKS Orchestration",
                "Infrastructure as Code (Terraform)",
                "Cloud Architecture & High Availability",
                "Observability (Prometheus/Grafana/Datadog)",
                "FinOps & Cost Optimization",
                "Technical Mentorship & Team Leadership",
            ],
        },
        "staff_principal": {
            "title": "Staff Platform Architect / Principal Engineer",
            "salary_range": (190000, 240000, 215000),
            "skills": [
                "Multi-Region Distributed Systems Architecture",
                "Enterprise Security Governance (ASD Essential 8)",
                "FinOps & Cloud Unit Economics",
                "Cross-Engineering Technical Strategy",
                "Executive Stakeholder Influence & Technical RFCs",
            ],
        },
        "executive": {
            "title": "Head of Infrastructure / VP of Platform Engineering",
            "salary_range": (250000, 340000, 290000),
            "skills": [
                "Department P&L Ownership & Budgeting",
                "Multi-Year Technology Platform Vision",
                "Enterprise Vendor & Cloud Contract Negotiation",
                "Executive & Boardroom Technical Strategy",
                "Talent Architecture & Engineering Org Design",
            ],
        },
        "adjacent_pivots": [
            {"title": "Site Reliability Engineering (SRE) Lead", "overlap_pct": 85, "reason": "Extensive crossover in Linux, automation, and distributed reliability telemetry."},
            {"title": "Cloud Security Architect (SecOps)", "overlap_pct": 80, "reason": "Strong alignment with infrastructure-as-code, IAM, and ASD Essential 8 compliance."},
            {"title": "Enterprise Solutions Architect", "overlap_pct": 75, "reason": "Capitalizes on broad cloud infrastructure design and stakeholder alignment."},
        ],
    },
    "healthcare": {
        "sector_label": "Healthcare & Clinical",
        "entry_mid": {
            "title": "Registered Nurse (Acute / Community)",
            "salary_range": (78000, 95000, 86000),
            "skills": [
                "Direct Patient Care",
                "Medication Administration & Calculations",
                "Aseptic Technique & Wound Care",
                "Clinical Handover (ISBAR)",
                "Electronic Medical Record (EMR) Documentation",
            ],
        },
        "senior_lead": {
            "title": "Clinical Nurse Specialist (CNS)",
            "salary_range": (105000, 125000, 115000),
            "skills": [
                "Specialized Clinical Diagnostics & Assessment",
                "Clinical Preceptorship & Graduate Mentoring",
                "Quality Auditing & Infection Prevention Control",
                "Complex Case Management & Escalation",
                "Morbidity & Mortality Clinical Review",
            ],
        },
        "staff_principal": {
            "title": "Nurse Unit Manager (NUM) / Clinical Nurse Consultant",
            "salary_range": (130000, 155000, 142000),
            "skills": [
                "Ward Rostering & Staffing Ratio Compliance",
                "Clinical Governance & NSQHS Standards",
                "Staff Dispute Resolution & Performance Management",
                "Accreditation Preparedness & Quality Strategy",
                "Multidisciplinary Health Team Coordination",
            ],
        },
        "executive": {
            "title": "Director of Nursing / Executive Director of Clinical Services",
            "salary_range": (175000, 235000, 200000),
            "skills": [
                "Health Service Clinical Governance & Strategy",
                "Hospital Workforce Planning & Enterprise Agreement Compliance",
                "Board of Health Clinical Quality Reporting",
                "Capital Health Budget Allocation",
            ],
        },
        "adjacent_pivots": [
            {"title": "Clinical Research Coordinator", "overlap_pct": 80, "reason": "Leverages patient trial protocols, ethics governance, and clinical documentation."},
            {"title": "Health Informatics Specialist", "overlap_pct": 75, "reason": "Combines acute clinical domain expertise with EMR systems and workflow design."},
            {"title": "Aged Care Facility Operations Manager", "overlap_pct": 70, "reason": "High demand for AHPRA-registered clinical leadership and compliance oversight."},
        ],
    },
    "finance": {
        "sector_label": "Banking, Finance & Accounting",
        "entry_mid": {
            "title": "Financial Analyst / Assistant Accountant",
            "salary_range": (80000, 105000, 92000),
            "skills": [
                "Month-End Ledger Reconciliations",
                "Variance Analysis & Budget vs Actuals",
                "Advanced Financial Modeling (Excel)",
                "Accounts Payable/Receivable Oversight",
                "ERP General Ledger Posting",
            ],
        },
        "senior_lead": {
            "title": "Senior Management Accountant / Finance Business Partner",
            "salary_range": (120000, 155000, 138000),
            "skills": [
                "Statutory Financial Reporting (AASB/IFRS)",
                "FP&A Commercial Scenario Modeling",
                "Divisional Business Partnering & Cost Analysis",
                "Australian Tax Compliance (GST/FBT/PAYG)",
                "Internal Control Systems & Audit Defense",
            ],
        },
        "staff_principal": {
            "title": "Financial Controller / Head of FP&A",
            "salary_range": (165000, 210000, 185000),
            "skills": [
                "Corporate Treasury & Cash Flow Optimization",
                "Audit Committee Financial Presentations",
                "ERP Transformation & PowerBI Architecture",
                "M&A Financial Due Diligence",
                "Debt Facility & Covenant Governance",
            ],
        },
        "executive": {
            "title": "Chief Financial Officer (CFO)",
            "salary_range": (240000, 360000, 295000),
            "skills": [
                "Boardroom Financial Governance & Investor Relations",
                "Capital Raising & Debt Syndication",
                "Enterprise Risk & Capital Allocation Strategy",
                "ASX Corporate Governance & Market Disclosure",
            ],
        },
        "adjacent_pivots": [
            {"title": "Commercial Strategy & Operations Director", "overlap_pct": 80, "reason": "Draws on strong unit economics, commercial contracts, and margin analysis."},
            {"title": "Internal Audit & Risk Advisory Lead", "overlap_pct": 80, "reason": "Direct overlap with AASB controls, fraud governance, and risk matrices."},
            {"title": "M&A Transaction Advisory Specialist", "overlap_pct": 75, "reason": "Leverages advanced valuation modeling and working capital due diligence."},
        ],
    },
    "trades": {
        "sector_label": "Trades, Construction & Logistics",
        "entry_mid": {
            "title": "Licensed Tradesperson / Electrical Specialist",
            "salary_range": (80000, 105000, 92000),
            "skills": [
                "Trade Craftsmanship & Technical Blueprint Reading",
                "WHS Safety Protocols & SWMS Compliance",
                "Power Equipment Operation & Hand Tool Mastery",
                "Fault Diagnosis & Circuit Testing",
                "Material Quantification & Work Orders",
            ],
        },
        "senior_lead": {
            "title": "Leading Hand / Construction Foreperson",
            "salary_range": (115000, 140000, 128000),
            "skills": [
                "Crew Supervision & Daily Tool-Box Pre-Starts",
                "Subcontractor Coordination & Site Scheduling",
                "Critical Path Milestone Execution",
                "Quality Assurance & Defect Rectification",
                "Workplace Safety Hazard Investigation",
            ],
        },
        "staff_principal": {
            "title": "Site Superintendent / Construction Project Manager",
            "salary_range": (150000, 195000, 172000),
            "skills": [
                "Contract Administration (AS 4000 / AS 2124)",
                "Progress Claims & Commercial Variation Tracking",
                "SafeWork Regulatory Compliance & Auditing",
                "Head Contractor Stakeholder Management",
                "Procurement & Trade Tender Packaging",
            ],
        },
        "executive": {
            "title": "General Manager of Construction / Operations Director",
            "salary_range": (220000, 310000, 260000),
            "skills": [
                "Multi-Project Operations & P&L Oversight",
                "Enterprise WHS Safety Management Systems",
                "Client Contract Governance & Tender Bidding",
                "Annual Capital Works Procurement",
            ],
        },
        "adjacent_pivots": [
            {"title": "WHS & Safety Auditor", "overlap_pct": 85, "reason": "Deep practical grounding in high-risk Australian site safety and SWMS."},
            {"title": "Construction Cost Estimator", "overlap_pct": 75, "reason": "Direct understanding of trade labour rates, plant hire, and takeoff quantities."},
            {"title": "Commercial Facilities Superintendent", "overlap_pct": 70, "reason": "Expertise in building mechanical, electrical, and structural maintenance."},
        ],
    },
    "legal": {
        "sector_label": "Legal & Professional Services",
        "entry_mid": {
            "title": "Associate Solicitor / In-House Legal Counsel",
            "salary_range": (90000, 125000, 108000),
            "skills": [
                "Legal Research & Advice Memorandum Drafting",
                "Commercial Contract Review & Redlining",
                "Discovery & Evidentiary Collation",
                "Court Rules & Practice Note Compliance",
                "Client Matter Administration",
            ],
        },
        "senior_lead": {
            "title": "Senior Associate / Senior Legal Counsel",
            "salary_range": (140000, 185000, 162000),
            "skills": [
                "High-Value Transaction Structuring & Drafting",
                "Dispute Negotiation & Alternative Dispute Resolution (ADR)",
                "Regulatory Response (ASIC / ACCC / OAIC)",
                "Junior Solicitor Mentorship & File Supervision",
                "Client Commercial Relationship Management",
            ],
        },
        "staff_principal": {
            "title": "Special Counsel / Legal Practice Director",
            "salary_range": (195000, 260000, 225000),
            "skills": [
                "Strategic Legal Risk Advisory & Board Briefings",
                "Practice Group Subject-Matter Authority",
                "Complex Commercial Litigation Strategy",
                "Fee Realization & Matter Profitability Management",
                "Commercial Policy Formulation",
            ],
        },
        "executive": {
            "title": "Equity Partner / General Counsel & Company Secretary",
            "salary_range": (280000, 450000, 350000),
            "skills": [
                "Partnership Capital & Profit Allocation",
                "Corporate Governance & Board Advisory",
                "Enterprise Legal Risk Management",
                "External Legal Panel Spend Management",
            ],
        },
        "adjacent_pivots": [
            {"title": "Head of Regulatory & Compliance", "overlap_pct": 85, "reason": "Extensive overlap in statutory interpretation, ASIC compliance, and enforcement response."},
            {"title": "Corporate Governance & Company Secretary", "overlap_pct": 80, "reason": "Deep grounding in Corporations Act 2001 and board governance."},
            {"title": "Commercial Contracts Director", "overlap_pct": 75, "reason": "Strong focus on procurement, vendor negotiation, and commercial risk transfer."},
        ],
    },
}

AU_CERTIFICATION_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    "technology": [
        {
            "name": "AWS Certified Solutions Architect - Professional",
            "level": "senior_lead",
            "issuing_body": "Amazon Web Services",
            "estimated_hours": 90,
            "impact": "Unlocks Staff Architect roles; validates multi-tier enterprise cloud designs.",
        },
        {
            "name": "Certified Kubernetes Administrator (CKA)",
            "level": "senior_lead",
            "issuing_body": "Cloud Native Computing Foundation (CNCF)",
            "estimated_hours": 60,
            "impact": "Gold standard for platform engineering and container orchestration.",
        },
        {
            "name": "CISM (Certified Information Security Manager)",
            "level": "staff_principal",
            "issuing_body": "ISACA",
            "estimated_hours": 100,
            "impact": "Required for cybersecurity alignment and ASD Essential 8 leadership.",
        },
    ],
    "healthcare": [
        {
            "name": "AHPRA Specialty Endorsement & Postgrad Cert in Advanced Clinical Practice",
            "level": "senior_lead",
            "issuing_body": "Australian Health Practitioner Regulation Agency (AHPRA)",
            "estimated_hours": 150,
            "impact": "Direct requirement to qualify as Clinical Nurse Specialist in AU hospitals.",
        },
        {
            "name": "Advanced Life Support 2 (ALS2)",
            "level": "senior_lead",
            "issuing_body": "Australian Resuscitation Council (ARC)",
            "estimated_hours": 24,
            "impact": "Essential for acute, emergency, and critical care clinical leadership.",
        },
        {
            "name": "Lead Auditor in Healthcare Quality Management (NSQHS)",
            "level": "staff_principal",
            "issuing_body": "Australian Commission on Safety and Quality in Health Care",
            "estimated_hours": 40,
            "impact": "Prerequisite for Nurse Unit Manager and Clinical Governance directorship.",
        },
    ],
    "finance": [
        {
            "name": "CA ANZ / CPA Australia Full Membership",
            "level": "senior_lead",
            "issuing_body": "Chartered Accountants ANZ / CPA Australia",
            "estimated_hours": 250,
            "impact": "Mandatory industry benchmark for Senior Accountant & Controller roles.",
        },
        {
            "name": "Certified Financial Modeling & Valuation Analyst (FMVA)",
            "level": "entry_mid",
            "issuing_body": "Corporate Finance Institute",
            "estimated_hours": 60,
            "impact": "Demonstrates advanced 3-statement forecasting and M&A modeling.",
        },
        {
            "name": "GAICD (Graduate of the Australian Institute of Company Directors)",
            "level": "staff_principal",
            "issuing_body": "AICD",
            "estimated_hours": 80,
            "impact": "Industry hallmark for CFOs and Board Audit Committee members.",
        },
    ],
    "trades": [
        {
            "name": "CPC40120 Certificate IV in Building and Construction",
            "level": "senior_lead",
            "issuing_body": "TAFE / Australian Registered Training Organisations (RTO)",
            "estimated_hours": 180,
            "impact": "Educational prerequisite for Builder's License and Site Superintendent roles.",
        },
        {
            "name": "BSB41419 Certificate IV in Work Health and Safety (WHS)",
            "level": "senior_lead",
            "issuing_body": "SafeWork Accredited RTO",
            "estimated_hours": 80,
            "impact": "Crucial for Leading Hand, Foreperson, and Site Safety Officer responsibilities.",
        },
        {
            "name": "Electrical Contractor License (AU State Regulator)",
            "level": "staff_principal",
            "issuing_body": "SafeWork / Energy Safe Victoria / Fair Trading",
            "estimated_hours": 60,
            "impact": "Required to sign off electrical compliance and oversee commercial trade teams.",
        },
    ],
    "legal": [
        {
            "name": "Legal Practice Management Course (LPMC)",
            "level": "senior_lead",
            "issuing_body": "Law Society of NSW / Victoria / QLS",
            "estimated_hours": 40,
            "impact": "Mandatory to lift the supervised condition on an AU Practising Certificate.",
        },
        {
            "name": "Certified In-House Counsel (ACC Credential)",
            "level": "senior_lead",
            "issuing_body": "Association of Corporate Counsel Australia",
            "estimated_hours": 50,
            "impact": "Accelerates advancement to Senior Counsel and Deputy General Counsel.",
        },
        {
            "name": "Graduate Diploma of Applied Corporate Governance",
            "level": "staff_principal",
            "issuing_body": "Governance Institute of Australia",
            "estimated_hours": 120,
            "impact": "Standard qualification for ASX Company Secretary and General Counsel.",
        },
    ],
}


def detect_current_seniority_level(title: str, years: int = 0) -> str:
    """Infers current seniority level based on job title keywords and experience."""
    t = (title or "").lower()

    if re.search(r"\b(director|vp|head\s+of|chief|partner|cfo|cto|general\s+manager)\b", t):
        return "executive"
    if re.search(r"\b(staff|principal|superintendent|special\s+counsel|num|consultant)\b", t):
        return "staff_principal"
    if re.search(r"\b(senior|lead|specialist|foreperson|foreman|associate\s+director)\b", t) or years >= 5:
        return "senior_lead"
    return "entry_mid"


def _get_next_seniority_level(current_level: str) -> str:
    try:
        idx = SENIORITY_LEVELS.index(current_level)
        if idx < len(SENIORITY_LEVELS) - 1:
            return SENIORITY_LEVELS[idx + 1]
    except ValueError:
        pass
    return "senior_lead"


def generate_career_roadmap(
    profile: Optional[Dict[str, Any]] = None,
    target_level: Optional[str] = None,
    sector: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a complete strategic career progression roadmap."""
    profile_data = profile or {}
    title = profile_data.get("title") or profile_data.get("headline") or "Professional"
    years = int(profile_data.get("yearsOfExperience") or 3)

    # Resolve sector
    inferred_sector = (
        sector
        or profile_data.get("industry")
        or profile_data.get("sector")
        or "technology"
    ).lower().strip()

    if inferred_sector not in SECTOR_CAREER_TRACKS:
        inferred_sector = "technology"

    sector_track = SECTOR_CAREER_TRACKS[inferred_sector]

    # Resolve current and target levels
    current_level = detect_current_seniority_level(title, years)
    resolved_target_level = target_level or _get_next_seniority_level(current_level)

    # Ensure target level is valid
    if resolved_target_level not in SENIORITY_LEVELS:
        resolved_target_level = "senior_lead"

    current_config = sector_track.get(current_level, sector_track["entry_mid"])
    target_config = sector_track.get(resolved_target_level, sector_track["senior_lead"])

    # Extract existing skills
    existing_skills_raw = profile_data.get("coreSkills") or profile_data.get("skills") or []
    existing_skills = {str(s).lower().strip() for s in existing_skills_raw}

    # Calculate skill gaps
    skill_gaps = []
    for skill in target_config["skills"]:
        s_lower = skill.lower()
        matched = any(s_lower in ex or ex in s_lower for ex in existing_skills)
        if not matched:
            category = "Leadership & Strategy" if any(w in s_lower for w in ["leadership", "strategy", "governance", "stakeholder", "budget", "mentorship"]) else "Technical Mastery"
            skill_gaps.append({
                "skill": skill,
                "category": category,
                "priority": "high",
                "acquisition_path": f"Dedicate structured project execution or specialized micro-credentialing toward {skill}.",
            })

    # If all skills match, provide advanced capability stretch
    if not skill_gaps:
        skill_gaps.append({
            "skill": f"Advanced {target_config['title']} Execution",
            "category": "Strategic Impact",
            "priority": "medium",
            "acquisition_path": "Lead high-visibility cross-functional initiatives demonstrating executive-level business outcomes.",
        })

    # Fetch recommended certifications
    cert_list = AU_CERTIFICATION_REGISTRY.get(inferred_sector, AU_CERTIFICATION_REGISTRY["technology"])
    relevant_certs = [c for c in cert_list if c["level"] == resolved_target_level or c["level"] == "senior_lead"]
    if not relevant_certs:
        relevant_certs = cert_list[:2]

    # 12-Month Execution Milestones
    milestones = [
        {
            "timeframe": "Months 1–3 (Q1)",
            "focus": "Core Capability & Technical Foundation",
            "deliverables": [
                f"Close foundational technical gap: {skill_gaps[0]['skill'] if skill_gaps else 'Core competency hardening'}.",
                "Initiate coursework for target industry certification.",
                "Conduct internal stakeholder discovery to identify acute operational bottlenecks.",
            ],
        },
        {
            "timeframe": "Months 4–6 (Q2)",
            "focus": "Credentialing & Measurable Business Outcomes",
            "deliverables": [
                f"Complete examination/endorsement: {relevant_certs[0]['name'] if relevant_certs else 'Industry credential'}.",
                "Ship high-visibility initiative delivering verified efficiency or revenue impact.",
                "Establish mentorship cadence with junior specialists.",
            ],
        },
        {
            "timeframe": "Months 7–12 (Q3-Q4)",
            "focus": "Strategic Scope & Executive Promotion Positioning",
            "deliverables": [
                f"Transition into target {target_config['title']} responsibilities and governance.",
                "Present multi-quarter operational business case to leadership.",
                "Negotiate formal title adjustment and compensation realignment to target market band.",
            ],
        },
    ]

    # Salary Projections (AUD)
    curr_min, curr_max, curr_med = current_config["salary_range"]
    tgt_min, tgt_max, tgt_med = target_config["salary_range"]
    salary_delta = tgt_med - curr_med
    growth_pct = round((salary_delta / curr_med) * 100.0, 1)

    return {
        "sector": inferred_sector,
        "sector_label": sector_track["sector_label"],
        "current_level": current_level,
        "current_level_label": LEVEL_LABELS.get(current_level, current_level),
        "current_title": title,
        "target_level": resolved_target_level,
        "target_level_label": LEVEL_LABELS.get(resolved_target_level, resolved_target_level),
        "target_title": target_config["title"],
        "skill_gaps": skill_gaps,
        "certifications": relevant_certs,
        "milestones_12m": milestones,
        "salary_projection": {
            "currency": "AUD",
            "current_min": curr_min,
            "current_max": curr_max,
            "current_median": curr_med,
            "target_min": tgt_min,
            "target_max": tgt_max,
            "target_median": tgt_med,
            "projected_lift_aud": salary_delta,
            "projected_growth_pct": growth_pct,
        },
        "adjacent_pivots": sector_track.get("adjacent_pivots", []),
    }
