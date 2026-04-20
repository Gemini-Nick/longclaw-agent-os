#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js >=18 is required to bootstrap longclaw-agent-os." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to bootstrap longclaw-agent-os." >&2
  exit 1
fi

node - <<'NODE'
const [major] = process.versions.node.split('.').map(Number)
if (major < 18) {
  console.error(`Node.js ${process.versions.node} is too old. Expected >=18.`)
  process.exit(1)
}
NODE

echo "Bootstrapping Electron/renderer dependencies with npm ci..."
npm ci
echo "Bootstrap complete."
echo "Next steps:"
echo "  npm run build"
echo "  npm run electron:start"
