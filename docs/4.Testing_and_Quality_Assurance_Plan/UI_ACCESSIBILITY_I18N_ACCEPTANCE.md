# UI accessibility and internationalization: mandatory acceptance criteria

Applies to **every active frontend and backoffice UI element, interaction and workflow**. A passing Lighthouse score or a successful static route scan is not a certificate of compliance.

## Definition of done for UI changes

- [ ] All text, accessible names, errors, hints, placeholders, actions, announcements, empty/loading states, and units are localized through the existing i18n system; no new hard-coded user-facing strings.
- [ ] Every supported locale includes the required keys and matching interpolation variables; changing language changes the actual rendered interface and persists across navigation/reload.
- [ ] Test both the base route and **every newly introduced interactive state** (opened modal, dropdown, validation error, populated form, loading/disabled states) with an automated axe WCAG 2.2 A/AA scan. Do not disable rules or filter by severity in acceptance tests.
- [ ] Visual text contrast meets WCAG AA (4.5:1 for normal text; 3:1 for qualifying large text). Relevant component boundaries, icons and focus indicators meet non-text contrast requirements (3:1 where applicable). Verify computed colors in the running browser.
- [ ] Labels are programmatically associated with inputs, keyboard use and focus order work, status/error messages are announced, and functional controls have sufficient names and descriptions.
- [ ] Verify responsive behavior, text expansion and keyboard/screen-reader use manually where automated checks cannot establish conformance.
- [ ] Add test coverage for affected locale-specific workflows and components, not just page snapshots. Assertions must verify the **translated visible content** rather than merely checking translation keys exist.
- [ ] No skips, waivers, exclusions or reduced thresholds without an explicitly reviewed issue documenting the failing requirement, affected surface, and remediation.

## CI enforcement and evidence

The current automated layers are: `pnpm i18n:check` (translation-bundle parity and interpolation), `pnpm test:a11y` (Playwright/axe), `pnpm test:visual:ci`, frontend tests, lint, and Lighthouse. For each new or changed UI workflow, include a test reaching the actual state in the accessibility suite and locale assertions for the affected controls.

The suite is **not yet exhaustive across all historical components, states, and backoffice surfaces**. Track remaining coverage in repository issues; do not assert universal compliance based solely on the passing gates. A change is not accepted if the changed UI state lacks this evidence, even when legacy test coverage is incomplete.

## Rest-time regression

`WorkoutEditor` must be tested with an exercise added (both rest fields rendered). The labels and controls must be accessible in English, German, Spanish, French and Greek, and must accept input without changing field semantics. The rest-time panel must use canonical design tokens, not hard-coded colors.
