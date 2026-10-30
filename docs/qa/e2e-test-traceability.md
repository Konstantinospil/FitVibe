# E2E smoke traceability and execution contract

The authoritative machine-checked matrix is [e2e-smoke-traceability.json](../../tests/qa/e2e-smoke-traceability.json). It maps 18 stable case IDs to scenario descriptions, requirements, logical stages and independently provisioned fixtures.

## Logical stages, not execution dependencies

A useful review order is public/authentication → onboarding → authenticated navigation → CRUD and workout workflows → revocation and negative tests. **This is for coverage review, not scheduling.** Playwright sharding, parallelism, retries and test filtering may execute any case first. No test may rely on another test to create records or dismiss modals.

| Fixture contract | Required state before a test's functional assertion |
| --- | --- |
| `public-page` | Fresh page context, essential-only consent established via the application API |
| `worker-athlete` | Verified worker account and session; completed onboarding; persisted essential-only consent |
| `disposable-athlete` | Newly registered and verified per-test account; consent reverified after login identity rotation; 2FA invitation resolved |

Explicit consent-lifecycle tests use `consentRequiredPage`, which **must not** inherit a preaccepted consent state.

## Enforcement

`node tests/qa/assert-test-discovery.cjs` invokes `check-e2e-traceability.cjs`. It rejects missing or duplicated `[E2E-SMOKE-NNN]` IDs, stale titles, unknown fixture contracts and inter-test dependencies. It is called in the existing CI Quality Gates job.

Future cases should receive a new permanent ID (never renumber existing cases) and a matrix entry. This first increment covers the smoke suite; other E2E suites can be migrated independently once ownership and requirements are audited.

## All Playwright suites (migration extension)

The CI discovery gate now also enumerates **frontend E2E and accessibility**, **visual regression**, and **backoffice E2E** test cases, including dynamically generated scenarios and every VRT project variant. It produces `tests/qa/reports/e2e-traceability.json` and `.md`, and uploads them as the `e2e-traceability-<run id>` artifact in the Quality Gates job.

The discovery matrix is generated from the tests that Playwright actually collects (`playwright test --list`), rather than guessing which loops or nested `describe` blocks declare tests. Each discovered scenario is related to the suite's authoritative `tests/qa/test-ownership.json` contract sources and fixture dependencies.

Existing smoke tests retain **explicit, permanent IDs**. Other cases receive a deterministic ID derived from suite, file path, and expanded title (for example `E2E-FRONTEND-...` and `E2E-VISUAL-...`); the generated matrix is the authority for those IDs. If the file or title changes, its generated ID changes, which must be reviewed as a traceability change. IDs must not be used to force a test sequence.

Use `node tests/qa/assert-test-discovery.cjs` to enforce both the existing ownership manifest and all-suite discovery mapping. Failures block CI; a report is not silently assumed valid if collection fails.
