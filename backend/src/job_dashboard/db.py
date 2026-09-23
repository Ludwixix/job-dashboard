"""
SQLite database initialization and FTS5 full-text search management.

Provides schema creation, supplemental performance indexes, external content FTS5
virtual table (jobs_fts), and automatic synchronization triggers.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from .logging import get_logger

logger = get_logger("job_dashboard.db")

SCHEMA_DDL = """
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
CREATE INDEX IF NOT EXISTS idx_jobs_score_posted ON jobs(score DESC, posted DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_remote ON jobs(remote);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

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
CREATE INDEX IF NOT EXISTS idx_user_apps_user_updated ON user_applications(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS application_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
    from_status TEXT, to_status TEXT NOT NULL, occurred_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_app_events_job ON application_events(job_id, occurred_at DESC);

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
"""


def init_fts5_index(conn: sqlite3.Connection) -> None:
    """Initialize the SQLite FTS5 external content table and synchronization triggers.

    Creates:
    - jobs_fts virtual table using FTS5 external content referencing 'jobs'.
    - Real-time sync triggers:
      - jobs_ai: AFTER INSERT ON jobs
      - jobs_ad: AFTER DELETE ON jobs
      - jobs_au: AFTER UPDATE OF title, company, location, description, source, stream ON jobs
    - Rebuilds inverted index if jobs table contains data but jobs_fts index is empty.
    """
    cursor = conn.cursor()

    # Ensure jobs base table exists first before attaching triggers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
            location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
            remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
            data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
    """)

    # Check for legacy jobs_fts table without external content or tokenchars
    existing_fts = cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs_fts'"
    ).fetchone()
    if existing_fts and existing_fts[0]:
        sql_def = existing_fts[0].lower()
        if "content='jobs'" not in sql_def or "tokenchars" not in sql_def:
            logger.info(
                "Migrating legacy jobs_fts table to external content FTS5 schema"
            )
            cursor.execute("DROP TRIGGER IF EXISTS jobs_ai;")
            cursor.execute("DROP TRIGGER IF EXISTS jobs_ad;")
            cursor.execute("DROP TRIGGER IF EXISTS jobs_au;")
            cursor.execute("DROP TABLE IF EXISTS jobs_fts;")

    # 1. Create external content virtual table jobs_fts
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(
            title,
            company,
            location,
            description,
            source,
            stream,
            content='jobs',
            content_rowid='rowid',
            tokenize="porter unicode61 tokenchars '+#.'"
        );
    """)

    # 2. Real-time synchronization triggers
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS jobs_ai AFTER INSERT ON jobs BEGIN
            INSERT INTO jobs_fts(rowid, title, company, location, description, source, stream)
            VALUES (new.rowid, new.title, new.company, new.location, new.description, new.source, new.stream);
        END;
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS jobs_ad AFTER DELETE ON jobs BEGIN
            INSERT INTO jobs_fts(jobs_fts, rowid, title, company, location, description, source, stream)
            VALUES ('delete', old.rowid, old.title, old.company, old.location, old.description, old.source, old.stream);
        END;
    """)

    # Notice: AFTER UPDATE OF restricts triggers exclusively to searchable text columns,
    # preventing write overhead during Kanban status transitions or score updates.
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS jobs_au AFTER UPDATE OF title, company, location, description, source, stream ON jobs BEGIN
            INSERT INTO jobs_fts(jobs_fts, rowid, title, company, location, description, source, stream)
            VALUES ('delete', old.rowid, old.title, old.company, old.location, old.description, old.source, old.stream);
            INSERT INTO jobs_fts(rowid, title, company, location, description, source, stream)
            VALUES (new.rowid, new.title, new.company, new.location, new.description, new.source, new.stream);
        END;
    """)

    # 3. Idempotent check & rebuild if jobs has rows but jobs_fts index is empty
    try:
        jobs_count_row = cursor.execute("SELECT count(*) FROM jobs").fetchone()
        jobs_count = jobs_count_row[0] if jobs_count_row else 0
        if jobs_count > 0:
            fts_docsize_count = 0
            try:
                docsize_row = cursor.execute(
                    "SELECT count(*) FROM jobs_fts_docsize"
                ).fetchone()
                if docsize_row:
                    fts_docsize_count = docsize_row[0]
            except sqlite3.OperationalError:
                pass

            if fts_docsize_count == 0:
                logger.info(f"Rebuilding FTS5 index for {jobs_count} existing jobs")
                cursor.execute("INSERT INTO jobs_fts(jobs_fts) VALUES('rebuild');")
    except sqlite3.OperationalError as e:
        logger.warning(f"FTS5 rebuild check skipped: {e}")


def init_db(conn: sqlite3.Connection) -> None:
    """Initialize full database schema, indexes, and FTS5 search index."""
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute("PRAGMA synchronous=NORMAL;")
    except sqlite3.Error:
        pass

    conn.executescript(SCHEMA_DDL)
    init_fts5_index(conn)
