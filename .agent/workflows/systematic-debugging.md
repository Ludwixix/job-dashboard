---
name: systematic-debugging
description: Use whenever something fails or behaves unexpectedly in this workspace — a pytest failure or collection error, a traceback from any job-dashboard script (make build, make scrape, server.py, scrape_daily.py), a wrong score/classification in the generated dashboard, or before proposing any fix at all. Debug first, fix second; never patch symptoms.
---

# Systematic Debugging Workflow

## Trigger Conditions
- Any test failure or collection error (`python3 -m pytest` in either project).
- Any traceback or non-zero exit from `make build`, `make scrape`, `make dedup`, `make reclassify`, `server.py`, `build_categorized_dashboard.py`, `deduplicate_jobs.py`.
- Dashboard output discrepancies (incorrect scores, category misclassifications, or broken stream groupings) in `index.html` / `index_categorized.html`.
- Before proposing any fix when the failure has not yet been reproduced.
- Inconsistent behavior across different scripts or execution environments.

## Ordered Steps
1. **Reproduce reliably**: Run the exact failing command and capture complete output:
   - site: `cd /home/s/.openclaw/workspace/job-dashboard-site && python3 -m pytest tests/ -v` (or `make build`)
   - modular: `cd /home/s/.openclaw/workspace/job-dashboard-modular && python3 -m pytest`
   Ensure reliable reproduction before attempting any code change.
2. **Read the error bottom-up**: Anchor on the first stack frame inside workspace code (`job-dashboard-site/*.py` or `job-dashboard-modular/src/job_dashboard/*.py`). Third-party library frames below it are context.
3. **Formulate a specific hypothesis**: State the hypothesis explicitly with file, line number, and mechanism (e.g. "`applications.py` no longer exports `ApplicationIndex`").
4. **Gather evidence cheaply**: Use `grep -rn <symbol> <project>`, execute functions in python interactive mode or isolated scripts, inspect actual data structures in `scrapers/jobs_combined.json`.
5. **Predict, then check**: State the expected outcome of a verification check prior to executing it. If the prediction fails, discard the hypothesis and formulate a new one.
6. **Fix the root cause at the source**: Implement the minimal correct change at the point of failure. Never widen `try/except` blocks, never delete assertions, and never weaken test suites to hide failures.
7. **Prove the fix**: Re-run the reproduction command, then run the full test suite and linter:
   - site: `ruff check . --exclude _archive/` + `python3 -m pytest tests/ -v`
   - modular: `ruff check .` + `python3 -m pytest`
8. **Check for sibling occurrences**: Grep for identical patterns across other scripts, including Makefile inline commands.

## Worked Example (Real Workspace Error)
**Scenario**: `cd /home/s/.openclaw/workspace/job-dashboard-modular && python3 -m pytest` fails during collection:
```
ERROR tests/test_core.py - ImportError: cannot import name 'ApplicationIndex'
  from 'job_dashboard.applications' (.../src/job_dashboard/applications.py).
  Did you mean: 'ApplicationRecord'?
```
**Application of Steps**:
1. *Reproduction*: Run `cd /home/s/.openclaw/workspace/job-dashboard-modular && python3 -m pytest` — reproduced immediately with 1 error during collection.
2. *Anchor*: Traceback points to `tests/test_core.py:4` importing `ApplicationIndex, split_documents`.
3. *Hypothesis*: `ApplicationIndex` was refactored into `ApplicationRecord` in `src/job_dashboard/applications.py`, leaving `test_core.py` with a stale import.
4. *Evidence*: `grep -n "^class " src/job_dashboard/applications.py` shows `class ApplicationRecord:`, while `grep -rn "ApplicationIndex" src/ tests/` reveals `ApplicationIndex` is only present in `tests/test_core.py`.
5. *Prediction*: Replacing `ApplicationIndex` with the current API in `test_core.py` will allow test collection to proceed without modifying `src/`.
6. *Fix & Prove*: Update `tests/test_core.py` or restore API if required, then verify `python3 -m pytest` collects all 56 tests cleanly.

## Stop / Escalate Conditions
- Three consecutive falsified hypotheses: stop, document all ruled-out possibilities with evidence, and escalate to the user.
- Failure originates inside an external package (`jobspy`, `playwright`, `pydantic`): consult documentation via `fetch` MCP server; do not patch site-packages.
- Fix requires running live job scrapers against external services or modifying raw scraped datasets (`jobs_*.json`): create a timestamped backup first and obtain user approval.
- Inability to reproduce the issue: document environment details and request reproduction steps from the user.
