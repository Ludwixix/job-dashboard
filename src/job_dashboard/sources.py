from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Protocol
from urllib.error import HTTPError, URLError

from .logging import get_logger
from .health import HealthCheck

logger = get_logger("job_dashboard.sources")


@dataclass(frozen=True)
class SearchQuery:
    term: str
    location: str = "Melbourne, VIC"
    stream: str = "core-it"
    group: str = ""
    weight: float = 1.0
    exclude_terms: tuple[str, ...] = ()
    enabled: bool = True


class JobSource(Protocol):
    name: str

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        ...


class SeekUnavailableError(RuntimeError):
    """SEEK did not permit this request or returned an unusable response."""


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def clean_description(value: Any, limit: int = 12000) -> str:
    """Turn provider HTML or email formats into readable text while preserving paragraph breaks."""
    raw = str(value or "")
    if not raw.strip():
        return ""

    # Remove script and style tags completely
    html = re.sub(r"<\s*style\b[^>]*>[\s\S]*?<\s*/\s*style\s*>", "", raw, flags=re.IGNORECASE)
    html = re.sub(r"<\s*script\b[^>]*>[\s\S]*?<\s*/\s*script\s*>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*head\b[^>]*>[\s\S]*?<\s*/\s*head\s*>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<!--[\s\S]*?-->", "", html)

    # Strip email MIME/header artifacts
    html = re.sub(r"(?i)^.*?Content-Type:\s*text/html.*?\n\n", "", html, flags=re.DOTALL)
    html = re.sub(r"(?i)^.*?boundary=.*?\n\n", "", html, flags=re.DOTALL)
    html = re.sub(r"(?i)(?:unsubscribe|view this job on seek|manage alerts|email preference|terms of service)[\s\S]*?$", "", html)

    # Format paragraph, heading, and list tags
    html = re.sub(r"<\s*(?:br\s*/?|p|div|section|article|h[1-6]|ul|ol|tr)\b[^>]*>", "\n\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*li\b[^>]*>", "\n• ", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*/\s*(?:p|div|section|article|h[1-6]|ul|ol|li|tr|table)\s*>", "\n", html, flags=re.IGNORECASE)

    parser = _TextExtractor()
    parser.feed(html)
    text = unescape("".join(parser.parts)).replace("\u00a0", " ")
    
    # Clean decoded text lines
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        # Skip pure separator or garbage artifact lines
        if re.match(r"^[-=_*~]{4,}$", line):
            continue
        if line:
            lines.append(line)
        elif lines and lines[-1] != "":
            lines.append("")
            
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:limit].rstrip() + ("..." if len(text) > limit else "")


class IndeedJobSpySource:
    name = "Indeed"

    def __init__(self, results_wanted: int = 20, hours_old: int = 336):
        self.results_wanted = results_wanted
        self.hours_old = hours_old

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
            )
            if results is None:
                return []
            return (_indeed_record(row, query) for _, row in results.iterrows())
        except Exception as error:
            logger.warning(f"Indeed scraper failed for {query.term}: {error}")
            return []


def _indeed_record(row: Any, query: SearchQuery) -> dict[str, Any]:
    url = str(row.get("job_url", "") or "").strip()
    return {
        "title": str(row.get("title", "") or ""),
        "company": str(row.get("company", "") or ""),
        "location": str(row.get("location", "") or query.location),
        "description": clean_description(row.get("description", "")),
        "url": url,
        "source": "Indeed",
        "posted": str(row.get("date_posted", "") or "")[:10],
        "remote": bool(row.get("is_remote", False)),
        "tags": [query.term, "indeed", query.stream],
        "application_route": url,
    }


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
        "posted": created[:10] if created else "",
        "remote": remote_value,
        "tags": [query.term, "adzuna", query.stream],
        "application_route": url,
        "salary": " - ".join(str(value) for value in (job.get("salary_min"), job.get("salary_max")) if value is not None) or str(job.get("salary") or "").strip(),
    }


class RemoteOkApiSource:
    name = "RemoteOK"
    endpoint = "https://remoteok.com/api"

    def __init__(self, timeout: float = 20.0):
        self.timeout = timeout

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        request = urllib.request.Request(
            self.endpoint,
            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
        )
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


def _remoteok_record(job: Mapping[str, Any], query: SearchQuery) -> dict[str, Any]:
    title = str(job.get("position") or job.get("title") or "").strip()
    company = str(job.get("company") or "").strip()
    location = str(job.get("location") or "Remote").strip() or "Remote"
    url = str(job.get("url") or "").strip() or f"https://remoteok.com/remote-jobs/{job.get('slug', '')}"
    description = clean_description(job.get("description", ""))
    posted = str(job.get("published_at") or "").strip()
    remote_value = "remote" in location.lower() or "remote" in f"{title} {description}".lower()
    return {
        "id": str(job.get("id") or url or title),
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "url": url,
        "source": "RemoteOK",
        "posted": posted[:10] if posted else "",
        "remote": remote_value,
        "tags": [query.term, "remoteok", query.stream],
        "application_route": url,
        "salary": str(job.get("salary") or "").strip(),
    }


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
        "posted": str(job.get("listingDate", "") or "")[:10],
        "remote": any(str(item.get("label", "")).lower() == "remote" for item in work_types),
        "tags": [query.term, "seek", query.stream],
        "application_route": url,
        "salary": job.get("salary") or job.get("salaryLabel", ""),
    }


_SEEK_EXTRACTOR = """() => Array.from(document.querySelectorAll('[data-testid=job-card]')).map(card => {
    const link = card.querySelector('[data-automation=jobTitle]');
    // SEEK sometimes renders a "Featured"/"Promoted" badge in the same slot
    // as the listing date for paid ads; only keep text that actually looks
    // like a date so it doesn't get mistaken for a real posted date.
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


class LinkedInBrowserSource:
    name = "LinkedIn"

    def __init__(self, max_pages: int = 4, results_per_query: int = 25, pause_seconds: float = 2.0):
        self.max_pages = max_pages
        self.results_per_query = results_per_query
        self.pause_seconds = pause_seconds

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise RuntimeError("LinkedIn requires the optional 'playwright' dependency") from error
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(locale="en-AU")
            page = context.new_page()
            detail_page = context.new_page()
            try:
                for page_number in range(self.max_pages):
                    encoded_term = urllib.parse.quote(query.term)
                    url = ("https://www.linkedin.com/jobs/search/?"
                           f"keywords={encoded_term}&location=Melbourne%2C%20Victoria%2C%20Australia"
                           f"&f_TPR=r1209600&start={page_number * self.results_per_query}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    records = page.evaluate(_LINKEDIN_EXTRACTOR)
                    if not records:
                        return
                    for record in records:
                        record["description"] = _linkedin_description(detail_page, record)
                        yield {
                            **record,
                            "source": "LinkedIn",
                            "tags": [query.term, "linkedin", query.stream],
                            "application_route": record.get("url", ""),
                            "remote": "remote" in f"{record.get('title', '')} {record.get('location', '')}".lower(),
                        }
                    if self.pause_seconds:
                        time.sleep(self.pause_seconds)
            finally:
                detail_page.close()
                browser.close()


_LINKEDIN_EXTRACTOR = """() => Array.from(document.querySelectorAll('.base-search-card')).map(card => ({
    title: card.querySelector('.base-search-card__title')?.textContent.trim() || '',
    company: card.querySelector('.base-search-card__subtitle a')?.textContent.trim() || '',
    location: card.querySelector('.job-search-card__location')?.textContent.trim() || '',
    url: (card.querySelector('a[href*="linkedin.com/jobs/view/"]')?.href || '').split('?')[0],
    posted: card.querySelector('time')?.getAttribute('datetime') || ''
})).filter(job => job.title && job.url)"""


def _linkedin_description(page: Any, record: dict[str, Any]) -> str:
    """Read the public detail page because search cards omit descriptions."""
    if not record.get("url"):
        return ""
    try:
        page.goto(record["url"], wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(500)
        return page.evaluate("""() => {
            for (const selector of ['.show-more-less-html__markup', '.description__text', '[data-testid="job-details"]']) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) return element.textContent.trim();
            }
            return document.querySelector('meta[property="og:description"]')?.content || '';
        }""")[:3000]
    except Exception:
        return ""


def is_recent(job: Mapping[str, Any], days: int = 14, now: datetime | None = None) -> bool:
    """A job with no verifiable posted date cannot be vouched for as recent —
    treating it as recent by default previously let stale, expired, or
    garbage-dated listings (e.g. a scraper capturing a UI badge like
    "Featured" instead of the real date) display as freshly posted.
    """
    value = normalize_posted_date(job.get("posted", ""), now)
    if not value:
        return False
    try:
        posted = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return False
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    return posted >= current - timedelta(days=days)


def normalize_posted_date(value: Any, now: datetime | None = None) -> str:
    """Normalize ISO and relative provider dates to an ISO calendar date."""
    text = str(value or "").strip().lower()
    current = now or datetime.now(timezone.utc)
    relative = re.fullmatch(r"(\d+)\s*d(?:ays?)?\s*ago", text)
    if relative:
        return (current - timedelta(days=int(relative.group(1)))).date().isoformat()
    try:
        posted = datetime.fromisoformat(text.replace("z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return ""
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    return posted.astimezone(timezone.utc).date().isoformat()


def posted_age(value: Any, now: datetime | None = None) -> str:
    """Return a human-readable age while retaining the original date in storage."""
    text = normalize_posted_date(value, now)
    if not text:
        return "Posting date unavailable"
    try:
        posted = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(text[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return "Posting date unavailable"
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    age = max(0, (current.date() - posted.astimezone(timezone.utc).date()).days)
    if age == 0:
        return "Posted today"
    if age == 1:
        return "Posted yesterday"
    return f"Posted {age} days ago"


def _normalize_company_name(name: Any) -> str:
    s = str(name or "").lower().strip()
    s = re.sub(r"\b(pty|ltd|limited|inc|corporation|corp|australia|group|services|technologies|solutions|holdings)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def _normalize_job_title(title: Any) -> str:
    s = str(title or "").lower().strip()
    s = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", s)
    s = re.sub(r"\b(immediate start|urgent|urgent:?|contract|permanent|full time|part time|temp|hybrid|remote)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref", "source", "spm", "from", "xptdk",
    "cmpid", "fromage", "pub", "vsk",
}


def _clean_job_url(url: Any) -> str:
    s = str(url or "").strip().rstrip("/")
    if "#" in s:
        s = s.split("#")[0]
    if "?" in s:
        base, _, qs = s.partition("?")
        kept = [kv for kv in qs.split("&") if kv and kv.split("=")[0].lower() not in _TRACKING_PARAMS]
        s = base + ("?" + "&".join(kept) if kept else "")
    return s.rstrip("/?")


def deduplicate_jobs(jobs: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate by clean URL and normalized company/title."""
    priority = {"LinkedIn": 0, "Seek": 1, "Indeed": 2, "Adzuna": 3}
    ordered = sorted(jobs, key=lambda job: priority.get(str(job.get("source", "")), 99))
    seen_urls: set[str] = set()
    seen_keys: dict[tuple[str, str], dict[str, Any]] = {}
    result: list[dict[str, Any]] = []
    
    for raw in ordered:
        job = dict(raw)
        raw_url = str(job.get("url") or job.get("application_route") or "")
        url = _clean_job_url(raw_url)
        
        comp_norm = _normalize_company_name(job.get("company", ""))
        title_norm = _normalize_job_title(job.get("title", ""))
        loc_norm = re.sub(r"[^a-z0-9]", "", str(job.get("location", "")).lower().strip())
        key = (comp_norm, title_norm, loc_norm)
        
        duplicate_key = comp_norm != "" and title_norm != "" and key in seen_keys
        duplicate_url = bool(url and url in seen_urls)
        
        if duplicate_url or duplicate_key:
            existing = seen_keys.get(key)
            if existing is not None:
                existing["tags"] = sorted(set(existing.get("tags", [])) | set(job.get("tags", [])))
                # Prefer longer and cleaner description
                if len(str(job.get("description", ""))) > len(str(existing.get("description", ""))):
                    existing["description"] = job.get("description", "")
            continue
            
        if url:
            seen_urls.add(url)
        if comp_norm and title_norm:
            seen_keys[key] = job
        result.append(job)
        
    return result


def _page_description(url: str, timeout: float = 4.0) -> str:
    if not url:
        return ""
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            html = response.read(250000).decode("utf-8", errors="replace")
        patterns = [
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)',
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
                r'"description"\s*:\s*"((?:\\.|[^"])*)"',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                value = unescape(match.group(1)).replace("\\n", " ").replace("\\\"", '"')
                value = re.sub(r"\s+", " ", value).strip()
                if value:
                    return value[:1000]
    except Exception:
        return ""
    return ""


def ensure_descriptions(jobs: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Fill provider omissions without allowing enrichment failure to drop a job."""
    enriched = []
    for raw in jobs:
        job = dict(raw)
        description = clean_description(job.get("description", ""))
        if not description:
            description = _page_description(str(job.get("url") or job.get("application_route") or ""))
        if not description:
            description = f"{job.get('title', 'Role')} at {job.get('company', 'the listed employer')} in {job.get('location', 'the advertised location')}."
        job["description"] = description
        enriched.append(job)
    return enriched


class ScrapePipeline:
    def __init__(
        self,
        sources: Iterable[JobSource],
        days: int = 14,
        pause_seconds: float = 0.0,
        health_check: HealthCheck | None = None,
    ):
        self.sources = tuple(sources)
        self.days = days
        self.pause_seconds = pause_seconds
        self.health_check = health_check
        self.source_health: dict[str, dict[str, Any]] = {}

    def run(self, queries: Iterable[SearchQuery], on_progress=None) -> list[dict[str, Any]]:
        collected: list[Mapping[str, Any]] = []
        self.errors: list[str] = []
        total_sources = len(self.sources)
        for idx, source in enumerate(self.sources):
            started_at = time.monotonic()
            if on_progress:
                on_progress(f'Scraping {source.name}...', int((idx / total_sources) * 100))
            health = self.source_health.setdefault(source.name, {"jobs": 0, "queries": 0, "success": False, "last_error": ""})
            for query in queries:
                if not query.enabled:
                    continue
                try:
                    results = source.search(query)
                    health["queries"] += 1
                    health["success"] = True
                    health["last_success"] = datetime.now(timezone.utc).isoformat()
                    for job in results:
                        text = " ".join(str(job.get(field, "")) for field in ("title", "company", "description", "tags")).lower()
                        if not any(term.lower() in text for term in query.exclude_terms):
                            collected.append(job)
                            health["jobs"] += 1
                except Exception as error:
                    health["queries"] += 1
                    health["last_error"] = str(error)
                    self.errors.append(f"{source.name} / {query.term}: {error}")
                if self.pause_seconds:
                    time.sleep(self.pause_seconds)
            if self.health_check:
                status = "healthy" if health["success"] and not health["last_error"] else "degraded" if health["success"] else "unhealthy"
                self.health_check.record_check(
                    component=f"scraper:{source.name}",
                    status=status,
                    duration=time.monotonic() - started_at,
                    details=dict(health),
                )
        return ensure_descriptions(deduplicate_jobs(job for job in collected if is_recent(job, self.days)))
