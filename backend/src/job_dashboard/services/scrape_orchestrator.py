"""
job_dashboard.services.scrape_orchestrator
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Domain service orchestrating job scraping pipelines, background coordination,
and anti-double-dipping rate-limiting invariants:
- Database-first query sufficiency checks (>= 10 fresh jobs within 21 days)
- Single-flight query coalescing via ScrapeCoordinator
- Bounded 1-worker concurrency ceiling for Cloud Run
- Polite 2.0s gateway pacing and 6-hour unfulfilling query cooldowns
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import threading
import time
from typing import Any, Callable

from ..scrape_coordinator import ScrapeCoordinator
from ..sources import ScrapePipeline, SearchQuery, detect_query_stream

logger = logging.getLogger(__name__)


class ScrapeOrchestrationService:
    """Orchestrates job discovery, scrapers, and background queues."""

    def __init__(
        self,
        data_dir: Path,
        repository=None,
        job_index=None,
        sources: list | None = None,
        health_check: bool = False,
    ):
        self.data_dir = Path(data_dir)
        self.search_queries_path = self.data_dir / "search_queries.json"
        self.repository = repository
        self.job_index = job_index
        self.sources = sources or []
        self.health_check = health_check
        self.source_health: dict[str, Any] = {}

        self.coordinator = ScrapeCoordinator(repo=self.repository)
        self.search_queries: list[SearchQuery] = self._load_search_queries()

    def _load_search_queries(self, defaults=None) -> list[SearchQuery]:
        """Load configured search queries from disk or populate defaults."""
        if not self.search_queries_path.exists():
            resolved = list(defaults or [])
            if resolved:
                try:
                    self.search_queries = resolved
                    self.save_search_queries()
                except Exception as err:
                    logger.warning(f"Could not persist default search queries: {err}")
            return resolved

        try:
            raw = json.loads(self.search_queries_path.read_text(encoding="utf-8"))
            queries = []
            for item in raw:
                if isinstance(item, dict):
                    queries.append(
                        SearchQuery(
                            term=item.get("term", ""),
                            location=item.get("location", "Melbourne, VIC"),
                            stream=item.get(
                                "stream", detect_query_stream(item.get("term", ""))
                            ),
                            group=item.get("group", ""),
                            weight=float(item.get("weight", 1.0)),
                            exclude_terms=tuple(item.get("exclude_terms", ())),
                            enabled=bool(item.get("enabled", True)),
                        )
                    )
            return queries
        except Exception as err:
            logger.warning(
                f"Failed to read search queries from {self.search_queries_path}: {err}"
            )
            return list(defaults or [])

    def save_search_queries(self) -> None:
        """Atomically persist current search queries to disk."""
        try:
            payload = [
                {
                    "term": q.term,
                    "location": q.location,
                    "stream": q.stream,
                    "group": getattr(q, "group", ""),
                    "weight": getattr(q, "weight", 1.0),
                    "exclude_terms": list(getattr(q, "exclude_terms", ())),
                    "enabled": getattr(q, "enabled", True),
                }
                for q in self.search_queries
            ]
            self.search_queries_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.search_queries_path.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            tmp.replace(self.search_queries_path)
        except Exception as err:
            logger.warning(f"Failed to persist search queries: {err}")

    def enqueue_queries(
        self, queries: list[SearchQuery], app, force: bool = False
    ) -> list[dict[str, Any]]:
        """Enqueue queries into the background ScrapeCoordinator."""
        return self.coordinator.enqueue_queries(queries, app, force=force)

    def refresh(
        self,
        queries: list[SearchQuery | str | dict],
        force: bool = False,
        ttl_hours: float = 12.0,
        on_progress: Callable[[str, int], None] | None = None,
    ) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
        """Execute a coordinated multi-query scrape with DB-first filtering."""
        if not queries:
            queries = list(self.search_queries or [])

        normalized_queries: list[SearchQuery] = []
        for q in queries:
            if isinstance(q, SearchQuery):
                normalized_queries.append(q)
            elif isinstance(q, str) and q.strip():
                normalized_queries.append(
                    SearchQuery(
                        term=q.strip(),
                        location="Melbourne, VIC",
                        stream=detect_query_stream(q.strip()),
                    )
                )
            elif isinstance(q, dict) and q.get("term"):
                normalized_queries.append(
                    SearchQuery(
                        term=str(q.get("term")).strip(),
                        location=str(q.get("location") or "Melbourne, VIC"),
                        stream=str(
                            q.get("stream") or detect_query_stream(str(q.get("term")))
                        ),
                        enabled=bool(q.get("enabled", True)),
                    )
                )

        queries_to_scrape = []
        cached_query_terms = []
        db_satisfied_terms = []

        for q in normalized_queries:
            term = q.term
            loc = q.location

            # 1. Database-First: Check if SQLite already has sufficient fresh matching jobs
            if not force and self.repository:
                has_cov, match_count = self.repository.has_sufficient_matching_jobs(
                    term, loc, threshold=10, max_age_days=21
                )
                if has_cov:
                    db_satisfied_terms.append(term)
                    cached_query_terms.append(term)
                    self.repository.record_query_scrape(term, loc, match_count)
                    continue

            # 2. Query Scrape Cache: Check if scraped within TTL
            if (
                not force
                and self.repository
                and self.repository.is_query_cached(term, loc, ttl_hours=ttl_hours)
            ):
                cached_query_terms.append(term)
            else:
                queries_to_scrape.append(q)

        pipeline_errors = []
        if queries_to_scrape:
            if on_progress:
                on_progress(
                    f"Scanning {len(queries_to_scrape)} live employment gateways...", 10
                )
            pipeline = ScrapePipeline(
                self.sources, days=14, health_check=self.health_check
            )
            fresh = pipeline.run(queries_to_scrape, on_progress=on_progress)
            pipeline_errors = pipeline.errors
            self.source_health = getattr(pipeline, "source_health", {})

            # Sync cooldown tracker to prevent duplicate background scraping
            for q in queries_to_scrape:
                key = self.coordinator._make_key(q)
                self.coordinator._cooldown_tracker[key] = time.time()

            if fresh and self.job_index:
                if on_progress:
                    on_progress("Saving & indexing positions...", 90)
                fresh_materialized = self.job_index.materialize_jobs(fresh)
                self.job_index.upsert_jobs(fresh_materialized)

        all_jobs = self.job_index.get_jobs() if self.job_index else []
        cache_stats = {
            "total_queries": len(normalized_queries),
            "scraped": len(queries_to_scrape),
            "cached": len(cached_query_terms),
            "db_satisfied": db_satisfied_terms,
            "total_jobs": len(all_jobs),
        }
        return all_jobs, pipeline_errors, cache_stats
