#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'ERR'
install-harness-loop.sh is deprecated.

Harness is now expected to run as a one-shot runtime tool:
  ~/.longclaw/runtime-v2/bin/harness tick
  ~/.longclaw/runtime-v2/bin/harness brief
  ~/.longclaw/runtime-v2/bin/harness doctor

If a legacy harness loop is still installed, run:
  bash scripts/guardian/uninstall-harness-loop.sh
ERR
exit 1
