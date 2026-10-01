"""Empirical Challenger 2 Test Suite: FSM Boundaries, Illegal Transitions, Malformed Payloads & Ladder.

Adversarially stress-tests:
1. Terminal stage transitions (all 24 micro events from CLOSED).
2. Illegal transitions & stage skipping (LEAD->OFFER, SAVED->OFFER_ACCEPTED, APPLIED->OFFER_ACCEPTED, backward hops).
3. Missing / malformed expected_version & extreme version gaps (-99999, 0, 99999).
4. Missing / malformed event_type & malformed payload JSON.
5. Rapid ladder progression and timeline audit integrity.
6. Multi-user isolation and idempotency key leakage vulnerability check.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from job_dashboard.db import init_db
from job_dashboard.fastapi_app import create_app
from job_dashboard.repository import JobRepository
from job_dashboard.routes.jobs import handle_patch_application_events
from job_dashboard.state_machine import (
    TRANSITION_MAP,
    MacroStage,
    MicroEventType,
    StateTransitionError,
    get_valid_events_for_stage,
    is_terminal_stage,
    normalize_event_type,
    normalize_macro_stage,
    validate_transition,
)


# ==============================================================================
# Fixtures
# ==============================================================================


@pytest.fixture
def repo(tmp_path):
    """Provide an isolated JobRepository."""
    db_file = tmp_path / "fsm_test.sqlite3"
    return JobRepository(str(db_file))


@pytest.fixture
def client_and_repo(tmp_path, monkeypatch):
    """Provide FastAPI TestClient and isolated JobRepository."""
    monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(tmp_path))
    app = create_app()
    r = JobRepository(str(tmp_path / "jobs.sqlite3"))
    with TestClient(app) as client:
        yield client, r


# ==============================================================================
# Group 1: Terminal Stage (CLOSED) Boundaries & Resilience
# ==============================================================================


class TestTerminalClosedStageResilience:
    """Empirically test that CLOSED is strictly terminal and immutable."""

    def test_closed_stage_is_terminal(self):
        """Verify is_terminal_stage and empty valid event list for CLOSED."""
        assert is_terminal_stage(MacroStage.CLOSED) is True
        assert is_terminal_stage("CLOSED") is True
        assert is_terminal_stage("closed") is True
        assert get_valid_events_for_stage(MacroStage.CLOSED) == []
        assert get_valid_events_for_stage("CLOSED") == []

    def test_closed_stage_rejects_every_single_event_type(self):
        """Every event type in MicroEventType must be rejected when stage is CLOSED."""
        for evt in MicroEventType:
            with pytest.raises(StateTransitionError) as exc_info:
                validate_transition(MacroStage.CLOSED, evt)
            assert "terminal state 'CLOSED'" in str(exc_info.value)

    def test_closed_stage_rejects_resurrection_with_requested_stage(self):
        """Attempting to resurrect CLOSED by passing requested_stage must fail."""
        for target in [
            MacroStage.LEAD,
            MacroStage.SAVED,
            MacroStage.APPLIED,
            MacroStage.INTERVIEWING,
            MacroStage.OFFER,
        ]:
            with pytest.raises(StateTransitionError) as exc_info:
                validate_transition(
                    MacroStage.CLOSED,
                    MicroEventType.APPLICATION_SUBMITTED,
                    requested_stage=target,
                )
            assert "terminal state 'CLOSED'" in str(exc_info.value)

    def test_closed_stage_repository_dispatch_rolls_back_atomically(self, repo):
        """In repository, dispatching on a CLOSED application must not mutate DB or add events."""
        repo.upsert_user_application("u1", "job_term", {"status": "sourced"})
        # Transition to CLOSED via REJECTED
        app, evt = repo.dispatch_application_event(
            user_id="u1",
            job_id="job_term",
            event_id="evt_close",
            event_type="REJECTED",
            expected_version=1,
        )
        assert app["macro_stage"] == "CLOSED"
        assert app["version"] == 2

        initial_events = repo.get_application_events("u1", "job_term")
        initial_event_count = len(initial_events)

        # Attempt to dispatch on CLOSED application with correct expected_version=2
        with pytest.raises(ValueError) as exc:
            repo.dispatch_application_event(
                user_id="u1",
                job_id="job_term",
                event_id="evt_illegal_on_closed",
                event_type="APPLICATION_SUBMITTED",
                expected_version=2,
            )
        assert "terminal state" in str(exc.value).lower()

        # Verify DB state is strictly unchanged
        app_after = repo.get_user_application("u1", "job_term")
        assert app_after["macro_stage"] == "CLOSED"
        assert app_after["version"] == 2

        events_after = repo.get_application_events("u1", "job_term")
        assert len(events_after) == initial_event_count
        assert not any(e["id"] == "evt_illegal_on_closed" for e in events_after)

    def test_closed_stage_fastapi_returns_400_not_500(self, client_and_repo):
        """FastAPI endpoint returns 400 Bad Request when attempting events on CLOSED application."""
        client, r = client_and_repo
        r.upsert_user_application("default_user", "job_api_term", {"status": "sourced"})
        r.dispatch_application_event(
            user_id="default_user",
            job_id="job_api_term",
            event_id="evt_reject",
            event_type="REJECTED",
            expected_version=1,
        )

        res = client.patch(
            "/api/v1/jobs/job_api_term/events",
            json={
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": 2,
            },
        )
        assert res.status_code == 400
        assert "terminal state" in res.json().get("detail", "").lower()


# ==============================================================================
# Group 2: Invalid Transitions & Illegal Stage Jumps
# ==============================================================================


class TestInvalidTransitionsAndJumps:
    """Empirically test that illegal state skips and backward jumps are blocked."""

    @pytest.mark.parametrize(
        "stage,invalid_event",
        [
            # From LEAD: cannot jump to INTERVIEWING or OFFER
            (MacroStage.LEAD, MicroEventType.SCREEN_SCHEDULED),
            (MacroStage.LEAD, MicroEventType.PANEL_SCHEDULED),
            (MacroStage.LEAD, MicroEventType.ASSESSMENT_RECEIVED),
            (MacroStage.LEAD, MicroEventType.INTERVIEW_COMPLETED),
            (MacroStage.LEAD, MicroEventType.OFFER_RECEIVED),
            (MacroStage.LEAD, MicroEventType.COUNTER_OFFER_SENT),
            (MacroStage.LEAD, MicroEventType.OFFER_ACCEPTED),
            (MacroStage.LEAD, MicroEventType.OFFER_DECLINED),
            (MacroStage.LEAD, MicroEventType.OFFER_RESCINDED),
            # From SAVED: cannot jump to INTERVIEWING or OFFER
            (MacroStage.SAVED, MicroEventType.SCREEN_SCHEDULED),
            (MacroStage.SAVED, MicroEventType.PANEL_SCHEDULED),
            (MacroStage.SAVED, MicroEventType.OFFER_RECEIVED),
            (MacroStage.SAVED, MicroEventType.OFFER_ACCEPTED),
            # From APPLIED: cannot jump directly to OFFER
            (MacroStage.APPLIED, MicroEventType.OFFER_RECEIVED),
            (MacroStage.APPLIED, MicroEventType.COUNTER_OFFER_SENT),
            (MacroStage.APPLIED, MicroEventType.OFFER_ACCEPTED),
            (MacroStage.APPLIED, MicroEventType.OFFER_DECLINED),
            # Backward hops: cannot jump back from INTERVIEWING to LEAD events
            (MacroStage.INTERVIEWING, MicroEventType.LEAD_IMPORTED),
            (MacroStage.INTERVIEWING, MicroEventType.SOURCED_MANUALLY),
            (MacroStage.INTERVIEWING, MicroEventType.LEAD_DISMISSED),
            # Backward hops: cannot jump back from OFFER to APPLIED/LEAD events
            (MacroStage.OFFER, MicroEventType.APPLICATION_SUBMITTED),
            (MacroStage.OFFER, MicroEventType.SCREEN_SCHEDULED),
            (MacroStage.OFFER, MicroEventType.PANEL_SCHEDULED),
            (MacroStage.OFFER, MicroEventType.LEAD_IMPORTED),
        ],
    )
    def test_prohibited_transitions_raise_error(self, stage, invalid_event):
        """Prohibited events from stages must raise StateTransitionError."""
        with pytest.raises(StateTransitionError) as exc_info:
            validate_transition(stage, invalid_event)
        assert "prohibited transition" in str(exc_info.value).lower()

    def test_conflicting_requested_stage_rejected(self):
        """When requested_stage contradicts natural event transition, must raise StateTransitionError."""
        # SCREEN_SCHEDULED from APPLIED naturally goes to INTERVIEWING; requesting SAVED must be rejected
        with pytest.raises(StateTransitionError) as exc_info:
            validate_transition(
                MacroStage.APPLIED,
                MicroEventType.SCREEN_SCHEDULED,
                requested_stage=MacroStage.SAVED,
            )
        assert "conflicting target stage" in str(exc_info.value).lower()

    def test_unknown_macro_stages_and_event_types(self):
        """Unknown stages or events must raise StateTransitionError with informative messages."""
        with pytest.raises(StateTransitionError) as e1:
            normalize_macro_stage("NON_EXISTENT_STAGE")
        assert "unknown macro stage" in str(e1.value).lower()

        with pytest.raises(StateTransitionError) as e2:
            normalize_event_type("NON_EXISTENT_EVENT")
        assert "unknown micro-event" in str(e2.value).lower()

        with pytest.raises(StateTransitionError):
            validate_transition("BOGUS_STAGE", MicroEventType.APPLICATION_SUBMITTED)

        with pytest.raises(StateTransitionError):
            validate_transition(MacroStage.LEAD, "BOGUS_EVENT")


# ==============================================================================
# Group 3: Missing Version, Malformed Payload & Extreme Version Gaps
# ==============================================================================


class TestVersionAndPayloadResilience:
    """Empirically test extreme version numbers, malformed payloads, and missing fields."""

    @pytest.mark.parametrize(
        "bad_version",
        [99999, 1000000, -99999, -1, 0, 50],
    )
    def test_extreme_version_gaps_return_409_conflict(
        self, client_and_repo, bad_version
    ):
        """Extreme version gaps against current version 1 must consistently return HTTP 409."""
        client, r = client_and_repo
        r.upsert_user_application("default_user", "job_extreme", {"status": "sourced"})

        res = client.patch(
            "/api/v1/jobs/job_extreme/events",
            json={
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": bad_version,
            },
        )
        assert res.status_code == 409
        body = res.json()
        assert "conflict" in body.get("detail", "").lower()
        assert body.get("current_version") == 1

    def test_missing_expected_version_fastapi(self, client_and_repo):
        """Missing expected_version returns 422 Unprocessable Entity in FastAPI."""
        client, r = client_and_repo
        r.upsert_user_application(
            "default_user", "job_missing_ver", {"status": "sourced"}
        )

        res = client.patch(
            "/api/v1/jobs/job_missing_ver/events",
            json={"event_type": "APPLICATION_SUBMITTED"},
        )
        assert res.status_code == 422

    def test_missing_event_type_fastapi(self, client_and_repo):
        """Missing event_type returns 422 Unprocessable Entity in FastAPI."""
        client, r = client_and_repo
        r.upsert_user_application(
            "default_user", "job_missing_evt", {"status": "sourced"}
        )

        res = client.patch(
            "/api/v1/jobs/job_missing_evt/events",
            json={"expected_version": 1},
        )
        assert res.status_code == 422

    def test_empty_string_event_type_fastapi(self, client_and_repo):
        """Empty string event_type returns 400 Bad Request."""
        client, r = client_and_repo
        r.upsert_user_application(
            "default_user", "job_empty_evt", {"status": "sourced"}
        )

        res = client.patch(
            "/api/v1/jobs/job_empty_evt/events",
            json={"expected_version": 1, "event_type": ""},
        )
        assert res.status_code == 400
        assert "unknown micro-event" in res.json().get("detail", "").lower()

    def test_unknown_event_type_fastapi(self, client_and_repo):
        """Arbitrary/injected event_type returns 400 Bad Request."""
        client, r = client_and_repo
        r.upsert_user_application("default_user", "job_inj_evt", {"status": "sourced"})

        res = client.patch(
            "/api/v1/jobs/job_inj_evt/events",
            json={
                "expected_version": 1,
                "event_type": "DROP TABLE user_applications;--",
            },
        )
        assert res.status_code == 400
        assert "unknown micro-event" in res.json().get("detail", "").lower()

    def test_complex_and_unicode_payloads_stored_defensively(self, client_and_repo):
        """Complex nested dictionaries, unicode, and large structures are preserved without corruption."""
        client, r = client_and_repo
        r.upsert_user_application("default_user", "job_payload", {"status": "sourced"})

        complex_payload = {
            "unicode_test": "🚀 Victoria Govt Melbourne 🇦🇺 日本語",
            "nested": {"level1": {"level2": [1, 2, {"key": "val"}]}},
            "special_chars": "<script>alert('xss')</script> & ' \" \n \t",
            "null_field": None,
            "bool_flag": True,
        }

        res = client.patch(
            "/api/v1/jobs/job_payload/events",
            json={
                "event_type": "ASSETS_TAILORED",
                "expected_version": 1,
                "payload": complex_payload,
            },
        )
        assert res.status_code == 200
        event = res.json()["event"]
        saved_payload = json.loads(event["payload_json"])
        assert saved_payload["unicode_test"] == complex_payload["unicode_test"]
        assert saved_payload["nested"]["level1"]["level2"][2]["key"] == "val"
        assert saved_payload["special_chars"] == complex_payload["special_chars"]


# ==============================================================================
# Group 4: Web.py Standard Library Router Handler Tests
# ==============================================================================


class TestWebPyHandlerResilience:
    """Empirically test handle_patch_application_events in routes/jobs.py."""

    class MockApp:
        def __init__(self, repository):
            self.repository = repository

    class MockHandler:
        def __init__(self, repository, headers=None, body=None):
            self.app = TestWebPyHandlerResilience.MockApp(repository)
            self.headers = headers or {}
            self._cached_json_body = body
            self.sent_status = None
            self.sent_json = None

        def send_json(self, status_code: int, data: dict):
            self.sent_status = status_code
            self.sent_json = data

    def test_web_py_missing_body(self, repo):
        """Web handler returns 400 when body is missing."""
        handler = self.MockHandler(repo, body=None)
        handle_patch_application_events(handler, "job1")
        assert handler.sent_status == 400
        assert "Missing JSON body" in handler.sent_json["error"]

    def test_web_py_missing_expected_version(self, repo):
        """Web handler returns 400 when expected_version is missing."""
        handler = self.MockHandler(repo, body={"event_type": "APPLICATION_SUBMITTED"})
        handle_patch_application_events(handler, "job1")
        assert handler.sent_status == 400
        assert "expected_version is required" in handler.sent_json["error"]

    def test_web_py_missing_event_type(self, repo):
        """Web handler returns 400 when event_type is missing."""
        handler = self.MockHandler(repo, body={"expected_version": 1})
        handle_patch_application_events(handler, "job1")
        assert handler.sent_status == 400
        assert "event_type is required" in handler.sent_json["error"]

    def test_web_py_conflict_returns_409(self, repo):
        """Web handler returns 409 with current_version on version conflict."""
        repo.upsert_user_application(
            "default_user", "job_web_conf", {"status": "sourced"}
        )
        handler = self.MockHandler(
            repo,
            body={"event_type": "APPLICATION_SUBMITTED", "expected_version": 99},
        )
        handle_patch_application_events(handler, "job_web_conf")
        assert handler.sent_status == 409
        assert "Resource version conflict" in handler.sent_json["error"]
        assert handler.sent_json["current_version"] == 1

    def test_web_py_terminal_state_returns_400(self, repo):
        """Web handler returns 400 when attempting transition from terminal CLOSED."""
        repo.upsert_user_application(
            "default_user", "job_web_term", {"status": "sourced"}
        )
        repo.dispatch_application_event(
            "default_user", "job_web_term", "e1", "REJECTED", expected_version=1
        )

        handler = self.MockHandler(
            repo,
            body={"event_type": "APPLICATION_SUBMITTED", "expected_version": 2},
        )
        handle_patch_application_events(handler, "job_web_term")
        assert handler.sent_status == 400
        assert "terminal state" in handler.sent_json["error"].lower()


# ==============================================================================
# Group 5: Rapid Ladder Progression & Full Audit Timeline Integrity
# ==============================================================================


class TestRapidLadderProgressionAndAudit:
    """Empirically test full end-to-end multi-step lifecycle progression and audit trail."""

    def test_full_ladder_lifecycle_and_audit_timeline(self, repo):
        """Progress an application through all stages from LEAD to CLOSED, verifying version and audit."""
        repo.upsert_user_application("user_ladder", "job_ladder", {"status": "sourced"})
        app = repo.get_user_application("user_ladder", "job_ladder")
        assert app["macro_stage"] == "LEAD"
        assert app["version"] == 1

        # Ladder sequence of (event_type, requested_stage, expected_stage, expected_ver)
        ladder = [
            ("LEAD_IMPORTED", None, "LEAD", 2),
            ("DOSSIER_COMPILED", None, "LEAD", 3),
            ("ASSETS_TAILORED", "SAVED", "SAVED", 4),
            ("APPLICATION_SUBMITTED", None, "APPLIED", 5),
            ("OUTREACH_SENT", None, "APPLIED", 6),
            ("SCREEN_SCHEDULED", None, "INTERVIEWING", 7),
            ("ASSESSMENT_RECEIVED", None, "INTERVIEWING", 8),
            ("PANEL_SCHEDULED", None, "INTERVIEWING", 9),
            ("INTERVIEW_COMPLETED", None, "INTERVIEWING", 10),
            ("OFFER_RECEIVED", None, "OFFER", 11),
            ("COUNTER_OFFER_SENT", None, "OFFER", 12),
            ("OFFER_ACCEPTED", None, "CLOSED", 13),
        ]

        expected_version = 1
        dispatched_event_ids = []

        for evt_type, req_stage, exp_stage, exp_ver in ladder:
            evt_id = f"evt_{evt_type.lower()}_{expected_version}"
            dispatched_event_ids.append(evt_id)
            updated_app, event = repo.dispatch_application_event(
                user_id="user_ladder",
                job_id="job_ladder",
                event_id=evt_id,
                event_type=evt_type,
                expected_version=expected_version,
                new_macro_stage=req_stage,
                payload_json=json.dumps(
                    {"step": evt_type, "from_ver": expected_version}
                ),
            )
            assert updated_app["macro_stage"] == exp_stage, f"Failed at {evt_type}"
            assert updated_app["version"] == exp_ver, f"Failed version at {evt_type}"
            assert event["id"] == evt_id
            assert event["event_type"] == evt_type
            expected_version = exp_ver

        # Verify audit trail in user_application_events
        audit_events = repo.get_application_events("user_ladder", "job_ladder")
        assert (
            len(audit_events) == 13
        )  # 1 initial 'sourced' + 12 dispatched ladder events

        # Verify reverse chronological ordering
        for i in range(len(audit_events) - 1):
            assert audit_events[i]["created_at"] >= audit_events[i + 1]["created_at"]

        # Terminal check: Application is now at CLOSED with version 13
        # Attempting any new event must fail
        with pytest.raises(ValueError) as exc:
            repo.dispatch_application_event(
                user_id="user_ladder",
                job_id="job_ladder",
                event_id="evt_post_closed",
                event_type="APPLICATION_SUBMITTED",
                expected_version=13,
            )
        assert "terminal state 'CLOSED'" in str(exc.value)

        # Attempting with wrong version must fail with conflict
        with pytest.raises(ValueError) as exc2:
            repo.dispatch_application_event(
                user_id="user_ladder",
                job_id="job_ladder",
                event_id="evt_post_closed_wrong_ver",
                event_type="APPLICATION_SUBMITTED",
                expected_version=999,
            )
        assert "Resource version conflict" in str(exc2.value)


# ==============================================================================
# Group 6: Idempotency Key Scoping & Tenant Isolation Vulnerability
# ==============================================================================


class TestIdempotencyScopingAndIsolation:
    """Empirically test whether Idempotency-Key leaks data across users or jobs."""

    def test_cross_user_idempotency_key_data_leakage(self, client_and_repo):
        """VULNERABILITY TEST: Reusing an idempotency key across different users MUST NOT leak data."""
        client, r = client_and_repo
        shared_key = str(uuid.uuid4())

        # Alice creates a private application with sensitive notes
        r.upsert_user_application(
            "alice",
            "job_alice_only",
            {"status": "sourced", "notes": "Private note: salary 180k"},
        )
        r1 = client.patch(
            "/api/v1/jobs/job_alice_only/events",
            headers={"X-User-Id": "alice", "Idempotency-Key": shared_key},
            json={"event_type": "APPLICATION_SUBMITTED", "expected_version": 1},
        )
        assert r1.status_code == 200

        # Bob submits a request with the SAME idempotency key on a different job
        r2 = client.patch(
            "/api/v1/jobs/job_bob_target/events",
            headers={"X-User-Id": "bob", "Idempotency-Key": shared_key},
            json={"event_type": "APPLICATION_SUBMITTED", "expected_version": 1},
        )

        # CHALLENGE ASSERTION:
        # If Bob receives Alice's application, this is a privacy leak!
        app_returned = r2.json().get("application") or {}
        returned_user = app_returned.get("user_id")
        returned_notes = app_returned.get("notes")

        # The system MUST NOT return Alice's data to Bob
        leak_detected = returned_user == "alice" or "salary 180k" in str(returned_notes)
        assert not leak_detected, (
            f"CRITICAL VULNERABILITY DETECTED: Cross-user idempotency key collision returned "
            f"Alice's private data to Bob! (returned user_id={returned_user}, notes={returned_notes})"
        )
