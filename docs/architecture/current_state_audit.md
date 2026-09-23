# Master System Architecture Audit & Stocktake Report
**Job Dashboard Monorepo (`/home/s/.openclaw/workspace/job-dashboard`)**

- **Date**: 2026-09-23
- **Author**: Comprehensive Audit Report Generator Worker (`teamwork_preview_worker`)
- **Status**: Definitive System Baseline & Architectural Audit
- **Verification Authority**: Multi-Agent Survey Synthesis (Backend, Frontend, Persistence & Ingestion, Test Gauntlet)

---

## 1. Executive Summary & Architecture Scorecard

### 1.1 Architectural Overview
The **Job Dashboard** repository is an autonomous career logistics portal and intelligence engine ("Candidate Logistics Portal - Mentat Core") engineered to discover Australian and international job opportunities, evaluate candidate-role compatibility across multi-dimensional criteria, synthesize tailored ATS-compliant application documents, coordinate recruiter relationship CRM workflows, and track application lifecycles.

The system is structured as a full-stack monorepo featuring:
- **Backend**: A Python package (`backend/src/job_dashboard`) running on Python 3.14 with a `ThreadingHTTPServer` HTTP core, SQLite Write-Ahead Logging (WAL) local persistence, multi-provider web scraping adapters, and LLM-assisted document generation.
- **Frontend**: A Single-Page Application (SPA) built on React 19, Vite 8, and Tailwind CSS v4, containing a high-density dashboard cockpit, 34 lazy-loaded intelligence modals, and client-side heuristic fallbacks for offline operation.
- **Persistence & Cloud Sync**: Local SQLite WAL storage combined with optimistic concurrency Cloud Storage (GCS) object synchronization tailored for ephemeral Cloud Run container lifecycles.

---

### 1.2 System Health & Architecture Scorecard

| Architectural Metric | Quantitative Value | Status / Evaluation | Key Source File(s) |
|---|:---:|:---:|---|
| **Total Backend Python Modules** | **95 modules** | Surveyed & Mapped | `backend/src/job_dashboard/` |
| **Backend Total Lines of Code** | **34,294 lines** | Measured (`wc -l`) | `backend/src/` |
| **Monolithic Core (`web.py`)** | **6,782 lines** | Primary Refactor Target | `backend/src/job_dashboard/web.py` |
| **Active Modular API Endpoints** | **189 endpoints** | 100% Intercepted | `backend/src/job_dashboard/routes/` |
| **Dead Fallback Code in `web.py`** | **4,281 lines** | Safe to Excise | `backend/src/job_dashboard/web.py` |
| **Shadow FastAPI Layer Size** | **973 lines (8 files)** | Dead Maintenance Debt | `backend/src/job_dashboard/routers/` |
| **Total Frontend Components** | **77 components** | Surveyed & Mapped | `frontend/src/components/` |
| **Frontend Component Lines of Code** | **34,614 lines** | Measured (`wc -l`) | `frontend/src/components/` |
| **Frontend Services & API Files** | **60 files** | Surveyed & Mapped | `frontend/src/services/`, `src/api/` |
| **Frontend Service Lines of Code** | **19,917 lines** | Measured (`wc -l`) | `frontend/src/services/`, `src/api/` |
| **Initial JS Bundle Size (`index-*.js`)**| **1,386.63 kB (1.39 MB)**| Exceeds 500 kB Warning | `frontend/dist/assets/` |
| **Backend Test Suite (Pytest)** | **339 passed, 3 skipped, 0 failed**| **100% Pass Rate** (13.95s) | `backend/tests/` |
| **Frontend Test Suite (Vitest)** | **437 passed, 0 failed** (81 files)| **100% Pass Rate** (25.33s) | `frontend/src/` |
| **Frontend Linter (`oxlint`)** | **0 errors, 400 warnings** | Clean Build (0 errors) | `frontend/src/` |
| **Active SQLite Database Tables** | **20 tables** (8,390 jobs) | WAL Mode Verified | `backend/data/jobs.sqlite3` |
| **Cloud Storage Backup Manifest** | **12 tracked objects** | Atomic Sync Routine | `backend/src/job_dashboard/gcs_backup.py` |

---

### 1.3 Primary Architectural Risks & Findings Summary

1. **Dead Procedural Fallbacks in `web.py` (4,281 Lines)**: The Strangler Fig extraction is functionally complete with 189 endpoints routed through `app_router.dispatch()`. However, 4,281 lines of legacy `if/elif` blocks remain in `web.py` after the dispatch points, bloating the file to 6,782 lines.
2. **Frontend Entry Bundle Bloat (1.39 MB minified)**: `Dashboard.jsx` and `App.jsx` statically import heavy views (`AnalyticsDashboard` bringing `recharts`, `ApplicationPipeline` bringing `@dnd-kit`, `SiteGate`, and `OnboardingFlow`), causing the initial bundle to reach 1,386.63 kB despite 34 lazy-loaded modals.
3. **Shadow FastAPI Prototype Divergence**: An experimental FastAPI implementation (`routers/*.py` and `fastapi_app.py`, 973 lines) covers only 32 endpoints (~17% of total), is unused in production, and introduces maintenance drift.
4. **Broken Router Endpoint**: `routers/applications.py:111` calls `repo.get_application_events(user_id, job_id)`, but `JobRepository` lacks this method, producing an unhandled `AttributeError` when queried.
5. **Cloud Storage Environment Variable Drift**: `routers/backup.py` checks `JOB_DASHBOARD_GCS_BUCKET` or `GCS_BUCKET_NAME`, whereas `config.py`, `run_server.py`, `web.py`, and `deploy-cloudrun.sh` use `JOB_DASHBOARD_GCS_DATA_BUCKET`. As a result, the backup status API misreports GCS as unconfigured.
6. **Database Full-Table Scans on Search**: Ad-hoc job queries in `JobRepository.find_fresh_matching_jobs` and `query_jobs_paginated` execute leading wildcard searches (`lower(title) LIKE '%term%'`), bypassing B-Tree indices and scanning all 8,390 rows sequentially.
7. **Scraper Concurrency Pathway Divergence**: While `ScrapeCoordinator` enforces strict single-flight request coalescing and a bounded 1-worker thread ceiling, the HTTP `/api/refresh` handler executes `app.refresh()` directly in the synchronous request thread, bypassing the coordinator queue.

---

## 2. Requirement R1: Repository Architecture & Module Inventory

### 2.1 Backend Architecture & Module Inventory (95 Modules)
The backend package (`backend/src/job_dashboard`) comprises **95 Python modules** totaling **34,294 lines of code** organized into 9 architectural domains.

#### 1. Core Web, Routing & Entrypoints (8 files, 8,099 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/api/__init__.py` | 7 | API boundary package entrypoint. | Exports / Top-level | `..web`, `.gateway` |
| `backend/src/job_dashboard/api/gateway.py` | 60 | Strict API boundary layer for client access. | `ApiGateway` | `..web` |
| `backend/src/job_dashboard/fastapi_app.py` | 271 | Experimental FastAPI application prototype. | `CookieOverrideRequest`, `TelemetryStatus`, `create_app` | `fastapi`, `.repository`, `.config` |
| `backend/src/job_dashboard/openapi.py` | 531 | OpenAPI 3.1.0 specification generator. | `generate_openapi_spec`, `save_openapi_spec` | `json`, `pathlib` |
| `backend/src/job_dashboard/router.py` | 225 | Fast regex/prefix HTTP router with parameter extraction. | `Router`, `get_json_body`, `get_query_params` | `.security`, `json`, `jwt` |
| `backend/src/job_dashboard/run_server.py` | 192 | CLI server runner, GCS restore trigger, DB initialization. | `main` | `.web`, `.db_pool`, `.gcs_backup` |
| `backend/src/job_dashboard/service.py` | 31 | Application domain service composing job functions. | `JobDashboard` | `.classify`, `.models`, `.normalize` |
| `backend/src/job_dashboard/web.py` | 6,782 | Monolithic server core; `DashboardApp` and `make_handler`. | `DashboardApp`, `make_handler`, `_persist_profile_to_all_sinks` | Standard library, internal domain packages |

#### 2. Data Persistence, Database & Backups (10 files, 3,791 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/config.py` | 114 | Pydantic / dotenv configuration management. | `Settings`, `get_settings` | `dotenv`, `os`, `pathlib` |
| `backend/src/job_dashboard/config_manager.py` | 131 | Lightweight configuration manager without Pydantic. | `SimpleSettings`, `ConfigManager` | `.logging`, `dotenv`, `os` |
| `backend/src/job_dashboard/db_pool.py` | 307 | SQLite connection pooling, WAL configuration, thread safety. | `ConnectionPool`, `get_db_connection` | `sqlite3`, `threading`, `collections` |
| `backend/src/job_dashboard/gcs_backup.py` | 246 | Atomic GCS object backup/restore with optimistic locking. | `backup_to_gcs`, `restore_from_gcs`, `create_backup_snapshot` | `google.cloud.storage`, `sqlite3` |
| `backend/src/job_dashboard/models.py` | 161 | Core data models and schemas. | `SalaryBracket`, `JobRecord`, `Job`, `CandidateProfile` | `pydantic`, `dataclasses` |
| `backend/src/job_dashboard/profile.py` | 19 | Profile loading and formatting utilities. | `load_profile`, `profile_name` | `json`, `pathlib` |
| `backend/src/job_dashboard/profile_builder.py` | 143 | Candidate profile synthesis from PDF resume. | `extract_text_from_pdf`, `build_candidate_profile` | `pypdf`, `re`, `.logging` |
| `backend/src/job_dashboard/repository.py` | 2,337 | Primary SQLite repository; query execution, schema migrations. | `JobRepository`, `generate_dedupe_key` | `.db_pool`, `sqlite3`, `hashlib` |
| `backend/src/job_dashboard/scrape_config.py` | 20 | Default search terms and queries configuration. | Exports / Top-level | `.sources` |
| `backend/src/job_dashboard/types.py` | 313 | Type definitions and custom error classes. | `JobDict`, `ProfileDict`, `ScoreDict`, validation functions | `enum`, `dataclasses`, `typing` |

#### 3. Scoring, Normalization & Matching (8 files, 2,042 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/batch_scoring.py` | 223 | Batch scoring operations for high throughput. | `score_jobs_batch`, `_score_single_job_fast` | `.models`, `.score` |
| `backend/src/job_dashboard/classify.py` | 37 | Job stream classification rules. | `classify_job`, `classify_jobs` | `.models`, `re` |
| `backend/src/job_dashboard/compare.py` | 78 | Model output comparison runner. | `CompareRunner` | `.llm`, `.models`, `concurrent.futures` |
| `backend/src/job_dashboard/normalize.py` | 126 | Job normalization across multi-provider schemas. | `normalize_job`, `validate_job_normalization` | `.models`, `.types`, `hashlib` |
| `backend/src/job_dashboard/score.py` | 680 | 5-dimension job scoring engine. | `calculate_job_score`, `_score_title`, `_score_skills` | `.models`, `.semantic_scoring` |
| `backend/src/job_dashboard/semantic_scoring.py` | 233 | Subword tokenization and cosine similarity matching. | `cosine_similarity`, `tokenize_subwords` | `math`, `collections` |
| `backend/src/job_dashboard/semantic_tailoring.py` | 505 | Semantic density and fluff eradication engine. | `eradicate_fluff`, `localize_australian` | `re`, `dataclasses` |
| `backend/src/job_dashboard/verifier.py` | 160 | Job URL liveness verification. | `verify_job_url`, `verify_job_urls` | `urllib`, `ssl`, `re` |

#### 4. Generative AI, Intelligence & Document Creation (16 files, 5,015 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/ai_resume_analyzer.py` | 93 | AI resume analyzer and skills gap extractor. | `AIResumeAnalyzer`, `get_resume_analyzer` | `.cache`, `.logging`, `datetime` |
| `backend/src/job_dashboard/ats_optimizer.py` | 465 | ATS document exporter and injection sanitizer. | `sanitize_adversarial_injections`, `generate_ats_optimized_resume` | `.semantic_tailoring`, `io` |
| `backend/src/job_dashboard/ats_simulator.py` | 354 | Algorithmic ATS parsing simulator and STAR density audit. | `calculate_star_metric_density`, `audit_regional_compliance_au` | `re`, `typing` |
| `backend/src/job_dashboard/auto_apply.py` | 384 | Autonomous application execution runner. | `AutoApplyTask`, `AutoApplyManager` | `logging`, `re`, `asyncio` |
| `backend/src/job_dashboard/career_matrix.py` | 555 | Strategic career roadmap and skills gap forecaster. | `detect_current_seniority_level`, `generate_career_roadmap` | `re`, `typing` |
| `backend/src/job_dashboard/career_recommender.py` | 108 | Career path recommendations from historical matches. | `CareerRecommender`, `get_career_recommender` | `.cache`, `.types` |
| `backend/src/job_dashboard/content_library.py` | 79 | Prompt and document template library. | `ContentLibrary` | `pathlib`, `re` |
| `backend/src/job_dashboard/cover_letter_polarizer.py` | 396 | Cover letter swappability and anti-template polarizer. | `audit_cover_letter`, `generate_polarized_variants` | `dataclasses`, `re` |
| `backend/src/job_dashboard/documents.py` | 53 | Document generation interface definitions. | `generate_documents`, `RelevanceError` | `.models`, `.score` |
| `backend/src/job_dashboard/executive_dossier.py` | 600 | Executive company and hiring team intelligence dossier. | `detect_enterprise_scale`, `generate_executive_dossier` | `re`, `typing` |
| `backend/src/job_dashboard/interview_influence.py` | 224 | Post-interview debrief and influence strategy generator. | `evaluate_influence_health`, `generate_referee_alignment_pack` | `dataclasses`, `datetime` |
| `backend/src/job_dashboard/interview_simulator.py` | 492 | Mock interview question and response evaluator. | `InterviewSimulator`, `get_interview_simulator` | `.logging`, `datetime` |
| `backend/src/job_dashboard/ksc_generator.py` | 560 | Australian Key Selection Criteria (KSC) generator. | `extract_ksc_from_jd`, `map_ksc_to_capability_framework` | `.semantic_tailoring`, `dataclasses` |
| `backend/src/job_dashboard/llm.py` | 214 | OpenRouter / LLM client proxy. | `OpenRouterDocumentGenerator` | `httpx`, `hashlib`, `json` |
| `backend/src/job_dashboard/prompt_context.py` | 37 | Prompt context loading from PDF/text references. | `load_prompt_context` | `pathlib`, `pypdf` |
| `backend/src/job_dashboard/screening_solver.py` | 401 | Application screening questionnaire solver. | `extract_screening_questions_from_jd`, `solve_screening_question` | `dataclasses`, `re` |

#### 5. Scraper Coordination & Sources (17 files, 4,521 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/scrape.py` | 166 | Scraper CLI entrypoint and pipeline builder. | `build_sources`, `resolve_cli_queries`, `main` | `.sources`, `.scrape_config` |
| `backend/src/job_dashboard/scrape_coordinator.py` | 218 | Anti-duplicate single-flight query coordinator. | `ScrapeCoordinator`, `enqueue_query` | `threading`, `queue`, `time` |
| `backend/src/job_dashboard/seek_cache_ingest.py` | 96 | SEEK local cache file ingestion. | `_records`, `_normalize`, `ingest` | `.sources`, `argparse` |
| `backend/src/job_dashboard/seek_pass_auditor.py` | 448 | SEEK Pass and verified credential auditor. | `extract_seek_pass_requirements`, `audit_candidate_credentials` | `re`, `typing` |
| `backend/src/job_dashboard/sources/__init__.py` | 106 | Sources package export and factory. | Exports / Top-level | `.adzuna`, `.seek`, `.indeed`, `.remoteok` |
| `backend/src/job_dashboard/sources/adzuna.py` | 150 | Adzuna REST API job scraper adapter. | `AdzunaApiSource`, `_adzuna_record` | `httpx`, `.base`, `..models` |
| `backend/src/job_dashboard/sources/base.py` | 559 | Base class for job scraping sources. | `SearchQuery`, `JobSource`, `clean_description` | `dataclasses`, `collections` |
| `backend/src/job_dashboard/sources/browser.py` | 133 | Playwright browser stealth and bot evasion. | `create_stealth_browser`, `is_challenge_page` | `playwright`, `.proxy` |
| `backend/src/job_dashboard/sources/dedup.py` | 74 | Job deduplication keys and normalization. | `_normalize_company_name`, `_clean_job_url` | `hashlib`, `re` |
| `backend/src/job_dashboard/sources/indeed.py` | 553 | Indeed JobSpy scraper adapter. | `IndeedJobSpySource`, `_indeed_record` | `jobspy`, `.base`, `..models` |
| `backend/src/job_dashboard/sources/linkedin.py` | 103 | LinkedIn browser scraper adapter. | `LinkedInBrowserSource` | `playwright`, `.base` |
| `backend/src/job_dashboard/sources/portal_crawler.py` | 290 | ATS portal description crawler. | `is_ats_portal_url`, `clean_html_to_text` | `bs4`, `httpx` |
| `backend/src/job_dashboard/sources/proxy.py` | 145 | Proxy rotation and sanitization. | `ProxyInfo`, `ProxyRotator`, `parse_proxy` | `dataclasses`, `os` |
| `backend/src/job_dashboard/sources/remoteok.py` | 141 | RemoteOK REST API scraper adapter. | `RemoteOkApiSource` | `httpx`, `.base` |
| `backend/src/job_dashboard/sources/resilience.py` | 386 | JSON-LD and Redux state extraction. | `extract_from_json_ld`, `extract_embedded_state_jobs` | `json`, `re` |
| `backend/src/job_dashboard/sources/seek.py` | 535 | SEEK API and mobile payload scraper adapter. | `SeekApiSource`, `extract_seek_job_id` | `jobspy`, `httpx`, `.base` |
| `backend/src/job_dashboard/sources/self_healing.py` | 418 | Scraper diagnostic probes and self-healing engine. | `diagnose_source`, `remediate_runtime` | `ast`, `datetime` |

#### 6. CRM, Applications & Analytics (12 files, 4,252 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/analytics.py` | 558 | Analytics calculations, KPI summaries. | `JobAnalytics`, `get_analytics` | `.cache`, `.types` |
| `backend/src/job_dashboard/applications.py` | 206 | Application lifecycle tracking and document splitting. | `ApplicationStatus`, `SmartApplication` | `dataclasses`, `enum` |
| `backend/src/job_dashboard/billing.py` | 388 | Stripe billing, token ledger, server-side AI proxy. | `calculate_cost_usd`, `forward_to_openrouter` | `.repository`, `json` |
| `backend/src/job_dashboard/digest.py` | 279 | Morning opportunity digest generator. | `generate_morning_digest`, `format_slack_digest_blocks` | `datetime`, `collections` |
| `backend/src/job_dashboard/email_connector.py` | 551 | Gmail IMAP/API email scanner and classifier. | `EmailClassifier`, `GmailScanner` | `email`, `base64`, `imaplib` |
| `backend/src/job_dashboard/funnel_analytics.py` | 499 | Funnel conversion and pipeline velocity engine. | `detect_stalled_applications`, `calculate_velocity` | `datetime`, `typing` |
| `backend/src/job_dashboard/inbound_sourcing.py` | 409 | Recruiter Boolean search optimizer. | `BooleanEvaluator`, `generate_recruiter_boolean_queries` | `re`, `typing` |
| `backend/src/job_dashboard/network_crm.py` | 477 | Recruiter and talent network CRM manager. | `NetworkContact`, `NetworkCRMManager` | `.db_pool`, `dataclasses` |
| `backend/src/job_dashboard/offer_analytics.py` | 328 | Compensation benchmarking and employment contract risks. | `calculate_australian_tax`, `detect_sector_track` | `re`, `typing` |
| `backend/src/job_dashboard/predictive_analytics.py` | 111 | Career velocity and predictive success scoring. | `PredictiveAnalytics` | `.cache`, `.types` |
| `backend/src/job_dashboard/recommendations.py` | 136 | Smart job recommendation engine. | `SmartRecommendationEngine` | `.cache`, `.types` |
| `backend/src/job_dashboard/smart_applications.py` | 310 | Smart application state persistence and tracker. | `get_smart_application_tracker` | `dataclasses`, `datetime` |

#### 7. System, Infrastructure, Security & Utilities (10 files, 1,755 lines)
| File Path | Lines | Primary Responsibility | Key Classes / Functions | Dependencies |
|---|:---:|---|---|---|
| `backend/src/job_dashboard/__init__.py` | 40 | Package initialization and public symbol exports. | Exports / Top-level | `.api`, `.classify`, `.models` |
| `backend/src/job_dashboard/cache.py` | 436 | In-memory and SQLite-backed TTL cache. | `CacheEntry`, `CacheManager`, `get_cache` | `hashlib`, `dataclasses` |
| `backend/src/job_dashboard/health.py` | 197 | System health check and component monitoring. | `HealthCheck`, `get_health_check` | `.logging`, `.config` |
| `backend/src/job_dashboard/logging.py` | 278 | Structured JSON logging with Google Cloud formatter. | `CloudLoggingFormatter`, `setup_logging` | `logging`, `json` |
| `backend/src/job_dashboard/metrics.py` | 112 | Prometheus metrics exporter and instrumentation. | `JobDashboardMetrics`, `get_metrics` | `prometheus_client` |
| `backend/src/job_dashboard/retry.py` | 207 | Exponential backoff and retry decorators. | `RetryManager`, `retry` | `collections`, `time` |
| `backend/src/job_dashboard/security.py` | 165 | JWT issuance, password hashing (bcrypt), token parsing. | `SecurityManager`, `create_access_token` | `bcrypt`, `jwt`, `datetime` |
| `backend/src/job_dashboard/system_metrics.py` | 60 | Host CPU, RAM, and disk utilization telemetry. | `get_system_telemetry` | `os`, `platform`, `psutil` |
| `backend/src/job_dashboard/tasks.py` | 110 | Asynchronous background maintenance tasks. | `sync_jobs`, `update_recommendations` | `.analytics`, `.logging` |
| `backend/src/job_dashboard/utils.py` | 150 | Dictionary serialization and sanitization utilities. | `convert_to_job_dict`, `convert_to_profile_dict` | `.models`, `.types` |

#### 8. Modular Domain Routes (`routes/`) (6 files, 4,117 lines)
| File Path | Lines | Primary Responsibility | Registered Endpoints |
|---|:---:|---|:---:|
| `backend/src/job_dashboard/routes/__init__.py` | 5 | Package init importing domain modules onto `app_router`. | N/A |
| `backend/src/job_dashboard/routes/ai.py` | 1,207 | AI documents, ATS diagnostics, interview simulator, tailoring. | 66 endpoints |
| `backend/src/job_dashboard/routes/auth.py` | 959 | Auth, GIS, passkeys, sessions, user profiles, preferences. | 18 endpoints |
| `backend/src/job_dashboard/routes/billing.py` | 120 | Stripe checkout, customer portal, server AI proxy. | 5 endpoints |
| `backend/src/job_dashboard/routes/jobs.py` | 1,137 | Job listings, candidate applications, CRM, dossiers, career matrix. | 69 endpoints |
| `backend/src/job_dashboard/routes/scrape.py` | 689 | Scraper execution, SSE streams, criteria, health, telemetry. | 31 endpoints |

#### 9. Shadow FastAPI Routers (`routers/`) (8 files, 702 lines)
| File Path | Lines | Primary Responsibility | Declared Endpoints |
|---|:---:|---|:---:|
| `backend/src/job_dashboard/routers/__init__.py` | 19 | Routers package exports. | N/A |
| `backend/src/job_dashboard/routers/applications.py` | 112 | Application tracking and event history router. | 4 endpoints |
| `backend/src/job_dashboard/routers/auth.py` | 157 | Authentication, session, and candidate profile router. | 5 endpoints |
| `backend/src/job_dashboard/routers/backup.py` | 48 | GCS backup status and snapshot router. | 2 endpoints |
| `backend/src/job_dashboard/routers/digest.py` | 88 | Opportunity digest preview and dispatch router. | 2 endpoints |
| `backend/src/job_dashboard/routers/jobs.py` | 113 | Job listings, descriptions, and URL verification router. | 5 endpoints |
| `backend/src/job_dashboard/routers/metrics.py` | 76 | Health, metrics, and OpenAPI schema router. | 6 endpoints |
| `backend/src/job_dashboard/routers/search.py` | 89 | Search criteria and saved searches router. | 4 endpoints |

---

### 2.2 Complete Active API Endpoint Matrix (189 Endpoints)
The table below details all 189 active HTTP endpoints registered on `app_router` and handled in production via `app_router.dispatch()`:

#### AI & Intelligence Routes (`routes/ai.py` — 66 Endpoints)
| Method | Path Pattern | Handler Function | Backing Domain Service | Auth Requirement | Request Payload | Response Schema |
|:---:|---|---|---|---|---|---|
| **GET** | `/api/ai/interview-statistics` | `handle_interview_statistics` | `app.get_interview_statistics` | Public | None | JSON stats object |
| **GET** | `/api/ai/predictive-analytics` | `handle_ai_predictive_analytics` | `app.get_predictive_analytics` | Public | Query: days, threshold | JSON prediction metrics |
| **GET** | `/api/ai/resume-analyze` | `handle_ai_resume_analyze` | `app.analyze_resume_ai` | Public | Query: resume_text | JSON analysis result |
| **GET** | `/api/ai/timing-recommendations`| `handle_ai_timing_recommendations`| `app.get_application_timing_recommendations` | Public | None | JSON timing advisory |
| **GET** | `/api/ats-diagnostic` | `handle_ats_diagnostic` | `JobRepository.get_job, get_user_profile` | Public | Query: job_id, user_id | JSON ATS score & gaps |
| **GET** | `/api/cover-letter` | `handle_cover_letter` | `JobRepository.get_job, get_user_profile` | Public | Query: job_id | JSON tailored draft |
| **GET** | `/api/documents` | `handle_get_documents` | `JobRepository.get_generated_document` | Bearer JWT | Query: job_id, doc_type | JSON cached documents |
| **GET** | `/api/export-ats-resume` | `handle_export_ats_resume` | `JobRepository.get_job, get_user_profile` | Public | Query: job_id, format | JSON ATS resume payload |
| **GET** | `/api/inbound-sourcing/queries`| `handle_inbound_sourcing_queries`| `inbound_sourcing.generate_recruiter_boolean_queries` | Public | Query: title, skills | JSON boolean search queries |
| **GET** | `/api/interview-debrief` | `handle_get_interview_debrief` | `app._interview_debriefs` | Public | Query: job_id | JSON debrief notes |
| **GET** | `/api/interview-sessions` | `handle_get_interview_sessions`| `JobRepository.get_interview_sessions` | Bearer JWT | Query: job_id | JSON session transcripts |
| **GET** | `/api/job-intelligence` | `handle_get_job_intelligence` | `JobRepository.get_job_intelligence` | Public | Query: job_id, tool_key | JSON tool outputs |
| **GET** | `/api/linkedin-optimization` | `handle_linkedin_optimization` | `JobRepository.get_job, get_user_profile` | Public | Query: job_id | JSON LinkedIn bullets |
| **GET** | `/api/psychology` | `handle_get_psychology` | `JobRepository.get_job_psychology` | Public | Query: job_id | JSON cultural insights |
| **GET** | `/api/semantic-gap` | `handle_semantic_gap` | `JobRepository.get_job, get_user_profile` | Public | Query: job_id | JSON semantic breakdown |
| **GET** | `^/api/ai/interview/(?P<session_id>[^/]+)/feedback$` | `handle_interview_feedback` | `app.get_interview_feedback` | Public | None | JSON feedback report |
| **GET** | `^/api/ai/interview/(?P<session_id>[^/]+)/performance$` | `handle_interview_performance` | `app.analyze_interview_performance` | Public | None | JSON score breakdown |
| **GET** | `^/api/auto-apply/(?P<job_id>[^/]+)/status$` | `handle_auto_apply_status` | `auto_apply.get_task_status` | Public | None | JSON task status & logs |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/ats-diagnostic$` | `handle_ats_diagnostic` | `JobRepository.get_job, get_user_profile` | Public | None | JSON ATS report |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/cover-letter$` | `handle_cover_letter` | `JobRepository.get_job, get_user_profile` | Public | None | JSON cover letter |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/cover-letter-audit$` | `handle_get_cover_letter_audit` | `cover_letter_polarizer.audit_cover_letter` | Public | None | JSON audit metrics |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/generate-status$` | `handle_job_generate_status` | `app._generation_status` | Public | None | JSON queue status |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/inbound-optimization$` | `handle_job_inbound_optimization` | `inbound_sourcing.generate_recruiter_boolean_queries` | Public | None | JSON Boolean queries |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/ksc$` | `handle_get_ksc` | `ksc_generator.extract_ksc_from_jd` | Public | None | JSON KSC criteria list |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/linkedin-optimization$` | `handle_linkedin_optimization` | `JobRepository.get_job, get_user_profile` | Public | None | JSON LinkedIn tags |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/screening-solutions$` | `handle_get_screening_solutions` | `screening_solver.extract_screening_questions_from_jd` | Public | None | JSON questions list |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/seek-pass$` | `handle_get_seek_pass` | `seek_pass_auditor.extract_seek_pass_requirements` | Public | None | JSON credentials list |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/semantic-gap$` | `handle_semantic_gap` | `JobRepository.get_job, get_user_profile` | Public | None | JSON gap analysis |
| **POST** | `/api/ai/career-paths` | `handle_ai_career_paths` | `app.recommend_career_paths` | Public | `{profile, industry}` | JSON recommended roles |
| **POST** | `/api/ai/interview/reset` | `handle_interview_reset` | `app.reset_interview_simulator` | Public | None | `{status: "reset"}` |
| **POST** | `/api/ai/interview/simulate` | `handle_interview_simulate` | `app.simulate_interview` | Public | `{job_id, candidate_level}` | JSON simulation session |
| **POST** | `/api/ai/resume-analyze` | `handle_ai_resume_analyze` | `app.analyze_resume_ai` | Public | `{resume_text: str}` | JSON parsed sections |
| **POST** | `/api/ai/skill-gap` | `handle_ai_skill_gap` | `app.analyze_skill_gap` | Public | `{job_id, profile}` | JSON skill delta |
| **POST** | `/api/ats-diagnostic` | `handle_ats_diagnostic` | `JobRepository.get_job, get_user_profile` | Public | `{job_id, resume_text}` | JSON ATS diagnosis |
| **POST** | `/api/auto-apply` | `handle_auto_apply` | `auto_apply.start_task` | Public | `{job_id, profile}` | `{task_id, status}` |
| **POST** | `/api/auto-apply/start` | `handle_auto_apply` | `auto_apply.start_task` | Public | `{job_id, profile}` | `{task_id, status}` |
| **POST** | `/api/cover-letter` | `handle_cover_letter` | `JobRepository.get_job, get_user_profile` | Public | `{job_id, tone}` | JSON cover letter draft |
| **POST** | `/api/cover-letter/audit` | `handle_post_cover_letter_audit`| `cover_letter_polarizer.audit_cover_letter` | Public | `{text: str}` | JSON audit scores |
| **POST** | `/api/cover-letter/polarize` | `handle_cover_letter_polarize` | `cover_letter_polarizer.generate_polarized_variants` | Public | `{job_id, draft_text}` | JSON variants |
| **POST** | `/api/documents` | `handle_post_documents` | `JobRepository.upsert_generated_document` | Bearer JWT | `{job_id, doc_type, content_text}` | `{success: True}` |
| **POST** | `/api/export-ats-resume` | `handle_export_ats_resume` | `ats_optimizer.generate_ats_optimized_resume` | Public | `{job_id, format}` | Downloadable document |
| **POST** | `/api/generate-docs` | `handle_generate_docs` | `app.start_generation` | Public | `{job_id, model, tone}` | `{task_id, status}` |
| **POST** | `/api/inbound-sourcing/audit` | `handle_inbound_sourcing_audit` | `inbound_sourcing.evaluate_boolean_query` | Public | `{headline, about}` | JSON profile audit |
| **POST** | `/api/inbound-sourcing/test-query` | `handle_inbound_test_query`| `inbound_sourcing.evaluate_boolean_query` | Public | `{query: str}` | JSON search preview |
| **POST** | `/api/interview-debrief` | `handle_post_interview_debrief` | `interview_influence.evaluate_influence_health` | Public | `{job_id, notes}` | JSON debrief rating |
| **POST** | `/api/interview-debrief/follow-up` | `handle_interview_debrief_followup` | `interview_influence.generate_objection_resolution_memo` | Public | `{job_id, objections}` | JSON email memo |
| **POST** | `/api/interview-debrief/referee-pack` | `handle_interview_debrief_referee_pack` | `interview_influence.generate_referee_alignment_pack` | Public | `{job_id, referees}` | JSON alignment guide |
| **POST** | `/api/interview-sessions` | `handle_post_interview_sessions`| `JobRepository.save_interview_session` | Bearer JWT | `{job_id, session_data}` | `{session_id, saved: True}` |
| **POST** | `/api/job-intelligence` | `handle_post_job_intelligence` | `JobRepository.upsert_job_intelligence` | Public | `{job_id, tool_key, data}` | `{saved: True}` |
| **POST** | `/api/ksc/generate` | `handle_post_ksc_generate` | `ksc_generator.map_ksc_to_capability_framework` | Public | `{job_id, criteria}` | JSON KSC statements |
| **POST** | `/api/linkedin-optimization` | `handle_linkedin_optimization` | `JobRepository.get_job, get_user_profile` | Public | `{job_id}` | JSON LinkedIn copy |
| **POST** | `/api/profile/auto-generate` | `handle_profile_auto_generate` | `profile_builder.synthesize_profile_from_text` | Public | `{raw_text, pdf_base64}`| JSON candidate profile |
| **POST** | `/api/psychology` | `handle_post_psychology` | `JobRepository.upsert_job_psychology` | Public | `{job_id, insights}` | `{saved: True}` |
| **POST** | `/api/screening/solve` | `handle_screening_solve` | `screening_solver.solve_screening_question` | Public | `{job_id, questions}` | JSON STAR solutions |
| **POST** | `/api/seek-pass/audit` | `handle_post_seek_pass_audit` | `seek_pass_auditor.audit_candidate_credentials` | Public | `{job_id, credentials}` | JSON compliance audit |
| **POST** | `/api/seek-pass/audit/` | `handle_post_seek_pass_audit` | `seek_pass_auditor.audit_candidate_credentials` | Public | `{job_id, credentials}` | JSON compliance audit |
| **POST** | `/api/semantic-gap` | `handle_semantic_gap` | `JobRepository.get_job, get_user_profile` | Public | `{job_id}` | JSON tailored gaps |
| **POST** | `^/api/ai/interview/(?P<session_id>[^/]+)/answer$` | `handle_interview_answer` | `app.submit_interview_answer` | Public | `{answer: str}` | JSON question evaluation |
| **POST** | `^/api/ai/interview/(?P<session_id>[^/]+)/feedback$` | `handle_interview_feedback` | `app.get_interview_feedback` | Public | None | JSON feedback report |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/ats-diagnostic$` | `handle_ats_diagnostic` | `JobRepository.get_job, get_user_profile` | Public | `{resume_text}` | JSON ATS diagnosis |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/cover-letter$` | `handle_cover_letter` | `JobRepository.get_job, get_user_profile` | Public | `{tone}` | JSON cover letter |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/generate$` | `handle_job_generate` | `app.start_generation` | Public | None | `{task_id, status}` |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/generate-final$` | `handle_job_generate_final` | `app._recover_generated_documents` | Public | None | JSON documents package |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/generate-status$` | `handle_job_generate_status` | `app._generation_status` | Public | None | JSON progress status |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/linkedin-optimization$` | `handle_linkedin_optimization` | `JobRepository.get_job, get_user_profile` | Public | None | JSON LinkedIn bullets |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/semantic-gap$` | `handle_semantic_gap` | `JobRepository.get_job, get_user_profile` | Public | None | JSON semantic gaps |

#### Auth & User Session Routes (`routes/auth.py` — 18 Endpoints)
| Method | Path Pattern | Handler Function | Backing Domain Service | Auth Requirement | Request Payload | Response Schema |
|:---:|---|---|---|---|---|---|
| **GET** | `/api/feature-flags` | `handle_get_feature_flags` | `JobRepository.get_feature_flags` | Bearer JWT / Optional | None | JSON feature flags |
| **GET** | `/api/preferences` | `handle_get_preferences` | `JobRepository.get_user_preferences` | Bearer JWT / Optional | None | JSON user preferences |
| **GET** | `/api/profile` | `handle_get_profile` | `JobRepository.get_user_profile` | Bearer JWT / Optional | Query: user_id, email | JSON candidate profile |
| **GET** | `/api/session` | `handle_get_session` | `JobRepository.get_user_profile` | Bearer JWT | None | JSON active session |
| **POST** | `/api/feature-flags` | `handle_set_feature_flag` | `JobRepository.set_feature_flag` | Bearer JWT | `{key, enabled, description}` | `{success: True}` |
| **POST** | `/api/google-login` | `handle_google_auth` | `JobRepository.get_user_profile, migrate_default_user` | Public | `{id_token, email, name}` | `{token, user}` |
| **POST** | `/api/google-oauth` | `handle_google_auth` | `JobRepository.get_user_profile, migrate_default_user` | Public | `{id_token, email, name}` | `{token, user}` |
| **POST** | `/api/link-google` | `handle_link_google` | `JobRepository.get_user_profile` | Bearer JWT | `{google_id, email}` | `{success: True}` |
| **POST** | `/api/login` | `handle_login` | `JobRepository.get_user_profile, security.verify` | Public | `{email, password}` | `{token, user}` |
| **POST** | `/api/logout` | `handle_logout` | In-memory session invalidate | Public | None | `{success: True}` |
| **POST** | `/api/passkey-login` | `handle_passkey_login` | `JobRepository.get_user_by_credential` | Public | `{credential_id, signature}` | `{token, user}` |
| **POST** | `/api/passkey-register` | `handle_passkey_setup` | `JobRepository.get_user_profile` | Bearer JWT | `{credential_id, public_key}` | `{success: True}` |
| **POST** | `/api/passkey-setup` | `handle_passkey_setup` | `JobRepository.get_user_profile` | Bearer JWT | `{credential_id, public_key}` | `{success: True}` |
| **POST** | `/api/preferences` | `handle_save_preferences` | `JobRepository.upsert_user_preferences` | Bearer JWT / Optional | `{scoring_weights, filters}` | `{success: True}` |
| **POST** | `/api/profile` | `handle_save_profile` | `_persist_profile_to_all_sinks` | Bearer JWT / Optional | Full profile JSON | `{saved: True}` |
| **POST** | `/api/register` | `handle_register` | `JobRepository.migrate_default_user` | Public | `{email, password, name}` | `{token, user}` |
| **POST** | `/api/resend-verification` | `handle_resend_verification` | Direct DB connection | Public | `{email: str}` | `{sent: True}` |
| **POST** | `/api/verify-email` | `handle_verify_email` | Direct DB connection | Public | `{email, code}` | `{verified: True}` |

#### Billing & AI Proxy Routes (`routes/billing.py` — 5 Endpoints)
| Method | Path Pattern | Handler Function | Backing Domain Service | Auth Requirement | Request Payload | Response Schema |
|:---:|---|---|---|---|---|---|
| **GET** | `/api/billing/status` | `handle_billing_status` | `billing.get_billing_status` | Bearer JWT | None | JSON subscription info |
| **POST** | `/api/ai/proxy` | `handle_ai_proxy` | `billing.forward_to_openrouter` | Bearer JWT | OpenRouter payload | Streaming / JSON AI completion |
| **POST** | `/api/billing/create-checkout-session` | `handle_create_checkout_session` | `billing.create_checkout_session` | Bearer JWT | `{price_id, period}` | `{checkout_url}` |
| **POST** | `/api/billing/customer-portal` | `handle_customer_portal` | `billing.create_portal_session` | Bearer JWT | None | `{portal_url}` |
| **POST** | `/api/billing/webhook` | `handle_billing_webhook` | `billing.handle_stripe_event` | Stripe Webhook Sig | Raw Stripe event | `{received: True}` |

#### Job Discovery, CRM & Application Routes (`routes/jobs.py` — 69 Endpoints)
| Method | Path Pattern | Handler Function | Backing Domain Service | Auth Requirement | Request Payload | Response Schema |
|:---:|---|---|---|---|---|---|
| **DELETE**| `/api/applications` | `handle_delete_applications` | `JobRepository.delete_user_application` | Bearer JWT | `{job_id: str}` | `{success: True}` |
| **DELETE**| `^/api/network/contacts/(?P<contact_id>[^/]+)$` | `handle_delete_contact` | `app.network_crm.delete_contact` | Public | None | `{deleted: True}` |
| **GET** | `/api/analytics/funnel` | `handle_analytics_funnel` | `funnel_analytics.calculate_funnel_metrics` | Public | Query: range, sector | JSON funnel metrics |
| **GET** | `/api/applications` | `handle_get_applications` | `JobRepository.get_user_applications` | Bearer JWT | None | JSON user applications list |
| **GET** | `/api/applications/archive` | `handle_applications_archive` | `app.application_archive` | Public | None | JSON archived jobs |
| **GET** | `/api/career/roadmap` | `handle_career_roadmap` | `career_matrix.generate_career_roadmap` | Public | None | JSON career trajectory |
| **GET** | `/api/dossier` | `handle_get_dossier` | `executive_dossier.generate_executive_dossier`| Public | Query: job_id, company | JSON executive briefing |
| **GET** | `/api/executive-dossier` | `handle_get_dossier` | `executive_dossier.generate_executive_dossier`| Public | Query: job_id, company | JSON executive briefing |
| **GET** | `/api/job-description` | `handle_get_job_description` | `JobRepository.get_job, web.fetch_seek` | Public | Query: job_id, url | JSON description text |
| **GET** | `/api/job-explanation` | `handle_job_explanation` | `JobRepository.get_job, get_user_profile` | Bearer JWT | Query: job_id | JSON match explanation |
| **GET** | `/api/jobs` | `handle_get_jobs` | `JobRepository.query_jobs_paginated` | Public | Query: page, search, stream | Paginated jobs JSON |
| **GET** | `/api/matches` | `handle_get_matches` | `JobRepository.get_candidate_matches` | Public | Query: min_score, limit | JSON matched jobs |
| **GET** | `/api/network/cadence` | `handle_network_cadence` | `app.network_crm.get_cadence_radar` | Public | None | JSON cadence radar |
| **GET** | `/api/network/contacts` | `handle_get_contacts` | `app.network_crm.list_contacts` | Public | Query: health, sector | JSON recruiter contacts |
| **GET** | `/api/network/contacts/` | `handle_get_contacts` | `app.network_crm.list_contacts` | Public | Query: health, sector | JSON recruiter contacts |
| **GET** | `/api/rejections` | `handle_get_rejections` | `app.rejected_applications` | Public | None | JSON rejected list |
| **GET** | `/api/reminders` | `handle_get_reminders` | `JobRepository.list_due_reminders` | Bearer JWT | Query: include_future | JSON reminders list |
| **GET** | `/api/saved-searches` | `handle_get_saved_searches` | `JobRepository.list_saved_searches` | Bearer JWT | None | JSON saved searches |
| **GET** | `/api/scraped-jobs` | `handle_get_scraped_jobs` | `app.public_jobs` | Public | Query parameters | JSON raw scraped jobs |
| **GET** | `/api/tracker/suggestions`| `handle_tracker_suggestions` | `app.tracker_suggestions` | Public | None | JSON tracker advice |
| **GET** | `/api/verify-job-url` | `handle_verify_job_url` | `verifier.verify_job_url` | Public | Query: url | JSON verification state |
| **GET** | `^/api/compare/(?P<comparison_id>[^/]+)$` | `handle_get_compare` | `app.compare_results.get` | Public | None | JSON compare result |
| **GET** | `^/api/jobs/(?P<job_id>[^/]+)/dossier$` | `handle_get_dossier` | `executive_dossier.generate_executive_dossier`| Public | None | JSON dossier |
| **GET** | `^/api/network/contacts/(?P<contact_id>[^/]+)$` | `handle_get_contact` | `app.network_crm.get_contact` | Public | None | JSON contact record |
| **GET** | `^/applications/(?P<filename>.+)$` | `handle_get_application_file` | File streaming from `data_dir` | Public | None | File binary stream |
| **POST** | `/api/analytics/funnel` | `handle_analytics_funnel` | `funnel_analytics.calculate_funnel_metrics` | Public | `{time_range, sector}` | JSON funnel analysis |
| **POST** | `/api/applications` | `handle_post_applications` | `JobRepository.upsert_user_application` | Bearer JWT | `{job_id, status, notes}` | `{saved: True}` |
| **POST** | `/api/applications/scan-updates` | `handle_applications_scan_updates` | `email_connector.GmailScanner` | Bearer JWT | `{username, app_password}` | JSON updated apps |
| **POST** | `/api/applications/sync`| `handle_applications_sync` | `JobRepository.upsert_user_application` | Bearer JWT | `{applications: list}` | `{synced: count}` |
| **POST** | `/api/career/roadmap` | `handle_career_roadmap` | `career_matrix.generate_career_roadmap` | Public | `{target_level, skills}` | JSON career vectors |
| **POST** | `/api/compensation/analyze`| `handle_compensation_benchmark`| `offer_analytics.calculate_australian_tax` | Public | `{salary, superannuation}`| JSON net compensation |
| **POST** | `/api/compensation/benchmark`| `handle_compensation_benchmark`| `offer_analytics.detect_sector_track` | Public | `{title, location}` | JSON market benchmarks |
| **POST** | `/api/contracts/audit` | `handle_contract_scan_risks` | `offer_analytics.scan_contract_risks` | Public | `{contract_text: str}` | JSON clause risks |
| **POST** | `/api/contracts/scan-risks` | `handle_contract_scan_risks` | `offer_analytics.scan_contract_risks` | Public | `{contract_text: str}` | JSON clause risks |
| **POST** | `/api/dossier/export-markdown` | `handle_dossier_export_markdown` | `executive_dossier.format_markdown` | Public | `{dossier_data: dict}` | Markdown text payload |
| **POST** | `/api/dossier/generate` | `handle_post_dossier_generate` | `executive_dossier.generate_executive_dossier`| Public | `{job_id, company}` | JSON dossier |
| **POST** | `/api/executive-dossier/export-markdown` | `handle_dossier_export_markdown` | `executive_dossier.format_markdown` | Public | `{dossier_data: dict}` | Markdown text payload |
| **POST** | `/api/executive-dossier/generate` | `handle_post_dossier_generate` | `executive_dossier.generate_executive_dossier`| Public | `{job_id, company}` | JSON dossier |
| **POST** | `/api/gmail/scan` | `handle_gmail_scan` | `app.scan_gmail` | Public | `{credentials}` | JSON scan results |
| **POST** | `/api/job-description` | `handle_post_job_description` | `JobRepository.update_job_description` | Public | `{job_id, url, force}` | JSON description |
| **POST** | `/api/jobs` | `handle_post_jobs` | `JobRepository.upsert_scraped_jobs` | Public | `{jobs: list}` | `{inserted, updated}` |
| **POST** | `/api/matches/evaluate` | `handle_matches_evaluate` | `JobRepository.evaluate_and_stage_matches` | Public | `{profile, min_score}` | `{matched_count}` |
| **POST** | `/api/network/contacts` | `handle_post_contact` | `app.network_crm.upsert_contact` | Public | Contact JSON object | `{saved_id: str}` |
| **POST** | `/api/network/contacts/` | `handle_post_contact` | `app.network_crm.upsert_contact` | Public | Contact JSON object | `{saved_id: str}` |
| **POST** | `/api/network/contacts/delete`| `handle_post_delete_contact`| `app.network_crm.delete_contact` | Public | `{contact_id: str}` | `{deleted: True}` |
| **POST** | `/api/network/contacts/interaction` | `handle_network_interaction` | `app.network_crm.add_interaction` | Public | `{contact_id, note}` | `{saved: True}` |
| **POST** | `/api/network/delete` | `handle_post_delete_contact` | `app.network_crm.delete_contact` | Public | `{contact_id: str}` | `{deleted: True}` |
| **POST** | `/api/network/interactions` | `handle_network_interaction` | `app.network_crm.add_interaction` | Public | `{contact_id, note}` | `{saved: True}` |
| **POST** | `/api/network/seed` | `handle_network_seed` | `app.network_crm.seed_default_contacts` | Public | None | `{seeded: count}` |
| **POST** | `/api/reminders` | `handle_post_reminders` | `JobRepository.create_reminder` | Bearer JWT | `{job_id, remind_at}` | `{reminder_id}` |
| **POST** | `/api/reminders/dismiss`| `handle_reminders_dismiss` | `JobRepository.dismiss_reminder` | Bearer JWT | `{reminder_id: str}` | `{dismissed: True}` |
| **POST** | `/api/saved-searches` | `handle_post_saved_searches` | `JobRepository.upsert_saved_search` | Bearer JWT | `{name, query}` | `{saved: True}` |
| **POST** | `/api/smart-applications` | `handle_smart_applications_list` | `app.get_smart_applications` | Public | Query parameters | JSON tracker apps |
| **POST** | `/api/smart-applications/add` | `handle_smart_applications_add` | `app.add_smart_application` | Public | Application payload | `{added: True}` |
| **POST** | `/api/smart-applications/add-note` | `handle_smart_applications_add_note` | `app.add_application_note` | Public | `{job_id, note}` | `{saved: True}` |
| **POST** | `/api/smart-applications/follow-ups/overdue` | `handle_smart_applications_overdue_followups` | `app.get_overdue_follow_ups` | Public | None | JSON overdue list |
| **POST** | `/api/smart-applications/follow-ups/upcoming` | `handle_smart_applications_upcoming_followups` | `app.get_upcoming_follow_ups` | Public | Query parameters | JSON upcoming list |
| **POST** | `/api/smart-applications/search` | `handle_smart_applications_search` | `app.search_smart_applications` | Public | `{term: str}` | JSON search results |
| **POST** | `/api/smart-applications/set-follow-up` | `handle_smart_applications_set_followup` | `app.set_application_follow_up` | Public | `{job_id, date}` | `{saved: True}` |
| **POST** | `/api/smart-applications/statistics` | `handle_smart_applications_statistics` | `app.get_application_statistics` | Public | None | JSON app stats |
| **POST** | `/api/smart-applications/update-status` | `handle_smart_applications_update_status` | `app.update_application_status` | Public | `{job_id, status}` | `{updated: True}` |
| **POST** | `/api/tracker/sync` | `handle_tracker_sync` | `app.sync_tracker` | Public | None | `{synced: True}` |
| **POST** | `/api/verify-jobs` | `handle_verify_jobs` | `verifier.verify_job_urls` | Public | `{urls: list}` | JSON verification map |
| **POST** | `^/api/compare/(?P<comparison_id>[^/]+)/retry$` | `handle_compare_retry` | `app.retry_compare_model` | Public | `{model: str}` | `{accepted: True}` |
| **POST** | `^/api/compare/(?P<comparison_id>[^/]+)/select$` | `handle_compare_select` | `app.select_compare_output` | Public | `{winner: str}` | `{selected: True}` |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/compare$` | `handle_job_compare` | `app.start_compare` | Public | None | `{comparison_id}` |
| **POST** | `^/api/jobs/(?P<job_id>[^/]+)/status$` | `handle_job_status` | `app.update_status` | Public | `{status: str}` | `{updated: True}` |
| **POST** | `^/api/network/contacts/(?P<contact_id>[^/]+)/delete$` | `handle_post_delete_contact` | `app.network_crm.delete_contact` | Public | None | `{deleted: True}` |
| **POST** | `^/api/network/contacts/(?P<contact_id>[^/]+)/interactions$` | `handle_network_interaction` | `app.network_crm.add_interaction` | Public | `{note: str}` | `{saved: True}` |

#### Scraper, Telemetry, Health & SSE Routes (`routes/scrape.py` — 31 Endpoints)
| Method | Path Pattern | Handler Function | Backing Domain Service | Auth Requirement | Request Payload | Response Schema |
|:---:|---|---|---|---|---|---|
| **GET** | `/api/backup/status` | `handle_backup_status` | `gcs_backup.get_backup_status` | Public | None | JSON backup timestamp |
| **GET** | `/api/digest/preview` | `handle_digest_preview` | `digest.generate_morning_digest` | Public | Query: min_score, limit | JSON digest preview |
| **GET** | `/api/health` | `handle_health` | `health.HealthCheck.check_all` | Public | None | `{status: "ok"}` |
| **GET** | `/api/metrics/hourly` | `handle_metrics_hourly` | `JobRepository.hourly_metrics` | Public | None | JSON hourly counts |
| **GET** | `/api/metrics/summary` | `handle_metrics_summary` | `JobRepository.metrics` | Public | None | JSON system KPI stats |
| **GET** | `/api/metrics/system` | `handle_metrics_system` | `system_metrics.get_system_telemetry` | Public | None | JSON CPU/RAM/Disk stats |
| **GET** | `/api/openapi.json` | `handle_openapi_spec` | `openapi.generate_openapi_spec` | Public | None | OpenAPI 3.1 JSON |
| **GET** | `/api/scrape/status` | `handle_scrape_status` | `app.scrape_coordinator.status` | Public | None | JSON scraper queue state |
| **GET** | `/api/scrape/stream` | `handle_scrape_stream` | `app.refresh` | Public | Query: terms, location | Server-Sent Events (SSE) |
| **GET** | `/api/search-criteria` | `handle_get_search_criteria` | `app.search_queries` | Public | None | JSON query keywords |
| **GET** | `/api/search-criteria/defaults` | `handle_search_criteria_defaults` | `scrape.resolve_cli_queries` | Public | None | JSON default criteria |
| **GET** | `/api/search-criteria/suggestions` | `handle_search_criteria_suggestions`| `app.suggested_search_queries` | Public | None | JSON suggested terms |
| **GET** | `/api/settings/cookies` | `handle_get_settings_cookies`| `JobRepository.get_provider_cookies` | Public | Query: provider | JSON cookie payload |
| **GET** | `/api/source-health` | `handle_source_health` | `health.HealthCheck.get_recent_checks` | Public | Query: hours | JSON health history |
| **GET** | `/api/sources/health` | `handle_sources_health` | `sources.self_healing.diagnose` | Public | None | JSON source health |
| **GET** | `/api/stats` | `handle_metrics_summary` | `JobRepository.metrics` | Public | None | JSON stats summary |
| **GET** | `/api/telemetry/status` | `handle_telemetry_status` | `JobRepository.get_provider_cookies` | Public | None | JSON telemetry status |
| **GET** | `/health` | `handle_health` | `health.HealthCheck.check_all` | Public | None | `{status: "ok"}` |
| **GET** | `/metrics` | `handle_metrics` | `metrics.get_metrics` | Public | None | Prometheus text format |
| **POST** | `/api/backup/snapshot` | `handle_backup_snapshot` | `gcs_backup.create_backup_snapshot` | Public | `{snapshot_tag: str}` | `{snapshot_path}` |
| **POST** | `/api/digest/dispatch` | `handle_digest_dispatch` | `digest.generate_morning_digest` | Public | `{webhook_url, limit}` | `{dispatched: True}` |
| **POST** | `/api/refresh` | `handle_scrape_refresh` | `app.refresh` | Public | `{queries: list}` | `{status, job_count}` |
| **POST** | `/api/scrape` | `handle_scrape_refresh` | `app.refresh` | Public | `{queries: list}` | `{status, job_count}` |
| **POST** | `/api/scrape/stream` | `handle_scrape_stream` | `app.refresh` | Public | `{queries: list}` | Server-Sent Events (SSE) |
| **POST** | `/api/search-criteria` | `handle_post_search_criteria` | `app.update_search_queries` | Public | `{queries: list}` | `{saved: True}` |
| **POST** | `/api/settings/cookies`| `handle_post_settings_cookies`| `JobRepository.set_provider_cookies` | Public | `{provider, cookies}` | `{saved: True}` |
| **POST** | `/api/sources/apply-patch` | `handle_sources_apply_patch` | `sources.self_healing.apply_patch` | Public | `{source, patch}` | `{applied: True}` |
| **POST** | `/api/sources/diagnose` | `handle_sources_diagnose` | `sources.self_healing.diagnose_source`| Public | `{source: str}` | JSON diagnostic probe |
| **POST** | `/api/sources/heal` | `handle_sources_remediate` | `sources.self_healing.remediate_runtime`| Public | `{source, diagnosis}` | JSON remediation step |
| **POST** | `/api/sources/llm-repair-context` | `handle_sources_repair_context` | `sources.self_healing.generate_repair` | Public | `{source, error}` | JSON prompt context |
| **POST** | `/api/sources/remediate` | `handle_sources_remediate` | `sources.self_healing.remediate_runtime`| Public | `{source, diagnosis}` | JSON remediation step |

---

### 2.3 Strangler Fig Assessment & Legacy Handler Fallbacks Analysis

#### Strangler Fig Extraction Status: Functionally Extracted, Structurally Incomplete
The Strangler Fig refactoring was initiated to de-monolithify `web.py` without risking regression across existing production deployments and test harnesses.

1. **Traffic Interception (100% Coverage)**:
   In `backend/src/job_dashboard/web.py`, `app_router.dispatch(self, method, path)` is invoked at the very top of each HTTP verb method on `Handler(BaseHTTPRequestHandler)`:
   - Line 2463 (`do_GET`): `if app_router.dispatch(self, "GET", path): return`
   - Line 3936 (`do_POST`): `if app_router.dispatch(self, "POST", path): return`
   - Line 6753 (`do_DELETE`): `if app_router.dispatch(self, "DELETE", path): return`
   
   Because all 189 valid API routes are registered on `app_router`, `app_router.dispatch()` returns `True` for every incoming HTTP request. **Zero production traffic ever falls through to the legacy procedural code.**

2. **The 4,281-Line Dead Code Burden**:
   Despite 100% of requests being intercepted by `app_router`, the legacy procedural `if/elif` blocks were retained verbatim inside `web.py`:
   - `do_GET` legacy fallback (lines 2466–3929): **1,463 lines**
   - `do_POST` legacy fallback (lines 3939–6746): **2,807 lines**
   - `do_DELETE` legacy fallback (lines 6755–6780): **25 lines**
   - **Total Dead Code**: **4,281 lines** (representing 63.1% of `web.py`'s 6,782 total lines).

3. **Comparison Matrix: Modular Routes vs Legacy Fallback**:
   | Attribute | Modular Router (`routes/`) | Legacy Fallback (`web.py`) | Status |
   |---|:---:|:---:|---|
   | **File Count** | 5 domain files | 1 file (`web.py`) | Modular routes segregated by domain |
   | **Total Lines** | 4,117 lines | 4,281 lines | Legacy mirrors ~98% of modular route logic |
   | **Execution Engine** | `app_router.dispatch()` | Procedural `if/elif` chains | Dispatch uses $O(1)$ dictionary lookup + compiled regex |
   | **Route Count** | 189 decorators | 187 if/elif branches | 100% of legacy routes have modular counterparts |
   | **Runtime Execution**| **100% Live Traffic** | **0% Live Traffic** | **Dead code** during standard operation |

4. **Why the Legacy Code Can Be Safely Excised**:
   - The test suite contains 139 mock-handler tests across 24 test files that invoke `handler.do_GET()` or `handler.do_POST()`.
   - When a test invokes `handler.do_GET()`, execution hits `if app_router.dispatch(self, "GET", path): return` first.
   - Because `app_router` contains all routes, the mock handler tests already execute the modular code in `routes/`.
   - Deleting lines 2466–3929, 3939–6746, and 6755–6780 immediately reduces `web.py` from 6,782 lines to ~2,500 lines without breaking a single test.

5. **The FastAPI Shadow Prototype Divergence**:
   - A parallel FastAPI implementation was created in `fastapi_app.py` (271 lines) and `routers/*.py` (702 lines).
   - This prototype declares **only 32 endpoints**, leaving 157 endpoints (~83% of the API surface) unimplemented. It lacks all 66 generative AI endpoints and all 31 scraper/resilience endpoints.
   - It is **not wired into production**: `deploy-cloudrun.sh` and `Dockerfile` execute `python -m job_dashboard.run_server`, which starts `web.py`'s `ThreadingHTTPServer`.
   - Maintaining this shadow layer creates confusion and technical debt. It should be removed to solidify the single source of truth.

---

### 2.4 Frontend Architecture & Component Inventory (77 Components)
The frontend comprises **77 React component files** totaling **34,614 lines of code** (`wc -l` verified, excluding `__tests__`).

#### 1. Top-Level Views & Dashboard Cockpit (21 files, 11,268 lines)
| Component File | Lines | Primary Role | State Management | Intelligence & Tools | Fallback & Skeletons |
|---|:---:|---|---|---|---|
| `components/Dashboard.jsx` | 1,487 | Central operations cockpit; coordinates views, navigation drawer, and modal triggers. | `useJobs`, `useDashboardState`, `useScrapeOrchestrator`, local `useState` | Background Autopilot agent, async doc queue | Wrapped in `SafeErrorBoundary`; `DashboardGridSkeleton` loader |
| `components/JobSeeker.jsx` | 1,972 | Main discovery feed; full-text search, stream tabs, facet filters, job cards. | 25+ local `useState`, `useMemo` for filtering, `useToast` | Match score ranking, commute distance, role clustering | Empty state illustration, debounced search (`useDeferredValue`) |
| `components/ActionHighlights.jsx` | 225 | Prioritized action items queue; urgent follow-ups, pending submissions. | Local `useState`, props from Dashboard | Interview readiness checks, executive dossier shortcuts | `SafeErrorBoundary` wrapper; empty state placeholder |
| `components/ApplicationPipeline.jsx` | 351 | Kanban / pipeline tracker; 6 drag-and-drop columns (`Discovered` to `Offer`). | `@dnd-kit/core` droppable, `useURLState`, local `useState` | Transition audit logging, CSV/JSON data export/import | `KanbanColumnSkeleton`, `TableSkeleton`, `EmptyState` |
| `components/KanbanColumn.jsx` | 212 | Droppable column container for Kanban board with card count badge. | `@dnd-kit/core` droppable, props | Status color mappings, action shortcuts per card | Empty column drop target styling |
| `components/PipelineTableView.jsx` | 155 | Tabular view for pipeline tracking with sortable headers. | Local `useState` (sort column, direction) | Status badges, date formatting, drawer links | Empty table state |
| `components/RemoteRolesSection.jsx` | 331 | Remote and hybrid opportunities hub. | Local `useState`, `useMemo` | Remote policy tags, timezone alignment checks | Lazy-loaded with `Suspense` and `DashboardGridSkeleton` |
| `components/MarketIntelligence.jsx` | 134 | Macro market intelligence panel; salary distributions, hiring velocity. | Props-driven (`jobs`), `useMemo` | Aggregates skill frequencies and salary averages | Graceful fallback when job pool is empty |
| `components/AnalyticsDashboard.jsx` | 463 | Funnel analytics dashboard with interactive charts (`recharts`). | Local `useState`, `useMemo` | Stage drop-off analysis, days-per-stage calculation | Graceful zero-state handling for chart containers |
| `components/CareerOperations.jsx` | 106 | Strategic operations console; reminders, saved searches, scraper health. | Local `useState`, `useEffect` | Career operations REST service | Loading indicator; error catch block |
| `components/TelemetryDesk.jsx` | 162 | Real-time scraper telemetry and engine diagnostics console. | Local `useState`, polling `/api/metrics/summary` | Ingestion rates, source latency, SQLite WAL metrics | Offline indicator if metric endpoint fails |
| `components/MonolithMode.jsx` | 832 | High-density keyboard-driven terminal view for power users. | Local `useState`, keyboard event listeners | Keyboard shortcuts (`j/k`, Enter, Space, `g`), inline AI trigger | High-contrast terminal error display |
| `components/CyberpunkAmbientMode.jsx` | 497 | Audio-reactive ambient visualization with generative soundscapes. | Local `useState`, Web Audio API refs | Web Audio procedural synthesis (`ambientAudioEngine.js`) | Fallback for browsers lacking Web Audio API support |
| `components/ZenAutopilotDashboard.jsx`| 574 | Autonomous background agent dashboard; auto-scraped jobs, queued docs. | Local `useState`, `useEffect` | Autopilot agent control (`startAutopilot`, `pauseAutopilot`) | Empty task queue state; pause/resume safeguards |
| `components/PrimeTargetSpotlight.jsx` | 420 | High-scoring job spotlight card (>85% match score). | Local `useState` | Deep match rationale extraction, commute badge | Auto-hides if no high-score matches exist |
| `components/TopMatchesSidebar.jsx` | 835 | Collapsible right-hand drawer surfacing top percentile roles. | Local `useState`, `useMemo` | Percentile ranking, 1-click tailored resume trigger | Skeleton loader during job calculation |
| `components/CopilotBar.jsx` | 70 | Pinned quick-intelligence copilot bar surfacing proactive suggestions. | Props-driven (`jobs`, callbacks) | Dynamic recommendations based on application recency | Renders null if no recommendation exists |
| `components/MetricsPanel.jsx` | 328 | Top-level KPI panel; applications sent, conversion rate, offers. | `useMemo` computed from jobs collection | Statistical conversion metrics, trajectory indicators | Fallback values (0 / 0%) when jobs array is empty |
| `components/RoleFilterBar.jsx` | 458 | Facet filter toolbar; keyword search, seniority, salary, work mode. | Local `useState`, props | Dynamic role clustering, salary threshold comparison | Reset filters button; keyboard accessible |
| `components/ProfileSwitcher.jsx` | 163 | Top navigation dropdown for instant candidate persona switching. | Local `useState`, `profileStorage` | Candidate persona switching, industry theme alignment | Click-outside handler; fallback to generic profile |
| `components/JobDrawer.jsx` | 468 | Slide-out drawer alternative to JobModal for desktop side-by-side view. | Local `useState`, props | Clean description renderer, commute calculation | Slide-in animation, escape key listener |
| `components/SiteGate.jsx` | 647 | Master access wall, PIN code lock, and developer auth override gate. | Local `useState`, `localStorage` | Passkey authentication, SHA-256 PIN hashing | Offline unlock fallback with developer master key |
| `components/OnboardingFlow.jsx` | 1,048 | 6-step candidate onboarding wizard configuring identity and preferences. | Local `useState`, `useEffect` | AI resume parsing (`parseResumeWithAI`), LLM ping test | Client-side heuristic parser fallback if AI parse fails |

#### 2. Modal Dialogs & Intelligence Hubs (34 files, 17,993 lines)
| Modal Component File | Lines | Primary Role | State Management | Intelligence & Backend Integration | Fallback / Skeletons |
|---|:---:|---|---|---|---|
| `components/dashboard/DashboardModals.jsx` | 694 | Master container component encapsulating 34 lazy-loaded modals. | Receives `modalState` prop object | Coordinates domain handlers and profile services | Wrapped in `<SafeErrorBoundary>` and `<Suspense fallback={<ModalSkeleton />}>` |
| `components/JobModal.jsx` | 992 | Full-screen deep-dive job inspector featuring 5 modular tabs. | Local `useState`, `useMemo` | Fit breakdown, commute calculator, ATS docx export | Lazy-loads `PsychologyDecoderModal` and `InterviewCheatSheetModal` |
| `components/job-modal/JobAssetsTab.jsx` | 736 | Sub-tab for tailoring, editing, and downloading resumes/cover letters. | Local `useState` | Calls `generateApplicationDocs`, ATS docx export | Client-side document synthesis fallback |
| `components/job-modal/JobDescriptionTab.jsx` | 184 | Sub-tab displaying cleaned job descriptions with HTML decoding. | Local `useState`, props | Calls `GET /api/job-description` | Fallback to raw job snippet if backend fetch fails |
| `components/job-modal/JobFitTab.jsx` | 421 | Sub-tab breaking down match score (semantic density, recency, fit). | `useMemo` calculated scores | Commute details (`commuteService`), keyword pros/cons | Default scores if job lacks structured audit data |
| `components/job-modal/JobNotesTab.jsx` | 98 | Sub-tab for private candidate notes, interview logs, referral data. | Local `useState` | Persists notes via `POST /api/applications` | Local state persistence if backend call fails |
| `components/job-modal/JobOfferTab.jsx` | 272 | Sub-tab for offer evaluation, due diligence, counter-offer letters. | Local `useState` | Contract risk evaluation (`offerService`) | Pre-canned counter-offer templates |
| `components/GeneratorModal.jsx` | 1,103 | Standalone document synthesis cockpit; fine-tune LLM model and tone. | Local `useState` | Direct LLM invocation, backend storage (`POST /api/documents`) | Client-side template generator fallback |
| `components/AutoApplyModal.jsx` | 385 | Autonomous application executor; parses requirements, auto-fills. | Local `useState` | Connects to `POST /api/auto-apply/start` | Client-side Fast-Track dispatcher (clipboard injection + URL open) |
| `components/BatchApplyModal.jsx` | 405 | Concurrency dispatcher generating packages for up to 10 jobs. | Local `useState` | Sequential async `generateApplicationDocs` with delay | Individual job error isolation |
| `components/CustomJobModal.jsx` | 362 | Ingestion modal allowing users to paste URL/raw text from unlisted jobs. | Local `useState` | Scrapes external job via `GET /api/job-description` | Manual field entry fallback |
| `components/CommandPalette.jsx` | 179 | Omni-navigation modal (`Cmd+K`) for fuzzy search over jobs and tools. | Local `useState`, `useEffect` | Quick job search and modal opening shortcut dispatcher | Empty results message; keyboard navigation |
| `components/ProfileModal.jsx` | 1,216 | Candidate profile editor; skills, titles, contact details, PDF upload. | Local `useState` | PDF extraction, AI profile parsing | Client-side regex parser fallback; JSON export |
| `components/AuthModal.jsx` | 411 | Authentication modal; Google OAuth, email login, passkeys. | Local `useState` | Calls `authService.js` (`/api/login`, `/api/register`) | Demo persona quick-login; clear session reset |
| `components/GoogleWorkspaceModal.jsx` | 636 | Google Workspace hub (Gmail scanner, Sheets tracker, Drive export). | Local `useState` | Gmail API, Google Sheets API, Google Drive folders | Fallback to manual CSV export |
| `components/GoogleIntegrationModal.jsx` | 11 | Compatibility wrapper around `GoogleWorkspaceModal` (tab="sheet"). | Props passed through | Wraps `GoogleWorkspaceModal` | Inherits parent fallback |
| `components/GooglePromptModal.jsx` | 11 | Compatibility wrapper around `GoogleWorkspaceModal` (tab="setup"). | Props passed through | Wraps `GoogleWorkspaceModal` | Inherits parent fallback |
| `components/SettingsModal.jsx` | 1,162 | Settings modal; configures LLM providers (OpenRouter, OpenAI, Gemini). | Local `useState` | `llmConfig.js` (connection testing, model fetching) | Offline connection verification; default models |
| `components/FollowUpEmailModal.jsx` | 171 | Contextual email composer for recruiter check-ins and thank-you notes. | Local `useState` | Contextual template generator (`trackerService.js`) | Clipboard copy fallback; mailto: links |
| `components/OfferActionHubModal.jsx` | 557 | Offer compensation analysis, equity valuation, contract risk scanner. | Local `useState` | Contract risk scanner (`POST /api/contracts/scan-risks`) | Local rule-based contract clause analyzer |
| `components/ExecutiveDossierModal.jsx` | 555 | Executive briefing generating company profile and culture signals. | Local `useState` | Executive dossier API (`POST /api/dossier/generate`) | Local intelligence synthesis using archetypes |
| `components/RecruiterRelationshipModal.jsx` | 975 | Recruiter CRM managing interaction history, cadence radar, follow-ups. | Local `useState` | Connects to `/api/network/contacts` and `/api/network/cadence` | LocalStorage fallback (`job_dashboard_recruiter_contacts`) |
| `components/FunnelIntelligenceModal.jsx` | 596 | Pipeline velocity analytics; detects bottlenecks and drop-offs. | Local `useState` | Funnel intelligence API (`POST /api/analytics/funnel`) | Local pipeline metrics calculation |
| `components/CareerMatrixModal.jsx` | 484 | Career vector compass mapping skill gaps towards Lead/Director levels. | Local `useState` | Career roadmap API (`POST /api/career/roadmap`) | Local career matrix generator |
| `components/WorkforceAustraliaModal.jsx` | 433 | Australian Workforce Australia PBAS point tracker and compliance report. | Local `useState` | PBAS calculation rules (`workforceAustraliaService.js`) | Local calculation adhering to 2026 PBAS rules |
| `components/InterviewCheatSheetModal.jsx` | 542 | 1-page interview cheat sheet with talking points and STAR answers. | Local `useState` | Cheat sheet generation service | Pre-rendered cheat sheet templates |
| `components/InterviewInfluenceModal.jsx` | 478 | Post-interview tactical debrief hub; power questions and follow-ups. | Local `useState` | Debrief API (`/api/interview-debrief`) | Local debrief guide synthesis |
| `components/InterviewSuiteModal.jsx` | 704 | Unified interview cockpit; simulator, prep questions, decoding. | Local `useState` | Connects to `interviewGuidePrompt.js`, `psychologyService.js` | Client-side interview question generator fallback |
| `components/InterviewPrepModal.jsx` | 6 | Compatibility wrapper around `InterviewSuiteModal` (tab="prep"). | Props passed through | Wraps `InterviewSuiteModal` | Inherits parent fallback |
| `components/MockInterviewModal.jsx` | 6 | Compatibility wrapper around `InterviewSuiteModal` (tab="simulator"). | Props passed through | Wraps `InterviewSuiteModal` | Inherits parent fallback |
| `components/PsychologyDecoderModal.jsx` | 6 | Compatibility wrapper around `InterviewSuiteModal` (tab="psychology"). | Props passed through | Wraps `InterviewSuiteModal` | Inherits parent fallback |
| `components/VoiceMockInterviewModal.jsx`| 508 | Speech-driven mock interview simulator using Web Speech API. | Local `useState` | Web Speech API wrapper (`voiceInterviewService.js`) | Text-based fallback when microphone is unavailable |
| `components/AtsDiagnosticModal.jsx` | 406 | Deep ATS audit; keyword match percentage, formatting penalties. | Local `useState` | Backend ATS diagnostic endpoint (`POST /api/ats-diagnostic`) | Client-side parsing fallback using `atsAuditParser.js` |
| `components/LinkedInInboundModal.jsx` | 523 | Recruiter Boolean search generator and LinkedIn profile optimizer. | Local `useState` | Inbound sourcing service (`/api/inbound-sourcing/*`) | Local Boolean query builder with syntax highlights |
| `components/CoverLetterPolarizerModal.jsx` | 486 | Anti-template cover letter polarizer; audits drafts for cliché fluff. | Local `useState` | Polarizer API (`/api/cover-letter/*`) | Local NLP heuristic auditor (`auditCoverLetterLocally`) |
| `components/ScreeningSolverModal.jsx` | 527 | Application friction solver; generates STAR-formatted answers. | Local `useState` | Screening solver API (`/api/screening/solve`) | Local heuristic answer generator |
| `components/KscGeneratorModal.jsx` | 525 | Australian Public Service (APS) Key Selection Criteria generator. | Local `useState` | KSC API (`/api/ksc/*`) | Local APS criteria extraction with SAO structuring |
| `components/SeekPassModal.jsx` | 413 | SEEK Pass verified credentials auditor; checks mandatory certs. | Local `useState` | SEEK Pass API (`/api/seek-pass/audit`) | Local credential checker (AHPRA, WWCC, Driver License) |
| `components/SkillGapModal.jsx` | 169 | Comparative market skill gap analyzer across all active jobs. | `useMemo` calculated | Skill gap extraction logic (`generationService.js`) | Renders empty state if skills match all requirements |
| `components/JobCompareModal.jsx` | 161 | Side-by-side comparison modal analyzing two jobs across salary/commute. | Props-driven | Salary comparison (`salaryUtils.js`), commute service | Fallback to single card if one job selected |
| `components/PdfPreviewModal.jsx` | 325 | Interactive visual ATS resume previewer with template styling. | Local `useState` | PDF template engine (`pdfTemplateService.js`), `jspdf` | Preview iframe loader; fallback download as text |
| `components/ScoringTunerModal.jsx` | 256 | Weight tuning modal with sliders for 5 ranking dimensions. | Local `useState` | Web Worker re-scoring (`scoreWorker.js`), `/api/preferences` | Synchronous calculation fallback |
| `components/SourceSelfHealModal.jsx` | 587 | Scraper health monitor; diagnoses HTTP 403s/429s and generates patches. | Local `useState` | Source healing API (`/api/sources/*`) | Local simulated diagnosis and repair guidance |
| `components/PricingModal.jsx` | 319 | Subscription tiers and API key modal; prompts Pro upgrade or BYO key. | Local `useState` | Billing service (`/api/billing/create-checkout-session`) | Redirect to SettingsModal for BYO API key |
| `components/ImportPreviewModal.jsx` | 74 | Modal confirmation dialog verifying CSV/JSON data before merging. | Local `useState` | Data portability parser (`DataPortability.js`) | Shows parse warnings and skips malformed rows |

#### 3. Subcomponents, UI Primitives & Error Boundaries (22 files, 5,353 lines)
| Component File | Lines | Primary Role | Key Details |
|---|:---:|---|---|
| `components/onboarding/StepAuth.jsx` | 418 | Authentication step for onboarding wizard. | Email/Password, Passkey, Google OAuth, Demo Persona |
| `components/onboarding/StepAiConfig.jsx` | 296 | LLM setup step for onboarding wizard. | Provider selector (OpenRouter, Gemini, OpenAI), ping test |
| `components/onboarding/StepIndustry.jsx` | 159 | Sector selection step for onboarding wizard. | Visual cards for Tech, Healthcare, Finance, Trades, Gov |
| `components/onboarding/StepRolesSkills.jsx` | 282 | Role targeting step for onboarding wizard. | Target job titles, skill tags, custom title input pills |
| `components/onboarding/StepPreferences.jsx` | 192 | Candidate preferences step for onboarding wizard. | Salary floor slider, work arrangement pills, postcode |
| `components/onboarding/StepReviewLaunch.jsx`| 246 | Final review step for onboarding wizard. | Candidate dossier summary card, launch discovery button |
| `components/ui/Button.jsx` | 56 | Design system button primitive. | Variants (`primary`, `secondary`, `outline`, `ghost`, `danger`) |
| `components/ui/Badge.jsx` | 41 | Design system generic badge primitive. | Variants (`cyan`, `emerald`, `indigo`, `amber`, `rose`, `teal`) |
| `components/ui/Card.jsx` | 35 | Design system card container. | Glassmorphic background styling, borders, hover effects |
| `components/ui/Modal.jsx` | 130 | Design system base modal dialog primitive. | Backdrop blur, escape key handling, body scroll locking |
| `components/ui/Tabs.jsx` | 53 | Design system tab navigation primitive. | Tab list, tab buttons with active indicator pills |
| `components/ui/EmptyState.jsx` | 40 | Design system zero-state block. | Icon container, title, description, call-to-action button |
| `components/ui/index.js` | 6 | UI primitives barrel export. | Exports `Button`, `Badge`, `Card`, `Modal`, `Tabs` |
| `components/Badge.jsx` | 17 | Specialized job status badge. | Maps status string to color dot via `getStatusConfig` |
| `components/ErrorBoundary.jsx` | 70 | Top-level React error boundary. | Class component catching uncaught rendering errors |
| `components/SafeErrorBoundary.jsx` | 90 | Granular error boundary for dashboard sections. | Isolates section crashes; includes retry button |
| `components/SkeletonLoaders.jsx` | 105 | Reusable skeleton loading placeholders. | `JobCardSkeleton`, `DashboardGridSkeleton`, `ModalSkeleton` |
| `components/ToastContext.jsx` | 84 | Toast notification provider & hook. | `ToastProvider` and `useToast` (`addToast`, `removeToast`) |

---

### 2.5 Frontend Services & API Layer (60 Modules)
The frontend services layer comprises **60 JavaScript files** totaling **19,917 lines of code** (`frontend/src/services/` and `frontend/src/api/`).

#### 1. Core Data, Query, and Ingestion Services
| Service File | Lines | Exported Functions | Backend Endpoints Called | Offline / Fallback Behavior |
|---|:---:|---|---|---|
| `services/dataService.js` | 864 | `fetchJobsData`, `fetchDetailedJobDescription`, `saveUserApplication`, `calculateCandidateMatchScore` | `GET /api/jobs`, `GET /api/applications`, `POST /api/applications`, `GET /api/job-description`, `POST /api/export-ats-resume` | Falls back to static `MULTI_INDUSTRY_JOBS` catalog if backend fails. Applications saved to `localStorage` before network POST. |
| `services/jobQueryService.js` | 468 | `buildQueriesFromProfile`, `pushQueriesToBackend`, `triggerProfileScrape`, `syncJobSearchState` | `POST /api/search-criteria`, `POST /api/refresh`, `GET /health` | Strict 12-hour TTL cache checks. Falls back to local database match queries if scraper backend fails. |
| `services/trackerService.js` | 427 | `getApplicationWorkflow`, `generateFollowUpEmail`, `saveUserApplicationToBackend`, `syncApplicationsToBackend` | `POST /api/applications`, `POST /api/applications/sync`, `GET /api/applications`, `POST /api/applications/scan-updates` | Synchronous dual-write: writes to `localStorage` first, then syncs to backend; catches network failures cleanly. |
| `services/apiConfig.js` | 24 | `getBackendApiBase`, `API_BASE` | None (resolver utility) | Checks `__API_BASE_URL__`, falls back to `origin`, `127.0.0.1:8787`, or Cloud Run URL. |
| `api/client.js` | 72 | `getAuthToken`, `ApiError`, `apiRequest` | Generic fetch client | Injects `Authorization: Bearer <token>`; parses responses; throws structured `ApiError`. |
| `api/jobsApi.js` | 78 | `getJobs`, `getSearchCriteria`, `triggerRefresh`, `verifyJobUrl`, `verifyJobs`, `getMetricsSummary` | `GET /api/jobs`, `GET /api/search-criteria`, `POST /api/refresh`, `GET /api/verify-job-url`, `POST /api/verify-jobs` | Delegates to `apiRequest`; propagates structured errors. |
| `api/applicationsApi.js` | 51 | `getApplications`, `saveApplication`, `syncApplications`, `scanUpdates` | `GET /api/applications`, `POST /api/applications`, `POST /api/applications/sync`, `POST /api/applications/scan-updates` | Delegates to `apiRequest`. |
| `api/authApi.js` | 55 | `checkSession`, `login`, `register`, `googleLogin`, `passkeyLogin` | `GET /api/session`, `POST /api/login`, `POST /api/register`, `POST /api/google-login`, `POST /api/passkey-login` | Delegates to `apiRequest`. |
| `api/profileApi.js` | 48 | `getProfile`, `saveProfile`, `getPreferences`, `savePreferences` | `GET /api/profile`, `POST /api/profile`, `GET /api/preferences`, `POST /api/preferences` | Delegates to `apiRequest`. |

#### 2. Authentication, Session & Cloud Integration Services
| Service File | Lines | Exported Functions | Backend Endpoints Called | Offline / Fallback Behavior |
|---|:---:|---|---|---|
| `services/authService.js` | 468 | `validateSession`, `loginWithEmail`, `registerWithEmail`, `linkGoogleAccount`, `loginWithDemoPersona` | `GET /api/session`, `POST /api/login`, `POST /api/register`, `POST /api/verify-email`, `POST /api/link-google` | Validates session with server; falls back to local JWT payload; provides offline demo personas. |
| `services/passkeyService.js` | 261 | `isPasskeySupported`, `registerBrowserPasskey`, `loginWithBrowserPasskey` | `POST /api/passkey-setup`, `POST /api/passkey-login` | Uses WebAuthn API; falls back to simulated passkey registration if platform authenticator is missing. |
| `services/googleAuthService.js` | 419 | `initGoogleAuth`, `loginWithGoogle`, `getAuthenticatedUser`, `verifyGoogleTokenWithBackend` | Google OAuth2 userinfo, `POST /api/google-login` | Wraps Google Identity Services (GIS); falls back to client-side token caching. |
| `services/googleSheetService.js` | 261 | `createApplicationsSheet`, `syncApplicationsToSheet`, `fetchApplicationsFromSheet` | Google Sheets REST API | Auto-creates headers; formats currency and dates; throws clear auth expiry messages. |
| `services/gmailSyncService.js` | 537 | `scanGmailForInterviews`, `extractInterviewDetailsFromMessage` | Google Gmail REST API | Scans message snippets using regex patterns for interview keywords; handles rate limits. |
| `services/billingService.js` | 208 | `fetchBillingStatus`, `createCheckoutSession`, `openCustomerPortal`, `callAiProxy` | `GET /api/billing/status`, `POST /api/billing/create-checkout-session`, `POST /api/billing/customer-portal` | Caches billing status in `localStorage`; falls back to default free tier (20 daily generations). |

#### 3. Intelligence, Document Generation & LLM Services
| Service File | Lines | Exported Functions | Backend Endpoints Called | Offline / Fallback Behavior |
|---|:---:|---|---|---|
| `services/generationService.js` | 980 | `generateApplicationDocs`, `saveDocumentToBackend`, `fetchDocumentFromBackend`, `generateClientSideTailoredDocs` | `POST /api/documents`, `GET /api/documents`, direct OpenRouter / OpenAI endpoints | When API key is absent or network fails, falls back completely to `generateClientSideTailoredDocs`. |
| `services/jobIntelligenceService.js` | 798 | `hasJobIntelligence`, `getJobIntelligence`, `saveJobIntelligence`, `runJobIntelligenceTool` | `POST /api/job-intelligence`, `POST /api/ai/proxy` | Coordinates 12 intelligence tools; falls back to local heuristic synthesis per tool. |
| `services/llmConfig.js` | 590 | `getLlmConfig`, `saveLlmConfig`, `fetchOpenRouterModels`, `testLlmConnection` | OpenRouter model API, provider ping endpoints | Caches fetched model list; returns curated default models if remote endpoint times out. |
| `services/llmCostService.js` | 300 | `calculateCost`, `recordTokenUsage`, `getSpendSummary`, `resetSpendHistory` | None (client-side cost accounting) | Calculates prompt/completion token pricing for 20+ models; stores in `localStorage`. |
| `services/autoApplyService.js` | 322 | `startBackendAutoApply`, `pollBackendAutoApplyStatus`, `executeFastTrackApply` | `POST /api/auto-apply/start`, `GET /api/auto-apply/:taskId/status` | If backend Playwright container fails, switches to Fast-Track client apply. |
| `services/autopilotAgent.js` | 271 | `startAutopilot`, `pauseAutopilot`, `resumeAutopilot`, `getAutopilotState` | None (client-side background loop) | Periodic background evaluation of discovered jobs; respects throttling intervals. |
| `services/atsDiagnosticService.js` | 215 | `runAtsDiagnostic`, `calculateAtsScoreLocally` | `POST /api/ats-diagnostic` | Falls back to `parsers/atsAuditParser.js` for regex-based client-side scoring. |
| `services/coverLetterPolarizerService.js` | 365 | `auditCoverLetter`, `polarizeCoverLetter`, `auditCoverLetterLocally` | `POST /api/cover-letter/audit`, `POST /api/cover-letter/polarize` | Falls back to local NLP heuristics (`auditCoverLetterLocally`) detecting clichés and fluff. |
| `services/screeningSolverService.js` | 372 | `getScreeningSolutions`, `solveScreeningQuestions`, `solveScreeningQuestionsLocally` | `GET /api/jobs/:id/screening-solutions`, `POST /api/screening/solve` | Falls back to local STAR answer synthesis using active candidate profile details. |
| `services/kscService.js` | 313 | `getJobKscCriteria`, `generateKscStatement`, `extractKscCriteriaLocally` | `GET /api/jobs/:id/ksc`, `POST /api/ksc/generate` | Falls back to local APS capability statement generation using Situation-Action-Outcome framework. |
| `services/seekPassService.js` | 358 | `getJobSeekPassRequirements`, `auditSeekPassCredentials`, `auditSeekPassLocally` | `GET /api/jobs/:id/seek-pass`, `POST /api/seek-pass/audit` | Checks Australian working rights, police check, WWCC, and AHPRA registration locally. |
| `services/dossierService.js` | 572 | `generateExecutiveDossier`, `generateLocalExecutiveDossier` | `POST /api/dossier/generate` | Generates structured company briefing from company name, sector, and notes if LLM call fails. |
| `services/offerService.js` | 425 | `scanContractRisks`, `scanContractRisksLocally`, `generateCounterOfferDraft` | `POST /api/contracts/scan-risks` | Scans probation, non-competes, and IP assignment using local regex heuristics. |
| `services/interviewCheatSheetService.js` | 1,407 | `generateInterviewCheatSheet`, `getCheatSheetTemplates`, `formatCheatSheetHtml` | None (client-side knowledge engine) | Generates company-specific talking points and reverse questions from curated templates. |
| `services/interviewInfluenceService.js` | 242 | `fetchInterviewDebrief`, `saveInterviewDebrief`, `generateInfluenceStrategy` | `GET /api/interview-debrief`, `POST /api/interview-debrief` | Local debrief synthesis with psychological power questions and follow-up drafts. |
| `services/psychologyService.js` | 199 | `decodeJobPsychology`, `saveJobPsychology`, `decodePsychologyLocally` | `POST /api/psychology`, `GET /api/psychology` | Maps JD linguistic markers to company cultural archetypes and leadership styles. |
| `services/inboundSourcingService.js` | 465 | `auditLinkedInOptimization`, `generateRecruiterSearchQueries` | `POST /api/inbound-sourcing/audit`, `POST /api/inbound-sourcing/test-query` | Local Boolean query builder with Google/LinkedIn X-ray syntax generation. |
| `services/careerMatrixService.js` | 340 | `fetchCareerRoadmap`, `generateLocalCareerMatrix` | `POST /api/career/roadmap` | Fallback generates multi-tier skill vectors and milestones across 5 seniority levels. |
| `services/recruiterCrmService.js` | 293 | `fetchRecruiterContacts`, `fetchCadenceRadar`, `saveRecruiterContact`, `deleteRecruiterContact` | `GET /api/network/contacts`, `GET /api/network/cadence`, `POST /api/network/contacts` | LocalStorage fallback (`job_dashboard_recruiter_contacts`) when backend network fails. |
| `services/funnelAnalyticsService.js` | 351 | `fetchFunnelAnalytics`, `calculateFunnelMetrics` | `POST /api/analytics/funnel` | Calculates stage drop-off and velocity locally from jobs array. |
| `services/workforceAustraliaService.js`| 248 | `calculateJobPbasPoints`, `calculatePeriodPbasTotal`, `getWorkforceSettings` | None (client-side calculation) | Implements official PBAS point rules (5 points/job application, 10 points/interview). |
| `services/voiceInterviewService.js` | 374 | `isVoiceSupported`, `createVoiceSession`, `speakText`, `stopSpeaking` | Web Speech API | Checks browser Web Speech API availability; provides text-mode fallback. |
| `services/sourceHealingService.js` | 381 | `fetchSourcesHealth`, `diagnoseSourceFailure`, `remediateSourceFailure`, `applySourcePatch` | `GET /api/sources/health`, `POST /api/sources/diagnose`, `POST /api/sources/remediate` | Simulates diagnostics and provides selector remediation instructions if backend is offline. |
| `services/careerOperationsService.js` | 24 | `getSavedSearches`, `saveSearch`, `getReminders`, `createReminder`, `dismissReminder` | `GET /api/saved-searches`, `POST /api/saved-searches`, `GET /api/reminders` | Wraps career operations REST endpoints; handles bearer authorization. |
| `services/verificationService.js` | 144 | `verifyJobUrlLiveness`, `batchVerifyJobs` | `GET /api/verify-job-url`, `POST /api/verify-jobs` | Validates HTTP status and URL patterns; caches verified states locally for 7 days. |

#### 4. Parsers, Profiles, Prompts & Utilities
| Service File | Lines | Primary Responsibility | Description |
|---|:---:|---|---|
| `services/parsers/resumeParser.js` | 332 | AI and heuristic resume parsing | Extracts contact info, titles, and skills; regex fallback |
| `services/parsers/atsAuditParser.js` | 309 | Client-side ATS audit parser | Pure regex and NLP token parser calculating semantic density and formatting penalties |
| `services/parsers/multiIndustryParserConfig.js` | 134 | Industry keyword dictionaries | Keywords covering Tech, Healthcare, Finance, Trades, Education, Retail |
| `services/profiles/profileStorage.js` | 309 | Dual-indexed profile persistence | Syncs across `localStorage` and backend SQLite (`/api/profile`) with LWW timestamps |
| `services/profiles/profileTemplates.js` | 424 | Curated candidate profiles | Pre-configured candidate profiles across 7 industry sectors |
| `services/profiles/profileCompleteness.js` | 148 | Completeness scoring formula | Evaluates profile completeness (0-100%) and returns prioritized boost recommendations |
| `services/profileService.js` | 69 | Profile facade barrel | Central export point for profile operations |
| `services/profileLearningEngine.js` | 260 | Heuristic profile learning | Evolve candidate profile from job interactions |
| `services/profileOnboardingPipeline.js` | 95 | Onboarding orchestration pipeline | Chains profile parsing, query generation, theme styling, and discovery scraping |
| `services/smartProfileBuilder.js` | 249 | Job cluster profile builder | Synthesizes profile from a collection of saved jobs |
| `services/scoringEngine.js` | 436 | 5-dimension job scoring engine | Calculates candidate-role fit score (0-100); persists weights to backend |
| `services/scoringTuningService.js` | 129 | Interactive scoring preview | Real-time score delta calculation for tuning sliders |
| `services/roleClusteringService.js` | 407 | Semantic text clustering | Groups jobs into distinct roles |
| `services/commuteService.js` | 219 | Transit & commute calculator | Calculates transit, driving, and cycling times from Melbourne base |
| `services/industryThemeService.js` | 283 | Dynamic theme styling | Injects CSS custom properties for active sector theme |
| `services/calendarService.js` | 212 | Calendar event generation | Generates `.ics` files and Google Calendar links for interviews |
| `services/ambientAudioEngine.js` | 388 | Procedural Web Audio synthesis | Cyberpunk ambient drone and sound effects engine |
| `services/pdfTemplateService.js` | 265 | ATS PDF template generator | Renders ATS-compliant resumes with configurable typography |
| `services/multiIndustryJobData.js` | 261 | Static fallback job catalog | 50+ diverse Australian jobs across 7 industries |
| `services/DataPortability.js` | 104 | Data import/export utility | JSON/CSV data portability parser for user applications |
| `services/prompts/applicationDocsPrompt.js` | 121 | Document generation prompt templates | Structured LLM prompt templates for resume and cover letter tailoring |
| `services/prompts/interviewGuidePrompt.js` | 299 | Interview prep prompt templates | Prompts for behavioral prep guides and simulation rubrics |
| `services/prompts/linkedInOptimizationPrompt.js` | 102 | LinkedIn prompt templates | Prompts for headline, summary, and experience bullet optimization |
| `services/prompts/semanticGapPrompt.js` | 78 | Semantic gap prompt templates | Prompts for extracting keyword gaps from job descriptions |

---

## 3. Requirement R2: Test Suite & Operational Health Gauntlet

### 3.1 Quantitative Results Summary

| Verification Suite | Target Directory | Tool & Version | Total Collected | Passed | Failed | Skipped | Errors | Warnings | Exit Code | Duration |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Backend Pytest** | `backend/tests/` | pytest 9.1.1 (Python 3.14.4) | 342 tests (61 files) | **339** | **0** | **3** | **0** | 0 | **0** | 13.95s |
| **Frontend Vitest** | `frontend/src/` | vitest 4.1.11 (Node 22.23.2) | 437 tests (81 files) | **437** | **0** | **0** | **0** | 0 | **0** | 25.33s |
| **Frontend Linter** | `frontend/src/` | oxlint 1.81.0 | 254 files (104 rules) | 254 clean | **0** | 0 | **0** | **400** | **0** | 0.385s |
| **Total Automated Tests** | Entire Monorepo | Monorepo Test Gauntlet | **779 total tests** | **776** | **0** | **3** | **0** | **400** | **0** | 39.28s |

---

### 3.2 Backend Pytest Suite Analysis
- **Execution Command**: `python3 -m pytest tests/ -q`
- **Output**: `339 passed, 3 skipped in 13.95s`
- **Test File Breadth**: 61 test files exercising core web routing, authentication, SQLite persistence, scoring engines, scrapers, GCS backups, and AI document generators.
- **Coverage Highlights**:
  - Over 139 individual tests across 24 test files validate HTTP endpoints using `make_handler(app)` mock instances.
  - 21 persistence and resilience tests (`test_scrape_resilience.py`, `test_profile_persistence.py`, `test_backend_persistence.py`, `test_gcs_backup.py`, `test_backup_router.py`) passed cleanly in 3.36s.

---

### 3.3 Skipped Tests Investigation
Running `python3 -m pytest tests/ -rs -q` confirmed that all 3 skipped tests originate from `tests/test_legacy_scraper_compatibility.py`:
1. `tests/test_legacy_scraper_compatibility.py::test_legacy_scraper_records_normalize_to_job[jobs_indeed.json]` (line 20)
2. `tests/test_legacy_scraper_compatibility.py::test_legacy_scraper_records_normalize_to_job[jobs_indeed_browser.json]` (line 20)
3. `tests/test_legacy_scraper_compatibility.py::test_legacy_scraper_records_normalize_to_job[jobs_seek_requests.json]` (line 20)

**Root Cause**: The test checks `pytest.skip("legacy output contains no scraped job records")` when the static legacy JSON files contain 0 records (`[]`). This is a static fixture condition, not a software bug or test failure.

---

### 3.4 Frontend Vitest Suite Analysis
- **Execution Command**: `npm test -- --run`
- **Output**: `Test Files: 81 passed (81)`, `Tests: 437 passed (437)`, `Duration: 25.33s`
- **Coverage Highlights**:
  - Smoke tests and full rendering tests for all top-level views and complex modal components.
  - Comprehensive service tests covering `profilePersistence`, `scoringEngine`, `dateUtils`, `indeedDeduplication`, `autoApplyService`, `seekPassService`, `voiceInterviewService`, and `workforceAustraliaService`.

---

### 3.5 Frontend Static Analysis (`oxlint`) Breakdown
- **Execution Command**: `npm run lint` (evaluates 104 rules on 254 files)
- **Output**: `Finished in 385ms on 254 files with 104 rules using 16 threads. Found 400 warnings and 0 errors.`

| Rule ID | Severity | Violation Count | Category & Architectural Impact |
|---|:---:|:---:|---|
| `eslint(no-unused-vars)` | Warning | 312 | Unused imports, parameters, or local variable declarations accumulated across prior refactoring phases |
| `react(set-state-in-effect)` | Warning | 37 | Synchronous `setState()` calls inside `useEffect()` causing cascading re-renders |
| `eslint(no-useless-escape)` | Warning | 15 | Redundant regex escape sequences in parsers |
| `react-hooks(exhaustive-deps)` | Warning | 15 | React Hook `useEffect` missing required reactive dependencies (stale closure risks) |
| `react(only-export-components)` | Warning | 12 | Non-component helper functions exported alongside React components |
| `react(static-components)` | Warning | 4 | Subcomponents declared inline that could be hoisted/memoized |
| `eslint(no-unused-expressions)` | Warning | 2 | Unused expressions in test assertion files |
| `eslint(no-dupe-keys)` | Warning | 1 | Duplicate object key in configuration object |
| `react(preserve-manual-memoization)` | Warning | 1 | Potential React compiler optimization skip |
| `react(immutability)` | Warning | 1 | Potential mutation of component props/state |
| **Total** | | **400** | |

---

### 3.6 Operational Health Verdict
The automated verification systems demonstrate that the codebase is in a **100% REGRESSION-FREE BASELINE STATE**.
- All 339 runnable backend tests pass.
- All 437 frontend tests pass.
- Zero linting errors exist.
- The 400 lint warnings identify clear opportunities for cleanup (Phase 1 & Phase 2 refactoring).

---

## 4. Requirement R3: Data Persistence & Ingestion Pipeline Audit

### 4.1 SQLite WAL & Connection Pool Configuration
- **Location**: `backend/src/job_dashboard/db_pool.py`
- **Class**: `ConnectionPool(db_path, max_connections=10, timeout=30.0)`
- **Configuration & Pragmas**:
  - `PRAGMA journal_mode=WAL;`: Enables Write-Ahead Logging, allowing concurrent readers alongside an active writer without blocking.
  - `PRAGMA busy_timeout=5000;`: Allows queries to wait up to 5,000 milliseconds for table locks to clear, preventing `sqlite3.OperationalError: database is locked`.
  - `PRAGMA synchronous=NORMAL;`: Reduces fsync disk flushes while maintaining data integrity in WAL mode, minimizing I/O latency.
- **Connection Management**:
  - Global connection pool registry (`_connection_pools: dict[str, ConnectionPool]`) guarantees one shared pool per SQLite file.
  - Thread safety enforced via `threading.Lock()` guarding a `collections.deque` pool queue.
  - Polling loop checks connection availability every 100ms up to 30.0s before raising `TimeoutError`.
  - `ConnectionPool.connection()` context manager executes `conn.rollback()` on exception to prevent dirty transaction reuse.
  - Liveness validation (`SELECT 1`) runs prior to returning connections to the pool; dead connections are closed and discarded.
  - Process teardown hook registered via `atexit.register(self.cleanup, log_cleanup=False)`.

---

### 4.2 Database Self-Healing & Startup Integrity Check
- **Location**: `backend/src/job_dashboard/repository.py:58-100` (`_check_and_recover_db`)
- **Mechanism**:
  1. On `JobRepository` instantiation, an unpooled connection runs `PRAGMA integrity_check`.
  2. If the check returns anything other than `"ok"` or throws an unhandled SQLite corruption error, the database is flagged as corrupt.
  3. The connection pool for that database is completely cleaned up (`pool.cleanup(log_cleanup=False)`).
  4. The corrupt file is deleted from disk via `os.remove(db_path)`.
  5. `_init_schema()` executes to generate a clean schema.

---

### 4.3 Database Schema Catalog (`backend/data/jobs.sqlite3`)
The active database `jobs.sqlite3` contains **20 tables** (total size ~18 MB):

| Table Name | Row Count | Primary Key | Foreign Keys | Purpose / Domain |
|---|:---:|---|---|---|
| `jobs` | 8,390 | `id` (TEXT) | None | Normalized scraped and ingested job listings |
| `users` | 1 | `id` (TEXT) | None | User auth, password hash, Google ID, passkey ID |
| `user_applications` | 87 | `id` (TEXT) | None | User private job tracker (stages, notes, URLs) |
| `application_events` | 490 | `id` (INT AUTO) | `job_id -> jobs(id)` | Audit trail of application status transitions |
| `user_profiles` | 8 | `user_id` (TEXT) | None | Serialized JSON candidate profile dossiers |
| `user_preferences` | 1 | `user_id` (TEXT) | None | Scoring weights and industry preferences |
| `generated_documents` | 379 | `id` (TEXT) | None | Cached AI resumes, cover letters, KSC responses |
| `job_psychology` | 2 | `job_id` (TEXT) | None | AI psychological profiling of hiring teams |
| `job_intelligence` | 0 | `(job_id, tool_key)` | None | Tool-specific AI intelligence outputs |
| `interview_sessions` | 0 | `id` (TEXT) | None | Mock interview transcripts and scores |
| `query_scrape_cache` | 87 | `query_key` (TEXT) | None | Query term TTL tracking to prevent duplicate scrapes |
| `user_saved_searches`| 5 | `id` (TEXT) | None | User-saved custom search filters and queries |
| `application_reminders` | 0 | `id` (TEXT) | None | Scheduled follow-up and interview prep reminders |
| `network_contacts` | 0 | `id` (TEXT) | None | Recruiter and professional contact CRM records |
| `candidate_matches` | 0 | `id` (TEXT) | None | Automated candidate-to-job matching scores |
| `feature_flags` | 5 | `key` (TEXT) | None | Dynamic system capability toggles |
| `provider_cookies` | 0 | `provider` (TEXT) | None | Scraper session cookies and headers |
| `user_subscriptions` | 0 | `id` (TEXT) | `user_id -> users(id)`| Stripe billing and subscription plans |
| `user_token_ledger` | 0 | `id` (TEXT) | `user_id -> users(id)`| Monthly LLM token usage accounting |
| `sqlite_sequence` | 1 | None | None | SQLite internal autoincrement tracker |

*Secondary databases in `backend/data/`: `cache.sqlite3` (`cache_entries`, 0 rows) and `health.sqlite3` (`health_checks`, 7 rows).*

---

### 4.4 Indexing Coverage & Query Performance Analysis

#### Existing Database Indices
1. `idx_jobs_posted` ON `jobs(posted)`
2. `idx_jobs_source` ON `jobs(source)`
3. `idx_jobs_stream` ON `jobs(stream)`
4. `idx_user_apps_user` ON `user_applications(user_id)`
5. `idx_gen_docs_user_job` ON `generated_documents(user_id, job_id)`
6. `idx_job_intel_job` ON `job_intelligence(job_id)`
7. `idx_interview_user_job` ON `interview_sessions(user_id, job_id)`
8. `idx_query_cache_term` ON `query_scrape_cache(term)`
9. `idx_saved_searches_user` ON `user_saved_searches(user_id, updated_at DESC)`
10. `idx_reminders_due` ON `application_reminders(user_id, remind_at, dismissed_at)`
11. `idx_net_contacts_user` ON `network_contacts(user_id)`
12. `idx_net_contacts_health` ON `network_contacts(relationship_health)`
13. `idx_net_contacts_followup` ON `network_contacts(next_follow_up_date)`
14. `idx_matches_user_score` ON `candidate_matches(user_id, score DESC)`
15. `idx_user_subs_user` ON `user_subscriptions(user_id)`
16. `idx_user_subs_stripe_cust` ON `user_subscriptions(stripe_customer_id)`
17. `idx_token_ledger_user` ON `user_token_ledger(user_id)`

#### Performance Deficiencies & Bottlenecks
1. **Full-Table Scans on Search Queries (`jobs` table)**:
   In `JobRepository.find_fresh_matching_jobs` (`repository.py:455-458`) and `query_jobs_paginated` (`repository.py:877-889`), text filtering uses leading-wildcard expressions:
   ```sql
   WHERE lower(title) LIKE '%term%' OR lower(company) LIKE '%term%' OR lower(description) LIKE '%term%'
   ```
   Standard B-Tree indices cannot index leading wildcards. Every search query performs a full sequential scan of all 8,390 rows.
2. **In-Memory Materialization & Sorting Overhead**:
   `query_jobs_paginated` (`repository.py:911-932`) selects all matching rows, loads raw JSON strings (`json.loads(row["data_json"])`), parses relative dates in Python, sorts the complete list in Python memory, and then applies pagination slices `[offset:offset+page_size]`. This creates memory and CPU overhead that scales linearly with matching records.
3. **Missing Foreign Key Index on `application_events(job_id)`**:
   `application_events` defines `FOREIGN KEY(job_id) REFERENCES jobs(id)`, but lacks an explicit index on `job_id`. Looking up the event timeline for a job requires a sequential scan of `application_events`.
4. **Missing Composite Index on `user_applications`**:
   `JobRepository.get_user_applications` (`repository.py:1037-1040`) executes:
   ```sql
   SELECT ... FROM user_applications WHERE user_id = ? ORDER BY updated_at DESC
   ```
   The existing index `idx_user_apps_user` only covers `(user_id)`, requiring SQLite to execute a filesort for ordering.

---

### 4.5 Cloud Storage Backup Architecture & Lifecycle Hookpoints
- **Architecture Rationale**: Cloud Run containers have ephemeral filesystems; all local file modifications are discarded on revision rollout, crash, or scale-to-zero. Direct SQLite operations over Cloud Storage FUSE are prohibited because SQLite WAL mode requires POSIX byte-range file locking (`fcntl`), which GCS FUSE does not support and which causes silent database corruption.
- **Manifest (`BACKUP_FILENAMES`)**: `gcs_backup.py` tracks 12 discrete objects (`jobs.sqlite3`, `jobs.sqlite3-wal`, `jobs.sqlite3-shm`, `health.sqlite3`, `health.sqlite3-wal`, `health.sqlite3-shm`, `jobs.json`, `job_profile.json`, `search_queries.json`, `smart_applications.json`, `generated_documents.json`, `compare_results.json`).
- **Synchronization Lifecycle Hookpoints**:
  1. *Cold-Start Restore* (`run_server.py:64`): On startup, `restore_from_gcs()` downloads the latest snapshot from Cloud Storage before SQLite initialization. In production (`K_SERVICE` set), `force=True` overwrites local files.
  2. *Foreground Profile Save Sync* (`web.py:197-201`): When `/api/profile` is posted, `job_profile.json` is uploaded synchronously before returning the HTTP 200 response, ensuring the profile is persisted before Cloud Run freezes the container CPU.
  3. *Background Database Sync* (`web.py:208-218`): A daemon thread flushes and uploads `jobs.sqlite3` and `jobs.sqlite3-wal`.
  4. *Preferences Save Sync* (`routes/auth.py:902`): Background thread backs up data directory on preference update.
  5. *Post-Scrape Synchronization* (`run_server.py:147`, `web.py:1700`): Newly scraped jobs are backed up to GCS once committed.
  6. *On-Demand Versioned Snapshots* (`routers/backup.py:48`): `POST /api/backup/snapshot` creates a timestamped backup under `gs://<bucket>/snapshots/snapshot_<timestamp>_<tag>/`.
- **Optimistic Concurrency**: `gcs_backup.py:118-135` passes `if_generation_match=generation_match` to Cloud Storage upload calls, preventing concurrent container instances from overwriting each other.
- **Safe WAL Checkpointing**: `_persist_profile_to_all_sinks` (`web.py:188`) executes `PRAGMA wal_checkpoint(TRUNCATE)` before GCS upload to ensure WAL writes are safely folded into the primary database file.

---

### 4.6 Dual-Index User Profile Recovery & LWW Reconciliation

#### Dual-Index Profile Resolution
To prevent candidate data from being orphaned when Google Identity Services (GIS) users authenticate via Google Subject IDs (`102938...`), UUIDs, or email addresses across devices:
1. Multi-Sink Persistence (`web.py:145-159`): Saving a profile writes to SQLite `user_profiles` under `user_id`, under normalized `email`, and under prefix-stripped IDs (`user_`, `prof_`), plus disk JSON and in-memory cache.
2. Fallback Cascade (`repository.py:1330-1376`): `get_user_profile` resolves via:
   - Exact match on `user_id`
   - Case-insensitive match (`LOWER(user_id)`)
   - Prefix stripping (removing `user_` or `prof_`)
   - Email JSON lookup: `SELECT ... WHERE profile_data_json LIKE '%"user_id"%' ORDER BY updated_at DESC LIMIT 1`.

#### Last-Write-Wins (LWW) Reconciliation
In `frontend/src/services/profiles/profileStorage.js:272-286`, client and backend states are reconciled on page reload using ISO timestamps:
- If `localProfile.updatedAt > remoteProfile.updatedAt`, the client preserves local edits and immediately pushes them to `/api/profile` to heal the server.
- If `remoteProfile.updatedAt >= localProfile.updatedAt`, local storage adopts the server profile without triggering an echo-loop.

---

### 4.7 Scraper Pipeline Invariants Audit
`ScrapeCoordinator` (`backend/src/job_dashboard/scrape_coordinator.py`) enforces 4 core operational invariants:

1. **Database-First Priority (Anti-Double-Dipping)**:
   - Rule: Check SQLite before dispatching external scrapers. If $\ge 10$ matching jobs younger than 21 days exist, satisfy query locally.
   - Verification: `JobRepository.has_sufficient_matching_jobs(term, location, threshold=10, max_age_days=21)` filters out stale jobs and satisfied terms in `web.py:1627-1638`. `test_database_first_bypasses_external_scrape` confirmed external scrapers are never called when threshold is met.
2. **Single-Flight Request Coalescing**:
   - Rule: Multiple concurrent requests for the same query term are coalesced into a single execution.
   - Verification: `ScrapeCoordinator.enqueue_query()` tracks `_in_flight_keys` and `_queued_keys`. `test_scrape_coordinator_single_flight_coalescing` simulated 40 concurrent threads requesting the identical query; exactly 1 was enqueued and 39 were coalesced (`status: "already_queued"` or `"in_flight"`).
3. **Bounded Worker Ceiling**:
   - Rule: Limit background scraper concurrency to 1 worker daemon (`max_workers = 1`) on Cloud Run to prevent memory exhaustion (2GB RAM ceiling) and IP bans.
   - Verification: `ScrapeCoordinator.__init__(max_workers=1)` uses a single `ScrapeCoordinatorWorker` thread reading from a FIFO queue.
4. **Polite Gateway Pacing & Cooldowns**:
   - Rule: 2.0s delay between queries; 6-hour cooldown on unfulfilling or recently scraped terms.
   - Verification: `ScrapeCoordinator._worker_loop` executes `time.sleep(self.inter_query_delay_seconds)` (2.0s); `enqueue_query` checks `_cooldown_tracker` with a 21,600s (6-hour) window.

---

### 4.8 Architectural Discrepancy & Bug Discoveries

1. **GCS Environment Variable Mismatch**:
   - `config.py:64`, `run_server.py:61`, `web.py:198`, and `deploy-cloudrun.sh:116` configure:
     ```bash
     JOB_DASHBOARD_GCS_DATA_BUCKET=${PROJECT_ID}-job-dashboard-data
     ```
   - In `routers/backup.py:25`:
     ```python
     bucket_name = os.getenv("JOB_DASHBOARD_GCS_BUCKET") or os.getenv("GCS_BUCKET_NAME")
     ```
   - *Impact*: `/api/backup/status` and `/api/backup/snapshot` report `gcs_configured: False` on Cloud Run because the router looks for a different variable name.
2. **Missing Method in `JobRepository`**:
   - `routers/applications.py:111` invokes `repo.get_application_events(user_id, job_id)`.
   - `JobRepository` has no `get_application_events` method, producing an unhandled `AttributeError` (500 error) when `GET /api/applications/{job_id}/events` is requested.
3. **Synchronous Scrape Invocation**:
   - `/api/refresh`, `/api/scrape`, and `/api/scrape/stream` (`routes/scrape.py:133`) invoke `app.refresh()` directly in the synchronous HTTP request thread rather than routing through `app.scrape_coordinator.enqueue_queries()`. Concurrent HTTP requests can bypass the 1-worker bounded ceiling.

---

## 5. Requirement R4: Architectural Refactor & Tech Debt Roadmap

### 5.1 Dedicated Cleanup Candidates (Files to Delete or Merge)

| Candidate Item | Target File(s) | Current Volume | Proposed Action & Rationale | Risk Level |
|---|---|:---:|---|:---:|
| **a) Dead Fallback Branches in `web.py`** | `backend/src/job_dashboard/web.py` | 4,281 lines | **Excise**: Delete lines 2466–3929 (`do_GET`), lines 3939–6746 (`do_POST`), and lines 6755–6780 (`do_DELETE`). All 189 routes are handled by `app_router.dispatch()`. Reduces `web.py` to ~2,500 lines. | **Zero** (100% tests pass via `app_router`) |
| **b) Shadow FastAPI Prototype** | `backend/src/job_dashboard/fastapi_app.py`, `backend/src/job_dashboard/routers/*.py` (8 files) | 973 lines | **Deprecate / Delete**: Remove unused prototype files. Only 8 out of 342 tests touch FastAPI, while production runs on `ThreadingHTTPServer` via `run_server.py`. Eliminates duplicate route maintenance. | **Very Low** (Update 2 test files) |
| **c) Dead Frontend Context** | `frontend/src/context/ModalContext.jsx` | 185 lines | **Deprecate / Delete**: `useModals()` has 0 consumers across the codebase. `useDashboardState.js` independently maintains the exact same modal state and prop-drills `modalState` to `DashboardModals.jsx`. | **Zero** (Remove unused wrapper in `App.jsx`) |
| **d) Duplicate Modal Mounts** | `frontend/src/components/JobSeeker.jsx`, `ActionHighlights.jsx`, `JobModal.jsx` | ~150 lines | **Merge**: Remove local mounts of `<GeneratorModal>`, `<AutoApplyModal>`, and `<PsychologyDecoderModal>` from child components. Route all modal triggers through the unified `DashboardModals.jsx`. | **Low** (Removes duplicate DOM trees) |
| **e) Style & Badge Collisions** | `frontend/src/utils/statusColors.js`, `frontend/src/components/Badge.jsx` | 65 lines | **Consolidate & Rename**: Migrate all styling to dark cyberpunk `statusStyles.js` and delete `statusColors.js`. Rename `components/Badge.jsx` to `JobStatusBadge.jsx` to prevent confusion with `components/ui/Badge.jsx`. | **Low** (Mechanical import updates) |
| **f) Missing Repository Method** | `backend/src/job_dashboard/repository.py` | +12 lines | **Implement**: Add `get_application_events(self, job_id: str)` to `JobRepository` querying `application_events` table ordered by `occurred_at DESC` to resolve runtime 500 error in `routers/applications.py`. | **Zero** (Pure bug fix) |
| **g) GCS Env Var Alignment** | `backend/src/job_dashboard/routers/backup.py:25` | 1 line | **Fix**: Update bucket lookup to check `os.getenv("JOB_DASHBOARD_GCS_DATA_BUCKET")` or use `settings.gcs_data_bucket`. | **Zero** (Pure bug fix) |
| **h) Scraper Queue Alignment** | `backend/src/job_dashboard/routes/scrape.py:133` | ~25 lines | **Refactor**: Route `/api/refresh` and `/api/scrape` through `app.scrape_coordinator.enqueue_queries()` rather than invoking synchronous `app.refresh()` in the HTTP thread. | **Medium** (Preserves rate limits) |

---

### 5.2 Performance Bottleneck Analysis

#### 1. Frontend Initial Bundle Bloat (1.39 MB minified / 386.88 kB gzip)
- **Problem**: `dist/assets/index-*.js` is **1,386.63 kB**, triggering Vite's chunk size warning.
- **Root Cause**:
  1. `Dashboard.jsx` statically imports `AnalyticsDashboard.jsx` (which drags `recharts` into the main chunk) and `ApplicationPipeline.jsx` (which drags `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` into the main chunk).
  2. `App.jsx` statically imports `SiteGate.jsx` (647 lines), `OnboardingFlow.jsx` (1,048 lines), and `Dashboard.jsx` (1,487 lines) at the root level.
  3. `vite.config.js` does not configure `manualChunks` for `recharts`, `@dnd-kit`, `jspdf`, `date-fns`, or `papaparse`.
- **Target**: Reduce `index-*.js` from 1.39 MB to **<400 kB**.

#### 2. SQLite Search Full-Table Scans & In-Memory Sorting
- **Problem**: Ad-hoc search queries on 8,390 jobs take 40–120ms due to sequential table scans and in-memory JSON deserialization.
- **Root Cause**:
  1. `lower(title) LIKE '%term%'` leading-wildcard expressions cannot utilize B-Tree indices.
  2. `query_jobs_paginated` fetches all matching rows into Python memory, parses JSON strings, sorts by date in Python, and slices the result.
- **Target**: Sub-10ms search queries utilizing an SQLite FTS5 virtual table and SQL-level `LIMIT ? OFFSET ?`.

---

### 5.3 Prioritized, Phased Refactoring Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Zero-Risk Dead Code Pruning & Defect Remediation               │
│ - Excise 4,281 lines of dead legacy if/elif branches from web.py       │
│ - Purge / Deprecate shadow FastAPI prototype (fastapi_app.py, routers) │
│ - Fix JobRepository.get_application_events and GCS env var in backup.py│
│ - Remove unused ModalContext.jsx and clean up 312 oxlint unused vars   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Frontend Bundle De-bloating & Modal Centralization            │
│ - Lazy-load AnalyticsDashboard (recharts) & ApplicationPipeline (dnd)  │
│ - Lazy-load root gates in App.jsx (SiteGate, OnboardingFlow)           │
│ - Configure manualChunks in vite.config.js (vendor-charts, vendor-dnd) │
│ - Centralize modal dialog mounts through DashboardModals.jsx           │
│ - Unify status styling into statusStyles.js and rename JobStatusBadge  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Query Optimization & Ingestion Hardening                      │
│ - Implement SQLite FTS5 virtual table (jobs_fts) with auto-sync triggers│
│ - Add missing composite indices on user_applications & app_events      │
│ - Precompute posted_iso timestamp to enable pure SQL LIMIT/OFFSET      │
│ - Route /api/refresh queries through ScrapeCoordinator queue           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Service Decomposition of DashboardApp                         │
│ - Extract JobIndexService (in-memory job cache & search sync)          │
│ - Extract ScrapeOrchestrationService (scrapers, GCS sync, loop)        │
│ - Extract ApplicationWorkflowService (CRM, Kanban state, notes)        │
│ - Leave DashboardApp as a clean composite container (<300 lines)       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Phase 1: Zero-Risk Dead Code Pruning & Defect Remediation (Immediate)
1. **Excise Dead `web.py` Branches**: Delete the legacy `if/elif` blocks inside `do_GET`, `do_POST`, and `do_DELETE` in `backend/src/job_dashboard/web.py`. Run `python3 -m pytest tests/` to confirm 100% test pass rate.
2. **Purge Shadow FastAPI Prototype**: Delete `fastapi_app.py` and `routers/*.py`. Remove or consolidate the 8 tests in `test_routers.py` and `test_backup_router.py`.
3. **Fix Broken Endpoint**: Implement `get_application_events(self, job_id: str)` in `JobRepository`.
4. **Fix GCS Environment Variable**: Align `routers/backup.py:25` with `JOB_DASHBOARD_GCS_DATA_BUCKET`.
5. **Clean Unused Code**: Remove `frontend/src/context/ModalContext.jsx` and prune top unused imports flagged by `oxlint`.

#### Phase 2: Frontend Bundle De-bloating & Modal Centralization
1. **Lazy-Load Dashboard Tabs**: In `Dashboard.jsx`, convert static imports of `AnalyticsDashboard`, `ApplicationPipeline`, `CyberpunkAmbientMode`, and `MonolithMode` to `React.lazy()`.
2. **Lazy-Load Root App Gates**: In `App.jsx`, lazy-load `SiteGate` and `OnboardingFlow`.
3. **Configure Vite `manualChunks`**: In `frontend/vite.config.js`, define explicit chunks for `vendor-charts` (`recharts`), `vendor-dnd` (`@dnd-kit`), and `vendor-pdf` (`jspdf`, `pdfjs-dist`). Verify `index-*.js` shrinks below 400 kB.
4. **Eliminate Duplicate Modal Mounts**: Strip local `<GeneratorModal>`, `<AutoApplyModal>`, and `<PsychologyDecoderModal>` mounts from `JobSeeker.jsx`, `ActionHighlights.jsx`, and `JobModal.jsx`.
5. **Unify Status Styling**: Deprecate `utils/statusColors.js` in favor of `utils/statusStyles.js`, and rename `components/Badge.jsx` to `JobStatusBadge.jsx`.

#### Phase 3: Query Optimization & Ingestion Hardening
1. **Introduce SQLite FTS5**: Create `jobs_fts` virtual table populated via triggers on `jobs` insert/update to support sub-10ms full-text searches.
2. **Add Missing Composite Indices**:
   - `CREATE INDEX idx_user_apps_user_updated ON user_applications(user_id, updated_at DESC);`
   - `CREATE INDEX idx_app_events_job ON application_events(job_id, occurred_at DESC);`
3. **Precompute `posted_iso`**: Compute normalized ISO timestamps at insertion time to replace in-memory Python date sorting with SQL-level `ORDER BY posted_iso DESC LIMIT ? OFFSET ?`.
4. **Route `/api/refresh` through Coordinator**: Enqueue refresh queries into `app.scrape_coordinator.enqueue_queries()` for unified single-flight coalescing and 1-worker pacing.

#### Phase 4: Service Decomposition of `DashboardApp`
1. Decompose `DashboardApp` (2,077 lines) into three dedicated service classes:
   - `JobIndexService`: manages in-memory job dictionaries, deduplication, and repository queries.
   - `ScrapeOrchestrationService`: manages scraper adapters, background scheduling, and GCS sync.
   - `ApplicationWorkflowService`: manages user applications, CRM contacts, and interview debriefs.
2. Retain `DashboardApp` as a lightweight composite application container (<300 lines) maintaining backwards compatibility for existing `app.*` references in `routes/`.

---
*End of Master Architecture Audit Report. Authored by teamwork_preview_worker. Verified against live monorepo state.*
