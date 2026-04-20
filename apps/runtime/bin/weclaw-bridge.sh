#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LONGCLAW_LOG_DIR:-/tmp/longclaw-guardian}"
LOG_FILE="$LOG_DIR/weclaw-bridge.log"
WECLAW_BIN="${WECLAW_BRIDGE_BIN:-$HOME/.weclaw/bin/weclaw-real}"
WECLAW_PID_FILE="${WECLAW_PID_FILE:-$HOME/.weclaw/weclaw.pid}"
WECLAW_LOG_FILE="${WECLAW_LOG_FILE:-$HOME/.weclaw/weclaw.log}"
WECLAW_PORT="${WECLAW_PORT:-18011}"
HEALTH_SCRIPT="${WECLAW_HEALTH_SCRIPT:-$SCRIPT_DIR/weclaw-bridge-health.py}"
mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%F %T')] $*" >>"$LOG_FILE"
}

listener_pid() {
  lsof -tiTCP:"$WECLAW_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

cleanup_stale_pid() {
  if [[ ! -f "$WECLAW_PID_FILE" ]]; then
    return 0
  fi

  local pid
  pid="$(tr -d '[:space:]' <"$WECLAW_PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$WECLAW_PID_FILE"
    log "removed empty weclaw pid file"
    return 0
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  rm -f "$WECLAW_PID_FILE"
  log "removed stale weclaw pid file for pid=$pid"
}

cleanup_orphan_listener() {
  local pid cmd
  pid="$(listener_pid)"
  if [[ -z "$pid" ]]; then
    return 0
  fi

  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$cmd" != *weclaw* ]]; then
    log "port $WECLAW_PORT already in use by non-weclaw process: $cmd"
    exit 1
  fi

  log "found orphaned weclaw listener on port $WECLAW_PORT (pid=$pid), terminating before clean restart"
  kill "$pid" >/dev/null 2>&1 || true
  sleep 1
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
    sleep 1
  fi
}

prune_legacy_watchdog_files() {
  rm -f \
    "$HOME/.weclaw/session-watchdog.sh" \
    "$HOME/.weclaw/watchdog.log" \
    "$HOME/.weclaw/watchdog.launchd.out.log" \
    "$HOME/.weclaw/watchdog.launchd.err.log"
}

if [[ ! -x "$WECLAW_BIN" ]]; then
  log "weclaw bridge binary not found: $WECLAW_BIN"
  exit 1
fi

prune_legacy_watchdog_files
cleanup_stale_pid
cleanup_orphan_listener
rm -f "$WECLAW_LOG_FILE"

if command -v python3 >/dev/null 2>&1 && [[ -f "$HEALTH_SCRIPT" ]]; then
  python3 "$HEALTH_SCRIPT" probe >>"$LOG_FILE" 2>&1 || true
  python3 "$HEALTH_SCRIPT" loop >>"$LOG_FILE" 2>&1 &
  log "weclaw bridge health monitor started pid=$!"
else
  log "weclaw bridge health monitor skipped: missing python3 or $HEALTH_SCRIPT"
fi

log "weclaw bridge starting in foreground with $WECLAW_BIN start -f"
exec "$WECLAW_BIN" start -f
