# ACAA Career Agent V2.0 (Modular Core)

A comprehensive, commercial-ready, and AI-powered job application system. This project features a Python-based core backend, a React Single Page Application (SPA) frontend, intelligent Web Scraping, and automated Document Generation (Resume & Cover Letter) orchestrated by LLMs.

## 🏗️ Architecture

The project is structured into robust, decoupled modules:

- **job-dashboard-modular (Backend Core)**:
  - `models.py`: Stable data contracts (`Job`, `ApplicationRecord`).
  - `score.py` & `classify.py`: Calculates fit dimensions and skill gaps from the candidate's actual profile (`coreSkills`, any industry — not a fixed IT-only taxonomy), and categorizes jobs (e.g. `core-it`, `bridge`).
  - `sources.py`: Multi-source scraping adapters (Seek, Indeed, LinkedIn, Adzuna, RemoteOK) with rate-limiting, per-query caching, and fallbacks. `is_recent()` excludes jobs with a missing/unparseable posted date rather than assuming they're fresh.
  - `health.py`: Persists per-source scrape outcomes (success/degraded/unhealthy, job counts, last error) to SQLite so refresh history survives restarts; exposed via `/api/source-health`.
  - `gcs_backup.py`: Restores the local SQLite job index from a GCS bucket on startup and backs it up after every successful refresh, since Cloud Run's container filesystem is ephemeral.
  - `applications.py` / `repository.py`: SQLite WAL persistence for jobs, per-user applications, saved searches, and reminders.
  - `web.py` / `run_server.py`: HTTP API layer integrating Auth, LLM document generation, persistence, and a background sync loop (`JOB_DASHBOARD_SYNC_INTERVAL_SECONDS`, default 30 min) that keeps the index fresh independent of any browser session.

- **job-dashboard-react (Frontend SPA)**:
  - **Job Cards V2**: Scannable, highly-optimized job cards with an honest "posted X days ago" badge (`src/utils/dateUtils.js` — unknown/unparseable dates are never shown as "posted today").
  - **Application Studio**: Expandable deep-dive view with the real scraped job description (formatted, scrollable, complete), a robust FIT Audit, and real-time synchronized PDF editors.
  - **Career Operations**: Saved search profiles, application reminders, per-job fit explanations, and live scraper source-health, all driven by the backend endpoints below.
  - **Enterprise Resilience**: Safe Error Boundaries prevent full-app crashes, backed by safe local storage wrappers.
  - **Smart Profile**: Auto-synthesizes user profiles via resume upload/parsing; saving a profile pushes personalized search queries to the backend (`/api/search-criteria`) and seeds ranking preferences before the next discovery scrape runs.

## ✨ V2.0 Commercial Enhancements

- **SQLite WAL Persistence + GCS Backup**: Jobs, applications, saved searches, and reminders persist in a SQLite WAL database, backed up to GCS so the index survives Cloud Run cold starts and redeploys instead of resetting to the container image's baked-in snapshot.
- **Live PDF Document Sync**: Backend API endpoints orchestrate real-time updates from frontend debounced editors straight into dynamically generated PDFs.
- **Smart Portal Resolution**: Auto-Apply routing resolves complex scraping links to guarantee accurate application portal handoffs.
- **Cloud Run Native**: Unified Dockerfile configuration serving both the Python backend and pre-compiled static Vite frontend assets in a single Google Cloud Run deployment.

## 📡 Key API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/jobs` | Paginated job index (the source of truth the frontend renders from) |
| `POST /api/refresh`, `GET/POST /api/scrape/stream` | Trigger a scrape; both are cache-aware (`ttl_hours`, default 12h) and persist results |
| `POST /api/search-criteria` | Replace the backend's active scrape queries (used for profile-driven personalization) |
| `GET /api/source-health` | Per-source scrape health history (success/degraded, job counts, last error) |
| `GET/POST /api/saved-searches` | User-scoped saved search profiles |
| `GET/POST /api/reminders`, `POST /api/reminders/dismiss` | Application follow-up/interview/offer reminders |
| `GET /api/job-explanation` | Deterministic fit-audit explanation (score, matched/missing skills, strengths, gaps) |
| `GET/POST /api/applications`, `/api/profile`, `/api/preferences` | Per-user application tracking, profile, and ranking preferences |

## 🚀 Quick Start (Local Development)

### 1. Backend Server
The backend handles scraping, SQLite persistence, and LLM orchestration.

```bash
cd /home/s/.openclaw/workspace/job-dashboard-modular
# Install dependencies
python3 -m pip install -e '.[scraping]'
python3 -m playwright install chromium

# Run tests
python3 -m pytest

# Start the local API server
PYTHONPATH=src python3 -m job_dashboard.run_server
```

### 2. Frontend React SPA
The frontend communicates with the backend API to render the dashboard.

```bash
cd /home/s/.openclaw/workspace/job-dashboard-react
# Install dependencies
npm install

# Start Vite Dev Server
npm run dev
```

## ☁️ Deployment (Google Cloud Run)

The application has been unified into a single Dockerized container deployed on Google Cloud Run.

1. Build the frontend and sync static assets:
```bash
cd job-dashboard-react
VITE_API_BASE_URL="https://job-dashboard-6xrdvjlrcq-ts.a.run.app" npm run build
rm -rf ../job-dashboard-modular/src/job_dashboard/static/*
cp -r dist/* ../job-dashboard-modular/src/job_dashboard/static/
```

2. Deploy to Cloud Run (the GCS bucket env var is required for the job index to persist across cold starts/redeploys — see Configuration below):
```bash
cd job-dashboard-modular
gcloud run deploy job-dashboard --source . --region australia-southeast1 --project acaa-agent \
  --memory 2Gi --cpu 2 --timeout 3600 --max-instances 10 --allow-unauthenticated \
  --set-env-vars JOB_DASHBOARD_GCS_DATA_BUCKET=acaa-agent-job-dashboard-data --quiet
```

## ⚙️ Configuration

See `.env.example` for the full list. The important ones for a working production deployment:
- `JOB_DASHBOARD_GCS_DATA_BUCKET`: **required on Cloud Run** — without it, the job index resets on every cold start/redeploy instead of accumulating. The Cloud Run runtime service account needs `roles/storage.objectAdmin` on this bucket.
- `JOB_DASHBOARD_OPENROUTER_API_KEY`: For AI document generation via OpenRouter.
- `JOB_DASHBOARD_ADZUNA_APP_ID` / `JOB_DASHBOARD_ADZUNA_API_KEY`: Required for the Adzuna source; without them it silently returns zero results.
- `JOB_DASHBOARD_SEEK_API_ENDPOINT`: (Optional) Approved Seek API endpoint.
- `JOB_DASHBOARD_SYNC_INTERVAL_SECONDS`: Background scrape/refresh interval (default 1800s / 30 min).

