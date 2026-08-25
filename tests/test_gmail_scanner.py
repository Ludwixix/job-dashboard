from job_dashboard.email_connector import EmailMessage, GmailScanner
from job_dashboard.web import DashboardApp


def test_gmail_scanner_keeps_only_application_signals(monkeypatch):
    messages = [
        EmailMessage("Application received for Cloud Engineer at Acme", "We received your application", "jobs@acme.com", "2026-08-25", "1"),
        EmailMessage("Your newsletter", "Weekly news", "news@example.com", "2026-08-25", "2"),
    ]
    monkeypatch.setattr(GmailScanner, "fetch_messages", lambda self: messages)

    result = GmailScanner("user@gmail.com", "app-password").application_messages()

    assert len(result) == 1
    assert result[0][1] == "application_confirmed"


def test_gmail_scanner_defaults_to_seven_days():
    scanner = GmailScanner("user@gmail.com", "app-password")
    assert scanner.days == 7


def test_gmail_scan_matches_existing_and_adds_unmatched(tmp_path, monkeypatch):
    profile = {"personal": {"full_name": "Test User"}, "technical_expertise": {}, "experience": [], "certifications": [], "education": []}
    app = DashboardApp(profile, [], tmp_path)
    app.jobs = [{"id": "job-1", "title": "Cloud Engineer", "company": "Acme", "description": "Cloud work", "source": "Adzuna", "posted": "2026-08-25", "url": "https://example.com/1", "remote": False}]
    app.jobs = app.materialize_jobs(app.jobs)
    app.save_jobs()
    messages = [
        EmailMessage("Application received for Cloud Engineer at Acme", "received", "jobs@acme.com", "2026-08-25", "1"),
        EmailMessage("Application received for Systems Administrator at Other Co", "received", "jobs@other.com", "2026-08-25", "2"),
    ]
    monkeypatch.setattr(GmailScanner, "application_messages", lambda self: [(messages[0], "application_confirmed", 0.9), (messages[1], "application_confirmed", 0.9)])

    result = app.scan_gmail("user@gmail.com", "app-password")

    assert result["matched"] == 1
    assert result["created"] == 1
    assert any(job["source"] == "Gmail" for job in result["jobs"])
def test_rejected_applications_are_available_in_archive(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    app.jobs = [{
        "id": "job-1", "title": "Cloud Engineer", "company": "Acme",
        "description": "Cloud work", "email_events": [{"category": "rejected", "email_id": "msg-1", "received_at": "2026-08-25"}],
    }]

    archive = app.rejected_applications()

    assert len(archive) == 1
    assert archive[0]["company"] == "Acme"