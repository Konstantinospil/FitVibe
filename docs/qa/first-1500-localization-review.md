# Localization AST audit — original findings 1–1500

## Scope, baseline and approach

The immutable source is [CI 41533808821](https://github.com/Konstantinospil/FitVibe/actions/runs/41533808821), `ui-literals.json`. Findings are **1-based, ordered JSON records**, including the technical class. The requested range “0–1500” means original records **1 through 1500**, not current sorted results or only visible-text candidates. Identical text at different source locations represents separate occurrences, anchored by the original stable finding ID.

| Original record indices | Technical (T) | False positives (F) | Confirmed UI / user-facing (L) | Per-record evidence |
|---|---:|---:|---:|---|
| 1–500 | 341 | 56 | 103 | [first-500-localization-review.md](first-500-localization-review.md), [first500-verdicts.json](first500-verdicts.json) |
| 501–1000 | 362 | 39 | 99 | [second-500-localization-review.md](second-500-localization-review.md), [second500-baseline-id-sets.json](second500-baseline-id-sets.json) |
| 1001–1500 | 384 | 11 | 105 | [third500-verdicts.json](third500-verdicts.json) |
| **Total** | **1087** | **106** | **307** | **1500 baseline records** |

The third batch's original 500 ID SHA-256 is `2d80a617d17784090b469bb6388041805bdfc2d59a5334989f393c6dd096d942`. Individual ordered dispositions are run-length encoded in `third500-verdicts.json`; both the 105 localized IDs and 11 false-positive IDs are stored there. The original CI artifact contains the unabridged corresponding file, source line, AST reason, source literal and stable ID. The existing regression gates protect the earlier two batches.

## Third batch: file-level decisions

| File | T | F | L | Resolution |
|---|---:|---:|---:|---|
| `apps/backoffice/src/pages/Messages.tsx` | 230 | 0 | 38 | Translate remaining table headings, message states, tooltips, paging, detail labels, response input and actions |
| `apps/backoffice/src/pages/PrivilegeManagement.tsx` | 27 | 3 | 29 | Translate role-change UI, sudo feedback, TOTP descriptions and buttons; **never change API role codes** |
| `apps/backoffice/src/pages/Settings.tsx` | 107 | 0 | 38 | Translate system controls, configuration status, action table, and administrative audit notes and maintenance message |
| `apps/backoffice/src/pages/Translations.tsx` | 20 | 8 | 0 | Preserve language codes and compound grouping/sorting keys as technical; use the selected Backoffice locale for `Intl.DisplayNames` |
| **Total** | **384** | **11** | **105** | |

### False-positive analysis

- `admin` and `superadmin` in the `nextRole` conditional are security-sensitive enum values passed to the backend, not translated display copy. The displayed role names are now translated separately.
- `superadmin` under a `disabled` predicate is an authorization discriminant.
- `DisplayNames` is an `Intl` property identifier.
- `en` is used as a fallback language code, either for data lookup or (previously) as the preferred `Intl.DisplayNames` locale. The latter was corrected to use the active Backoffice locale.
- `${namespace}::${key_path}` and `${namespace}.${key_path}` are stable grouping and ordering keys, not displayed strings.

The scanner was refined **only for the proven technical patterns**. Source-level audits cannot guarantee dynamic API fields or all browser states are correctly translated; those need the separate data-contract and live-browser checks.

## Regression tests and verification

```bash
pnpm ui-localization:test
pnpm ui-literals:audit
pnpm --filter @fitvibe/backoffice run typecheck
pnpm --filter @fitvibe/backoffice run lint
pnpm test:backoffice
```

`tests/qa/third500-localization.test.cjs` validates the original SHA and complete run-length verdicts, both ID sets, scanner coverage, translation references, and zero surviving original UI or review classifications. The tests for batches 1 and 2 remain active.

**Merge gate:** validate the final branch SHA in CI, including lint/typecheck, browser behavior across all five languages and MFA/administrative flows. On a branch push, GitHub's audit workflow can succeed while general quality and browser jobs are skipped; do **not** interpret that as full approval.
