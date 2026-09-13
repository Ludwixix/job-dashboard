from __future__ import annotations

import json
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

import httpx

from ..models import JobRecord, SalaryBracket
from .base import (
    SearchQuery,
    canonical_posted_date,
    clean_description,
    estimate_salary_bracket,
    parse_salary_bracket,
    sanitize_html,
)


class RemoteOkApiSource:
    name = "RemoteOK"
    endpoint = "https://remoteok.com/api"

    def __init__(self, timeout: float = 20.0):
        self.timeout = timeout

    async def asearch(
        self,
        query: SearchQuery,
        client: httpx.AsyncClient | None = None,
    ) -> list[JobRecord]:
        """Asynchronously query RemoteOK API using httpx.AsyncClient."""
        headers = {"Accept": "application/json", "User-Agent": "Mozilla/5.0"}
        try:
            if client:
                response = await client.get(self.endpoint, headers=headers, timeout=self.timeout)
                payload = response.json()
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as local_client:
                    response = await local_client.get(self.endpoint, headers=headers)
                    payload = response.json()

            items = payload.get("jobs", []) or payload.get("results", []) if isinstance(payload, dict) else payload
            results: list[JobRecord] = []
            for item in items:
                if not isinstance(item, Mapping):
                    continue
                haystack = " ".join([
                    str(item.get("position") or item.get("title") or ""),
                    str(item.get("company") or ""),
                    str(item.get("description") or ""),
                    str(item.get("location") or ""),
                ]).lower()
                if query.term.lower() not in haystack:
                    continue
                results.append(_remoteok_record(item, query))
            return results
        except Exception:
            return []

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Synchronous query implementation with fallback handling."""
        request = urllib.request.Request(
            self.endpoint,
            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))

            if isinstance(payload, dict):
                items = payload.get("jobs", []) or payload.get("results", [])
            else:
                items = payload

            for item in items:
                if not isinstance(item, Mapping):
                    continue
                haystack = " ".join([
                    str(item.get("position") or item.get("title") or ""),
                    str(item.get("company") or ""),
                    str(item.get("description") or ""),
                    str(item.get("location") or ""),
                ]).lower()
                if query.term.lower() not in haystack.lower():
                    continue
                yield _remoteok_record(item, query)
        except Exception:
            return


def _remoteok_record(job: Mapping[str, Any], query: SearchQuery) -> JobRecord:
    title = str(job.get("position") or job.get("title") or "").strip()
    company = str(job.get("company") or "").strip()
    location = str(job.get("location") or "Remote").strip() or "Remote"
    url = str(job.get("url") or "").strip() or f"https://remoteok.com/remote-jobs/{job.get('slug', '')}"
    raw_desc = str(job.get("description", ""))
    sanitized_desc = sanitize_html(raw_desc)
    posted = str(job.get("published_at") or "").strip()
    remote_value = "remote" in location.lower() or "remote" in f"{title} {sanitized_desc}".lower()

    # Parse structured salary bracket
    salary_bracket = parse_salary_bracket(
        salary_text=str(job.get("salary") or "").strip() or None,
        min_amount=job.get("salary_min"),
        max_amount=job.get("salary_max"),
        currency="USD" if "$" in str(job.get("salary") or "") else "AUD",
    )
    if salary_bracket.min_amount is None and salary_bracket.max_amount is None:
        salary_bracket = estimate_salary_bracket(title=title, location=location)

    # RemoteOK is a 100% remote job board
    work_mode = "remote"

    return JobRecord(
        id=str(job.get("id") or url or title),
        provider_job_id=str(job.get("id") or url or title),
        provider="remoteok",
        title=title,
        company=company,
        location=location,
        work_mode=work_mode,
        url=url,
        raw_description=sanitized_desc,
        key_requirements=[query.term, query.stream],
        salary=salary_bracket,
    )
