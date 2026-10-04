# US-8.7: Lighthouse Compliance

---

**Story ID**: US-8.7  
**Epic ID**: [E8](../b.Epics/E8-accessibility.md)  
**Title**: Lighthouse Compliance  
**Status**: Open  
**Story Points**: 2  
**Priority**: High  
**Created**: 2025-01-21  
**Updated**: 2026-09-25

---

## User Story

**As a** developer  
**I want** Lighthouse accessibility checks to provide a stable regression signal  
**So that** accessibility regressions are detected continuously without treating an automated score as proof of WCAG conformance

## Description

Lighthouse accessibility score target is ≥90 on tracked pages, consistent with NFR-004 and the QA plan. Lighthouse is a regression indicator only; WCAG 2.2 AA conformance is established criterion-by-criterion with automated and manual evidence as appropriate. Lighthouse CI runs on the governed CI path and regressions below the configured threshold block completion.

## Related Acceptance Criteria

- [US-8.7-AC01](../e.Acceptance_Criteria/US-8.7-AC01.md): Lighthouse score target
- [US-8.7-AC02](../e.Acceptance_Criteria/US-8.7-AC02.md): Lighthouse CI enforcement

## Dependencies

### Story Dependencies

- [NFR-004: Accessibility](../a.Requirements/NFR-004-a11y.md): Parent requirement

## Technical Notes

- Lighthouse CI integration
- Score monitoring
- Budget enforcement

## Test Strategy

- Lighthouse CI runs
- Score tracking
- Regression detection

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2026-09-25  
**Next Review**: after implementation comparison
