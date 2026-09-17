"""Jobs router for listing, searching, description enrichment, and URL verification."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..repository import JobRepository
from ..verifier import verify_job_url

router = APIRouter(tags=["Jobs"])


def get_repo(request: Request) -> JobRepository:
    return request.app.state.repository


class BatchVerifyRequest(BaseModel):
    urls: List[str]


@router.get("/api/jobs")
async def get_jobs(
    q: Optional[str] = Query(default=None, description="Search query string"),
    source: Optional[str] = Query(default=None, description="Filter by source"),
    location: Optional[str] = Query(default=None, description="Filter by location"),
    status: Optional[str] = Query(default=None, description="Filter by application status"),
    min_score: int = Query(default=0, ge=0, le=100, description="Minimum match score"),
    page: int = Query(default=1, ge=1, description="Page number"),
    pageSize: int = Query(default=50, ge=1, le=500, description="Items per page"),
    page_size: Optional[int] = Query(default=None, ge=1, le=500, description="Alias for pageSize"),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Retrieve filtered and paginated job opportunities."""
    effective_page_size = page_size or pageSize
    jobs = repo.list_jobs(
        role=q or "",
        source=source or "",
        location=location or "",
        status=status or "",
        match_score_min=min_score,
    )
    total = len(jobs)
    offset = (page - 1) * effective_page_size
    paginated = jobs[offset : offset + effective_page_size]

    return {
        "jobs": paginated,
        "total": total,
        "page": page,
        "pageSize": effective_page_size,
        "totalPages": max(1, (total + effective_page_size - 1) // effective_page_size),
    }


@router.get("/api/scraped-jobs")
async def get_scraped_jobs(repo: JobRepository = Depends(get_repo)) -> Dict[str, Any]:
    """Retrieve full cached dataset of indexed opportunities."""
    jobs = repo.list_jobs()
    return {"success": True, "count": len(jobs), "jobs": jobs}


@router.get("/api/job-description")
async def get_job_description(
    job_id: Optional[str] = Query(default=None),
    url: Optional[str] = Query(default=None),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Fetch stored full description for a job listing."""
    job = None
    if job_id:
        job = repo.get_job(job_id)
    if not job and url:
        jobs = repo.list_jobs()
        job = next(
            (j for j in jobs if j.get("portalLink") == url or j.get("url") == url or j.get("link") == url),
            None,
        )

    description = ""
    if job:
        description = job.get("description") or job.get("notes") or ""

    return {
        "success": True,
        "job_id": job_id or (job.get("id") if job else None),
        "description": description,
        "cached": bool(description),
        "length": len(description),
    }


@router.get("/api/verify-job-url")
async def verify_url(
    url: str = Query(..., description="Job ad URL to verify"),
    force: bool = Query(default=False, description="Bypass cache check"),
) -> Dict[str, Any]:
    """Verify whether external job URL is active or has expired/been taken down."""
    result = verify_job_url(url, force=force)
    return result


@router.post("/api/verify-jobs")
async def verify_batch_jobs(payload: BatchVerifyRequest) -> Dict[str, Any]:
    """Verify batch of external job URLs."""
    results = [verify_job_url(u) for u in payload.urls[:20]]
    return {
        "success": True,
        "total": len(results),
        "results": results,
    }

