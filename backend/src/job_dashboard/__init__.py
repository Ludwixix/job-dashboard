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
    ScrapePipeline,
    SearchQuery,
    SeekApiSource,
)

from .api import ApiGateway

__all__ = [
    "AdzunaApiSource",
    "ApiGateway",
    "ApplicationRecord",
    "IndeedJobSpySource",
    "Job",
    "JobAnalysis",
    "JobDashboard",
    "LinkedInBrowserSource",
    "OpenRouterDocumentGenerator",
    "RemoteOkApiSource",
    "ScoreResult",
    "ScrapePipeline",
    "SearchQuery",
    "SeekApiSource",
    "classify_job",
    "classify_jobs",
    "normalize_job",
    "score_job",
]
