# Full-Stack De-Monolithification — Migration & Continuity State

> **Continuity Document**: This file records the active architectural state, completed milestones, ongoing tasks, and operational protocols. An external OpenRouter or Antigravity agent can read this file and seamlessly resume implementation without loss of context.
> **Repository Root**: `/home/s/.openclaw/workspace/job-dashboard`  
> **Last Updated**: 2026-09-20T03:10:00Z  
> **Integrity Mode**: Development / Strict Zero Regression

---

## 1. Architectural Strategy & Decision Record (R1)

- **Strategy Selected**: **Option A — Strangler Fig Custom Regex Router on `http.server.BaseHTTPRequestHandler`** (Unanimously approved).
- **Alternative Evaluated & Rejected**: **Option B — FastAPI / Starlette Migration**.
  - *Rejection Rationale*: Migrating to FastAPI would immediately break ~139 Pytest unit tests that mock `BaseHTTPRequestHandler` internals, introduce fatal event-loop starvation when interacting with synchronous SQLite WAL transactions and Playwright scraper threads, and risk exceeding Cloud Run's 2GB memory ceiling.
- **Architectural Guardrails**:
  1. `Router.dispatch(handler, method, path)` strips query parameters via `urlparse(handler.path).path` before regex matching.
  2. `make_handler(app)` assigns `Handler.app = app` at class-level so dynamically instantiated handler instances preserve application context.
  3. `web.py` retains legacy fallback logic during transitions: unregistered routes fall through cleanly.
  4. Frontend services (`profileService.js`, `generationService.js`) retain 100% public facade re-exports so no existing components or test mocks break.
  5. User Directive: Code implementation subagents use `Model='flash'`.

---

## 2. Milestone Execution Roadmap

| Milestone | Scope & Domain | Status | Key Artifacts / Targets |
|-----------|----------------|--------|--------------------------|
| **M0: Survey & R1 Debate** | Full stack architectural survey & trade-off debate | **DONE** | `.agents/critic_architecture_r1/handoff.md`<br>`.agents/explorer_backend_r1/handoff.md`<br>`.agents/explorer_frontend_r1/handoff.md` |
| **M1: Backend Phase 1** | Route Infrastructure & Auth/Billing Modularization | **DONE** | `backend/src/job_dashboard/router.py`<br>`backend/src/job_dashboard/routes/auth.py`<br>`backend/src/job_dashboard/routes/billing.py`<br>`backend/src/job_dashboard/web.py`<br>*(339/339 Pytest passing, 100%)* |
| **M5: Frontend Phase 5** | Service Domain Splitting & Facades | **DONE** | `frontend/src/services/prompts/`<br>`frontend/src/services/parsers/`<br>`frontend/src/services/profiles/`<br>`frontend/src/services/generationService.js`<br>`frontend/src/services/profileService.js`<br>*(436/436 Vitest passing, 0 lint errors, build clean)* |
| **M2: Backend Phase 2** | Jobs, AI, Scrapers Domain Routes & Lean `web.py` | **DONE** | `routes/jobs.py`, `routes/ai.py`, `routes/scrape.py`, lean `web.py`<br>*(339/339 Pytest passing, 100%)* |
| **M3: Frontend Phase 3** | Dashboard Decoupling & Custom Hooks | **DONE** | `useDashboardState.js`, `useScrapeOrchestrator.js`, `DashboardModals.jsx`, `Dashboard.jsx`<br>*(436/436 Vitest passing, 0 lint errors)* |
| **M4: Frontend Phase 4** | Modal Sub-Component Decomposition | **DONE** | `frontend/src/components/job-modal/` (5 tabs), `frontend/src/components/onboarding/` (6 steps)<br>*(436/436 Vitest passing, 0 lint errors)* |
| **M6: Verification & Packaging** | Full Test Gauntlet & Cloud Run Container Packaging | **DONE** | 339 Pytest + 436 Vitest + production build clean |

---

## 3. Verification & Acceptance Criteria
- **Backend Pytest**: `cd /home/s/.openclaw/workspace/job-dashboard/backend && python3 -m pytest tests/ -v` (Target: 339/339 passing, 100%).
- **Frontend Vitest**: `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm test -- --run` (Verified: 436/436 passing, 100%).
- **Containerization**: `deploy-cloudrun.sh` local package verification.
- **Victory Audit**: Mandatory independent verification prior to completion declaration.

---

## 4. Continuity & Resume Instructions for Incoming Agents
1. **Context Assessment**: Read `/home/s/.openclaw/workspace/job-dashboard/PROJECT.md` for interface contracts and file ownership.
2. **Current Branch / Working Dir**: `/home/s/.openclaw/workspace/job-dashboard` on `master`.
3. **Active Work Items**:
   - Check status of M1 (`backend/src/job_dashboard/router.py`, `routes/auth.py`, `routes/billing.py`). Run `cd backend && python3 -m pytest tests/ -v`.
   - M5 is verified and complete.
4. **Resuming Implementation**:
   - As soon as M1 completes: Dispatch M2 (Backend Phase 2) and M3/M4 (Frontend Phases 3 & 4).
   - If testing fails: Apply systematic debugging, isolate regressions, and repair facades/contracts.
