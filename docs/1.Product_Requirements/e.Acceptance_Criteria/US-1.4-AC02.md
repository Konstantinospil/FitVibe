# US-1.4-AC02: Measurement Systems and Min/Max Conversion

---

**AC ID**: US-1.4-AC02  
**Story ID**: [US-1.4](../d.User_stories/US-1.4-profile-measurements.md)  
**Status**: Rejected  
**Priority**: High  
**Test Method**: Integration  
**Created**: 2026-01-04  
**Updated**: 2026-09-25

---

## Supersession

Rejected as an active acceptance criterion because parent story US-1.4 is superseded. The underlying intent is restructured under FR-014/E21 and will receive canonical E21 acceptance criteria after documentation-to-implementation comparison.

## Criterion

When an attribute is created with a measurement system and min/max values, the system stores and returns min/max values in both metric and imperial systems using fixed conversion factors and rounding to two decimals, within ≤500ms.

**SMART Criteria Checklist**:

- **Specific**: Measurement systems, conversion, and rounding are defined
- **Measurable**: Response time ≤500ms and two-decimal rounding
- **Achievable**: Standard conversion logic
- **Relevant**: Enables consistent min/max validation
- **Time-bound**: Response time constraint specified

## Test Method

Integration tests verify conversion and persistence in both systems.

## Evidence Required

- API response showing both metric and imperial min/max values
- DB row showing stored converted values
- Test log documenting conversion factors used

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
