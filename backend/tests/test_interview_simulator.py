"""
Unit tests for the multi-industry interview simulator and rubric scoring engine.
"""
from __future__ import annotations

import pytest
from job_dashboard.interview_simulator import get_interview_simulator


@pytest.fixture
def simulator():
    sim = get_interview_simulator()
    sim.reset_data()
    return sim


def test_create_session_healthcare(simulator):
    session = simulator.create_session(
        job_description="Acute care registered nurse position in emergency department requiring AHPRA registration and clinical triage experience.",
        role="Registered Nurse (Emergency Ward)",
        question_count=5,
    )
    assert session["stream"] == "healthcare"
    assert session["total_questions"] == 5
    questions = session["questions"]
    assert any("ISBAR" in q["text"] or "vital signs" in q["text"] or "AHPRA" in q["text"] for q in questions)


def test_create_session_finance(simulator):
    session = simulator.create_session(
        job_description="Senior financial accountant responsible for month-end close, balance sheet reconciliations, and AASB statutory reporting in SAP.",
        role="Senior Financial Accountant CPA",
        question_count=4,
    )
    assert session["stream"] == "finance"
    assert session["total_questions"] == 4
    questions = session["questions"]
    assert any("AASB" in q["text"] or "variance" in q["text"] or "ledger" in q["text"] for q in questions)


def test_create_session_trades(simulator):
    session = simulator.create_session(
        job_description="Site supervisor for commercial building projects. Must hold White Card and enforce SafeWork WHS and SWMS compliance.",
        role="Site Supervisor - Construction",
        question_count=5,
    )
    assert session["stream"] == "trades"
    assert session["total_questions"] == 5
    questions = session["questions"]
    assert any("SWMS" in q["text"] or "safety hazard" in q["text"] or "subcontractor" in q["text"] for q in questions)


def test_create_session_legal(simulator):
    session = simulator.create_session(
        job_description="In-house corporate legal counsel advising on Australian Consumer Law, commercial indemnities, and dispute settlements.",
        role="Corporate Legal Counsel",
        question_count=5,
    )
    assert session["stream"] == "legal"
    assert session["total_questions"] == 5
    questions = session["questions"]
    assert any("indemnities" in q["text"] or "ACL" in q["text"] or "dispute" in q["text"] for q in questions)


def test_create_session_technology(simulator):
    session = simulator.create_session(
        job_description="Senior cloud engineer managing Azure hybrid infrastructure, PowerShell automation, and ACSC Essential 8 compliance.",
        role="Senior Cloud Infrastructure Engineer",
        question_count=5,
    )
    assert session["stream"] == "technology"
    assert session["total_questions"] == 5
    questions = session["questions"]
    assert any("outage" in q["text"] or "cloud" in q["text"] or "Essential 8" in q["text"] for q in questions)


def test_interview_submission_and_feedback(simulator):
    session = simulator.create_session(
        job_description="Registered nurse for clinical triage and inpatient ward.",
        role="Registered Nurse",
        question_count=2,
    )
    session_id = session["session_id"]
    q1_id = session["questions"][0]["id"]
    q2_id = session["questions"][1]["id"]

    # Submit first answer
    res1 = simulator.submit_answer(
        session_id=session_id,
        question_id=q1_id,
        answer=(
            "When managing a post-operative patient whose blood pressure dropped rapidly, I initiated an immediate MET call "
            "and utilized ISBAR communication to brief the attending registrar. I administered IV fluid resuscitation per AHPRA "
            "protocol, successfully stabilizing vital signs within 12 minutes with zero complications."
        ),
    )
    assert res1["success"] is True
    assert res1["all_answered"] is False

    # Submit second answer
    res2 = simulator.submit_answer(
        session_id=session_id,
        question_id=q2_id,
        answer=(
            "In every high-risk medication administration, I strictly perform independent two-nurse double checks for 5 rights "
            "verification per NSQHS clinical governance standards. This rigor eliminated 100% of potential dispensing errors across 450+ patient admissions."
        ),
    )
    assert res2["success"] is True
    assert res2["all_answered"] is True

    # Retrieve feedback
    feedback = simulator.get_feedback(session_id)
    assert feedback["score"] >= 80
    assert "HEALTHCARE FOCUS" in feedback["feedback"]
    assert "Key Strengths" in feedback["feedback"]

    # Analyze performance
    perf = simulator.analyze_performance(session_id)
    assert perf["performance_level"] in ("Good", "Excellent")
    assert perf["stream"] == "healthcare"
