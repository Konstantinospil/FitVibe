# #557 — Password & Authentication Policy v1.0 compliance audit

**As-of:** 2026-10-26  
**Source:** [accepted Password & Authentication Policy](../5.Policies/5.a.Ops/PASSWORD_AND_AUTHENTICATION_POLICY.md), §§1–12  
**Branch audited:** `fix/557-deterministic-onboarding-fixtures` at `345b0c328f8e0ea840fd17cab87d943ea836d3e3`  
**Status:** evidence-backed source review, **not** a completed operational/security certification.

## Assessment conventions

- **Implemented:** source evidence establishes the core behavior; tests or operational proof may still need strengthening.
- **Partial:** portions exist but one or more policy requirements have not been demonstrated.
- **Gap:** direct contradiction in reviewed source or clear missing mandatory control.
- **Verify:** source review alone cannot establish deployment/operational compliance.
- **Conditional:** "prefer", "where feasible", or optional policy provisions need an applicability decision, not an invented implementation.

Passing CI only establishes success of current assertions. Do **not** close #557, DRIFT-093, or merge solely because existing checks are green.

## Requirement-by-requirement traceability

| Policy | Requirement | Assessment | Evidence / necessary verification |
|---|---|---|---|
| §1 | Scope includes users, admins, service/integration accounts across environments | **Verify** | Inventory service accounts, deployments and exceptions; backend tests alone do not certify them |
| §2.1 | Member password >=12 | **Implemented** | `auth.schemas.ts` min 12; `passwordPolicy.ts` runtime floor 12; `app-settings.registry.ts` floor >=12 |
| §2.1 | No mandatory composition categories | **Gap** | `auth.schemas.ts`, `passwordPolicy.ts`, `Register.tsx` require upper/lower/digit/symbol; `ResetPassword.tsx` displays same requirements |
| §2.1 | No periodic forced rotation; change on compromise/breach/exception | **Verify** | No scheduled rotation found in reviewed auth flows; assess account-management and operational triggers |
| §2.1 | Disallow last five passwords | **Gap / no proof** | `resetPasswordAtomic` writes one `users.password_hash`; no five-entry history check in reviewed password flow. Validate other change paths before implementation |
| §2.1 | Reject breached and common passwords | **Gap / no proof** | Password validators only implement complexity/identifier checks; email blacklist is **not** a password breach check |
| §2.1 | Progressive failed-login backoff, generic errors | **Implemented/Partial** | `auth.login-attempt.service.ts` + `bruteforce.repository.ts` account and IP lockout; opaque login challenge. Verify IP+identifier alias behavior and status-code contract |
| §2.1 | Offer optional TOTP for members | **Implemented** | `two-factor.service.ts`, onboarding component and related E2E/unit tests |
| §2.2 | Admin >=16-character password | **Gap** | Registration/reset shared 12-character minimum; no verified role-based elevated minimum. Account promotion and existing credentials need migration rule |
| §2.2 | Admin mandatory MFA | **Implemented, acceptance tests pending** | `administrator-mfa.guard.ts` persisted role+TOTP+MFA-attested session, `auth.middleware.ts` after JWT+session validation, `two-factor.service.ts` admin disable/dismiss rejected. Test bootstrap/promoted/refresh/recovery |
| §2.2 | Admin shorter access-token lifetime | **Gap** | `auth.session-tokens.ts` signs a single `env.ACCESS_TOKEN_TTL` (default 900 seconds) irrespective of role |
| §2.2 | Reauthentication for sensitive admin actions | **Partial** | `superadmin.service.ts` has sudo reauth + fresh TOTP for privileged role change; inventory other privileged actions, visibility overrides and step-up boundaries |
| §2.2 | Prefer IP allow-listing or mTLS where feasible | **Conditional** | Deployment topology and remote access not assessed; record feasibility and compensating controls |
| §2.3 | Service accounts prefer keys/OAuth, password >=24 if needed, vault and rotation | **Verify** | No authoritative service-account credential inventory was established; align with Key Management Policy |
| §3 | Argon2id >=64MiB, >=3 iterations, >=1 parallelism, unique salts | **Gap** | `auth.registration.service.ts`, `auth.login.service.ts`, `auth.password.service.ts` use bcrypt; existing `PASSWORD_HASHING_MIGRATION_PLAN.md` proposes gradual dual verification |
| §3 | TLS 1.3, no plaintext password logs, trace redaction | **Verify** | `docs/SECURITY.md` specifies TLS 1.3; actual proxy/deployment, request logging, traces and redaction require audit |
| §3 | Password manager support, paste and long passphrases | **Partial/Verify** | Shared `PasswordField.tsx` supports standard input; validators cap at 128 chars (not necessarily a violation), no verified anti-paste logic. Add interaction tests |
| §3 | Strength checks locally and server-side (length + breach check) | **Gap** | Frontend and backend checks exist but rely on character classes; no verified breach check |
| §4 | Password reset token single-use, TTL <=15m | **Partial + confirmed gap** | `auth.tokens.service.ts` hashed token+expiry; `auth.state.repository.ts` transactional consumption. `app-settings.registry.ts` defaults 15m but permits **1440m**; enforce <=15m in all persisted settings and defaults |
| §4 | Bind reset token to user and device/session fingerprint where possible | **Conditional** | Bound to user in `auth_tokens`; device-binding feasibility/risk and legitimate cross-device recovery need assessment |
| §4 | Reset invalidates all user sessions and refresh tokens | **Implemented** | `resetPasswordAtomic` -> `revokeUserAuthStateAtomic` within one transaction, `password-reset-security.test.ts` |
| §4 | Rechallenge admin MFA after reset | **Partial/Verify** | Fresh login for TOTP-enabled account invokes second factor; dedicated admin-after-reset regression still required |
| §4 | Non-enumerating reset email/response | **Implemented/Verify** | `auth.controller.ts` fixed 202 response; `auth.password.service.ts` nonexisting account decoy. Test output, timing and email behavior |
| §5 | RFC6238 TOTP + one-use limited recovery codes | **Implemented** | `two-factor.service.ts` and unit tests include TOTP+backup code consumption; inspect regeneration/recovery audit for admin |
| §5 | SameSite/Secure/HttpOnly cookies and CSRF for mutations | **Implemented/Verify** | `auth.controller.ts` SameSite=Lax, HttpOnly, secure flag; `csrf.ts` double-submit + origin verification; verify HTTPS production config |
| §5 | Per-IP and per-account rate limits | **Implemented/Partial** | Route rate limiter and `bruteforce.repository.ts`; model combines identifier/IP and per-IP data; verify true per-account protection across IPs |
| §5 | Credential-stuffing/anomaly detection | **Partial** | Audit events for IP/login attempt thresholds; operational detection across identifiers/networks requires proof |
| §5 | Optional device binding high-risk actions | **Conditional** | Determine whether and where required; document applicability rather than silently asserting compliance |
| §6 | Metrics: failed-login, backoff/lockouts and anomalous geo/ASN successes | **Partial/Gap** | Auth audit events exist, but `observability/metrics.ts` defines only HTTP counters/histogram and refresh-token reuse; geo/ASN instrumentation not verified |
| §6 | Metrics: password-reset requests/completions, token errors/expiry | **Gap / no proof** | No named Prometheus counters in `observability/metrics.ts`; request counts are not equivalent to outcome metrics |
| §6 | Metrics: MFA enrollment/bypass | **Gap / no proof** | Audit events in MFA service, but no verified dedicated metrics or alerting |
| §6 | 3-sigma failed login spike over **30-day** baseline | **Gap** | `infra/prometheus/alerts.yml` computes a **1-hour** baseline on `auth_failed_login_total`; that metric is not defined in reviewed `metrics.ts` |
| §6 | Lockout alert per account >N in 10m | **Gap / configuration needed** | No demonstrated metric/alert; threshold **N** is unspecified in policy |
| §6 | Password reset failure >5% in 15m | **Gap** | No demonstrated corresponding alert or numerator/denominator metrics |
| §6 | Quarterly security review/tabletop feedback | **Verify (operational)** | Record owner, cadence, review evidence, follow-up tracking |
| §7 | Passphrase-oriented strength indicator (length/entropy, not character classes) | **Gap** | Register/reset UI uses composition checks/list; no demonstrated entropy/passphrase strength meter |
| §7 | Nonidentifying errors | **Partial** | Login/reset use opaque external responses; inspect validation, account-existence, logs and all languages |
| §7 | Screen-reader and high-contrast support; accessible timeout | **Partial** | Axe suite is green; full high-contrast, keyboard and delayed/MFA journeys require targeted validation |
| §7 | EN/DE and culturally neutral guidance | **Partial** | EN/DE and other locale dictionaries present; inspect strength/reset/MFA guidance after changes |
| §8 | Admin MFA and step-up role/visibility changes | **Partial** | `superadmin.service.ts` fresh TOTP role change; inventory visibility overrides and privileged routes |
| §8 | Short admin session TTL and inactivity cutoff | **Gap** | `auth.session-tokens.ts` shared refresh/session expiry; `isSessionActiveForUser` checks revoked/expires, not idle time |
| §8 | Quarterly admin role reviews/least privilege | **Verify (operational)** | Document owner, export/attestation procedure, schedule and records |
| §8 | Audit password reset, MFA enrollment/disable, admin login | **Partial** | `auth.audit.ts` and MFA service record events; confirm all reset/step-up/denied/admin authentication paths with event/PII tests |
| §9 | Documented EX-YYYY-#### exceptions, approval, CVSS context, <=90d expiry, auto-expire | **Gap / Verify** | `infra/security/exceptions/` contains generic `VULN_EXCEPTION_TEMPLATE.md`, not demonstrated policy exception workflow or auto-expiry |
| §10.1 | Argon2id library and breach check | **Gap** | Tied to §§2–3 above |
| §10.1 | Per-account and per-IP exponential backoff + opaque pre-auth responses | **Partial** | Lockout thresholds and opaque response exist; cross-IP account-level semantics and status-code/generic contract must be verified |
| §10.1 | Reset failures on successful login; refresh rotation; correlation ID | **Partial** | Reset attempt state and refresh token rotation implemented; audit request IDs exist; verify 2FA success path and tracing |
| §10.2 | Frontend strength feedback, paste support, long passwords, accessibility | **Partial/Gap** | Tied to §§3 and 7 |
| §11 | SECURITY + Key Management Policy alignment, NIST/OWASP references | **Verify** | Cross-document review required; no claim of external certification |
| §12 | Versioned change log for decisions/implementation | **Implemented as document practice; update required** | Update policy version and change log only when approved behavior is changed |

## Remediation sequence — #557 remains the parent acceptance issue

### Stage A — Protect core security invariants (blockers)

- [ ] Enforce reset TTL ceiling **15 minutes** at governance/schema/runtime boundaries, include persisted out-of-range migration handling and negative tests.
- [ ] Verify deleted/inactive user fail-closed boundaries, privileged role promotion/revocation and fresh MFA after reset using realistic integration/E2E tests.
- [ ] Complete bootstrap administrator MFA and backup-code recovery journeys, retaining a limited enrollment session.

### Stage B — Password policy convergence

- [ ] Implement a shared password-policy authority, length rules and passphrase-oriented UI/server validation; remove composition requirements.
- [ ] Design server-side breached/common-password checks with secure offline or k-anonymity mode, timeouts and availability/error policy.
- [ ] Add last-five password history with transactional concurrency safety, including reset/change and role-promotion checks.
- [ ] Implement dual-format bcrypt/Argon2id verification; use Argon2id for new/replaced passwords and opportunistic migration after successful verification. Retain tested rollback/backward compatibility; benchmark arm64/x86, memory and CI.
- [ ] Apply admin >=16 and conditional service-account >=24 floors, including legacy credentials, bootstrap and promoted users.

### Stage C — Sessions, privileged operations and transport

- [ ] Separate admin/user access token lifetimes; short admin refresh/session lifetime and idle cutoff; test expiry, refresh, downgraded/privileged transitions.
- [ ] Inventory sensitive administrator routes and apply sudo + fresh MFA consistently.
- [ ] Verify TLS1.3, strict cookies, CSRF, production proxy/trust settings, log and trace redaction, password-manager compatibility.
- [ ] Decide and document feasibility of network restrictions, device binding and service-account authentication.

### Stage D — Detection, accessibility and governance

- [ ] Implement and test accurate auth outcome metrics and Prometheus alerts for the **30-day** baseline, lockouts, password-reset failure percentage, and MFA events; choose explicit threshold N.
- [ ] Align registration/reset/strength UI, accessible interaction, translations, error enumeration defenses, and full visual baselines.
- [ ] Document quarterly admin-access review, incident/tabletop review and exception approval/expiry workflow; gather operational evidence.
- [ ] Reconcile DRIFT-093, update accepted policy change log, security docs and test ownership, and run independent full CI.

## Release acceptance

- [ ] Each policy clause above is **implemented with test/operational evidence**, or formally classified conditional/not applicable with an approved rationale.
- [ ] All direct contradictions are eliminated; any exception has explicit documented approval, compensating controls and an expiry <=90 days.
- [ ] Migrations have backup, rollback and legacy-user compatibility evidence; no forced mass password reset.
- [ ] Security-specific negative regression tests, CI gates, VRT, axe, and all four isolated E2E shards pass on final merged `feature` commit.
- [ ] DRIFT-093 closed only after documented security-policy reconciliation; issue #557 closed only after full traceability is verified.

## Decisions to resolve before implementation

1. **Breached-password checker — DECIDED (2026-10-26)**: server-side HIBP k-anonymity range API, versioned local blocklist and fail-closed password changes if no fresh cached provider data. See [`breached-password-screening-557.md`](breached-password-screening-557.md). Implementation pending.
2. **Legacy account migration**: determine whether pre-existing admin passwords under 16 characters must trigger forced change before privileged access. This is security-sensitive.
3. **Operational feasibility**: TLS/proxy constraints, service accounts, privileged network restrictions, device binding and documented exceptions.
4. **Security alert threshold**: define N lockouts per account in 10 minutes. Record who maintains 30-day baseline and evidence of quarterly review.

Review decisions against the accepted policy; do not treat an undocumented exception as compliance.
