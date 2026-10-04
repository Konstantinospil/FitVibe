# US-1.4-AC03: Attribute Search, Add/Remove, and Tooltips

---

**AC ID**: US-1.4-AC03  
**Story ID**: [US-1.4](../d.User_stories/US-1.4-profile-measurements.md)  
**Status**: Rejected  
**Priority**: High  
**Test Method**: E2E  
**Created**: 2026-01-04  
**Updated**: 2026-09-25

---

## Supersession

Rejected as an active acceptance criterion because parent story US-1.4 is superseded. The underlying intent is restructured under FR-014/E21 and will receive canonical E21 acceptance criteria after documentation-to-implementation comparison.

## Criterion

Typing in the profile attribute search returns matching global attributes within ≤300ms per keystroke, shows a tooltip with unit, granularity, and min/max values for each result, and allows users to add (+) or remove (-) attributes from their displayed list with persistence after refresh.

**SMART Criteria Checklist**:

- **Specific**: Search behavior, tooltip content, and add/remove actions are defined
- **Measurable**: Response time ≤300ms and persistence after refresh
- **Achievable**: Standard UI search and persistence logic
- **Relevant**: Core discovery and personalization of measurements
- **Time-bound**: Response time constraint specified

## Test Method

E2E tests validate search, tooltip details, add/remove actions, and persistence.

## Evidence Required

- E2E run results with timing assertions
- Screenshots showing tooltip metadata
- Persistence proof via refreshed page state

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
