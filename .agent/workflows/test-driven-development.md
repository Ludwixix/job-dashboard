---
name: test-driven-development
description: Use when adding or changing any function or module in job-dashboard-site or job-dashboard-modular — especially scoring (scoring_engine.py), classification (stream_classifier.py, reclassify_jobs.py), dedup (deduplicate_jobs.py), or anything under modular src/job_dashboard/. Write the failing test first, watch it fail for the expected reason, then implement.
---

# Test-Driven Development Workflow

## Trigger Conditions
- Adding a new function, module, API endpoint, or CLI command.
- Fixing a bug (the failing test serves as the executable reproduction).
- Updating scoring, classification, or filtering logic (`scoring_engine.py`, `stream_classifier.py`, `reclassify_jobs.py`, `deduplicate_jobs.py`).
- Adding or modifying features in `job-dashboard-modular/src/job_dashboard/`.
- Whenever explicit testing is requested.

## Ordered Steps
1. **Pin the contract first**: Define precise input and output shapes using existing fixtures:
   - `job-dashboard-site`: `sample_job` in `tests/conftest.py` (`id`, `title`, `company`, `location`, `url`, `source`, `score`, `fit`, `work_type`, `posted`, `matched_terms`, `gaps`, `why`).
   - `job-dashboard-modular`: Pydantic models from `src/job_dashboard/models.py` (`Job`, `ApplicationRecord`).
2. **Write the failing test first**:
   - `job-dashboard-site`: Add test case under `tests/test_*.py`.
   - `job-dashboard-modular`: Add test case under `tests/test_*.py` (runs with `pythonpath = ["src"]` configured in `pyproject.toml`).
3. **Execute test to verify failure**:
   - site: `python3 -m pytest tests/ -v`
   - modular: `python3 -m pytest`
   Confirm the test fails specifically for the expected reason (e.g. missing function, assertion failure) rather than a syntax or import error.
4. **Implement minimal code**: Write only the code necessary to satisfy the failing test.
5. **Re-run the full test suite**: Verify no regressions occurred across the entire test suite.
6. **Refactor cleanly and verify linting**:
   - site: `ruff check . --exclude _archive/`
   - modular: `ruff check .`
7. **Preserve test integrity**: Never modify an existing test assertion just to pass code changes unless the specification itself changed (which must be documented in the commit message).

## Worked Example (Real Project Files & Commands)
**Task**: Ensure a "Senior Azure Cloud Engineer" job is classified into an IT category and never as `non-it`.
**Steps**:
1. *Contract definition*: `reclassify_jobs.classify_job(job: dict) -> str` returns a category ID (or `"non-it"` for non-IT jobs).
2. *Write test*: Add to `job-dashboard-site/tests/test_reclassify.py`:
   ```python
   from reclassify_jobs import classify_job

   def test_azure_cloud_engineer_not_non_it():
       job = {
           "title": "Senior Azure Cloud Engineer",
           "company": "Cloudworks Australia",
           "description": "Azure, Microsoft 365, infrastructure as code"
       }
       assert classify_job(job) != "non-it"
   ```
3. *Run test and watch fail*: `cd /home/s/.openclaw/workspace/job-dashboard-site && python3 -m pytest tests/ -v`.
4. *Implement fix*: Adjust classification pattern rules in `reclassify_jobs.py`.
5. *Verify*: Full suite green (21 passed + new test), followed by `ruff check . --exclude _archive/`.
6. *Note*: Re-run `make build` before generating final HTML.

## Stop / Escalate Conditions
- Test fixtures require real scraped data not present in fixtures: ask user which snapshot (`scrapers/jobs_combined.json`) is authoritative.
- Test requires network access or external APIs (e.g. live Jobspy, Playwright, or external DB): mock at the network boundary; if mocking compromises validation value, escalate.
- Pre-existing unrelated test failures present in the suite: document and report them clearly without modifying unrelated tests.
- Rebuilding dashboard outputs (`index.html`, `index_categorized.html`) or deploying to Netlify: requires separate user approval.
