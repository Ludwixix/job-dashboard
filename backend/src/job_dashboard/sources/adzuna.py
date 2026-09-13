from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

import httpx

from ..logging import get_logger
from ..models import JobRecord, SalaryBracket
from .base import (
    SearchQuery,
    canonical_posted_date,
    clean_description,
    estimate_salary_bracket,
    parse_salary_bracket,
    sanitize_html,
)

logger = get_logger("job_dashboard.sources.adzuna")


class AdzunaApiSource:
    name = "Adzuna"
    endpoint = "https://api.adzuna.com/v1/api/jobs/au/search/1"

    def __init__(
        self,
        results_wanted: int = 20,
        timeout: float = 20.0,
        app_id: str | None = None,
        api_key: str | None = None,
    ):
        self.results_wanted = results_wanted
        self.timeout = timeout
        self.app_id = app_id
        self.api_key = api_key

    def _get_params(self, query: SearchQuery) -> dict[str, Any] | None:
        app_id = self.app_id or os.getenv("ADZUNA_APP_ID")
        api_key = self.api_key or os.getenv("ADZUNA_API_KEY")
        if not app_id or not api_key:
            return None
        return {
            "app_id": app_id,
            "app_key": api_key,
            "results_per_page": self.results_wanted,
            "what": query.term,
            "where": query.location,
            "sort_by": "relevance",
            "content-type": "application/json",
        }

    async def asearch(
        self,
        query: SearchQuery,
        client: httpx.AsyncClient | None = None,
    ) -> list[JobRecord]:
        """Asynchronously query Adzuna API using httpx.AsyncClient."""
        params = self._get_params(query)
        if not params:
            return []

        headers = {"Accept": "application/json", "User-Agent": "Mozilla/5.0"}
        try:
            if client:
                response = await client.get(self.endpoint, params=params, headers=headers, timeout=self.timeout)
                payload = response.json()
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as local_client:
                    response = await local_client.get(self.endpoint, params=params, headers=headers)
                    payload = response.json()

            results = []
            for item in payload.get("results", []):
                results.append(_adzuna_record(item, query))
            return results
        except Exception as error:
            logger.warning(f"Adzuna async scraper failed for {query.term}: {error}")
            return []

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Synchronous query implementation with fallback handling."""
        params = self._get_params(query)
        if not params:
            return []

        encoded = urllib.parse.urlencode(params)
        request = urllib.request.Request(
            f"{self.endpoint}?{encoded}",
            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))

            for result in payload.get("results", []):
                yield _adzuna_record(result, query)
        except Exception as error:
            logger.warning(f"Adzuna scraper failed for {query.term}: {error}")
            return


def _adzuna_record(job: Mapping[str, Any], query: SearchQuery) -> JobRecord:
    company = job.get("company") or {}
    location = job.get("location") or {}
    title = str(job.get("title") or "").strip()
    company_name = str(company.get("display_name") or company.get("name") or "").strip()
    location_name = str(location.get("display_name") or "").strip() or query.location
    url = str(job.get("redirect_url") or job.get("url") or "").strip()
    raw_desc = str(job.get("description", ""))
    sanitized_desc = sanitize_html(raw_desc)
    created = str(job.get("created") or "").strip()
    remote_value = "remote" in f"{title} {location_name} {sanitized_desc}".lower()

    # Parse structured salary bracket
    raw_salary_text = str(job.get("salary") or "").strip()
    if not raw_salary_text and (job.get("salary_min") is not None or job.get("salary_max") is not None):
        raw_salary_text = " - ".join(str(value) for value in (job.get("salary_min"), job.get("salary_max")) if value is not None)

    salary_bracket = parse_salary_bracket(
        salary_text=raw_salary_text or None,
        min_amount=job.get("salary_min"),
        max_amount=job.get("salary_max"),
        currency="AUD",
    )
    if salary_bracket.min_amount is None and salary_bracket.max_amount is None:
        salary_bracket = estimate_salary_bracket(title=title, location=location_name)

    work_mode = "remote" if remote_value else "onsite"

    return JobRecord(
        id=str(job.get("id") or url or title),
        provider_job_id=str(job.get("id") or url or title),
        provider="adzuna",
        title=title,
        company=company_name,
        location=location_name,
        work_mode=work_mode,
        url=url,
        raw_description=sanitized_desc,
        key_requirements=[query.term, query.stream],
        salary=salary_bracket,
    )
