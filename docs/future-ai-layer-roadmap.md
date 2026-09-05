# Task Specification: Future AI Layer Roadmap (research/proposal only — do not schedule until consolidation lands)

## 1. Overview & Problem Statement
- **Goal**: Produce a research-backed roadmap document evaluating whether to migrate the backend's scraping and job-matching logic toward LLM-native extraction and embedding-based semantic matching. This is a **proposal-only** task — no code, no dependencies, no branches.
- **Target Audience / Component**: `backend/src/job_dashboard/sources/` (scraping) and `backend/src/job_dashboard/score.py` (matching), as documentation subjects only — not as edit targets.
- **Prerequisite**: Do not start this task until the consolidation work (`consolidation-task-v2.md`, Phases 1–4) has merged to master and passed its full test suite. This roadmap is explicitly lower priority than removing existing bloat.

## 2. In-Scope & Out-of-Scope

### In-Scope
- Research and summarize how the current scraper adapters (`sources/indeed.py`, `sources/seek.py`, etc.) work today, as a baseline.
- Research **Crawl4AI** (github.com/unclecode/crawl4ai, Apache 2.0, actively maintained as of early 2026) as a candidate replacement or supplement for scraping — evaluate license, maintenance activity, hosting requirements, and migration cost against the current Playwright-based approach.
- Research embedding-based resume/JD matching as an alternative to the current heuristic `score.py` scoring engine. **Caveat**: "Resume2Vec" refers to a January 2025 preprint describing a transformer-embedding + cosine-similarity method — it is a research paper, not a packaged library. Do not treat it as an installable dependency. If this direction is pursued, the roadmap should identify a concrete, maintained embedding model or library (e.g. a sentence-transformers model) that implements the same idea, not the paper's name itself.
- Produce a written comparison: current approach vs. proposed approach, including estimated engineering cost, risk, and a rollback plan.
- Explicitly flag any new external API dependency, rate limit, or cost implication (e.g. hosted embedding APIs, Crawl4AI's cloud offering if used instead of self-hosted).

### Out-of-Scope
- No code changes to `sources/`, `score.py`, database schema, or API contracts.
- No dependency installation, `pip install`, or `package.json` changes.
- No spike branches or proof-of-concept code without separate, explicit sign-off after this document is reviewed.

## 3. Deliverable
A single markdown document at `docs/tasks/ai-layer-roadmap.md` containing:
1. Current-state summary of scraping and scoring.
2. Crawl4AI evaluation (with citation to the actual maintained repo).
3. Embedding-based matching evaluation (with the Resume2Vec caveat above, and a concrete, verifiable library recommendation instead of the paper name).
4. Cost/risk/rollback comparison table.
5. An explicit recommendation: proceed, proceed with modifications, or do not proceed — with reasoning.

## 4. Verification Plan
- No automated tests apply — this is a documentation task.
- Human review required before this roadmap can spawn any follow-on implementation task. Do not self-approve.

## 5. Constraints & Invariants
- Zero Secret Exposure — as in all other tasks.
- Scraper/Scoring Isolation — this task documents, it does not modify.
- This document must not reference unverified package names as if they were installable. If a tool's install/maintenance status can't be confirmed, say so explicitly in the roadmap rather than assuming it exists.