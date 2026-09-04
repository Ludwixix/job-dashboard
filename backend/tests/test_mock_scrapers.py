import os
from job_dashboard.sources import ScrapePipeline, SearchQuery


def test_mock_scrapers_flag(monkeypatch):
    monkeypatch.setenv("MOCK_SCRAPERS", "true")

    pipeline = ScrapePipeline(sources=(), days=14)
    queries = [SearchQuery(term="python", enabled=True)]
    results = pipeline.run(queries)

    assert len(results) > 0
    assert any(j["company"] == "Canva" for j in results)
    assert any(j["source"] == "SEEK" for j in results)
