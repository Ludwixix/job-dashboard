---
name: frontend-architecture
description: React code-splitting with React.lazy, Suspense, SafeErrorBoundary, sans-serif typography, and centralized UI primitives
globs: "frontend/**/*.{js,jsx,ts,tsx}"
---

# Frontend Architectural Constraints (React / Vite / Tailwind)

## 1. Strict Dynamic Code-Splitting (`React.lazy`)
- All modal dialogs, secondary views, and heavy analytics components must be loaded on-demand:
  ```jsx
  const JobModal = lazy(() => import('./JobModal').then(m => ({ default: m.JobModal })));
  ```
- Every lazy component must be safely wrapped inside a `<SafeErrorBoundary>` and `<Suspense fallback={<ModalSkeleton />}>`.
- Never import modals eagerly into `App.jsx` or `Dashboard.jsx`.

## 2. Typography & Readability Standards
- Content areas (job titles, company names, job descriptions, form inputs) must use readable sans-serif typography (`type-heading`, `type-body`, `font-sans`).
- Monospace typography (`font-mono`) is strictly reserved for UI chrome, status badges, telemetry stats, and terminal indicators.

## 3. Component Consolidation & UI Primitives
- Use centralized UI primitives from `src/components/ui/`: `Button.jsx`, `Modal.jsx`, `Badge.jsx`, `EmptyState.jsx`.
- Use centralized status styles from `src/utils/statusStyles.js` (`statusBadgeClass`, `statusDotClass`).
- Do not invent duplicate modal wrappers or custom buttons that bypass focus states or accessibility attributes.

## 4. Screen Utilization & Layout
- Maximize screen real estate on desktop. Avoid arbitrary restrictive containers (`max-w-2xl`, `max-w-3xl`) for primary views. Expand grids smoothly to `3xl`, `4xl`, and `5xl` breakpoints.

## 5. Verification Gauntlet
- Run frontend tests: `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm test -- --run`
- Run frontend linter: `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm run lint`

