from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

from ..logging import get_logger
from .base import SearchQuery, canonical_posted_date, clean_description
from .browser import BotBlockedError, create_stealth_browser, is_challenge_page, wait_for_challenge_clearance
from .proxy import ProxyRotator, sanitize_proxy_url

logger = get_logger("job_dashboard.sources.indeed")


class IndeedJobSpySource:
    name = "Indeed"

    def __init__(
        self,
        results_wanted: int = 25,
        hours_old: int = 336,
        html_fallback: bool = True,
        browser_fallback: bool = False,
        multi_board: bool = False,
        timeout: float = 15.0,
        proxy: str | None = None,
    ):
        self.results_wanted = results_wanted
        self.hours_old = hours_old
        self.html_fallback = html_fallback
        self.browser_fallback = browser_fallback
        self.multi_board = multi_board
        self.timeout = timeout
        self.proxy_rotator = ProxyRotator([proxy] if proxy else None)

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        # Tier 1: JobSpy Scraper
        try:
            records = list(self._search_jobspy(query))
            if records:
                return iter(records)
        except Exception as error:
            logger.warning(f"Indeed JobSpy scraper failed for {query.term}: {error}")

        # Tier 2: Public Embedded JSON
        if self.html_fallback:
            try:
                fallback = list(self._search_embedded_json(query))
                if fallback:
                    logger.info(f"Indeed structured JSON fallback recovered {len(fallback)} jobs for {query.term}")
                    return iter(fallback)
            except Exception as fallback_error:
                logger.warning(f"Indeed structured JSON fallback failed for {query.term}: {fallback_error}")

        # Tier 3: Stealth Playwright Browser Fallback
        if self.browser_fallback:
            try:
                browser_jobs = list(self._search_browser(query))
                if browser_jobs:
                    logger.info(f"Indeed stealth browser fallback recovered {len(browser_jobs)} jobs for {query.term}")
                    return iter(browser_jobs)
            except Exception as browser_error:
                logger.warning(f"Indeed stealth browser fallback failed for {query.term}: {browser_error}")

        return iter(())

    def _search_jobspy(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            from jobspy import scrape_jobs
        except ImportError as error:
            raise RuntimeError("Indeed requires the optional 'jobspy' dependency") from error

        proxy_url = self.proxy_rotator.get_proxy()
        proxies_arg = [proxy_url] if proxy_url else None
        sites = ["indeed"]
        if self.multi_board:
            sites.extend(["zip_recruiter", "glassdoor"])

        results = scrape_jobs(
            site_name=sites,
            search_term=query.term,
            location=query.location,
            country_indeed="australia",
            results_wanted=self.results_wanted,
            hours_old=self.hours_old,
            description_format="markdown",
            proxies=proxies_arg,
        )
        if results is not None and not results.empty:
            records = [_indeed_record(row, query) for _, row in results.iterrows()]
            valid = [r for r in records if r.get("url")]
            if valid:
                return iter(valid)
        return iter(())

    def _search_embedded_json(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Parse Indeed's public embedded job-card JSON without anti-bot bypasses."""
        params = urllib.parse.urlencode({"q": query.term, "l": query.location, "filter": 0, "start": 0})
        request = urllib.request.Request(
            f"https://au.indeed.com/jobs?{params}",
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
            },
        )
        proxy_url = self.proxy_rotator.get_proxy()
        if proxy_url:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
            resp_ctx = opener.open(request, timeout=self.timeout)
        else:
            resp_ctx = urllib.request.urlopen(request, timeout=self.timeout)

        with resp_ctx as response:
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
            if not description:
                description = f"{title} at {company} in {location}. Full position description and direct application available on Indeed Australia."
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

    def _search_browser(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Stealth Playwright browser fallback for Indeed."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise RuntimeError("Indeed browser fallback requires 'playwright'") from error

        playwright_proxy = self.proxy_rotator.get_playwright_proxy()
        with sync_playwright() as playwright:
            browser, context = create_stealth_browser(playwright, headless=True, proxy=playwright_proxy)
            page = context.new_page()
            try:
                params = urllib.parse.urlencode({"q": query.term, "l": query.location})
                url = f"https://au.indeed.com/jobs?{params}"
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                wait_for_challenge_clearance(page, max_wait_seconds=5.0)
                page.wait_for_timeout(2000)

                if is_challenge_page(page.title()):
                    raise BotBlockedError("Cloudflare challenge encountered on Indeed")

                raw_jobs = page.evaluate(_INDEED_EXTRACTOR)
                for record in raw_jobs:
                    posted_val = record.get("posted") or "today"
                    b_desc = clean_description(record.get("description", ""))
                    if not b_desc:
                        b_title = record.get("title", "")
                        b_comp = record.get("company", "")
                        b_loc = record.get("location", "")
                        b_desc = f"{b_title} at {b_comp} in {b_loc}. Full position description and direct application available on Indeed Australia."
                    yield {
                        **record,
                        "description": b_desc,
                        "source": "Indeed",
                        "posted": canonical_posted_date(posted_val),
                        "tags": [query.term, "indeed", query.stream],
                        "application_route": record.get("url", ""),
                    }
            finally:
                browser.close()


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
    source_name = str(row.get("site", "") or "Indeed").capitalize()
    title = str(row.get("title", "") or "")
    company = str(row.get("company", "") or "")
    location = str(row.get("location", "") or query.location)
    desc = clean_description(row.get("description", ""))
    if not desc:
        desc = f"{title} at {company} in {location}. Full position description and direct application available on Indeed Australia."
    job_id = str(row.get("id", "") or "").strip()
    if not job_id and "jk=" in url:
        match = re.search(r"jk=([a-zA-Z0-9]+)", url)
        if match:
            job_id = f"indeed-{match.group(1)}"
    return {
        "id": job_id,
        "title": title,
        "company": company,
        "location": location,
        "description": desc,
        "url": url,
        "source": source_name,
        "posted": canonical_posted_date(row.get("date_posted", "") or ""),
        "remote": bool(row.get("is_remote", False)),
        "tags": [query.term, source_name.lower(), query.stream],
        "application_route": url,
    }


_INDEED_EXTRACTOR = """() => {
    const cards = Array.from(document.querySelectorAll('div.job_seen_beacon, td.resultContent, div.cardOutline'));
    return cards.map(card => {
        const titleEl = card.querySelector('h2.jobTitle span, a[data-jk] span, h2 a');
        const title = titleEl?.textContent.trim() || '';
        const linkEl = card.querySelector('h2.jobTitle a, a[data-jk], a[href*="/rc/clk"], a[href*="/viewjob"]');
        const rawUrl = linkEl?.getAttribute('href') || '';
        const jk = linkEl?.getAttribute('data-jk') || card.closest('[data-jk]')?.getAttribute('data-jk') || '';
        let url = '';
        if (jk) {
            url = 'https://au.indeed.com/viewjob?jk=' + jk;
        } else if (rawUrl.startsWith('http')) {
            url = rawUrl;
        } else if (rawUrl) {
            url = 'https://au.indeed.com' + rawUrl;
        }
        const company = card.querySelector('[data-testid="company-name"], span.companyName, .company_location .companyName')?.textContent.trim() || '';
        const location = card.querySelector('[data-testid="text-location"], div.companyLocation')?.textContent.trim() || '';
        const snippet = card.querySelector('.job-snippet, [data-testid="jobsnippet_footer"], .underShelfFooter')?.textContent.trim() || '';
        const salary = card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet-container, .metadata')?.textContent.trim() || '';
        const rawDate = card.querySelector('[data-testid="myJobsStateDate"], span.date')?.textContent.trim() || '';
        return {
            id: jk ? ('indeed-' + jk) : '',
            title: title,
            company: company,
            location: location,
            description: snippet,
            url: url || '',
            salary: salary,
            posted: rawDate,
            remote: /remote|hybrid/i.test((title + ' ' + location + ' ' + snippet).toLowerCase())
        };
    }).filter(j => j.title && j.url);
}"""
