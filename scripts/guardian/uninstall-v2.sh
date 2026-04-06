#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

for label in "${NEW_LABELS[@]}"; do
  bootout_gui_label "$label"
  bootout_system_label "$label"
  rm -f "$LAUNCH_AGENTS_DIR/$label.plist"
done

rm -f \
  "$RUNTIME_INSTALL_DIR/bin/weclaw" \
  "$RUNTIME_INSTALL_DIR/bin/weclaw-bridge.sh" \
  "$RUNTIME_INSTALL_DIR/bin/repo-scheduler-service.sh" \
  "$RUNTIME_INSTALL_DIR/bin/guardian-monitor.sh" \
  "$RUNTIME_INSTALL_DIR/bin/codex-appserver.sh" \
  "$RUNTIME_INSTALL_DIR/bin/claude-worker.sh" \
  "$RUNTIME_INSTALL_DIR/bin/weguard" \
  "$RUNTIME_INSTALL_DIR/bin/weclaw-guardian"

rm -f \
  "$WECLAW_BIN_DIR/weclaw" \
  "$WECLAW_BIN_DIR/weguard" \
  "$WECLAW_BIN_DIR/weclaw-guardian"

rm -f \
  "$RUNTIME_INSTALL_DIR/launchd/com.zhangqilong.ai.codex.appserver.plist" \
  "$RUNTIME_INSTALL_DIR/launchd/com.zhangqilong.ai.guardian.monitor.plist"

echo "runtime services removed; weclaw credentials and weclaw-real preserved"
