---
name: adversarial-review
description: Use before completing or committing any change — especially to scoring/classification/dashboard generation, the Makefile, or code that consumes scraped job records — and before any deploy (make deploy hits Netlify production). Attack your own change: lying type annotations, stale call sites, missing keys, and silent data loss.
---

# Adversarial Review Workflow

## Trigger Conditions
- Before marking any task complete on files touching `scoring_engine.py`, `stream_classifier.py`, `reclassify_jobs.py`, `deduplicate_jobs.py`, `build_categorized_dashboard.py`, the `Makefile`, or `job-dashboard-modular/src/job_dashboard/`.
- Before making any git commit (`/home/s/.openclaw/workspace` or submodules).
- ALWAYS before running `make deploy` or `make deploy-draft` (which deploys to Netlify production).
- Whenever a bug fix or feature works on the first try.
- When an explicit code review is requested.

## Ordered Steps
1. **Re-read the diff cold**: Enumerate every implicit assumption made: file existence, JSON keys present, function return types matching annotations, non-empty collections.
2. **Verify every signature against all call sites**: Search for all callers using `grep -rn <symbol>`, including Makefile recipes and scraper entry points (`scrapers/scrape_all.py`).
3. **Audit type annotations against runtime behavior**: Check whether declared return types accurately reflect what functions return (see worked example below).
4. **Stress test data contracts**: Real job payloads from scrapers have missing fields, `None` values for locations, unicode company titles, duplicate IDs, and empty lists. Ensure defensive handling.
5. **Execute test and lint gauntlet**:
   - site: `cd /home/s/.openclaw/workspace/job-dashboard-site && ruff check . --exclude _archive/ && python3 -m pytest tests/ -v`
   - modular: `cd /home/s/.openclaw/workspace/job-dashboard-modular && ruff check . && python3 -m pytest`
6. **Security and secrets audit**:
   - Verify no secret values appear in diffs, commit messages, or generated artifacts.
   - Ensure no code references `KEYS.md`, `OpenRouterAPI.txt`, or `.env`.
   - Never stage secrets (`git status` review before every commit; never `git add -A`).
7. **Document findings**: Format as `severity` · `file:line` · `concrete fix`. Implement fixes and re-run step 5.

## Worked Example (Real Workspace Finding)
**Observation**: `job-dashboard-site/reclassify_jobs.py:250` declares:
```python
def reclassify(data: dict) -> dict:
```
However, at line 271 it returns:
```python
return data, stats
```
This returns a 2-tuple `tuple[dict, dict]`. The code executes without error only because call sites unpack two variables (`main()` at line 285 does `data, stats = reclassify(data)`, and Makefile does `d,s=reclassify(d)`). The type annotation is misleading to static analyzers and human readers.
**Remediation**:
- Correct type annotation to `-> tuple[dict, dict]`.
- Add test in `tests/test_reclassify.py` asserting `isinstance(reclassify(...), tuple)`.
- Re-run full test suite and linter.

## Stop / Escalate Conditions
- A review finding requires an architectural redesign rather than a localized bugfix: present findings to the user before refactoring.
- Deployment reviews: `make deploy` modifies Netlify production environment; requires explicit user authorization every time.
- Discovery of exposed or tracked secrets: stop immediately, do not display secret content in output, and alert user (e.g. `workspace/OpenRouterAPI.txt`).
- Blast radius exceeds task bounds: halt and confirm scope.
