# Job Dashboard Ingestion — Manifest V3 Chrome Extension

Production-grade Chrome Extension for seamlessly extracting viewed opportunities and recommendation feed items from authenticated LinkedIn sessions and synchronizing them into Job Dashboard via `POST /api/jobs`.

---

## Architecture Overview

```
[ LinkedIn Tab DOM ]
        │  (Content Scripts: extractor.js, recommender.js, pacer.js)
        ▼
   chrome.runtime.sendMessage({ action: "INGEST_JOB", payload })
        │
        ▼
[ Background Service Worker ] (service-worker.js, api-bridge.js, storage.js)
        │
        ├─► Ping http://localhost:8000/api/health (1500ms timeout)
        │   └─► If healthy: Target = Localhost (8000)
        │   └─► If offline: Target = Cloud Run Production
        │
        ├─► Normalize payload (id, title, company, description, source, tags, posted, date_posted, remote, salary_raw)
        │
        ├─► POST ${target}/api/jobs
        │
        └─► Update chrome.storage.local (import cache & history)
        ▲
        │  (Status & Action Requests)
[ Glassmorphism Popup HUD ] (popup.html, popup.js, popup.css)
   - Connection Badge (Localhost / Cloud Run / Offline)
   - "Import Current Job"
   - "Scan Recommended Feed"
   - Settings Drawer (Custom URL, Token, Telemetry)
```

---

## Directory Structure

```
extensions/linkedin-ingestion/
├── manifest.json              # Strict Manifest V3 configuration
├── package.json               # Node test scripts and dependencies (Vitest, JSDOM)
├── vitest.config.js           # Vitest runner configuration with JSDOM
├── README.md                  # Developer guide & loading manual
├── icons/                     # Antigravity badge icons
│   ├── icon-16.png            # 16x16 px toolbar icon
│   ├── icon-48.png            # 48x48 px extensions management icon
│   └── icon-128.png           # 128x128 px store/install icon
├── scripts/
│   └── generate_icons.py      # Deterministic Pillow icon generation script
├── src/
│   ├── background/
│   │   ├── service-worker.js  # Top-level event listener coordinator
│   │   ├── api-bridge.js      # Dual-target resolution & HTTP transmission
│   │   └── storage.js         # chrome.storage.local persistence helpers
│   ├── content/
│   │   ├── extractor.js       # Multi-tier fallback DOM parsing for active job detail view
│   │   ├── recommender.js     # In-situ batch scanning for recommended collections
│   │   ├── pacer.js           # Polite pacing queue with jitter (1.5s–3.0s) & circuit breaker
│   │   └── content-script.js  # Tab message listener and coordinator
│   └── popup/
│       ├── popup.html         # Antigravity glassmorphism HUD markup
│       ├── popup.css          # Dark obsidian styling with cyan/teal glows
│       └── popup.js           # Popup controller, tab checking, and action dispatchers
└── tests/
    ├── setup.js               # Chrome API mock environment
    ├── extractor.test.js      # DOM extraction unit tests
    ├── pacer.test.js          # Polite pacer & timing unit tests
    ├── bridge.test.js         # Dual-target resolution & normalization tests
    ├── storage.test.js        # Storage cache & queue unit tests
    └── fixtures/
        ├── job-detail-unified.html     # Unified top card fixture
        ├── job-detail-classic.html     # Two-pane search view fixture
        └── job-feed-recommended.html  # Recommended card feed fixture
```

---

## Installation & Developer Loading

### Step 1: Generate Icons (if needed)
The repository includes pre-generated PNG icons. To regenerate deterministically:
```bash
python3 scripts/generate_icons.py
```

### Step 2: Load Unpacked in Google Chrome
1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Toggle on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the extension directory:
   `/home/s/.openclaw/workspace/job-dashboard/extensions/linkedin-ingestion`
6. The **Job Dashboard Ingestion** extension will appear in your extensions list.

---

## Usage Guide

1. **Active Job Ingestion**:
   - Navigate to any job post on LinkedIn (e.g. `https://www.linkedin.com/jobs/view/<id>/` or `https://www.linkedin.com/jobs/search/?currentJobId=<id>`).
   - Click the extension icon in the toolbar to open the Antigravity HUD.
   - Click **Import Current Job**.
   - The job title, company, location, employment type, workplace mode, salary range, clean canonical URL, and expanded description are parsed and posted to Job Dashboard.

2. **Recommended Feed Batch Scanning**:
   - Navigate to `https://www.linkedin.com/jobs/` or `https://www.linkedin.com/jobs/collections/recommended/`.
   - Open the HUD and click **Scan Feed**.
   - Detected cards are queued in the HUD. Click **Import All** to ingest them with human-speed polite pacing (1.5s–3.0s jitter delay).

3. **Dual-Target Backend Connectivity**:
   - The extension automatically pings `http://localhost:8000/api/health` with a 1500ms timeout.
   - If local development is running, jobs are sent to `http://localhost:8000/api/jobs`.
   - If localhost is unreachable or times out, jobs seamlessly route to Cloud Run production (`https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/jobs`).
   - A custom backend URL can also be configured in the settings drawer.

---

## Testing & Verification

Run the Vitest test gauntlet:
```bash
npm test
```

To run in watch mode during development:
```bash
npm run test:watch
```
