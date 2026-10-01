"""Tier 4: Real-World Application Scenarios Test Suite.

Scope:
- Complete end-to-end recruitment funnel journeys across all Macro Stages:
  LEAD -> SAVED -> APPLIED -> INTERVIEWING -> OFFER -> CLOSED
- Timeline audit trail verification across multiple distinct events
- Realistic multi-tab concurrent triage conflict detection and recovery
"""

from __future__ import annotations

import uuid


class TestTier4RealWorldScenarios:
    """Tier 4: End-to-End Real-World Application Scenarios."""

    def test_full_recruitment_funnel_lifecycle_scenario(self, e2e_harness):
        """Simulate a candidate's complete recruitment journey from initial lead to accepted offer."""
        job_id = "seek-tier4-full-journey"
        e2e_harness.seed_job(
            job_id=job_id,
            title="Head of Cloud & Platform Engineering",
            company="Melbourne Financial Corp",
            score=98,
        )
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        # Check endpoint with dedicated probe job ID so we don't pollute the test job timeline
        probe = e2e_harness.patch_event(
            job_id="probe-job-check", event_type="ASSETS_TAILORED", expected_version=1
        )
        endpoint = (
            f"/api/v1/jobs/{job_id}/events"
            if probe.status_code != 404
            else f"/api/applications/{job_id}/events"
        )
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

        journey_events = [
            # 1. Candidate prepares application dossier
            {
                "event_type": "ASSETS_TAILORED",
                "expected_version": 1,
                "new_macro_stage": "SAVED",
                "payload": {"resume_model": "DeepSeek V3", "cover_letter_words": 380},
            },
            # 2. Candidate submits application
            {
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": 2,
                "new_macro_stage": "APPLIED",
                "payload": {"method": "portal", "portal_ref": "MEL-89421"},
            },
            # 3. Recruiter invites to phone screen
            {
                "event_type": "SCREEN_SCHEDULED",
                "expected_version": 3,
                "new_macro_stage": "INTERVIEWING",
                "payload": {
                    "interviewer": "Sarah Jenkins",
                    "scheduled_for": "2026-10-10T10:00:00Z",
                },
            },
            # 4. Technical panel interview completed
            {
                "event_type": "INTERVIEW_COMPLETED",
                "expected_version": 4,
                "new_macro_stage": "INTERVIEWING",
                "payload": {
                    "panel_members": 3,
                    "feedback": "Strong architecture depth",
                },
            },
            # 5. Formal written offer received
            {
                "event_type": "OFFER_RECEIVED",
                "expected_version": 5,
                "new_macro_stage": "OFFER",
                "payload": {"salary_package": 210000, "bonus_pct": 15},
            },
            # 6. Candidate signs and accepts offer
            {
                "event_type": "OFFER_ACCEPTED",
                "expected_version": 6,
                "new_macro_stage": "CLOSED",
                "payload": {"start_date": "2026-11-01", "signed_contract": True},
            },
        ]

        # Execute journey step by step
        for idx, step in enumerate(journey_events, start=1):
            key = f"key-journey-step-{idx}-{uuid.uuid4()}"
            res = e2e_harness.patch_event(
                job_id=job_id,
                event_type=step["event_type"],
                expected_version=step["expected_version"],
                new_macro_stage=step["new_macro_stage"],
                payload=step["payload"],
                idempotency_key=key,
                endpoint_override=endpoint,
            )
            assert res.status_code == 200, (
                f"Step {idx} ({step['event_type']}) failed: {res.text}"
            )
            data = res.json()
            assert data["application"]["version"] == step["expected_version"] + 1
            assert data["application"]["macro_stage"] == step["new_macro_stage"]

        # Final state verification in database
        final_app = e2e_harness.get_raw_application(
            user_id="default_user", job_id=job_id
        )
        assert final_app is not None
        assert final_app["version"] == 7
        assert final_app["macro_stage"] == "CLOSED"

        # Verify audit trail contains all 6 events
        events_res = e2e_harness.get_events(job_id)
        assert events_res.status_code == 200
        events_data = events_res.json()
        recorded_events = events_data.get("events", [])
        assert len(recorded_events) == 6

        recorded_types = [e["event_type"] for e in recorded_events]
        for step in journey_events:
            assert step["event_type"] in recorded_types

    def test_multi_tab_concurrent_triage_conflict_recovery(self, e2e_harness):
        """Simulate two browser tabs open simultaneously, detecting OCC conflict and recovering."""
        job_id = "seek-tier4-multi-tab"
        e2e_harness.seed_job(job_id=job_id, title="Infrastructure Lead")
        e2e_harness.seed_application(job_id=job_id, macro_stage="LEAD", version=1)

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

        # 1. Tab A and Tab B both load Job at version 1
        tab_a_cached_version = 1
        tab_b_cached_version = 1

        # 2. Tab A executes action: APPLICATION_SUBMITTED
        res_a = e2e_harness.patch_event(
            job_id=job_id,
            event_type="APPLICATION_SUBMITTED",
            expected_version=tab_a_cached_version,
            new_macro_stage="APPLIED",
            endpoint_override=endpoint,
        )
        assert res_a.status_code == 200
        tab_a_new_version = res_a.json()["application"]["version"]
        assert tab_a_new_version == 2

        # 3. Tab B (which still has stale cached_version=1) attempts action: LEAD_DISMISSED
        res_b = e2e_harness.patch_event(
            job_id=job_id,
            event_type="LEAD_DISMISSED",
            expected_version=tab_b_cached_version,  # Stale!
            new_macro_stage="CLOSED",
            endpoint_override=endpoint,
        )
        # Tab B MUST receive 409 Conflict
        assert res_b.status_code == 409, (
            f"Tab B should have received 409 Conflict, got {res_b.status_code}"
        )

        # 4. Tab B simulates client recovery: fetches latest application version
        app_b_fresh = e2e_harness.get_raw_application(
            user_id="default_user", job_id=job_id
        )
        assert app_b_fresh["version"] == 2
        assert app_b_fresh["macro_stage"] == "APPLIED"

        # 5. Tab B re-attempts an appropriate action for APPLIED stage using fresh version 2
        res_b_retry = e2e_harness.patch_event(
            job_id=job_id,
            event_type="SCREEN_SCHEDULED",
            expected_version=app_b_fresh["version"],
            new_macro_stage="INTERVIEWING",
            endpoint_override=endpoint,
        )
        assert res_b_retry.status_code == 200
        assert res_b_retry.json()["application"]["version"] == 3
        assert res_b_retry.json()["application"]["macro_stage"] == "INTERVIEWING"
