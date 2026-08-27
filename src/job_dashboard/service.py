from collections.abc import Mapping
from typing import Any

from .classify import classify_job
from .models import JobAnalysis
from .normalize import normalize_job
from .score import score_job


class JobDashboard:
    """Application service that composes independent job-domain functions."""

    def __init__(self, profile: Mapping[str, Any]):
        self.profile = profile

    def analyse(self, raw_job: Mapping[str, Any]) -> JobAnalysis:
        job = normalize_job(raw_job)
        score = score_job(job, self.profile)
        fit_category = "no-skill-match" if not score.matched_skills else (
            "excellent-fit" if score.score >= 85 else
            "strong-fit" if score.score >= 70 else
            "good-fit" if score.score >= 55 else
            "partial-fit" if score.score >= 40 else "weak-fit"
        )
        return JobAnalysis(job, classify_job(job), score, fit_category)

    def analyse_many(self, raw_jobs: list[Mapping[str, Any]]) -> list[JobAnalysis]:
        return [self.analyse(job) for job in raw_jobs]
