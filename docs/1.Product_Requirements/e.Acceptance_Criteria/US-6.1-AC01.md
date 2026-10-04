# US-6.1-AC01: Data Export Generation

---

**AC ID**: US-6.1-AC01  
**Story ID**: [US-6.1](../d.User_stories/US-6.1-data-export.md)  
**Status**: Approved  
**Priority**: High  
**Test Method**: E2E DSR  
**Created**: 2025-01-21  
**Updated**: 2026-09-25

---

## Criterion

An authenticated user can request their portable data via `GET /api/v1/users/me/export` and receive a machine-readable export containing the applicable user, profile, session/training, exercise, points/badges and related portable records.

## Test Method

Integration + E2E DSR

## Evidence Required

- Authenticated response, export fixture, completeness assertions

## Verification

- [ ] Criterion satisfied
- [ ] Evidence linked

## Related Artifacts

- **Story**: [US-6.1](../d.User_stories/US-6.1-data-export.md)
- **Epic**: [E6](../b.Epics/E6-privacy-and-gdpr.md)
- **Requirement**: [NFR-002](../a.Requirements/NFR-002-privacy.md)
- **PRD Reference**: PRD §Privacy
- **TDD Reference**: TDD §Privacy

---

**Last Updated**: 2025-01-21  
**Verified By**: {Name/Team}  
**Verified Date**: {YYYY-MM-DD}
