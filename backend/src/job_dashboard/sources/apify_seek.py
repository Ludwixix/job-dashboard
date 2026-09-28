from __future__ import annotations

import os
from collections.abc import Iterable, Mapping
from typing import Any
from urllib.parse import urlparse

from ..logging import get_logger
from ..models import JobRecord
from .base import (
    JobSource,
    SearchQuery,
    SeekUnavailableError,
    canonical_posted_date,
    clean_description,
    parse_salary_bracket,
    resolve_search_location,
)

logger = get_logger("job_dashboard.sources.apify_seek")

DEFAULT_SEEK_ACTOR_ID = "automation-lab/seek-scraper"
DEFAULT_MAX_RESULTS = 20
MAX_RESULTS_CAP = 50
DEFAULT_ACTOR_TIMEOUT_SECS = 55


class ApifySeekFallbackSource:
    """Use the Apify SEEK Actor only when the native SEEK adapter is unavailable."""

    name = "Seek"

    def __init__(
        self,
        native_source: JobSource,
        *,
        api_token: str | None = None,
        actor_id: str = DEFAULT_SEEK_ACTOR_ID,
        max_results: int = DEFAULT_MAX_RESULTS,
        timeout_secs: int = DEFAULT_ACTOR_TIMEOUT_SECS,
        fetch_job_details: bool = False,
        client: Any | None = None,
    ):
        self.native_source = native_source
        self.api_token = api_token or os.getenv("APIFY_API_TOKEN") or os.getenv(
            "JOB_DASHBOARD_APIFY_API_TOKEN"
        )
        self.actor_id = actor_id.strip()
        self.max_results = max(1, min(MAX_RESULTS_CAP, int(max_results)))
        self.timeout_secs = max(1, int(timeout_secs))
        self.fetch_job_details = bool(fetch_job_details)
        self.source_timeout = max(75, self.timeout_secs + 20)
        self.client = client

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            native_results = list(self.native_source.search(query))
        except SeekUnavailableError as native_error:
            if not self.api_token or not self.actor_id:
                raise
            logger.info(
                "Native SEEK unavailable; invoking configured Apify fallback "
                f"({type(native_error).__name__})"
            )
        else:
            if native_results:
                return native_results
            return []

        return self._search_apify(query)

    def _get_client(self):
        if self.client is not None:
            return self.client
        if not self.api_token:
            raise SeekUnavailableError("Apify SEEK fallback has no API token")
        from apify_client import ApifyClient

        self.client = ApifyClient(self.api_token)
        return self.client

    def _search_apify(self, query: SearchQuery) -> list[dict[str, Any]]:
        run_input = {
            "keywords": [query.term],
            "location": resolve_search_location(query),
            "maxResults": self.max_results,
            "fetchJobDetails": self.fetch_job_details,
        }
        try:
            client = self._get_client()
            run = client.actor(self.actor_id).call(
                run_input=run_input,
                timeout_secs=self.timeout_secs,
            )
            dataset_id = run.get("defaultDatasetId") if run else None
            if not dataset_id:
                raise SeekUnavailableError("Apify SEEK run returned no dataset")
            items = client.dataset(dataset_id).iterate_items()
            records = [
                record
                for item in items
                if (record := _apify_seek_record(item, query)) is not None
            ]
            logger.info(
                f"Apify SEEK fallback returned {len(records)} records for configured query"
            )
            return records
        except Exception as error:
            logger.warning(f"Apify SEEK fallback failed ({type(error).__name__})")
            raise SeekUnavailableError("Apify SEEK fallback failed") from error


def configure_apify_seek_fallback(
    native_source: JobSource,
    *,
    enabled: bool,
    api_token: str | None,
    actor_id: str = DEFAULT_SEEK_ACTOR_ID,
    max_results: int = DEFAULT_MAX_RESULTS,
    timeout_secs: int = DEFAULT_ACTOR_TIMEOUT_SECS,
    fetch_job_details: bool = False,
) -> JobSource:
    """Wrap native SEEK only when the paid fallback is explicitly enabled and configured."""
    if not enabled or not api_token:
        return native_source
    return ApifySeekFallbackSource(
        native_source,
        api_token=api_token,
        actor_id=actor_id,
        max_results=max_results,
        timeout_secs=timeout_secs,
        fetch_job_details=fetch_job_details,
    )


def _apify_seek_record(
    item: Mapping[str, Any], query: SearchQuery
) -> dict[str, Any] | None:
    title = str(item.get("title") or "").strip()
    company = str(item.get("company") or item.get("advertiserName") or "").strip()
    url = str(item.get("url") or "").strip()
    job_id = str(item.get("id") or "").strip()
    if not url and job_id:
        url = f"https://www.seek.com.au/job/{job_id}"
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    is_seek_domain = hostname == "seek.com.au" or hostname.endswith(".seek.com.au")
    if not title or not company or not job_id or not is_seek_domain:
        return None

    location = str(item.get("location") or query.location or "Australia").strip()
    work_type = str(item.get("workType") or "").strip()
    remote = any(
        marker in f"{title} {location} {work_type}".lower()
        for marker in ("remote", "work from home", " wfh")
    )
    description = clean_description(
        item.get("fullDescription")
        or item.get("shortDescription")
        or item.get("description")
    )
    salary_text = str(item.get("salary") or "").strip()
    salary = parse_salary_bracket(salary_text=salary_text or None, currency="AUD")
    if not salary.raw_text and salary.min_amount is None and salary.max_amount is None:
        salary = None

    record = JobRecord(
        id=f"seek-{job_id}",
        provider_job_id=job_id,
        provider="seek",
        title=title,
        company=company,
        location=location,
        work_mode="remote" if remote else "unknown",
        url=url,
        raw_description=description,
        key_requirements=[query.term, query.stream],
        salary=salary,
        posted=canonical_posted_date(str(item.get("listingDate") or ""))
        or str(item.get("listingDate") or "").strip()
        or None,
        remote=remote,
    )
    return {**record.to_dict(), "scraper_backend": "apify"}