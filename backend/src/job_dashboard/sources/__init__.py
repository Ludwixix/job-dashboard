"""Multi-provider job scraping adapters, deduplication, and ingestion pipeline."""
from __future__ import annotations

import sys
import urllib
import urllib.parse
import urllib.request

sys.modules["job_dashboard.sources.urllib"] = urllib
sys.modules["job_dashboard.sources.urllib.request"] = urllib.request
sys.modules["job_dashboard.sources.urllib.parse"] = urllib.parse

from .adzuna import AdzunaApiSource, _adzuna_record
from .base import (
    JobSource,
    ScrapePipeline,
    SearchQuery,
    SeekUnavailableError,
    _TextExtractor,
    _page_description,
    canonical_posted_date,
    clean_description,
    ensure_descriptions,
    is_recent,
    normalize_posted_date,
    posted_age,
)
from .dedup import (
    _clean_job_url,
    _normalize_company_name,
    _normalize_job_title,
    deduplicate_jobs,
)
from .indeed import IndeedJobSpySource, _extract_balanced_json, _indeed_record
from .linkedin import LinkedInBrowserSource, _linkedin_description
from .remoteok import RemoteOkApiSource, _remoteok_record
from .seek import SeekApiSource, _seek_record

__all__ = [
    "SearchQuery",
    "JobSource",
    "SeekUnavailableError",
    "ScrapePipeline",
    "clean_description",
    "is_recent",
    "normalize_posted_date",
    "canonical_posted_date",
    "posted_age",
    "ensure_descriptions",
    "deduplicate_jobs",
    "IndeedJobSpySource",
    "AdzunaApiSource",
    "RemoteOkApiSource",
    "SeekApiSource",
    "LinkedInBrowserSource",
    # Internal utilities preserved for backward-compatibility & test coverage
    "_TextExtractor",
    "_page_description",
    "_clean_job_url",
    "_normalize_company_name",
    "_normalize_job_title",
    "_extract_balanced_json",
    "_indeed_record",
    "_adzuna_record",
    "_remoteok_record",
    "_seek_record",
    "_linkedin_description",
]
