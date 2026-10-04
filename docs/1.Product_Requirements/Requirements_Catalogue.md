# FitVibe Requirements Catalogue

**Version**: 3.0  
**Last Updated**: 2026-09-25  
**Status**: Active

---

## Purpose

This catalogue is a synchronized navigation summary of the canonical requirement files in `a.Requirements/`. It is **not** an independent source of requirement status or scope. If this catalogue disagrees with an individual requirement file, the individual canonical file wins and the catalogue must be corrected.

The lifecycle for delivery artifacts is `Open → Progressing → Done`, with `Superseded` retained for historical traceability.

## Functional Requirements

| ID | Title | Status | Priority | Gate | Canonical file |
| --- | --- | --- | --- | --- | --- |
| FR-001 | User Registration | Done | High | GOLD | [FR-001-user-registration.md](a.Requirements/FR-001-user-registration.md) |
| FR-002 | Login & Session | Done | High | GOLD | [FR-002-login-and-session.md](a.Requirements/FR-002-login-and-session.md) |
| FR-003 | Auth-Wall | Done | High | GOLD | [FR-003-authwall.md](a.Requirements/FR-003-authwall.md) |
| FR-004 | Planner | Progressing | Medium | SILVER | [FR-004-planner.md](a.Requirements/FR-004-planner.md) |
| FR-005 | Logging & Import | Progressing | Medium | SILVER | [FR-005-logging-and-import.md](a.Requirements/FR-005-logging-and-import.md) |
| FR-006 | Gamification | Done | Medium | SILVER | [FR-006-gamification.md](a.Requirements/FR-006-gamification.md) |
| FR-007 | Analytics & Export | Done | High | GOLD | [FR-007-analytics-and-export.md](a.Requirements/FR-007-analytics-and-export.md) |
| FR-008 | Admin & RBAC | Done | High | GOLD | [FR-008-admin-and-rbac.md](a.Requirements/FR-008-admin-and-rbac.md) |
| FR-009 | Profile & Settings | Done | Medium | SILVER | [FR-009-profile-and-settings.md](a.Requirements/FR-009-profile-and-settings.md) |
| FR-010 | Exercise Library | Done | Medium | SILVER | [FR-010-exercise-library.md](a.Requirements/FR-010-exercise-library.md) |
| FR-011 | Sharing & Community | Done | Medium | SILVER | [FR-011-sharing-and-community.md](a.Requirements/FR-011-sharing-and-community.md) |
| FR-012 | Coach Training Unit Assignment | Open | High | SILVER | [FR-012-coach-training-unit-assignment.md](a.Requirements/FR-012-coach-training-unit-assignment.md) |
| FR-013 | Lockout UI Feedback & Countdown Timer | Superseded | Medium | SILVER | [FR-013-lockout-ui-feedback.md](a.Requirements/FR-013-lockout-ui-feedback.md) |
| FR-014 | Profile Measurements | Progressing | High | SILVER | [FR-014-profile-measurements.md](a.Requirements/FR-014-profile-measurements.md) |

## Non-Functional Requirements

| ID | Title | Status | Priority | Gate | Canonical file |
| --- | --- | --- | --- | --- | --- |
| NFR-001 | Security | Done | High | GOLD | [NFR-001-security.md](a.Requirements/NFR-001-security.md) |
| NFR-002 | Privacy | Progressing | High | GOLD | [NFR-002-privacy.md](a.Requirements/NFR-002-privacy.md) |
| NFR-003 | Performance | Progressing | High | GOLD | [NFR-003-performance.md](a.Requirements/NFR-003-performance.md) |
| NFR-004 | Accessibility | Progressing | High | GOLD | [NFR-004-a11y.md](a.Requirements/NFR-004-a11y.md) |
| NFR-005 | Availability & Backups | Progressing | High | SILVER | [NFR-005-ops.md](a.Requirements/NFR-005-ops.md) |
| NFR-006 | Internationalization | Done | Medium | SILVER | [NFR-006-i18n.md](a.Requirements/NFR-006-i18n.md) |
| NFR-007 | Observability | Progressing | Medium | SILVER | [NFR-007-observability.md](a.Requirements/NFR-007-observability.md) |
| NFR-008 | Database Encryption | Progressing | High | GOLD | [NFR-008-database-encryption.md](a.Requirements/NFR-008-database-encryption.md) |

## Other Requirements

| ID | Title | Status | Priority | Gate | Canonical file |
| --- | --- | --- | --- | --- | --- |
| REQ-2025-01-20-001  | Terms and Conditions Acceptance | Done | High | GOLD | [REQ-2025-01-20-001-terms-and-conditions.md](a.Requirements/REQ-2025-01-20-001-terms-and-conditions.md) |

## Status Summary

- **Done**: 12
- **Progressing**: 9
- **Open**: 1
- **Superseded**: 1
- **Total**: 23

## Maintenance

1. Change requirement scope/status in the canonical individual requirement file.
2. Synchronize `a.Requirements/INDEX.md`.
3. Synchronize this catalogue and downstream traceability summaries.
4. Do not use GitHub issues or `docs/6.Implementation/` working notes to override canonical product documentation.

---

**Last Reviewed**: 2026-09-25  
**Next Review**: after implementation comparison
