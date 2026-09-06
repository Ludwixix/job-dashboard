**Role:** Act as an Expert Frontend Developer, UI/UX Designer, and CSS Architect.

**Context:** I have a web application in a monorepo (`job-dashboard`). I want you to audit the frontend app (`frontend/`), which is a Vite + React SPA branded as "CAREER.AGENT". It features a dark, terminal/HUD aesthetic with a primary theme color of `#0f172a`. The app consists of at least four distinct views:
1. The Kanban board
2. The Document Generator Studio
3. The AI Psychology Profiler
4. The "Zen Autopilot" mode

**Scope:** Stay inside `frontend/` only — do not read or modify anything in `backend/`. This is a styling audit only: do not change or rewrite any code yet, and when a future implementation phase happens, it must touch styling/markup only, never the business logic or AI logic inside the Psychology Profiler or Document Generator.

**Task:** Produce a comprehensive styling audit, consistency check, and documentation of the styling across the app.

**0. Visual Verification (do this first, if you're able to render/screenshot the app)**
- Capture all four views at 375px, 768px, and 1440px widths before writing anything else.
- Use these screenshots as evidence throughout the report below — a code-only read misses real rendered contrast issues, overflow, and visual drift.

**1. Map the Current Design System**
- Find and list every source of styling truth: Tailwind config, global CSS, CSS-in-JS, theme constants, and component-level inline styles.
- Flag if there is more than one competing system (e.g., some components using Tailwind tokens while others hardcode hex values).
- Output every unique color, font-size, spacing, and border-radius value used across `frontend/src` as a **table**: value | usage count | file locations. Group near-duplicates that should be consolidated into one token (e.g., `#0f172a` vs `#0f1729`).

**2. Cross-View Consistency**
- Compare the Kanban board, Document Generator Studio, Psychology Profiler, and Zen Autopilot views. Since these were likely built at different times, check whether they share the same button/card/input/modal components or have each grown their own one-off versions.
- Flag any view that breaks the "terminal/HUD" visual language established elsewhere (e.g., wrong font, wrong color palette, or a generic Bootstrap-y look).
- Check whether "Zen Autopilot," described as minimalist, is consistently minimalist or just uses a subset of the same cluttered components.

**3. Responsiveness & Structural Issues**
- Using the screenshots from Step 0 (or manual review if unavailable), audit each view at 375px, 768px, and 1440px for overflow, cramped Kanban columns, broken tables/cards, or unusable modals.
- Check z-index stacking context across modals, toasts, and dropdowns for conflicts.

**4. Accessibility & Interaction States**
- Check contrast ratios against WCAG AA, given the dark base theme (`#0f172a`).
- Confirm hover/focus/disabled/loading/empty/error states exist and are styled for *every* interactive component, not just the happy path.

**5. Componentization**
- Identify duplicated UI logic across the four views that should be extracted into a shared component library (e.g., `frontend/src/components/ui`), and specifically note where no shared component currently exists.

**6. Styling Documentation**
- Document the styling based on your findings. Organize the current (and proposed consolidated) design tokens into a clear reference format so we have a single source of truth moving forward.

**Output Requirements:**
1. **The Audit Report:** A prioritized report categorized by **Critical**, **Moderate**, and **Nice-to-have**. For each item, include file paths, the specific issue (with screenshot reference if applicable), and a brief suggested fix.
2. **Design System Document (`STYLEGUIDE.md` blueprint):** A structured markdown artifact formally documenting the standardized core colors, typography scale, spacing variables, and component interaction states based on your audit.
3. **Overhaul Directions:** Propose 2–3 concrete directions for a broader visual overhaul (e.g., "Lean fully into a strict terminal/HUD skin with a unified design-token file" vs. "Modernize into a clean, high-contrast SaaS dashboard look"). Include trade-offs for each so I can decide before any code is written.

Add this as a fourth output requirement — slots in right after "Overhaul Directions" since the plan should follow from whichever direction gets picked:

---

**4. Implementation Plan:** Once I've chosen a direction from Section 3, produce a phased implementation plan to execute the overhaul. This should include:
- **Phasing:** Break the work into logical phases (e.g., Phase 1: consolidate design tokens/`STYLEGUIDE.md` into actual code; Phase 2: rebuild shared component library; Phase 3: migrate each of the four views onto shared components; Phase 4: responsive/accessibility pass; Phase 5: QA/visual regression check). Order phases so foundational work (tokens, shared components) happens before view-specific migration.
- **Per-phase detail:** For each phase, list the specific files/components to be touched, the order to tackle them in, and any risks or dependencies (e.g., "Psychology Profiler's modal reuses a one-off z-index hack — must resolve before shared Modal component rollout").
- **Effort estimate:** A rough relative sizing per phase (S/M/L) so I can gauge scope, not exact hours.
- **Rollback safety:** Note which phases are safe to ship incrementally (e.g., token consolidation) versus which require an all-at-once cutover (e.g., swapping every button component in one PR) and flag any that risk visual regressions if half-migrated.
- **Non-goals:** Explicitly restate that business logic, AI logic, and backend code remain untouched throughout every phase.

Do not begin writing implementation code in this response — output only the plan. Wait for my go-ahead on a specific phase before implementing.

---

This keeps the plan as its own checkpoint — Gemini stops and hands you something reviewable instead of drifting straight into code the moment it has a direction picked.