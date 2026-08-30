from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db_pool import get_connection_pool, get_db_connection
from .logging import get_logger

logger = get_logger("job_dashboard.repository")

STATUSES = ("sourced", "shortlisted", "applied", "interviewing", "offer", "rejected")


class JobRepository:
    """SQLite persistence for jobs, Kanban status, and application events."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        self.pool = get_connection_pool(self.path)
        
        # Initialize database schema
        self._init_schema()
        
        logger.info(f"JobRepository initialized for {self.path}")

    def _init_schema(self):
        """Initialize database schema."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
                    location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
                    remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
                    data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted);
                CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
                CREATE INDEX IF NOT EXISTS idx_jobs_stream ON jobs(stream);
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS application_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
                    from_status TEXT, to_status TEXT NOT NULL, occurred_at TEXT NOT NULL,
                    FOREIGN KEY(job_id) REFERENCES jobs(id)
                );
                CREATE TABLE IF NOT EXISTS query_scrape_cache (
                    query_key TEXT PRIMARY KEY,
                    term TEXT NOT NULL,
                    location TEXT NOT NULL,
                    last_scraped_at TEXT NOT NULL,
                    result_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_query_cache_term ON query_scrape_cache(term);
            """)
            conn.commit()
            logger.debug(f"Database schema initialized for {self.path}")

    def is_query_cached(self, term: str, location: str = "", ttl_hours: float = 12.0) -> bool:
        """Check if a search query has been scraped recently to prevent redundant scraping."""
        if not term:
            return True
        key = f"{term.strip().lower()}___{(location or '').strip().lower()}"
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT last_scraped_at, result_count FROM query_scrape_cache WHERE query_key = ?", (key,)).fetchone()
            if not row:
                return False
            try:
                scraped_dt = datetime.fromisoformat(row["last_scraped_at"])
                if scraped_dt.tzinfo is None:
                    scraped_dt = scraped_dt.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - scraped_dt).total_seconds() / 3600.0
                return age_hours < ttl_hours
            except Exception:
                return False

    def record_query_scrape(self, term: str, location: str = "", result_count: int = 0) -> None:
        """Record that a query term was freshly scraped with timestamp."""
        if not term:
            return
        key = f"{term.strip().lower()}___{(location or '').strip().lower()}"
        now = datetime.now(timezone.utc).isoformat()
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute("""
                    INSERT INTO query_scrape_cache (query_key, term, location, last_scraped_at, result_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(query_key) DO UPDATE SET
                        last_scraped_at = excluded.last_scraped_at,
                        result_count = excluded.result_count
                """, (key, term.strip(), (location or "").strip(), now, result_count, now))


    def replace_jobs(self, jobs: list[dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        start_time = datetime.now()
        
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                for job in jobs:
                    conn.execute("""
                        INSERT INTO jobs (id,title,company,location,description,source,url,posted,remote,stream,score,data_json,created_at,updated_at)
                        VALUES (:id,:title,:company,:location,:description,:source,:url,:posted,:remote,:stream,:score,:data_json,:created_at,:updated_at)
                        ON CONFLICT(id) DO UPDATE SET title=excluded.title, company=excluded.company,
                        location=excluded.location, description=excluded.description, source=excluded.source,
                        url=excluded.url, posted=excluded.posted, remote=excluded.remote, stream=excluded.stream,
                        score=excluded.score, data_json=excluded.data_json, updated_at=excluded.updated_at
                    """, {
                        "id": str(job.get("id") or f"{job.get('company', '')}_{job.get('title', '')}"),
                        "title": str(job.get("title") or "Unknown Title"),
                        "company": str(job.get("company") or "Unknown Company"),
                        "location": str(job.get("location") or "Melbourne, VIC"),
                        "description": str(job.get("description") or ""),
                        "source": str(job.get("source") or "Job Board"),
                        "url": str(job.get("url") or job.get("link") or ""),
                        "posted": str(job.get("posted") or job.get("date") or ""),
                        "remote": int(bool(job.get("remote", False))),
                        "stream": str(job.get("stream") or "core-it"),
                        "score": int(job.get("score") or 0),
                        "data_json": json.dumps(job, ensure_ascii=False),
                        "created_at": now,
                        "updated_at": now
                    })

        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Replaced {len(jobs)} jobs in {duration:.3f}s")

    def list_jobs(self, *, location="", salary_min=None, role="", source="", match_score_min=0, stream="", status="") -> list[dict[str, Any]]:
        start_time = datetime.now()
        
        clauses = ["score >= ?"]
        values: list[Any] = [match_score_min]
        for field, value in (("location", location), ("source", source), ("stream", stream), ("status", status)):
            if value:
                clauses.append(f"lower({field}) LIKE lower(?)")
                values.append(f"%{value}%")
        if role:
            clauses.append("(lower(title) LIKE lower(?) OR lower(company) LIKE lower(?) OR lower(description) LIKE lower(?))")
            values.extend([f"%{role}%", f"%{role}%", f"%{role}%"])
        
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(f"SELECT * FROM jobs WHERE {' AND '.join(clauses)} ORDER BY score DESC, posted DESC", values).fetchall()
        
        result = []
        for row in rows:
            job = json.loads(row["data_json"])
            if salary_min is not None and self._salary_amount(job.get("salary", "")) < salary_min:
                continue
            job["status"] = row["status"]
            result.append(job)
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.debug(f"Listed {len(result)} jobs in {duration:.3f}s")
        
        return result

    @staticmethod
    def _salary_amount(value: Any) -> float:
        """Extract a comparable lower salary bound from provider text."""
        text = str(value or "")
        numbers = []
        for match in re.finditer(r"(\d[\d,]*(?:\.\d+)?)\s*(k|m)?", text, re.IGNORECASE):
            number = float(match.group(1).replace(",", ""))
            multiplier = match.group(2)
            if multiplier:
                number *= 1000 if multiplier.lower() == "k" else 1000000
            numbers.append(number)
        super_match = re.search(r"\d+(?:\.\d+)?\s*%\s*(?:super|superannuation)", text, re.IGNORECASE)
        if super_match:
            numbers = [number for number in numbers if number != float(re.search(r"\d+(?:\.\d+)?", super_match.group()).group())]
        return min(numbers) if numbers else 0.0

    def update_status(self, job_id: str, status: str) -> dict[str, Any]:
        start_time = datetime.now()
        
        if status not in STATUSES:
            raise ValueError(f"invalid status: {status}")
        
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get current status
            row = conn.execute("SELECT status FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if row is None:
                raise KeyError(job_id)
            
            # Update status and record event
            now = datetime.now(timezone.utc).isoformat()
            with conn:
                conn.execute("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?", (status, now, job_id))
                conn.execute("INSERT INTO application_events (job_id,from_status,to_status,occurred_at) VALUES (?,?,?,?)", (job_id, row["status"], status, now))
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Updated job {job_id} status to {status} in {duration:.3f}s")
        
        return {"job_id": job_id, "status": status}

    def metrics(self) -> dict[str, Any]:
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get status counts
            rows = conn.execute("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status").fetchall()
            counts = {status: 0 for status in STATUSES}
            counts.update({row["status"]: row["count"] for row in rows})
            total = sum(counts.values())
            
            # Get event count
            event_count = conn.execute("SELECT COUNT(*) FROM application_events").fetchone()[0]
            
            return {"total": total, "by_status": counts, "events": event_count}
