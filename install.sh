#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARDIAN_SRC_DIR="$ROOT_DIR/apps/runtime/guardian"
GUARDIAN_BIN_OUT="$ROOT_DIR/apps/runtime/bin/weclaw-guardian"

MODE_ARGS=()

usage() {
  cat <<'EOF'
Usage: bash install.sh [--mixed]

Install the longclaw runtime-first package locally from this repository.

Options:
  --mixed   Render daemon plists for codex/guardian in addition to user agents.
  -h, --help  Show this help message.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --mixed)
      MODE_ARGS+=("$arg")
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

[[ -d "$GUARDIAN_SRC_DIR" ]] || {
  echo "ERROR: guardian source tree not found: $GUARDIAN_SRC_DIR" >&2
  exit 1
}

if [[ -x "${WECLAW_REAL_BUNDLE:-$ROOT_DIR/bundle/weclaw-real}" ]]; then
  echo "==> using bundled weclaw-real"
else
  echo "==> bundled weclaw-real not found; install will try local repo or existing ~/.weclaw/bin/weclaw-real"
fi

if command -v go >/dev/null 2>&1; then
  echo "==> building weclaw-guardian"
  bash "$ROOT_DIR/scripts/guardian/build-core.sh"
elif [[ -x "$GUARDIAN_BIN_OUT" ]]; then
  echo "==> reusing existing weclaw-guardian at $GUARDIAN_BIN_OUT"
else
  cat <<EOF
WARN: Go is not installed and no prebuilt guardian binary was found.
Install will continue without guardian monitor auto-start.
To enable it later, install Go and run:
  bash "$ROOT_DIR/scripts/guardian/build-core.sh"
EOF
fi

echo "==> cleaning legacy runtime residue"
bash "$ROOT_DIR/scripts/guardian/cleanup-legacy-runtime.sh"

echo "==> installing runtime services"
if ((${#MODE_ARGS[@]})); then
  bash "$ROOT_DIR/scripts/guardian/install-v2.sh" "${MODE_ARGS[@]}"
else
  bash "$ROOT_DIR/scripts/guardian/install-v2.sh"
fi

cat <<'EOF'

Install complete.
First-time setup still requires:
  ~/.weclaw/bin/weclaw login
EOF
