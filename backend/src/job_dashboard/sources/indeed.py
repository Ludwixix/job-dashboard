from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

from ..logging import get_logger
from .base import SearchQuery, canonical_posted_date, clean_description

logger = get_logger("job_dashboard.sources.indeed")


class IndeedJobSpySource:
    name = "Indeed"

    def __init__(self, results_wanted: int = 20, hours_old: int = 336, html_fallback: bool = True, timeout: float = 15.0):
        self.results_wanted = results_wanted
        self.hours_old = hours_old
        self.html_fallback = html_fallback
        self.timeout = timeout

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            from jobspy import scrape_jobs
        except ImportError as error:
            raise RuntimeError("Indeed requires the optional 'jobspy' dependency") from error

        try:
            results = scrape_jobs(
                site_name=["indeed"],
                search_term=query.term,
                location=query.location,
                country_indeed="australia",
                results_wanted=self.results_wanted,
                hours_old=self.hours_old,
                description_format="markdown",
            )
            if results is not None and not results.empty:
                records = [_indeed_record(row, query) for _, row in results.iterrows()]
                if any(record.get("url") for record in records):
                    return iter(records)
            if self.html_fallback:
                fallback = list(self._search_embedded_json(query))
                if fallback:
                    logger.info(f"Indeed structured fallback returned {len(fallback)} jobs for {query.term}")
                    return iter(fallback)
            return iter(())
        except Exception as error:
            logger.warning(f"Indeed scraper failed for {query.term}: {error}")
            if self.html_fallback:
                try:
                    fallback = list(self._search_embedded_json(query))
                    if fallback:
                        logger.info(f"Indeed structured fallback recovered {len(fallback)} jobs for {query.term}")
                        return iter(fallback)
                except Exception as fallback_error:
                    logger.warning(f"Indeed structured fallback failed for {query.term}: {fallback_error}")
            return iter(())

    def _search_embedded_json(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Parse Indeed's public embedded job-card JSON without anti-bot bypasses."""
        params = urllib.parse.urlencode({"q": query.term, "l": query.location, "filter": 0, "start": 0})
        request = urllib.request.Request(
            f"https://au.indeed.com/jobs?{params}",
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.8",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            },
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            html = response.read(2_000_000).decode("utf-8", errors="replace")
        marker = 'window.mosaic.providerData["mosaic-provider-jobcards"]='
        start = html.find(marker)
        if start < 0:
            return
        start += len(marker)
        payload_text = _extract_balanced_json(html, start)
        if not payload_text:
            return
        payload = json.loads(payload_text)
        model = payload.get("metaData", {}).get("mosaicProviderJobCardsModel", {})
        for item in model.get("results", [])[: self.results_wanted]:
            if not isinstance(item, Mapping):
                continue
            job_key = str(item.get("jobkey") or item.get("jobKey") or "").strip()
            url = f"https://au.indeed.com/viewjob?jk={job_key}" if job_key else str(item.get("viewJobLink") or "")
            title = str(item.get("displayTitle") or item.get("title") or "").strip()
            company = str(item.get("company") or item.get("truncatedCompany") or "").strip()
            location = str(item.get("formattedLocation") or query.location).strip()
            description = clean_description(item.get("snippet") or item.get("jobDescription") or "")
            posted = item.get("pubDate") or item.get("formattedRelativeTime") or ""
            if title and url:
                yield {
                    "id": f"indeed-{job_key}" if job_key else "",
                    "title": title,
                    "company": company,
                    "location": location,
                    "description": description,
                    "url": url,
                    "source": "Indeed",
                    "posted": canonical_posted_date(posted),
                    "remote": bool(item.get("remoteLocation")),
                    "tags": [query.term, "indeed", query.stream],
                    "application_route": url,
                    "salary": str(item.get("salarySnippet", {}).get("text") or "") if isinstance(item.get("salarySnippet"), Mapping) else "",
                }


def _extract_balanced_json(text: str, start: int) -> str:
    """Extract a JSON object from an assignment without regex-truncating nested data."""
    opening = text.find("{", start)
    if opening < 0:
        return ""
    depth = 0
    in_string = False
    escaped = False
    for index in range(opening, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[opening:index + 1]
    return ""


def _indeed_record(row: Any, query: SearchQuery) -> dict[str, Any]:
    url = str(row.get("job_url", "") or "").strip()
    return {
        "title": str(row.get("title", "") or ""),
        "company": str(row.get("company", "") or ""),
        "location": str(row.get("location", "") or query.location),
        "description": clean_description(row.get("description", "")),
        "url": url,
        "source": "Indeed",
        "posted": canonical_posted_date(row.get("date_posted", "") or ""),
        "remote": bool(row.get("is_remote", False)),
        "tags": [query.term, "indeed", query.stream],
        "application_route": url,
    }
