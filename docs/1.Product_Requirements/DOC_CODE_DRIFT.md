# Docs vs code drift register

**Created**: 2026-09-01  
**Scope**: Product requirements, technical design, design system, policies. Excludes testing plans and security/review folders.  
**Status**: Historical snapshot under revalidation. The register was created before Backend Technical-Debt Reduction Pass 2 Phases 11–15 and must not be treated as a current implementation backlog without checking the live `dev` state. **Decision** records the 2026-09-01 recommendation, not an instruction to change current code.

> **Debt-confrontation rule (2026-09-24):** documentation is reconciled before implementation debt is selected. Rows that describe intentionally open product scope are backlog, not technical debt. Rows already repaired by later phases must be marked superseded rather than reimplemented.

This file is a decision log. Each row is a mismatch between documentation and the current codebase. **Suggested** is the original one-liner; **Decision** is the recommended correction: `update-doc` | `change-code` | `keep-both` | `wont-fix`.

Matching ACs are omitted. Only failing ACs, status/wording mismatches, missing artifacts, and undocumented code become rows.

## How to read types

| Type           | Meaning                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `DOC_STALE`    | Code implements the behavior; the document status or wording is wrong or outdated.              |
| `CODE_GAP`     | The document requires behavior that is missing or incomplete in code.                           |
| `DOC_INTERNAL` | Two documents disagree with each other (independent of code).                                   |
| `UNDOCUMENTED` | Code (or an epic marked Done) has no matching FR/story, or a required story/AC file is missing. |

## How to mark Decision

1. Read **Doc** (the claim) and **Code** (what exists).
2. **Decision** is filled with the recommended source of truth. Override a cell if you disagree.
3. Values: `update-doc` (docs catch up to code or shrink over-spec), `change-code` (implement or wire what docs/unused UI already require), `keep-both` (two valid surfaces; document both), `wont-fix` (real backlog or out of scope for this pass; do not pretend it shipped).

---

## 2026-09-25 Documentation Reconciliation Baseline

The following documentation decisions have now been made and incorporated into canonical artifacts. They are no longer open documentation-design questions:

- delivery lifecycle uses Open / Progressing / Done / Superseded; ACs keep Proposed / Approved / Verified / Rejected;
- individual canonical artifacts outrank indexes/catalogues; `docs/6.Implementation/` and GitHub issues are not product SSOT;
- FR-013 lockout feedback is Superseded by Phase-14 opaque authentication controls and no longer owns `US-13.*`;
- E13 owns `US-13.*` and has eight canonical product stories; E13-A11/A12 remain verification activities;
- Profile Measurements no longer reopens E1/FR-009; it is FR-014 / E21, while US-1.4 is Superseded;
- E14–E18 are legacy-completed scope; missing retrospective stories are not future backlog;
- FR-008/E16 explicitly recognize product administration plus the dedicated Backoffice surface and canonical roles `athlete`, `coach`, `support`, `admin`;
- NFR-001 removes CAPTCHA/puzzle authentication from target scope and follows ADR-030;
- NFR-004 uses WCAG 2.2 AA as normative scope; Lighthouse is a regression indicator rather than proof of conformance;
- NFR-005 standardizes quarterly full restore drills with automated backup/integrity evidence between drills;
- NFR-006/E18 define the canonical five-locale set: EN/DE/EL/ES/FR with English fallback;
- legal publication authority is an immutable Backoffice publication snapshot under ADR-032; mutable translation/Markdown sources cannot redefine a published version;
- E19 now has canonical publication, registration-acceptance, and re-acceptance stories;
- E20 verification reports are historical evidence and must be revalidated against live `dev` before backlog derivation.

**Next step:** compare this contradiction-reduced target documentation against live implementation. Rows in this historical register must be reclassified from live evidence before any GitHub Project/backlog is created.

---

## Summary

| Type         |  Count |
| ------------ | -----: |
| DOC_STALE    |     29 |
| CODE_GAP     |     40 |
| DOC_INTERNAL |     15 |
| UNDOCUMENTED |      8 |
| **Total**    | **92** |

### Recommended Decision mix

| Decision      | Count |
| ------------- | ----: |
| `update-doc`  |    65 |
| `wont-fix`    |    13 |
| `change-code` |    10 |
| `keep-both`   |     4 |

### By area

| Area                               | Rows | Dominant type |
| ---------------------------------- | ---: | ------------- |
| Cross-cutting / indexes            |   14 | DOC_INTERNAL  |
| E1 Profile                         |    3 | mixed         |
| E2–E3 Exercise / sharing           |    2 | DOC_STALE     |
| E4 Planner                         |    8 | CODE_GAP      |
| E5 Logging / import                |    7 | CODE_GAP      |
| E6 Privacy / GDPR                  |    8 | mixed         |
| E7 Performance                     |    6 | DOC_STALE     |
| E8 Accessibility                   |    5 | mixed         |
| E9 Observability                   |    3 | DOC_STALE     |
| E10 Availability                   |    5 | mixed         |
| E11 leftover tech-debt IDs         |    2 | CODE_GAP      |
| E12 Coach units                    |    2 | CODE_GAP      |
| E13 WCAG 2.2                       |    6 | mixed         |
| FR-013 Lockout UI                  |    2 | CODE_GAP      |
| E14–E18 Done epics without stories |    5 | UNDOCUMENTED  |
| E19 Terms                          |    2 | DOC_STALE     |
| E20 Encryption                     |    3 | CODE_GAP      |
| TDD / ADR / infra / modules        |    6 | DOC_STALE     |
| Policies                           |    3 | mixed         |

---

## Register

### Cross-cutting indexes and schema

| ID        | Doc                                                                                                                                                                                                                              | Code                                                                                                                                                                                                                 | Type         | Suggested                                                                                              | Decision   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ | ---------- |
| DRIFT-001 | [`0.REQUIREMENTS_SCHEMA.md`](0.REQUIREMENTS_SCHEMA.md) AC status: Proposed / Approved / Verified / Rejected. Story/epic indexes use Open / Progressing / Done. Many stories still say **Proposed**. FR-013 says **In Progress**. | n/a                                                                                                                                                                                                                  | DOC_INTERNAL | Pick one status vocabulary and apply it.                                                               | update-doc |
| DRIFT-002 | [`Requirements_Catalogue.md`](Requirements_Catalogue.md): FR-010 and FR-011 **Open**; omits FR-012 and FR-013. Summary counts “9 Done / 4 Open”.                                                                                 | [`a.Requirements/INDEX.md`](a.Requirements/INDEX.md): FR-010/011 **Done**; lists FR-012 Open and FR-013 Progressing. Code has exercise library and feed.                                                             | DOC_INTERNAL | Make the catalogue match INDEX (and code for E2/E3).                                                   | update-doc |
| DRIFT-003 | [`AC_ALL_STORIES.md`](AC_ALL_STORIES.md) **US-11.1–11.5** are tech-debt ACs (duplicate 2FA, skipped tests, timer cleanup, DB cleanup, JSDoc).                                                                                    | Canonical stories [`US-11.1-user-registration.md`](d.User_stories/US-11.1-user-registration.md)–[`US-11.3-auth-wall.md`](d.User_stories/US-11.3-auth-wall.md) are auth and **Done**. No `US-11*-AC*.md` files exist. | DOC_INTERNAL | Retag tech-debt ACs (e.g. TD-\*) and add real auth ACs, or drop the stale dump.                        | update-doc |
| DRIFT-004 | [`FR-013-lockout-ui-feedback.md`](a.Requirements/FR-013-lockout-ui-feedback.md) defines **US-13.1 / 13.2 / 13.3** (lockout UI). E13 WCAG also owns the US-13 namespace.                                                          | No `US-13.*` story files at all.                                                                                                                                                                                     | DOC_INTERNAL | Renumber lockout stories (e.g. US-11.4+) so they do not collide with WCAG.                             | update-doc |
| DRIFT-005 | NFR-004 / E8 / US-8.7-AC01: Lighthouse a11y **= 100**. E13 success: **≥ 90**.                                                                                                                                                    | [`tests/perf/lighthouserc.json`](../../tests/perf/lighthouserc.json) `minScore: 0.9`.                                                                                                                                | DOC_INTERNAL | Unify on ≥0.90 (matches CI) or raise CI to 1.0.                                                        | update-doc |
| DRIFT-006 | [`NFR-005-ops.md`](a.Requirements/NFR-005-ops.md): **monthly** restore drills.                                                                                                                                                   | [`Disaster_Recovery_Test_Plan.md`](../5.Policies/5.a.Ops/Disaster_Recovery_Test_Plan.md): **quarterly**.                                                                                                             | DOC_INTERNAL | Pick one cadence.                                                                                      | update-doc |
| DRIFT-007 | TDD `2a` Mini-RTM uses FR-1…FR-8 and roles `user`/`admin`.                                                                                                                                                                       | PRD IDs are FR-001…; workspace roles are `athlete`, `admin`, `coach`, `support`.                                                                                                                                     | DOC_INTERNAL | Remap Mini-RTM to PRD IDs and canonical role codes.                                                    | update-doc |
| DRIFT-008 | [`terms-and-conditions.md`](../5.Policies/terms-and-conditions.md), [`Privacy_Policy.md`](../5.Policies/Privacy_Policy.md), [`Cookie-policy.md`](../5.Policies/Cookie-policy.md) read as legal SSOT.                             | Runtime copy/versioning is locale JSON + ADR-024.                                                                                                                                                                    | DOC_INTERNAL | Mark policies as mirrors of locale JSON, or generate one from the other.                               | keep-both  |
| DRIFT-009 | [`NFR-001-security.md`](a.Requirements/NFR-001-security.md) and the PRD: optional **CAPTCHA** after abuse. [`E13-A9`](c.Activities/E13-A9-authentication-pattern-review.md): **no** cognitive function tests in auth.            | No CAPTCHA implementation found.                                                                                                                                                                                     | DOC_INTERNAL | Drop CAPTCHA from NFR-001 (align with WCAG 3.3.8) or document an accessible alternative if you add it. | update-doc |
| DRIFT-010 | [`FR-013-lockout-ui-feedback.md`](a.Requirements/FR-013-lockout-ui-feedback.md) **Status: In Progress**.                                                                                                                         | [`a.Requirements/INDEX.md`](a.Requirements/INDEX.md) **Progressing**.                                                                                                                                                | DOC_INTERNAL | Use the schema word Progressing.                                                                       | update-doc |
| DRIFT-011 | US-3.1–3.8 stories **Done**.                                                                                                                                                                                                     | Almost all `e.Acceptance_Criteria/US-3.*-AC*.md` still **Proposed**. Feed/social code exists.                                                                                                                        | DOC_INTERNAL | Mark those ACs Done if they pass, or reopen the stories.                                               | update-doc |
| DRIFT-012 | [`E20-VERIFICATION-REPORT.md`](b.Epics/E20-VERIFICATION-REPORT.md) claims SSL **verified** (`getSslConfig`, `rejectUnauthorized: true`, CA/cert env). Epic INDEX: **Progressing**.                                               | [`db.config.ts`](../../apps/backend/src/db/db.config.ts): `ssl: PGSSL==="true" ? { rejectUnauthorized: false }`. **No** `getSslConfig`.                                                                              | DOC_INTERNAL | Rewrite the report to match code; keep epic Progressing until strict SSL exists.                       | update-doc |
| DRIFT-013 | E13 activities link `E8-A2-keyboard-navigation.md` (and similar short names).                                                                                                                                                    | Real files are `E8-A2-keyboard-navigation-implementation.md` etc.                                                                                                                                                    | DOC_INTERNAL | Fix relative links.                                                                                    | update-doc |
| DRIFT-014 | [`FR-008-admin-and-rbac.md`](a.Requirements/FR-008-admin-and-rbac.md): roles `user`, `coach`, `admin`; JWT `roles[]`.                                                                                                            | Seeds/RBAC: `athlete`, `admin`, `coach`, `support`; JWT `role` is a scalar. Core rule: unauthenticated is not a role.                                                                                                | DOC_STALE    | Align FR-008 (and TDD) to canonical role codes.                                                        | update-doc |

### E1 Profile (FR-009)

| ID        | Doc                                                                                                                | Code                                                                                                            | Type         | Suggested                                                                        | Decision   |
| --------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- | ---------- |
| DRIFT-015 | [`E1-profile-and-settings.md`](b.Epics/E1-profile-and-settings.md) and FR-009 **Done**. Epic does not list US-1.4. | [`US-1.4-profile-measurements.md`](d.User_stories/US-1.4-profile-measurements.md) **Proposed**.                 | DOC_INTERNAL | Either demote E1/FR-009 to Progressing or fold US-1.4 into E1 as remaining work. | update-doc |
| DRIFT-016 | US-1.4 and AC01/02/04 **Proposed**: create+409, dual min/max, derived validation.                                  | [`apps/backend/src/modules/measurements/`](../../apps/backend/src/modules/measurements/) implements those APIs. | DOC_STALE    | Mark the API ACs Done/Progressing; keep UI ACs open.                             | update-doc |
| DRIFT-017 | US-1.4-AC03: profile search UI with +/− and tooltips.                                                              | Measurements `?q=` exists; **no** UI in `Profile.tsx` / Settings.                                               | CODE_GAP     | Build the UI or drop AC03.                                                       | update-doc |

US-1.1–1.3 (edit, avatar, tests) match code (`Settings.tsx`, avatar routes, profile tests). No extra rows.

### E2 Exercise / E3 Sharing

| ID        | Doc                        | Code                                                                                                                         | Type      | Suggested                         | Decision   |
| --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------- | ---------- |
| DRIFT-018 | Catalogue FR-010 **Open**. | FR-010 file + E2 **Done**; `exercise.routes.ts`, `Exercises.tsx`, `ExerciseSelector.tsx`, session `exercise_name` snapshots. | DOC_STALE | Catalogue → Done (same as INDEX). | update-doc |
| DRIFT-019 | Catalogue FR-011 **Open**. | FR-011 + E3 **Done**; `feed.routes.ts`, `Feed.tsx`, follow/clone/report.                                                     | DOC_STALE | Catalogue → Done.                 | update-doc |

### E4 Planner (FR-004)

| ID        | Doc                                                                                                                                                                  | Code                                                                                                                          | Type      | Suggested                                                                  | Decision   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------- | ---------- |
| DRIFT-020 | [`US-4.1-plan-crud.md`](d.User_stories/US-4.1-plan-crud.md) Proposed; [`E4-A1`](c.Activities/E4-A1-plan-crud-operations.md) Open. AC01–03 create/update/soft-delete. | [`plans.routes.ts`](../../apps/backend/src/modules/plans/plans.routes.ts): list/create/update/archive/delete `/api/v1/plans`. | DOC_STALE | Mark backend ACs Done; keep UI open.                                       | update-doc |
| DRIFT-021 | US-4.1: athlete creates/edits/deletes **plans** in the product.                                                                                                      | **No** frontend `/api/v1/plans` usage. [`Planner.tsx`](../../apps/frontend/src/pages/Planner.tsx) creates **sessions** only.  | CODE_GAP  | Add a plans UI or rewrite the story around session planning.               | update-doc |
| DRIFT-022 | US-4.1-AC04: ETag → 412 on stale update.                                                                                                                             | No `ETag` / `If-Match` on plans.                                                                                              | CODE_GAP  | Implement optimistic concurrency or drop the AC.                           | update-doc |
| DRIFT-023 | US-4.2-AC01: `POST /api/v1/plans/:id/activate` auto-generates sessions.                                                                                              | Plans router has `/archive` only. No activate handler.                                                                        | CODE_GAP  | Implement activate or mark the story out of scope.                         | wont-fix   |
| DRIFT-024 | US-4.2-AC03: `duration_weeks` / `target_frequency` → 422.                                                                                                            | Create schema is name/dates only.                                                                                             | CODE_GAP  | Add fields or drop the AC.                                                 | update-doc |
| DRIFT-025 | US-4.2-AC02: progress on session complete.                                                                                                                           | `recomputeProgress` from [`sessions.service.ts`](../../apps/backend/src/modules/sessions/sessions.service.ts).                | DOC_STALE | Mark this AC Done if it covers session-plan progress, not “plan activate”. | update-doc |
| DRIFT-026 | US-4.3-AC01–04: calendar DnD reschedule `planned_at`; month/week/day views.                                                                                          | `SessionPlanner` reorders **exercises** only. `SessionCalendar.tsx` is display-ish and not the Planner schedule DnD.          | CODE_GAP  | Implement calendar session DnD or narrow the story to exercise reorder.    | update-doc |
| DRIFT-027 | US-4.4: touch drag/resize on the planner calendar.                                                                                                                   | No planner touch-gesture handling.                                                                                            | CODE_GAP  | Implement or defer.                                                        | wont-fix   |

### E5 Logging and import (FR-005)

| ID        | Doc                                                                                            | Code                                                                                     | Type      | Suggested                                                          | Decision   |
| --------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ | ---------- |
| DRIFT-028 | [`US-5.1-manual-logging.md`](d.User_stories/US-5.1-manual-logging.md) and E5-A1 Proposed/Open. | [`Logger.tsx`](../../apps/frontend/src/pages/Logger.tsx) + `PATCH /api/v1/sessions/:id`. | DOC_STALE | Mark the core logging story Progressing/Done.                      | update-doc |
| DRIFT-029 | US-5.1-AC01/03: duration, distance, HR + unit conversion.                                      | Logger captures sets/reps/weight-style fields, not duration/distance/HR.                 | CODE_GAP  | Add those metrics or narrow the AC to what Logger actually stores. | update-doc |
| DRIFT-030 | US-5.2 / E5-A2: `POST /api/v1/sessions/import` GPX.                                            | No GPX parser or import route.                                                           | CODE_GAP  | Implement or keep Open as a real gap.                              | wont-fix   |
| DRIFT-031 | US-5.3 / E5-A3: FIT import.                                                                    | None.                                                                                    | CODE_GAP  | Same as GPX.                                                       | wont-fix   |
| DRIFT-032 | US-5.4: pace/elevation derived from GPS tracks.                                                | No track-derived metrics in sessions.                                                    | CODE_GAP  | Same as import.                                                    | wont-fix   |
| DRIFT-033 | US-5.5: IndexedDB / SW offline log + sync.                                                     | No service worker or offline queue.                                                      | CODE_GAP  | Implement PWA sync or defer.                                       | wont-fix   |
| DRIFT-034 | US-5.6: import tests.                                                                          | No import tests (nothing to test).                                                       | CODE_GAP  | Follows DRIFT-030/031.                                             | wont-fix   |

### E6 Privacy / GDPR (NFR-002)

| ID        | Doc                                             | Code                                                                                                                                                                                                         | Type      | Suggested                                                                 | Decision    |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------- | ----------- |
| DRIFT-035 | US-6.1 / E6-A1 Proposed/Open; AC01 JSON export. | `GET /api/v1/users/me/export` + [`DataExportButton.tsx`](../../apps/frontend/src/components/profile/DataExportButton.tsx).                                                                                   | DOC_STALE | Mark API Done.                                                            | update-doc  |
| DRIFT-036 | US-6.1: export available from Settings.         | `DataExportButton` is **not** used in [`Settings.tsx`](../../apps/frontend/src/pages/Settings.tsx).                                                                                                          | CODE_GAP  | Mount the button (or another export entry) on Settings.                   | change-code |
| DRIFT-037 | US-6.1-AC02: 24h secure download link.          | Export is an immediate ZIP attachment (`exportData` / `collectUserData`).                                                                                                                                    | CODE_GAP  | Add expiring links or rewrite the AC to “immediate download”.             | update-doc  |
| DRIFT-038 | US-6.2 / E6-A2 Proposed/Open.                   | `DELETE /api/v1/users/me` + Settings delete + [`dsr.service.ts`](../../apps/backend/src/modules/users/dsr.service.ts).                                                                                       | DOC_STALE | Mark Done.                                                                | update-doc  |
| DRIFT-039 | US-6.3 full consent management Proposed/Open.   | Cookie-only: [`consent.routes.ts`](../../apps/backend/src/modules/consent/consent.routes.ts), `CookieConsent.tsx`.                                                                                           | DOC_STALE | Narrow the story to cookie consent, or implement remaining consent types. | update-doc  |
| DRIFT-040 | US-6.4 ACs: privacy settings UI + persist.      | [`PrivacySettings.tsx`](../../apps/frontend/src/components/profile/PrivacySettings.tsx) calls `/api/v1/users/me/privacy`. **No** matching route in `users.routes.ts`. Component **not** mounted on Settings. | CODE_GAP  | Add the backend route and mount the UI, or remove the dead client.        | change-code |
| DRIFT-041 | US-6.5 GDPR audit Proposed/Open.                | `insertAudit` on export/delete; consent audits.                                                                                                                                                              | DOC_STALE | Mark the shipped events Done.                                             | update-doc  |
| DRIFT-042 | US-6.5-AC02: audit log exportable.              | Admin `GET /api/v1/logs` can filter; no dedicated audit-export endpoint.                                                                                                                                     | CODE_GAP  | Add export or drop that AC.                                               | update-doc  |

### E7 Performance (NFR-003)

| ID        | Doc                                                            | Code                                                                                                       | Type      | Suggested                                                              | Decision   |
| --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- | ---------- |
| DRIFT-043 | US-7.1 / E7-A1: per-endpoint API p95 program.                  | [`tests/perf/k6-smoke.js`](../../tests/perf/k6-smoke.js) hits health/metrics/root only.                    | CODE_GAP  | Keep Open; smoke ≠ the program.                                        | wont-fix   |
| DRIFT-044 | US-7.2 “queries optimized”.                                    | Indexes/MVs exist; not a finished optimization program.                                                    | CODE_GAP  | Keep Progressing; do not mark Done.                                    | wont-fix   |
| DRIFT-045 | US-7.3 / 7.4 bundle + CWV Proposed; E7-A3/A4 Open.             | LHCI budgets in CI / `lighthouserc.json`. Not proof of passing CWV in production.                          | DOC_STALE | Mark “budgets exist” Progressing; keep pass/fail ACs open until green. | update-doc |
| DRIFT-046 | US-7.5 / E7-A5 Proposed/Open: cache frequently accessed data.  | [`cache.service.ts`](../../apps/backend/src/services/cache.service.ts) (Redis/memory) used on heavy paths. | DOC_STALE | Mark Done/Progressing.                                                 | update-doc |
| DRIFT-047 | US-7.6 / E7-A6 Proposed/Open: materialized views.              | Migration `202608310012_create_views_and_helpers.ts` + refresh script.                                     | DOC_STALE | Mark Done.                                                             | update-doc |
| DRIFT-048 | US-7.7 / 7.8 Proposed/Open: automated perf tests + dashboards. | CI k6 job + [`infra/observability/grafana/`](../../infra/observability/grafana/).                          | DOC_STALE | Mark Done for the shipped slice.                                       | update-doc |

### E8 Accessibility (NFR-004)

| ID        | Doc                                          | Code                                                                                                                                    | Type      | Suggested                                                                   | Decision    |
| --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- | ----------- |
| DRIFT-049 | US-8.1, 8.2, 8.4, 8.6 Proposed; E8-A\* Open. | Widespread `aria-*`, keyboard helpers, `ScreenReaderOnly`, CI `accessibility` job / axe Playwright.                                     | DOC_STALE | Progress those stories; do not claim “all elements/features” until audited. | update-doc  |
| DRIFT-050 | US-8.3-AC01: sufficient contrast throughout. | `accessibility.spec.cjs` **disables** `color-contrast` on Dashboard.                                                                    | CODE_GAP  | Fix Dashboard contrast or record an exemption in the AC.                    | change-code |
| DRIFT-051 | US-8.5-AC01: focus trapped in modals.        | [`FocusTrap.tsx`](../../apps/frontend/src/components/a11y/FocusTrap.tsx) is exported but **unused**. `Modal.tsx` has no Tab-cycle trap. | CODE_GAP  | Wire FocusTrap into Modal.                                                  | change-code |
| DRIFT-052 | US-8.7: perfect Lighthouse a11y (100).       | CI `minScore: 0.9`.                                                                                                                     | CODE_GAP  | See DRIFT-005 — lower the AC or raise CI.                                   | update-doc  |
| DRIFT-053 | US-8.4 live regions as a dedicated pattern.  | [`LiveRegion.tsx`](../../apps/frontend/src/components/a11y/LiveRegion.tsx) unused; ad-hoc `aria-live` elsewhere.                        | CODE_GAP  | Use LiveRegion consistently or describe the ad-hoc pattern in the story.    | update-doc  |

### E9 Observability (NFR-007)

| ID        | Doc                                                                | Code                                                                                                                                                    | Type      | Suggested                                               | Decision   |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------- | ---------- |
| DRIFT-054 | NFR-007 and E9 **Open**; US-9.1–9.6 **Proposed**; E9-A\* **Open**. | Pino + `X-Request-Id`; `GET /metrics`; OTEL [`tracing.ts`](../../apps/backend/src/observability/tracing.ts); Grafana dashboards; Loki/Promtail configs. | DOC_STALE | Set epic/NFR to Progressing; mark shipped stories Done. | update-doc |
| DRIFT-055 | US-9.2 “Prometheus metrics for **all** endpoints”.                 | Metrics exist; not proven per-endpoint coverage.                                                                                                        | CODE_GAP  | Narrow the wording or add missing instruments.          | update-doc |
| DRIFT-056 | US-9.5-AC02: alerts to PagerDuty/Slack/email.                      | [`alert-rules.yml`](../../infra/observability/alert-rules.yml) has rules; **no** Alertmanager receivers/channels.                                       | CODE_GAP  | Add receivers or drop the channel AC.                   | update-doc |

### E10 Availability (NFR-005)

| ID        | Doc                                                                | Code                                                                                                                                   | Type      | Suggested                                                                        | Decision    |
| --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- | ----------- |
| DRIFT-057 | NFR-005: **`/healthz`**.                                           | Mounted **`GET /api/v1/health`** in [`health.router.ts`](../../apps/backend/src/modules/health/health.router.ts) → `{ status: "ok" }`. | DOC_STALE | Document `/health` or add `/healthz`.                                            | update-doc  |
| DRIFT-058 | US-10.1 / E10-A1: automated **daily** encrypted backups (CronJob). | [`infra/scripts/backup-database.sh`](../../infra/scripts/backup-database.sh) exists; **no** k8s CronJob / CI schedule.                 | CODE_GAP  | Add a scheduler or keep the story Open.                                          | update-doc  |
| DRIFT-059 | NFR-005: retain **30** days of daily backups.                      | Script `RETENTION_DAYS` default **14**.                                                                                                | CODE_GAP  | Align default to 30 or change the NFR.                                           | update-doc  |
| DRIFT-060 | US-10.4: comprehensive health (readiness/liveness, DB/storage).    | Shallow `/health` only; no DB probe.                                                                                                   | CODE_GAP  | Add probes or downgrade the AC.                                                  | change-code |
| DRIFT-061 | US-10.2, 10.3, 10.5 Proposed/Open.                                 | `restore-database.sh`, DR plan doc, system read-only + [`Maintenance.tsx`](../../apps/frontend/src/pages/Maintenance.tsx).             | DOC_STALE | Mark shipped slices Done; keep “quarterly restore **job**” open (no automation). | update-doc  |

### E11 Auth (FR-001/002/003) and leftover US-11 tech debt

Canonical US-11.1–11.3 (registration, session, auth-wall) match `auth` + `ProtectedRoute`. No row for those stories.

| ID        | Doc                                                                           | Code                                                                                                                                                                                                                                    | Type     | Suggested                                         | Decision    |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------- | ----------- |
| DRIFT-063 | AC_ALL_STORIES US-11.1: delete `twofa.service.ts`; single 2FA implementation. | Both [`twofa.service.ts`](../../apps/backend/src/modules/auth/twofa.service.ts) (login verify, used by `auth.service.ts`) and [`two-factor.service.ts`](../../apps/backend/src/modules/auth/two-factor.service.ts) (manage 2FA) remain. | CODE_GAP | Merge or document the split (see also DRIFT-003). | keep-both   |
| DRIFT-064 | AC_ALL_STORIES US-11.2: review/fix skipped tests.                             | `it.skip` still in bruteforce integration and `db.config` SSL tests.                                                                                                                                                                    | CODE_GAP | Fix, justify, or drop those tests.                | change-code |

### E12 Coach training units (FR-012)

| ID        | Doc                                                                                                                | Code                                                          | Type         | Suggested                                  | Decision |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------ | ------------------------------------------ | -------- |
| DRIFT-065 | FR-012 / E12 / US-12.1–12.4 **Open**: training-unit CRUD, assignment, parameter mods, coach–athlete relationships. | **No** training-unit module, routes, or tables under `apps/`. | CODE_GAP     | Expected Open — implement or defer the FR. | wont-fix |
| DRIFT-066 | US-12.\* stories exist.                                                                                            | **Zero** `US-12*-AC*.md` files.                               | UNDOCUMENTED | Author ACs if the epic stays in scope.     | wont-fix |

### E13 WCAG 2.2 (NFR-004)

| ID        | Doc                                                                                                     | Code                                                                                                                  | Type         | Suggested                                                                      | Decision    |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ | ----------- |
| DRIFT-067 | E13: “user stories will be created”. Activities E13-A1–A12 exist.                                       | **No** `US-13.*` story files (and FR-013 already took US-13.1–13.3).                                                  | UNDOCUMENTED | Create WCAG stories with IDs that do not collide (e.g. US-13.4+ or US-E13.\*). | update-doc  |
| DRIFT-068 | E13-A4 / A5 / A6 / A11 **Open**: focus-visible, keyboard drag alternatives, 44px targets, axe wcag22aa. | `global.css` `:focus-visible` and 44px targets; `SessionPlanner` arrow reorder; axe tags include `wcag22aa`.          | DOC_STALE    | Mark those activities Progressing/Done if you accept the current coverage.     | update-doc  |
| DRIFT-069 | E13-A7: help in consistent locations (3.2.6).                                                           | Footer has terms/privacy; no consistent Contact/help slot across forms.                                               | CODE_GAP     | Add a shared help pattern.                                                     | change-code |
| DRIFT-070 | E13-A8: form data persist on validation errors (3.3.7).                                                 | Controlled inputs keep in-memory values on some forms (e.g. Register); **no** draft/localStorage persistence pattern. | CODE_GAP     | Define whether in-memory is enough; if not, implement drafts.                  | update-doc  |
| DRIFT-071 | E13-A10: status messages announced.                                                                     | Ad-hoc `aria-live`; unused `LiveRegion.tsx`.                                                                          | CODE_GAP     | Same as DRIFT-053.                                                             | update-doc  |
| DRIFT-072 | E13-A1/A2/A3 **Done** (design tokens, ADR-020, NFR-004 wording).                                        | Docs/CSS updated; NFR-004 still also claims full 2.2 while E13 is Progressing (DRIFT-005/009).                        | DOC_STALE    | Fine as Done **docs** work; do not treat as product 2.2 complete.              | update-doc  |

### FR-013 Lockout UI

| ID        | Doc                                                     | Code                                                                                                                                                                                 | Type         | Suggested                                         | Decision    |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------- | ----------- |
| DRIFT-073 | FR-013: countdown + remaining-attempt counter on login. | [`LockoutTimer.tsx`](../../apps/frontend/src/components/LockoutTimer.tsx) and `AttemptCounter` exist with tests. **Not imported** in `LoginFormContent.tsx` (plain `setError` text). | CODE_GAP     | Mount the components and pass `remainingSeconds`. | change-code |
| DRIFT-074 | FR-013 defines US-13.1–13.3.                            | No story files (see DRIFT-004).                                                                                                                                                      | UNDOCUMENTED | Add stories under a non-colliding ID.             | update-doc  |

### E14–E18 (Done epics with no stories)

| ID        | Doc                                                                                                              | Code                                                                                                                                                     | Type         | Suggested                                                          | Decision   |
| --------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ | ---------- |
| DRIFT-075 | E14–E18 files + INDEX **Done**. Related stories/activities are placeholders.                                     | No `US-14.*`…`US-18.*` and no `E14`–`E18` activity files.                                                                                                | UNDOCUMENTED | Backfill stories/ACs or demote status until the work is traceable. | update-doc |
| DRIFT-076 | [`E14-gamification.md`](b.Epics/E14-gamification.md) / FR-006 Done: points, badges, anti-gaming, bounded totals. | [`modules/points/`](../../apps/backend/src/modules/points/) (points, badges, streaks, seasonal). No leaderboard / anomaly / revoke APIs found.           | CODE_GAP     | Mark Done only for shipped slices; AC the rest or cut it.          | update-doc |
| DRIFT-077 | E15 / FR-007 Done: analytics + CSV/JSON export.                                                                  | [`progress`](../../apps/backend/src/modules/progress/) summary/trends/export. [`Progress.tsx`](../../apps/frontend/src/pages/Progress.tsx) / Insights.   | DOC_STALE    | Keep Done if you accept missing stories (still DRIFT-075).         | update-doc |
| DRIFT-078 | E16 / FR-008 Done: in-app admin + RBAC.                                                                          | Frontend `/admin/*` **and** [`apps/backoffice`](../../apps/backoffice/) SPA (users, translations, messages, audit). FR-008 does not describe backoffice. | UNDOCUMENTED | Extend FR-008/E16 for dual admin surfaces, or consolidate.         | keep-both  |
| DRIFT-079 | [`NFR-006-i18n.md`](a.Requirements/NFR-006-i18n.md) / E18 Done: **EN + DE only**.                                | Locales `en`, `de`, `el`, `es`, `fr` under `apps/frontend/src/i18n/locales/`.                                                                            | DOC_STALE    | Update NFR/E18 to five locales.                                    | update-doc |

### E19 Terms (REQ-2025-01-20-001)

| ID        | Doc                                        | Code                                                                                                                                                                                   | Type         | Suggested                                             | Decision   |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- | ---------- |
| DRIFT-080 | E19 + REQ **Open**; no stories/activities. | [`Terms.tsx`](../../apps/frontend/src/pages/Terms.tsx), [`TermsReacceptance.tsx`](../../apps/frontend/src/pages/TermsReacceptance.tsx), Register `terms_accepted`, auth `acceptTerms`. | DOC_STALE    | Set Progressing/Done and add US/AC linked to ADR-024. | update-doc |
| DRIFT-081 | E19: “stories will be created”.            | None.                                                                                                                                                                                  | UNDOCUMENTED | Author stories if the requirement stays GOLD.         | update-doc |

### E20 Encryption (NFR-008)

| ID        | Doc                                                                                     | Code                                                                                                                  | Type         | Suggested                                         | Decision    |
| --------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------- | ----------- |
| DRIFT-082 | NFR-008 / ADR-026 / `DATABASE_ENCRYPTION_SETUP.md`: prod verify-full SSL. US-20.1 Open. | `rejectUnauthorized: false` when `PGSSL=true`.                                                                        | CODE_GAP     | Implement env-aware strict SSL or weaken the NFR. | change-code |
| DRIFT-083 | US-20.2: encrypted storage volumes.                                                     | `storage-class-encrypted.yaml` and backup encrypt scripts exist; rotation not implemented (E20 report).               | CODE_GAP     | Keep Open until deploy/rotation is real.          | wont-fix    |
| DRIFT-084 | E20 epic links `docs/6.Implementation/` as verification.                                | [`6.Implementation/README.md`](../6.Implementation/README.md) is a stub; real report is `E20-VERIFICATION-REPORT.md`. | DOC_INTERNAL | Point the epic at the colocated report only.      | update-doc  |

### Technical design, modules, infra

| ID        | Doc                                                                                                                                                                                           | Code                                                                                                                                  | Type         | Suggested                                         | Decision   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------- | ---------- |
| DRIFT-085 | [`modules/README.md`](../../apps/backend/src/modules/README.md): module index; “all registered in `index.ts`”. Omits consent, contact, translations, measurements.                            | Those four exist. Consent/admin/system also mounted from [`app.ts`](../../apps/backend/src/app.ts) (`/consent`, `/admin`, `/system`). | DOC_STALE    | Update README + TDD 2b to the real mount graph.   | update-doc |
| DRIFT-086 | TDD modules list does not own consent / contact / translations / measurements as first-class modules.                                                                                         | Live routers as above.                                                                                                                | UNDOCUMENTED | Add them to TDD 2b and the FR that owns each.     | update-doc |
| DRIFT-087 | [ADR-023](../2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR-023-server-side-rendering.md) Accepted: **streaming** SSR (`renderToPipeableStream`), `src/server.tsx`. | [`ssr/render.tsx`](../../apps/frontend/src/ssr/render.tsx) uses **`renderToString`**.                                                 | DOC_STALE    | Update ADR to string SSR, or implement streaming. | update-doc |
| DRIFT-088 | [`INFRASTRUCTURE.md`](../2.Technical_Design_Document/INFRASTRUCTURE.md): frontend = React SPA via NGINX.                                                                                      | SSR Node server (`apps/frontend/server.ts`) exists.                                                                                   | DOC_STALE    | Document SSR + reverse-proxy topology.            | update-doc |
| DRIFT-089 | ADR-023 context still describes a **client-only SPA**.                                                                                                                                        | SSR is implemented (non-streaming).                                                                                                   | DOC_STALE    | Refresh Context now that SSR shipped.             | update-doc |
| DRIFT-090 | [`project-structure.md`](../2.Technical_Design_Document/project-structure.md) lists backoffice.                                                                                               | Backoffice app exists; no FR (DRIFT-078).                                                                                             | UNDOCUMENTED | Same decision as dual admin.                      | keep-both  |

Design-system tokens in `3.b` match `global.css` `--vibe-*`. No row.

### Policies

| ID        | Doc                                                                                                                                         | Code                                                                            | Type      | Suggested                                                             | Decision    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- | ----------- |
| DRIFT-092 | [`PASSWORD_AND_AUTHENTICATION_POLICY.md`](../5.Policies/5.a.Ops/PASSWORD_AND_AUTHENTICATION_POLICY.md): **Argon2id**; no composition rules. | **bcryptjs** + composition regex in `auth.schemas.ts`. TDD 2a also says bcrypt. | DOC_STALE | Align policy with TDD/code (bcrypt + composition) or migrate hashing. | update-doc  |
| DRIFT-093 | Same policy: admin MFA required; breach/reuse checks.                                                                                       | 2FA is optional user setting; no pwned/reuse check found.                       | CODE_GAP  | Enforce admin MFA and/or soften the policy.                           | change-code |
| DRIFT-094 | [`KEY_MANAGEMENT_POLICY.md`](../5.Policies/5.a.Ops/KEY_MANAGEMENT_POLICY.md): DB AES keys, 6-month rotation.                                | JWT runbook exists; E20 report: key rotation **not** implemented.               | CODE_GAP  | Implement rotation ops or narrow the policy.                          | wont-fix    |

User-flow doc `3.c` (points on complete, progress export) matches code. No row.

---

## 2026-09-24 revalidation notes

The following snapshot findings are already superseded by later implementation and must not drive duplicate repair work:

- **DRIFT-082** (production PostgreSQL certificate verification): current code owns SSL construction in `apps/backend/src/db/ssl-config.ts`; production enables certificate verification, while relaxed verification is limited to development or explicit configuration. The old row describes the pre-repair `db.config.ts` implementation.
- **DRIFT-063** (two 2FA services): the current split has distinct responsibilities: login-stage verification and 2FA lifecycle/administration. Do not merge them solely because the historical AC dump called the split debt; only a demonstrated duplicated invariant or dependency problem justifies consolidation.
- Phase 14 deliberately removed public lockout counters/reasons from the authentication surface to prevent credential/enrollment disclosure. Historical lockout-UI rows and ACs must therefore be reconciled to the opaque-challenge contract rather than used to restore those disclosures.
- Phase 15 made the email blacklist authoritative/fail-closed, encrypted persisted TOTP secrets, and added step-up authentication to sensitive 2FA administration. Any earlier row or policy statement claiming those controls are absent requires revalidation against PR #240.

Open feature scope such as planner activation/DnD, GPX/FIT import, offline sync, coach units, comprehensive observability channels, or automated backup scheduling remains product backlog unless a completed phase or accepted requirement explicitly claims it is shipped. The debt-confrontation pass will not implement such scope merely to make this historical register reach zero rows.

## Suggested review order

1. **DOC_INTERNAL** rows (DRIFT-001–014, 084) — fix the map before changing code.
2. **Safe DOC_STALE statuses** (E2/E3 catalogue, E5.1 logger, E6.2 delete, E9 stack, E19 terms, NFR-006 locales).
3. **CODE_GAP product holes** (planner activate/DnD, GPX/FIT/offline, privacy route, lockout UI, coach units, SSL).
4. **UNDOCUMENTED** (E14–E18 stories, backoffice, measurements UI, FR-013 stories).

Cheap `change-code` slice (lockout UI, Settings export/privacy, FocusTrap, prod SSL) is applied in app code after these decisions. Remaining `change-code` rows (Dashboard contrast, health probes, skipped tests, WCAG help, admin MFA) stay for a later pass. `update-doc` rows are not applied in this pass.
