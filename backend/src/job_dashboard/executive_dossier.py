"""Executive Job & Company Intelligence Dossier Generation Engine.

Synthesizes deep organizational profiles, leadership stakeholder hierarchies,
acute pain points, a structured 'First 90 Days' strategic execution blueprint,
reverse interview questions, and due diligence risk audits across all 5 career tracks.
"""

from __future__ import annotations

import re
from typing import Any


def detect_enterprise_scale(company: str = "", description: str = "") -> str:
    """Classifies an organization's enterprise scale based on company name and description signals."""
    text = f"{company} {description}".lower()

    # Public Sector / Government
    public_terms = [
        "department of",
        "ministry",
        "health service",
        "alfred health",
        "royal melbourne",
        "monash health",
        "municipal",
        "council",
        "statutory",
        "commission",
        "australian taxation office",
        "ato",
        "csiro",
        "vps",
        "aps",
        "government",
        "public health",
        "agency",
        "public sector",
    ]
    for term in public_terms:
        if re.search(r"\b" + re.escape(term) + r"\b", text):
            return "public_sector"

    # ASX 200 / Large Enterprise / Global
    asx_terms = [
        "asx",
        "asx 200",
        "asx 100",
        "fortune 500",
        "commonwealth bank",
        "bhp",
        "telstra",
        "westpac",
        "anz",
        "nab",
        "macquarie",
        "rio tinto",
        "woolworths",
        "wesfarmers",
        "csl",
        "fortescue",
        "atlassian",
        "canva",
        "global resources",
        "multinational",
        "50,000 employees",
        "10,000+ employees",
        "enterprise",
    ]
    for term in asx_terms:
        if re.search(r"\b" + re.escape(term) + r"\b", text):
            return "asx_enterprise"

    # Growth / Start-up
    growth_terms = [
        "startup",
        "start-up",
        "scaleup",
        "scale-up",
        "series a",
        "series b",
        "series c",
        "venture-backed",
        "venture backed",
        "seed",
        "pre-seed",
        "incubator",
        "fast-paced",
        "scaling fast",
    ]
    for term in growth_terms:
        if re.search(r"\b" + re.escape(term) + r"\b", text):
            return "growth_startup"

    # Default to Mid-Market / Commercial Private
    return "mid_market"


def detect_sector_track(role_title: str = "", description: str = "", company: str = "") -> str:
    """Detects primary sector track across Healthcare, Finance, Trades, Legal, Technology, or General."""
    text = f"{role_title} {company} {description}".lower()

    if re.search(
        r"\b(nurse|nursing|ahpra|clinical|health|patient|medical|doctor|hospital|allied health|physio|pharmacy|triage|nsqhs|aged care)\b",
        text,
    ):
        return "healthcare"
    if re.search(
        r"\b(accountant|accounting|cpa|\bca\b|audit|auditing|tax|finance|financial|payroll|ledger|bas|aasb|ifrs|apra|treasury)\b",
        text,
    ):
        return "finance"
    if re.search(
        r"\b(construction|builder|site supervisor|site manager|foreman|carpenter|electrician|plumber|trades|safework|whs|white card|subcontractor|scaffold)\b",
        text,
    ):
        return "trades"
    if re.search(
        r"\b(legal|counsel|solicitor|lawyer|barrister|paralegal|litigation|practising certificate|statutory compliance|m&a|admitted)\b",
        text,
    ):
        return "legal"
    if re.search(
        r"\b(software|cloud|devops|engineer|developer|data|architect|cyber|security|infrastructure|kubernetes|aws|azure|systems|network|frontend|backend)\b",
        text,
    ):
        return "technology"

    return "general"


def generate_executive_dossier(job: dict[str, Any], profile: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generates an exhaustive strategic intelligence dossier for a target role and company."""
    company_name = str(job.get("company") or "Target Organization").strip()
    target_role = str(job.get("title") or "Professional Specialist").strip()
    description = str(job.get("description") or job.get("notes") or "").strip()
    location = str(job.get("location") or "Australia").strip()

    sector = detect_sector_track(target_role, description, company_name)
    enterprise_scale = detect_enterprise_scale(company_name, description)

    candidate_name = profile.get("name") if profile else "Candidate"
    candidate_skills = profile.get("coreSkills", []) if profile else []

    # 1. Organization Profile
    scale_meta = {
        "asx_enterprise": {
            "label": "ASX 200 / Multinational Enterprise",
            "headcount": "5,000+ Employees",
            "governance_style": "Centralized Matrix & Enterprise Risk Committee",
            "pace": "Strategic & High Rigor",
        },
        "public_sector": {
            "label": "Public Sector / Government Statutory Authority",
            "headcount": "1,000–10,000+ Public Servants",
            "governance_style": "State/Federal Public Sector Standards & Ministerial Accountability",
            "pace": "Process-Governed & Transparent",
        },
        "growth_startup": {
            "label": "High-Growth Scaleup / Venture-Backed",
            "headcount": "50–500 Employees",
            "governance_style": "Agile Leadership & Direct Executive Access",
            "pace": "Ultra-Fast & Iterative",
        },
        "mid_market": {
            "label": "Established Mid-Market Corporate",
            "headcount": "200–2,000 Employees",
            "governance_style": "Pragmatic Commercial Oversight & Board Reporting",
            "pace": "Commercially Agile",
        },
    }[enterprise_scale]

    if sector == "healthcare":
        operating_model = "Public Health Network / Acute Inpatient & Tertiary Hospital Care" if enterprise_scale == "public_sector" else "Private Hospital Group / Specialized Clinical Health Network"
        compliance_frameworks = [
            "AHPRA Registration & Mandatory CPD Standards",
            "NSQHS (National Safety and Quality Health Service) Standards",
            "ISBAR Structured Clinical Handover Protocols",
            "Aged Care Quality Standards (if residential care)",
            "Therapeutic Goods Administration (TGA) Compliance",
        ]
        competitors = ["Ramsay Health Care", "St Vincent's Health", "Healthscope", "Mercy Health", "Monash Health"]
        exec_leadership = [
            {"role": "Chief Executive Officer / Hospital Executive Director", "focus": "Clinical excellence, operational throughput, and board governance"},
            {"role": "Director of Clinical Services / Director of Nursing (DON)", "focus": "Staffing ratios, patient safety, and clinical credentialing"},
            {"role": "Unit Manager / Clinical Nurse Consultant", "focus": "Daily ward operations, bed management, and multidisciplinary coordination"},
        ]
        why_funded = f"Funded to elevate patient care delivery, stabilize clinical handover reliability, and uphold strict NSQHS accreditation across {location}."
        challenges = [
            "Patient acuity fluctuations and nurse-to-patient staffing ratio balances.",
            "Minimizing clinical documentation fatigue and handoff error variance.",
            "Navigating strict state health department regulatory scrutiny.",
            "Balancing multidisciplinary team coordination under high bed occupancy.",
        ]
        reverse_q = [
            "What are the primary clinical quality metrics or NSQHS criteria the executive team is targeting for improvement this calendar year?",
            "How does executive leadership actively support ward culture, fatigue management, and clinical mentorship during peak acuity cycles?",
            "What investments are being made in digital health or electronic medical records (EMR) to reduce administrative load?",
            "How does the interdisciplinary clinical governance model handle rapid escalation of complex patient cases?",
            "What would successful clinical performance look like for this role by the conclusion of the initial 90 days?",
        ]
        plan_p1_actions = [
            "Conduct comprehensive clinical workflow audit of inpatient handovers and patient intake processes.",
            "Meet with Nurse Unit Manager, Allied Health leads, and medical consultants to align on clinical expectations.",
            "Audit medication administration records and AHPRA compliance documentation.",
            "Shadow key shift handovers to evaluate ISBAR protocol adherence.",
        ]
        plan_p1_deliverables = ["Baseline Clinical Workflow & Handoff Audit Report", "Stakeholder Priority Map"]
        plan_p2_actions = [
            "Implement standardized documentation checkpoints to eliminate handover ambiguity.",
            "Lead structured clinical coaching sessions on patient deterioration escalation.",
            "Collaborate with quality assurance leads on NSQHS audit readiness.",
        ]
        plan_p2_deliverables = ["Standardized Clinical Handover Checksheet", "Zero-Variance Documentation Trial"]
        plan_p3_actions = [
            "Establish unit-wide continuous quality improvement (CQI) monitoring routines.",
            "Mentor graduate and junior nursing staff to build clinical resilience.",
            "Present patient outcome improvements to the Clinical Governance Committee.",
        ]
        plan_p3_metrics = ["99%+ NSQHS documentation compliance", "Measurable reduction in clinical handover variance"]

    elif sector == "finance":
        operating_model = "Financial Services / Corporate Treasury & Commercial Accounting"
        compliance_frameworks = [
            "AASB / IFRS Statutory Financial Reporting Standards",
            "ATO Corporate Tax Governance & Transfer Pricing",
            "APRA Prudential Standards (CPS 234 / CPS 230 if banking/insurance)",
            "ASIC Corporations Act 2001 Financial Records Compliance",
            "SOX 404 / Internal Control Testing Frameworks",
        ]
        competitors = ["Macquarie Group", "ANZ", "BHP Corporate Finance", "KPMG Enterprise", "PwC Financial Advisory"]
        exec_leadership = [
            {"role": "Chief Financial Officer (CFO)", "focus": "Capital allocation, board fiscal governance, and audit sign-off"},
            {"role": "Head of Finance / Financial Controller", "focus": "Statutory ledger accuracy, ERP integrity, and month-end speed"},
            {"role": "Head of Internal Audit & Tax", "focus": "Tax defense, ATO governance, and risk mitigation"},
        ]
        why_funded = f"Approved to accelerate month-end financial reporting cycles, ensure watertight AASB/IFRS audit compliance, and deliver strategic financial clarity in {location}."
        challenges = [
            "Compressing multi-entity month-end ledger close from 10+ business days down to 4 days.",
            "Resolving ERP data discrepancies across disparate billing and sub-ledger systems.",
            "Navigating tightened ATO and ASIC disclosure and transparency mandates.",
            "Providing reliable forward-looking cash flow and working capital variance modeling.",
        ]
        reverse_q = [
            "What is the single biggest bottleneck in the current month-end financial close and reporting cadence?",
            "How is the finance team balancing commercial decision support with statutory audit rigor?",
            "What ERP or financial systems automation projects are planned or underway for this fiscal year?",
            "How has recent macroeconomic volatility or regulatory shifts impacted capital management priorities?",
            "What quantifiable outcome would make the CFO consider this hire an outstanding success after 90 days?",
        ]
        plan_p1_actions = [
            "Review chart of accounts, sub-ledger reconciliation cadence, and month-end close schedules.",
            "Interview FP&A leads, commercial managers, and external audit partners on recurring friction points.",
            "Audit balance sheet reconciliations and high-risk accrual accounts.",
            "Map transaction flows across ERP and payment gateway integrations.",
        ]
        plan_p1_deliverables = ["Financial Close Friction Diagnostic", "Chart of Accounts Reconciliation Register"]
        plan_p2_actions = [
            "Automate repetitive journal entries and intercompany eliminations.",
            "Redesign the month-end checklist to compress closing schedule by 2 business days.",
            "Standardize balance sheet substantiation packs for external audit review.",
        ]
        plan_p2_deliverables = ["Compressed Month-End Close Playbook", "Standardized Audit Workpaper Pack"]
        plan_p3_actions = [
            "Institutionalize automated variance analysis models comparing actuals vs forecast.",
            "Present fiscal recommendations and internal control hardening to the Audit Committee.",
            "Deliver training to operational leads on financial governance and cost accountability.",
        ]
        plan_p3_metrics = ["Month-end close completed within 4 business days", "100% audit-cleared balance sheet reconciliations"]

    elif sector == "trades":
        operating_model = "Commercial Head Contracting / Tier-1 Civil & Structural Project Delivery"
        compliance_frameworks = [
            "SafeWork Australia WHS Act & Regulations",
            "National Construction Code (NCC) / Building Code of Australia (BCA)",
            "CPCCWHS1001 White Card & High Risk Work Licencing (HRWL)",
            "ISO 9001 (Quality) & ISO 14001 (Environmental) Management",
            "Security of Payment Act (SOPA) Statutory Claims Compliance",
        ]
        competitors = ["Multiplex", "Lendlease", "Probuild", "Built", "Hansen Yuncken", "Mirvac"]
        exec_leadership = [
            {"role": "Managing Director / Construction Director", "focus": "Project margin preservation, safety culture, and program delivery"},
            {"role": "Project Director / Operations Manager", "focus": "Subcontractor procurement, site sequencing, and client relations"},
            {"role": "Site Safety & Quality Manager", "focus": "Zero-harm safety compliance and defect elimination"},
        ]
        why_funded = f"Created to drive on-time site milestone delivery, ensure strict SafeWork WHS zero-harm compliance, and streamline subcontractor trade coordination across {location}."
        challenges = [
            "Preventing critical path program slippage caused by trade sequencing delays.",
            "Enforcing zero-harm WHS compliance across multiple high-risk work subcontractors.",
            "Controlling variation costs and managing long-lead material procurement lead times.",
            "Minimizing defect rectification lists leading up to practical completion (PC).",
        ]
        reverse_q = [
            "What is the current critical path status of the primary project site, and where are the key sequencing risks?",
            "How does company leadership handle safety non-conformance when trade packages fall behind schedule?",
            "What digital site management platforms (e.g. Procore, HammerTech, Aconex) are standard on this project?",
            "How are client and superintendent relationships managed during dispute and variation assessments?",
            "What primary safety and delivery milestone must be accomplished within the first 90 days?",
        ]
        plan_p1_actions = [
            "Execute thorough site walk and SafeWork WHS compliance audit across all active work fronts.",
            "Review master program schedule, critical path dependencies, and trade package contracts.",
            "Meet key subcontractor foremen to assess crew resourcing and material delivery schedules.",
            "Review Safe Work Method Statements (SWMS) and site induction records.",
        ]
        plan_p1_deliverables = ["Site Safety & Program Readiness Audit", "Subcontractor Coordination Matrix"]
        plan_p2_actions = [
            "Establish disciplined daily trade coordination standups and weekly look-ahead meetings.",
            "Implement stringent quality inspection checkpoints prior to trade handovers to eliminate defects.",
            "Tighten site logistics and delivery booking systems to eliminate crane and hoisting bottlenecks.",
        ]
        plan_p2_deliverables = ["Weekly 3-Week Rolling Program Format", "Pre-Cover Quality Verification Checklists"]
        plan_p3_actions = [
            "Lead milestone inspection with principal consultant and superintendent with zero high-risk non-conformances.",
            "Deliver targeted productivity gains on critical path trade sequences.",
            "Document subcontractor performance ratings for future package procurement.",
        ]
        plan_p3_metrics = ["Zero Lost-Time Injuries (LTI)", "100% critical path milestones delivered on schedule"]

    elif sector == "legal":
        operating_model = "Corporate Legal Practice / In-House General Counsel & Commercial Advisory"
        compliance_frameworks = [
            "Legal Profession Uniform Law (Australian Practising Certificate)",
            "Australian Consumer Law (ACL) Competition & Deceptive Conduct",
            "Privacy Act 1988 & Australian Privacy Principles (APPs)",
            "Corporations Act 2001 & Foreign Investment Review Board (FIRB)",
            "Professional Indemnity Insurance & Conflict of Interest Rules",
        ]
        competitors = ["King & Wood Mallesons", "Herbert Smith Freehills", "Allens", "Clayton Utz", "Ashurst", "Gilbert + Tobin"]
        exec_leadership = [
            {"role": "General Counsel / Managing Partner", "focus": "Enterprise legal risk appetite, board advisory, and outside counsel spend"},
            {"role": "Special Counsel / Practice Group Leader", "focus": "Deal velocity, matter management, and negotiation defense"},
            {"role": "Head of Regulatory & Risk", "focus": "Statutory compliance, privacy governance, and litigation exposure"},
        ]
        why_funded = f"Approved to protect commercial deal velocity, remediate contract exposure, and deliver pragmatic regulatory risk mitigation across {location}."
        challenges = [
            "Balancing commercial deal velocity with watertight limitation of liability and indemnity clauses.",
            "Navigating rapidly evolving regulatory reforms across privacy, cybersecurity, and consumer law.",
            "Eliminating contract review bottlenecks that slow revenue generation.",
            "Managing outside counsel spend and establishing automated precedent templates.",
        ]
        reverse_q = [
            "How does the legal function strike the balance between risk mitigation and commercial transaction velocity?",
            "What are the top three regulatory or legislative reforms currently impacting the organization's risk profile?",
            "What contract lifecycle management (CLM) or legal tech tools are utilized to manage workflow volume?",
            "How directly does this role interact with executive business unit leaders and the board?",
            "What would prompt the General Counsel to consider this appointment an exceptional success in the first quarter?",
        ]
        plan_p1_actions = [
            "Conduct comprehensive audit of active commercial contract registers, NDAs, and standard customer agreements.",
            "Interview department heads (sales, procurement, product) to map common legal friction points.",
            "Review standard terms of business, indemnities, liability caps, and insurance requirements.",
            "Audit external law firm panel arrangements and current billing rates.",
        ]
        plan_p1_deliverables = ["Contract Risk & Bottleneck Audit", "Commercial Stakeholder Engagement Blueprint"]
        plan_p2_actions = [
            "Develop an operational Contract Playbook establishing standard fallback negotiation positions.",
            "Institute a self-service NDA and standard agreement mechanism to free up specialized legal capacity.",
            "Provide commercial training to procurement and commercial teams on key legal risk clauses.",
        ]
        plan_p2_deliverables = ["Negotiation Playbook & Clause Library", "Self-Service Contract Workflow Protocol"]
        plan_p3_actions = [
            "Achieve a 30% reduction in average contract turnaround time for standard commercial agreements.",
            "Deliver executive briefing paper on upcoming statutory compliance changes.",
            "Conduct structured annual legal risk review for senior leadership.",
        ]
        plan_p3_metrics = ["30%+ faster contract review turnaround", "Zero unapproved uncapped indemnity exposures"]

    else:
        # Technology / Default
        operating_model = "Cloud Platform Engineering / Enterprise SaaS & Infrastructure Operations"
        compliance_frameworks = [
            "ASD Essential 8 / Essential Eight Cybersecurity Mitigation Strategies",
            "ISO 27001 / ISO/IEC 27001 Information Security Management",
            "SOC 2 Type II Operational Trust Principles",
            "AWS / Azure Well-Architected Framework",
            "ITIL 4 Service Management & Incident Response",
        ]
        competitors = ["Atlassian", "Canva", "Amazon Web Services", "Microsoft Australia", "Google Cloud", "Xero"]
        exec_leadership = [
            {"role": "Chief Technology Officer (CTO) / VP of Engineering", "focus": "Platform vision, system reliability, and engineering throughput"},
            {"role": "Head of Infrastructure / Platform Engineering Director", "focus": "Cloud spend optimization, zero-trust security, and CI/CD velocity"},
            {"role": "Lead Architect / Principal Engineer", "focus": "System decoupling, tech debt reduction, and architecture governance"},
        ]
        why_funded = f"Approved to scale platform infrastructure, eradicate deployment bottlenecks, and bolster ASD Essential 8 security resiliency across {location}."
        challenges = [
            "Managing architectural complexity and reducing legacy technical debt across microservices.",
            "Upholding high-availability 99.99% SLAs while increasing deployment frequency.",
            "Hardening cloud environments against evolving cyber threats without throttling developer speed.",
            "Optimizing cloud infrastructure spend (FinOps) across AWS/Azure compute and storage footprints.",
        ]
        reverse_q = [
            "What is the single biggest architectural challenge or technical debt bottleneck facing the engineering team today?",
            "How does engineering leadership balance feature delivery velocity against platform reliability and security?",
            "What are the target deployment frequency and MTTR (Mean Time to Resolution) goals for this year?",
            "How is the team navigating multi-cloud or hybrid infrastructure governance under ASD Essential 8?",
            "What specific milestone or deliverable would indicate this hire is excelling by the end of the 90-day mark?",
        ]
        plan_p1_actions = [
            "Audit cloud infrastructure architecture, Kubernetes manifests, and CI/CD deployment pipelines.",
            "Meet engineering managers, product leads, and security team to map operational pain points.",
            "Inspect telemetry dashboards, incident logs, and SLA breach reports from the past 6 months.",
            "Review access controls, secret management practices, and ASD Essential 8 maturity levels.",
        ]
        plan_p1_deliverables = ["Platform Architecture & Security Baseline Audit", "Infrastructure Friction Map"]
        plan_p2_actions = [
            "Implement high-impact CI/CD pipeline optimizations to reduce build/deploy cycle latency.",
            "Remediate top 3 security vulnerability clusters in container images and cloud IAM roles.",
            "Standardize infrastructure-as-code (Terraform/Bicep) templates to enforce consistency.",
        ]
        plan_p2_deliverables = ["Optimized Automated Deployment Pipeline", "Zero-Drift IaC Template Repository"]
        plan_p3_actions = [
            "Lead architectural review for upcoming multi-quarter platform scaling initiative.",
            "Roll out automated compliance guardrails preventing unencrypted or misconfigured resources.",
            "Deliver an executive briefing on reliability gains and cloud cost optimization achievements.",
        ]
        plan_p3_metrics = ["99.95%+ platform SLA availability", "Deployment cycle time reduced by 25%+"]

    # Assemble comprehensive 90-day plan
    first_90_days = {
        "days_1_30": {
            "phase": "Days 1–30: Listen, Audit & Align",
            "focus": f"Immerse in {company_name}'s operating model, audit baseline workflows, and establish high-trust stakeholder relationships.",
            "key_actions": plan_p1_actions,
            "deliverables": plan_p1_deliverables,
            "success_metrics": ["100% critical stakeholder interviews completed", "Comprehensive baseline audit published"],
        },
        "days_31_60": {
            "phase": "Days 31–60: Optimize & Deliver Quick Wins",
            "focus": "Address acute friction points, execute measurable high-impact quick wins, and stabilize primary delivery pipelines.",
            "key_actions": plan_p2_actions,
            "deliverables": plan_p2_deliverables,
            "success_metrics": ["First production quick win deployed", "Standardized operational checklist adopted"],
        },
        "days_61_90": {
            "phase": "Days 61–90: Scale, Institutionalize & Measure ROI",
            "focus": "Transition from tactical optimization to strategic scaling, embed permanent quality controls, and present tangible ROI to executive leadership.",
            "key_actions": plan_p3_actions,
            "deliverables": ["Quarterly Strategic Performance Review", "Long-Term Capability Roadmap"],
            "success_metrics": plan_p3_metrics,
        },
    }

    # Diligence & Risk Signals
    diligence_flags = [
        f"Probe historical turnover in this position: determine if {company_name} is replacing an outgoing specialist or creating a net-new capability.",
        f"Inspect budget and headcount stability: clarify whether this team has secured dedicated multi-year capital funding.",
        f"Clarify decision velocity: verify whether technical/operational decisions require prolonged committee consensus.",
        f"Assess process/technical debt: explore how much working time will be allocated to maintenance vs high-value innovation.",
    ]

    return {
        "company_name": company_name,
        "target_role": target_role,
        "sector": sector,
        "enterprise_scale": enterprise_scale,
        "scale_meta": scale_meta,
        "location": location,
        "candidate_context": {
            "name": candidate_name,
            "skills_leveraged": candidate_skills[:5],
        },
        "organization_profile": {
            "operating_model": operating_model,
            "enterprise_scale_label": scale_meta["label"],
            "headcount_bracket": scale_meta["headcount"],
            "compliance_frameworks": compliance_frameworks,
            "competitors": competitors,
            "governance_style": scale_meta["governance_style"],
        },
        "leadership_stakeholders": {
            "key_executives": exec_leadership,
            "reporting_hierarchy": f"Reports into {exec_leadership[1]['role']} with dotted-line escalation to {exec_leadership[0]['role']}.",
            "hiring_manager_mandate": f"Mandate: Deliver measurable stability, accelerate team output, and mitigate compliance risks across {company_name}.",
            "stakeholder_pressures": challenges[0],
        },
        "strategic_pain_points": {
            "why_role_was_funded": why_funded,
            "core_challenges": challenges,
            "strategic_opportunities": [
                f"Establish {company_name} as a benchmark for operational excellence in {sector.capitalize()}.",
                f"Champion modern tooling and automation to minimize manual overhead.",
                f"Foster cross-functional collaboration between delivery teams and executive leadership.",
            ],
        },
        "first_90_days": first_90_days,
        "reverse_interview_questions": reverse_q,
        "risk_and_cultural_audit": {
            "diligence_flags": diligence_flags,
            "debt_risk_assessment": "Moderate: Legacy workflows exist; leadership is actively funding headcount to modernize.",
            "budget_stability": "High: Critical operational function tied directly to organizational delivery.",
        },
    }


def export_dossier_markdown(dossier: dict[str, Any]) -> str:
    """Formats an executive dossier dictionary into a publication-ready markdown briefing report."""
    company = dossier.get("company_name", "Target Organization")
    role = dossier.get("target_role", "Target Role")
    scale_label = dossier.get("scale_meta", {}).get("label", "Enterprise")
    sector = dossier.get("sector", "General").capitalize()
    location = dossier.get("location", "Australia")

    org = dossier.get("organization_profile", {})
    lead = dossier.get("leadership_stakeholders", {})
    pain = dossier.get("strategic_pain_points", {})
    plan = dossier.get("first_90_days", {})
    questions = dossier.get("reverse_interview_questions", [])
    audit = dossier.get("risk_and_cultural_audit", {})

    lines = [
        f"# Executive Briefing Dossier: {company}",
        f"**Target Role**: {role} | **Sector**: {sector} | **Enterprise Scale**: {scale_label}",
        f"**Location**: {location} | **Operating Model**: {org.get('operating_model', 'N/A')}",
        "",
        "---",
        "",
        "## 1. Executive Summary & Organizational Profile",
        f"- **Enterprise Footprint**: {org.get('headcount_bracket', 'Enterprise')}",
        f"- **Governance Style**: {org.get('governance_style', 'Formal Oversight')}",
        f"- **Key Competitors**: {', '.join(org.get('competitors', []))}",
        "",
        "### Regulatory & Compliance Frameworks",
    ]
    for frame in org.get("compliance_frameworks", []):
        lines.append(f"- {frame}")

    lines.extend([
        "",
        "---",
        "",
        "## 2. Strategic Pain Points: Why This Role Was Funded",
        f"> {pain.get('why_role_was_funded', '')}",
        "",
        "### Acute Core Challenges",
    ])
    for ch in pain.get("core_challenges", []):
        lines.append(f"1. {ch}")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Leadership & Stakeholder Alignment",
        f"**Target Reporting Hierarchy**: {lead.get('reporting_hierarchy', '')}",
        "",
        "### Key Executive Decision Makers",
    ])
    for ex in lead.get("key_executives", []):
        lines.append(f"- **{ex.get('role')}**: {ex.get('focus')}")

    lines.extend([
        "",
        "---",
        "",
        "## 4. First 90 Days Strategic Execution Blueprint",
    ])

    for key, title_prefix in [
        ("days_1_30", "Days 1–30: Listen, Audit & Align"),
        ("days_31_60", "Days 31–60: Optimize & Deliver Quick Wins"),
        ("days_61_90", "Days 61–90: Scale, Institutionalize & Measure ROI"),
    ]:
        phase_data = plan.get(key, {})
        lines.extend([
            f"",
            f"### {title_prefix}",
            f"*{phase_data.get('focus', '')}*",
            "",
            "**Key Actions**:",
        ])
        for act in phase_data.get("key_actions", []):
            lines.append(f"- {act}")

        lines.append("")
        lines.append("**Deliverables & Milestones**:")
        for d in phase_data.get("deliverables", []):
            lines.append(f"- [x] {d}")

    lines.extend([
        "",
        "---",
        "",
        "## 5. Executive Reverse Interview Questions",
        "*Ask these high-stakes strategic questions during final-round panel and C-suite interviews:*",
        "",
    ])
    for i, q in enumerate(questions, 1):
        lines.append(f"{i}. \"{q}\"")

    lines.extend([
        "",
        "---",
        "",
        "## 6. Due Diligence & Risk Signals",
    ])
    for flag in audit.get("diligence_flags", []):
        lines.append(f"- ⚠️ {flag}")

    return "\n".join(lines)
