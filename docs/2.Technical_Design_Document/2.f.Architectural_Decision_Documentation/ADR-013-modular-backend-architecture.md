# ADR-013: Modular Backend Architecture (Router → Service → Repository)

**Date:** 2025-10-14  
**Status:** Accepted  
**Author:** Reviewer  
**Cross-References:** PRD §6 (API & domains), §5 (Security/NFR); TDD §3–§7 (architecture, schema, modules), §10 (build/run); QA §2–§9 (CI), §11 (performance), §12 (security), §14 (perf-regression)

---

## Context

We need a backend that isolates web routing from business logic and data access, supports strict security and observability, and scales with clear domain boundaries. The PRD defines core domains (auth, users, exercises, sessions/workouts, progress, points/rewards, feed/social). The TDD requires a **three-layer architecture** with testable contracts and database migrations. The QA plan enforces CI gates for lint/type checks, unit/integration/E2E tests, security scanning, and perf budgets (API p95 < 300 ms).

Goals:

- Keep controllers thin and framework-agnostic logic in services.
- Centralize data access and transactions in repositories using SQL migrations.
- Enable cross-cutting concerns (authn/z, audit logging, input validation, caching) via middleware/utilities without leaking into business logic.

---

## Decision

1. **Layering Pattern**
   - **Router (HTTP layer):** Express routers per domain module. Responsibilities: request parsing, schema validation, authn, coarse RBAC guard, calling services, HTTP error mapping, and response serialization. No DB access here.
   - **Service (domain layer):** Pure business logic; coordinates repositories and domain rules; opens/joins transactions; enforces fine-grained authorization; emits domain events.
   - **Repository (data layer):** SQL via Knex; owns queries, pagination, and data mapping (DB ↔ DTO). No HTTP/express code.

2. **Domain Modules (initial set)**
   - `auth`, `users`, `exercises`, `sessions` (workouts), `progress`, `points`, `feed`.
   - Each module exports: `router`, `service`, `repository`, `types`, `validators`, `mappers`, and `events`.

3. **Contracts & Types**
   - **DTOs** in `packages/types` define request/response shapes; **Zod** (or equivalent) validators shared by router and tests.
   - **Error model:** `DomainError(code, message, details?)` with HTTP mapping in a central middleware; no raw DB errors cross the router boundary.
   - **Idempotency:** Write endpoints accept `Idempotency-Key`; service layer ensures deterministic replay and 409 on payload mismatch (per policy).

4. **Transactions & Consistency**
   - Services open a transaction for multi-repository operations; pass `trx` to repos; commit/rollback at service boundary.
   - Use **FOR UPDATE** where needed; avoid long-lived transactions; prefer upserts with constraints for counters/points.

5. **Authorization**
   - Router: verifies JWT (access token) and coarse role scopes.
   - Service: enforces resource ownership and row-level rules (e.g., user can only mutate own sessions; admins limited to admin routes).

6. **Audit & Observability**
   - Middleware emits audit events for CRUD/security actions (no PII in payload). Correlation ID propagated.
   - Prometheus metrics: request latency histograms per route; domain counters (created/updated/deleted), auth failures, and cache hit ratio.

7. **Caching & Performance**
   - Read paths can consult a cache layer (in-memory/Redis) abstracted via `cache.get/set/invalidate`. Services define cache keys and invalidation when writes occur.
   - CI budgets: API **p95 < 300 ms** overall; endpoint groups: auth ≤200 ms, CRUD ≤300 ms, feed ≤400 ms, analytics ≤600 ms.

8. **Validation, localization, and user preferences**
   - All inputs validated at the router using shared schemas; server errors localized via token catalogs (for user-facing messages), while logs remain English.
   - Profile identity/content and user preferences are separate domain contracts even when their persistence currently shares the `users` table.
   - `preferred_lang` is the authoritative persisted **user language preference**; `units` is the authoritative persisted **measurement-system preference**. They are exposed and mutated through the preferences service/API, not the profile-update contract.
   - `locale` is a distinct account/localization attribute and must not be silently treated as, synchronized with, or overwritten by the language preference. A future product decision may define explicit synchronization, but it must be deliberate rather than inferred from similarly named fields.
   - Sharing a database row does not make profile and preferences one service boundary; repository/service ownership follows the domain contract.

9. **Asynchrony & Events**
   - Services can emit domain events to an internal queue for side effects (notifications, analytics materialization). Event handling is idempotent and retried with backoff.

10. **Folder Structure (backend app)**

```
apps/backend/src/
├─ modules/
│  ├─ auth/
│  │  ├─ router.ts
│  │  ├─ service.ts
│  │  ├─ repository.ts
│  │  ├─ validators.ts
│  │  ├─ types.ts
│  │  └─ events.ts
│  ├─ users/ …
│  ├─ exercises/ …
│  ├─ sessions/ …
│  ├─ progress/ …
│  ├─ points/ …
│  └─ feed/ …
├─ core/
│  ├─ db/ (knex client, migrations, seeds)
│  ├─ cache/
│  ├─ auth/ (JWT, RBAC)
│  ├─ audit/
│  ├─ errors/
│  ├─ http/ (express app, middlewares, error-map)
│  ├─ config/
│  └─ observability/ (metrics, tracing)
└─ index.ts
```

11. **Security Defaults**

- Security headers (CSP no `unsafe-inline`, HSTS, Referrer-Policy, Permissions-Policy), strict CORS allowlist.
- CSRF protection for state-changing routes when cookies are in use.
- Input size limits; upload handling uses object storage with AV scan (no base64 blobs in DB).

12. **Testing**

- **Unit:** services with mocked repositories; repositories with a test DB.
- **Integration:** routers → services → repos against ephemeral Postgres; seeds + migrations per run.
- **E2E:** Playwright flows across key user journeys.
- **Performance:** k6 smoke with budgets; fail CI on >10% regression.
- **Security:** ZAP baseline (auth), dependency scan; deny on high CVEs.

---

## Consequences

**Positive**

- Clear separation of concerns, easier testing, and safer refactors.
- Built-in seams for caching, audit, and events without leaking across layers.
- Enforced security and performance budgets via CI and shared utilities.

**Negative / Trade-offs**

- Slight boilerplate overhead (validators, mappers, DTOs) per module.
- Strict boundaries require discipline for cross-module interactions (use service interfaces).

**Operational**

- Lint rules prevent forbidden imports (router ↔ repo). Pre-commit hooks check types and formatting.
- Migration discipline required; every schema change must ship with forward/backfill steps.

---

## Alternatives Considered

| Option                                | Description                                    | Reason Rejected                                                       |
| ------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Controller fat models (active record) | Put logic in models, call directly from routes | Tight coupling; hard to test; violates TDD layering                   |
| Service + direct SQL in routes        | Keep two layers only                           | Encourages DB access from HTTP; cross-cutting concerns leak           |
| Microservices now                     | Split each domain into its own service         | Overhead not justified for MVP; start modular monolith, revisit later |

---

## References

- PRD: domains, security baselines, API route overview
- TDD: architecture & modules, database migrations, runtime contracts
- QA: CI stages, perf budgets, a11y/security checks

---

## Status Log

| Version | Date       | Change                                                           | Author   |
| ------- | ---------- | ---------------------------------------------------------------- | -------- |
| v1.0    | 2025-10-14 | Initial ADR: modular monolith with Router → Service → Repository | Reviewer |
| v1.1    | 2026-09-24 | Record Phase 9 profile/preferences ownership boundary and explicit distinction between persisted language preference and locale | FitVibe Engineering / Product Owner |
