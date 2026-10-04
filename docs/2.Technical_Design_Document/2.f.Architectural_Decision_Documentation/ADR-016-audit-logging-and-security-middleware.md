# ADR-016: Security Middleware & Audit Logging

**Date:** 2025-10-14  
**Status:** Accepted  
**Author:** Reviewer  
**Cross-References:** PRD §5 Security & Privacy; PRD §7 Engineering Standards; TDD §5–§7 (auth, RBAC, logging), §10 (ops); QA §2–§12 (CI gates, security scans), §11 (performance)

---

## Context

We must enforce a secure-by-default HTTP stack and produce reliable, privacy-safe audit logs for regulated operations (auth, profile changes, data exports/deletes, payments if added). The PRD requires strict security headers, CSRF protection where applicable, role-based access control, rate limiting, and **PII-safe** logs with correlation/traceability. The TDD specifies layered middleware and centralized logging; the QA plan runs ZAP baseline, dependency scanning, and rejects builds with high CVEs or missing headers.

This ADR defines the standard middleware stack, audit event model, storage/retention, and CI observability needed to satisfy those requirements.

---

## Decision

1. **Authentication & Session**
   - **Access tokens:** JWT **RS256** (short-lived).
   - **Refresh tokens:** Server-stored, **rotating**; revocation list persisted.
   - Clock skew tolerance ≤ 60 s; mandatory TLS; token audience and issuer validated.

2. **Authorization (RBAC)**
   - **Router-level** coarse checks from JWT claims (role/scope).
   - **Service-level** fine-grained checks on resource ownership and attributes.
   - Admin-only routes isolated under `/admin` with enhanced logging/alerts.

3. **Security Middleware (HTTP)**
   - **CSP** without `unsafe-inline`; nonces for inline scripts if unavoidable.
   - **HSTS** (include subdomains), **Referrer-Policy: strict-origin-when-cross-origin**, **Permissions-Policy** (deny by default).
   - **CORS** strict allowlist; preflight handled centrally.
   - **CSRF** protection for cookie-based sessions and any state-changing route when cookies present.
   - **Input size limits** and **rate limiting** (token bucket per IP/user/route class).
   - **Body parsing** with `limit` and type checks; file uploads scanned via AV before persistence.

4. **Audit Logging Model**
   - **PII-Free Principle:** Request/response bodies are **not** logged; only minimal metadata and event fields.
   - **Correlation:** Every request carries a `correlation_id` (generated if missing); propagated to logs, metrics, and traces.
   - **Event schema (log line):**
     ```json
     {
       "ts": "2025-10-14T12:34:56.789Z",
       "event": "user.update",
       "actor_user_id": "ulid",
       "subject_type": "user",
       "subject_id": "ulid",
       "action": "update",
       "result": "success",
       "ip": "client-ip",
       "user_agent": "ua",
       "correlation_id": "uuid/ulid",
       "resource": "/api/v1/users/ulid",
       "http_method": "PATCH",
       "status": 200,
       "extras": { "fields_changed": ["displayName", "avatarId"] }
     }
     ```
   - **Never store secrets or raw PII** (e.g., email, address); use stable IDs or hashed tokens for lookup when necessary.
   - **Sampling:** Info-level request logs sampled; **security/audit events are not sampled**.

5. **Durable audit delivery**

   - A failed primary `audit_log` insert is persisted to the database-backed `audit_outbox` for later replay rather than being treated as successful delivery.
   - Replay is **at-least-once attempted and idempotent at the audit-event ID**: insertion into `audit_log` uses the original event ID and duplicate IDs are ignored before the outbox row is removed.
   - Short actor-FK visibility races may be retried synchronously with a bounded delay before falling back to the outbox.
   - Replay may be opportunistic; a full transactional outbox coupling business state and audit state is **not** implied by this mechanism. If both the primary audit insert and outbox persistence fail, the application logs that audit durability has failed; this ADR does not claim atomic business-operation/audit-event commit.
   - This mechanism is the recovery path required by the audit durability policy, not an independent source of business truth.

6. **Storage, Retention, and Integrity**
   - **Structured JSON logs** shipped to a centralized store (e.g., OpenSearch/Cloud Logging).
   - **Retention:** 180 days default; **access-controlled** indices; DSR deletions **do not** remove audit entries but they contain no PII.
   - **Tamper-evidence:** Append-only sink with periodic **hash chaining** or provider-native immutability (WORM) for audit-critical streams.

7. **Observability & Alerts**
   - **Metrics:** Prometheus counters/histograms for `http_requests`, `auth_failures_total`, `rate_limit_hits_total`, `audit_events_total`, and latency per route.
   - **Alerts:** Notify on spikes of 401/403/429, admin route access, and audit writer failures. SLO: API p95 < **300 ms**; logging overhead < **5%** CPU budget.

8. **Idempotency & Replays (tie-in)**
   - Audit entries reference idempotency keys on unsafe writes; replays are marked `result: "replay"` to distinguish from duplicates.

9. **Privacy & Compliance**
   - **Redaction hooks** scrub known fields before logging.
   - **Data residency** follows deployment region; logs tagged with region.
   - **Access controls**: least-privileged roles for log readers; auditable access to the log platform.

10. **Testing & CI Integration**
   - **Automated checks** ensure security headers, CORS policy, and CSRF tokens on protected routes (ZAP baseline in CI).
   - Unit/integration tests assert: no PII in logs, correlation propagation, and audit events for critical actions.
   - **Performance gate:** k6 smoke must pass with budgets; log sampling configurable for test envs.

---

## Consequences

**Positive**

- Strong, testable security posture with minimal risk of PII leakage.
- Traceable actions with correlation across logs, metrics, and traces.
- Clear retention and integrity guarantees for audits.

**Negative / Trade-offs**

- Added complexity and cost for centralized logging and immutability.
- Sampling and redaction must be maintained as fields evolve.

**Operational**

- Rotate keys regularly; monitor token refresh anomalies.
- Track log volume; adjust sampling and retention to control costs.

---

## Alternatives Considered

| Option                           | Description        | Reason Rejected                                              |
| -------------------------------- | ------------------ | ------------------------------------------------------------ |
| Verbose request/response logging | Log full payloads  | Privacy/compliance risk; exceeds PRD guidance                |
| Client-only analytics            | No server audit    | Fails compliance and forensics needs                         |
| Single-layer authorization       | Only router checks | Insufficient for resource-level rules; violates TDD layering |

---

## References

- PRD: Security & privacy baselines (headers, CSRF, RBAC, logging)
- TDD: Auth/RBAC design, centralized logging, operational practices
- QA: ZAP baseline, dependency scans, perf budgets

---

## Status Log

| Version | Date       | Change                                                | Author   |
| ------- | ---------- | ----------------------------------------------------- | -------- |
| v1.0    | 2025-10-14 | Initial ADR for security middleware and audit logging | Reviewer |
| v1.1    | 2026-09-24 | Document bounded audit-write retry and durable idempotent database outbox replay semantics introduced during backend debt reduction | FitVibe Engineering / Product Owner |
