import pytest
from job_dashboard.executive_dossier import (
    detect_enterprise_scale,
    generate_executive_dossier,
    export_dossier_markdown,
)


def test_detect_enterprise_scale():
    # ASX 200 / Large Enterprise
    assert detect_enterprise_scale("Commonwealth Bank", "Enterprise financial institution with 50,000 employees ASX") == "asx_enterprise"
    assert detect_enterprise_scale("BHP Minerals", "Global resources corporation listed on the ASX 200") == "asx_enterprise"
    assert detect_enterprise_scale("Telstra", "National telecommunications carrier") == "asx_enterprise"

    # Public Sector / Government
    assert detect_enterprise_scale("Department of Health Victoria", "Public health service agency VPS enterprise") == "public_sector"
    assert detect_enterprise_scale("Australian Taxation Office", "APS government statutory authority") == "public_sector"
    assert detect_enterprise_scale("City of Melbourne", "Local government municipal council") == "public_sector"

    # Growth / Start-up
    assert detect_enterprise_scale("HyperScale AI", "Series B high-growth venture-backed startup fast-paced environment") == "growth_startup"
    assert detect_enterprise_scale("SeedTech Labs", "Early-stage pre-seed incubator team scaling fast") == "growth_startup"

    # Mid-Market / Private Corporate
    assert detect_enterprise_scale("Nexus Consulting Group", "Established private commercial advisory firm") == "mid_market"


def test_generate_executive_dossier_technology():
    job = {
        "id": "tech_lead_01",
        "title": "Lead Cloud Infrastructure Engineer",
        "company": "Atlassian",
        "description": "Lead multi-cloud AWS and Kubernetes infrastructure, ASD Essential 8 hardening, and reduce deployment latency.",
        "location": "Sydney, NSW",
    }
    profile = {
        "name": "Alex Mercer",
        "title": "Senior Cloud Infrastructure Architect",
        "industry": "Technology",
        "coreSkills": ["AWS", "Kubernetes", "Terraform", "CI/CD", "Essential 8"],
    }

    dossier = generate_executive_dossier(job, profile)

    assert dossier["sector"] == "technology"
    assert dossier["enterprise_scale"] == "asx_enterprise"
    assert dossier["company_name"] == "Atlassian"
    assert dossier["target_role"] == "Lead Cloud Infrastructure Engineer"

    # Org Profile
    org = dossier["organization_profile"]
    assert "SaaS" in org["operating_model"] or "Cloud" in org["operating_model"] or "Software" in org["operating_model"]
    assert any("Essential 8" in f or "ISO 27001" in f for f in org["compliance_frameworks"])

    # Pain points
    pain = dossier["strategic_pain_points"]
    assert len(pain["why_role_was_funded"]) > 20
    assert len(pain["core_challenges"]) >= 3

    # Leadership & Stakeholders
    lead = dossier["leadership_stakeholders"]
    assert len(lead["key_executives"]) >= 2
    assert "CTO" in lead["key_executives"][0]["role"] or "Engineering" in lead["key_executives"][0]["role"] or "Technology" in lead["key_executives"][0]["role"]

    # 90-day Blueprint
    plan = dossier["first_90_days"]
    assert "days_1_30" in plan
    assert "days_31_60" in plan
    assert "days_61_90" in plan
    assert len(plan["days_1_30"]["key_actions"]) >= 3
    assert len(plan["days_31_60"]["deliverables"]) >= 2
    assert len(plan["days_61_90"]["success_metrics"]) >= 2

    # Reverse questions & diligence
    assert len(dossier["reverse_interview_questions"]) >= 4
    assert len(dossier["risk_and_cultural_audit"]["diligence_flags"]) >= 2


def test_generate_executive_dossier_healthcare():
    job = {
        "id": "health_nurse_02",
        "title": "Clinical Nurse Specialist / Care Coordinator",
        "company": "Alfred Health",
        "description": "Oversee inpatient surgical ward, AHPRA standards, NSQHS clinical governance, patient acuity, and ISBAR clinical handovers.",
        "location": "Melbourne, VIC",
    }
    dossier = generate_executive_dossier(job)

    assert dossier["sector"] == "healthcare"
    assert dossier["enterprise_scale"] == "public_sector"
    org = dossier["organization_profile"]
    assert any("AHPRA" in f or "NSQHS" in f for f in org["compliance_frameworks"])
    assert "Hospital" in org["operating_model"] or "Public Health" in org["operating_model"] or "Clinical" in org["operating_model"]

    # Reverse questions must be clinical/health grounded
    questions = dossier["reverse_interview_questions"]
    assert any("clinical" in q.lower() or "patient" in q.lower() or "accreditation" in q.lower() or "governance" in q.lower() for q in questions)


def test_generate_executive_dossier_finance():
    job = {
        "id": "fin_manager_03",
        "title": "Senior Financial Controller",
        "company": "Macquarie Group",
        "description": "Direct month-end statutory reporting, AASB / IFRS standards, APRA compliance, and ERP transformation.",
        "location": "Sydney, NSW",
    }
    dossier = generate_executive_dossier(job)

    assert dossier["sector"] == "finance"
    org = dossier["organization_profile"]
    assert any("AASB" in f or "APRA" in f or "ATO" in f for f in org["compliance_frameworks"])

    plan = dossier["first_90_days"]
    # Month-end or audit deliverables in finance 90-day plan
    actions_p2 = " ".join(plan["days_31_60"]["key_actions"]).lower()
    assert "month-end" in actions_p2 or "reporting" in actions_p2 or "reconciliation" in actions_p2 or "ledger" in actions_p2


def test_generate_executive_dossier_trades_and_legal():
    # Trades
    trade_job = {
        "id": "trade_04",
        "title": "Senior Construction Project Manager",
        "company": "Multiplex Constructions",
        "description": "Lead commercial tier 1 site delivery, subcontractor coordination, SafeWork WHS compliance, and master program scheduling.",
    }
    trade_dossier = generate_executive_dossier(trade_job)
    assert trade_dossier["sector"] == "trades"
    assert any("SafeWork" in f or "WHS" in f or "NCC" in f for f in trade_dossier["organization_profile"]["compliance_frameworks"])

    # Legal
    legal_job = {
        "id": "legal_05",
        "title": "Corporate Legal Counsel",
        "company": "King & Wood Mallesons",
        "description": "Manage cross-border M&A, Australian Practising Certificate, ACL consumer law, and commercial litigation risk.",
    }
    legal_dossier = generate_executive_dossier(legal_job)
    assert legal_dossier["sector"] == "legal"
    assert any("Practising Certificate" in f or "Uniform Law" in f or "ACL" in f for f in legal_dossier["organization_profile"]["compliance_frameworks"])


def test_export_dossier_markdown():
    job = {
        "title": "Director of Engineering",
        "company": "Canva",
        "description": "Direct platform scaling and reliability for global creative suite.",
    }
    dossier = generate_executive_dossier(job)
    markdown = export_dossier_markdown(dossier)

    assert "# Executive Briefing Dossier: Canva" in markdown
    assert "Director of Engineering" in markdown
    assert "Strategic Pain Points" in markdown
    assert "First 90 Days Strategic Execution Blueprint" in markdown
    assert "Days 1–30" in markdown
    assert "Days 31–60" in markdown
    assert "Days 61–90" in markdown
    assert "Executive Reverse Interview Questions" in markdown

