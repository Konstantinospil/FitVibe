# Legacy frontend archive — 2026-09

Historical/reference-only frontend code archived under issue #342.

Rules:
- active production code must never import from this directory;
- this directory is excluded from TypeScript production compilation, ESLint, tests, coverage, visual regression, production bundles, and Architecture & Hardcoding checks;
- archived code is not considered compliant or production-ready;
- reuse follows #341: select → compare with Figma → extract → clean → test → activate.

This first slice archives legacy athlete surfaces that are outside the target production navigation:
Exercises, Feed, Insights, Logger, Planner, Profile, Progress, and Sessions.
