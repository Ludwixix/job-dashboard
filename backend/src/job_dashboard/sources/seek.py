from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError

from ..logging import get_logger
from .base import SearchQuery, SeekUnavailableError, canonical_posted_date, clean_description, is_recent
from .browser import BotBlockedError, create_stealth_browser, is_challenge_page, wait_for_challenge_clearance
from .proxy import ProxyRotator, parse_proxy, sanitize_proxy_url

logger = get_logger("job_dashboard.sources.seek")


class SeekApiSource:
    name = "Seek"
    endpoint = "https://chalice-search-api.cloud.seek.com.au/search"

    def __init__(
        self,
        page_size: int = 22,
        timeout: float = 15.0,
        pause_seconds: float = 1.5,
        max_pages: int = 3,
        max_results: int = 60,
        retries: int = 2,
        endpoint: str | None = None,
        allow_browser_fallback: bool = False,
        cache_path: str | Path | None = None,
        allow_cache_fallback: bool = False,
        allow_cross_source_fallback: bool = False,
        proxy: str | None = None,
    ):
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
        self.allow_cross_source_fallback = allow_cross_source_fallback
        self.proxy_rotator = ProxyRotator([proxy] if proxy else None)

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        failures = []

        # Tier 1: Chalice Search API
        try:
            records = list(self._search_api(query))
            if records:
                return iter(records)
            failures.append("API returned no jobs")
        except Exception as api_error:
            failures.append(f"API: {api_error}")

        # Tier 2: Stealth Headless Browser (Playwright)
        if self.allow_browser_fallback:
            try:
                records = list(self._search_browser(query))
                if records:
                    logger.info(f"SEEK stealth browser fallback recovered {len(records)} jobs for '{query.term}'")
                    return iter(records)
                failures.append("stealth browser returned no jobs")
            except Exception as browser_error:
                failures.append(f"stealth browser: {browser_error}")

        # Tier 3: Pre-ingested Cache Fallback
        if self.allow_cache_fallback:
            try:
                records = list(self._search_cache(query))
                if records:
                    logger.info(f"SEEK cache fallback recovered {len(records)} jobs for '{query.term}'")
                    return iter(records)
                failures.append("cache returned no jobs")
            except Exception as cache_error:
                failures.append(f"cache: {cache_error}")

        # Tier 4: Cross-source Australian gateway fallback
        if self.allow_cross_source_fallback:
            try:
                records = list(self._search_cross_source(query))
                if records:
                    logger.info(f"Cross-source gateway fallback recovered {len(records)} Australian jobs for '{query.term}'")
                    return iter(records)
                failures.append("cross-source returned no jobs")
            except Exception as cross_error:
                failures.append(f"cross-source: {cross_error}")

        if not self.allow_browser_fallback and not self.allow_cache_fallback and not self.allow_cross_source_fallback:
            detail = failures[0] if failures else "API unavailable"
            raise SeekUnavailableError(f"public API unavailable: {detail}")
        raise SeekUnavailableError("; ".join(failures) or "all fallbacks exhausted")

    def _search_api(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        page = 0
        collected = 0
        proxy_url = self.proxy_rotator.get_proxy()
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
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
                    "Referer": "https://www.seek.com.au/",
                    "Origin": "https://www.seek.com.au",
                },
            )
            payload = self._request_json(request, proxy_url=proxy_url)
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

    def _request_json(self, request: urllib.request.Request, proxy_url: str | None = None) -> Any:
        opener = urllib.request.build_opener()
        if proxy_url:
            opener.add_handler(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
        for attempt in range(self.retries + 1):
            try:
                with opener.open(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                if error.code in (401, 403):
                    raise SeekUnavailableError(f"SEEK denied the request (HTTP {error.code})") from error
                if error.code != 429 and not 500 <= error.code < 600:
                    raise SeekUnavailableError(f"SEEK returned HTTP {error.code}") from error
                if attempt >= self.retries:
                    raise SeekUnavailableError(f"SEEK remained unavailable (HTTP {error.code})") from error
                time.sleep(min(30.0, 2.0 ** attempt))
            except (URLError, TimeoutError, json.JSONDecodeError) as error:
                if attempt >= self.retries:
                    raise SeekUnavailableError("SEEK request failed") from error
                time.sleep(min(30.0, 2.0 ** attempt))

    def _search_browser(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        if not self.allow_browser_fallback:
            raise SeekUnavailableError("browser fallback is disabled")
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise SeekUnavailableError("playwright is not installed") from error

        playwright_proxy = self.proxy_rotator.get_playwright_proxy()
        with sync_playwright() as playwright:
            browser, context = create_stealth_browser(playwright, headless=True, proxy=playwright_proxy)
            page = context.new_page()
            try:
                slug = query.term.replace(" ", "-")
                url = f"https://www.seek.com.au/{slug}-jobs/in-All-Melbourne-VIC?daterange=14"
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                wait_for_challenge_clearance(page, max_wait_seconds=5.0)
                page.wait_for_timeout(2500)

                if is_challenge_page(page.title()):
                    raise BotBlockedError("Cloudflare challenge encountered on SEEK")

                raw_jobs = page.evaluate(_SEEK_EXTRACTOR)
                for record in raw_jobs:
                    posted_val = record.get("posted") or "today"
                    yield {
                        **record,
                        "source": "Seek",
                        "posted": canonical_posted_date(posted_val),
                        "tags": [query.term, "seek", query.stream],
                        "application_route": record.get("url", ""),
                    }
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

    def _search_cross_source(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Fallback to JobSpy Australian scraping when direct Seek methods are blocked."""
        try:
            from jobspy import scrape_jobs
        except ImportError:
            return iter(())

        proxy_url = self.proxy_rotator.get_proxy()
        proxies_arg = [proxy_url] if proxy_url else None
        try:
            results = scrape_jobs(
                site_name=["zip_recruiter", "glassdoor"],
                search_term=query.term,
                location=query.location,
                results_wanted=min(20, self.max_results),
                hours_old=336,
                description_format="markdown",
                proxies=proxies_arg,
            )
            if results is not None and not results.empty:
                output = []
                for _, row in results.iterrows():
                    url = str(row.get("job_url", "") or "").strip()
                    if not url:
                        continue
                    output.append({
                        "title": str(row.get("title", "") or ""),
                        "company": str(row.get("company", "") or ""),
                        "location": str(row.get("location", "") or query.location),
                        "description": clean_description(row.get("description", "")),
                        "url": url,
                        "source": "Seek (Gateway)",
                        "posted": canonical_posted_date(row.get("date_posted", "") or ""),
                        "remote": bool(row.get("is_remote", False)),
                        "tags": [query.term, "seek-fallback", query.stream],
                        "application_route": url,
                    })
                return iter(output)
        except Exception as err:
            logger.warning(f"Cross-source fallback failed: {err}")
        return iter(())


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


_SEEK_EXTRACTOR = """() => {
    const cards = Array.from(document.querySelectorAll('[data-testid=job-card], article[data-automation=normalJob], article'));
    return cards.map(card => {
        const titleEl = card.querySelector('[data-testid=job-card-title], [data-automation=jobTitle], h3 a, h2 a');
        const link = card.querySelector('a[data-automation=jobTitle], [data-testid=job-card-title] a, a[href*="/job/"]');
        const compEl = card.querySelector('[data-automation=jobCompany], a[data-automation=jobCompany]');
        const locEl = card.querySelector('[data-automation=jobLocation], span[data-automation=jobLocation]');
        const descEl = card.querySelector('[data-automation=jobShortDescription], [data-testid=job-card-teaser]');
        const salEl = card.querySelector('[data-automation=jobSalary], span[data-automation=jobSalary]');
        const rawPosted = card.querySelector('[data-automation=jobListingDate], time')?.textContent.trim() || '';
        const posted = /\\d/.test(rawPosted) ? rawPosted : '';
        const rawUrl = link?.href || titleEl?.href || '';
        const url = rawUrl ? rawUrl.split('?')[0].split('#')[0] : '';
        return {
            title: titleEl?.textContent.trim() || '',
            company: compEl?.textContent.trim() || '',
            location: locEl?.textContent.trim() || '',
            description: descEl?.textContent.trim() || '',
            salary: salEl?.textContent.trim() || '',
            posted: posted,
            url: url,
            remote: /remote|hybrid/i.test(card.textContent || '')
        };
    }).filter(job => job.title && job.url);
}"""


def extract_seek_job_id(url_or_id: str) -> str | None:
    """Extract numeric Seek Job ID from URL or raw identifier string."""
    if not url_or_id or not isinstance(url_or_id, str):
        return None
    cleaned = url_or_id.strip()
    if cleaned.isdigit():
        return cleaned
    seek_prefix_match = re.search(r"^seek-(\d+)$", cleaned, re.IGNORECASE)
    if seek_prefix_match:
        return seek_prefix_match.group(1)
    # Check URL patterns e.g. seek.com.au/job/93979774 or au.seek.com/job/93979774
    url_match = re.search(r"(?:seek\.com\.au|seek\.com)/job/(\d+)", cleaned, re.IGNORECASE)
    if url_match:
        return url_match.group(1)
    # Generic /job/12345678 if 'seek' is in the string
    if "seek" in cleaned.lower():
        generic_match = re.search(r"/job/(\d+)", cleaned)
        if generic_match:
            return generic_match.group(1)
    return None


def extract_seek_description_from_html(html_content: str) -> str:
    """Extract complete detailed job description from raw Seek HTML."""
    if not html_content or not isinstance(html_content, str):
        return ""

    # Strategy 1: window.SEEK_REDUX_DATA
    m = re.search(r"window\.SEEK_REDUX_DATA\s*=\s*(.*?);\s*(?:window\.SEEK_|</script>)", html_content, re.DOTALL)
    if not m:
        m = re.search(r"window\.SEEK_REDUX_DATA\s*=\s*(.*?);\s*</script>", html_content, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1).strip())
            job_obj = data.get("jobdetails", {}).get("result", {}).get("job", {})
            content = job_obj.get("content") or job_obj.get("content2")
            if content and len(content) >= 30:
                return clean_description(content)
        except Exception:
            pass

    # Strategy 2: DOM container data-automation="jobAdDetails"
    dom_match = re.search(r'data-automation=["\']jobAdDetails["\'][^>]*>(.*?)(?:<div class="[^"]*advertiser|data-automation="jobActions"|data-automation="shareJob"|</div>\s*</div>\s*</div>\s*</section>)', html_content, re.DOTALL | re.IGNORECASE)
    if not dom_match:
        dom_match = re.search(r'data-automation=["\']jobAdDetails["\'][^>]*>(.*?)</div>', html_content, re.DOTALL | re.IGNORECASE)
    if dom_match:
        cleaned = clean_description(dom_match.group(1))
        if len(cleaned) >= 30:
            return cleaned

    # Strategy 3: JSON-LD Schema.org JobPosting
    ld_matches = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html_content, re.DOTALL)
    for raw_ld in ld_matches:
        try:
            parsed_ld = json.loads(raw_ld)
            items = parsed_ld.get("@graph", [parsed_ld]) if isinstance(parsed_ld, dict) else []
            for item in items:
                if isinstance(item, dict) and item.get("@type") == "JobPosting":
                    desc = item.get("description")
                    if desc and len(desc) >= 30:
                        return clean_description(desc)
        except Exception:
            pass

    return ""


def fetch_seek_job_description(
    url_or_id: str,
    timeout: float = 8.0,
    proxy_url: str | None = None,
    allow_browser_fallback: bool = True
) -> str:
    """Fetch and parse the full detailed job description for a Seek listing."""
    job_id = extract_seek_job_id(url_or_id)
    target_url = f"https://www.seek.com.au/job/{job_id}" if job_id else url_or_id
    if not target_url.startswith(("http://", "https://")):
        return ""

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Referer": "https://www.seek.com.au/",
    }

    req = urllib.request.Request(target_url, headers=headers)
    opener = urllib.request.build_opener()
    if proxy_url:
        opener.add_handler(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))

    try:
        with opener.open(req, timeout=timeout) as response:
            html = response.read().decode("utf-8", errors="replace")
            desc = extract_seek_description_from_html(html)
            if desc and len(desc) >= 30:
                return desc
    except Exception as err:
        logger.debug(f"HTTP Seek job description fetch failed for {target_url}: {err}")

    # Fallback to Playwright stealth browser if allowed
    if allow_browser_fallback:
        try:
            from playwright.sync_api import sync_playwright
            from .browser import create_stealth_browser
            with sync_playwright() as playwright:
                browser, context = create_stealth_browser(playwright, headless=True)
                page = context.new_page()
                try:
                    page.goto(target_url, wait_until="domcontentloaded", timeout=int(timeout * 1500))
                    page.wait_for_timeout(1000)
                    html = page.content()
                    desc = extract_seek_description_from_html(html)
                    if desc and len(desc) >= 30:
                        return desc
                finally:
                    browser.close()
        except Exception as browser_err:
            logger.debug(f"Browser Seek description fallback failed: {browser_err}")

    return ""
