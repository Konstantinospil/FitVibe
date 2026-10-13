#!/usr/bin/env bash
# Runs inside mcr.microsoft.com/playwright:v1.64.0-jammy (invoked by update-linux-baselines.mjs).
set -euo pipefail

mkdir -p /tmp/run/tests/frontend
cp -a /work/tests/frontend/visual /tmp/run/tests/frontend/visual
cd /tmp/run
printf '%s\n' '{"type":"module","devDependencies":{"@playwright/test":"1.64.0"}}' > package.json
npm install --silent
npx playwright test --config tests/frontend/visual/config/playwright.config.ts \
  ${UPDATE_SNAPSHOTS:+--update-snapshots="$UPDATE_SNAPSHOTS"} "$@"
if [ "${UPDATE_SNAPSHOTS:-}" != "none" ]; then
  python3 - <<'PY'
from pathlib import Path
import shutil
root = Path("tests/frontend/visual")
for src in root.rglob("*-linux.png"):
    dest = Path("/work") / src
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"copied {src}")
PY
fi
