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
export INGRESS_IMAGE="ghcr.io/example/fitvibe-ingress@sha256:${dummy_digest}"
export BACKEND_IMAGE="ghcr.io/example/fitvibe-backend@sha256:${dummy_digest}"
export FRONTEND_IMAGE="ghcr.io/example/fitvibe-frontend@sha256:${dummy_digest}"
export BACKOFFICE_IMAGE="ghcr.io/example/fitvibe-backoffice@sha256:${dummy_digest}"
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
python3 - "${resolved_config}" "${compose_file}" <<'PY'
import json, re, sys
from pathlib import Path
data = json.loads(sys.argv[1])
services = data.get("services", {})
required = {"ingress", "backend", "frontend", "backoffice", "db", "clamav", "redis"}
missing = sorted(required - set(services))
if missing:
    raise SystemExit(f"Missing production services: {', '.join(missing)}")

for name, service in services.items():
    depends = service.get("depends_on") or {}
    if name in depends:
        raise SystemExit(f"Service {name} must not depend on itself")

backend_env = services["backend"].get("environment") or {}
if str(backend_env.get("PORT")) != "4000":
    raise SystemExit("production backend must listen on container port 4000")

backend_ports = services["backend"].get("ports") or []
if not any(
    isinstance(port, dict)
    and int(port.get("target", 0)) == 4000
    and str(port.get("published", "")) == "4000"
    and port.get("host_ip") == "127.0.0.1"
    for port in backend_ports
):
    raise SystemExit("backend must bind 127.0.0.1:4000 to container port 4000")

backend_volumes = services["backend"].get("volumes") or []
if not any(
    isinstance(v, dict)
    and v.get("type") == "bind"
    and v.get("source") == "/srv/stacks/fitvibe/keys"
    and v.get("target") == "/app/keys"
    and v.get("read_only") is True
    for v in backend_volumes
):
    raise SystemExit("backend must mount persistent JWT signing keys read-only")

# Some Compose versions drop explicit false-valued bind options from their
# normalized JSON model. Validate create_host_path in the authored config,
# while retaining the normalized runtime checks for the mount itself.
source_text = Path(sys.argv[2]).read_text()
backend_source = re.search(
    r"(?ms)^  backend:\\n(.*?)(?=^  [A-Za-z][A-Za-z0-9_-]*:\\n|\\Z)", source_text
)
if not backend_source:
    raise SystemExit("production Compose must define a backend service")

bind_mounts = re.findall(
    r"(?m)^      - type: bind\\s*\\n((?:^        .*\\n)+)", backend_source.group(1)
)
if not any(
    all(re.search(r"(?m)^\\s*" + re.escape(key) + r":\\s*" + re.escape(value) + r"\\s*$", mount)
        for key, value in (
            ("source", "/srv/stacks/fitvibe/keys"),
            ("target", "/app/keys"),
            ("read_only", "true"),
            ("create_host_path", "false"),
        ))
    for mount in bind_mounts
):
    raise SystemExit("backend JWT bind mount must explicitly prevent host-directory creation")

backend_depends = services["backend"].get("depends_on") or {}
for dependency in ("db", "clamav", "redis"):
    if dependency not in backend_depends:
        raise SystemExit(f"backend must depend on {dependency}")

ingress_ports = services["ingress"].get("ports") or []
if not any(
    isinstance(port, dict)
    and int(port.get("target", 0)) == 80
    and str(port.get("published", "")) == "80"
    for port in ingress_ports
):
    raise SystemExit("ingress must publish host port 80")

ingress_depends = services["ingress"].get("depends_on") or {}
for dependency in ("backend", "frontend"):
    if dependency not in ingress_depends:
        raise SystemExit(f"ingress must depend on {dependency}")

frontend_ports = services["frontend"].get("ports") or []
if frontend_ports:
    raise SystemExit("frontend SSR must not publish a host port; traffic must pass through ingress")

backoffice_ports = services["backoffice"].get("ports") or []
if not any(
    isinstance(port, dict)
    and int(port.get("target", 0)) == 8080
    and str(port.get("published", "")) == "8081"
    for port in backoffice_ports
):
    raise SystemExit("backoffice must publish host port 8081 to container port 8080")

backoffice_env = services["backoffice"].get("environment") or {}
backoffice_depends = services["backoffice"].get("depends_on") or {}
if "backend" not in backoffice_depends:
    raise SystemExit("backoffice must depend on backend")

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
