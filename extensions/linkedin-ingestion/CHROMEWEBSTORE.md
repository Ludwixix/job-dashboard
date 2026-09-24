# Chrome Web Store Listing & Metadata: Job Dashboard Ingestion

**Extension Name**: Job Dashboard Ingestion  
**Version**: 1.0.0  
**Last Updated**: 2026-09-24  
**Primary Category**: Productivity  
**Language**: English  

---

## 1. Store Listing Details

### Single-Sentence Summary (Max 132 chars)
Extract and ingest viewed LinkedIn jobs and recommendations directly into your Job Dashboard workspace with one click.

### Detailed Description
Job Dashboard Ingestion connects your active LinkedIn browsing directly with your personal Job Dashboard. 

Key Capabilities:
• 1-Click Active Job Ingestion: Automatically parses the complete job specification (Title, Company, Location, Workplace Type, Employment Type, Salary Range, and full un-truncated description) from the open LinkedIn tab and synchronizes it into your tracking database.
• In-Situ Recommendation Feed Scanning: Discovers recommended opportunities on LinkedIn collection feeds and allows batch ingestion with human-speed polite pacing.
• Dual-Target Backend Support: Automatically connects to your local development environment or routes seamlessly to cloud production.
• Clean Canonical Links: Strips tracking queries and redirects, preserving clean, direct job application URLs.
• Antigravity Dark HUD: High-contrast, accessible glassmorphic interface showing connection health and recent import telemetry.

---

## 2. Permissions Justification

| Permission | Plain-English Review Justification |
| :--- | :--- |
| `storage` | Required to persist user configuration (routing preferences, custom backend URLs) and maintain an offline import history cache for deduplication. |
| `activeTab` | Required to access the active LinkedIn job listing tab upon explicit user click to extract job posting details without reading background tabs. |
| `scripting` | Required to inject the content parsing script into open LinkedIn job tabs if they were opened prior to extension installation. |
| `host_permissions` (`*://*.linkedin.com/*`) | Required to read DOM elements and parse job postings on LinkedIn job details and collection pages. |
| `host_permissions` (`http://localhost:8000/*`) | Required for local development to probe backend health (`/api/health`) and transmit job payloads (`/api/jobs`). |
| `host_permissions` (`https://job-dashboard-6xrdvjlrcq-ts.a.run.app/*`) | Required to submit extracted job opportunities to the production Job Dashboard cloud backend. |

---

## 3. Privacy & Data Use Disclosures

- **Does this extension collect user personal data?** No.
- **Does this extension transmit browsing history?** No. Only user-selected job advertisement details from active LinkedIn job pages are transmitted to the user's configured Job Dashboard backend.
- **Data Retention**: Import history is stored locally in the browser's `chrome.storage.local` and never sold or shared with third parties.

---

## 4. Version History

- **v1.0.0 (2026-09-24)**: Initial release with Manifest V3 architecture, multi-tier DOM extraction cascade, dual-target API bridge, polite pacing queue, and Antigravity HUD.
