# US-4.1: Plan CRUD

---

**Story ID**: US-4.1  
**Epic ID**: [E4](../b.Epics/E4-planner-completion.md)  
**Title**: Plan CRUD  
**Status**: Proposed  
**Story Points**: 5  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2025-01-21

---

## User Story

**As a** authenticated user  
**I want** to create, read, update, and delete training plans  
**So that** I can manage my training schedule effectively

## Description

Users need the ability to perform full CRUD operations on training plans. This includes creating new plans, viewing existing plans, updating plan details, and deleting (archiving) plans. The system must support concurrency control through ETag mechanisms to prevent conflicts when multiple users or sessions edit the same plan.

## Related Acceptance Criteria

- [US-4.1-AC01](../e.Acceptance_Criteria/US-4.1-AC01.md): Plan creation
- [US-4.1-AC02](../e.Acceptance_Criteria/US-4.1-AC02.md): Plan updates
- [US-4.1-AC03](../e.Acceptance_Criteria/US-4.1-AC03.md): Plan deletion (soft-delete)
- [US-4.1-AC04](../e.Acceptance_Criteria/US-4.1-AC04.md): Concurrency control with ETag

## Dependencies

### Feature Dependencies

- [FR-001: User Registration](../a.Requirements/FR-001-user-registration.md): User accounts required
- [FR-002: Login & Session](../a.Requirements/FR-002-login-and-session.md): Authentication required

## Technical Notes

- Use ETag headers for optimistic concurrency control
- Soft-delete via `archived_at` timestamp
- Plan updates must preserve associated sessions

## Implementation / verification (2026-11-26)

- AC01–AC04: `tests/backend/integration/plan-crud.integration.test.ts` runs against Postgres. It times five plan creations after a warm-up and fails above 500 ms (each run logs the timings; locally 5–12 ms), checks that updates survive a reload, that deleting sets `archived_at` and keeps the plan's sessions, and that a stale `If-Match` gets 412 while the current ETag or no ETag saves.
- Fixed while adding AC02 evidence: `PATCH /plans/:id` ignored `duration_weeks`, `target_frequency` and `time_zone`, so edits to those fields in the Training plans dialog were silently lost.
- E2E: `tests/frontend/e2e/planner-workflow.spec.cjs` creates a plan in the dialog, shows the conflict banner for a stale edit, activates the plan, finds the generated workout in the calendar and archives the plan without losing its workouts.
- The dialog no longer logs a stale-version refusal as an error: it is an expected outcome shown as the banner.

## Test Strategy

- Unit tests for plan CRUD operations
- Integration tests for API endpoints
- E2E tests for complete workflow

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
