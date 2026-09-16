from dataclasses import dataclass, field
from typing import Any, Optional, List, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class SalaryBracket(BaseModel):
    raw_text: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    currency: str = "AUD"
    is_hourly: bool = False
    estimated: bool = False


class JobRecord(BaseModel):
    id: Optional[str] = None
    provider_job_id: str
    provider: Literal["seek", "indeed", "adzuna", "remoteok", "manual"]
    title: str
    company: str
    location: str
    work_mode: Literal["remote", "hybrid", "onsite", "unknown"] = "unknown"
    url: str
    raw_description: str
    key_requirements: List[str] = Field(default_factory=list)
    salary: Optional[SalaryBracket] = None
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    posted: Optional[str] = None
    remote: Optional[bool] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert JobRecord to dictionary format compatible with scoring and repository layers."""
        job_id = self.id or f"{self.provider}_{self.provider_job_id}"
        source_map = {
            "seek": "Seek",
            "indeed": "Indeed",
            "adzuna": "Adzuna",
            "remoteok": "RemoteOK",
            "manual": "Manual",
        }
        is_remote_detected = (
            self.remote if self.remote is not None else (
                self.work_mode in ("remote", "hybrid")
                or "remote" in f"{self.title} {self.location}".lower()
                or "wfh" in f"{self.title} {self.location}".lower()
                or "work from home" in f"{self.title} {self.location}".lower()
            )
        )
        return {
            "id": job_id,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "description": self.raw_description,
            "source": source_map.get(self.provider, self.provider),
            "url": self.url,
            "remote": bool(is_remote_detected),
            "salary": self.salary.raw_text if self.salary and self.salary.raw_text else "",
            "salary_min": self.salary.min_amount if self.salary else None,
            "salary_max": self.salary.max_amount if self.salary else None,
            "salary_bracket": self.salary.model_dump() if self.salary else None,
            "salary_estimated": self.salary.estimated if self.salary else False,
            "key_requirements": self.key_requirements,
            "tags": list(self.key_requirements) + [self.provider] + (["remote"] if is_remote_detected else []),
            "application_route": self.url,
            "posted": self.posted or self.scraped_at.isoformat(),
        }

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.to_dict().get(key, default)

    def __contains__(self, key: str) -> bool:
        return key in self.to_dict()

    def __iter__(self):
        return iter(self.to_dict().items())

    def keys(self):
        return self.to_dict().keys()

    def values(self):
        return self.to_dict().values()

    def items(self):
        return self.to_dict().items()




@dataclass(frozen=True)
class Job:
    id: str
    title: str
    company: str
    location: str = ""
    description: str = ""
    why: str = ""
    tags: tuple[str, ...] = ()
    remote: bool = False
    source: str = ""
    url: str = ""
    subcategory: str = ""
    posted: str = ""

    def text(self) -> str:
        return " ".join((self.title, self.company, self.location, self.description, self.why, *self.tags))


@dataclass(frozen=True)
class ScoreResult:
    score: int
    fit: str
    dimensions: dict[str, int]
    matched_skills: tuple[str, ...] = ()
    missing_skills: tuple[str, ...] = ()
    strengths: tuple[str, ...] = ()
    risks: tuple[str, ...] = ()
    confidence: float = 0.0
    experience_level: str = "mid"
    relevance: str = "Strong"
    score_breakdown: dict[str, int] = field(default_factory=dict)
    semantic_score: float | None = None
    rule_score: int | None = None


@dataclass(frozen=True)
class JobAnalysis:
    job: Job
    stream: str
    score: ScoreResult
    fit_category: str = "weak-fit"


@dataclass
class ApplicationRecord:
    application_id: str
    company: str
    title: str
    location: str = ""
    application_url: str = ""
    resume: str = ""
    cover: str = ""
    why: str = ""
    audit: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "application_id": self.application_id,
            "company": self.company,
            "title": self.title,
            "location": self.location,
            "application_url": self.application_url,
            "resume": self.resume,
            "cover": self.cover,
            "why": self.why,
            "audit": self.audit,
        }
