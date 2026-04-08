#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

if ! command -v go >/dev/null 2>&1; then
  err "Go not found. Install Go first (e.g. 'brew install go')."
fi

log "building weclaw-guardian"
mkdir -p "$RUNTIME_SRC_DIR/bin"
(
  cd "$RUNTIME_SRC_DIR/guardian"
  go build -o "$RUNTIME_SRC_DIR/bin/weclaw-guardian" ./cmd/weclaw-guardian
)
chmod +x "$RUNTIME_SRC_DIR/bin/weclaw-guardian"
ad_hoc_sign_binary "$RUNTIME_SRC_DIR/bin/weclaw-guardian"

log "syncing binary to $WECLAW_BIN_DIR"
cp "$RUNTIME_SRC_DIR/bin/weclaw-guardian" "$WECLAW_BIN_DIR/weclaw-guardian"
chmod +x "$WECLAW_BIN_DIR/weclaw-guardian"
ad_hoc_sign_binary "$WECLAW_BIN_DIR/weclaw-guardian"

log "build done"
