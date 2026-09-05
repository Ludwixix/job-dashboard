import json
from unittest.mock import patch, MagicMock
import pytest

from job_dashboard.sources.seek import (
    extract_seek_description_from_html,
    fetch_seek_job_description,
    extract_seek_job_id,
)


def test_extract_seek_job_id():
    assert extract_seek_job_id("https://www.seek.com.au/job/93979774") == "93979774"
    assert extract_seek_job_id("https://au.seek.com/job/93979774?type=standard&ref=search#sol=123") == "93979774"
    assert extract_seek_job_id("seek-93979774") == "93979774"
    assert extract_seek_job_id("93979774") == "93979774"
    assert extract_seek_job_id("https://indeed.com/viewjob?jk=abc") is None


def test_extract_seek_description_from_redux():
    sample_redux = {
        "jobdetails": {
            "result": {
                "job": {
                    "abstract": "Short teaser here",
                    "content": "<h2>Role Overview</h2><p>We are seeking an experienced <strong>Systems Engineer</strong> to lead our team.</p><ul><li>Key duty 1</li><li>Key duty 2</li></ul>"
                }
            }
        }
    }
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <script>
    window.SEEK_REDUX_DATA = {json.dumps(sample_redux)};
    window.SEEK_OTHER_DATA = {{}};
    </script>
    </head>
    <body><div>Some page content</div></body>
    </html>
    """
    desc = extract_seek_description_from_html(html)
    assert "Role Overview" in desc
    assert "Systems Engineer" in desc
    assert "• Key duty 1" in desc
    assert "• Key duty 2" in desc


def test_extract_seek_description_from_dom_attribute():
    html = """
    <div class="ad-container">
      <div data-automation="jobAdDetails" class="_123">
        <h2>About the Role</h2>
        <p>This is a critical infrastructure position responsible for M365 and Azure deployments.</p>
        <ul>
          <li>Design hybrid network topology</li>
          <li>Automate PowerShell deployments</li>
        </ul>
      </div>
    </div>
    """
    desc = extract_seek_description_from_html(html)
    assert "About the Role" in desc
    assert "M365 and Azure deployments" in desc
    assert "• Design hybrid network topology" in desc


def test_fetch_seek_job_description_http_mocked():
    sample_html = """
    <script>
    window.SEEK_REDUX_DATA = {"jobdetails":{"result":{"job":{"content":"<p>Detailed Cloud Engineer duties and salary benefits.</p>"}}}};
    </script>
    """
    with patch("urllib.request.OpenerDirector.open") as mock_open:
        mock_response = MagicMock()
        mock_response.read.return_value = sample_html.encode("utf-8")
        mock_open.return_value.__enter__.return_value = mock_response

        desc = fetch_seek_job_description("https://www.seek.com.au/job/94061629", allow_browser_fallback=False)
        assert "Detailed Cloud Engineer duties and salary benefits." in desc


def test_update_job_description_in_repository(tmp_path):
    from job_dashboard.repository import JobRepository
    repo = JobRepository(str(tmp_path / "test.db"))

    raw_jobs = [{
        "id": "seek-94061629",
        "title": "Systems Engineer",
        "company": "Tech Corp",
        "location": "Melbourne",
        "url": "https://www.seek.com.au/job/94061629",
        "description": "Short teaser",
    }]
    repo.upsert_scraped_jobs(raw_jobs)
    job = repo.get_job("seek-94061629")
    assert job["description"] == "Short teaser"

    updated = repo.update_job_description("seek-94061629", "Comprehensive detailed description of duties and requirements")
    assert updated is True

    job_after = repo.get_job("seek-94061629")
    assert "Comprehensive detailed description" in job_after["description"]


def test_job_description_endpoint(tmp_path):
    import io
    from job_dashboard.repository import JobRepository
    from job_dashboard.web import make_handler, DashboardApp

    repo = JobRepository(str(tmp_path / "test.db"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo

    long_desc = "A" * 400
    repo.upsert_scraped_jobs([{
        "id": "job-cached",
        "title": "Cloud Architect",
        "company": "Cloud Co",
        "url": "https://example.com/job/1",
        "description": long_desc,
    }])

    repo.upsert_scraped_jobs([{
        "id": "job-seek-short",
        "title": "DevOps Engineer",
        "company": "DevOps Co",
        "url": "https://www.seek.com.au/job/94061629",
        "description": "Short teaser",
    }])

    handler_cls = make_handler(app)

    # 1. Test cached return for long description
    handler = handler_cls.__new__(handler_cls)
    handler.path = "/api/job-description?job_id=job-cached"
    handler.headers = {}
    handler.rfile = io.BytesIO()
    handler.wfile = io.BytesIO()
    handler.client_address = ("127.0.0.1", 12345)
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()

    handler.do_GET()
    payload = json.loads(handler.wfile.getvalue().decode("utf-8"))
    assert payload["success"] is True
    assert payload["cached"] is True
    assert payload["description"] == long_desc

    # 2. Test enrichment trigger for short description
    with patch("job_dashboard.web.fetch_seek_job_description") as mock_fetch:
        mock_fetch.return_value = "Detailed Seek ad responsibilities and requirements spanning multiple lines."

        handler2 = handler_cls.__new__(handler_cls)
        handler2.path = "/api/job-description?job_id=job-seek-short"
        handler2.headers = {}
        handler2.rfile = io.BytesIO()
        handler2.wfile = io.BytesIO()
        handler2.client_address = ("127.0.0.1", 12345)
        handler2.send_response = MagicMock()
        handler2.send_header = MagicMock()
        handler2.end_headers = MagicMock()

        handler2.do_GET()
        payload2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
        assert payload2["success"] is True
        assert payload2["enriched"] is True
        assert "Detailed Seek ad" in payload2["description"]

        # Verify persisted in database
        persisted = repo.get_job("job-seek-short")
        assert "Detailed Seek ad" in persisted["description"]

