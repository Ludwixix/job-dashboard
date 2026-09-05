# Service Consolidation Proposal: Unified Interview Intelligence Suite

**Target Components**:
- `frontend/src/components/InterviewPrepModal.jsx` (148 LOC)
- `frontend/src/components/MockInterviewModal.jsx` (165 LOC)
- `frontend/src/components/PsychologyDecoderModal.jsx` (348 LOC)

**Total Current Footprint**: 661 lines of code across 3 separate modals and multiple redundant trigger paths.

---

## 1. Executive Summary

The application currently features three disjointed interview-related modals:
1. **`InterviewPrepModal.jsx`**: Generates high-impact anchor talking points, tailored STAR behavioral/technical questions, and strategic questions to ask the hiring manager using OpenRouter (`generateInterviewGuide`).
2. **`MockInterviewModal.jsx`**: Simulates a live interactive 5-question interview session via backend FastAPI endpoints (`/api/ai/interview/*`) with turn-by-turn answers and final scoring feedback.
3. **`PsychologyDecoderModal.jsx`**: Uses an OpenRouter prompt to analyze hidden stakeholder pressures, hiring manager psychological archetypes, candidate positioning edge strategy, and cultural clues.

These three modals address different stages of the exact same candidate workflow for a specific job posting: **understanding the role subtext**, **crafting talking points**, and **rehearsing responses**. Having three separate modal components forces disparate state lifecycles, duplicate backdrop/header/footer boilerplate, and inconsistent caching behaviors.

This proposal outlines an architectural consolidation into a single **`InterviewSuiteModal.jsx`** with a unified tabbed interface, shared job dossier compilation, and streamlined state management.

---

## 2. Functional Overlap & Redundancy Analysis

### 2.1 State Management Redundancy
- **Job Entity Matching**:
  - `Dashboard.jsx` maintains two separate state hooks:
    ```javascript
    const [selectedForInterviewPrep, setSelectedForInterviewPrep] = useState(null);
    const [selectedForMockInterview, setSelectedForMockInterview] = useState(null);
    ```
  - Both require separate memoized lookup hooks (`liveSelectedForInterviewPrep` and `liveSelectedForMockInterview`) to handle background data updates.
  - `JobModal.jsx` maintains a third independent state:
    ```javascript
    const [showPsychology, setShowPsychology] = useState(false);
    ```
- **Candidate Profile Loading**:
  - All three modals independently call `getActiveProfile()` or assume profile context.
- **Loading & Error Feedback**:
  - Each modal implements its own spinner, error banner, and retry handler with slightly different UI styling (indigo vs amber vs teal color schemes).

### 2.2 Duplicate API & AI Pipeline Logic
- **Job Dossier Compilation**:
  - `PsychologyDecoderModal` aggregates `job.description`, `job.notes`, `job.requirements`, `job.salary`, etc., into a synthesized dossier.
  - `InterviewPrepModal` passes `job` to `generateInterviewGuide` which compiles similar properties.
  - `MockInterviewModal` extracts `job.description || job.notes || ''` and `job.title` to send to `/api/ai/interview/simulate`.
- **Cache Persistence Fragmentation**:
  - `PsychologyDecoderModal` persists to `localStorage` via `psychologyService.js` and updates the job object.
  - `InterviewPrepModal` does not persist generated guides across sessions (re-generates on every open).
  - `MockInterviewModal` state is ephemeral and lost once the modal closes.

### 2.3 UI & Modal Shell Duplication
All 3 modals implement:
- Fixed backdrop with `z-50`/`z-[60]`, `bg-slate-950/80-90`, `backdrop-blur-*`, flex centering, click-outside dismissal.
- Rounded container `bg-slate-900 border border-slate-700/60 rounded-2xl` with custom top gradient border.
- Header with title, company, role, close button (`X`).
- Footer with close button and status text.
This modal shell boilerplate accounts for approximately **180 lines of duplicate JSX/CSS**.

---

## 3. Proposed Unified Architecture

### 3.1 Single Modal Component: `InterviewSuiteModal.jsx`
Replace the 3 separate modals with a cohesive, tabbed workspace:
```
┌────────────────────────────────────────────────────────────────────────┐
│  INTERVIEW INTELLIGENCE SUITE — [Role Title] @ [Company Name]     [X]  │
│  [Tab 1: Psychology Decoder]  [Tab 2: Prep & STAR Guide]  [Tab 3: Live Simulator] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Dynamic Tab View Area]                                               │
│  - Tab 1: Hidden Priorities, Manager Profile, Unfair Edge, Culture     │
│  - Tab 2: High-Impact Proof Points, STAR Answers, Reverse Questions   │
│  - Tab 3: Interactive Mock Interview Agent with Real-Time Feedback     │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  ● Cached on Job Dossier        [Copy Prep] [Export PDF]       [Done]  │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Unified Data Service: `interviewService.js`
Consolidate interview intelligence into a single service:
- `getInterviewSuiteData(job)`: Returns cached data or fetches on demand.
- `decodeEmployerPsychology(job, profile)`: Encapsulates prompt and persistence.
- `generatePrepGuide(job, profile)`: Encapsulates STAR guide generation with persistence.
- `startMockSession(job)` / `submitMockAnswer(sessionId, qId, answer)` / `getMockFeedback(sessionId)`.
- Persists all results to `job.interviewSuite = { psychology, prepGuide, mockFeedback }` via `dataService.saveUserApplication`.

### 3.3 State Simplification in `Dashboard.jsx` & `JobModal.jsx`
- Replace `selectedForInterviewPrep` and `selectedForMockInterview` in `Dashboard.jsx` with:
  ```javascript
  const [interviewSuiteJob, setInterviewSuiteJob] = useState(null);
  const [initialInterviewTab, setInitialInterviewTab] = useState('psychology'); // 'psychology' | 'prep' | 'simulator'
  ```
- Triggering from anywhere in the UI opens the suite directly into the relevant tab while keeping all tools accessible with a single click.

---

## 4. Expected Impact & Metric Projections

| Metric | Current Implementation | Proposed Consolidated Implementation | Net Reduction |
| :--- | :--- | :--- | :--- |
| **Component Files** | 3 (`InterviewPrepModal`, `MockInterviewModal`, `PsychologyDecoderModal`) | 1 (`InterviewSuiteModal`) | -2 files |
| **Total Lines of Code** | 661 LOC | ~380 - 410 LOC | **-250 to -280 LOC (-38% to -42%)** |
| **Modal Shell Boilerplate**| 3 duplicate shells (~180 LOC) | 1 shared shell (~60 LOC) | -120 LOC |
| **Dashboard.jsx Modals** | 2 lazy modal imports & 4 handlers | 1 lazy modal import & 2 handlers | -20 LOC |
| **Async Bundle Chunks** | 3 separate chunks (~472 kB combined) | 1 cohesive chunk (~75-80 kB without PDF libs) | Significant chunk overhead reduction |
| **User Experience** | Fragmented across multiple dialogs | 1 unified command center for interview readiness | Drastic UX enhancement |

---

## 5. Migration Strategy & Risk Mitigation

1. **Step 1 (Zero-Risk Refactor)**: Build `InterviewSuiteModal.jsx` supporting tabs `['psychology', 'prep', 'simulator']`.
2. **Step 2 (Deprecation & Backward Compatibility)**: Re-export compatibility wrappers from old modal files if third-party modules or unmigrated components still reference them:
   ```javascript
   export const InterviewPrepModal = (props) => <InterviewSuiteModal {...props} initialTab="prep" />;
   export const MockInterviewModal = (props) => <InterviewSuiteModal {...props} initialTab="simulator" />;
   export const PsychologyDecoderModal = (props) => <InterviewSuiteModal {...props} initialTab="psychology" />;
   ```
3. **Step 3 (Consumer Cutover)**: Update `Dashboard.jsx`, `JobModal.jsx`, `ActionHighlights.jsx`, and `JobSeeker.jsx` to consume `InterviewSuiteModal` directly.
4. **Step 4 (Test Suite Update)**: Consolidate `PsychologyDecoderModal.test.jsx` into comprehensive `InterviewSuiteModal.test.jsx`.
