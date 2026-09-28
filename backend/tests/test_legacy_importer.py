"""Unit and regression tests for legacy JSON application importer."""

import json
from pathlib import Path
import pytest

from job_dashboard.importer import import_legacy_applications, normalize_status
from job_dashboard.repository import JobRepository


def test_normalize_status_mapping():
    assert normalize_status("new") == "Discovered"
    assert normalize_status("review") == "Discovered"
    assert normalize_status("ready") == "Discovered"
    assert normalize_status("applied") == "Applied"
    assert normalize_status("interview") == "Interviewing"
    assert normalize_status("interviewing") == "Interviewing"
    assert normalize_status("offer") == "Offer Received"
    assert normalize_status("rejected") == "Rejected"
    assert normalize_status("archived") == "Rejected"
    assert normalize_status(None) == "Discovered"
    assert normalize_status("custom applied string") == "Applied"


def test_importer_requires_explicit_user_id(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    json_path = tmp_path / "apps.json"
    json_path.write_text("{}", encoding="utf-8")

    with pytest.raises(ValueError, match="Explicit user_id is required"):
        import_legacy_applications(json_path, "", repo)

    with pytest.raises(ValueError, match="Cannot import legacy applications to ownerless 'default_user'"):
        import_legacy_applications(json_path, "default_user", repo)


def test_importer_creates_backup_and_preserves_source(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    json_path = tmp_path / "smart_applications.json"
    sample_data = {
        "app_1": {
            "application_id": "app_1",
            "job_id": "seek_1001",
            "job_title": "Cloud Architect",
            "company": "Canva",
            "status": "applied",
            "notes": "Spoke to recruiter Sarah",
            "applied_at": "2026-09-01T10:00:00Z",
            "updated_at": "2026-09-02T12:00:00Z",
        },
        "app_2": {
            "application_id": "app_2",
            "job_id": "indeed_2002",
            "job_title": "DevOps Lead",
            "company": "Atlassian",
            "status": "interview",
            "notes": "Technical panel on Thursday",
            "applied_at": "2026-09-03T10:00:00Z",
            "updated_at": "2026-09-04T12:00:00Z",
        },
    }
    json_path.write_text(json.dumps(sample_data), encoding="utf-8")

    report = import_legacy_applications(json_path, "user_jane_doe", repo, backup=True)

    assert report["total_records"] == 2
    assert report["imported"] == 2
    assert report["updated"] == 0
    assert report["skipped"] == 0
    assert report["errors"] == []
    assert json_path.exists(), "Source JSON must remain intact"
    assert Path(report["backup_file"]).is_file(), "Backup file must exist"

    # Verify database contents
    apps = repo.get_user_applications("user_jane_doe")
    assert len(apps) == 2
    app_map = {a["job_id"]: a for a in apps}
    assert app_map["seek_1001"]["company"] == "Canva"
    assert app_map["seek_1001"]["status"] == "Applied"
    assert app_map["indeed_2002"]["status"] == "Interviewing"

    # Idempotent re-run should not create duplicate entries (skipped as already current)
    report2 = import_legacy_applications(json_path, "user_jane_doe", repo, backup=False)
    assert report2["total_records"] == 2
    assert report2["imported"] == 0
    assert report2["skipped"] == 2
    assert len(repo.get_user_applications("user_jane_doe")) == 2
