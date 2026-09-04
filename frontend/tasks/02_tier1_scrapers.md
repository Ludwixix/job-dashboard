# TASK 2: Base Interface & Tier 1 Scrapers (JobSpy + Playwright Stealth)

## Prerequisite
Confirm that `01_data_layer.md` models and database adapters are in place.

## Scope of Work
Create or integrate under `services/scrapers/` (or the existing scraper module path):
1. `base.py`:
   - Abstract Base Class `JobProviderBase` defining:
     `async def search(self, query: str, location: str, limit: int = 25) -> List[StandardJob]`

2. `tier1_stealth.py`:
   - `IndeedJobSpyProvider`: Scrapes Indeed via `python-jobspy` in an async executor thread, normalizing records to `StandardJob` (Tier 1). Supports optional `TIER1_PROXY_URL`.
   - `SeekPlaywrightProvider`: Uses Playwright with `playwright-stealth` in headless Chromium.
     - Anti-detection flags: `--disable-blink-features=AutomationControlled`, `--no-sandbox`, `--disable-dev-shm-usage`.
     - Extracts structured data by intercepting SEEK's network payloads or parsing `__NEXT_DATA__`.
     - Normalizes results to `StandardJob` (Tier 1).
     - Raises custom exceptions (`TierBlockedException`, `TierRateLimitedException`) on 403, 429, or bot challenges.
3. Follow the project's existing configuration patterns (e.g., Pydantic `BaseSettings` or `.env` loaders).

## Handoff & Next Step
Once all files are written and validated:
1. Confirm completion of Task 2 in a single short summary sentence.
2. Immediately read and execute the instructions in: `03_fallback_tiers.md`.