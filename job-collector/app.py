from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from collector import CostTieredCollector
from database import cached_jobs, init_db, session_factory
from fastapi import FastAPI, Query
from models import (
    CachedJobsResponse,
    HealthResponse,
    JobSearchRequest,
    JobSearchResponse,
)
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
collector = CostTieredCollector()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Cost-Tiered Job Aggregator", version="1.0.0", lifespan=lifespan)


@app.post("/api/jobs/search", response_model=JobSearchResponse)
@app.post("/api/v1/jobs/search", response_model=JobSearchResponse)
async def search_jobs(request: JobSearchRequest) -> JobSearchResponse:
    """Execute live cascade scraping across SEEK and Indeed with multi-tier failover."""
    jobs, breakdown, new_stored = await collector.search(
        request.query, request.location, request.limit, request.force_tier
    )
    return JobSearchResponse(
        total_found=len(jobs),
        new_jobs_stored=new_stored,
        tier_breakdown=breakdown,
        jobs=jobs,
    )


@app.get("/api/jobs", response_model=CachedJobsResponse)
@app.get("/api/v1/jobs", response_model=CachedJobsResponse)
async def get_jobs(
    query: str | None = None,
    location: str | None = None,
    source: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> CachedJobsResponse:
    """Return cached job listings from SQLite with filtering and pagination."""
    async with session_factory() as session:
        jobs, total = await cached_jobs(session, query, location, source, limit, offset)
    return CachedJobsResponse(total=total, jobs=jobs)


@app.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    """Health check for service and database."""
    async with session_factory() as session:
        await session.execute(text("SELECT 1"))
    return HealthResponse(status="ok", database=True)

