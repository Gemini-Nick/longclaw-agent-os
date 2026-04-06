#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

OUT_BIN="${1:-$RUNTIME_SRC_DIR/bin/weclaw-guardian}"
SRC_DIR="$ROOT_DIR/apps/runtime/guardian"

command -v go >/dev/null 2>&1 || err "Go is required to build weclaw-guardian"
[[ -d "$SRC_DIR" ]] || err "guardian source tree not found: $SRC_DIR"

mkdir -p "$(dirname "$OUT_BIN")"

log "building weclaw-guardian"
(
  cd "$SRC_DIR"
  go build -o "$OUT_BIN" ./cmd/weclaw-guardian
)

chmod +x "$OUT_BIN"
ad_hoc_sign_binary "$OUT_BIN"
log "built guardian binary at $OUT_BIN"
