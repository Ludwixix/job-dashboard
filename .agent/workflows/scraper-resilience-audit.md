---
name: scraper-resilience-audit
description: Use when auditing, debugging, or enhancing job scraping adapters (Seek, Indeed, LinkedIn, Adzuna, RemoteOK, ATS portals). Covers multi-tier fallback architecture, anti-bot mitigation, Redux state extraction, rate-limit backoff, and on-demand ad enrichment.
---

# Scraper Resilience & Anti-Bot Audit Workflow

## Trigger Conditions
- Scraper returns empty results, 403 Forbidden, 429 Too Many Requests, or Cloudflare challenge pages.
- Job descriptions return short teaser summaries (<350 characters) instead of full advertisements.
- Adding a new job board source adapter or ATS portal parser.
- Routine scraper health monitoring or proxy rotator maintenance.

## Architecture & Tiered Execution Flow
1. **Tier 1: Direct Structured HTTP / Chalice API**:
   - Lightweight, high concurrency, lowest resource consumption.
   - Requires modern browser Client Hints headers (`Sec-Ch-Ua`, `Sec-Ch-Ua-Mobile: ?0`, `Sec-Fetch-Dest: document`, `Referer: https://www.seek.com.au/`).
   - If response is 403 or 429, seamlessly escalate to Tier 2.
2. **Tier 2: Playwright Stealth Headless Browser**:
   - Emulates authentic user agents, WebGL vendor strings, navigator plugins, and human-like cursor jitter.
   - Clears challenge screens using `wait_for_challenge_clearance()`.
   - Intercepts dynamic responses and extracts DOM structures.
3. **Tier 3: On-Demand Detail Enrichment**:
   - Rather than fetching 100+ full HTML detail pages during initial search discovery (which triggers rate limits and slows latency), search returns teasers.
   - When a job is inspected or targeted for application asset generation, `/api/job-description?job_id=...&url=...` fetches the full HTML ad on demand.
   - Full description is permanently cached in SQLite (`jobs.description` and `jobs.data_json`).

## Seek Scraper Detail Extraction Protocols
- **Redux State Extraction**:
  - Full Seek ad HTML resides within `<script>window.SEEK_REDUX_DATA = {...};</script>`.
  - Extract via `jobdetails.result.job.content` (5,000+ characters of pristine structured markup).
  - Strip unnecessary styling while converting `<ul><li>` items into clean bullet points (`• `).
- **DOM Fallback**:
  - Target container: `[data-automation="jobAdDetails"]` or `[data-testid="job-details"]`.
  - Extract inner text and format headings and paragraphs cleanly.

## Audit & Verification Steps
1. **Unit Test Scraper Extractors**:
   ```bash
   cd /home/s/.openclaw/workspace/job-dashboard/backend
   python3 -m pytest tests/test_seek_description.py tests/test_portal_crawler.py -v
   ```
2. **Live Test On-Demand Endpoint**:
   ```bash
   curl -s "http://localhost:8080/api/job-description?job_id=seek-94061629" | jq '{success, length, cached, enriched}'
   ```
3. **Inspect Proxy Health**:
   - Check `test_proxy.py` and ensure `ProxyRotator` cycles failed IPs out of rotation for 300 seconds.
