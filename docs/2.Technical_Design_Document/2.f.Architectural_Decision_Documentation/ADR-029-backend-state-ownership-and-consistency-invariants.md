# ADR-029: Backend State Ownership and Consistency Invariants

**Date:** 2026-09-22  
**Status:** Accepted  
**Author:** FitVibe Engineering / Product Owner  
**Cross-References:** ADR-002, ADR-007, ADR-010, ADR-013, ADR-024; Backend Technical-Debt Reduction Pass 2

---

## Context

The first backend refactoring pass reduced structural concentration but exposed a more important class of debt: state that can be represented in several places without one clear authority.

Examples found during the second review include stale feed visibility after a session visibility change, performed-workout input that can be accepted and then discarded, completed sessions whose scoring inputs can change without recalculating derived gamification state, authentication counters whose reset semantics blur account and IP state, and legal-document versions derived from mutable metadata.

The second technical-debt pass therefore treats state ownership and invariants as architecture, not implementation detail.

---

## Decision

### 1. General state rule

Every important domain concept has one authoritative persisted representation.

Derived, cached, indexed, denormalized, or externally materialized state:

- must identify its authoritative source;
- must not override the current authority for privacy, authorization, or security decisions;
- must have explicit refresh/recovery semantics;
- must be safe to recompute or reconcile;
- must not silently become a second independent source of truth.

If two values must succeed or fail together in the database, the service operation must make that atomicity explicit.

External side effects such as queue jobs, telemetry, notifications, and remote provider calls are not part of a database transaction. They occur after commit and must be retry-safe when required.

### 2. Sessions, exercises, and performed workout data

**Authority**

- Session lifecycle and visibility are owned by the session record.
- Planned exercise structure is owned by the session/exercise planning records.
- Performed workout data is owned by `exercise_sets`.

**Invariants**

- `exercise_sets` is the long-term sole source of truth for performed reps, load, duration, and other performed-set attributes.
- A public API must not accept a separate performed-workout representation and then discard it.
- Compatibility input, if temporarily retained during Phase 12, must be explicitly converted to the authoritative set model and have a removal condition.
- A completed session's scoring-relevant workout data is immutable.
- Changing scoring-relevant workout data requires an explicit reopen transition before editing and a subsequent completion transition before scoring again.

**Derived state**

- Session points, feed publication, statistics, streaks, Vibe Level effects, and badge effects are derived from authoritative session/workout state.

### 3. Feed, publication, visibility, and bookmarks

**Authority**

- `session.visibility` is the authority for the session's visibility state.
- Ownership and relationship state remain authoritative for owner/follower access.
- A bookmark is an explicit durable access grant ("key-door" capability) for the bookmarking user; it is not merely presentation metadata.

**Invariants**

- Feed rows may materialize/index visibility for query performance, but materialized values never grant access by themselves.
- Access is decided from current authoritative access state: ownership, applicable visibility/relationship rules, and explicit bookmark grants.
- A user who validly bookmarks a session retains access through that bookmark even if the owner later changes the session visibility to a state that would otherwise deny that user.
- A visibility downgrade immediately prevents new access that is not independently authorized by ownership, an existing bookmark grant, or another explicit access mechanism.
- Stale feed/index state may affect discoverability latency only if it cannot expose data without one of the authoritative access grants above.
- A bookmark may be created only while the user currently has legitimate access to the session.
- Once validly created, the bookmark is a durable independent access grant.
- Unbookmarking removes that bookmark grant immediately; other grants may still provide access.
- The owner has no dedicated per-user bookmark-revocation control in the current model.
- Revoking or expiring the link that originally enabled access does not remove an already-created bookmark grant.
- Blocking is a stronger denial and overrides bookmark, follower, public, and link-based access for the blocked user.
- Session deletion overrides all grants.

This decision extends the older Public/Link/Private visibility model: visibility remains authoritative for visibility, while access can also be conferred by an explicit durable bookmark capability. ADR-010 v1.1 records the full grant-precedence logic, including `followers`, unbookmarking, link revocation, blocking, and deletion.

### 4. Points, Vibe Levels, and badges

**Authority**

- Completed session/workout state is the authoritative business fact.
- Scoring rules interpret that completed workout.
- Points, Vibe Levels, badges, point events and materialized totals are derived state. They may be persisted for performance, auditability and history views, but they are not independent sources of product truth.

**Invariants**

- Completion is the primary operation. Once the source transaction commits successfully, a downstream gamification failure does not roll the session completion back.
- Derived scoring must be retryable and idempotent.
- Concurrent derivation attempts for the same completed scoring lifecycle must converge rather than create duplicate current scoring state or surface uniqueness races as normal application behavior.
- A completed session is stable until an explicit reopen transition.
- Reopen moves the session back into an editable/unscored lifecycle state and may be used to correct any recorded workout fact, including fields used by scoring.
- Accuracy of the workout record takes precedence over preserving a previous gamification result. Gamification must reconcile to corrected authoritative workout data.
- Re-completion reconciles the derived scoring state for that session rather than stacking an unrelated second award.
- Historical points are not immutable accounting history. When scoring rules change, completed historical sessions may be recalculated and current points may be rewritten.
- Persisted points/events must therefore be rebuildable from authoritative completed sessions plus scoring rules. If original calculation values or algorithm versions are retained, they are audit metadata rather than current authority.
- Vibe Level and badge processing occurs after the source transaction commits and follows the same recoverable-derivation principle.
- Concurrent completion/scoring attempts must converge on one current derived result and not expose duplicate-award uniqueness races.
- Normal reopen authority belongs to the session owner; administrative intervention is a separate capability.
- Scoring recalculation follows a hybrid model: affected projections may be marked stale and rebuilt asynchronously, while a known-stale value may be recalculated/reconciled on demand.
- Previous calculated values and algorithm/version identifiers may be retained as audit metadata, while only the latest projection contributes to current gamification totals.
- Points-history pagination must preserve complete ordered traversal with no gaps or duplicates, including rows sharing timestamps.

### 5. Authentication, lockouts, and sessions

**Authority**

- Credential verification state, account security state, auth sessions, account-specific failure state, and aggregate IP failure state are distinct concepts.
- The database representation for each security control is authoritative for that control.

**Invariants**

- Account/IP and aggregate-IP brute-force state are not interchangeable.
- Successful authentication for one account must not erase unrelated attack history for other accounts using the same IP.
- Counter mutation must be atomic under concurrent requests.
- Security-sensitive state is reset only at the explicitly defined successful-authentication transition.
- Where a required security control cannot read its authoritative backing state, the protected operation fails closed unless a later ADR explicitly permits degradation.
- Client IP is security-relevant only when derived through explicitly configured trusted-proxy topology.

Phase 14 defines the detailed authentication transition and reset policy.

### 6. Legal documents and consent

**Authority**

- Legal-document versions will be explicit persisted versions.
- User acceptance records reference the explicit version accepted.

**Invariants**

- File timestamps, translation row `created_at`, filesystem modification times, and similar metadata are not legal version authorities.
- Publishing a new version deterministically creates the acceptance state required by policy.
- Translation changes do not accidentally alter or fail to alter legal acceptance semantics.
- Existing acceptances must be migrated or mapped deliberately during Phase 17.

This is the target architecture and will supersede the version-calculation approach in ADR-024 when Phase 17 is implemented. ADR-024 remains a description of the current implementation until that migration is completed and documented.

### 7. Measurements and attribute definitions

**Authority**

- Measurement records own measured values.
- Measurement attribute definitions own the schema/meaning of those values.
- Translation rows are descriptive/localized metadata for definitions, not an independent measurement authority.

**Invariants**

- Creating a definition and the translation required for that definition is one atomic database operation when both are required for a valid attribute.
- Partial creation is not an accepted state.
- Creator/ownership provenance, if required by product policy, must be represented in schema rather than only in comments or implicit context.

### 8. Secrets

**Authority**

- Application code consumes secrets through a string-value contract.
- AWS, Vault, environment variables, or later providers are adapters to that contract.

**Contract**

```ts
getSecret(key): Promise<string | null>
setSecret(key, value: string): Promise<void>
```

Provider-specific encoding is not visible to consumers.

**Invariants**

- For providers that support writes, a successful `setSecret(key, value)` followed by `getSecret(key)` returns the same string value.
- Provider precedence and environment fallback are explicit.
- Provider errors do not silently change a secret value's meaning.
- Structured provider payloads are adapter concerns, not application-level secret types.

### 9. Consistency classes

FitVibe uses three explicit consistency classes:

1. **Transactional consistency**
   - state that must be valid together inside Postgres;
   - examples: required multi-table definition creation, atomic counters, session/exercise writes.

2. **Immediate authority / derived index**
   - authority commits immediately; indexes/materializations may refresh separately but may never weaken privacy or authorization;
   - example: feed publication/index rows.

3. **Post-commit retryable derivation**
   - source state commits first; idempotent derived processing follows and may be retried;
   - examples: points-derived Vibe Level/badge jobs and similar non-authoritative projections.

A full transactional outbox is not mandated by this ADR. Phase 16 decides whether current failure modes justify one. The default for the current scale is the simplest retry-safe post-commit mechanism that satisfies the invariant.

---

## Consequences

### Positive

- Product behavior is no longer invented independently in controllers, services, repositories, tests, or queue workers.
- Privacy and security decisions use current authoritative state.
- Derived state can be repaired or recomputed without redefining product truth.
- Transaction boundaries can be tested against explicit invariants.
- AI-assisted changes have a concrete architectural target and are less likely to add compensating wrappers or contradictory models.

### Trade-offs

- Some existing APIs and tests must change because they currently encode contradictory behavior.
- Compatibility behavior may require temporary migration code, but it must have explicit removal criteria.
- Post-commit derivation requires retry/idempotency discipline.
- Explicit legal versioning requires a migration away from the existing ADR-024 implementation.

---

## Alternatives Considered

| Option | Description | Reason Rejected |
| --- | --- | --- |
| Preserve multiple mutable representations | Keep session/feed/actual/legal versions independently synchronized | Creates stale-state risk and recurring reconciliation debt |
| Make all side effects transactional | Hold source transaction open while queues/providers/derivations run | External systems cannot participate reliably in the same DB transaction and would increase failure coupling |
| Eventual consistency everywhere | Treat all projections and security/privacy state as eventually consistent | Unacceptable for authorization, privacy, and critical security controls |
| Continue timestamp-derived legal versions | Infer legal version from translation/filesystem metadata | Does not provide a deliberate legal publication/acceptance boundary |
| Structured secrets throughout application code | Expose provider-specific objects to consumers | Couples application semantics to secret-provider storage formats |

---

## Implementation Mapping

- **Phase 12:** session/feed visibility and performed-workout contract.
- **Phase 13:** completed-session lifecycle, scoring, pagination, idempotent gamification derivation.
- **Phase 14:** authentication state machine and brute-force counters.
- **Phase 15:** ineffective security controls and 2FA hardening.
- **Phase 16:** transaction/post-commit boundaries.
- **Phase 17:** explicit legal-document version model; reconcile ADR-024.
- **Phase 18:** provider-independent string secret contract.
- **Phases 19–22:** residue removal, test-quality audit, architecture review, and CI enforcement.

---

## References

- [Backend Technical-Debt Reduction — Pass 2](./BACKEND_TECH_DEBT_REDUCTION_PASS_2.md)
- [ADR-002 — Authentication & Session Strategy](./ADR-002-authentication-token-strategy.md)
- [ADR-007 — Idempotency Policy for Writes](./ADR-007-idempotency-policy-for-writes.md)
- [ADR-010 — Public/Link/Private Visibility Model](./ADR-010-public-link-private-visibility-model.md)
- [ADR-013 — Modular Backend Architecture](./ADR-013-modular-backend-architecture.md)
- [ADR-024 — Legal Document Version Calculation](./ADR-024-legal-document-version-calculation.md)

---

## Status Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| v1.0 | 2026-09-22 | Accepted state ownership and consistency invariants after Phase 11 product-owner interview | FitVibe Engineering / Product Owner |
| v1.1 | 2026-09-22 | Clarified bookmark as a durable user access grant (key-door capability); detailed revocation semantics deferred to Phase 12 | FitVibe Engineering / Product Owner |
| v1.2 | 2026-09-22 | Finalized key-door precedence: unbookmark removes grant; no owner per-user bookmark revoke; link revoke preserves existing bookmark; block and deletion override access | FitVibe Engineering / Product Owner |
| v1.3 | 2026-09-23 | Corrected gamification authority: completed sessions are primary truth; points/Vibe/badges are recomputable derived state and historical points may be rewritten | FitVibe Engineering / Product Owner |
| v1.4 | 2026-09-23 | Prioritized workout-record correctness: reopened completed sessions may correct scoring-relevant data; defined hybrid recalculation, convergence and audit-retention policy | FitVibe Engineering / Product Owner |
| v1.5 | 2026-09-23 | Implemented Phase 13: explicit reopen lifecycle, rebuildable gamification projection, audit revisions, deterministic replay, on-demand stale reconciliation and gap-free points pagination; PR #238 merged after full CI/CodeQL verification | FitVibe Engineering / Product Owner |
