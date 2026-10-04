# ADR-030: Authoritative Account-Security Controls

**Date:** 2026-09-24  
**Status:** Accepted  
**Author:** FitVibe Development Team  
**Cross-References:** ADR-002, ADR-026, BACKEND_TECH_DEBT_REDUCTION_PASS_2.md, PR #240

---

## Context

Phase 15 found three security controls whose implementation did not match their intended security posture:

1. the email blacklist could fail open when its backing state could not be read;
2. TOTP secrets were stored as plaintext application data;
3. sensitive 2FA administration could be performed using an authenticated session without a fresh second-factor check.

The goal was to remove the appearance of security and make each control enforceable end to end.

## Decision

### 1. Email blacklist is authoritative and fail-closed

The blacklist remains a supported security feature.

- Account-establishment and access-restoration flows that depend on an email address must consult the authoritative blacklist state.
- A database or schema failure while reading blacklist state must not be interpreted as "not blacklisted".
- Blacklisted recovery requests remain externally opaque where enumeration resistance requires it.
- The blacklist is not a replacement for existing account-status controls on already-established sessions.

The canonical lookup lives behind the shared email-blacklist repository so security semantics are not duplicated across callers.

### 2. TOTP secrets are encrypted at the application boundary

TOTP verification requires the original secret, so one-way hashing is not possible. TOTP secrets are therefore encrypted before persistence and decrypted only inside the authentication boundary.

- Algorithm: AES-256-GCM.
- Envelope version: `enc:v1`.
- Key material comes from `TOTP_ENCRYPTION_KEY` and is not stored with ciphertext.
- The application refuses to use plaintext TOTP secrets after migration.
- Existing plaintext values are migrated transactionally to encrypted envelopes.
- Migration rollback never converts encrypted secrets back to plaintext. Reapplying the migration is idempotent because encrypted envelopes are skipped.

This complements infrastructure/database encryption in ADR-026; it protects this high-value secret even from a database-only disclosure.

### 3. Sensitive 2FA administration requires step-up authentication

A valid authenticated session alone is insufficient to weaken or replace the user's second factor.

The following operations require password confirmation plus a current second factor when 2FA is active:

- regenerate backup codes;
- disable 2FA;
- replace or restart an existing 2FA setup.

Read-only 2FA status does not require step-up.

Initial enrollment remains possible when no active second factor exists. Restarting an existing setup is exposed as a state-changing operation and validates the existing factor before replacement.

## Consequences

### Positive

- Blacklist failure cannot silently weaken account-access controls.
- Database-only compromise does not directly reveal TOTP seeds.
- Session theft alone cannot regenerate recovery material or disable/replace 2FA.
- Security rules are centralized and testable at externally observable boundaries.

### Trade-offs

- TOTP operations now depend on correct deployment of `TOTP_ENCRYPTION_KEY`.
- Key loss makes encrypted TOTP material unrecoverable and requires 2FA recovery/reset procedures.
- Sensitive 2FA administration requires additional user interaction.
- Blacklist backing-store failures deliberately block affected security-sensitive flows.

## Alternatives Considered

| Option | Description | Reason Rejected |
| --- | --- | --- |
| Remove email blacklist | Delete the feature rather than enforce it | The product owner explicitly retained it as a real security control |
| Fail-open blacklist | Treat read failures as allowed | Creates silent security degradation |
| Store TOTP plaintext | Rely only on database/volume access controls | Database disclosure would reveal reusable second-factor seeds |
| Hash TOTP secrets | Store only a one-way digest | TOTP verification requires the original secret |
| Session-only 2FA administration | Allow sensitive changes from any authenticated session | A stolen session could disable or replace the second factor |
| Generic recent-auth token system | Introduce a separate step-up session/state subsystem | Unnecessary complexity for current requirements; action-local step-up is sufficient |

## Implementation and Verification

Implemented in PR #240 and merged into `dev` as `2b3844bbfe35b6c2d9fe283fc350e24e2c5a62b5`.

Final feature head: `b63cdfa6e82fd4b15ef141d8a58b73e22f747cf5`.

Verification:

- CI run 1034: passed;
- CodeQL run 802: passed;
- backend, frontend, database, contract, security, accessibility, Lighthouse, visual, E2E and performance gates passed on the final implementation head.

## Status Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| v1.0 | 2026-09-24 | Phase 15 authoritative blacklist, encrypted TOTP storage and 2FA step-up policy | FitVibe Development Team |
