#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_APPS="${LONGCLAW_DESKTOP_OBSERVER_TARGET_APPS:-同花顺,Electron}"
SESSION_SECONDS="${LONGCLAW_DESKTOP_OBSERVER_SESSION_SECONDS:-300}"
INTERVAL_SECONDS="${LONGCLAW_DESKTOP_OBSERVER_INTERVAL_SECONDS:-30}"
IDLE_SLEEP_SECONDS="${LONGCLAW_DESKTOP_OBSERVER_IDLE_SLEEP_SECONDS:-10}"
MAX_SNAPSHOTS="${LONGCLAW_DESKTOP_OBSERVER_MAX_SNAPSHOTS:-120}"
LOOP_COUNT="${LONGCLAW_DESKTOP_OBSERVER_LOOP_COUNT:-0}"
LOG_DIR="${ROOT_DIR}/reports/desktop-observations"
SUPERVISOR_LOG="${LOG_DIR}/supervisor.log"

mkdir -p "${LOG_DIR}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${SUPERVISOR_LOG}" >&2
}

probe_app() {
  local app="$1"
  swift "${ROOT_DIR}/scripts/desktop_click_observer.swift" --target-app "${app}" --probe >/dev/null 2>&1
}

run_session() {
  local app="$1"
  local scenario="auto-$(echo "${app}" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-')"
  log "start app=${app} scenario=${scenario} duration=${SESSION_SECONDS}s interval=${INTERVAL_SECONDS}s max_snapshots=${MAX_SNAPSHOTS}"
  set +e
  local output
  output="$(swift "${ROOT_DIR}/scripts/desktop_click_observer.swift" \
    --target-app "${app}" \
    --scenario "${scenario}" \
    --duration "${SESSION_SECONDS}" \
    --interval "${INTERVAL_SECONDS}" \
    --require-clicks 0 \
    --max-snapshots "${MAX_SNAPSHOTS}" 2>&1)"
  local status=$?
  set -e
  printf '%s\n' "${output}" | tee -a "${SUPERVISOR_LOG}" >&2
  log "finish app=${app} status=${status}"
}

iteration=0
log "supervisor_start target_apps=${TARGET_APPS} loop_count=${LOOP_COUNT}"

while true; do
  iteration=$((iteration + 1))
  IFS=',' read -r -a apps <<< "${TARGET_APPS}"
  matched=0
  for app in "${apps[@]}"; do
    app="$(echo "${app}" | sed 's/^ *//;s/ *$//')"
    [[ -z "${app}" ]] && continue
    if probe_app "${app}"; then
      matched=1
      run_session "${app}"
    fi
  done
  if [[ "${LOOP_COUNT}" != "0" && "${iteration}" -ge "${LOOP_COUNT}" ]]; then
    log "supervisor_stop reason=loop_count iteration=${iteration}"
    exit 0
  fi
  if [[ "${matched}" == "0" ]]; then
    log "idle no_target_window sleep=${IDLE_SLEEP_SECONDS}s"
  fi
  sleep "${IDLE_SLEEP_SECONDS}"
done
