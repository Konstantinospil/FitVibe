# US-4.4: Mobile Touch Gestures

---

**Story ID**: US-4.4  
**Epic ID**: [E4](../b.Epics/E4-planner-completion.md)  
**Title**: Mobile Touch Gestures  
**Status**: Proposed  
**Story Points**: 5  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2025-01-21

---

## User Story

**As a** authenticated user on a mobile device  
**I want** to schedule sessions using touch gestures  
**So that** I can manage my training schedule on the go

## Description

Users need mobile-friendly touch gesture support for drag-and-drop scheduling. The system must support touchstart, touchmove, touchend events, provide visual feedback, and maintain performance (no scroll-jank >50ms).

## Related Acceptance Criteria

- [US-4.4-AC01](../e.Acceptance_Criteria/US-4.4-AC01.md): Touch gesture support
- [US-4.4-AC02](../e.Acceptance_Criteria/US-4.4-AC02.md): Mobile usability

## Dependencies

### Story Dependencies

- [US-4.3: Drag-and-Drop Scheduling](../d.User_stories/US-4.3-drag-and-drop-scheduling.md): Base drag-and-drop functionality

## Technical Notes

- Touch event handling (touchstart, touchmove, touchend)
- Performance critical: no scroll-jank >50ms
- Screen width support ≥320px

## Implementation / verification (2026-11-25)

- Calendar scheduling uses Pointer Events, which cover touch (`touchstart`/`touchmove`/`touchend` input), mouse and pen through one code path.
- Only the move handle sets `touch-action: none`, so a touch drag starts on the handle while the rest of the page keeps native scrolling. The dragged preview follows the pointer through a CSS transform, without re-rendering the page on each move.
- Visual feedback: the target day shows a dashed outline, a conflicting target switches to danger tokens, and the dragged card is dimmed.
- 2026-11-26: holding the finger near the top or bottom edge scrolls the calendar, so a day that is off screen on a phone (the month grid sits above the selected day's workouts) can still be reached.
- E2E (`tests/frontend/e2e/calendar-scheduling.spec.cjs`, 360 × 780 touch emulation): a touch drag reaches an off-screen day by edge auto-scroll and saves the move; long tasks over 50 ms during the drag fail the test, and the measurement is attached.
- Resize (2026-11-26): in the week and day views every planned session has a resize handle on its lower edge. Dragging it (mouse, pen or touch) onto an hour slot makes the session end where that hour ends; the grid previews the new end and any overlap while dragging, and an overlapping length is refused before saving. The keyboard path is Space on the handle, the up and down arrows (15 minutes per step) and Enter; the reschedule dialog also has a length field.
- E2E: "touch: drag the resize handle in the day view" (360 × 780 touch emulation) saves a new length; "week view: resize a workout…" covers pointer resize, overlap refusal and the keyboard path.

## Test Strategy

- E2E mobile emulation tests
- Performance tests for touch gesture responsiveness

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
