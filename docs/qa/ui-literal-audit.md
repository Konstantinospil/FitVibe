# UI literal audit

The repository scanner `tests/qa/audit-ui-literals.cjs` uses the TypeScript compiler
AST to identify **every nonempty string, JSX text node and template expression**
in `apps/frontend/src` and `apps/backoffice/src` (`.ts`, `.tsx`, `.js`,
`.jsx`, `.mjs`, `.cjs`). It also inventories static HTML content and
CSS `content:` declarations.

## Run

```bash
pnpm install --frozen-lockfile
pnpm ui-literals:test
pnpm ui-literals:audit
# After all candidates have been reviewed and remediated:
pnpm ui-literals:strict
```

CI runs the scanner's regression tests and inventory mode on each eligible push/PR
and uploads `tests/qa/reports/ui-literals.json` (complete, machine-readable)
plus `tests/qa/reports/ui-literals.md` (human review list) as a workflow artifact
for 90 days. Reports are generated; do not commit them.

## Classification

- `ui` — probable directly displayed text: JSX children, accessible labels,
  placeholders, display metadata, confirmation dialogs, alerts, toasts.
- `review` — ambiguous literals, including array-based options, intermediate
  state/formatters, and unrecognized props. **Do not discard these.** Inspect
  where their values are used.
- `technical` — import paths, translation keys, module references, CSS classes,
  API paths, known identifiers, logs, discriminators and related literals.
  These remain in the JSON report for manual reclassification if required.

Findings include `file`, `line`, `column`, `kind`, `text`,
`classification`, `reason`, and `id`. IDs are deterministic per
file/kind/text/occurrence and do not depend on line numbers.

## Remediation process

1. Review the JSON inventory, **including technical-labeled entries**.
2. For actual user-visible copy, move it to translation resources and invoke
   the application's localization adapter. Do not localize internal keys,
   standards-defined protocol strings, or native language names solely to
   eliminate warnings.
3. Inspect uncertain `review` findings and trace values to their render
   locations; dynamic content may require integration/UI testing.
4. Add localization regression tests for affected screens and languages.
5. Only after zero unresolved UI/review candidates remain, make
   `pnpm ui-literals:strict` a required CI gate.

## Limits

No static scanner can prove that **all runtime-visible text** is localized.
Messages fetched from an API, DOM mutations, third-party libraries, generated
strings and external documents need separate runtime/integration testing.
AST classification is intentionally conservative: false positives must be
triaged, not deleted or hidden from the report. The static HTML/CSS inventory
uses targeted source parsing rather than TypeScript AST because these are not
TypeScript grammars. The inventory deliberately excludes archived source,
declaration files and tests.

## Second layer: backend and data-contract audit

\`pnpm ui-data-contracts:audit\` scans the backend and shared type sources
with TypeScript AST. It inventories error constructors (including stable
HTTP error codes), server-controlled display fields, seed labels and
frontend/backend message passthroughs. It compares collected error codes
against the five locales' error translations. It writes:
- \`tests/qa/reports/ui-data-contracts.json\` (complete inventory)
- \`tests/qa/reports/ui-data-contracts.md\` (human review)

\`pnpm ui-data-contracts:strict\` fails on any unresolved candidate. No
database connection is used: this static scan cannot determine whether
persisted dynamic content was supplied by a user or an application seed.
Those records require separate read-only, permission-scoped database review.

## Third layer: real-browser localization audit

\`tests/frontend/e2e/runtime-localization.spec.cjs\` uses the existing
Playwright E2E infrastructure, including a real backend and production
frontend image. It opens public Login/Registration and authenticated
Home/Calendar/Library/Dashboard/Settings for each supported language:
EN, DE, FR, ES and EL. The browser captures visible DOM text and user-facing
attributes. It compares rendered text with localized translation resources,
flags unresolved translation keys, and cross-references the static source
literal inventory. Each scenario attaches full structured findings to the
standard Playwright report and prints per-locale counts to CI logs.

Run locally with the existing Playwright environment:
\`\`\`bash
pnpm exec playwright test tests/frontend/e2e/runtime-localization.spec.cjs \
  --config tests/frontend/e2e/playwright.config.cjs
\`\`\`

**Interpretation:** An English fallback that exactly matches a translated
English resource is stronger evidence than a generic hardcoded text match.
Untranslated source literal matches remain review candidates. Text that is
intentionally the same across languages, user-generated posts, and
third-party text require human evaluation. The test only covers the listed
routes and visible states; do not represent it as exhaustive of all
interactive flows. Runtime collection is advisory while existing findings
are triaged, but actual language/locale selection and expected login
translations are asserted.

