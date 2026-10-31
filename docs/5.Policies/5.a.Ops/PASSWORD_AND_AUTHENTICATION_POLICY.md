---
title: "Password & Authentication Policy"
version: "v1.1"
status: "Accepted"
owner: "FitVibe Security"
date: "2025-10-18"
license: "MIT"
contact: "kpilpilidis@gmail.com"
related_policies:
  - infra/security/policies/SECURITY.md
  - infra/security/policies/Key_Management_Policy.md
---

# 1. Purpose & Scope

This policy defines password and authentication requirements for **FitVibe** end users, administrators, service accounts, and integrations. It complements **SECURITY.md** and the **Key Management & Rotation Policy**.

**Environments:** production, staging, and developer environments.  
**Applies to:** application accounts, administrative accounts, CI/CD/service accounts (where applicable).

---

# 2. Password Requirements

## 2.1 All Users (Members)

- **Length:** **≥ 12** characters (recommend passphrases **16–64** chars).
- **Composition rules:** _No mandatory_ uppercase/lowercase/number/symbol requirements.
- **Rotation:** _No periodic rotation._ Change only upon **suspected compromise**, **breach notification**, or **policy exception**.
- **Reuse:** Disallow reuse of the last **5** passwords.
- **Blocklists:** Reject passwords on the maintained local whole-password common-password blocklist. For breached-password matches returned by a k-anonymity provider, **warn without rejecting** the otherwise valid password; provider unavailability must also be disclosed without blocking account creation/change. Continue enforcing length, role minimums, identifier restrictions and password history.
- **Rate limiting:** Progressive backoff on failed attempts; show generic failure messages.
- **MFA:** Offer **TOTP**; encourage opt-in.

## 2.2 Administrators (Elevated Access)

- **Length:** **≥ 16** characters (passphrase recommended).
- **MFA:** **Required** (TOTP or hardware-backed where available).
- **Session lifetime:** Shorter access token TTL; enforce re-auth on sensitive actions.
- **Network hardening:** Prefer IP allow-listing / mTLS for admin consoles when feasible.

## 2.3 Service & Integration Accounts

- Prefer **key-based/OAuth** auth over passwords. If a password is unavoidable:
  - Length **≥ 24**; stored only in a secrets manager; rotated on the same cadence as infra secrets per Key Management Policy.

---

# 3. Password Handling & Storage

- **Hashing:** **Argon2id** with parameters tuned via benchmarks. Baseline:
  - _memory_ **≥ 64 MiB**, _iterations_ **≥ 3**, _parallelism_ **≥ 1**.
  - Unique **per-password salt**; encoded parameters stored with the hash.
- **Transport:** TLS 1.3; never log raw passwords; redact from traces and crash reports.
- **Copy/paste & managers:** Allow clipboard paste and long passphrases; do not block password managers.
- **Account creation & change:** Evaluate passphrase length and contextual rules server-side and provide local entropy-based feedback. Check breach exposure on the backend where possible; return accessible, localized warnings on a breach match or screening outage without preventing otherwise valid password writes. The local common-password blocklist remains mandatory.

---

# 4. Password Reset & Recovery

- Use **single-use, short-lived** reset tokens (≤ **15 minutes**).
- Bind tokens to **user + device/session fingerprint** when possible.
- After reset:
  - **Invalidate** all existing sessions and refresh tokens.
  - **Re-challenge MFA** on next login for admin accounts.
- Email templates must not disclose whether an account exists beyond the opted flow (avoid enumeration).

---

# 5. Authentication Controls (Beyond Passwords)

- **MFA/TOTP:** Built-in TOTP (RFC 6238); recovery codes (one-time, limited count).
- **Session security:** SameSite cookies (if cookies used), secure flags, and CSRF tokens on state-changing actions.
- **Brute-force defense:** Rate limits per IP and per account; anomaly detection for credential-stuffing.
- **Device signals:** Optional device binding for high-risk actions (admin areas, sharing/visibility changes).

---

# 6. Monitoring, Alerts & Metrics

Track at minimum:

- Failed login rate, lockout/backoff activations, successful logins by geo/ASN anomalies.
- Password-reset initiation/completion rates; token failures/expiries.
- MFA enrollment and bypass rates.

**Alerts (Prometheus):**

- Failed-login spike > **3σ** from 30-day baseline.
- Lockout events per account > **N** in 10 minutes.
- Password reset token failure rate > **5%** in 15 minutes.

Quarterly review results feed into security posture reports and tabletop exercises.

---

# 7. User Experience & Accessibility

- Provide a **strength indicator** tuned for passphrases (length/entropy, not just character classes).
- Clear, non-identifying error messages.
- Support screen readers and high-contrast modes; avoid timeouts that hinder assistive tech users.
- Localization for EN/DE; avoid culturally specific examples in guidance text.

---

# 8. Administrative Controls

- Admin MFA **mandatory**; enforce **step-up** MFA for sensitive actions (role changes, visibility overrides).
- Short admin session TTL; inactivity timeout.
- Quarterly access reviews for admin roles; least-privilege assignments.
- Audit log entries for password resets, MFA enrollment/disable, and admin authentication events.

---

# 9. Exceptions

- Use **EX-YYYY-####** in `infra/security/exceptions/` to request any deviation (e.g., temporary reduced length for a device UI).
- Each exception: CVSS context (if applicable), compensating controls, expiry ≤ **90 days**, security approval.
- Auto-expire exceptions; renewals require fresh justification.

---

# 10. Implementation Guidance (Engineering)

## 10.1 Backend

- Libraries: Argon2id (libsodium or language-native bindings).
- Breach checks: server-side online k-anon API with bounded timeout, caching and rate limits; matching or unavailable results are advisory. Local common-password denial remains mandatory.
- On login failures: increment per-account + per-IP counters; apply exponential backoff; return 200 with generic message.
- On successful login: reset counters; rotate refresh tokens; record correlation ID.

## 10.2 Frontend

- Strength meter: length/entropy, dictionary detection, breached-word hints.
- Allow paste and long inputs; show passphrase tips; inline, real-time validation.
- Respect reduced motion and accessible labels; do not expose validation specifics that aid attackers.

---

# 11. Compliance & References

- Aligns with **SECURITY.md (§7, §9, §11, §13)** and **Key Management Policy**.
- Informed by **NIST SP 800-63B** (memorized secrets), **OWASP ASVS** (V2, V3, V7).

---

# 12. Change Log

- **v1.1 (2026-10-31):** Approved Stage B behavior: breached-password and lookup-outage results are advisory rather than rejection; locally common passwords remain rejected. Updated account-creation/change semantics without relaxing role minima, reuse checks or Argon2id.\n- **v1.0 (2025-10-18):** First consolidated Password & Authentication Policy aligned with FitVibe SECURITY v2.2; removed periodic rotation and mandatory composition rules; added breach checks, Argon2id parameters, admin MFA requirements, monitoring thresholds, and exception workflow.
