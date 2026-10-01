"""Tier 2: Boundary & Corner Cases Test Suite for Job Dashboard Refactoring.

Scope:
- Stale update simulations returning HTTP 409 Conflict
- Future/skewed version collisions returning HTTP 409 Conflict
- Missing required fields (expected_version, event_type) returning HTTP 400 Bad Request
- Empty or malformed request payloads
- Non-existent target jobs and applications
- Case-insensitivity of Idempotency-Key header
- Prohibited FSM transitions and terminal state enforcement
"""

from __future__ import annotations

import uuid

import pytest

from job_dashboard.state_machine import (
    MacroStage,
    MicroEventType,
    StateTransitionError,
    validate_transition,
)


class TestTier2BoundaryAndCornerCases:
    """Tier 2: Boundary and Corner Case Verification."""

    def test_stale_update_simulation_returns_409_conflict(self, e2e_harness):
        """Simulate stale client update (expected_version=1 when actual version=2) -> HTTP 409."""
        job_id = "seek-tier2-stale-409"
        e2e_harness.seed_job(job_id=job_id, title="Senior Cloud Architect")
        # Application seeded with version=2 (simulating concurrent or prior mutation)
        e2e_harness.seed_application(job_id=job_id, macro_stage="APPLIED", version=2)

        # Client attempts mutation with stale expected_version=1
        res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="SCREEN_SCHEDULED",
            expected_version=1,
            new_macro_stage="INTERVIEWING",
        )
        if res.status_code == 404:
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type="SCREEN_SCHEDULED",
                expected_version=1,
                new_macro_stage="INTERVIEWING",
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        assert res.status_code == 409, (
            f"Expected 409 Conflict for stale update, got {res.status_code}: {res.text}"
        )
        data = res.json()
        error_text = str(data.get("error") or data.get("detail") or "")
        assert "conflict" in error_text.lower() or "version" in error_text.lower()

    def test_future_version_mismatch_returns_409_conflict(self, e2e_harness):
        """Simulate future version mismatch (expected_version=99 when actual version=1) -> HTTP 409."""
        job_id = "seek-tier2-future-version"
        e2e_harness.seed_job(job_id=job_id, title="Principal Security Architect")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=99,
            new_macro_stage="APPLIED",
        )
        if res.status_code == 404:
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=99,
                new_macro_stage="APPLIED",
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        assert res.status_code == 409, (
            f"Expected 409 Conflict, got {res.status_code}: {res.text}"
        )

    def test_missing_expected_version_returns_400(self, e2e_harness):
        """Verify request omitting expected_version returns HTTP 400 Bad Request."""
        job_id = "seek-tier2-missing-ver"
        e2e_harness.seed_job(job_id=job_id, title="DevOps Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=None,
        )
        if res.status_code == 404:
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=None,
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        assert res.status_code in (400, 422), (
            f"Expected 400 or 422 for missing expected_version, got {res.status_code}"
        )

    def test_missing_event_type_returns_400(self, e2e_harness):
        """Verify request omitting event_type returns HTTP 400 Bad Request."""
        job_id = "seek-tier2-missing-evt"
        e2e_harness.seed_job(job_id=job_id, title="DevOps Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="",
            expected_version=1,
        )
        if res.status_code == 404:
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type="",
                expected_version=1,
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        assert res.status_code in (400, 422), (
            f"Expected 400 or 422 for missing event_type, got {res.status_code}"
        )

    def test_nonexistent_job_returns_404_or_409(self, e2e_harness):
        """Verify dispatching an event for an un-tracked / non-existent job returns error."""
        non_existent_id = f"non-existent-{uuid.uuid4().hex[:8]}"
        res = e2e_harness.patch_event(
            job_id=non_existent_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
        )
        if res.status_code == 404:
            # Check if 404 was from router or from business logic (Application not found)
            data = res.json()
            # If router 404 detail is "Not Found", try the alias route
            if data.get("detail") == "Not Found":
                res = e2e_harness.patch_event(
                    job_id=non_existent_id,
                    event_type="APPLICATION_SUBMITTED",
                    expected_version=1,
                    endpoint_override=f"/api/applications/{non_existent_id}/events",
                )

        assert res.status_code in (404, 409, 400), (
            f"Expected client error for non-existent job, got {res.status_code}"
        )

    def test_idempotency_key_header_case_insensitivity(self, e2e_harness):
        """Verify server recognizes both 'Idempotency-Key' and 'idempotency-key'."""
        job_id = "seek-tier2-case-header"
        e2e_harness.seed_job(job_id=job_id, title="Network Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        idemp_key = str(uuid.uuid4())
        # First call with lowercase header
        res1 = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            extra_headers={"idempotency-key": idemp_key},
        )
        if res1.status_code == 404:
            res1 = e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                extra_headers={"idempotency-key": idemp_key},
                endpoint_override=f"/api/applications/{job_id}/events",
            )
        assert res1.status_code == 200

        # Second call with Title-Case header
        res2 = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            extra_headers={"Idempotency-Key": idemp_key},
        )
        if res2.status_code == 404:
            res2 = e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                extra_headers={"Idempotency-Key": idemp_key},
                endpoint_override=f"/api/applications/{job_id}/events",
            )
        assert res2.status_code == 200
        # Exactly one event in DB
        assert e2e_harness.get_raw_events_count(idemp_key) == 1

    def test_fsm_terminal_stage_rejection(self):
        """Verify applications in CLOSED terminal stage reject subsequent event transitions."""
        with pytest.raises(StateTransitionError) as exc_info:
            validate_transition(MacroStage.CLOSED, MicroEventType.APPLICATION_SUBMITTED)
        assert "terminal state" in str(exc_info.value).lower()

    def test_prohibited_fsm_transition_rejection(self):
        """Verify invalid leap transitions (e.g. LEAD directly executing OFFER_ACCEPTED) are rejected."""
        with pytest.raises(StateTransitionError) as exc_info:
            validate_transition(MacroStage.LEAD, MicroEventType.OFFER_ACCEPTED)
        assert "prohibited transition" in str(exc_info.value).lower()
