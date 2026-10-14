# US-4.2: Plan Activation & Progress

---

**Story ID**: US-4.2  
**Epic ID**: [E4](../b.Epics/E4-planner-completion.md)  
**Title**: Plan Activation & Progress  
**Status**: Proposed  
**Story Points**: 5  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2025-01-21

---

## User Story

**As a** authenticated user  
**I want** to activate training plans and track their progress  
**So that** I can see how well I'm following my planned schedule

## Description

Users need the ability to activate training plans, which generates scheduled sessions based on plan templates and recurrence rules. The system must track plan progress by calculating completion percentage and updating it as sessions are completed.

## Related Acceptance Criteria

- [US-4.2-AC01](../e.Acceptance_Criteria/US-4.2-AC01.md): Plan activation
- [US-4.2-AC02](../e.Acceptance_Criteria/US-4.2-AC02.md): Progress tracking
- [US-4.2-AC03](../e.Acceptance_Criteria/US-4.2-AC03.md): Plan duration validation

## Dependencies

### Story Dependencies

- [US-4.1: Plan CRUD](../d.User_stories/US-4.1-plan-crud.md): Plans must exist before activation

## Technical Notes

- Activation endpoint: `POST /api/v1/plans/:id/activate` (authenticated owner only).
- A plan must contain `start_date`, `duration_weeks` (1–52), `target_frequency` (1–7), and exactly that many planned template sessions in the first week.
- Each template session contains the prescribed exercises, planned set attributes, and optional weekly recurrence rule. Activation creates the remaining weeks; it does not duplicate the first week or copy performed results.
- `time_zone` is an IANA time zone identifier, defaulting to `UTC` for existing clients. Subsequent sessions retain the template's local time across daylight-saving changes. Times that do not exist at a DST transition are rejected rather than silently shifted.
- `end_date`, when provided, must match the duration. Activation is transactionally guarded by a plan row lock; subsequent attempts return 409.
- Changes to dates, duration, frequency, or time zone after activation are rejected to preserve the schedule.
- Progress uses persisted, non-deleted sessions: `completed_count / session_count * 100`. Completion uses the existing session lifecycle, not another plan-specific completion mechanism.
- Session conflicts are currently detected for exact scheduled instants. Overlap based on workout duration remains a broader Planner constraint and requires authoritative duration semantics.

## Implementation / verification (2026-10-14)

- Backend work is in [PR #491](https://github.com/Konstantinospil/FitVibe/pull/491), superseding #484.
- Tests include recurrence/DST behavior, database-backed activation with prescribed-set preservation, completion progress, rejected repeat activation, unauthorized requests, and invalid field bounds.
- Keep this story **open** until CI quality, backend integration, API validation, and coverage gates pass with evidence.
- User-facing plan activation/progress components remain aligned with [#84](https://github.com/Konstantinospil/FitVibe/issues/84) and the Planner UI; live workout execution is separately tracked by [#365](https://github.com/Konstantinospil/FitVibe/issues/365).

## Test Strategy

- Integration tests for activation flow
- Unit tests for progress calculation
- E2E tests for complete activation workflow

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
