from job_dashboard.models import Job
from job_dashboard.score import _title_category, score_job


def test_nurse_profile_with_nursing_job_title_scores_full_category():
    profile = {
        "targetTitles": ["Registered Nurse"],
        "experience": [{"title": "Enrolled Nurse"}],
        "coreSkills": ["Patient Care", "Medication Administration", "Triage"],
    }
    job = Job(
        id="job-nurse-1",
        title="Registered Nurse - Aged Care",
        company="St Vincent's Care",
        location="Melbourne, VIC",
        description="Looking for an experienced Registered Nurse to coordinate patient care.",
    )

    assert _title_category(job, profile) == 1.0
    result = score_job(job, profile)
    assert result.dimensions["title_category_match"] == 100


def test_nurse_profile_with_it_job_title_is_neutral():
    profile = {
        "targetTitles": ["Registered Nurse"],
        "experience": [{"title": "Enrolled Nurse"}],
        "coreSkills": ["Patient Care", "Medication Administration"],
    }
    job = Job(
        id="job-it-1",
        title="Azure Cloud Systems Administrator",
        company="Tech Corp",
        location="Melbourne, VIC",
        description="Systems administration across Azure cloud infrastructure.",
    )

    assert _title_category(job, profile) == 0.55
    result = score_job(job, profile)
    assert result.dimensions["title_category_match"] == 55


def test_empty_profile_uses_it_fallback():
    empty_profile = {}
    it_job = Job(
        id="job-it-2",
        title="Senior Systems Administrator",
        company="Enterprise Tech",
        location="Melbourne, VIC",
        description="Infrastructure and systems administration.",
    )
    non_it_job = Job(
        id="job-nurse-2",
        title="Registered Nurse",
        company="Public Health Hospital",
        location="Melbourne, VIC",
        description="Ward nurse duties.",
    )

    # IT job matches fallback IT heuristic -> 1.0
    assert _title_category(it_job, empty_profile) == 1.0
    it_result = score_job(it_job, empty_profile)
    assert it_result.dimensions["title_category_match"] == 100

    # Non-IT job does not match fallback IT heuristic -> 0.45
    assert _title_category(non_it_job, empty_profile) == 0.45
    non_it_result = score_job(non_it_job, empty_profile)
    assert non_it_result.dimensions["title_category_match"] == 45


def test_profile_experience_title_overlap_matches():
    profile = {
        "targetTitles": [],
        "experience": [{"title": "Occupational Therapist"}],
    }
    job = Job(
        id="job-ot-1",
        title="Senior Occupational Therapist",
        company="Health Rehabilitation",
        location="Melbourne, VIC",
        description="Occupational therapy role.",
    )

    assert _title_category(job, profile) == 1.0
    result = score_job(job, profile)
    assert result.dimensions["title_category_match"] == 100
