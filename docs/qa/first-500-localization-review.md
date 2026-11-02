# Localization audit: first 500 findings

## Baseline and reproducibility

The review covers **all categories** of the first 500 `findings` in the AST inventory from GitHub Actions run [41533808821](https://github.com/Konstantinospil/FitVibe/actions/runs/41533808821), artifact `ui-literal-audit-41533808821` / `ui-literals.json`. It does not mean the first 500 *UI-only* findings.

Individual decisions, in baseline index order, are stored in [first500-verdicts.json](./first500-verdicts.json) as run-length-encoded categories, anchored to SHA-256 of the original 500 finding IDs joined with newline characters. The immutable sets of all 103 corrected UI literal IDs and 56 false-positive IDs are preserved in [first500-baseline-id-sets.json](./first500-baseline-id-sets.json). The `first500-localization.test.cjs` regression gate rescans both applications and requires corrected UI literal IDs to stay absent and remaining false-positive IDs to stay technical; this check does not depend on the 90-day retention of the original workflow artifact. The baseline report supplies each ID, source file, line, AST reason, and literal. [first500-summary.json](./first500-summary.json) records the baseline.

| Category | Occurrences | Review outcome |
|---|---:|---|
| `T`: already technical | 341 | Legitimate implementation literals; no translation |
| `F`: false positives | 56 | Scanner classifications require correction |
| `L`: user-facing copy | 103 | Must move into locale-aware rendering |
| **Total** | **500** | Original report records, not unique text strings |

## Source-file breakdown

| File (under `apps/backoffice/src/`) | T | F | L | Remediation |
|---|---:|---:|---:|---|
| `App.tsx` | 26 | 22 | 1 | Protected-route loading message localized |
| `components/AdminStatusHeader.tsx` | 42 | 6 | 19 | Status, health and counts localized |
| `components/FreshTotpDialog.tsx` | 23 | 0 | 6 | Title, guidance, input, error and buttons localized; authorization unchanged |
| `components/Layout.tsx` | 22 | 1 | 3 | Logo alt, identity and sign-out localized |
| `components/ThemeToggle.tsx` | 15 | 3 | 4 | Screen-reader label and tooltip localized |
| `components/ui/Button.tsx` | 2 | 0 | 0 | Technical identifiers retained |
| `components/ui/Card.tsx` | 2 | 0 | 0 | Technical identifiers retained |
| `hooks/useThemeColors.ts` | 1 | 12 | 0 | CSS custom properties recognized as technical |
| `hooks/useToast.ts` | 1 | 0 | 0 | Technical identifier retained |
| `main.tsx` | 4 | 1 | 0 | DOM mount-point identifier; not user-facing |
| `pages/AdminDashboard_v2.tsx` | 44 | 0 | 17 | Navigation names and descriptions localized |
| `pages/AuditLogs.tsx` | 159 | 11 | 53 | Filters, table, summaries, metadata, selection and details localized |

## False-positive mechanisms

- **CSS properties and dimensions**: e.g. `var(--color-text-primary)`, `10px`. Their style values are technical, even when the object property happens to be named `text`.
- **DOM and routing identifiers**: `/login`, `to="/translations"`, `data-theme`, `root`. Translate only corresponding displayed labels, never these identifiers.
- **Comparison and filter values**: `dark`, `admin`, `superadmin`, `all`, and severity codes. Preserve these values in API requests and state; localize their visible representations separately.
- **Internal diagnostic strings**: e.g. timeouts and logs. Do not translate if they are exclusively for developer diagnostics.

The AST classifier has been refined for CSS custom properties/dimensions, JSX comparison operands, navigation targets and DOM selectors. Some ambiguous literals necessarily remain in the **review** category; the aim is to reduce false positives without suppressing potentially visible text.

## Remediation design

The Backoffice catalog is in `apps/backoffice/src/i18n/ui.ts` with matching locale files for French, Spanish and Greek. All five locales (EN, DE, FR, ES, EL) have the same translation keys and placeholders. The `first500-localization.test.cjs` suite checks this parity, direct key references and the 500-entry review record.

Security-sensitive MFA validation, audit protocol codes, database records, routes and role values are untouched. Database-defined audit action names and unknown server-generated labels require further **data-contract** localization review: they were not among the 103 confirmed source literals.

## Verification criteria

1. `pnpm ui-localization:test` must pass.
2. Prettier, lint, TypeScript, Backoffice browser tests, and audit job must pass.
3. Compare the new `ui-literals.json` against the **original 500 finding IDs**. A corrected UI issue should no longer appear as the same untranslated source literal. A corrected false-positive candidate should either disappear or be classified `technical`.
4. Manually verify representative EN/DE/FR/ES/EL screens, particularly the TOTP challenge and audit details.

**Do not merge PR #599 until validation is complete.** Source-based counts are not substitutes for runtime confirmation.
