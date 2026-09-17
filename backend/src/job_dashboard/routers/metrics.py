"""Metrics, health, and OpenAPI specification router."""

from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, Request

from ..openapi import generate_openapi_spec
from ..repository import JobRepository

router = APIRouter(tags=["Metrics & Health"])


def get_repo(request: Request) -> JobRepository:
    return request.app.state.repository


@router.get("/health")
@router.get("/api/health")
async def get_health(repo: JobRepository = Depends(get_repo)) -> Dict[str, Any]:
    """Health check endpoint probe."""
    try:
        jobs_count = repo.count_jobs()
        db_healthy = True
    except Exception:
        jobs_count = 0
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "degraded",
        "timestamp": time.time(),
        "version": "3.0.0",
        "services": {
            "database": db_healthy,
            "cache": True,
            "jobs_count": jobs_count,
        },
    }


@router.get("/api/metrics/summary")
@router.get("/api/stats")
async def get_metrics_summary(repo: JobRepository = Depends(get_repo)) -> Dict[str, Any]:
    """Summary of indexed jobs, applications, and ingestion velocity."""
    metrics = repo.metrics()
    return metrics


@router.get("/api/metrics/hourly")
async def get_metrics_hourly(
    hours: int = Query(default=24, ge=1, le=168),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Hourly ingestion velocity breakdown."""
    stats = repo.hourly_metrics(hours=hours)
    return {"success": True, **stats}


@router.get("/api/openapi.json")
async def get_openapi() -> Dict[str, Any]:
    """Serve full OpenAPI 3.1.0 specification schema."""
    return generate_openapi_spec()

