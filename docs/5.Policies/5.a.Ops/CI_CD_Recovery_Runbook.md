# FitVibe deployment recovery and release verification

## Release invariants

- Only a successful `main` CI run at current `main` HEAD may deploy.
- The image digest manifest must originate from that run, and images must have verified cosign signatures.
- Version tags are immutable. An interrupted publication can be resumed only if existing tags resolve to the same digests.
- A GitHub Release must not be published until full container verification succeeds.

## Pre-deployment checkpoint

CD creates `${PROD_STACK_DIR}/deploy-recovery/<UTC>-<commit>/` with restrictive permissions. It retains the previous Compose template, source SHA, and immutable image references read from running Docker containers. It intentionally does **not** copy `.env`, private keys, or database data.

If an existing Compose installation has only some services running, the deployment stops because it cannot guarantee a complete rollback. First deployments may have no prior images.

## Recovery behavior

1. If `docker compose up` fails before any database migration starts, CD attempts to restore the saved Compose file and image digests. The pipeline still fails even if restoration succeeds.
2. When migration execution starts, automatic image rollback is prohibited because previous images may not support the new database schema.
3. Any failure after that boundary requires operator review of schema compatibility, database backup availability, and the recovery checkpoint. A Docker image rollback is not a database rollback.

## Manual recovery (operator-controlled)

1. Stop further releases and investigate the failed CD run and `docker compose ps/logs` on the host.
2. Locate the checkpoint identified in the deployment log or `${PROD_STACK_DIR}/deploy-recovery/latest-recovery-path`.
3. Determine whether migrations started. If they did, consult the database backup/restore procedure and confirm application-schema compatibility **before** restoring prior images.
4. Confirm that all image references in `previous-images.env` are digest-pinned and refer to the expected registry and components.
5. Restore the previous Compose file and load the manifest in the deployment shell. Keep the existing `.env` and key material untouched.
6. Run `docker compose --env-file .env -f compose.yml config --quiet` before applying the restored deployment, then verify health, authentication and data integrity.

**This workflow does not create a database backup.** A verified backup and restore procedure is a prerequisite for safely reversing data or schema migrations.

## Required GitHub settings (manual verification)

An active ruleset protects `dev`. The connected GitHub integration cannot update or confirm classic branch protection on `feature` or `main`. An administrator should require pull requests and `QA Summary` (plus appropriate other checks) on each protected branch, prohibit direct pushes, and verify that administrators cannot bypass the intended policy.

## Negative validation

`node --test tests/qa/ci-cd-contract.test.cjs` asserts that manual CD input is treated as data, branch audit cannot delete refs, publication requires verified images, and rollback stops at the database mutation boundary. Additional runtime recovery drills are necessary before claiming recovery is proven.