"""Unit tests for the Australian SEEK Pass & Verified Credentials Pre-Qualification Auditor."""

import json
from unittest.mock import MagicMock
from job_dashboard.seek_pass_auditor import (
    extract_seek_pass_requirements,
    audit_candidate_credentials,
    calculate_readiness_score,
    generate_seek_pass_responses,
    generate_seek_pass_report,
)


def test_extract_seek_pass_requirements_all_domains():
    jd_text = """
    Requirements:
    - Must be an Australian Citizen with unrestricted full working rights.
    - Candidate must hold or be eligible to obtain an Australian Government Security Clearance (Baseline or NV1).
    - Current National Police Check (issued within last 6 months) is mandatory.
    - Working with Children Check (WWCC) required prior to commencing.
    - NDIS Worker Screening Check clearance required.
    - Valid Australian Driver's Licence (Class C) and SafeWork Construction White Card.
    - AHPRA registration as a Registered Nurse or Medical Practitioner.
    - CPA or CA ANZ professional accreditation desired.
    """
    reqs = extract_seek_pass_requirements(jd_text, "Senior Healthcare Systems Administrator")
    domains = {r["domain"] for r in reqs}
    
    assert "right_to_work" in domains
    assert "security_clearance" in domains
    assert "criminal_history" in domains
    assert "working_with_children" in domains
    assert "ndis_worker" in domains
    assert "occupational_licences" in domains
    assert "healthcare_ahpra" in domains
    assert "finance_professional" in domains


def test_audit_candidate_credentials_verified_and_knockout():
    reqs = [
        {
            "id": "rtw_01",
            "domain": "right_to_work",
            "name": "Australian Citizenship / Permanent Residency",
            "mandatory": True,
            "keywords": ["australian citizen", "pr", "permanent resident", "working rights"],
        },
        {
            "id": "sec_01",
            "domain": "security_clearance",
            "name": "NV1 Security Clearance",
            "mandatory": True,
            "keywords": ["nv1", "negative vetting 1"],
        },
        {
            "id": "pol_01",
            "domain": "criminal_history",
            "name": "National Police Check",
            "mandatory": False,
            "keywords": ["police check", "criminal history", "afac"],
        },
    ]

    profile = {
        "name": "Sam Ludwig",
        "work_rights": "Australian Citizen",
        "credentials": ["National Police Certificate (2025)", "Driver Licence Class C"],
        "clearances": [],  # Missing NV1
    }

    audited = audit_candidate_credentials(reqs, profile)
    status_map = {item["id"]: item["status"] for item in audited}

    assert status_map["rtw_01"] == "VERIFIED"
    assert status_map["sec_01"] == "KNOCKOUT_RISK"
    assert status_map["pol_01"] == "VERIFIED"


def test_calculate_readiness_score_empty_requirements_exempt():
    audited = []
    result = calculate_readiness_score(audited)
    assert result["readiness_score"] == 100
    assert result["risk_level"] == "EXEMPT"
    assert result["knockout_count"] == 0


def test_calculate_readiness_score_with_knockout_risk():
    audited = [
        {
            "id": "rtw_01",
            "mandatory": True,
            "status": "VERIFIED",
        },
        {
            "id": "sec_01",
            "mandatory": True,
            "status": "KNOCKOUT_RISK",
        },
        {
            "id": "lic_01",
            "mandatory": False,
            "status": "ACTION_REQUIRED",
        },
    ]
    result = calculate_readiness_score(audited)
    assert result["readiness_score"] < 60
    assert result["risk_level"] == "HIGH_RISK_KNOCKOUT"
    assert result["knockout_count"] == 1
    assert result["action_count"] == 1
    assert result["verified_count"] == 1


def test_generate_seek_pass_responses():
    audited = [
        {
            "id": "rtw_01",
            "domain": "right_to_work",
            "name": "Australian Citizenship / Working Rights",
            "status": "VERIFIED",
        },
        {
            "id": "pol_01",
            "domain": "criminal_history",
            "name": "National Police Check",
            "status": "ACTION_REQUIRED",
        },
    ]
    profile = {"name": "Sam Ludwig", "work_rights": "Australian Citizen"}
    responses = generate_seek_pass_responses(audited, profile)
    
    assert len(responses) >= 2
    assert any("unrestricted" in r["response"].lower() or "citizen" in r["response"].lower() for r in responses)


def test_generate_seek_pass_report_structure():
    job = {
        "id": "job_123",
        "title": "Cloud Infrastructure Engineer",
        "company": "KBR",
        "description": "Must be an Australian Citizen eligible for Baseline clearance. Police check required.",
    }
    profile = {
        "name": "Sam Ludwig",
        "work_rights": "Australian Citizen",
        "credentials": ["National Police Certificate (Verified 2025)"],
        "clearances": ["Baseline Clearance (AGSVA)"],
    }

    report = generate_seek_pass_report(job, profile)
    
    assert report["job_id"] == "job_123"
    assert report["readiness_score"] == 100
    assert report["risk_level"] in ("PASS_READY", "LOW_RISK")
    assert "dossier_markdown" in report
    assert "KBR" in report["dossier_markdown"]
    assert len(report["audited_requirements"]) >= 2


def test_seek_pass_api_endpoints():
    from job_dashboard.web import make_handler

    mock_repo = MagicMock()
    mock_repo.get_job_by_id.return_value = {
        "id": "job_test_99",
        "title": "Systems Administrator",
        "company": "Victorian Department of Health",
        "description": "Australian Citizen required. Working with Children Check mandatory.",
    }
    mock_repo.get_profile.return_value = {
        "name": "Sam Ludwig",
        "work_rights": "Australian Citizen",
        "credentials": ["WWCC Victoria Employee Check"],
    }

    handler_cls = make_handler(mock_repo)
    handler = handler_cls.__new__(handler_cls)
    handler.repository = mock_repo
    handler.wfile = MagicMock()

    # Verify GET /api/jobs/{id}/seek-pass logic
    report = handler._get_job_seek_pass_report("job_test_99")
    assert report is not None
    assert report["job_id"] == "job_test_99"
    assert report["readiness_score"] == 100

