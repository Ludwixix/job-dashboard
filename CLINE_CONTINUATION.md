# Cline Continuation Prompt — Profile & Onboarding Quality Overhaul

> **Purpose**: Copy the entire contents of this file and paste it as your first message to Cline (or any AI coding assistant) to resume this task if Antigravity credits run out.

---

## Project Context

You are working on the **ACAA Job Dashboard** — a full-stack job tracking and AI-powered application management system. The repository lives at:

```
/home/s/.openclaw/workspace/job-dashboard
```

- **Backend**: Python, `http.server.BaseHTTPRequestHandler`, SQLite WAL, modular routes in `backend/src/job_dashboard/routes/`
- **Frontend**: React 19 + Vite, Tailwind CSS, modular services/hooks/components
- **Tests**: `cd backend && python3 -m pytest tests/ -v` (339 tests), `cd frontend && npm test -- --run` (436 tests)
- **Deploy**: `cd backend && bash deploy-cloudrun.sh acaa-agent`

**IMPORTANT CONSTRAINTS:**
- Never `git add -A`. Stage only the files you intentionally change.
- Never hardcode API keys or secrets. Check `.env.example` for env var names.
- Run the full test suite before every commit. 100% pass rate required.
- Conventional Commits: `fix(profile): ...`, `feat(onboarding): ...` etc.

---

## Current Task: Profile & Onboarding Quality Overhaul

### The Problem

When a **Registered Nurse** creates a new account and uploads their resume, the system:
1. **Fails to extract useful data** from the resume (returns empty or IT-contaminated profile)
2. **Populates IT-related search queries** (e.g. "software engineer", "developer") instead of healthcare queries (e.g. "registered nurse", "nursing", "RN")
3. **Scores and ranks IT jobs higher** than healthcare jobs on the nurse's dashboard

A partial fix was applied in commit `a8a6161` but it is NOT fully resolved end-to-end.

---

## What Needs To Be Fixed

### R1 — Resume Parsing Accuracy

**Files:**
- `frontend/src/services/parsers/resumeParser.js` — main parser
- `frontend/src/services/parsers/multiIndustryParserConfig.js` — industry keyword lexicons
- `frontend/src/services/parsers/atsAuditParser.js` — ATS scoring

**Problem:** The parser may default to IT scoring when no strong IT signal exists, rather than detecting the actual dominant industry from the resume text.

**Required outcome:** A Registered Nurse resume → parsed profile with `industry: "Healthcare"`, nursing titles, nursing skills, zero IT titles.

**Test:** `frontend/src/services/__tests__/multiIndustryResumeParsing.test.js` — ensure healthcare/nursing assertions pass.

---

### R2 — Profile-Driven Search Query Generation

**Files:**
- `frontend/src/services/profiles/profileStorage.js` — `saveProfile()` / profile sync to backend
- `frontend/src/components/onboarding/StepReviewLaunch.jsx` — final onboarding step that should push search criteria
- `backend/src/job_dashboard/routes/auth.py` — `handle_save_profile()` at line ~838
- `backend/src/job_dashboard/routes/scrape.py` — search criteria persistence

**Problem:** After saving a nurse profile, the search queries sent to `/api/search-criteria` may still use IT defaults instead of generating industry-appropriate queries from the profile's `industry`, `targetRoles`, and `coreSkills` fields.

**Required outcome:** Saving a nurse profile pushes queries like `["registered nurse", "RN", "nursing"]` — not `["software engineer"]`.

**Verification:** Check the `searchCriteria` field returned by `GET /api/search-criteria` after saving a nurse profile.

---

### R3 — Profile-Driven Job Scoring

**Files:**
- `backend/src/job_dashboard/score.py` — `score_job(job, profile)` function
- `backend/src/job_dashboard/routes/jobs.py` — `handle_score_matches()` and `handle_job_explanation()`

**Problem:** The scoring engine may use hardcoded IT skill weights or fail to adapt to a non-IT profile's `coreSkills`, resulting in healthcare jobs scoring low for a nurse.

**Required outcome:** `GET /api/job-explanation?jobId=<id>` for a nursing job returns a high score and healthcare skill matches for a nurse profile.

---

### R4 — Onboarding Data Integrity

**Files:**
- `frontend/src/components/OnboardingFlow.jsx` — state management between steps
- `frontend/src/components/onboarding/StepRolesSkills.jsx` — skills/roles step
- `frontend/src/components/onboarding/StepPreferences.jsx` — location/work prefs
- `frontend/src/components/onboarding/StepReviewLaunch.jsx` — final save

**Problem:** Profile data collected during onboarding steps may be silently lost when navigating between steps (forward/back), or not persisted to the backend at the end.

**Required outcome:** After completing onboarding, `GET /api/profile` returns a complete profile object with `industry`, `seniority`, `targetRoles`, `coreSkills`, and `locationPreference` all set correctly.

---

## Acceptance Criteria (All Must Pass)

- [ ] A Registered Nurse resume → `industry: "Healthcare"`, nursing titles, zero IT titles in parsed output
- [ ] A Software Engineer resume → `industry: "Technology"`, tech titles, zero healthcare titles
- [ ] `GET /api/search-criteria` after nurse onboarding → queries contain `"nurse"` or `"RN"`, not `"developer"`
- [ ] `GET /api/search-criteria` after developer onboarding → queries contain tech terms
- [ ] `GET /api/profile` after completing onboarding → all fields populated (industry, skills, roles, preferences)
- [ ] `cd backend && python3 -m pytest tests/ -v` → **339 tests pass**
- [ ] `cd frontend && npm test -- --run` → **436 tests pass**
- [ ] `cd frontend && npm run lint` → **0 errors**

---

## How To Run Tests

```bash
# Backend tests
cd /home/s/.openclaw/workspace/job-dashboard/backend
python3 -m pytest tests/ -v

# Frontend tests (note: 2 tests are flaky under load — run 3x if they timeout)
cd /home/s/.openclaw/workspace/job-dashboard/frontend
npm test -- --run

# Lint
cd /home/s/.openclaw/workspace/job-dashboard/frontend
npm run lint
```

---

## Key Reference Files

| File | Purpose |
|---|---|
| `MIGRATION_STATE.md` | Architecture decisions and completed milestones |
| `PROJECT.md` | Interface contracts and code ownership |
| `backend/src/job_dashboard/routes/auth.py` | Profile save/load endpoints |
| `backend/src/job_dashboard/score.py` | Job scoring engine |
| `frontend/src/services/parsers/resumeParser.js` | Resume parsing logic |
| `frontend/src/services/parsers/multiIndustryParserConfig.js` | Industry keyword lexicons |
| `frontend/src/services/profiles/profileStorage.js` | Profile save/sync to backend |
| `frontend/src/components/OnboardingFlow.jsx` | Onboarding orchestrator |
| `backend/tests/test_profile_persistence.py` | Backend profile persistence tests |
| `frontend/src/services/__tests__/multiIndustryResumeParsing.test.js` | Multi-industry resume parsing tests |

---

## Commit When Done

```bash
cd /home/s/.openclaw/workspace/job-dashboard
# Stage only the files you changed (never git add -A)
git add <specific files>
git commit -m "fix(profile): <description of what was fixed>"
git push origin master
```
