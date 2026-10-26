# Test ownership and CI contract inventory

This document explains the executable ownership inventory used by the FitVibe quality gate.

## Authority

- `tests/qa/test-ownership.json` is the machine-readable inventory for CI jobs, active test-suite ownership, fixture dependencies, isolation model, expected evidence, severity and status.
- `.github/workflows/ci.yml` remains the authority for how CI executes.
- Product requirements, ADRs, architecture documents and the QA plan remain authoritative for intended application behavior. The ownership inventory must never be used to rewrite an expectation merely to match current implementation.

## Enforcement

`tests/qa/assert-test-discovery.cjs` runs in the existing **Quality Gates** job. It verifies:

1. every job in `.github/workflows/ci.yml` has a declared inventory entry and no stale job entry remains;
2. declared job names and blocking/advisory severity match the workflow;
3. every active test file matches exactly one declared suite;
4. archived frontend tests are excluded only by the documented archive rule;
5. every active suite has at least one tracked test;
6. a synthetic unowned test path is rejected, proving that a broad catch-all ownership rule has not made the gate false-green.

Run locally:

```bash
node tests/qa/assert-test-discovery.cjs
```

## Adding or changing tests

When adding or moving a test, keep its ownership explicit. Prefer an existing precise suite pattern when that runner and contract genuinely own the test. Otherwise add or refine a suite entry in `tests/qa/test-ownership.json`.

Each suite records its owner, CI job IDs, contract sources, fixture dependencies, isolation model, expected artifacts/evidence, severity and active status. Patterns must remain mutually exclusive. Do not add a repository-wide catch-all merely to make discovery pass.

When a new CI job is added or renamed, update the `ci_jobs` inventory in the same change. The discovery gate fails on workflow/manifest drift.

## Failure classification

Classify CI failures as one of:

- **implementation** — application behavior violates the intended contract;
- **assertion** — the assertion does not represent the intended contract;
- **fixture** — test state/setup is incorrect or contaminated;
- **infrastructure** — runner, service, browser, network or tool execution failed independently of the application contract;
- **unresolved** — evidence is insufficient and further diagnostics are required.

For a known failure, record the run link, reproduction command or steps, owning suite/job and classification. Do not classify a failure without evidence.

## Baseline evidence for issue #556

At implementation start on 2026-10-25, the existing discovery gate classified **328 active test files** and **156 archived frontend test files**, with no orphaned active tests. The previous mechanism therefore already enforced runner ownership at a coarse level.

The missing controls addressed by #556 were reviewable ownership/contract metadata, complete CI-job inventory, mutually exclusive ownership, workflow-drift validation and an executed negative ownership control.

The feature baseline was green when this work started, so `known_failures` is intentionally empty. Historical failures and run links remain on #555/#556 and should only be promoted into the manifest when they are active and reproducible.


## Deterministic onboarding fixture contract (#557)

Frontend E2E tests use three explicit real-server onboarding states:

- **fully onboarded** — a verified non-admin athlete account provisioned once per Playwright worker, with a real, persisted 2FA invitation decision and essential-only consent; each consuming test has its own browser context and restores only its independently verified session cookies;
- **first login** — unique verified account per Playwright test, authenticated session, pending 2FA invitation, no browser consent;
- **consent required** — authenticated account with 2FA onboarding resolved but no browser consent.

The fixture contract is implemented in `tests/frontend/e2e/server-helpers.cjs` and exposed through `tests/frontend/e2e/fixtures.cjs`. Browser/session/consent cookies must not be cached in module-global mutable variables. A worker-scoped account is used only for ordinary non-destructive journeys; registration, first-login, cookie-consent and revocation journeys retain isolated state. The test UI authentication hint is initialized once per tab and must not be reset on every navigation after real login. Stateful first-login and locale-switch tests use unique accounts derived from the test identity so shard assignment or execution order cannot change their starting state.

Onboarding transitions must be verified through supported application APIs and rendered UI. Tests must not use forced clicks, hidden-overlay removal, synthetic authenticated state, blind sleeps, or automatic bypasses. Localized onboarding selectors resolve the active translation rather than matching English-only labels.

The authoritative onboarding journey remains `tests/frontend/e2e/onboarding-flow.spec.cjs`. Fixture-specific regressions live in `tests/frontend/e2e/onboarding-fixtures.spec.cjs`, including the required 2FA → consent sequencing and localized first-login state. Component regressions cover delayed status responses and failed invitation persistence. Playwright traces, screenshots, videos and browser diagnostics remain retained for genuine failures.
