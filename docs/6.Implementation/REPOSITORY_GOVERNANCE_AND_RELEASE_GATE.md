# Repository Governance and Release Gate

**Phase:** 22  
**Issue:** #269

## Branch policy

`main` is the release branch. A production release is valid only when the exact `main` commit:

1. is associated with a merged pull request targeting `main`;
2. passes the full mandatory CI workflow;
3. produces signed immutable image digests;
4. is selected by the CD workflow from a successful `main` CI run.

The CI `Release Governance` job fails a `main` push that is not associated with a merged pull request. The CD workflow only accepts successful `main` CI runs, so a failed governance/quality run cannot produce a production deployment.

`dev` is intentionally a working integration branch. It is not treated as a release branch and does not require merged-PR provenance. Pull requests into `dev` still run the complete CI quality gates.

## GitHub repository settings

At the time of Phase 22 implementation, the repository exposes no GitHub rulesets through the API. The connected GitHub App does not have repository-administration permission to create or inspect branch-protection rules.

The workflow-level release gate is therefore the enforceable repository control available in code:

- direct pushes to `main` cannot obtain a successful release CI result without merged-PR provenance;
- image build/publication depends on Release Governance and all mandatory QA/deployment gates;
- production CD accepts only successful `main` CI artifacts.

If repository-administration access is later available, add a GitHub ruleset for `main` that requires pull requests and the mandatory CI checks. That server-side rule is defense in depth; it must not replace the workflow-level release gate.

## Mandatory CI contract

The release path retains lint/typecheck, backend/frontend/database tests, coverage, backend integration, API/OpenAPI contract validation, security, accessibility, Lighthouse, visual regression, performance, metrics/i18n checks, the production deployment contract, and release-governance provenance.

The QA Summary depends on all mandatory gates. Production image builds depend on the same gates and therefore cannot run when one of them fails.

## Deployment contract

`infra/docker/prod/compose.yml` is the only production Compose template. `scripts/validate-production-compose.sh` verifies that:

- no duplicate production Compose template exists;
- CD installs that exact file from the deployed commit;
- the Compose model resolves successfully;
- required services/dependencies and persistence volumes exist;
- no service depends on itself;
- every production image is pinned by a full SHA-256 digest.

CD repeats immutable-image validation on the production host before pulling or starting services.
