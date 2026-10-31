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

### ARM64 benchmark evidence — 2026-10-31

**Status: Raspberry Pi 4 ARM64 single-host benchmark recorded; not yet full Stage B hardware/capacity acceptance.**

- Device: Raspberry Pi 4, Cortex-A72, Linux `arm64`, 7.64 GiB RAM.
- Runtime: Docker Node.js `v24.22.2`; benchmark parameters Argon2id `memoryKiB=65536`, `passes=3`, `parallelism=1`, `tagLength=32`.
- Five sequential synthetic-hash measurements (ms): `521, 533, 542, 535, 522`. Reported p50 `533 ms`, observed maximum / sample p95 `542 ms`. **Five samples are insufficient for a robust tail-latency estimate.**
- Two concurrent hashes: reported individual durations `662 ms` and `649 ms`, wall time `673 ms`; observed process peak RSS sample `176 MiB` (not a guaranteed absolute peak).
- Runtime source provenance: Pi's existing FitVibe checkout remains `8844615cc2c27f6cc3bedfa9a07912026c5d3043` (Node 22); the benchmark was run with a separately fetched script in a Node 24 container, so **do not confuse the Pi's deployed checkout SHA with the benchmark script source revision**. The precise fetched script commit was not captured in the benchmark JSON.
- Assessment: current baseline is usable for current-scale authentication on this hardware; **do not reduce Argon2id settings** based on this run. No sustained login/registration throughput, full FitVibe-container memory footprint, or multi-process / high-concurrency stress capacity has been measured.

### AMD64 benchmark evidence — 2026-10-31

**Status: AMD64 Docker-based synthetic benchmark recorded; both ARM64 and AMD64 hardware checks collected, but not a production load test.**

- Platform: Linux `x64` runtime on an Intel Core i7-10510U (1.80 GHz) Windows desktop using Docker; reported runtime memory 7.66 GiB (container/VM-reported capacity, **not independently confirmed host physical memory**).
- Runtime: Node.js `v24.22.2` and the same Argon2id parameters `memoryKiB=65536`, `passes=3`, `parallelism=1`, `tagLength=32`.
- Five sequential synthetic-hash measurements (ms): `411, 284, 321, 320, 333`; median `321 ms`, observed maximum / sample p95 `411 ms`. The first measurement is slower than the others; no cause is established by this small sample.
- Two concurrent hashes: `419 ms` and `412 ms`; wall time `421 ms`. Observed peak process RSS sample `179 MiB` (not a guaranteed absolute peak).
- Versus Raspberry Pi ARM64: sequential median 533 ms vs 321 ms (~1.66x speedup, ~40% reduction), concurrent pair wall time 673 ms vs 421 ms (~1.60x speedup). The relative numbers are indicative, not production SLA measurements.
- Benchmarks ran with synthetic passwords and require no user or database secrets. The exact benchmark script revision was not embedded in either JSON; preserve source provenance in future runs.
- **Conclusion:** keep Argon2id at 64 MiB / 3 passes / parallelism 1 for both environments. Real application login-load testing, container/cgroup peak-memory observation, operational rate limits, isolated database restore, rollback and legacy administrator credential-transition decisions remain outstanding.

### Follow-up evidence

Collect container/cgroup memory and latency under realistic co-resident FitVibe load; verify `promtool` rule syntax and auth monitoring operationally; document the hash benchmark script SHA for reproducibility. Do not classify a 5-sample hash benchmark as comprehensive load testing.

### B. Legacy administrator transition — implementation candidate (2026-10-31)

**Decision:** After genuinely verified MFA, require an administrator password set under the current >=16-character policy before privileged access; **no grace period**.

**Implementation on the fix branch, pending exact-HEAD CI acceptance:**

- Migration `202610310002_admin_password_policy_attestation.ts` adds `users.admin_password_policy_verified_at`, **nullable with no grandfathered default**. Existing administrator bcrypt or Argon2id hashes do not demonstrate original password length, so legacy administrators start without attestation. This marker is **not** inferred from hash format or successful sign-in / opportunistic bcrypt migration.
- The verified-MFA administrator guard checks current persisted role, active session, MFA state and the persisted attestation before any protected action. An unenforced legacy administrator can only use `GET /auth/admin-password/status`, `POST /users/change-password` and logout. Without MFA, the existing limited TOTP enrollment remains the only permitted path.
- Authenticated password change and recovery reset validate >=16 against the actual current role under the locked user row, preserve last-five history, write the new Argon2id hash and attestation together, and revoke all previous sessions atomically. A failed password check, weak password or reuse rejection must not attest or revoke sessions.
- New admin credentials written through the protected user-creation service, production bootstrap seed and standalone CLI bootstrap receive attestation from the validated 16+ character write. Rerunning the seed does **not** stamp pre-existing administrator credentials or silently reset them.
- The frontend redirects MFA-verified legacy administrators to an isolated `/admin/password-update` form, uses existing global form/password/strength components, and provides EN/DE/EL/FR/ES guidance and advisory feedback. After change, sign out and authenticate again with MFA.
- Real-Express/PostgreSQL integration regressions in `admin-mfa-bootstrap.integration.test.ts` verify bootstrap enrollment, MFA requirement before password update, 403 for other API actions, wrong-current/short-password refusal, committed update, session revocation, fresh MFA and compliant status; separate recovery reset verifies an invalid candidate preserves token/attestation, successful recovery, and MFA enrollment remains mandatory. Pre-existing tests/assertions were retained.
- **Current status:** source changes committed but not independently accepted until CI (Quality, backend, DB migrations, integration, frontend, axe, VRT, all four shards) succeeds on the exact final SHA.

**Deployment constraints:** Apply the schema migration and verified dual-format Argon2id-capable backend **before** enabling the new guard in live traffic. Take and restore a secure PostgreSQL backup in a disposable environment first. A rollback to code without the attestation guard would permit already-MFA-enrolled legacy administrators to reach privileged routes without the new minimum; use a known compatible release and security-owner rollback plan. Do not force an offline mass password reset, inspect/guess old password length, export credential hashes or bypass MFA.

**Remaining owner acceptance:** Test deployment staging with an existing administrator and a newly promoted user, prove secure password reset and authenticator recovery, and document a tested rollback / restoration drill. The initial credential migration does not retroactively reconstruct five historical passwords.

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
