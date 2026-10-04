# US-8.7-AC01: Lighthouse Score Target

---

**AC ID**: US-8.7-AC01
**Story ID**: [US-8.7](../d.User_stories/US-8.7-lighthouse-compliance.md)
**Status**: Proposed
**Priority**: High
**Test Method**: Lighthouse CI
**Created**: 2025-01-21
**Updated**: 2026-09-25

---

## Criterion

Lighthouse accessibility score is ≥90 on the tracked pages defined by the QA plan. The score is treated as a regression indicator and does not by itself establish WCAG 2.2 AA conformance.

**SMART Criteria Checklist**:

- **Specific**: Clear Lighthouse regression threshold and scope
- **Measurable**: Score ≥90 on tracked pages and maintained across governed CI runs
- **Achievable**: Standard Lighthouse testing approach
- **Relevant**: Continuous accessibility regression detection; criterion-level WCAG verification remains separate
- **Time-bound**: Per release

## Test Method

Lighthouse CI verifies the configured ≥90 accessibility threshold on tracked pages.

## Evidence Required

- Lighthouse reports
- Accessibility score history

## Related Tests

{Note: Test files will be created and linked here}

## Related Evidence

{Note: Evidence files will be created and linked here}

## Verification

- [ ] Criterion is specific and measurable
- [ ] Test method is appropriate
- [ ] Evidence requirements are clear
- [ ] Related tests are identified

## Related Artifacts

- **Story**: [US-8.7](../d.User_stories/US-8.7-lighthouse-compliance.md)
- **Epic**: [E8](../b.Epics/E8-accessibility.md)
- **Requirement**: [NFR-004](../a.Requirements/NFR-004-a11y.md)
- **PRD Reference**: PRD §Accessibility
- **TDD Reference**: TDD §Accessibility

---

**Last Updated**: 2026-09-25
**Verified By**: {Name/Team}
**Verified Date**: {YYYY-MM-DD}
