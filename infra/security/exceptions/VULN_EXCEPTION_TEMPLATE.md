# Security exception request — machine-readable contract

Issue 557: Security exceptions require explicit approval and expire within 90 days.
The security CI gate scans `infra/security/exceptions/EX-YYYY-####.json`
on every run. A missing approval, expired record or invalid date **fails CI**;
renaming an exception to Markdown cannot bypass validation.

Prepare a new record by copying this example into a suitably numbered JSON
file. Replace **all** example fields with approved factual information.
An exception record does **not** itself disable any security check or grant
an application privilege. Exceptions affecting runtime enforcement require a
separately reviewed implementation, and expiration must revoke that behavior.

```json
{
  "id": "EX-2026-0001",
  "approval": "approved",
  "owner": "security-owner",
  "securityApprover": "security-reviewer",
  "asset": "affected-component",
  "justification": "Temporary documented exception; identify why remediation cannot proceed",
  "riskContext": "Specific threat, exposure, and impact assessment",
  "cvssContext": "Applicable CVE/CVSS score or a documented reason it is not applicable",
  "remediationIssue": "https://github.com/Konstantinospil/FitVibe/issues/557",
  "compensatingControls": [
    "Approved and verifiable restriction",
    "Monitoring or containment control"
  ],
  "submittedAt": "2026-10-01",
  "approvedAt": "2026-10-01",
  "expiresAt": "2026-11-01"
}
```

**These are example values, not an approved exception.** The example is
not stored as an active `EX-*.json` record.

The expiry is calculated from the approval date, not from the creation
of the issue. Any extension requires a newly reviewed approval and risk
assessment; do not extend a date in place without approval. Expired records
block CI and must be removed or renewed with fresh evidence.

Run locally:

```bash
node tests/security/check-policy-exceptions.cjs
node --test tests/security/check-policy-exceptions.test.cjs
```

No passwords, keys, user identifiers or other secrets belong in exception
records. Store security-owner decisions in the relevant GitHub issue.
