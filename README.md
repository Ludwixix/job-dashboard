# ACAA Job Dashboard

A comprehensive, modular, and AI-powered job application system. This project features a Python-based core backend, a React Single Page Application (SPA) frontend, intelligent Web Scraping, and automated Document Generation (Resume & Cover Letter) tailored to specific job requirements using LLMs.

## Architecture

The project consists of several components working in tandem:

- **job-dashboard-modular (Backend Core)**: 
  - `models.py`: Stable data contracts (`Job`, `ApplicationRecord`).
  - `score.py` & `classify.py`: Calculates fit dimensions, gaps, and categorizes jobs (e.g. `core-it`, `bridge`).
  - `sources.py`: Provides scraping adapters (Seek, Indeed, LinkedIn, Adzuna) with robust fallbacks.
  - `applications.py`: Manages SQLite state for Job Application tracking (ApplicationTracker).
  - `web.py`: The HTTP server providing APIs for the frontend.

- **job-dashboard-react (Frontend SPA)**:
  - Built with Vite, React, and TailwindCSS.
  - **Job Cards V2**: Highly optimized, scannable job cards displaying at-a-glance metadata, top matched skills, and "Star/Save" functionality.
  - **Job Modal**: Expandable deep-dive view with beautifully formatted job descriptions, a robust FIT Audit, and 1-click Auto-Apply actions.
  - **Auto-Apply Engine**: Leverages AI to pre-fill screening questions, dynamically generate tailored PDF Resumes/Cover Letters, and seamlessly dispatch the user to the application portal.

## Quick Start (Local Development)

### 1. Backend Server
The backend handles scraping, SQLite persistence, and LLM orchestration.

```bash
cd /home/s/.openclaw/workspace/job-dashboard-modular
# Install dependencies
python -m pip install -e '.[scraping]'
python -m playwright install chromium

# Run tests
python -m pytest

# Start the local API server
PYTHONPATH=src python -m job_dashboard.run_server
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

## Features

- **Multi-Source Scraping**: Scrapes SEEK, Indeed, LinkedIn, and Adzuna in real-time or via cache fallbacks.
- **AI Document Generation**: Uses OpenRouter (or local fallbacks) to dynamically synthesize a customized Resume and Cover Letter strictly based on your "Source of Truth" profile context.
- **Smart Scoring & FIT Audit**: Evaluates the job description against your profile to score compatibility and highlight missing/matching skills.
- **Auto-Apply**: 1-click pipeline that generates documents, compiles a candidate payload, copies it to the clipboard, and opens the job portal.
- **Starred Jobs**: Save jobs locally for future review.
- **Kanban Board & Tracker**: Move jobs through lifecycle stages (Applied, Interviewing, Offer).

## Deployment (Google Cloud Run)

The application has been unified into a single Dockerized container deployed on Google Cloud Run. 
The static React assets are built and served by the Python backend.

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
./deploy-cloudrun.sh
```

## Configuration

Set the following environment variables (locally in `.env` or in GCP Secret Manager):
- `OPENROUTER_API_KEY`: For AI document generation.
- `ADZUNA_APP_ID` / `ADZUNA_API_KEY`: For Adzuna scraping.
- `SEEK_API_ENDPOINT`: (Optional) Approved Seek API endpoint.
