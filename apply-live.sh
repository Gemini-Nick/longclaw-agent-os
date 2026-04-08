#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ "$#" -gt 0 ]]; then
  npm run guardian:install -- "$@"
else
  npm run guardian:install
fi
