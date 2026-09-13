---
name: backend-architecture
description: SQLite WAL concurrency, pooled db access, auto-recovery, dynamic test fixtures, and cognitive performance standards for Python backend
globs: "backend/**/*.py"
---

# Backend Architectural & Governance Standards (Python / SQLite)

## 1. SQLite Concurrency & WAL Protocol
- The backend runs on a multi-threaded Python HTTP server (`web.py`) with SQLite.
- Always operate in **WAL (Write-Ahead Logging)** mode:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  ```
- All database access **MUST** pass through `get_db_connection(self.path)` from `job_dashboard.db_pool`.
- Never create unmanaged, unpooled `sqlite3.connect()` calls that can leak file descriptors or trigger `sqlite3.OperationalError: database is locked`.
- Always ensure connection context managers properly finalize transactions and return connections to the pool.

## 2. Schema Integrity & Data-Driven Context
- Inspect actual database table definitions in `job_dashboard/repository.py` or via SQLite table schemas before crafting SQL queries to guarantee exact schema alignment.
- All repository initializations must execute `_check_and_recover_db()` prior to running schema scripts to auto-heal malformed databases.
- In Docker/Cloud Run packaging, never bake live SQLite databases (`*.sqlite3`, `*.sqlite3-wal`, `*.sqlite3-shm`) into images; let the container initialize a clean state on startup.
- **No External Database Dependencies**: The backend is strictly local and self-contained (SQLite WAL mode + JSON data files). Do NOT introduce PostgreSQL, MySQL, Supabase, or remote database client drivers.

## 3. Cognitive Strategies & Performance-First Standards
- **Parameterized Queries**: Every SQL query must be parameterized to prevent SQL injection vulnerabilities.
- **Algorithmic Complexity**: Prioritize memory-efficient indexed lookups and dictionary hash-maps (\(O(1)\)) over repetitive linear scans (\(O(n)\)) across large job record sets.
- **Documentation**: Every public function, class, and method must include docstrings documenting parameters, return values, and technical rationale ("Why", not "What").
- **Dynamic Test Fixtures**: Never hardcode fixed calendar dates (e.g., `2026-08-24`) in test fixtures validated by recency filters. Always generate dynamic test dates using `datetime.now(timezone.utc).date().isoformat()`.

## 4. Verification Gauntlet
- Run backend tests: `cd /home/s/.openclaw/workspace/job-dashboard/backend && python3 -m pytest tests/ -v`
- Run backend linter: `cd /home/s/.openclaw/workspace/job-dashboard/backend && ruff check .`
