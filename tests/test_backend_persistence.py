import tempfile
from pathlib import Path
import pytest
from job_dashboard.repository import JobRepository

@pytest.fixture
def temp_repo():
    with tempfile.NamedTemporaryFile(suffix=".db") as f:
        repo = JobRepository(f.name)
        yield repo

def test_profile_persistence(temp_repo):
    user_id = "test_user_123"
    profile_data = {
        "id": "test_user_123",
        "name": "Sam Ludwig",
        "title": "Senior Systems Engineer",
        "industry": "Technology & IT",
        "skills": ["Azure", "PowerShell", "Terraform"]
    }
    saved = temp_repo.upsert_user_profile(user_id, profile_data)
    assert saved["name"] == "Sam Ludwig"

    fetched = temp_repo.get_user_profile(user_id)
    assert fetched["name"] == "Sam Ludwig"
    assert "Azure" in fetched["skills"]

def test_preferences_persistence(temp_repo):
    user_id = "test_user_123"
    prefs = {
        "promotedJobIds": ["seek_123", "indeed_456"],
        "demotedJobIds": ["old_789"],
        "boostedCompanies": ["Thales", "Acciona"]
    }
    temp_repo.upsert_user_preferences(user_id, prefs)
    fetched = temp_repo.get_user_preferences(user_id)
    assert "seek_123" in fetched["promotedJobIds"]
    assert "Thales" in fetched["boostedCompanies"]

def test_user_applications_and_email_updates(temp_repo):
    user_id = "test_user_123"
    job_id = "thales_admin_001"
    app_data = {
        "job_id": job_id,
        "company": "Thales",
        "title": "Systems Administrator",
        "status": "Applied",
        "notes": "Submitted via company portal"
    }
    temp_repo.upsert_user_application(user_id, job_id, app_data)
    apps = temp_repo.get_user_applications(user_id)
    assert len(apps) == 1
    assert apps[0]["status"] == "Applied"

    # Update via simulated email
    temp_repo.update_application_status_from_email(
        user_id=user_id,
        job_id=job_id,
        new_status="Interview Scheduled",
        email_subject="Invitation to Interview - Thales",
        email_snippet="We would like to invite you for a 30m phone screen",
        email_date="2026-08-31T10:00:00Z",
        email_thread_id="msg_123456"
    )

    updated_apps = temp_repo.get_user_applications(user_id)
    assert updated_apps[0]["status"] == "Interview Scheduled"

def test_documents_and_psychology_persistence(temp_repo):
    user_id = "test_user_123"
    job_id = "job_999"

    # Documents
    temp_repo.upsert_generated_document(user_id, job_id, "resume", "SAMPLE RESUME TEXT", "GLM-5")
    doc = temp_repo.get_generated_document(user_id, job_id, "resume")
    assert doc is not None
    assert doc["content_text"] == "SAMPLE RESUME TEXT"

    # Psychology
    temp_repo.upsert_job_psychology(job_id, "Acciona", "Cloud Lead", {"culture": "fast-paced"}, "Claude-3.5")
    psy = temp_repo.get_job_psychology(job_id)
    assert psy is not None
    assert psy["insights"]["culture"] == "fast-paced"
