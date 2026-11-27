# ADR-043: Live workout execution commands

**Date:** 2026-11-27
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-042 (set prescription and performed work), ADR-029 (state ownership), ADR-007 (idempotency), Issues #365, #290, #364, migration `202611270002_live_execution_state.ts`

---

## Context

ADR-042 separated a set's prescription from performed work and added the `stopped_early` outcome. Today an athlete can start a planned workout, but cannot record sets, pause, adjust the workout while training, or finish it from the app. Issue #365 asks for a server-authoritative execution flow:

- the client must not derive the current order or state on its own;
- retries must not duplicate work;
- elapsed time must come from timestamps, not from a browser counter.

## Decision

1. **Small commands, not array replacement.** A workout in progress is changed through dedicated commands. Each one works on a session the athlete owns that is `in_progress` (otherwise `409 E.SESSION.NOT_ACTIVE`, or 404 for someone else's session). Each runs in one transaction with the session row locked, and returns the whole session.
   - `PATCH /sessions/{id}/sets/{setId}` records (`completed`), corrects or skips (`skipped`) a set. A correction keeps the first `recorded_at`. Skipping clears the performed values. The prescription is never changed.
   - `POST /sessions/{id}/exercises/{exerciseId}/sets` adds a planned set with `source = added`. It brings a skipped exercise back.
   - `POST /sessions/{id}/exercises` appends an exercise with `source = added`, with one empty planned set.
   - `POST /sessions/{id}/exercises/{exerciseId}/skip` marks the exercise skipped, and its remaining planned sets skipped.
   - `POST /sessions/{id}/pause` and `/resume`.
2. **Idempotency.**
   - Recording, skipping, pausing and resuming give the same result when repeated.
   - Adding a set or an exercise accepts an `Idempotency-Key` (ADR-007).
3. **Time comes from timestamps.**
   - `sessions.paused_at` marks an open pause, and `sessions.paused_seconds` sums the finished ones. Active time = (completed_at or now) − started_at − paused_seconds − open pause.
   - Finishing while paused closes the pause.
   - Rest is not stored as a state. The client counts down a set's `rest_sec` (performed or planned) from its `recorded_at`.
4. **Exercise state.** `session_exercises.status` is `planned` or `skipped`, and `session_exercises.source` is `prescribed` or `added`. Whether an exercise is done is derived from its sets.
5. **Finishing and discarding reuse existing paths.**
   - `PATCH /sessions/{id}` with `status: completed` and an optional `completion_outcome` finishes the workout. Unrecorded planned sets stay planned and never score (ADR-042).
   - `DELETE /sessions/{id}` discards it, as a soft delete.
6. **Rate limit.** The commands share the `sessions_execution` policy (120 per minute), because a workout produces one call per set.

## Consequences

- The Start screen can resume after a reload from the server's state alone.
- Order is server-authoritative: added work goes to the end of its exercise or of the workout.
- **Still to come:**
  - Raw vs Adjusted effective prescriptions (#364) build on `planned_*` and are fixed at start;
  - interval/circuit blocks and intake (#290) need their own model;
  - insertion at a position other than the end is not supported yet.
