# Production Docker contract

`infra/docker/prod/compose.yml` is the single authoritative production Compose template.

The CD workflow checks out the exact successful `main` commit and installs this file as:

`/srv/stacks/fitvibe/compose.yml`

The production host therefore must not maintain an independent Compose definition.

## Required host configuration

`/srv/stacks/fitvibe/.env` supplies host-specific configuration and secrets. At minimum it must define:

- `POSTGRES_PASSWORD`
- application variables required by `.env`/the backend runtime

`INGRESS_IMAGE`, `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `BACKOFFICE_IMAGE`, `POSTGRES_IMAGE`, `CLAMAV_IMAGE`, and `REDIS_IMAGE` are injected by CD from the successful main CI image-digest artifact. The production host does not maintain these image references in `.env`.

All production images must resolve to immutable SHA-256 digest references. CD rejects mutable tags.

## Service contract

The backend waits for healthy PostgreSQL, ClamAV, and Redis services. ClamAV signatures persist in `clamav_signatures`, PostgreSQL data persists in `db_data`, and Redis uses AOF plus the persistent `redis_data` volume. Production sets `REDIS_ENABLED=true`; the backend fails startup rather than falling back to the in-memory queue if Redis is unavailable.

The browser-facing entry point is the dedicated Nginx ingress on port 80. It proxies `/api/*` to `backend:4000` and all other application traffic to `frontend:4173` on the Docker network. The backend keeps a loopback-only `127.0.0.1:4000` binding for host diagnostics; browsers must never use that port directly. Compose explicitly sets backend `PORT=4000` to prevent the host's `.env` from changing the internal service contract.

Backoffice is published on host port `8081` and proxies API and health requests to `backend:4000`. It must be restricted to trusted networks by host firewall/Tailscale policy. If the Backoffice is used from a different browser origin (`http://<tailscale-host-or-ip>:8081`), include that exact origin in both `ALLOWED_ORIGINS` and `CSRF_ALLOWED_ORIGINS` in the host's private `.env`. Never use a wildcard origin.

### Tailscale PoC auth profile

For the current HTTP-only private Tailscale stage, the production host `.env` must explicitly use host-only cookies and disable the Secure flag only as a temporary PoC exception:

```env
COOKIE_DOMAIN=
COOKIE_SECURE=false
FRONTEND_URL=http://<tailscale-host-or-ip>
APP_BASE_URL=http://<tailscale-host-or-ip>
ALLOWED_ORIGINS=http://<tailscale-host-or-ip>,http://<tailscale-host-or-ip>:8081
CSRF_ALLOWED_ORIGINS=http://<tailscale-host-or-ip>,http://<tailscale-host-or-ip>:8081
```

Do not carry `COOKIE_SECURE=false` into an Internet-facing deployment. The public HTTPS profile must set `COOKIE_SECURE=true` and retain host-only cookies.

## Validation

Run:

`bash scripts/validate-production-compose.sh`

The validator executes `docker compose config`, checks required services and dependencies, rejects self-dependencies, verifies ClamAV and Redis persistence, and rejects mutable image references.
