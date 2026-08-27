from pathlib import Path

from job_dashboard import JobDashboard, normalize_job
from job_dashboard.applications import ApplicationIndex, split_documents
from job_dashboard.documents import RelevanceError, generate_documents
from job_dashboard.models import Job
from job_dashboard.models import ApplicationRecord


def test_normalize_job_is_stable_without_source_id():
    first = normalize_job({"title": "Cloud Engineer", "company": "Acme", "location": "Melbourne"})
    second = normalize_job({"title": "Cloud Engineer", "company": "Acme", "location": "Melbourne"})
    assert first == second
    assert first.id


def test_dashboard_classifies_and_scores_job():
    analysis = JobDashboard({"skills": ["azure", "powershell", "windows"]}).analyse({
        "title": "Cloud Engineer",
        "company": "Example Technology",
        "location": "Melbourne",
        "description": "Azure and PowerShell automation for Windows environments",
    })
    assert analysis.stream == "core-it"
    assert 0 <= analysis.score.score <= 100
    assert "azure" in analysis.score.matched_skills


def test_document_split_and_index_upsert(tmp_path: Path):
    resume, cover, description = split_documents("resume\n===COVER_LETTER===\ncover\n===JOB_DESCRIPTION===\nsource")
    assert (resume, cover, description) == ("resume", "cover", "source")
    index = ApplicationIndex(tmp_path / "index.json")
    record = ApplicationRecord("acme-cloud", "Acme", "Cloud Engineer", resume="resume.md")
    index.upsert(record)
    index.upsert(record)
    assert len(index.load()["roles"]) == 1


def test_document_generation_blocks_no_match_role():
    job = Job("id", "Business Development Executive - Data & AI", "HSO", description="Own revenue targets and close new sales opportunities")

    try:
        generate_documents(job, {"personal": {}})
    except RelevanceError as error:
        assert "Resume not generated" in str(error)
    else:
        raise AssertionError("Expected no-match role to be blocked")
