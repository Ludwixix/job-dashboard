from __future__ import annotations

import asyncio
import logging
from collections import Counter

from database import session_factory, upsert_jobs
from models import StandardJob
from scrapers.base import JobProviderBase, ProviderUnavailable
from scrapers.tier1_stealth import IndeedJobSpyProvider, SeekPlaywrightProvider
from scrapers.tier2_apify import ApifyIndeedProvider, ApifySeekProvider
from scrapers.tier3_serp import SerpApiGoogleJobsProvider

logger = logging.getLogger("job_collector")


class CostTieredCollector:
    """
    Cascade Orchestrator executing concurrent board scraping (SEEK & Indeed)
    with independent multi-tier failover: Tier 1 -> Tier 2 -> Tier 3.
    """

    def __init__(self) -> None:
        self.tiers: dict[str, list[JobProviderBase]] = {
            "INDEED": [
                IndeedJobSpyProvider(),
                ApifyIndeedProvider(),
                SerpApiGoogleJobsProvider(),
            ],
            "SEEK": [
                SeekPlaywrightProvider(),
                ApifySeekProvider(),
                SerpApiGoogleJobsProvider(),
            ],
        }

    async def _search_source(
        self,
        source: str,
        query: str,
        location: str,
        limit: int,
        force_tier: int | None = None,
    ) -> list[StandardJob]:
        """Perform cascade search across tiers with failover for a specific source board."""
        providers = self.tiers[source]
        for index, provider in enumerate(providers, 1):
            if force_tier is not None and index != force_tier:
                continue
            try:
                logger.info("source=%s target_tier=%s event=attempt", source, index)
                jobs = await provider.search(query, location, limit)
                if jobs:
                    logger.info("source=%s target_tier=%s event=success count=%d", source, index, len(jobs))
                    return jobs
            except ProviderUnavailable as exc:
                logger.warning(
                    "source=%s target_tier=%s error_type=%s message=%s event=failover",
                    source,
                    index,
                    type(exc).__name__,
                    exc,
                )
            except Exception as exc:
                logger.exception(
                    "source=%s target_tier=%s error_type=%s event=unexpected_error",
                    source,
                    index,
                    type(exc).__name__,
                )
        logger.error("source=%s event=exhausted_all_tiers", source)
        return []

    async def search(
        self,
        query: str,
        location: str,
        limit: int = 25,
        force_tier: int | None = None,
    ) -> tuple[list[StandardJob], dict[str, int], int]:
        """
        Execute concurrent searches across all job boards with independent tier failover.
        Returns: (jobs, tier_breakdown, new_jobs_stored_count).
        """
        # Concurrently search SEEK and INDEED
        results = await asyncio.gather(
            *(self._search_source(source, query, location, limit, force_tier) for source in self.tiers)
        )
        all_jobs = [job for group in results for job in group]

        # Deduplicate jobs by unique identity hash
        deduped: dict[str, StandardJob] = {}
        for job in all_jobs:
            item = job.with_identity()
            deduped[item.id] = item

        # Persist jobs to database
        fresh: list[StandardJob] = []
        if deduped:
            async with session_factory() as session:
                fresh, _ = await upsert_jobs(session, list(deduped.values()))

        fresh_ids = {job.id for job in fresh}
        tier_breakdown = dict(Counter(str(job.tier_retrieved) for job in deduped.values()))

        # Mark new jobs
        final_jobs = [
            job.model_copy(update={"is_new": job.id in fresh_ids})
            for job in deduped.values()
        ]
        return final_jobs, tier_breakdown, len(fresh)

