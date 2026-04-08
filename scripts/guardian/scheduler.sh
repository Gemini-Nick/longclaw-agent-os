#!/usr/bin/env bash
set -euo pipefail

# Legacy compatibility wrapper. Real scheduler logic moved to runtime service script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
exec "$REPO_ROOT/apps/runtime/bin/repo-scheduler-service.sh" "$@"
