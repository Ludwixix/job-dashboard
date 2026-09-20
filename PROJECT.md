# Project: Job Dashboard Full-Stack De-Monolithification

## Architecture
- **Backend Architecture**: Strangler Fig Pattern using an enhanced `Router` over Python's standard library `http.server.BaseHTTPRequestHandler` within `ThreadingHTTPServer`. Extracted domain routes reside in `backend/src/job_dashboard/routes/` (`auth.py`, `billing.py`, `jobs.py`, `ai.py`, `scrape.py`). `web.py` serves as a lean HTTP entrypoint for CORS, static assets, middleware, and legacy fallback during migration.
- **Frontend Architecture**: Component and Hook Decoupling. Massive components (`Dashboard.jsx`, `JobModal.jsx`, `OnboardingFlow.jsx`) are decomposed into focused hooks (`useDashboardState`, `useScrapeOrchestrator`), modal containers, and tab sub-components. Massive services (`generationService.js`, `profileService.js`) are partitioned into domain directories (`prompts/`, `parsers/`, `profiles/`) while retaining public facade re-exports to preserve 100% backward compatibility for all consumers and test mocks.

## Feature Inventory
| # | Feature / Extraction Area | Description | Milestone | Source |
|---|---------------------------|-------------|-----------|--------|
| 1 | R1: Architecture Debate | Strangler Fig BaseHTTPRequestHandler vs FastAPI evaluation | M0 | ORIGINAL_REQUEST.md |
| 2 | Backend Router & Helpers | Enhanced Router with query stripping, static priority, JSON helpers | M1 | implementation_plan.md |
| 3 | Auth Domain Routes | Extract `/api/session`, `/api/login`, `/api/register`, `/api/profile`, etc. | M1 | implementation_plan.md |
| 4 | Billing Domain Routes | Extract `/api/billing/*`, `/api/stripe/*`, `/api/ai/proxy` | M1 | implementation_plan.md |
| 5 | Jobs Domain Routes | Extract `/api/jobs`, `/api/job-description`, `/api/applications`, CRM, matches | M2 | implementation_plan.md |
| 6 | AI Domain Routes | Extract `/api/generate-docs`, `/api/ai/interview/*`, ATS diagnostic, KSC | M2 | implementation_plan.md |
| 7 | Scrape & System Routes | Extract `/api/refresh`, `/api/scrape/*`, SSE stream, `/health`, `/metrics` | M2 | implementation_plan.md |
| 8 | Dashboard Hooks & Modals | Extract `useDashboardState`, `useScrapeOrchestrator`, `DashboardModals.jsx` | M3 | implementation_plan.md |
| 9 | Dashboard Bug Fixes | Fix dangling `<CommandPalette />` syntax and undefined `setJobs` reference | M3 | survey |
| 10 | JobModal Tab Decomposition | Extract 5 true tabs (`fit`, `description`, `notes`, `assets`, `offer`, intel) | M4 | survey |
| 11 | OnboardingFlow 6-Step Wizard | Extract 6 true steps (`StepAuth` through `StepReviewLaunch`) | M4 | survey |
| 12 | Generation Service Prompts | Extract raw prompts into `services/prompts/`, retain facade | M5 | implementation_plan.md |
| 13 | Profile Service Parsers & Config | Extract lexicon and parsers into `services/parsers/`, retain facade | M5 | implementation_plan.md |
| 14 | Profile Service Storage & Templates | Extract storage and templates into `services/profiles/`, retain facade | M5 | survey |
| 15 | Full Verification & Packaging | 339 Pytest + 436 Vitest + Cloud Run containerization packaging verification | M6 | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Survey & Architecture Debate (R1) | Evaluate BaseHTTPRequestHandler vs FastAPI, debate trade-offs | None | DONE |
| 1 | Backend Phase 1: Router & Auth/Billing | `router.py`, `routes/auth.py`, `routes/billing.py`, `web.py` fallback | M0 | PLANNED |
| 2 | Backend Phase 2: Jobs, AI, Scrape | `routes/jobs.py`, `routes/ai.py`, `routes/scrape.py`, lean `web.py` | M1 | PLANNED |
| 3 | Frontend Phase 3: Dashboard Decoupling | `useDashboardState.js`, `useScrapeOrchestrator.js`, `DashboardModals.jsx`, `Dashboard.jsx` | M0 | PLANNED |
| 4 | Frontend Phase 4: Modal Sub-Components | `job-modal/` tabs, `onboarding/` 6 steps, `JobModal.jsx`, `OnboardingFlow.jsx` | M0 | PLANNED |
| 5 | Frontend Phase 5: Service Domain Splitting | `services/prompts/`, `services/parsers/`, `services/profiles/`, facades | M0 | PLANNED |
| 6 | Final Verification & Cloud Run Deployment | Pytest (339) + Vitest (436) + Lint + `deploy-cloudrun.sh` package test | M2, M5 | PLANNED |

## Interface Contracts
### Backend Router & Handlers
- `Router.dispatch(handler, method, path)`: Expects normalized path with query parameters stripped (`urlparse(handler.path).path`). Returns `True` if matched, `False` otherwise.
- `make_handler(app)`: Attaches `Handler.app = app` as a class attribute so handlers instantiated via `Handler.__new__(Handler)` retain `self.app`.
- Route Handlers: `handler_func(request_handler, **kwargs)`. Accesses state via `request_handler.app`, writes response via `request_handler.send_json(status, data)` or `request_handler.send_response()`.

### Frontend Services & Facades
- `profileService.js` and `generationService.js` remain public facades re-exporting all sub-module functions and constants:
  - `saveProfile`, `getActiveProfile`, `fetchProfileFromBackend`, `SECTOR_TEMPLATES`, `calculateProfileCompleteness`
  - `generateClientSideTailoredDocs`, `runDocumentQualityAudit`, `calculateAtsScore`, `extractJobKeywords`
- `OnboardingFlow.jsx`: Retains 6 sequential steps (`StepAuth`, `StepAiConfig`, `StepIndustry`, `StepRolesSkills`, `StepPreferences`, `StepReviewLaunch`) and exports `SENIORITY_OPTIONS` and `INDUSTRY_OPTIONS`.
- `JobModal.jsx`: Retains 5 tabs: `fit`, `description`, `notes`, `assets`, `offer`.

## Code Layout
- Exclusive Backend File Ownership:
  - `backend/src/job_dashboard/router.py`
  - `backend/src/job_dashboard/routes/auth.py`
  - `backend/src/job_dashboard/routes/billing.py`
  - `backend/src/job_dashboard/routes/jobs.py`
  - `backend/src/job_dashboard/routes/ai.py`
  - `backend/src/job_dashboard/routes/scrape.py`
  - `backend/src/job_dashboard/routes/__init__.py`
  - `backend/src/job_dashboard/web.py`
- Exclusive Frontend File Ownership:
  - `frontend/src/hooks/useDashboardState.js`
  - `frontend/src/hooks/useScrapeOrchestrator.js`
  - `frontend/src/components/dashboard/DashboardModals.jsx`
  - `frontend/src/components/Dashboard.jsx`
  - `frontend/src/components/job-modal/*`
  - `frontend/src/components/JobModal.jsx`
  - `frontend/src/components/onboarding/*`
  - `frontend/src/components/OnboardingFlow.jsx`
  - `frontend/src/services/prompts/*`
  - `frontend/src/services/parsers/*`
  - `frontend/src/services/profiles/*`
  - `frontend/src/services/generationService.js`
  - `frontend/src/services/profileService.js`
