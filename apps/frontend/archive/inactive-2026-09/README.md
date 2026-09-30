# Inactive frontend archive — 2026-09

This archive is the source pool for the #341 frontend reconstruction.

Only the currently required Home and authentication/authorization flow remain active.
Everything else is reference-only and must not be imported by active production code.

Reactivation rule:
1. select the page/component and its relevant tests;
2. compare it with the current Figma/design authority and current product requirements;
3. migrate only the required implementation back under active source;
4. remove obsolete dependencies and hardcoding;
5. restore/update only the relevant tests;
6. require normal CI/architecture gates before considering it production-active.

Backend, deployment, database, Docker, backoffice and shared cross-application infrastructure are not part of this archive operation.
