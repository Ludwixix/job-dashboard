from dataclasses import dataclass, field
from typing import Any


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
