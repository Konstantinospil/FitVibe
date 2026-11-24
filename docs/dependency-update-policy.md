# Dependency update and override policy

## Existing updates

Dependabot proposes updates against feature weekly. Security updates can target
main (the default branch). Use feature -> dev -> main for release promotion.
Every deployment must use a reviewed lockfile.

## Weekly latest compatibility canary

The GitHub Action at .github/workflows/dependency-latest-canary.yml runs
Tuesday 06:20 UTC after it has been merged to main (scheduled workflows only
run from the default branch). It also supports manual dispatch.

It checks out feature, attempts workspace-wide latest-version updates, retains
the pinned pnpm toolchain, and runs audit, typecheck, lint, builds, and
frontend/backend unit tests. Its artifact includes the changed-manifest and
lockfile patch, upgrade logs and a summary.

A green canary is not release approval: integration, E2E, visual regression,
production Docker smoke, and ARM64 runtime validation need normal full PR CI.
The canary never pushes commits, creates PRs, publishes images or deploys.
To adopt tested changes, apply the patch on a separate branch, update any
coupled Docker/browser versions, and open a PR against feature.

## Controlled override removal

Never remove all overrides simultaneously. Security constraints, compatibility
exceptions and local patched-extract-zip carry distinct risks.

On manual dispatch, supply remove_override with exactly one inventory name.
The isolated probe verifies and removes one workspace entry without rewriting
the inventory. The governance inventory check is intentionally skipped for
this diagnostic probe, but audit and compatibility testing still run.
No removal is committed or deployed.

Before permanent removal, compare dependency parents, resolved versions,
known advisories and application behavior. Update the inventory and workspace
declaration together in a normal PR, and require full CI. This includes
production Docker and ARM64 verification where relevant. A clean pnpm audit
alone cannot prove that every replacement is secure.

Prioritize unverified-necessity entries for investigation. Keep
security-patch-required and link: patches until a verified upstream fix or
replacement is available and demonstrated compatible.

Do not use latest resolution directly in deployment: keep tested lockfiles and
digest-pinned images for reproducibility.
