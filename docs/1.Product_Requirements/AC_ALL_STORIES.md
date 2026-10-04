# Acceptance Criteria for All User Stories

> **Authority:** Historical aggregate only. This file contains legacy/generated acceptance-criterion text and identifier collisions from earlier product-model versions. It must not be used as product SSOT or as a backlog source. Canonical acceptance criteria live as individual files under `e.Acceptance_Criteria/`; where they disagree, the individual canonical file wins.


**Generated**: 2025-01-21

---

## US-1.1

### US-1.1-AC01

**Criterion**: Users can edit alias, weight, fitness level, and training frequency via API endpoint PATCH /api/v1/users/me within ≤500ms response time.

- **Test Method**: Integration + E2E
- **Evidence Required**: API response times, DB snapshot, UI screenshots

### US-1.1-AC02

**Criterion**: Profile field validation: alias max 32 chars, weight range 20-400 kg (or equivalent in lbs), fitness level enum (beginner/intermediate/advanced/elite), training frequency enum (rarely/1_2_per_week/3_4_per_week/5_plus_per_week). Invalid values rejected with 422 and clear error messages.

- **Test Method**: Unit + API negative
- **Evidence Required**: Validation test results, error message samples

### US-1.1-AC03

**Criterion**: Immutable fields (date_of_birth, gender) cannot be modified; attempts return 403 Forbidden with error code E.USER.IMMUTABLE_FIELD.

- **Test Method**: API negative
- **Evidence Required**: HTTP traces, error responses

### US-1.1-AC04

**Criterion**: Weight is stored internally as kg (weight_kg) regardless of user's preferred unit; UI converts for display based on user's weight_unit preference.

- **Test Method**: Integration
- **Evidence Required**: DB records, UI conversion tests

### US-1.1-AC05

**Criterion**: Profile changes are audit-logged with who/when/what; state history records created for each field change.

- **Test Method**: Integration
- **Evidence Required**: Audit log excerpts, state history records

---

## US-1.2

### US-1.2-AC01

**Criterion**: Users can upload avatar images via POST /api/v1/users/me/avatar; accepted formats: JPEG, PNG, WebP; max size 5MB; rejected with 422 if invalid.

- **Test Method**: Integration
- **Evidence Required**: Upload logs, error responses for invalid files

### US-1.2-AC02

**Criterion**: Uploaded avatars are scanned for malware using antivirus service; infected files rejected with E.UPLOAD.MALWARE_DETECTED and audit logged.

- **Test Method**: Integration
- **Evidence Required**: AV scan logs, EICAR test file rejection

### US-1.2-AC03

**Criterion**: System generates 128×128 pixel preview image from uploaded avatar within ≤2s; preview stored and served at /users/avatar/:id endpoint.

- **Test Method**: Integration
- **Evidence Required**: Preview images, performance metrics, storage verification

### US-1.2-AC04

**Criterion**: Users without avatars see a default placeholder image; placeholder is accessible and properly sized.

- **Test Method**: E2E
- **Evidence Required**: UI screenshots showing placeholder

### US-1.2-AC05

**Criterion**: Avatar upload is idempotent via Idempotency-Key header; duplicate uploads return same result with Idempotent-Replayed header.

- **Test Method**: Integration
- **Evidence Required**: Idempotency test results, HTTP headers

---

## US-1.3

### US-1.3-AC01

**Criterion**: Unit tests cover profile field validation, immutable field protection, and weight unit conversion with ≥90% code coverage.

- **Test Method**: Unit
- **Evidence Required**: Test coverage reports

### US-1.3-AC02

**Criterion**: Integration tests verify profile update API, avatar upload flow, and error handling scenarios.

- **Test Method**: Integration
- **Evidence Required**: Integration test results

### US-1.3-AC03

**Criterion**: E2E tests verify complete profile editing workflow including form validation, submission, and persistence.

- **Test Method**: E2E
- **Evidence Required**: E2E test results, UI screenshots

---

## US-10.1

### US-10.1-AC01

**Criterion**: Automated daily encrypted backups of all critical data (users, sessions, exercises, points); backups stored in secure location.

- **Test Method**: Ops review
- **Evidence Required**: Backup job logs, backup storage verification

### US-10.1-AC02

**Criterion**: Backup encryption verified; backup integrity checksums validated; backup rotation policy (retain 30 days daily, 12 months monthly).

- **Test Method**: Ops review
- **Evidence Required**: Encryption verification, rotation policy

---

## US-10.2

### US-10.2-AC01

**Criterion**: Quarterly backup restore tests performed; restore procedure documented; restore RTO ≤4h, RPO ≤24h verified.

- **Test Method**: Ops review
- **Evidence Required**: Restore test logs, RTO/RPO verification

### US-10.2-AC02

**Criterion**: Restore tests include data integrity verification; restored data matches source; restore procedure tested end-to-end.

- **Test Method**: Ops review
- **Evidence Required**: Restore test results, integrity verification

---

## US-10.3

### US-10.3-AC01

**Criterion**: Disaster recovery procedures documented in runbook; DR scenarios tested (regional failover, data center outage); RTO ≤4h, RPO ≤24h.

- **Test Method**: Ops review
- **Evidence Required**: DR runbook, DR test results

### US-10.3-AC02

**Criterion**: DR procedures include communication plan, escalation paths, and rollback procedures; procedures reviewed quarterly.

- **Test Method**: Ops review
- **Evidence Required**: DR documentation, review records

---

## US-10.4

### US-10.4-AC01

**Criterion**: Health check endpoint GET /api/v1/health returns 200 with service status (database, storage, external services); health checks used by load balancer.

- **Test Method**: Integration
- **Evidence Required**: Health check responses, load balancer configuration

### US-10.4-AC02

**Criterion**: Health check includes readiness and liveness probes; unhealthy services removed from load balancer; health status monitored.

- **Test Method**: Integration
- **Evidence Required**: Health check implementation, monitoring verification

---

## US-10.5

### US-10.5-AC01

**Criterion**: Read-only mode implemented via system configuration; read-only mode prevents all write operations (POST, PATCH, DELETE return 503).

- **Test Method**: Integration
- **Evidence Required**: Read-only mode tests, maintenance mode verification

### US-10.5-AC02

**Criterion**: Read-only mode can be toggled via admin endpoint or environment variable; mode change takes effect within ≤10s.

- **Test Method**: Integration
- **Evidence Required**: Mode toggle tests, activation timing

---

## US-11.1

### US-11.1-AC01

**Criterion**: Duplicate 2FA routes removed from auth.routes.ts (lines 99-128); twofa.controller.ts and twofa.service.ts deleted if unused.

- **Test Method**: Code review
- **Evidence Required**: Code diff, route conflict resolution

### US-11.1-AC02

**Criterion**: Only two-factor.controller.ts and two-factor.routes.ts remain; all 2FA functionality uses single implementation; tests updated.

- **Test Method**: Code review
- **Evidence Required**: Code verification, test updates

---

## US-11.2

### US-11.2-AC01

**Criterion**: All 62 skipped tests reviewed; tests either fixed, documented (with reason), or removed; test coverage maintained or improved.

- **Test Method**: Code review
- **Evidence Required**: Skipped test review log, test fixes

### US-11.2-AC02

**Criterion**: Skipped test reasons documented in test files or test plan; intentional skips justified; no tests skipped without reason.

- **Test Method**: Code review
- **Evidence Required**: Test documentation, skip reason verification

---

## US-11.3

### US-11.3-AC01

**Criterion**: Timer cleanup standardized: tests using jest.useFakeTimers() restore in afterEach; no global timer clearing; pattern documented.

- **Test Method**: Code review
- **Evidence Required**: Timer cleanup pattern, test updates

---

## US-11.4

### US-11.4-AC01

**Criterion**: Database connection cleanup verified: all tests that create connections close them in afterEach/afterAll; no open handles detected.

- **Test Method**: Integration
- **Evidence Required**: Connection cleanup tests, open handle verification

---

## US-11.5

### US-11.5-AC01

**Criterion**: All public APIs have JSDoc comments with parameter descriptions, return types, and examples; documentation coverage ≥80%.

- **Test Method**: Code review
- **Evidence Required**: JSDoc coverage report, documentation samples

### US-11.5-AC02

**Criterion**: Complex business logic has inline comments explaining rationale; code is self-documenting where possible; README files updated.

- **Test Method**: Code review
- **Evidence Required**: Code documentation review, README updates

---

## US-2.1

### US-2.1-AC01

**Criterion**: Users can create exercises via POST /api/v1/exercises with required fields (name, type_code) and optional fields (muscle_group, equipment, tags, description); exercise saved within ≤500ms.

- **Test Method**: Integration + E2E
- **Evidence Required**: DB snapshot, UI screenshots, API response times

### US-2.1-AC02

**Criterion**: Users can update their own exercises via PATCH /api/v1/exercises/:id; edits preserve historical accuracy; unauthorized edits return 403.

- **Test Method**: Integration + E2E
- **Evidence Required**: Update tests, access control verification

### US-2.1-AC03

**Criterion**: Exercises can be archived (soft delete) via DELETE /api/v1/exercises/:id; archived exercises have archived_at timestamp set; they are hidden from selectors but retained in database.

- **Test Method**: Integration + E2E
- **Evidence Required**: DB records, UI showing archived exercises not in selectors

### US-2.1-AC04

**Criterion**: Exercise visibility model: private (default, owner_id = user_id) or public (is_public = true); private exercises only visible to creator.

- **Test Method**: Integration + E2E
- **Evidence Required**: Access control tests, UI screenshots

### US-2.1-AC05

**Criterion**: Exercise name uniqueness enforced per owner: (owner_id, normalized_name) unique constraint; duplicate names rejected with 409 CONFLICT.

- **Test Method**: Unit + API negative
- **Evidence Required**: Uniqueness test results, error responses

---

## US-2.2

### US-2.2-AC01

**Criterion**: Users can search public exercises via GET /api/v1/exercises?is_public=true&q=searchterm with pagination (default 20, max 100).

- **Test Method**: E2E
- **Evidence Required**: Search results, API response times

### US-2.2-AC02

**Criterion**: Exercise search supports filtering by category (type_code), muscle_group, equipment, and tags; filters can be combined.

- **Test Method**: E2E
- **Evidence Required**: Filter UI screenshots, filtered search results

### US-2.2-AC03

**Criterion**: Search results are sorted by relevance (name match) or date; empty results return empty array with 200 status.

- **Test Method**: E2E
- **Evidence Required**: Search result ordering, empty result handling

---

## US-2.3

### US-2.3-AC01

**Criterion**: When an exercise is used in a session, exercise name is stored as snapshot in session_exercises.exercise_name field; snapshot persists even if exercise is later modified or archived.

- **Test Method**: Integration
- **Evidence Required**: DB records showing snapshot preservation, exercise modification tests

### US-2.3-AC02

**Criterion**: Historical sessions display exercise name from snapshot, not current exercise name; exercise changes do not affect past session records.

- **Test Method**: Integration + E2E
- **Evidence Required**: Historical session display tests, exercise modification verification

---

## US-2.4

### US-2.4-AC01

**Criterion**: Administrators can create global exercises (owner_id = null) via POST /api/v1/exercises with admin role; global exercises are accessible to all users.

- **Test Method**: Integration + E2E
- **Evidence Required**: Admin UI screenshots, access control tests

### US-2.4-AC02

**Criterion**: Administrators can edit and archive global exercises; non-admin users cannot modify global exercises (403 Forbidden).

- **Test Method**: Integration + E2E
- **Evidence Required**: Admin edit tests, non-admin access denial

---

## US-2.5

### US-2.5-AC01

**Criterion**: Exercise selector in Planner and Logger displays user's personal exercises, global exercises, and public exercises; archived exercises are excluded.

- **Test Method**: E2E
- **Evidence Required**: Exercise selector UI screenshots, exercise list verification

### US-2.5-AC02

**Criterion**: Exercise selector supports search and filtering; selected exercise is added to session with proper reference.

- **Test Method**: E2E
- **Evidence Required**: Selector search tests, exercise addition verification

---

## US-2.6

### US-2.6-AC01

**Criterion**: Unit tests cover exercise CRUD operations, archival, visibility model, and uniqueness constraints with ≥90% code coverage.

- **Test Method**: Unit
- **Evidence Required**: Test coverage reports

### US-2.6-AC02

**Criterion**: Integration tests verify exercise creation, editing, archival, search, and access control scenarios.

- **Test Method**: Integration
- **Evidence Required**: Integration test results

### US-2.6-AC03

**Criterion**: E2E tests verify complete exercise management workflow including creation, search, selection, and archival.

- **Test Method**: E2E
- **Evidence Required**: E2E test results, UI screenshots

---

## US-3.1

### US-3.1-AC01

**Criterion**: Authenticated users can access public feed via GET /api/v1/feed?scope=public with pagination (default 20 items per page, max 100); feed returns public sessions only.

- **Test Method**: Integration + E2E
- **Evidence Required**: Feed API responses, pagination tests, UI screenshots

### US-3.1-AC02

**Criterion**: Feed supports search via ?q=keyword parameter; search matches session titles, exercise names, and user aliases.

- **Test Method**: E2E
- **Evidence Required**: Search functionality tests, search result screenshots

### US-3.1-AC03

**Criterion**: Feed supports sorting by date (default), popularity (likes), and relevance; sort parameter ?sort=date|popularity|relevance.

- **Test Method**: E2E
- **Evidence Required**: Sort functionality tests, sorted feed screenshots

### US-3.1-AC04

**Criterion**: Feed response time p95 ≤400ms per PRD performance targets; feed is cached for 30s via NGINX edge caching.

- **Test Method**: Performance
- **Evidence Required**: Performance metrics, cache hit ratio

---

## US-3.2

### US-3.2-AC01

**Criterion**: Users can toggle session visibility (private/public) via PATCH /api/v1/sessions/:id with visibility field; default is private.

- **Test Method**: Integration + E2E
- **Evidence Required**: Visibility toggle tests, API responses

### US-3.2-AC02

**Criterion**: Switching session from private to public makes it visible in feed within ≤2s; switching from public to private removes it from feed immediately; past private data never leaked.

- **Test Method**: Integration + Security
- **Evidence Required**: Privacy tests, data leakage verification, feed update timing

---

## US-3.3

### US-3.3-AC01

**Criterion**: Users can like/unlike public sessions via POST /api/v1/feed/item/:feedItemId/like and DELETE /api/v1/feed/item/:feedItemId/like; like action is idempotent.

- **Test Method**: Integration + E2E
- **Evidence Required**: Like button tests, API responses, idempotency verification

### US-3.3-AC02

**Criterion**: Like counts update in real-time within ≤500ms; like count displayed on feed items and session details.

- **Test Method**: Integration + E2E
- **Evidence Required**: Count update tests, UI screenshots, API response times

### US-3.3-AC03

**Criterion**: Users can bookmark/unbookmark sessions via POST /api/v1/sessions/:id/bookmark and DELETE /api/v1/sessions/:id/bookmark; bookmarks are idempotent.

- **Test Method**: E2E
- **Evidence Required**: Bookmark UI screenshots, bookmark functionality tests

### US-3.3-AC04

**Criterion**: Users can view their bookmarked sessions via GET /api/v1/users/me/bookmarks with pagination.

- **Test Method**: E2E
- **Evidence Required**: Bookmark collection view tests, UI screenshots

---

## US-3.4

### US-3.4-AC01

**Criterion**: Users can comment on public sessions via POST /api/v1/feed/item/:feedItemId/comments with body (plain text, max 500 chars); comments are idempotent.

- **Test Method**: E2E
- **Evidence Required**: Comment UI screenshots, comment creation tests

### US-3.4-AC02

**Criterion**: Comments are displayed with author info, timestamp, and proper formatting; comments list paginated (default 20 per page).

- **Test Method**: E2E
- **Evidence Required**: Comment display tests, comment list screenshots

### US-3.4-AC03

**Criterion**: Comment owners and session owners can delete comments via DELETE /api/v1/comments/:commentId; deleted comments are soft-deleted (deleted_at set).

- **Test Method**: E2E
- **Evidence Required**: Comment deletion tests, access control verification

### US-3.4-AC04

**Criterion**: Comment rate limiting: 20 comments per hour per user; exceeding limit returns 429 with Retry-After header.

- **Test Method**: Integration
- **Evidence Required**: Rate limit tests, HTTP headers

---

## US-3.5

### US-3.5-AC01

**Criterion**: Users can follow/unfollow other users via POST /api/v1/users/:alias/follow and DELETE /api/v1/users/:alias/follow; users cannot follow themselves (422 error).

- **Test Method**: Integration + E2E
- **Evidence Required**: Follow button tests, follower count tests, self-follow prevention

### US-3.5-AC02

**Criterion**: Follower and following counts update correctly; counts displayed on user profiles; GET /api/v1/users/:alias/followers and /following return paginated lists.

- **Test Method**: Integration + E2E
- **Evidence Required**: Follower count tests, UI screenshots, API responses

### US-3.5-AC03

**Criterion**: Follow rate limiting: 50 follows per day per user; exceeding limit returns 429.

- **Test Method**: Integration
- **Evidence Required**: Rate limit tests

---

## US-3.6

### US-3.6-AC01

**Criterion**: Users can clone public sessions via POST /api/v1/sessions/:id/clone or POST /api/v1/feed/session/:sessionId/clone; cloned session created as planned session for current user.

- **Test Method**: Integration + E2E
- **Evidence Required**: Clone functionality tests, cloned session verification

### US-3.6-AC02

**Criterion**: Cloned sessions preserve attribution: source_session_id or metadata field contains original session ID and creator info; attribution visible in UI.

- **Test Method**: Integration + E2E
- **Evidence Required**: Attribution verification, UI screenshots showing attribution

### US-3.6-AC03

**Criterion**: Users can modify cloned sessions (title, date, exercises, sets); modifications do not affect original session.

- **Test Method**: E2E
- **Evidence Required**: Modification tests, original session preservation

---

## US-3.7

### US-3.7-AC01

**Criterion**: Users can report inappropriate content (sessions or comments) via POST /api/v1/feed/report with reason and details; reports are idempotent.

- **Test Method**: Integration + E2E
- **Evidence Required**: Report UI screenshots, report creation tests

### US-3.7-AC02

**Criterion**: Reports appear in admin moderation queue; admins can view reports via GET /api/v1/admin/reports with filtering and pagination.

- **Test Method**: Integration + E2E
- **Evidence Required**: Admin queue tests, report list screenshots

### US-3.7-AC03

**Criterion**: Report rate limiting: 10 reports per day per user; exceeding limit returns 429.

- **Test Method**: Integration
- **Evidence Required**: Rate limit tests

---

## US-3.8

### US-3.8-AC01

**Criterion**: Unit tests cover like, bookmark, comment, follow, and clone operations with ≥90% code coverage.

- **Test Method**: Unit
- **Evidence Required**: Test coverage reports

### US-3.8-AC02

**Criterion**: Integration tests verify feed access, social interactions, cloning, and reporting scenarios.

- **Test Method**: Integration
- **Evidence Required**: Integration test results

### US-3.8-AC03

**Criterion**: E2E tests verify complete social workflow including feed browsing, liking, commenting, following, and cloning.

- **Test Method**: E2E
- **Evidence Required**: E2E test results, UI screenshots

---

## US-4.1

### US-4.1-AC01

**Criterion**: Users can create training plans via POST /api/v1/plans with name, start_date, end_date; plan saved within ≤500ms.

- **Test Method**: Integration
- **Evidence Required**: DB snapshot, API response times

### US-4.1-AC02

**Criterion**: Users can update plans via PATCH /api/v1/plans/:id; updates persist and visible after reload.

- **Test Method**: Integration
- **Evidence Required**: Update tests, persistence verification

### US-4.1-AC03

**Criterion**: Users can delete plans via DELETE /api/v1/plans/:id; deletion is soft-delete (archived_at set); associated sessions are not deleted.

- **Test Method**: Integration
- **Evidence Required**: Deletion tests, session preservation verification

### US-4.1-AC04

**Criterion**: Plan concurrency: last-writer-wins with ETag support; stale ETag returns 412 Precondition Failed with conflict banner.

- **Test Method**: Integration
- **Evidence Required**: ETag headers, concurrency test results

---

## US-4.2

### US-4.2-AC01

**Criterion**: Users can activate a plan via POST /api/v1/plans/:id/activate; activation generates scheduled sessions based on plan template and recurrence rules.

- **Test Method**: Integration
- **Evidence Required**: Activation tests, generated sessions verification

### US-4.2-AC02

**Criterion**: Plan progress tracking: progress_percent calculated as (completed_count / session_count) \* 100; progress updates when sessions are completed.

- **Test Method**: Integration
- **Evidence Required**: Progress calculation tests, progress update verification

### US-4.2-AC03

**Criterion**: Plan duration validation: duration_weeks ∈ [1..52]; target_frequency ∈ [1..7] sessions per week; invalid values rejected with 422.

- **Test Method**: Unit + API negative
- **Evidence Required**: Validation test results, error responses

---

## US-4.3

### US-4.3-AC01

**Criterion**: Drag-and-drop scheduling updates session planned_at without full page reload; calendar re-renders within ≤150ms on modern desktop.

- **Test Method**: E2E
- **Evidence Required**: Performance traces, drag-and-drop functionality tests

### US-4.3-AC02

**Criterion**: Overlapping sessions detected client-side before save with actionable error message and visual highlight of conflicts.

- **Test Method**: Unit + E2E
- **Evidence Required**: Conflict detection tests, UI screenshots

### US-4.3-AC03

**Criterion**: Server re-validates session overlaps; rejects with 422 and returns conflicting session IDs in error response.

- **Test Method**: API negative
- **Evidence Required**: HTTP traces, error responses with conflict details

### US-4.3-AC04

**Criterion**: Calendar view displays sessions with proper time slots, colors, and labels; supports month/week/day views.

- **Test Method**: E2E
- **Evidence Required**: Calendar UI screenshots, view switching tests

---

## US-4.4

### US-4.4-AC01

**Criterion**: Mobile drag/resize works via touch gestures (touchstart, touchmove, touchend); no scroll-jank with long tasks >50ms.

- **Test Method**: E2E mobile emu
- **Evidence Required**: Performance traces, touch gesture tests

### US-4.4-AC02

**Criterion**: Touch gestures are responsive and provide visual feedback; calendar is usable on mobile devices (screen width ≥320px).

- **Test Method**: E2E mobile emu
- **Evidence Required**: Mobile UI screenshots, usability tests

---

## US-4.5

### US-4.5-AC01

**Criterion**: Unit tests cover plan CRUD, activation, session generation, and progress tracking with ≥90% code coverage.

- **Test Method**: Unit
- **Evidence Required**: Test coverage reports

### US-4.5-AC02

**Criterion**: Integration tests verify plan management, activation flow, conflict detection, and progress calculation.

- **Test Method**: Integration
- **Evidence Required**: Integration test results

### US-4.5-AC03

**Criterion**: E2E tests verify complete planner workflow including drag-and-drop, conflict detection, and mobile touch gestures.

- **Test Method**: E2E
- **Evidence Required**: E2E test results, UI screenshots

---

## US-5.1

### US-5.1-AC01

**Criterion**: Users can log session metrics (duration, distance, heart rate, sets, reps, weight) via PATCH /api/v1/sessions/:id with status='completed'; metrics saved within ≤500ms.

- **Test Method**: Integration + E2E
- **Evidence Required**: Logging tests, DB records, API response times

### US-5.1-AC02

**Criterion**: Session edits are audit-logged with who/when/what; audit records include field changes and timestamps.

- **Test Method**: Unit + Integration
- **Evidence Required**: Audit log excerpts, edit history verification

### US-5.1-AC03

**Criterion**: Logger frontend allows manual entry of all metrics with proper validation and unit conversion.

- **Test Method**: E2E
- **Evidence Required**: Logger UI screenshots, form validation tests

---

## US-5.2

### US-5.2-AC01

**Criterion**: Users can import GPX files via POST /api/v1/sessions/import with file upload; GPX parser extracts track points, elevation, and timestamps.

- **Test Method**: Fuzz + fixtures
- **Evidence Required**: GPX parser test results, import success/failure logs

### US-5.2-AC02

**Criterion**: GPX parser handles ≥99% valid GPX samples; malformed GPX files produce user-facing error (422) without application crash.

- **Test Method**: Fuzz + fixtures
- **Evidence Required**: Corpus results, error handling tests

### US-5.2-AC03

**Criterion**: Imported GPX data creates session with proper metrics (distance, duration, elevation gain/loss); timezone normalization applied.

- **Test Method**: Unit
- **Evidence Required**: Parser snapshots, imported session verification

---

## US-5.3

### US-5.3-AC01

**Criterion**: Users can import FIT files via POST /api/v1/sessions/import; FIT parser extracts GPS, heart rate, power, and other device metrics.

- **Test Method**: Fuzz + fixtures
- **Evidence Required**: FIT parser test results, import success/failure logs

### US-5.3-AC02

**Criterion**: FIT parser handles ≥99% valid FIT samples; malformed FIT files produce user-facing error (422) without crash.

- **Test Method**: Fuzz + fixtures
- **Evidence Required**: Corpus results, error handling tests

### US-5.3-AC03

**Criterion**: FIT file metadata (GPS coordinates, heart rate zones, timezone) respected; timezone normalization applied correctly.

- **Test Method**: Unit
- **Evidence Required**: Parser snapshots, metadata extraction verification

---

## US-5.4

### US-5.4-AC01

**Criterion**: Editing pace or elevation triggers automatic recalculation of derived metrics (average pace, elevation gain/loss, normalized power) within ≤200ms.

- **Test Method**: Integration
- **Evidence Required**: Recalculation logs, metric update verification

### US-5.4-AC02

**Criterion**: Metric recalculation is idempotent: same inputs produce same outputs; snapshot tests remain stable across runs.

- **Test Method**: Unit
- **Evidence Required**: Snapshot tests, idempotency verification

---

## US-5.5

### US-5.5-AC01

**Criterion**: Offline logging buffers session events in local storage (IndexedDB); events sync to server within ≤5s after network reconnect.

- **Test Method**: E2E (PWA offline)
- **Evidence Required**: Network traces, sync verification, offline storage tests

### US-5.5-AC02

**Criterion**: Service worker enables offline functionality; sync queue handles failed syncs with retry logic (exponential backoff).

- **Test Method**: E2E (PWA offline)
- **Evidence Required**: Service worker tests, sync queue verification

---

## US-5.6

### US-5.6-AC01

**Criterion**: Fuzz tests cover GPX and FIT parsers with diverse file samples; parser handles edge cases (empty files, malformed XML/binary, missing fields).

- **Test Method**: Fuzz + fixtures
- **Evidence Required**: Fuzz test results, corpus coverage

### US-5.6-AC02

**Criterion**: Import tests verify file validation, parsing accuracy, error handling, and metric calculation correctness.

- **Test Method**: Unit + Integration
- **Evidence Required**: Import test results, accuracy verification

---

## US-6.1

### US-6.1-AC01

**Criterion**: Users can request data export via GET /api/v1/users/me/export; export generates JSON bundle with user, profile, sessions, exercises, points, badges within ≤24h.

- **Test Method**: E2E DSR
- **Evidence Required**: Export job logs, JSON bundle samples

### US-6.1-AC02

**Criterion**: Export link valid for 24h; download available via secure link; export includes all user data per GDPR requirements.

- **Test Method**: E2E DSR
- **Evidence Required**: Export link tests, data completeness verification

---

## US-6.2

### US-6.2-AC01

**Criterion**: Users can delete account via DELETE /api/v1/users/me; deletion marks account as pending_deletion; hard deletion occurs within 30 days.

- **Test Method**: E2E DSR
- **Evidence Required**: Deletion tests, account status verification

### US-6.2-AC02

**Criterion**: Account deletion propagates to backups within ≤14 days (configurable); deletion receipt issued in audit log.

- **Test Method**: Ops review
- **Evidence Required**: Deletion pipeline logs, backup verification

### US-6.2-AC03

**Criterion**: Deletion invalidates all active sessions; user cannot login after deletion; data anonymized where required for referential integrity.

- **Test Method**: Integration
- **Evidence Required**: Session invalidation tests, anonymization verification

---

## US-6.3

### US-6.3-AC01

**Criterion**: Users can manage consent preferences via UI; consent stored in database with timestamp and version; opt-out respected within ≤5m across services.

- **Test Method**: E2E
- **Evidence Required**: Consent UI screenshots, consent storage verification

### US-6.3-AC02

**Criterion**: Consent banner gates optional analytics; consent changes trigger immediate effect; consent history maintained for audit.

- **Test Method**: E2E
- **Evidence Required**: Consent banner tests, analytics gating verification

---

## US-6.4

### US-6.4-AC01

**Criterion**: Users can configure privacy settings for profile (hide age/weight) and content (default visibility) via privacy settings UI.

- **Test Method**: E2E
- **Evidence Required**: Privacy settings UI screenshots, settings persistence tests

### US-6.4-AC02

**Criterion**: Privacy settings take effect immediately; past data visibility not retroactively changed; settings persisted in user profile.

- **Test Method**: Integration + Security
- **Evidence Required**: Privacy tests, settings application verification

---

## US-6.5

### US-6.5-AC01

**Criterion**: All GDPR-related events (export requests, deletion requests, consent changes) are audit-logged with timestamp, user ID, and action details.

- **Test Method**: Integration
- **Evidence Required**: Audit log excerpts, GDPR event verification

### US-6.5-AC02

**Criterion**: Audit logs are retained per retention policy; logs are searchable and exportable for compliance demonstrations.

- **Test Method**: Ops review
- **Evidence Required**: Audit log retention verification, search functionality

---

## US-6.6

### US-6.6-AC01

**Criterion**: Integration tests verify data export flow, deletion flow, consent management, and privacy settings with GDPR compliance checks.

- **Test Method**: Integration
- **Evidence Required**: GDPR flow test results

### US-6.6-AC02

**Criterion**: E2E tests verify complete GDPR user journeys including export request, download, account deletion, and consent management.

- **Test Method**: E2E DSR
- **Evidence Required**: E2E test results, GDPR journey screenshots

---

## US-7.1

### US-7.1-AC01

**Criterion**: API latency p95 ≤300ms for all endpoints per PRD targets; slow endpoints identified and optimized.

- **Test Method**: Performance
- **Evidence Required**: Performance metrics, latency histograms

### US-7.1-AC02

**Criterion**: Per-endpoint budgets met: Auth ≤200ms, CRUD ≤300ms, Analytics ≤600ms, Feed ≤400ms p95.

- **Test Method**: Performance
- **Evidence Required**: Endpoint latency metrics, budget compliance

---

## US-7.2

### US-7.2-AC01

**Criterion**: Database queries optimized with proper indexes; slow query threshold 200ms; queries exceeding threshold logged and optimized.

- **Test Method**: Performance
- **Evidence Required**: Query performance metrics, index usage reports

### US-7.2-AC02

**Criterion**: Large tables (sessions, user_points) partitioned by month; partitions automatically pruned; connection pooling p95 wait <5ms.

- **Test Method**: Performance
- **Evidence Required**: Partitioning verification, pool metrics

---

## US-7.3

### US-7.3-AC01

**Criterion**: Frontend JS bundle size ≤300KB gzipped; Lighthouse CI budget enforced; bundle size regression >10% blocks merge.

- **Test Method**: Performance
- **Evidence Required**: Bundle size reports, Lighthouse CI results

### US-7.3-AC02

**Criterion**: Code splitting implemented for non-critical routes; lazy loading mandatory; critical CSS inlined.

- **Test Method**: Performance
- **Evidence Required**: Bundle analysis, code splitting verification

---

## US-7.4

### US-7.4-AC01

**Criterion**: Frontend performance metrics meet targets: LCP ≤2.5s, CLS ≤0.1, TTI ≤3.0s on mid-tier device, 4G connection.

- **Test Method**: Performance
- **Evidence Required**: Lighthouse reports, Web Vitals metrics

### US-7.4-AC02

**Criterion**: Performance regression >10% from baseline blocks release; Lighthouse CI runs per PR with budget enforcement.

- **Test Method**: Performance
- **Evidence Required**: Lighthouse CI results, regression reports

---

## US-7.5

### US-7.5-AC01

**Criterion**: Read-through caching implemented for heavy queries (feed, progress); cache TTL 60s default with explicit invalidation on data changes.

- **Test Method**: Integration
- **Evidence Required**: Cache hit ratio metrics, invalidation tests

### US-7.5-AC02

**Criterion**: Cache strategy documented; cache keys follow naming convention; cache warming for frequently accessed data.

- **Test Method**: Documentation review
- **Evidence Required**: Cache documentation, cache key patterns

---

## US-7.6

### US-7.6-AC01

**Criterion**: Materialized views created for analytics (session_summary, exercise_prs, weekly_aggregates); views refreshed asynchronously (REFRESH CONCURRENTLY).

- **Test Method**: Integration
- **Evidence Required**: Materialized view definitions, refresh job logs

### US-7.6-AC02

**Criterion**: Materialized views refresh on session completion or nightly; refresh is non-blocking; view consistency verified.

- **Test Method**: Integration
- **Evidence Required**: Refresh job logs, consistency tests

---

## US-7.7

### US-7.7-AC01

**Criterion**: k6 load tests configured and run in CI; tests validate throughput ≥500 req/s sustained, 1000 req/s burst.

- **Test Method**: Performance
- **Evidence Required**: k6 test results, throughput metrics

### US-7.7-AC02

**Criterion**: Performance regression >10% from baseline blocks release; baseline dataset ≥10k sessions for realistic query costs.

- **Test Method**: Performance
- **Evidence Required**: Performance test results, regression reports

---

## US-7.8

### US-7.8-AC01

**Criterion**: Performance metrics exposed via Prometheus: http_request_duration_ms, db_query_duration_ms, frontend_lcp_ms; metrics available in Grafana dashboards.

- **Test Method**: Integration
- **Evidence Required**: Prometheus metrics, Grafana dashboard screenshots

### US-7.8-AC02

**Criterion**: Performance alerts configured: p95 latency >400ms for 10min (warning), error rate >0.5% for 5min (critical).

- **Test Method**: Ops review
- **Evidence Required**: Alert configuration, alert test results

---

## US-8.1

### US-8.1-AC01

**Criterion**: All interactive elements have proper ARIA labels (aria-label, aria-labelledby, aria-describedby); semantic HTML used (button, nav, main, etc.).

- **Test Method**: Accessibility audit
- **Evidence Required**: ARIA audit results, HTML semantic verification

### US-8.1-AC02

**Criterion**: Form inputs have associated labels; form errors announced to screen readers; form structure is logical.

- **Test Method**: Accessibility audit
- **Evidence Required**: Form accessibility tests, label association verification

---

## US-8.2

### US-8.2-AC01

**Criterion**: All features navigable using only keyboard (Tab, Enter, Space, Arrow keys); focus indicators visible (2px outline, sufficient contrast).

- **Test Method**: Accessibility audit
- **Evidence Required**: Keyboard navigation tests, focus indicator screenshots

### US-8.2-AC02

**Criterion**: No keyboard traps; skip links available for main content; tab order is logical and predictable.

- **Test Method**: Accessibility audit
- **Evidence Required**: Keyboard trap tests, skip link verification

---

## US-8.3

### US-8.3-AC01

**Criterion**: Color contrast meets WCAG 2.2 AA standards: text 4.5:1 for normal text, 3:1 for large text; UI components 3:1.

- **Test Method**: Accessibility audit
- **Evidence Required**: Color contrast audit results, contrast ratio measurements

### US-8.3-AC02

**Criterion**: Color is not the only means of conveying information; icons, labels, or patterns supplement color coding.

- **Test Method**: Accessibility audit
- **Evidence Required**: Color dependency audit, alternative indicator verification

---

## US-8.4

### US-8.4-AC01

**Criterion**: Application tested with screen readers (NVDA, JAWS, VoiceOver); all features accessible and functional.

- **Test Method**: Screen reader testing
- **Evidence Required**: Screen reader test results, accessibility test reports

### US-8.4-AC02

**Criterion**: Dynamic content changes announced to screen readers; live regions (aria-live) used appropriately; page structure is logical.

- **Test Method**: Screen reader testing
- **Evidence Required**: Screen reader announcements, live region tests

---

## US-8.5

### US-8.5-AC01

**Criterion**: Focus management in modals: focus trapped within modal, focus returns to trigger on close, initial focus on first interactive element.

- **Test Method**: Accessibility audit
- **Evidence Required**: Modal focus tests, focus management verification

### US-8.5-AC02

**Criterion**: Dynamic content (dropdowns, tooltips, notifications) manages focus appropriately; focus not lost unexpectedly.

- **Test Method**: Accessibility audit
- **Evidence Required**: Dynamic content focus tests

---

## US-8.6

### US-8.6-AC01

**Criterion**: Automated accessibility tests (axe-core) run in CI; tests cover all pages and components; violations block merge.

- **Test Method**: Automated testing
- **Evidence Required**: CI test results, axe violation reports

### US-8.6-AC02

**Criterion**: Accessibility test coverage ≥80% of interactive elements; critical violations (level 1) must be zero.

- **Test Method**: Automated testing
- **Evidence Required**: Test coverage reports, violation counts

---

## US-8.7

### US-8.7-AC01

**Criterion**: Lighthouse accessibility score = 100; all accessibility audits pass; score maintained across releases.

- **Test Method**: Lighthouse CI
- **Evidence Required**: Lighthouse reports, accessibility score history

### US-8.7-AC02

**Criterion**: Lighthouse CI runs per PR; accessibility score regression blocks merge; budget enforced.

- **Test Method**: Lighthouse CI
- **Evidence Required**: Lighthouse CI results, budget compliance

---

## US-9.1

### US-9.1-AC01

**Criterion**: All logs are structured JSON with required fields: ts, level, request_id, user_id (if authenticated), route, status, lat_ms; no PII in logs.

- **Test Method**: Integration
- **Evidence Required**: Log samples, PII scan results

### US-9.1-AC02

**Criterion**: Correlation IDs (request_id) propagated across services; request tracing possible via correlation ID search.

- **Test Method**: Integration
- **Evidence Required**: Correlation ID propagation tests, trace verification

---

## US-9.2

### US-9.2-AC01

**Criterion**: Prometheus metrics exposed for all endpoints: http_request_duration_seconds (histogram), http_requests_total (counter) with method, route, status labels.

- **Test Method**: Integration
- **Evidence Required**: Prometheus metrics, metric definitions

### US-9.2-AC02

**Criterion**: Database metrics: db_query_duration_seconds (histogram) with op, table labels; background job metrics: background_job_duration_seconds.

- **Test Method**: Integration
- **Evidence Required**: DB metrics, job metrics

### US-9.2-AC03

**Criterion**: Metric cardinality bounded: route labels normalized, user IDs excluded, label sets limited to prevent cardinality explosion.

- **Test Method**: Integration
- **Evidence Required**: Cardinality analysis, metric samples

---

## US-9.3

### US-9.3-AC01

**Criterion**: OpenTelemetry tracing implemented with traceparent propagation; sampling rate 10% prod, 100% staging; spans include timing only (no PII).

- **Test Method**: Integration
- **Evidence Required**: Tracing configuration, trace samples

### US-9.3-AC02

**Criterion**: Traces cover full request lifecycle: HTTP → service → database; trace IDs searchable in observability platform.

- **Test Method**: Integration
- **Evidence Required**: Trace samples, trace completeness verification

---

## US-9.4

### US-9.4-AC01

**Criterion**: Grafana dashboards created for: API latency (p95), error rate, DB health, job queues, uploads AV, performance budgets.

- **Test Method**: Ops review
- **Evidence Required**: Grafana dashboard screenshots, dashboard definitions

### US-9.4-AC02

**Criterion**: Dashboards refresh automatically; data retention configured; dashboards accessible to ops team.

- **Test Method**: Ops review
- **Evidence Required**: Dashboard configuration, access verification

---

## US-9.5

### US-9.5-AC01

**Criterion**: Alerting rules configured for: 5xx rate spikes (>0.5% for 5min), p95 latency breaches (>400ms for 10min), DB pool saturation, auth lockout anomalies.

- **Test Method**: Ops review
- **Evidence Required**: Alert rule definitions, alert test results

### US-9.5-AC02

**Criterion**: Alerts sent to appropriate channels (PagerDuty, Slack, email); alert routing based on severity; alert fatigue prevented.

- **Test Method**: Ops review
- **Evidence Required**: Alert configuration, notification channel tests

---

## US-9.6

### US-9.6-AC01

**Criterion**: Log aggregation pipeline configured (Loki or compatible); logs ingested from all services; logs searchable by correlation ID, user ID, timestamp.

- **Test Method**: Ops review
- **Evidence Required**: Log aggregation configuration, search functionality

### US-9.6-AC02

**Criterion**: Log retention policy configured (default 30 days, configurable); log storage optimized; log queries performant (<2s for typical searches).

- **Test Method**: Ops review
- **Evidence Required**: Retention policy, query performance metrics

---
