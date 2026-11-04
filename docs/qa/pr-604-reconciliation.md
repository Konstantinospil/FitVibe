# PR #604 manual reconciliation

Base: `feature` at `504d6fa764600c6a4151a17cc5a697bccf77d031`.
Parallel source: `fix/i18n-remaining-913-audit` at `490a3d5ac3c5c857d962e27fe5362b482b8b8b93`.
Integration: `integration/604-manual-reconciliation`.

## Preservation rule

Keep behavior from the current feature implementation where the two branches implement the same user-facing function under different translation keys. Import additions unique to the audit branch. Both sets of translation keys remain in all five locale catalogs; retain feature translations for identical keys with differing wording. Never copy entire alternate files over the improved feature implementation.

## File-by-file decisions

1. `apps/backoffice/src/pages/Translations.tsx`: feature version; uses localized loading, timestamps, complete pagination and localization keys; audit's alternate keys are preserved in all catalogs.
2. `apps/backoffice/src/pages/Users.tsx`: feature version; preserves active locale for date formatting, role-code fallback, privileged action handling, localization and accessible labels.
3. `apps/frontend/src/components/AppHeader.tsx`: feature version; `navigation.main` and audit's `navigation.mainNavigation` both available.
4. `apps/frontend/src/components/ConfirmDialog.tsx`: feature version; competing changes are formatting-only and do not change button callbacks or semantics.
5. `apps/frontend/src/components/ThemeToggle.tsx`: feature version; alternate `themeToggle.*` keys preserved.
6. `apps/frontend/src/components/domain/VibeformConstellation.tsx`: feature version; both accessibility label namespaces preserved.
7. `apps/frontend/src/components/profile/TwoFactorManagement.tsx`: feature version; audit difference only formats existing localized status text.
8. `apps/frontend/src/contexts/ToastContext.tsx`: feature version; `notifications.close` and `notifications.dismiss` keys preserved.
9. `apps/frontend/src/lib/vibeform/templates/FlowVibeform.tsx`: feature version; semantic code and translation call equivalent.
10. `apps/frontend/src/pages/LoginFormContent.tsx`: feature version; retains login-specific empty-field error and error-code handling; audit substitutes registration-specific label.
11. `apps/frontend/src/pages/VerifyEmail.tsx`: feature version; retains localized error handling and error-code validation.
12. `apps/frontend/src/public/login-shell.ts`: feature version; uses existing 5-locale `login-shell-text.json` and differentiated authentication errors. Audit auth catalogs retained separately.
13. `tests/frontend/components/profile/TwoFactorManagement.test.tsx`: feature version; labels follow actual localized component contract, not hardcoded English.
14. `tests/qa/audit-ui-literals.cjs`: feature version; retains stricter classifications for translation defaults, technical ARIA/SVG, Intl formatting and notifications.
15. `tests/qa/audit-ui-literals.test.cjs`: feature version; tests current AST rules, including UI defaultValue, nonlinguistic templates and SVG/ARIA.

Additional reconciliations: `PublicRoutes.tsx` and `Router.tsx` use the audit branch's shared localized LoadingFallback, and `dashboardApi.ts` retains locale-aware dashboard metrics. Seven source-only files imported, five Backoffice catalogs unioned (46 unique keys/locale), and five frontend common catalogs unioned (17 keys/locale).

## Static checks performed

- All five Backoffice locales contain 410 flattened keys with identical key sets.
- All five frontend auth catalogs contain 147 flattened keys with identical key sets.
- Frontend common catalogs contain the same 979 shared keys in all five locales; Greek adds 8 Greek-specific character keys.
- The latest integration branch was compared against both parents using GitHub compare and file/blob checks.

## Required runtime/CI verification

Historical two-parent merge confirms commit provenance, not behavioral correctness. Full lint, TypeScript typecheck, QA AST tests, frontend and Backoffice browser suites, authentication/2FA tests and required CI gates must run on the integration/feature commit. Review overlapping locale strings with different values in context. Do not claim that all 913 audit findings are functionally remediated solely from this merge.
