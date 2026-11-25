# ADR-039: Email-first registration to prevent account enumeration

**Date:** 2026-11-25
**Status:** Accepted
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** Issue #653 (registration reveals account existence), #553 finding 2 (concurrent registration), PR #659 (first attempt, superseded), ADR-002 (enumeration resistance, email deny-list), ADR-030 (account security controls), ADR-036 (atomic auth state transitions), ADR-037 (durable job queue), AC-1.8 (verification resend limit), AC-1.12 (timing consistency)

---

## Context

`POST /api/v1/auth/register` took the whole sign-up form in one request: email, username, password, profile and avatar. It answered `409 AUTH_CONFLICT` when the email already had an account and `202 "If the email is valid…"` otherwise. Anyone could therefore check whether a given address uses FitVibe. For a fitness app that is personal information in itself, and it also hands attackers a verified target list for phishing and credential stuffing (#653).

The first fix (PR #659) kept the single form and made the email conflict silent: same `202`, password hashed on every path, a notice emailed to the owner, and unique-violation races mapped to the same answers. Review left three gaps, all caused by creating the account **before** the address was proven:

1. **Pending accounts leak through the resend cap.** A second sign-up for an unverified account re-sent its verification email. After the AC-1.8 cap (3 per hour) it answered `429`, which a brand-new address never gets.
2. **Usernames tie back to addresses.** "Username taken" had to be checked before the email, independently of it. Otherwise "this address with that username" would reveal which address owns a pending username. As a result, a person re-registering with their own pending username was told it was taken.
3. **Responses differed outside production.** The response carried a `debugVerificationToken` for new accounts only, so development and test responses still differed by account state.

Current practice was reviewed before choosing a replacement:

- **OWASP ASVS 5.0, V6.3.8 (Level 3):** login, registration and password reset must not reveal whether an account exists, through messages, status codes or timing. For registration this means answering the same way whether or not the email exists, and sending the real outcome by email: a welcome link to a new user, or a "you already have an account" note to the existing one.
- **Clerk (strict enumeration protection):** sign-up with an existing address sends no code. The owner is told by email that someone tried to sign up. In the combined sign-in/sign-up flow, the backend reveals whether an account exists only after the identifier is verified.
- **Ory Kratos:** account-enumeration mitigation is built on identifier-first login and two-step registration.
- **Auth0:** where enumeration matters, recommends an invite-style flow: the user submits an email and receives a link to sign up.
- **Flask-Security (`SECURITY_RETURN_GENERIC_RESPONSES`):** keeps one form, always returns 200 and emails the outcome, including "pick a different username". This is secure but poor UX.
- **Supabase:** returns a fake success and sends nothing. This is widely reported as confusing, because the person never learns why no email arrived.

---

## Decision

Self-service registration verifies the address **before** any account exists. It takes two steps.

### Step 1: `POST /auth/register` with `{ email, locale? }`

- Validates only the address format and an optional UI language, then **queues** an `auth.registration.dispatch` job and returns `202 { message }`.
- The message is identical for every address. The request path reads **no** account, deny-list or throttle data, so neither its body, status nor timing can depend on account state. The usual timing floor still applies.
- Per-IP rate limiting (`auth_register`) still applies. Its `429` depends only on the caller, never on the address.

### Background job: `dispatchRegistrationRequest`

Every request is recorded in `registration_intents`, keyed by the SHA-256 of the normalized address. A per-address throttle allows **3 requests per hour for every address alike**; over the limit, the job does nothing. Throttling is silent because no caller waits on the job. Within the limit:

| Address state                                                | Email sent                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| No account                                                   | "Finish creating your FitVibe account" with a one-time link to `/register/complete?token=…`                      |
| Active account                                               | "Someone tried to register with your address", with sign-in and password-reset links (in the account's language) |
| `pending_verification` (only administrator-created accounts) | The existing verification link. The AC-1.8 per-account cap still applies, silently.                              |
| Suspended, banned or pending deletion                        | Nothing                                                                                                          |
| On the email deny-list (ADR-002)                             | Nothing                                                                                                          |

Each new link retires earlier unused links for the same address, so only the newest works. The link lives for `auth.email_verification_ttl_minutes` (15 minutes by default). Only the SHA-256 of the token is stored. The address itself is stored only on rows that carry a link.

Queue jobs that carry personal data are flagged `sensitive`. BullMQ removes them as soon as they complete, and the in-memory queue never logs their payload.

### Step 2: `POST /auth/register/intent` and `POST /auth/register/complete`

- `intent` with `{ token }` returns `{ email, expiresAt }` so the completion page can show the address. Unknown or used links return `400 AUTH_INVALID_TOKEN`; expired links return `410 AUTH_TOKEN_EXPIRED`.
- `complete` takes `{ token, username, password, profile?, terms_accepted }`, optionally as multipart with an avatar. The caller has now **proved ownership of the mailbox**, so explicit errors are safe: `409 USER_USERNAME_TAKEN` (the link stays usable), `409 AUTH_EMAIL_ALREADY_REGISTERED`, password-policy and reference-value errors.
- In one transaction (ADR-036), the link row is locked `FOR UPDATE`, the account is created **active with a verified email**, the terms version is accepted, and the link is consumed. Of several concurrent submissions of one link, exactly one creates the account; the others receive `400`. Unique-violation races map to the explicit `409`s above, never a `500`.

### Consequences for existing flows

- Self-service sign-up no longer creates `pending_verification` accounts. `/verify` and `/verify/resend` remain for administrator-created accounts, and AC-1.8 continues to cover them.
- No response carries a token or link in any environment. `debugVerificationToken` and `verificationUrl` are removed from registration, and `debugResetToken` and `resetUrl` from forgot-password.
- **Forgot-password uses the same pattern.** `POST /auth/password/forgot` only queues an `auth.password-reset.dispatch` job and returns the same `202` for every address. The job checks the deny-list and account status, issues the reset token and emails the link to active accounts only. Before, the reset email was sent inside the request for existing accounts only, so with SMTP enabled the response time revealed which addresses had accounts.
- Development and browser tests read email from an in-memory **test mailbox** at `GET/DELETE /api/v1/dev/mail?to=`. It is **on by default when `NODE_ENV=development` and `EMAIL_ENABLED` is off**: there the links are otherwise unreachable, and before this change the same links were returned in API responses, so the default is no wider than what it replaces. It is off by default everywhere else. `EMAIL_CAPTURE_ENABLED` overrides the default either way. The route is mounted only when capture is enabled, and `env.ts` refuses to start with capture enabled when `NODE_ENV=production`.
- The retention sweep deletes expired `registration_intents` rows.

---

## Consequences

**Positive**

- Registration answers identically, in body, status and timing, for every address in every environment. This meets ASVS 5.0 V6.3.8 (Level 3).
- All three gaps left by the one-form approach are closed by design rather than by special cases.
- Typos and abandoned sign-ups no longer create accounts that hold an address or a username, and nobody can squat someone else's address with an unverified account.
- Usernames are chosen by a proven mailbox owner, so "username taken" can be shown plainly.
- Account creation is atomic: there are no partial rows and no `500` on races.

**Negative / trade-offs**

- Sign-up has two screens with a mailbox round-trip in between. People who mistype their address, or forget they already registered, get feedback only by email.
- Links expire (15 minutes by default). A person who comes back later has to request a new one.
- Blocked, suspended and banned addresses receive nothing, which is indistinguishable from a lost email.
- Every registration request costs an email, bounded by the per-address and per-IP limits.
- The completion step can still reveal "username taken" to whoever holds a valid link. This is intended: usernames are public, and the holder owns the mailbox.

**Operational**

- Production already requires Redis/BullMQ (ADR-037). Registration emails now depend on the worker being healthy.
- No new setting is needed for local development or the CI browser and accessibility jobs (`NODE_ENV=development`, `EMAIL_ENABLED=false`). A development-mode deployment that is reachable by others and has no SMTP exposes the mailbox, just as it exposed the debug tokens before; such deployments should set `EMAIL_CAPTURE_ENABLED=false` or enable SMTP. Production refuses capture at startup.
- Clients that called the old single-step `POST /auth/register` must move to the two-step API. The only client is the FitVibe frontend, updated in the same change.

---

## Alternatives Considered

| Option                                                                        | Description                                                                              | Reason Rejected                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| One form, silent conflicts (PR #659)                                          | Same `202` for existing emails, notice email, hash on every path, username checked first | Left the pending-account `429`, the username/email link and dev-only response differences; each fix required another special case |
| Fake success, no email (Supabase style)                                       | Return success for an existing email and do nothing                                      | Owners never learn why no email arrived; the outcome is reported as confusing                                                     |
| One form, outcome by email including username problems (Flask-Security style) | Always `200`; email "address already registered" or "choose another username"            | Secure, but makes people go to their inbox to learn that a username is taken                                                      |
| Rate limiting and bot protection only (Clerk "bulk" level)                    | Keep explicit errors but throttle bulk checks                                            | Still answers targeted "does this person use FitVibe?" checks                                                                     |
| Keep `409 AUTH_CONFLICT`                                                      | Status quo                                                                               | The vulnerability in #653                                                                                                         |

---

## References

- OWASP ASVS 5.0, requirement V6.3.8, as summarized at <https://safeguard.sh/resources/blog/asvs-5-v6-3-8-no-user-enumeration>
- OWASP Web Security Testing Guide, WSTG-IDNT-04, Testing for Account Enumeration and Guessable User Account
- Clerk, user enumeration protection: <https://clerk.com/docs/guides/protect/user-enumeration-protection>
- Clerk, sign-in-or-up custom flow: <https://clerk.com/docs/guides/development/custom-flows/authentication/sign-in-or-up>
- Ory, identifier-first authentication and account enumeration mitigation: <https://www.ory.sh/docs/identities/sign-in/identifier-first-authentication>
- Auth0 community, preventing user enumeration on sign up: <https://community.auth0.com/t/preventing-user-enumeration-on-sign-up/61106>
- Flask-Security, generic responses: <https://flask-security-too.readthedocs.io/en/stable/patterns.html>
- Supabase discussion #38242, duplicate email handling: <https://github.com/orgs/supabase/discussions/38242>
- Implementation: `apps/backend/src/modules/auth/auth.registration.service.ts`, `auth.registration-intent.repository.ts`, migration `202611250001_create_registration_intents.ts`, `apps/frontend/src/pages/Register.tsx`, `CompleteRegistration.tsx`
- Tests: `tests/backend/integration/email-first-registration.integration.test.ts`, `tests/backend/modules/auth/auth.registration.email-first.test.ts`, `tests/backend/services/mail-capture.test.ts`

---

## Status Log

| Version | Date       | Change                                                                                                       | Author                             |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| v1.0    | 2026-11-25 | Initial decision; supersedes PR #659 approach                                                                | FitVibe team (drafted with Claude) |
| v1.1    | 2026-11-25 | Forgot-password queued and debug reset token removed; test mailbox on by default in development without SMTP | FitVibe team (drafted with Claude) |
