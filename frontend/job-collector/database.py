from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path

from models import Base, JobRecord, StandardJob, utc_now
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////data/jobs.db")

# Automatically ensure parent directory exists for SQLite files
if "sqlite" in DATABASE_URL:
    if ":////" in DATABASE_URL:
        db_file_path = DATABASE_URL.split(":////")[-1]
        Path(db_file_path).parent.mkdir(parents=True, exist_ok=True)
    elif ":///" in DATABASE_URL:
        db_file_path = DATABASE_URL.split(":///")[-1]
        Path(db_file_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Initialize database schema by creating all registered tables."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def upsert_job(session: AsyncSession, job: StandardJob) -> tuple[StandardJob, bool]:
    """
    Async upsert for a single job posting.
    Inserts a new posting or updates `last_seen_at` and fresh metadata if already scraped.
    Returns (job, is_new).
    """
    now = utc_now()
    item = job.with_identity()
    record = await session.get(JobRecord, item.id)
    is_new = False
    
    if record is None:
        record = JobRecord(
            id=item.id,
            title=item.title,
            company=item.company,
            location=item.location,
            source=item.source.value if hasattr(item.source, "value") else str(item.source),
            url=item.url,
            salary=item.salary,
            description=item.description,
            date_posted=item.date_posted,
            tier_retrieved=item.tier_retrieved,
            first_seen_at=item.first_seen_at or now,
            last_seen_at=now,
        )
        session.add(record)
        is_new = True
    else:
        record.last_seen_at = now
        record.tier_retrieved = item.tier_retrieved
        # Update URL policy: refresh with incoming URL if non-empty
        if item.url:
            record.url = item.url
        if item.salary:
            record.salary = item.salary
        if item.description:
            record.description = item.description
        if item.date_posted and not record.date_posted:
            record.date_posted = item.date_posted

    await session.commit()
    return item.model_copy(update={"is_new": is_new, "last_seen_at": now}), is_new


async def upsert_jobs(session: AsyncSession, jobs: Sequence[StandardJob]) -> tuple[list[StandardJob], int]:
    """
    Async batch upsert matching database session patterns.
    Inserts new postings or updates `last_seen_at` and fresh metadata if already scraped.
    Returns (list of newly stored StandardJobs, count of fresh jobs).
    """
    now = utc_now()
    fresh: list[StandardJob] = []
    for schema in jobs:
        item = schema.with_identity()
        record = await session.get(JobRecord, item.id)
        if record is None:
            record = JobRecord(
                id=item.id,
                title=item.title,
                company=item.company,
                location=item.location,
                source=item.source.value if hasattr(item.source, "value") else str(item.source),
                url=item.url,
                salary=item.salary,
                description=item.description,
                date_posted=item.date_posted,
                tier_retrieved=item.tier_retrieved,
                first_seen_at=item.first_seen_at or now,
                last_seen_at=now,
            )
            session.add(record)
            fresh.append(item.model_copy(update={"is_new": True, "last_seen_at": now}))
        else:
            record.last_seen_at = now
            record.tier_retrieved = item.tier_retrieved
            # Update URL policy: refresh with incoming URL if non-empty
            if item.url:
                record.url = item.url
            if item.salary:
                record.salary = item.salary
            if item.description:
                record.description = item.description
            if item.date_posted and not record.date_posted:
                record.date_posted = item.date_posted

    await session.commit()
    return fresh, len(fresh)


async def cached_jobs(
    session: AsyncSession,
    query: str | None,
    location: str | None,
    source: str | None,
    limit: int,
    offset: int,
) -> tuple[list[StandardJob], int]:
    """Retrieve paginated jobs from SQLite cache ordered by most recently seen."""
    filters = []
    if query:
        pattern = f"%{query.lower()}%"
        filters.append(
            or_(
                func.lower(JobRecord.title).like(pattern),
                func.lower(JobRecord.company).like(pattern),
                func.lower(JobRecord.description).like(pattern),
            )
        )
    if location:
        filters.append(func.lower(JobRecord.location).like(f"%{location.lower()}%"))
    if source:
        filters.append(func.lower(JobRecord.source) == source.lower())

    condition = filters or [True]
    total = int(
        (await session.scalar(select(func.count()).select_from(JobRecord).where(*condition)))
        or 0
    )
    rows = (
        await session.scalars(
            select(JobRecord)
            .where(*condition)
            .order_by(JobRecord.last_seen_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return [row.to_schema() for row in rows], total

