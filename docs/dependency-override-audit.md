# Dependency override impact audit

Run `node tests/qa/report-override-impact.cjs > override-impact.json` from the repository root.

The report enumerates all workspace overrides, identifies direct declarations,
lists resolved versions found in the lockfile, and marks unresolved justification.
It is intentionally advisory. A resolved version **does not** establish that an
override is necessary, redundant, secure, or safe to remove. The report marks
every entry's `overrideEffect` as `not-determined` and `safeToRemove` as false.

Before changing an override, determine its dependency parents, confirm the
advisory or compatibility rationale, and compare an isolated fresh installation
with and without the single override. Verify the resulting lockfile, security
checks, tests, builds, and ARM64 deployment when relevant.

Do not use this report as permission to remove an override automatically.
