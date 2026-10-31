# Issue #557 — final acceptance and owner actions

**Current scope:** Fix branch `fix/557-deterministic-onboarding-fixtures`, draft PR #588.
**Purpose:** Separate engineering implementation from real-environment and security-owner decisions. A green CI on the fix branch does not accept deployment, close DRIFT-093, or validate merged `feature`.

## 1. Stage B — owner actions

### A. Measure password hashing on **actual** production-like hardware

Run on the Raspberry Pi arm64 and, separately, a proposed amd64 deployment host. The benchmark uses only synthetic secrets and Node native Argon2id. It needs Node >=24.7 and does **not** need live credentials or a database.

```bash
git rev-parse HEAD
uname -m
node --version
node apps/backend/scripts/benchmark-password-hashing.mjs | tee argon2id-benchmark-$(uname -m).json
```

If Node >=24.7 is not installed but Docker is available, from an up-to-date repository checkout:

```bash
docker run --rm -v "$PWD:/work:ro" -w /work node:24 \
  node apps/backend/scripts/benchmark-password-hashing.mjs \
  | tee argon2id-benchmark-$(uname -m).json
```

Attach the **JSON only**, without any environment variables, credentials, full logs or database backups. Record host RAM, CPU, current load and container memory limits. The script samples RSS and may underestimate the real peak; collect container/cgroup memory evidence under concurrent hashing separately.

### B. Decide how to transition legacy and newly promoted administrators

Existing bcrypt and Argon2id hashes **do not reveal password length**. The owner must approve a rule and a deadline to replace historically short administrator credentials. Options:

- Require a new >=16-character secret at the next fully MFA-authenticated administrator login before privileged use, with a limited password-change/enrollment path.
- Run a scheduled, notified transition period with explicit expiry, secure recovery and forced password-change after the grace period.

Do not guess historic length, convert passwords offline, remove MFA or block the only account capable of secure enrollment. Document tests of bootstrap, promotion, MFA, failed transition and recovery.

### C. Perform isolated backup, migration and rollback drills

Before live rollout: take a consistent, access-controlled PostgreSQL backup of users, password history, authentication state and migrations. Restore **only to a disposable isolated environment** and validate (1) bcrypt sign-in then Argon2id upgrade, (2) Argon2id sign-in, (3) reset/history/atomic token consumption, (4) compatibility with an actual rollback **to a dual-verifier release**. Older bcrypt-only code is **not** a safe downgrade once Argon2id secrets have been issued.

Keep dump files, secrets and identifiable database rows private; record only pass/fail, recovery time and versions in the issue.

### D. Verify user feedback

In EN and DE at minimum, exercise registration, reset, authenticated password change and administrator-created user flows with deterministic breach-provider fixtures. Verify that advisory warnings are visibly presented **after** a successful change; no local/common-password blocklist bypass. Audit the consuming frontend route, not just API typing.

### E. Inventory service accounts

List non-person accounts and integrations; choose preferred OAuth/key authentication, or require a >=24-character managed secret if a password is unavoidable. Record secret owner, rotation and least-privilege disposition.

## 2. Stage C — privileged actions and actual transport

The role-change path already uses superadmin sudo plus a fresh TOTP. **The following other mutations still need an approved sensitivity and UX contract** before uniformly imposing a new step-up, or operators may become unable to use the admin console.

| Route / operation | Existing boundary | Security-owner disposition needed |
|---|---|---|
| `POST /admin/reports/:reportId/moderate` | Admin role, MFA session | Choose step-up for hide/ban vs dismiss; implement and test if required |
| `POST /admin/action-mappings` | Admin role, MFA session | Approve fresh reauth or lower-risk mapping-only exception |
| `POST /admin/users/:userId/action` and suspend/ban/activate/delete aliases | Admin role, MFA session | Require approved step-up for suspension/ban/deletion, with recoverable UI |
| `POST /users/` (admin create) and `PATCH /users/:id/status` | Admin role, MFA session | Confirm elevated identity-change and privilege semantics; implement step-up if required |
| `POST /admin/superadmin/privileges/admins/:userId/role` | Superadmin sudo plus fresh TOTP | Keep existing protected flow, test session/role races |
| Visibility and privacy overrides, if any | Inventory pending | Decide if these are admin-sensitive and need step-up |

Do **not** add a blanket middleware that all admins cannot satisfy. Design an authenticated five-minute step-up grant and accessible frontend challenge (or reuse an existing proven mechanism) with a robust audit and denial path; add negative real-API tests for bypass, stale grants, role promotion and replay.

Deployment owner must collect redacted evidence for TLS 1.3 termination, trusted-proxy configuration, cookie Secure/HttpOnly/SameSite behavior over HTTPS, CSRF on writes, authentication log/trace redaction, real public ingress topology, and feasibility of admin IP allowlisting/mTLS/device signals. Do not expose ports publicly merely to run these checks.

## 3. Stage D — observability and governance

The fix branch now emits bounded, no-identity Prometheus authentication counters for failed/blocked logins, completed logins, reset requests/completions/invalid tokens, and MFA events. Initial alert work adds a thirty-day rate baseline and the reset-token failure ratio.

**Not yet accepted:**

- Run `promtool check rules infra/prometheus/alerts.yml` and exercise alerts against real counter samples. Verify the Prometheus scrape and secured /metrics access. Store **at least 30 days** of series history; otherwise the statistical alert intentionally remains inactive during warm-up. Consider volume, disk capacity and actual retention configuration.
- Configure actual Alertmanager delivery, secure contact ownership and an alert test. The checked-in `infra/prometheus/prometheus.yml` currently has alertmanager configuration commented out.
- Choose the policy's integer **N** for **per-account** lockouts over ten minutes. Implement threshold detection using a secure, access-controlled backend aggregation keyed by account; export **only aggregate incident counts** to Prometheus. Do **not** put account ID, hashed email, IP, password, token or raw identifying labels on time series.
- Decide the geo/ASN anomaly source and privacy/compliance constraints, then implement and verify those signals if applicable.
- Record quarterly privileged-access attestation owner and evidence, security/tabletop cadence, and automatic expiry for `EX-YYYY-####` exceptions within 90 days.
- Reconcile PASSWORD_AND_AUTHENTICATION_POLICY v1.1, SECURITY and Key Management documents, DRIFT-093 and the original 50-clause acceptance matrix with current evidence. The matrix's 2026-10-26 findings are historical and should not be copied into a final status without reclassification.

## 4. Final integration gate

1. Review draft PR #588 and the one outstanding `feature` commit that the fix branch is missing. Forward-merge without losing meaningful changes.
2. Verify required Quality, Backend unit/integration, Database, Frontend, security, accessibility, VRT and **all four** Playwright shards on the **merged feature SHA**.
3. Complete the policy matrix with per-clause source, passing tests and operational evidence, plus approved `conditional / not applicable` rationales.
4. Only after that, close DRIFT-093 and #557. Neither an untested document nor fix-branch-only green CI is closure evidence.

**Security note:** Never upload production database dumps, account passwords, TOTP recovery codes, SMTP credentials, Tailscale auth keys, or private environment files into GitHub issues or CI artifacts.
