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
        return JobAnalysis(job, classify_job(job), score_job(job, self.profile))

    def analyse_many(self, raw_jobs: list[Mapping[str, Any]]) -> list[JobAnalysis]:
        return [self.analyse(job) for job in raw_jobs]
