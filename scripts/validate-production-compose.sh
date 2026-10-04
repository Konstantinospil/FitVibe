#!/usr/bin/env bash
set -euo pipefail

compose_file="${1:-infra/docker/prod/compose.yml}"
if [[ ! -f "${compose_file}" ]]; then
  echo "Production compose file not found: ${compose_file}" >&2
  exit 1
fi

canonical_path="infra/docker/prod/compose.yml"
if [[ "${compose_file}" == "${canonical_path}" ]]; then
  mapfile -t production_compose_files < <(
    find infra/docker/prod -maxdepth 1 -type f \( -name '*compose*.yml' -o -name '*compose*.yaml' \) | sort
  )
  if [[ "${#production_compose_files[@]}" -ne 1 || "${production_compose_files[0]}" != "${canonical_path}" ]]; then
    echo "Expected exactly one canonical production Compose file: ${canonical_path}" >&2
    printf 'Found: %s\n' "${production_compose_files[@]}" >&2
    exit 1
  fi

  if ! grep -F 'canonical_compose="${PROD_SOURCE_DIR}/infra/docker/prod/compose.yml"' .github/workflows/cd.yml >/dev/null; then
    echo "CD must install the canonical production Compose template from the deployed commit." >&2
    exit 1
  fi
fi

dummy_digest="$(printf 'a%.0s' {1..64})"
export BACKEND_IMAGE="ghcr.io/example/fitvibe-backend@sha256:${dummy_digest}"
export FRONTEND_IMAGE="ghcr.io/example/fitvibe-frontend@sha256:${dummy_digest}"
export POSTGRES_IMAGE="postgres@sha256:${dummy_digest}"
export CLAMAV_IMAGE="clamav/clamav@sha256:${dummy_digest}"
export REDIS_IMAGE="redis@sha256:${dummy_digest}"
export POSTGRES_PASSWORD="contract-validation"
export FITVIBE_ENV_FILE="/dev/null"

docker compose -f "${compose_file}" config --quiet

resolved_images="$(docker compose -f "${compose_file}" config --images)"
while IFS= read -r image; do
  [[ -z "${image}" ]] && continue
  if ! printf '%s\n' "${image}" | grep -Eq '@sha256:[0-9a-fA-F]{64}$'; then
    echo "Mutable production image reference: ${image}" >&2
    exit 1
  fi
done <<< "${resolved_images}"

resolved_config="$(docker compose -f "${compose_file}" config --format json)"
python3 - "${resolved_config}" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
services = data.get("services", {})
required = {"backend", "frontend", "db", "clamav", "redis"}
missing = sorted(required - set(services))
if missing:
    raise SystemExit(f"Missing production services: {', '.join(missing)}")

for name, service in services.items():
    depends = service.get("depends_on") or {}
    if name in depends:
        raise SystemExit(f"Service {name} must not depend on itself")

backend_depends = services["backend"].get("depends_on") or {}
for dependency in ("db", "clamav", "redis"):
    if dependency not in backend_depends:
        raise SystemExit(f"backend must depend on {dependency}")

frontend_ports = services["frontend"].get("ports") or []
if not any(
    isinstance(port, dict)
    and int(port.get("target", 0)) == 4173
    and str(port.get("published", "")) == "80"
    for port in frontend_ports
):
    raise SystemExit("frontend must publish host port 80 to SSR container port 4173")

clamav_volumes = services["clamav"].get("volumes") or []
if not any(
    (v.get("source") if isinstance(v, dict) else str(v).split(":", 1)[0]) == "clamav_signatures"
    for v in clamav_volumes
):
    raise SystemExit("clamav must persist signatures in clamav_signatures")

redis_volumes = services["redis"].get("volumes") or []
if not any(
    (v.get("source") if isinstance(v, dict) else str(v).split(":", 1)[0]) == "redis_data"
    for v in redis_volumes
):
    raise SystemExit("redis must persist data in redis_data")

print("Production Compose contract is valid.")
PY
