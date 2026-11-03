# Localization AST audit: second tranche (913 findings)

## Baseline and scope

The source of truth for this review is the **UI Literal AST Audit** artifact
`ui-literal-audit-41594129548 / ui-literals.json`, generated from GitHub Actions
[run #41594129548](https://github.com/Konstantinospil/FitVibe/actions/runs/41594129548)
on `fix/i18n-first-500-review`.

It contained **913 candidates** from **158 scanned files**, distinct from
the earlier first-500 review:

| Category | Candidates |
|---|---:|
| Likely UI text | 232 |
| Needs source review | 681 |
| Total | **913** |

Split by source area: Backoffice 192 (120 UI, 72 review); main frontend 721
(112 UI, 609 review). These are *occurrences*, not verified unique bugs.

The baseline is immutable, and its original JSON report is available from
the workflow artifact. Do not interpret reductions between scanner versions
as fixed defects without checking whether the text was translated or the
scanner simply classified it as technical.

## Remediation branch and code changes

Work is on `fix/i18n-remaining-913`, draft PR #601 stacked on
`fix/i18n-first-500-review` (PR #599). The following concrete cases were
reviewed and modified:

| Source | Finding class | Treatment |
|---|---|---|
| `backoffice/pages/Users.tsx` | UI copy and confirmation prompts | Localized page title, filters, form and table labels, actions, status and role names, prompts, confirmation messages and user feedback; raw API error text replaced with localized generic feedback |
| `backoffice/pages/Translations.tsx` | UI copy / date formatting | Localized translation editor, filters, selection labels, archive states and pagination; switched forced en-US date display to active locale |
| `backoffice/i18n/*.json` | Missing locale resources | Added corresponding EN/DE/FR/ES/EL entries for translated Backoffice surfaces |
| `frontend/pages/LoginFormContent.tsx` | English fallback and backend error passthrough | Uses existing locale keys; avoids displaying raw server-origin messages |
| `frontend/pages/TwoFactorVerificationLogin.tsx` | English fallback | Uses existing translations, retaining verification and session expiry rules |
| `frontend/components/profile/TwoFactorManagement.tsx` and `services/accountApi.ts` | Hardcoded MFA recovery text and incorrect HTTP payload | Localized restart instructions; password-only step-up omits invalid empty optional OTP, with regression test |
| `frontend/pages/VerifyEmail.tsx` | Email verification error copy | Localizes error-code responses instead of displaying raw server messages |
| `frontend/pages/Contact.tsx` | English t() defaultValue and API passthrough | Removed fixed English fallbacks; preserved translated keys and generic localized failure messages |
| `frontend/components/AppHeader.tsx` | Navigation and slogan | Translation keys for labels; removed hardcoded English fallbacks |
| `frontend/components/LegalDocumentShell.tsx` | Effective date / version | Added translations in all five supported languages |
| `frontend/services/dashboardApi.ts` | Metric names and trends | Localized metrics, plural day counts, periods and trend descriptions |
| `frontend/contexts/ToastContext.tsx`, `components/ThemeToggle.tsx` | Accessible UI names | Translated notification region, dismiss, and theme controls |
| `frontend/routes/PublicRoutes.tsx`, `routes/Router.tsx` | Suspense loading | Converted fixed English loading content into localized components |
| `frontend/public/login-shell.ts` | Pre-hydration labels and errors | Added a small five-language resource for the standalone login shell |
| `frontend/i18n/config.ts` | Hardcoded English minimal login bundle | Relocated localized resource data into JSON, preserving lazy loading |
| `frontend/components/domain/VibeBadge.tsx`, `VibeformConstellation.tsx`, `lib/vibeform/**` | Assistive names and action instructions | Use localized labels and fallback text |
| `frontend/components/ConfirmDialog.tsx`, `composites/Modal.tsx` | Default buttons | Localized default confirmation and dismissal labels |

## False-positive analysis and improved detector

`tests/qa/audit-ui-literals.cjs` now distinguishes these documented
technical values from display text:

- Native SVG attributes (path commands, coordinates, dimensions, fill and
  stroke, namespace, clip path). These must remain protocol/graphic literals.
- ARIA *state* attributes (e.g., `aria-hidden="true"`,
  `aria-live="polite"`, `aria-haspopup="menu"`); **aria-label** remains
  user-facing and must be translated.
- React event-handler control, numeric and styling props, documented locale
  formatting instructions, colors and resource URIs.
- Translation-key arguments to `t()` are technical; literal
  `defaultValue: "English copy"` is *not* technical and is flagged for
  remediation.
- Existing first-500 review protections remain active.

Regression cases for these distinctions are located in
`tests/qa/audit-ui-literals.test.cjs`.

## Per-finding baseline reconciliation

The JSON ledger [`i18n-913-baseline-reconciliation.json`](./i18n-913-baseline-reconciliation.json)
records **all 913 original candidate indices** in stable baseline order,
anchored by a SHA-256 of the original finding IDs. The ledger uses
run-length-encoded statuses, which can be expanded and matched to each
original finding ID in the immutable workflow artifact.

An initial comparison against run #41711310263 yielded:

| Mechanical status | Count | Interpretation |
|---|---:|---|
| Removed from source / stable ID absent | 195 | Must verify whether corrected, relocated, or intentionally removed |
| Reclassified technical | 262 | False-positive candidates no longer classified as UI/review |
| Still UI/review or awaiting manual disposition | 456 | Not proof of 456 bugs; source inspection required |
| **Total** | **913** | Audited scope |

This ledger deliberately distinguishes **mechanical reconciliation** from
confirmed remediation. A more recent audit after the subsequent code fixes
is required before the user can consider all 913 resolved.

## Audited candidate count over time

| Audit run | Likely UI | Review | Combined |
|---|---:|---:|---:|
| Baseline 41594129548 | 232 | 681 | 913 |
| Intermediate 41711310263 | 43 | 433 | **476** |

The intermediate run predates subsequent changes. **Do not use it to assert
all 913 were corrected.** It reflects both false-positive reclassification
and actual localization changes. The definitive completion condition is an
updated audited inventory plus tests for all supported locales.

## Known follow-up issues and merge criteria

The initial push-triggered quality check on the parent stack contained
Prettier violations in the Backoffice. Some were corrected on this branch;
their resolution requires new lint results.

1. Review every residual `ui` and `review` record, especially dynamic
   strings in the frontend, SSR fallback rendering and application-controlled
   backend error text, without blindly translating protocol identifiers.
2. Reconcile remaining records against the baseline by stable finding ID,
   retaining confirmed exemptions with an explanation.
3. Run scanner regression, locale parity, frontend unit tests, Backoffice
   E2E and the full push-triggered CI. The pull-request CI does not execute
   every quality job.
4. Keep PR #601 **draft and unmerged** until that validation succeeds.

The separate backend/data-contract findings (984 candidates in an older
audit) are **not** included in these 913 frontend-source findings.
