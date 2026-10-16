# ADR-020: Accessibility Compliance (WCAG 2.2 AA) & Inclusive UX

**Date:** 2025-10-14  
**Status:** Accepted  
**Author:** Reviewer  
**Cross-References:** PRD §5–§7 (NFRs, UX standards), Accessibility requirements; TDD §3–§7 (frontend architecture, routes), §9–§10 (build/run/CI); QA §6 (Lighthouse/axe), §8–§12 (CI gates), §14 (regression)

---

## Context

The product must be perceivable, operable, understandable, and robust to **WCAG 2.2 AA**. The PRD mandates inclusive defaults and assistive technology support. The TDD uses React/Vite with tokenized i18n and a component library; QA enforces **Lighthouse ≥ 90**, automated a11y (axe) checks in CI, and E2E coverage for keyboard navigation and focus management.

This ADR defines accessibility non-negotiables, component patterns, testing, and CI enforcement so features are **accessible by default** and regressions are caught automatically.

---

## Decision

1. **Standards & Scope**
   - Target **WCAG 2.2 AA** for web UX.
   - Support modern screen readers (NVDA, VoiceOver), keyboard-only users, and high-contrast/zoom users (up to 200%).

2. **Design System & Semantics**
   - Use **semantic HTML** first; ARIA only when necessary.
   - Components must expose **visible labels**, `aria-label`/`aria-labelledby` where needed, and proper roles.
   - **Focus management:** logical tab order; visible focus rings; focus trap for modals/drawers; return focus on close.
   - **Color/contrast:** minimum **4.5:1** for text; **3:1** for large text/icons; system tokens enforce contrast.
   - **Forms:** associate labels/controls; inline error text with `aria-describedby`; clear instructions and examples.
   - **Animations:** respect **prefers-reduced-motion**; avoid parallax/auto-playing animations without controls.
   - **WCAG 2.2 additions:**
     - **Focus Not Obscured (2.4.11):** Focus indicators must not be hidden by overlays; minimum 2px visibility required.
     - **Dragging Movements (2.5.7):** All drag operations must have keyboard alternatives (arrow keys, Enter/Space).
     - **Target Size (2.5.8):** Minimum 24×24 CSS pixels for pointer targets (exceptions: inline links, user agent controls, essential targets).
     - **Consistent Help (3.2.6):** Help mechanisms must appear in same relative order across pages.
     - **Redundant Entry (3.3.7):** Auto-populate previously entered information where appropriate; preserve form data on validation errors.
     - **Accessible Authentication (3.3.8):** No cognitive function tests (CAPTCHA, puzzles) in authentication flows; if required, must provide alternative.
     - **Status Messages (4.1.3):** Status messages must be programmatically determinable via ARIA roles (`role="status"` for polite, `role="alert"` for assertive).

3. **Keyboard & Shortcuts**
   - All interactive elements reachable via **Tab/Shift+Tab**; **Enter/Space** activate controls; **Esc** closes dialogs.
   - Skip links (`Skip to main content`) and landmark regions (`header`, `nav`, `main`, `footer`).

4. **Media & Images**
   - **Alt text** required for informative images; decorative images use empty `alt`.
   - Captions/subtitles for videos; transcripts for long-form audio.
   - Image derivatives sized to avoid layout shift (with width/height or CSS reserve).

5. **Internationalization & Language**
   - Set `<html lang>`; update on language switch.
   - Mark language changes within content via `lang` attribute when mixing languages (e.g., code/quotes).
   - Text expansion accommodated in layouts (longer DE strings).

6. **Error Prevention & Recovery**
   - Prevent destructive actions with confirms/undo where possible.
   - Persist form data on validation errors; keyboard focus moves to the first error; error summary linked to fields.

7. **Performance & Responsiveness**
   - Performance budgets (LCP **< 2.5 s**, CLS **≤ 0.1**); images lazy-loaded; fonts with `font-display: swap`.
   - Touch targets minimum **44×44 px**; responsive layouts at common breakpoints.

8. **Component Library Requirements**
   - Shared components (Button, Link, Input, Select, Modal, Tooltip, Tabs, Toast) must pass axe checks and include stories with **a11y add-on**.
   - Provide **screen reader-only** utility and consistent keyboard behaviors.
   - Document ARIA patterns per component with do/don’t examples.

9. **Testing & CI Gates**
   - **Unit/Storybook:** axe checks on core components; snapshot stories include keyboard interactions.
   - **E2E (Playwright):** keyboard-only flows for critical tasks; assertions on focus order and ARIA attributes.
   - **Lighthouse CI:** fail if score < **90** or CLS/LCP budgets breached.
   - **Regression:** visual regression tests (optional) for focus indicators and color tokens.

10. **Documentation & Checklists**
    - Contributor checklist in PR template (labels, focus, contrast, keyboard, errors).
    - Accessibility notes in design specs and acceptance criteria for each user story.

11. **Operations & Telemetry**
    - Monitor Lighthouse trends per release; publish a11y report links in PR comments.
    - Track user feedback for accessibility issues; triage as **P1** for blocking defects.

---

## Consequences

**Positive**

- Inclusive default UX; automated gates reduce regressions; predictable performance and readability.
- Documented patterns accelerate delivery and reduce one-off decisions.

**Negative / Trade-offs**

- Additional effort to author alt text, labels, and tests.
- Visual/interaction constraints on custom UI elements (intentional for accessibility).

**Operational**

- Review color tokens quarterly; re-run audits when brand colors change.
- Keep a11y CI tooling updated; educate contributors with short guides and examples.

---

## Alternatives Considered

| Option                                        | Description                 | Reason Rejected                                                |
| --------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| Post-hoc audits only                          | Manual audits late in cycle | Too slow; regressions slip through; not aligned with QA gating |
| Component-by-component ARIA without semantics | ARIA everywhere             | Higher defect rate; semantics-first is more robust             |
| Exclude captions/transcripts for media        | Save time on content        | Fails WCAG and PRD inclusivity goals                           |

---

## References

- PRD: Accessibility & UX standards, performance budgets
- TDD: Frontend architecture, build/run/CI, component library practices
- QA: Lighthouse/axe gates, E2E keyboard flows, regression thresholds

---

## Status Log

| Version | Date       | Change                                                                  | Author   |
| ------- | ---------- | ----------------------------------------------------------------------- | -------- |
| v1.0    | 2025-10-14 | Initial ADR for WCAG 2.2 AA accessibility compliance and CI enforcement | Reviewer |
| v2.0    | Unverified | Updated to WCAG 2.2 AA with 9 new success criteria                      | Reviewer |
