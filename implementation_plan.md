# Full-Stack De-Monolithification Plan: Route, Component & Service Modularization

This plan outlines the complete architectural overhaul of both the backend and frontend codebases. We will utilize the **Strangler Fig Pattern** across the stack, surgically decomposing massive files into dedicated, domain-driven modules without breaking the current live application.

## User Review Required

> [!WARNING]
> **Custom Backend Router Implementation**
> The current backend uses the Python standard library's `http.server.BaseHTTPRequestHandler` with a 6,700-line `if/elif` block. We will build a lightweight, regex-based custom routing mechanism to map endpoints to new modular controllers without injecting heavy third-party frameworks.
> 
> **React Prop Drilling & State Context**
> As we break apart massive components like `Dashboard.jsx` (2,600 lines) and `JobModal.jsx` (2,400 lines), we will extract custom hooks to manage state and potentially use React Context for deep prop passing, minimizing component re-renders.

## Phased Execution Strategy

We will execute this roadmap in **5 distinct phases**. At the end of *each* phase, we will run the full test suite (436 Vitest + 339 Pytest), commit changes, and deploy to Cloud Run to guarantee zero regression and limit the blast radius.

---

### Phase 1: Backend Route Infrastructure & Auth/Billing Modularization

We will establish the custom backend router and extract the highest-risk backend domains first.

1. **[NEW] `backend/src/job_dashboard/router.py`**:
   - Create a lightweight `Router` class capable of registering `GET`, `POST`, `PUT`, `DELETE` handlers with regex path variables.
2. **[NEW] `backend/src/job_dashboard/routes/auth.py`**:
   - Extract `/api/session`, `/api/login`, `/api/google-oauth`, and `/api/profile` logic.
3. **[NEW] `backend/src/job_dashboard/routes/billing.py`**:
   - Extract `/api/stripe/create-checkout-session`, `/api/stripe/webhook`, and `/api/billing/portal`.
4. **[MODIFY] `backend/src/job_dashboard/web.py`**:
   - Integrate the `Router` into `DashboardApp.do_GET` and `do_POST`.
   - Remove all extracted `if/elif` blocks, falling back to the monolith for unregistered routes.

**Deployment Gate**: Full test suite + Cloud Run deployment. Verify auth and billing live.

---

### Phase 2: Backend Core Entities (Jobs, AI, Scrapers)

Finish the backend modularization, completely dissolving the `web.py` God Object.

1. **[NEW] `backend/src/job_dashboard/routes/jobs.py`**:
   - Extract `/api/jobs`, `/api/job-description`, `/api/custom-job`, `/api/applications`.
2. **[NEW] `backend/src/job_dashboard/routes/ai.py`**:
   - Extract generative endpoints (`/api/generate-docs`, `/api/generate-interview`, etc.).
3. **[NEW] `backend/src/job_dashboard/routes/scrape.py`**:
   - Extract `/api/refresh`, `/api/scrape/status`.
4. **[MODIFY] `backend/src/job_dashboard/web.py`**:
   - Remove remaining API endpoints.
   - `web.py` is now strictly an HTTP server entrypoint for middleware, router dispatch, and static asset serving.

**Deployment Gate**: Full test suite + Cloud Run deployment.

---

### Phase 3: Frontend Dashboard Decoupling

Tackle the massive `Dashboard.jsx` (2,600 lines) by extracting logic and layout.

1. **[NEW] `frontend/src/hooks/useDashboardState.js`**:
   - Extract state management, initial data fetching, and profile syncing logic.
2. **[NEW] `frontend/src/hooks/useScrapeOrchestrator.js`**:
   - Extract the background polling, telemetry, and scrape triggering logic.
3. **[NEW] `frontend/src/components/dashboard/DashboardModals.jsx`**:
   - Move the 30+ modal definitions (lazy wrappers and `<Suspense>`) into a dedicated container component.
4. **[MODIFY] `frontend/src/components/Dashboard.jsx`**:
   - Refactor to act primarily as a layout shell orchestrating custom hooks, subheaders, and tabs.

**Deployment Gate**: Full Vitest run + Cloud Run deployment.

---

### Phase 4: Frontend Modal Sub-Component Decomposition

Target the massive `JobModal.jsx` (2,490 lines) and `OnboardingFlow.jsx` (2,335 lines).

1. **[NEW] `JobOverviewTab.jsx`, `JobDocsTab.jsx`, `JobInterviewPrepTab.jsx`, `JobCompanyIntelTab.jsx`**:
   - Extract the massive inner rendering logic of `JobModal.jsx` into focused sub-components.
2. **[NEW] `StepIndustry.jsx`, `StepResumeUpload.jsx`, `StepPreferences.jsx`**:
   - Extract the individual steps of the `OnboardingFlow.jsx` wizard.
3. **[MODIFY] `JobModal.jsx` & `OnboardingFlow.jsx`**:
   - Refactor into lightweight tab/step switchers that mount the extracted sub-components.

**Deployment Gate**: Full Vitest run + Cloud Run deployment.

---

### Phase 5: Frontend Service Domain Splitting

Decouple logic inside `generationService.js` (1,630 lines) and `profileService.js` (1,257 lines).

1. **[NEW] `frontend/src/services/prompts/`**:
   - Extract raw string prompt templates (e.g. `coverLetterPrompt.js`, `kscPrompt.js`) out of `generationService.js`.
2. **[NEW] `frontend/src/services/parsers/`**:
   - Extract the massive industry skill lexicons and keyword matching dictionaries from `profileService.js` into dedicated parser configurations.
3. **[MODIFY] `generationService.js` & `profileService.js`**:
   - Import the extracted constants/prompts, focusing solely on the orchestrator logic.

**Final Deployment Gate**: Full test suite + Cloud Run deployment.

---

## Verification Plan

### Automated Tests
- Backend tests: `cd backend && python3 -m pytest tests/ -v` (339 tests must pass).
- Frontend tests: `cd frontend && npm test -- --run` (436 tests must pass).
- Linters: `npm run lint`.

### Live Smoke Tests & Rollback
- Execute `bash backend/deploy-cloudrun.sh acaa-agent` after each phase.
- Perform live functional verification against the deployed revision.
- If an issue is detected, execute instant rollback using: `gcloud run services update-traffic job-dashboard --to-revisions=PREVIOUS_REVISION=100`.
