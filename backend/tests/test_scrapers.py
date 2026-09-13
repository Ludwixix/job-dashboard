import pytest
from job_dashboard.models import JobRecord, SalaryBracket
from job_dashboard.sources.base import SearchQuery, sanitize_html, parse_salary_bracket
from job_dashboard.sources.seek import SeekApiSource, _seek_record
from job_dashboard.sources.indeed import _indeed_record
from job_dashboard.sources.adzuna import _adzuna_record
from job_dashboard.sources.remoteok import _remoteok_record


def test_html_sanitization():
    unsafe_html = "<p>Clean text</p><script>alert('xss')</script><img src=x onerror=alert(1)><a href='http://bad.com'>link</a>"
    clean = sanitize_html(unsafe_html)
    assert "<script>" not in clean
    assert "alert" not in clean
    assert "<img" not in clean
    assert "<p>Clean text</p>" in clean


def test_salary_bracket_parsing():
    bracket = parse_salary_bracket("$120,000 - $140,000 per annum")
    assert bracket.min_amount == 120000.0
    assert bracket.max_amount == 140000.0
    assert bracket.is_hourly is False

    hourly_bracket = parse_salary_bracket("$65 - $80 / hr")
    assert hourly_bracket.min_amount == 65.0
    assert hourly_bracket.max_amount == 80.0
    assert hourly_bracket.is_hourly is True


def test_seek_record_conformance():
    raw_seek_job = {
        "id": "94061629",
        "title": "Senior Systems Engineer",
        "advertiser": {"description": "Global Corp"},
        "places": {"label": "Melbourne VIC"},
        "teaser": "<p>Lead our <strong>infrastructure</strong> transformation.</p>",
        "workType": [{"label": "Remote"}],
        "listingDate": "2026-09-10T00:00:00Z",
        "salary": "$150,000 - $170,000",
    }
    query = SearchQuery(term="systems engineer", location="Melbourne", stream="infrastructure")
    record = _seek_record(raw_seek_job, query)

    assert isinstance(record, JobRecord)
    assert record.id == "seek-94061629"
    assert record.provider == "seek"
    assert record.title == "Senior Systems Engineer"
    assert record.company == "Global Corp"
    assert record.work_mode == "remote"
    assert record.salary is not None
    assert record.salary.min_amount == 150000.0
    assert record.salary.max_amount == 170000.0
    assert "<strong>infrastructure</strong>" in record.raw_description
    
    # Dict mapping protocol backward compatibility
    d = record.to_dict()
    assert d["title"] == "Senior Systems Engineer"
    assert d["remote"] is True
    assert record["company"] == "Global Corp"
    assert "tags" in record


def test_indeed_record_conformance():
    raw_indeed_row = {
        "id": "indeed-12345",
        "job_url": "https://au.indeed.com/viewjob?jk=12345",
        "title": "Site Reliability Engineer",
        "company": "Cloud Systems",
        "location": "Sydney NSW",
        "description": "<p>Manage Kubernetes clusters</p><script>evil()</script>",
        "is_remote": True,
        "date_posted": "2026-09-08",
        "salary": "$130k - $160k",
        "min_amount": 130000,
        "max_amount": 160000,
    }
    query = SearchQuery(term="sre", location="Sydney", stream="cloud")
    record = _indeed_record(raw_indeed_row, query)

    assert isinstance(record, JobRecord)
    assert record.provider == "indeed"
    assert record.work_mode == "remote"
    assert record.salary.min_amount == 130000.0
    assert record.salary.max_amount == 160000.0
    assert "evil" not in record.raw_description
    assert record["source"] == "Indeed"


def test_adzuna_record_conformance():
    raw_adzuna_job = {
        "id": "adz-999",
        "title": "Lead DevOps Architect",
        "company": {"display_name": "NextGen Ltd"},
        "location": {"display_name": "Brisbane QLD"},
        "description": "<p>Drive CI/CD pipelines</p>",
        "redirect_url": "https://adzuna.com.au/jobs/999",
        "salary_min": 140000,
        "salary_max": 180000,
        "created": "2026-09-12T10:00:00Z",
    }
    query = SearchQuery(term="devops", location="Brisbane", stream="devops")
    record = _adzuna_record(raw_adzuna_job, query)

    assert isinstance(record, JobRecord)
    assert record.provider == "adzuna"
    assert record.company == "NextGen Ltd"
    assert record.salary.min_amount == 140000.0
    assert record.salary.max_amount == 180000.0


def test_remoteok_record_conformance():
    raw_remoteok_job = {
        "id": "rok-777",
        "position": "Python Platform Engineer",
        "company": "Distributed Labs",
        "location": "Worldwide",
        "description": "<div>Build resilient async backend services</div>",
        "url": "https://remoteok.com/l/777",
        "salary_min": 110000,
        "salary_max": 145000,
        "date": "2026-09-13T00:00:00Z",
    }
    query = SearchQuery(term="python", location="Remote", stream="backend")
    record = _remoteok_record(raw_remoteok_job, query)

    assert isinstance(record, JobRecord)
    assert record.provider == "remoteok"
    assert record.work_mode == "remote"
    assert record.salary.min_amount == 110000.0
    assert record.salary.max_amount == 145000.0


def test_heuristic_salary_enrichment_when_salary_null():
    raw_seek_no_salary = {
        "id": "111222",
        "title": "Senior Systems Engineer",
        "advertiser": {"description": "Enterprise Pty"},
        "places": {"label": "Melbourne VIC"},
        "teaser": "Full position details available.",
        "workType": [],
    }
    query = SearchQuery(term="systems engineer", location="Melbourne", stream="infrastructure")
    record = _seek_record(raw_seek_no_salary, query)

    assert record.salary is not None
    assert record.salary.estimated is True
    assert record.salary.min_amount == 130000.0
    assert record.salary.max_amount == 165000.0
    assert record["salary_estimated"] is True


def test_resilient_selector_degradation_seek():
    from job_dashboard.sources.seek import extract_seek_description_from_html

    # Raw HTML with broken/missing Redux and data-automation, but article container
    html_fallback = """
    <html>
      <body>
        <div id="wrapper">
          <section class="job-content">
            <p>We are seeking an outstanding Cloud Solutions Architect to join our infrastructure platform team.</p>
            <p>Key responsibilities include designing scalable AWS and GCP cloud topologies and driving CI/CD automation across multiple squads.</p>
          </section>
        </div>
      </body>
    </html>
    """
    desc = extract_seek_description_from_html(html_fallback)
    assert len(desc) > 50
    assert "Cloud Solutions Architect" in desc
    assert "CI/CD automation" in desc


def test_resilient_selector_degradation_indeed_embedded_json():
    from job_dashboard.sources.indeed import IndeedJobSpySource
    import unittest.mock as mock

    # Mock response with no mosaic job cards, but valid JSON-LD
    json_ld_html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "JobPosting",
          "title": "Principal Kubernetes Architect",
          "hiringOrganization": {"name": "Tech Corp"},
          "jobLocation": {"address": {"addressLocality": "Melbourne"}},
          "description": "<p>Lead our enterprise container modernization initiatives.</p>",
          "url": "https://au.indeed.com/viewjob?jk=abc999"
        }
        </script>
      </head>
      <body><div>Broken DOM cards</div></body>
    </html>
    """
    source = IndeedJobSpySource()
    with mock.patch("urllib.request.urlopen") as mock_open:
        mock_resp = mock.MagicMock()
        mock_resp.read.return_value = json_ld_html.encode("utf-8")
        mock_open.return_value.__enter__.return_value = mock_resp

        jobs = list(source._search_embedded_json(SearchQuery("kubernetes", "Melbourne")))
        assert len(jobs) == 1
        assert jobs[0].title == "Principal Kubernetes Architect"
        assert jobs[0].company == "Tech Corp"
        assert jobs[0].salary.estimated is True
        assert jobs[0].salary.min_amount == 160000.0

