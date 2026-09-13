---
name: frontend-architecture
description: React code-splitting with React.lazy, Suspense, SafeErrorBoundary, Antigravity Premium design philosophy, and centralized UI primitives
globs: "frontend/**/*.{js,jsx,ts,tsx}"
---

# Frontend Architectural & Governance Standards (React / Vite / Tailwind)

## 1. Google Antigravity Premium Design Philosophy
- **Glassmorphism**: Use translucent surfaces, subtle borders, and blur filters (`backdrop-blur-md`, `bg-slate-900/80`, `border-slate-800/80`).
- **Typography**: Content areas (job titles, companies, descriptions, form inputs) must strictly use readable sans-serif typography (`font-sans`). Monospace (`font-mono`) is reserved solely for UI badges, telemetry counters, and technical IDs.
- **Micro-Interactions & Animation**: Leverage Framer Motion or smooth Tailwind transitions for interactive states (hover lift, modal fades, drawer slides).
- **Accessibility (WCAG 2.1 AA)**: Semantic elements, proper ARIA roles/labels on interactive buttons/icons, visible focus rings (`focus-visible:ring-2`), and high color contrast.
- **Screen Utilization**: Maximize screen real estate on desktop. Avoid arbitrary restrictive containers (`max-w-2xl`, `max-w-3xl`) for primary views; smoothly expand grids to `3xl`, `4xl`, and `5xl`.

## 2. Component Logic & Coding Standards
- **Functional Components**: Use pure functional components and React hooks exclusively. No class-based components.
- **Strict Dynamic Code-Splitting (`React.lazy`)**:
  - All secondary views, modal dialogs, and heavy analytics components must be loaded on-demand:
    ```jsx
    const JobModal = lazy(() => import('./JobModal').then(m => ({ default: m.JobModal })));
    ```
  - Every lazy component must be wrapped inside `<SafeErrorBoundary>` and `<Suspense fallback={<ModalSkeleton />}>`.
  - Never import modals eagerly into `App.jsx` or `Dashboard.jsx`.
- **Documentation**: All exported components, custom hooks, and utility functions must include JSDoc comments explaining the intent and parameters ("Why", not "What").
- **Error Handling & Clean Output**: Wrap asynchronous operations in `try/catch`. Never leave raw `console.log` statements in production-ready code; use the structured logger or user-visible error state.
- **Component Consolidation**: Use centralized UI primitives from `src/components/ui/` (`Button.jsx`, `Modal.jsx`, `Badge.jsx`, `EmptyState.jsx`) and status styles from `src/utils/statusStyles.js`.

## 3. Verification Gauntlet
- Run tests: `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm test -- --run`
- Run linter: `cd /home/s/.openclaw/workspace/job-dashboard/frontend && npm run lint`
