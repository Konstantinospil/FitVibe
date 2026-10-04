# ADR-036: Atomic authentication state transitions

- **Status:** Accepted
- **Date:** 2026-09-26
- **Scope:** Phase 21 / DD-03 and DD-06

## Decision

Security-sensitive authentication state changes are persisted atomically.

- Initial login and completed 2FA create the auth session and initial refresh token in one transaction.
- Refresh rotation locks the current refresh token, revokes it, inserts its replacement, and updates the backing session in one transaction.
- Password reset locks the one-time reset token and atomically updates the password, consumes outstanding reset tokens, and revokes all refresh/session state.
- Password change atomically updates the password and revokes all refresh/session state.
- Non-active account status changes atomically revoke all refresh/session state together with the status transition.

## Access-token invalidation

Access JWTs remain cryptographically stateless, but authorization is session-backed. Every protected request validates the JWT and then verifies that its `sid` refers to an unrevoked, unexpired `auth_sessions` row owned by `sub`.

Therefore logout, password reset/change, explicit session revocation, and non-active status transitions invalidate already-issued access JWTs immediately without a token blacklist or per-route revocation logic.

## Refresh replay and concurrency

Refresh rotation uses a row lock on the current refresh-token row. Exactly one concurrent request can claim and rotate an active token. A replay or losing concurrent request revokes the entire session family and is audited as refresh reuse.

## Consequences

- No supported password/session/token transition can commit a half-completed security state.
- Session-backed access validation adds one indexed database lookup per protected request.
- Audit metadata can truthfully state when refresh-family and access-token invalidation occurred.
