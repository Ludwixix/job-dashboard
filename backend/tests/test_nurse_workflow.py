"""
test_nurse_workflow.py
End-to-end integration test verifying new user onboarding workflow as a Registered Nurse:
1. User registration with email/password
2. Creation and dual-sink persistence of a Registered Nurse profile (Healthcare & Medical)
3. Search query synchronization for nursing roles
4. Job matching, scoring, and opportunity triage for clinical vs non-clinical jobs
5. Session restoration across reloads
"""

import io
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock

from job_dashboard.repository import JobRepository
from job_dashboard.web import make_handler, DashboardApp
from job_dashboard.models import Job
from job_dashboard.score import score_job


@pytest.fixture
def nurse_app_environment(tmp_path):
    repo = JobRepository(str(tmp_path / "jobs.sqlite3"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo

    # Initialize tables
    with repo.get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                email_verified INTEGER DEFAULT 0,
                email_verification_code TEXT,
                email_verification_expires_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                profile_data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()

    handler_cls = make_handler(app)
    return app, handler_cls, repo


def create_handler_request(handler_cls, method, path, body=None, headers=None):
    handler = handler_cls.__new__(handler_cls)
    handler.path = path
    headers_dict = headers.copy() if headers else {}
    if body is not None:
        payload = (
            json.dumps(body).encode("utf-8")
            if isinstance(body, dict)
            else body.encode("utf-8")
        )
        headers_dict["Content-Length"] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
    else:
        handler.rfile = io.BytesIO()
    handler.headers = headers_dict
    handler.client_address = ("127.0.0.1", 12345)
    handler.wfile = io.BytesIO()
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()
    return handler


def get_response_payload(handler):
    handler.wfile.seek(0)
    raw = handler.wfile.read()
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def test_nurse_onboarding_and_job_discovery_lifecycle(nurse_app_environment):
    app, handler_cls, repo = nurse_app_environment

    # =========================================================================
    # Step 1: User Registration as a Nurse
    # =========================================================================
    nurse_reg_payload = {
        "email": "claire.davies.rn@melbournehospital.org.au",
        "name": "Claire Davies, RN",
        "password": "ClinicalNurse2026!",
    }
    reg_handler = create_handler_request(
        handler_cls, "POST", "/api/register", body=nurse_reg_payload
    )
    reg_handler.do_POST()

    assert reg_handler.send_response.call_args[0][0] == 200
    reg_response = get_response_payload(reg_handler)
    assert reg_response["success"] is True
    assert reg_response["user"]["email"] == "claire.davies.rn@melbournehospital.org.au"
    assert reg_response["user"]["name"] == "Claire Davies, RN"
    assert reg_response["has_profile"] is False
    token = reg_response["token"]
    user_id = reg_response["user"]["id"]

    # =========================================================================
    # Step 2: Create & Persist Registered Nurse Profile (Healthcare & Medical)
    # =========================================================================
    nurse_profile = {
        "id": user_id,
        "name": "Claire Davies, RN",
        "title": "Registered Nurse / Clinical Nurse Specialist",
        "industry": "Healthcare & Medical",
        "seniorityLevel": "Senior / Specialist",
        "yearsOfExperience": 8,
        "location": "Melbourne, VIC",
        "suburb": "Parkville",
        "workRights": "Australian Citizen (Unrestricted)",
        "clearance": "AHPRA Registered (Division 1) · WWCC · National Police Check",
        "targetSalary": "$100,000 - $125,000 + Super + Salary Packaging",
        "targetTitles": [
            "Registered Nurse",
            "Clinical Nurse Specialist",
            "Associate Nurse Unit Manager",
            "Emergency Triage Nurse",
            "Clinical Care Coordinator",
        ],
        "coreSkills": [
            "AHPRA Registered Nurse",
            "Acute Patient Assessment",
            "Emergency Triage",
            "Medication Administration",
            "Infection Control",
            "Clinical Governance",
            "Electronic Medical Records (EMR)",
            "BLS / ALS Certification",
        ],
        "certifications": [
            "AHPRA Registered Nurse (Division 1) — Registration #NMW0009876543",
            "Working with Children Check (Victoria — Employee)",
            "Advanced Life Support (ALS Level 2) Certification",
        ],
        "workHistorySummary": "Experienced Registered Nurse with 8+ years in acute care, emergency triage, and clinical ward coordination across major Melbourne public and private hospital networks.",
    }

    prof_handler = create_handler_request(
        handler_cls,
        "POST",
        "/api/profile",
        body=nurse_profile,
        headers={"Authorization": f"Bearer {token}"},
    )
    prof_handler.do_POST()

    assert prof_handler.send_response.call_args[0][0] == 200
    prof_response = get_response_payload(prof_handler)
    assert prof_response["success"] is True
    assert (
        prof_response["profile"]["title"]
        == "Registered Nurse / Clinical Nurse Specialist"
    )
    assert prof_response["profile"]["industry"] == "Healthcare & Medical"
    assert "AHPRA Registered Nurse" in prof_response["profile"]["coreSkills"]

    # Verify Dual-Sink persistence in SQLite database
    with repo.get_connection() as conn:
        row = conn.execute(
            "SELECT profile_data_json FROM user_profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
        assert row is not None
        saved_db_profile = json.loads(row[0])
        assert saved_db_profile["name"] == "Claire Davies, RN"
        assert saved_db_profile["industry"] == "Healthcare & Medical"

    # =========================================================================
    # Step 3: Verify Session Restoration
    # =========================================================================
    session_handler = create_handler_request(
        handler_cls,
        "GET",
        "/api/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    session_handler.do_GET()
    assert session_handler.send_response.call_args[0][0] == 200
    session_response = get_response_payload(session_handler)
    assert session_response["success"] is True
    assert session_response["has_profile"] is True
    assert session_response["profile"]["name"] == "Claire Davies, RN"

    # =========================================================================
    # Step 4: Synchronize Nurse Search Queries
    # =========================================================================
    nurse_queries = [
        {"term": "Registered Nurse", "location": "Melbourne VIC"},
        {"term": "Clinical Nurse Specialist", "location": "Melbourne VIC"},
        {"term": "Associate Nurse Unit Manager", "location": "Melbourne VIC"},
    ]
    queries_handler = create_handler_request(
        handler_cls,
        "POST",
        "/api/search-criteria",
        body={"queries": nurse_queries},
        headers={"Authorization": f"Bearer {token}"},
    )
    queries_handler.do_POST()
    assert queries_handler.send_response.call_args[0][0] == 200
    queries_resp = get_response_payload(queries_handler)
    assert queries_resp["success"] is True

    # =========================================================================
    # Step 5: Test Job Matching & Scoring for Clinical vs Non-Clinical Jobs
    # =========================================================================
    # Nurse Job 1: High Match
    nurse_job_1 = Job(
        id="seek-nurse-001",
        title="Clinical Nurse Specialist — Acute Care / Emergency",
        company="Royal Melbourne Hospital",
        location="Parkville, VIC",
        url="https://www.seek.com.au/job/nurse-001",
        description="We are seeking an experienced AHPRA Registered Nurse (Division 1) to join our fast-paced Emergency Department. Must have strong skills in emergency triage, patient assessment, and medication administration. ALS certification preferred.",
        source="Seek",
        tags=(
            "AHPRA Registered Nurse",
            "Emergency Triage",
            "Patient Care",
            "Medication Administration",
        ),
    )

    # Nurse Job 2: Good Match (Ward Leadership)
    nurse_job_2 = Job(
        id="indeed-nurse-002",
        title="Associate Nurse Unit Manager (ANUM) — Surgical Ward",
        company="Epworth HealthCare",
        location="Richmond, VIC",
        url="https://au.indeed.com/job/nurse-002",
        description="Lead clinical nursing shifts, mentor junior and graduate nurses, coordinate multidisciplinary patient discharges. Current AHPRA registration required.",
        source="Indeed",
        tags=("AHPRA Registered Nurse", "Clinical Governance", "Ward Management"),
    )

    # Non-Clinical Job 3: Mismatch Negative Control
    it_job_3 = Job(
        id="seek-devops-003",
        title="Senior Cloud Infrastructure / DevOps Engineer",
        company="Atlassian",
        location="Melbourne, VIC",
        url="https://www.seek.com.au/job/it-003",
        description="Looking for a Senior Cloud Infrastructure Engineer with AWS, Terraform, Docker, and Kubernetes mastery. No healthcare experience needed.",
        source="Seek",
        tags=("AWS", "Kubernetes", "Terraform", "CI/CD"),
    )

    # Ingest jobs into repo
    repo.upsert_job(
        {
            "id": nurse_job_1.id,
            "title": nurse_job_1.title,
            "company": nurse_job_1.company,
            "location": nurse_job_1.location,
            "url": nurse_job_1.url,
            "description": nurse_job_1.description,
            "source": nurse_job_1.source,
            "tags": list(nurse_job_1.tags),
        }
    )
    repo.upsert_job(
        {
            "id": nurse_job_2.id,
            "title": nurse_job_2.title,
            "company": nurse_job_2.company,
            "location": nurse_job_2.location,
            "url": nurse_job_2.url,
            "description": nurse_job_2.description,
            "source": nurse_job_2.source,
            "tags": list(nurse_job_2.tags),
        }
    )
    repo.upsert_job(
        {
            "id": it_job_3.id,
            "title": it_job_3.title,
            "company": it_job_3.company,
            "location": it_job_3.location,
            "url": it_job_3.url,
            "description": it_job_3.description,
            "source": it_job_3.source,
            "tags": list(it_job_3.tags),
        }
    )

    # Run scoring engine with nurse profile
    result_1 = score_job(nurse_job_1, nurse_profile)
    result_2 = score_job(nurse_job_2, nurse_profile)
    result_3 = score_job(it_job_3, nurse_profile)

    # The clinical nurse specialist job should receive a top tier score
    assert result_1.score >= 70, (
        f"Clinical Nurse Specialist score should be >= 70, got {result_1.score} (matched: {result_1.matched_skills})"
    )
    assert result_2.score >= 65, (
        f"Associate Nurse Unit Manager score should be >= 65, got {result_2.score} (matched: {result_2.matched_skills})"
    )

    # The IT DevOps job should be heavily penalized for title & skill mismatch
    assert result_3.score < 50, (
        f"IT DevOps job score should be < 50 for a Nurse, got {result_3.score}"
    )
    assert result_1.score > result_3.score, (
        f"Nurse job ({result_1.score}) must score substantially higher than DevOps job ({result_3.score})"
    )

    # =========================================================================
    # Step 6: Verify Profile Retrieval has all complete required fields
    # =========================================================================
    get_prof_handler = create_handler_request(
        handler_cls, "GET", "/api/profile", headers={"Authorization": f"Bearer {token}"}
    )
    get_prof_handler.do_GET()
    assert get_prof_handler.send_response.call_args[0][0] == 200
    retrieved_prof = get_response_payload(get_prof_handler).get("profile", {})
    assert retrieved_prof.get("industry") == "Healthcare & Medical"
    assert retrieved_prof.get("seniority") in ("Senior", "Senior / Specialist")
    assert any("nurse" in r.lower() for r in (retrieved_prof.get("targetRoles") or []))
    assert any("ahpra" in s.lower() for s in (retrieved_prof.get("coreSkills") or []))
    assert retrieved_prof.get("locationPreference") is not None

    # =========================================================================
    # Step 7: Verify GET /api/search-criteria has searchCriteria key & nurse terms
    # =========================================================================
    crit_get_handler = create_handler_request(
        handler_cls, "GET", "/api/search-criteria", headers={"Authorization": f"Bearer {token}"}
    )
    crit_get_handler.do_GET()
    assert crit_get_handler.send_response.call_args[0][0] == 200
    crit_payload = get_response_payload(crit_get_handler)
    assert "searchCriteria" in crit_payload
    sc_terms = [q["term"] for q in crit_payload["searchCriteria"]]
    assert any("nurse" in t.lower() or "rn" in t.lower() for t in sc_terms)
    assert not any("developer" in t.lower() or "software" in t.lower() for t in sc_terms)

    # =========================================================================
    # Step 8: Verify GET /api/job-explanation with jobId returns clinical breakdown
    # =========================================================================
    exp_handler = create_handler_request(
        handler_cls, "GET", "/api/job-explanation?jobId=seek-nurse-001", headers={"Authorization": f"Bearer {token}"}
    )
    exp_handler.do_GET()
    assert exp_handler.send_response.call_args[0][0] == 200
    exp_data = get_response_payload(exp_handler)
    assert exp_data.get("success") is True
    explanation = exp_data.get("explanation", {})
    assert explanation.get("score", 0) >= 70
    assert any("triage" in s.lower() or "patient" in s.lower() or "nurse" in s.lower() or "medication" in s.lower()
               for s in explanation.get("matched_skills", []))

    # =========================================================================
    # Step 9: Verify Developer Onboarding updates search-criteria to tech terms
    # =========================================================================
    dev_profile = {
        "id": "user_dev_001",
        "name": "David Dev",
        "title": "Senior Software Engineer",
        "industry": "Technology",
        "seniority": "Senior",
        "targetRoles": ["Senior Software Engineer", "Full Stack Developer"],
        "coreSkills": ["Python", "React", "AWS", "Docker"],
        "locationPreference": "Melbourne, VIC"
    }
    dev_prof_handler = create_handler_request(
        handler_cls, "POST", "/api/profile", body=dev_profile, headers={"X-User-Id": "user_dev_001"}
    )
    dev_prof_handler.do_POST()
    assert dev_prof_handler.send_response.call_args[0][0] == 200

    dev_crit_handler = create_handler_request(
        handler_cls, "GET", "/api/search-criteria", headers={"X-User-Id": "user_dev_001"}
    )
    dev_crit_handler.do_GET()
    assert dev_crit_handler.send_response.call_args[0][0] == 200
    dev_crit_payload = get_response_payload(dev_crit_handler)
    dev_terms = [q["term"] for q in dev_crit_payload["searchCriteria"]]
    assert any("software" in t.lower() or "developer" in t.lower() or "engineer" in t.lower() for t in dev_terms)
    assert not any("nurse" in t.lower() or "hospital" in t.lower() for t in dev_terms)
