"""Unit tests for Phase 23 Screening Questionnaire Solver Engine."""

from __future__ import annotations

import pytest
from job_dashboard.screening_solver import (
    extract_screening_questions_from_jd,
    generate_screening_report,
    solve_screening_question,
)


@pytest.fixture
def mock_candidate_profile():
    return {
        "name": "Alex Taylor",
        "title": "Senior Systems Engineer",
        "workRights": "Australian Citizen (Unrestricted Full Working Rights)",
        "clearance": "Baseline / NV1 Eligible",
        "yearsOfExperience": 8,
        "location": "Melbourne, VIC",
        "availability": "Immediate / <2 Weeks Notice",
        "targetSalary": "$130,000 + Super",
        "coreSkills": ["Python", "Kubernetes", "AWS", "Terraform", "Docker"],
    }


@pytest.fixture
def mock_job():
    return {
        "id": "job_tech_001",
        "title": "Lead Cloud Infrastructure Engineer",
        "company": "Canva",
        "location": "Melbourne, VIC",
        "salary": "$140,000 - $160,000 + Equity",
        "description": (
            "Must have valid Australian working rights.\n"
            "Do you hold a current Australian National Police Check?\n"
            "Experience with Kubernetes and Terraform is essential.\n"
            "Tell us about a time you handled a severe production outage under pressure."
        ),
    }


def test_solve_work_rights_dealbreaker(mock_candidate_profile, mock_job):
    q = "Are you legally entitled to work in Australia without visa sponsorship?"
    sol = solve_screening_question(q, mock_candidate_profile, mock_job)
    assert sol.category == "Mandatory Legal & Work Rights"
    assert sol.risk_level == "Critical Dealbreaker"
    assert "Australian Citizen" in sol.answer
    assert sol.suggested_dropdown != ""


def test_solve_statutory_clearances(mock_candidate_profile, mock_job):
    # Police check
    sol_police = solve_screening_question("Do you hold a current National Police Check?", mock_candidate_profile, mock_job)
    assert sol_police.risk_level == "Critical Dealbreaker"
    assert "Police Check" in sol_police.answer

    # Working With Children Check
    sol_wwcc = solve_screening_question("Do you have a valid Working With Children Check (WWCC)?", mock_candidate_profile, mock_job)
    assert sol_wwcc.risk_level == "Critical Dealbreaker"
    assert "Working With Children Check" in sol_wwcc.answer

    # NDIS Screening
    sol_ndis = solve_screening_question("Are you cleared under the NDIS Worker Screening database?", mock_candidate_profile, mock_job)
    assert sol_ndis.risk_level == "Critical Dealbreaker"
    assert "NDIS" in sol_ndis.answer

    # Construction White Card
    sol_white = solve_screening_question("Must hold a valid General Construction Induction White Card", mock_candidate_profile, mock_job)
    assert sol_white.risk_level == "Critical Dealbreaker"
    assert "White Card" in sol_white.answer


def test_solve_years_of_experience(mock_candidate_profile, mock_job):
    q = "How many years of experience do you have in cloud infrastructure?"
    sol = solve_screening_question(q, mock_candidate_profile, mock_job)
    assert sol.category == "Technical Stack Competency"
    assert "8+ years" in sol.answer
    assert "8+ Years" in sol.suggested_dropdown


def test_solve_core_skill_match(mock_candidate_profile, mock_job):
    q = "Do you have commercial production experience with Kubernetes and Python?"
    sol = solve_screening_question(q, mock_candidate_profile, mock_job)
    assert sol.category == "Technical Stack Competency"
    assert "Kubernetes" in sol.answer or "Python" in sol.answer
    assert "commercial production experience" in sol.answer


def test_solve_star_behavioral_question(mock_candidate_profile, mock_job):
    q = "Describe a time when you faced high pressure and conflicting stakeholder priorities."
    sol = solve_screening_question(q, mock_candidate_profile, mock_job)
    assert sol.category == "STAR Behavioral & Situational"
    assert "Situation:" in sol.answer
    assert "Task:" in sol.answer
    assert "Action:" in sol.answer
    assert "Result:" in sol.answer


def test_solve_commercial_and_salary(mock_candidate_profile, mock_job):
    q = "What are your salary expectations for this position?"
    sol = solve_screening_question(q, mock_candidate_profile, mock_job)
    assert sol.category == "Commercial & Logistical Parameters"
    assert sol.risk_level == "Low Friction"
    assert "$140,000" in sol.answer or "$130,000" in sol.answer


def test_extract_screening_questions_from_jd(mock_job):
    questions = extract_screening_questions_from_jd(mock_job["description"], mock_job["title"])
    assert len(questions) >= 3
    assert any("police" in q.lower() for q in questions)


def test_generate_screening_report(mock_candidate_profile, mock_job):
    report = generate_screening_report(mock_job, mock_candidate_profile)
    assert report.compliance_score == 100
    assert report.dealbreaker_count >= 1
    assert len(report.solutions) > 0
    assert len(report.key_dealbreakers) > 0
    assert "100% compliant" in report.advice_summary


def test_custom_questions_solver(mock_candidate_profile, mock_job):
    custom = [
        "Do you require any visa sponsorship now or in the future?",
        "Are you willing to attend the Melbourne CBD office twice a week?",
    ]
    report = generate_screening_report(mock_job, mock_candidate_profile, custom_questions=custom)
    assert len(report.solutions) == 2
    assert report.solutions[0]["category"] == "Mandatory Legal & Work Rights"
    assert "Melbourne" in report.solutions[1]["answer"]


def test_screening_api_endpoints(tmp_path, mock_candidate_profile, mock_job):
    import io
    import json
    from unittest.mock import MagicMock
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(
        profile=mock_candidate_profile,
        sources=[],
        data_dir=tmp_path,
    )
    app.repository.replace_jobs([mock_job])
    handler_cls = make_handler(app)

    # 1. Test POST /api/screening/solve
    payload = {
        "job": mock_job,
        "profile": mock_candidate_profile,
        "questions": ["Are you an Australian Citizen with full working rights?"],
    }
    body = json.dumps(payload).encode("utf-8")
    handler1 = handler_cls.__new__(handler_cls)
    handler1.path = "/api/screening/solve"
    handler1.headers = {"Content-Length": str(len(body))}
    handler1.rfile = io.BytesIO(body)
    handler1.wfile = io.BytesIO()
    handler1.client_address = ("127.0.0.1", 12345)
    handler1.requestline = "POST /api/screening/solve HTTP/1.1"
    handler1.request_version = "HTTP/1.1"
    handler1.command = "POST"
    handler1.send_response = MagicMock()
    handler1.send_header = MagicMock()
    handler1.end_headers = MagicMock()

    handler1.do_POST()
    res1 = json.loads(handler1.wfile.getvalue().decode("utf-8"))
    assert res1["success"] is True
    assert "report" in res1
    assert res1["report"]["compliance_score"] == 100
    assert len(res1["report"]["solutions"]) == 1

    # 2. Test GET /api/jobs/{id}/screening-solutions
    handler2 = handler_cls.__new__(handler_cls)
    handler2.path = f"/api/jobs/{mock_job['id']}/screening-solutions"
    handler2.headers = {}
    handler2.rfile = io.BytesIO()
    handler2.wfile = io.BytesIO()
    handler2.client_address = ("127.0.0.1", 12345)
    handler2.requestline = f"GET /api/jobs/{mock_job['id']}/screening-solutions HTTP/1.1"
    handler2.request_version = "HTTP/1.1"
    handler2.command = "GET"
    handler2.send_response = MagicMock()
    handler2.send_header = MagicMock()
    handler2.end_headers = MagicMock()

    handler2.do_GET()
    res2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
    assert res2["success"] is True
    assert "report" in res2
    assert len(res2["report"]["solutions"]) >= 3

