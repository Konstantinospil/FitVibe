# Phase 21 Architecture and Documentation Conformance Review

**Issue:** #268  
**Review baseline:** `dev` after #276, #277 and #278  
**Status:** Conformance corrections prepared; Phase 21 closes only after the review PR passes CI and is merged.

## Architecture findings

### Protected-route authentication

The runtime contract is canonicalized around `modules/auth/auth.middleware.ts`.

- Browser requests authenticate with the HttpOnly access-token cookie.
- Deliberate non-browser/API clients may use `Authorization: Bearer`.
- Every access JWT must contain `sid` and is accepted only while the corresponding `auth_sessions` row is owned by `sub`, unrevoked and unexpired.
- The former `users/users.middleware.ts` path is removed.
- The unused `middlewares/auth.guard.ts` and `services/tokens.ts` compatibility layers are removed in this review because they bypassed the canonical session-backed contract and used a different refresh-token claim shape.

### Legal-document authority

ADR-035 is authoritative. Runtime terms/cookie-policy decisions use persisted legal publications and acceptances. The former timestamp-derived `config/legal-version.ts` authority is absent from `dev`. ADR-024 is explicitly superseded.

### Authentication state transitions

ADR-036 is authoritative. Session creation, refresh rotation, password reset/change and non-active status revocation use atomic database transitions. Protected access tokens are immediately invalidated through their backing session.

### Module boundaries and dependency direction

The largest production modules are concentrated in points/gamification, sessions, authentication, users and feed.

The session/feed/points interaction is intentionally directional:

- sessions owns canonical workout/session state;
- feed owns publication/projection of eligible sessions;
- points owns derived gamification state;
- session writes mark gamification projection stale inside the session transaction;
- feed publication reconciliation and gamification scheduling occur after commit;
- points reconciliation re-reads canonical session state and rebuilds derived projection transactionally.

No service-level `sessions ↔ feed ↔ points` import cycle was found in the reviewed current implementation.

### Transaction and post-commit boundaries

Security-critical auth transitions are atomic under ADR-036. Session-domain primary writes remain transactional; non-authoritative feed/gamification projections are reconciled after commit. This keeps canonical state authoritative while allowing derived state to heal.

## Documentation corrections in this review

- module README points to `auth/auth.middleware.ts`, not deleted `users/users.middleware.ts`;
- TDD describes HttpOnly cookie authentication as the browser default and Bearer as the deliberate API/client path;
- coding guide no longer teaches a feature-local Bearer-only authentication implementation;
- stale `requireAuth` method inventory entry is removed;
- ADR-024 status is corrected to Superseded;
- ADR index now includes ADR-035 and ADR-036.

## Bounded remaining debt

The following open work is deliberate and outside Phase 21:

- **#269 Phase 22 — CI quality gate and deployment-contract enforcement:** mandatory release/deployment enforcement.
- **#270 Production Compose and ClamAV deployment-contract cleanup:** canonical production Compose and AV startup/health semantics.
- **#279 Durable production job-queue contract:** production durability, Redis/BullMQ fail-safe selection and restart recovery.

These items are production-readiness/deployment concerns and are tracked explicitly rather than hidden as Phase 21 architecture debt.

## Phase 21 conclusion

With #276–#278 complete and the conformance corrections in this review merged, no additional high-severity correctness/privacy/security architecture contradiction identified by the Phase 21 review remains undocumented. Remaining production-readiness debt is bounded by #269, #270 and #279.
