---
name: production-deployment
description: Use before and during any deployment to Google Cloud Run or Netlify production. Enforces pre-deployment test gauntlet, zero secret exposure checks, Cloud Run artifact builds, health checks, and live rollback readiness.
---

# Production Deployment Workflow

## Trigger Conditions
- Deploying the monolithic web service or backend to Google Cloud Run (`job-dashboard-6xrdvjlrcq-ts.a.run.app`).
- Deploying frontend build artifacts or executing `deploy-cloudrun.sh`.
- Releasing major scraper updates, auth enhancements, or AI layer features to production.
- Post-incident recovery or rollback verification.

## Pre-Deployment Verification Checklist (Mandatory)
1. **Zero Secret Exposure Verification**:
   - Run `git status` to verify no `.env*`, `KEYS.md`, `OpenRouterAPI.txt`, or service account credentials are staged.
   - Verify environment variables passed to `gcloud run deploy` reference Cloud Secret Manager (`--set-secrets`) or project metadata, never hardcoded plaintext secrets.
2. **Backend Test Gauntlet**:
   - `cd /home/s/.openclaw/workspace/job-dashboard/backend && python3 -m pytest tests/ -v`
   - Must achieve 100% test pass rate with zero regression.
3. **Frontend Build & Lint Gauntlet**:
   - `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm run lint`
   - `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm test -- --run`
   - `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm run build`
4. **Git Synchronization**:
   - Ensure local branch `master` is clean and committed with Conventional Commits (`feat:`, `fix:`, etc.).
   - Push commits to upstream repository: `git push origin master`.

## Deployment Execution Steps
1. **Cloud Run Build & Deploy**:
   ```bash
   cd /home/s/.openclaw/workspace/job-dashboard/backend
   bash deploy-cloudrun.sh acaa-agent
   ```
2. **Live Health Check Verification**:
   - Verify health endpoint returns HTTP 200:
     ```bash
     curl -f -s https://job-dashboard-6xrdvjlrcq-ts.a.run.app/health | jq .
     ```
   - Verify database initialization and job ingestion readiness.
3. **Live API Smoke Tests**:
   - Test jobs listing: `curl -f -s "https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/jobs?pageSize=5" | jq .total`
   - Test detailed description enrichment: `curl -f -s "https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/job-description?job_id=seek-94061629" | jq .success`
   - Test session restoration: `curl -f -s "https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/session" -H "Authorization: Bearer invalid" | jq .authenticated`

## Rollback & Escalation Protocol
- If `/health` returns non-200 or memory limits spike:
  - Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=job-dashboard" --limit 30 --format json`
  - Revert traffic to prior revision: `gcloud run services update-traffic job-dashboard --to-revisions=PREVIOUS_REVISION=100`
  - Alert the user with the exact failure traceback.
