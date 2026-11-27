# ADR-042: Separate a set's prescription from performed work

**Date:** 2026-11-26
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-029 (state ownership), ADR-007 (idempotency), Issues #89, #289, #290, #364, #365, `docs/2.Technical_Design_Document/SESSION_LIFECYCLE_INTEGRATION.md`, migration `202611270001_split_set_prescription_and_outcome.ts`

---

## Context

ADR-029 makes `exercise_sets` the only source of performed workout data. In practice, the workout editor also stored a workout's targets (reps, load, rest) in those same columns as unrecorded rows. Scoring counted every row. So a planned workout that was marked completed scored its prescription as if it had been performed. Recording sets, finishing a workout and logging a past workout (#89, #289, #365) all depend on telling the two apart.

The session-lifecycle design note also ruled out two approaches. Replacing the whole set array, as PR #489 did, loses IDs, prescriptions and name snapshots. Classifying rows by `recorded_at` doesn't work either, because historical writers omitted it.

## Decision

1. **Per-set columns, not a second table.** `exercise_sets` gains:
   - `status`: `planned`, `completed` or `skipped`;
   - `source`: `prescribed` or `added`;
   - `planned_reps`, `planned_weight_kg`, `planned_distance_m`, `planned_duration_sec`, `planned_rpe` and `planned_rest_sec`.

   The existing value columns hold performed values only. The API returns the prescription as `set.planned`, and the performed values in the top-level set fields.

2. **Only completed sets are performed work.** Points, Vibe levels and regional training loads read completed sets only. Duration estimates use performed values where they exist, otherwise the prescription, and skip skipped sets.
3. **Set validation.**
   - A set without `status` is completed if it has `recorded_at`, otherwise planned.
   - A planned set may not have `recorded_at`.
   - A skipped set may not have performed values.
   - For compatibility (ADR-029), a planned set that sends targets only in the top-level fields has them moved to `planned`. Remove this conversion once every client sends `planned`.
4. **Stopped early is an outcome, not a status.** `sessions.completion_outcome` is `completed` or `stopped_early`. It is set when a session completes, and cleared on reopen. Session status stays `completed`, so the feed, statistics and scoring are unchanged. Neither outcome counts as failure.
5. **Discarding a started workout is a soft delete.** It uses the existing cancel path: status `canceled` plus `deleted_at`.
6. **Manual Log is one request.** `POST /sessions` with `status: "completed"` creates a finished past workout atomically:
   - `started_at` is `planned_at`;
   - `completed_at` is `planned_at + planned_duration_min`, and never later than now;
   - a start in the future is refused with `422 E.SESSION.LOG_IN_FUTURE`.

   The usual completion processing runs afterwards: gamification and feed reconciliation.

7. **Reuse copies a prescription.** Cloning without `include_actual` turns each set into a planned set. Its target is the original target, or what was performed when no target was recorded. Skipped sets are dropped. Previously all sets were dropped.
8. **Name snapshots survive replacement.** When a session's exercises are replaced, an exercise that was already in the session keeps its recorded `exercise_name` snapshot (#289).
9. **Heart rate is an optional result (#89, added 2026-11-27).** `exercise_sets.heart_rate_bpm` is a whole number from 20 to 250. It has no `planned_*` twin, because a target never holds a heart rate.
   - Only a completed set may carry one; the database enforces this as well.
   - A planned set that sends one is refused, not converted to a target.
   - Recording or skipping a set in a live workout clears or sets it with the other results.
   - A full copy keeps it; a reuse as a prescription drops it.

## Backfill

A set's class comes from its session, never from `recorded_at` alone:

- **Performed work:** sets of completed sessions, of reopened sessions (in progress with a pending gamification rebuild) and sets with `recorded_at` stay completed. Their prescription is unknown and stays empty.
- **Prescriptions:** every other set has its values moved to `planned_*`, and its performed columns are cleared.

Completed sessions get `completion_outcome = 'completed'`. The down migration moves prescriptions back into the value columns.

## Consequences

- Completing a workout without recording anything earns the base completion points only, not points for the planned volume.
- Generated, recurring and reused sessions now carry their per-set targets.
- **Still to come:** live execution commands and the Start screen (#365, #290), Raw vs Adjusted prescriptions (#364), and per-exercise skip status. These build on this model without another migration of set data.
