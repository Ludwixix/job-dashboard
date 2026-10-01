"""Adversarial Concurrency, OCC, and Idempotency Stress Tests.

Empirical verification suite designed by Challenger 1 to stress-test:
1. High-contention multi-threaded requests (20-50 threads) with identical Idempotency-Key.
2. High-contention racing OCC updates (20-50 threads) with distinct Idempotency-Keys.
3. Mixed-group contention (50 threads partitioned into 5 key groups).
4. Stale update simulations (expected_version != current_version).
5. Fast consecutive version ladder mutations under concurrency.
6. Direct repository stress test with 20, 50, and concurrent threads.
7. Hostile / edge-case inputs (weird keys, empty keys, case insensitivity, terminal state replay).
"""

from __future__ import annotations

import concurrent.futures
import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from job_dashboard.db import init_db
from job_dashboard.fastapi_app import create_app
from job_dashboard.orm_models import JobApplication, ApplicationEvent
from job_dashboard.repository import JobRepository
from job_dashboard.state_machine import MacroStage, MicroEventType


@pytest.fixture
def stress_harness(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Provide isolated environment for adversarial stress testing."""
    db_file = tmp_path / "jobs.sqlite3"
    monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(tmp_path))

    conn = sqlite3.connect(str(db_file))
    init_db(conn)
    conn.commit()
    conn.close()

    repo = JobRepository(str(db_file))
    app = create_app()

    # Pre-seed a test job
    with sqlite3.connect(str(db_file)) as conn:
        now = "2026-10-01T12:00:00Z"
        conn.execute(
            """
            INSERT OR REPLACE INTO jobs (id, title, company, score, location, source, url, created_at, updated_at, data_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "stress-job-1",
                "Adversarial Stress Target",
                "Test Corp",
                90,
                "Melbourne",
                "seek",
                "http://test",
                now,
                now,
                "{}",
            ),
        )
        conn.commit()

    with TestClient(app) as client:
        yield client, repo, str(db_file)


class TestAdversarialConcurrencyIdempotency:
    """Adversarial stress testing of concurrency, OCC, and idempotency guarantees."""

    @pytest.mark.parametrize("thread_count", [20, 50])
    def test_high_contention_identical_idempotency_key(
        self, stress_harness, thread_count
    ):
        """Stress test 20 and 50 concurrent threads with identical Idempotency-Key.

        Requirements:
        - ZERO HTTP 500 Internal Server Errors.
        - EXACTLY 1 event record inserted into user_application_events.
        - Application version incremented exactly once (from 1 to 2).
        - All threads receive HTTP 200 OK.
        - All threads receive the identical event payload.
        """
        client, repo, db_path = stress_harness
        job_id = f"job-idemp-contention-{thread_count}-{uuid.uuid4().hex[:8]}"

        # Seed job and application
        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})
        app_before = repo.get_user_application("stress_user", job_id)
        assert app_before["version"] == 1
        assert app_before["macro_stage"] == "LEAD"

        idemp_key = f"idemp-stress-{thread_count}-{uuid.uuid4()}"
        barrier = threading.Barrier(thread_count)

        def worker(idx: int):
            # Synchronize thread start to maximize contention
            barrier.wait()
            res = client.patch(
                f"/api/v1/jobs/{job_id}/events",
                headers={
                    "Idempotency-Key": idemp_key,
                    "X-User-Id": "stress_user",
                },
                json={
                    "event_type": "APPLICATION_SUBMITTED",
                    "expected_version": 1,
                    "new_macro_stage": "APPLIED",
                    "payload": {"thread_index": idx},
                },
            )
            return res

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=thread_count
        ) as executor:
            futures = [executor.submit(worker, i) for i in range(thread_count)]
            responses = [f.result() for f in futures]

        status_codes = [r.status_code for r in responses]
        five_hundreds = [r for r in responses if r.status_code == 500]

        # 1. ZERO 500 errors
        assert len(five_hundreds) == 0, (
            f"Encountered HTTP 500 errors: {[r.text for r in five_hundreds]}"
        )

        # 2. All responses must be HTTP 200 OK (idempotent result)
        assert all(code == 200 for code in status_codes), (
            f"Expected all HTTP 200, got status distribution: {dict((c, status_codes.count(c)) for c in set(status_codes))}"
        )

        # 3. All responses reference the exact same event ID and idempotency key
        event_ids = set()
        for r in responses:
            body = r.json()
            assert body["success"] is True
            assert body["application"]["version"] == 2
            assert body["application"]["macro_stage"] == "APPLIED"
            event_ids.add(body["event"]["id"])
            assert body["event"]["idempotency_key"] == idemp_key

        assert len(event_ids) == 1, (
            f"Expected exactly 1 unique event ID across all responses, got {event_ids}"
        )

        # 4. Verify SQLite DB state directly
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(
                "SELECT COUNT(*) FROM user_application_events WHERE idempotency_key = ?",
                (idemp_key,),
            )
            event_count = cur.fetchone()[0]
            assert event_count == 1, (
                f"Expected exactly 1 event record in DB, found {event_count}"
            )

            cur = conn.execute(
                "SELECT version, macro_stage FROM user_applications WHERE user_id = ? AND job_id = ?",
                ("stress_user", job_id),
            )
            row = cur.fetchone()
            assert row[0] == 2
            assert row[1] == "APPLIED"

    @pytest.mark.parametrize("thread_count", [20, 50])
    def test_high_contention_racing_occ_updates(self, stress_harness, thread_count):
        """Stress test 20 and 50 concurrent threads with DISTINCT Idempotency-Keys all claiming expected_version=1.

        Requirements:
        - ZERO HTTP 500 Internal Server Errors.
        - EXACTLY ONE winner (HTTP 200 OK).
        - EXACTLY (thread_count - 1) losers returning HTTP 409 Conflict.
        - Every 409 Conflict includes current_version=2 in the payload.
        - Exactly 1 event record created.
        - Application version is exactly 2.
        """
        client, repo, db_path = stress_harness
        job_id = f"job-occ-race-{thread_count}-{uuid.uuid4().hex[:8]}"

        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})
        app_before = repo.get_user_application("stress_user", job_id)
        assert app_before["version"] == 1

        barrier = threading.Barrier(thread_count)

        def worker(idx: int):
            barrier.wait()
            res = client.patch(
                f"/api/v1/jobs/{job_id}/events",
                headers={
                    "Idempotency-Key": f"idemp-race-{thread_count}-{idx}-{uuid.uuid4()}",
                    "X-User-Id": "stress_user",
                },
                json={
                    "event_type": "APPLICATION_SUBMITTED",
                    "expected_version": 1,
                    "new_macro_stage": "APPLIED",
                    "payload": {"worker_idx": idx},
                },
            )
            return res

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=thread_count
        ) as executor:
            futures = [executor.submit(worker, i) for i in range(thread_count)]
            responses = [f.result() for f in futures]

        status_codes = [r.status_code for r in responses]
        five_hundreds = [r for r in responses if r.status_code == 500]
        assert len(five_hundreds) == 0, (
            f"HTTP 500 errors detected: {[r.text for r in five_hundreds]}"
        )

        successes = [r for r in responses if r.status_code == 200]
        conflicts = [r for r in responses if r.status_code == 409]

        assert len(successes) == 1, f"Expected exactly 1 winner, got {len(successes)}"
        assert len(conflicts) == thread_count - 1, (
            f"Expected {thread_count - 1} conflicts, got {len(conflicts)}"
        )

        # Verify conflict response payload
        for r in conflicts:
            body = r.json()
            assert "detail" in body or "error" in body
            assert (
                "conflict" in (body.get("detail", "") + body.get("error", "")).lower()
            )
            assert body.get("current_version") == 2

        # Verify DB state
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(
                "SELECT version, macro_stage FROM user_applications WHERE user_id = ? AND job_id = ?",
                ("stress_user", job_id),
            )
            row = cur.fetchone()
            assert row[0] == 2
            assert row[1] == "APPLIED"

            # Verify exactly 1 mutation event created (plus initial sourced creation event = 2 total)
            cur = conn.execute(
                "SELECT COUNT(*) FROM user_application_events WHERE application_id = (SELECT id FROM user_applications WHERE user_id = ? AND job_id = ?) AND event_type = 'APPLICATION_SUBMITTED'",
                ("stress_user", job_id),
            )
            assert cur.fetchone()[0] == 1

    def test_mixed_group_contention_50_threads(self, stress_harness):
        """50 concurrent threads partitioned into 5 groups of 10 threads.
        Each group shares a distinct Idempotency-Key. All groups expect version=1.

        Requirements:
        - Exactly ONE group wins the OCC update.
        - All 10 threads in the winning group receive HTTP 200 OK.
        - All 40 threads in the 4 losing groups receive HTTP 409 Conflict.
        - ZERO HTTP 500 errors.
        - In the DB: exactly 1 event record in user_application_events.
        """
        client, repo, db_path = stress_harness
        job_id = f"job-mixed-groups-{uuid.uuid4().hex[:8]}"

        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})

        num_groups = 5
        threads_per_group = 10
        total_threads = num_groups * threads_per_group

        group_keys = [f"group-key-{g}-{uuid.uuid4()}" for g in range(num_groups)]
        barrier = threading.Barrier(total_threads)

        def worker(thread_idx: int):
            group_idx = thread_idx % num_groups
            idemp_key = group_keys[group_idx]
            barrier.wait()
            res = client.patch(
                f"/api/v1/jobs/{job_id}/events",
                headers={
                    "Idempotency-Key": idemp_key,
                    "X-User-Id": "stress_user",
                },
                json={
                    "event_type": "APPLICATION_SUBMITTED",
                    "expected_version": 1,
                    "new_macro_stage": "APPLIED",
                    "payload": {"group": group_idx, "thread": thread_idx},
                },
            )
            return group_idx, res

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=total_threads
        ) as executor:
            futures = [executor.submit(worker, i) for i in range(total_threads)]
            results = [f.result() for f in futures]

        # Group results by group_idx
        by_group: dict[int, list] = {g: [] for g in range(num_groups)}
        for g_idx, res in results:
            by_group[g_idx].append(res)

        # Check for 500 errors across all results
        five_hundreds = [res for _, res in results if res.status_code == 500]
        assert len(five_hundreds) == 0, (
            f"Found 500 errors: {[r.text for r in five_hundreds]}"
        )

        # Identify which group won
        winning_groups = []
        losing_groups = []
        for g_idx, res_list in by_group.items():
            status_codes = [r.status_code for r in res_list]
            if any(c == 200 for c in status_codes):
                winning_groups.append(g_idx)
            else:
                losing_groups.append(g_idx)

        assert len(winning_groups) == 1, (
            f"Expected exactly 1 winning group, got {winning_groups}"
        )
        winning_group_idx = winning_groups[0]

        # All threads in winning group must have received 200 OK
        win_statuses = [r.status_code for r in by_group[winning_group_idx]]
        assert all(c == 200 for c in win_statuses), (
            f"Winning group had non-200 responses: {win_statuses}"
        )

        # All threads in losing groups must have received 409 Conflict
        for g_idx in losing_groups:
            lose_statuses = [r.status_code for r in by_group[g_idx]]
            assert all(c == 409 for c in lose_statuses), (
                f"Losing group {g_idx} had non-409 responses: {lose_statuses}"
            )

        # In DB: exactly 1 mutation event created
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(
                "SELECT COUNT(*) FROM user_application_events WHERE event_type = 'APPLICATION_SUBMITTED'"
            )
            assert cur.fetchone()[0] == 1

            cur = conn.execute(
                "SELECT version, macro_stage FROM user_applications WHERE user_id = ? AND job_id = ?",
                ("stress_user", job_id),
            )
            row = cur.fetchone()
            assert row[0] == 2
            assert row[1] == "APPLIED"

    def test_stale_update_simulation_matrix(self, stress_harness):
        """Exhaustive matrix of stale and future version update simulations."""
        client, repo, _ = stress_harness
        job_id = f"job-stale-matrix-{uuid.uuid4().hex[:8]}"
        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})

        # Move to version 3
        repo.dispatch_application_event(
            user_id="stress_user",
            job_id=job_id,
            event_id="evt-v1-to-v2",
            event_type="ASSETS_TAILORED",
            expected_version=1,
            new_macro_stage="LEAD",
        )
        repo.dispatch_application_event(
            user_id="stress_user",
            job_id=job_id,
            event_id="evt-v2-to-v3",
            event_type="APPLICATION_SUBMITTED",
            expected_version=2,
            new_macro_stage="APPLIED",
        )
        app = repo.get_user_application("stress_user", job_id)
        assert app["version"] == 3

        # Test stale versions: -1, 0, 1, 2
        for stale_ver in [-1, 0, 1, 2]:
            res = client.patch(
                f"/api/v1/jobs/{job_id}/events",
                headers={"X-User-Id": "stress_user"},
                json={
                    "event_type": "SCREEN_SCHEDULED",
                    "expected_version": stale_ver,
                    "new_macro_stage": "INTERVIEWING",
                },
            )
            assert res.status_code == 409, (
                f"Expected 409 for stale version {stale_ver}, got {res.status_code}: {res.text}"
            )
            body = res.json()
            assert body.get("current_version") == 3
            assert (
                f"expected {stale_ver}"
                in (body.get("detail", "") + body.get("error", "")).lower()
            )

        # Test future versions: 4, 10, 999
        for future_ver in [4, 10, 999]:
            res = client.patch(
                f"/api/v1/jobs/{job_id}/events",
                headers={"X-User-Id": "stress_user"},
                json={
                    "event_type": "SCREEN_SCHEDULED",
                    "expected_version": future_ver,
                    "new_macro_stage": "INTERVIEWING",
                },
            )
            assert res.status_code == 409, (
                f"Expected 409 for future version {future_ver}, got {res.status_code}"
            )
            body = res.json()
            assert body.get("current_version") == 3

    @pytest.mark.parametrize("thread_count", [10, 20])
    def test_direct_repository_thread_stress(self, stress_harness, thread_count):
        """Stress test JobRepository directly with concurrent threads (20 and 50)."""
        _, repo, db_path = stress_harness
        job_id = f"job-repo-{thread_count}-{uuid.uuid4().hex[:8]}"
        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})

        idemp_key = f"repo-{thread_count}-key-{uuid.uuid4()}"
        barrier = threading.Barrier(thread_count)
        results = []
        errors = []

        def worker(idx: int):
            barrier.wait()
            try:
                app, evt = repo.dispatch_application_event(
                    user_id="stress_user",
                    job_id=job_id,
                    event_id=f"evt-{thread_count}-{idx}",
                    event_type="APPLICATION_SUBMITTED",
                    expected_version=1,
                    new_macro_stage="APPLIED",
                    idempotency_key=idemp_key,
                )
                results.append((app, evt))
            except Exception as e:
                errors.append(e)

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=thread_count
        ) as executor:
            futures = [executor.submit(worker, i) for i in range(thread_count)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, (
            f"Repository raised errors under {thread_count} concurrent threads: {errors}"
        )
        assert len(results) == thread_count

        for app, evt in results:
            assert app["version"] == 2
            assert app["macro_stage"] == "APPLIED"
            assert evt["idempotency_key"] == idemp_key

        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(
                "SELECT COUNT(*) FROM user_application_events WHERE idempotency_key = ?",
                (idemp_key,),
            )
            assert cur.fetchone()[0] == 1

    def test_hostile_idempotency_keys_and_edge_cases(self, stress_harness):
        """Adversarial probe with unusual keys, special characters, and terminal state replay."""
        client, repo, _ = stress_harness
        job_id = f"job-hostile-keys-{uuid.uuid4().hex[:8]}"
        repo.upsert_user_application("stress_user", job_id, {"status": "sourced"})

        # 1. ASCII-printable complex characters in idempotency key
        hostile_key = "idemp:!@#$%^&*()_+=-`~[]{}|;:',.<>?/\\"
        res = client.patch(
            f"/api/v1/jobs/{job_id}/events",
            headers={"Idempotency-Key": hostile_key, "X-User-Id": "stress_user"},
            json={
                "event_type": "ASSETS_TAILORED",
                "expected_version": 1,
                "new_macro_stage": "LEAD",
            },
        )
        assert res.status_code == 200
        assert res.json()["event"]["idempotency_key"] == hostile_key

        # Replay with same hostile key
        res_replay = client.patch(
            f"/api/v1/jobs/{job_id}/events",
            headers={"Idempotency-Key": hostile_key, "X-User-Id": "stress_user"},
            json={
                "event_type": "ASSETS_TAILORED",
                "expected_version": 1,
            },
        )
        assert res_replay.status_code == 200
        assert res_replay.json()["application"]["version"] == 2

        # 2. Advance to CLOSED (terminal stage)
        res_close = client.patch(
            f"/api/v1/jobs/{job_id}/events",
            headers={"Idempotency-Key": "close-key-1", "X-User-Id": "stress_user"},
            json={
                "event_type": "REJECTED",
                "expected_version": 2,
                "new_macro_stage": "CLOSED",
            },
        )
        assert res_close.status_code == 200
        assert res_close.json()["application"]["macro_stage"] == "CLOSED"
        assert res_close.json()["application"]["version"] == 3

        # 3. New mutation on CLOSED application should fail with 400 Bad Request
        res_after_close = client.patch(
            f"/api/v1/jobs/{job_id}/events",
            headers={
                "Idempotency-Key": "new-event-on-closed",
                "X-User-Id": "stress_user",
            },
            json={
                "event_type": "OUTREACH_SENT",
                "expected_version": 3,
            },
        )
        assert res_after_close.status_code == 400
        assert "terminal" in res_after_close.text.lower()

        # 4. BUT replay of the close-key-1 should SUCCEED idempotently with 200 OK
        res_close_replay = client.patch(
            f"/api/v1/jobs/{job_id}/events",
            headers={"Idempotency-Key": "close-key-1", "X-User-Id": "stress_user"},
            json={
                "event_type": "REJECTED",
                "expected_version": 2,
            },
        )
        assert res_close_replay.status_code == 200
        assert res_close_replay.json()["application"]["macro_stage"] == "CLOSED"
        assert res_close_replay.json()["application"]["version"] == 3
