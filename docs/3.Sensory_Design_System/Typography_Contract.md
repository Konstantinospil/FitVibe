# FitVibe Typography Contract

**Figma authority:** [FitVibe Design System v2](https://www.figma.com/design/34p8LsvwoBCvnxSWFP6Sd9)

## Sources

- `design/typography.schema.json`: 11 approved styles and proposed/adopted mobile sizes.
- `packages/ui/src/typography.css`: **only** CSS definition of responsive role tokens.
- `tests/qa/check-typography-contract.mjs`: enforcement, including duplicate/unknown roles and drift checks.
- `tests/qa/check-typography-contract.test.mjs`: positive/negative regression fixtures.
- `tests/qa/check-architecture-hardcoding.mjs`: existing complementary guard for hardcoded design properties in CSS and React.

All values in Figma are desktop values. The mobile typography scale was approved for this implementation on 2026-10-09. Breakpoint: `max-width: 768px`. Root font size determines actual rem scaling; browser zoom and OS scaling remain supported.

## Semantic usage

Use one of the eleven named roles, not arbitrary combinations of size, weight and family:

```css
.profile-title {
  font: var(--typography-page-title);
  letter-spacing: var(--typography-page-title-letter-spacing);
}
```

You may use the equivalent `.typography-page-title` class or the individual `--typography-<role>-*` variables when a legitimate component override requires them.

Roles: `display`, `page-title`, `section-title`, `card-title`, `body`, `supporting`, `control`, `control-large`, `primary-metric`, `secondary-metric`, `metric-small`.

The legacy `--type-*` aliases are declared once in the shared stylesheet and resolve directly to responsive typography role variables. The athlete and Backoffice stylesheets do not own typography values. Avoid introducing new legacy aliases.

## Enforcement

Run from repository root:

```bash
pnpm typography:check
node tests/qa/check-typography-contract.test.mjs
pnpm architecture:frontend-tokens
```

The CI Architecture & Hardcoding job runs all checks on `feature`, `fix/*`, `dev`, `main` and supported pull requests. Any violation must fail CI; do not regenerate visual snapshots to hide inconsistent typography.

### Guard boundaries

The checker uses the PostCSS AST for active CSS and the TypeScript compiler AST for literal React/TSX typography styles. It rejects unknown or duplicate roles, unauthorized local typography declarations, and schema drift. The existing hardcoding gate provides additional coverage. A static check cannot infer every intended semantic role from an arbitrary component: computed-style and component role tests are still required for that higher-level guarantee. Backend email templates and archived code are outside the active application CSS gate.

## Changes

For any design-approved Figma typography revision: update the JSON contract and shared CSS together, adjust regression fixtures as needed, run both gates, and review visual snapshots intentionally. Never edit Backoffice-specific typography copies to override the authority.
