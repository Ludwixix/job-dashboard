# ACAA Career Agent V2.0 (Modular Core)

A comprehensive, commercial-ready, and AI-powered job application system. This project features a Python-based core backend, a React Single Page Application (SPA) frontend, intelligent Web Scraping, and automated Document Generation (Resume & Cover Letter) orchestrated by LLMs.

## 🏗️ Architecture

The project is structured into robust, decoupled modules:

- **job-dashboard-modular (Backend Core)**:
  - `models.py`: Stable data contracts (`Job`, `ApplicationRecord`).
  - `score.py` & `classify.py`: Calculates fit dimensions and skill gaps from the candidate's actual profile (`coreSkills`, any industry — not a fixed IT-only taxonomy), and categorizes jobs (e.g. `core-it`, `bridge`).
  - `sources.py`: Multi-source scraping adapters (Seek, Indeed, LinkedIn, Adzuna, RemoteOK) with rate-limiting, per-query caching, and fallbacks. Provider-relative dates are converted to absolute capture-time dates, and `is_recent()` excludes jobs with a missing/unparseable posted date rather than assuming they're fresh.
  - `seek_cache_ingest.py`: Maintained SEEK cache importer. Validates title/company/URL/description/date, rejects stale or badge-only dates such as `Featured`, deduplicates, and atomically writes `data/seek_cache.json` for fallback ingestion when SEEK returns HTTP 403 or is otherwise unavailable.
  - `health.py`: Persists per-source scrape outcomes (success/degraded/unhealthy, job counts, last error) to SQLite so refresh history survives restarts; exposed via `/api/source-health`.
  - `gcs_backup.py`: Restores the local SQLite job index from a GCS bucket on startup and backs it up after every successful refresh, since Cloud Run's container filesystem is ephemeral.
  - `applications.py` / `repository.py`: SQLite WAL persistence for jobs, per-user applications, saved searches, and reminders.
  - `web.py` / `run_server.py`: HTTP API layer integrating Auth, LLM document generation, persistence, and a background sync loop (`JOB_DASHBOARD_SYNC_INTERVAL_SECONDS`, default 30 min) that keeps the index fresh independent of any browser session. Public `GET /api/jobs` reads from the SQLite index, excludes Gmail workflow records and unverifiable dates, and sorts by parsed posting time.

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
- **Authoritative Indexed Feed**: Scrapers write validated listings to SQLite; the frontend reads the indexed database through `/api/jobs`. Cloud Run restores/backups the index through GCS because its local filesystem is ephemeral.
- **Accurate Posting Ages**: Relative provider values such as `9d ago` are frozen to an absolute date at capture time, so the displayed age advances correctly on subsequent visits. Unknown dates are excluded from the public fresh-job feed.

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

### SEEK cache maintenance

When SEEK's public API is unavailable or returns HTTP 403, the backend falls back to the maintained cache only when `JOB_DASHBOARD_SEEK_CACHE_FALLBACK=true`. Produce a new cache from an approved/exported SEEK JSON payload with:

```bash
cd backend
PYTHONPATH=src python3 -m job_dashboard.seek_cache_ingest \
  --input /path/to/seek-export.json \
  --output data/seek_cache.json \
  --days 14
```

The importer writes only listings with a valid HTTP(S) URL, non-empty title/company/description, and a verifiable date within the selected window. It writes atomically, so a partial export cannot replace a previously valid cache.

## 🚀 Quick Start (Local Development)

### 1. Backend Server
The backend handles scraping, SQLite persistence, and LLM orchestration.

```bash
cd backend
# Install dependencies
python3 -m pip install -e '.[scraping]'
python3 -m playwright install chromium

# Run tests
python3 -m pytest tests/ -v

# Start the local API server
PYTHONPATH=src python3 -m job_dashboard.run_server
```

### 2. Frontend React SPA
The frontend communicates with the backend API to render the dashboard.

```bash
cd ../frontend
# Install dependencies
npm install

# Start Vite Dev Server
npm run dev
```

## ☁️ Deployment (Google Cloud Run)

The application has been unified into a single Dockerized container deployed on Google Cloud Run. Use the automated deployment script from the backend directory:

```bash
cd backend
bash deploy-cloudrun.sh acaa-agent
```

Alternatively, to manually build and deploy:
1. Build the frontend and sync static assets:
```bash
cd frontend
VITE_API_BASE_URL="https://job-dashboard-6xrdvjlrcq-ts.a.run.app" npm run build
rm -rf ../backend/src/job_dashboard/static/*
cp -r dist/* ../backend/src/job_dashboard/static/
```

2. Deploy to Cloud Run:
```bash
cd backend
gcloud run deploy job-dashboard --source . --region australia-southeast1 --project acaa-agent \
  --memory 2Gi --cpu 2 --timeout 3600 --max-instances 5 --allow-unauthenticated \
  --set-env-vars JOB_DASHBOARD_GCS_DATA_BUCKET=acaa-agent-job-dashboard-data,\
JOB_DASHBOARD_SEEK_CACHE_PATH=data/seek_cache.json,\
JOB_DASHBOARD_SEEK_CACHE_FALLBACK=true,\
JOB_DASHBOARD_LINKEDIN_ENABLED=false --quiet
```

## ⚙️ Configuration

See `.env.example` for the full list. The important ones for a working production deployment:
- `JOB_DASHBOARD_GCS_DATA_BUCKET`: **required on Cloud Run** — without it, the job index resets on every cold start/redeploy instead of accumulating. The Cloud Run runtime service account needs `roles/storage.objectAdmin` on this bucket.
- `JOB_DASHBOARD_OPENROUTER_API_KEY`: For AI document generation via OpenRouter.
- `JOB_DASHBOARD_ADZUNA_APP_ID` / `JOB_DASHBOARD_ADZUNA_API_KEY`: Required for the Adzuna source; without them it silently returns zero results.
- `JOB_DASHBOARD_SEEK_API_ENDPOINT`: (Optional) Approved Seek API endpoint.
- `JOB_DASHBOARD_SYNC_INTERVAL_SECONDS`: Background scrape/refresh interval (default 1800s / 30 min).
- `JOB_DASHBOARD_SEEK_CACHE_PATH`: Backend-owned maintained SEEK fallback cache (default `data/seek_cache.json`).
- `JOB_DASHBOARD_SEEK_CACHE_FALLBACK`: Enables validated local cache fallback after live SEEK/API/browser failure.
- `JOB_DASHBOARD_LINKEDIN_ENABLED`: Keep `false` in production when LinkedIn browser automation would block other source work.

### Operational verification

```bash
BASE=https://job-dashboard-6xrdvjlrcq-ts.a.run.app
curl -s "$BASE/health"
curl -s "$BASE/api/jobs?page=1&pageSize=10"
curl -s "$BASE/api/source-health?hours=168"
```

The health endpoint confirms the service, `/api/jobs` confirms the indexed database read path, and `/api/source-health` shows whether individual sources returned data or degraded to cache/failure. A `200` response from `/api/refresh` can still include per-source errors in its `errors` array, so inspect that field when validating a fresh run.

