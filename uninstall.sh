#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: bash uninstall.sh

Remove runtime launch agents, wrappers, and installed runtime files while
preserving weclaw credentials and weclaw-real.
EOF
}

case "${1:-}" in
  "")
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown argument: $1" >&2
    usage >&2
    exit 1
    ;;
esac

bash "$ROOT_DIR/scripts/guardian/uninstall-v2.sh"
