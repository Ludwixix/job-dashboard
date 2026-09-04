from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any
from urllib.error import HTTPError, URLError

from ..logging import get_logger
from .base import SearchQuery, canonical_posted_date, clean_description

logger = get_logger("job_dashboard.sources.adzuna")


class AdzunaApiSource:
    name = "Adzuna"
    endpoint = "https://api.adzuna.com/v1/api/jobs/au/search/1"

    def __init__(self, results_wanted: int = 20, timeout: float = 20.0, app_id: str | None = None, api_key: str | None = None):
        self.results_wanted = results_wanted
        self.timeout = timeout
        self.app_id = app_id
        self.api_key = api_key

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        app_id = self.app_id or os.getenv("ADZUNA_APP_ID")
        api_key = self.api_key or os.getenv("ADZUNA_API_KEY")
        if not app_id or not api_key:
            return []  # Silently skip if credentials missing

        try:
            params = urllib.parse.urlencode({
                "app_id": app_id,
                "app_key": api_key,
                "results_per_page": self.results_wanted,
                "what": query.term,
                "where": query.location,
                "sort_by": "relevance",
                "content-type": "application/json",
            })
            request = urllib.request.Request(
                f"{self.endpoint}?{params}",
                headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            
            for result in payload.get("results", []):
                yield _adzuna_record(result, query)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            logger.warning(f"Adzuna scraper failed for {query.term}: {error}")
            return


def _adzuna_record(job: Mapping[str, Any], query: SearchQuery) -> dict[str, Any]:
    company = (job.get("company") or {})
    location = (job.get("location") or {})
    title = str(job.get("title") or "").strip()
    company_name = str(company.get("display_name") or company.get("name") or "").strip()
    location_name = str(location.get("display_name") or "").strip() or query.location
    url = str(job.get("redirect_url") or job.get("url") or "").strip()
    description = clean_description(job.get("description", ""))
    created = str(job.get("created") or "").strip()
    remote_value = "remote" in f"{title} {location_name} {description}".lower()
    return {
        "id": str(job.get("id") or url or title),
        "title": title,
        "company": company_name,
        "location": location_name,
        "description": description,
        "url": url,
        "source": "Adzuna",
        "posted": canonical_posted_date(created),
        "remote": remote_value,
        "tags": [query.term, "adzuna", query.stream],
        "application_route": url,
        "salary": " - ".join(str(value) for value in (job.get("salary_min"), job.get("salary_max")) if value is not None) or str(job.get("salary") or "").strip(),
    }
