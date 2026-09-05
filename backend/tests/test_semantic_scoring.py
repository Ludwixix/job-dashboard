import math
import pytest
from job_dashboard.models import Job, ScoreResult
from job_dashboard.score import explain_score, score_job
from job_dashboard.semantic_scoring import (
    compute_semantic_similarity,
    compute_subword_tfidf_vector,
    cosine_similarity,
    extract_profile_semantic_corpus,
    score_job_hybrid,
)


@pytest.fixture
def sample_it_profile():
    return {
        "headline": "Senior Cloud Systems Engineer & Modern Workplace Architect",
        "marketArchetype": "Cloud Infrastructure Lead",
        "bio": "Extensive experience in Azure enterprise architecture, Microsoft 365, and PowerShell automation.",
        "coreSkills": ["Azure", "Microsoft 365", "PowerShell", "Intune", "Exchange Online"],
        "keyStrengths": [
            "Designing hybrid cloud governance",
            "Zero trust identity and modern workplace deployment",
        ],
        "targetTitles": ["Cloud Engineer", "Systems Administrator", "Infrastructure Lead"],
        "technical_expertise": {
            "cloud": ["Azure", "AWS", "Entra ID"],
            "automation": ["PowerShell", "Bash", "Terraform"],
        },
    }


@pytest.fixture
def sample_cloud_job():
    return Job(
        id="job-cloud-123",
        title="Senior Cloud Infrastructure Engineer (Azure / M365)",
        company="Enterprise Tech Solutions",
        location="Melbourne, VIC",
        description="We are seeking an experienced Cloud Systems Administrator to oversee our Azure tenant, automate Microsoft 365 migrations using PowerShell, and configure Intune endpoint compliance.",
        why="Core infrastructure automation role",
        tags=("cloud", "azure", "powershell", "m365"),
        remote=True,
    )


@pytest.fixture
def sample_unrelated_job():
    return Job(
        id="job-chef-999",
        title="Head Pastry Chef & Baker",
        company="Artisan Bakery Co",
        location="Geelong, VIC",
        description="Seeking an experienced pastry chef skilled in sourdough bread making, croissant laminating, and confectionery creation.",
        why="Bakery production",
        tags=("culinary", "baking"),
        remote=False,
    )


def test_cosine_similarity_calculations():
    # Dense sequence
    assert math.isclose(cosine_similarity([1.0, 0.0], [1.0, 0.0]), 1.0)
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine_similarity([], []) == 0.0

    # Sparse mapping
    vec_a = {"cloud": 0.8, "azure": 0.6}
    vec_b = {"cloud": 0.8, "azure": 0.6}
    assert math.isclose(cosine_similarity(vec_a, vec_b), 1.0)

    vec_c = {"pastry": 1.0, "flour": 1.0}
    assert cosine_similarity(vec_a, vec_c) == 0.0

    # Partial overlap
    vec_d = {"cloud": 0.8, "linux": 0.5}
    partial_sim = cosine_similarity(vec_a, vec_d)
    assert 0.0 < partial_sim < 1.0


def test_extract_profile_semantic_corpus(sample_it_profile):
    corpus = extract_profile_semantic_corpus(sample_it_profile)
    assert "Senior Cloud Systems Engineer" in corpus
    assert "Azure" in corpus
    assert "PowerShell" in corpus
    assert "Cloud Infrastructure Lead" in corpus

    # Handles nested profile dict
    wrapped = {"profile": sample_it_profile}
    nested_corpus = extract_profile_semantic_corpus(wrapped)
    assert "Senior Cloud Systems Engineer" in nested_corpus


def test_compute_subword_tfidf_vector():
    text = "Azure cloud architecture and automated orchestration"
    vector = compute_subword_tfidf_vector(text)
    assert len(vector) > 0
    # Length of unit-norm vector should be ~1.0
    norm = math.sqrt(sum(v * v for v in vector.values()))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)


def test_compute_semantic_similarity(sample_it_profile, sample_cloud_job, sample_unrelated_job):
    cloud_sim = compute_semantic_similarity(sample_it_profile, sample_cloud_job)
    chef_sim = compute_semantic_similarity(sample_it_profile, sample_unrelated_job)

    assert cloud_sim > 0.35, f"Expected high similarity for relevant cloud job, got {cloud_sim}"
    assert chef_sim < 0.15, f"Expected low similarity for unrelated chef job, got {chef_sim}"
    assert cloud_sim > chef_sim * 2


def test_score_job_hybrid_blending(sample_it_profile, sample_cloud_job):
    deterministic_result = score_job(sample_cloud_job, sample_it_profile)
    hybrid_result = score_job_hybrid(sample_cloud_job, sample_it_profile, semantic_weight=0.25)

    assert isinstance(hybrid_result, ScoreResult)
    assert hybrid_result.rule_score == deterministic_result.score
    assert hybrid_result.semantic_score is not None
    assert 0.0 <= hybrid_result.semantic_score <= 1.0
    assert "semantic_similarity" in hybrid_result.dimensions
    assert "semantic_similarity" in hybrid_result.score_breakdown

    # Verify explain_score integrates semantic metadata
    explanation = explain_score(hybrid_result)
    assert "semantic_score" in explanation
    assert "rule_score" in explanation
    assert explanation["semantic_score"] == hybrid_result.semantic_score
    assert explanation["rule_score"] == hybrid_result.rule_score


def test_score_job_hybrid_zero_weight_returns_base(sample_it_profile, sample_cloud_job):
    deterministic = score_job(sample_cloud_job, sample_it_profile)
    zero_weight = score_job_hybrid(sample_cloud_job, sample_it_profile, semantic_weight=0.0)

    assert zero_weight.score == deterministic.score
    assert zero_weight.semantic_score is None


def test_score_job_hybrid_graceful_error_resilience():
    # Malformed inputs should not raise, but fallback gracefully
    empty_job = Job(id="empty", title="", company="")
    result = score_job_hybrid(empty_job, {})
    assert isinstance(result, ScoreResult)

