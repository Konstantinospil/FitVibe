# Production Docker contract

`infra/docker/prod/compose.yml` is the single authoritative production Compose template.

The CD workflow checks out the exact successful `main` commit and installs this file as:

`/srv/stacks/fitvibe/compose.yml`

The production host therefore must not maintain an independent Compose definition.

## Required host configuration

`/srv/stacks/fitvibe/.env` supplies host-specific configuration and secrets. At minimum it must define:

- `POSTGRES_PASSWORD`
- `POSTGRES_IMAGE` as a full `@sha256:<64-hex>` digest reference
- `CLAMAV_IMAGE` as a full `@sha256:<64-hex>` digest reference
- application variables required by `.env`/the backend runtime

`BACKEND_IMAGE` and `FRONTEND_IMAGE` are injected by CD from the signed CI image-digest artifact and are not stored as mutable tags.

All production images must resolve to immutable SHA-256 digest references. CD rejects mutable tags.

## Service contract

The backend waits for healthy PostgreSQL and ClamAV services. ClamAV signatures persist in the named `clamav_signatures` volume, and PostgreSQL data persists in `db_data`.

The backend is bound to `127.0.0.1:4000`; external access should pass through the intended reverse-proxy/frontend path rather than exposing the API directly.

## Validation

Run:

`bash scripts/validate-production-compose.sh`

The validator executes `docker compose config`, checks required services and dependencies, rejects self-dependencies, verifies ClamAV signature persistence, and rejects mutable image references.
