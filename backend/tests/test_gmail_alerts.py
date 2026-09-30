import pytest
from job_dashboard.email_connector import (
    EmailMessage,
    JobAlertParser,
    GmailScanner,
)


def test_job_alert_parser_identifies_and_parses_seek_alerts():
    parser = JobAlertParser()
    sample_seek_body = """
    Jobs recommended for you based on your activity:
    
    Senior Infrastructure Engineer
    Centorrino Technologies - Melbourne VIC
    $130,000 - $150,000
    View job: https://www.seek.com.au/job/78910111
    
    Cloud Engineer (AWS/Azure)
    Versent - Melbourne VIC
    $140,000
    View job: https://www.seek.com.au/job/78910112

    Level 1 Helpdesk Technician
    Retail Tech Services - Dandenong VIC
    $55,000
    View job: https://www.seek.com.au/job/78910113
    """
    msg = EmailMessage(
        subject="SEEK: Jobs recommended for you",
        snippet="Senior Infrastructure Engineer, Cloud Engineer, and more",
        from_address="noreply@seek.com.au",
        received_at="2026-09-30T10:00:00Z",
        email_id="seek-alert-1",
        body_preview=sample_seek_body,
    )

    assert parser.is_job_alert(msg) is True

    jobs = parser.parse_alert_email(msg, min_score=60)
    # The L1 helpdesk technician job should be filtered out by score < 60
    assert len(jobs) == 2
    titles = [j["title"] for j in jobs]
    assert "Senior Infrastructure Engineer" in titles
    assert "Cloud Engineer (AWS/Azure)" in titles
    assert "Level 1 Helpdesk Technician" not in titles

    for j in jobs:
        assert j["source"] == "Gmail Alert"
        assert j["score"] >= 60
        assert j["url"].startswith("https://www.seek.com.au/job/")


def test_job_alert_parser_identifies_and_parses_linkedin_alerts():
    parser = JobAlertParser()
    sample_linkedin_body = """
    Sam, 3 new jobs for 'Senior Systems Administrator'
    
    Senior Systems Administrator
    Macquarie Group
    Melbourne, Victoria, Australia
    https://www.linkedin.com/comm/jobs/view/4123456789/

    EFTPOS Field Technician
    Terminal Services
    Melbourne, Victoria, Australia
    https://www.linkedin.com/comm/jobs/view/4123456790/
    """
    msg = EmailMessage(
        subject="Sam, 3 new jobs for 'Senior Systems Administrator'",
        snippet="Senior Systems Administrator at Macquarie Group",
        from_address="jobalerts-noreply@linkedin.com",
        received_at="2026-09-30T11:00:00Z",
        email_id="li-alert-1",
        body_preview=sample_linkedin_body,
    )

    assert parser.is_job_alert(msg) is True
    jobs = parser.parse_alert_email(msg, min_score=60)
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Senior Systems Administrator"
    assert jobs[0]["company"] == "Macquarie Group"
    assert jobs[0]["source"] == "Gmail Alert"
    assert jobs[0]["score"] >= 80


def test_job_alert_parser_scores_and_suppresses_noise():
    parser = JobAlertParser()

    # Target title match should score high
    high_score = parser.score_job_title("Senior Infrastructure Engineer")
    assert high_score >= 85

    # L1 / helpdesk / technician noise should score low
    low_score = parser.score_job_title("Junior L1 Helpdesk Support Specialist")
    assert low_score < 50

    field_tech_score = parser.score_job_title("EFTPOS Field Service Technician")
    assert field_tech_score < 50
