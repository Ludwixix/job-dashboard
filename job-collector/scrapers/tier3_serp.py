from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from models import StandardJob
from scrapers.base import JobProviderBase, ProviderUnavailable


class SerpApiGoogleJobsProvider(JobProviderBase):
    """Tier 3: Google Jobs fallback targeting Seek and Indeed domains via SerpApi."""
    name = "GOOGLE_JOBS"

    async def search(self, query: str, location: str, limit: int = 25) -> list[StandardJob]:
        key = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
        if not key:
            raise ProviderUnavailable("SERPAPI_API_KEY is not configured")
        try:
            import httpx

            search_query = f"{query} site:seek.com.au OR site:au.indeed.com"
            async with httpx.AsyncClient(timeout=25) as client:
                response = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google_jobs",
                        "q": search_query,
                        "location": location,
                        "api_key": key,
                        "hl": "en",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            raise ProviderUnavailable(f"SerpApi request failed: {exc}") from exc

        jobs: list[StandardJob] = []
        for item in payload.get("jobs_results", [])[:limit]:
            title = str(item.get("title") or "").strip()
            company = str(item.get("company_name") or "").strip()

            apply_opts = item.get("apply_options") or []
            url = ""
            origin_source = self.name

            if apply_opts:
                first_opt = apply_opts[0]
                url = str(first_opt.get("link") or "").strip()
                title_opt = str(first_opt.get("title") or "").lower()
                if "seek" in title_opt or "seek.com" in url:
                    origin_source = "SEEK"
                elif "indeed" in title_opt or "indeed.com" in url:
                    origin_source = "INDEED"

            if not url:
                url = str(item.get("share_link") or "").strip()

            if title and company and url:
                jobs.append(
                    StandardJob(
                        title=title,
                        company=company,
                        location=str(item.get("location") or location),
                        source=origin_source,
                        url=url,
                        salary=str(item.get("salary") or "") or None,
                        description=str(item.get("description") or "") or None,
                        date_posted=_parse(item.get("detected_extensions", {}).get("posted_at")),
                        tier_retrieved=3,
                    )
                )
        if not jobs:
            raise ProviderUnavailable("Google Jobs returned no parseable jobs")
        return jobs[:limit]


# Backward-compatible alias
SerpApiProvider = SerpApiGoogleJobsProvider


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

