"""
scrape_coordinator.py
~~~~~~~~~~~~~~~~~~~~~
Central coordinator for background job scraping with:
- Database-first verification to prevent double dipping
- Single-flight request coalescing (40 users -> 1 scrape task)
- Strict concurrency bounding (max 1 worker thread to protect Cloud Run memory/CPU)
- Query cooldowns (prevents re-scraping same term within cooldown window)
- Polite gateway pacing (avoids triggering SEEK / Indeed rate limits and anti-bot bans)
"""

import concurrent.futures
import json
import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any

from .sources import ScrapePipeline, SearchQuery

logger = logging.getLogger(__name__)


class ScrapeCoordinator:
    """Coordinates background job scraping to protect against concurrent overload."""

    def __init__(
        self,
        repo=None,
        max_workers: int = 1,
        cooldown_seconds: int = 21600,  # 6 hours
        inter_query_delay_seconds: float = 2.0,
    ):
        self.repo = repo
        self.max_workers = max_workers
        self.cooldown_seconds = cooldown_seconds
        self.inter_query_delay_seconds = inter_query_delay_seconds

        self._queue: queue.Queue[tuple[SearchQuery, Any]] = queue.Queue()
        self._lock = threading.Lock()
        self._in_flight_keys: set[str] = set()
        self._queued_keys: set[str] = set()
        self._cooldown_tracker: dict[str, float] = {}

        self._active_query_display = ""
        self._is_scraping = False
        self._completed_count = 0
        self._last_scraped_at: str | None = None
        self._errors: list[str] = []

        self._worker_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def _make_key(self, query: SearchQuery) -> str:
        term = getattr(query, "term", str(query)).strip().lower()
        loc = getattr(query, "location", "").strip().lower()
        return f"{term}___{loc}"

    def get_queue_depth(self) -> int:
        return self._queue.qsize()

    def is_busy(self) -> bool:
        return self._is_scraping or self.get_queue_depth() > 0

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "success": True,
                "is_scraping": self._is_scraping,
                "active_query": self._active_query_display,
                "queue_depth": self.get_queue_depth(),
                "completed_count": self._completed_count,
                "last_scraped_at": self._last_scraped_at,
                "errors": list(self._errors[-5:]),
            }

    def enqueue_query(
        self, query: SearchQuery, app, force: bool = False
    ) -> dict[str, Any]:
        """Enqueue a single query, coalescing if already in flight or queued."""
        key = self._make_key(query)
        term = getattr(query, "term", str(query)).strip()
        loc = getattr(query, "location", "").strip()

        with self._lock:
            # 1. Single-Flight: Check if already actively scraping
            if key in self._in_flight_keys:
                return {"status": "in_flight", "query": term, "key": key}

            # 2. Single-Flight: Check if already queued
            if key in self._queued_keys:
                return {"status": "already_queued", "query": term, "key": key}

            # 3. Cooldown check (unless explicitly forced)
            if not force:
                last_time = self._cooldown_tracker.get(key, 0)
                if time.time() - last_time < self.cooldown_seconds:
                    return {"status": "cooldown", "query": term, "key": key}

            # Enqueue for background worker
            self._queued_keys.add(key)
            self._queue.put((query, app))

            # Ensure background worker thread is running
            self._ensure_worker_running()

            return {
                "status": "enqueued",
                "query": term,
                "key": key,
                "queue_depth": self.get_queue_depth(),
            }

    def enqueue_queries(
        self, queries: list[SearchQuery], app, force: bool = False
    ) -> list[dict[str, Any]]:
        """Enqueue multiple queries with single-flight coalescing."""
        results = []
        for q in queries:
            results.append(self.enqueue_query(q, app, force=force))
        return results

    def _ensure_worker_running(self) -> None:
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._stop_event.clear()
            self._worker_thread = threading.Thread(
                target=self._worker_loop, daemon=True, name="ScrapeCoordinatorWorker"
            )
            self._worker_thread.start()

    def _worker_loop(self) -> None:
        """Sequential single-worker execution loop."""
        while not self._stop_event.is_set():
            try:
                task = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

            query, app = task
            key = self._make_key(query)
            term = getattr(query, "term", str(query)).strip()
            loc = getattr(query, "location", "").strip()

            with self._lock:
                self._queued_keys.discard(key)
                self._in_flight_keys.add(key)
                self._is_scraping = True
                self._active_query_display = f"{term} ({loc})" if loc else term

            try:
                logger.info(
                    f"ScrapeCoordinator executing gateway query: {term} [{loc}]"
                )
                pipeline = ScrapePipeline(
                    app.sources,
                    days=14,
                    health_check=getattr(app, "health_check", False),
                )
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                try:
                    future = executor.submit(pipeline.run, [query])
                    try:
                        fresh = future.result(timeout=45.0)
                    except concurrent.futures.TimeoutError:
                        logger.warning(
                            f"ScrapeCoordinator query timed out after 45s: {term} [{loc}]"
                        )
                        fresh = []
                        with self._lock:
                            self._errors.append(
                                f"{term}: Scrape gateway timed out (45s ceiling)"
                            )
                finally:
                    executor.shutdown(wait=False, cancel_futures=True)

                if pipeline.errors:
                    with self._lock:
                        self._errors.extend(pipeline.errors)

                if fresh:
                    # Materialize fresh jobs
                    fresh_materialized = app.materialize_jobs(fresh)
                    new_jobs_to_add = []
                    with app.lock:
                        existing_ids = {j.get("id") for j in app.jobs if j.get("id")}
                        merged = list(app.jobs)
                        for job in fresh_materialized:
                            jid = job.get("id")
                            if jid and jid not in existing_ids:
                                merged.append(job)
                                existing_ids.add(jid)
                                new_jobs_to_add.append(job)
                        app.jobs = merged

                    # Persist fresh materialized jobs into SQLite repository
                    try:
                        app.repository.replace_jobs(fresh_materialized)
                    except Exception as repo_err:
                        logger.warning(
                            f"Error persisting fresh jobs to repository: {repo_err}"
                        )

                    # Update jobs.json and jobs_combined.json only if new jobs arrived
                    if new_jobs_to_add:
                        try:
                            app.jobs_path.write_text(
                                json.dumps(
                                    {"jobs": app.jobs},
                                    indent=2,
                                    ensure_ascii=False,
                                    default=str,
                                )
                                + "\n",
                                encoding="utf-8",
                            )
                        except Exception as json_err:
                            logger.warning(f"Error writing jobs.json: {json_err}")

                        try:
                            combined_path = app.data_dir / "jobs_combined.json"
                            combined_path.write_text(
                                json.dumps(app.jobs, ensure_ascii=False, indent=2)
                                + "\n",
                                encoding="utf-8",
                            )
                        except Exception as comb_err:
                            logger.warning(
                                f"Error updating jobs_combined.json: {comb_err}"
                            )

                # Record query cache and cooldown
                now_iso = datetime.now(timezone.utc).isoformat()
                app.repository.record_query_scrape(term, loc, len(fresh or []))

                with self._lock:
                    self._cooldown_tracker[key] = time.time()
                    self._completed_count += 1
                    self._last_scraped_at = now_iso

            except Exception as exc:
                logger.error(
                    f"ScrapeCoordinator failed processing {term}: {exc}", exc_info=True
                )
                with self._lock:
                    self._errors.append(f"{term}: {exc}")
            finally:
                with self._lock:
                    self._in_flight_keys.discard(key)
                    if self._queue.empty():
                        self._is_scraping = False
                        self._active_query_display = ""
                self._queue.task_done()

                # Polite gateway pacing pause
                time.sleep(self.inter_query_delay_seconds)

    def stop(self) -> None:
        """Stop worker thread cleanly."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
