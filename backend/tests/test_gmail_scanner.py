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
    assert not any(job["source"] == "Gmail" for job in result["jobs"])
    assert any(item["company"] == "Other Co" for item in app.application_archive())
def test_rejected_applications_are_available_in_archive(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    app.jobs = [{
        "id": "job-1", "title": "Cloud Engineer", "company": "Acme",
        "description": "Cloud work", "email_events": [{"category": "rejected", "email_id": "msg-1", "received_at": "2026-08-25"}],
    }]

    archive = app.rejected_applications()

    assert len(archive) == 1
    assert archive[0]["company"] == "Acme"


def test_classify_interviewing_kbr_sharepoint_analyst():
    from job_dashboard.email_connector import EmailClassifier
    classifier = EmailClassifier()
    msg = EmailMessage(
        subject="KBR: Interview Invitation - SharePoint Online Analyst",
        snippet="We would like to invite you to an interview loop with the panel for the SharePoint Online Analyst position.",
        from_address="recruiting@kbr.com",
        received_at="2026-09-10T09:00:00Z",
        email_id="kbr-msg-1",
    )
    category, confidence = classifier.classify(msg)
    assert category == "interview_requested"
    assert confidence >= 0.7
    assert DashboardApp._gmail_status(category) == "interviewing"


def test_classify_applied_schoolbox_nexon_vic_health():
    from job_dashboard.email_connector import EmailClassifier
    classifier = EmailClassifier()

    # Schoolbox
    schoolbox_msg = EmailMessage(
        subject="Schoolbox Application Acknowledgment: ICT Support Specialist",
        snippet="Thank you for your application to Schoolbox. We have received your submission.",
        from_address="careers@schoolbox.com.au",
        received_at="2026-09-11T10:00:00Z",
        email_id="sb-msg-1",
    )
    cat_sb, conf_sb = classifier.classify(schoolbox_msg)
    assert cat_sb == "application_confirmed"
    assert DashboardApp._gmail_status(cat_sb) == "applied"

    # Nexon
    nexon_msg = EmailMessage(
        subject="Nexon Asia Pacific - Application Receipt",
        snippet="Confirmation of receipt of your application for Cloud Engineer at Nexon.",
        from_address="talent@nexon.com.au",
        received_at="2026-09-12T11:00:00Z",
        email_id="nx-msg-1",
    )
    cat_nx, conf_nx = classifier.classify(nexon_msg)
    assert cat_nx == "application_confirmed"
    assert DashboardApp._gmail_status(cat_nx) == "applied"

    # Victorian Department of Health
    vic_health_msg = EmailMessage(
        subject="Victorian Department of Health: Application Confirmation",
        snippet="Your application for Senior Project Officer has been successfully submitted and received.",
        from_address="careers@health.vic.gov.au",
        received_at="2026-09-13T12:00:00Z",
        email_id="vh-msg-1",
    )
    cat_vh, conf_vh = classifier.classify(vic_health_msg)
    assert cat_vh == "application_confirmed"
    assert DashboardApp._gmail_status(cat_vh) == "applied"


def test_classify_rejected_racv_olympus_nextdc():
    from job_dashboard.email_connector import EmailClassifier
    classifier = EmailClassifier()

    # RACV
    racv_msg = EmailMessage(
        subject="RACV - Update on your application",
        snippet="Thank you for your interest in RACV. Unfortunately, we will not be moving forward with your application on this occasion.",
        from_address="talent@racv.com.au",
        received_at="2026-09-10T14:00:00Z",
        email_id="racv-msg-1",
    )
    cat_racv, conf_racv = classifier.classify(racv_msg)
    assert cat_racv == "rejected"
    assert DashboardApp._gmail_status(cat_racv) == "rejected"

    # Olympus
    olympus_msg = EmailMessage(
        subject="Olympus Australia - Candidacy Update",
        snippet="After careful consideration, Olympus has decided to pursue other candidates whose qualifications more closely align with our needs.",
        from_address="recruiting@olympus.com.au",
        received_at="2026-09-11T15:00:00Z",
        email_id="ol-msg-1",
    )
    cat_ol, conf_ol = classifier.classify(olympus_msg)
    assert cat_ol == "rejected"
    assert DashboardApp._gmail_status(cat_ol) == "rejected"

    # NEXTDC
    nextdc_msg = EmailMessage(
        subject="NEXTDC Application Status: Cloud Engineer",
        snippet="We regret to inform you that we will not be progressing your candidacy further at NEXTDC.",
        from_address="careers@nextdc.com",
        received_at="2026-09-12T16:00:00Z",
        email_id="ndc-msg-1",
    )
    cat_ndc, conf_ndc = classifier.classify(nextdc_msg)
    assert cat_ndc == "rejected"
    assert DashboardApp._gmail_status(cat_ndc) == "rejected"


def test_gmail_scan_sanitizes_malformed_text_and_timestamps(tmp_path, monkeypatch):
    app = DashboardApp({}, [], tmp_path)
    messages = [
        EmailMessage(
            subject="<b>Application received</b> for Cloud Engineer at &quot;Acme Corp&quot;",
            snippet="<div>We received &amp; registered your application</div>",
            from_address="jobs@acme.com",
            received_at="malformed-date-string",
            email_id="malformed-1",
            body_preview="<p>Full HTML <b>body</b> text &amp; details</p>",
        )
    ]
    monkeypatch.setattr(GmailScanner, "application_messages", lambda self: [(messages[0], "application_confirmed", 0.9)])

    result = app.scan_gmail("user@gmail.com", "app-password")
    assert result["created"] == 1

    created_job = next(j for j in app.jobs if getattr(j, "id", None) == "gmail-malformed-1" or (isinstance(j, dict) and j.get("id") == "gmail-malformed-1"))
    desc = getattr(created_job, "description", None) or created_job.get("description", "")
    posted = getattr(created_job, "posted", None) or created_job.get("posted", "")

    assert "<" not in desc
    assert ">" not in desc
    assert "&amp;" not in desc
    # Verify timestamp was sanitized into valid YYYY-MM-DD
    assert len(posted) == 10
    assert posted.count("-") == 2


def test_gmail_scan_deduplicates_email_events_and_jobs(tmp_path, monkeypatch):
    app = DashboardApp({}, [], tmp_path)
    app.jobs = [{
        "id": "job-existing-1",
        "title": "SharePoint Online Analyst",
        "company": "KBR",
        "description": "Enterprise SharePoint Analyst",
        "source": "SEEK",
        "posted": "2026-09-01",
        "url": "https://example.com/kbr",
        "remote": False,
        "email_events": [{"email_id": "dup-1", "category": "application_confirmed", "received_at": "2026-09-02T10:00:00Z", "confidence": 0.9}],
    }]
    app.jobs = app.materialize_jobs(app.jobs)
    app.save_jobs()

    # Incoming message with identical email_id
    duplicate_msg = EmailMessage(
        subject="KBR: Interview Invitation - SharePoint Online Analyst",
        snippet="We invite you to interview for SharePoint Online Analyst at KBR",
        from_address="recruiting@kbr.com",
        received_at="2026-09-10T10:00:00Z",
        email_id="dup-1",
    )
    monkeypatch.setattr(GmailScanner, "application_messages", lambda self: [(duplicate_msg, "interview_requested", 0.95)])

    # First scan
    result1 = app.scan_gmail("user@gmail.com", "app-password")
    assert result1["matched"] == 1
    # Check that events list did not duplicate 'dup-1'
    existing_job = next(j for j in app.jobs if j["id"] == "job-existing-1")
    assert len(existing_job["email_events"]) == 1

    # Second scan with identical message
    result2 = app.scan_gmail("user@gmail.com", "app-password")
    assert len(existing_job["email_events"]) == 1