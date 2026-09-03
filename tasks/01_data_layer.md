# TASK 1: Data Models & Persistence for Job Scraping

## Objective
Inspect the current `job-dashboard` repository layout and extend the data models and database migrations/schema.

## Scope of Work
1. Review the existing project structure and identify how models and databases are organized in `job-dashboard` (e.g., SQLAlchemy/SQLModel/Prisma, SQLite/Postgres).
2. Extend or create the Job data model:
   - Required fields: `id` (deterministic SHA256/MD5 hash from company.lower().strip() + title.lower().strip() + location.lower().strip()), `title`, `company`, `location`, `source` (SEEK, INDEED, GOOGLE_JOBS), `url`, `salary`, `date_posted`, `description`, `tier_retrieved` (int: 1, 2, or 3), `first_seen_at`, and `last_seen_at`.
   - Implement an async upsert function matching existing database session patterns that inserts new postings or updates `last_seen_at` if the job has already been scraped.
3. Update or provide corresponding Pydantic schemas (`StandardJob`, `JobSearchRequest`, `JobSearchResponse`) compatible with existing dashboard response contracts.

## Handoff & Next Step
Once all files are written, validated, and lint-checked:
1. Confirm completion of Task 1 in a single short summary sentence.
2. Immediately read and execute the instructions in: `02_tier1_scrapers.md`.