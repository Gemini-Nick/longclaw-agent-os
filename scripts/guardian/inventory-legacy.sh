#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$HOME/.longclaw/audit/$TS"
mkdir -p "$OUT_DIR"

log "collect launchctl labels"
if ! launchctl list >"$OUT_DIR/launchctl-list.txt" 2>"$OUT_DIR/launchctl-list.err.txt"; then
  warn "launchctl list failed, continue with gui/system print snapshots"
fi
launchctl print "gui/$(id -u)" >"$OUT_DIR/launchctl-gui-print.txt" 2>"$OUT_DIR/launchctl-gui-print.err.txt" || true
launchctl print system >"$OUT_DIR/launchctl-system-print.txt" 2>"$OUT_DIR/launchctl-system-print.err.txt" || true

log "collect relevant processes"
ps -Ao pid,ppid,user,stat,etime,command >"$OUT_DIR/processes-all.txt" 2>"$OUT_DIR/processes.err.txt" || true
rg -i 'weclaw|guardian|codex|claude|scheduler' "$OUT_DIR/processes-all.txt" >"$OUT_DIR/processes.txt" || true

log "collect launchagent files"
ls -la "$LAUNCH_AGENTS_DIR" >"$OUT_DIR/launchagents-ls.txt"
for p in "$LAUNCH_AGENTS_DIR"/com.weclaw*.plist "$LAUNCH_AGENTS_DIR"/com.longclaw*.plist "$LAUNCH_AGENTS_DIR"/com.zhangqilong*.plist; do
  [[ -f "$p" ]] || continue
  cp "$p" "$OUT_DIR/"
done

log "collect runtime scripts"
cp -R "$RUNTIME_SRC_DIR" "$OUT_DIR/runtime-src-snapshot"

log "inventory saved: $OUT_DIR"
