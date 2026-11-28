# ADR-046: Interval and circuit blocks

**Date:** 2026-11-28
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-042 (set prescription and performed work), ADR-043 (live workout commands), ADR-045 (workout intake), Issue #290, migration `202611280001_create_session_blocks.ts`

---

## Context

Athletes train intervals (Tabata, EMOM) and circuits: several exercises done in turn, repeated for a number of rounds, with timed work and rest (#290). A session was a flat, ordered list of exercises, each with its own sets, and nothing could say "these three exercises form one circuit of 3 rounds".

`exercise_sets` already means the sets of one exercise, so a multi-exercise bundle must not be called a set. The structure has to be durable (no executable frontend logic in opaque JSON), keep ordinary flat sessions unchanged, and leave room for later interval protocols.

## Decision

1. **A block groups consecutive exercises.**
   - New table `session_blocks`: `kind`, optional `name`, `rounds`, `work_sec`, `rest_sec`, `round_rest_sec`. Each block belongs to its session (`ON DELETE CASCADE`).
   - `session_exercises.block_id` points at the block (`ON DELETE SET NULL`). Exercises without one are ordinary flat exercises.
   - `interval`: timed work and rest for each member, so `work_sec` is required. `circuit`: the members back to back, with work optional (rep-based). Both repeat `rounds` times, with `round_rest_sec` between rounds.
2. **One ordering.** A block has no position of its own. Its members' `session_exercises.order_index` places it, and they must follow each other. Reads return `blocks` in the order of their first member.
3. **A round is a set.** Each round of a member is one of that member's ordinary sets, so scoring, estimates and live recording (ADR-043) work unchanged. `rounds` is the prescription, like a planned set count: a member may end up with more sets (an extra round) or fewer (stopped early).
4. **Written with the exercises.**
   - Create and update take `blocks` (each with a request-local `ref`) next to `exercises`, and each member sets `block_ref`.
   - Blocks are replaced whenever the exercises are. `blocks` without `exercises` is refused (`400 E.SESSION.BLOCKS_WITHOUT_EXERCISES`).
   - The service refuses an unknown or duplicate ref, a block without members, a circuit of fewer than 2 exercises, members that don't follow each other, and an interval without work (`422 E.SESSION.INVALID_BLOCK`).
5. **Limits.** At most 50 rounds, work 1–3,600 s, rest 0–3,600 s, a name of up to 100 characters, and 50 blocks per session (`SESSION_BLOCK_LIMITS`). These are enforced by zod and by a check constraint, mirrored in the frontend config, and pinned by the contract tests.
6. **Copies keep blocks.** Reusing a session (clone, recurrence) and activating a plan copy the template's blocks with new ids.
7. **Data export.** Blocks are part of the athlete's data export, under `sessions.blocks`. Members carry `block_id`.

## Consequences

- **Workout editor:** the exercise being edited can start an interval block or a circuit, or join the block of the exercise above it, so members are always consecutive. A member's sets follow the block's rounds. An interval's work and rest become each round's targets, and a circuit's rest follows each exercise. The editor won't save a circuit of one exercise or an interval without work. Saving an existing session sends its blocks back, so editing never flattens it.
- **Session page and live workout:** a card before a block's first exercise shows its name (or kind), rounds, work and rest. The live workout records rounds as ordinary sets, and its rest timer uses each round's rest target.
- **Not in this slice** (each builds on this model without a schema change):
  - a guided interval clock that alternates work and rest and counts rounds;
  - rest between rounds in the live rest timer;
  - blocks in the manual Log.
- **Scoring is unchanged:** points and Vibe levels still read completed sets only (ADR-042).
