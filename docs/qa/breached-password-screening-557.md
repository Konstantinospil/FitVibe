# #557 — Breached-password screening decision

**Status:** Standalone backend checker and deterministic unit tests committed (2026-10-26); **not integrated** into registration, reset, or other password-write paths. CI pending.
**Date:** 2026-10-26
**Policy:** `docs/5.Policies/5.a.Ops/PASSWORD_AND_AUTHENTICATION_POLICY.md` §§2.1, 3 and 10.

## Architecture

The user selected the Have I Been Pwned (HIBP) Pwned Passwords range API, checked from the FitVibe backend, with a versioned local common-password blocklist.

Use server-side k-anonymity: SHA-1 of the UTF-8 candidate is used only for the range query; send its **first five hexadecimal characters**, never the original candidate or complete digest. Compare the returned suffixes locally. Require the provider's padded response setting and a meaningful user-agent header. The API requires no key. Store credentials separately using the planned Argon2id migration, never SHA-1.

Run screening when **creating or replacing** a password, not on login, MFA verification, refresh or ordinary application requests. Validate the local common-password list first. Compare the **whole** submitted password; avoid rejecting long passphrases merely for containing a common word. Keep a reviewed, versioned list, provenance, checksum, and update ownership.

## Failure and outage decision

**Fail closed for new or replaced passwords.** If the provider cannot be checked reliably, return retryable HTTP 503 `BREACH_CHECK_UNAVAILABLE`. Never silently accept a local-only negative check as sufficient.

- A verified, unexpired cached hash-prefix range may be used, initially for up to **6 hours**, with an in-memory capacity of **128 prefixes**. Do not renew an entry's expiry during an outage.
- Reject known common/breached passwords even during an outage.
- Existing login, MFA, session refresh and logout must continue without the external provider.
- On unavailability, **do not** write account credentials, change existing sessions, consume a valid reset token, or send account-verification mail. Normal reset-token expiry remains in force.
- Use a bounded request timeout (initial target **2.5 seconds**) and a small circuit breaker (initial target **30 seconds**). Never allow unexpected HTTP responses or malformed/padded data to be misread as a clean result.
- Return a localized, accessible retry message. Log aggregate outcomes and latency only: never candidate secrets, full hashes, hash prefixes/suffixes, user IDs or email addresses.
- No automatic production fail-open option. An exceptional operational departure requires the accepted security exception process.

## Implementation integration

Standalone component implemented in `apps/backend/src/modules/auth/breached-password.service.ts` with `common-passwords.blocklist.ts`; tests in `tests/backend/modules/auth/breached-password.service.test.ts` are owned by the existing `backend-jest` suite and explicitly cite #557. **CI verification is pending.** Keep existing synchronous password-length/context validation, and introduce a **separate asynchronous** orchestration method. Call this on eligible *new* registration before persistence, and on a valid password reset **before** atomic password/token/session mutation. Inventory other password-write paths, including administrator operations.

The frontend should preserve the form state on HTTP 503 and use localized error messages for a common password, a breached password, and temporary screening unavailability.

Do not introduce online HIBP calls into CI. Mock provider replies, outages, 429, 5xx, malformed responses, redirects, padding, cache freshness and concurrent requests. Test that registration/reset failures leave all authentication state unchanged, and that a retry succeeds after recovery. All new tests must have explicit test ownership under `tests/qa/test-ownership.json`.

Source documentation: https://haveibeenpwned.com/API/v3 and https://haveibeenpwned.com/scalar/. NIST blocklist guidance: https://pages.nist.gov/800-63-4/sp800-63b.html.

**Release gate:** no policy-compliance claim until the code, tests, integration, localization, monitoring and CI checks are complete. Keep issue #557 open.
