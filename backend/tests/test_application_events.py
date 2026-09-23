"""Tests for JobRepository.get_application_events and event timeline logging."""

from job_dashboard.repository import JobRepository


def test_get_application_events(tmp_path):
    db_path = str(tmp_path / "test_events.sqlite3")
    repo = JobRepository(db_path)

    # Initially empty
    events = repo.get_application_events("job_123")
    assert events == []

    # Insert an application, which logs an event
    repo.upsert_user_application(
        user_id="user_abc",
        job_id="job_123",
        data={
            "status": "Applied",
            "notes": "Applied via website",
        },
    )

    # Query with job_id only
    events = repo.get_application_events("job_123")
    assert len(events) == 1
    assert events[0]["job_id"] == "job_123"
    assert events[0]["to_status"] == "Applied"

    # Query with (user_id, job_id) signature
    events_dual = repo.get_application_events("user_abc", "job_123")
    assert len(events_dual) == 1
    assert events_dual[0]["to_status"] == "Applied"

    # Update status to trigger another event
    repo.upsert_user_application(
        user_id="user_abc",
        job_id="job_123",
        data={
            "status": "Interview Scheduled",
            "notes": "Phone screen on Monday",
        },
    )

    events_updated = repo.get_application_events("job_123")
    assert len(events_updated) == 2
    # Verify ordered by occurred_at DESC
    assert events_updated[0]["to_status"] == "Interview Scheduled"
    assert events_updated[1]["to_status"] == "Applied"
