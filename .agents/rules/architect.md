# Architectural Compliance & Monorepo Engineering Guidelines

## Mandatory Pre-Implementation Reading
Before writing, modifying, or refactoring any backend endpoints (Python) or frontend components/views (React):
1. **Search and inspect `docs/tasks/`** for existing architectural proposals and milestones:
   - `docs/tasks/ai-layer-roadmap.md`: System-wide autonomous AI agent & copilot architecture.
   - `docs/tasks/google-integrations-consolidation-proposal.md`: Consolidated Google Workspace hub patterns.
   - `docs/tasks/interview-modals-consolidation-proposal.md`: Consolidated interview prep and simulation architecture.
   - `docs/tasks/styles.md`: Visual tokens, typography hierarchy, and glassmorphism standards.
2. **Phase 3 Code-Splitting & Lazy Loading Milestones**:
   - Every secondary view, modal dialog, and heavy analytics tab must strictly leverage `React.lazy()` and code splitting.
   - Never import modals eagerly into `App.jsx` or `Dashboard.jsx`.
3. **Phase 4 Service Consolidation Milestones**:
   - Consolidate redundant standalone services into unified domain modules rather than adding one-off utilities.

---

## Backend Architectural Constraints (Python / SQLite)

1. **SQLite Concurrency & WAL Protocol**:
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
2. **Startup Auto-Recovery & Schema Integrity**:
   - All repository initializations must execute `_check_and_recover_db()` prior to running schema scripts to auto-heal malformed databases.
   - In Docker/Cloud Run packaging, never bake live SQLite databases (`*.sqlite3`, `*.sqlite3-wal`, `*.sqlite3-shm`) into images; let the container initialize a clean state on startup.
3. **No External Database Dependencies**:
   - The backend is local and self-contained. Do NOT introduce PostgreSQL, MySQL, Supabase, or remote database client drivers.
4. **Time-Insensitive Test Fixtures**:
   - Never hardcode fixed calendar dates (e.g., `2026-08-24`) in test fixtures that are validated by `is_recent(days=14)`.
   - Always generate dynamic test dates using `datetime.now(timezone.utc).date().isoformat()`.

---

## Frontend Architectural Constraints (React / Vite / Tailwind)

1. **Strict Dynamic Code-Splitting (`React.lazy`)**:
   - All modal dialogs and secondary dashboards must be loaded on-demand:
     ```jsx
     const JobModal = lazy(() => import('./JobModal').then(m => ({ default: m.JobModal })));
     ```
   - Every lazy component must be safely wrapped inside a `<SafeErrorBoundary>` and `<Suspense fallback={<ModalSkeleton />}>`.
2. **Typography & Readability Standards**:
   - Content areas (job titles, company names, job descriptions, form inputs) must use readable sans-serif typography (`type-heading`, `type-body`, `font-sans`).
   - Monospace typography (`font-mono`) is strictly reserved for UI chrome, status badges, telemetry stats, and terminal indicators.
3. **Component Consolidation & UI Primitives**:
   - Use centralized UI primitives from `src/components/ui/`: `Button.jsx`, `Modal.jsx`, `Badge.jsx`, `EmptyState.jsx`.
   - Use centralized status styles from `src/utils/statusStyles.js` (`statusBadgeClass`, `statusDotClass`).
   - Do not invent duplicate modal wrappers or custom buttons that bypass focus states or accessibility attributes.
4. **Desktop Screen Utilization**:
   - Maximize screen real estate. Avoid arbitrary restrictive containers (`max-w-2xl`, `max-w-3xl`) for primary views. Expand grids smoothly to `3xl`, `4xl`, and `5xl` breakpoints.
