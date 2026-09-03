from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from models import StandardJob
from scrapers.base import (
    JobProviderBase,
    ProviderUnavailable,
    QuotaExhaustedException,
)


class ApifyProvider(JobProviderBase):
    """Generic Apify provider for executing target community actors."""

    def __init__(self, source: str, actor: str):
        self.name = source
        self.actor = actor

    async def search(self, query: str, location: str, limit: int = 25) -> list[StandardJob]:
        token = os.getenv("APIFY_API_TOKEN")
        if not token:
            raise ProviderUnavailable("APIFY_API_TOKEN is not configured")
        try:
            from apify_client import ApifyClientAsync
        except ImportError as exc:
            raise ProviderUnavailable("apify-client is not installed") from exc

        client = ApifyClientAsync(token)
        try:
            run = await client.actor(self.actor).call(
                run_input={
                    "query": query,
                    "location": location,
                    "maxItems": limit,
                    "limit": limit,
                }
            )
            dataset = await client.dataset(run["defaultDatasetId"]).list_items(limit=limit)
        except Exception as exc:
            message = str(exc)
            if "402" in message or "limit" in message.lower() or "quota" in message.lower() or "payment" in message.lower():
                raise QuotaExhaustedException(f"Apify quota exhausted: {exc}") from exc
            raise ProviderUnavailable(f"Apify {self.name} failed: {exc}") from exc

        jobs: list[StandardJob] = []
        for item in dataset.items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or item.get("position") or "").strip()
            company = str(item.get("company") or item.get("companyName") or "").strip()
            url = str(item.get("url") or item.get("jobUrl") or item.get("link") or "").strip()
            if title and company and url:
                jobs.append(
                    StandardJob(
                        title=title,
                        company=company,
                        location=str(item.get("location") or location),
                        source=self.name,
                        url=url,
                        salary=str(item.get("salary") or "") or None,
                        description=str(item.get("description") or "") or None,
                        date_posted=_parse_date(item.get("datePosted") or item.get("postedAt")),
                        tier_retrieved=2,
                    )
                )
        if not jobs:
            raise ProviderUnavailable(f"Apify returned no parseable {self.name} jobs")
        return jobs[:limit]


class ApifySeekProvider(ApifyProvider):
    """Tier 2: SEEK fallback using Apify's automation-lab/seek-scraper actor."""

    def __init__(self, actor: str = "automation-lab/seek-scraper"):
        super().__init__(source="SEEK", actor=actor)


class ApifyIndeedProvider(ApifyProvider):
    """Tier 2: Indeed fallback using Apify's orgupdate/indeed-jobs-scraper actor."""

    def __init__(self, actor: str = "orgupdate/indeed-jobs-scraper"):
        super().__init__(source="INDEED", actor=actor)


def _parse_date(value: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")) if value else None
    except ValueError:
        return None

