from job_dashboard.models import Job
from job_dashboard.score import score_job


def test_nested_profile_variants_match_canonical_job_skills():
    profile = {
        "technical_expertise": {
            "cloud": ["Azure Functions", "Entra ID"],
            "automation": ["PowerShell (advanced/PnP)"],
        }
    }
    result = score_job(Job("1", "Cloud Engineer", "Acme", description="Azure and PowerShell automation"), profile)
    assert {"azure", "powershell"}.issubset(result.matched_skills)
    assert result.dimensions["skill_match"] > 0