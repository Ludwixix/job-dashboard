import json
from datetime import datetime, timezone

from job_dashboard.models import Job
from job_dashboard.score import score_job
from job_dashboard.sources import (
    AdzunaApiSource,
    RemoteOkApiSource,
    ScrapePipeline,
    SearchQuery,
    deduplicate_jobs,
    is_recent,
    normalize_posted_date,
    posted_age,
)


class FakeSource:
    name = "fake"

    def __init__(self, jobs):
        self.jobs = jobs

    def search(self, query):
        return [{**job, "tags": [query.term]} for job in self.jobs]


class PartialSource:
    name = "partial"

    def search(self, query):
        if query.term == "broken":
            raise RuntimeError("provider unavailable")
        return [{"title": "Cloud Engineer", "company": "Acme", "url": "https://acme/jobs/1", "posted": "2026-08-24"}]


def test_pipeline_filters_recent_and_deduplicates_sources():
    jobs = [
        {"title": "Cloud Engineer", "company": "Acme", "url": "https://acme/jobs/1", "posted": "2026-08-24"},
        {"title": "Cloud Engineer", "company": "Acme", "url": "https://acme/jobs/1", "posted": "2026-08-24"},
        {"title": "Old Role", "company": "Acme", "url": "https://acme/jobs/2", "posted": "2020-01-01"},
    ]
    pipeline = ScrapePipeline([FakeSource(jobs)], days=14)
    result = pipeline.run([SearchQuery("cloud")])
    assert len(result) == 1
    assert result[0]["title"] == "Cloud Engineer"


def test_recent_accepts_missing_and_iso_dates():
    now = datetime(2026, 8, 25, tzinfo=timezone.utc)
    assert is_recent({}, now=now)
    assert is_recent({"posted": "2026-08-20T12:00:00Z"}, now=now)
    assert not is_recent({"posted": "2026-07-01"}, now=now)


def test_relative_seek_dates_are_normalized_and_age_checked():
    now = datetime(2026, 8, 25, tzinfo=timezone.utc)
    assert normalize_posted_date("28d ago", now) == "2026-07-28"
    assert normalize_posted_date("2d ago", now) == "2026-08-23"
    assert not is_recent({"posted": "28d ago"}, days=14, now=now)
    assert is_recent({"posted": "2d ago"}, days=14, now=now)
    assert posted_age("10d ago", now) == "Posted 10 days ago"


def test_dedupe_merges_tags():
    result = deduplicate_jobs([
        {"title": "Role", "company": "Co", "url": "https://x", "source": "Indeed", "tags": ["one"]},
        {"title": "Role", "company": "Co", "url": "https://y", "source": "LinkedIn", "tags": ["two"]},
    ])
    assert result[0]["source"] == "LinkedIn"
    assert result[0]["tags"] == ["one", "two"]


def test_scrape_pipeline_tracks_source_health():
    jobs = [{"title": "Cloud Engineer", "company": "Acme", "url": "https://acme/jobs/1", "posted": "2026-08-24"}]
    pipeline = ScrapePipeline([FakeSource(jobs)], days=14)
    pipeline.run([SearchQuery("cloud")])
    assert pipeline.source_health["fake"]["jobs"] == 1
    assert pipeline.source_health["fake"]["queries"] == 1
    assert pipeline.source_health["fake"]["success"] is True
    assert "last_success" in pipeline.source_health["fake"]


def test_source_health_stays_healthy_after_partial_query_failure():
    pipeline = ScrapePipeline([PartialSource()], days=14)
    pipeline.run([SearchQuery("cloud"), SearchQuery("broken")])
    assert pipeline.source_health["partial"]["success"] is True
    assert pipeline.source_health["partial"]["last_error"] == "provider unavailable"


def test_dedupe_uses_location_when_titles_match():
    result = deduplicate_jobs([
        {"title": "Cloud Engineer", "company": "Acme", "location": "Melbourne", "url": "https://x", "source": "Seek", "tags": ["one"]},
        {"title": "Cloud Engineer", "company": "Acme", "location": "Sydney", "url": "https://y", "source": "Indeed", "tags": ["two"]},
    ])
    assert len(result) == 2


def test_score_penalises_seniority_mismatch():
    profile = {"skills": {"azure": "advanced", "powershell": "advanced"}}
    engineer = score_job(Job("1", "Azure Engineer", "Acme", description="Azure and PowerShell automation for cloud services"), profile)
    manager = score_job(Job("1", "Head of Cloud Platform", "Acme", description="Azure strategy and platform leadership with PowerShell automation"), profile)
    assert engineer.score > manager.score + 15


def test_adzuna_api_source_parses_results(monkeypatch):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({
                "results": [{
                    "title": "Azure Engineer",
                    "company": {"display_name": "Contoso"},
                    "location": {"display_name": "Melbourne VIC, Australia"},
                    "description": "<p>Azure and automation</p>",
                    "redirect_url": "https://example.com/jobs/1",
                    "created": "2026-08-20T00:00:00Z",
                    "salary_is_predicted": 1,
                    "salary_min": 110000,
                    "salary_max": 130000,
                }]
            }).encode("utf-8")

    monkeypatch.setenv("ADZUNA_APP_ID", "demo-app")
    monkeypatch.setenv("ADZUNA_API_KEY", "demo-key")
    monkeypatch.setattr("job_dashboard.sources.urllib.request.urlopen", lambda *args, **kwargs: FakeResponse())

    records = list(AdzunaApiSource().search(SearchQuery("azure")))

    assert len(records) == 1
    assert records[0]["title"] == "Azure Engineer"
    assert records[0]["company"] == "Contoso"
    assert records[0]["source"] == "Adzuna"
    assert records[0]["salary"] == "110000 - 130000"
    assert records[0]["remote"] is False


def test_remote_ok_api_source_filters_jobs(monkeypatch):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps([
                {
                    "position": "Azure Cloud Engineer",
                    "company": "Fabrikam",
                    "location": "Remote",
                    "description": "Build Azure infrastructure",
                    "url": "https://remoteok.com/1",
                    "published_at": "2026-08-20T00:00:00Z",
                    "salary": "$140k",
                },
                {
                    "position": "Sales Executive",
                    "company": "Acme",
                    "location": "Sydney",
                    "description": "Drive sales",
                    "url": "https://remoteok.com/2",
                    "published_at": "2026-08-20T00:00:00Z",
                },
            ]).encode("utf-8")

    monkeypatch.setattr("job_dashboard.sources.urllib.request.urlopen", lambda *args, **kwargs: FakeResponse())

    records = list(RemoteOkApiSource().search(SearchQuery("azure")))

    assert len(records) == 1
    assert records[0]["title"] == "Azure Cloud Engineer"
    assert records[0]["source"] == "RemoteOK"
    assert records[0]["remote"] is True
