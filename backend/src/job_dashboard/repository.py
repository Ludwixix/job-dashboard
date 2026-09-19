import hashlib
import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db_pool import get_connection_pool, get_db_connection
from .logging import get_logger

logger = get_logger("job_dashboard.repository")

STATUSES = ("sourced", "shortlisted", "applied", "interviewing", "offer", "rejected")


def generate_dedupe_key(company: str, title: str, url: str, location: str = "") -> str:
    """Generate a canonical cross-source key while retaining URL-only fallbacks."""
    normalized_company = re.sub(
        r"[^a-z0-9]",
        "",
        re.sub(
            r"\b(pty|ltd|limited|inc|corporation|corp|australia|group|services|technologies|solutions|holdings)\b",
            "",
            (company or "").strip().lower(),
        ),
    )
    normalized_title = re.sub(r"[^a-z0-9]", "", (title or "").strip().lower())
    normalized_location = re.sub(r"[^a-z0-9]", "", (location or "").strip().lower())
    identity = "|".join((normalized_company, normalized_title, normalized_location))
    norm = (
        identity
        if normalized_company and normalized_title
        else f"{identity}|{(url or '').strip().lower()}"
    )
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:24]


class JobRepository:
    """SQLite persistence for jobs, Kanban status, and application events."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        self.pool = get_connection_pool(self.path)
        self._public_jobs_cache = None
        self._public_jobs_cache_time = 0.0

        # Initialize database schema
        self._init_schema()

        logger.info(f"JobRepository initialized for {self.path}")

    def get_connection(self):
        """Get a database connection from the pool."""
        return get_db_connection(self.path)

    def _check_and_recover_db(self):
        """Run PRAGMA integrity_check on a direct connection (bypassing the pool).

        If the DB is malformed, close all pool connections, delete the file, and
        let _init_schema recreate a fresh empty database.
        """
        import os

        db_path = self.path
        corrupt = False
        # Open a *direct* connection — not via the pool — so we can fully close it
        try:
            conn = sqlite3.connect(db_path, check_same_thread=False, timeout=5.0)
            try:
                result = conn.execute("PRAGMA integrity_check").fetchone()
                if result and result[0] != "ok":
                    logger.error(
                        f"DB integrity check failed: '{result[0]}' at {db_path}. "
                        "Will delete and recreate."
                    )
                    corrupt = True
            finally:
                conn.close()
        except Exception as exc:
            logger.error(
                f"DB integrity check raised {exc!r} at {db_path}. Will delete and recreate."
            )
            corrupt = True

        if corrupt:
            # Flush the pool so no cached connections point to the corrupt file
            from .db_pool import get_connection_pool

            pool = get_connection_pool(db_path)
            pool.cleanup(log_cleanup=False)
            try:
                os.remove(db_path)
                logger.info(
                    f"Deleted corrupt DB at {db_path}. Fresh schema will be created."
                )
            except FileNotFoundError:
                pass

    def _init_schema(self):
        """Initialize database schema, auto-recovering from corruption."""
        self._check_and_recover_db()
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA busy_timeout=5000;")
            conn.execute("PRAGMA synchronous=NORMAL;")
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
                    created_at TEXT NOT NULL,
                    google_id TEXT DEFAULT '',
                    picture TEXT DEFAULT '',
                    passkey_id TEXT DEFAULT '',
                    email_verified INTEGER DEFAULT 0,
                    email_verification_code TEXT DEFAULT '',
                    email_verification_expires_at TEXT DEFAULT ''
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
                    job_data_json TEXT DEFAULT '{}',
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, job_id)
                );
                CREATE INDEX IF NOT EXISTS idx_user_apps_user ON user_applications(user_id);
                CREATE TABLE IF NOT EXISTS application_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
                    from_status TEXT, to_status TEXT NOT NULL, occurred_at TEXT NOT NULL,
                    FOREIGN KEY(job_id) REFERENCES jobs(id)
                );
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    profile_data_json TEXT NOT NULL DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id TEXT PRIMARY KEY,
                    prefs_json TEXT NOT NULL DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS generated_documents (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    content_text TEXT NOT NULL,
                    model_name TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_gen_docs_user_job ON generated_documents(user_id, job_id);
                CREATE TABLE IF NOT EXISTS job_psychology (
                    job_id TEXT PRIMARY KEY,
                    company TEXT DEFAULT '',
                    title TEXT DEFAULT '',
                    insights_json TEXT NOT NULL DEFAULT '{}',
                    model_name TEXT DEFAULT '',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS job_intelligence (
                    job_id TEXT NOT NULL,
                    tool_key TEXT NOT NULL,
                    intelligence_json TEXT NOT NULL DEFAULT '{}',
                    model_name TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(job_id, tool_key)
                );
                CREATE INDEX IF NOT EXISTS idx_job_intel_job ON job_intelligence(job_id);
                CREATE TABLE IF NOT EXISTS interview_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    company TEXT DEFAULT '',
                    title TEXT DEFAULT '',
                    session_data_json TEXT NOT NULL DEFAULT '{}',
                    score REAL DEFAULT 0.0,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_interview_user_job ON interview_sessions(user_id, job_id);
                CREATE TABLE IF NOT EXISTS query_scrape_cache (
                    query_key TEXT PRIMARY KEY,
                    term TEXT NOT NULL,
                    location TEXT NOT NULL,
                    last_scraped_at TEXT NOT NULL,
                    result_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_query_cache_term ON query_scrape_cache(term);
                CREATE TABLE IF NOT EXISTS user_saved_searches (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    query_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, name)
                );
                CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON user_saved_searches(user_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS application_reminders (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    reminder_type TEXT NOT NULL,
                    remind_at TEXT NOT NULL,
                    dismissed_at TEXT,
                    details_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_reminders_due ON application_reminders(user_id, remind_at, dismissed_at);
                CREATE TABLE IF NOT EXISTS network_contacts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'default_user',
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT '',
                    organization TEXT NOT NULL DEFAULT '',
                    contact_type TEXT NOT NULL DEFAULT 'agency_recruiter',
                    sector TEXT NOT NULL DEFAULT 'technology',
                    email TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    linkedin_url TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    relationship_health TEXT NOT NULL DEFAULT 'warm',
                    cadence_frequency_days INTEGER NOT NULL DEFAULT 14,
                    last_interaction_date TEXT,
                    next_follow_up_date TEXT,
                    associated_job_ids_json TEXT NOT NULL DEFAULT '[]',
                    interactions_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_net_contacts_user ON network_contacts(user_id);
                CREATE INDEX IF NOT EXISTS idx_net_contacts_health ON network_contacts(relationship_health);
                CREATE INDEX IF NOT EXISTS idx_net_contacts_followup ON network_contacts(next_follow_up_date);
                CREATE TABLE IF NOT EXISTS candidate_matches (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    score INTEGER NOT NULL DEFAULT 0,
                    fit TEXT NOT NULL DEFAULT 'moderate',
                    reasons_json TEXT NOT NULL DEFAULT '[]',
                    matched_at TEXT NOT NULL,
                    reviewed INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'matched',
                    UNIQUE(user_id, job_id)
                );
                CREATE INDEX IF NOT EXISTS idx_matches_user_score ON candidate_matches(user_id, score DESC);
                CREATE TABLE IF NOT EXISTS feature_flags (
                    key TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    description TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS provider_cookies (
                    provider TEXT PRIMARY KEY,
                    headers_json TEXT NOT NULL DEFAULT '{}',
                    cookies_json TEXT NOT NULL DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    stripe_customer_id TEXT DEFAULT '',
                    stripe_subscription_id TEXT DEFAULT '',
                    plan_tier TEXT NOT NULL DEFAULT 'free',
                    status TEXT NOT NULL DEFAULT 'inactive',
                    current_period_start TEXT NOT NULL,
                    current_period_end TEXT NOT NULL,
                    cancel_at_period_end INTEGER DEFAULT 0,
                    monthly_token_allowance INTEGER DEFAULT 500000,
                    trial_generations_remaining INTEGER DEFAULT 3,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );
                CREATE INDEX IF NOT EXISTS idx_user_subs_user ON user_subscriptions(user_id);
                CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_cust ON user_subscriptions(stripe_customer_id);
                CREATE TABLE IF NOT EXISTS user_token_ledger (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    billing_period_month TEXT NOT NULL,
                    prompt_tokens INTEGER DEFAULT 0,
                    completion_tokens INTEGER DEFAULT 0,
                    total_tokens INTEGER DEFAULT 0,
                    cost_usd REAL DEFAULT 0.0,
                    call_count INTEGER DEFAULT 0,
                    last_call_at TEXT NOT NULL,
                    UNIQUE(user_id, billing_period_month),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );
                CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON user_token_ledger(user_id);
            """)
            for col_sql in [
                "ALTER TABLE user_applications ADD COLUMN job_data_json TEXT DEFAULT '{}'",
                "ALTER TABLE user_applications ADD COLUMN company_domain TEXT DEFAULT ''",
                "ALTER TABLE user_applications ADD COLUMN application_ref_id TEXT DEFAULT ''",
                "ALTER TABLE user_applications ADD COLUMN email_thread_id TEXT DEFAULT ''",
                "ALTER TABLE user_applications ADD COLUMN last_scanned_at TEXT DEFAULT ''",
                "ALTER TABLE user_applications ADD COLUMN last_email_subject TEXT DEFAULT ''",
                "ALTER TABLE user_applications ADD COLUMN last_email_date TEXT DEFAULT ''",
                "ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''",
                "ALTER TABLE users ADD COLUMN picture TEXT DEFAULT ''",
                "ALTER TABLE users ADD COLUMN passkey_id TEXT DEFAULT ''",
                "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN email_verification_code TEXT DEFAULT ''",
                "ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT DEFAULT ''",
            ]:
                try:
                    conn.execute(col_sql)
                except sqlite3.OperationalError:
                    pass

            default_flags = [
                (
                    "automated_gmail_sync",
                    1,
                    "Autonomous background tracking and status updating via Gmail",
                ),
                (
                    "candidate_matching_engine",
                    1,
                    "Dual-layer candidate intake scoring and automated staging",
                ),
                (
                    "stream_classifier_v3",
                    1,
                    "High-precision multi-industry career classification engine",
                ),
                (
                    "headless_scrapers",
                    1,
                    "Scheduled headless web scrapers with automatic backoff",
                ),
                (
                    "instant_asset_generation",
                    1,
                    "One-click resume and cover letter synthesis",
                ),
            ]
            now_iso = datetime.now(timezone.utc).isoformat()
            for k, en, desc in default_flags:
                conn.execute(
                    "INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at) VALUES (?, ?, ?, ?)",
                    (k, en, desc, now_iso),
                )
            conn.commit()
            logger.debug(f"Database schema initialized for {self.path}")

    def count_jobs(self) -> int:
        """Return total count of jobs currently in database."""
        with get_db_connection(self.path) as conn:
            row = conn.execute("SELECT COUNT(*) AS total FROM jobs").fetchone()
            return int(row[0]) if row else 0

    def is_query_cached(
        self, term: str, location: str = "", ttl_hours: float = 12.0
    ) -> bool:
        """Check if a search query has been scraped recently to prevent redundant scraping."""
        if not term:
            return True
        key = f"{term.strip().lower()}___{(location or '').strip().lower()}"
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT last_scraped_at, result_count FROM query_scrape_cache WHERE query_key = ?",
                (key,),
            ).fetchone()
            if not row:
                return False
            try:
                scraped_dt = datetime.fromisoformat(row["last_scraped_at"])
                if scraped_dt.tzinfo is None:
                    scraped_dt = scraped_dt.replace(tzinfo=timezone.utc)
                age_hours = (
                    datetime.now(timezone.utc) - scraped_dt
                ).total_seconds() / 3600.0
                result_count = int(row["result_count"] or 0)
                # If zero jobs were returned previously (e.g. temporary scraper glitch or empty),
                # allow re-scrape after 5 minutes (0.08 hours) instead of locking out for 12 hours.
                effective_ttl = 0.08 if result_count <= 0 else ttl_hours
                return age_hours < effective_ttl
            except Exception:
                return False

    def record_query_scrape(
        self, term: str, location: str = "", result_count: int = 0
    ) -> None:
        """Record that a query term was freshly scraped with timestamp."""
        if not term:
            return
        key = f"{term.strip().lower()}___{(location or '').strip().lower()}"
        now = datetime.now(timezone.utc).isoformat()
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO query_scrape_cache (query_key, term, location, last_scraped_at, result_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(query_key) DO UPDATE SET
                        last_scraped_at = excluded.last_scraped_at,
                        result_count = excluded.result_count
                """,
                    (
                        key,
                        term.strip(),
                        (location or "").strip(),
                        now,
                        result_count,
                        now,
                    ),
                )

    def replace_jobs(self, jobs: list[dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        start_time = datetime.now()

        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                for job in jobs:
                    conn.execute(
                        """
                        INSERT INTO jobs (id,title,company,location,description,source,url,posted,remote,stream,score,data_json,created_at,updated_at)
                        VALUES (:id,:title,:company,:location,:description,:source,:url,:posted,:remote,:stream,:score,:data_json,:created_at,:updated_at)
                        ON CONFLICT(id) DO UPDATE SET title=excluded.title, company=excluded.company,
                        location=excluded.location, description=excluded.description, source=excluded.source,
                        url=excluded.url, posted=excluded.posted, remote=excluded.remote, stream=excluded.stream,
                        score=excluded.score, data_json=excluded.data_json, updated_at=excluded.updated_at
                    """,
                        {
                            "id": str(
                                job.get("id")
                                or f"{job.get('company', '')}_{job.get('title', '')}"
                            ),
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
                            "updated_at": now,
                        },
                    )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Replaced {len(jobs)} jobs in {duration:.3f}s")

    def list_jobs(
        self,
        *,
        location="",
        salary_min=None,
        role="",
        source="",
        match_score_min=0,
        stream="",
        status="",
    ) -> list[dict[str, Any]]:
        start_time = datetime.now()

        clauses = ["score >= ?"]
        values: list[Any] = [match_score_min]
        for field, value in (
            ("location", location),
            ("source", source),
            ("stream", stream),
            ("status", status),
        ):
            if value:
                clauses.append(f"lower({field}) LIKE lower(?)")
                values.append(f"%{value}%")
        if role:
            clauses.append(
                "(lower(title) LIKE lower(?) OR lower(company) LIKE lower(?) OR lower(description) LIKE lower(?))"
            )
            values.extend([f"%{role}%", f"%{role}%", f"%{role}%"])

        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                f"SELECT * FROM jobs WHERE {' AND '.join(clauses)} ORDER BY score DESC, posted DESC",
                values,
            ).fetchall()

        result = []
        for row in rows:
            job = json.loads(row["data_json"])
            if (
                salary_min is not None
                and self._salary_amount(job.get("salary", "")) < salary_min
            ):
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
        super_match = re.search(
            r"\d+(?:\.\d+)?\s*%\s*(?:super|superannuation)", text, re.IGNORECASE
        )
        if super_match:
            numbers = [
                number
                for number in numbers
                if number
                != float(re.search(r"\d+(?:\.\d+)?", super_match.group()).group())
            ]
        return min(numbers) if numbers else 0.0

    def update_status(self, job_id: str, status: str) -> dict[str, Any]:
        start_time = datetime.now()

        if status not in STATUSES:
            raise ValueError(f"invalid status: {status}")

        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row

            # Get current status
            row = conn.execute(
                "SELECT status FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
            if row is None:
                raise KeyError(job_id)

            # Update status and record event
            now = datetime.now(timezone.utc).isoformat()
            with conn:
                conn.execute(
                    "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?",
                    (status, now, job_id),
                )
                conn.execute(
                    "INSERT INTO application_events (job_id,from_status,to_status,occurred_at) VALUES (?,?,?,?)",
                    (job_id, row["status"], status, now),
                )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Updated job {job_id} status to {status} in {duration:.3f}s")
        self._public_jobs_cache = None
        self._public_jobs_cache_time = 0.0

        return {"job_id": job_id, "status": status}

    def hourly_metrics(self, hours: int = 24) -> dict[str, Any]:
        """Calculates hourly job additions and recent discovery velocity."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row

            # 1. Jobs added in the last 1 hour
            last_hour_row = conn.execute("""
                SELECT COUNT(*) AS count
                FROM jobs
                WHERE substr(created_at, 1, 19) >= strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-1 hour'))
            """).fetchone()
            added_last_hour = int(last_hour_row["count"]) if last_hour_row else 0

            # 2. Jobs added in the past 24 hours
            past_24h_row = conn.execute("""
                SELECT COUNT(*) AS count
                FROM jobs
                WHERE substr(created_at, 1, 19) >= strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours'))
            """).fetchone()
            added_past_24h = int(past_24h_row["count"]) if past_24h_row else 0

            # 3. Hourly breakdown for the specified time window
            hours_limit = max(1, min(hours, 168))  # max 7 days
            breakdown_rows = conn.execute(f"""
                SELECT 
                    strftime('%Y-%m-%dT%H:00:00Z', substr(created_at, 1, 19)) AS hour,
                    COUNT(*) AS count
                FROM jobs
                WHERE substr(created_at, 1, 19) >= strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-{hours_limit} hours'))
                GROUP BY hour
                ORDER BY hour DESC
            """).fetchall()

            breakdown = [
                {"hour": row["hour"], "count": int(row["count"])}
                for row in breakdown_rows
            ]

            return {
                "added_last_hour": added_last_hour,
                "added_past_24h": added_past_24h,
                "hourly_breakdown": breakdown,
            }

    def metrics(self) -> dict[str, Any]:
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row

            # Get status counts
            rows = conn.execute(
                "SELECT status, COUNT(*) AS count FROM jobs GROUP BY status"
            ).fetchall()
            counts = {status: 0 for status in STATUSES}
            counts.update({row["status"]: row["count"] for row in rows})
            total = sum(counts.values())

            # Get event count
            event_count = conn.execute(
                "SELECT COUNT(*) FROM application_events"
            ).fetchone()[0]

        hourly = self.hourly_metrics(hours=24)
        return {
            "total": total,
            "by_status": counts,
            "events": event_count,
            "hourly_ingestion": hourly,
        }

    def upsert_scraped_jobs(self, raw_jobs: list[dict[str, Any]]) -> int:
        """Upsert a list of scraped jobs into the database with high-performance batch executemany."""
        if not raw_jobs:
            return 0
        now = datetime.now(timezone.utc).isoformat()

        batch_params = []
        for job in raw_jobs:
            company = str(job.get("company") or "").strip()
            title = str(job.get("title") or "").strip()
            url = str(
                job.get("url") or job.get("link") or job.get("portalLink") or ""
            ).strip()

            if not company and not title:
                continue

            location = str(job.get("location") or "Melbourne, VIC").strip()
            dedupe_id = job.get("id") or generate_dedupe_key(
                company, title, url, location
            )
            source = str(job.get("source") or "Job Board").strip()
            description = str(job.get("description") or job.get("notes") or "").strip()
            from .sources import canonical_posted_date

            posted = canonical_posted_date(job.get("posted") or job.get("date") or "")
            is_remote_flag = (
                bool(job.get("remote", False))
                or str(job.get("work_mode", "")).lower() in ("remote", "hybrid")
                or "remote" in f"{location} {title}".lower()
                or "wfh" in f"{location} {title}".lower()
                or "work from home" in f"{location} {title}".lower()
                or any("remote" in str(t).lower() for t in (job.get("tags") or ()))
            )
            remote = 1 if is_remote_flag else 0
            stream = str(job.get("stream") or job.get("industry") or "core-it").strip()
            score = int(job.get("score") or 0)

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
            clean_job["remote"] = bool(is_remote_flag)
            clean_job["stream"] = stream
            clean_job["score"] = score
            clean_job["description"] = description

            batch_params.append(
                {
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
                    "updated_at": now,
                }
            )

        if not batch_params:
            return 0

        start_time = datetime.now()
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                conn.executemany(
                    """
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
                """,
                    batch_params,
                )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Batch upserted {len(batch_params)} scraped jobs in {duration:.3f}s"
        )
        self._public_jobs_cache = None
        self._public_jobs_cache_time = 0.0
        return len(batch_params)

    def query_jobs_paginated(
        self,
        page: int = 1,
        page_size: int = 50,
        search: str = "",
        industry: str = "",
        remote: bool | None = None,
        sort_by: str = "newest",
    ) -> dict[str, Any]:
        """Query jobs with database-level pagination, search filtering, and sorting."""
        page = max(1, int(page))
        page_size = max(1, min(500, int(page_size)))
        offset = (page - 1) * page_size

        is_default_query = (
            not search
            and (not industry or industry.lower() == "all")
            and remote is None
        )
        if (
            is_default_query
            and self._public_jobs_cache is not None
            and (time.time() - self._public_jobs_cache_time < 300)
        ):
            jobs = [dict(j) for j in self._public_jobs_cache]
        else:
            # Gmail messages are workflow records, not public job listings.
            clauses = ["lower(source) != 'gmail'"]
            params: list[Any] = []

            if search:
                search_pattern = f"%{search.strip().lower()}%"
                clauses.append(
                    "(lower(title) LIKE ? OR lower(company) LIKE ? OR lower(location) LIKE ? OR lower(description) LIKE ? OR lower(source) LIKE ?)"
                )
                params.extend(
                    [
                        search_pattern,
                        search_pattern,
                        search_pattern,
                        search_pattern,
                        search_pattern,
                    ]
                )

            if industry and industry.lower() != "all":
                clauses.append("(lower(stream) LIKE ? OR lower(data_json) LIKE ?)")
                params.extend(
                    [f"%{industry.strip().lower()}%", f"%{industry.strip().lower()}%"]
                )

            if remote is not None:
                clauses.append("remote = ?")
                params.append(1 if remote else 0)

            where_sql = " AND ".join(clauses)

            with get_db_connection(self.path) as conn:
                conn.row_factory = sqlite3.Row

                # Public job reads are intentionally materialized and filtered in
                # Python: SQLite's lexical ORDER BY would place values such as
                # "Featured" above ISO dates, and it cannot reliably interpret
                # provider-relative values such as "9d ago". This also keeps
                # workflow/email records out of the public index.
                rows = conn.execute(
                    f"SELECT data_json, status, created_at, updated_at FROM jobs WHERE {where_sql}",
                    params,
                ).fetchall()

            jobs = []
            for row in rows:
                try:
                    job_data = json.loads(row["data_json"])
                    if str(job_data.get("source") or "").strip().lower() == "gmail":
                        continue
                    posted = self._parse_posted_timestamp(
                        job_data.get("posted") or job_data.get("date")
                    )
                    if posted is None:
                        continue
                    job_data["status"] = row["status"]
                    job_data["_posted_timestamp"] = posted
                    jobs.append(job_data)
                except Exception:
                    continue

            if is_default_query:
                self._public_jobs_cache = [dict(j) for j in jobs]
                self._public_jobs_cache_time = time.time()

        if sort_by == "score":
            jobs.sort(
                key=lambda job: (
                    int(job.get("score") or 0),
                    job.get("_posted_timestamp", 0.0),
                ),
                reverse=True,
            )
        elif sort_by == "company":
            jobs.sort(
                key=lambda job: (
                    str(job.get("company") or "").casefold(),
                    -job.get("_posted_timestamp", 0.0),
                )
            )
        elif sort_by == "title":
            jobs.sort(
                key=lambda job: (
                    str(job.get("title") or "").casefold(),
                    -job.get("_posted_timestamp", 0.0),
                )
            )
        else:
            jobs.sort(key=lambda job: job.get("_posted_timestamp", 0.0), reverse=True)

        total_count = len(jobs)
        sliced_jobs = jobs[offset : offset + page_size]
        result_jobs = []
        for job in sliced_jobs:
            clean_job = dict(job)
            clean_job.pop("_posted_timestamp", None)
            result_jobs.append(clean_job)

        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return {
            "jobs": result_jobs,
            "total": total_count,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        }

    @staticmethod
    def _parse_posted_timestamp(value: Any) -> float | None:
        """Return a UTC timestamp for a provider date, or None if unverifiable."""
        text = str(value or "").strip().casefold()
        if not text:
            return None
        import re

        if text in ("today", "posted today", "just now"):
            return datetime.now(timezone.utc).timestamp()
        if text in ("yesterday", "posted yesterday"):
            return datetime.now(timezone.utc).timestamp() - 86400
        hour_match = re.search(r"(\d+)\s*h(?:ours?)?\s*ago", text)
        if hour_match:
            return (
                datetime.now(timezone.utc).timestamp() - int(hour_match.group(1)) * 3600
            )
        minute_match = re.search(r"(\d+)\s*m(?:in(?:utes?)?)?\s*ago", text)
        if minute_match:
            return (
                datetime.now(timezone.utc).timestamp() - int(minute_match.group(1)) * 60
            )
        relative = re.fullmatch(r"(\d+)\s*d(?:ays?)?\s*ago(?:\s*[•|].*)?", text)
        if relative:
            return (
                datetime.now(timezone.utc).timestamp() - int(relative.group(1)) * 86400
            )
        try:
            parsed = datetime.fromisoformat(text.replace("z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.strptime(text[:10], "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                try:
                    from dateutil import parser as dt_parser

                    parsed = dt_parser.parse(text)
                except Exception:
                    return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).timestamp()

    def get_user_applications(self, user_id: str) -> list[dict[str, Any]]:
        """Fetch private application tracking records for a specific authenticated user."""
        if not user_id:
            return []

        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                       resume_url, cover_letter_url, applied_at, updated_at,
                       COALESCE(job_data_json, '{}') AS job_data_json
                FROM user_applications
                WHERE user_id = ?
                ORDER BY updated_at DESC
            """,
                (user_id,),
            ).fetchall()

        results = []
        seen_ids = set()
        seen_company_titles = set()
        for row in rows:
            d = dict(row)
            try:
                extra = json.loads(d.get("job_data_json") or "{}")
                if isinstance(extra, dict):
                    for k, v in extra.items():
                        if k not in d or not d[k]:
                            d[k] = v
            except Exception:
                pass

            jid = str(d.get("job_id") or d.get("id") or "").strip()
            comp = str(d.get("company") or "").strip().lower()
            title = str(d.get("title") or "").strip().lower()
            comp_key = f"{comp}:::{title}"

            if jid and jid in seen_ids:
                continue
            if comp and title and comp_key in seen_company_titles:
                continue

            if jid:
                seen_ids.add(jid)
            if comp and title:
                seen_company_titles.add(comp_key)
            results.append(d)
        return results

    def upsert_user_application(
        self, user_id: str, job_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Create or update a user's private application tracking record."""
        now = datetime.now(timezone.utc).isoformat()
        app_id = data.get("id") or f"app_{user_id[:8]}_{job_id}"
        status = data.get("status") or "sourced"
        notes = str(data.get("notes") or "").strip()
        resume_text = str(
            data.get("resume_text") or data.get("resumeText") or ""
        ).strip()
        cover_letter_text = str(
            data.get("cover_letter_text") or data.get("coverLetterText") or ""
        ).strip()
        resume_url = str(data.get("resume_url") or "").strip()
        cover_letter_url = str(data.get("cover_letter_url") or "").strip()
        applied_at = data.get("applied_at") or (
            now
            if status in ("applied", "Applied", "submitted", "Interviewing", "Offer")
            else None
        )
        job_data_json = json.dumps(data.get("job_data") or data, ensure_ascii=False)

        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            with conn:
                conn.execute(
                    """
                    INSERT INTO user_applications (
                        id, user_id, job_id, status, notes, resume_text, cover_letter_text,
                        resume_url, cover_letter_url, applied_at, job_data_json, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, job_id) DO UPDATE SET
                        status = excluded.status,
                        notes = excluded.notes,
                        resume_text = CASE WHEN excluded.resume_text != '' THEN excluded.resume_text ELSE user_applications.resume_text END,
                        cover_letter_text = CASE WHEN excluded.cover_letter_text != '' THEN excluded.cover_letter_text ELSE user_applications.cover_letter_text END,
                        resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE user_applications.resume_url END,
                        cover_letter_url = CASE WHEN excluded.cover_letter_url != '' THEN excluded.cover_letter_url ELSE user_applications.cover_letter_url END,
                        applied_at = CASE WHEN excluded.applied_at IS NOT NULL THEN excluded.applied_at ELSE user_applications.applied_at END,
                        job_data_json = excluded.job_data_json,
                        updated_at = excluded.updated_at
                """,
                    (
                        app_id,
                        user_id,
                        job_id,
                        status,
                        notes,
                        resume_text,
                        cover_letter_text,
                        resume_url,
                        cover_letter_url,
                        applied_at,
                        job_data_json,
                        now,
                    ),
                )

                # Also log to application_events
                conn.execute(
                    """
                    INSERT INTO application_events (job_id, from_status, to_status, occurred_at)
                    VALUES (?, 'user_action', ?, ?)
                """,
                    (job_id, status, now),
                )

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
            "job_data": data,
            "updated_at": now,
        }

    def delete_user_application(self, user_id: str, job_id: str) -> bool:
        """Remove a user's tracking entry for a job."""
        with get_db_connection(self.path) as conn:
            with conn:
                cur = conn.execute(
                    "DELETE FROM user_applications WHERE user_id = ? AND job_id = ?",
                    (user_id, job_id),
                )
                return cur.rowcount > 0

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with get_db_connection(self.path) as conn:
            row = conn.execute(
                "SELECT data_json, status FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
        if not row:
            return None
        job = json.loads(row[0])
        job["status"] = row[1]
        return job

    def update_job_description(self, job_id: str, description: str) -> bool:
        """Update a job's description and sync data_json."""
        if not job_id or not description:
            return False
        now = datetime.now(timezone.utc).isoformat()
        with get_db_connection(self.path) as conn:
            row = conn.execute(
                "SELECT data_json FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
            if not row:
                return False
            try:
                data = json.loads(row[0]) if row[0] else {}
            except Exception:
                data = {}
            data["description"] = description
            with conn:
                cur = conn.execute(
                    "UPDATE jobs SET description = ?, data_json = ?, updated_at = ? WHERE id = ?",
                    (description, json.dumps(data, ensure_ascii=False), now, job_id),
                )
                return cur.rowcount > 0

    def list_saved_searches(self, user_id: str) -> list[dict[str, Any]]:
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT id, name, query_json, created_at, updated_at FROM user_saved_searches WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        return [{**dict(row), "query": json.loads(row["query_json"])} for row in rows]

    def upsert_saved_search(
        self, user_id: str, name: str, query: dict[str, Any], search_id: str = ""
    ) -> dict[str, Any]:
        normalized_name = name.strip()[:100]
        if not normalized_name:
            raise ValueError("Saved search name is required")
        now = datetime.now(timezone.utc).isoformat()
        saved_id = (
            search_id
            or hashlib.sha256(f"{user_id}|{normalized_name}".encode()).hexdigest()[:24]
        )
        payload = json.dumps(query, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """INSERT INTO user_saved_searches (id, user_id, name, query_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, name) DO UPDATE SET query_json = excluded.query_json, updated_at = excluded.updated_at""",
                    (saved_id, user_id, normalized_name, payload, now, now),
                )
        return {
            "id": saved_id,
            "name": normalized_name,
            "query": query,
            "updated_at": now,
        }

    def delete_saved_search(self, user_id: str, search_id: str) -> bool:
        with get_db_connection(self.path) as conn:
            with conn:
                return (
                    conn.execute(
                        "DELETE FROM user_saved_searches WHERE user_id = ? AND id = ?",
                        (user_id, search_id),
                    ).rowcount
                    > 0
                )

    def list_due_reminders(
        self, user_id: str, include_future: bool = False
    ) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        due_clause = "" if include_future else "AND remind_at <= ?"
        params = [user_id] + ([] if include_future else [now])
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                f"SELECT * FROM application_reminders WHERE user_id = ? AND dismissed_at IS NULL {due_clause} ORDER BY remind_at ASC",
                params,
            ).fetchall()
        return [
            {**dict(row), "details": json.loads(row["details_json"])} for row in rows
        ]

    def create_reminder(
        self,
        user_id: str,
        job_id: str,
        reminder_type: str,
        remind_at: str,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if reminder_type not in {"follow_up", "interview_prep", "offer_deadline"}:
            raise ValueError("Invalid reminder type")
        try:
            datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("remind_at must be an ISO-8601 timestamp") from error
        now = datetime.now(timezone.utc).isoformat()
        reminder_id = hashlib.sha256(
            f"{user_id}|{job_id}|{reminder_type}|{remind_at}".encode()
        ).hexdigest()[:24]
        payload = json.dumps(details or {}, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    "INSERT OR REPLACE INTO application_reminders (id, user_id, job_id, reminder_type, remind_at, details_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        reminder_id,
                        user_id,
                        job_id,
                        reminder_type,
                        remind_at,
                        payload,
                        now,
                        now,
                    ),
                )
        return {
            "id": reminder_id,
            "job_id": job_id,
            "reminder_type": reminder_type,
            "remind_at": remind_at,
            "details": details or {},
        }

    def dismiss_reminder(self, user_id: str, reminder_id: str) -> bool:
        with get_db_connection(self.path) as conn:
            with conn:
                return (
                    conn.execute(
                        "UPDATE application_reminders SET dismissed_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND dismissed_at IS NULL",
                        (
                            datetime.now(timezone.utc).isoformat(),
                            datetime.now(timezone.utc).isoformat(),
                            reminder_id,
                            user_id,
                        ),
                    ).rowcount
                    > 0
                )

    # ==========================================
    # USER PROFILES & RESUME INTELLIGENCE VAULT
    # ==========================================
    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        """Fetch custom candidate profile from backend database with multi-index fallback."""
        if not user_id:
            return {}
        with get_db_connection(self.path) as conn:
            # 1. Exact match
            row = conn.execute(
                "SELECT profile_data_json FROM user_profiles WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if row and row[0]:
                try:
                    return json.loads(row[0])
                except Exception:
                    pass
            # 2. Case-insensitive match
            row = conn.execute(
                "SELECT profile_data_json FROM user_profiles WHERE LOWER(user_id) = LOWER(?)",
                (user_id,),
            ).fetchone()
            if row and row[0]:
                try:
                    return json.loads(row[0])
                except Exception:
                    pass
            # 3. Strip common prefixes like user_ or prof_
            for prefix in ("user_", "prof_"):
                if user_id.startswith(prefix):
                    clean_id = user_id[len(prefix) :]
                    row = conn.execute(
                        "SELECT profile_data_json FROM user_profiles WHERE user_id = ? OR LOWER(user_id) = LOWER(?)",
                        (clean_id, clean_id),
                    ).fetchone()
                    if row and row[0]:
                        try:
                            return json.loads(row[0])
                        except Exception:
                            pass
            # 4. Search by email inside profile_data_json
            if "@" in user_id:
                row = conn.execute(
                    "SELECT profile_data_json FROM user_profiles WHERE profile_data_json LIKE ? ORDER BY updated_at DESC LIMIT 1",
                    (f'%"{user_id}"%',),
                ).fetchone()
                if row and row[0]:
                    try:
                        return json.loads(row[0])
                    except Exception:
                        pass
        return {}

    def upsert_user_profile(
        self, user_id: str, profile_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Persist candidate profile permanently to backend database."""
        now = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(profile_data, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO user_profiles (user_id, profile_data_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        profile_data_json = excluded.profile_data_json,
                        updated_at = excluded.updated_at
                """,
                    (user_id, payload_json, now),
                )
        return profile_data

    # ==========================================
    # USER PREFERENCES & ALGORITHMIC WEIGHTS
    # ==========================================
    def get_user_preferences(self, user_id: str) -> dict[str, Any]:
        """Fetch candidate recommendation preferences & boosted/demoted weights."""
        if not user_id:
            return {}
        with get_db_connection(self.path) as conn:
            row = conn.execute(
                "SELECT prefs_json FROM user_preferences WHERE user_id = ?", (user_id,)
            ).fetchone()
            if row and row[0]:
                try:
                    return json.loads(row[0])
                except Exception:
                    pass
        return {
            "promotedJobIds": [],
            "demotedJobIds": [],
            "boostedCompanies": [],
            "demotedCompanies": [],
            "boostedTerms": [],
            "demotedTerms": [],
            "preferredStreams": [],
        }

    def upsert_user_preferences(
        self, user_id: str, prefs_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Persist recommendation feedback weights and preferences."""
        now = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(prefs_data, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO user_preferences (user_id, prefs_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        prefs_json = excluded.prefs_json,
                        updated_at = excluded.updated_at
                """,
                    (user_id, payload_json, now),
                )
        return prefs_data

    # ==========================================
    # GENERATED TAILORED DOCUMENTS (RESUME / COVER)
    # ==========================================
    def get_generated_document(
        self, user_id: str, job_id: str, doc_type: str = "resume"
    ) -> dict[str, Any] | None:
        """Fetch cached tailored application document for a job."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                SELECT id, user_id, job_id, doc_type, content_text, model_name, metadata_json, updated_at
                FROM generated_documents
                WHERE user_id = ? AND job_id = ? AND doc_type = ?
            """,
                (user_id, job_id, doc_type),
            ).fetchone()
            if row:
                d = dict(row)
                try:
                    d["metadata"] = json.loads(d.get("metadata_json") or "{}")
                except Exception:
                    d["metadata"] = {}
                return d
        return None

    def upsert_generated_document(
        self,
        user_id: str,
        job_id: str,
        doc_type: str,
        content_text: str,
        model_name: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Cache tailored resume or cover letter permanently."""
        now = datetime.now(timezone.utc).isoformat()
        doc_id = f"doc_{user_id[:8]}_{job_id}_{doc_type}"
        meta_json = json.dumps(metadata or {}, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO generated_documents (id, user_id, job_id, doc_type, content_text, model_name, metadata_json, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        content_text = excluded.content_text,
                        model_name = excluded.model_name,
                        metadata_json = excluded.metadata_json,
                        updated_at = excluded.updated_at
                """,
                    (
                        doc_id,
                        user_id,
                        job_id,
                        doc_type,
                        content_text,
                        model_name,
                        meta_json,
                        now,
                    ),
                )
        return {
            "id": doc_id,
            "user_id": user_id,
            "job_id": job_id,
            "doc_type": doc_type,
            "content_text": content_text,
            "model_name": model_name,
            "metadata": metadata or {},
            "updated_at": now,
        }

    # ==========================================
    # EMPLOYER PSYCHOLOGY DECODER CACHE
    # ==========================================
    def get_job_psychology(self, job_id: str) -> dict[str, Any] | None:
        """Fetch cached employer psychology & hidden priorities."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                SELECT job_id, company, title, insights_json, model_name, updated_at
                FROM job_psychology
                WHERE job_id = ?
            """,
                (job_id,),
            ).fetchone()
            if row:
                d = dict(row)
                try:
                    d["insights"] = json.loads(d.get("insights_json") or "{}")
                except Exception:
                    d["insights"] = {}
                return d
        return None

    def upsert_job_psychology(
        self,
        job_id: str,
        company: str,
        title: str,
        insights: dict[str, Any],
        model_name: str = "",
    ) -> dict[str, Any]:
        """Cache decoded employer psychology permanently in SQLite."""
        now = datetime.now(timezone.utc).isoformat()
        insights_json = json.dumps(insights, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO job_psychology (job_id, company, title, insights_json, model_name, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(job_id) DO UPDATE SET
                        company = excluded.company,
                        title = excluded.title,
                        insights_json = excluded.insights_json,
                        model_name = excluded.model_name,
                        updated_at = excluded.updated_at
                """,
                    (job_id, company, title, insights_json, model_name, now),
                )
        return {
            "job_id": job_id,
            "company": company,
            "title": title,
            "insights": insights,
            "model_name": model_name,
            "updated_at": now,
        }

    # ==========================================
    # ON-DEMAND JOB INTELLIGENCE ARTIFACTS
    # ==========================================
    def get_job_intelligence(
        self, job_id: str, tool_key: str | None = None
    ) -> dict[str, Any]:
        """Retrieve persisted on-demand intelligence artifacts for a job card."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            if tool_key:
                row = conn.execute(
                    """
                    SELECT job_id, tool_key, intelligence_json, model_name, created_at, updated_at
                    FROM job_intelligence
                    WHERE job_id = ? AND tool_key = ?
                """,
                    (job_id, tool_key),
                ).fetchone()
                if row:
                    d = dict(row)
                    try:
                        d["data"] = json.loads(d.get("intelligence_json") or "{}")
                    except Exception:
                        d["data"] = {}
                    return d
                return {}

            rows = conn.execute(
                """
                SELECT job_id, tool_key, intelligence_json, model_name, created_at, updated_at
                FROM job_intelligence
                WHERE job_id = ?
            """,
                (job_id,),
            ).fetchall()
            result = {}
            for r in rows:
                d = dict(r)
                try:
                    d["data"] = json.loads(d.get("intelligence_json") or "{}")
                except Exception:
                    d["data"] = {}
                result[d["tool_key"]] = d
            return result

    def upsert_job_intelligence(
        self,
        job_id: str,
        tool_key: str,
        data: dict[str, Any],
        model_name: str = "",
    ) -> dict[str, Any]:
        """Persist on-demand intelligence artifact in SQLite WAL database."""
        now = datetime.now(timezone.utc).isoformat()
        intel_json = json.dumps(data, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO job_intelligence (job_id, tool_key, intelligence_json, model_name, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(job_id, tool_key) DO UPDATE SET
                        intelligence_json = excluded.intelligence_json,
                        model_name = excluded.model_name,
                        updated_at = excluded.updated_at
                """,
                    (job_id, tool_key, intel_json, model_name, now, now),
                )
        return {
            "job_id": job_id,
            "tool_key": tool_key,
            "data": data,
            "model_name": model_name,
            "updated_at": now,
        }

    # ==========================================
    # INTERVIEW SIMULATOR SESSIONS
    # ==========================================
    def get_interview_sessions(
        self, user_id: str, job_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Fetch mock interview session history and AI ratings."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            if job_id:
                rows = conn.execute(
                    """
                    SELECT id, user_id, job_id, company, title, session_data_json, score, updated_at
                    FROM interview_sessions
                    WHERE user_id = ? AND job_id = ?
                    ORDER BY updated_at DESC
                """,
                    (user_id, job_id),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, user_id, job_id, company, title, session_data_json, score, updated_at
                    FROM interview_sessions
                    WHERE user_id = ?
                    ORDER BY updated_at DESC
                """,
                    (user_id,),
                ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["session_data"] = json.loads(d.get("session_data_json") or "{}")
            except Exception:
                d["session_data"] = {}
            results.append(d)
        return results

    def save_interview_session(
        self,
        user_id: str,
        job_id: str,
        company: str,
        title: str,
        session_data: dict[str, Any],
        score: float = 0.0,
    ) -> dict[str, Any]:
        """Save a completed mock interview Q&A session with AI scores."""
        now = datetime.now(timezone.utc).isoformat()
        session_id = f"mock_{user_id[:8]}_{job_id}_{int(datetime.now().timestamp())}"
        session_json = json.dumps(session_data, ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO interview_sessions (id, user_id, job_id, company, title, session_data_json, score, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        session_id,
                        user_id,
                        job_id,
                        company,
                        title,
                        session_json,
                        score,
                        now,
                    ),
                )
        return {
            "id": session_id,
            "user_id": user_id,
            "job_id": job_id,
            "company": company,
            "title": title,
            "session_data": session_data,
            "score": score,
            "updated_at": now,
        }

    # ==========================================
    # TARGETED GMAIL APPLICATION STATUS UPDATES
    # ==========================================
    def update_application_status_from_email(
        self,
        user_id: str,
        job_id: str,
        new_status: str,
        email_subject: str = "",
        email_snippet: str = "",
        email_date: str = "",
        email_thread_id: str = "",
    ) -> dict[str, Any]:
        """Update status and log event timeline when targeted Gmail scanner detects recruiter response."""
        now = datetime.now(timezone.utc).isoformat()
        with get_db_connection(self.path) as conn:
            with conn:
                # Update user_applications record
                conn.execute(
                    """
                    UPDATE user_applications
                    SET status = ?,
                        last_scanned_at = ?,
                        last_email_subject = ?,
                        last_email_date = ?,
                        email_thread_id = CASE WHEN ? != '' THEN ? ELSE email_thread_id END,
                        updated_at = ?
                    WHERE user_id = ? AND job_id = ?
                """,
                    (
                        new_status,
                        now,
                        email_subject,
                        email_date,
                        email_thread_id,
                        email_thread_id,
                        now,
                        user_id,
                        job_id,
                    ),
                )

                # Append to application_events timeline
                conn.execute(
                    """
                    INSERT INTO application_events (job_id, from_status, to_status, occurred_at)
                    VALUES (?, 'gmail_sync', ?, ?)
                """,
                    (job_id, new_status, email_date or now),
                )

        return {
            "user_id": user_id,
            "job_id": job_id,
            "status": new_status,
            "email_subject": email_subject,
            "email_date": email_date,
            "updated_at": now,
        }

    # ==========================================
    # IDENTITY & AUTH FOUNDATION
    # ==========================================
    def create_user(
        self, user_id: str, email: str, password_hash: str, name: str = None
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                    (user_id, email, name, password_hash, now),
                )
        return {"id": user_id, "email": email, "name": name, "created_at": now}

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with get_db_connection(self.path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()
            if row:
                return dict(row)
            return None

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        with get_db_connection(self.path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if row:
                return dict(row)
            return None

    def migrate_default_user(self, new_user_id: str) -> int:
        """Migrates all data from 'default_user' to the newly registered user account."""
        total_migrated = 0
        with get_db_connection(self.path) as conn:
            with conn:
                # user_applications
                c = conn.execute(
                    "UPDATE user_applications SET user_id = ? WHERE user_id = 'default_user'",
                    (new_user_id,),
                )
                total_migrated += c.rowcount
                # user_profiles
                c = conn.execute(
                    "UPDATE user_profiles SET user_id = ? WHERE user_id = 'default_user'",
                    (new_user_id,),
                )
                total_migrated += c.rowcount
                # user_preferences
                c = conn.execute(
                    "UPDATE user_preferences SET user_id = ? WHERE user_id = 'default_user'",
                    (new_user_id,),
                )
                total_migrated += c.rowcount
                # generated_documents
                c = conn.execute(
                    "UPDATE generated_documents SET user_id = ? WHERE user_id = 'default_user'",
                    (new_user_id,),
                )
                total_migrated += c.rowcount
                # candidate_matches
                c = conn.execute(
                    "UPDATE candidate_matches SET user_id = ? WHERE user_id = 'default_user'",
                    (new_user_id,),
                )
                total_migrated += c.rowcount

        logger.info(
            f"Migrated {total_migrated} records from 'default_user' to '{new_user_id}'"
        )
        return total_migrated

    def upsert_job(self, job_dict: dict[str, Any]) -> int:
        """Convenience method to insert or update a single job."""
        return self.upsert_scraped_jobs([job_dict])

    def upsert_candidate_match(
        self,
        user_id: str,
        job_id: str,
        score: int,
        fit: str = "moderate",
        reasons: list[str] | None = None,
        status: str = "matched",
    ) -> dict[str, Any]:
        """Stage or update a high-relevance job match for candidate intake."""
        now = datetime.now(timezone.utc).isoformat()
        match_id = f"match_{user_id[:8]}_{job_id}"
        reasons_json = json.dumps(reasons or [], ensure_ascii=False)
        with get_db_connection(self.path) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO candidate_matches (id, user_id, job_id, score, fit, reasons_json, matched_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, job_id) DO UPDATE SET
                        score = excluded.score,
                        fit = excluded.fit,
                        reasons_json = excluded.reasons_json,
                        matched_at = excluded.matched_at,
                        status = excluded.status
                """,
                    (match_id, user_id, job_id, score, fit, reasons_json, now, status),
                )
        return {
            "id": match_id,
            "user_id": user_id,
            "job_id": job_id,
            "score": score,
            "fit": fit,
            "reasons": reasons or [],
            "matched_at": now,
            "status": status,
        }

    def get_candidate_matches(
        self, user_id: str, min_score: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Retrieve staged candidate matches with joined job details."""
        with get_db_connection(self.path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT m.*, j.title, j.company, j.location, j.description, j.source, j.url, j.posted, j.stream, j.data_json
                FROM candidate_matches m
                LEFT JOIN jobs j ON m.job_id = j.id
                WHERE m.user_id = ? AND m.score >= ?
                ORDER BY m.score DESC, m.matched_at DESC
                LIMIT ?
            """,
                (user_id, min_score, limit),
            ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                try:
                    d["reasons"] = json.loads(d.get("reasons_json") or "[]")
                except Exception:
                    d["reasons"] = []
                d["job"] = {
                    "id": d.get("job_id"),
                    "title": d.get("title") or "",
                    "company": d.get("company") or "",
                    "location": d.get("location") or "",
                    "description": d.get("description") or "",
                    "source": d.get("source") or "",
                    "url": d.get("url") or "",
                    "posted": d.get("posted") or "",
                    "stream": d.get("stream") or "",
                }
                results.append(d)
            return results

    def evaluate_and_stage_matches(
        self,
        user_id: str,
        profile: dict[str, Any],
        min_score: int = 50,
        limit: int = 200,
    ) -> int:
        """Autonomously score indexed jobs against candidate profile and stage top matches."""
        from .models import Job
        from .score import score_job

        all_jobs = self.list_jobs()[:limit]
        staged = 0
        for j in all_jobs:
            try:
                job_model = Job(
                    id=j["id"],
                    title=j.get("title", ""),
                    company=j.get("company", ""),
                    location=j.get("location", ""),
                    description=j.get("description", ""),
                    source=j.get("source", "seek"),
                    url=j.get("url", ""),
                    posted=j.get("posted", ""),
                )
                score_res = score_job(job_model, profile)
                if score_res.score >= min_score:
                    reasons = list(score_res.matched_skills[:3])
                    if score_res.fit == "strong":
                        reasons.append("High title & seniority match")
                    self.upsert_candidate_match(
                        user_id=user_id,
                        job_id=j["id"],
                        score=score_res.score,
                        fit=score_res.fit,
                        reasons=reasons,
                        status="matched",
                    )
                    staged += 1
            except Exception as e:
                logger.warning(f"Error evaluating job {j.get('id')} for {user_id}: {e}")
        return staged

    def get_feature_flags(self) -> dict[str, dict[str, Any]]:
        """Retrieve all registered feature flags with state and descriptions.

        Returns:
            Dictionary mapping flag key to metadata dict {'enabled': bool, 'description': str, 'updated_at': str}.
        """
        flags: dict[str, dict[str, Any]] = {}
        with self.pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT key, enabled, description, updated_at FROM feature_flags"
            )
            for row in cursor.fetchall():
                flags[row[0]] = {
                    "enabled": bool(row[1]),
                    "description": row[2],
                    "updated_at": row[3],
                }
        return flags

    def set_feature_flag(self, key: str, enabled: bool, description: str = "") -> bool:
        """Update or insert a feature flag state.

        Args:
            key: Unique flag key string.
            enabled: Boolean flag state.
            description: Optional descriptive text.

        Returns:
            True on successful update.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.pool.connection() as conn:
            cursor = conn.cursor()
            if description:
                cursor.execute(
                    """
                    INSERT INTO feature_flags (key, enabled, description, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        enabled = excluded.enabled,
                        description = excluded.description,
                        updated_at = excluded.updated_at
                    """,
                    (key, 1 if enabled else 0, description, now_iso),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO feature_flags (key, enabled, description, updated_at)
                    VALUES (?, ?, '', ?)
                    ON CONFLICT(key) DO UPDATE SET
                        enabled = excluded.enabled,
                        updated_at = excluded.updated_at
                    """,
                    (key, 1 if enabled else 0, now_iso),
                )
            conn.commit()
            return True

    def is_feature_enabled(self, key: str, default: bool = True) -> bool:
        """Check whether a given feature flag is enabled.

        Args:
            key: Unique flag key string.
            default: Fallback status if flag is not registered.

        Returns:
            Boolean indicating whether feature is active.
        """
        with self.pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT enabled FROM feature_flags WHERE key = ?", (key,))
            row = cursor.fetchone()
            if row is not None:
                return bool(row[0])
        return default

    def set_provider_cookies(
        self,
        provider: str,
        headers: dict[str, str] | None = None,
        cookies: dict[str, str] | None = None,
    ) -> bool:
        """Store manual session headers and cookies per provider in SQLite."""
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO provider_cookies (provider, headers_json, cookies_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(provider) DO UPDATE SET
                    headers_json = excluded.headers_json,
                    cookies_json = excluded.cookies_json,
                    updated_at = excluded.updated_at
                """,
                (
                    provider.lower().strip(),
                    json.dumps(headers or {}),
                    json.dumps(cookies or {}),
                    now_iso,
                ),
            )
            conn.commit()
            return True

    def get_provider_cookies(self, provider: str) -> dict[str, Any]:
        """Retrieve stored headers and cookies for a provider."""
        with self.pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT headers_json, cookies_json, updated_at FROM provider_cookies WHERE provider = ?",
                (provider.lower().strip(),),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "provider": provider,
                    "headers": json.loads(row[0]) if row[0] else {},
                    "cookies": json.loads(row[1]) if row[1] else {},
                    "updated_at": row[2],
                }
        return {"provider": provider, "headers": {}, "cookies": {}, "updated_at": None}

    def get_subscription(self, user_id: str) -> dict[str, Any]:
        """Retrieve subscription details for a user, returning default free tier if unconfigured."""
        with self.pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, stripe_customer_id, stripe_subscription_id,
                       plan_tier, status, current_period_start, current_period_end,
                       cancel_at_period_end, monthly_token_allowance, trial_generations_remaining,
                       created_at, updated_at
                FROM user_subscriptions
                WHERE user_id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "user_id": row[1],
                    "stripe_customer_id": row[2] or "",
                    "stripe_subscription_id": row[3] or "",
                    "plan_tier": row[4],
                    "status": row[5],
                    "current_period_start": row[6],
                    "current_period_end": row[7],
                    "cancel_at_period_end": bool(row[8]),
                    "monthly_token_allowance": int(row[9]),
                    "trial_generations_remaining": int(row[10]),
                    "created_at": row[11],
                    "updated_at": row[12],
                }

        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "id": f"sub_{user_id}",
            "user_id": user_id,
            "stripe_customer_id": "",
            "stripe_subscription_id": "",
            "plan_tier": "free",
            "status": "inactive",
            "current_period_start": now_iso,
            "current_period_end": now_iso,
            "cancel_at_period_end": False,
            "monthly_token_allowance": 0,
            "trial_generations_remaining": 3,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

    def save_subscription(
        self,
        user_id: str,
        plan_tier: str = "pro_monthly",
        status: str = "active",
        stripe_customer_id: str = "",
        stripe_subscription_id: str = "",
        current_period_start: str = "",
        current_period_end: str = "",
        cancel_at_period_end: bool = False,
        monthly_token_allowance: int = 500000,
        trial_generations_remaining: int = 3,
    ) -> dict[str, Any]:
        """Upsert a user subscription."""
        now_iso = datetime.now(timezone.utc).isoformat()
        start = current_period_start or now_iso
        end = current_period_end or now_iso
        sub_id = f"sub_{user_id}"
        with self.pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO user_subscriptions (
                    id, user_id, stripe_customer_id, stripe_subscription_id,
                    plan_tier, status, current_period_start, current_period_end,
                    cancel_at_period_end, monthly_token_allowance, trial_generations_remaining,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    plan_tier = excluded.plan_tier,
                    status = excluded.status,
                    stripe_customer_id = CASE WHEN excluded.stripe_customer_id != '' THEN excluded.stripe_customer_id ELSE user_subscriptions.stripe_customer_id END,
                    stripe_subscription_id = CASE WHEN excluded.stripe_subscription_id != '' THEN excluded.stripe_subscription_id ELSE user_subscriptions.stripe_subscription_id END,
                    current_period_start = excluded.current_period_start,
                    current_period_end = excluded.current_period_end,
                    cancel_at_period_end = excluded.cancel_at_period_end,
                    monthly_token_allowance = excluded.monthly_token_allowance,
                    updated_at = excluded.updated_at
                """,
                (
                    sub_id,
                    user_id,
                    stripe_customer_id,
                    stripe_subscription_id,
                    plan_tier,
                    status,
                    start,
                    end,
                    1 if cancel_at_period_end else 0,
                    monthly_token_allowance,
                    trial_generations_remaining,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()
        return self.get_subscription(user_id)

    def record_token_usage(
        self,
        user_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost_usd: float = 0.0,
        model: str = "",
    ) -> dict[str, Any]:
        """Record token consumption in user_token_ledger."""
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        month_key = now.strftime("%Y-%m")
        ledger_id = f"tok_{user_id}_{month_key}"
        total = prompt_tokens + completion_tokens

        with self.pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO user_token_ledger (
                    id, user_id, billing_period_month, prompt_tokens,
                    completion_tokens, total_tokens, cost_usd, call_count, last_call_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(user_id, billing_period_month) DO UPDATE SET
                    prompt_tokens = user_token_ledger.prompt_tokens + excluded.prompt_tokens,
                    completion_tokens = user_token_ledger.completion_tokens + excluded.completion_tokens,
                    total_tokens = user_token_ledger.total_tokens + excluded.total_tokens,
                    cost_usd = user_token_ledger.cost_usd + excluded.cost_usd,
                    call_count = user_token_ledger.call_count + 1,
                    last_call_at = excluded.last_call_at
                """,
                (
                    ledger_id,
                    user_id,
                    month_key,
                    prompt_tokens,
                    completion_tokens,
                    total,
                    cost_usd,
                    now_iso,
                ),
            )
            conn.commit()
        return self.get_token_usage(user_id, month_key)

    def get_token_usage(self, user_id: str, month: str | None = None) -> dict[str, Any]:
        """Retrieve token usage and allowance for a user for the given or current month."""
        month_key = month or datetime.now(timezone.utc).strftime("%Y-%m")
        sub = self.get_subscription(user_id)
        allowance = sub.get("monthly_token_allowance", 0)

        with self.pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT prompt_tokens, completion_tokens, total_tokens, cost_usd, call_count, last_call_at
                FROM user_token_ledger
                WHERE user_id = ? AND billing_period_month = ?
                """,
                (user_id, month_key),
            )
            row = cursor.fetchone()
            if row:
                prompt_tokens = int(row[0])
                completion_tokens = int(row[1])
                total_tokens = int(row[2])
                cost_usd = float(row[3])
                call_count = int(row[4])
                last_call_at = row[5]
            else:
                prompt_tokens = 0
                completion_tokens = 0
                total_tokens = 0
                cost_usd = 0.0
                call_count = 0
                last_call_at = None

        remaining = max(0, allowance - total_tokens) if allowance > 0 else 0
        return {
            "user_id": user_id,
            "billing_period_month": month_key,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost_usd,
            "call_count": call_count,
            "last_call_at": last_call_at,
            "allowance": allowance,
            "remaining_tokens": remaining,
        }

    def decrement_trial_generations(self, user_id: str) -> int:
        """Decrement the trial generations remaining for a user (min 0)."""
        with self.pool.connection() as conn:
            self.save_subscription(
                user_id=user_id,
                plan_tier="free",
                status="inactive",
                monthly_token_allowance=0,
            )
            conn.execute(
                """
                UPDATE user_subscriptions
                SET trial_generations_remaining = MAX(0, trial_generations_remaining - 1),
                    updated_at = ?
                WHERE user_id = ?
                """,
                (datetime.now(timezone.utc).isoformat(), user_id),
            )
            conn.commit()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT trial_generations_remaining FROM user_subscriptions WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row else 0
