# Dependency hygiene: first classification pass

Source: [Knip run 40072279324](https://github.com/Konstantinospil/FitVibe/actions/runs/40072279324), artifact `dependency-hygiene-40072279324`. **This is the pre-config baseline, not a proof of unused code.** Refer to issue #554.

## Verified

| Package | Status | Evidence | Next action |
| --- | --- | --- | --- |
| `openai` (root) | Removed on this branch | No application imports found in repository search; previously caused `openai > undici` production advisory | Verify absence from regenerated lockfile and `pnpm audit --prod` |
| `multer` (backend) | Patched requirement | Production advisory GHSA-q7qp-rjg7-q26m; manifest, pnpm override and exception inventory now require >=2.5.0 | Confirm lockfile resolution and upload tests |
| `snyk` (root) | Review, not remove | Knip does not reliably observe CLI usage in CI or scripts | Search CI/scripts and retain or relocate as appropriate |

## Needs evidence before any removal

| Group | Packages | Why Knip may miss usage | Verification |
| --- | --- | --- | --- |
| JSX runtimes | `preact` in frontend, backoffice, UI | Transformed JSX and Vite aliases are often implicit | Inspect tsconfig JSX import source, Vite aliases, compiled imports and Preact pilot tests |
| Backend tracing | All six `@opentelemetry/*` production findings | Preload and runtime initialization may be indirect | Inspect deployment entry points and instrumentation/bootstrap, test tracing |
| Server runtime | `compression`, `tsx` | `server.ts` and npm script entry points are not necessarily statically imported | Inspect start/build scripts and container stages |
| Frontend libraries | `react-router`, `recharts` | React compatibility/config or dynamically loaded pages | Search imports, bundle analysis and application surfaces |
| Backend authentication/logging | `otplib`, `pino-pretty` | OTP preset or logger configuration may use packages indirectly | Search runtime/logging references and tests |
| Patched packages | `foreground-child` | Dependency in a patched package may be loaded through upstream source code | Inspect the patched package source and its exported functionality |
| Developer tooling | `dotenv-cli`, `pnpm`, `ts-node`, `lighthouse`, eslint/prettier packages | Script/CI invocation may not be reported as code imports | Search package scripts and CI steps for direct use |
| Test dependencies | `@types/bcrypt`, `@types/bcryptjs`, `@types/supertest`, `pg-mem`, `supertest` | Tests are outside the backend workspace scope | Map shared tests to backend ownership before decisions |

## Baseline quality

The original full audit reported 540 unlisted imports and 348 unresolved imports, including inactive archived tests under `apps/frontend/archive/`. Until shared test-workspace ownership, generated code and configured entry points are modeled correctly, these counts are **not** interpreted as actionable missing dependencies.

## CI checkpoint

At [CI run 40074011240](https://github.com/Konstantinospil/FitVibe/actions/runs/40074011240), Quality, Frontend, Database, security, architecture, ARM64/AMD64 and deployment checks passed; **VRT failed** at `tests/frontend/visual/pages/first-login-2fa.spec.ts:27` because the secure-account dialog was not found. Do not treat this branch as green or remove additional packages before the outstanding E2E and VRT results are resolved.

## Rules for subsequent cleanup

For each package: confirm manifest declaration, search source/scripts/config/CI, inspect `pnpm why -r`, document production use, remove only when verified, regenerate lockfile, rerun full CI, and record any test discovery/ownership changes. Never use `knip --fix` for automatic removal.
