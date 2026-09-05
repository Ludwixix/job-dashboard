from unittest.mock import patch
from job_dashboard.models import Job
from job_dashboard.sources.portal_crawler import (
    clean_html_to_text,
    enrich_job_description,
    extract_description_from_html,
    is_ats_portal_url,
)


def test_is_ats_portal_url_detection():
    # Valid ATS portal URLs
    assert is_ats_portal_url("https://boards.greenhouse.io/canva/jobs/123456")
    assert is_ats_portal_url("https://jobs.lever.co/atlassian/abc-xyz-123")
    assert is_ats_portal_url("https://enterprise.myworkdayjobs.com/en-US/Careers/job/Engineer_R101")
    assert is_ats_portal_url("https://jobs.smartrecruiters.com/AcmeCorp/999-developer")
    assert is_ats_portal_url("https://company.taleo.net/careersection/jobdetail.ftl?job=123")
    assert is_ats_portal_url("https://jobs.ashbyhq.com/openai/developer")
    assert is_ats_portal_url("https://company.bamboohr.com/careers/12")

    # Non-ATS URLs
    assert not is_ats_portal_url("https://www.seek.com.au/job/78901234")
    assert not is_ats_portal_url("https://au.indeed.com/viewjob?jk=abcdef123456")
    assert not is_ats_portal_url("https://news.ycombinator.com")
    assert not is_ats_portal_url("")
    assert not is_ats_portal_url(None)


def test_clean_html_to_text_cleans_tags_and_entities():
    sample_html = """
    <div>
        <script>var x = 10; alert('bad');</script>
        <style>.hide { display: none; }</style>
        <h1>Senior Systems Engineer &amp; Architect</h1>
        <p>Key requirements for this role &quot;urgently&quot;:</p>
        <ul>
            <li>5+ years Azure experience &nbsp; required</li>
            <li>PowerShell scripting mastery</li>
        </ul>
    </div>
    """
    cleaned = clean_html_to_text(sample_html)
    assert "alert('bad')" not in cleaned
    assert ".hide" not in cleaned
    assert "Senior Systems Engineer & Architect" in cleaned
    assert '"urgently"' in cleaned
    assert "5+ years Azure experience   required" in cleaned
    assert "PowerShell scripting mastery" in cleaned


def test_extract_description_from_workday_dom():
    workday_html = """
    <!DOCTYPE html>
    <html>
    <body>
        <header><nav><a href="/">Home</a></nav></header>
        <div data-automation-id="jobPostingDescription">
            <h2>About the Role</h2>
            <p>We are looking for a Senior Azure Infrastructure Administrator to manage multi-region cloud tenants.</p>
            <h3>Responsibilities</h3>
            <p>Automate tenant provisioning, optimize cloud compute spend, and ensure compliance with ISO 27001 standards.</p>
        </div>
        <footer><p>Cookie Policy</p></footer>
    </body>
    </html>
    """
    desc = extract_description_from_html(workday_html)
    assert "About the Role" in desc
    assert "Senior Azure Infrastructure Administrator" in desc
    assert "ISO 27001" in desc
    assert "Cookie Policy" not in desc


def test_extract_description_from_greenhouse_dom():
    greenhouse_html = """
    <html>
    <body>
        <div id="content" class="job-description">
            <h2>Cloud Operations Lead</h2>
            <p>Join our mission-critical enterprise engineering squad building next-gen resilient platforms.</p>
            <p>Candidate must demonstrate hands-on mastery of Kubernetes, Terraform, and Python automation.</p>
        </div>
    </body>
    </html>
    """
    desc = extract_description_from_html(greenhouse_html)
    assert "Cloud Operations Lead" in desc
    assert "Kubernetes, Terraform, and Python automation" in desc


def test_enrich_job_description_skips_when_already_comprehensive():
    long_desc = "A" * 400
    job = Job(
        id="job-1",
        title="Software Engineer",
        company="Tech Corp",
        description=long_desc,
        url="https://boards.greenhouse.io/techcorp/jobs/123",
    )
    with patch("job_dashboard.sources.portal_crawler.fetch_portal_description") as mock_fetch:
        enriched = enrich_job_description(job)
        mock_fetch.assert_not_called()
        assert enriched.description == long_desc


def test_enrich_job_description_skips_non_ats_urls():
    short_desc = "Short snippet"
    job = Job(
        id="job-2",
        title="Software Engineer",
        company="Tech Corp",
        description=short_desc,
        url="https://www.seek.com.au/job/123",
    )
    with patch("job_dashboard.sources.portal_crawler.fetch_portal_description") as mock_fetch:
        enriched = enrich_job_description(job)
        mock_fetch.assert_not_called()
        assert enriched.description == short_desc


def test_enrich_job_description_enriches_truncated_ats_job():
    short_desc = "Truncated listing description..."
    full_deep_desc = (
        "Comprehensive Role Overview:\n"
        "As a Senior Cloud Systems Administrator, you will drive enterprise migration, "
        "manage Azure landing zones, author robust PowerShell runbooks, and lead technical incident reviews."
    )
    job = Job(
        id="job-3",
        title="Senior Cloud Administrator",
        company="Enterprise Tech",
        description=short_desc,
        url="https://jobs.lever.co/enterprisetech/cloud-admin",
    )
    with patch("job_dashboard.sources.portal_crawler.fetch_portal_description", return_value=full_deep_desc):
        enriched = enrich_job_description(job)
        assert enriched.description == full_deep_desc
        assert enriched.title == job.title
        assert enriched.company == job.company
