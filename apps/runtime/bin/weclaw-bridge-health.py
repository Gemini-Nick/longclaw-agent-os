#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def expand(path: str) -> Path:
    return Path(os.path.expanduser(path)).resolve()


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(path)


def process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_pidfile(path: Path) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            pid = int(path.read_text(encoding="utf-8").strip())
        except Exception:
            pid = 0
        if pid and process_alive(pid):
            return False
        path.unlink(missing_ok=True)
    path.write_text(f"{os.getpid()}\n", encoding="utf-8")
    return True


def release_pidfile(path: Path) -> None:
    try:
        if path.exists():
            pid = int(path.read_text(encoding="utf-8").strip())
            if pid == os.getpid():
                path.unlink(missing_ok=True)
    except Exception:
        pass


def listener_up(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def resolve_dns(host: str) -> tuple[list[str], str | None]:
    try:
        infos = socket.getaddrinfo(host, None, family=socket.AF_INET, type=socket.SOCK_STREAM)
    except Exception as exc:
        return [], str(exc)
    addresses = sorted({item[4][0] for item in infos if item and item[4]})
    return addresses, None


def tls_probe(host: str, timeout_seconds: float) -> tuple[bool, str | None]:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((host, 443), timeout=timeout_seconds) as raw_sock:
            with ctx.wrap_socket(raw_sock, server_hostname=host) as tls_sock:
                tls_sock.settimeout(timeout_seconds)
                tls_sock.do_handshake()
        return True, None
    except Exception as exc:
        return False, str(exc)


def current_proxy_mode() -> dict:
    try:
        result = subprocess.run(
            ["scutil", "--proxy"],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except Exception as exc:
        return {"available": False, "error": str(exc)}
    if result.returncode != 0:
        return {"available": False, "error": (result.stderr or result.stdout).strip()}
    text = result.stdout
    return {
        "available": True,
        "http_enabled": "HTTPEnable : 1" in text,
        "https_enabled": "HTTPSEnable : 1" in text,
        "socks_enabled": "SOCKSEnable : 1" in text,
        "proxy_host": "127.0.0.1" if "127.0.0.1" in text else None,
    }


def build_state(previous: dict, host: str, port: int, timeout_seconds: float) -> dict:
    dns_addresses, dns_error = resolve_dns(host)
    tls_ok, tls_error = tls_probe(host, timeout_seconds)
    listener_ok = listener_up(port)
    upstream_reachable = tls_ok
    previous_failures = int(previous.get("consecutive_failures", 0) or 0)
    consecutive_failures = 0 if upstream_reachable else previous_failures + 1
    last_success_at = previous.get("last_success_at")
    if upstream_reachable:
        last_success_at = now_iso()

    state = {
        "generated_at": now_iso(),
        "api_host": host,
        "listener_port": port,
        "listener_up": listener_ok,
        "dns_resolved": bool(dns_addresses),
        "dns_addresses": dns_addresses,
        "dns_error": dns_error,
        "tls_ok": tls_ok,
        "upstream_reachable": upstream_reachable,
        "last_error": tls_error or dns_error,
        "last_success_at": last_success_at,
        "consecutive_failures": consecutive_failures,
        "proxy": current_proxy_mode(),
    }
    return state


def command_probe(args: argparse.Namespace) -> int:
    previous = read_json(args.state_file, {})
    state = build_state(previous, args.host, args.port, args.timeout_seconds)
    write_json(args.state_file, state)
    print(json.dumps(state, ensure_ascii=False))
    return 0 if state.get("upstream_reachable") else 1


def command_loop(args: argparse.Namespace) -> int:
    if not acquire_pidfile(args.pid_file):
        print(json.dumps({"status": "already_running", "pid_file": str(args.pid_file)}, ensure_ascii=False))
        return 0

    should_stop = False

    def handle_signal(_signum, _frame):
        nonlocal should_stop
        should_stop = True

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        while not should_stop:
            previous = read_json(args.state_file, {})
            state = build_state(previous, args.host, args.port, args.timeout_seconds)
            write_json(args.state_file, state)
            print(json.dumps(state, ensure_ascii=False), flush=True)
            for _ in range(args.interval_seconds):
                if should_stop:
                    break
                time.sleep(1)
    finally:
        release_pidfile(args.pid_file)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Probe weclaw bridge health under TUN/proxy mode")
    runtime_state_dir = expand(os.getenv("LONGCLAW_RUNTIME_STATE_DIR", "~/.longclaw/runtime-v2/state"))
    state_file = expand(
        os.getenv("LONGCLAW_WECLAW_BRIDGE_HEALTH_FILE", str(runtime_state_dir / "weclaw-bridge-health.json"))
    )
    pid_file = expand(os.getenv("LONGCLAW_WECLAW_BRIDGE_HEALTH_PID_FILE", str(state_file) + ".pid"))
    host = os.getenv("WECLAW_HEALTH_TARGET_HOST", "ilinkai.weixin.qq.com")
    port = int(os.getenv("WECLAW_PORT", "18011"))

    parser.add_argument("--state-file", type=expand, default=state_file)
    parser.add_argument("--pid-file", type=expand, default=pid_file)
    parser.add_argument("--host", default=host)
    parser.add_argument("--port", type=int, default=port)
    parser.add_argument("--timeout-seconds", type=float, default=float(os.getenv("WECLAW_HEALTH_TIMEOUT_SECONDS", "8")))

    subparsers = parser.add_subparsers(dest="command", required=True)
    probe = subparsers.add_parser("probe")
    probe.set_defaults(func=command_probe)

    loop = subparsers.add_parser("loop")
    loop.add_argument("--interval-seconds", type=int, default=int(os.getenv("WECLAW_HEALTH_INTERVAL_SECONDS", "60")))
    loop.set_defaults(func=command_loop)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
