# Task Specification: [Feature Name / Task Title]

## 1. Overview & Problem Statement
- **Goal**: [Clear 1-2 sentence description of what should be achieved]
- **Target Audience / Component**: [e.g. Backend API, Frontend Kanban, Scraper Pipeline, Cloud Run infra]
- **Relevant Issues / PRs**: [Optional link or identifier]

## 2. In-Scope & Out-of-Scope
### In-Scope
- [Specific deliverable 1]
- [Specific deliverable 2]

### Out-of-Scope
- [Explicit boundary on what NOT to change or refactor]

## 3. Technical Requirements & Contract
- **Endpoints / Schema Changes**:
  - `GET /api/...` or `POST /api/...`
  - Request / Response JSON contracts
- **Data Models**:
  - Fields added, modified, or validated in SQLite / Pydantic
- **Frontend State & UI**:
  - Components affected and user interaction expectations

## 4. Verification Plan
- **Automated Tests**:
  - Backend command: `cd backend && python3 -m pytest tests/test_new_feature.py -v`
  - Frontend command: `cd frontend && npm test -- --run`
- **Manual / Smoke Test**:
  - e.g. `./scripts/smoke-test.sh` or browser verification steps

## 5. Constraints & Invariants
- Zero Secret Exposure (no commits of `.env` or credential tokens)
- Backwards compatibility with existing database rows
- Fast mode / isolated changes (do not touch unrelated files)
