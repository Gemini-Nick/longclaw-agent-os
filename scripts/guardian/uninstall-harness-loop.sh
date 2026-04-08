#!/usr/bin/env bash
set -euo pipefail

LABEL="com.zhangqilong.ai.harness.loop"
PLIST_OUT="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_OUT"

echo "Uninstalled harness loop launch agent:"
echo "  label: $LABEL"
