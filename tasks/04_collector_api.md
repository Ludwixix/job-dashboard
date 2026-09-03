# TASK 4: Cascade Orchestrator & Dashboard API Endpoints

## Prerequisite
Confirm all scraper providers (Tiers 1, 2, 3) and data access layers are functional.

## Scope of Work
1. Create `services/collector.py`:
   - Concurrently trigger SEEK and Indeed scrapers using `asyncio.gather`.
   - Implement independent failover per board: Tier 1 -> Tier 2 -> Tier 3.
   - Deduplicate and persist results via the database upsert function from Task 1.
   - Return execution metrics: `{ total_found, new_jobs_stored, tier_breakdown }`.

2. Integrate with existing `job-dashboard` API routes:
   - Add/update `POST /api/jobs/search`: Triggers the live cascade, updates DB, and returns listings to the caller.
   - Add/update `GET /api/jobs`: Returns cached listings with standard pagination and filtering.
   - Ensure the JSON schema matches what the existing UI/frontend expects to consume.

## Handoff & Next Step
Once all files are written and validated:
1. Confirm completion of Task 4 in a single short summary sentence.
2. Immediately read and execute the instructions in: `05_deployment.md`.