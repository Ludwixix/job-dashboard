import hashlib
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


def generate_dedupe_key(company: str, title: str, url: str) -> str:
    """Generate deterministic deduplication key for a job listing."""
    norm = f"{(company or '').strip().lower()}|{(title or '').strip().lower()}|{(url or '').strip().lower()}"
    return hashlib.sha256(norm.encode('utf-8')).hexdigest()[:24]


class JobRepository:
    """SQLite persistence for jobs, Kanban status, and application events."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        self.pool = get_connection_pool(self.path)
        
        # Initialize database schema
        self._init_schema()
        
        logger.info(f"JobRepository initialized for {self.path}")

    def get_connection(self):
        """Get a database connection from the pool."""
        return get_db_connection(self.path)

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
                CREATE TABLE IF NOT EXISTS user_applications (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'sourced',
                    notes TEXT DEFAULT '',
                    resume_text TEXT DEFAULT '',
                    cover_letter_text TEXT DEFAULT '',
                    resume_url TEXT DEFAULT '',
                    cover_letter_url TEXT DEFAULT '',
                    applied_at TEXT,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, job_id)
                );
                CREATE INDEX IF NOT EXISTS idx_user_apps_user ON user_applications(user_id);
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

    def upsert_scraped_jobs(self, raw_jobs: list[dict[str, Any]]) -> int:
        """Upsert a list of scraped jobs into the database with deduplication."""
        now = datetime.now(timezone.utc).isoformat()
        inserted_or_updated = 0
        
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                for job in raw_jobs:
                    company = str(job.get("company") or "").strip()
                    title = str(job.get("title") or "").strip()
                    url = str(job.get("url") or job.get("link") or job.get("portalLink") or "").strip()
                    
                    if not company and not title:
                        continue
                        
                    dedupe_id = job.get("id") or generate_dedupe_key(company, title, url)
                    location = str(job.get("location") or "Melbourne, VIC").strip()
                    source = str(job.get("source") or "Job Board").strip()
                    description = str(job.get("description") or job.get("notes") or "").strip()
                    posted = str(job.get("posted") or job.get("date") or "").strip()
                    remote = 1 if bool(job.get("remote", False)) or "remote" in location.lower() else 0
                    stream = str(job.get("stream") or job.get("industry") or "core-it").strip()
                    score = int(job.get("score") or 0)
                    
                    # Store clean standardized job dictionary in data_json
                    clean_job = dict(job)
                    clean_job["id"] = dedupe_id
                    clean_job["company"] = company
                    clean_job["title"] = title
                    clean_job["location"] = location
                    clean_job["source"] = source
                    clean_job["url"] = url
                    clean_job["portalLink"] = url
                    clean_job["date"] = posted
                    clean_job["posted"] = posted
                    clean_job["remote"] = bool(remote)
                    clean_job["stream"] = stream
                    clean_job["score"] = score
                    clean_job["description"] = description
                    
                    conn.execute("""
                        INSERT INTO jobs (id, title, company, location, description, source, url, posted, remote, stream, score, data_json, status, created_at, updated_at)
                        VALUES (:id, :title, :company, :location, :description, :source, :url, :posted, :remote, :stream, :score, :data_json, 'sourced', :created_at, :updated_at)
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            company = excluded.company,
                            location = excluded.location,
                            description = excluded.description,
                            source = excluded.source,
                            url = excluded.url,
                            posted = excluded.posted,
                            remote = excluded.remote,
                            stream = excluded.stream,
                            score = CASE WHEN excluded.score > 0 THEN excluded.score ELSE jobs.score END,
                            data_json = excluded.data_json,
                            updated_at = excluded.updated_at
                    """, {
                        "id": dedupe_id,
                        "title": title or "Untitled Role",
                        "company": company or "Confidential",
                        "location": location,
                        "description": description,
                        "source": source,
                        "url": url,
                        "posted": posted,
                        "remote": remote,
                        "stream": stream,
                        "score": score,
                        "data_json": json.dumps(clean_job, ensure_ascii=False),
                        "created_at": now,
                        "updated_at": now
                    })
                    inserted_or_updated += 1
                    
        logger.info(f"Upserted {inserted_or_updated} scraped jobs into database")
        return inserted_or_updated

    def query_jobs_paginated(
        self,
        page: int = 1,
        page_size: int = 50,
        search: str = "",
        industry: str = "",
        remote: bool | None = None,
        sort_by: str = "newest"
    ) -> dict[str, Any]:
        """Query jobs with database-level pagination, search filtering, and sorting."""
        page = max(1, int(page))
        page_size = max(1, min(10000, int(page_size)))
        offset = (page - 1) * page_size
        
        clauses = ["1=1"]
        params: list[Any] = []
        
        if search:
            search_pattern = f"%{search.strip().lower()}%"
            clauses.append("(lower(title) LIKE ? OR lower(company) LIKE ? OR lower(location) LIKE ? OR lower(description) LIKE ?)")
            params.extend([search_pattern, search_pattern, search_pattern, search_pattern])
            
        if industry and industry.lower() != "all":
            clauses.append("(lower(stream) LIKE ? OR lower(data_json) LIKE ?)")
            params.extend([f"%{industry.strip().lower()}%", f"%{industry.strip().lower()}%"])
            
        if remote is not None:
            clauses.append("remote = ?")
            params.append(1 if remote else 0)
            
        where_sql = " AND ".join(clauses)
        
        # Determine sort order
        if sort_by == "score":
            order_sql = "score DESC, posted DESC"
        elif sort_by == "company":
            order_sql = "company ASC, posted DESC"
        elif sort_by == "title":
            order_sql = "title ASC, posted DESC"
        else: # newest
            order_sql = "posted DESC, created_at DESC"
            
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Count total matching rows
            count_row = conn.execute(f"SELECT COUNT(*) AS total FROM jobs WHERE {where_sql}", params).fetchone()
            total_count = count_row["total"] if count_row else 0
            
            # Fetch slice
            query_sql = f"SELECT data_json, status, created_at, updated_at FROM jobs WHERE {where_sql} ORDER BY {order_sql} LIMIT ? OFFSET ?"
            query_params = params + [page_size, offset]
            rows = conn.execute(query_sql, query_params).fetchall()
            
        jobs = []
        for row in rows:
            try:
                job_data = json.loads(row["data_json"])
                job_data["status"] = row["status"]
                jobs.append(job_data)
            except Exception:
                continue
                
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        
        return {
            "jobs": jobs,
            "total": total_count,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages
        }

    def get_user_applications(self, user_id: str) -> list[dict[str, Any]]:
        """Fetch private application tracking records for a specific authenticated user."""
        if not user_id:
            return []
            
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                       resume_url, cover_letter_url, applied_at, updated_at
                FROM user_applications
                WHERE user_id = ?
                ORDER BY updated_at DESC
            """, (user_id,)).fetchall()
            
        return [dict(row) for row in rows]

    def upsert_user_application(self, user_id: str, job_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create or update a user's private application tracking record."""
        now = datetime.now(timezone.utc).isoformat()
        app_id = data.get("id") or f"app_{user_id[:8]}_{job_id}"
        status = data.get("status") or "sourced"
        notes = str(data.get("notes") or "").strip()
        resume_text = str(data.get("resume_text") or "").strip()
        cover_letter_text = str(data.get("cover_letter_text") or "").strip()
        resume_url = str(data.get("resume_url") or "").strip()
        cover_letter_url = str(data.get("cover_letter_url") or "").strip()
        applied_at = data.get("applied_at") or (now if status == "applied" else None)
        
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                conn.execute("""
                    INSERT INTO user_applications (
                        id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                        resume_url, cover_letter_url, applied_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, job_id) DO UPDATE SET
                        status = excluded.status,
                        notes = excluded.notes,
                        resume_text = CASE WHEN excluded.resume_text != '' THEN excluded.resume_text ELSE user_applications.resume_text END,
                        cover_letter_text = CASE WHEN excluded.cover_letter_text != '' THEN excluded.cover_letter_text ELSE user_applications.cover_letter_text END,
                        resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE user_applications.resume_url END,
                        cover_letter_url = CASE WHEN excluded.cover_letter_url != '' THEN excluded.cover_letter_url ELSE user_applications.cover_letter_url END,
                        applied_at = CASE WHEN excluded.applied_at IS NOT NULL THEN excluded.applied_at ELSE user_applications.applied_at END,
                        updated_at = excluded.updated_at
                """, (
                    app_id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                    resume_url, cover_letter_url, applied_at, now
                ))
                
                # Also log to application_events
                conn.execute("""
                    INSERT INTO application_events (job_id, from_status, to_status, occurred_at)
                    VALUES (?, 'user_action', ?, ?)
                """, (job_id, status, now))
                
        return {
            "id": app_id,
            "user_id": user_id,
            "job_id": job_id,
            "status": status,
            "notes": notes,
            "resume_text": resume_text,
            "cover_letter_text": cover_letter_text,
            "resume_url": resume_url,
            "cover_letter_url": cover_letter_url,
            "applied_at": applied_at,
            "updated_at": now
        }

    def delete_user_application(self, user_id: str, job_id: str) -> bool:
        """Remove a user's tracking entry for a job."""
        with get_db_connection(self.path) as conn:
            with conn:
                cur = conn.execute("DELETE FROM user_applications WHERE user_id = ? AND job_id = ?", (user_id, job_id))
                return cur.rowcount > 0

