# Job Dashboard Core

A modular extraction of the existing job dashboard's reusable behavior. This project keeps the core functions independent from scraping, generated HTML, Netlify, and LLM providers.

## Modules

- `models.py` defines the stable `Job` and `ApplicationRecord` data contracts.
- `normalize.py` converts source records into a predictable job shape.
- `classify.py` assigns jobs to `core-it`, `bridge`, or `traineeship`.
- `score.py` calculates fit dimensions, matched skills, gaps, and confidence.
- `applications.py` handles document splitting and application-index persistence.
- `service.py` composes the pure functions into an application-facing service.
- `sources.py` provides Indeed, Adzuna, RemoteOK, Seek, and LinkedIn adapters plus deduplication.

## Quick start

```bash
python -m pytest
```

Install provider adapters and run a collection:

```bash
python -m pip install -e '.[scraping]'
python -m playwright install chromium
PYTHONPATH=src python -m job_dashboard.scrape --output jobs.json
```

Adzuna requires credentials supplied through the environment (or the local `.env`):

```bash
export ADZUNA_APP_ID=your-app-id
export ADZUNA_API_KEY=your-api-key
```

The source adapters are the tested integration of the usable scrapers from the
legacy `job-dashboard-site/scrapers` folder. Indeed uses JobSpy, Adzuna uses its
API, SEEK uses its public search API with an optional browser fallback, LinkedIn
uses public search pages through Playwright, and RemoteOK adds remote listings.
The legacy scripts are retained as reference material rather than copied into
this application; fragile HTML, Google-search, Jora, CareerOne, and RSS
variants are not part of the production pipeline.

Run one provider while developing an adapter:

```bash
PYTHONPATH=src python -m job_dashboard.scrape --source seek --output jobs-seek.json
```

For Seek, the optional fallbacks can be enabled in order after the API:

```bash
PYTHONPATH=src python -m job_dashboard.scrape --source seek \
    --seek-browser-fallback \
    --seek-cache-fallback \
    --seek-cache-path /path/to/jobs_seek.json \
    --output jobs-seek.json
```

The app server enables the browser and cache fallbacks by default. Override
`SEEK_BROWSER_FALLBACK`, `SEEK_CACHE_FALLBACK`, or `SEEK_CACHE_PATH` when a
different policy or snapshot is required.

Indeed uses JobSpy, SEEK uses its public search API when that endpoint permits the request, and LinkedIn uses public job search pages through Playwright. Provider dependencies are optional so the domain core remains usable offline. The SEEK adapter deliberately does not bypass CAPTCHA, bot protection, robots rules, authentication, or rate limits; denied requests are reported in the dashboard refresh errors. Configure `SEEK_ENABLED=0` to disable it, or set `SEEK_API_ENDPOINT` only to a provider-approved endpoint. `SEEK_MAX_PAGES`, `SEEK_MAX_RESULTS`, and `SEEK_PAUSE_SECONDS` provide conservative request bounds.

Use the core without a server or database:

```python
from job_dashboard.service import JobDashboard

profile = {"skills": ["azure", "powershell", "windows"]}
dashboard = JobDashboard(profile)
result = dashboard.analyse({
    "title": "Cloud Engineer",
    "company": "Example Co",
    "location": "Melbourne",
    "description": "Azure and PowerShell automation",
})
print(result.score.score, result.stream)
```

The original project remains the source for scrapers, document templates, and deployment. Migrate those adapters into this package only when their input/output contracts are tested.

## Local dashboard

Start the full local application with the existing profile and writing documents:

```bash
PYTHONPATH=src python -m job_dashboard.run_server
```

On-demand generation loads every Markdown file under `Source of truth/` and `Guidelines/`, then sends that context, the verified profile, and the selected listing to the configured OpenRouter model. Set `OPENROUTER_API_KEY` to override the local OpenClaw configuration, or set `LLM_MODEL` to choose another model. Without a key, the server uses the grounded local fallback generator.
