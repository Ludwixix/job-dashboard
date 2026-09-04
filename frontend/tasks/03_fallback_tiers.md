# TASK 3: Fallback Tiers (Tier 2 Apify & Tier 3 SerpApi)

## Prerequisite
Confirm `JobProviderBase` and `StandardJob` are implemented from Tasks 1 and 2.

## Scope of Work
Implement managed fallback scrapers in `services/scrapers/`:
1. `tier2_apify.py`:
   - Implement `ApifySeekProvider` and `ApifyIndeedProvider` using `apify-client`.
   - Read `APIFY_API_TOKEN` from existing project configuration/env.
   - Target active community actors (e.g., `automation-lab/seek-scraper` and `orgupdate/indeed-jobs-scraper`).
   - Normalize output to `StandardJob` (Tier 2). Catch quota limit errors (HTTP 402) and raise `QuotaExhaustedException`.

2. `tier3_serp.py`:
   - Implement `SerpApiGoogleJobsProvider` using `SERPAPI_API_KEY`.
   - Query targeting `site:seek.com.au OR site:au.indeed.com` combined with the role and location.
   - Normalize Google Jobs structured output to `StandardJob` (Tier 3).

Ensure all providers adhere strictly to `JobProviderBase`.

## Handoff & Next Step
Once all files are written and validated:
1. Confirm completion of Task 3 in a single short summary sentence.
2. Immediately read and execute the instructions in: `04_collector_api.md`.