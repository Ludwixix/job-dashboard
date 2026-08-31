# ACAA Career Agent V2.0 (Modular Core)

A comprehensive, commercial-ready, and AI-powered job application system. This project features a Python-based core backend, a React Single Page Application (SPA) frontend, intelligent Web Scraping, and automated Document Generation (Resume & Cover Letter) orchestrated by LLMs.

## 🏗️ Architecture

The project is structured into robust, decoupled modules:

- **job-dashboard-modular (Backend Core)**: 
  - `models.py`: Stable data contracts (`Job`, `ApplicationRecord`).
  - `score.py` & `classify.py`: Calculates fit dimensions, skill gaps, and categorizes jobs intelligently (e.g. `core-it`, `bridge`).
  - `sources.py`: Provides multi-source scraping adapters (Seek, Indeed, LinkedIn, Adzuna) with intelligent rate-limiting and fallbacks.
  - `applications.py`: Manages high-performance SQLite WAL state for Job Application tracking (`ApplicationTracker`).
  - `web.py` / `run_server.py`: HTTP API layer integrating Auth, LLM document generation, and persistence.

- **job-dashboard-react (Frontend SPA)**:
  - **Job Cards V2**: Scannable, highly-optimized job cards.
  - **Application Studio**: Expandable deep-dive view with beautifully formatted job descriptions, a robust FIT Audit, and real-time synchronized PDF editors.
  - **Enterprise Resilience**: Safe Error Boundaries prevent full-app crashes, backed by safe local storage wrappers.
  - **Smart Profile**: Auto-synthesizes user profiles via Google OAuth.

## ✨ V2.0 Commercial Enhancements

- **SQLite WAL Persistence**: Fully transitioned from Google Sheets to a robust SQLite Write-Ahead Logging database for immediate, reliable state management across user sessions.
- **Live PDF Document Sync**: Backend API endpoints orchestrate real-time updates from frontend debounced editors straight into dynamically generated PDFs.
- **Smart Portal Resolution**: Auto-Apply routing resolves complex scraping links to guarantee accurate application portal handoffs.
- **Cloud Run Native**: Unified Dockerfile configuration serving both the Python backend and pre-compiled static Vite frontend assets in a single Google Cloud Run deployment.

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
npm run build
rm -rf ../job-dashboard-modular/src/job_dashboard/static/*
cp -r dist/* ../job-dashboard-modular/src/job_dashboard/static/
```

2. Deploy to Cloud Run:
```bash
cd job-dashboard-modular
gcloud run deploy job-dashboard --source . --region australia-southeast1 --project acaa-agent --quiet
```

## ⚙️ Configuration

Set the following environment variables (locally in `.env` or in GCP Secret Manager):
- `OPENROUTER_API_KEY`: For AI document generation via OpenRouter.
- `ADZUNA_APP_ID` / `ADZUNA_API_KEY`: For Adzuna scraping.
- `SEEK_API_ENDPOINT`: (Optional) Approved Seek API endpoint.
