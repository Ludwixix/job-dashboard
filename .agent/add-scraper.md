# Component Workflow: Adding a New Scraper Adapter

Strict engineering rules and context boundaries when creating or updating scraper sources in `job-dashboard`.

## 1. Context Boundaries & Isolation Rules
- **Single File Ownership**: The scraper adapter must be self-contained in `backend/src/job_dashboard/sources/<provider>.py`.
- **Do Not Contaminate Other Adapters**: Never touch `seek.py`, `indeed.py`, `linkedin.py`, or `adzuna.py` when fixing or adding another provider.
- **Shared Contracts**: Extend `JobSource` from `backend/src/job_dashboard/sources/base.py` and implement:
  ```python
  class NewProviderSource(JobSource):
      name = "new_provider"
      def search(self, query: SearchQuery) -> list[dict[str, Any]]:
          ...
  ```
- **Registration**: Register the new source only in `backend/src/job_dashboard/sources/__init__.py`.

## 2. Data Normalization & Integrity
Every scraper adapter MUST produce normalized dictionaries adhering to the canonical schema:
- `id`: Unique composite identifier (e.g. `provider-{job_id}`)
- `title`: Clean job title (no excessive whitespace or HTML entities)
- `company`: Normalized company name
- `location`: Standard location string (e.g. `Sydney NSW` or `Remote, Australia`)
- `description`: Clean text without raw HTML or tracking scripts (pass through `clean_description()`)
- `source`: Exact provider name (`SEEK`, `Indeed`, `LinkedIn`, `Adzuna`, etc.)
- `url`: Canonical job URL (strip tracking query parameters)
- `posted`: Absolute or verifiable relative date (`posted_age`, `is_recent`)
- `tags`: List of extracted tech keywords/skills

## 3. Resilience & Anti-Detection Standards
- **Mock Mode Support**: Check `MOCK_SCRAPERS=true` so test cycles can bypass live HTTP without hitting IP blocks.
- **Fail-Safe Exception Handling**: Wrap outbound network queries in `try/except`; never crash the whole ingestion pipeline on one provider timeout. Return empty list and log error message.
- **Rate-Limiting & Delays**: Introduce randomized human-like delays (`time.sleep`) between pagination calls.

## 4. Verification & Testing Checklist
1. Add mock fixture records in `backend/data/mock_jobs_fixture.json`.
2. Write unit tests in `backend/tests/test_sources.py` using mocked HTTP responses or sample HTML snapshots.
3. Verify deduplication and recency filters:
   `cd backend && python3 -m pytest tests/test_sources.py -v`
4. Confirm health monitoring logs check:
   `GET /api/source-health`
