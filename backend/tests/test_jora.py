"""Tests for Jora Australia scraper adapter and anti-403 resilience."""

import os
from unittest.mock import MagicMock, patch
import pytest

from job_dashboard.sources.base import SearchQuery
from job_dashboard.sources.jora import JoraSource
from job_dashboard.sources.resilience import (
    CloudflareChallengeError,
    domain_cooldown_tracker,
)


@pytest.fixture(autouse=True)
def reset_cooldowns():
    domain_cooldown_tracker.clear()
    yield
    domain_cooldown_tracker.clear()


SAMPLE_JORA_HTML = """
<!DOCTYPE html>
<html>
<head><title>Python Jobs in Melbourne VIC - Jora</title></head>
<body>
    <div id="jobresults">
        <div class="result -job">
            <div class="job-item">
                <a class="job-link" href="/job/Senior-Python-Engineer-1234567890abcdef1234567890abcdef?sp=serp">
                    Senior Python Engineer
                </a>
                <span class="job-company">Canva Australia</span>
                <span class="job-location">Melbourne VIC</span>
                <span class="badge -salary">$160,000 - $185,000 per year</span>
                <div class="job-abstract">
                    Lead backend architecture initiatives utilizing Python, FastAPI, and Kubernetes.
                </div>
                <span class="job-listed-date">2 days ago</span>
            </div>
        </div>
        <div class="result -job">
            <div class="job-item">
                <a class="job-link" href="https://au.jora.com/job/DevOps-Cloud-Engineer-abcdef1234567890abcdef1234567890?sp=serp">
                    DevOps Cloud Engineer (WFH)
                </a>
                <span class="job-company">Atlassian</span>
                <span class="job-location">Remote, Australia</span>
                <span class="badge -salary">$175k</span>
                <div class="job-abstract">
                    Manage Terraform, AWS infrastructure, and continuous deployment pipelines.
                </div>
                <span class="job-listed-date">today</span>
            </div>
        </div>
    </div>
</body>
</html>
"""


def test_jora_source_mock_mode():
    """Verify that JoraSource returns normalized fixtures when mock mode is enabled."""
    with patch.dict(os.environ, {"MOCK_SCRAPERS": "true"}):
        source = JoraSource()
        query = SearchQuery(term="DevOps", location="Melbourne VIC")
        results = source.search(query)
        assert len(results) == 2
        assert results[0]["source"] == "Jora"
        assert "Devops" in results[0]["title"]
        assert results[0]["id"].startswith("jora-")
        assert results[0]["salary_bracket"] is not None


def test_jora_html_parsing():
    """Verify that Jora HTML parser correctly extracts structured fields."""
    source = JoraSource()
    query = SearchQuery(term="Python", location="Melbourne VIC")

    jobs = source._parse_html(SAMPLE_JORA_HTML, query)
    assert len(jobs) == 2

    # Job 1 verification
    j1 = jobs[0]
    assert j1["title"] == "Senior Python Engineer"
    assert j1["company"] == "Canva Australia"
    assert j1["location"] == "Melbourne VIC"
    assert "$160,000" in j1["salary"]
    assert "FastAPI" in j1["description"]
    assert j1["source"] == "Jora"
    assert (
        j1["url"]
        == "https://au.jora.com/job/Senior-Python-Engineer-1234567890abcdef1234567890abcdef"
    )
    assert j1["id"] == "jora-1234567890abcdef1234567890abcdef"

    # Job 2 verification (Remote detection)
    j2 = jobs[1]
    assert j2["title"] == "DevOps Cloud Engineer (WFH)"
    assert j2["company"] == "Atlassian"
    assert j2["remote"] is True
    assert "remote" in j2["tags"]


def test_jora_cooldown_triggers_apify_fallback():
    """Verify that an active anti-403 cooldown bypasses native scraping and routes to Apify."""
    domain_cooldown_tracker.mark_blocked("au.jora.com", cooldown_secs=300)
    assert domain_cooldown_tracker.is_cooldown_active("au.jora.com") is True

    source = JoraSource(apify_fallback_enabled=True, apify_token="apify_mock_token")
    query = SearchQuery(term="Site Reliability Engineer", location="Sydney NSW")

    with patch.object(
        source,
        "_search_apify_fallback",
        return_value=[{"id": "jora-apify-1", "title": "SRE"}],
    ) as mock_apify:
        results = source.search(query)
        mock_apify.assert_called_once_with(query)
        assert len(results) == 1
        assert results[0]["id"] == "jora-apify-1"


def test_jora_cloudflare_block_activates_cooldown_and_fallback():
    """Verify that a CloudflareChallengeError marks the domain on cooldown and escalates."""
    source = JoraSource(apify_fallback_enabled=True, apify_token="apify_mock_token")
    query = SearchQuery(term="Cloud Architect", location="Melbourne VIC")

    with patch.object(
        source,
        "_search_native",
        side_effect=CloudflareChallengeError(
            "au.jora.com", 403, "Turnstile intercepted"
        ),
    ):
        with patch.object(
            source,
            "_search_apify_fallback",
            return_value=[{"id": "jora-fallback-1", "title": "Cloud Architect"}],
        ) as mock_apify:
            results = source.search(query)
            assert len(results) == 1
            assert results[0]["id"] == "jora-fallback-1"
            mock_apify.assert_called_once_with(query)
