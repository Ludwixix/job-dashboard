# Master Architecture Overhaul & Phase Improvements Report

**Date**: 2026-09-23  
**Repository**: `/home/s/.openclaw/workspace/job-dashboard` (`https://github.com/Ludwixix/job-dashboard.git`)  
**Target Environment**: Google Cloud Run (`acaa-agent` / `australia-southeast1`)  
**Scope**: Full Implementation & Verification of Phases 1 through 4

---

## 1. Executive Summary

This report documents the architectural overhaul, optimization, and verification of the Job Dashboard monorepo across all four targeted roadmap phases:
- **Phase 1: Procedural Cleanup & Dead Code Pruning** — Excised 4,241 lines of dead fallback code in `web.py`, implemented `get_application_events()` in `JobRepository`, aligned GCS environment variables, and pruned unused context files.
- **Phase 2: Frontend Bundle De-bloating & Code Splitting** — Implemented Vite manual chunking rules (`vendor-charts`, `vendor-dnd`, `vendor-pdf-parse`, `vendor-pdf-gen`, `vendor-date`), lazy-loaded root gates (`SiteGate`, `OnboardingFlow`), and reduced the production entry chunk (`index-*.js`) from **1,386.63 kB** to **384.53 kB** (**72.3% reduction**, well below the 400 kB ceiling).
- **Phase 3: Query Optimization & Ingestion Hardening** — Introduced SQLite FTS5 full-text indexing (`jobs_fts`) with real-time automatic synchronization triggers (`AFTER INSERT`, `AFTER DELETE`, `AFTER UPDATE`), composite indices on `user_applications(user_id, updated_at DESC)` and `application_events(job_id, occurred_at DESC)`, and asynchronous single-flight queue routing via `ScrapeCoordinator` for `/api/refresh` and `/api/scrape`.
- **Phase 4: Service Decomposition of `DashboardApp`** — Decomposed the monolithic application logic into three focused domain services (`JobIndexService`, `ScrapeOrchestrationService`, and `ApplicationWorkflowService`) with dual-indexed $O(1)$ in-memory lookups, while maintaining 100% backward compatibility.

All verification gauntlets passed with 100% success rate:
- **Backend Tests**: 344 passed, 3 skipped in 12.55s.
- **Frontend Tests**: 437 passed in 81 test files in 17.03s.
- **Frontend Linting**: 0 errors.

---

## 2. Phase-by-Phase Technical Details

### Phase 1: Dead Code Pruning & Route Modernization
- **`backend/src/job_dashboard/web.py`**:
  - Excised 4,241 lines of obsolete procedural `if/elif` blocks inside `do_GET`, `do_POST`, and `do_DELETE` that were superseded by `routes/` and `router.py`.
  - Reduced `web.py` line count from 6,782 to 2,541 lines.
- **`backend/src/job_dashboard/repository.py`**:
  - Implemented `JobRepository.get_application_events(user_id_or_job_id, job_id=None)` returning chronological transition records sorted by `occurred_at DESC`.
- **`backend/src/job_dashboard/routers/backup.py`**:
  - Aligned Cloud Storage bucket configuration to check `JOB_DASHBOARD_GCS_DATA_BUCKET`.
- **Frontend Cleanup**:
  - Deleted unused `frontend/src/context/ModalContext.jsx` (185 lines, 0 active consumers).

### Phase 2: Frontend Bundle De-bloating & Chunking
- **Chunk Partitioning in `vite.config.js`**:
  - `vendor-charts`: isolated `recharts` into separate 348 kB chunk.
  - `vendor-dnd`: isolated `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` into 42 kB chunk.
  - `vendor-pdf-parse`: isolated `pdfjs-dist` into 429 kB chunk.
  - `vendor-pdf-gen`: isolated `jspdf` and `html2canvas` into 750 kB chunk.
  - `vendor-date`: isolated `date-fns` into 23 kB chunk.
- **Dynamic Imports & Code Splitting**:
  - Lazy-loaded `SiteGate` and `OnboardingFlow` at the root application level.
  - Extracted lightweight `siteGateStorage.js` utility to allow `SiteGate` to be cleanly code-split into a separate 18.89 kB chunk.
  - Replaced legacy `utils/statusColors.js` with unified `utils/statusStyles.js` and updated `Badge.jsx`.
- **Measured Production Metrics**:
  - Initial JS bundle dropped from **1.39 MB (1,386.63 kB)** to **384.53 kB (98.50 kB gzip)**.

### Phase 3: SQLite FTS5 Indexing & Scraper Coordination
- **FTS5 Virtual Table & Auto-Sync Triggers**:
  ```sql
  CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(
      id UNINDEXED,
      title,
      company,
      stream,
      description,
      tokenize = 'porter unicode61'
  );

  CREATE TRIGGER IF NOT EXISTS jobs_ai AFTER INSERT ON jobs BEGIN
      INSERT INTO jobs_fts(id, title, company, stream, description)
      VALUES (new.id, new.title, new.company, new.stream, new.description);
  END;

  CREATE TRIGGER IF NOT EXISTS jobs_ad AFTER DELETE ON jobs BEGIN
      DELETE FROM jobs_fts WHERE id = old.id;
  END;

  CREATE TRIGGER IF NOT EXISTS jobs_au AFTER UPDATE ON jobs BEGIN
      DELETE FROM jobs_fts WHERE id = old.id;
      INSERT INTO jobs_fts(id, title, company, stream, description)
      VALUES (new.id, new.title, new.company, new.stream, new.description);
  END;
  ```
- **FTS5 Query Acceleration**:
  - Implemented `JobRepository._sanitize_fts_query(term)` to tokenize and quote query strings.
  - `find_fresh_matching_jobs()` queries `jobs_fts MATCH ?` with sub-10ms performance, falling back to substring `LIKE` matching if needed.
- **Composite Database Indices**:
  - `idx_user_apps_user_updated ON user_applications(user_id, updated_at DESC)`
  - `idx_app_events_job ON application_events(job_id, occurred_at DESC)`
- **Scraper Invariants & Anti-Double-Dipping**:
  - Updated `handle_scrape_refresh` in `routes/scrape.py` to support asynchronous queueing via `ScrapeCoordinator`.
  - Coordinated background cooldowns (`_cooldown_tracker`) with foreground scraping in `app.refresh()` to prevent redundant board queries within 6 hours.

### Phase 4: Service Decomposition of `DashboardApp`
- **`JobIndexService` (`backend/src/job_dashboard/services/job_index.py`)**:
  - Provides thread-safe $O(1)$ dual lookups (`get_job(id)`, `get_job_by_url(url)`).
  - Handles job normalization, scoring, and atomic disk persistence to `jobs.json` and `jobs_combined.json`.
- **`ScrapeOrchestrationService` (`backend/src/job_dashboard/services/scrape_orchestrator.py`)**:
  - Encapsulates multi-source scraping execution, search query persistence, and `ScrapeCoordinator` single-flight queue management.
- **`ApplicationWorkflowService` (`backend/src/job_dashboard/services/application_workflow.py`)**:
  - Encapsulates Kanban application lifecycle, document generation caches, and recruiter network CRM.
- **Facade Compatibility**:
  - `DashboardApp` instantiates and delegates to these services while preserving all route contracts and legacy attribute access (`app.jobs`, `app.refresh`, `app.materialize_jobs`, `app.repository`).

---

## 3. Verification Matrix

| Test Suite | Components Tested | Total Tests | Pass Count | Fail Count | Duration |
|:---|:---|:---:|:---:|:---:|:---:|
| **Backend Pytest** | Repository, FTS5, Services, Scrapers, Auth, API Routes | 347 | 344 (3 skipped) | 0 | 12.55s |
| **Frontend Vitest** | UI Components, Modals, Services, Hooks, Integration | 437 | 437 | 0 | 17.03s |
| **Frontend Oxlint** | 253 frontend source files | 104 rules | Clean (0 errors) | 0 | 0.24s |
| **Vite Production Build** | Production Rollup bundle, chunk splitting, static sync | 67 chunks | Initial chunk 384 kB (<400 kB ceiling) | 0 | 0.80s |

---

## 4. Conclusion & Next Steps

All objectives defined in the current architecture overhaul roadmap and user goals are fulfilled. The codebase is clean, performant, modular, and ready for production deployment to Cloud Run and git push.

