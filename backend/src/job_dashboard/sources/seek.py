from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError

from .base import SearchQuery, SeekUnavailableError, canonical_posted_date, clean_description, is_recent


class SeekApiSource:
    name = "Seek"
    endpoint = "https://chalice-search-api.cloud.seek.com.au/search"

    def __init__(self, page_size: int = 22, timeout: float = 15.0, pause_seconds: float = 1.5,
                 max_pages: int = 3, max_results: int = 60, retries: int = 2,
                 endpoint: str | None = None, allow_browser_fallback: bool = False,
                 cache_path: str | Path | None = None, allow_cache_fallback: bool = False):
        self.page_size = max(1, min(100, page_size))
        self.timeout = timeout
        self.pause_seconds = max(0.0, pause_seconds)
        self.max_pages = max(1, max_pages)
        self.max_results = max(1, max_results)
        self.retries = max(0, min(3, retries))
        self.endpoint = endpoint or self.endpoint
        self.allow_browser_fallback = allow_browser_fallback
        self.cache_path = Path(cache_path) if cache_path else None
        self.allow_cache_fallback = allow_cache_fallback

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        failures = []
        try:
            records = list(self._search_api(query))
            if records:
                yield from records
                return
            failures.append("API returned no jobs")
        except Exception as api_error:
            failures.append(f"API: {api_error}")

        if self.allow_browser_fallback:
            try:
                records = list(self._search_browser(query))
                if records:
                    yield from records
                    return
                failures.append("browser returned no jobs")
            except Exception as browser_error:
                failures.append(f"browser: {browser_error}")

        if self.allow_cache_fallback:
            try:
                records = list(self._search_cache(query))
                if records:
                    yield from records
                    return
                failures.append("cache returned no jobs")
            except Exception as cache_error:
                failures.append(f"cache: {cache_error}")

        if not self.allow_browser_fallback and not self.allow_cache_fallback:
            detail = failures[0] if failures else "API unavailable"
            raise SeekUnavailableError(f"public API unavailable: {detail}")
        raise SeekUnavailableError("; ".join(failures) or "all fallbacks are disabled")

    def _search_api(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        page = 0
        collected = 0
        while True:
            if page >= self.max_pages or collected >= self.max_results:
                return
            params = urllib.parse.urlencode({
                "siteKey": "AU-Main",
                "where": query.location,
                "keywords": query.term,
                "pageSize": self.page_size,
                "page": page,
                "sortmode": "ListedDate",
            })
            request = urllib.request.Request(
                f"{self.endpoint}?{params}",
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://www.seek.com.au/",
                    "Origin": "https://www.seek.com.au",
                },
            )
            payload = self._request_json(request)
            if not isinstance(payload, Mapping):
                raise SeekUnavailableError("public API returned a non-object response")
            jobs = payload.get("jobs", [])
            if not jobs:
                return
            for job in jobs[: self.max_results - collected]:
                if not isinstance(job, Mapping):
                    continue
                yield _seek_record(job, query)
                collected += 1
                if collected >= self.max_results:
                    return
            page += 1
            if len(jobs) < self.page_size:
                return
            if self.pause_seconds:
                time.sleep(self.pause_seconds)

    def _request_json(self, request: urllib.request.Request) -> Any:
        for attempt in range(self.retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                if error.code in (401, 403):
                    raise SeekUnavailableError(f"SEEK denied the request (HTTP {error.code})") from error
                if error.code != 429 and not 500 <= error.code < 600:
                    raise SeekUnavailableError(f"SEEK returned HTTP {error.code}") from error
                if attempt >= self.retries:
                    raise SeekUnavailableError(f"SEEK remained unavailable (HTTP {error.code})") from error
                retry_after = error.headers.get("Retry-After", "")
                try:
                    delay = min(30.0, max(1.0, float(retry_after)))
                except ValueError:
                    delay = min(30.0, 2.0 ** attempt)
                time.sleep(delay)
            except (URLError, TimeoutError, json.JSONDecodeError) as error:
                if attempt >= self.retries:
                    raise SeekUnavailableError("SEEK request failed") from error
                time.sleep(min(30.0, 2.0 ** attempt))

    def _search_browser(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        if not self.allow_browser_fallback:
            raise SeekUnavailableError("browser fallback is disabled for compliance")
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page(locale="en-AU")
            try:
                slug = query.term.replace(" ", "-")
                page.goto(f"https://www.seek.com.au/{slug}-jobs/in-All-Melbourne-VIC?daterange=14", wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2500)
                for record in page.evaluate(_SEEK_EXTRACTOR):
                    yield {**record, "source": "Seek", "tags": [query.term, "seek", query.stream], "application_route": record.get("url", "")}
            finally:
                browser.close()

    def _search_cache(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        if self.cache_path is None or not self.cache_path.is_file():
            raise SeekUnavailableError("cache file not found")
        try:
            payload = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise SeekUnavailableError("cache file contains invalid JSON") from error
        records = payload.get("jobs") if isinstance(payload, Mapping) else payload
        if not isinstance(records, list):
            raise SeekUnavailableError("cache format invalid: expected a jobs list")

        term = query.term.casefold()
        matched = []
        for record in records:
            if not isinstance(record, Mapping):
                continue
            if not is_recent(record, days=14):
                continue
            searchable = " ".join(str(record.get(field) or "") for field in (
                "title", "company", "location", "description", "tags"
            )).casefold()
            if term in searchable:
                tags = record.get("tags") or []
                if isinstance(tags, str):
                    tags = [tags]
                matched.append({
                    **record,
                    "source": "Seek",
                    "tags": [*tags, query.term, "seek", query.stream],
                    "application_route": record.get("url", ""),
                })
            if len(matched) >= self.max_results:
                break
        yield from matched


def _seek_record(job: Mapping[str, Any], query: SearchQuery) -> dict[str, Any]:
    identifier = str(job.get("id", "") or "")
    advertiser = job.get("advertiser") if isinstance(job.get("advertiser"), Mapping) else {}
    places = job.get("places") if isinstance(job.get("places"), Mapping) else {}
    location = places.get("label") or ", ".join(filter(None, [job.get("area"), job.get("state")]))
    url = f"https://www.seek.com.au/job/{identifier}" if identifier else ""
    work_types = job.get("workType") or []
    stable_id = identifier or re.sub(r"[^a-z0-9]+", "-", f"{job.get('title', '')}-{advertiser.get('description', '')}".lower()).strip("-")
    return {
        "id": f"seek-{stable_id}" if stable_id else "",
        "title": job.get("title", ""),
        "company": advertiser.get("description", job.get("advertiserDescription", "")),
        "location": location,
        "description": clean_description(job.get("teaser", "")),
        "url": url,
        "source": "Seek",
        "posted": canonical_posted_date(job.get("listingDate", "") or ""),
        "remote": any(str(item.get("label", "")).lower() == "remote" for item in work_types),
        "tags": [query.term, "seek", query.stream],
        "application_route": url,
        "salary": job.get("salary") or job.get("salaryLabel", ""),
    }


_SEEK_EXTRACTOR = """() => Array.from(document.querySelectorAll('[data-testid=job-card]')).map(card => {
    const link = card.querySelector('[data-automation=jobTitle]');
    const rawPosted = card.querySelector('[data-automation=jobListingDate]')?.textContent.trim() || '';
    const posted = /\\d/.test(rawPosted) ? rawPosted : '';
    return {
        title: card.querySelector('[data-testid=job-card-title]')?.textContent.trim() || '',
        company: card.querySelector('[data-automation=jobCompany]')?.textContent.trim() || '',
        location: card.querySelector('[data-automation=jobLocation]')?.textContent.trim() || '',
        description: card.querySelector('[data-automation=jobShortDescription]')?.textContent.trim() || '',
        posted: posted,
        url: link?.href || '',
        remote: /remote/i.test(card.textContent || '')
    };
}).filter(job => job.title && job.url)"""
