from __future__ import annotations

import time
import urllib.parse
from collections.abc import Iterable, Mapping
from typing import Any

from ..logging import get_logger
from .base import SearchQuery
from .browser import create_stealth_browser, is_challenge_page, wait_for_challenge_clearance
from .proxy import ProxyRotator

logger = get_logger("job_dashboard.sources.linkedin")


class LinkedInBrowserSource:
    name = "LinkedIn"

    def __init__(
        self,
        max_pages: int = 4,
        results_per_query: int = 25,
        pause_seconds: float = 2.0,
        proxy: str | None = None,
    ):
        self.max_pages = max_pages
        self.results_per_query = results_per_query
        self.pause_seconds = pause_seconds
        self.proxy_rotator = ProxyRotator([proxy] if proxy else None)

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise RuntimeError("LinkedIn requires the optional 'playwright' dependency") from error

        playwright_proxy = self.proxy_rotator.get_playwright_proxy()
        with sync_playwright() as playwright:
            browser, context = create_stealth_browser(playwright, headless=True, proxy=playwright_proxy)
            page = context.new_page()
            detail_page = context.new_page()
            try:
                for page_number in range(self.max_pages):
                    encoded_term = urllib.parse.quote(query.term)
                    url = (
                        "https://www.linkedin.com/jobs/search/?"
                        f"keywords={encoded_term}&location=Melbourne%2C%20Victoria%2C%20Australia"
                        f"&f_TPR=r1209600&start={page_number * self.results_per_query}"
                    )
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    wait_for_challenge_clearance(page, max_wait_seconds=4.0)
                    if is_challenge_page(page.title()):
                        logger.warning(f"LinkedIn challenge page encountered on page {page_number}")
                        return

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
        page.goto(record["url"], wait_until="domcontentloaded", timeout=15000)
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
