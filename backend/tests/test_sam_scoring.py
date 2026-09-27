"""Comprehensive Unit Tests for Sam Mode Scoring & Knockout Engine.

Tests:
1. Hard Knockouts: Zero false knockouts on Australian Citizen (Unrestricted) and Baseline/NV1 clearance.
2. Knockouts on foreign citizenship restrictions and mandatory active TSPV.
3. Salary Floor: $120,000 AUD floor parsing (annual, k-notation, daily, hourly, undisclosed).
4. Location & Commute: Melbourne, Balaclava local, remote, hybrid, and interstate rejection.
5. Deep Competency Matching & Enterprise Scale Multipliers.
6. Role Archetype Classification for Sam's 8 target titles.
7. Proof-Point Synthesis & Justification Scoring.
"""

from __future__ import annotations

import pytest

from job_dashboard.sam_scoring import (
    CANONICAL_TARGET_TITLES,
    classify_role_archetype,
    evaluate_knockouts,
    evaluate_location,
    evaluate_salary,
    score_sam_job,
    synthesize_proof_points,
)


class TestSamKnockoutInvariants:
    """Verifies the 4-pillar hard knockout system with strict zero false knockout guarantees."""

    @pytest.mark.parametrize(
        "phrase",
        [
            "Must be an Australian Citizen",
            "Australian Citizenship is required for this role",
            "Applicants must be Australian Citizens or Permanent Residents",
            "Citizen or PR only",
            "Must possess unrestricted Australian working rights",
            "No visa sponsorship is available for this position",
            "Candidates must not require visa sponsorship",
            "Visa sponsorship provided",
            "Standard Australian working entitlement",
        ],
    )
    def test_zero_false_knockouts_australian_citizen(self, phrase: str):
        """Sam Ludwig is an Australian Citizen with unrestricted work rights."""
        job = {
            "title": "Senior Systems Engineer",
            "location": "Melbourne, VIC",
            "salary_raw": "$150,000",
            "description": f"Core engineering responsibilities. {phrase}.",
        }
        ko = evaluate_knockouts(job)
        assert ko.work_rights_pass is True
        assert ko.knocked_out is False

    @pytest.mark.parametrize(
        "phrase",
        [
            "US Citizens only",
            "Must be a US Citizen to comply with ITAR regulations",
            "ITAR compliant role: Non-US persons cannot be considered",
            "Green Card only",
            "UK nationals only",
        ],
    )
    def test_foreign_citizenship_knockout(self, phrase: str):
        """Jobs requiring non-Australian citizenship must be knocked out."""
        job = {
            "title": "Senior Systems Engineer",
            "location": "Melbourne, VIC",
            "salary_raw": "$150,000",
            "description": f"Restricted aerospace project. {phrase}.",
        }
        ko = evaluate_knockouts(job)
        assert ko.work_rights_pass is False
        assert ko.knocked_out is True
        assert any("foreign nationals" in r.lower() for r in ko.reasons)

    @pytest.mark.parametrize(
        "phrase",
        [
            "Must hold or be eligible to obtain Baseline security clearance",
            "Baseline clearance required",
            "Ability to obtain an AGSVA Baseline clearance",
            "NV1 clearance eligible",
            "Negative Vetting Level 1 (NV1) clearance desirable",
            "Must be willing to undergo Negative Vetting 1 process",
            "Requires National Police Check and Working With Children Check (WWCC)",
            "NDIS Worker Screening check mandatory",
            "No security clearance required",
        ],
    )
    def test_zero_false_knockouts_baseline_and_nv1(self, phrase: str):
        """Sam Ludwig is Australian Citizen eligible for Baseline and NV1 clearances."""
        job = {
            "title": "Senior Infrastructure Engineer",
            "location": "Melbourne, VIC",
            "salary_raw": "$150,000",
            "description": f"Enterprise infrastructure deployment. {phrase}.",
        }
        ko = evaluate_knockouts(job)
        assert ko.clearance_pass is True
        assert ko.knocked_out is False

    def test_mandatory_active_tspv_knockout(self):
        """Mandatory active TSPV without sponsorship must be knocked out."""
        job = {
            "title": "Senior Defence Infrastructure Specialist",
            "location": "Melbourne, VIC",
            "salary_raw": "$160,000",
            "description": "Mandatory requirement: Candidate must hold an active Top Secret Positive Vetting (TSPV) security clearance. No exceptions.",
        }
        ko = evaluate_knockouts(job)
        assert ko.clearance_pass is False
        assert ko.knocked_out is True
        assert any("tspv" in r.lower() for r in ko.reasons)

    def test_tspv_with_sponsorship_or_baseline_pass(self):
        """If TSPV is preferred or sponsorship/Baseline is accepted, role must pass."""
        job = {
            "title": "Senior Systems Engineer",
            "location": "Melbourne, VIC",
            "salary_raw": "$150,000",
            "description": "Baseline or NV1 clearance required; TSPV is advantageous with sponsorship available.",
        }
        ko = evaluate_knockouts(job)
        assert ko.clearance_pass is True
        assert ko.knocked_out is False


class TestSamSalaryFloorParsing:
    """Verifies salary floor parsing against the $120,000 AUD threshold."""

    @pytest.mark.parametrize(
        "sal_str, expected_pass",
        [
            ("$140,000 - $165,000 + Super", True),
            ("$150k + super", True),
            ("$145k - $160k", True),
            ("$120,000 exact package", True),
            ("$120k", True),
            ("$119,999", False),
            ("$119,000 package", False),
            ("$75,000 - $85,000", False),
            ("$85k", False),
            ("$95,000 max", False),
        ],
    )
    def test_annual_salary_parsing(self, sal_str: str, expected_pass: bool):
        pass_flag, _assess, reasons = evaluate_salary(sal_str)
        assert pass_flag is expected_pass
        if not expected_pass:
            assert any("120,000 floor" in r for r in reasons)

    @pytest.mark.parametrize(
        "rate_str, expected_pass",
        [
            ("$850 - $950 per day", True),  # ~$198k/yr
            ("$900 / day", True),  # ~$198k/yr
            ("$600 / day", True),  # ~$132k/yr
            ("$450 / day", False),  # ~$99k/yr (< $120k)
            ("$350 / day", False),  # ~$77k/yr (< $120k)
            ("$85 / hr", True),  # ~$153k/yr
            ("$75 / hr", True),  # ~$135k/yr
            ("$40 / hr", False),  # ~$72k/yr (< $120k)
            ("$50 / hr", False),  # ~$90k/yr (< $120k)
        ],
    )
    def test_contract_rates_annualization(self, rate_str: str, expected_pass: bool):
        pass_flag, _assess, _reasons = evaluate_salary(rate_str)
        assert pass_flag is expected_pass

    @pytest.mark.parametrize(
        "sal_text",
        [
            None,
            "",
            "   ",
            "Competitive salary package + employee benefits",
            "Market competitive rate based on experience",
            "Attractive remuneration package",
            "Negotiable based on candidate skills",
        ],
    )
    def test_unstated_and_text_salaries_pass_permissively(self, sal_text: str | None):
        """Unstated salaries must never trigger a false knockout."""
        pass_flag, assess, reasons = evaluate_salary(sal_text)
        assert pass_flag is True
        assert len(reasons) == 0
        assert assess["in_range"] is True


class TestSamLocationAndCommute:
    """Verifies location matching for Balaclava, Melbourne SE, Greater Melbourne, Remote, and Hybrid."""

    @pytest.mark.parametrize(
        "loc_text, desc_text, remote_flag",
        [
            ("Melbourne, VIC", "Hybrid 2 days in office", False),
            ("Balaclava, Melbourne VIC", "Local office near Balaclava station", False),
            ("Richmond, VIC", "Office located in Cremorne", False),
            ("Clayton, VIC", "South East Melbourne campus", False),
            ("Remote, Australia", "100% remote anywhere in Australia", True),
            ("Sydney, NSW", "Work from home / 100% remote across Australia", True),
            ("Anywhere, Australia", "Full WFH flexibility", True),
        ],
    )
    def test_acceptable_locations_pass(
        self, loc_text: str, desc_text: str, remote_flag: bool
    ):
        full_text = f"{loc_text} {desc_text}".lower()
        pass_flag, reasons = evaluate_location(loc_text, full_text, remote_flag)
        assert pass_flag is True
        assert len(reasons) == 0

    def test_strict_interstate_on_site_knockout(self):
        """Strict on-site role in Perth with no remote must be knocked out."""
        loc_text = "Perth, WA"
        full_text = "perth, wa strictly 5 days per week on-site in perth cbd office. no remote or interstate applicants."
        pass_flag, reasons = evaluate_location(loc_text, full_text, remote=False)
        assert pass_flag is False
        assert any("outside victoria" in r.lower() for r in reasons)


class TestSamCompetencyAndEnterpriseMultipliers:
    """Verifies competency clusters and enterprise scale multipliers."""

    def test_enterprise_scale_multiplier_660k_users(self):
        job = {
            "title": "Lead SharePoint & M365 Systems Specialist",
            "location": "Melbourne, VIC",
            "salary_raw": "$160,000",
            "description": "Managing statewide enterprise education network supporting 660,000+ users and 1,000+ school sites.",
        }
        res = score_sam_job(job)
        assert res.overall_score >= 85
        assert res.scale_multiplier >= 1.10
        assert any("Enterprise Scale: 660k+ Users" in c.label for c in res.chips)

    def test_clinical_hospital_migration_match(self):
        job = {
            "title": "Endpoint Migration Specialist",
            "location": "Melbourne, VIC",
            "salary_raw": "$145,000",
            "description": "Windows 11 Autopilot rollout across clinical hospital wards with zero patient care disruption and EMR compatibility.",
        }
        res = score_sam_job(job)
        assert res.overall_score >= 75
        assert res.scale_multiplier >= 1.10
        assert any("Clinical Migration: Match" in c.label for c in res.chips)

    def test_powershell_automation_speedup_match(self):
        job = {
            "title": "Infrastructure Automation Engineer",
            "location": "Melbourne, VIC",
            "salary_raw": "$150,000",
            "description": "PowerShell runbook development for cloud migration and batch process optimization.",
        }
        res = score_sam_job(job)
        assert any("PowerShell: Expert (87% Speedup)" in c.label for c in res.chips)


class TestSamArchetypeClassification:
    """Verifies that all 8 canonical target titles are classified accurately."""

    @pytest.mark.parametrize(
        "title, expected_archetype",
        [
            ("Senior Systems Engineer", "Senior Systems Engineer"),
            ("Lead Systems Specialist", "Senior Systems Engineer"),
            ("Senior Infrastructure Engineer", "Senior Infrastructure Engineer"),
            ("Senior Cloud Infrastructure Engineer", "Cloud Infrastructure Specialist"),
            (
                "Cloud Infrastructure Specialist (Azure)",
                "Cloud Infrastructure Specialist",
            ),
            ("Senior M365 Engineer", "Senior M365 Engineer"),
            ("Microsoft 365 Lead", "Senior M365 Engineer"),
            ("Endpoint / EUC Engineer", "Endpoint / EUC Engineer"),
            (
                "Senior Intune & Autopilot Deployment Engineer",
                "Endpoint / EUC Engineer",
            ),
            ("L3 Systems / Operations Lead", "L3 Systems / Operations Lead"),
            ("Tier 3 Support Operations Lead", "L3 Systems / Operations Lead"),
            (
                "SharePoint & Modern Workplace Architect",
                "SharePoint & Modern Workplace Architect",
            ),
            ("Modern Workplace Specialist", "SharePoint & Modern Workplace Architect"),
            ("Automation & DevOps Engineer", "Automation & DevOps Engineer"),
            ("PowerShell & DevOps Specialist", "Automation & DevOps Engineer"),
        ],
    )
    def test_archetype_mapping(self, title: str, expected_archetype: str):
        job = {
            "title": title,
            "location": "Melbourne, VIC",
            "description": "Enterprise engineering.",
        }
        arch = classify_role_archetype(job)
        assert arch in CANONICAL_TARGET_TITLES
        assert arch == expected_archetype


class TestSamProofPointSynthesis:
    """Verifies synthesis of empirical proof points from Sam's verified milestones."""

    def test_proof_points_grounded_in_verified_milestones(self):
        text = "m365 sharepoint enterprise 660,000 users windows 11 autopilot hospital clinical powershell automation".lower()
        proof_points, _details, score = synthesize_proof_points(text)
        assert len(proof_points) >= 2
        assert score >= 85
        combined = " ".join(proof_points)
        assert "660,000" in combined
        assert "Dept of Education" in combined or "St John of God" in combined
