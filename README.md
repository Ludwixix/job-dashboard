# Job Dashboard Monorepo

Polyglot monorepo consolidating the backend domain service, multi-provider scrapers, SQLite/WAL persistence, and React frontend SPA for the Job Dashboard platform.

## 🏗️ Architecture & Subprojects

- **[Backend (`backend/`)](backend/README.md)**: Python package (`job_dashboard`) containing core domain logic, multi-provider scrapers (SEEK, Indeed, Adzuna, RemoteOK), SQLite/WAL persistence, health monitors, and FastAPI/HTTP endpoints.
- **[Frontend (`frontend/`)](frontend/README.md)**: Vite + React Single Page Application featuring interactive Kanban boards, document generator studio, AI psychology profiler, and minimalist Zen Autopilot.
- **[Documentation & Tasks (`docs/`)](docs/)**: Architectural proposals, task roadmaps, and AI layer evaluations:
  - `docs/tasks/ai-layer-roadmap.md`: Research evaluation on Crawl4AI and embedding-based matching.
  - `docs/tasks/interview-modals-consolidation-proposal.md`: Consolidation design for interview preparation modals.
  - `docs/tasks/google-integrations-consolidation-proposal.md`: Consolidation design for Google Workspace and passkey identity.
  - `docs/Resume_Optimization.md`: ATS and algorithmic recruitment optimization guidelines.

## ⚡ Recent Architectural Milestones

- **Phase 1 (Dead Code Eradication)**: Removed obsolete `job-collector/` legacy packages (-1,978 LOC) and cleaned root clutter.
- **Phase 2 (Component Deduplication)**: Removed orphaned Kanban and Table tracker components in favor of unified `ApplicationPipeline` (-1,381 LOC).
- **Phase 3 (Dashboard Code-Splitting)**: Converted all 11 heavy modal dialogs to dynamic `React.lazy` imports with `Suspense` and `ModalSkeleton`, shrinking the main JavaScript bundle from 1.84 MB down to 1.19 MB (-34.9% raw, -34.0% gzip).
- **Phase 4 (Service Consolidation Proposals)**: Produced architectural consolidation proposals for interview intelligence and Google Workspace services.

## 🚀 Quick Start

### Backend (Python)
```bash
cd backend
# Run test suite (108 tests)
python3 -m pytest tests/ -v

# Run local API server
PYTHONPATH=src python3 -m job_dashboard.run_server
```

### Frontend (React + Vite)
```bash
cd frontend
# Install dependencies
npm install

# Run dev server
npm run dev

# Run test suite (18 suites, 48 tests)
npm test -- --run

# Production bundle build
npm run build
```

## ☁️ Deployment (Google Cloud Run)

The application packages both the Python backend and pre-compiled React SPA into a single container deployed to Cloud Run:

```bash
cd backend
bash deploy-cloudrun.sh acaa-agent
```

- **Production URL**: `https://job-dashboard-6xrdvjlrcq-ts.a.run.app/`
- **Health Check**: `curl https://job-dashboard-6xrdvjlrcq-ts.a.run.app/health`

