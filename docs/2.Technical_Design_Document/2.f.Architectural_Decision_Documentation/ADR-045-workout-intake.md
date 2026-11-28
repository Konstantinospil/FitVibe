# ADR-045: Workout intake (water and food energy)

**Date:** 2026-11-27
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-043 (live workout commands), ADR-044 (post-workout note and photo), Issue #290, migration `202611270005_create_session_intake_entries.ts`

---

## Context

During or after a workout, the athlete may want to record what they drank and ate (#290). Neither of the existing fields fits:

- `sessions.calories` is the energy the workout used, and it feeds points.
- The measurement catalogue's body water is body composition.

Reusing either would mix unrelated meanings. Fasting is an independent, time-based record and stays out of the session lifecycle.

## Decision

1. **A typed entry log.**
   - Each entry is a row in `session_intake_entries`: `kind` (`water` in millilitres, or `energy`, food energy in kilocalories), `amount`, and `recorded_at`.
   - Entries belong to their session (`ON DELETE CASCADE`).
   - A single entry is at most 5,000 ml or 5,000 kcal (`INTAKE_LIMITS`), enforced by zod and by a check constraint.
   - Totals are computed from the entries, so they can always be audited.
2. **When intake can be recorded.**
   - `POST /sessions/{id}/intake` adds one entry, timed now, once the session is `in_progress` or `completed` (`409 E.SESSION.INTAKE_NOT_STARTED` otherwise).
   - `DELETE /sessions/{id}/intake/{entryId}` removes one.
   - Both are owner-only, return the session's intake, and are audited as `session_intake`.
3. **Manual Log.** `POST /sessions` with `status: completed` may carry `intake` (up to 20 entries). They are written in the same transaction and timed at the workout's end. On any other session they are refused (`400 E.SESSION.INTAKE_WITHOUT_RESULT`).
4. **Private.** Session reads include `intake` (entries and totals) for the owner only. A public session is shown to anyone else without it, like the photo (ADR-044).
5. **Data export.** Intake entries are part of the athlete's data export, under `sessions.intake`.

## Consequences

- **Where it's recorded:**
  - The live workout shows a "Water and food" panel, with one-tap water buttons (250 and 500 ml), an entry form and the entries so far.
  - The session page shows the same panel. It is editable on a started or completed workout and read-only otherwise.
  - The manual Log takes optional water and food totals.
- **Calories stay apart:** `sessions.calories` and points are untouched.
- **Units:** water is recorded in millilitres for everyone for now. Showing fluid ounces to athletes who use pounds is a possible follow-up.
