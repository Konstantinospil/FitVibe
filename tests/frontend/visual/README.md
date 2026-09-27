# Visual Regression Tests

Visual regression tests ensure UI consistency across themes and breakpoints. These tests capture screenshots and compare them against baseline images to detect visual regressions.

## Overview

Per QA Plan Section 16 (VIZ-SNAP-02), visual regression tests:

- Test critical screens: Auth, Planner, Logger, Dashboard, Feed, Profile, Settings
- Cover themes: light and dark
- Cover breakpoints: xs (360px), sm (640px), md (1024px), lg (1280px)
- Use deterministic time (frozen clock) and masked dynamic regions
- Enforce maxDiffPixelRatio ≤ 0.2%

Playwright projects (`ui:{theme}:{viewport}`) drive the matrix. Each spec has one test per screen and skips combinations that are out of scope, so the same case is not run eight times.

## Running Tests

### Local Development

```bash
# Run the same Linux Chromium visual comparison used by CI
pnpm test:visual
```

`pnpm test:visual` always runs inside the pinned Playwright Linux Docker image, even when invoked from Windows. This avoids host-OS font and rendering differences.

### Updating Baselines

**Linux baseline update** — Playwright Docker image, not Compose:

```bash
pnpm test:visual:update
```

### Updating Baselines in GitHub

A manual GitHub Actions workflow, **Update Visual Baselines**, provides the same operation without requiring local Docker:

1. Open **Actions → Update Visual Baselines → Run workflow**.
2. Set `source_ref` to the branch containing the intentional UI changes (normally `dev` or a feature branch).
3. Keep `target_branch` as `dev` for normal development.
4. The workflow regenerates and verifies the Linux baselines, rejects changes outside `*-linux.png` snapshot paths, pushes a dedicated branch, and opens a **draft** PR.
5. Review the changed baseline images in that PR.
6. If the screenshots are correct, mark the PR **Ready for review**. This triggers the normal CI workflow.
7. Merge only after CI passes and the visual changes have been explicitly approved.

The updater workflow is intentionally installed on the repository default branch so that GitHub exposes the `workflow_dispatch` control. It may still generate baselines from another `source_ref`.

The comparison and update commands both run `mcr.microsoft.com/playwright:v1.63.0-jammy`, the same image as the `visual_regression` CI job. The update command rewrites `*-linux.png` files; commit them only after reviewing and approving the visual changes.

**Important**: Baseline updates require design approval and should include before/after screenshots in the PR description.

## Test Structure

```
tests/frontend/visual/
├── config/
│   └── playwright.config.ts    # Playwright configuration for visual tests
├── helpers/
│   ├── auth.ts                 # Session flag + theme seeding
│   ├── capture.ts              # Shared prepare / screenshot helpers
│   ├── fakeClock.ts            # Freezes time for deterministic tests
│   ├── mask.ts                 # Masks dynamic regions (timestamps, avatars, etc.)
│   ├── mockApi.ts              # Route mocks for authenticated screens
│   ├── project.ts              # Theme/viewport matrix helpers
│   └── responsive.ts           # Responsive design validation helpers
├── pages/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   ├── feed.spec.ts
│   ├── logger.spec.ts
│   ├── planner.spec.ts
│   ├── profile.spec.ts
│   └── settings.spec.ts
└── components/
    └── navbar.spec.ts
```

Baselines live next to each spec in `*.spec.ts-snapshots/` and are committed. Failure diffs go to `__screenshots__/` (gitignored).

## Determinism Controls

- **Fake Clock**: All tests use frozen time (`2025-10-01T12:00:00.000Z`) via `freezeTime()` helper
- **Dynamic Masking**: Timestamps, avatars, charts, and animated elements are masked
- **Seeded Data**: Tests use deterministic API fixtures
- **Network Stability**: Unmatched `/api/**` requests are stubbed so they cannot hang
- **Auth**: `sessionStorage.fitvibe:auth` is set before navigation so bootstrap and the auth store stay signed in

## CI Integration

Visual regression tests run automatically in CI:

- Job: `visual_regression`
- Runs after: `quality` and `frontend_tests`
- Command: `pnpm test:visual:ci`
- Snapshot mode: comparison-only (`--update-snapshots=none`)
- Fails if: maxDiffPixelRatio > 0.2%, any unapproved visual diff, or CI modifies/creates a baseline snapshot
- Artifacts: actual/expected/diff screenshots, traces, HTML report, and JUnit output are uploaded for review
- Baseline updates are never performed or committed by CI; use `pnpm test:visual:update` explicitly and commit approved `*-linux.png` files

## GitHub Baseline Update Workflow

A manual GitHub Actions workflow, **Update Visual Baselines**, regenerates the committed Linux baselines from the latest `dev` branch.

The workflow:

1. checks out the latest `dev`;
2. installs the pinned project dependencies;
3. runs `pnpm test:visual:update`;
4. reruns `pnpm test:visual` to verify the regenerated baselines;
5. refuses to continue if anything other than `*-linux.png` visual baselines changed;
6. creates a run-specific branch;
7. opens a **draft pull request** back to `dev`.

The generated PR is intentionally draft. Review the screenshot changes before accepting them. Once they are approved, mark the PR **Ready for review**; the normal CI workflow includes the `ready_for_review` event and will run against the updated baselines.

This workflow does not make visual differences self-approving. A human still decides whether the new screenshots represent the intended UI.

## Adding New Visual Tests

1. Create a spec with a single test per screen (theme/viewport come from the project)
2. Use `openAuthenticatedPage` / `openPublicPage` and `capturePageScreenshot`
3. Pass `skipUnlessMatrix` viewports (and themes) that match QA Plan D.3
4. Wait for a stable selector so loading skeletons are not snapshotted
5. Update Linux baseline screenshots explicitly (`pnpm test:visual:update`), review the diffs, and commit the approved baselines

Example:

```typescript
import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("My Page Visual Tests", () => {
  test("my page", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/my-page", { viewports: ["md", "lg"] });
    await capturePageScreenshot(page, testInfo, "my-page", { waitFor: "role=heading" });
  });
});
```

## Troubleshooting

### Tests Fail with Visual Differences

1. Review the diff images in CI artifacts
2. If the change is intentional:
   - Get design approval
   - Update baselines with the Docker command above
   - Commit updated baselines with the PR
3. If the change is unintentional:
   - Investigate CSS/styling changes
   - Check for layout shifts or responsive breakage

### Screenshots Not Matching Locally

Windows and macOS font rendering differs from CI, so the project deliberately runs visual comparisons in the Linux Playwright container. Use `pnpm test:visual` to compare and `pnpm test:visual:update` only when intentionally accepting new Linux baselines.

## References

- QA Plan Section 16: Visual Design QA
- Playwright Visual Comparisons: https://playwright.dev/docs/test-screenshots
