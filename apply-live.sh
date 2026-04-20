#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "longclaw-agent-os live apply: this syncs runtime state only; it does not bootstrap repo node_modules." >&2
echo "For Electron/renderer development, run: bash ./bootstrap-dev.sh" >&2

if [[ "$#" -gt 0 ]]; then
  npm run guardian:install -- "$@"
else
  npm run guardian:install
fi
