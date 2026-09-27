# Infrastructure

The `infra` workspace defines how FitVibe is deployed, observed, and secured across environments. Assets are environment-agnostic so they can be reused locally, in staging, or in production.

## Contents

| Path                           | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| `docker/`                      | Docker Compose stacks and service Dockerfiles                 |
| `docker/dev/compose.dev.yml`   | Local developer stack (backend, frontend, postgres, nginx)    |
| `docker/prod/compose.yml`      | Canonical production stack contract                                     |
| `nginx/`                       | Base NGINX configuration and site definitions                 |
| `observability/`               | Prometheus scrape configs and Grafana dashboards              |
| `scripts/`                     | Helper shell scripts for migrating, seeding, and rollbacks    |
| `security/policies/`           | Operational policies (password rotation, key management, ...) |

## Local Stack

```bash
docker compose -f infra/docker/dev/compose.dev.yml up --build
```

This spins up Postgres, the backend, the frontend, and NGINX configured with the files under `infra/nginx/`.

## CI/CD

GitHub Actions workflows (`.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `.github/workflows/security-scan.yml`) call into these assets. Production CD installs `infra/docker/prod/compose.yml` from the exact deployed commit into `/srv/stacks/fitvibe/compose.yml`; the host does not maintain an independent production Compose definition.

## Observability

- Prometheus scrape configuration lives in `observability/prometheus.yml`.
- Grafana dashboards (JSON) sit under `observability/grafana/dashboards/`.
  Import them into Grafana or configure your provisioning pipeline to load them automatically.

## Security Policies

Policies under `security/policies/` are markdown documents reviewed with the security team. Update them whenever security posture changes and reference them from `docs/` where relevant.
