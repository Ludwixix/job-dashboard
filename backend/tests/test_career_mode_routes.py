"""Comprehensive Route Integration Tests for Career Mode Endpoints.

Tests:
1. GET /api/career-mode/overview (Cockpit telemetry, profile snapshot, archetype distribution)
2. GET /api/career-mode/matches (Filtered & scored job feed, chips, knockouts, sorting)
3. POST /api/career-mode/evaluate (Batch evaluation and SQLite staging)
4. POST /api/career-mode/application-studio (STAR KSC, cover letter, ATS resume audit)
5. Error handling: 400 on missing job_id, 404 on non-existent job_id.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
from urllib.parse import urlencode

import pytest

from job_dashboard.sam_scoring import CANONICAL_TARGET_TITLES
from job_dashboard.web import DashboardApp, make_handler


class MockHttpClient:
    """Helper client to dispatch HTTP requests against DashboardApp handler."""

    def __init__(self, app: DashboardApp):
        self.app = app
        self.handler_cls = make_handler(app)

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
    ) -> tuple[int, dict[str, Any]]:
        full_path = path
        if params:
            sep = "&" if "?" in path else "?"
            full_path = f"{path}{sep}{urlencode(params)}"

        handler = self.handler_cls.__new__(self.handler_cls)
        handler.path = full_path

        headers: dict[str, str] = {}
        if json_body is not None:
            body_bytes = json.dumps(json_body).encode("utf-8")
            headers["Content-Length"] = str(len(body_bytes))
            headers["Content-Type"] = "application/json"
            handler.rfile = io.BytesIO(body_bytes)
        else:
            headers["Content-Length"] = "0"
            handler.rfile = io.BytesIO()

        handler.headers = headers
        handler.client_address = ("127.0.0.1", 12345)
        handler.wfile = io.BytesIO()

        status_box = [200]

        def record_status(code: int, message: str | None = None):
            status_box[0] = code

        handler.send_response = record_status
        handler.send_header = lambda k, v: None
        handler.end_headers = MagicMock()

        method_upper = method.upper()
        if method_upper == "GET":
            handler.do_GET()
        elif method_upper == "POST":
            handler.do_POST()
        else:
            raise NotImplementedError(method)

        response_bytes = handler.wfile.getvalue()
        try:
            response_json = (
                json.loads(response_bytes.decode("utf-8")) if response_bytes else {}
            )
        except json.JSONDecodeError:
            response_json = {}

        return status_box[0], response_json

    def get(
        self, path: str, params: dict[str, Any] | None = None
    ) -> tuple[int, dict[str, Any]]:
        return self.request("GET", path, params=params)

    def post(
        self, path: str, json_body: Any | None = None
    ) -> tuple[int, dict[str, Any]]:
        return self.request("POST", path, json_body=json_body)


@pytest.fixture
def test_app(tmp_path: Path):
    """Sets up a clean DashboardApp instance populated with test jobs."""
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    profile = {
        "id": "sam_ludwig",
        "name": "Sam Ludwig",
        "title": "Senior Infrastructure & M365 Engineer",
        "seniorityLevel": "Senior / Lead",
        "yearsOfExperience": 10,
        "workRights": "Australian Citizen (Unrestricted)",
        "clearance": "Australian Citizen (Baseline / NV1 Eligible)",
        "targetSalary": "$140,000 - $165,000 + Super",
        "salaryFloor": 120000,
        "salaryExpectations": {
            "min": 140000,
            "max": 165000,
            "preferred": 150000,
            "currency": "AUD",
        },
        "location": "Melbourne, VIC (Balaclava 3183)",
        "suburb": "Balaclava",
        "state": "VIC",
        "targetTitles": list(CANONICAL_TARGET_TITLES),
    }

    app = DashboardApp(profile=profile, sources=[], data_dir=data_dir)
    repo = app.repository

    # Seed test jobs
    repo.upsert_job(
        {
            "id": "job_route_vic_edu",
            "title": "Lead Microsoft 365 & Identity Systems Specialist",
            "company": "Victorian Public Sector",
            "location": "Melbourne, VIC",
            "salary_raw": "$155,000 - $165,000 + Super",
            "description": "660,000+ users enterprise SharePoint farm, Entra ID, Intune, PnP PowerShell.",
            "remote": False,
            "source": "seek",
            "url": "https://example.com/job1",
            "posted": "2026-09-24",
        }
    )
    repo.upsert_job(
        {
            "id": "job_route_sys_eng",
            "title": "Senior Systems Engineer",
            "company": "Melbourne Tech",
            "location": "Melbourne, VIC (Balaclava Local)",
            "salary_raw": "$145,000",
            "description": "Windows Server, Active Directory, VMware, PowerShell automation.",
            "remote": False,
            "source": "seek",
            "url": "https://example.com/job2",
            "posted": "2026-09-24",
        }
    )
    repo.upsert_job(
        {
            "id": "job_route_remote_cloud",
            "title": "Cloud Infrastructure Specialist",
            "company": "Cloud Global",
            "location": "Remote, Australia",
            "salary_raw": "$150,000",
            "description": "Azure cloud, Terraform, CI/CD, 100% remote across Australia.",
            "remote": True,
            "source": "seek",
            "url": "https://example.com/job3",
            "posted": "2026-09-24",
        }
    )
    repo.upsert_job(
        {
            "id": "job_route_underpaid",
            "title": "IT Technician",
            "company": "Budget Fix",
            "location": "Melbourne, VIC",
            "salary_raw": "$75,000",
            "description": "Printer repair, L1 ticket logging.",
            "remote": False,
            "source": "seek",
            "url": "https://example.com/job4",
            "posted": "2026-09-24",
        }
    )

    return MockHttpClient(app)


class TestCareerModeOverviewRoute:
    """Verifies GET /api/career-mode/overview."""

    def test_overview_success_contract(self, test_app: MockHttpClient):
        status, data = test_app.get("/api/career-mode/overview")
        assert status == 200
        assert data.get("success") is True

        profile = data.get("profile", {})
        assert profile.get("id") == "sam_ludwig"
        assert profile.get("name") == "Sam Ludwig"
        assert profile.get("yearsOfExperience") == 10
        assert profile.get("salaryFloor") == 120000
        assert "Australian Citizen" in profile.get("workRights", "")

        telemetry = data.get("telemetry", {})
        assert "last_scraped_at" in telemetry
        assert "new_vacancies_today" in telemetry
        assert telemetry.get("feed_health") in ("healthy", "active", "standby")

        archetype_counts = data.get("archetype_counts", {})
        for title in CANONICAL_TARGET_TITLES:
            assert title in archetype_counts
            assert isinstance(archetype_counts[title], int)


class TestCareerModeMatchesRoute:
    """Verifies GET /api/career-mode/matches."""

    def test_matches_feed_returns_scored_jobs(self, test_app: MockHttpClient):
        status, data = test_app.get(
            "/api/career-mode/matches", params={"min_score": 70}
        )
        assert status == 200
        assert data.get("success") is True
        jobs = data.get("jobs", [])
        assert len(jobs) >= 2

        vic_job = next((j for j in jobs if j["id"] == "job_route_vic_edu"), None)
        assert vic_job is not None
        assert vic_job["sam_score"] >= 85
        assert vic_job["justification_score"] >= 80
        assert len(vic_job["chips"]) >= 3
        assert vic_job["knockouts"]["overall_pass"] is True

    def test_matches_archetype_filter(self, test_app: MockHttpClient):
        status, data = test_app.get(
            "/api/career-mode/matches", params={"archetype": "Senior Systems Engineer"}
        )
        assert status == 200
        jobs = data.get("jobs", [])
        assert all(
            "Systems" in j["title"] or j["role_archetype"] == "Senior Systems Engineer"
            for j in jobs
        )

    def test_matches_remote_only_filter(self, test_app: MockHttpClient):
        status, data = test_app.get(
            "/api/career-mode/matches", params={"remote_only": "true"}
        )
        assert status == 200
        jobs = data.get("jobs", [])
        assert len(jobs) >= 1
        assert all(
            j["remote"] is True or "remote" in j["location"].lower() for j in jobs
        )

    def test_matches_min_score_zero_includes_knockouts(self, test_app: MockHttpClient):
        status, data = test_app.get("/api/career-mode/matches", params={"min_score": 0})
        assert status == 200
        jobs = {j["id"]: j for j in data.get("jobs", [])}
        assert "job_route_underpaid" in jobs
        assert jobs["job_route_underpaid"]["knockouts"]["salary_pass"] is False


class TestCareerModeEvaluateRoute:
    """Verifies POST /api/career-mode/evaluate."""

    def test_evaluate_triggers_batch_scoring(self, test_app: MockHttpClient):
        status, data = test_app.post(
            "/api/career-mode/evaluate", json_body={"min_score": 60}
        )
        assert status == 200
        assert data.get("success") is True
        assert data.get("evaluated_count", 0) >= 4
        assert "archetype_distribution" in data


class TestCareerModeApplicationStudioRoute:
    """Verifies POST /api/career-mode/application-studio."""

    def test_application_studio_generates_all_assets(self, test_app: MockHttpClient):
        payload = {
            "job_id": "job_route_vic_edu",
            "generation_types": ["ksc", "cover_letter", "ats_resume"],
        }
        status, data = test_app.post(
            "/api/career-mode/application-studio", json_body=payload
        )
        assert status == 200
        assert data.get("success") is True
        assert data.get("job_id") == "job_route_vic_edu"

        # KSC verification
        ksc = data.get("ksc", {})
        responses = ksc.get("criteria_responses", [])
        assert len(responses) >= 1
        star = responses[0].get("star_narrative", {})
        assert all(k in star for k in ("situation", "task", "action", "result"))
        assert len(star["situation"]) > 20

        # Cover letter verification
        cl = data.get("cover_letter", {})
        assert "variant" in cl
        assert len(cl.get("content", "")) > 100

        # ATS resume verification
        ats = data.get("ats_resume", {})
        assert ats.get("match_score", 0) >= 70
        assert len(ats.get("matched_keywords", [])) > 0
        assert len(ats.get("tailored_summary", "")) > 50

    def test_application_studio_missing_job_id_returns_400(
        self, test_app: MockHttpClient
    ):
        status, data = test_app.post(
            "/api/career-mode/application-studio", json_body={}
        )
        assert status == 400
        assert data.get("success") is False

    def test_application_studio_nonexistent_job_returns_404(
        self, test_app: MockHttpClient
    ):
        status, data = test_app.post(
            "/api/career-mode/application-studio",
            json_body={"job_id": "non_existent_role_999"},
        )
        assert status == 404
        assert data.get("success") is False
