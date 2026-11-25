# ADR-040: First-party browser error reporting

**Date:** 2026-11-25
**Status:** Proposed
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** Issue #663 (production console suppression), PR #665 (suppression removed), ADR-006 (observability cardinality policy), ADR-003 (data retention), `docs/5.Policies/Data_Map.md` (Observability row)

---

## Context

Until #663 the frontend silenced `console.error` and `console.warn` in production. Removing that showed that browser errors had been invisible: a CSP-blocked animation and a username `pattern` that the browser rejected had both gone unnoticed. Making the console visible helps during development and in E2E, but nobody reads a user's console. Production needs errors to reach the team.

`utils/logger.ts` and the old suppression only had placeholder comments ("send to Sentry"). Options considered:

- **Third-party SaaS (Sentry, Bugsnag, Datadog RUM).** Rich tooling, but it adds a new data processor and an international transfer, and needs a privacy-notice change and possibly consent. It also adds an SDK to the entry bundle, which works against the Lighthouse budgets.
- **Self-hosted Sentry/GlitchTip.** No outside processor, but it is a new service to run, patch and back up on the private deployment.
- **First-party endpoint into the existing log pipeline.** No new processor, service or SDK. Reports go into logs that already have a purpose, legal basis and retention in the Data Map (Observability: legitimate interests; logs 30 days with PII redaction). Less tooling: no source-map symbolication, no issue grouping UI.

## Decision

Browsers report errors to FitVibe's own backend, and the backend writes them to the existing structured log and metrics.

### Endpoint: `POST /api/v1/client-errors`

- Public, because errors on login and registration matter. Protected by the global CSRF and origin checks, and rate limited per IP (`client_errors_report`: 20 per minute).
- Strict body: `kind` (`error` | `unhandledrejection` | `logger`), `message` (≤ 1000), optional `stack` (≤ 4000) and `source` (≤ 500), and `route`, a path of up to 200 characters. Unknown fields are rejected, so a report cannot carry a user id, email or free-form context.
- The server does not trust the client's sanitizing. Before logging, it removes control characters, query strings and fragments (which can carry one-time registration, reset or verification tokens), and email addresses.
- Logged at `warn` as `clientError` with the request id. No user id is logged.
- Counted in `frontend_client_errors_total{kind}`. Per ADR-006 it has one bounded label and no identity labels.

### Client: `apps/frontend/src/utils/errorReporter.ts`

- Installed from `main.tsx` in production builds only. SSR, unit tests and development builds send nothing.
- Reports `window` `error` events (not failed resource loads or opaque cross-origin `Script error.`), `unhandledrejection` events, and `logger.error` calls. For logger calls it sends the message and the `Error` only, never the context object.
- Sends only `location.pathname`, never the query or fragment, and applies the same token/email stripping as the server.
- Sends each distinct error once per page load, and at most 10 reports per page.
- Has no static imports. The HTTP client is loaded on the first report, so pages without errors pay nothing. A failed report is dropped silently, so reporting can never loop.
- It does not wrap `console.*`. Code that should reach the team uses `logger.error`.

## Consequences

- Production errors become visible in the logs the team already reads, within the existing 30-day retention.
- No new processor, cookie or consent category. The Data Map Observability row already covers this processing. The published privacy notice should still be checked, and may need a sentence saying that technical error reports without account identifiers are collected (owner decision).
- Stacks are minified, because no source maps are uploaded. They are still enough to find the chunk and function. Symbolication can be added later without changing the contract.
- No grouping UI. If volume or triage needs grow, the endpoint can forward to a self-hosted Sentry-compatible service behind the same contract.

## Backout plan

Remove the `installErrorReporting()` call in `main.tsx`. The endpoint can stay, because an unused, rate-limited route costs nothing.
