# Session lifecycle integration — replacement for PR #489

Status: merged into `feat/261-calendar-rescheduling` (PR #670) as the first slice of the #489 replacement. It covers session details, entry points, start and reuse. Recording, completion and the other open items below are not done, so the issues stay open.

## Structure and ownership

- ADR-029: `sessions` owns lifecycle/visibility, planning records own prescription, and `exercise_sets` alone owns performed data. No second persistence model or archive imports.
- Preserve the existing WorkoutEditor, ScheduleSessionCard/Chip, calendar scheduling hooks, reschedule dialog and canonical session API. Add details as a distinct protected page using the existing page-loader architecture (#634), not a parallel calendar or workout editor.
- Home history and Calendar selected-day/week/history link to detail. Calendar and Library route successful starts to the persisted session ID. Move and resize remain separate actions.
- Details display the canonical snapshot and completed points. Start uses the existing status PATCH and server-generated timestamps. Own-session reuse uses the existing clone endpoint with private visibility, no recurrence, no plan attachment and include_actual=false. A date/time is explicitly selected. Public/feed reuse is not exposed here (#366).
- Completed history is not edited here. The server's explicit reopen and gamification reconciliation remain authoritative.

## Acceptance and unresolved invariants

| Issue | Recovered scope                                                      | Remaining                                                                                                                |
| ----- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| #289  | Protected session details, entry-point navigation, own-history clone | Complete prescription cloning, historical Log, result/Vibe UI, integration/E2E evidence                                  |
| #290  | Start an existing planned workout; enter persisted session detail    | Dedicated live Start/resume, timer, recording, interval/intake contract                                                  |
| #365  | Separate detail from editor; preserve canonical session identity     | Dedicated execution state machine and commands, set recording, pause/rest, skip/add, finish/stop/discard, optional media |

**Update (2026-11-26):** ADR-042 settles the prescription/performed split described below. Sets now have a status (planned, completed or skipped), a source and their own planned values. Only completed sets score. The backfill classifies existing rows by their session.

PR #489's full-array replacement is deliberately not copied: it filters out unrecorded rows, changes IDs, loses RPE/rest/notes/extras, and re-snapshots names. The current planning editor stores some prescription in unrecorded exercise_sets rows, while clone(include_actual=false) drops all set rows. Before enabling recording, define and validate immutable effective prescription separately from actual sets within the existing domain; preserve stable IDs and snapshots and ensure unrecorded placeholders never contribute to completed scoring. Legacy rows cannot be classified solely by recorded_at because historical writers may omit timestamps. This needs API/data design and migration review under ADR-029, ADR-007 and #364/#365, including scoring/analytics and estimation consumers. Do not copy performed metrics into new achievements. Do not mark the issues complete on this draft.

## Verification

- `tests/frontend/pages/SessionDetail.test.tsx` covers the detail view: schedule with planned length, visibility, prescription and recorded sets, points, start, reuse, owner-only actions, canceled sessions, load errors, and the owner after a page reload. The Calendar, Home and Library tests cover their links into the detail view.
- `tests/frontend/e2e/session-detail.spec.cjs` runs against the real backend. It opens a planned workout from the Calendar, starts it (the server records `started_at`), and reuses it as a private copy that keeps its planned length at the chosen time. It also opens a completed workout from Home's history.
- Fixed before merging:
  - Owner actions waited for the auth store's user, which is only set by a sign-in in the same tab. After a reload the page loaded nothing. The session now loads straight away, and `useCurrentUserId` falls back to the profile API to decide whether to show owner actions.
  - Visibility used a missing translation key.
  - Planned distance claimed a unit (km) the data model does not define.
  - Two translation keys were unused.
  - Lint and formatting errors.
- `Library` had the same reload problem (owned exercises showed as public, without edit actions). It now uses `useCurrentUserId` too.
