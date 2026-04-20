#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_DIR="$HOME/.longclaw/legacy-archive/$TS"
mkdir -p "$ARCHIVE_DIR/LaunchAgents" "$ARCHIVE_DIR/weclaw-bin"

log "stopping legacy labels"
for label in "${LEGACY_LABELS[@]}"; do
  launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
  launchctl bootout "system/$label" >/dev/null 2>&1 || true
done

log "archiving legacy launchagent files"
for p in "$LAUNCH_AGENTS_DIR"/com.weclaw*.plist "$LAUNCH_AGENTS_DIR"/com.longclaw*.plist "$LAUNCH_AGENTS_DIR"/com.zhangqilong.ai.harness.loop.plist; do
  [[ -f "$p" ]] || continue
  mv "$p" "$ARCHIVE_DIR/LaunchAgents/"
done

log "killing leftover legacy processes"
pkill -f '/\.weclaw/bin/weclaw start -f' >/dev/null 2>&1 || true
pkill -f '/\.weclaw/session-watchdog\.sh' >/dev/null 2>&1 || true
pkill -f '/apps/runtime/guardian-daemon\.sh' >/dev/null 2>&1 || true

if [[ -f "$WECLAW_BIN_DIR/weclaw" ]]; then
  cp "$WECLAW_BIN_DIR/weclaw" "$ARCHIVE_DIR/weclaw-bin/weclaw.before-retire"
fi

log "legacy retired. archive: $ARCHIVE_DIR"
