from __future__ import annotations

from typing import Any

import pytest

from job_dashboard.sources.apify_seek import (
    ApifySeekFallbackSource,
    configure_apify_seek_fallback,
)
from job_dashboard.sources.base import ScrapePipeline, SearchQuery, SeekUnavailableError


class FakeNativeSeek:
    name = "Seek"

    def __init__(self, result=None, error=None):
        self.result = result or []
        self.error = error

    def search(self, query):
        if self.error:
            raise self.error
        return self.result


class FakeDataset:
    def __init__(self, items):
        self.items = items

    def iterate_items(self):
        yield from self.items


class FakeApifyClient:
    def __init__(self, items):
        self.items = items
        self.actor_id = None
        self.run_input = None
        self.timeout_secs = None
        self.call_count = 0

    def actor(self, actor_id):
        self.actor_id = actor_id
        return self

    def call(self, run_input: dict[str, Any], *, timeout_secs: int):
        self.call_count += 1
        self.run_input = run_input
        self.timeout_secs = timeout_secs
        return {"defaultDatasetId": "dataset-1"}

    def dataset(self, dataset_id):
        assert dataset_id == "dataset-1"
        return FakeDataset(self.items)


def test_apify_fallback_runs_only_after_native_seek_unavailable():
    client = FakeApifyClient(
        [
            {
                "id": "91129270",
                "url": "https://www.seek.com.au/job/91129270",
                "title": "Senior Software Engineer",
                "company": "Example Pty Ltd",
                "location": "Melbourne VIC",
                "shortDescription": "Build reliable platform services.",
                "fullDescription": "<p>Build reliable platform services.</p>",
                "listingDate": "2026-09-24T00:00:00Z",
                "salary": "$140,000 - $170,000 per year",
                "workType": "Full time",
            }
        ]
    )
    source = ApifySeekFallbackSource(
        native_source=FakeNativeSeek(error=SeekUnavailableError("blocked")),
        api_token="test-token",
        actor_id="automation-lab/seek-scraper",
        max_results=20,
        timeout_secs=55,
        client=client,
    )

    records = list(source.search(SearchQuery("software engineer", "Melbourne VIC")))

    assert client.call_count == 1
    assert client.actor_id == "automation-lab/seek-scraper"
    assert client.run_input == {
        "keywords": ["software engineer"],
        "location": "Melbourne VIC",
        "maxResults": 20,
        "fetchJobDetails": False,
    }
    assert client.timeout_secs == 55
    assert records[0]["id"] == "seek-91129270"
    assert records[0]["source"] == "Seek"
    assert records[0]["scraper_backend"] == "apify"
    assert records[0]["salary_min"] == 140000
    assert "Build reliable platform services." in records[0]["description"]


def test_native_seek_results_do_not_start_paid_actor():
    client = FakeApifyClient([])
    source = ApifySeekFallbackSource(
        native_source=FakeNativeSeek(result=[{"id": "seek-1", "title": "Engineer"}]),
        api_token="test-token",
        client=client,
    )

    assert list(source.search(SearchQuery("engineer"))) == [
        {"id": "seek-1", "title": "Engineer"}
    ]
    assert client.call_count == 0


def test_unexpected_native_seek_error_does_not_spend_apify_credits():
    client = FakeApifyClient([])
    source = ApifySeekFallbackSource(
        native_source=FakeNativeSeek(error=ValueError("normalizer defect")),
        api_token="test-token",
        client=client,
    )

    with pytest.raises(ValueError, match="normalizer defect"):
        list(source.search(SearchQuery("engineer")))
    assert client.call_count == 0


def test_apify_result_rejects_lookalike_seek_hostname():
    from job_dashboard.sources.apify_seek import _apify_seek_record

    record = _apify_seek_record(
        {
            "id": "91129270",
            "url": "https://evilseek.com.au/job/91129270",
            "title": "Engineer",
            "company": "Example",
        },
        SearchQuery("engineer"),
    )

    assert record is None


def test_apify_fallback_is_disabled_without_token_and_does_not_import_client():
    source = ApifySeekFallbackSource(
        native_source=FakeNativeSeek(error=SeekUnavailableError("blocked")),
        api_token=None,
    )

    with pytest.raises(SeekUnavailableError, match="blocked"):
        list(source.search(SearchQuery("engineer")))


def test_apify_wrapper_requires_explicit_enablement_and_token():
    native = FakeNativeSeek()

    assert configure_apify_seek_fallback(
        native, enabled=False, api_token="token"
    ) is native
    assert configure_apify_seek_fallback(
        native, enabled=True, api_token=None
    ) is native

    wrapped = configure_apify_seek_fallback(
        native, enabled=True, api_token="token", max_results=20
    )
    assert isinstance(wrapped, ApifySeekFallbackSource)
    assert wrapped.max_results == 20


def test_apify_configuration_is_opt_in_and_bounded(monkeypatch):
    from job_dashboard.config import Settings

    monkeypatch.setenv("JOB_DASHBOARD_APIFY_SEEK_ENABLED", "true")
    monkeypatch.setenv("APIFY_API_TOKEN", "test-token")
    monkeypatch.setenv("JOB_DASHBOARD_APIFY_SEEK_ACTOR_ID", "automation-lab/seek-scraper")
    monkeypatch.setenv("JOB_DASHBOARD_APIFY_SEEK_MAX_RESULTS", "500")
    monkeypatch.setenv("JOB_DASHBOARD_APIFY_SEEK_TIMEOUT_SECS", "55")

    settings = Settings()

    assert settings.apify_seek_enabled is True
    assert settings.apify_api_token == "test-token"
    assert settings.apify_seek_actor_id == "automation-lab/seek-scraper"
    assert settings.apify_seek_max_results == 50
    assert settings.apify_seek_timeout_secs == 55


def test_pipeline_uses_fallback_sources_bounded_timeout(monkeypatch):
    observed_timeouts = []

    class FakeFuture:
        def result(self, timeout=None):
            observed_timeouts.append(timeout)
            return []

    class FakeExecutor:
        def __init__(self, max_workers):
            assert max_workers == 1

        def submit(self, function, *args):
            return FakeFuture()

        def shutdown(self, wait=False, cancel_futures=False):
            return None

    class BoundedSource:
        name = "Seek"
        source_timeout = 75

        def search(self, query):
            return []

    monkeypatch.setattr(
        "job_dashboard.sources.base.concurrent.futures.ThreadPoolExecutor",
        FakeExecutor,
    )
    ScrapePipeline([BoundedSource()], source_timeout=12).run(
        [SearchQuery("engineer")]
    )

    assert observed_timeouts == [75]


def test_coordinator_budget_includes_apify_source_timeout():
    from job_dashboard.scrape_coordinator import ScrapeCoordinator

    class NativeSource:
        name = "SeekNative"

    native = NativeSource()
    fallback = FakeNativeSeek()
    fallback.source_timeout = 75

    assert ScrapeCoordinator.pipeline_timeout([native, fallback], 12) == 92


def test_cli_seek_factory_wraps_native_source_only_when_enabled(monkeypatch):
    from job_dashboard.config import settings
    from job_dashboard.scrape import build_sources
    from job_dashboard.sources.seek import SeekApiSource

    monkeypatch.setattr(settings, "apify_seek_enabled", False)
    monkeypatch.setattr(settings, "apify_api_token", "test-token")
    assert isinstance(build_sources(["seek"])[0], SeekApiSource)

    monkeypatch.setattr(settings, "apify_seek_enabled", True)
    monkeypatch.setattr(settings, "apify_api_token", "test-token")
    monkeypatch.setattr(settings, "apify_seek_actor_id", "automation-lab/seek-scraper")
    wrapped = build_sources(["seek"])[0]
    assert isinstance(wrapped, ApifySeekFallbackSource)
    assert isinstance(wrapped.native_source, SeekApiSource)


def test_production_launcher_uses_configured_apify_seek_fallback(monkeypatch):
    from job_dashboard.config import settings
    from job_dashboard.run_server import _build_seek_source
    from job_dashboard.sources.seek import SeekApiSource

    monkeypatch.setattr(settings, "seek_max_pages", 2)
    monkeypatch.setattr(settings, "seek_max_results", 30)
    monkeypatch.setattr(settings, "seek_pause_seconds", 0.0)
    monkeypatch.setattr(settings, "seek_api_endpoint", None)
    monkeypatch.setattr(settings, "seek_browser_fallback", False)
    monkeypatch.setattr(settings, "stealth_browser_enabled", False)
    monkeypatch.setattr(settings, "seek_cache_path", None)
    monkeypatch.setattr(settings, "seek_cache_fallback", False)
    monkeypatch.setattr(settings, "multi_board_enabled", False)
    monkeypatch.setattr(settings, "proxy_url", None)
    monkeypatch.setattr(settings, "apify_seek_enabled", True)
    monkeypatch.setattr(settings, "apify_api_token", "test-token")
    monkeypatch.setattr(settings, "apify_seek_actor_id", "automation-lab/seek-scraper")
    monkeypatch.setattr(settings, "apify_seek_max_results", 20)
    monkeypatch.setattr(settings, "apify_seek_timeout_secs", 55)

    source = _build_seek_source()

    assert isinstance(source, ApifySeekFallbackSource)
    assert isinstance(source.native_source, SeekApiSource)