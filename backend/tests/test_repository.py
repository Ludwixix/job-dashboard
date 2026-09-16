import pytest
from datetime import datetime, timezone
from job_dashboard.repository import JobRepository


class FakeRefreshSource:
    name = "fake"

    def search(self, query):
        today = datetime.now(timezone.utc).date().isoformat()
        return [
            {
                "title": "Cloud Engineer",
                "company": "Acme",
                "url": "https://acme/1",
                "posted": today,
                "location": "Melbourne",
            }
        ]


def test_dashboard_app_refresh_persists_jobs_and_reports_progress(tmp_path):
    from job_dashboard.sources import SearchQuery
    from job_dashboard.web import DashboardApp

    app = DashboardApp(
        profile={}, sources=[FakeRefreshSource()], data_dir=tmp_path, search_queries=[]
    )
    baseline_count = app.repository.count_jobs()
    progress_events = []

    _, _, stats = app.refresh(
        [SearchQuery("cloud")],
        on_progress=lambda stage, pct: progress_events.append((stage, pct)),
    )

    assert stats["queries_scraped"] == 1
    assert app.repository.count_jobs() > baseline_count
    assert progress_events


def test_dashboard_app_refresh_skips_cached_queries_on_second_call(tmp_path):
    from job_dashboard.sources import SearchQuery
    from job_dashboard.web import DashboardApp

    app = DashboardApp(
        profile={}, sources=[FakeRefreshSource()], data_dir=tmp_path, search_queries=[]
    )
    app.refresh([SearchQuery("cloud")])

    _, _, stats = app.refresh([SearchQuery("cloud")], force=False, ttl_hours=12.0)

    assert stats["cache_hit"] is True
    assert stats["queries_scraped"] == 0


def test_repository_filters_and_logs_status_transition(tmp_path):
    repository = JobRepository(tmp_path / "jobs.sqlite3")
    repository.replace_jobs(
        [
            {
                "id": "one",
                "title": "Cloud Engineer",
                "company": "Acme",
                "location": "Melbourne",
                "description": "Azure role",
                "source": "Seek",
                "url": "https://example.test/one",
                "salary": "$110,000 - $130,000",
                "score": 88,
            }
        ]
    )
    assert len(repository.list_jobs(source="Seek", match_score_min=80)) == 1
    assert len(repository.list_jobs(role="Acme", salary_min=100000)) == 1
    assert repository.list_jobs(salary_min=120000) == []
    repository.update_status("one", "shortlisted")
    assert repository.metrics()["by_status"]["shortlisted"] == 1
    assert repository.metrics()["events"] == 1


def test_upsert_pagination_and_user_applications(tmp_path):
    repo = JobRepository(tmp_path / "test_jobs.sqlite3")

    # 1. Test upsert with deduplication
    raw_jobs = [
        {
            "title": "M365 Admin",
            "company": "Contoso",
            "url": "https://job.test/1",
            "stream": "core-it",
            "remote": True,
            "score": 90,
            "posted": "2026-08-28",
        },
        {
            "title": "M365 Admin",
            "company": "Contoso",
            "url": "https://job.test/1",
            "stream": "core-it",
            "remote": True,
            "score": 92,
            "posted": "2026-08-28",
        },  # Duplicate
        {
            "title": "Azure Consultant",
            "company": "Fabrikam",
            "url": "https://job.test/2",
            "stream": "cloud",
            "remote": False,
            "score": 85,
            "posted": "2026-08-27",
        },
    ]
    upsert_count = repo.upsert_scraped_jobs(raw_jobs)
    assert upsert_count == 3

    # 2. Test paginated query
    result = repo.query_jobs_paginated(page=1, page_size=10, search="Contoso")
    assert result["total"] == 1
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["company"] == "Contoso"
    assert result["jobs"][0]["score"] == 92  # Updated score

    # Test remote filter
    remote_res = repo.query_jobs_paginated(page=1, page_size=10, remote=True)
    assert remote_res["total"] == 1
    assert remote_res["jobs"][0]["company"] == "Contoso"

    # 3. Test user applications isolation
    user_id = "user_abc_123"
    job_id = result["jobs"][0]["id"]

    repo.upsert_user_application(
        user_id,
        job_id,
        {
            "status": "applied",
            "notes": "Submitted custom resume via portal",
            "resume_text": "Experienced M365 Admin...",
        },
    )

    apps = repo.get_user_applications(user_id)
    assert len(apps) == 1
    assert apps[0]["job_id"] == job_id
    assert apps[0]["status"] == "applied"
    assert "Submitted custom resume" in apps[0]["notes"]

    # Other users should see empty applications
    other_apps = repo.get_user_applications("different_user")
    assert len(other_apps) == 0


def test_saved_searches_reminders_and_cross_source_deduplication(tmp_path):
    repo = JobRepository(tmp_path / "jobs.sqlite3")
    repo.upsert_scraped_jobs(
        [
            {
                "title": "Cloud Engineer",
                "company": "Acme Pty Ltd",
                "location": "Melbourne",
                "url": "https://seek.test/1",
            },
            {
                "title": "Cloud Engineer",
                "company": "Acme",
                "location": "Melbourne",
                "url": "https://indeed.test/2",
            },
        ]
    )
    assert repo.count_jobs() == 1

    saved = repo.upsert_saved_search(
        "user-1", "Cloud roles", {"include": ["azure"], "remote": True}
    )
    assert repo.list_saved_searches("user-1")[0]["query"]["include"] == ["azure"]
    assert repo.delete_saved_search("user-1", saved["id"])

    reminder = repo.create_reminder(
        "user-1", "job-1", "follow_up", "2020-01-01T00:00:00+00:00"
    )
    assert len(repo.list_due_reminders("user-1")) == 1
    assert repo.dismiss_reminder("user-1", reminder["id"])
    assert repo.list_due_reminders("user-1") == []


def test_public_job_index_excludes_gmail_and_unverifiable_dates_and_sorts_dates(
    tmp_path,
):
    repo = JobRepository(tmp_path / "jobs.sqlite3")
    repo.replace_jobs(
        [
            {
                "id": "featured",
                "title": "Featured role",
                "company": "Acme",
                "source": "Seek",
                "posted": "Featured",
            },
            {
                "id": "gmail",
                "title": "Application confirmation",
                "company": "Acme",
                "source": "Gmail",
                "posted": "2026-08-30",
            },
            {
                "id": "old",
                "title": "Older role",
                "company": "Acme",
                "source": "Indeed",
                "posted": "2026-08-20",
            },
            {
                "id": "new",
                "title": "Newer role",
                "company": "Acme",
                "source": "Indeed",
                "posted": "2026-08-28",
            },
        ]
    )

    result = repo.query_jobs_paginated(page=1, page_size=10)

    assert [job["id"] for job in result["jobs"]] == ["new", "old"]
    assert result["total"] == 2


def test_repository_hourly_metrics(tmp_path):
    from datetime import datetime, timezone, timedelta

    repo = JobRepository(tmp_path / "jobs.sqlite3")

    now = datetime.now(timezone.utc)
    two_hours_ago = (now - timedelta(hours=2)).isoformat()
    thirty_hours_ago = (now - timedelta(hours=30)).isoformat()

    # 1. Add recent job via upsert_scraped_jobs (created_at = now)
    repo.upsert_scraped_jobs(
        [
            {
                "id": "recent_job",
                "title": "DevOps Engineer",
                "company": "TechCorp",
                "location": "Melbourne",
                "url": "https://test.com/1",
            }
        ]
    )

    # 2. Insert older jobs directly to simulate historic ingestion
    with repo.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO jobs (id, title, company, location, source, url, posted, remote, stream, score, data_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'core', 80, '{}', 'sourced', ?, ?)
        """,
            (
                "two_h_job",
                "SysAdmin",
                "OlderCorp",
                "Melbourne",
                "Seek",
                "https://test.com/2",
                "2026-09-04",
                two_hours_ago,
                two_hours_ago,
            ),
        )
        conn.execute(
            """
            INSERT INTO jobs (id, title, company, location, source, url, posted, remote, stream, score, data_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'core', 70, '{}', 'sourced', ?, ?)
        """,
            (
                "thirty_h_job",
                "Helpdesk",
                "OldestCorp",
                "Melbourne",
                "Indeed",
                "https://test.com/3",
                "2026-09-02",
                thirty_hours_ago,
                thirty_hours_ago,
            ),
        )

    stats = repo.hourly_metrics(hours=24)
    assert stats["added_last_hour"] == 1
    assert stats["added_past_24h"] == 2
    assert len(stats["hourly_breakdown"]) >= 1

    # Check that summary metrics() incorporates hourly_ingestion
    summary = repo.metrics()
    assert "hourly_ingestion" in summary
    assert summary["hourly_ingestion"]["added_last_hour"] == 1
    assert summary["hourly_ingestion"]["added_past_24h"] == 2


def test_raw_pool_get_connection_leaks_and_exhausts_pool(tmp_path):
    """`pool.get_connection()` returns a bare sqlite3.Connection.

    Using it as a context manager runs sqlite3's *transaction* protocol
    (commit/rollback) and never returns the connection to the pool, so
    `_active_connections` is never decremented and the pool starves.
    """
    from job_dashboard.db_pool import ConnectionPool

    pool = ConnectionPool(tmp_path / "leak.sqlite3", max_connections=3, timeout=0.5)

    for _ in range(3):
        with pool.get_connection() as conn:
            conn.execute("SELECT 1").fetchone()

    # Every slot was leaked, so the pool is now permanently exhausted.
    assert pool._active_connections == 3
    assert pool.get_stats()["pool_size"] == 0

    with pytest.raises(TimeoutError):
        pool.get_connection()


def test_pool_connection_contextmanager_is_reusable(tmp_path):
    """`pool.connection()` correctly returns the connection on exit."""
    from job_dashboard.db_pool import ConnectionPool

    pool = ConnectionPool(tmp_path / "ok.sqlite3", max_connections=3, timeout=0.5)

    for _ in range(50):
        with pool.connection() as conn:
            conn.execute("SELECT 1").fetchone()

    stats = pool.get_stats()
    assert stats["active_connections"] == 0
    assert stats["pool_size"] <= 3


def test_pool_connection_rolls_back_and_returns_on_error(tmp_path):
    """A failing write must not leak an open transaction back into the pool."""
    from job_dashboard.db_pool import ConnectionPool

    pool = ConnectionPool(tmp_path / "rollback.sqlite3", max_connections=3, timeout=0.5)

    with pytest.raises(RuntimeError):
        with pool.connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)")
            conn.execute("INSERT INTO t (id) VALUES (1)")
            raise RuntimeError("boom")

    # Connection was still returned, and the transaction rolled back.
    assert pool.get_stats()["active_connections"] == 0
    assert pool.get_stats()["pool_size"] == 1

    with pool.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 0


def test_repeated_repository_reads_do_not_exhaust_connection_pool(tmp_path):
    """Repository reads must return connections, else Cloud Run 503s.

    `/api/telemetry/status` calls `get_provider_cookies()` twice per request;
    a leak exhausts the 10-slot pool within a handful of polls.
    """
    from job_dashboard.db_pool import ConnectionPool

    db_path = tmp_path / "jobs.sqlite3"
    repo = JobRepository(db_path)
    # Tiny pool with a short timeout so exhaustion surfaces immediately.
    repo.pool = ConnectionPool(db_path, max_connections=3, timeout=0.5)

    for _ in range(30):
        repo.get_provider_cookies("seek")
        repo.get_provider_cookies("indeed")

    stats = repo.pool.get_stats()
    assert stats["active_connections"] == 0
    assert stats["pool_size"] <= 3


def test_job_intelligence_persistence(tmp_path):
    """Test on-demand job intelligence persistence and retrieval in SQLite."""
    db_path = tmp_path / "jobs.sqlite3"
    repo = JobRepository(db_path)

    # Empty initially
    assert repo.get_job_intelligence("job_123") == {}

    # Upsert an intelligence artifact
    data = {"summary": "Executive summary", "score": 95}
    saved = repo.upsert_job_intelligence(
        "job_123", "executive_dossier", data, "meta-llama/llama-3.3-70b-instruct:free"
    )
    assert saved["job_id"] == "job_123"
    assert saved["tool_key"] == "executive_dossier"
    assert saved["data"]["score"] == 95

    # Retrieve all intelligence for job
    all_intel = repo.get_job_intelligence("job_123")
    assert "executive_dossier" in all_intel
    assert all_intel["executive_dossier"]["data"]["summary"] == "Executive summary"
    assert (
        all_intel["executive_dossier"]["model_name"]
        == "meta-llama/llama-3.3-70b-instruct:free"
    )

    # Retrieve single tool
    single_intel = repo.get_job_intelligence("job_123", "executive_dossier")
    assert single_intel["data"]["score"] == 95

    # Update intelligence
    updated_data = {"summary": "Updated executive summary", "score": 98}
    repo.upsert_job_intelligence(
        "job_123", "executive_dossier", updated_data, "google/gemini-2.0-flash-exp:free"
    )
    refetched = repo.get_job_intelligence("job_123", "executive_dossier")
    assert refetched["data"]["score"] == 98
    assert refetched["model_name"] == "google/gemini-2.0-flash-exp:free"
