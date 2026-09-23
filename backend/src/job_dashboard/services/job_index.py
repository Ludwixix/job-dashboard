"""
job_dashboard.services.job_index
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Domain service for managing in-memory and persisted job indices:
- Dual-indexed O(1) in-memory cache (_jobs_by_id, _jobs_by_url)
- Thread-safe RLock protection for atomic updates
- Materialization of raw scraped job payloads with domain scoring and normalization
- Atomic disk persistence to jobs.json and jobs_combined.json
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import threading
from typing import Any

from ..normalize import normalize_job
from ..sources import clean_description

logger = logging.getLogger(__name__)


class JobIndexService:
    """Manages in-memory job caches, dual-indexing, and disk serialization."""

    def __init__(
        self,
        data_dir: Path,
        repository=None,
        dashboard_service=None,
        initial_jobs: list[dict[str, Any]] | None = None,
    ):
        self.data_dir = Path(data_dir)
        self.jobs_path = self.data_dir / "jobs.json"
        self.combined_path = self.data_dir / "jobs_combined.json"
        self.repository = repository
        self.dashboard_service = dashboard_service
        self._lock = threading.RLock()

        self._jobs: list[dict[str, Any]] = []
        self._jobs_by_id: dict[str, dict[str, Any]] = {}
        self._jobs_by_url: dict[str, dict[str, Any]] = {}
        self.last_skipped_jobs: list[dict[str, Any]] = []

        if initial_jobs is not None:
            self.set_jobs(initial_jobs)
        else:
            self.load_jobs()

    def _rebuild_indices(self) -> None:
        """Rebuild O(1) lookup tables under lock."""
        by_id: dict[str, dict[str, Any]] = {}
        by_url: dict[str, dict[str, Any]] = {}
        for job in self._jobs:
            jid = str(job.get("id") or "").strip()
            if jid:
                by_id[jid] = job
            url = str(job.get("url") or "").strip()
            if url:
                by_url[url] = job
        self._jobs_by_id = by_id
        self._jobs_by_url = by_url

    def get_jobs(self) -> list[dict[str, Any]]:
        """Return a copy of the current in-memory job list."""
        with self._lock:
            return list(self._jobs)

    def set_jobs(self, jobs: list[dict[str, Any]]) -> None:
        """Atomically set the in-memory job list and rebuild dual index."""
        with self._lock:
            self._jobs = list(jobs)
            self._rebuild_indices()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """O(1) lookup of a job by ID."""
        with self._lock:
            return self._jobs_by_id.get(str(job_id).strip())

    def get_job_by_url(self, url: str) -> dict[str, Any] | None:
        """O(1) lookup of a job by canonical URL."""
        with self._lock:
            return self._jobs_by_url.get(str(url).strip())

    def load_jobs(self) -> list[dict[str, Any]]:
        """Load jobs from jobs.json or jobs_combined.json on disk."""
        with self._lock:
            candidates = [
                self.jobs_path,
                self.combined_path,
                self.data_dir / "scraped_jobs.json",
            ]
            for p in candidates:
                if p.exists():
                    try:
                        raw = json.loads(p.read_text(encoding="utf-8"))
                        if isinstance(raw, dict) and "jobs" in raw:
                            loaded = list(raw["jobs"])
                        elif isinstance(raw, list):
                            loaded = list(raw)
                        else:
                            loaded = []
                        if loaded:
                            self.set_jobs(loaded)
                            return self._jobs
                    except Exception as err:
                        logger.error(f"Error loading jobs from {p}: {err}")
            self.set_jobs([])
            return []

    def save_jobs(self) -> None:
        """Atomically serialize current jobs to disk."""
        with self._lock:
            payload = {"jobs": self._jobs}
            tmp = self.jobs_path.with_suffix(".tmp")
            try:
                with tmp.open("w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False, default=str)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
                tmp.replace(self.jobs_path)
            except Exception as err:
                logger.warning(f"Error saving jobs to {self.jobs_path}: {err}")

            try:
                comb_tmp = self.combined_path.with_suffix(".tmp")
                with comb_tmp.open("w", encoding="utf-8") as f:
                    json.dump(self._jobs, f, indent=2, ensure_ascii=False, default=str)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
                comb_tmp.replace(self.combined_path)
            except Exception as comb_err:
                logger.debug(f"Note updating jobs_combined.json: {comb_err}")

    def materialize_jobs(self, jobs: list[Any]) -> list[dict[str, Any]]:
        """Normalize, score, and decorate raw job postings with domain analysis."""
        materialized = []
        skipped = []
        for raw in jobs:
            candidate = raw.to_dict() if hasattr(raw, "to_dict") else dict(raw)
            if not str(candidate.get("company") or "").strip():
                candidate["company"] = "Confidential"
            if (
                isinstance(candidate.get("salary"), dict)
                and "raw_text" in candidate["salary"]
            ):
                candidate["salary"] = candidate["salary"]["raw_text"]
            elif hasattr(candidate.get("salary"), "raw_text"):
                candidate["salary"] = candidate["salary"].raw_text
            try:
                job = normalize_job(candidate)
                analysis = (
                    self.dashboard_service.analyse(candidate)
                    if self.dashboard_service
                    else None
                )
            except Exception as error:
                logger.warning(f"Skipping unnormalizable job: {error}")
                skipped.append({"job": candidate, "error": str(error)})
                continue

            item = dict(candidate)
            item["id"] = job.id
            item["description"] = clean_description(job.description)
            if analysis is not None:
                item.update(
                    {
                        "score": analysis.score.score,
                        "stream": analysis.stream,
                        "fit_category": analysis.fit_category,
                        "dimensions": analysis.score.dimensions,
                        "matched_skills": analysis.score.matched_skills,
                        "missing_skills": analysis.score.missing_skills,
                    }
                )
            materialized.append(item)

        with self._lock:
            self.last_skipped_jobs = skipped
        return materialized

    def upsert_jobs(self, fresh_jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Merge fresh jobs into in-memory collection and update repository."""
        with self._lock:
            existing_ids = set(self._jobs_by_id.keys())
            merged = list(self._jobs)
            added = []
            for job in fresh_jobs:
                jid = str(job.get("id") or "").strip()
                if jid and jid not in existing_ids:
                    merged.append(job)
                    existing_ids.add(jid)
                    added.append(job)
            self._jobs = merged
            self._rebuild_indices()
            self.save_jobs()

        if self.repository and fresh_jobs:
            try:
                self.repository.replace_jobs(fresh_jobs)
            except Exception as repo_err:
                logger.warning(f"Error persisting fresh jobs to repository: {repo_err}")

        return self.get_jobs()
