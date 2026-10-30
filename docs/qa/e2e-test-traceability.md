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
