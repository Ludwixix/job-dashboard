import hashlib
import json
from collections.abc import Mapping
from typing import Any

from .models import Job
from .types import NormalizationError, validate_job_data
from .utils import convert_to_job_dict


def normalize_job(raw: Mapping[str, Any]) -> Job:
    """Convert a source listing into the stable internal job contract."""
    try:
        # Convert to typed dictionary first
        job_dict = convert_to_job_dict(dict(raw))
        
        # Validate the data
        validation = validate_job_data(job_dict)
        if not validation.is_valid:
            raise NormalizationError(
                f"Job data validation failed: {', '.join(validation.errors)}",
                {"errors": validation.errors, "warnings": validation.warnings}
            )
        
        title = job_dict["title"]
        company = job_dict["company"]
        location = job_dict.get("location", "")
        
        # Process tags
        tags = job_dict.get("tags") or ()
        if isinstance(tags, str):
            tags = (tags,)
        elif tags:
            tags = tuple(str(tag).strip() for tag in tags if str(tag).strip())
        
        # Generate or use provided ID
        source_id = job_dict.get("id")
        if source_id:
            job_id = str(source_id)
        else:
            identity = json.dumps([title, company, location, job_dict.get("url", "")], sort_keys=True)
            job_id = hashlib.sha256(identity.encode()).hexdigest()[:16]
        
        return Job(
            id=job_id,
            title=title,
            company=company,
            location=location,
            description=job_dict.get("description", ""),
            why=job_dict.get("why", ""),
            tags=tags,
            remote=job_dict.get("remote", False),
            source=job_dict.get("source", ""),
            url=job_dict.get("url", ""),
            subcategory=job_dict.get("subcategory", ""),
            posted=job_dict.get("posted", ""),
        )
    except KeyError as e:
        raise NormalizationError(f"Missing required field: {e}", {"field": str(e)}) from e
    except (TypeError, ValueError) as e:
        raise NormalizationError(f"Type conversion error: {e}", {"error": str(e)}) from e
    except Exception as e:
        raise NormalizationError(f"Unexpected error during normalization: {e}", {"error": str(e)}) from e


def normalize_jobs(raw_jobs: list[Mapping[str, Any]]) -> list[Job]:
    """Normalize a batch of jobs with error handling for each job."""
    jobs = []
    errors = []
    
    for i, raw in enumerate(raw_jobs):
        try:
            job = normalize_job(raw)
            jobs.append(job)
        except NormalizationError as e:
            errors.append({
                "index": i,
                "error": e.message,
                "details": e.details
            })
    
    if errors and not jobs:
        # If all jobs failed, raise a comprehensive error
        raise NormalizationError(
            f"All {len(errors)} jobs failed normalization",
            {"errors": errors}
        )
    
    return jobs


def validate_job_normalization(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Validate job data without normalizing it."""
    try:
        job_dict = convert_to_job_dict(dict(raw))
        validation = validate_job_data(job_dict)
        
        # Generate preview ID
        title = job_dict["title"]
        company = job_dict["company"]
        location = job_dict.get("location", "")
        identity = json.dumps([title, company, location, job_dict.get("url", "")], sort_keys=True)
        preview_id = hashlib.sha256(identity.encode()).hexdigest()[:16]
        
        return {
            "is_valid": validation.is_valid,
            "errors": validation.errors,
            "warnings": validation.warnings,
            "preview_id": preview_id,
            "normalized_fields": {
                "title": title,
                "company": company,
                "location": location,
                "description_length": len(job_dict.get("description", "")),
                "tags_count": len(job_dict.get("tags", [])),
                "has_url": bool(job_dict.get("url")),
            }
        }
    except Exception as e:
        return {
            "is_valid": False,
            "errors": [f"Validation failed: {e!s}"],
            "warnings": [],
            "preview_id": None,
            "normalized_fields": None
        }
