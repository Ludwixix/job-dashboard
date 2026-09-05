"""portal_crawler.py.

Targeted ATS employer portal scraper adapter.
Fetches and enriches deep job descriptions from complex employer and ATS platforms
(Greenhouse, Lever, Workday, SmartRecruiters, Taleo, Ashby, BambooHR) when direct job board
listings only provide truncated summaries.

Supports Crawl4AI when available, with automatic fallback to stealth Playwright browser
and lightweight HTTP HTML parsing.
"""

from __future__ import annotations

import re
import urllib.parse
import urllib.request
from typing import Any

from ..logging import get_logger
from ..models import Job

logger = get_logger("job_dashboard.sources.portal_crawler")

# Patterns matching supported ATS and employer career portal domains
ATS_DOMAIN_PATTERNS = [
    r"greenhouse\.io",
    r"lever\.co",
    r"myworkdayjobs\.com",
    r"smartrecruiters\.com",
    r"taleo\.net",
    r"ashbyhq\.com",
    r"bamboohr\.com",
    r"workable\.com",
    r"pinpointhq\.com",
    r"jobvite\.com",
]

# CSS / DOM container selectors known to house the full job description on ATS pages
JOB_DESCRIPTION_SELECTORS = [
    # Seek
    '[data-automation="jobAdDetails"]',
    '[data-testid="job-details"]',
    # Workday
    '[data-automation-id="jobPostingDescription"]',
    # Greenhouse
    "#content",
    ".job-description",
    ".body",
    # Lever
    ".section.page-centered",
    '[data-qa="job-description"]',
    # SmartRecruiters
    ".job-sections",
    "[itemprop='description']",
    # Generic article / role bodies
    "article",
    "main",
    '[role="main"]',
    "#job-description",
    ".description",
]


def is_ats_portal_url(url: str) -> bool:
    """Check if the provided URL targets a recognized ATS or employer portal."""
    if not url or not isinstance(url, str):
        return False
    clean = url.lower()
    return any(re.search(pattern, clean) for pattern in ATS_DOMAIN_PATTERNS)


def clean_html_to_text(html_fragment: str) -> str:
    """Convert an HTML fragment to clean, readable plain text while stripping script/style tags."""
    if not html_fragment:
        return ""

    # Remove script, style, and svg blocks
    clean = re.sub(r"<(script|style|svg)[^>]*>.*?</\1>", " ", html_fragment, flags=re.DOTALL | re.IGNORECASE)
    # Replace block-level closing tags and br with newlines
    clean = re.sub(r"<(/?p|/?div|/?h[1-6]|/?li|br)[^>]*>", "\n", clean, flags=re.IGNORECASE)
    # Strip remaining tags
    clean = re.sub(r"<[^>]*>", " ", clean)
    # Decode basic entities
    clean = (
        clean.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    # Consolidate excessive spaces and newlines
    lines = [line.strip() for line in clean.split("\n")]
    result = "\n".join(line for line in lines if line)
    return result.strip()


def extract_description_from_html(html: str) -> str:
    """Extract the primary job description from raw HTML using regex and known container markers.

    Designed to execute in sub-millisecond time without requiring heavy parser dependencies.
    """
    if not html:
        return ""

    if "SEEK_REDUX_DATA" in html or "jobAdDetails" in html:
        try:
            from .seek import extract_seek_description_from_html
            seek_desc = extract_seek_description_from_html(html)
            if seek_desc and len(seek_desc) >= 50:
                return seek_desc
        except Exception:
            pass

    # Try BeautifulSoup if available for cleaner selector matching
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Strip non-content elements
        for tag in soup(["script", "style", "nav", "footer", "header", "svg", "noscript"]):
            tag.decompose()

        for selector in JOB_DESCRIPTION_SELECTORS:
            match = soup.select_one(selector)
            if match:
                text = match.get_text(separator="\n", strip=True)
                if len(text) >= 150:
                    return text

        # Fallback to article or body
        if soup.body:
            body_text = soup.body.get_text(separator="\n", strip=True)
            if len(body_text) >= 200:
                return body_text
    except Exception as e:
        logger.debug(f"BeautifulSoup parsing deferred to regex fallback: {e}")

    # Fallback to regex-based extraction
    for pattern in [
        r'<div[^>]*data-automation-id="jobPostingDescription"[^>]*>(.*?)</div>',
        r'<div[^>]*id="content"[^>]*>(.*?)</div>',
        r'<article[^>]*>(.*?)</article>',
        r'<main[^>]*>(.*?)</main>',
    ]:
        match = re.search(pattern, html, flags=re.DOTALL | re.IGNORECASE)
        if match:
            text = clean_html_to_text(match.group(1))
            if len(text) >= 150:
                return text

    return clean_html_to_text(html)[:4000]


def fetch_portal_description_http(url: str, timeout_seconds: float = 8.0) -> str:
    """Fetch description via standard HTTP GET request with browser-like headers."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            html = response.read().decode("utf-8", errors="replace")
            return extract_description_from_html(html)
    except Exception as e:
        logger.warning(f"HTTP portal description fetch failed for {url}: {e}")
        return ""


def fetch_portal_description_playwright(url: str, timeout_ms: int = 15000) -> str:
    """Fetch description via Playwright stealth browser for JavaScript-heavy Single Page Apps."""
    try:
        from playwright.sync_api import sync_playwright
        from .browser import create_stealth_browser
    except ImportError:
        logger.warning("Playwright not installed, skipping browser portal scrape")
        return ""

    try:
        with sync_playwright() as playwright:
            browser, context = create_stealth_browser(playwright, headless=True)
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(1000)

                # Evaluate selectors inside the browser DOM
                content = page.evaluate("""() => {
                    const selectors = [
                        '[data-automation-id="jobPostingDescription"]',
                        '#content',
                        '.job-description',
                        '[data-qa="job-description"]',
                        'article',
                        'main'
                    ];
                    for (const s of selectors) {
                        const el = document.querySelector(s);
                        if (el && el.innerText.trim().length > 150) {
                            return el.innerText.trim();
                        }
                    }
                    return document.body ? document.body.innerText.trim() : '';
                }""")
                return str(content or "")[:6000]
            finally:
                page.close()
                browser.close()
    except Exception as e:
        logger.warning(f"Playwright portal description fetch failed for {url}: {e}")
        return ""


def fetch_portal_description(url: str, timeout_seconds: float = 12.0) -> str:
    """Orchestrate multi-engine portal description extraction.

    Tries Crawl4AI if available, then HTTP request, then Playwright browser.
    """
    if not url:
        return ""

    # Engine 1: Try Crawl4AI if installed
    try:
        import asyncio
        import crawl4ai

        async def _crawl():
            async with crawl4ai.AsyncWebCrawler(verbose=False) as crawler:
                result = await crawler.arun(url=url)
                return result.markdown or result.cleaned_html or ""

        content = asyncio.run(_crawl())
        if len(content.strip()) >= 150:
            logger.info(f"Successfully scraped portal via Crawl4AI: {url}")
            return content[:6000]
    except (ImportError, Exception) as e:
        logger.debug(f"Crawl4AI not used ({e}), falling back to native engines")

    # Engine 2: Fast HTTP fetch (effective for static ATS endpoints like Greenhouse / Lever)
    http_text = fetch_portal_description_http(url, timeout_seconds=min(6.0, timeout_seconds))
    if len(http_text) >= 200:
        return http_text[:6000]

    # Engine 3: Playwright stealth browser (for client-rendered Workday / React portals)
    browser_text = fetch_portal_description_playwright(url, timeout_ms=int(timeout_seconds * 1000))
    if len(browser_text) >= 150:
        return browser_text[:6000]

    return http_text or ""


def enrich_job_description(job: Job) -> Job:
    """Enrich a job listing with full portal description if currently truncated.

    Returns the updated Job instance or original if already comprehensive.
    """
    # If description is already detailed (> 350 chars), skip network fetch
    if job.description and len(job.description.strip()) >= 350:
        return job

    target_url = job.url or ""
    if not is_ats_portal_url(target_url):
        return job

    deep_description = fetch_portal_description(target_url)
    if deep_description and len(deep_description.strip()) > len(job.description.strip()):
        logger.info(f"Enriched job {job.id} ({job.title} at {job.company}) from ATS portal")
        return Job(
            id=job.id,
            title=job.title,
            company=job.company,
            location=job.location,
            description=deep_description,
            why=job.why,
            tags=job.tags,
            remote=job.remote,
            source=job.source,
            url=job.url,
            subcategory=job.subcategory,
            posted=job.posted,
        )

    return job
