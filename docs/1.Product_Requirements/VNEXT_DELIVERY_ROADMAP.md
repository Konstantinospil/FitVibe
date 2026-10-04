# FitVibe vNext Delivery Roadmap

**Baseline:** 2026-09-26  
**Branch:** `dev`  
**Purpose:** Complete the verified product, engineering, deployment and design work before creating the next FitVibe application version.

## Authority and rules

- Canonical product scope remains in the individual requirement, epic, story and acceptance-criterion files under `docs/1.Product_Requirements/`.
- Accepted ADRs remain authoritative for durable architectural decisions.
- This document is the authoritative execution sequence for vNext.
- GitHub issues are execution records. Closing an issue does not override canonical acceptance criteria or ADRs.
- Existing functionality is verified and repaired where necessary; it is not rebuilt merely because an issue title sounds broad.
- Fix forward only. Tests, CI thresholds and security controls are not weakened to obtain a green build.
- New scope discovered during a phase must be documented and assessed before implementation.
- The next version/tag/release is created only after Phase 29 passes.

## Phase sequence

### Engineering baseline

#### Phase 18 — Secrets contract repair — #265

Give Vault, AWS Secrets Manager and any retained environment fallback one predictable provider-independent contract.

Completion requires round-trip contract tests, explicit provider/fallback behavior and no secret disclosure.

#### Phase 19 — Repository/API residue quality pass — #266

Re-audit the current repository for real implementation residue: stale compatibility paths, retries/sleeps, broad catches, unsafe casts, duplicated schemas, silent defaults and other high-signal debt.

Historical findings are leads only and must be revalidated against current `dev`.

#### Phase 20 — Cross-stack test quality and flakiness audit — #267

Ensure backend, frontend, E2E and visual tests defend intended behavior rather than weak readiness signals or historical defects.

Known current lead: Logger visual regression currently waits for `Session Visibility` rather than proving the requested session is fully initialized.

#### Phase 21 — Architecture and documentation conformance review — #268

Review dependency direction, state ownership, large modules, duplicated rules, compatibility code and transaction/side-effect boundaries. Reconcile TDD/API/operations documentation with the implemented architecture.

#### Phase 22 — CI quality gate and deployment-contract enforcement — #269

Make the repaired invariants hard to regress. Validate the production deployment contract as part of CI/release preparation.

Concrete child work:
- #270 Production Compose and ClamAV deployment-contract cleanup.

### Product completion

#### Phase 23 — Measurements Completion — #260

Scope:
- #256 US-21.1 Measurement Definition Catalogue
- #257 US-21.2 User Measurement Values
- #258 US-21.3 Measurement Discovery & Profile Presentation
- #259 US-21.4 Derived Measurements
- #271 Vibeform user-facing integration decision/implementation

Finish the already-started E21 capability without replacing the existing backend model.

#### Phase 24 — Planner Completion — #261

Scope:
- #84–#88 E4 Planner stories
- accessibility dependency #139 for keyboard alternatives to dragging

Finish plan management, activation/session generation and usable accessible scheduling.

#### Phase 25 — Logging & Import Expansion — #262

Scope:
- #89–#94 E5 Logging & Import stories

Before implementation, explicitly retain or defer GPX, FIT and offline-sync scope. Manual logging semantics remain part of the phase regardless.

#### Phase 26 — Coach & Training Unit Workflows — #263

Scope:
- #247–#250 E12 Coach/Training Unit stories

Before implementation, explicitly confirm E12 remains desired product scope and review the data model before adding new persistence/routes.

#### Phase 27 — Production Readiness Closure — #264

Scope:
- #95–#100 Privacy/GDPR
- #101–#108 Performance
- #109–#115 Accessibility foundation
- #137–#144 WCAG 2.2 closure
- #116–#121 Observability
- #122–#126 Availability/DR
- #254–#255 Database/storage encryption
- #270 production Compose/ClamAV cleanup

This phase is primarily evidence and operational closure. Existing infrastructure must not be recreated merely to satisfy old story wording.

### Design and product integration

#### Phase 28 — Design and Product Integration Closure — #274

Scope:
- #271 Mount Vibeform in the user-facing profile/measurement experience
- #272 Close FitVibe design-system implementation gaps
- #273 Define/integrate the kudos "respectful nod" mark if kudos is retained for vNext

Kudos may be explicitly deferred from vNext. Vibeform must receive an explicit product disposition so an implemented production subsystem is not left unintentionally orphaned.

### Release

#### Phase 29 — vNext Release Candidate Gate — #275

The next application version is created only after this gate passes.

Required evidence:
- retained canonical GOLD acceptance criteria are Verified;
- retained SILVER scope is Done or explicitly deferred from vNext;
- Phases 18–28 are complete or have explicit, documented non-release-blocking deferrals;
- complete CI and CodeQL/security scans pass on the exact release commit;
- upgrade/migration from the currently deployed version is exercised;
- production Compose/CD contract is validated;
- backup and restore evidence is current;
- intended Windows, Android and private-remote-access smoke tests pass;
- no unresolved High-priority blocker remains;
- release notes identify implemented, deferred and operationally significant changes.

## Dependency model

The preferred sequence is:

`18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29`

This sequence is conservative. Product work may overlap with engineering phases only when the engineering phase does not affect the touched module, contract or test boundary. Overlap must not be used to bypass an unresolved correctness/security issue.

Phase 27 depends on Phase 22 because production-readiness evidence is not credible if deployment and CI contracts are still drifting.

Phase 28 follows core product completion so design integration validates the actual retained product surface rather than hypothetical screens.

Phase 29 is always last.

## GitHub Project composition

The vNext Project should contain:

- the 61 open canonical `[Current]` product-story issues;
- completed E19 issues #251–#253 for traceability;
- phase trackers #260–#269 and #274–#275;
- concrete engineering/design issues #270–#273.

Project workstreams should additionally include:
- Engineering Quality
- Deployment & Release
- Design & Product Integration
- Roadmap Coordination

Recommended additional Work type values:
- Engineering
- Design
- Roadmap

Engineering/design issues do not need a fabricated product Epic or GOLD/SILVER gate. Leave those fields empty unless a genuine canonical requirement governs the issue.

## Release-scope decisions still required

These are explicit decision gates, not accidental missing implementation:

1. GPX import retained or deferred for vNext.
2. FIT import retained or deferred for vNext.
3. Offline workout sync retained or deferred for vNext.
4. Coach/training-unit workflows retained or deferred for vNext.
5. Vibeform user-facing placement.
6. Kudos interaction/mark included in vNext or deferred.

Each decision must be recorded in the relevant phase/issue before the release gate can close.
