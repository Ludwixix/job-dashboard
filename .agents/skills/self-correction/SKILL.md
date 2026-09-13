---
name: self-correction
description: Monorepo self-healing, bug diagnostic, and procedural correction knowledgebase for job-dashboard.
---

# Monorepo Self-Correction & Autonomous Engineering Skill

This skill documents verified procedural solutions for recurring system bottlenecks, runtime exceptions, and testing regressions in the `job-dashboard` monorepo.

---

## Procedural Self-Improvement Loop

When an exception, test failure, or build issue occurs:
1. **Isolate Trace**: Capture the exact stack trace and failing assertion.
2. **Execute Critic Protocol**: Run dual-persona review to prevent bundle bloat, maintain Suspense alignment, and check edge cases.
3. **Targeted Fix**: Apply the minimal necessary patch in `backend/src/` or `frontend/src/`.
4. **Verify**: Run `python3 -m pytest tests/ -v` (backend) or `npm test -- --run` (frontend).
5. **Log Correction**: Add an entry under the appropriate framework header below.

---

### [Backend/Python]

#### 1. SQLite Database Locks & Concurrency Contention
- **Symptoms**:
  - `sqlite3.OperationalError: database is locked`
  - `sqlite3.DatabaseError: database disk image is malformed`
  - Long HTTP 503 or 500 delays on `/api/jobs` under concurrent requests.
- **Root Cause**:
  - Unpooled, direct `sqlite3.connect()` calls bypass connection lifecycle management and keep open locks across thread boundaries.
  - Docker container builds copying dirty WAL journal files (`jobs.sqlite3-wal`, `jobs.sqlite3-shm`) into production images without a matching main database state.
- **Procedural Resolution**:
  1. **Connection Pool Enforcement**: Always use `get_db_connection(self.path)` from `job_dashboard.db_pool` as a context manager. Never instantiate standalone `sqlite3.connect()` calls in business logic.
  2. **WAL Configuration**: Ensure database initialization executes:
     ```sql
     PRAGMA journal_mode = WAL;
     PRAGMA synchronous = NORMAL;
     PRAGMA busy_timeout = 5000;
     ```
  3. **Auto-Recovery on Startup**: Implement `_check_and_recover_db()` in `JobRepository._init_schema()`:
     - Run `PRAGMA integrity_check` on startup.
     - If corrupt, flush the active connection pool, delete the corrupt SQLite file, and re-initialize a clean schema.
  4. **Docker / Cloud Run Clean State**: Add `data/*.sqlite3*` to `backend/.gcloudignore` so runtime databases are never packaged into build tarballs.

#### 2. Test Fixture Time-Drift (`is_recent` Date Boundaries)
- **Symptoms**:
  - `AssertionError: assert 0 > 0` or `assert 0 == 1` in `test_sources.py` or `test_repository.py`.
- **Root Cause**:
  - Test fixtures hardcoding calendar dates (e.g. `"posted": "2026-08-24"`). When the current calendar date exceeds 14 days from that date, `is_recent(days=14)` excludes the jobs, causing valid scraper pipelines to produce 0 results.
- **Procedural Resolution**:
  - Always generate fixture posted dates dynamically:
    ```python
    today_iso = datetime.now(timezone.utc).date().isoformat()
    ```

#### 3. Deterministic ATS Metric Tokenization & Sanitizer Boundaries
- **Symptoms**:
  - Inaccurate STAR density metrics or regex catastrophic backtracking when parsing unformatted, multi-page CV text.
- **Root Cause**:
  - Overly broad regex patterns for metric detection matching generic numbers (dates, phone numbers, page numbers) as quantitative achievements.
- **Procedural Resolution**:
  - Disqualify isolated 4-digit calendar years (`(?!19\d\d|20\d\d)`) and standalone single digits from metric quantifiers unless accompanied by metric units (%, $, k, M, x, fold, ms, etc.).
  - Benchmark regex tokenization with linear-time pre-tokenized scanning or bounded character lookbehinds/lookaheads.

---

### [Frontend/React]

#### 1. Vite Bundling Exceptions & Dynamic Chunk Splitting
- **Symptoms**:
  - `RollupError: Unexpected early chunk termination` or initial bundle size exceeding 1.2 MB.
  - White screen on initial page load with React hydration / Suspense rendering errors.
- **Root Cause**:
  - Direct, eager imports of large secondary modals (e.g. `GeneratorModal`, `InterviewSuiteModal`, `AnalyticsDashboard`) in `Dashboard.jsx` or `App.jsx`.
- **Procedural Resolution**:
  1. **Lazy Loading**: Convert heavy components to `React.lazy()` with named-to-default resolution:
     ```javascript
     const JobModal = lazy(() => import('./JobModal').then(m => ({ default: m.JobModal })));
     ```
  2. **Suspense Boundaries**: Wrap every lazy component in `<SafeErrorBoundary>` and `<Suspense fallback={<ModalSkeleton />}>`.
  3. **Rollup Manual Chunks**: In `vite.config.js`, group large dependencies into dedicated vendor chunks:
     ```javascript
     manualChunks: {
       'vendor-react': ['react', 'react-dom'],
       'vendor-icons': ['lucide-react'],
       'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
     }
     ```

#### 2. Context Provider Omission in Isolated Component Tests
- **Symptoms**:
  - `Error: useToast must be used within a ToastProvider` when running unit tests.
- **Root Cause**:
  - Component under test invokes a hook (`useToast`, `useJobs`) whose context provider is mounted in `main.jsx` rather than inside the component itself.
- **Procedural Resolution**:
  - Provide a safe no-op fallback inside the hook when context is undefined:
    ```javascript
    export const useToast = () => {
      const context = useContext(ToastContext);
      if (!context) {
        return { addToast: () => {}, removeToast: () => {} };
      }
      return context;
    };
    ```

#### 3. Nested Interactive Tags (`<button>` inside `<button>`) in Action Card Grids
- **Symptoms**:
  - Hydration warnings (`Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>`), click bubbling deadlocks, or secondary modal buttons failing to trigger their `onClick` handlers.
- **Root Cause**:
  - Action cards implemented as outer `<button>` elements mistakenly containing secondary inline trigger buttons (e.g. "Intel Hub" or "ATS Sentinel" trigger buttons embedded inside a parent card button).
- **Procedural Resolution**:
  - Implement action cards using non-interactive containers (`<div role="group" className="...">`) with individual dedicated `<button>` triggers, or convert secondary actions into sibling elements with `e.stopPropagation()` handlers.

#### 4. API Base Utility Standardization (`getBackendApiBase`)
- **Symptoms**:
  - `TypeError: getApiBase is not a function` in newly added frontend service modules.
- **Root Cause**:
  - Importing legacy `getApiBase` instead of `getBackendApiBase` from `../services/apiConfig.js`.
- **Procedural Resolution**:
  - Always import `getBackendApiBase` from `apiConfig.js` across all API service layers.

