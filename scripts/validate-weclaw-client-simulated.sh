#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LONGCLAW_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_ROOT="$(cd "${LONGCLAW_ROOT}/.." && pwd)"
WECLAW_ROOT="${WORKSPACE_ROOT}/weclaw"
HERMES_ROOT="${WORKSPACE_ROOT}/hermes-agent"

echo "[1/3] WeClaw simulated front door"
(
  cd "${WECLAW_ROOT}"
  go test ./api ./messaging
)

echo "[2/3] Hermes canonical launch/task path"
python3 -m pytest -o addopts='' \
  "${HERMES_ROOT}/tests/agent_core/test_service.py" \
  "${HERMES_ROOT}/tests/gateway/test_api_server_agent_os.py"

echo "[3/3] Electron client simulated control plane"
(
  cd "${LONGCLAW_ROOT}"
  npm run test -- src/services/longclawControlPlane/client.test.ts
)

echo
echo "Simulated WeClaw -> client validation passed."
echo "Validated:"
echo "- controlled WeClaw ingress and explicit launch submission"
echo "- Hermes LaunchIntent -> Task / Run / Work Item canonical path"
echo "- Electron control-plane visibility for tasks, work items, and flagship pack dashboard"
