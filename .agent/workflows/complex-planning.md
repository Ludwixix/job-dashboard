---
name: complex-planning
description: Use before starting any task that might touch multiple interdependent files — anything in job-dashboard-site or job-dashboard-modular that changes shared helpers (stream_classifier, reclassify, scoring), data-file schemas, the Makefile, or modular src/job_dashboard internals. Run the 5-condition checklist first; if 2+ apply, call sequential-thinking BEFORE any file edit.
---

# Complex Planning Workflow

## Trigger Conditions
- Any task touching shared modules, scoring algorithms, classification pipelines, or data schemas.
- Tasks spanning multiple files or repositories in the workspace (`job-dashboard-site`, `job-dashboard-modular`).
- Refactor requests or architectural modifications.

## Mandatory Gate — Run Before ANY File Edit

Before starting any task, check if 2+ of these apply:
- Task touches 3+ files with import/dependency relationships
- Task involves changing a function signature used elsewhere in the codebase
- Task is a refactor or architectural change, not a net-new isolated feature
- You cannot describe the full scope of the change in one sentence
- The task was initially reported as "simple" but touches shared/core modules

If 2+ apply: call the `sequential-thinking` MCP tool BEFORE any file edit, stating which conditions triggered it. Do not skip this for tasks that seem simple at first glance.

## Ordered Steps (After the Gate Fires)
1. **Call `sequential-thinking` as your FIRST action**: State explicitly which checklist conditions triggered the gate. If the MCP tool is unavailable, output equivalent structured reasoning in chat before proceeding.
2. **Map the blast radius with evidence**: Use grep and symbol lookups (`grep -rn <symbol> <project>`) for every function/type to be touched. Include non-obvious callers:
   - `job-dashboard-site/scrapers/scrape_all.py` imports `stream_classifier.classify_all_jobs`.
   - `job-dashboard-site/Makefile` embeds inline python (e.g., `make build` calls `reclassify_jobs.reclassify`).
3. **Order the work test-first**: Reference `.agent/workflows/test-driven-development.md`: failing test → minimal implementation → full suite → lint.
4. **Execute incrementally**: Keep each edit coherent. After each step, verify against `pytest` and `ruff`.
5. **Re-evaluate when reality diverges**: If new dependencies or unexpected data schemas appear, re-enter `sequential-thinking` with a revision thought instead of improvising.
6. **Track state in git**: Inspect `git status` and `git diff` at each step to ensure easy rollback if needed.

## Worked Example (Real Files & Dependency Edges)
**Task**: "Add a posted-age freshness signal to the job score."
**Why the gate fires (2+ conditions apply)**:
- *Touches 3+ files with dependency relationships*: `job-dashboard-site/scoring_engine.py` (`score_job` at line 221 + `calculate_*` helpers), test suite (`tests/test_scoring.py` and `sample_job` fixture in `tests/conftest.py` containing `"posted": "2026-08-20"`), and `build_categorized_dashboard.py` (which renders scores to HTML).
- *Changes a function signature*: Adding a `today`/`now` reference parameter to `score_job` for testability changes its call contract.
- *Touches shared/core modules*: Score generation impacts both site dashboard tables and categorized views.

**Execution flow**:
1. Call `sequential-thinking` MCP tool stating conditions 1, 2, and 5 triggered.
2. Formulate plan: Pin fixture shape in `tests/conftest.py` -> update contract in `tests/test_scoring.py` -> modify `scoring_engine.py` -> verify full pytest suite (21 passed) -> run ruff -> rebuild dashboard.

## Stop / Escalate Conditions
- The blast-radius grep reveals callers outside this workspace (e.g. other agent workspaces): stop and confirm authoritative source with user.
- The plan requires data schema changes (`*.sql` migrations, SQLite schemas under `job-dashboard-modular/src/data/`, or jobtracker formats): the backend is strictly local SQLite/JSON; schema changes require explicit user approval.
- Any step involves deploying (`make deploy`) or hitting live job scrapers with external requests: request explicit user approval.
- If in doubt whether a task meets the gate criteria (e.g. 1 borderline condition): trigger the gate anyway.
