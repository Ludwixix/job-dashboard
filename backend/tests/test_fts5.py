"""
Unit, integration, and benchmark tests for SQLite FTS5 Full-Text Search and Triggers.

Validates:
- External content virtual table jobs_fts creation and tokenchars configuration
- Real-time synchronization triggers (jobs_ai, jobs_ad, jobs_au)
- Immunity to index churn on status / score / metadata updates
- Technical symbol searches (C++, C#, .NET, Node.js)
- Query sanitization and edge-case safety
- Idempotent rebuild migration
- Graceful LIKE fallback on OperationalError / disabled FTS
- Sub-10ms query execution benchmark
"""

import sqlite3
import time
from datetime import datetime, timezone

import pytest

from job_dashboard.db import init_db, init_fts5_index
from job_dashboard.repository import JobRepository, sanitize_fts5_query


@pytest.fixture
def temp_db(tmp_path):
    """Provide a fresh SQLite database path for testing."""
    return str(tmp_path / "test_fts5_jobs.sqlite3")


@pytest.fixture
def repo(temp_db):
    """Provide an initialized JobRepository instance."""
    return JobRepository(temp_db)


def test_init_fts5_index_and_triggers_creation(temp_db):
    """Verify jobs_fts external content table and triggers are created."""
    conn = sqlite3.connect(temp_db)
    init_db(conn)

    # 1. Verify jobs_fts virtual table exists
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    ]
    assert "jobs" in tables
    assert "jobs_fts" in tables

    # 2. Verify schema specifies content='jobs' and tokenchars '+#.'
    fts_sql = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs_fts'"
    ).fetchone()[0]
    assert "content='jobs'" in fts_sql.lower()
    assert "tokenchars '+#.'" in fts_sql

    # 3. Verify all three real-time sync triggers exist
    triggers = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger'"
        ).fetchall()
    ]
    assert "jobs_ai" in triggers
    assert "jobs_ad" in triggers
    assert "jobs_au" in triggers
    conn.close()


def test_fts5_real_time_sync_insert_update_delete(repo):
    """Verify real-time synchronization on INSERT, UPDATE, and DELETE."""
    now_iso = datetime.now(timezone.utc).isoformat()
    job = {
        "id": "sync_job_1",
        "title": "Staff Rust Systems Engineer",
        "company": "SystemsCorp",
        "location": "Sydney, NSW",
        "description": "High performance low-level memory safe systems architecture.",
        "source": "seek",
        "posted": now_iso,
        "stream": "engineering",
        "score": 90,
    }

    # 1. INSERT sync test
    repo.upsert_scraped_jobs([job])
    matches = repo.find_fresh_matching_jobs("Rust")
    assert len(matches) == 1
    assert matches[0]["id"] == "sync_job_1"

    paginated = repo.query_jobs_paginated(search="memory safe")
    assert paginated["total"] == 1
    assert paginated["jobs"][0]["id"] == "sync_job_1"

    # 2. UPDATE sync test (modifying searchable text)
    updated_job = dict(job)
    updated_job["title"] = "Principal Go Infrastructure Architect"
    updated_job["company"] = "CloudCorp"
    updated_job["description"] = (
        "Distributed cloud computing with Golang and Kubernetes."
    )
    repo.upsert_scraped_jobs([updated_job])

    # Old terms should no longer match
    assert len(repo.find_fresh_matching_jobs("Rust")) == 0
    assert repo.query_jobs_paginated(search="memory safe")["total"] == 0
    assert repo.query_jobs_paginated(search="SystemsCorp")["total"] == 0

    # New terms must match immediately
    go_matches = repo.find_fresh_matching_jobs("Golang")
    assert len(go_matches) == 1
    assert go_matches[0]["title"] == "Principal Go Infrastructure Architect"

    cloud_matches = repo.query_jobs_paginated(search="CloudCorp")
    assert cloud_matches["total"] == 1
    assert cloud_matches["jobs"][0]["id"] == "sync_job_1"

    # 3. DELETE sync test
    with repo.get_connection() as conn, conn:
        conn.execute("DELETE FROM jobs WHERE id = ?", ("sync_job_1",))

    assert len(repo.find_fresh_matching_jobs("Golang")) == 0
    assert repo.query_jobs_paginated(search="Golang")["total"] == 0


def test_status_and_metadata_updates_preserve_fts5_state(repo):
    """Verify updating non-search columns (status, score) preserves FTS5 state."""
    now_iso = datetime.now(timezone.utc).isoformat()
    job = {
        "id": "status_job_1",
        "title": "Machine Learning Engineer",
        "company": "NeuroAI",
        "location": "Melbourne, VIC",
        "description": "Deep learning models using PyTorch and Transformers.",
        "source": "indeed",
        "posted": now_iso,
        "stream": "ai",
        "score": 85,
    }
    repo.upsert_scraped_jobs([job])

    # Search initially works
    res1 = repo.query_jobs_paginated(search="PyTorch")
    assert res1["total"] == 1
    assert res1["jobs"][0]["status"] == "sourced"

    # Update Kanban status to 'applied' and score to 98
    repo.update_status("status_job_1", "applied")
    with repo.get_connection() as conn, conn:
        conn.execute("UPDATE jobs SET score = 98 WHERE id = 'status_job_1'")

    # Verify search still finds the job with updated status
    res2 = repo.query_jobs_paginated(search="PyTorch")
    assert res2["total"] == 1
    assert res2["jobs"][0]["status"] == "applied"

    with repo.get_connection() as conn:
        db_score = conn.execute(
            "SELECT score FROM jobs WHERE id = 'status_job_1'"
        ).fetchone()[0]
        assert db_score == 98


def test_special_symbol_search_cpp_csharp_dotnet(repo):
    """Verify technical terms containing +, #, and . are correctly isolated."""
    now_iso = datetime.now(timezone.utc).isoformat()
    jobs = [
        {
            "id": "cpp_job",
            "title": "Senior C++ Engine Programmer",
            "company": "GameStudio",
            "location": "Sydney, NSW",
            "description": "Unreal Engine C++ gameplay systems and shaders.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 90,
        },
        {
            "id": "csharp_job",
            "title": "Full Stack C# .NET Developer",
            "company": "EnterpriseCorp",
            "location": "Melbourne, VIC",
            "description": "Enterprise cloud services with C# and ASP.NET Core 8.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 85,
        },
        {
            "id": "c_job",
            "title": "Embedded C Developer",
            "company": "HardwareCorp",
            "location": "Brisbane, QLD",
            "description": "Microcontroller firmware in standard C language.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 80,
        },
        {
            "id": "node_job",
            "title": "Backend Node.js Developer",
            "company": "WebTech",
            "location": "Perth, WA",
            "description": "Microservices built with Node.js and TypeScript.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 88,
        },
    ]
    repo.upsert_scraped_jobs(jobs)

    # 1. Searching for C++ must return cpp_job and NOT csharp_job or c_job
    cpp_res = repo.query_jobs_paginated(search="C++")
    assert cpp_res["total"] == 1
    assert cpp_res["jobs"][0]["id"] == "cpp_job"

    # 2. Searching for C# must return csharp_job and NOT cpp_job
    csharp_res = repo.query_jobs_paginated(search="C#")
    assert csharp_res["total"] == 1
    assert csharp_res["jobs"][0]["id"] == "csharp_job"

    # 3. Searching for .NET must return csharp_job
    dotnet_res = repo.query_jobs_paginated(search=".NET")
    assert dotnet_res["total"] == 1
    assert dotnet_res["jobs"][0]["id"] == "csharp_job"

    # 4. Searching for Node.js must return node_job
    node_res = repo.query_jobs_paginated(search="Node.js")
    assert node_res["total"] == 1
    assert node_res["jobs"][0]["id"] == "node_job"


def test_sanitize_fts5_query_edge_cases():
    """Verify sanitize_fts5_query handles various user inputs securely."""
    # Empty or whitespace
    assert sanitize_fts5_query("") == ""
    assert sanitize_fts5_query("   ") == ""
    assert sanitize_fts5_query(None) == ""

    # Exact phrase
    assert sanitize_fts5_query('"machine learning"') == '"machine learning"'

    # Unclosed quote
    sanitized_unclosed = sanitize_fts5_query('"senior developer')
    assert '"senior"' in sanitized_unclosed
    assert '"developer"' in sanitized_unclosed

    # Boolean operators handling
    assert sanitize_fts5_query("AND python OR") == '"python"'
    assert sanitize_fts5_query("python AND AND data") == '"python" AND "data"*'
    assert sanitize_fts5_query("python OR") == '"python"'

    # Technical symbols
    assert sanitize_fts5_query("C++") == '"C++"*'
    assert sanitize_fts5_query("C#") == '"C#"*'
    assert sanitize_fts5_query(".NET") == '".NET"*'

    # Trailing wildcard
    assert sanitize_fts5_query("engineer*") == '"engineer"*'
    assert sanitize_fts5_query("full-stack") == '"full-stack"*'


def test_idempotent_rebuild_migration(temp_db):
    """Verify idempotent rebuild populates empty jobs_fts on existing database."""
    conn = sqlite3.connect(temp_db)
    # 1. Create base jobs table without FTS5
    conn.execute("""
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
            location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
            remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
            data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
    """)
    # Insert rows directly
    now_iso = datetime.now(timezone.utc).isoformat()
    for i in range(5):
        conn.execute(
            """INSERT INTO jobs (id, title, company, location, description, source, url, posted, data_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)""",
            (
                f"job_{i}",
                f"Software Engineer {i}",
                "TestCompany",
                "Sydney",
                "Building high throughput data pipelines in Scala.",
                "seek",
                f"https://example.com/{i}",
                now_iso,
                now_iso,
                now_iso,
            ),
        )
    conn.commit()

    # 2. Run init_fts5_index which should detect existing jobs and rebuild
    init_fts5_index(conn)

    # 3. Verify all 5 rows are indexed and searchable
    res = conn.execute(
        "SELECT count(*) FROM jobs JOIN jobs_fts ON jobs.rowid = jobs_fts.rowid WHERE jobs_fts MATCH '\"Scala\"*'"
    ).fetchone()[0]
    assert res == 5

    # 4. Running init_fts5_index again should be idempotent and not fail
    init_fts5_index(conn)
    res_after = conn.execute(
        "SELECT count(*) FROM jobs JOIN jobs_fts ON jobs.rowid = jobs_fts.rowid WHERE jobs_fts MATCH '\"Scala\"*'"
    ).fetchone()[0]
    assert res_after == 5
    conn.close()


def test_graceful_fallback_to_like_on_error_or_disabled_fts(repo):
    """Verify seamless fallback to LIKE if FTS5 encounters an error or is unavailable."""
    now_iso = datetime.now(timezone.utc).isoformat()
    job = {
        "id": "fallback_job_1",
        "title": "Quantum Cryptography Researcher",
        "company": "QubitLabs",
        "location": "Canberra, ACT",
        "description": "Post-quantum lattice based cryptographic implementations.",
        "source": "seek",
        "posted": now_iso,
        "stream": "research",
        "score": 92,
    }
    repo.upsert_scraped_jobs([job])

    # 1. Normal FTS search succeeds
    res_normal = repo.query_jobs_paginated(search="cryptographic")
    assert res_normal["total"] == 1

    # 2. Drop the jobs_fts table to simulate disabled or corrupted FTS5
    with repo.get_connection() as conn, conn:
        conn.execute("DROP TRIGGER IF EXISTS jobs_ai;")
        conn.execute("DROP TRIGGER IF EXISTS jobs_ad;")
        conn.execute("DROP TRIGGER IF EXISTS jobs_au;")
        conn.execute("DROP TABLE IF EXISTS jobs_fts;")

    # 3. Query should seamlessly fall back to LIKE without raising an exception
    res_fallback = repo.query_jobs_paginated(search="cryptographic")
    assert res_fallback["total"] == 1
    assert res_fallback["jobs"][0]["id"] == "fallback_job_1"

    # 4. find_fresh_matching_jobs should also fall back to LIKE cleanly
    fresh_fallback = repo.find_fresh_matching_jobs("cryptographic")
    assert len(fresh_fallback) == 1
    assert fresh_fallback[0]["id"] == "fallback_job_1"


def test_fts5_rank_ordering(repo):
    """Verify FTS5 results are ordered by BM25 relevance rank."""
    now_iso = datetime.now(timezone.utc).isoformat()
    jobs = [
        {
            "id": "mention_once",
            "title": "General Developer",
            "company": "Acme",
            "location": "Sydney",
            "description": "General web developer who occasionally wrote a python script.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 70,
        },
        {
            "id": "title_and_repeat",
            "title": "Lead Python Engineer",
            "company": "PyCorp",
            "location": "Sydney",
            "description": "Python core expert architecting Python backend services in Python 3.14.",
            "source": "seek",
            "posted": now_iso,
            "stream": "engineering",
            "score": 85,
        },
    ]
    repo.upsert_scraped_jobs(jobs)

    # Search for python with relevance sort
    res = repo.query_jobs_paginated(search="python", sort_by="relevance")
    assert res["total"] == 2
    # The job with multiple Python occurrences and title match must rank first
    assert res["jobs"][0]["id"] == "title_and_repeat"
    assert res["jobs"][1]["id"] == "mention_once"


def test_benchmark_sub_10ms_keyword_search(repo):
    """Benchmark full-text search to guarantee execution latency < 10ms."""
    now_iso = datetime.now(timezone.utc).isoformat()
    # Batch insert 200 diverse jobs
    sample_jobs = []
    technologies = [
        "Python",
        "Rust",
        "Golang",
        "TypeScript",
        "C++",
        "Java",
        "Docker",
        "AWS",
        "Kubernetes",
        "React",
    ]
    for i in range(200):
        tech = technologies[i % len(technologies)]
        sample_jobs.append(
            {
                "id": f"bench_job_{i}",
                "title": f"Senior {tech} Engineer {i}",
                "company": f"TechCompany {i % 10}",
                "location": "Sydney, NSW" if i % 2 == 0 else "Melbourne, VIC",
                "description": f"Developing cloud native applications in {tech} with microservices.",
                "source": "seek",
                "posted": now_iso,
                "stream": "engineering",
                "score": 75 + (i % 20),
            }
        )
    repo.upsert_scraped_jobs(sample_jobs)

    # Measure search latencies over multiple queries
    test_terms = ["Python", "C++", "Kubernetes", "Docker", "TypeScript"]
    latencies_ms = []

    for term in test_terms:
        start_time = time.perf_counter()
        result = repo.query_jobs_paginated(search=term, page_size=20)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        latencies_ms.append(elapsed_ms)
        assert result["total"] > 0, f"Expected matches for {term}"

    avg_latency = sum(latencies_ms) / len(latencies_ms)
    max_latency = max(latencies_ms)

    # Assert sub-10ms performance requirement
    assert max_latency < 10.0, f"Max latency was {max_latency:.2f}ms (must be < 10.0ms)"
    assert avg_latency < 5.0, (
        f"Average latency was {avg_latency:.2f}ms (target < 5.0ms)"
    )
