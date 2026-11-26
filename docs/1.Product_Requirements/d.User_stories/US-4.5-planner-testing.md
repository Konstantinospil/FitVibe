# US-4.5: Planner Testing

---

**Story ID**: US-4.5  
**Epic ID**: [E4](../b.Epics/E4-planner-completion.md)  
**Title**: Planner Testing  
**Status**: Proposed  
**Story Points**: 3  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2025-01-21

---

## User Story

**As a** developer  
**I want** comprehensive test coverage for planner features  
**So that** I can ensure reliability and prevent regressions

## Description

The planner feature requires comprehensive testing at unit, integration, and E2E levels. Tests must cover plan CRUD, activation, session generation, progress tracking, conflict detection, and mobile touch gestures.

## Related Acceptance Criteria

- [US-4.5-AC01](../e.Acceptance_Criteria/US-4.5-AC01.md): Unit test coverage
- [US-4.5-AC02](../e.Acceptance_Criteria/US-4.5-AC02.md): Integration tests
- [US-4.5-AC03](../e.Acceptance_Criteria/US-4.5-AC03.md): E2E tests

## Dependencies

### Story Dependencies

- [US-4.1: Plan CRUD](../d.User_stories/US-4.1-plan-crud.md): Feature to test
- [US-4.2: Plan Activation & Progress](../d.User_stories/US-4.2-plan-activation-progress.md): Feature to test
- [US-4.3: Drag-and-Drop Scheduling](../d.User_stories/US-4.3-drag-and-drop-scheduling.md): Feature to test
- [US-4.4: Mobile Touch Gestures](../d.User_stories/US-4.4-mobile-touch-gestures.md): Feature to test

## Technical Notes

- Unit test coverage ≥90%
- Integration tests for API flows
- E2E tests for complete workflows

## Implementation / verification (2026-11-26)

- AC01: coverage from the unit suites. Backend `modules/plans/*`: 95.9 % statements (activation service 97 %, activation schedule 98.7 %, repository 99.3 %, service 91.4 %, controller 91.8 %); `sessions.schedule.ts` 100 %. Frontend planner code: `lib/scheduling/*` 99–100 %, `useSessionReschedule` 100 %, `useKeyboardMove` 100 %, `usePointerDrag` 95 %, `useCalendarScheduling` 94 %, `Calendar` 94 %, `PlanManagement` 95 %, schedule composites 86–100 % lines.
- AC02: integration tests against Postgres: `plan-crud` (CRUD, archive, ETag), `plan-activation` (generation, progress, overlap refusal) and `session-scheduling` (move and resize overlaps, back-to-back, canceled and other users' sessions).
- AC03: `planner-workflow.spec.cjs` (create, stale-edit banner, activate, calendar, archive) and `calendar-scheduling.spec.cjs` (drag-and-drop in every view, keyboard, resize, overlap refusal, server 422, touch drag and touch resize).

## Test Strategy

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for user workflows

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
