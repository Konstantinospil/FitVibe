# ADR-028: Pin Application Runtime to Node.js 24 LTS

**Date:** 2026-09-03  
**Status:** Accepted  
**Author:** FitVibe Architecture  
**Cross-References:** ADR-014 (stack), ADR-018 (CI/CD), ADR-021 (Jest 30 deferred), TDD §0–§3, QA CI `NODE_VERSION`

---

## Context

FitVibe previously ran on **Node.js 20 LTS** in CI (`NODE_VERSION`), Docker (`node:20-alpine`), and local docs. Node 20 reached end-of-life in **April 2026**. Node 24 (`Krypton`) is the current LTS line.

GitHub Actions JS **action runtimes** already target Node 24 (ADR-018). That is independent of the **application** Node version used to install, test, build, and run FitVibe. This ADR pins the application runtime.

---

## Decision

1. **Runtime:** Node.js **24 LTS** for local development, CI, and container images.
2. **Pins:**
   - CI: `NODE_VERSION: "24"` (and explicit `node-version: "24"` where env is not used)
   - Docker: `node:24-alpine` for backend and frontend builder/runtime stages
   - Engines: root `package.json` `"node": ">=24"`
   - Tooling: `.nvmrc` contains `24`
   - Types: `@types/node` `^24` at the workspace root and in `apps/backend`, `apps/frontend`, and `apps/backoffice`
3. **Out of scope:** `packages/patched-extract-zip` keeps its upstream `engines` field (package removed in November 2026 once nothing depended on `extract-zip`; see `docs/dependency-override-second-pass.md`). Backend tests stay on **Jest 29 + ts-jest** (ADR-021 remains Deferred).
4. **Native addons:** `sharp` `>=0.35` continues to supply musl prebuilds for Alpine; do not add a compile toolchain unless a prebuild is missing.

---

## Consequences

**Positive**

- Supported LTS through April 2028; security patches continue after Node 20 EOL.
- CI, Docker, engines, and docs describe the same runtime.

**Negative / Trade-offs**

- Jest 29 does not formally list Node 24 in `engines`; keep ADR-021 Deferred unless transform failures appear.
- Contributors must install Node 24 locally (`nvm use` / `.nvmrc`).

**Operational**

- Bump `NODE_VERSION`, Docker tags, `@types/node` major, and this ADR together on the next LTS move.
- Action majors (`checkout@v6`, `setup-node@v6`, …) remain the Node 24 **action** runtime; do not conflate them with `NODE_VERSION`.

---

## Alternatives Considered

| Option                                | Description                         | Reason Rejected                                                       |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Stay on Node 20                       | Keep `NODE_VERSION: "20"`           | EOL; no security updates                                              |
| Jump to Node 22 only                  | 22 is still in Maintenance          | 24 is the current LTS; 22 does not reset the next-upgrade clock       |
| Upgrade Jest to 30 in the same change | Unblocks official Node 24 `engines` | ADR-021 is Deferred; transform risk is separate from the runtime bump |

---

## Status Log

| Version | Date       | Change                                            | Author               |
| ------- | ---------- | ------------------------------------------------- | -------------------- |
| v1.0    | 2026-09-03 | Pin app runtime, images, and types to Node 24 LTS | FitVibe Architecture |
