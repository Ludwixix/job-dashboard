from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    """Return current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)


class JobSource(str, Enum):
    SEEK = "SEEK"
    INDEED = "INDEED"
    GOOGLE_JOBS = "GOOGLE_JOBS"


def job_id(company: str, title: str, location: str, algorithm: Literal["sha256", "md5"] = "sha256") -> str:
    """
    Generate a deterministic hash ID from company + title + location.
    Defaults to SHA256 (64 hex characters) or MD5 (32 hex characters).
    """
    normalized = "|".join((company.strip().lower(), title.strip().lower(), location.strip().lower()))
    raw_bytes = normalized.encode("utf-8")
    if algorithm == "md5":
        return hashlib.md5(raw_bytes).hexdigest()
    return hashlib.sha256(raw_bytes).hexdigest()


# Alias for clarity
generate_job_id = job_id


class StandardJob(BaseModel):
    """Normalized job posting schema compatible with the dashboard contract."""
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    title: str
    company: str
    location: str
    source: JobSource | str
    url: str
    salary: str | None = None
    description: str | None = None
    date_posted: datetime | None = None
    tier_retrieved: int = Field(ge=1, le=3)
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    is_new: bool = False

    def with_identity(self) -> StandardJob:
        now = utc_now()
        resolved_source = self.source.value if isinstance(self.source, JobSource) else str(self.source)
        return self.model_copy(
            update={
                "id": self.id or job_id(self.company, self.title, self.location),
                "source": resolved_source,
                "first_seen_at": self.first_seen_at or now,
                "last_seen_at": self.last_seen_at or now,
            }
        )


class Base(DeclarativeBase):
    """Declarative base for SQLAlchemy ORM models."""


class JobRecord(Base):
    """SQLAlchemy ORM table mapping for persistent scraped jobs."""
    __tablename__ = "job_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    salary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_posted: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    tier_retrieved: Mapped[int] = mapped_column(Integer, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    def to_schema(self, is_new: bool = False) -> StandardJob:
        return StandardJob(
            id=self.id,
            title=self.title,
            company=self.company,
            location=self.location,
            source=self.source,
            url=self.url,
            salary=self.salary,
            description=self.description,
            date_posted=self.date_posted,
            tier_retrieved=self.tier_retrieved,
            first_seen_at=self.first_seen_at,
            last_seen_at=self.last_seen_at,
            is_new=is_new,
        )


class JobSearchRequest(BaseModel):
    """Search request parameters for cost-tiered job scraping."""
    query: str = Field(min_length=1, max_length=300)
    location: str = Field(default="Melbourne", max_length=200)
    limit: int = Field(default=25, ge=1, le=100)
    force_tier: int | None = Field(default=None, ge=1, le=3)


# Compatibility alias
SearchRequest = JobSearchRequest


class JobSearchResponse(BaseModel):
    """Aggregated response contract returning search results and tier metrics."""
    total_found: int
    new_jobs_stored: int
    tier_breakdown: dict[str, int] = Field(default_factory=dict)
    jobs: list[StandardJob] = Field(default_factory=list)


# Compatibility alias
SearchResponse = JobSearchResponse


class CachedJobsResponse(BaseModel):
    """Paginated listing of cached jobs from the database."""
    total: int
    jobs: list[StandardJob] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Collector health status."""
    status: str
    database: bool

