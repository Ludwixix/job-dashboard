# Project: Job Dashboard Architecture Overhaul Optimization & Validation

## Architecture Overview
- **Phase 2 (Frontend Architecture & Optimization)**:
  - Vite 8 Rolldown-compatible prioritized chunking (`codeSplitting.groups` / refined `manualChunks`) eliminating vendor circular preloads.
  - On-demand dynamic imports for PDF generation (`jspdf`) and application generation (`generationService.js`).
  - Strict bundle size control: initial entry bundle < 400 kB, eager preloads stripped of non-critical visualization/document libraries.
  - Modal centralization: avoid duplicate lazy imports in `JobSeeker.jsx`, leveraging `DashboardModals.jsx`.
- **Phase 3 (Data Persistence & Scraper Invariants)**:
  - SQLite FTS5 virtual table (`jobs_fts`) external content table with `content='jobs', content_rowid='rowid'` and `tokenize="porter unicode61 tokenchars '+#.'"`.
  - Real-time automatic synchronization triggers on `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE OF title, company, location, description, source, stream ON jobs`.
  - Sub-10ms search with query sanitization (`sanitize_fts5_query`) and graceful fallback to `LIKE`.
  - ScraperCoordinator single-flight enqueueing for `/api/refresh` and `/api/scrape`, eliminating global `self.lock` contention during network I/O.
  - Enforcement of anti-double-dipping invariants: database-first sufficiency check, 6-hour unfulfilling query cooldown, exception-resilient cooldown tracking, and 1-worker Cloud Run ceiling.
- **Phase 4 (Backend Service Decomposition)**:
  - Decompose monolithic `DashboardApp` (2,030 lines) into focused domain services:
    - `JobIndexService`: $O(1)$ dual-indexed in-memory cache (`_jobs_by_id`, `_jobs_by_url`) replacing $O(N^2)$ linear generator scans.
    - `ScrapeOrchestrationService`: 1-worker queue, single-flight coordinator, polite 2.0s pacing, caller event synchronization, and GCS backup coordination.
    - `ApplicationWorkflowService`: Kanban workflow, document generation, and CRM operations.
  - `DashboardApp` remains a lightweight composite facade preserving 100% backward compatibility for all existing tests and routes.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Architecture Survey & Baseline | Deep audit across Phases 2-4 and baseline test verification | M1 | ORIGINAL_REQUEST.md |
| 2 | Vite Chunking & Rolldown Strategy | Eliminate `vendor-charts` and `vendor-pdf` from root preload; ensure entry bundle < 400 kB | M2 | Survey / Explorer 1 |
| 3 | Modal & Dynamic Import Decoupling | Lazy load PDF generator in `JobSeeker.jsx`, fix `SiteGate.jsx` re-exports, deduplicate modals | M2 | Survey / Explorer 1 |
| 4 | SQLite FTS5 Virtual Table Schema | Create `jobs_fts` with external content and custom tokenizer (`tokenchars '+#.'`) | M3 | ORIGINAL_REQUEST.md / Explorer 2 |
| 5 | FTS5 Real-Time Sync Triggers | Auto-sync triggers on `jobs` (INSERT, DELETE, targeted UPDATE) for sub-10ms queries | M3 | ORIGINAL_REQUEST.md / Explorer 2 |
| 6 | FTS5 Query Integration & Fallback | Query integration with `sanitize_fts5_query` and automatic fallback to `LIKE` | M3 | Survey / Explorer 2 |
| 7 | Scraper Coordinator Enqueueing | Wire `/api/refresh` and `/api/scrape` to `ScrapeCoordinator` to avoid global lock contention | M4 | ORIGINAL_REQUEST.md / Explorer 3 |
| 8 | Anti-Double-Dipping Invariants | DB-first sufficiency check, 6-hr unfulfilling cooldown, exception-safe cooldown tracking | M4 | Monorepo Rules / Explorer 3 |
| 9 | DashboardApp Service Decomposition | Extract `JobIndexService`, `ScrapeOrchestrationService`, and `ApplicationWorkflowService` | M4 | ORIGINAL_REQUEST.md / Explorer 3 |
| 10 | Verification & Test Gauntlet | 100% pass on pytest backend (340+ tests), vitest frontend (437 tests), and linting | M5 | ORIGINAL_REQUEST.md |
| 11 | Master Phase Improvements Report | Publish comprehensive documentation at `docs/architecture/phase_improvements_report.md` | M5 | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Multi-Agent Survey & Baseline | Deep audit of Phases 2, 3, 4; baseline metrics | None | DONE |
| 2 | Frontend Bundle & Chunking Optimization | Vite chunking, lazy PDF generator, modal deduplication, bundle < 400 kB | M1 | IN_PROGRESS |
| 3 | SQLite FTS5 Virtual Table & Triggers | `jobs_fts` schema, triggers, sub-10ms search query integration, fallback | M1 | PLANNED |
| 4 | Scraper Coordinator & Service Decomposition | Single-flight enqueueing, lock contention fix, 1-worker pacing, services | M1 | PLANNED |
| 5 | Verification Audit & Master Report | Backend/frontend test runs, bundle metrics, FTS5 benchmarks, architecture report | M2, M3, M4 | PLANNED |

## Interface Contracts
### SQLite FTS5 Search API (`repository.py` & `db.py`)
- `sanitize_fts5_query(term: str) -> str`: Normalizes user query, quotes token strings containing punctuation, escapes boolean operators (`AND`, `OR`, `NOT`, `NEAR`), appends trailing wildcard prefix `*` for autocomplete.
- `init_fts5_index(conn: sqlite3.Connection) -> None`: Idempotently creates `jobs_fts` virtual table, registers triggers (`jobs_ai`, `jobs_ad`, `jobs_au`), and triggers initial populate if `jobs_fts` is empty but `jobs` has rows.
- `query_jobs_paginated(...)`: Prefers `jobs_fts MATCH ?` with ranking (`ORDER BY rank`); gracefully catches `sqlite3.OperationalError` and falls back to standard `LIKE` query.

### Scraper Coordinator API (`scrape_coordinator.py`)
- `ScrapeCoordinator.enqueue_query(query: SearchQuery, app, force: bool = False, wait: bool = False, timeout: float = 30.0)`:
  - Database-first check: invokes `repo.has_sufficient_matching_jobs(...)` unless `force=True`.
  - Single-flight queue coalescing: returns existing future/event if already in flight or queued.
  - Cooldown tracking: enforces 6 hours (21,600s) on unfulfilling terms (`result_count <= 0`).
  - Worker exception handling: records failure cooldown to prevent retry storms.
  - If `wait=True`, caller thread awaits completion event up to `timeout` seconds without holding `app.lock`.

### Backend Service Decomposition (`services/`)
- `JobIndexService`: Manages in-memory jobs cache (`_jobs_by_id`, `_jobs_by_url`), thread-safe updates via `RLock`, $O(1)$ fast lookups in `public_jobs()`.
- `ScrapeOrchestrationService`: Encapsulates `ScrapeCoordinator`, `ScrapePipeline`, and background refresh logic with 1-worker pacing.
- `ApplicationWorkflowService`: Encapsulates job status updates, Kanban pipeline state, note updates, and resume/cover letter generation.

## Code Layout
- Frontend:
  - `frontend/vite.config.js`
  - `frontend/src/components/JobSeeker.jsx`
  - `frontend/src/components/SiteGate.jsx`
  - `frontend/src/components/Dashboard.jsx`
  - `frontend/src/components/__tests__/Dashboard.test.jsx`
- Backend:
  - `backend/src/job_dashboard/db.py`
  - `backend/src/job_dashboard/repository.py`
  - `backend/src/job_dashboard/scrape_coordinator.py`
  - `backend/src/job_dashboard/routes/scrape.py`
  - `backend/src/job_dashboard/services/job_index.py`
  - `backend/src/job_dashboard/services/scrape_orchestrator.py`
  - `backend/src/job_dashboard/services/application_workflow.py`
  - `backend/src/job_dashboard/services/__init__.py`
  - `backend/src/job_dashboard/web.py`
- Documentation:
  - `docs/architecture/phase_improvements_report.md`
