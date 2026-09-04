# Job Dashboard Context Map

Permanent navigation map and operational guide for the `job-dashboard` polyglot monorepo.
- **Canonical Repository**: [https://github.com/Ludwixix/job-dashboard](https://github.com/Ludwixix/job-dashboard)
- **Local Path**: `/home/s/.openclaw/workspace/job-dashboard`
- **Default Branch**: `master`

## Operating Modes
- Default to Fast mode for isolated single-file edits; only use Planning mode for cross-module refactors.
- Never read, print, stage, or commit secret files (`.env*`, `client_secret*.json`, `KEYS.md`, `OpenRouterAPI.txt`, `credentials/`).

## Monorepo Architecture

The repository is divided into two primary subtrees:
- `backend/`: Python service package (`job_dashboard`) handling domain models, multi-provider scrapers, SQLite/WAL persistence, and HTTP/REST endpoints.
- `frontend/`: Vite + React SPA providing the user interface (Kanban board, tailored document generation, psychology profiler, and minimalist Zen Autopilot).

## Production Deployment
- The live production backend targets Google Cloud Run: https://job-dashboard-6xrdvjlrcq-ts.a.run.app/

## Backend Modules (`backend/src/job_dashboard/`)
- API Boundary: `api/` is the sole entrypoint the frontend may interact with; request handlers must not import internal domain modules or `service.py` directly.
- Domain Models & Types: `models.py`, `types.py`
- Normalization & Cleaning: `normalize.py`, `utils.py`
- Classification & Taxonomy: `classify.py`
- Match Scoring Engine: `score.py`
- Applications & Tracking: `applications.py`, `smart_applications.py`
- Domain Services & Facades: `service.py`
- Scraper Contracts & Adapters: `sources/` (`indeed.py`, `adzuna.py`, `remoteok.py`, `seek.py`, `linkedin.py`, `base.py`, `dedup.py`)
- Database & WAL Persistence: `db_pool.py`, `repository.py`
- Server & HTTP Endpoints: `web.py`, `run_server.py`
- Diagnostics & Integrity: `health.py`, `verifier.py`
- Tests: `backend/tests/` (execute via `cd backend && python3 -m pytest tests/ -v`)

## Frontend Modules (`frontend/src/`)
- Application Shell: `App.jsx`, `main.jsx`, `index.css`
- UI Components: `components/` (e.g., `Dashboard.jsx`, `JobModal.jsx`, `ZenAutopilotDashboard.jsx`, `CustomJobModal.jsx`)
- State & Business Services: `services/` (e.g., `dataService.js`, `generationService.js`, `profileService.js`, `trackerService.js`)
- Shared Helpers & Parsers: `utils/` (e.g., `dateUtils.js`, `documentParser.js`)
- Static Data & Assets: `frontend/public/` (`jobs_combined.json`)
- Tests & Specs: `frontend/src/**/__tests__/` (execute via `cd frontend && npm test -- --run`)
- Build: `cd frontend && npm run build`

## Documentation & References
- Root Monorepo Guide: `README.md`
- Backend Documentation: `backend/README.md`, `backend/docs/`
- Frontend Documentation: `frontend/README.md`
