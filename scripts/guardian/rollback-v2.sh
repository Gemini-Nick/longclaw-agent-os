#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

log "stopping v2 labels"
for label in "${NEW_LABELS[@]}"; do
  launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
  launchctl bootout "system/$label" >/dev/null 2>&1 || true
done

latest_backup="$(ls -1t "$WECLAW_BIN_DIR"/weclaw.legacy.* 2>/dev/null | head -n 1 || true)"
if [[ -n "$latest_backup" ]]; then
  log "restoring legacy weclaw from $latest_backup"
  cp "$latest_backup" "$WECLAW_BIN_DIR/weclaw"
  chmod +x "$WECLAW_BIN_DIR/weclaw"
else
  warn "no legacy weclaw backup found"
fi

log "if needed, restore archived launchagents from ~/.longclaw/legacy-archive/<timestamp>/LaunchAgents"
