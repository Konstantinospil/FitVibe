# US-4.3: Drag-and-Drop Scheduling

---

**Story ID**: US-4.3  
**Epic ID**: [E4](../b.Epics/E4-planner-completion.md)  
**Title**: Drag-and-Drop Scheduling  
**Status**: Proposed  
**Story Points**: 8  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2025-01-21

---

## User Story

**As a** authenticated user  
**I want** to schedule sessions via drag-and-drop in a calendar view  
**So that** I can quickly organize my training schedule visually

## Description

Users need an intuitive drag-and-drop interface for scheduling sessions in a calendar view. The system must support conflict detection (both client and server-side), multiple calendar views (month/week/day), and proper performance (re-render ≤150ms).

## Related Acceptance Criteria

- [US-4.3-AC01](../e.Acceptance_Criteria/US-4.3-AC01.md): Drag-and-drop performance
- [US-4.3-AC02](../e.Acceptance_Criteria/US-4.3-AC02.md): Client-side conflict detection
- [US-4.3-AC03](../e.Acceptance_Criteria/US-4.3-AC03.md): Server-side conflict validation
- [US-4.3-AC04](../e.Acceptance_Criteria/US-4.3-AC04.md): Calendar views

## Dependencies

### Story Dependencies

- [US-4.1: Plan CRUD](../d.User_stories/US-4.1-plan-crud.md): Plans must exist

## Technical Notes

- Calendar re-render performance critical (≤150ms)
- Client-side conflict detection for UX
- Server-side validation for data integrity

## Implementation / verification (2026-11-25)

- Planned sessions on the Calendar (selected-day list and weekly plan) carry a move handle. Dragging it onto a month-grid day moves the session to that day and keeps its local time; activating it without dragging opens a day-and-time dialog, the non-drag alternative required by [US-13.3](https://github.com/Konstantinospil/FitVibe/issues/139).
- AC01: a move updates the cached calendar optimistically, without a page reload, and is restored if the server refuses it. The E2E scenario measures the time from pointer release to the target day's re-render and fails above 150 ms (it attaches the measurement).
- AC02: conflicts against the loaded sessions are detected before any request. While dragging, the hovered day and the conflicting sessions are highlighted; a refused move shows an actionable message naming the blocking workout. Conflicting cards carry a text label, so the state does not rely on colour alone.
- AC03: `PATCH /api/v1/sessions/:id` re-validates a changed `planned_at` inside the write transaction and rejects a conflict with `422 E.SESSION.SCHEDULE_CONFLICT` and `details.conflictingSessionIds`.
- **Conflict definition (decision gate):** a conflict is another active session planned at the same instant, the rule activation and recurrence already use (see [US-4.2](./US-4.2-plan-activation-progress.md)). Overlap by workout duration needs authoritative duration semantics and remains an open product decision.
- AC04 (2026-11-26): a view switch offers **Month**, **Week** and **Day**. Week and day views show hour rows (06:00–22:00, widened to fit earlier or later sessions) by day columns; each session is a chip labelled with its time and title and coloured by status. Dropping a chip on an hour slot moves the session to that day and hour and keeps its minutes.
- Dragging near the top or bottom of the window scrolls the calendar, so off-screen days and hours stay reachable.
- E2E: `tests/frontend/e2e/calendar-scheduling.spec.cjs` covers month, week and day moves, keyboard moves, the move dialog, client refusal of a conflict (no request sent) and the server 422 (HTTP trace attached).
- Close this story once that E2E suite passes in CI on `feature`.

## Test Strategy

- E2E tests for drag-and-drop functionality
- Unit tests for conflict detection logic
- Performance tests for re-render times

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
