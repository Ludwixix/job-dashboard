# Test Infrastructure Specification: Job Dashboard Priority Action Queue

**Revision**: 3.1.0  
**Target System**: Australian Job Dashboard (`job-dashboard`)  
**Scope**: Two-Tier State Machine, OCC Concurrency, Idempotency, and Keyboard-First Triage Feed  
**Author**: E2E Acceptance Test Suite Writer  

---

## 1. Overview & Test Runners

The testing infrastructure spans two coordinated test runners across backend and frontend:

| Component | Framework | Config File | Execution Root | Test Files |
|-----------|-----------|-------------|----------------|------------|
| **Backend** | `pytest>=9.1` | `backend/pyproject.toml` | `backend/` | `tests/e2e/test_tier*.py` |
| **Frontend** | `vitest>=4.1` | `frontend/vitest.config.js` | `frontend/` | `src/__tests__/e2e_*.test.jsx` |

Both runners operate with zero external cloud dependencies using local ephemeral SQLite databases (`jobs.sqlite3` with WAL mode) and JSDOM environments.

---

## 2. Four-Tier Test Architecture

The E2E acceptance suite is systematically organized into four distinct tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 4: Real-World Scenarios                                           │
│   • Full recruitment lifecycle (LEAD -> SAVED -> APPLIED -> OFFER)     │
│   • Multi-tab concurrent triage conflict detection & recovery          │
│   • Interactive triage session with mixed operations & error recovery  │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Cross-Feature Combinations & Concurrency                       │
│   • Concurrent identical PATCH requests (Same Idempotency-Key)         │
│   • Concurrent racing updates (Expected Version 1 vs 1)                │
│   • Rapid version ladder chaining (v1 -> v2 -> v3 -> v4 -> v5)         │
│   • Instant UI optimistic update (<16ms) with simulated network delay  │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Boundary & Corner Cases                                        │
│   • Stale update OCC conflict (expected=1, current=2) -> HTTP 409      │
│   • Future version mismatch (expected=99, current=1) -> HTTP 409       │
│   • Missing expected_version or event_type -> HTTP 400 Bad Request     │
│   • Case-insensitive Idempotency-Key header recognition                │
│   • Upper/lower bounds clamping (index 0 and length-1)                 │
│   • Input element typing isolation guard (input/textarea)              │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Feature Coverage (Isolated Happy Path)                         │
│   • Two-tier FSM transition rules                                      │
│   • Single valid PATCH event progression & version increment           │
│   • Idempotent single repetition returns cached 200 without version hop│
│   • Audit trail timeline reflection                                    │
│   • Keyboard navigation hotkeys: 'j', 'k', 'e', 's', 'g', 'c'          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Strict Acceptance Thresholds & Invariants

### 3.1 Backend Concurrency & Idempotency Invariants
1. **Zero 500 Errors Under Concurrency**:
   - When $N \ge 10$ concurrent threads issue identical `PATCH /api/v1/jobs/{id}/events` requests with the same `Idempotency-Key`, **exactly 0 requests may fail with HTTP 500**.
   - Exactly one event record must be written to `user_application_events`.
   - The application `version` must increment exactly once ($1 \to 2$).
2. **Deterministic OCC Version Conflict (HTTP 409)**:
   - Any state mutation where `expected_version != current_version` must return `HTTP 409 Conflict`.
   - The error response must include diagnostic conflict details and the `current_version`.
3. **FSM Legality Guarantee**:
   - Applications in terminal stages (`CLOSED`) strictly reject subsequent events.
   - Prohibited transition leaps (e.g. `LEAD` straight to `OFFER_ACCEPTED`) are rejected.

### 3.2 Frontend Latency & UX Invariants
1. **Sub-16ms Optimistic UI Progression**:
   - When a candidate triggers the primary Next Best Action (via `e` or click), the stage change in the UI must execute synchronously in **$< 16\text{ms}$** (within a single 60Hz display frame) before network I/O completes.
2. **Automatic Rollback & Toast on Network Failure**:
   - If simulated network requests fail (e.g. 500 error or network disconnection), the UI must instantly revert the item to its previous state and fire an error toast notification.
3. **Automatic Rollback & Toast on 409 Conflict**:
   - If the backend returns `409 Conflict`, the UI must revert optimistic changes and alert the user that the item was modified elsewhere.
4. **Keystroke Isolation Guard**:
   - Keystrokes (`j`, `k`, `e`, `s`, `g`, `c`) must be strictly ignored when the active element is an `<input>`, `<textarea>`, `<select>`, or `contentEditable` element.

---

## 4. Test Execution Guide

### 4.1 Running the Backend Acceptance Suite

```bash
# Navigate to backend package
cd /home/s/.openclaw/workspace/job-dashboard/backend

# Run full E2E test suite (all 4 tiers)
python3 -m pytest tests/e2e/ -v

# Run individual tiers
python3 -m pytest tests/e2e/test_tier1_features.py -v
python3 -m pytest tests/e2e/test_tier2_boundaries.py -v
python3 -m pytest tests/e2e/test_tier3_combinations.py -v
python3 -m pytest tests/e2e/test_tier4_scenarios.py -v
```

### 4.2 Running the Frontend Acceptance Suite

```bash
# Navigate to frontend package
cd /home/s/.openclaw/workspace/job-dashboard/frontend

# Run full frontend E2E triage suite
npm test -- --run src/__tests__/e2e_triage_feed.test.jsx
```

### 4.3 Running Combined Verification

```bash
# Run both backend and frontend E2E suites sequentially
(cd /home/s/.openclaw/workspace/job-dashboard/backend && python3 -m pytest tests/e2e/ -v) && \
(cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm test -- --run src/__tests__/e2e_triage_feed.test.jsx)
```
