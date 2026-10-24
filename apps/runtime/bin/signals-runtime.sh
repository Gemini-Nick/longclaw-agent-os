#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LONGCLAW_LOG_DIR:-/tmp/longclaw-guardian}"
PID_DIR="${LONGCLAW_PID_DIR:-$HOME/.longclaw/runtime-v2/pids}"
ROOT="${LONGCLAW_SIGNALS_REPO_ROOT:-/Users/zhangqilong/github代码仓库/Signals}"
PORT="${LONGCLAW_SIGNALS_WEB_PORT:-8011}"
LABEL="${SIGNALS_RUNTIME_LABEL:-com.zhangqilong.ai.signals.runtime}"
WEB_SCRIPT="${SIGNALS_WEB_SCRIPT:-$SCRIPT_DIR/signals-web.sh}"
SYNC_SCRIPT="${SIGNALS_SYNC_SCRIPT:-$SCRIPT_DIR/signals-sync.sh}"
POSTMARKET_SCRIPT="${SIGNALS_POSTMARKET_SCRIPT:-$SCRIPT_DIR/signals-postmarket.sh}"
START_SYNC="${SIGNALS_RUNTIME_START_SYNC:-false}"
START_LANES="${SIGNALS_RUNTIME_START_LANES:-true}"
START_POSTMARKET="${SIGNALS_RUNTIME_START_POSTMARKET:-true}"
LANES_RAW="${SIGNALS_RUNTIME_LANES:-quote_lane signal_lane workbench_lane board_lane}"
LANES="$(printf '%s' "$LANES_RAW" | tr ',' ' ')"
SUPERVISOR_LOG="$LOG_DIR/signals.runtime.log"
WEB_LOG="$LOG_DIR/signals.web.launchd.log"
SYNC_LOG="$LOG_DIR/signals.sync.launchd.log"
POSTMARKET_LOG="$LOG_DIR/signals.postmarket.launchd.log"

WEB_PID=""
SYNC_PID=""
POSTMARKET_PID=""
LAST_CHILD_PID=""
CONTROL_PID_FILE="$PID_DIR/signals-runtime-control.pid"
LANE_NAMES=()
LANE_PIDS=()

mkdir -p "$LOG_DIR" "$PID_DIR"

ts() {
  date '+%F %T'
}

log() {
  printf '[%s] %s\n' "$(ts)" "$*" >>"$SUPERVISOR_LOG"
}

require_exec() {
  local path="$1"
  if [[ ! -x "$path" ]]; then
    log "missing executable: $path"
    echo "missing executable: $path" >&2
    exit 2
  fi
}

lane_short() {
  case "$1" in
    quote_lane) printf 'quote' ;;
    signal_lane) printf 'signal' ;;
    workbench_lane) printf 'workbench' ;;
    board_lane) printf 'board' ;;
    *) return 1 ;;
  esac
}

validate_lane() {
  lane_short "$1" >/dev/null
}

lane_pid_file() {
  printf '%s/signals-lane-%s.pid\n' "$PID_DIR" "$1"
}

lane_log_file() {
  local short
  short="$(lane_short "$1")"
  printf '%s/signals.%s.launchd.log\n' "$LOG_DIR" "$short"
}

print_pid_status() {
  local name="$1"
  local pid_file="$2"
  local pid=""
  if [[ -f "$pid_file" ]]; then
    pid="$(tr -d '[:space:]' <"$pid_file" 2>/dev/null || true)"
  fi

  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    printf '%s: running pid=%s command=%s\n' "$name" "$pid" "$(ps -p "$pid" -o command= 2>/dev/null || true)"
  elif [[ -n "$pid" ]]; then
    printf '%s: stale pid=%s pid_file=%s\n' "$name" "$pid" "$pid_file"
  else
    printf '%s: missing pid_file=%s\n' "$name" "$pid_file"
  fi
}

print_launchd_status() {
  launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | awk '
    /state =|pid =|runs =|last exit code =|program =|path =/ { gsub(/^[ \t]+/, ""); print }
  ' || true
}

status_cmd() {
  echo "Signals Runtime"
  echo "label: $LABEL"
  print_launchd_status
  print_pid_status "web" "$PID_DIR/signals-web.pid"
  if [[ "$START_SYNC" == "true" ]]; then
    print_pid_status "sync" "$PID_DIR/signals-sync.pid"
  fi
  if [[ "$START_POSTMARKET" == "true" ]]; then
    print_pid_status "postmarket" "$PID_DIR/signals-postmarket.pid"
  fi
  if [[ "$START_LANES" == "true" ]]; then
    local lane
    for lane in $LANES; do
      if validate_lane "$lane"; then
        print_pid_status "$lane" "$(lane_pid_file "$lane")"
      else
        printf '%s: invalid lane configured\n' "$lane"
      fi
    done
  fi
  printf 'port_%s_listener: %s\n' "$PORT" "$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1" pid="$2}' || true)"
  printf 'logs: %s %s' "$SUPERVISOR_LOG" "$WEB_LOG"
  if [[ "$START_SYNC" == "true" ]]; then
    printf ' %s' "$SYNC_LOG"
  fi
  if [[ "$START_POSTMARKET" == "true" ]]; then
    printf ' %s' "$POSTMARKET_LOG"
  fi
  if [[ "$START_LANES" == "true" ]]; then
    local lane_log
    for lane in $LANES; do
      if validate_lane "$lane"; then
        lane_log="$(lane_log_file "$lane")"
        printf ' %s' "$lane_log"
      fi
    done
  fi
  printf '\n'
}

doctor_cmd() {
  status_cmd
  echo
  if [[ ! -f "$ROOT/scripts/signals_doctor.py" ]]; then
    echo "signals doctor missing: $ROOT/scripts/signals_doctor.py" >&2
    return 2
  fi
  (cd "$ROOT" && bash scripts/python.sh scripts/signals_doctor.py "$@")
}

observe_cmd() {
  if [[ ! -f "$ROOT/scripts/signals_runtime_observer.py" ]]; then
    echo "signals observer missing: $ROOT/scripts/signals_runtime_observer.py" >&2
    return 2
  fi
  (cd "$ROOT" && bash scripts/python.sh scripts/signals_runtime_observer.py "$@")
}

tail_logs_cmd() {
  local lines="${1:-80}"
  local files=()
  local f
  for f in "$SUPERVISOR_LOG" "$WEB_LOG"; do
    [[ -f "$f" ]] && files+=("$f")
  done
  if [[ "$START_SYNC" == "true" ]] && [[ -f "$SYNC_LOG" ]]; then
    files+=("$SYNC_LOG")
  fi
  if [[ "$START_POSTMARKET" == "true" ]] && [[ -f "$POSTMARKET_LOG" ]]; then
    files+=("$POSTMARKET_LOG")
  fi
  if [[ "$START_LANES" == "true" ]]; then
    local lane lane_log
    for lane in $LANES; do
      if validate_lane "$lane"; then
        lane_log="$(lane_log_file "$lane")"
        [[ -f "$lane_log" ]] && files+=("$lane_log")
      fi
    done
  fi
  if (( ${#files[@]} == 0 )); then
    echo "no signals runtime logs found in $LOG_DIR" >&2
    return 1
  fi
  tail -n "$lines" "${files[@]}"
}

normalize_child() {
  case "${1:-}" in
    web) printf 'web' ;;
    sync) printf 'sync' ;;
    postmarket) printf 'postmarket' ;;
    quote|quote_lane) printf 'quote_lane' ;;
    signal|signal_lane) printf 'signal_lane' ;;
    workbench|workbench_lane) printf 'workbench_lane' ;;
    board|board_lane) printf 'board_lane' ;;
    *) return 1 ;;
  esac
}

restart_child_cmd() {
  local child="${1:-}"
  local normalized=""
  local pid_file=""
  normalized="$(normalize_child "$child")" || {
    echo "usage: $0 restart-child [web|sync|postmarket|quote|signal|workbench|board]" >&2
    return 2
  }
  if [[ "$normalized" == "web" ]]; then
    restart_web_cmd
    return $?
  fi
  case "$normalized" in
    web) pid_file="$PID_DIR/signals-web.pid" ;;
    sync) pid_file="$PID_DIR/signals-sync.pid" ;;
    postmarket) pid_file="$PID_DIR/signals-postmarket.pid" ;;
    *) pid_file="$(lane_pid_file "$normalized")" ;;
  esac

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(tr -d '[:space:]' <"$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "terminating signals $normalized pid=$pid"
      kill "$pid" >/dev/null 2>&1 || true
    fi
  fi
  echo "kickstarting $LABEL"
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
}

# Only supervisors advertising this protocol accept USR1. Never signal the old
# deployed supervisor: USR1 would terminate it and restart every worker.
restart_web_cmd() {
  local owner started actual old_web current attempt
  if [[ ! -f "$CONTROL_PID_FILE" ]]; then
    echo "isolated web restart unavailable: supervisor upgrade required" >&2
    return 2
  fi
  owner="$(sed -n '1p' "$CONTROL_PID_FILE")"
  started="$(sed -n '2p' "$CONTROL_PID_FILE")"
  [[ "$owner" =~ ^[0-9]+$ ]] || return 2
  actual="$(ps -p "$owner" -o lstart= 2>/dev/null || true)"
  if [[ -z "$started" || "$actual" != "$started" ]]; then
    echo "isolated web restart refused: stale supervisor identity" >&2
    return 2
  fi
  if ! bounded_web_supported; then
    echo "isolated web restart refused: bounded startup protocol unavailable" >&2
    return 2
  fi
  old_web="$(cat "$PID_DIR/signals-web.pid" 2>/dev/null || true)"
  kill -USR1 "$owner" || return 2
  for attempt in {1..40}; do
    current="$(cat "$PID_DIR/signals-web.pid" 2>/dev/null || true)"
    if [[ -n "$current" && "$current" != "$old_web" ]] && kill -0 "$current" 2>/dev/null; then
      echo "web restarted pid=$current startup_profile=bounded_readonly; API acceptance required"
      return 0
    fi
    sleep 0.25
  done
  echo "isolated web restart not confirmed; inspect runtime and API health" >&2
  return 1
}

bounded_web_supported() {
  # Import-only capability declaration: this module must have no service/DB
  # side effects. Missing support refuses the restart before stopping the web.
  (cd "$ROOT" && bash scripts/python.sh -c 'from signals.core.startup_profile import BOUNDED_STARTUP_PROTOCOL; assert BOUNDED_STARTUP_PROTOCOL == 1')
}

restart_web_child() {
  if ! bounded_web_supported; then
    log "isolated web restart refused: bounded startup protocol unavailable"
    return 0
  fi
  log "isolated web restart requested; startup_profile=bounded_readonly"
  stop_child "$WEB_PID" "web"
  SIGNALS_RUNTIME_STARTUP_PROFILE=bounded_readonly start_child "web" "$WEB_SCRIPT" "$WEB_LOG"
}

usage() {
  cat <<EOF
usage: $0 [run|status|doctor|observe [--json]|tail-logs [lines]|restart-web|restart-child web|sync|postmarket|quote|signal|workbench|board]
EOF
}

start_child() {
  local name="$1"
  local script="$2"
  local log_file="$3"
  shift 3

  log "starting $name with $script $*"
  "$script" "$@" >>"$log_file" 2>&1 &
  local pid="$!"
  printf '%s\n' "$pid" >"$PID_DIR/signals-$name.pid"
  log "$name started pid=$pid log=$log_file"
  LAST_CHILD_PID="$pid"

  if [[ "$name" == "web" ]]; then
    WEB_PID="$pid"
  elif [[ "$name" == "sync" ]]; then
    SYNC_PID="$pid"
  elif [[ "$name" == "postmarket" ]]; then
    POSTMARKET_PID="$pid"
  fi
}

start_lane_child() {
  local lane="$1"
  local log_file
  validate_lane "$lane" || {
    log "invalid lane configured: $lane"
    echo "invalid lane configured: $lane" >&2
    exit 2
  }
  log_file="$(lane_log_file "$lane")"
  start_child "lane-$lane" "$SYNC_SCRIPT" "$log_file" --lane "$lane"
  LANE_NAMES+=("$lane")
  LANE_PIDS+=("$LAST_CHILD_PID")
}

child_exit_code() {
  local pid="$1"
  set +e
  wait "$pid"
  local rc="$?"
  set -e
  printf '%s\n' "$rc"
}

stop_child() {
  local pid="$1"
  local name="$2"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    log "stopping $name pid=$pid"
    pkill -TERM -P "$pid" >/dev/null 2>&1 || true
    kill "$pid" >/dev/null 2>&1 || true
    sleep "${SIGNALS_RUNTIME_CHILD_STOP_GRACE_SECONDS:-0.3}"
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    log "force stopping $name pid=$pid"
    pkill -KILL -P "$pid" >/dev/null 2>&1 || true
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  if [[ -f "$CONTROL_PID_FILE" && "$(sed -n '1p' "$CONTROL_PID_FILE")" == "$$" ]]; then
    rm -f "$CONTROL_PID_FILE"
  fi
  local i
  for (( i=${#LANE_PIDS[@]} - 1; i >= 0; i-- )); do
    stop_child "${LANE_PIDS[$i]}" "lane ${LANE_NAMES[$i]}"
  done
  stop_child "$POSTMARKET_PID" "postmarket"
  stop_child "$SYNC_PID" "sync"
  stop_child "$WEB_PID" "web"
}

terminate() {
  log "signals runtime received stop"
  cleanup
  exit 0
}

trap terminate INT TERM
trap cleanup EXIT

COMMAND="${1:-run}"
if [[ $# -gt 0 ]]; then
  shift
fi

case "$COMMAND" in
  run|start) ;;
  status) status_cmd "$@"; exit $? ;;
  doctor) doctor_cmd "$@"; exit $? ;;
  observe|observer) observe_cmd "$@"; exit $? ;;
  tail-logs|logs) tail_logs_cmd "$@"; exit $? ;;
  restart-web) restart_web_cmd; exit $? ;;
  restart-child|restart) restart_child_cmd "$@"; exit $? ;;
  help|-h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

require_exec "$WEB_SCRIPT"
if [[ "$START_SYNC" == "true" && "$START_LANES" == "true" ]]; then
  echo "SIGNALS_RUNTIME_START_SYNC and SIGNALS_RUNTIME_START_LANES cannot both be true" >&2
  exit 2
fi
if [[ "$START_SYNC" == "true" || "$START_LANES" == "true" ]]; then
  require_exec "$SYNC_SCRIPT"
fi
if [[ "$START_POSTMARKET" == "true" ]]; then
  require_exec "$POSTMARKET_SCRIPT"
fi

# The control identity is published only after the USR1 handler is installed.
trap restart_web_child USR1
printf '%s\n%s\n' "$$" "$(ps -p "$$" -o lstart=)" >"$CONTROL_PID_FILE"
log "signals runtime starting"
start_child "web" "$WEB_SCRIPT" "$WEB_LOG"
if [[ "$START_SYNC" == "true" ]]; then
  start_child "sync" "$SYNC_SCRIPT" "$SYNC_LOG"
elif [[ "$START_LANES" == "true" ]]; then
  for lane in $LANES; do
    start_lane_child "$lane"
  done
else
  log "sync and lane children disabled"
fi
if [[ "$START_POSTMARKET" == "true" ]]; then
  start_child "postmarket" "$POSTMARKET_SCRIPT" "$POSTMARKET_LOG"
else
  log "postmarket child disabled"
fi

while true; do
  sleep 5
  if [[ -n "$WEB_PID" ]] && ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
    rc="$(child_exit_code "$WEB_PID")"
    log "web exited rc=$rc; exiting for launchd restart"
    exit 1
  fi
  if [[ "$START_SYNC" == "true" ]] && [[ -n "$SYNC_PID" ]] && ! kill -0 "$SYNC_PID" >/dev/null 2>&1; then
    rc="$(child_exit_code "$SYNC_PID")"
    log "sync exited rc=$rc; exiting for launchd restart"
    exit 1
  fi
  if [[ "$START_POSTMARKET" == "true" ]] && [[ -n "$POSTMARKET_PID" ]] && ! kill -0 "$POSTMARKET_PID" >/dev/null 2>&1; then
    rc="$(child_exit_code "$POSTMARKET_PID")"
    log "postmarket exited rc=$rc; exiting for launchd restart"
    exit 1
  fi
  if [[ "$START_LANES" == "true" ]]; then
    for (( i=0; i<${#LANE_PIDS[@]}; i++ )); do
      if ! kill -0 "${LANE_PIDS[$i]}" >/dev/null 2>&1; then
        rc="$(child_exit_code "${LANE_PIDS[$i]}")"
        log "lane ${LANE_NAMES[$i]} exited rc=$rc; exiting for launchd restart"
        exit 1
      fi
    done
  fi
done
