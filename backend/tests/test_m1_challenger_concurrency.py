"""Challenger Empirical Stress-Test Suite for Milestone M1.

Adversarially verifies:
1. Schema migration backward-compatibility from pre-M1 databases.
2. WAL mode concurrency under high-load multi-threaded read/write stress.
3. UNIQUE(user_id, achievement_id) constraint enforcement and upsert idempotency.
4. Concurrency race conditions on identical achievement keys.
5. Defensive resilience against malformed JSON, clock skew, and case sensitivity.
"""

from __future__ import annotations

import concurrent.futures
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.telemetry import (
    calculate_decayed_weight,
    mine_career_patterns,
)

# ==============================================================================
# Pre-M1 Legacy Schema Definition (Simulating legacy production database)
# ==============================================================================

PRE_M1_LEGACY_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
    location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
    remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
    data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sourced',
    notes TEXT DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, job_id)
);
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    profile_data_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);
"""


# ==============================================================================
# 1. Schema Migration & Backward Compatibility Test
# ==============================================================================


def test_schema_migration_pre_m1_backward_compatibility():
    """Verify pre-M1 database migrates cleanly without data loss or crashes."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "legacy_jobs.sqlite3"

        # 1. Create a legacy database without M1 tables
        conn = sqlite3.connect(str(db_path))
        conn.executescript(PRE_M1_LEGACY_SCHEMA)

        # Seed pre-existing production-like data
        conn.execute(
            "INSERT INTO jobs (id, title, company, data_json, created_at, updated_at) "
            "VALUES ('job_legacy_1', 'Lead DevOps Engineer', 'Acme Corp', '{\"skills\": [\"Terraform\"]}', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')"
        )
        conn.execute(
            "INSERT INTO users (id, email, name, password_hash, created_at) "
            "VALUES ('user_sam', 'sam@example.com', 'Sam Ludwig', 'hashed_pw', '2026-08-01T00:00:00Z')"
        )
        conn.execute(
            "INSERT INTO user_applications (id, user_id, job_id, status, updated_at) "
            "VALUES ('app_1', 'user_sam', 'job_legacy_1', 'interviewing', '2026-08-02T00:00:00Z')"
        )
        conn.commit()
        conn.close()

        # Verify M1 tables do NOT exist yet
        check_conn = sqlite3.connect(str(db_path))
        tables_before = {
            row[0]
            for row in check_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "user_learning_telemetry" not in tables_before
        assert "user_achievements" not in tables_before
        check_conn.close()

        # 2. Instantiate JobRepository — triggers _init_schema() and migrations
        repo = JobRepository(db_path)

        # 3. Verify M1 tables now exist
        verify_conn = sqlite3.connect(str(db_path))
        tables_after = {
            row[0]
            for row in verify_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "user_learning_telemetry" in tables_after
        assert "user_achievements" in tables_after

        # Verify required indexes exist
        indexes_after = {
            row[0]
            for row in verify_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ).fetchall()
        }
        assert "idx_telemetry_user" in indexes_after
        assert "idx_telemetry_user_time" in indexes_after
        assert "idx_telemetry_job" in indexes_after
        assert "idx_telemetry_type" in indexes_after
        assert "idx_achievements_user" in indexes_after
        assert "idx_achievements_user_ach" in indexes_after
        assert "idx_achievements_unlocked" in indexes_after

        # Verify WAL mode is active
        journal_mode = verify_conn.execute("PRAGMA journal_mode").fetchone()[0]
        assert journal_mode.upper() == "WAL"

        # 4. Verify ZERO data loss on legacy tables
        job_row = verify_conn.execute(
            "SELECT title, company FROM jobs WHERE id='job_legacy_1'"
        ).fetchone()
        assert job_row == ("Lead DevOps Engineer", "Acme Corp")

        user_row = verify_conn.execute(
            "SELECT email, name FROM users WHERE id='user_sam'"
        ).fetchone()
        assert user_row == ("sam@example.com", "Sam Ludwig")

        app_row = verify_conn.execute(
            "SELECT status FROM user_applications WHERE id='app_1'"
        ).fetchone()
        assert app_row == ("interviewing",)
        verify_conn.close()

        # 5. Verify repository operations work on newly migrated tables
        eid = repo.insert_telemetry_event(
            {
                "user_id": "user_sam",
                "event_type": "applied",
                "job_id": "job_legacy_1",
                "job_title": "Lead DevOps Engineer",
                "company": "Acme Corp",
                "skills": ["Terraform", "Kubernetes"],
            }
        )
        assert eid > 0

        ach = repo.upsert_user_achievement(
            user_id="user_sam",
            achievement_id="first_contact",
            progress=1.0,
            target=1.0,
            unlocked=True,
            unlocked_at="2026-09-30T18:00:00Z",
        )
        assert ach["unlocked"] == 1
        assert ach["achievement_id"] == "first_contact"


# ==============================================================================
# 2. Concurrency Stress Test Under SQLite WAL Mode
# ==============================================================================


def test_wal_concurrency_stress_telemetry_and_achievements():
    """Simulate heavy multi-threaded read/write concurrency to verify WAL resilience."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "stress_jobs.sqlite3"
        repo = JobRepository(db_path)

        num_writers = 8
        events_per_writer = 40  # 320 telemetry events
        num_readers = 4
        num_ach_workers = 4
        ach_per_worker = 20  # 80 achievement upserts

        errors: list[Exception] = []

        def telemetry_writer_worker(worker_id: int):
            try:
                for i in range(events_per_writer):
                    event = {
                        "user_id": f"user_{worker_id % 3}",
                        "event_type": "applied" if i % 2 == 0 else "viewed",
                        "job_id": f"job_{worker_id}_{i}",
                        "job_title": f"Engineer {i}",
                        "company": f"TechCorp {worker_id}",
                        "skills": ["Python", "Docker", "AWS"],
                        "occurred_at": datetime.now(timezone.utc).isoformat(),
                    }
                    eid = repo.insert_telemetry_event(event)
                    assert eid > 0
                    time.sleep(0.001)  # small yield to interleave threads
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        def achievement_worker(worker_id: int):
            try:
                for i in range(ach_per_worker):
                    ach_id = f"badge_{i % 10}"
                    repo.upsert_user_achievement(
                        user_id=f"user_{worker_id % 3}",
                        achievement_id=ach_id,
                        progress=float(i + 1),
                        target=20.0,
                        unlocked=(i >= 15),
                    )
                    time.sleep(0.001)
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        def telemetry_reader_worker(worker_id: int):
            try:
                for _ in range(30):
                    events = repo.get_telemetry_events(
                        user_id=f"user_{worker_id % 3}", limit=50
                    )
                    # Also mine patterns on the fly
                    if events:
                        patterns = mine_career_patterns(events)
                        assert isinstance(patterns, dict)
                    time.sleep(0.002)
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        # Launch all workers concurrently
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=num_writers + num_ach_workers + num_readers
        ) as executor:
            futures = []
            for w in range(num_writers):
                futures.append(executor.submit(telemetry_writer_worker, w))
            for a in range(num_ach_workers):
                futures.append(executor.submit(achievement_worker, a))
            for r in range(num_readers):
                futures.append(executor.submit(telemetry_reader_worker, r))

            concurrent.futures.wait(futures)

        # Verify zero concurrency errors (no database locked, no busy errors)
        assert len(errors) == 0, f"Encountered concurrency errors: {errors}"

        # Verify integrity of written records
        conn = sqlite3.connect(str(db_path))
        total_events = conn.execute(
            "SELECT count(*) FROM user_learning_telemetry"
        ).fetchone()[0]
        assert total_events == num_writers * events_per_writer

        total_achievements = conn.execute(
            "SELECT count(*) FROM user_achievements"
        ).fetchone()[0]
        # 3 users, 10 badges each -> maximum 30 unique rows
        assert total_achievements <= 30
        conn.close()


# ==============================================================================
# 3. Index & UNIQUE Constraint Verification
# ==============================================================================


def test_unique_constraint_user_achievements():
    """Verify UNIQUE(user_id, achievement_id) prevents duplicates at SQL level."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_unique.sqlite3"
        repo = JobRepository(db_path)

        conn = sqlite3.connect(str(db_path))
        # 1. Raw INSERT of duplicate must fail with IntegrityError
        conn.execute(
            "INSERT INTO user_achievements (user_id, achievement_id, unlocked, created_at, updated_at) "
            "VALUES ('user_1', 'cloud_pioneer', 0, '2026-09-30T10:00:00Z', '2026-09-30T10:00:00Z')"
        )
        conn.commit()

        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO user_achievements (user_id, achievement_id, unlocked, created_at, updated_at) "
                "VALUES ('user_1', 'cloud_pioneer', 1, '2026-09-30T11:00:00Z', '2026-09-30T11:00:00Z')"
            )
            conn.commit()
        conn.close()

        # 2. repo.upsert_user_achievement must perform seamless upsert without creating duplicate rows
        # Initial upsert
        res1 = repo.upsert_user_achievement(
            user_id="user_2",
            achievement_id="momentum_builder",
            progress=2.0,
            target=5.0,
            unlocked=False,
            unlocked_at=None,
        )
        assert res1["progress"] == 2.0
        assert res1["unlocked"] == 0

        # Update upsert
        res2 = repo.upsert_user_achievement(
            user_id="user_2",
            achievement_id="momentum_builder",
            progress=5.0,
            target=5.0,
            unlocked=True,
            unlocked_at="2026-09-30T15:00:00Z",
        )
        assert res2["progress"] == 5.0
        assert res2["unlocked"] == 1
        assert res2["unlocked_at"] == "2026-09-30T15:00:00Z"

        # Check total rows in DB for user_2 is exactly 1
        achievements = repo.get_user_achievements("user_2")
        assert len(achievements) == 1
        assert achievements[0]["achievement_id"] == "momentum_builder"
        assert achievements[0]["unlocked"] == 1
        assert achievements[0]["unlocked_at"] == "2026-09-30T15:00:00Z"


def test_concurrent_upsert_on_same_achievement_key():
    """Verify concurrent upserts for the exact same (user_id, achievement_id) do not duplicate rows."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_race_ach.sqlite3"
        repo = JobRepository(db_path)

        target_user = "user_concurrent_race"
        target_ach = "streak_champion"

        def race_worker(val: float):
            return repo.upsert_user_achievement(
                user_id=target_user,
                achievement_id=target_ach,
                progress=val,
                target=10.0,
                unlocked=(val >= 10.0),
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(race_worker, float(i)) for i in range(1, 21)]
            concurrent.futures.wait(futures)

        # Confirm exactly 1 row exists
        conn = sqlite3.connect(str(db_path))
        count = conn.execute(
            "SELECT count(*) FROM user_achievements WHERE user_id = ? AND achievement_id = ?",
            (target_user, target_ach),
        ).fetchone()[0]
        conn.close()
        assert count == 1


# ==============================================================================
# 4. Resilience & Defensive Edge Case Tests
# ==============================================================================


def test_corrupted_json_handling_in_telemetry_reads():
    """Verify repository handles corrupted or non-standard JSON payloads gracefully."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "corrupt_json.sqlite3"
        repo = JobRepository(db_path)

        # Directly insert malformed JSON into the table
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            """
            INSERT INTO user_learning_telemetry (
                user_id, event_type, interaction_type, signal_weight,
                job_id, job_title, company, skills_json,
                job_snapshot_json, metadata_json, occurred_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "user_corrupt",
                "applied",
                "applied",
                5.0,
                "job_999",
                "DevOps",
                "Chaos Corp",
                "NOT_VALID_JSON{[[",
                "INVALID_SNAPSHOT_JSON",
                "INVALID_META_JSON",
                "2026-09-30T10:00:00Z",
                "2026-09-30T10:00:00Z",
            ),
        )
        conn.commit()
        conn.close()

        # Repository read must NOT crash, but fallback gracefully to empty collections
        events = repo.get_telemetry_events("user_corrupt")
        assert len(events) == 1
        item = events[0]
        assert item["skills"] == []
        assert item["job_snapshot"] == {}
        assert item["metadata"] == {}


def test_user_id_case_insensitivity():
    """Verify telemetry and achievement queries handle case variations of user_id."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "case_test.sqlite3"
        repo = JobRepository(db_path)

        repo.insert_telemetry_event(
            {
                "user_id": "Sam_Ludwig",
                "event_type": "applied",
                "job_title": "Platform Lead",
            }
        )

        repo.upsert_user_achievement(
            user_id="Sam_Ludwig",
            achievement_id="executive_circle",
            progress=1.0,
            target=1.0,
            unlocked=True,
        )

        # Query using lowercase
        events = repo.get_telemetry_events("sam_ludwig")
        assert len(events) == 1

        # Query using uppercase
        events_upper = repo.get_telemetry_events("SAM_LUDWIG")
        assert len(events_upper) == 1

        achievements = repo.get_user_achievements("sam_ludwig")
        assert len(achievements) == 1
        assert achievements[0]["achievement_id"] == "executive_circle"


def test_future_timestamp_clock_skew_resilience():
    """Verify decay calculation clamps clock skew future timestamps to elapsed_days=0.0."""
    now = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)
    # Event occurred 2 days in the future
    future_ts = datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)

    decayed = calculate_decayed_weight(5.0, occurred_at=future_ts, now=now)
    # Should not magnify weight (> 5.0), must be clamped to 5.0 * 2^0 = 5.0
    assert decayed == 5.0


def test_concurrent_wal_readers_during_active_write_transaction():
    """Verify WAL mode allows concurrent readers to query without blocking during write transactions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "wal_read_write.sqlite3"
        repo = JobRepository(db_path)

        # Seed initial data
        repo.insert_telemetry_event(
            {
                "user_id": "reader_test_user",
                "event_type": "viewed",
                "job_title": "Initial Job",
            }
        )

        read_results: list[int] = []
        read_errors: list[Exception] = []

        import threading

        write_started_event = threading.Event()
        write_finished_event = threading.Event()

        def slow_writer():
            from job_dashboard.db_pool import get_db_connection

            with get_db_connection(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("BEGIN IMMEDIATE")
                for i in range(50):
                    cursor.execute(
                        """
                        INSERT INTO user_learning_telemetry (
                            user_id, event_type, interaction_type, signal_weight,
                            job_id, job_title, company, skills_json,
                            job_snapshot_json, metadata_json, occurred_at, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            "writer_user",
                            "applied",
                            "applied",
                            5.0,
                            f"job_slow_{i}",
                            f"Slow Job {i}",
                            "SlowCo",
                            "[]",
                            "{}",
                            "{}",
                            "2026-09-30T10:00:00Z",
                            "2026-09-30T10:00:00Z",
                        ),
                    )
                    if i == 5:
                        write_started_event.set()
                    time.sleep(0.005)  # simulate slow batch write
                conn.commit()
            write_finished_event.set()

        def fast_reader():
            write_started_event.wait(timeout=5.0)
            try:
                for _ in range(20):
                    events = repo.get_telemetry_events("reader_test_user")
                    read_results.append(len(events))
                    time.sleep(0.005)
            except Exception as e:  # noqa: BLE001
                read_errors.append(e)

        writer_thread = threading.Thread(target=slow_writer)
        reader_threads = [threading.Thread(target=fast_reader) for _ in range(4)]

        writer_thread.start()
        for t in reader_threads:
            t.start()

        writer_thread.join(timeout=10.0)
        for t in reader_threads:
            t.join(timeout=10.0)

        assert len(read_errors) == 0, (
            f"Reader encountered errors during write: {read_errors}"
        )
        assert len(read_results) > 0
        assert all(count >= 1 for count in read_results)


def test_high_volume_batch_concurrency():
    """Stress-test batch telemetry insertion and batch achievement upserts under heavy concurrent load."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "batch_stress.sqlite3"
        repo = JobRepository(db_path)

        num_threads = 10
        batches_per_thread = 5
        items_per_batch = 20  # 10 * 5 * 20 = 1,000 telemetry events
        errors: list[Exception] = []

        def batch_worker(thread_id: int):
            try:
                for b in range(batches_per_thread):
                    events = [
                        {
                            "user_id": f"batch_user_{thread_id}",
                            "event_type": "applied" if j % 2 == 0 else "starred",
                            "job_id": f"batch_job_{thread_id}_{b}_{j}",
                            "job_title": f"Batch Role {j}",
                            "company": f"Corp {thread_id}",
                            "skills": ["Python", "Terraform"],
                        }
                        for j in range(items_per_batch)
                    ]
                    ids = repo.batch_insert_telemetry(events)
                    assert len(ids) == items_per_batch

                    achievements = [
                        {
                            "achievement_id": f"ach_batch_{j % 5}",
                            "progress": float(b * 10 + j),
                            "target": 100.0,
                            "unlocked": (b == batches_per_thread - 1),
                        }
                        for j in range(5)
                    ]
                    up_count = repo.batch_upsert_achievements(
                        user_id=f"batch_user_{thread_id}",
                        achievements=achievements,
                    )
                    assert up_count == 5
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(batch_worker, tid) for tid in range(num_threads)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, f"Batch concurrency errors: {errors}"

        # Verify exact counts
        conn = sqlite3.connect(str(db_path))
        total_events = conn.execute(
            "SELECT count(*) FROM user_learning_telemetry"
        ).fetchone()[0]
        assert (
            total_events == num_threads * batches_per_thread * items_per_batch
        )  # 1000

        total_ach = conn.execute("SELECT count(*) FROM user_achievements").fetchone()[0]
        assert total_ach == num_threads * 5  # 50 unique rows
        conn.close()


def test_application_lifecycle_auto_telemetry_under_concurrency():
    """Verify application transitions auto-record telemetry under multi-threaded concurrency."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app_telemetry.sqlite3"
        repo = JobRepository(db_path)

        statuses = ["applied", "interviewing", "rejected", "starred"]
        errors: list[Exception] = []

        def app_worker(thread_id: int):
            try:
                for i in range(15):
                    status = statuses[i % len(statuses)]
                    job_id = f"job_lifecycle_{thread_id}_{i}"
                    # Create job first
                    repo.upsert_job(
                        {
                            "id": job_id,
                            "title": f"Lifecycle Role {i}",
                            "company": "Gov Agency",
                            "skills": ["Azure", "Entra ID"],
                        }
                    )
                    # Transition application status
                    repo.upsert_user_application(
                        user_id=f"user_app_{thread_id}",
                        job_id=job_id,
                        data={
                            "status": status,
                            "job_data": {
                                "title": f"Lifecycle Role {i}",
                                "company": "Gov Agency",
                                "skills": ["Azure", "Entra ID"],
                            },
                        },
                    )
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(app_worker, tid) for tid in range(8)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, f"App lifecycle errors: {errors}"

        # Verify auto-recorded telemetry
        conn = sqlite3.connect(str(db_path))
        tel_count = conn.execute(
            "SELECT count(*) FROM user_learning_telemetry"
        ).fetchone()[0]
        # Each transition was one of applied/interviewing/rejected/starred which trigger auto-telemetry
        assert tel_count == 8 * 15  # 120 events auto-recorded
        conn.close()
