# TASK 5: Dependencies & Containerization Updates

## Prerequisite
Confirm code implementation in Tasks 1 through 4 is complete.

## Scope of Work
1. Update dependency definitions (`requirements.txt`, `pyproject.toml`, or equivalent):
   - Add: `playwright`, `playwright-stealth`, `python-jobspy`, `apify-client`, `google-search-results`, `aiosqlite`.
2. Adapt backend `Dockerfile`:
   - Ensure headless Chromium and its OS dependencies are installed (`playwright install --with-deps chromium` or equivalent Playwright base image).
   - Ensure unprivileged user permissions and `/data` volume directory paths match the container layout.
3. Adapt `docker-compose.yml`:
   - Set shared memory (`shm_size: '2gb'` or `ipc: host`) to avoid Chromium renderer crashes.
   - Map `.env` variables (`APIFY_API_TOKEN`, `SERPAPI_API_KEY`, `TIER1_PROXY_URL`).
   - Preserve existing frontend, database, or worker definitions.

## Completion
Run test imports/checks where possible, confirm the build files are valid, and report final integration status. Do NOT trigger any further prompt files.