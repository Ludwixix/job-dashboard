"""Tests for GCS Backup and Snapshot Management Router."""

import pytest
from fastapi.testclient import TestClient
from job_dashboard.fastapi_app import create_app
from job_dashboard.gcs_backup import get_backup_status, create_backup_snapshot


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(tmp_path))
    # Create sample local files
    (tmp_path / "jobs.sqlite3").write_text("fake db content")
    (tmp_path / "job_profile.json").write_text('{"name": "Sam"}')
    (tmp_path / "smart_applications.json").write_text("[]")

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_backup_status_endpoint_local(client, tmp_path):
    res = client.get("/api/backup/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["local_files_count"] >= 3
    assert data["total_local_bytes"] > 0
    filenames = [f["filename"] for f in data["local_files"]]
    assert "jobs.sqlite3" in filenames
    assert "job_profile.json" in filenames
    assert "smart_applications.json" in filenames


def test_backup_snapshot_endpoint_dry_run(client):
    res = client.post("/api/backup/snapshot", json={"snapshot_tag": "ci_test"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "snapshot_id" in data
    assert "ci_test" in data["snapshot_id"]
    assert data["status"] in ("dry_run_local_only", "completed", "noop")


def test_direct_gcs_backup_functions(tmp_path):
    (tmp_path / "jobs.sqlite3").write_text("db binary mock")
    (tmp_path / "search_queries.json").write_text("[]")

    status = get_backup_status(None, tmp_path)
    assert status["success"] is True
    assert status["gcs_configured"] is False
    assert status["local_files_count"] >= 2

    snap = create_backup_snapshot(None, tmp_path, snapshot_tag="manual")
    assert snap["success"] is True
    assert snap["status"] == "dry_run_local_only"
    assert "manual" in snap["snapshot_id"]
