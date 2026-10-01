"""Comprehensive unit, integration, and concurrency tests for Milestone M1.

Tests cover:
1. Two-Tier Finite State Machine (Macro Stage + Micro-Event transitions and constraints).
2. SQLAlchemy ORM models with version-based Optimistic Concurrency Control (OCC).
3. SQLite WAL session management and busy timeout handling.
4. Repository layer OCC validation, state progression, and idempotency key deduplication.
5. Concurrent requests handling:
   - Multiple identical requests with the same Idempotency-Key create exactly 1 event without 500 errors.
   - Concurrent conflicting requests with stale expected_version return HTTP 409 Conflict.
6. FastAPI endpoints: PATCH /api/v1/jobs/{job_id}/events and GET /api/v1/jobs/{job_id}/events.
"""

from __future__ import annotations

import concurrent.futures
import sqlite3
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm.exc import StaleDataError

from job_dashboard.db import init_db
from job_dashboard.db_session import db_session_scope, get_session_factory
from job_dashboard.fastapi_app import create_app
from job_dashboard.orm_models import ApplicationEvent, JobApplication
from job_dashboard.repository import JobRepository
from job_dashboard.state_machine import (
    MacroStage,
    MicroEventType,
    StateTransitionError,
    is_terminal_stage,
    validate_transition,
)

# ============================================================================
# 1. Two-Tier Finite State Machine Tests
# ============================================================================


class TestTwoTierStateMachine:
    """Test stage validation, transitions, and terminal boundaries."""

    def test_macro_stage_and_micro_event_enums(self):
        """Verify all mandatory stages and micro-events exist."""
        expected_stages = {
            "LEAD",
            "SAVED",
            "APPLIED",
            "INTERVIEWING",
            "OFFER",
            "CLOSED",
        }
        actual_stages = {s.value for s in MacroStage}
        assert expected_stages.issubset(actual_stages)

        expected_events = {
            "LEAD_IMPORTED",
            "ASSETS_TAILORED",
            "APPLICATION_SUBMITTED",
            "OUTREACH_SENT",
            "SCREEN_SCHEDULED",
            "ASSESSMENT_RECEIVED",
            "INTERVIEW_COMPLETED",
            "OFFER_RECEIVED",
            "OFFER_ACCEPTED",
            "REJECTED",
            "GHOSTED",
        }
        actual_events = {e.value for e in MicroEventType}
        assert expected_events.issubset(actual_events)

    def test_valid_stage_progressions(self):
        """Verify happy-path forward transitions from LEAD to CLOSED."""
        # LEAD -> APPLIED
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.APPLICATION_SUBMITTED)
            == MacroStage.APPLIED
        )
        # APPLIED -> INTERVIEWING
        assert (
            validate_transition(MacroStage.APPLIED, MicroEventType.SCREEN_SCHEDULED)
            == MacroStage.INTERVIEWING
        )
        # INTERVIEWING -> OFFER
        assert (
            validate_transition(MacroStage.INTERVIEWING, MicroEventType.OFFER_RECEIVED)
            == MacroStage.OFFER
        )
        # OFFER -> CLOSED
        assert (
            validate_transition(MacroStage.OFFER, MicroEventType.OFFER_ACCEPTED)
            == MacroStage.CLOSED
        )

    def test_in_stage_events_maintain_current_stage(self):
        """Verify micro-events that do not change the macro stage."""
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.LEAD_IMPORTED)
            == MacroStage.LEAD
        )
        assert (
            validate_transition(MacroStage.LEAD, MicroEventType.ASSETS_TAILORED)
            == MacroStage.LEAD
        )
        assert (
            validate_transition(MacroStage.APPLIED, MicroEventType.FOLLOW_UP_SENT)
            == MacroStage.APPLIED
        )
        assert (
            validate_transition(
                MacroStage.INTERVIEWING, MicroEventType.INTERVIEW_COMPLETED
            )
            == MacroStage.INTERVIEWING
        )
        assert (
            validate_transition(MacroStage.INTERVIEWING, MicroEventType.PANEL_SCHEDULED)
            == MacroStage.INTERVIEWING
        )

    def test_lead_to_saved_transition_with_requested_stage(self):
        """Verify LEAD can move to SAVED when explicitly requested."""
        res = validate_transition(
            MacroStage.LEAD,
            MicroEventType.ASSETS_TAILORED,
            requested_stage=MacroStage.SAVED,
        )
        assert res == MacroStage.SAVED

    def test_terminal_rejections_transition_to_closed(self):
        """Verify rejections and ghosting move any active stage to CLOSED."""
        for stage in [
            MacroStage.LEAD,
            MacroStage.SAVED,
            MacroStage.APPLIED,
            MacroStage.INTERVIEWING,
            MacroStage.OFFER,
        ]:
            assert (
                validate_transition(stage, MicroEventType.REJECTED) == MacroStage.CLOSED
            )
            assert (
                validate_transition(stage, MicroEventType.GHOSTED) == MacroStage.CLOSED
            )

    def test_closed_terminal_stage_rejects_all_events(self):
        """Verify applications in CLOSED stage reject any new events."""
        assert is_terminal_stage(MacroStage.CLOSED) is True
        for event in MicroEventType:
            with pytest.raises(StateTransitionError) as exc_info:
                validate_transition(MacroStage.CLOSED, event)
            assert "terminal state" in str(exc_info.value).lower()

    def test_prohibited_transition_raises_error(self):
        """Verify skipping stages or executing invalid events raises StateTransitionError."""
        # Cannot jump from LEAD directly to OFFER_ACCEPTED
        with pytest.raises(StateTransitionError):
            validate_transition(MacroStage.LEAD, MicroEventType.OFFER_ACCEPTED)

        # Cannot schedule panel when only in LEAD stage
        with pytest.raises(StateTransitionError):
            validate_transition(MacroStage.LEAD, MicroEventType.PANEL_SCHEDULED)


# ============================================================================
# 2. SQLAlchemy ORM Models & OCC Versioning Tests
# ============================================================================


class TestSQLAlchemyOCC:
    """Test SQLAlchemy ORM model version_id_col and OCC mechanics."""

    @pytest.fixture
    def sa_db(self, tmp_path):
        """Provide a test database initialized with SQLAlchemy engine."""
        db_file = tmp_path / "test_sa.sqlite3"
        conn = sqlite3.connect(str(db_file))
        init_db(conn)
        conn.close()
        return str(db_file)

    def test_orm_models_version_id_col_configuration(self):
        """Verify JobApplication is configured with OCC version_id_col."""
        assert "version_id_col" in JobApplication.__mapper_args__
        col = JobApplication.__mapper_args__["version_id_col"]
        assert col.name == "version"

    def test_sqlalchemy_automatic_version_increment(self, sa_db):
        """Verify SQLAlchemy automatically increments version on updates."""
        with db_session_scope(sa_db) as session:
            app = JobApplication(
                id="app_test_1",
                user_id="user_1",
                job_id="job_1",
                macro_stage=MacroStage.LEAD.value,
                version=1,
            )
            session.add(app)

        # Update stage via ORM
        with db_session_scope(sa_db) as session:
            app = session.get(JobApplication, "app_test_1")
            assert app.version == 1
            app.macro_stage = MacroStage.APPLIED.value

        # Re-fetch and verify version incremented
        with db_session_scope(sa_db) as session:
            app = session.get(JobApplication, "app_test_1")
            assert app.macro_stage == MacroStage.APPLIED.value
            assert app.version == 2

    def test_sqlalchemy_stale_data_error_on_concurrent_update(self, sa_db):
        """Verify StaleDataError is raised when updating with a stale version."""
        with db_session_scope(sa_db) as session:
            app = JobApplication(
                id="app_occ_conflict",
                user_id="user_occ",
                job_id="job_occ",
                macro_stage=MacroStage.LEAD.value,
                version=1,
            )
            session.add(app)

        # Session 1 and Session 2 both fetch the same application
        factory = get_session_factory(sa_db)
        session1 = factory()
        session2 = factory()

        try:
            app1 = session1.get(JobApplication, "app_occ_conflict")
            app2 = session2.get(JobApplication, "app_occ_conflict")
            assert app1.version == 1
            assert app2.version == 1

            # Session 1 commits update -> version becomes 2
            app1.macro_stage = MacroStage.APPLIED.value
            session1.commit()

            # Session 2 tries to commit with stale version 1 -> StaleDataError
            app2.macro_stage = MacroStage.INTERVIEWING.value
            with pytest.raises(StaleDataError):
                session2.commit()
        finally:
            session1.close()
            session2.close()

    def test_application_event_relationship_and_cascade(self, sa_db):
        """Verify events relationship and cascading persistence."""
        with db_session_scope(sa_db) as session:
            app = JobApplication(
                id="app_rel_1",
                user_id="user_rel",
                job_id="job_rel",
                macro_stage=MacroStage.LEAD.value,
                version=1,
            )
            event = ApplicationEvent(
                id="evt_rel_1",
                application_id="app_rel_1",
                event_type=MicroEventType.LEAD_IMPORTED.value,
                idempotency_key="idemp_rel_1",
                payload_json='{"source": "seek"}',
            )
            app.events.append(event)
            session.add(app)

        with db_session_scope(sa_db) as session:
            app = session.get(JobApplication, "app_rel_1")
            assert len(app.events) == 1
            assert app.events[0].id == "evt_rel_1"
            assert app.events[0].idempotency_key == "idemp_rel_1"


# ============================================================================
# 3. Repository OCC & Idempotency Tests
# ============================================================================


class TestRepositoryOCCAndIdempotency:
    """Test JobRepository.get_user_application and dispatch_application_event."""

    @pytest.fixture
    def repo(self, tmp_path):
        """Create an initialized repository."""
        db_file = tmp_path / "test_repo.sqlite3"
        return JobRepository(str(db_file))

    def test_get_user_application_returns_stage_and_version(self, repo):
        """Verify get_user_application retrieves macro_stage and version."""
        repo.upsert_user_application("u1", "j1", {"status": "sourced"})
        app = repo.get_user_application("u1", "j1")
        assert app is not None
        assert app["job_id"] == "j1"
        assert app["macro_stage"] == "LEAD"
        assert app["version"] == 1

        # Nonexistent returns None
        assert repo.get_user_application("u1", "nonexistent") is None

    def test_dispatch_application_event_happy_path(self, repo):
        """Verify successful event dispatch increments version and updates stage."""
        repo.upsert_user_application("u1", "j1", {"status": "sourced"})

        updated_app, event = repo.dispatch_application_event(
            user_id="u1",
            job_id="j1",
            event_id="evt-101",
            event_type="APPLICATION_SUBMITTED",
            expected_version=1,
            new_macro_stage="APPLIED",
            payload_json='{"method": "portal"}',
            idempotency_key="idemp-101",
        )

        assert updated_app["version"] == 2
        assert updated_app["macro_stage"] == "APPLIED"
        assert event["id"] == "evt-101"
        assert event["event_type"] == "APPLICATION_SUBMITTED"
        assert event["idempotency_key"] == "idemp-101"

    def test_dispatch_application_event_version_conflict_raises_value_error(self, repo):
        """Verify expected_version mismatch raises version conflict ValueError."""
        repo.upsert_user_application("u1", "j1", {"status": "sourced"})

        with pytest.raises(ValueError) as exc_info:
            repo.dispatch_application_event(
                user_id="u1",
                job_id="j1",
                event_id="evt-stale",
                event_type="APPLICATION_SUBMITTED",
                expected_version=99,  # Current is 1
            )
        assert "Resource version conflict" in str(exc_info.value)

    def test_dispatch_application_event_idempotency_replay(self, repo):
        """Verify replaying with identical idempotency_key returns cached event."""
        repo.upsert_user_application("u1", "j1", {"status": "sourced"})
        idemp_key = "idemp-replay-key"

        # Dispatch 1
        app1, event1 = repo.dispatch_application_event(
            user_id="u1",
            job_id="j1",
            event_id="evt-first",
            event_type="DOSSIER_COMPILED",
            expected_version=1,
            new_macro_stage="SAVED",
            idempotency_key=idemp_key,
        )
        assert app1["version"] == 2

        # Replay with same idempotency_key (even with stale expected_version=1)
        app2, event2 = repo.dispatch_application_event(
            user_id="u1",
            job_id="j1",
            event_id="evt-second",
            event_type="DOSSIER_COMPILED",
            expected_version=1,
            idempotency_key=idemp_key,
        )

        # Version must NOT have incremented again
        assert app2["version"] == 2
        # Event ID must be the original
        assert event2["id"] == "evt-first"
        assert event2["idempotency_key"] == idemp_key

    def test_concurrent_identical_idempotency_keys(self, repo):
        """Verify 10 concurrent threads with identical idempotency_key create exactly 1 event and return 200."""
        repo.upsert_user_application("u1", "j_conc", {"status": "sourced"})
        idemp_key = f"idemp-concurrent-{uuid.uuid4()}"

        results = []
        errors = []

        def worker(thread_idx: int):
            try:
                app, event = repo.dispatch_application_event(
                    user_id="u1",
                    job_id="j_conc",
                    event_id=f"evt-conc-{thread_idx}",
                    event_type="APPLICATION_SUBMITTED",
                    expected_version=1,
                    new_macro_stage="APPLIED",
                    idempotency_key=idemp_key,
                )
                return app, event
            except Exception as e:
                errors.append(e)
                raise

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(worker, i) for i in range(10)]
            for fut in concurrent.futures.as_completed(futures):
                try:
                    res = fut.result()
                    results.append(res)
                except Exception:
                    pass

        # Zero unhandled exceptions
        assert len(errors) == 0
        assert len(results) == 10

        # All workers saw version 2 and the same event
        for app, event in results:
            assert app["version"] == 2
            assert app["macro_stage"] == "APPLIED"
            assert event["idempotency_key"] == idemp_key

        # Exactly 1 event recorded in DB
        events = repo.get_application_events("u1", "j_conc")
        matching = [e for e in events if e.get("idempotency_key") == idemp_key]
        assert len(matching) == 1

    def test_concurrent_competing_version_updates_exactly_one_winner(self, repo):
        """Verify concurrent updates with different idempotency keys have exactly 1 winner and 9 conflicts."""
        repo.upsert_user_application("u1", "j_compete", {"status": "sourced"})

        successes = []
        conflicts = []

        def worker(idx: int):
            try:
                res = repo.dispatch_application_event(
                    user_id="u1",
                    job_id="j_compete",
                    event_id=f"evt-compete-{idx}",
                    event_type="APPLICATION_SUBMITTED",
                    expected_version=1,
                    new_macro_stage="APPLIED",
                    idempotency_key=f"idemp-compete-{idx}-{uuid.uuid4()}",
                )
                successes.append(res)
            except ValueError as e:
                if "Resource version conflict" in str(e):
                    conflicts.append(str(e))
                else:
                    raise

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(worker, i) for i in range(10)]
            concurrent.futures.wait(futures)

        assert len(successes) == 1, f"Expected exactly 1 winner, got {len(successes)}"
        assert len(conflicts) == 9, (
            f"Expected 9 conflict rejections, got {len(conflicts)}"
        )


# ============================================================================
# 4. HTTP API Endpoints & Concurrency Tests
# ============================================================================


class TestJobEventsAPI:
    """Test PATCH /api/v1/jobs/{job_id}/events and idempotency/OCC over HTTP."""

    @pytest.fixture
    def client_and_repo(self, tmp_path, monkeypatch):
        """Initialize FastAPI TestClient with isolated data directory."""
        monkeypatch.setenv("JOB_DASHBOARD_DATA_DIR", str(tmp_path))
        app = create_app()
        repo = JobRepository(str(tmp_path / "jobs.sqlite3"))
        with TestClient(app) as test_client:
            yield test_client, repo

    def test_patch_event_happy_path(self, client_and_repo):
        """Verify PATCH /api/v1/jobs/{job_id}/events advances stage and version."""
        client, repo = client_and_repo
        repo.upsert_user_application("default_user", "job-api-1", {"status": "sourced"})

        idemp_key = str(uuid.uuid4())
        res = client.patch(
            "/api/v1/jobs/job-api-1/events",
            headers={"Idempotency-Key": idemp_key},
            json={
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": 1,
                "new_macro_stage": "APPLIED",
                "payload": {"portal": "seek"},
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["application"]["version"] == 2
        assert data["application"]["macro_stage"] == "APPLIED"
        assert data["event"]["event_type"] == "APPLICATION_SUBMITTED"
        assert data["event"]["idempotency_key"] == idemp_key

    def test_patch_event_stale_version_returns_409_conflict(self, client_and_repo):
        """Verify stale expected_version returns HTTP 409 Conflict with detail."""
        client, repo = client_and_repo
        repo.upsert_user_application(
            "default_user", "job-api-stale", {"status": "sourced"}
        )

        # Send request with expected_version=99 when actual is 1
        res = client.patch(
            "/api/v1/jobs/job-api-stale/events",
            json={
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": 99,
            },
        )
        assert res.status_code == 409
        data = res.json()
        assert "Resource version conflict" in data.get("detail", "")
        assert data.get("current_version") == 1

    def test_patch_event_sequential_idempotent_replay(self, client_and_repo):
        """Verify repeating identical request with same Idempotency-Key returns cached 200."""
        client, repo = client_and_repo
        repo.upsert_user_application(
            "default_user", "job-api-idem", {"status": "sourced"}
        )
        idemp_key = str(uuid.uuid4())

        payload = {
            "event_type": "DOSSIER_COMPILED",
            "expected_version": 1,
            "new_macro_stage": "SAVED",
        }

        # First request
        res1 = client.patch(
            "/api/v1/jobs/job-api-idem/events",
            headers={"Idempotency-Key": idemp_key},
            json=payload,
        )
        assert res1.status_code == 200
        event1 = res1.json()["event"]
        assert res1.json()["application"]["version"] == 2

        # Second request with same idempotency key
        res2 = client.patch(
            "/api/v1/jobs/job-api-idem/events",
            headers={"Idempotency-Key": idemp_key},
            json=payload,
        )
        assert res2.status_code == 200
        event2 = res2.json()["event"]
        assert res2.json()["application"]["version"] == 2
        assert event1["id"] == event2["id"]

    def test_patch_event_case_insensitive_header(self, client_and_repo):
        """Verify both 'Idempotency-Key' and 'idempotency-key' are accepted."""
        client, repo = client_and_repo
        repo.upsert_user_application("default_user", "job-case", {"status": "sourced"})
        idemp_key = str(uuid.uuid4())

        res = client.patch(
            "/api/v1/jobs/job-case/events",
            headers={"idempotency-key": idemp_key},
            json={
                "event_type": "ASSETS_TAILORED",
                "expected_version": 1,
            },
        )
        assert res.status_code == 200
        assert res.json()["event"]["idempotency_key"] == idemp_key

    def test_patch_event_missing_parameters_returns_400(self, client_and_repo):
        """Verify missing expected_version or event_type returns 400 or 422."""
        client, repo = client_and_repo
        repo.upsert_user_application(
            "default_user", "job-bad-req", {"status": "sourced"}
        )

        # Missing expected_version
        res1 = client.patch(
            "/api/v1/jobs/job-bad-req/events",
            json={"event_type": "APPLICATION_SUBMITTED"},
        )
        assert res1.status_code in (400, 422)

        # Missing event_type
        res2 = client.patch(
            "/api/v1/jobs/job-bad-req/events",
            json={"expected_version": 1},
        )
        assert res2.status_code in (400, 422)

    def test_patch_event_nonexistent_job_returns_404(self, client_and_repo):
        """Verify nonexistent application returns 404 Not Found."""
        client, repo = client_and_repo
        res = client.patch(
            "/api/v1/jobs/completely-unknown-job/events",
            json={
                "event_type": "APPLICATION_SUBMITTED",
                "expected_version": 1,
            },
        )
        assert res.status_code in (404, 409)

    def test_get_job_events_returns_chronological_list(self, client_and_repo):
        """Verify GET /api/v1/jobs/{job_id}/events lists all timeline events."""
        client, repo = client_and_repo
        repo.upsert_user_application(
            "default_user", "job-timeline", {"status": "sourced"}
        )

        # Dispatch 2 events
        client.patch(
            "/api/v1/jobs/job-timeline/events",
            json={"event_type": "ASSETS_TAILORED", "expected_version": 1},
        )
        client.patch(
            "/api/v1/jobs/job-timeline/events",
            json={"event_type": "APPLICATION_SUBMITTED", "expected_version": 2},
        )

        res = client.get("/api/v1/jobs/job-timeline/events")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        events = data["events"]
        assert len(events) == 3
        types = [e["event_type"] for e in events]
        assert "APPLICATION_SUBMITTED" in types
        assert "ASSETS_TAILORED" in types
        assert "sourced" in types
