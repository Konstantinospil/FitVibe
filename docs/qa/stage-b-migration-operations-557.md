# #557 Stage B — password-hash migration and operational acceptance

**Status:** Implementation guide; **not evidence** of production deployment, backup restoration, or hardware benchmarks.
**Branch:** `fix/557-deterministic-onboarding-fixtures`.

## Invariants

- Keep new-password validation centralized, with minimum 12 characters for members and 16 for administrators; no mandatory character classes.
- Reject locally common whole passwords, and preserve successful password writes with explicit warnings for HIBP matches and provider outages.
- Recheck current password and role minimum under the locked user row in an authenticated change transaction. Reset/change must not consume tokens or revoke sessions on a rejected reuse.
- Use Argon2id for new/changed passwords (64 MiB, 3 passes, 1 lane, unique salt). Continue dual-format bcrypt/Argon2id verification for previously stored passwords.
- Historical passwords from before the `user_password_history` migration cannot be reconstructed. Reuse prevention applies to the current password plus the recorded five prior hashes going forward.

## Before deploying

1. Verify full required CI on the exact release SHA, including Backend Integration, migration/database tests, all four E2E shards, axe, VRT and security checks.
2. Inventory all password-writing consumers, administrator roles and external integrations. Ensure all readers of authentication credentials use dual-format verification **before** new Argon2id hashes are written.
3. Make a restorable PostgreSQL backup including `users`, `user_password_history`, related authentication tables and the schema migration ledger. Do **not** log or copy user passwords; store backups using normal secret/data access controls.
4. Test restore into an isolated database and verify both old bcrypt login and new Argon2id login after applying migrations, including reset and password-history enforcement. Confirm that a failed or interrupted migration leaves the previous environment restorable.

### Example backup/restore validation

Use the deployment's own injected `DATABASE_URL` instead of placing a secret in shell history:

```bash
# On a host with PostgreSQL client tools and a securely injected DATABASE_URL:
pg_dump --format=custom --no-owner --file=fitvibe-pre-stage-b.dump "$DATABASE_URL"

# Restore only to a dedicated disposable test database, never over production:
pg_restore --no-owner --clean --if-exists \
  --dbname="$RESTORE_TEST_DATABASE_URL" fitvibe-pre-stage-b.dump
```

Do not declare migration acceptance before the restored application passes authentication smoke tests.

## Hardware verification

Run the repository's benchmark using Node 24.7+ and installed repository dependencies on **both** the Raspberry Pi (arm64) and intended amd64 deployment host:

```bash
node --version
uname -m
node scripts/benchmarks/argon2id-stage-b.mjs
```

Record source revision, Node version, CPU architecture, RAM, serial median hash time, parallel two-hash time and resident memory. The script uses throwaway random test secrets; it does not touch the application database. For real peak memory under concurrent load, also collect OS or container RSS/cgroup metrics, since the script's RSS is a sampled estimate.

Choose operating limits from observed memory, latency and login throughput on actual deployment hardware; do not infer Pi runtime from a cross-compiled image.

## Existing administrators and legacy credentials

A bcrypt hash **cannot reveal the original password length**, so one cannot determine which legacy administrators previously used passwords shorter than 16 characters by querying stored hashes. Do not attempt to reverse or reconstruct passwords. A safe transition must establish an authenticated, MFA-protected administrator password-change workflow and document when existing and newly promoted administrators must rotate into a >=16-character credential. New administrator credentials are already enforced at password-write time.

Before declaring full Stage B acceptance, agree on the enforced deadline and server-side access boundary for users who have not yet completed the transition. Avoid a circular guard where changing a password requires privileged access that itself demands the changed password. Treat this as an unresolved migration decision, not a silently approved exception.

## Rollback safety

**Do not roll back to code that verifies only bcrypt** after Argon2id credentials have been issued. Old software cannot authenticate these users, and Argon2id hashes cannot be converted back to bcrypt without the original secret. The valid paths are (a) roll back only to a previously verified dual-format-capable release, or (b) restore a complete compatible database backup with a matching software revision according to the service recovery plan, with appropriate data-loss assessment. Never silently delete the password-history table during a rolling rollback.

## Evidence to attach to #557

- Passing CI URLs for the exact fix-branch commit and later merged `feature` commit.
- Raspberry Pi and amd64 benchmark JSON, including memory/concurrency observations.
- Isolated restore and rollback drill record, including source/target software versions.
- Decision and test for legacy/promoted administrators with old credentials.
- Credential-write UI warning screenshots in supported languages, if applicable.

This guide is not a statement that these checks have already been performed.
