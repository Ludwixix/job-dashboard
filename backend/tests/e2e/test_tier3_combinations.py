"""Tier 3: Cross-Feature Combinations & Concurrency Stress Test Suite.

Scope:
- Multi-threaded concurrent execution of identical PATCH requests with the same Idempotency-Key
- Verifies:
  1. Exactly ONE event record created in SQLite user_application_events
  2. Application version incremented exactly once
  3. ZERO HTTP 500 Internal Server Errors
  4. Response consistency (HTTP 200 for winning and cached requests)
- Multi-threaded racing updates on identical version:
  1. Exactly ONE request succeeds (HTTP 200)
  2. All competing requests receive HTTP 409 Conflict
  3. Zero 500 errors
- Sequential version chaining and state integrity
"""

from __future__ import annotations

import concurrent.futures
import uuid


class TestTier3CrossFeatureCombinations:
    """Tier 3: Concurrency and Cross-Feature Combinations."""

    def test_concurrent_identical_requests_single_event_zero_500s(self, e2e_harness):
        """Concurrent identical PATCH requests with the same Idempotency-Key create exactly one event record without 500 errors."""
        job_id = "seek-tier3-concurrent-idemp"
        e2e_harness.seed_job(job_id=job_id, title="Lead SRE / DevOps")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        idemp_key = f"idemp-concurrent-{uuid.uuid4()}"
        num_threads = 10

        # Discover working endpoint
        check_res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            idempotency_key="probe-key",
            endpoint_override=f"/api/v1/jobs/{job_id}/events",
        )
        endpoint = (
            f"/api/v1/jobs/{job_id}/events"
            if check_res.status_code != 404
            else f"/api/applications/{job_id}/events"
        )

        # Re-reset application to version=1 for test
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        def worker_task(thread_idx: int):
            return e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                idempotency_key=idemp_key,
                payload={
                    "thread_idx": thread_idx,
                    "notes": "Concurrent submission stress test",
                },
                endpoint_override=endpoint,
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_threads)]
            responses = [f.result() for f in futures]

        # 1. Assert ZERO 500 errors across all concurrent threads
        status_codes = [r.status_code for r in responses]
        five_hundreds = [r for r in responses if r.status_code == 500]
        assert len(five_hundreds) == 0, (
            f"Found {len(five_hundreds)} HTTP 500 Internal Server Errors in concurrent execution! "
            f"Statuses: {status_codes}, Errors: {[r.text for r in five_hundreds]}"
        )

        # 2. All responses should be HTTP 200 (idempotent result) or handled gracefully
        assert all(code in (200, 409) for code in status_codes), (
            f"Unexpected status codes: {status_codes}"
        )
        assert 200 in status_codes, "At least one request must succeed with 200 OK"

        # 3. Exactly ONE event record created in user_application_events
        event_count = e2e_harness.get_raw_events_count(idempotency_key=idemp_key)
        assert event_count == 1, (
            f"Expected exactly 1 event record in database, found {event_count}"
        )

        # 4. Application version incremented exactly once (from 1 to 2)
        app_in_db = e2e_harness.get_raw_application(
            user_id="default_user", job_id=job_id
        )
        assert app_in_db is not None
        assert app_in_db["version"] == 2
        assert app_in_db["macro_stage"] == "APPLIED"

    def test_concurrent_racing_version_updates_exactly_one_winner(self, e2e_harness):
        """Racing concurrent updates claiming expected_version=1: exactly 1 wins (200), others receive 409 Conflict, zero 500s."""
        job_id = "seek-tier3-racing-occ"
        e2e_harness.seed_job(job_id=job_id, title="Principal Systems Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        num_threads = 8

        # Discover working endpoint
        probe_res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            endpoint_override=f"/api/v1/jobs/{job_id}/events",
        )
        endpoint = (
            f"/api/v1/jobs/{job_id}/events"
            if probe_res.status_code != 404
            else f"/api/applications/{job_id}/events"
        )

        # Reset application
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        def worker_task(thread_idx: int):
            # Each thread uses a distinct idempotency key and distinct payload, but same expected_version=1
            thread_key = f"key-race-{thread_idx}-{uuid.uuid4()}"
            return e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                idempotency_key=thread_key,
                payload={"worker": thread_idx},
                endpoint_override=endpoint,
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_threads)]
            responses = [f.result() for f in futures]

        status_codes = [r.status_code for r in responses]

        # 1. Zero 500 errors
        assert not any(code == 500 for code in status_codes), (
            f"Got 500 errors: {[r.text for r in responses if r.status_code == 500]}"
        )

        # 2. Exactly one 200 OK winner
        successes = [r for r in responses if r.status_code == 200]
        conflicts = [r for r in responses if r.status_code == 409]

        assert len(successes) == 1, (
            f"Expected exactly 1 winner with HTTP 200, got {len(successes)}. Statuses: {status_codes}"
        )
        assert len(conflicts) == num_threads - 1, (
            f"Expected {num_threads - 1} 409 Conflicts, got {len(conflicts)}"
        )

        # 3. Database version is strictly 2
        app_in_db = e2e_harness.get_raw_application(
            user_id="default_user", job_id=job_id
        )
        assert app_in_db["version"] == 2

    def test_rapid_consecutive_valid_version_ladder(self, e2e_harness):
        """Verify sequential version chaining from version 1 -> 5 without corruption."""
        job_id = "seek-tier3-ladder"
        e2e_harness.seed_job(job_id=job_id, title="Lead Solutions Architect")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        # Sequence of valid transitions:
        # LEAD (1) -> ASSETS_TAILORED -> LEAD (2)
        # LEAD (2) -> APPLICATION_SUBMITTED -> APPLIED (3)
        # APPLIED (3) -> SCREEN_SCHEDULED -> INTERVIEWING (4)
        # INTERVIEWING (4) -> OFFER_RECEIVED -> OFFER (5)
        ladder = [
            ("ASSETS_TAILORED", 1, "LEAD", 2),
            ("APPLICATION_SUBMITTED", 2, "APPLIED", 3),
            ("SCREEN_SCHEDULED", 3, "INTERVIEWING", 4),
            ("OFFER_RECEIVED", 4, "OFFER", 5),
        ]

        # Check endpoint
        probe = e2e_harness.patch_event(
            job_id=job_id, event_type="ASSETS_TAILORED", expected_version=1
        )
        endpoint = (
            f"/api/v1/jobs/{job_id}/events"
            if probe.status_code != 404
            else f"/api/applications/{job_id}/events"
        )
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        for event_type, expected_ver, next_stage, resulting_ver in ladder:
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type=event_type,
                expected_version=expected_ver,
                new_macro_stage=next_stage,
                endpoint_override=endpoint,
            )
            assert res.status_code == 200, (
                f"Failed at {event_type} (expected_ver={expected_ver}): {res.text}"
            )
            data = res.json()
            assert data["application"]["version"] == resulting_ver
            assert data["application"]["macro_stage"] == next_stage

        final_app = e2e_harness.get_raw_application(
            user_id="default_user", job_id=job_id
        )
        assert final_app["version"] == 5
        assert final_app["macro_stage"] == "OFFER"
