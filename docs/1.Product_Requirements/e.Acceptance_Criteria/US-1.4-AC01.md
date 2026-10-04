# US-1.4-AC01: Attribute Creation and Duplicate Prevention

---

**AC ID**: US-1.4-AC01  
**Story ID**: [US-1.4](../d.User_stories/US-1.4-profile-measurements.md)  
**Status**: Rejected  
**Priority**: High  
**Test Method**: Integration + API negative  
**Created**: 2026-01-04  
**Updated**: 2026-09-25

---

## Supersession

Rejected as an active acceptance criterion because parent story US-1.4 is superseded. The underlying intent is restructured under FR-014/E21 and will receive canonical E21 acceptance criteria after documentation-to-implementation comparison.

## Criterion

Creating a biometric or performance attribute with name, unit type, granularity, min value, max value, and measurement system persists the attribute within ≤500ms, and any subsequent create attempt with a normalized duplicate name (trimmed, case-insensitive, and collapsed whitespace) is rejected with 409.

**SMART Criteria Checklist**:

- **Specific**: Attribute creation fields and duplicate rule are defined
- **Measurable**: Response time ≤500ms and 409 on duplicates
- **Achievable**: Standard validation and uniqueness checks
- **Relevant**: Core to global attribute management
- **Time-bound**: Response time constraint specified

## Test Method

Integration tests validate successful creation and negative tests validate duplicate rejection.

## Evidence Required

- API request/response logs with timing
- DB row showing stored attribute metadata
- API negative test result showing 409 on duplicate

## Verification

- [ ] Criterion is specific and measurable
- [ ] Test method is appropriate
- [ ] Evidence requirements are clear

## Related Artifacts

- **Story**: [US-1.4](../d.User_stories/US-1.4-profile-measurements.md)
- **Epic**: [E1](../b.Epics/E1-profile-and-settings.md)
- **Requirement**: [FR-009](../a.Requirements/FR-009-profile-and-settings.md)
- **PRD Reference**: PRD §Profile & Settings
- **TDD Reference**: TDD §Profile & Settings

---

**Last Updated**: 2026-09-25  
**Verified By**: {Name/Team}  
**Verified Date**: {YYYY-MM-DD}
