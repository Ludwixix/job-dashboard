import json
from unittest.mock import patch

import pytest

from job_dashboard.sources import (
    IndeedJobSpySource,
    SearchQuery,
    SeekApiSource,
    SeekUnavailableError,
)


def test_seek_tier1_api_success():
    class ApiSuccessSeek(SeekApiSource):
        def _search_api(self, query):
            yield {"id": "seek-api-01", "title": "API Position", "url": "https://seek.com.au/1"}

    source = ApiSuccessSeek()
    jobs = list(source.search(SearchQuery("devops")))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "seek-api-01"


def test_seek_tier2_browser_fallback():
    class ApiFailingSeek(SeekApiSource):
        def _search_api(self, query):
            raise RuntimeError("403 Forbidden")

        def _search_browser(self, query):
            yield {"id": "seek-browser-01", "title": "Browser Position", "url": "https://seek.com.au/2"}

    source = ApiFailingSeek(allow_browser_fallback=True)
    jobs = list(source.search(SearchQuery("devops")))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "seek-browser-01"


def test_seek_tier3_cache_fallback(tmp_path):
    cache_file = tmp_path / "seek_cache.json"
    cache_file.write_text(json.dumps([
        {
            "id": "seek-cache-01",
            "title": "Cloud Architect",
            "company": "Enterprise Corp",
            "location": "Melbourne VIC",
            "url": "https://seek.com.au/3",
            "posted": "1d ago",
            "tags": ["cloud"],
        }
    ]))

    class BothFailingSeek(SeekApiSource):
        def _search_api(self, query):
            raise RuntimeError("403 Forbidden")

        def _search_browser(self, query):
            raise RuntimeError("Cloudflare challenge")

    source = BothFailingSeek(
        allow_browser_fallback=True,
        cache_path=cache_file,
        allow_cache_fallback=True,
    )
    jobs = list(source.search(SearchQuery("cloud")))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "seek-cache-01"


def test_seek_tier4_cross_source_fallback():
    class AllDirectFailingSeek(SeekApiSource):
        def _search_api(self, query):
            raise RuntimeError("403")

        def _search_browser(self, query):
            raise RuntimeError("blocked")

        def _search_cross_source(self, query):
            yield {"id": "gateway-01", "title": "Alternative Gateway Role", "url": "https://jobs.example.com/1"}

    source = AllDirectFailingSeek(
        allow_browser_fallback=True,
        allow_cache_fallback=False,
        allow_cross_source_fallback=True,
    )
    jobs = list(source.search(SearchQuery("cloud")))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "gateway-01"


def test_indeed_fallback_chain():
    class FallbackIndeed(IndeedJobSpySource):
        def _search_jobspy(self, query):
            raise RuntimeError("JobSpy 429 rate limit")

        def _search_embedded_json(self, query):
            raise RuntimeError("Cloudflare 403")

        def _search_browser(self, query):
            yield {"id": "indeed-browser-01", "title": "Stealth Indeed Job", "url": "https://au.indeed.com/viewjob?jk=abc"}

    source = FallbackIndeed(browser_fallback=True)
    jobs = list(source.search(SearchQuery("sysadmin")))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "indeed-browser-01"
