# Current GitHub Backlog

**Baseline date:** 2026-10-03  
**Branch:** `feature` (PR #362 integration) / `dev`  
**Purpose:** Authoritative mapping from reconciled product documentation and the vNext engineering/design roadmap to GitHub execution issues.

## Rules

1. Canonical product scope lives in individual requirement, epic, story and acceptance-criterion files under `docs/1.Product_Requirements/`.
2. Accepted ADRs govern architectural decisions.
3. `IMPLEMENTATION_ALIGNMENT_2026-09-25.md` determines whether an issue is implementation work, closure/verification work, or genuinely new scope.
4. GitHub issue text is an execution aid, not product SSOT.
5. Historical closed issues are not reopened merely to preserve old numbering.
6. A story is not Done because code exists; its canonical ACs must be verified with the required evidence.
7. **False-positive remap (2026-10-03):** newer open issues are authoritative. Old closed false-positive issues are obsolete; missing parameters were absorbed into the open hosts or into new hosts #366–#372. Do not reopen the obsolete numbers.

## Recommended GitHub Project

**Project name:** FitVibe — vNext Delivery Roadmap

### Status field

- Backlog — valid work, not ready to start
- Ready — scope/ACs sufficiently clear and dependencies satisfied
- In Progress — implementation or active verification underway
- Blocked — external/product/architecture dependency prevents progress
- Verification — implementation exists and remaining work is evidence/AC closure
- Done — canonical ACs verified

### Additional fields

- **Canonical ID** — e.g. US-19.1
- **Epic** — E4, E5, E6, …
- **Work type** — Feature / Verification / Operations / Documentation / Engineering / Design / Roadmap
- **Priority** — High / Medium / Low
- **Gate** — GOLD / SILVER
- **Workstream** — one of the sections below, including Engineering Quality, Deployment & Release, Design & Product Integration, and Roadmap Coordination
- **Dependency** — optional blocking story/decision

### Recommended views

- **Ready next** — Status = Ready, grouped by Workstream
- **Implementation** — Work type = Feature, Status not Done
- **Verification debt** — Work type = Verification
- **Operations** — Work type = Operations
- **By epic** — grouped by Epic
- **Blocked** — Status = Blocked
- **Roadmap** — grouped by Workstream, ordered by dependency

## Current workstreams

### Profile & Settings (E1) — frontend hosts

Historical #2–#4 are obsolete false-positive closes. Execution:

- [#349](https://github.com/Konstantinospil/FitVibe_demo/issues/349) — Settings production surface (absorbs US-1.1–US-1.3 profile edit/avatar/tests + US-21.2 values / US-21.3 discovery selection)
- [#348](https://github.com/Konstantinospil/FitVibe_demo/issues/348) — Dashboard and Vibeform (US-21.3 presentation portion)
- [#271](https://github.com/Konstantinospil/FitVibe_demo/issues/271) — Mount Vibeform in user-facing profile experience

### Exercise Library (E2) — frontend / backoffice hosts

Historical #5–#6, #8–#10 are obsolete (except genuinely done #7 snapshots). Execution:

- [#347](https://github.com/Konstantinospil/FitVibe_demo/issues/347) — Library production surface (public search/list; absorbs #6 + library test share)
- [#351](https://github.com/Konstantinospil/FitVibe_demo/issues/351) — Exercise Creator (personal CRUD; absorbs #5 + test share)
- [#350](https://github.com/Konstantinospil/FitVibe_demo/issues/350) / [#289](https://github.com/Konstantinospil/FitVibe_demo/issues/289) — Workout Editor / Plan·Log selector consumers (absorbs #9)
- [#367](https://github.com/Konstantinospil/FitVibe_demo/issues/367) — Backoffice admin global exercise management (absorbs #8)
- [#338](https://github.com/Konstantinospil/FitVibe_demo/issues/338) — Workout duration/intensity estimation and library filtering (additive)

### Sharing & Community (E3)

Historical #12–#18 are obsolete false-positive closes. #11 (public feed browse) remains done. Execution:

- [#366](https://github.com/Konstantinospil/FitVibe_demo/issues/366) — E3 Social surfaces — visibility, engagement, clone, report, tests
- [#361](https://github.com/Konstantinospil/FitVibe_demo/issues/361) — Workout Nods and monthly Home Billboard (distinct from feed likes/bookmarks/comments/follow)

### Planner Completion (E4)

- [#84](https://github.com/Konstantinospil/FitVibe_demo/issues/84) — US-4.1: to create, edit, and delete training plans
- [#85](https://github.com/Konstantinospil/FitVibe_demo/issues/85) — US-4.2: to activate a plan and have sessions automatically generated
- [#86](https://github.com/Konstantinospil/FitVibe_demo/issues/86) — US-4.3: to schedule sessions using drag-and-drop on a calendar
- [#87](https://github.com/Konstantinospil/FitVibe_demo/issues/87) — US-4.4: to use touch gestures to schedule sessions
- [#88](https://github.com/Konstantinospil/FitVibe_demo/issues/88) — US-4.5: comprehensive tests for planner features

### Logging & Import (E5)

- [#89](https://github.com/Konstantinospil/FitVibe_demo/issues/89) — US-5.1: to manually log my workout sessions with metrics
- [#90](https://github.com/Konstantinospil/FitVibe_demo/issues/90) — US-5.2: to import GPX files from my fitness devices
- [#91](https://github.com/Konstantinospil/FitVibe_demo/issues/91) — US-5.3: to import FIT files with GPS and heart rate data
- [#92](https://github.com/Konstantinospil/FitVibe_demo/issues/92) — US-5.4: derived metrics (pace, elevation) to be automatically calculated
- [#93](https://github.com/Konstantinospil/FitVibe_demo/issues/93) — US-5.5: to log workouts offline and sync when I reconnect
- [#94](https://github.com/Konstantinospil/FitVibe_demo/issues/94) — US-5.6: comprehensive tests for file import functionality

### Privacy & GDPR (E6)

- [#95](https://github.com/Konstantinospil/FitVibe_demo/issues/95) — US-6.1: to export my data in JSON format
- [#96](https://github.com/Konstantinospil/FitVibe_demo/issues/96) — US-6.2: to delete my account and all associated data
- [#97](https://github.com/Konstantinospil/FitVibe_demo/issues/97) — US-6.3: to manage my consent preferences
- [#98](https://github.com/Konstantinospil/FitVibe_demo/issues/98) — US-6.4: to configure privacy settings for my profile and content
- [#99](https://github.com/Konstantinospil/FitVibe_demo/issues/99) — US-6.5: to log all GDPR-related events
- [#100](https://github.com/Konstantinospil/FitVibe_demo/issues/100) — US-6.6: comprehensive tests for GDPR flows

### Performance (E7)

- [#101](https://github.com/Konstantinospil/FitVibe_demo/issues/101) — US-7.1: API responses to be fast
- [#102](https://github.com/Konstantinospil/FitVibe_demo/issues/102) — US-7.2: database queries to be optimized
- [#103](https://github.com/Konstantinospil/FitVibe_demo/issues/103) — US-7.3: the application to load quickly
- [#104](https://github.com/Konstantinospil/FitVibe_demo/issues/104) — US-7.4: smooth page interactions
- [#105](https://github.com/Konstantinospil/FitVibe_demo/issues/105) — US-7.5: to cache frequently accessed data
- [#106](https://github.com/Konstantinospil/FitVibe_demo/issues/106) — US-7.6: to use materialized views for analytics
- [#107](https://github.com/Konstantinospil/FitVibe_demo/issues/107) — US-7.7: automated performance tests
- [#108](https://github.com/Konstantinospil/FitVibe_demo/issues/108) — US-7.8: performance metrics and dashboards

### Accessibility Foundation (E8)

- [#109](https://github.com/Konstantinospil/FitVibe_demo/issues/109) — US-8.1: proper ARIA labels on all interactive elements
- [#110](https://github.com/Konstantinospil/FitVibe_demo/issues/110) — US-8.2: to navigate all features using only the keyboard
- [#111](https://github.com/Konstantinospil/FitVibe_demo/issues/111) — US-8.3: sufficient color contrast throughout the application
- [#112](https://github.com/Konstantinospil/FitVibe_demo/issues/112) — US-8.4: the application to work with my screen reader
- [#113](https://github.com/Konstantinospil/FitVibe_demo/issues/113) — US-8.5: proper focus management in modals and dynamic content
- [#114](https://github.com/Konstantinospil/FitVibe_demo/issues/114) — US-8.6: automated accessibility tests in CI
- [#115](https://github.com/Konstantinospil/FitVibe_demo/issues/115) — US-8.7 Lighthouse accessibility regression monitoring

### Observability (E9)

- [#116](https://github.com/Konstantinospil/FitVibe_demo/issues/116) — US-9.1: structured JSON logs with correlation IDs
- [#117](https://github.com/Konstantinospil/FitVibe_demo/issues/117) — US-9.2: Prometheus metrics for all endpoints
- [#118](https://github.com/Konstantinospil/FitVibe_demo/issues/118) — US-9.3: OpenTelemetry tracing
- [#119](https://github.com/Konstantinospil/FitVibe_demo/issues/119) — US-9.4: Grafana dashboards for key metrics
- [#120](https://github.com/Konstantinospil/FitVibe_demo/issues/120) — US-9.5: alerts for critical metrics
- [#121](https://github.com/Konstantinospil/FitVibe_demo/issues/121) — US-9.6: centralized log aggregation

### Availability & Backups (E10)

- [#122](https://github.com/Konstantinospil/FitVibe_demo/issues/122) — US-10.1: automated daily encrypted backups
- [#123](https://github.com/Konstantinospil/FitVibe_demo/issues/123) — US-10.2: quarterly backup restore tests
- [#124](https://github.com/Konstantinospil/FitVibe_demo/issues/124) — US-10.3: documented and tested DR procedures
- [#125](https://github.com/Konstantinospil/FitVibe_demo/issues/125) — US-10.4: comprehensive health check endpoints
- [#126](https://github.com/Konstantinospil/FitVibe_demo/issues/126) — US-10.5: a read-only mode for maintenance

### WCAG 2.2 Closure (E13)

- [#137](https://github.com/Konstantinospil/FitVibe_demo/issues/137) — US-13.1 WCAG 2.2 Documentation Alignment
- [#138](https://github.com/Konstantinospil/FitVibe_demo/issues/138) — US-13.2 Focus Not Obscured
- [#139](https://github.com/Konstantinospil/FitVibe_demo/issues/139) — US-13.3 Keyboard Alternatives for Dragging
- [#140](https://github.com/Konstantinospil/FitVibe_demo/issues/140) — US-13.4 Pointer Target Size
- [#141](https://github.com/Konstantinospil/FitVibe_demo/issues/141) — US-13.5 Consistent Help
- [#142](https://github.com/Konstantinospil/FitVibe_demo/issues/142) — US-13.6 Redundant Entry & Form Persistence
- [#143](https://github.com/Konstantinospil/FitVibe_demo/issues/143) — US-13.7 Accessible Authentication
- [#144](https://github.com/Konstantinospil/FitVibe_demo/issues/144) — US-13.8 Programmatic Status Messages

### Coach Workflows (E12)

- [#247](https://github.com/Konstantinospil/FitVibe_demo/issues/247) — US-12.1 Training Unit CRUD
- [#248](https://github.com/Konstantinospil/FitVibe_demo/issues/248) — US-12.2 Training Unit Assignment
- [#249](https://github.com/Konstantinospil/FitVibe_demo/issues/249) — US-12.3 Exercise Parameter Modification
- [#250](https://github.com/Konstantinospil/FitVibe_demo/issues/250) — US-12.4 Coach-Athlete Relationship Management

### Legal Publication (E19) — completed in Phase 17

- [#251](https://github.com/Konstantinospil/FitVibe_demo/issues/251) — US-19.1 Publish Legal Document Snapshots — **completed**
- [#252](https://github.com/Konstantinospil/FitVibe_demo/issues/252) — US-19.2 Terms Acceptance at Registration — **completed**
- [#253](https://github.com/Konstantinospil/FitVibe_demo/issues/253) — US-19.3 Terms Re-Acceptance — **completed**

### Database Encryption (E20)

- [#254](https://github.com/Konstantinospil/FitVibe_demo/issues/254) — US-20.1 Database SSL/TLS Configuration
- [#255](https://github.com/Konstantinospil/FitVibe_demo/issues/255) — US-20.2 Encrypted Storage Volumes

### Profile Measurements (E21)

Historical #256–#258 are obsolete false-positive closes. Authoritative open hosts:

- [#368](https://github.com/Konstantinospil/FitVibe_demo/issues/368) — US-21.1 Measurement Definition Catalogue (replaces closed #256)
- [#349](https://github.com/Konstantinospil/FitVibe_demo/issues/349) — US-21.2 values + US-21.3 discovery/selection (Settings host; replaces closed #257/#258 entry paths)
- [#348](https://github.com/Konstantinospil/FitVibe_demo/issues/348) / [#271](https://github.com/Konstantinospil/FitVibe_demo/issues/271) — US-21.3 profile/Dashboard presentation
- [#259](https://github.com/Konstantinospil/FitVibe_demo/issues/259) — US-21.4 Derived Measurements
- [#260](https://github.com/Konstantinospil/FitVibe_demo/issues/260) — Phase 23 Measurements Completion (tracker)

## vNext engineering, design and roadmap work

The canonical product-story catalogue is supplemented by the following current delivery issues. They are part of the vNext Project but do not invent product requirements or Epics.

### Roadmap Coordination

- [#260](https://github.com/Konstantinospil/FitVibe_demo/issues/260) — Phase 23 Measurements Completion
- [#261](https://github.com/Konstantinospil/FitVibe_demo/issues/261) — Phase 24 Planner Completion
- [#262](https://github.com/Konstantinospil/FitVibe_demo/issues/262) — Phase 25 Logging & Import Expansion
- [#263](https://github.com/Konstantinospil/FitVibe_demo/issues/263) — Phase 26 Coach & Training Unit Workflows
- [#264](https://github.com/Konstantinospil/FitVibe_demo/issues/264) — Phase 27 Production Readiness Closure
- [#274](https://github.com/Konstantinospil/FitVibe_demo/issues/274) — Phase 28 Design and Product Integration Closure
- [#275](https://github.com/Konstantinospil/FitVibe_demo/issues/275) — Phase 29 vNext Release Candidate Gate

### Engineering Quality

- [#265](https://github.com/Konstantinospil/FitVibe_demo/issues/265) — Phase 18 Secrets contract repair
- [#266](https://github.com/Konstantinospil/FitVibe_demo/issues/266) — Phase 19 Repository/API residue quality pass
- [#267](https://github.com/Konstantinospil/FitVibe_demo/issues/267) — Phase 20 Cross-stack test quality and flakiness audit
- [#268](https://github.com/Konstantinospil/FitVibe_demo/issues/268) — Phase 21 Architecture and documentation conformance review
- [#269](https://github.com/Konstantinospil/FitVibe_demo/issues/269) — Phase 22 CI quality gate and deployment-contract enforcement
- [#369](https://github.com/Konstantinospil/FitVibe_demo/issues/369) — Application settings governance completion (absorbs obsolete #303)
- [#370](https://github.com/Konstantinospil/FitVibe_demo/issues/370) — Superadmin sudo, TOTP step-up, privilege management (absorbs obsolete #304)
- [#371](https://github.com/Konstantinospil/FitVibe_demo/issues/371) — Inventory skipped tests — fix, justify, or remove (absorbs obsolete #63)
- [#372](https://github.com/Konstantinospil/FitVibe_demo/issues/372) — Public API JSDoc coverage ≥80% (absorbs obsolete #66)
- [#339](https://github.com/Konstantinospil/FitVibe_demo/issues/339) — Make frontend hardcoding enforcement repository-wide
- [#363](https://github.com/Konstantinospil/FitVibe_demo/issues/363) — Make quality and security validation self-contained and product-authoritative

### Deployment & Release

- [#270](https://github.com/Konstantinospil/FitVibe_demo/issues/270) — Production Compose and ClamAV deployment-contract cleanup

### Design & Product Integration

- [#271](https://github.com/Konstantinospil/FitVibe_demo/issues/271) — Mount Vibeform in the user-facing profile experience
- [#272](https://github.com/Konstantinospil/FitVibe_demo/issues/272) — Close FitVibe design-system implementation gaps
- [#273](https://github.com/Konstantinospil/FitVibe_demo/issues/273) — Define and integrate the FitVibe kudos "respectful nod" mark

The complete sequencing and release gate are defined in [VNEXT_DELIVERY_ROADMAP.md](./VNEXT_DELIVERY_ROADMAP.md).

## Current/open issue invariant

After the 2026-10-03 false-positive remap:

- Open E4–E13 / E12 / E20 `[Current]` product-story issues remain as listed above (#84–#144, #247–#250, #254–#255, #259).
- Open E1–E3 / E21 execution hosts include #271, #347–#351, #361, #366–#368 (plus Settings/Dashboard #349/#348).
- New engineering hosts from remap: #367, #369–#372.
- Completed E19 issues retained for traceability: **3** (#251–#253).
- Historical obsolete false-positive closes (#2–#66 remapped set, #256–#258, #303–#304) are **not** part of the Project; comments point at authoritative opens.

Future product issues must reference canonical requirement/story/AC scope. Engineering, design and roadmap issues must reference the concrete verified gap or phase they close and must not fabricate a product Epic solely for Project metadata.

## Historical issue handling

The former duplicate imports and obsolete namespaces have been closed as not planned rather than silently rewritten into different requirements:

- old completed E1–E3 duplicates (#67–#83 and related);
- stale technical-debt issues using the canonical `US-11.*` namespace (#127–#131) — engineering debt re-hosted as #371/#372 without colliding with auth US-11.*;
- obsolete E12 decomposition;
- verification-only `US-13.9` issue after E13 was normalized to eight canonical product stories.

**2026-10-03 false-positive remap:** Issues #2–#66 (historical first import), #256–#258, #303, and #304 that were closed as completed without meeting live-app / AC gates remain closed as obsolete. Authoritative work is on open Current/delivery issues (#84–#125, #347–#351, #349/#348/#271, #366–#372, #260). They remain in GitHub history for traceability but are not part of the current backlog.
