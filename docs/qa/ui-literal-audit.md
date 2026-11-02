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
