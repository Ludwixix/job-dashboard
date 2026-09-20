import time
import json
import threading
from datetime import datetime, timezone, timedelta
from io import BytesIO
from unittest.mock import MagicMock, patch

from job_dashboard.sources import SearchQuery
from job_dashboard.repository import JobRepository
from job_dashboard.scrape_coordinator import ScrapeCoordinator


def create_mock_job(
    job_id, title, company="Acme Corp", location="Melbourne, VIC", days_ago=2
):
    posted_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime(
        "%Y-%m-%d"
    )
    return {
        "id": job_id,
        "title": title,
        "company": company,
        "location": location,
        "posted": posted_date,
        "date": posted_date,
        "source": "SEEK",
        "stream": "Healthcare & Medical" if "Nurse" in title else "Technology & IT",
        "description": f"Exciting opportunity for {title} in {location}.",
        "url": f"https://example.com/job/{job_id}",
        "status": "sourced",
        "score": 85,
    }


def test_repository_matching_jobs_and_coverage(tmp_path):
    repo = JobRepository(tmp_path / "jobs.db")

    # Empty DB has 0 coverage
    has_cov, count = repo.has_sufficient_matching_jobs(
        "Registered Nurse", "Melbourne", threshold=5
    )
    assert not has_cov
    assert count == 0

    # Insert 6 fresh nurse jobs
    jobs = [
        create_mock_job(
            f"nurse_{i}",
            f"Registered Nurse Grade {i}",
            location="Melbourne, VIC",
            days_ago=1,
        )
        for i in range(6)
    ]
    # Insert 1 stale nurse job (posted 40 days ago)
    jobs.append(
        create_mock_job(
            "nurse_old", "Registered Nurse", location="Melbourne, VIC", days_ago=40
        )
    )
    # Insert 2 IT jobs
    jobs.append(
        create_mock_job(
            "it_1", "Senior Cloud Engineer", location="Melbourne, VIC", days_ago=1
        )
    )
    jobs.append(
        create_mock_job(
            "it_2", "DevOps Engineer", location="Melbourne, VIC", days_ago=1
        )
    )

    repo.replace_jobs(jobs)

    # Coverage threshold 5 should now be satisfied (6 fresh nurse jobs >= 5)
    has_cov, count = repo.has_sufficient_matching_jobs(
        "Registered Nurse", "Melbourne", threshold=5, max_age_days=21
    )
    assert has_cov is True
    assert count == 6

    # Fetch matching jobs directly
    matches = repo.find_fresh_matching_jobs(
        "Registered Nurse", "Melbourne", max_age_days=21
    )
    assert len(matches) == 6
    assert all("Nurse" in j["title"] for j in matches)


def test_database_first_bypasses_external_scrape(tmp_path):
    from job_dashboard.web import DashboardApp

    app = DashboardApp({}, [], tmp_path)
    app.sync_tracker = lambda: None

    # Populate 12 fresh nurse jobs in the database
    nurse_jobs = [
        create_mock_job(
            f"nurse_{i}",
            "Registered Nurse Specialist",
            location="Melbourne, VIC",
            days_ago=2,
        )
        for i in range(12)
    ]
    app.repository.replace_jobs(nurse_jobs)
    app.jobs = nurse_jobs

    queries = [
        SearchQuery(term="Registered Nurse Specialist", location="Melbourne, VIC")
    ]

    # Patch ScrapePipeline to verify it is NEVER called when DB coverage is sufficient
    with patch("job_dashboard.web.ScrapePipeline") as mock_pipeline:
        jobs, errors, cache_stats = app.refresh(queries, force=False)

        assert mock_pipeline.call_count == 0
        assert cache_stats["cache_hit"] is True
        assert "Registered Nurse Specialist" in cache_stats.get("satisfied_from_db", [])
        assert len(jobs) >= 12


def test_scrape_coordinator_single_flight_coalescing(tmp_path):
    repo = JobRepository(tmp_path / "jobs.db")
    coordinator = ScrapeCoordinator(repo=repo, max_workers=1)

    mock_app = MagicMock()
    mock_app.repository = repo
    mock_app.sources = []
    mock_app.health_check = False
    mock_app.data_dir = tmp_path
    mock_app.jobs = []
    mock_app.save_jobs = MagicMock()
    mock_app.materialize_jobs = lambda jobs: jobs

    query = SearchQuery("Speech Pathologist", "Melbourne, VIC")

    # Simulate 40 simultaneous requests for the exact same query
    results = []
    threads = []
    for _ in range(40):
        t = threading.Thread(
            target=lambda: results.append(coordinator.enqueue_query(query, mock_app))
        )
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Only 1 query should have been enqueued, the other 39 coalesced / deduplicated
    enqueued_count = sum(1 for r in results if r.get("status") == "enqueued")
    coalesced_count = sum(
        1 for r in results if r.get("status") in ("already_queued", "in_flight", "cooldown")
    )
    assert enqueued_count == 1
    assert coalesced_count == 39

    coordinator.stop()


def test_scrape_coordinator_cooldown(tmp_path):
    repo = JobRepository(tmp_path / "jobs.db")
    coordinator = ScrapeCoordinator(repo=repo, cooldown_seconds=600)

    query_key = "physiotherapist___melbourne, vic"
    coordinator._cooldown_tracker[query_key] = time.time()  # just scraped

    mock_app = MagicMock()
    query = SearchQuery("Physiotherapist", "Melbourne, VIC")
    res = coordinator.enqueue_query(query, mock_app)

    assert res["status"] == "cooldown"
    assert coordinator.get_queue_depth() == 0


def test_scrape_status_endpoint(tmp_path):
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp({}, [], tmp_path)
    handler_class = make_handler(app)
    handler = handler_class.__new__(handler_class)
    handler.path = "/api/scrape/status"
    handler.headers = {}

    sent = {}
    handler.send_json = lambda code, data: sent.update({"code": code, "data": data})
    handler.do_GET()

    assert sent["code"] == 200
    assert sent["data"]["success"] is True
    assert "queue_depth" in sent["data"]
    assert "is_scraping" in sent["data"]
