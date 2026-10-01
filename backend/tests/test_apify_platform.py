"""Unit and integration tests for unified multi-platform Apify scraper adapters and endpoints."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from job_dashboard.models import JobRecord
from job_dashboard.sources import (
    DEFAULT_APIFY_ACTORS,
    ApifyPlatformSource,
    JobSource,
    SearchQuery,
    build_apify_run_input,
    normalize_apify_job_record,
    test_apify_token as validate_apify_token,
)
from job_dashboard.web import DashboardApp


class MockSource(JobSource):
    name = "MockNative"

    def __init__(self, items=None, error=None):
        self.items = items or []
        self.error = error

    def search(self, query):
        if self.error:
            raise self.error
        return self.items


def test_default_actors_defined_for_all_major_platforms():
    assert "seek" in DEFAULT_APIFY_ACTORS
    assert "indeed" in DEFAULT_APIFY_ACTORS
    assert "linkedin" in DEFAULT_APIFY_ACTORS
    assert "adzuna" in DEFAULT_APIFY_ACTORS
    assert DEFAULT_APIFY_ACTORS["seek"] == "automation-lab/seek-scraper"
    assert DEFAULT_APIFY_ACTORS["indeed"] == "misceres/indeed-scraper"
    assert (
        DEFAULT_APIFY_ACTORS["linkedin"] == "curious_coder/linkedin-job-search-scraper"
    )


def test_build_apify_run_input():
    query = SearchQuery(term="Senior Cloud Engineer", location="Melbourne, VIC")

    # Seek input
    seek_inp = build_apify_run_input("seek", query, max_results=25)
    assert seek_inp["keywords"] == ["Senior Cloud Engineer"]
    assert "Melbourne" in seek_inp["location"]
    assert seek_inp["maxResults"] == 25
    assert seek_inp["fetchJobDetails"] is True

    # Indeed input
    indeed_inp = build_apify_run_input("indeed", query, max_results=15)
    assert indeed_inp["position"] == "Senior Cloud Engineer"
    assert indeed_inp["country"] == "AU"
    assert indeed_inp["maxItems"] == 15

    # LinkedIn input
    li_inp = build_apify_run_input("linkedin", query, max_results=30)
    assert li_inp["keywords"] == "Senior Cloud Engineer"
    assert li_inp["count"] == 30

    # Custom / other input
    custom_inp = build_apify_run_input("adzuna", query, max_results=20)
    assert custom_inp["query"] == "Senior Cloud Engineer"
    assert custom_inp["maxResults"] == 20


def test_normalize_apify_seek_record():
    query = SearchQuery(term="Systems Engineer", location="Melbourne")
    raw_seek = {
        "id": "78912345",
        "title": "Senior Systems Engineer",
        "advertiserName": "Melbourne IT Cloud Corp",
        "location": "Melbourne VIC",
        "salary": "$150,000 - $170,000 + Super",
        "listingDate": "2026-09-28T04:12:00Z",
        "fullDescription": "Manage hybrid cloud infrastructure with Terraform and Entra ID.",
        "workType": "Full time",
    }
    normalized = normalize_apify_job_record(raw_seek, "seek", query)
    assert normalized is not None
    assert normalized["id"] == "seek-78912345"
    assert normalized["title"] == "Senior Systems Engineer"
    assert normalized["company"] == "Melbourne IT Cloud Corp"
    assert normalized["url"] == "https://www.seek.com.au/job/78912345"
    assert normalized["salary"] == "$150,000 - $170,000 + Super"
    assert normalized["salary_min"] == 150000
    assert normalized["salary_bracket"]["min_amount"] == 150000


def test_normalize_apify_indeed_record():
    query = SearchQuery(term="Cloud Architect", location="Sydney")
    raw_indeed = {
        "jobKey": "ind-abc-999",
        "positionName": "Lead Cloud Solutions Architect",
        "company": "Enterprise Banking Group",
        "formattedLocation": "Sydney NSW",
        "salaryText": "$190,000 per year",
        "date": "2026-09-29",
        "snippet": "Design resilient AWS and Kubernetes clusters across enterprise portfolios.",
        "link": "https://au.indeed.com/viewjob?jk=ind-abc-999",
    }
    normalized = normalize_apify_job_record(raw_indeed, "indeed", query)
    assert normalized is not None
    assert normalized["id"] == "indeed-ind-abc-999"
    assert normalized["title"] == "Lead Cloud Solutions Architect"
    assert normalized["company"] == "Enterprise Banking Group"
    assert normalized["source"] == "Indeed"
    assert normalized["scraper_backend"] == "apify"


def test_normalize_apify_linkedin_record():
    query = SearchQuery(term="DevOps Lead", location="Melbourne")
    raw_li = {
        "jobId": "384729102",
        "title": "Principal DevOps Lead",
        "companyName": "Canva",
        "location": "Remote / Melbourne",
        "jobUrl": "https://www.linkedin.com/jobs/view/384729102",
        "description": "Lead multi-region Terraform pipelines and developer platform stability.",
        "postedDate": "2 days ago",
    }
    normalized = normalize_apify_job_record(raw_li, "linkedin", query)
    assert normalized is not None
    assert normalized["id"] == "linkedin-384729102"
    assert normalized["title"] == "Principal DevOps Lead"
    assert normalized["company"] == "Canva"
    assert normalized["source"] == "LinkedIn"
    assert normalized["work_mode"] == "remote"


def test_validate_apify_token():
    # Empty token fails
    assert validate_apify_token("") == {
        "success": False,
        "error": "API token is required",
    }

    # Mocked 200 response
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "id": "user_xyz",
                "username": "australian_dev",
                "plan": {"name": "Personal"},
            }
        }
        mock_get.return_value = mock_resp

        res = validate_apify_token("valid_token_123")
        assert res["success"] is True
        assert res["username"] == "australian_dev"
        assert res["plan"] == "Personal"

    # Mocked 401 response
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.json.return_value = {"error": {"message": "Token not found"}}
        mock_get.return_value = mock_resp

        res = validate_apify_token("invalid_token")
        assert res["success"] is False
        assert "Token not found" in res["error"]


def test_apify_platform_source_primary_mode():
    query = SearchQuery(term="Senior Admin", location="Melbourne")
    source = ApifyPlatformSource(
        platform="seek",
        api_token="test_tok",
        mode="primary",
    )

    fake_items = [
        {
            "id": "111",
            "title": "Senior Systems Admin",
            "company": "Gov Agency",
            "location": "Melbourne",
            "url": "https://www.seek.com.au/job/111",
        }
    ]
    with patch.object(source, "_call_actor", return_value=fake_items):
        results = list(source.search(query))
        assert len(results) == 1
        assert results[0]["id"] == "seek-111"
        assert results[0]["scraper_backend"] == "apify"


def test_apify_platform_source_fallback_mode():
    query = SearchQuery(term="Senior Admin", location="Melbourne")
    native_fail = MockSource(error=RuntimeError("Cloudflare captcha blocked"))
    source = ApifyPlatformSource(
        platform="seek",
        api_token="test_tok",
        mode="fallback",
        native_source=native_fail,
    )

    fake_items = [
        {
            "id": "222",
            "title": "Senior SysAdmin",
            "company": "Healthcare VIC",
            "url": "https://www.seek.com.au/job/222",
        }
    ]
    with patch.object(source, "_call_actor", return_value=fake_items):
        results = list(source.search(query))
        assert len(results) == 1
        assert results[0]["id"] == "seek-222"
        assert results[0]["scraper_backend"] == "apify"


def test_dashboard_app_get_sources_for_scrape():
    app = DashboardApp()
    app.sources = [
        MockSource(items=[]),
    ]
    app.sources[0].name = "Seek"

    # 1. Without Apify settings: returns original native source
    sources_default = app.get_sources_for_scrape("test_user")
    assert len(sources_default) == 1
    assert sources_default[0].name == "Seek"
    assert not isinstance(sources_default[0], ApifyPlatformSource)

    # 2. With Apify settings enabled for Seek in user preferences
    mock_prefs = {
        "apify_settings": {
            "api_token": "apify_tok_secret",
            "platforms": {
                "seek": {
                    "enabled": True,
                    "mode": "primary",
                    "actor_id": "custom/seek-scraper",
                    "max_results": 25,
                }
            },
        }
    }
    with patch.object(app.repository, "get_user_preferences", return_value=mock_prefs):
        sources_apify = app.get_sources_for_scrape("test_user")
        assert len(sources_apify) == 1
        assert isinstance(sources_apify[0], ApifyPlatformSource)
        assert sources_apify[0].actor_id == "custom/seek-scraper"
        assert sources_apify[0].api_token == "apify_tok_secret"


def test_sanitize_apify_actor_id():
    from job_dashboard.sources.apify_platform import sanitize_apify_actor_id

    # Pure slug
    assert (
        sanitize_apify_actor_id("websift/seek-job-scraper")
        == "websift/seek-job-scraper"
    )
    # Pure ID
    assert sanitize_apify_actor_id("m7tdxsBaMKJhIu4fM") == "m7tdxsBaMKJhIu4fM"
    # actors/ prefix from console URL path
    assert sanitize_apify_actor_id("actors/m7tdxsBaMKJhIu4fM") == "m7tdxsBaMKJhIu4fM"
    # Full console URL
    url = "https://console.apify.com/actors/m7tdxsBaMKJhIu4fM/input?addFromActorId=m7tdxsBaMKJhIu4fM"
    assert sanitize_apify_actor_id(url) == "m7tdxsBaMKJhIu4fM"
    # Empty or whitespace
    assert sanitize_apify_actor_id("   ") == ""
    assert sanitize_apify_actor_id(None) == ""


def test_normalize_websift_seek_scraper_payload():
    query = SearchQuery(term="Systems Engineer", location="Melbourne")
    raw_item = {
        "id": "86136632",
        "jobLink": "https://www.seek.com.au/job/86136632",
        "title": "Senior Cloud Systems Engineer",
        "salary": "$140,000 - $160,000",
        "workArrangements": "Hybrid",
        "listedAt": "2026-09-28T04:00:00.000Z",
        "joblocationInfo": {
            "displayLocation": "Melbourne VIC",
            "location": "Melbourne",
        },
        "advertiser": {
            "name": "Acme Cloud Solutions",
        },
        "content": {
            "unEditedContent": "<p>Lead AWS and Linux infrastructure migrations.</p>",
        },
    }
    rec = normalize_apify_job_record(raw_item, "seek", query)
    assert rec is not None
    assert rec["id"] == "seek-86136632"
    assert rec["title"] == "Senior Cloud Systems Engineer"
    assert rec["company"] == "Acme Cloud Solutions"
    assert rec["location"] == "Melbourne VIC"
    assert rec["url"] == "https://www.seek.com.au/job/86136632"
    assert rec["posted"] == "2026-09-28"
    assert "Acme Cloud Solutions" in rec["company"]
