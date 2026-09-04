# Job Dashboard Monorepo

Polyglot monorepo consolidating the backend domain service and frontend user interface for the Job Dashboard platform.

## Architecture & Subprojects

- [Backend (`backend/`)](backend/README.md): Python package (`job_dashboard`) containing core domain logic, multi-provider scrapers, SQLite/WAL persistence, health monitors, and FastAPI/HTTP endpoints.
- [Frontend (`frontend/`)](frontend/README.md): Vite + React Single Page Application featuring interactive Kanban boards, document generator studio, AI psychology profiler, and minimalist Zen Autopilot.

## Quick Start

### Backend (Python)
```bash
cd backend
python3 -m pytest tests/ -v
# Run local server
python3 -m job_dashboard.run_server
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Production build
npm run build
# Test suite
npm test -- --run
```
