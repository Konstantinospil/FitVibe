# ADR-044: Post-workout note and photo

**Date:** 2026-11-27
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-004 (media upload safety), ADR-042 (prescription and performed work), ADR-043 (live workout commands), Issue #365, migration `202611270004_add_session_result_note_and_photo.ts`

---

## Context

After a workout, the athlete can describe how it went and attach a photo (#365). This works for both outcomes, completed and stopped early. Neither is required to save the workout.

`sessions.notes` already exists, but the Plan editor uses it for the plan's instructions. Writing the athlete's note there would overwrite what was planned, which ADR-042 rules out: planned and performed stay apart.

Four upload paths each had their own copy of the type list, the 5 MB cap, the malware scan and the re-encoding: the avatar, the registration avatar, body-progress photos, and now workout photos.

## Decision

1. **A separate result note.**
   - `sessions.result_note` (text, at most 1,000 characters, the same limit as `notes`) holds what the athlete wrote after the workout. `notes` stays the plan's.
   - The API accepts it only when the session is, or becomes, completed: `POST /sessions` with `status: completed`, or `PATCH /sessions/{id}`. Otherwise it answers `400 E.SESSION.RESULT_NOTE_WITHOUT_RESULT`.
   - It is not a correction field, so it can be edited on a completed session without reopening it.
   - A database check refuses a result note on a planned session. A reopened session keeps its note while it is corrected.
   - The manual Log's note is a post-workout note, so the Log now writes `result_note`.
   - Cloning never copies the note or the photo.
2. **One photo per session, owner only.**
   - The photo is a `media` row with `target_type = 'session'` and `target_id` = the session id. A partial unique index keeps it to one per session.
   - `POST /sessions/{id}/photo` (multipart field `photo`) adds a photo or replaces the current one. It is allowed once the session is completed (`409 E.SESSION.PHOTO_NOT_COMPLETED` otherwise). Replacing and removing (`DELETE /sessions/{id}/photo`) stay allowed later.
   - The upload locks the session row, so two uploads can't both add a photo. The file is written first and removed again if its row can't be saved. Replaced files are deleted once the new row is committed.
   - `GET /sessions/{id}/photo/{photoId}` serves the image to its owner only; anyone else gets 404. A replaced photo gets a new id and URL, so the response is cached as private and immutable.
   - Session reads include `photo` for the owner. A public session is shown to anyone else without its photo.
   - The rate limits match body-progress photos: 10 uploads, 120 reads and 30 removals per minute.
3. **One image pipeline** (`services/imageUpload.service.ts`).
   - It holds the accepted types, the 5 MB cap, the multipart reader, and `prepareImage()`. That function checks the type and size, scans for malware (ADR-004), decodes the bytes to prove the format, and re-encodes the image, dropping its metadata, including any location.
   - There are two output formats. An avatar is a 128 px square PNG. A photo is a JPEG whose longest edge is at most 1,600 px, never enlarged.
   - The avatar, registration-avatar, body-progress and workout-photo uploads all use it. Media files are written by one `saveMediaFile(folder, owner, …)`.

## Consequences

- **Finishing a workout** offers an optional note and photo next to the summary. The workout is saved first, then the photo is uploaded. If the upload fails, the result is already saved: the dialog says so and offers a retry or a way to continue without the photo.
- **The session page** shows the note and the photo, and lets the owner edit the note and add, replace or remove the photo.
- **Body-progress photo uploads** now answer `422` with the shared codes, where they used to answer `400`. They also reject bytes that aren't a real image instead of failing with a 500. No screen uses that endpoint yet.
- **Account deletion and data export** already cover every `media` row, so workout photos are included with no extra code.
- **Still to come:**
  - Showing photos to followers or on public sessions needs its own sharing decision.
  - Several photos per workout would need a new constraint and a gallery.
