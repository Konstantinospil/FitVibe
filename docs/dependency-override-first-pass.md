# Override verification — first pass (21 October 2026)

Evidence: `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and workspace manifests on `feature`. Review is **advisory**. No no-override dependency resolution has been performed.

| Override | Direct manifests | Current lockfile resolution | Finding | Decision |
| --- | --- | --- | --- | --- |
| `vite: ^8.2.2` | frontend/backoffice `^8.3.4` | 8.3.4 | Direct declarations have a stricter minimum, but transitive consumers and forced specifiers remain. | Retain pending isolated comparison |
| `vitest: ^5.0.1` | frontend `^5.0.5` | 5.0.5 | Direct declaration exceeds override minimum; transitive consumers remain. | Retain pending isolated comparison |
| `jest: ^30.5.2` | backend `^30.5.2` | 30.5.2 | Direct declaration matches override; cannot infer transitive behavior. | Retain pending isolated comparison |
| `axios: >=1.16.0` | frontend `^1.15.0`; backoffice `^1.13.5` | 1.20.0 | Override raises the minimum beyond declared direct ranges. Distinct reconciliation needed. | Retain pending isolated comparison |

## Verification protocol

1. On a separate disposable worktree based on the same commit, remove **only one** pnpm workspace override.
2. Run a fresh `pnpm install --lockfile-only --no-frozen-lockfile` and inspect the lockfile diff. Do not change the tracked lockfile on the promotion branch.
3. Check dependency parents and resolved versions for the affected package, not merely the direct manifest.
4. Confirm the security reason and peer compatibility; run lint, typecheck, dependency governance, relevant tests, security checks, then complete CI including deployment builds.
5. Record exact before/after versions and test run links before classifying the override as redundant or removing it.

Current result: **zero overrides demonstrated safe to remove**. Reports from CI describe the existing resolution only. The first artifact omitted resolvedVersions because package metadata parsing returned no entries; the report generator now falls back to snapshot versions.
