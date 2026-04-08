#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="$ROOT_DIR/harness/launchd/com.zhangqilong.ai.harness.loop.agent.plist.tmpl"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_OUT="$LAUNCH_AGENTS_DIR/com.zhangqilong.ai.harness.loop.plist"
STATE_DIR="$ROOT_DIR/harness/state"
STDOUT_LOG="$STATE_DIR/loop.launchd.out.log"
STDERR_LOG="$STATE_DIR/loop.launchd.err.log"
LABEL="com.zhangqilong.ai.harness.loop"
HARNESS_BIN="$ROOT_DIR/harness/bin/harness"
NODE_BIN="$(command -v node)"

[[ -x "$NODE_BIN" ]] || {
  echo "ERROR: node not found in PATH" >&2
  exit 1
}

mkdir -p "$LAUNCH_AGENTS_DIR" "$STATE_DIR"

sed \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__HARNESS_BIN__|$HARNESS_BIN|g" \
  -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
  -e "s|__STDOUT_LOG__|$STDOUT_LOG|g" \
  -e "s|__STDERR_LOG__|$STDERR_LOG|g" \
  -e "s|__PATH__|$PATH|g" \
  -e "s|__HOME__|$HOME|g" \
  "$TEMPLATE" >"$PLIST_OUT"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_OUT"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed harness loop launch agent:"
echo "  label: $LABEL"
echo "  plist: $PLIST_OUT"
echo "  stdout: $STDOUT_LOG"
echo "  stderr: $STDERR_LOG"
