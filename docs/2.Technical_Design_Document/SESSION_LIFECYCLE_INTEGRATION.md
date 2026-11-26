# Session lifecycle integration — replacement for PR #489

Status: draft implementation; not evidence of full acceptance. Base: `feat/261-calendar-rescheduling` at `b39c9ec666c632ac2979b1b5558a2627128c9a91` (PR #670, eight commits ahead of feature).

## Structure and ownership

- ADR-029: `sessions` owns lifecycle/visibility, planning records own prescription, and `exercise_sets` alone owns performed data. No second persistence model or archive imports.
- Preserve the existing WorkoutEditor, ScheduleSessionCard/Chip, calendar scheduling hooks, reschedule dialog and canonical session API. Add details as a distinct protected page using the existing page-loader architecture (#634), not a parallel calendar or workout editor.
- Home history and Calendar selected-day/week/history link to detail. Calendar and Library route successful starts to the persisted session ID. Move and resize remain separate actions.
- Details display the canonical snapshot and completed points. Start uses the existing status PATCH and server-generated timestamps. Own-session reuse uses the existing clone endpoint with private visibility, no recurrence, no plan attachment and include_actual=false. A date/time is explicitly selected. Public/feed reuse is not exposed here (#366).
- Completed history is not edited here. The server's explicit reopen and gamification reconciliation remain authoritative.

## Acceptance and unresolved invariants

| Issue | Recovered scope | Remaining |
| --- | --- | --- |
| #289 | Protected session details, entry-point navigation, own-history clone | Complete prescription cloning, historical Log, result/Vibe UI, integration/E2E evidence |
| #290 | Start an existing planned workout; enter persisted session detail | Dedicated live Start/resume, timer, recording, interval/intake contract |
| #365 | Separate detail from editor; preserve canonical session identity | Dedicated execution state machine and commands, set recording, pause/rest, skip/add, finish/stop/discard, optional media |

PR #489's full-array replacement is deliberately not copied: it filters out unrecorded rows, changes IDs, loses RPE/rest/notes/extras, and re-snapshots names. The current planning editor stores some prescription in unrecorded exercise_sets rows, while clone(include_actual=false) drops all set rows. Before enabling recording, define and validate immutable effective prescription separately from actual sets within the existing domain; preserve stable IDs and snapshots and ensure unrecorded placeholders never contribute to completed scoring. Legacy rows cannot be classified solely by recorded_at because historical writers may omit timestamps. This needs API/data design and migration review under ADR-029, ADR-007 and #364/#365, including scoring/analytics and estimation consumers. Do not copy performed metrics into new achievements. Do not mark the issues complete on this draft.

## Verification

Add protected route and loader tests and session detail lifecycle tests. Existing calendar scheduling and smoke tests must remain authoritative; run lint, formatting, typecheck, unit, integration, both E2E shards and visual/a11y gates before review. No local execution is claimed for connector-created changes.
