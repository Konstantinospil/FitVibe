# ADR-018: CI/CD with GitHub Actions and GHCR

**Date:** 2025-10-14  
**Status:** Accepted  
**Last reconciled with workflow:** 2026-10-03  
**Cross-References:** PRD §7 Engineering Standards; PRD §5 NFRs; QA plan; ADR-028

---

## Context

FitVibe requires CI that is both reproducible and honest about what it proves. A green run must mean that the checks protecting a release actually passed; informational uploads or synthetic harnesses must not be described as production validation.

The executable workflow in `.github/workflows/ci.yml` is the source of truth. This ADR records the intended contract and must be updated when that contract changes.

## Decision

### 1. Triggers and release path

- Pull requests run the full CI validation graph.
- Pushes to `main` and `dev` run CI.
- Container publication is performed only for a successful push to `main`.
- CD is triggered from a successful `main` CI run and deploys the exact digest-pinned, signed images produced by that run.
- The production deploy verifies cosign OIDC identity and refuses mutable image references.

### 2. Hard quality gates

The release graph requires all of the following before image publication:

- architecture/hardcoding policy checks;
- manifest validation, dependency audit, lint and typecheck;
- backend, frontend and backoffice tests;
- database migration/seed tests;
- enforced backend/frontend coverage;
- integration and metrics-contract tests;
- accessibility;
- repository-native security aggregation;
- CodeQL compatibility;
- OWASP ZAP baseline;
- OpenAPI and contract tests;
- i18n;
- Lighthouse;
- real-stack k6 performance smoke;
- visual regression;
- authoritative Playwright E2E;
- deployment-contract and release-governance checks;
- QA summary enforcement.

`qa_summary` runs even when an upstream job fails so that diagnostics can still be produced, but its final enforcement step fails unless every required job concluded successfully.

### 3. E2E authority

The E2E job automatically discovers every `*.spec.cjs` under `tests/frontend/e2e`, except `accessibility.spec.cjs`, which has its own hard gate. This prevents newly added E2E specs from silently existing outside CI.

E2E specifications must describe active production surfaces. Tests for intentionally retired routes are updated or archived rather than kept as misleading dormant coverage.

The backoffice has its own Playwright gate that verifies the privilege wall for unauthenticated, non-admin and admin sessions.

### 4. Performance evidence

Lighthouse runs against the built SSR frontend and currently enforces:

- performance category >= 0.60;
- accessibility, best-practices and SEO >= 0.90;
- JavaScript <= 300 KiB;
- LCP <= 2875 ms.

The lower aggregate Lighthouse performance floor does not override the explicit LCP and bundle-size budgets.

k6 no longer targets a mock server. CI migrates and seeds a real PostgreSQL database, builds and starts the FitVibe backend, and exercises real health, governance, exercise-type and translation routes. The CI profile is a repeatable regression smoke load, not a certification of production capacity or the historical 500 req/s design target.

A relative p95 regression baseline may be added only after it has been calibrated from repeated real-stack runs. Until then, absolute endpoint budgets remain hard gates; a synthetic mock baseline must not be used.

### 5. Coverage and external services

The repository's own `test:coverage:gate` is the authoritative coverage gate. Codecov is a supplementary reporting service and `fail_ci_if_error: false` is intentional so a Codecov outage cannot override a passing repository-native coverage calculation.

### 6. Supply-chain controls

- GitHub Actions are pinned by commit SHA.
- Multi-architecture images are built for amd64 and arm64.
- Images are pushed by digest and assembled into manifests.
- SBOM/provenance artifacts are produced by the release path.
- Images are signed with keyless cosign/OIDC.
- CD verifies signatures and exact digests before deployment.

### 7. Caching and determinism

CI currently disables turbo remote caching and installs from the frozen pnpm lockfile. Documentation must not claim active CI caching unless the workflow actually enables and validates it.

### 8. Reporting

Job summaries must reflect actual job outcomes. Informational checks, such as container image-size reporting, must be labelled informational unless an explicit threshold is enforced.

---

## Consequences

**Positive**

- A successful release build now transitively and explicitly requires security, architecture, DAST and E2E checks.
- Performance results measure FitVibe code and a real PostgreSQL data path instead of a toy server.
- Dormant E2E files cannot create an illusion of coverage.
- Backoffice privilege protection has executable CI coverage.
- External reporting services remain useful without becoming accidental single points of failure.

**Trade-offs**

- Main/PR CI is slower because the release graph deliberately waits for more meaningful checks.
- Real-stack performance measurements have more runner variance than a mock server; thresholds must therefore be calibrated conservatively and tightened from evidence.

---

## Status Log

| Version | Date       | Change |
| ------- | ---------- | ------ |
| v1.0 | 2025-10-14 | Initial CI/CD ADR |
| v1.1 | 2026-09-03 | Record Node 24 action and application runtime |
| v1.2 | 2026-10-03 | Reconcile ADR with live DAG; make architecture/E2E/ZAP/CodeQL/backoffice release gates; replace mock k6 with real backend/Postgres smoke; document actual Lighthouse and Codecov semantics |
