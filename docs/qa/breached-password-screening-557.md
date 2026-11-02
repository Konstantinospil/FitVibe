# #557 — Breached-password screening decision

**Status:** Stage B integration in progress (2026-10-31); registration/reset advisory behavior implemented; authenticated change and administrator-created user paths updated on fix branch, pending final CI. Historical 2026-10-26 design below is superseded where explicitly noted.
**Date:** 2026-10-26
**Policy:** `docs/5.Policies/5.a.Ops/PASSWORD_AND_AUTHENTICATION_POLICY.md` §§2.1, 3 and 10.

## Architecture

The user selected the Have I Been Pwned (HIBP) Pwned Passwords range API, checked from the FitVibe backend, with a versioned local common-password blocklist.

Use server-side k-anonymity: SHA-1 of the UTF-8 candidate is used only for the range query; send its **first five hexadecimal characters**, never the original candidate or complete digest. Compare the returned suffixes locally. Require the provider's padded response setting and a meaningful user-agent header. The API requires no key. Store credentials separately using the planned Argon2id migration, never SHA-1.

Run screening when **creating or replacing** a password, not on login, MFA verification, refresh or ordinary application requests. Validate the local common-password list first. Compare the **whole** submitted password; avoid rejecting long passphrases merely for containing a common word. Keep a reviewed, versioned list, provenance, checksum, and update ownership.

## Breach and outage behavior (updated 2026-10-31)

Supersedes the original fail-closed proposal, following the explicit user decision not to reject otherwise valid compromised passwords. **Common-password local blocklist matches still fail closed.** The accepted policy now describes a nonblocking advisory for HIBP matches and provider errors.

- Registration, reset, authenticated change and admin-created account creation must use the **same** k-anonymity checker and local blocklist. Common passwords are rejected with `PASSWORD_COMMON`.
- A confirmed HIBP match returns a localized warning `PASSWORD_BREACHED`; a provider outage, malformed response or timeout returns `BREACH_CHECK_UNAVAILABLE`. Neither advisory blocks an otherwise valid password write. Present the warning *after* successful persistence, never falsely report success before it.
- Continue using the existing 2.5s request timeout, six-hour bounded cache and circuit breaker. Never send or log raw passwords, full digests or user identifiers to the provider.
- Password reset tokens must still be single-use, revocation atomic and history checks serialized; a warning cannot bypass any other validation.
- Authentication, MFA, logout and refresh must remain entirely independent of the breach provider.
- CI uses deterministic transport mocks, not public HIBP calls. The staged rollout requires monitoring, client feedback and redacted diagnostics.

## Implementation integration

Standalone component implemented in `apps/backend/src/modules/auth/breached-password.service.ts` with `common-passwords.blocklist.ts`; tests in `tests/backend/modules/auth/breached-password.service.test.ts` are owned by the existing `backend-jest` suite and explicitly cite #557. **CI verification is pending.** Keep existing synchronous password-length/context validation, and introduce a **separate asynchronous** orchestration method. Call this on eligible *new* registration before persistence, and on a valid password reset **before** atomic password/token/session mutation. Inventory other password-write paths, including administrator operations.

The frontend should preserve form state for a mandatory local blocklist error and present a localized post-success advisory for breached passwords or screening unavailability. Authenticated change API clients must consume the optional warning field.

Do not introduce online HIBP calls into CI. Mock provider replies, outages, 429, 5xx, malformed responses, redirects, padding, cache freshness and concurrent requests. Test that registration/reset failures leave all authentication state unchanged, and that a retry succeeds after recovery. All new tests must have explicit test ownership under `tests/qa/test-ownership.json`.

Source documentation: https://haveibeenpwned.com/API/v3 and https://haveibeenpwned.com/scalar/. NIST blocklist guidance: https://pages.nist.gov/800-63-4/sp800-63b.html.

**Release gate:** no policy-compliance claim until the code, tests, integration, localization, monitoring and CI checks are complete. Keep issue #557 open.
