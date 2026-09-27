# Test Infrastructure: "Sam Mode" Personal Career Command Center

## 1. Overview & Architecture
This document details the test infrastructure for the "Sam Mode" Personal Career Command Center in the Job Dashboard repository (`/home/s/.openclaw/workspace/job-dashboard`).

The test suite is built on **opaque-box, requirement-driven principles**:
- The tests interact with the application strictly as an external client / HTTP API consumer would, dispatching HTTP requests (`GET`, `POST`) and asserting on HTTP status codes, headers, and JSON response bodies.
- All test fixtures are **self-contained and isolated**: each test run spins up a temporary SQLite database, loads the canonical profile (`backend/data/job_profile.json`), seeds deterministic test vacancies, and cleans up completely after execution.
- No database pollution, no dependency on external live job boards, and zero coupling to internal private method names.

---

## 2. 4-Tier Test Design Matrix

The test suite in `tests/e2e/test_career_mode_e2e.py` implements a 4-Tier verification gauntlet:

| Tier | Test Focus | Description | Tests |
|---|---|---|---|
| **Tier 1** | **Feature Coverage** | Direct verification of every requirement in `ORIGINAL_REQUEST.md` (2026-09-24T09:20:05Z) and `PROJECT.md`: HUD overview, match breakdown chips, 8 archetype filters, hard knockouts, and 1-click tailored application studio. | 5 |
| **Tier 2** | **Boundary & Corner Cases** | Stress testing edge conditions: missing/None salary, malformed salary strings (daily contractor rates `$900/day`, hourly rates `$85/hr`, text-only packages), zero-match queries, clearance ambiguities (Baseline/NV1 vs TSPV), and extreme experience. | 5 |
| **Tier 3** | **Cross-Feature Combinations** | Multi-parameter pairwise interactions: filtering by archetype + salary floor + remote work arrangement; generating application materials on filtered subsets; real-time scraper telemetry reflection in cockpit overview. | 4 |
| **Tier 4** | **Real-World Scenarios** | Holistic end-to-end user workflows: (A) Sam reviewing a Victorian Dept of Education equivalent enterprise role and generating STAR KSC + cover letter; (B) Rejection and exclusion of underpaid role; (C) Commute and local alignment for hybrid Melbourne SE / Balaclava role. | 3 |
| **Total** | | **Comprehensive E2E Suite** | **17** |

---

## 3. Test Cases Inventory

### Tier 1: Feature Coverage (`TestTier1FeatureCoverage`)
1. `test_hud_overview_endpoint_contract`:
   - Validates `GET /api/career-mode/overview`.
   - Asserts profile data (Sam Ludwig, 10 YOE, Australian Citizen, Baseline/NV1 eligible, $140k-$165k + Super, $120k floor, Balaclava 3183, all 8 canonical target titles).
   - Asserts telemetry metrics (`last_scraped_at`, `new_vacancies_today`, `feed_health`, `total_matching_jobs`, `high_alignment_jobs`).
   - Asserts vacancy counts across all 8 target archetypes.
2. `test_match_breakdown_chips_structure`:
   - Validates `GET /api/career-mode/matches`.
   - Asserts presence of instant match breakdown chips (`M365 & Entra ID: 100%`, `Autopilot/Intune: Match`, `Salary: In Range`, `Clearance: Ready`).
   - Asserts composite Justification Score (>= 80) and Proof-Point synthesis referencing Sam's 660,000+ user enterprise milestone at Dept of Education VIC.
3. `test_eight_archetype_filters`:
   - Validates filtering across all 8 target roles:
     1. Senior Systems Engineer
     2. Senior Infrastructure Engineer
     3. Senior M365 Engineer
     4. Cloud Infrastructure Specialist
     5. Endpoint / EUC Engineer
     6. L3 Systems / Operations Lead
     7. SharePoint & Modern Workplace Architect
     8. Automation & DevOps Engineer
4. `test_hard_knockouts_enforcement`:
   - Validates hard knockout rules across salary floor (< $120k), clearance (strict TSPV), work rights (US Citizen only), and location (Perth on-site).
   - Validates **ZERO false knockouts** on Australian Citizenship and Baseline/NV1 security clearance requirements.
5. `test_one_click_application_studio_contract`:
   - Validates `POST /api/career-mode/application-studio`.
   - Asserts generation of structured STAR KSC responses grounded in Sam's real enterprise history.
   - Asserts tailored executive cover letter.
   - Asserts ATS resume optimization summary (score, matched keywords, tailored summary).

### Tier 2: Boundary & Corner Cases (`TestTier2BoundaryAndCornerCases`)
6. `test_missing_and_none_salary_graceful_handling`:
   - Omitted, empty, or `None` salary values do not throw HTTP 500 and pass permissively without false knockouts.
7. `test_malformed_salary_strings_resilience`:
   - Daily rate `$850 - $950 per day` annualized to ~$190k-$210k (passes $120k floor).
   - Daily rate `$350 / day` annualized to ~$80k (fails $120k floor).
   - Hourly rate `$85 / hr` annualized to ~$170k (passes $120k floor).
   - Text strings ("Competitive package") handled gracefully without crash.
   - Boundary checks: `$119,000` (fails floor) vs `$120,000` (passes floor).
8. `test_zero_match_query_resilience`:
   - Impossible query parameters return `{"total": 0, "jobs": []}` with HTTP 200 OK.
9. `test_clearance_and_citizenship_edge_cases`:
   - "Eligible to obtain Baseline clearance" -> PASS.
   - "Negative Vetting 1 (NV1) mandatory" -> PASS.
   - "Active TSPV mandatory" -> KNOCKOUT.
10. `test_extreme_seniority_and_experience_filtering`:
    - Entry-level / graduate intern positions receive low justification score and are excluded from the high-alignment feed.

### Tier 3: Cross-Feature Combinations (`TestTier3CrossFeatureCombinations`)
11. `test_archetype_salary_floor_and_remote_combination`:
    - Compound filtering (`archetype` + `min_score` + `remote_only`) enforces all constraints conjunctively.
12. `test_application_generation_on_filtered_jobs`:
    - Jobs discovered via filtered feed seamlessly feed into the Application Studio generator.
13. `test_scraper_telemetry_integrated_in_hud_overview`:
    - Database job additions immediately update HUD vacancy counts.
14. `test_batch_evaluate_reflected_in_matches_feed`:
    - Batch evaluation via `POST /api/career-mode/evaluate` updates staged cache and feed scores.

### Tier 4: Real-World Scenarios (`TestTier4RealWorldScenarios`)
15. `test_scenario_dept_of_ed_vic_enterprise_workflow`:
    - Sam checks HUD, discovers high-alignment Victorian public sector role, validates 660,000+ user proof points and match chips, and generates 1-click STAR KSC + executive cover letter.
16. `test_scenario_low_salary_rejection`:
    - An underpaid $85,000 Desktop Support role is evaluated, flagged as failing the $120,000 salary floor, and excluded from recommended feeds.
17. `test_scenario_hybrid_melbourne_balaclava_alignment`:
    - A hybrid role in Balaclava / Melbourne SE is evaluated, matching commute preferences with `location_pass: True`.

---

## 4. How to Execute Tests

### From Repository Root:
```bash
# Run the entire E2E test suite
python3 -m pytest tests/e2e/test_career_mode_e2e.py -v

# Run a specific tier
python3 -m pytest tests/e2e/test_career_mode_e2e.py -k "TestTier1" -v
python3 -m pytest tests/e2e/test_career_mode_e2e.py -k "TestTier2" -v
python3 -m pytest tests/e2e/test_career_mode_e2e.py -k "TestTier3" -v
python3 -m pytest tests/e2e/test_career_mode_e2e.py -k "TestTier4" -v
```

### From Backend Directory:
```bash
cd backend && python3 -m pytest tests/test_career_mode_e2e.py -v
```

### Linting:
```bash
ruff check tests/e2e/test_career_mode_e2e.py
```

---

## 5. Test Infrastructure Components
- **Test File**: `tests/e2e/test_career_mode_e2e.py`
- **Aliases / Symlinks**:
  - `tests/e2e/test_career_mode_cockpit_e2e.py -> test_career_mode_e2e.py`
  - `backend/tests/test_career_mode_e2e.py -> ../../tests/e2e/test_career_mode_e2e.py`
- **Client**: `CareerModeE2EClient` wrapping `make_handler(app)`
- **Fixture**: `e2e_env` provisioning isolated temporary SQLite database and seeding 15+ diverse job listings covering all edge and pass conditions.
