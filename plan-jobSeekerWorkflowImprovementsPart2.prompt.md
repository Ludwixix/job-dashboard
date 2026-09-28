# Site Audit — Improvement Plan Part 2

## Purpose and Scope

This plan captures site-wide issues beyond the account/profile and résumé-generation work in Part 1. The site is a public, multi-user job dashboard; listings and user-specific operations must have clear security boundaries. Job-source acquisition strategy is out of scope: do not add, replace, or expand scraping methods as part of this plan. Source-health display and the safety of operational controls remain in scope.

This audit was performed against the current working-tree snapshot on 2026-09-27. Several core files already have uncommitted changes from the user's/another agent's work. Preserve those changes; reconcile Part 2 after that work stabilizes rather than overwriting or interpreting its diffs as final.

## Audit Evidence

- `npm test -- --run` in `frontend/`: 456 passed, 1 failed. `sourceHealingService.test.js` expects the raw health payload, while the current in-progress service code normalizes it to a new response shape.
- Full backend test collection stops because `tests/test_fts5.py` imports `sanitize_fts5_query`, which is absent from `backend/src/job_dashboard/repository.py` in this snapshot.
- Backend tests excluding `test_fts5.py`: 414 passed, 38 failed, 3 skipped. Most failures are 404 responses from the live `web.py` handler for endpoints defined in the separate route modules (including Career Mode, billing/AI proxy, scrape status, and source health); other failures include reminder dismissal, a pagination expectation, and profile/score contracts.
- `ruff check . --statistics` reports 897 findings, including 8 F821 undefined-name findings. Confirmed examples include `ScoringError` in `batch_scoring.py`, `json` in `seek_pass_auditor.py`, and `dismissed` in the reminder handler in `web.py`.
- Frontend lint completes with a large warning set, especially unused imports/variables and React effect/dependency warnings in substantial components. Establish a reviewed baseline rather than mass-applying fixes.
- Vite production build succeeds when built to a fresh temporary directory. The project `npm run build` script also replaces `backend/src/job_dashboard/static/assets`, so keep build verification isolated or review generated artifacts carefully.
- The normal CI workflow tests the backend and tests/lints/builds the frontend, but does not run backend Ruff. A second auto-heal workflow can run an LLM agent with write permissions and secrets after test failures.

## Priority 0 — Close Security and Supply-Chain Risks

1. **Protect provider session cookies.** The active stdlib handler's `/api/settings/cookies` GET returns the stored provider `headers` and `cookies`; POST writes them into a global provider-cookie table. Neither branch has an authentication or ownership check. Require verified administrative authorization, make the store user-scoped only if cookies are genuinely needed, encrypt any persisted secret material, and never return cookie/header values from status APIs. Prefer removing manual cookie persistence from the public product surface.
2. **Remove or constrain webhook SSRF.** `/api/digest/dispatch` accepts a caller-supplied `webhook_url` and passes it to `urllib.request.urlopen`. Require authentication and accept only a server-configured, validated webhook destination; reject loopback, link-local, private, metadata, and redirect-to-private targets. Add strict egress/network policy and request size/time limits.
3. **Disable unsafe autonomous CI writes.** `.github/workflows/agent-auto-heal.yml` runs for pushes and pull requests, grants `contents: write`/`pull-requests: write`, passes model/GitHub secrets to an autonomous code-writing agent, uses an unpinned `npx --yes` package, then runs `git add .`, commits, and pushes. Remove automatic secret-bearing code repair from untrusted PRs. Use least-privilege read-only tokens, pin all third-party actions/CLI versions, never auto-stage the workspace, and require a human-reviewed patch/PR before any write. If retained, run only in a separately approved trusted environment with no production secrets.
4. **Keep runtime source-code patching disabled in production.** `sources/self_healing.py` writes model-generated Python into a live source file and runs pytest via `subprocess.run(..., shell=True)`. The frontend sends `patch_code`, while the route-module handler reads `patch`; moreover, the route module's patch endpoint is not mounted in the active stdlib handler. Do not simply mount it to fix the 404. Either remove the code-patch feature or redesign it as an administrator-only, reviewable offline workflow with a fixed file allowlist, fixed argument-vector test commands (no shell), isolated temporary worktree/container, approval, diff display, and rollback verification.
5. **Perform an endpoint authorization inventory.** Treat public job reads as intentionally public only where required. Every endpoint that reads/writes provider credentials, user profile/application/document data, triggers outbound requests, changes persistent state, or invokes generation/maintenance must derive identity from a verified token subject and enforce authorization at the route boundary. Do not trust `X-User-Id` or query/body `user_id` as proof of identity. Add explicit authz tests for every sensitive route.

## Priority 1 — Restore a Single, Tested Runtime API

1. **Choose and wire one canonical router.** Production runs `job_dashboard.run_server` and the stdlib handler in `web.py`; domain routes are separately decorated/registered through `routes/__init__.py`, but the active handler does not dispatch that router. This divergence accounts for many of the observed 404 test failures. Mount one authoritative route table in the production handler, or retire the unused route modules; do not maintain parallel handler implementations with conflicting behavior.
2. **Reconcile endpoint paths and payload schemas.** Make the server, frontend service, OpenAPI spec, smoke tests, and backend route tests agree on canonical paths and JSON shapes. Specific examples to settle: `/api/source-health` versus `/api/sources/health`; the health service's normalized payload versus tests expecting the raw shape; the source patch `patch` versus `patch_code` field; backup and billing endpoints that exist in route modules but currently return 404 through the active handler.
3. **Make health reporting truthful.** Compute overall source status from actual per-source outcomes. Never default missing/error health data to `healthy`; represent `unknown`, `degraded`, and `unavailable` distinctly. Include timestamp, last-success time, errors, and counts. Test healthy, degraded, unhealthy, never-run, and route-failure states.
4. **Add route-contract coverage against the deployed handler.** Tests must invoke the same `make_handler`/HTTP dispatch path used by `run_server`, not only call decorated functions directly. Cover success, authentication, authorization, invalid payloads, and unknown-route behavior for all declared frontend API dependencies.
5. **Synchronize OpenAPI and live routes.** Generate the spec from the actual production route registry and fail CI when a documented endpoint is not mounted or a mounted endpoint is undocumented. Ensure generated docs do not advertise inactive alternate-router endpoints.

## Priority 1 — Fix Confirmed Runtime Correctness Defects

1. Fix reminder dismissal so `/api/reminders/dismiss` actually performs the user-scoped repository mutation and returns that result; add a regression test for authenticated success, missing identity, unknown reminder, and cross-user attempts. The current handler references undefined `dismissed`.
2. Repair or remove the dangling FTS5 query-sanitization contract. The missing `sanitize_fts5_query` currently prevents the backend suite from collecting. Decide whether FTS5 search is a supported live path; if yes, implement and test sanitization, index synchronization, and graceful LIKE fallback; if not, remove stale imports/docs/tests without weakening security tests.
3. Resolve undefined names flagged by Ruff before feature work continues: import/define the intended `ScoringError`, import `json` where `seek_pass_auditor.py` serializes structured credentials, and address remaining F821s. Add failure-path tests so exception handlers themselves cannot raise `NameError`.
4. Reconcile page-size behavior: repository pagination clamps `page_size` to 500 while a test expects 2,000. Keep a defensible server cap and update the API contract/test, or deliberately support a larger bounded cap with resource tests; do not silently change either side.
5. Resolve the `sourceHealingService` test mismatch by updating the documented response contract and asserting the normalized shape, including error/missing-status cases. A test must not preserve a stale shape just to pass.

## Priority 2 — Make Persistence and Recovery Coherent

1. Replace per-file live SQLite/WAL/SHM uploads with a coherent snapshot strategy using SQLite's online backup API or a serialized checkpoint-and-snapshot procedure. Store a versioned manifest/checksum for each snapshot; restore only a mutually consistent set. Avoid treating `jobs.sqlite3`, `-wal`, and `-shm` uploaded at different times/generations as one valid backup.
2. Serialize backup/restore work across app threads and Cloud Run instances. Add concurrency controls/leases or a single-writer backup job; verify restore cannot overwrite newer local state unexpectedly. Keep a last-known-good snapshot and report restore/backup age and integrity, not just object existence.
3. Review GCS IAM, encryption, lifecycle/retention, and restore permissions for the full SQLite database, which contains user and provider data. Do not expose bucket names or object metadata beyond authorized operations.
4. Add fault-injection tests for writes during backup, partial upload, generation-precondition conflict, truncated/corrupt database, missing WAL, cold start, and rollback to a previous snapshot. Ensure a failed backup is surfaced as degraded rather than reported successful/no-op without an operator-visible reason.

## Priority 2 — Establish Reliable Quality Gates and CI

1. First merge/reconcile the current in-progress changes, then capture a stable test baseline. Do not mass-fix the 897 Ruff findings blindly; prioritize all undefined names, auth/security-sensitive code, and files changed in the active worktree, then ratchet the repository baseline down in reviewed batches.
2. Add backend Ruff to `.github/workflows/deploy.yml` and make CI enforce backend tests, backend lint, frontend lint, frontend tests, and a non-destructive production build. Fix the current failing suite rather than suppressing route, auth, persistence, or data-contract tests.
3. Remove or rewrite `.github/workflows/agent-auto-heal.yml` as specified in Priority 0. CI must never let an LLM auto-commit/push unreviewed code or gain secrets from an untrusted PR.
4. Expand smoke tests beyond basic process health/metrics to verify the live public job feed, route registry, source-health contract, auth-required behavior, and expected 404/401 semantics. Keep smoke tests read-only; use a separate staging fixture for mutations.
5. Add a dependency/security audit cadence (lockfile review, known-vulnerability scan, action pinning, secret scanning) and avoid exposing scanner output containing secret values.

## Priority 3 — Finish Product-Surface Quality Checks

1. Keep the existing global focus-visible and reduced-motion support. Run an axe-based accessibility pass on signup/login, onboarding, dashboard/job list, job detail, application pipeline, and document studio; manually test keyboard-only navigation, visible focus, dialog focus/escape behavior, labels/errors/live regions, 200% zoom, and narrow mobile widths.
2. Check document/list heavy paths on representative data. The job list is paginated today; retain bounded page sizes and measure before adding virtualization. Lazy-load PDF parsing/rendering and the 2.2 MB PDF worker only when those features are opened; establish bundle/interaction budgets from measured production chunks.
3. Add frontend workflow tests for empty/loading/error states, API outage, expired sessions, account switching, long/untrusted job descriptions, and destructive actions. Keep Apply as an outbound link and verify links work with keyboard and browser open-in-new-tab behavior.
4. Align documentation with the actual deployed server and behavior. Remove claims for inactive endpoints/features, document canonical route contracts, startup recovery behavior, and the exact meaning of each health state. Update counts/commands only after rerunning the suites.

## Dependencies and Delivery Order

- Coordinate with the agent implementing Part 1: the current working tree already has large edits in `web.py`, `repository.py`, `run_server.py`, `sources/base.py`, `Dashboard.jsx`, `JobModal.jsx`, and `sourceHealingService.js`. Preserve and review those changes; rerun this audit against the stabilized result before applying overlapping changes.
- Priority 0 security controls come first and must not wait for UI polish.
- Priority 1 route wiring is a prerequisite for validating auth and frontend workflows; tests must target the actual production handler.
- Priority 2 persistence snapshots depend on finalized user/data ownership boundaries from Part 1.
- CI and UI quality gates follow once the runtime contract and test suite are stable.

## Acceptance Criteria

- Unauthenticated requests cannot read or modify provider cookies, trigger outbound webhooks, write source code, or access user-private records.
- Webhook delivery cannot reach arbitrary/internal destinations; code repair cannot execute in the live server process or auto-push to a branch.
- All frontend-called API endpoints resolve through the production handler with documented schemas; expected auth failures return 401/403, not 404/500.
- Backend and frontend suites pass; no undefined-name lint findings remain; Ruff/oxlint baselines are explicitly enforced in CI.
- A restore always selects a verified, internally consistent SQLite snapshot; simulated partial writes/failures cannot silently corrupt or replace newer data.
- Health indicators reflect actual source/backend state, and accessible core workflows pass automated plus keyboard/mobile review.

## Files to Start With

- `backend/src/job_dashboard/web.py` and `backend/src/job_dashboard/run_server.py` — active production server, manual route dispatch, unauthenticated cookie and webhook paths, user identity resolution.
- `backend/src/job_dashboard/routes/__init__.py` and `backend/src/job_dashboard/routes/*.py` — alternate route registry that currently diverges from the active handler.
- `backend/src/job_dashboard/repository.py` — provider cookie persistence, pagination, FTS contract, user data.
- `backend/src/job_dashboard/sources/self_healing.py` and `routes/scrape.py` — dangerous runtime patch implementation and currently unmounted endpoints.
- `frontend/src/services/sourceHealingService.js` and `src/services/__tests__/sourceHealingService.test.js` — wrong/inconsistent endpoint and response contract.
- `backend/src/job_dashboard/gcs_backup.py`, `db_pool.py`, and profile/job persistence call sites in `web.py` — snapshot consistency and concurrent backup behavior.
- `backend/src/job_dashboard/batch_scoring.py`, `seek_pass_auditor.py`, and `web.py` — undefined-name runtime errors.
- `backend/tests/test_fts5.py`, `test_career_mode_routes.py`, `test_career_mode_e2e.py`, `test_subscription_billing.py`, `test_scrape_resilience.py`, and `test_source_self_healing.py` — current API/test contract drift.
- `frontend/src/index.css`, `components/AuthModal.jsx`, `OnboardingFlow.jsx`, `JobSeeker.jsx`, `ApplicationPipeline.jsx`, and `GeneratorModal.jsx` — remaining accessibility and workflow checks.
- `.github/workflows/agent-auto-heal.yml`, `.github/workflows/deploy.yml`, and `scripts/smoke-test.sh` — CI privilege boundary and release verification.
