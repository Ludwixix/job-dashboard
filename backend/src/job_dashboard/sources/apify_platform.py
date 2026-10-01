"""Unified multi-platform Apify scraping adapter.

Supports Seek, Indeed, LinkedIn, Adzuna, and custom Apify actors
as primary scrapers or resilient fallbacks when native scraping fails.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterable, Mapping
from typing import Any
from urllib.parse import urlparse

import requests

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

logger = get_logger("job_dashboard.sources.apify_platform")

DEFAULT_APIFY_ACTORS: dict[str, str] = {
    "seek": "automation-lab/seek-scraper",
    "indeed": "misceres/indeed-scraper",
    "linkedin": "curious_coder/linkedin-job-search-scraper",
    "adzuna": "apify/web-scraper",
}

DEFAULT_MAX_RESULTS = 20
MAX_RESULTS_CAP = 50
DEFAULT_TIMEOUT_SECS = 60


def test_apify_token(api_token: str) -> dict[str, Any]:
    """Validate an Apify API token against the official Apify user profile endpoint."""
    if not api_token or not str(api_token).strip():
        return {"success": False, "error": "API token is required"}
    token = str(api_token).strip()
    try:
        resp = requests.get(
            "https://api.apify.com/v2/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return {
                "success": True,
                "username": data.get("username", "Apify User"),
                "id": data.get("id"),
                "plan": data.get("plan", {}).get("name", "Active"),
            }
        else:
            error_msg = "Invalid API token or unauthorized"
            try:
                err_data = resp.json().get("error", {})
                error_msg = err_data.get("message", error_msg)
            except Exception:
                pass
            return {"success": False, "error": error_msg}
    except Exception as e:
        return {"success": False, "error": str(e)}


def sanitize_apify_actor_id(raw_actor: str | None) -> str:
    """Normalize actor identifier by removing URL prefixes or 'actors/' namespace."""
    if not raw_actor:
        return ""
    cleaned = str(raw_actor).strip()
    if "apify.com/actors/" in cleaned:
        cleaned = cleaned.split("apify.com/actors/")[-1].split("/")[0].split("?")[0]
    elif cleaned.startswith("actors/"):
        cleaned = cleaned[len("actors/") :]
    return cleaned.strip()


def build_apify_run_input(
    platform: str, query: SearchQuery, max_results: int, location: str | None = None
) -> dict[str, Any]:
    """Construct platform-specific or generic actor input payload."""
    loc = location or resolve_search_location(query) or "Australia"
    term = query.term
    plat = platform.lower()

    if plat == "seek":
        return {
            "keywords": [term],
            "searchTerm": term,
            "query": term,
            "keyword": term,
            "location": loc,
            "maxResults": max_results,
            "fetchJobDetails": True,
        }
    elif plat == "indeed":
        return {
            "position": term,
            "location": loc,
            "maxItems": max_results,
            "maxResults": max_results,
            "country": "AU",
            "queries": [term],
        }
    elif plat == "linkedin":
        return {
            "keywords": term,
            "location": loc,
            "count": max_results,
            "limit": max_results,
            "searchQueries": [{"keyword": term, "location": loc}],
        }
    else:
        # Flexible generic payload that works with most Apify job search actors
        return {
            "query": term,
            "keyword": term,
            "keywords": [term],
            "position": term,
            "location": loc,
            "country": "AU",
            "maxItems": max_results,
            "maxResults": max_results,
            "count": max_results,
            "limit": max_results,
        }


def normalize_apify_job_record(
    item: Mapping[str, Any], platform: str, query: SearchQuery
) -> dict[str, Any] | None:
    """Normalize a raw Apify dataset item into a canonical JobRecord dictionary."""
    plat = platform.lower()
    title = str(
        item.get("title")
        or item.get("positionName")
        or item.get("jobTitle")
        or item.get("job_title")
        or item.get("position")
        or ""
    ).strip()

    raw_company = (
        item.get("company")
        or item.get("companyName")
        or item.get("advertiserName")
        or (
            item.get("advertiser", {}).get("name")
            if isinstance(item.get("advertiser"), dict)
            else item.get("advertiser")
        )
        or (
            item.get("companyProfile", {}).get("name")
            if isinstance(item.get("companyProfile"), dict)
            else ""
        )
        or item.get("employer")
        or ""
    )
    if not raw_company and isinstance(item.get("hiringOrganization"), dict):
        raw_company = item.get("hiringOrganization", {}).get("name") or ""
    elif not raw_company and isinstance(item.get("hiringOrganization"), str):
        raw_company = item.get("hiringOrganization")
    company = str(raw_company).strip()
    if company.lower() == "n/a":
        company = ""

    if not title or not company:
        return None

    url = str(
        item.get("url")
        or item.get("jobLink")
        or item.get("jobUrl")
        or item.get("link")
        or item.get("job_url")
        or item.get("applyUrl")
        or ""
    ).strip()

    raw_job_id = str(
        item.get("id")
        or item.get("jobId")
        or item.get("job_id")
        or item.get("seekJobId")
        or item.get("jobKey")
        or item.get("job_key")
        or ""
    ).strip()

    if not url and raw_job_id:
        if plat == "seek":
            url = f"https://www.seek.com.au/job/{raw_job_id}"
        elif plat == "indeed":
            url = f"https://au.indeed.com/viewjob?jk={raw_job_id}"
        elif plat == "linkedin":
            url = f"https://www.linkedin.com/jobs/view/{raw_job_id}"

    if not raw_job_id and url:
        raw_job_id = str(abs(hash(url)))
    if not raw_job_id:
        raw_job_id = str(abs(hash(f"{company}_{title}")))

    location = str(
        item.get("location")
        or (
            item.get("joblocationInfo", {}).get("displayLocation")
            if isinstance(item.get("joblocationInfo"), dict)
            else ""
        )
        or (
            item.get("joblocationInfo", {}).get("location")
            if isinstance(item.get("joblocationInfo"), dict)
            else ""
        )
        or item.get("jobLocation")
        or item.get("place")
        or item.get("formattedLocation")
        or query.location
        or "Australia"
    ).strip()

    work_type = str(
        item.get("workType")
        or item.get("employmentType")
        or item.get("workTypes")
        or ""
    ).strip()
    remote = any(
        marker in f"{title} {location} {work_type}".lower()
        for marker in ("remote", "work from home", " wfh", "hybrid")
    )

    desc_raw = (
        item.get("fullDescription")
        or (
            item.get("content", {}).get("unEditedContent")
            if isinstance(item.get("content"), dict)
            else ""
        )
        or (
            item.get("content", {}).get("jobHook")
            if isinstance(item.get("content"), dict)
            else ""
        )
        or item.get("description")
        or item.get("snippet")
        or item.get("teaser")
        or item.get("jobDescription")
        or ""
    )
    description = clean_description(desc_raw)

    salary_raw = str(
        item.get("salary")
        or item.get("salaryText")
        or item.get("salaryRange")
        or item.get("remuneration")
        or ""
    ).strip()
    salary = parse_salary_bracket(salary_text=salary_raw or None, currency="AUD")
    if not salary.raw_text and salary.min_amount is None and salary.max_amount is None:
        salary = None

    posted_raw = str(
        item.get("listedAt")
        or item.get("listingDate")
        or item.get("postedDate")
        or item.get("postedAt")
        or item.get("date")
        or item.get("datePosted")
        or ""
    ).strip()
    posted = canonical_posted_date(posted_raw) or posted_raw or None

    source_name = {
        "seek": "Seek",
        "indeed": "Indeed",
        "linkedin": "LinkedIn",
        "adzuna": "Adzuna",
    }.get(plat, plat.capitalize())

    valid_provider = (
        plat
        if plat in ("seek", "indeed", "adzuna", "remoteok", "linkedin")
        else "manual"
    )
    record = JobRecord(
        id=f"{plat}-{raw_job_id}",
        provider_job_id=raw_job_id,
        provider=valid_provider,
        title=title,
        company=company,
        location=location,
        work_mode="remote" if remote else "unknown",
        url=url,
        raw_description=description,
        key_requirements=[query.term, query.stream],
        salary=salary,
        posted=posted,
        remote=remote,
    )
    res = record.to_dict()
    res["source"] = source_name
    res["scraper_backend"] = "apify"
    res["work_mode"] = record.work_mode
    return res


class ApifyPlatformSource:
    """Unified Apify scraper supporting primary or fallback modes for any job portal."""

    def __init__(
        self,
        platform: str,
        *,
        api_token: str | None = None,
        actor_id: str | None = None,
        max_results: int = DEFAULT_MAX_RESULTS,
        timeout_secs: int = DEFAULT_TIMEOUT_SECS,
        mode: str = "primary",  # "primary" or "fallback"
        native_source: JobSource | None = None,
        client: Any | None = None,
    ):
        self.platform = platform.lower().strip()
        self.name = {
            "seek": "Seek",
            "indeed": "Indeed",
            "linkedin": "LinkedIn",
            "adzuna": "Adzuna",
        }.get(self.platform, self.platform.capitalize())

        self.api_token = (
            api_token
            or os.getenv("APIFY_API_TOKEN")
            or os.getenv("JOB_DASHBOARD_APIFY_API_TOKEN")
        )
        raw_actor = actor_id or DEFAULT_APIFY_ACTORS.get(
            self.platform, "apify/web-scraper"
        )
        self.actor_id = sanitize_apify_actor_id(raw_actor)
        self.max_results = max(1, min(MAX_RESULTS_CAP, int(max_results)))
        self.timeout_secs = max(5, int(timeout_secs))
        self.mode = mode.lower().strip()
        self.native_source = native_source
        self.client = client
        self.source_timeout = max(75, self.timeout_secs + 20)

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Execute job search via Apify (or native source depending on mode)."""
        # Case A: Fallback mode -> Try native first
        if self.mode == "fallback" and self.native_source:
            try:
                native_results = list(self.native_source.search(query))
                if native_results:
                    return native_results
            except Exception as native_err:
                if not self.api_token:
                    logger.warning(
                        f"Native {self.name} failed ({type(native_err).__name__}) "
                        "and Apify API token is not configured."
                    )
                    raise
                logger.info(
                    f"Native {self.name} failed ({type(native_err).__name__}); "
                    f"invoking configured Apify fallback (actor={self.actor_id})."
                )

        # Case B: Primary mode (or fallback triggered after native failure)
        try:
            return self._search_apify(query)
        except Exception as apify_err:
            logger.warning(
                f"Apify {self.name} search failed ({type(apify_err).__name__}): {apify_err}"
            )
            # If primary mode failed and native source exists, try native as backup
            if self.mode == "primary" and self.native_source:
                logger.info(f"Attempting native {self.name} as secondary backup...")
                return self.native_source.search(query)
            raise

    def _call_actor(self, run_input: dict[str, Any]) -> list[dict[str, Any]]:
        """Call Apify actor using apify-client if available, or direct REST API."""
        if not self.api_token:
            raise ValueError(f"Apify {self.name} source has no API token configured")

        # 1. Try official ApifyClient if installed or provided
        try:
            from apify_client import ApifyClient

            client = self.client or ApifyClient(self.api_token)
            run = client.actor(self.actor_id).call(
                run_input=run_input,
                timeout_secs=self.timeout_secs,
            )
            dataset_id = run.get("defaultDatasetId") if run else None
            if dataset_id:
                items = list(client.dataset(dataset_id).iterate_items())
                return items
        except ImportError:
            pass

        # 2. Resilient Direct HTTP call (works without apify-client package)
        actor_slug = self.actor_id.replace("/", "~")
        url = f"https://api.apify.com/v2/acts/{actor_slug}/run-sync-get-dataset-items"
        params = {"token": self.api_token, "timeout": self.timeout_secs}
        headers = {"Content-Type": "application/json"}

        resp = requests.post(
            url,
            json=run_input,
            params=params,
            headers=headers,
            timeout=self.timeout_secs + 20,
        )
        if resp.status_code in (200, 201):
            items = resp.json()
            if isinstance(items, list):
                return items
            return []
        else:
            raise RuntimeError(
                f"Apify HTTP run failed with status {resp.status_code}: {resp.text[:200]}"
            )

    def _search_apify(self, query: SearchQuery) -> list[dict[str, Any]]:
        run_input = build_apify_run_input(self.platform, query, self.max_results)
        logger.info(
            f"Invoking Apify {self.name} scraper (actor={self.actor_id}, max={self.max_results})"
        )
        items = self._call_actor(run_input)
        records = [
            record
            for item in items
            if (record := normalize_apify_job_record(item, self.platform, query))
            is not None
        ]
        logger.info(
            f"Apify {self.name} returned {len(records)} normalized records for '{query.term}'"
        )
        return records
