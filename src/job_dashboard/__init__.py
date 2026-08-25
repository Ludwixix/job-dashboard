"""Reusable job dashboard domain and application services."""

from .classify import classify_job, classify_jobs
from .llm import OpenRouterDocumentGenerator
from .models import ApplicationRecord, Job, JobAnalysis, ScoreResult
from .normalize import normalize_job
from .score import score_job
from .service import JobDashboard
from .sources import (
    AdzunaApiSource,
    IndeedJobSpySource,
    LinkedInBrowserSource,
    RemoteOkApiSource,
    SearchQuery,
    ScrapePipeline,
    SeekApiSource,
)

__all__ = [
    "ApplicationRecord",
    "Job",
    "JobAnalysis",
    "JobDashboard",
    "OpenRouterDocumentGenerator",
    "AdzunaApiSource",
    "IndeedJobSpySource",
    "LinkedInBrowserSource",
    "RemoteOkApiSource",
    "SearchQuery",
    "ScrapePipeline",
    "SeekApiSource",
    "ScoreResult",
    "classify_job",
    "classify_jobs",
    "normalize_job",
    "score_job",
]
