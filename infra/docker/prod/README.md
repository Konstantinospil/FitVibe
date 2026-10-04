# Production Docker contract

`infra/docker/prod/compose.yml` is the single authoritative production Compose template.

The CD workflow checks out the exact successful `main` commit and installs this file as:

`/srv/stacks/fitvibe/compose.yml`

The production host therefore must not maintain an independent Compose definition.

## Required host configuration

`/srv/stacks/fitvibe/.env` supplies host-specific configuration and secrets. At minimum it must define:

- `POSTGRES_PASSWORD`
- application variables required by `.env`/the backend runtime

`BACKEND_IMAGE`, `FRONTEND_IMAGE`, `BACKOFFICE_IMAGE`, `POSTGRES_IMAGE`, `CLAMAV_IMAGE`, and `REDIS_IMAGE` are injected by CD from the successful main CI image-digest artifact. The production host does not maintain these image references in `.env`.

All production images must resolve to immutable SHA-256 digest references. CD rejects mutable tags.

## Service contract

The backend waits for healthy PostgreSQL, ClamAV, and Redis services. ClamAV signatures persist in `clamav_signatures`, PostgreSQL data persists in `db_data`, and Redis uses AOF plus the persistent `redis_data` volume. Production sets `REDIS_ENABLED=true`; the backend fails startup rather than falling back to the in-memory queue if Redis is unavailable.

The backend is bound to `127.0.0.1:4000`; external access should pass through the intended reverse-proxy/frontend path rather than exposing the API directly.

## Validation

Run:

`bash scripts/validate-production-compose.sh`

The validator executes `docker compose config`, checks required services and dependencies, rejects self-dependencies, verifies ClamAV and Redis persistence, and rejects mutable image references.
