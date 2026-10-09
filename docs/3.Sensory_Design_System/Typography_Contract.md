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

The legacy `--type-*` tokens remain for compatibility. On mobile, their size and line-height values resolve to the responsive shared role definitions. Avoid introducing new legacy aliases.

## Enforcement

Run from repository root:

```bash
pnpm typography:check
node tests/qa/check-typography-contract.test.mjs
pnpm architecture:frontend-tokens
```

The CI Architecture & Hardcoding job runs all checks on `feature`, `fix/*`, `dev`, `main` and supported pull requests. Any violation must fail CI; do not regenerate visual snapshots to hide inconsistent typography.

### Guard boundaries

The automated checker rejects raw typography declarations, unknown or duplicated role declarations and references, and divergent canonical values in active CSS. The existing hardcoding gate covers React inline design values. It does not yet prove that every legacy component uses the correct *semantic* role; this requires a source and computed-style migration audit. Backend email templates and archived code are outside the active application CSS gate.

## Changes

For any design-approved Figma typography revision: update the JSON contract and shared CSS together, adjust regression fixtures as needed, run both gates, and review visual snapshots intentionally. Never edit Backoffice-specific typography copies to override the authority.
