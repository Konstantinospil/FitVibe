#!/usr/bin/env bash
# Isolated Linux Playwright runner for the repository visual suite.
set -euo pipefail

mkdir -p /tmp/run/tests/frontend /tmp/run/tests/qa /tmp/run/design
cp -a /work/tests/frontend/visual /tmp/run/tests/frontend/visual
cp /work/tests/qa/assert-computed-typography.cjs /tmp/run/tests/qa/
cp /work/design/typography.schema.json /tmp/run/design/
cd /tmp/run
printf '%s\n' '{"type":"module","devDependencies":{"@playwright/test":"1.64.1"}}' > package.json
npm install --silent --no-audit --no-fund
npx playwright test --config tests/frontend/visual/config/playwright.config.ts \
  --update-snapshots="${UPDATE_SNAPSHOTS:-none}" "$@"

if [ "${UPDATE_SNAPSHOTS:-none}" != "none" ]; then
  python3 - <<'PY'
from pathlib import Path
import shutil
root = Path("tests/frontend/visual")
for src in root.rglob("*-linux.png"):
    dest = Path("/work") / src
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
PY
fi
