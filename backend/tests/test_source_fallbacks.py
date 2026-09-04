import json

import pytest

from job_dashboard.sources import (
    SearchQuery,
    SeekApiSource,
    SeekUnavailableError,
    ensure_descriptions,
)


class BlockedSeek(SeekApiSource):
    def _search_api(self, query):
        raise RuntimeError("403")


class BrowserAndApiBlockedSeek(SeekApiSource):
    def _search_api(self, query):
        raise RuntimeError("403")

    def _search_browser(self, query):
        raise RuntimeError("browser unavailable")


def test_seek_does_not_bypass_api_block_with_browser():
    with pytest.raises(SeekUnavailableError, match="public API unavailable"):
        list(BlockedSeek().search(SearchQuery("cloud engineer")))


def test_missing_description_gets_useful_fallback():
    jobs = ensure_descriptions([{"title": "Service Desk Analyst", "company": "Acme", "location": "Melbourne"}])
    assert jobs[0]["description"] == "Service Desk Analyst at Acme in Melbourne."


def test_seek_uses_cache_after_api_and_browser_fail(tmp_path):
    cache_path = tmp_path / "seek.json"
    cache_path.write_text(json.dumps({"jobs": [{
        "id": "123",
        "title": "Cloud Engineer",
        "company": "Acme",
        "location": "Melbourne",
        "url": "https://www.seek.com.au/job/123",
        "description": "Azure platform work",
        "tags": ["cloud"],
        "posted": "2d ago",
    }]}))
    source = BrowserAndApiBlockedSeek(
        allow_browser_fallback=True,
        cache_path=cache_path,
        allow_cache_fallback=True,
    )

    jobs = list(source.search(SearchQuery("cloud")))

    assert len(jobs) == 1
    assert jobs[0]["id"] == "123"
    assert jobs[0]["source"] == "Seek"


def test_seek_does_not_use_cache_after_api_success(tmp_path):
    class SuccessfulSeek(SeekApiSource):
        def _search_api(self, query):
            yield {"id": "api-1", "title": "API job"}

        def _search_cache(self, query):
            raise AssertionError("cache should not be read after API success")

    source = SuccessfulSeek(cache_path=tmp_path / "unused.json", allow_cache_fallback=True)

    assert [job["id"] for job in source.search(SearchQuery("cloud"))] == ["api-1"]


def test_seek_cache_fallback_ignores_stale_and_undated_records(tmp_path):
    cache_path = tmp_path / "seek.json"
    cache_path.write_text(json.dumps({"jobs": [
        {"id": "fresh", "title": "Cloud Engineer", "company": "Acme", "location": "Melbourne", "url": "https://seek.test/fresh", "description": "Azure platform work", "posted": "2d ago"},
        {"id": "old", "title": "Cloud Engineer", "company": "Acme", "location": "Melbourne", "url": "https://seek.test/old", "description": "Azure platform work", "posted": "30d ago"},
        {"id": "badge", "title": "Cloud Engineer", "company": "Acme", "location": "Melbourne", "url": "https://seek.test/badge", "description": "Azure platform work", "posted": "Featured"},
    ]}))
    source = BrowserAndApiBlockedSeek(
        allow_browser_fallback=False,
        cache_path=cache_path,
        allow_cache_fallback=True,
    )

    jobs = list(source.search(SearchQuery("cloud")))

    assert [job["id"] for job in jobs] == ["fresh"]
