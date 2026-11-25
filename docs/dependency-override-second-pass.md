# Override verification — second pass (24 November 2026)

Supersedes the "zero overrides demonstrated safe to remove" result of
[the first pass](dependency-override-first-pass.md). Scope: the 32 overrides in
`pnpm-workspace.yaml` on `feature` at `b61b497`. Result: **29 removed, 3 kept.**

## Method

For every override, on a disposable copy of the same commit:

1. Remove **only that** override line.
2. Re-resolve with `pnpm install --lockfile-only` twice: once keeping the
   committed lockfile (what a real PR produces) and once from scratch (what the
   parents' ranges select today).
3. Diff the resolved package set against the baseline, map every dependency
   parent to the range its published manifest declares, and run `pnpm audit`.
4. Repeat for groups that overlap (the minimatch, OpenTelemetry and Jest
   families), and finally with all removals applied together.

Toolchain: pnpm 12.5.1 (`packageManager`). Advisory data: npm audit
(GitHub Advisory Database). Not covered here: installing, building and running
tests; that is left to full PR CI.

## Removed: no change to the installed package set (21)

| Override                                                                                                                                                                                                            | Evidence                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `minimatch@5`, `minimatch@9`                                                                                                                                                                                        | No package requests minimatch 5 or 9.                                                                                                |
| `brace-expansion@1`, `brace-expansion@2`                                                                                                                                                                            | No package requested v1/v2 at the time of removal.                                                                                   |
| `@opentelemetry/propagator-jaeger`                                                                                                                                                                                  | Not in the dependency graph.                                                                                                         |
| `extract-zip` (`link:packages/patched-extract-zip`)                                                                                                                                                                 | No consumer: `@puppeteer/browsers` 3.x replaced it with `modern-tar`. The orphaned workspace package was deleted.                    |
| `brace-expansion@5`                                                                                                                                                                                                 | Only consumer (minimatch 11) already asks `^5.0.12`.                                                                                 |
| `lighthouse`                                                                                                                                                                                                        | `@lhci/cli` / `@lhci/utils` 0.16.1 pin `13.6.0` themselves; the root devDependency stays.                                            |
| `expect`, `jest-message-util`, `@jest/types`, `jest-util`                                                                                                                                                           | Jest 30.5.2 packages pin exactly these versions.                                                                                     |
| `ajv`                                                                                                                                                                                                               | Resolves 6.15.0 either way (patched ≥6.14.0). The override also wired ajv 6 into `ajv-formats`' optional peer, which requires ajv 8. |
| `@humanfs/node`                                                                                                                                                                                                     | Resolves 0.16.8 either way; from scratch the override pushed eslint to 0.17.0, outside its `^0.16.6`.                                |
| `@eslint/config-array>minimatch`, `@eslint/eslintrc>minimatch`, `eslint-plugin-import>minimatch`, `eslint-plugin-jsx-a11y>minimatch`, `eslint-plugin-react>minimatch`, `eslint>minimatch`, `test-exclude>minimatch` | Fully shadowed by `minimatch@3`.                                                                                                     |

## Removed: obsolete floors that forced versions outside parent ranges (8)

| Override                                                                         | Before                                                                                                                   | After                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `@opentelemetry/core: >=2.8.0` + `@opentelemetry/exporter-prometheus: >=0.217.0` | OTel 3.x packages pinning core `3.1.1` resolved core **2.10.0**; sdk-node got exporter-prometheus 0.221.0 (asks 0.301.2) | All 35 core edges on 3.1.1; exporter-prometheus 0.301.2 |
| `esbuild: ^0.25.0`                                                               | 0.25.12, although tsx asks `~0.28.0` and vite `^0.27 \|\| ^0.28`                                                         | 0.28.2                                                  |
| `protobufjs: >=7.6.1`                                                            | 8.8.0 for `@grpc/proto-loader` (asks `^7.5.3`)                                                                           | 7.6.6                                                   |
| `js-yaml: >=4.3.1`                                                               | 5.4.1 for `^3`, `^4` and `^5.5.0` consumers                                                                              | 3.15.2 / 4.3.2 / 5.5.0                                  |
| `qs: >=6.16.1`                                                                   | 6.16.1 everywhere, superagent (asks `^6.17.1`) included                                                                  | express/body-parser 6.16.1 (patched), superagent 6.17.1 |
| `minimatch@3: >=3.1.4`                                                           | eslint stack forced from `^3.1.2` to v11                                                                                 | minimatch 3.1.5 + brace-expansion 1.1.22                |
| `@jest/transform: ^30.5.2`                                                       | Only masked a stale optional peer (ts-jest → babel-jest 30.2.0)                                                          | ts-jest re-resolved: babel-jest 30.5.2, esbuild 0.28.2  |

`pnpm audit` after all removals: no known vulnerabilities.

## Kept (3)

| Override                  | Why                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glob: 14.0.2`            | Removal reintroduces GHSA-3g3m-2fjr-6pw4 (glob 13.0.7 and 10.5.0).                                                                                         |
| `minimatch@10: 11.0.1`    | Removal reintroduces GHSA-g3hv-75wg-m249 (minimatch 10.2.6).                                                                                               |
| `chrome-launcher: ^1.2.1` | Not security-relevant, but removal gives `@lhci/cli` chrome-launcher 0.13.4 → rimraf 3, which the `glob` override would force onto glob 14 (API mismatch). |

Details and removal criteria for the kept entries are in
`docs/dependency-overrides.json`.

## Follow-ups

- `chrome-launcher`: consider a parent-scoped `@lhci/cli>chrome-launcher` rule so
  lighthouse gets its declared `^1.2.2`.
- `glob`: the `14.0.2` pin is below rimraf 6.1.4's `^14.0.3`.
- `packages/patched-glob` (vendored glob 10.5.1) is not referenced by any
  override or manifest.
- `tests/qa/report-dependency-relevance.cjs` reports parent-scoped selectors
  (`parent>child`) as stale because it looks them up as package names.

## Addendum: pnpm toolchain pins (25 November 2026)

- The root `pnpm` devDependency (drifted to 12.21.0 via Dependabot) was removed;
  pnpm is pinned only by `packageManager` (12.5.1).
- Dockerfiles no longer pin their own pnpm (`10.34.5` dev, `12.9.0` prod). They
  run `corepack install` and assert the version equals `packageManager`.
  Reproduced on the 4 October tree: pnpm 12.5.1 deploys fine with an explicit
  `--legacy`; the failure that motivated 12.9.0 was a plain `pnpm deploy`.
- pnpm 12 ignores `force-legacy-deploy` in `.npmrc` (12.5.1 and 12.9.0 both fail a
  plain deploy with it). The setting now lives in `pnpm-workspace.yaml` as
  `forceLegacyDeploy: true`, and `.npmrc` was deleted.
- Dev images were broken on `feature`: the backend ran a plain deploy, and the
  frontend runtime stage installed without `.pnpmfile.cjs` and without the
  `@fitvibe/ui` workspace package. Both now follow the prod build flow.
