# Research & Architectural Roadmap: Future AI Layer (Scraping & Semantic Matching)

**Document Reference**: `docs/tasks/ai-layer-roadmap.md`  
**Evaluation Scope**: Backend scraping architecture (`backend/src/job_dashboard/sources/`) and candidate fit scoring engine (`backend/src/job_dashboard/score.py`).  
**Author**: Antigravity Autonomous Engineering Agent  
**Status**: Complete — Phase 1 (Hybrid Semantic Vector Scoring), Phase 2 (Targeted ATS Portal Scraping), & Phase 3 (Semantic Density & Content Generation Engine) Implemented & Verified on Master  

---

## 1. Executive Summary

This evaluation investigates whether to migrate `job-dashboard`'s backend scraping and job-matching subsystem toward LLM-native extraction and embedding-based semantic matching.

Currently, the platform relies on:
1. **Scraping**: A resilient, tiered multi-provider architecture leveraging `python-jobspy`, direct HTTP REST APIs (Adzuna, RemoteOK), Playwright headless Chromium fallbacks, and an atomic file-based cache for SEEK (`seek_cache_ingest.py`).
2. **Scoring**: A deterministic, multi-dimensional heuristic regex engine (`score.py`) scoring jobs on 5 distinct dimensions (title alignment, primary skills, secondary skills, seniority level, and location/remote preferences), augmented by dynamic `coreSkills` extraction across multi-industry profiles.

This roadmap evaluates two potential evolutions:
- **Crawl4AI** (`github.com/unclecode/crawl4ai`) as a unified web-scraping extraction engine.
- **Embedding-Based Semantic Matching** (evaluating sentence-transformers and hosted vector embeddings as alternatives to the current keyword/regex scoring engine, addressing the "Resume2Vec" preprint caveat).

**Primary Finding & Recommendation**: **Proceed with Modifications (Phased Hybrid Approach)**. 
- Do **not** replace the existing scraping pipeline with Crawl4AI wholesale today; the current multi-provider JobSpy/REST/Playwright implementation is stable, low-latency, and zero-cost. Instead, retain the current pipeline and evaluate Crawl4AI strictly as a secondary fallback crawler for stubborn JavaScript/anti-bot career portals.
- For scoring, implement a **two-tier hybrid scoring model**: retain deterministic regex scoring for fast, explainable Tier-1 pre-filtering and candidate explanations, while introducing an optional, asynchronous Tier-2 semantic similarity reranker using a verified, lightweight embedding model (`sentence-transformers/all-MiniLM-L6-v2`) or hosted vector API (`google-genai` / `text-embedding-004`).

---

## 2. Current-State Technical Baseline

### 2.1 Scraping Subsystem (`backend/src/job_dashboard/sources/`)
The current scraping layer is built around provider isolation and multi-tier fallbacks:

```
                  ┌──────────────────────────────┐
                  │ Scrape Pipeline Orchestrator │
                  └──────────────┬───────────────┘
                                 │
     ┌───────────────────┬───────┴───────────┬───────────────────┐
     ▼                   ▼                   ▼                   ▼
┌─────────────┐   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SEEK      │   │   Indeed    │     │   Adzuna    │     │  RemoteOK   │
└──────┬──────┘   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                 │                   │                   │
  Tier 1: JobSpy    Tier 1: JobSpy      Direct REST API     Direct REST API
  Tier 2: Browser   Tier 2: Browser          (Fast)              (Fast)
  Tier 3: Cache     Tier 3: Empty Fallback
```

- **Strengths**:
  - **Zero LLM Token Cost**: Extraction is purely mechanical (JSON parsing and CSS/XPath selectors).
  - **High Throughput**: Hundreds of listings can be retrieved in seconds.
  - **Date Normalization**: Provider-relative ages (`9d ago`) are frozen into absolute ISO timestamps (`canonical_posted_date`), ensuring honest date display and chronological sorting.
  - **Cache Resilience**: If SEEK blocks requests or throttles (HTTP 403), `seek_cache_ingest.py` seamlessly serves atomic, validated cached records without crashing the feed.
- **Weaknesses**:
  - CSS selector churn on portals without public APIs requires ongoing scraper adapter maintenance.
  - Unstructured employer career pages (e.g. Workday, Taleo, Greenhouse) are difficult to scrape without custom scrapers.

### 2.2 Scoring Engine (`backend/src/job_dashboard/score.py`)
The scoring engine evaluates job fit against candidate profiles using a 100-point multi-dimensional model:
- **Title Alignment (30 pts)**: Exact and partial token overlap between candidate headline and job title.
- **Primary Skills (35 pts)**: Matches against curated aliases (`SKILL_ALIASES`) and candidate `coreSkills`.
- **Secondary Skills (15 pts)**: Supporting capabilities weighted at 0.45x.
- **Seniority & Role Penalty (-15 to -25 pts)**: Penalizes seniority mismatches (e.g. Junior vs Principal, or Data Engineer vs Systems Administrator).
- **Location & Remote Fit (20 pts)**: City/suburb matching and hybrid/remote alignment.

- **Strengths**:
  - **100% Deterministic & Explainable**: Generates human-readable fit explanations (`/api/job-explanation`) detailing matched skills, missing skills, and score breakdown.
  - **Extreme Performance**: Evaluates 1,000+ jobs in < 25 milliseconds in-memory with zero network overhead.
  - **Domain Customization**: Explicitly penalizes out-of-domain mismatches through curated negative rules.
- **Weaknesses**:
  - Misses semantic synonyms not covered by `SKILL_ALIASES` (e.g., "orchestrating microservices" vs "Kubernetes management").
  - Requires maintaining skill dictionaries for non-IT disciplines unless supplied via `coreSkills`.

---

## 3. Crawl4AI Evaluation

### 3.1 Overview & Repository Status
- **Repository**: `github.com/unclecode/crawl4ai` (UncleCode)
- **License**: Apache License 2.0 (Commercially permissive)
- **Maintenance Status**: Highly active, rapidly growing community (v0.4.x+ as of 2025/2026), dedicated async architecture.
- **Core Technology**: Built on top of Playwright, `asyncio`, and optional LLM integration (supports local and hosted models for structured extraction).

### 3.2 Architectural Fit for Job Dashboard
Crawl4AI offers:
1. **Markdown Generation for LLMs**: Strips clutter, navigation menus, ads, and scripts to output clean markdown specifically formatted for LLM token efficiency.
2. **Extraction Strategies**: Supports `JsonCssExtractionStrategy`, `LLMExtractionStrategy`, and cosine-similarity chunk extraction.
3. **Anti-Bot & Session Management**: Built-in browser fingerprint spoofing, proxy rotation hooks, and dynamic infinite scroll handling.

### 3.3 Limitations & Hosting Constraints
1. **Container Weight**: Like our existing Playwright container setup, Crawl4AI requires headless Chromium and OS-level system libraries (`libglib`, `libnss3`, etc.). Running it in Google Cloud Run requires at least 2 GiB RAM and 2 vCPUs (matching our current spec).
2. **Throughput vs. JobSpy**: JobSpy uses lightweight direct HTTP requests with TLS spoofing (`tls-client`) where possible, which is significantly faster and lower-memory than launching full browser contexts for every portal query.
3. **LLM Extraction Costs**: Using Crawl4AI with an LLM extraction strategy for batch job scraping would introduce variable API costs ($0.05–$0.20 per scrape run) and increased latency (2–5 seconds per job page).

### 3.4 Verdict on Crawl4AI
- **Not Recommended** as a direct replacement for JobSpy / REST sources (`sources/indeed.py`, `sources/adzuna.py`).
- **Recommended** as a standalone micro-crawler for direct employer portal links (e.g., extracting full descriptions from arbitrary company career pages when JobSpy only captures truncated snippets).

---

## 4. Embedding-Based Semantic Matching Evaluation

### 4.1 The "Resume2Vec" Preprint Caveat
In industry literature and academic discussion, "Resume2Vec" refers to a January 2025 research preprint outlining a dual-encoder transformer architecture that embeds resumes and job descriptions into a shared metric space for cosine similarity ranking.
- **Critical Fact**: "Resume2Vec" is **not an installable package or maintained open-source library**. It cannot be installed via `pip install resume2vec`.
- Attempting to declare dependencies on unverified preprint names introduces supply-chain vulnerabilities and build breakages.

### 4.2 Verifiable, Maintained Embedding Alternatives
If embedding-based semantic matching is introduced, it must utilize concrete, actively maintained libraries or hosted APIs:

#### Option A: In-Process Local Embeddings (`sentence-transformers`)
- **Package**: `sentence-transformers` (Hugging Face, Apache 2.0).
- **Candidate Model**: `sentence-transformers/all-MiniLM-L6-v2` (22M parameters, ~80 MB model size, 384-dimensional vector output).
- **Inference Speed**: ~15ms per job description on CPU.
- **Pros**: Zero external API costs, no network latency, runs locally inside the Python container.
- **Cons**: Adds PyTorch dependency (`torch`), increasing container image size by ~800 MB.

#### Option B: Hosted Vertex AI / Google Gemini Embeddings (`google-genai`)
- **Package**: Already partially integrated via Google Cloud ecosystem.
- **Candidate Model**: `text-embedding-004` (768 dimensions) or Gemini embedding endpoints.
- **Pros**: Zero local memory footprint, state-of-the-art semantic comprehension across complex job descriptions.
- **Cons**: Requires external API calls, per-token API cost, and network latency on batch refresh.

#### Option C: OpenRouter / OpenAI Compatible Embeddings
- **Endpoint**: Embeddings API via OpenRouter or direct provider.
- **Pros**: Matches existing frontend OpenRouter integration.
- **Cons**: Variable costs, rate limits.

---

## 5. Architectural Comparison: Current vs. Proposed

| Evaluation Dimension | Current Architecture (`score.py` + `sources/`) | Proposed Hybrid Architecture (Heuristics + Semantic Embeddings) |
| :--- | :--- | :--- |
| **Scraping Engine** | `python-jobspy` + Playwright + REST | Current scrapers + Crawl4AI employer fallback |
| **Matching Engine** | Deterministic Regex & Keyword Taxonomy | Tier-1 Heuristics + Tier-2 Vector Cosine Similarity |
| **Execution Speed** | < 25ms for 1,000 jobs | ~25ms (Tier 1) + ~150ms for Top 50 (Tier 2) |
| **Explainability** | 100% deterministic (matched/missing skills) | Hybrid: Deterministic breakdown + semantic boost |
| **Container Size** | ~1.4 GB | ~1.5 GB (Hosted Embeddings) / ~2.3 GB (Local PyTorch) |
| **External API Cost** | $0.00 | Free tier / < $0.01 per batch with hosted embeddings |
| **Failure Mode** | Graceful fallback to cached jobs | Fallback to pure regex scoring if embedding API fails |

---

## 6. Implementation Roadmap & Rollback Plan

### Phase 1: Hybrid Semantic Scoring Prototype (Safe, Non-Breaking)
1. Add an optional semantic score field to `ScoreResult`:
   ```python
   class ScoreResult:
       score: int                    # Composite score (0-100)
       rule_score: int               # Deterministic regex score
       semantic_score: float | None  # Vector cosine similarity (0.0 - 1.0)
       explanation: ScoreExplanation
   ```
2. Compute embeddings only for candidate profile and the top 50 pre-filtered jobs, keeping CPU and network overhead negligible.
3. Blend the score: `final_score = (rule_score * 0.7) + (semantic_score * 30)`.

### Phase 2: Targeted Portal Scraping via Crawl4AI
1. Retain JobSpy for feed discovery.
2. Introduce an isolated background job adapter (`sources/portal_crawler.py`) using Crawl4AI to fetch deep job descriptions from complex ATS portals (Workday/Greenhouse) when links are flagged as truncated.

### Phase 3: Semantic Density & Content Generation Engine (The Intelligence Layer)
1. **Semantic Gap Analysis (Diagnostic)**: Evaluates conceptual alignment comparing candidate capabilities against requisition requirements, calculating a 0–100 semantic density score and returning a concise 3-sentence diagnostic with pursue/skip recommendations (`analyze_semantic_gap`).
2. **Achievement Anchoring**: Structures experience statements into quantifiable business outcomes following `[Active Verb] + [Core Task/Project] + [Quantified Result/Metric]` with metric front-loading for 7.4-second F-pattern recruiter scanning.
3. **Fluff Eradication & Scale Attribution**: Automatically strips subjective corporate buzzwords (`results-driven`, `team player`, `proven track record`) and anchors claims in factual scale indicators.
4. **Australian Market Localization**: Normalizes spelling (`organise`, `prioritise`, `centre`, `programmes`) and enforces single-column, demographic-free AU resume conventions.
5. **Endpoints & Frontend Integration**:
   - `GET /api/semantic-gap` & `POST /api/semantic-gap` (and `/api/jobs/{job_id}/semantic-gap`)
   - `fetchSemanticGapAnalysis` in `frontend/src/services/generationService.js` with resilient client fallback.

### Rollback Strategy
- Every semantic feature must be behind a feature flag (e.g. `JOB_DASHBOARD_SEMANTIC_SCORING_ENABLED=false`).
- If an embedding service fails or times out, the scoring engine immediately defaults to pure `rule_score` without user disruption.

---

## 7. Explicit Recommendation

### **Recommendation: Proceed with Modifications**

1. **Do NOT wholesale replace existing scrapers**: The current JobSpy, Adzuna, RemoteOK, and SEEK cache ingestion pipeline is battle-tested, fast, and stable. Replacing it with Crawl4AI would increase latency and maintenance overhead without improving job coverage.
2. **Do NOT install unverified "Resume2Vec" packages**: Any semantic matching implementation must rely exclusively on verified packages (`google-genai` embeddings or `sentence-transformers`).
3. **DO implement a two-stage hybrid scoring system**: Augmenting the deterministic rule engine with hosted vector embeddings (`text-embedding-004`) for top-tier candidates will deliver genuine improvements in match nuance without sacrificing explainability or adding container bloat.

