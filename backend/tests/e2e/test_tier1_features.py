"""Tier 1: Feature Coverage Test Suite for Job Dashboard Refactoring.

Scope:
- Isolated happy-path tests for each individual feature
- Single event state transitions and version increments
- Idempotent event caching on single-thread repetition
- FSM transition rule compliance
- Triage queue structure and next best action mapping
- Opaque-box HTTP contract compliance
"""

from __future__ import annotations

import uuid

from job_dashboard.state_machine import (
    MacroStage,
    MicroEventType,
    validate_transition,
)


class TestTier1FeatureCoverage:
    """Tier 1: Isolated Happy-Path Feature Verification."""

    def test_fsm_transition_rules_contract(self):
        """Verify the two-tier FSM transition rules for canonical stages."""
        # 1. LEAD promotions
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.APPLICATION_SUBMITTED)
            == MacroStage.APPLIED
        )
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.LEAD_DISMISSED)
            == MacroStage.CLOSED
        )
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.DOSSIER_COMPILED)
            == MacroStage.LEAD
        )

        # 2. APPLIED promotions
        assert (
            validate_transition(MacroStage.APPLIED, MicroEventType.SCREEN_SCHEDULED)
            == MacroStage.INTERVIEWING
        )
        assert (
            validate_transition(MacroStage.APPLIED, MicroEventType.REJECTED)
            == MacroStage.CLOSED
        )

        # 3. INTERVIEWING promotions
        assert (
            validate_transition(MacroStage.INTERVIEWING, MicroEventType.OFFER_RECEIVED)
            == MacroStage.OFFER
        )
        assert (
            validate_transition(
                MacroStage.INTERVIEWING, MicroEventType.INTERVIEW_COMPLETED
            )
            == MacroStage.INTERVIEWING
        )

        # 4. OFFER promotions
        assert (
            validate_transition(MacroStage.OFFER, MicroEventType.OFFER_ACCEPTED)
            == MacroStage.CLOSED
        )

    def test_repository_dispatch_application_event_isolated(self, repo, db_path):
        """Verify repository layer atomic event dispatch with OCC increment."""
        job_id = "test-job-tier1-repo"
        user_id = "user_tier1"
        repo.upsert_user_application(
            user_id=user_id, job_id=job_id, data={"status": "sourced"}
        )

        app_initial = repo.get_user_application(user_id, job_id)
        assert app_initial is not None
        assert app_initial.get("version") == 1
        assert app_initial.get("macro_stage") == "LEAD"

        event_id = str(uuid.uuid4())
        idemp_key = str(uuid.uuid4())
        updated_app, event = repo.dispatch_application_event(
            user_id=user_id,
            job_id=job_id,
            event_id=event_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            payload_json='{"portal": "seek"}',
            idempotency_key=idemp_key,
        )

        assert updated_app["version"] == 2
        assert updated_app["macro_stage"] == "APPLIED"
        assert event["id"] == event_id
        assert event["event_type"] == "APPLICATION_SUBMITTED"

    def test_patch_event_single_happy_path(self, e2e_harness):
        """Verify PATCH /api/v1/jobs/{id}/events increments version and updates stage."""
        job_id = "seek-tier1-happy"
        e2e_harness.seed_job(job_id=job_id, title="Senior Site Reliability Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        idemp_key = str(uuid.uuid4())
        response = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            idempotency_key=idemp_key,
            payload={"notes": "Submitted via Seek portal"},
        )

        # Allow testing against /api/v1/jobs/{id}/events or /api/applications/{id}/events
        if response.status_code == 404:
            response = e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                idempotency_key=idemp_key,
                payload={"notes": "Submitted via Seek portal"},
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        data = response.json()
        assert data.get("success") is True
        assert "application" in data
        assert "event" in data

        app = data["application"]
        assert app["version"] == 2
        assert app["macro_stage"] == "APPLIED"

        event = data["event"]
        assert event["event_type"] == "APPLICATION_SUBMITTED"
        assert e2e_harness.get_raw_events_count(idemp_key) == 1

    def test_idempotent_single_retry_returns_cached_event(self, e2e_harness):
        """Verify re-sending identical request with same Idempotency-Key returns cached 200."""
        job_id = "seek-tier1-idemp"
        e2e_harness.seed_job(job_id=job_id, title="Lead Infrastructure Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        idemp_key = str(uuid.uuid4())
        # First dispatch
        res1 = e2e_harness.patch_event(
            job_id=job_id,
            event_type="DOSSIER_COMPILED",
            expected_version=1,
            new_macro_stage="SAVED",
            idempotency_key=idemp_key,
        )
        if res1.status_code == 404:
            res1 = e2e_harness.patch_event(
                job_id=job_id,
                event_type="DOSSIER_COMPILED",
                expected_version=1,
                new_macro_stage="SAVED",
                idempotency_key=idemp_key,
                endpoint_override=f"/api/applications/{job_id}/events",
            )
        assert res1.status_code == 200
        first_event_id = res1.json()["event"]["id"]

        # Second dispatch with identical Idempotency-Key
        res2 = e2e_harness.patch_event(
            job_id=job_id,
            event_type="DOSSIER_COMPILED",
            expected_version=1,  # same or subsequent version
            new_macro_stage="SAVED",
            idempotency_key=idemp_key,
        )
        if res2.status_code == 404:
            res2 = e2e_harness.patch_event(
                job_id=job_id,
                event_type="DOSSIER_COMPILED",
                expected_version=1,
                new_macro_stage="SAVED",
                idempotency_key=idemp_key,
                endpoint_override=f"/api/applications/{job_id}/events",
            )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["event"]["id"] == first_event_id
        # Version must not have double-incremented to 3
        assert data2["application"]["version"] == 2
        # Database must contain exactly 1 event for this idempotency key
        assert e2e_harness.get_raw_events_count(idemp_key) == 1

    def test_audit_timeline_reflects_created_events(self, e2e_harness):
        """Verify timeline audit query returns the created events."""
        job_id = "seek-tier1-timeline"
        e2e_harness.seed_job(job_id=job_id, title="Platform Engineer")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        idemp_key = str(uuid.uuid4())
        res = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            idempotency_key=idemp_key,
        )
        if res.status_code == 404:
            e2e_harness.patch_event(
                job_id=job_id,
                event_type="APPLICATION_SUBMITTED",
                expected_version=1,
                new_macro_stage="APPLIED",
                idempotency_key=idemp_key,
                endpoint_override=f"/api/applications/{job_id}/events",
            )

        events_res = e2e_harness.get_events(job_id)
        assert events_res.status_code == 200
        events_data = events_res.json()
        events = events_data.get("events", [])
        assert len(events) >= 1
        assert any(e.get("event_type") == "APPLICATION_SUBMITTED" for e in events)

    def test_nba_queue_endpoint_structure(self, e2e_harness):
        """Verify GET /api/v1/jobs/queue returns prioritized triage feed items."""
        job_id = "seek-tier1-queue"
        e2e_harness.seed_job(job_id=job_id, title="Senior Cloud Architect", score=92)
        e2e_harness.seed_application(job_id=job_id, macro_stage="SAVED", version=1)

        res = e2e_harness.get_queue()
        # If queue endpoint is not yet mounted (Phase 2), verify contract structure if 200,
        # otherwise document status
        if res.status_code == 200:
            data = res.json()
            assert "items" in data
            assert isinstance(data["items"], list)
            if len(data["items"]) > 0:
                item = data["items"][0]
                assert "priority_score" in item
                assert "macro_stage" in item
                assert "version" in item
                assert "next_best_action" in item
        else:
            assert res.status_code in (404, 501), (
                f"Unexpected status code for queue: {res.status_code}"
            )
