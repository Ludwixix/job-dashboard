from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from models import StandardJob
from scrapers.base import (
    JobProviderBase,
    ProviderUnavailable,
    TierBlockedException,
    TierRateLimitedException,
)

FLAGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-infobars",
]


class IndeedJobSpyProvider(JobProviderBase):
    """Tier 1: Indeed scraper utilizing python-jobspy within an async thread pool."""
    name = "INDEED"

    async def search(self, query: str, location: str, limit: int = 25) -> list[StandardJob]:
        return await asyncio.to_thread(self._search, query, location, limit)

    def _search(self, query: str, location: str, limit: int) -> list[StandardJob]:
        try:
            from jobspy import scrape_jobs

            proxy_url = os.getenv("TIER1_PROXY_URL")
            frame = scrape_jobs(
                site_name=["indeed"],
                search_term=query,
                location=location,
                country_indeed="australia",
                results_wanted=limit,
                hours_old=336,
                description_format="markdown",
                proxies=proxy_url,
            )
        except Exception as exc:
            msg = str(exc).lower()
            if "403" in msg or "blocked" in msg or "captcha" in msg or "cloudflare" in msg:
                raise TierBlockedException(f"Indeed JobSpy blocked: {exc}") from exc
            if "429" in msg or "rate limit" in msg:
                raise TierRateLimitedException(f"Indeed JobSpy rate-limited: {exc}") from exc
            raise ProviderUnavailable(f"JobSpy Indeed failed: {type(exc).__name__}: {exc}") from exc

        jobs: list[StandardJob] = []
        for _, row in frame.iterrows():
            url = str(row.get("job_url") or "").strip()
            title = str(row.get("title") or "").strip()
            company = str(row.get("company") or "").strip()
            if title and company and url:
                jobs.append(
                    StandardJob(
                        title=title,
                        company=company,
                        location=str(row.get("location") or location),
                        source=self.name,
                        url=url,
                        salary=str(row.get("salary") or "") or None,
                        description=str(row.get("description") or ""),
                        date_posted=_date(row.get("date_posted")),
                        tier_retrieved=1,
                    )
                )
        if not jobs and limit:
            raise ProviderUnavailable("JobSpy returned no parseable Indeed jobs")
        return jobs[:limit]


# Backward-compatible alias
IndeedTier1 = IndeedJobSpyProvider


class SeekPlaywrightProvider(JobProviderBase):
    """Tier 1: SEEK scraper utilizing Playwright with playwright-stealth in headless Chromium."""
    name = "SEEK"

    async def search(self, query: str, location: str, limit: int = 25) -> list[StandardJob]:
        try:
            from playwright.async_api import async_playwright
            from playwright_stealth import stealth_async
        except ImportError as exc:
            raise ProviderUnavailable("Playwright / playwright-stealth is unavailable") from exc
        proxy_url = os.getenv("TIER1_PROXY_URL")
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=FLAGS,
                proxy={"server": proxy_url} if proxy_url else None
            )
            context = await browser.new_context(
                locale="en-AU",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            await stealth_async(page)
            
            # Prepare network interception for SEEK JSON responses
            intercepted_jobs: list[dict] = []
            
            async def handle_response(response):
                try:
                    ct = response.headers.get("content-type", "")
                    if "application/json" in ct and ("search" in response.url or "graphql" in response.url):
                        payload = await response.json()
                        raw_list = payload.get("data", {}).get("search", {}).get("results", []) or payload.get("jobs", []) or payload.get("results", [])
                        for item in raw_list:
                            if isinstance(item, dict) and item.get("title") and (item.get("id") or item.get("url")):
                                intercepted_jobs.append(item)
                except Exception:
                    pass

            page.on("response", handle_response)
            
            try:
                slug = query.replace(" ", "-").lower()
                loc_slug = location.replace(" ", "-").lower()
                response = await page.goto(f"https://www.seek.com.au/{slug}-jobs/in-{loc_slug}", wait_until="domcontentloaded", timeout=25000)
                status_code = response.status if response else 200
                if status_code == 403:
                    raise TierBlockedException("SEEK returned HTTP 403 Forbidden")
                if status_code == 429:
                    raise TierRateLimitedException("SEEK returned HTTP 429 Too Many Requests")

                await page.wait_for_timeout(2000)
                
                content = await page.content()
                page_title = (await page.title()).lower()
                if "challenge" in page_title or "cf-mitigated" in content or "captcha" in content.lower():
                    raise TierBlockedException(f"SEEK bot challenge detected: {page_title}")
                
                # Check for __NEXT_DATA__ JSON block
                jobs: list[StandardJob] = []
                next_data_raw = await page.evaluate("() => document.getElementById('__NEXT_DATA__')?.textContent || ''")
                if next_data_raw:
                    try:
                        import json
                        nd = json.loads(next_data_raw)
                        data_jobs = nd.get("props", {}).get("pageProps", {}).get("data", {}).get("results", []) or nd.get("props", {}).get("pageProps", {}).get("jobs", [])
                        for r in data_jobs:
                            jid = str(r.get("id") or "")
                            url = f"https://www.seek.com.au/job/{jid}" if jid else str(r.get("url") or "")
                            if r.get("title") and url:
                                jobs.append(StandardJob(
                                    title=str(r.get("title")),
                                    company=str(r.get("advertiser", {}).get("description") or r.get("companyName") or "Unknown"),
                                    location=str(r.get("location") or location),
                                    source=self.name,
                                    url=url,
                                    salary=str(r.get("salary") or "") or None,
                                    description=str(r.get("teaser") or "") or None,
                                    tier_retrieved=1
                                ))
                    except Exception:
                        pass
                
                # Fallback to intercepted network payloads
                if not jobs and intercepted_jobs:
                    for r in intercepted_jobs:
                        jid = str(r.get("id") or "")
                        url = f"https://www.seek.com.au/job/{jid}" if jid else str(r.get("url") or "")
                        if r.get("title") and url:
                            jobs.append(StandardJob(
                                title=str(r.get("title")),
                                company=str(r.get("advertiser", {}).get("description") or r.get("companyName") or "Unknown"),
                                location=str(r.get("location") or location),
                                source=self.name,
                                url=url,
                                tier_retrieved=1
                            ))
                
                # Fallback to DOM evaluation
                if not jobs:
                    records = await page.eval_on_selector_all(
                        "[data-testid=job-card]",
                        "cards => cards.map(card => { const a=card.querySelector('[data-automation=jobTitle]'); return {title:a?.textContent?.trim(), url:a?.href, company:card.querySelector('[data-automation=jobCompany]')?.textContent?.trim(), location:card.querySelector('[data-automation=jobLocation]')?.textContent?.trim()}; }).filter(x => x.title && x.url)"
                    )
                    jobs = [
                        StandardJob(
                            title=r["title"],
                            company=r.get("company") or "Unknown",
                            location=r.get("location") or location,
                            source=self.name,
                            url=r["url"],
                            tier_retrieved=1
                        )
                        for r in records
                    ]

                if not jobs:
                    raise ProviderUnavailable("SEEK returned no parseable jobs")
                return jobs[:limit]
            finally:
                await browser.close()


# Backward-compatible alias
SeekTier1 = SeekPlaywrightProvider


def _date(value: Any) -> datetime | None:
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError: return None
