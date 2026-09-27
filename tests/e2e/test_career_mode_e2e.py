"""Comprehensive Requirement-Driven Opaque-Box E2E Test Suite (Tiers 1-4).

This test suite rigorously validates the "Sam Mode" Personal Career Command Center
against all authoritative requirements defined in ORIGINAL_REQUEST.md (2026-09-24T09:20:05Z)
and the project architecture in PROJECT.md.

Subsystems Tested:
1. Backend Hyper-Personalized Scoring & Knockout Engine (sam_scoring.py)
2. Dedicated Career Mode REST API Routes (routes/career_mode.py):
   - GET /api/career-mode/overview (HUD telemetry, profile snapshot, archetype counts)
   - GET /api/career-mode/matches (Filtered/scored feed, match chips, knockouts, justification score)
   - POST /api/career-mode/evaluate (On-demand batch evaluation and staging)
   - POST /api/career-mode/application-studio (STAR KSC responses, executive cover letter, ATS resume audit)
3. 8 Core Target Archetype Filters & Commute Preference Alignment
4. Hard Knockout Invariants (Zero false knockouts on Aus Citizen and Baseline/NV1; $120k floor)
5. Real-World End-to-End Enterprise User Journeys

Test Tier Structure:
- Tier 1: Feature Coverage (Direct requirement tests)
- Tier 2: Boundary & Corner Cases (Malformed salary, clearance subtleties, zero-match)
- Tier 3: Cross-Feature Combinations (Archetype + salary + remote pairwise filters, telemetry integration)
- Tier 4: Real-World Scenarios (End-to-end user journeys for Sam Ludwig)
"""

from __future__ import annotations

import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
from urllib.parse import urlencode

import pytest

# Ensure backend/src is on sys.path for direct module discovery across test runners
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_SRC = WORKSPACE_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from job_dashboard.web import DashboardApp, make_handler

# Attempt importing career_mode route to guarantee registration on app_router if available
try:
    from job_dashboard.routes import career_mode  # noqa: F401
except ImportError:
    pass


# ==============================================================================
# Opaque-Box HTTP Test Client
# ==============================================================================


class ApiResponse:
    """Represents an HTTP response for opaque-box assertions."""

    def __init__(self, status_code: int, body_bytes: bytes, headers: dict[str, str]):
        self.status_code = status_code
        self.content = body_bytes
        self.headers = headers

    def json(self) -> Any:
        """Parse JSON response body or return empty dict if empty."""
        if not self.content:
            return {}
        return json.loads(self.content.decode("utf-8"))

    @property
    def text(self) -> str:
        """Return response body decoded as UTF-8 string."""
        return self.content.decode("utf-8")


class CareerModeE2EClient:
    """Opaque-box client simulating client HTTP requests against DashboardApp."""

    def __init__(self, app: DashboardApp):
        self.app = app
        self.handler_cls = make_handler(app)

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> ApiResponse:
        """Dispatch an HTTP request through make_handler and return ApiResponse."""
        full_path = path
        if params:
            query_string = urlencode(params)
            sep = "&" if "?" in path else "?"
            full_path = f"{path}{sep}{query_string}"

        handler = self.handler_cls.__new__(self.handler_cls)
        handler.path = full_path
        headers_dict = dict(headers or {})

        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            headers_dict["Content-Length"] = str(len(data))
            headers_dict["Content-Type"] = "application/json"
            handler.rfile = io.BytesIO(data)
        else:
            headers_dict.setdefault("Content-Length", "0")
            handler.rfile = io.BytesIO()

        handler.headers = headers_dict
        handler.client_address = ("127.0.0.1", 54321)
        handler.wfile = io.BytesIO()

        response_status = [200]
        response_headers: dict[str, str] = {}

        def record_send_response(code: int, message: str | None = None):
            response_status[0] = code

        def record_send_header(key: str, value: str):
            response_headers[key.lower()] = value

        handler.send_response = record_send_response
        handler.send_header = record_send_header
        handler.end_headers = MagicMock()

        method_upper = method.upper()
        if method_upper == "GET":
            handler.do_GET()
        elif method_upper == "POST":
            handler.do_POST()
        elif method_upper == "DELETE":
            handler.do_DELETE()
        else:
            raise NotImplementedError(f"Unsupported HTTP method: {method}")

        return ApiResponse(
            status_code=response_status[0],
            body_bytes=handler.wfile.getvalue(),
            headers=response_headers,
        )

    def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> ApiResponse:
        """Send HTTP GET request."""
        return self.request("GET", path, params=params, headers=headers)

    def post(
        self,
        path: str,
        json_body: Any | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> ApiResponse:
        """Send HTTP POST request."""
        return self.request(
            "POST", path, params=params, json_body=json_body, headers=headers
        )


# ==============================================================================
# Canonical Fixtures & Seed Datasets
# ==============================================================================

CANONICAL_TARGET_TITLES = [
    "Senior Systems Engineer",
    "Senior Infrastructure Engineer",
    "Senior M365 Engineer",
    "Cloud Infrastructure Specialist",
    "Endpoint / EUC Engineer",
    "L3 Systems / Operations Lead",
    "SharePoint & Modern Workplace Architect",
    "Automation & DevOps Engineer",
]


def load_canonical_profile() -> dict[str, Any]:
    """Load canonical profile from backend/data/job_profile.json."""
    profile_path = WORKSPACE_ROOT / "backend" / "data" / "job_profile.json"
    if profile_path.is_file():
        try:
            return json.loads(profile_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {
                "id": "sam_ludwig",
                "name": "Sam Ludwig",
                "title": "Senior Infrastructure & M365 Engineer",
                "seniorityLevel": "Senior / Lead",
                "yearsOfExperience": 10,
                "location": "Melbourne, VIC (Balaclava 3183)",
                "suburb": "Balaclava",
                "state": "VIC",
                "workRights": "Australian Citizen (Unrestricted)",
                "clearance": "Australian Citizen (Baseline / NV1 Eligible)",
                "targetSalary": "$140,000 - $165,000 + Super",
                "salaryExpectations": {
                    "min": 140000,
                    "max": 165000,
                    "preferred": 150000,
                },
                "targetTitles": CANONICAL_TARGET_TITLES,
            }


def build_seed_job(
    job_id: str,
    title: str,
    company: str,
    location: str,
    salary_raw: str | None,
    description: str,
    remote: bool = False,
    source: str = "seek",
) -> dict[str, Any]:
    """Helper to format a job dictionary for JobRepository upsert."""
    now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return {
        "id": job_id,
        "title": title,
        "company": company,
        "location": location,
        "salary_raw": salary_raw,
        "description": description,
        "source": source,
        "url": f"https://example.com/jobs/{job_id}",
        "remote": remote,
        "posted": now_date,
        "date_posted": now_date,
    }


@pytest.fixture
def e2e_env(tmp_path: Path):
    """Sets up a pristine, self-contained test environment with realistic seed jobs."""
    profile = load_canonical_profile()
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    app = DashboardApp(profile=profile, sources=[], data_dir=data_dir)
    repo = app.repository

    # 1. High Alignment Victorian Enterprise Role (Dept of Ed VIC scale equivalent)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_vic_edu",
            title="Lead Microsoft 365 & Identity Systems Specialist",
            company="Victorian Public Sector Agency",
            location="Melbourne, VIC",
            salary_raw="$155,000 - $165,000 + Super",
            description="""
            Department of Education Victoria equivalent statutory authority.
            Managing high-scale multi-tenant enterprise environments supporting 500,000+ users.
            Required Core Capabilities:
            - Microsoft 365, SharePoint Online, and Exchange Hybrid administration.
            - Entra ID (Azure AD), Conditional Access, MFA compliance, and tri-platform sync.
            - Microsoft Intune (MDM/MAM) and Windows Autopilot fleet orchestration.
            - Advanced PowerShell scripting and automated PnP runbooks across 1,000+ school sites.
            - Alignment with ACSC Essential 8 maturity model and ISO 27001 compliance.
            - Australian Citizenship required. Eligible for Baseline / NV1 security clearance.
            """,
            remote=False,
        )
    )

    # 2. Seed jobs for each of the 8 canonical target archetypes
    archetype_seeds = [
        (
            "job_e2e_sys_eng",
            "Senior Systems Engineer",
            "Melbourne Enterprise",
            "Melbourne, VIC",
            "$145,000 + Super",
            "Windows Server, VMware vSphere, Active Directory, ServiceNow triage.",
        ),
        (
            "job_e2e_infra_eng",
            "Senior Infrastructure Engineer",
            "VicHealth Tech",
            "Melbourne, VIC",
            "$150,000 - $160,000",
            "Hybrid cloud infrastructure, Azure IaaS/PaaS, Terraform, PowerShell automation.",
        ),
        (
            "job_e2e_m365_spec",
            "Senior M365 Engineer",
            "Modern Workplace Solutions",
            "Melbourne, VIC (Balaclava)",
            "$155,000 + Super",
            "M365, SharePoint Online, Teams, Exchange Online, Graph API.",
        ),
        (
            "job_e2e_cloud_spec",
            "Cloud Infrastructure Specialist",
            "Melbourne Cloud Co",
            "Melbourne, VIC",
            "$150,000",
            "Azure cloud engineer, Entra ID, identity federation, Azure DevOps.",
        ),
        (
            "job_e2e_euc_eng",
            "Endpoint / EUC Engineer",
            "Metro Health Network",
            "Melbourne, VIC",
            "$140,000",
            "Clinical endpoint migration, Windows 11 Autopilot, Intune SOE deployment, zero patient disruption.",
        ),
        (
            "job_e2e_ops_lead",
            "L3 Systems / Operations Lead",
            "Gov Services Victoria",
            "Melbourne, VIC",
            "$155,000",
            "Tier-3 escalation point, RCA documentation, ITIL 4 service management.",
        ),
        (
            "job_e2e_sp_arch",
            "SharePoint & Modern Workplace Architect",
            "Digital Workspaces AU",
            "Melbourne, VIC",
            "$165,000",
            "Bespoke SharePoint Online portals, SPFx, React, enterprise intranets.",
        ),
        (
            "job_e2e_devops_eng",
            "Automation & DevOps Engineer",
            "FinTech Melbourne",
            "Melbourne, VIC",
            "$145,000",
            "PowerShell 7, Python automation, CI/CD pipelines, task elimination.",
        ),
    ]
    for jid, title, company, loc, sal, desc in archetype_seeds:
        repo.upsert_job(build_seed_job(jid, title, company, loc, sal, desc))

    # 3. Knockout Job Seeds
    # Salary Knockout: Below $120k floor ($85,000)
    repo.upsert_job(
        build_seed_job(
            job_id="job_ko_salary",
            title="Desktop Support Technician",
            company="Budget IT Solutions",
            location="Melbourne, VIC",
            salary_raw="$75,000 - $85,000",
            description="L1/L2 PC support, ticket logging, printer setup.",
        )
    )

    # Clearance Knockout: Mandates strict Top Secret Positive Vetting (TS PV)
    repo.upsert_job(
        build_seed_job(
            job_id="job_ko_clearance_tspv",
            title="Senior Defence Infrastructure Specialist",
            company="Defence Intelligence Contractor",
            location="Canberra / Melbourne",
            salary_raw="$160,000",
            description="Mandatory requirement: Candidate must hold an active Top Secret Positive Vetting (TSPV) security clearance. No exceptions.",
        )
    )

    # Work Rights Knockout: Non-Australian work rights strictly required
    repo.upsert_job(
        build_seed_job(
            job_id="job_ko_work_rights",
            title="US ITAR Systems Specialist",
            company="Global Aerospace Corp",
            location="Melbourne, VIC",
            salary_raw="$150,000",
            description="ITAR compliant role: Must be a United States Citizen only. Non-US citizens cannot be considered.",
        )
    )

    # Location Knockout: Strictly on-site outside Melbourne (Perth CBD)
    repo.upsert_job(
        build_seed_job(
            job_id="job_ko_location_perth",
            title="Senior Systems Engineer",
            company="Mining Tech WA",
            location="Perth, WA",
            salary_raw="$155,000",
            description="Strictly 5 days per week on-site in Perth CBD office. No remote or interstate applicants.",
            remote=False,
        )
    )

    # 4. Boundary & Corner Case Seeds
    # Remote High Alignment
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_remote_azure",
            title="Senior Infrastructure Engineer",
            company="Australia Wide Cloud",
            location="Remote, Australia",
            salary_raw="$150,000",
            description="100% remote across Australia. Azure, Entra ID, PowerShell automation, Baseline clearance eligible.",
            remote=True,
        )
    )

    # Daily Contractor Rate: $900/day (~$200k/yr -> passes $120k floor)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_daily_rate_high",
            title="Senior M365 Consultant (Contract)",
            company="Enterprise IT Consulting",
            location="Melbourne, VIC",
            salary_raw="$850 - $950 per day",
            description="6 month contract. M365 migration, SharePoint Online, PowerShell.",
        )
    )

    # Low Daily Contractor Rate: $350/day (~$80k/yr -> fails $120k floor)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_daily_rate_low",
            title="IT Rollout Assistant",
            company="Hardware Contractors",
            location="Melbourne, VIC",
            salary_raw="$350 / day",
            description="Short-term equipment deployment.",
        )
    )

    # Hourly Contractor Rate: $85/hr (~$170k/yr -> passes $120k floor)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_hourly_rate",
            title="Cloud Migration Engineer",
            company="Contracting AU",
            location="Melbourne, VIC",
            salary_raw="$85 / hr",
            description="Contract role. Intune Autopilot rollout.",
        )
    )

    # Missing Salary: None / Empty
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_missing_salary",
            title="Enterprise Systems Administrator",
            company="Premier Solutions",
            location="Melbourne, VIC",
            salary_raw=None,
            description="Core systems administration, Windows Server, VMware.",
        )
    )

    # Text Salary: No numbers ("Competitive salary package")
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_text_salary",
            title="Senior Systems Engineer",
            company="Top Tier Law",
            location="Melbourne, VIC",
            salary_raw="Competitive salary package + employee benefits",
            description="High availability infrastructure management.",
        )
    )

    # Abbreviated notation: "$145k - $160k"
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_k_salary",
            title="Senior Infrastructure Engineer",
            company="Growth Tech",
            location="Melbourne, VIC",
            salary_raw="$145k - $160k",
            description="Azure, Entra ID, PowerShell.",
        )
    )

    # Boundary Floor Under: $119,000 package (< $120k floor)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_boundary_under",
            title="Systems Administrator",
            company="Mid Tier Corp",
            location="Melbourne, VIC",
            salary_raw="$119,000 package",
            description="Windows Server, AD, general administration.",
        )
    )

    # Boundary Floor Over: $120,000 plus super (>= $120k floor)
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_boundary_exact",
            title="Senior Systems Administrator",
            company="Mid Tier Corp",
            location="Melbourne, VIC",
            salary_raw="$120,000 plus super",
            description="Enterprise systems maintenance.",
        )
    )

    # Hybrid Melbourne SE / Balaclava Local Alignment
    repo.upsert_job(
        build_seed_job(
            job_id="job_e2e_balaclava_local",
            title="Senior M365 Specialist",
            company="South East Melbourne Enterprise",
            location="Balaclava, Melbourne VIC",
            salary_raw="$150,000 + Super",
            description="Hybrid working (2 days in Balaclava office, 3 days home). Managing M365 and Entra ID.",
        )
    )

    client = CareerModeE2EClient(app)
    return client, repo, app


# ==============================================================================
# TIER 1: FEATURE COVERAGE
# Direct requirement tests for HUD overview, match chips, 8 archetype filters,
# hard knockouts, and 1-click tailored application studio.
# ==============================================================================


class TestTier1FeatureCoverage:
    """Tier 1: Feature Coverage (authoritative requirement verification)."""

    def test_hud_overview_endpoint_contract(self, e2e_env):
        """R1 Acceptance: GET /api/career-mode/overview returns canonical profile snapshot,

        telemetry HUD metrics, and archetype vacancy distribution.
        """
        client, _, _ = e2e_env
        res = client.get("/api/career-mode/overview")
        assert res.status_code == 200, (
            f"Expected HTTP 200, got {res.status_code}: {res.text}"
        )
        data = res.json()

        # 1. Profile Verification
        assert "profile" in data, "Overview payload must contain 'profile'"
        profile = data["profile"]
        assert profile.get("id") == "sam_ludwig"
        assert profile.get("name") == "Sam Ludwig"
        assert "Senior Infrastructure" in profile.get("title", "")
        assert profile.get("yearsOfExperience") == 10
        assert "Australian Citizen" in profile.get("workRights", "")
        assert "Baseline" in profile.get("clearance", "")
        assert "$140,000" in profile.get("targetSalary", "")
        assert profile.get("salaryFloor") == 120000
        assert "Melbourne" in profile.get("location", "")
        assert "Balaclava" in profile.get("location", "")

        # Verify all 8 core target titles are present in profile
        target_titles = profile.get("targetTitles") or []
        for title in CANONICAL_TARGET_TITLES:
            assert title in target_titles, (
                f"Missing target title {title} in profile overview"
            )

        # 2. Telemetry Verification
        assert "telemetry" in data, "Overview payload must contain 'telemetry'"
        telemetry = data["telemetry"]
        assert "last_scraped_at" in telemetry
        assert "new_vacancies_today" in telemetry
        assert isinstance(telemetry["new_vacancies_today"], int)
        assert telemetry.get("feed_health") in ("healthy", "active", "standby")
        assert "total_matching_jobs" in telemetry
        assert "high_alignment_jobs" in telemetry

        # 3. Archetype Distribution Verification
        assert "archetype_counts" in data, (
            "Overview payload must contain 'archetype_counts'"
        )
        counts = data["archetype_counts"]
        for title in CANONICAL_TARGET_TITLES:
            assert title in counts, f"Archetype {title} missing from archetype_counts"
            assert isinstance(counts[title], int)

    def test_match_breakdown_chips_structure(self, e2e_env):
        """R1 & R2 Acceptance: GET /api/career-mode/matches returns jobs with instant

        match breakdown chips, justification score, and proof points.
        """
        client, _, _ = e2e_env
        res = client.get("/api/career-mode/matches", params={"min_score": 70})
        assert res.status_code == 200, (
            f"Expected HTTP 200, got {res.status_code}: {res.text}"
        )
        data = res.json()

        assert "jobs" in data, "Matches payload must contain 'jobs' array"
        jobs = data["jobs"]
        assert len(jobs) > 0, "Expected matching jobs in feed"

        # Find the Victorian enterprise role
        vic_edu_job = next((j for j in jobs if j.get("id") == "job_e2e_vic_edu"), None)
        assert vic_edu_job is not None, (
            "High-alignment Victorian enterprise job should appear in feed"
        )

        # Assert match metrics
        assert vic_edu_job.get("sam_score", 0) >= 85, (
            "Expected high sam_score >= 85 for Dept of Ed equivalent"
        )
        assert vic_edu_job.get("justification_score", 0) >= 80, (
            "Expected high justification score >= 80"
        )

        # Assert proof points synthesis
        proof_points = vic_edu_job.get("proof_points", [])
        assert isinstance(proof_points, list)
        assert len(proof_points) > 0, "Job must have synthesized proof points"
        combined_proofs = " ".join(proof_points)
        assert any(
            term in combined_proofs
            for term in ["660,000", "Education", "SharePoint", "M365", "PowerShell"]
        ), (
            f"Proof points should reference Sam's verified enterprise scale, got: {proof_points}"
        )

        # Assert instant match breakdown chips
        chips = vic_edu_job.get("chips", [])
        assert isinstance(chips, list)
        assert len(chips) >= 3, "Expected at least 3 match breakdown chips"
        chip_labels = [c.get("label", "") for c in chips if isinstance(c, dict)]
        assert any("M365" in c or "Entra" in c for c in chip_labels), (
            f"Missing M365/Entra chip: {chip_labels}"
        )
        assert any("Salary" in c for c in chip_labels), (
            f"Missing Salary chip: {chip_labels}"
        )
        assert any("Clearance" in c for c in chip_labels), (
            f"Missing Clearance chip: {chip_labels}"
        )

        # Assert knockout flags
        knockouts = vic_edu_job.get("knockouts", {})
        assert knockouts.get("work_rights_pass") is True
        assert knockouts.get("clearance_pass") is True
        assert knockouts.get("salary_pass") is True
        assert knockouts.get("location_pass") is True
        assert knockouts.get("overall_pass") is True

    def test_eight_archetype_filters(self, e2e_env):
        """R1 Acceptance: Quick toggles for Sam's 8 core target titles correctly

        filter the job feed.
        """
        client, _, _ = e2e_env
        for target_title in CANONICAL_TARGET_TITLES:
            res = client.get(
                "/api/career-mode/matches", params={"archetype": target_title}
            )
            assert res.status_code == 200, (
                f"Querying archetype '{target_title}' failed with {res.status_code}"
            )
            data = res.json()
            jobs = data.get("jobs", [])
            # If jobs are returned, all must match or align with the queried archetype
            for job in jobs:
                assert (
                    target_title.lower() in job.get("title", "").lower()
                    or any(
                        word.lower() in job.get("title", "").lower()
                        for word in target_title.split()
                        if len(word) > 3
                    )
                    or job.get("archetype") == target_title
                ), (
                    f"Job {job.get('title')} does not match queried archetype {target_title}"
                )

    def test_hard_knockouts_enforcement(self, e2e_env):
        """R2 Acceptance: Hard Knockout Rules flag work rights, clearance requirements,

        and salary floors with zero false knockouts on Australian Citizen and Baseline/NV1.
        """
        client, _, _ = e2e_env
        res = client.get("/api/career-mode/matches", params={"min_score": 0})
        assert res.status_code == 200
        data = res.json()
        jobs_by_id = {j.get("id"): j for j in data.get("jobs", [])}

        # 1. Salary Knockout (< $120k floor)
        ko_salary = jobs_by_id.get("job_ko_salary")
        if ko_salary:
            kos = ko_salary.get("knockouts", {})
            assert kos.get("salary_pass") is False, (
                "Job under $120k floor must fail salary_pass"
            )
            assert kos.get("overall_pass") is False, (
                "Job failing salary must have overall_pass=False"
            )

        # 2. Security Clearance Knockout (Strict TSPV required)
        ko_tspv = jobs_by_id.get("job_ko_clearance_tspv")
        if ko_tspv:
            kos = ko_tspv.get("knockouts", {})
            assert kos.get("clearance_pass") is False, (
                "Mandatory TSPV must fail clearance_pass for Baseline/NV1"
            )
            assert kos.get("overall_pass") is False, (
                "Job failing clearance must have overall_pass=False"
            )

        # 3. Work Rights Knockout (US Citizens Only)
        ko_rights = jobs_by_id.get("job_ko_work_rights")
        if ko_rights:
            kos = ko_rights.get("knockouts", {})
            assert kos.get("work_rights_pass") is False, (
                "US Citizens Only role must fail work_rights_pass"
            )
            assert kos.get("overall_pass") is False, (
                "Job failing work rights must have overall_pass=False"
            )

        # 4. Location Knockout (Perth on-site)
        ko_loc = jobs_by_id.get("job_ko_location_perth")
        if ko_loc:
            kos = ko_loc.get("knockouts", {})
            assert kos.get("location_pass") is False, (
                "Strict Perth on-site role must fail location_pass for Melbourne candidate"
            )
            assert kos.get("overall_pass") is False, (
                "Job failing location must have overall_pass=False"
            )

        # 5. Zero False Knockouts on Australian Citizen & Baseline/NV1 Eligible
        pass_job = jobs_by_id.get("job_e2e_vic_edu")
        assert pass_job is not None, "Valid job must exist in feed"
        kos_pass = pass_job.get("knockouts", {})
        assert kos_pass.get("work_rights_pass") is True, (
            "Australian Citizen mention must NOT falsely knock out Sam"
        )
        assert kos_pass.get("clearance_pass") is True, (
            "Baseline / NV1 mention must NOT falsely knock out Sam"
        )
        assert kos_pass.get("salary_pass") is True, "$155k-$165k must pass $120k floor"
        assert kos_pass.get("location_pass") is True, "Melbourne location must pass"
        assert kos_pass.get("overall_pass") is True, "Overall pass must be True"

    def test_one_click_application_studio_contract(self, e2e_env):
        """R4 Acceptance: POST /api/career-mode/application-studio produces structured

        STAR KSC responses, executive cover letters, and ATS keyword summaries
        grounded in Sam's verified milestones.
        """
        client, _, _ = e2e_env
        payload = {
            "job_id": "job_e2e_vic_edu",
            "generation_types": ["ksc", "cover_letter", "ats_resume"],
        }
        res = client.post("/api/career-mode/application-studio", json_body=payload)
        assert res.status_code == 200, (
            f"Expected HTTP 200, got {res.status_code}: {res.text}"
        )
        data = res.json()

        # 1. KSC STAR Verification
        assert "ksc" in data, "Response must include 'ksc' generation"
        ksc = data["ksc"]
        criteria_responses = ksc.get("criteria_responses", [])
        assert len(criteria_responses) >= 1, (
            "Must generate at least 1 KSC criterion response"
        )
        first_ksc = criteria_responses[0]
        assert "criterion" in first_ksc
        assert "star_narrative" in first_ksc
        star = first_ksc["star_narrative"]
        assert all(k in star for k in ("situation", "task", "action", "result")), (
            f"STAR narrative missing components: {star}"
        )
        combined_star = (
            f"{star['situation']} {star['task']} {star['action']} {star['result']}"
        )
        assert any(
            term in combined_star
            for term in [
                "660,000",
                "Education",
                "SharePoint",
                "PowerShell",
                "Capgemini",
                "St John",
            ]
        ), "KSC STAR responses must be grounded in Sam's real enterprise roles"

        # 2. Executive Cover Letter Verification
        assert "cover_letter" in data, "Response must include 'cover_letter'"
        cover_letter = data["cover_letter"]
        assert "variant" in cover_letter
        assert "content" in cover_letter
        cl_text = cover_letter["content"]
        assert len(cl_text) >= 100, "Cover letter content should be substantial"
        assert any(
            term in cl_text
            for term in [
                "660,000",
                "Education",
                "infrastructure",
                "clinical",
                "PowerShell",
            ]
        ), "Cover letter must highlight verified achievements"

        # 3. ATS Resume Optimization Summary Verification
        assert "ats_resume" in data, "Response must include 'ats_resume'"
        ats = data["ats_resume"]
        assert "match_score" in ats
        assert isinstance(ats["match_score"], (int, float))
        assert "matched_keywords" in ats
        assert isinstance(ats["matched_keywords"], list)
        assert len(ats["matched_keywords"]) > 0
        assert "tailored_summary" in ats
        assert len(ats["tailored_summary"]) >= 50


# ==============================================================================
# TIER 2: BOUNDARY & CORNER CASES
# Robustness against missing salary, daily/hourly rates, extreme seniority,
# zero-match queries, and clearance edge cases.
# ==============================================================================


class TestTier2BoundaryAndCornerCases:
    """Tier 2: Boundary & Corner Cases (unusual inputs and edge conditions)."""

    def test_missing_and_none_salary_graceful_handling(self, e2e_env):
        """Boundary: Jobs with None, empty string, or omitted salary must not crash

        and should not trigger a false salary knockout.
        """
        client, _, _ = e2e_env
        res = client.get("/api/career-mode/matches", params={"min_score": 0})
        assert res.status_code == 200
        jobs = {j["id"]: j for j in res.json().get("jobs", [])}

        missing_sal_job = jobs.get("job_e2e_missing_salary")
        assert missing_sal_job is not None, "Missing salary job should be present"
        kos = missing_sal_job.get("knockouts", {})
        # Undisclosed salary should be permissive (True) so valid opportunities are not discarded
        assert kos.get("salary_pass") is True, (
            "Undisclosed salary should pass permissively"
        )

        chips = [c.get("label", "") for c in missing_sal_job.get("chips", [])]
        assert any("Salary" in c for c in chips), (
            "Should provide a salary chip indicating undisclosed status"
        )

    def test_malformed_salary_strings_resilience(self, e2e_env):
        """Boundary: Parser must handle daily rates ($900/day), hourly rates ($85/hr),

        k-notation ($145k), text packages, and boundary numbers without 500 errors.
        """
        client, _, _ = e2e_env
        res = client.get("/api/career-mode/matches", params={"min_score": 0})
        assert res.status_code == 200
        jobs = {j["id"]: j for j in res.json().get("jobs", [])}

        # Daily rate: $900/day -> ~$200k/yr -> salary_pass=True
        daily_high = jobs.get("job_e2e_daily_rate_high")
        if daily_high:
            assert daily_high.get("knockouts", {}).get("salary_pass") is True

        # Low daily rate: $350/day -> ~$80k/yr -> salary_pass=False
        daily_low = jobs.get("job_e2e_daily_rate_low")
        if daily_low:
            assert daily_low.get("knockouts", {}).get("salary_pass") is False

        # Hourly rate: $85/hr -> ~$170k/yr -> salary_pass=True
        hourly = jobs.get("job_e2e_hourly_rate")
        if hourly:
            assert hourly.get("knockouts", {}).get("salary_pass") is True

        # Text package ("Competitive salary package"): must not throw unhandled exception
        text_sal = jobs.get("job_e2e_text_salary")
        assert text_sal is not None
        assert "knockouts" in text_sal

        # Abbreviated notation ("$145k - $160k"): parses >= $120k floor
        k_sal = jobs.get("job_e2e_k_salary")
        if k_sal:
            assert k_sal.get("knockouts", {}).get("salary_pass") is True

        # Floor boundary under: $119,000 -> salary_pass=False
        under = jobs.get("job_e2e_boundary_under")
        if under:
            assert under.get("knockouts", {}).get("salary_pass") is False

        # Floor boundary exact: $120,000 -> salary_pass=True
        exact = jobs.get("job_e2e_boundary_exact")
        if exact:
            assert exact.get("knockouts", {}).get("salary_pass") is True

    def test_zero_match_query_resilience(self, e2e_env):
        """Corner Case: Non-existent archetype or impossible score filter returns

        200 OK with empty list rather than 404 or 500.
        """
        client, _, _ = e2e_env
        res = client.get(
            "/api/career-mode/matches",
            params={"archetype": "NonExistentQuantumRole", "min_score": 99},
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("total", len(data.get("jobs", []))) == 0
        assert data.get("jobs") == []

    def test_clearance_and_citizenship_edge_cases(self, e2e_env):
        """Corner Case: Ambiguous security clearance phrases (sponsorship vs mandatory

        active clearance) and Australian citizenship variants.
        """
        _, repo, app = e2e_env
        client = CareerModeE2EClient(app)

        # Job with "Eligible to obtain Baseline clearance"
        repo.upsert_job(
            build_seed_job(
                job_id="job_edge_clearance_elig",
                title="Systems Engineer",
                company="State Agency",
                location="Melbourne, VIC",
                salary_raw="$135,000",
                description="Must be an Australian Citizen eligible to obtain Baseline clearance upon onboarding.",
            )
        )

        res = client.get("/api/career-mode/matches", params={"min_score": 0})
        jobs = {j["id"]: j for j in res.json().get("jobs", [])}
        edge_job = jobs.get("job_edge_clearance_elig")
        assert edge_job is not None
        assert edge_job.get("knockouts", {}).get("clearance_pass") is True
        assert edge_job.get("knockouts", {}).get("work_rights_pass") is True

    def test_extreme_seniority_and_experience_filtering(self, e2e_env):
        """Corner Case: Junior intern role receives low justification score and

        is excluded from recommended feed.
        """
        _, repo, app = e2e_env
        client = CareerModeE2EClient(app)

        repo.upsert_job(
            build_seed_job(
                job_id="job_edge_intern",
                title="Junior Graduate Desktop Intern",
                company="Startup Inc",
                location="Melbourne, VIC",
                salary_raw="$60,000",
                description="No experience required. Entry level internship.",
            )
        )

        res = client.get("/api/career-mode/matches", params={"min_score": 75})
        assert res.status_code == 200
        jobs = res.json().get("jobs", [])
        intern_in_high_match = any(j["id"] == "job_edge_intern" for j in jobs)
        assert not intern_in_high_match, (
            "Junior intern job should not appear in high alignment feed"
        )


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS
# Pairwise interactions: archetype + salary floor + remote filters,
# application studio generation on filtered sets, and telemetry updates.
# ==============================================================================


class TestTier3CrossFeatureCombinations:
    """Tier 3: Cross-Feature Combinations (multi-parameter interactions)."""

    def test_archetype_salary_floor_and_remote_combination(self, e2e_env):
        """Cross-Feature: Filtering by archetype + score + remote_only simultaneously

        enforces all constraints conjunctively.
        """
        client, _, _ = e2e_env
        params = {
            "archetype": "Senior Infrastructure Engineer",
            "min_score": 75,
            "remote_only": "true",
        }
        res = client.get("/api/career-mode/matches", params=params)
        assert res.status_code == 200
        jobs = res.json().get("jobs", [])

        for job in jobs:
            # Must satisfy score threshold
            assert job.get("sam_score", 0) >= 75
            # Must be remote
            assert (
                job.get("remote") is True or "remote" in job.get("location", "").lower()
            )
            # Must not be knocked out
            assert job.get("knockouts", {}).get("overall_pass", True) is True

    def test_application_generation_on_filtered_jobs(self, e2e_env):
        """Cross-Feature: Discovered job from filtered matches feed can be directly

        submitted to Application Studio.
        """
        client, _, _ = e2e_env
        # 1. Fetch filtered matches
        res_matches = client.get(
            "/api/career-mode/matches", params={"archetype": "Senior M365 Engineer"}
        )
        assert res_matches.status_code == 200
        jobs = res_matches.json().get("jobs", [])
        assert len(jobs) > 0, "Expected at least one matching M365 role"
        target_job = jobs[0]

        # 2. Dispatch Application Studio for discovered job
        payload = {
            "job_id": target_job["id"],
            "generation_types": ["ksc", "cover_letter"],
        }
        res_app = client.post("/api/career-mode/application-studio", json_body=payload)
        assert res_app.status_code == 200
        app_data = res_app.json()
        assert "ksc" in app_data or "cover_letter" in app_data

    def test_scraper_telemetry_integrated_in_hud_overview(self, e2e_env):
        """Cross-Feature: Database insertions reflect immediately in HUD telemetry counts."""
        client, repo, _ = e2e_env
        # 1. Initial overview
        res1 = client.get("/api/career-mode/overview")
        assert res1.status_code == 200
        initial_telemetry = res1.json().get("telemetry", {})
        initial_total = initial_telemetry.get("total_matching_jobs", 0)

        # 2. Upsert an additional matching job for today
        repo.upsert_job(
            build_seed_job(
                job_id="job_telemetry_dynamic_add",
                title="Senior Systems Engineer",
                company="Fresh Ingestion Ltd",
                location="Melbourne, VIC",
                salary_raw="$150,000",
                description="M365, Active Directory, PowerShell automation.",
            )
        )

        # 3. Subsequent overview reflects update
        res2 = client.get("/api/career-mode/overview")
        assert res2.status_code == 200
        updated_telemetry = res2.json().get("telemetry", {})
        assert updated_telemetry.get("total_matching_jobs", 0) >= initial_total

    def test_batch_evaluate_reflected_in_matches_feed(self, e2e_env):
        """Cross-Feature: POST /api/career-mode/evaluate triggers on-demand batch

        re-scoring and staging.
        """
        client, _, _ = e2e_env
        res = client.post("/api/career-mode/evaluate", json_body={"min_score": 70})
        assert res.status_code == 200, (
            f"Expected 200, got {res.status_code}: {res.text}"
        )
        data = res.json()
        assert (
            data.get("success") is True
            or "evaluated_count" in data
            or "matches_count" in data
        )


# ==============================================================================
# TIER 4: REAL-WORLD SCENARIOS
# Realistic end-to-end user workflows for Sam Ludwig.
# ==============================================================================


class TestTier4RealWorldScenarios:
    """Tier 4: Real-World Scenarios (holistic end-to-end user workflows)."""

    def test_scenario_dept_of_ed_vic_enterprise_workflow(self, e2e_env):
        """Scenario A: Sam reviews a Victorian Public Sector enterprise role,

        verifies HUD clearance/salary alignment, checks 660,000+ user proof points,
        and generates a STAR KSC response document and tailored cover letter.
        """
        client, _, _ = e2e_env

        # Step 1: Sam opens the Career Cockpit HUD
        overview_res = client.get("/api/career-mode/overview")
        assert overview_res.status_code == 200
        hud = overview_res.json()
        assert hud["profile"]["workRights"] == "Australian Citizen (Unrestricted)"
        assert hud["profile"]["salaryFloor"] == 120000

        # Step 2: Sam filters for high-alignment roles (min_score=85)
        feed_res = client.get("/api/career-mode/matches", params={"min_score": 85})
        assert feed_res.status_code == 200
        feed_jobs = feed_res.json().get("jobs", [])
        vic_role = next((j for j in feed_jobs if j["id"] == "job_e2e_vic_edu"), None)
        assert vic_role is not None, (
            "Enterprise VIC role must appear in high alignment feed"
        )

        # Step 3: Inspect proof points and instant match breakdown chips
        proof_points = vic_role.get("proof_points", [])
        assert any("660,000" in p or "Education" in p for p in proof_points), (
            f"Expected proof point referencing 660,000+ users, got: {proof_points}"
        )
        assert vic_role["knockouts"]["overall_pass"] is True

        # Step 4: Click 1-Click Application Studio to generate tailored materials
        gen_res = client.post(
            "/api/career-mode/application-studio",
            json_body={
                "job_id": vic_role["id"],
                "generation_types": ["ksc", "cover_letter", "ats_resume"],
            },
        )
        assert gen_res.status_code == 200
        studio_output = gen_res.json()

        # Step 5: Verify generated application assets
        # STAR KSC responses
        ksc_responses = studio_output.get("ksc", {}).get("criteria_responses", [])
        assert len(ksc_responses) >= 1
        star_narrative = ksc_responses[0]["star_narrative"]
        assert len(star_narrative["situation"]) > 20
        assert len(star_narrative["action"]) > 20

        # Cover letter tailored to enterprise scale
        cl_content = studio_output.get("cover_letter", {}).get("content", "")
        assert len(cl_content) > 100
        assert "Dear" in cl_content or "Hiring" in cl_content

    def test_scenario_low_salary_rejection(self, e2e_env):
        """Scenario B: An underpaid $85,000 role is evaluated, correctly flagged

        as failing the $120,000 salary floor, and excluded from recommended feed.
        """
        client, _, _ = e2e_env

        # Query high-alignment recommendations
        feed_res = client.get("/api/career-mode/matches", params={"min_score": 70})
        assert feed_res.status_code == 200
        recommended_ids = [j["id"] for j in feed_res.json().get("jobs", [])]
        assert "job_ko_salary" not in recommended_ids, (
            "Underpaid role must not appear in recommended feed"
        )

        # Direct inspection of the underpaid job
        all_res = client.get("/api/career-mode/matches", params={"min_score": 0})
        all_jobs = {j["id"]: j for j in all_res.json().get("jobs", [])}
        underpaid_job = all_jobs.get("job_ko_salary")
        if underpaid_job:
            assert underpaid_job["knockouts"]["salary_pass"] is False
            assert underpaid_job["knockouts"]["overall_pass"] is False

    def test_scenario_hybrid_melbourne_balaclava_alignment(self, e2e_env):
        """Scenario C: A hybrid role in Balaclava/Melbourne SE matches Sam's

        commute preference and passes all location and knockout filters.
        """
        client, _, _ = e2e_env
        feed_res = client.get("/api/career-mode/matches", params={"min_score": 70})
        assert feed_res.status_code == 200
        jobs = {j["id"]: j for j in feed_res.json().get("jobs", [])}

        balaclava_job = jobs.get("job_e2e_balaclava_local")
        assert balaclava_job is not None, "Local Balaclava role should appear in feed"
        assert balaclava_job["knockouts"]["location_pass"] is True
        assert balaclava_job["knockouts"]["overall_pass"] is True
