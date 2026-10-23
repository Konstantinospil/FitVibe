# Issue #523 — Renderer parity baseline (2026-10-23)

## Verified current build contracts on `fix/bundle`

| Execution surface | Command/configuration | Renderer |
| --- | --- | --- |
| Production SSR client | `pnpm --filter @fitvibe/frontend build:client` sets `USE_REACT=true` | React |
| Production SSR server | `build:server` sets `SSR=true`; `src/ssr/render.tsx` imports `react-dom/server` | React |
| Production SSR pipeline | `build:ssr` composes client, server and static output | React |
| Frontend Vitest | `vite.config.ts` selects React when `VITEST=true` | React |
| Client-only Vite build | `vite.config.ts` selects `@preact/preset-vite` when React/SSR switches are absent | Preact |
| Backoffice | Separately configured; verify its build before assigning test-renderer parity | Not established in this audit |

## Impact on the issue

The issue's premise that all production frontend component tests must be rendered by Preact is **not currently true for the SSR deployment**. Replacing `@testing-library/react` across the existing Vitest suite would decrease parity with the default SSR production build and may create misleading test results.

## Proposed safe pilot

1. Preserve existing React-rendered tests for SSR-path components and hooks.
2. Identify client-only Preact entrypoints *actually deployed and used*, then select 5–10 existing component tests relevant to that entrypoint.
3. Add `@testing-library/preact` and isolated Preact-only Vitest aliases/configuration **only for that selected pilot**, with lockfile regenerated via pnpm (not manually patched).
4. Run both React baseline and Preact pilot tests, asserting real behavior (events, state, async transitions). Reuse existing test files where possible, or explicitly declare test ownership in `tests/qa/assert-test-discovery.cjs`.
5. Verify parity with real built-client Playwright tests and production SSR hydration. Preserve current coverage gates and no-skip policy.
6. Only expand migration if the intended production frontend renderer is switched to Preact, or if a distinct Preact client-only target is verified.

## Required architectural decision

Is the deployed SSR application's intended renderer still React, or is migration of the SSR client/server build to Preact planned? This decision must precede wholesale test renderer migration; do not make an unapproved runtime framework change as part of a test-only issue.

## Test ownership

The active frontend unit tests under `tests/frontend/**/*.test.{ts,tsx}` are owned by the `frontend-vitest` entry in `tests/qa/assert-test-discovery.cjs`. A separate `*.test.*` pilot must remain within this owned location or explicitly extend the ownership check and CI runner.
