"""
Utility functions for type conversion and validation.
"""
from typing import Any

from .types import JobDict, ProfileDict, ValidationResult, validate_profile_data, validate_job_data

def convert_to_job_dict(data: dict[str, Any]) -> JobDict:
    """Convert any dictionary to a properly typed JobDict."""
    result: JobDict = {
        "title": str(data.get("title", "")).strip(),
        "company": str(data.get("company", "")).strip(),
    }
    
    # Optional fields with type conversion
    if "location" in data:
        result["location"] = str(data["location"]).strip()
    
    if "description" in data:
        result["description"] = str(data["description"]).strip()
    
    if "why" in data:
        result["why"] = str(data["why"]).strip()
    
    if "tags" in data:
        tags = data["tags"]
        if isinstance(tags, str):
            result["tags"] = [tags.strip()]
        elif isinstance(tags, (list, tuple)):
            result["tags"] = [str(tag).strip() for tag in tags]
    
    if "remote" in data:
        result["remote"] = bool(data["remote"])
    
    if "source" in data:
        result["source"] = str(data["source"]).strip()
    
    if "url" in data:
        result["url"] = str(data["url"]).strip()
    elif "application_url" in data:
        result["url"] = str(data["application_url"]).strip()
    
    if "subcategory" in data:
        result["subcategory"] = str(data["subcategory"]).strip()
    
    if "posted" in data:
        result["posted"] = str(data["posted"]).strip()
    elif "date_posted" in data:
        result["posted"] = str(data["date_posted"]).strip()
    
    # IDs
    if "id" in data:
        result["id"] = str(data["id"]).strip()
    elif "job_id" in data:
        result["id"] = str(data["job_id"]).strip()
    
    return result


def convert_to_profile_dict(data: dict[str, Any]) -> ProfileDict:
    """Convert any dictionary to a properly typed ProfileDict."""
    result: ProfileDict = {
        "skills": data.get("skills", {}),
    }
    
    # Optional fields
    if "technical_expertise" in data:
        result["technical_expertise"] = data["technical_expertise"]
    
    if "experience" in data:
        result["experience"] = data["experience"]
    
    if "education" in data:
        result["education"] = data["education"]
    
    if "certifications" in data:
        result["certifications"] = data["certifications"]
    
    if "personal" in data:
        result["personal"] = data["personal"]
    
    if "preferences" in data:
        result["preferences"] = data["preferences"]
    
    return result


def convert_analysis_to_dict(analysis: Any) -> dict[str, Any]:
    """Convert JobAnalysis object to dictionary."""
    from .models import JobAnalysis
    
    if not isinstance(analysis, JobAnalysis):
        raise TypeError("Expected JobAnalysis object")
    
    return {
        "job": {
            "id": analysis.job.id,
            "title": analysis.job.title,
            "company": analysis.job.company,
            "location": analysis.job.location,
            "description": analysis.job.description,
            "why": analysis.job.why,
            "tags": list(analysis.job.tags),
            "remote": analysis.job.remote,
            "source": analysis.job.source,
            "url": analysis.job.url,
            "subcategory": analysis.job.subcategory,
            "posted": analysis.job.posted,
        },
        "stream": analysis.stream,
        "score": {
            "score": analysis.score.score,
            "fit": analysis.score.fit,
            "dimensions": dict(analysis.score.dimensions),
            "matched_skills": list(analysis.score.matched_skills),
            "missing_skills": list(analysis.score.missing_skills),
            "strengths": list(analysis.score.strengths),
            "risks": list(analysis.score.risks),
            "confidence": analysis.score.confidence,
            "experience_level": analysis.score.experience_level,
            "relevance": analysis.score.relevance,
            "score_breakdown": dict(analysis.score.score_breakdown),
        },
        "fit_category": analysis.fit_category,
    }


def batch_convert_jobs(jobs_data: list[dict[str, Any]]) -> list[JobDict]:
    """Convert a batch of job dictionaries to typed JobDicts."""
    return [convert_to_job_dict(job) for job in jobs_data]


def validate_and_convert_job(data: dict[str, Any]) -> tuple[JobDict, ValidationResult]:
    """Validate and convert job data in one operation."""
    validation = validate_job_data(data)
    job_dict = convert_to_job_dict(data)
    return job_dict, validation


def validate_and_convert_profile(data: dict[str, Any]) -> tuple[ProfileDict, ValidationResult]:
    """Validate and convert profile data in one operation."""
    validation = validate_profile_data(data)
    profile_dict = convert_to_profile_dict(data)
    return profile_dict, validation