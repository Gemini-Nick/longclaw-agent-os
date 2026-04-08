#!/usr/bin/env bash
set -euo pipefail

# Legacy compatibility wrapper. Real monitoring is now handled by weclaw-guardian.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/bin/guardian-monitor.sh" "$@"
