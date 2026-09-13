import json
import pytest
from job_dashboard.ats_simulator import (
    simulate_topological_flattening,
    audit_ats_compliance,
    calculate_star_metric_density,
    audit_regional_compliance_au,
    generate_ats_diagnostic_report,
)


SAMPLE_COMPLIANT_RESUME = """
Jane Doe
Melbourne, VIC | jane.doe@example.com | 0400 123 456 | linkedin.com/in/janedoe

PROFESSIONAL SUMMARY
Senior Cloud & Infrastructure Engineer with 8+ years architecting enterprise AWS and Azure environments. Proven track record managing 600+ virtual machines with 99.99% uptime and delivering $450k annual cloud cost reductions.

SKILLS
Cloud: AWS, Azure, Google Cloud
Infrastructure as Code: Terraform, Ansible, CloudFormation
Containers: Docker, Kubernetes (EKS/AKS)
CI/CD: GitHub Actions, GitLab CI, ArgoCD
Scripting: Python, Bash, PowerShell

WORK EXPERIENCE
Senior Cloud Systems Engineer | TechCorp Australia | 03/2021 - Present
- Architected multi-region AWS transit gateway infrastructure reducing network latency by 38% across 12 branch offices.
- Automated Kubernetes cluster provisioning with Terraform and ArgoCD, slashing deployment cycle times from 4 hours to 18 minutes.
- Led migration of 14 core microservices to Amazon EKS, eliminating single points of failure and maintaining 99.99% service availability.
- Mentored a squad of 6 junior and mid-level DevOps engineers, conducting weekly architecture reviews.

Infrastructure Engineer | Global Logistics Ltd | 06/2018 - 02/2021
- Deployed centralized logging infrastructure using ELK stack processing 45M daily log events.
- Re-architected storage backup policies, reducing secondary cloud storage expenditure by $12,000 monthly.
- Engineered automated disaster recovery runbooks tested to recover database state within 15-minute RPO.

EDUCATION
Bachelor of Computer Science | University of Melbourne | 2014 - 2017

REFEREES
David Smith | Principal Cloud Architect | TechCorp Australia | david.smith@example.com
Sarah Jenkins | Head of Engineering | Global Logistics Ltd | s.jenkins@example.com
"""

SAMPLE_PROBLEMATIC_RESUME = """
John Smith
Curriculum Vitae

MY JOURNEY
I am a results-driven, highly passionate team player with a dynamic track record of being a thought leader in tech.
Passionate self-starter who excels in fast-paced environments.

CORE STRENGTHS
Cloud Platforms | Management | Leadership | Hard Worker

PROJECTS & ACCOMPLISHMENTS
- Worked on various cloud servers and assisted team members when needed.
- Helped with website deployment and fixed bugs.
- Responsible for day-to-day IT support and resolving tickets.
- Attended weekly status meetings and provided helpful updates.

PERSONAL DETAILS
Date of Birth: 14/05/1990
Marital Status: Single
Nationality: Australian
"""


def test_calculate_star_metric_density_compliant():
    result = calculate_star_metric_density(SAMPLE_COMPLIANT_RESUME)
    assert result["total_bullets"] >= 6
    assert result["quantified_bullets"] >= 4
    assert result["density_percentage"] >= 60.0
    assert result["fluff_count"] == 0
    assert len(result["bullets"]) >= 6


def test_calculate_star_metric_density_problematic():
    result = calculate_star_metric_density(SAMPLE_PROBLEMATIC_RESUME)
    assert result["density_percentage"] < 30.0
    assert result["fluff_count"] >= 3
    assert any("results-driven" in f.lower() for f in result["fluff_phrases"])


def test_audit_ats_compliance_workday_and_greenhouse():
    report = audit_ats_compliance(SAMPLE_COMPLIANT_RESUME)
    assert report["overall_score"] >= 85
    assert report["workday"]["status"] == "passed"
    assert report["greenhouse"]["status"] == "passed"
    assert report["taleo"]["status"] == "passed"
    assert report["jobadder"]["status"] == "passed"
    assert report["detected_sections"]["work_experience"] is True
    assert report["detected_sections"]["education"] is True
    assert report["detected_sections"]["skills"] is True


def test_audit_ats_compliance_flags_issues():
    report = audit_ats_compliance(SAMPLE_PROBLEMATIC_RESUME)
    assert report["overall_score"] < 65
    assert report["workday"]["status"] in ("warning", "failed")
    assert any("section" in f.lower() or "journey" in f.lower() for f in report["taxonomy_warnings"])


def test_audit_regional_compliance_au_compliant():
    au_audit = audit_regional_compliance_au(SAMPLE_COMPLIANT_RESUME)
    assert au_audit["has_referees"] is True
    assert au_audit["demographic_risks"] == []
    assert au_audit["compliant"] is True


def test_audit_regional_compliance_au_demographic_risks():
    au_audit = audit_regional_compliance_au(SAMPLE_PROBLEMATIC_RESUME)
    assert au_audit["has_referees"] is False
    assert len(au_audit["demographic_risks"]) >= 2
    assert any("date of birth" in r.lower() or "age" in r.lower() for r in au_audit["demographic_risks"])
    assert any("marital" in r.lower() for r in au_audit["demographic_risks"])


def test_simulate_topological_flattening():
    flattened = simulate_topological_flattening(SAMPLE_COMPLIANT_RESUME)
    assert "Jane Doe" in flattened["candidate_name"]
    assert "jane.doe@example.com" in flattened["contact_info"]["email"]
    assert "0400 123 456" in flattened["contact_info"]["phone"]
    assert "AWS" in flattened["extracted_skills"]
    assert len(flattened["raw_text_stream"]) > 100


def test_generate_ats_diagnostic_report():
    job = {
        "title": "Senior Cloud Engineer",
        "company": "Canva",
        "requirements": "AWS, Kubernetes, Terraform",
        "description": "Looking for a Senior Cloud Engineer to manage multi-region AWS and Kubernetes infrastructure.",
    }
    full_report = generate_ats_diagnostic_report(SAMPLE_COMPLIANT_RESUME, job)
    assert "ats_score" in full_report
    assert "ats_compliance" in full_report
    assert "star_density" in full_report
    assert "regional_au" in full_report
    assert "topological_flattening" in full_report
    assert "target_job" in full_report
    assert "actionable_recommendations" in full_report
    assert full_report["target_job"]["title"] == "Senior Cloud Engineer"


def test_ats_diagnostic_api_endpoint(tmp_path):
    import io
    from unittest.mock import MagicMock
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={"resume_text": SAMPLE_COMPLIANT_RESUME}, sources=[], data_dir=tmp_path)
    handler_cls = make_handler(app)

    # 1. Test GET endpoint
    handler = handler_cls.__new__(handler_cls)
    handler.path = "/api/ats-diagnostic"
    handler.headers = {}
    handler.rfile = io.BytesIO()
    handler.wfile = io.BytesIO()
    handler.client_address = ("127.0.0.1", 12345)
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()

    handler.do_GET()
    payload = json.loads(handler.wfile.getvalue().decode("utf-8"))
    assert payload["success"] is True
    assert "diagnostic" in payload
    assert payload["diagnostic"]["ats_score"] >= 80

    # 2. Test POST endpoint with custom resume
    post_body = json.dumps({"resume_text": SAMPLE_PROBLEMATIC_RESUME, "job": {"title": "Junior Support"}}).encode("utf-8")
    handler2 = handler_cls.__new__(handler_cls)
    handler2.path = "/api/ats-diagnostic"
    handler2.headers = {"Content-Length": str(len(post_body))}
    handler2.rfile = io.BytesIO(post_body)
    handler2.wfile = io.BytesIO()
    handler2.client_address = ("127.0.0.1", 12345)
    handler2.send_response = MagicMock()
    handler2.send_header = MagicMock()
    handler2.end_headers = MagicMock()

    handler2.do_POST()
    payload2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
    assert payload2["success"] is True
    assert payload2["diagnostic"]["ats_score"] < 65
