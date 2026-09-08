import pytest
from datetime import datetime, timezone
from job_dashboard.interview_influence import (
    InterviewDebrief,
    generate_objection_resolution_memo,
    generate_referee_alignment_pack,
    evaluate_influence_health,
    INTERVIEW_STAGES,
    PANEL_SENTIMENTS,
)

def test_interview_debrief_model_validation():
    debrief = InterviewDebrief(
        job_id="job-melb-101",
        stage="Technical & Architecture",
        interview_date="2026-09-08",
        panel_names="David Vance (Head of Infrastructure), Sarah Jenkins (Lead Cloud Architect)",
        panel_sentiment="Leaning Positive",
        topics_covered=["M365 Tenant Migration", "Zero Trust Identity", "Disaster Recovery RTO"],
        perceived_objections=["Concerned candidate might find mid-level scope too routine", "Wanted deeper enterprise multi-region Entra ID governance"],
        promised_decision_date="2026-09-12",
        notes="Strong technical rapport. Panel was deeply engaged during incident triage case study."
    )
    assert debrief.job_id == "job-melb-101"
    assert debrief.stage in INTERVIEW_STAGES
    assert debrief.panel_sentiment in PANEL_SENTIMENTS
    assert len(debrief.topics_covered) == 3
    assert len(debrief.perceived_objections) == 2


def test_evaluate_influence_health():
    strong_debrief = InterviewDebrief(
        job_id="job-1",
        stage="Stakeholder Interview",
        interview_date="2026-09-07",
        panel_names="Amanda Cruz",
        panel_sentiment="Strong Positive",
        topics_covered=["Team leadership"],
        perceived_objections=[],
        promised_decision_date="2026-09-10"
    )
    health_strong = evaluate_influence_health(strong_debrief)
    assert health_strong["score"] >= 80
    assert health_strong["status"] == "High Conviction"
    assert health_strong["recommended_action"] == "Send brief value-add reinforcement memo"

    friction_debrief = InterviewDebrief(
        job_id="job-2",
        stage="Technical & Architecture",
        interview_date="2026-09-07",
        panel_names="Michael Brown",
        panel_sentiment="High Friction",
        topics_covered=["System scaling"],
        perceived_objections=["Worried about Kubernetes production downtime experience", "Uncertain on Australian regulatory compliance knowledge"],
        promised_decision_date="2026-09-09"
    )
    health_friction = evaluate_influence_health(friction_debrief)
    assert health_friction["score"] < 60
    assert health_friction["status"] == "Objection Overcoming Required"
    assert len(health_friction["action_items"]) >= 2


def test_generate_objection_resolution_memo_technology():
    job = {
        "title": "Systems Engineer",
        "company": "NextGen Platforms",
        "location": "Melbourne, VIC"
    }
    profile = {
        "name": "Samuel Ludwig",
        "title": "Mid-Level IT Infrastructure & Systems Engineer",
        "email": "samuel@ludwig.com"
    }
    debrief = InterviewDebrief(
        job_id="job-101",
        stage="Technical & Architecture",
        interview_date="2026-09-08",
        panel_names="David Vance, Sarah Jenkins",
        panel_sentiment="Leaning Positive",
        topics_covered=["Cloud endpoint management", "Intune compliance"],
        perceived_objections=["Wanted more detail on handling complex PowerShell automated rollback routines."],
        promised_decision_date="2026-09-12",
        notes="Discussed Windows 11 migrations."
    )
    memo = generate_objection_resolution_memo(job, debrief, profile)
    assert memo["subject"].startswith("RE: Technical Debrief & Value Add")
    assert "NextGen Platforms" in memo["body"]
    assert "PowerShell" in memo["body"]
    assert "Samuel Ludwig" in memo["body"]
    # Check that it doesn't open with generic cliches
    assert not memo["body"].strip().startswith("I am writing to thank you")


def test_generate_referee_alignment_pack():
    job = {
        "title": "Senior Clinical Specialist",
        "company": "St Vincent Health",
        "location": "Melbourne, VIC"
    }
    profile = {
        "name": "Samuel Ludwig",
        "title": "Clinical Systems Specialist",
        "email": "sam@health.com"
    }
    debrief = InterviewDebrief(
        job_id="job-health-202",
        stage="Panel Interview",
        interview_date="2026-09-08",
        panel_names="Dr. Patricia Wong (Director of Nursing)",
        panel_sentiment="Strong Positive",
        topics_covered=["NSQHS Clinical Governance", "Inpatient Handover Protocols"],
        perceived_objections=["Wanted verification of crisis escalation leadership during night shifts."],
        promised_decision_date="2026-09-14"
    )
    pack = generate_referee_alignment_pack(
        job=job,
        debrief=debrief,
        referee_name="Marcus Vance",
        referee_title="Clinical Operations Lead",
        referee_relationship="Former Line Manager at Mercy Health",
        profile=profile
    )

    assert "Marcus Vance" in pack["briefing_document"]
    assert "St Vincent Health" in pack["briefing_document"]
    assert "NSQHS" in pack["briefing_document"]
    assert len(pack["targeted_star_talking_points"]) >= 2
    assert "crisis escalation" in pack["briefing_document"].lower() or "crisis" in str(pack["targeted_star_talking_points"]).lower()
