# Implementation Alignment Baseline — 2026-09-25

**Branch assessed:** `dev`  
**Purpose:** Compare the contradiction-free canonical product documentation against the live implementation before deriving GitHub Project backlog items.  
**Authority:** This is an evidence/assessment document. Canonical product scope remains in the individual requirement, epic, story and AC files. Accepted ADRs remain authoritative for architectural decisions.

## Assessment rules

- **Done** is not inferred from code presence alone. A story is Done only after its acceptance criteria are verified with the required evidence.
- **Progressing** means meaningful implementation exists but one or more criteria, surfaces, tests or operational evidence remain incomplete/unverified.
- **Open** means no meaningful implementation was found for the canonical story.
- Historical `DOC_CODE_DRIFT.md`, old GitHub issue imports and `docs/6.Implementation/` were used only as leads and were rechecked against current `dev`.
- Only verified remaining gaps should become future GitHub Project items.

## Product functionality

| Scope | Assessment | Current evidence | Remaining gap / verification |
| --- | --- | --- | --- |
| E4 / US-4.1 Plan CRUD | Progressing | Backend `plans` router/service implements list/create/get/update/archive/delete. | Product UI still plans individual sessions rather than managing plans; optimistic concurrency/ETag requirement not evidenced. |
| E4 / US-4.2 Activation & Progress | Progressing | Plan progress recomputation exists and is triggered from session state. | No plan activation endpoint/session generation flow found. |
| E4 / US-4.3 Drag-and-Drop | Open | Current Planner reorders exercises with explicit up/down actions. | Calendar drag/drop scheduling not found. |
| E4 / US-4.4 Mobile Touch | Open | No canonical touch scheduling implementation found. | Implement/verify touch scheduling only if retained after UX review. |
| E4 / US-4.5 Planner Testing | Open | Existing tests cover pieces of sessions/plans. | End-to-end canonical planner workflow is not yet evidenced. |
| E5 / US-5.1 Manual Logging | Progressing | Logger/session write paths exist. | Canonical duration/distance/HR and related verification require reconciliation against current logger semantics. |
| E5 / US-5.2 GPX Import | Open | No GPX parser/import route found. | Implement if retained in product scope. |
| E5 / US-5.3 FIT Import | Open | No FIT parser/import route found. | Implement if retained in product scope. |
| E5 / US-5.4 Derived Track Metrics | Open | No GPS-track-derived pace/elevation pipeline found. | Depends on import/track-data scope. |
| E5 / US-5.5 Offline Sync | Open | No service worker/IndexedDB sync queue found. | Implement or explicitly defer product scope. |
| E5 / US-5.6 Import Testing | Open | Import functionality is not present. | Follows GPX/FIT implementation. |
| E6 / US-6.1 Data Export | Progressing | Export API and reusable DataExportButton exist. | Current behavior is immediate download rather than the old 24h expiring-link AC; canonical AC should reflect the intended UX before completion. |
| E6 / US-6.2 Account Deletion | Progressing | Pending-deletion state, DSR service, purge processing and frontend/API integration exist. | Operational proof of backup propagation/retention remains required before Done. |
| E6 / US-6.3 Consent Management | Open/Partial | Cookie-consent functionality exists. | Broad consent-preference model described by the old story is not evidenced; scope should be narrowed or implemented. |
| E6 / US-6.4 Privacy Settings | Progressing | Privacy components/default visibility infrastructure exist. | Full profile-field privacy semantics need verification. |
| E6 / US-6.5 GDPR Audit Logging | Progressing | Audit infrastructure and deletion/terms events exist. | Verify all canonical GDPR event classes and retention/search expectations. |
| E6 / US-6.6 GDPR Testing | Progressing | DSR and related integration/unit tests exist. | Complete criterion-level coverage/evidence. |
| E12 / US-12.1–12.4 | Open | No training-unit/coach-athlete application module, routes or tables found. | Entire canonical E12 remains future product work unless explicitly deferred. |
| E19 / US-19.1 Publication Snapshots | Done | Phase 17 adds persisted legal publications, immutable per-language snapshots, Backoffice publication, integrity metadata, audit records and explicit change/user-action classification. | Verified against the current Phase 17 implementation and canonical story/AC. |
| E19 / US-19.2 Registration Acceptance | Done | Registration requires explicit Terms acceptance, resolves the current published Terms snapshot and records acceptance against its immutable publication ID. | Verified against the current Phase 17 implementation and canonical story/AC. |
| E19 / US-19.3 Re-Acceptance | Done | Re-acceptance status derives from persisted legal publications; required user action is driven by the latest effective publication while editorial/no-action publications remain auditable without forcing re-acceptance. | Verified against the current Phase 17 implementation and canonical story/AC. |
| E21 / US-21.1 Measurement Catalogue | Progressing | Measurement migration, seeded catalogues, normalized uniqueness, CRUD/list service exist. | Final ACs and administration/ownership semantics must be verified. |
| E21 / US-21.2 User Measurement Values | Progressing | Bio/performance value tables and authenticated value endpoints exist. | Frontend/profile workflow and historical semantics require verification. |
| E21 / US-21.3 Discovery & Presentation | Progressing | Search/list and visibility-selection backend semantics exist. | Complete profile UI was not evidenced. |
| E21 / US-21.4 Derived Measurements | Progressing | Model/service support source IDs and derived operator validation. | End-to-end calculation/update behavior and UI are not yet evidenced. |

## Non-functional scope

| Scope | Assessment | Current evidence | Remaining gap / verification |
| --- | --- | --- | --- |
| E7 Performance | Progressing | Lighthouse budgets, k6 load script, materialized views, caching infrastructure and performance dashboards exist. | Story-level targets must be verified against CI/runtime evidence; do not recreate already implemented infrastructure as backlog. |
| E8 Accessibility | Progressing | axe Playwright suite and Lighthouse CI exist. | Axe coverage is limited to selected pages; Dashboard currently disables color-contrast rule; manual keyboard/screen-reader evidence remains. |
| E9 / NFR-007 Observability | Progressing | Structured logging/request IDs, Prometheus metrics, OpenTelemetry, Grafana dashboards, Loki/Promtail configuration exist. | Metrics coverage, trace sampling policy, dashboard completeness, alert delivery channels and log-retention semantics remain partially unverified/incomplete. |
| E10 / US-10.4 Health Checks | Progressing | Basic health endpoint and Kubernetes health infrastructure exist. | Canonical dependency-aware readiness/liveness behavior is not fully evidenced. |
| E10 / US-10.5 Read-Only Mode | Progressing | Global mutation guard, admin endpoints, Backoffice controls, audit events and tests exist. | AC verification should explicitly cover admin toggle/environment startup semantics and activation timing before Done. |
| E10 Backup/DR | Progressing | DR/restore documentation exists; infrastructure references restore tooling. | Current executable automated encrypted backup/restore evidence and actual drill records require verification. |
| E13 WCAG 2.2 | Progressing | WCAG 2.2 axe tags are used and documentation is now aligned. | Criterion-specific A/AA verification, color contrast, dragging alternatives, help consistency, form persistence and manual evidence remain to be checked individually. |
| E20 / US-20.1 DB TLS | Progressing | `getSslConfig` enforces strict production certificate verification and has unit tests; `db.config.ts` uses it. | Live/integration TLS connection evidence and monitoring/failure behavior are still required by the ACs. |
| E20 / US-20.2 At-Rest Encryption | Progressing | Encrypted Kubernetes storage-class template exists. | Provider/runtime-specific deployment proof and encrypted backup/restore verification are not established by the repository template alone. |

## Status corrections implied by this assessment

The following top-level documentation statuses should be **Progressing**, not Open, because meaningful current implementation exists:

- NFR-007 / E9 Observability
- REQ-2025-01-20-001 / E19 Terms and Conditions
- FR-014 / E21 Profile Measurements

E12 remains **Open** because no meaningful implementation was found.

## Future GitHub Project derivation

The future project must not import old issues wholesale. Its initial work items should be generated from **remaining verified gaps**, grouped approximately as:

1. **Planner completion** — plan UI, activation/session generation, calendar scheduling, mobile interaction, verification.
2. **Logging/import expansion** — only if GPX/FIT/offline remain desired scope.
3. **Privacy completion** — consent scope decision, remaining privacy controls, operational DSR evidence.
4. **Coach workflows** — E12, if still strategically desired.
5. **Legal publication** — ADR-032 snapshots/publication, then adapt acceptance and re-acceptance to snapshot identity.
6. **Measurements completion** — profile UI, final derived behavior and canonical AC verification rather than rebuilding the existing backend.
7. **Accessibility closure** — specific unresolved WCAG 2.2 A/AA criteria and manual verification.
8. **Observability/operations closure** — sampling, alert delivery, retention, readiness/liveness, backup/restore evidence.
9. **Database encryption closure** — integration/deployment verification and at-rest evidence.

Items that are already materially implemented should appear as verification/documentation work only where evidence is missing, not as feature implementation stories.

## Post-Phase-17 execution plan

Phase 17 (E19 legal publication) is complete. The complete vNext sequence is defined in `VNEXT_DELIVERY_ROADMAP.md`. The former product-only Phase 18–22 numbering has been corrected so the previously retained engineering-quality Phases 18–22 are not overwritten.

### Engineering baseline

1. **Phase 18 — Secrets contract repair** — tracking #265.
2. **Phase 19 — Repository/API residue quality pass** — tracking #266.
3. **Phase 20 — Cross-stack test quality and flakiness audit** — tracking #267.
4. **Phase 21 — Architecture and documentation conformance review** — tracking #268.
5. **Phase 22 — CI quality gate and deployment-contract enforcement** — tracking #269; concrete production Compose/ClamAV work #270.

### Product completion

6. **Phase 23 — Measurements Completion** — tracking #260; stories #256–#259; Vibeform integration #271.
7. **Phase 24 — Planner Completion** — tracking #261; stories #84–#88.
8. **Phase 25 — Logging & Import Expansion** — tracking #262; stories #89–#94; GPX/FIT/offline scope requires explicit retention/defer decisions.
9. **Phase 26 — Coach & Training Unit Workflows** — tracking #263; stories #247–#250; E12 requires explicit retention/defer decision.
10. **Phase 27 — Production Readiness Closure** — tracking #264; privacy, performance, accessibility, observability, availability/DR and encryption closure plus #270.

### Design/integration and release

11. **Phase 28 — Design and Product Integration Closure** — tracking #274; Vibeform #271, design system #272, kudos mark #273 if retained.
12. **Phase 29 — vNext Release Candidate Gate** — tracking #275. No new application version/tag/release is created before this gate passes.

### Sequencing rules

- Each phase begins from current `dev`; implementation presence is not completion without canonical acceptance-criterion evidence where canonical ACs apply.
- Engineering issues are not given fabricated product Epics or GOLD/SILVER gates merely to fit Project metadata.
- Product phases may overlap engineering phases only when the engineering work does not affect the same contract/module/test boundary.
- CI/test gates must not be weakened to make a phase pass. Fix forward only.
- Scope expansion discovered during a phase must be documented and assessed before implementation.
- Phase 29 is the release boundary, not another implementation phase.

## Historical GitHub issues

- Issues #2–#66: historical closed first import.
- Issues #67–#131: stale second import of the old 65-story model; not current backlog.
- Issues #133–#136: old E12 decomposition; IDs conflict with current canonical E12 stories.
- Issues #137–#145: pre-reconciliation E13 import; useful historical input only.

These should be reconciled/closed as obsolete or superseded only after the new Project structure is approved; they must not be migrated automatically.
