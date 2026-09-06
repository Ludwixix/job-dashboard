"""Unit tests for the Strategic Career Roadmap & Skills Gap Forecasting Engine."""

import pytest
from job_dashboard.career_matrix import (
    generate_career_roadmap,
    detect_current_seniority_level,
    SECTOR_CAREER_TRACKS,
    AU_CERTIFICATION_REGISTRY,
)


def test_empty_profile_generates_safe_technology_roadmap():
    """An empty or minimal profile safely defaults to mid-level technology track."""
    roadmap = generate_career_roadmap({}, target_level=None, sector=None)

    assert roadmap is not None
    assert roadmap["sector"] == "technology"
    assert roadmap["current_level"] in ("entry_mid", "senior_lead")
    assert roadmap["target_level"] is not None
    assert len(roadmap["skill_gaps"]) > 0
    assert len(roadmap["milestones_12m"]) == 3
    assert roadmap["salary_projection"]["target_min"] > roadmap["salary_projection"]["current_min"]
    assert len(roadmap["adjacent_pivots"]) > 0


def test_technology_senior_to_staff_roadmap():
    """A Senior DevOps engineer receives targeted Staff/Principal roadmap with cloud architecture gaps."""
    senior_profile = {
        "title": "Senior DevOps Engineer",
        "industry": "technology",
        "coreSkills": ["Kubernetes", "Docker", "Terraform", "CI/CD", "AWS", "Python"],
        "yearsOfExperience": 7,
    }

    roadmap = generate_career_roadmap(senior_profile, target_level="staff_principal", sector="technology")

    assert roadmap["current_level"] == "senior_lead"
    assert roadmap["target_level"] == "staff_principal"
    assert "Staff Platform Architect" in roadmap["target_title"] or "Principal" in roadmap["target_title"]
    # Check that high-level architecture & FinOps/governance skills are flagged as gaps
    gap_skills = [gap["skill"] for gap in roadmap["skill_gaps"]]
    assert any("Architecture" in s or "FinOps" in s or "Executive" in s or "Distributed" in s for s in gap_skills)
    # Check certification recommendations
    cert_names = [c["name"] for c in roadmap["certifications"]]
    assert any("AWS" in c or "CKA" in c or "Architecture" in c for c in cert_names)
    # Salary projection
    assert roadmap["salary_projection"]["target_median"] >= 190000


def test_healthcare_rn_to_clinical_specialist_roadmap():
    """A Registered Nurse receives healthcare progression toward Clinical Nurse Specialist / NUM."""
    rn_profile = {
        "title": "Registered Nurse - Acute Care",
        "industry": "healthcare",
        "coreSkills": ["Patient Assessment", "Medication Administration", "Infection Control", "Aseptic Technique"],
        "yearsOfExperience": 4,
    }

    roadmap = generate_career_roadmap(rn_profile, target_level="senior_lead", sector="healthcare")

    assert roadmap["sector"] == "healthcare"
    assert roadmap["target_level"] == "senior_lead"
    assert any("Clinical Nurse Specialist" in t or "Senior" in t for t in [roadmap["target_title"]])
    # Australian accreditation check (AHPRA)
    cert_names = [c["name"] for c in roadmap["certifications"]]
    assert any("AHPRA" in c or "Postgraduate" in c or "Specialty" in c for c in cert_names)


def test_finance_analyst_to_controller_roadmap():
    """A Financial Analyst receives trajectory toward Senior Management Accountant / Financial Controller."""
    finance_profile = {
        "title": "Financial Analyst",
        "industry": "finance",
        "coreSkills": ["Financial Modeling", "Variance Analysis", "Excel", "Month-End Close"],
        "yearsOfExperience": 3,
    }

    roadmap = generate_career_roadmap(finance_profile, target_level="senior_lead", sector="finance")

    assert roadmap["sector"] == "finance"
    cert_names = [c["name"] for c in roadmap["certifications"]]
    assert any("CPA" in c or "CA ANZ" in c for c in cert_names)
    assert roadmap["salary_projection"]["target_median"] > roadmap["salary_projection"]["current_median"]


def test_trades_electrician_to_superintendent_roadmap():
    """An Electrician receives progression toward Foreperson and Site Superintendent."""
    trades_profile = {
        "title": "Licensed Electrician",
        "industry": "trades",
        "coreSkills": ["Switchboard Wiring", "Fault Finding", "Test & Tag", "Cable Hauling"],
        "yearsOfExperience": 6,
    }

    roadmap = generate_career_roadmap(trades_profile, target_level="senior_lead", sector="trades")

    assert roadmap["sector"] == "trades"
    cert_names = [c["name"] for c in roadmap["certifications"]]
    assert any("WHS" in c or "Diploma" in c or "Contractor" in c for c in cert_names)


def test_detect_current_seniority_level():
    """Accurately infers seniority tier from job title and experience years."""
    assert detect_current_seniority_level("Junior Developer", 1) == "entry_mid"
    assert detect_current_seniority_level("Senior Software Engineer", 6) == "senior_lead"
    assert detect_current_seniority_level("Staff Platform Architect", 10) == "staff_principal"
    assert detect_current_seniority_level("Director of Engineering", 15) == "executive"
