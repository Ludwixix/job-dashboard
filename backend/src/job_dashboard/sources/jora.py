"""Jora Australia job scraper adapter.

Provides resilient search and extraction for au.jora.com with automatic
Cloudflare 403 challenge detection, domain cooldown management, and Apify fallback.
"""

from __future__ import annotations

import os
import re
import urllib.parse
from collections.abc import Iterable, Mapping
from typing import Any
from bs4 import BeautifulSoup

from ..logging import get_logger
from ..models import JobRecord
from .base import (
    JobSource,
    SearchQuery,
    canonical_posted_date,
    clean_description,
    parse_salary_bracket,
    resolve_search_location,
)
from .resilience import (
    CloudflareChallengeError,
    RateLimitBlockedError,
    ResilientScrapeSession,
    domain_cooldown_tracker,
)

logger = get_logger("job_dashboard.sources.jora")

DEFAULT_JORA_BASE_URL = "https://au.jora.com"


class JoraSource:
    """Scraper adapter for Jora Australia (au.jora.com)."""

    name = "jora"

    def __init__(
        self,
        base_url: str = DEFAULT_JORA_BASE_URL,
        timeout: float = 15.0,
        max_results: int = 30,
        proxy: str | None = None,
        apify_fallback_enabled: bool = True,
        apify_token: str | None = None,
        apify_actor_id: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_results = max_results
        self.proxy = proxy
        self.apify_fallback_enabled = apify_fallback_enabled
        self.apify_token = apify_token
        self.apify_actor_id = apify_actor_id
        self._session = ResilientScrapeSession(
            domain="au.jora.com",
            timeout=self.timeout,
            min_jitter=1.5,
            max_jitter=3.0,
            proxy=self.proxy,
        )

    def search(self, query: SearchQuery) -> list[dict[str, Any]]:
        """Search Jora for matching job listings."""
        # 0. Check mock mode for isolated testing and CI
        if os.getenv("MOCK_SCRAPERS", "").lower() in ("1", "true", "yes") or os.getenv(
            "JOB_DASHBOARD_MOCK_SCRAPERS", ""
        ).lower() in ("1", "true", "yes"):
            return self._mock_search(query)

        # 1. Check if domain is currently in anti-403 cooldown
        if domain_cooldown_tracker.is_cooldown_active("au.jora.com"):
            logger.info(
                "Jora is on active anti-403 cooldown. Escalating to Apify or cache."
            )
            if self.apify_fallback_enabled:
                return self._search_apify_fallback(query)
            return []

        # 2. Native scraping attempt with anti-403 resilience
        try:
            return self._search_native(query)
        except (CloudflareChallengeError, RateLimitBlockedError) as bot_err:
            logger.warning(
                f"Jora native scraping blocked ({bot_err}). Escalating to fallback."
            )
            if self.apify_fallback_enabled:
                return self._search_apify_fallback(query)
            return []
        except Exception as err:
            logger.warning(f"Jora native scrape failed: {err}")
            if self.apify_fallback_enabled:
                return self._search_apify_fallback(query)
            return []

    def _search_native(self, query: SearchQuery) -> list[dict[str, Any]]:
        """Scrape Jora directly using ResilientScrapeSession."""
        location = resolve_search_location(query) or "Melbourne VIC"
        params = {
            "q": query.term,
            "l": location,
        }
        url = f"{self.base_url}/j?{urllib.parse.urlencode(params)}"
        logger.info(f"Querying Jora: {url}")

        resp = self._session.get(url, apply_jitter=True)
        if resp.status_code != 200:
            logger.warning(f"Jora returned HTTP {resp.status_code}")
            return []

        return self._parse_html(resp.text, query)

    def _parse_html(self, html: str, query: SearchQuery) -> list[dict[str, Any]]:
        """Extract and normalize job records from Jora search HTML."""
        soup = BeautifulSoup(html, "html.parser")
        results: list[dict[str, Any]] = []
        seen_keys: set[str] = set()

        # Jora job link selectors
        job_links = soup.select('a.job-link, a[href*="/job/"]')
        for link in job_links:
            href = str(link.get("href") or "").strip()
            if not href or href.startswith("#") or "javascript:" in href:
                continue

            # Title
            title = link.get_text(strip=True)
            if not title or len(title) < 2:
                continue

            # Strip tracking query params from job URL
            clean_href = href.split("?")[0]
            if clean_href.startswith("/"):
                job_url = f"{self.base_url}{clean_href}"
            elif clean_href.startswith("http"):
                job_url = clean_href
            else:
                job_url = f"{self.base_url}/{clean_href}"

            # Extract job ID slug
            job_id_match = re.search(
                r"/job/(?:[a-zA-Z0-9_-]+-)?([a-f0-9]{32}|[a-zA-Z0-9]+)", clean_href
            )
            job_id = (
                job_id_match.group(1) if job_id_match else str(abs(hash(clean_href)))
            )

            # Ascend to job card container
            container = (
                link.find_parent("div", class_=re.compile(r"job|result|card", re.I))
                or link.parent.parent
            )

            # Company
            comp_el = container.select_one(
                '.job-company, [class*="company"], [class*="employer"], span.company'
            )
            company = comp_el.get_text(strip=True) if comp_el else "Confidential"

            # Location
            loc_el = container.select_one(
                '.job-location, [class*="location"], span.location'
            )
            location = (
                loc_el.get_text(strip=True)
                if loc_el
                else (query.location or "Australia")
            )

            # Salary
            sal_el = container.select_one(
                '.job-salary, [class*="salary"], .badge.-salary, [class*="badge"]'
            )
            salary_raw = sal_el.get_text(strip=True) if sal_el else ""

            # Teaser / Snippet
            desc_el = container.select_one(
                '.job-abstract, .job-snippet, [class*="abstract"], [class*="description"]'
            )
            snippet = clean_description(desc_el.get_text(strip=True) if desc_el else "")

            # Relative / Posted date
            date_el = container.select_one('.job-listed-date, [class*="date"], time')
            posted_raw = date_el.get_text(strip=True) if date_el else "today"

            # Deduplication key
            norm_key = f"{company.lower()}___{title.lower()}"
            if norm_key in seen_keys:
                continue
            seen_keys.add(norm_key)

            is_remote = bool(
                "remote" in f"{title} {location} {snippet}".lower()
                or "wfh" in f"{title} {location} {snippet}".lower()
                or "work from home" in f"{title} {location} {snippet}".lower()
            )

            job_dict = {
                "id": f"jora-{job_id}",
                "provider_job_id": job_id,
                "title": title,
                "company": company,
                "location": location,
                "description": snippet,
                "source": "Jora",
                "url": job_url,
                "remote": is_remote,
                "salary": salary_raw,
                "salary_bracket": parse_salary_bracket(salary_raw),
                "posted": canonical_posted_date(posted_raw),
                "tags": ["jora"] + (["remote"] if is_remote else []),
            }
            results.append(job_dict)
            if len(results) >= self.max_results:
                break

        return results

    def _search_apify_fallback(self, query: SearchQuery) -> list[dict[str, Any]]:
        """Delegate search to Apify Jora actor."""
        try:
            from .apify_platform import ApifyPlatformSource

            token = (
                self.apify_token
                or os.getenv("APIFY_API_TOKEN")
                or os.getenv("JOB_DASHBOARD_APIFY_API_TOKEN")
            )
            if not token:
                logger.debug("No Apify token available for Jora fallback.")
                return []

            actor_id = self.apify_actor_id or "memo23/jora-search-cheerio-ppr"
            apify_source = ApifyPlatformSource(
                platform="jora",
                api_token=token,
                actor_id=actor_id,
                max_results=self.max_results,
            )
            return list(apify_source.search(query))
        except Exception as e:
            logger.warning(f"Apify Jora fallback failed: {e}")
            return []

    def _mock_search(self, query: SearchQuery) -> list[dict[str, Any]]:
        """Produce deterministic mock records for unit testing and CI."""
        term_clean = query.term.title()
        return [
            {
                "id": "jora-mock-001",
                "provider_job_id": "mock-001",
                "title": f"Senior {term_clean} Specialist",
                "company": "Melbourne Tech Innovations",
                "location": query.location or "Melbourne VIC",
                "description": f"Exciting opportunity for a Senior {term_clean} to lead infrastructure initiatives.",
                "source": "Jora",
                "url": "https://au.jora.com/job/senior-specialist-mock-001",
                "remote": True,
                "salary": "$140,000 - $160,000 AUD",
                "salary_bracket": parse_salary_bracket("$140,000 - $160,000 AUD"),
                "posted": "today",
                "tags": ["jora", "remote"],
            },
            {
                "id": "jora-mock-002",
                "provider_job_id": "mock-002",
                "title": f"{term_clean} Team Lead",
                "company": "Victorian Digital Solutions",
                "location": "Sydney NSW",
                "description": f"Join our growing team as a {term_clean} Lead working with enterprise stakeholders.",
                "source": "Jora",
                "url": "https://au.jora.com/job/team-lead-mock-002",
                "remote": False,
                "salary": "$165,000 AUD",
                "salary_bracket": parse_salary_bracket("$165,000 AUD"),
                "posted": "yesterday",
                "tags": ["jora"],
            },
        ]
