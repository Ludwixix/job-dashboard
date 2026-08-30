"""
Batch scoring operations for improved performance.
"""
from typing import List, Dict, Any, Tuple
from functools import lru_cache
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

from .models import Job, ScoreResult
from .types import ScoringError, ProfileDict
from .score import (
    SKILL_ALIASES, _LEVEL_WEIGHT, _CLUSTER_WEIGHT, _PRIMARY_SKILLS, _SECONDARY_SKILLS,
    _TRADE_TERMS, _DATA_ROLE_TERMS, _DATA_SPECIFIC_TERMS,
    _profile_skills, _job_skills, _role_domain, _experience_level,
    _seniority_penalty, _skill_cluster
)


def score_jobs_batch(jobs: List[Job], profile: Dict[str, Any]) -> List[ScoreResult]:
    """
    Score multiple jobs efficiently using batch processing.
    
    Args:
        jobs: List of Job objects to score
        profile: User profile dictionary
        
    Returns:
        List of ScoreResult objects
    """
    try:
        if not jobs:
            return []
        
        # Pre-compute profile skills once for all jobs
        profile_skills = _profile_skills(profile)
        
        results = []
        for job in jobs:
            try:
                result = _score_single_job_fast(job, profile_skills)
                results.append(result)
            except Exception as e:
                # Create error result for failed job
                error_result = _create_error_result(job, str(e))
                results.append(error_result)
        
        return results
        
def _score_single_job_fast(job: Job, profile_skills: Dict[str, str]) -> ScoreResult:
    """Optimized single job scoring using pre-computed profile skills."""
    # Extract job skills
    skills = _job_skills(job)
    domain = _role_domain(job)
    
    # Calculate matched skills
    matched = tuple(
        skill for skill, confidence in skills.items()
        if confidence >= 0.6 and skill in profile_skills and domain != "trade"
    )
    missing = tuple(skill for skill in skills if skill not in profile_skills)
    
    # Calculate weights
    total_weight = sum(
        _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill)]
        for skill in skills
    )
    matched_weight = sum(
        _LEVEL_WEIGHT.get(profile_skills.get(skill, "basic"), 0.5) * _CLUSTER_WEIGHT[_skill_cluster(skill)] * skills[skill]
        for skill in matched
    )
    skill_match = matched_weight / total_weight if total_weight else 0.0
    
    # Calculate other factors
    experience_level = _experience_level(job)
    experience = {"junior": 0.7, "mid": 1.0, "senior": 0.9, "executive": 0.3}[experience_level]
    location = 1.0 if job.remote or re.search(r"remote|melbourne|vic", job.location, re.I) else 0.5
    company = 0.9 if re.search(r"government|council|bank|university|health|technology|cloud", job.company, re.I) else 0.7
    growth = 0.9 if re.search(r"trainee|graduate|junior|training", job.text(), re.I) else 0.8 if re.search(r"cloud|azure|devops", job.text(), re.I) else 0.5
    seniority_penalty = _seniority_penalty(job)
    title_category = 1.0 if any(term in job.title.lower() for term in ("sharepoint", "microsoft 365", "m365", "infrastructure", "systems administrator", "powershell", "azure", "cloud")) else 0.45
    recency = 1.0 if getattr(job, "posted", "") else 0.5
    
    # Calculate dimensions and total score
    dimensions = {
        "skill_match": round(skill_match * 100),
        "title_category_match": round(title_category * 100),
        "location_fit": round(location * 100),
        "recency_weight": round(recency * 100),
        "experience_fit": round(experience * 100),
        "company_fit": round(company * 100),
        "growth_potential": round(growth * 100)
    }
    
    total = skill_match * 0.6 + title_category * 0.12 + location * 0.08 + experience * 0.08 + company * 0.04 + growth * 0.03 + recency * 0.05 - seniority_penalty
    
    # Apply domain-specific adjustments
    if domain == "data" and not any(term in job.text().lower() for term in _DATA_SPECIFIC_TERMS):
        total = min(total, 0.5)
    if domain == "trade":
        total = min(total, 0.35)
    
    total = max(0.0, min(1.0, total))
    
    # Determine fit category
    fit = "No skill match" if not matched else "Excellent fit" if total >= 0.85 else "Strong fit" if total >= 0.7 else "Good fit" if total >= 0.55 else "Partial fit"
    
    # Calculate confidence
    confidence = min(1.0, 0.5 + (0.2 if job.description else 0) + (0.1 if job.tags else 0) + (0.1 if job.why else 0) + (0.1 if len(skills) > 3 else 0))
    
    # Determine strengths and risks
    strengths = ("Strong skill alignment", "Experience level matches role requirements", "Ideal location match")[:1 + (experience >= 0.8) + (location >= 0.9)]
    risks = ((f"Missing skills: {', '.join(missing[:3])}",) if missing else ()) + ("Verify exact requirements before applying",)
    relevance = "No match" if domain == "trade" else "Strong"
    
    # Create ScoreResult
    return ScoreResult(
        round(total * 100),
        fit,
        dimensions,
        matched,
        missing,
        strengths,
        risks[:3],
        round(confidence, 2),
        experience_level,
        relevance,
        dimensions
    )


def _create_error_result(job: Job, error_message: str) -> ScoreResult:
    """Create an error ScoreResult for failed job scoring."""
    return ScoreResult(
        0,
        "Error",
        {"skill_match": 0, "title_category_match": 0, "location_fit": 0, "recency_weight": 0, "experience_fit": 0, "company_fit": 0, "growth_potential": 0},
        (),
        (),
        (),
        (f"Scoring error: {error_message}",),
        0.0,
        "mid",
        "Error",
        {}
    )