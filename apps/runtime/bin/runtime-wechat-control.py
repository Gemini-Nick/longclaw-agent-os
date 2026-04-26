#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request
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


def load_task_queue(path: Path) -> dict:
    data = read_json(path, {"version": "wechat-task-queue-v1", "tasks": []})
    if not isinstance(data.get("tasks"), list):
        data["tasks"] = []
    data.setdefault("version", "wechat-task-queue-v1")
    return data


def save_task_queue(path: Path, state: dict) -> None:
    state["version"] = "wechat-task-queue-v1"
    state["updated_at"] = now_iso()
    write_json(path, state)


def load_notification_state(path: Path) -> dict:
    data = read_json(path, {})
    data.setdefault("version", "wechat-notification-state-v1")
    data.setdefault("mode", "every_round_summary")
    return data


def save_notification_state(path: Path, state: dict) -> None:
    state["version"] = "wechat-notification-state-v1"
    state["updated_at"] = now_iso()
    write_json(path, state)


def resolve_target_user_id(explicit_target: str | None, accounts_dir: Path) -> str:
    if explicit_target:
        return explicit_target
    for account_path in sorted(accounts_dir.glob("*-im-bot.json")):
        account = read_json(account_path, {})
        user_id = account.get("ilink_user_id")
        if isinstance(user_id, str) and user_id:
            return user_id
    return ""


def load_primary_account(accounts_dir: Path) -> dict:
    for account_path in sorted(accounts_dir.glob("*-im-bot.json")):
        account = read_json(account_path, {})
        if account.get("bot_token") and account.get("ilink_bot_id"):
            return account
    return {}


def summarize_tasks(task_state: dict) -> dict:
    tasks = task_state.get("tasks", [])
    pending = [item for item in tasks if item.get("status") == "pending"]
    running = [item for item in tasks if item.get("status") == "running"]
    completed = [item for item in tasks if item.get("status") == "completed"]
    failed = [item for item in tasks if item.get("status") == "failed"]
    return {
        "pending": pending,
        "running": running,
        "completed": completed,
        "failed": failed,
        "counts": {
            "pending": len(pending),
            "running": len(running),
            "completed": len(completed),
            "failed": len(failed),
            "total": len(tasks),
        },
    }


def humanize_runtime_text(value, fallback: str = "unknown") -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    replacements = {
        "本轮无新增自动处理故障": "这轮没有新增需要自动处理的问题",
        "knowledge-base: 人工审阅 environment_missing": "人工审阅知识库缺少必要环境的问题",
        "Longclaw Runtime Dashboard": "状态看板",
        "Longclaw Runtime": "本地助手",
        "Runtime Dashboard": "状态看板",
        "Longclaw runtime": "本地助手",
        "Runtime": "本地助手",
        "knowledge-base:": "知识库：",
        "knowledge_signal_read_failed:": "知识库读取失败：",
        "knowledge_projection_failed:": "知识库看板更新失败：",
        "weclaw_bridge_unreachable:": "微信通道连不上：",
        "environment_missing": "缺少必要环境",
        "Operation not permitted": "没有权限",
        "Permission denied": "没有权限",
        "知识库 Desktop 目录": "桌面知识库目录",
        "harness": "自动检查",
        "blocked_items": "卡住事项",
        "weclaw bridge": "微信通道",
        "weclaw session window": "微信会话记录",
        "manual override": "人工指定路由",
    }
    for raw, readable in replacements.items():
        text = text.replace(raw, readable)
    text = text.replace("： ", "：").replace("授权 本地助手 访问", "授权本地助手访问")
    return text


def format_agent_name(value) -> str:
    text = str(value or "unknown").strip()
    aliases = {
        "codex": "Codex",
        "claude": "Claude",
    }
    return aliases.get(text.lower(), text or "unknown")


def format_task_queue_line(pending_count: int, running_count: int) -> str:
    if pending_count == 0 and running_count == 0:
        return "任务队列：空闲（待处理 0，进行中 0）"
    return f"任务队列：待处理 {pending_count}，进行中 {running_count}"


def build_user_action_line(
    blocked_count: int,
    manual_review_count: int,
    pending_review_count: int,
    queue_has_work: bool,
    watch_item: str,
) -> str:
    if blocked_count or manual_review_count or pending_review_count:
        parts = []
        if blocked_count:
            parts.append(f"{blocked_count} 项卡住，重点看：{watch_item}")
        if manual_review_count:
            parts.append(f"{manual_review_count} 项人工审阅待确认")
        if pending_review_count:
            parts.append(f"{pending_review_count} 项待你确认")
        return f"需要你处理：是。{'；'.join(parts)}。"
    if queue_has_work:
        return "需要你处理：否。我会继续处理队列里的任务。"
    return "需要你处理：否。当前没有卡住事项，也没有新的人工审阅。"


def build_summary_text(queue: dict, task_summary: dict) -> tuple[str, str]:
    routing = queue.get("routing", {})
    harness = queue.get("harness", {})
    most_worth_watching = queue.get("most_worth_watching") or harness.get("headline") or "unknown"
    pending_reviews = queue.get("pending_reviews", [])
    blocked_items = queue.get("blocked_items", [])
    next_steps = queue.get("next_steps", [])
    manual_review_count = int(harness.get("manual_review_count") or 0)
    pending_review_count = len(pending_reviews)
    pending_count = task_summary["counts"]["pending"]
    running_count = task_summary["counts"]["running"]
    headline = humanize_runtime_text(harness.get("headline"), "这轮自动检查已完成")
    watch_item = humanize_runtime_text(most_worth_watching, headline)
    cycle_signature = hashlib.sha256(
        json.dumps(
            {
                "generated_at": queue.get("generated_at"),
                "summary_signature": harness.get("summary_signature"),
                "most_worth_watching": most_worth_watching,
                "pending_tasks": pending_count,
                "running_tasks": running_count,
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()

    lines = [
        f"我刚刚完成了这轮自动检查：{headline}",
        build_user_action_line(
            blocked_count=len(blocked_items),
            manual_review_count=manual_review_count,
            pending_review_count=pending_review_count,
            queue_has_work=bool(pending_count or running_count),
            watch_item=watch_item,
        ),
        f"时间：{queue.get('generated_at', 'unknown')}",
        f"主力 agent：{format_agent_name(routing.get('effective_agent'))}",
        format_task_queue_line(pending_count, running_count),
        f"人工审阅数：{manual_review_count} 项；待你确认：{pending_review_count} 项",
    ]
    if watch_item != headline:
        lines.append(f"我会继续盯：{watch_item}")
    if next_steps:
        lines.append(f"下一步：{humanize_runtime_text(next_steps[0])}")
    return "\n".join(lines), cycle_signature


def run_weclaw_send(weclaw_bin: Path, target_user_id: str, message: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(weclaw_bin), "send", "--to", target_user_id, "--text", message],
        check=False,
        capture_output=True,
        text=True,
    )


def generate_wechat_uin() -> str:
    return base64.b64encode(str(random.randint(1, 2**32 - 1)).encode("utf-8")).decode("ascii")


def send_direct_summary(accounts_dir: Path, target_user_id: str, message: str) -> tuple[bool, str | None]:
    account = load_primary_account(accounts_dir)
    if not account:
        return False, "no_primary_account"

    payload = {
        "msg": {
            "from_user_id": account["ilink_bot_id"],
            "to_user_id": target_user_id,
            "client_id": hashlib.sha256(f"{target_user_id}:{now_iso()}".encode("utf-8")).hexdigest()[:32],
            "message_type": 2,
            "message_state": 2,
            "item_list": [{"type": 1, "text_item": {"text": message}}],
            "context_token": "",
        },
        "base_info": {},
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{account.get('baseurl', 'https://ilinkai.weixin.qq.com')}/ilink/bot/sendmessage",
        data=data,
        headers={
            "Content-Type": "application/json",
            "AuthorizationType": "ilink_bot_token",
            "Authorization": f"Bearer {account['bot_token']}",
            "X-WECHAT-UIN": generate_wechat_uin(),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return False, str(exc)

    if payload.get("ret") != 0:
        return False, f"ret={payload.get('ret')} errmsg={payload.get('errmsg', '')}".strip()
    return True, None


def command_send_summary(args: argparse.Namespace) -> int:
    queue = read_json(args.queue_file, {})
    if not queue:
        print(json.dumps({"status": "failed", "reason": f"queue_missing:{args.queue_file}"}, ensure_ascii=False))
        return 0

    task_state = load_task_queue(args.task_queue_file)
    task_summary = summarize_tasks(task_state)
    notification_state = load_notification_state(args.notification_state_file)
    target_user_id = resolve_target_user_id(args.target_user_id, args.accounts_dir)
    delivery_policy = queue.get("delivery_policy", {})
    conversation_delivery_mode = delivery_policy.get(
        "conversation_delivery_mode",
        delivery_policy.get("wechat_delivery_mode", "unavailable"),
    )
    summary_delivery_mode = delivery_policy.get("summary_delivery_mode", conversation_delivery_mode)
    if not target_user_id:
        notification_state.update(
            {
                "target_user_id": "",
                "last_send_status": "skipped_no_target",
                "last_error": f"no_target_user_id:{args.accounts_dir}",
                "last_delivery_mode": "unavailable",
                "last_summary_delivery_mode": "unavailable",
                "last_conversation_delivery_mode": conversation_delivery_mode,
            }
        )
        save_notification_state(args.notification_state_file, notification_state)
        print(json.dumps({"status": "skipped", "reason": "no_target_user_id"}, ensure_ascii=False))
        return 0

    message, cycle_signature = build_summary_text(queue, task_summary)
    if (
        notification_state.get("last_cycle_signature") == cycle_signature
        and notification_state.get("last_send_status") == "sent"
    ):
        print(json.dumps({"status": "skipped", "reason": "duplicate_cycle"}, ensure_ascii=False))
        return 0

    notification_state.update(
        {
            "mode": "every_round_summary",
            "target_user_id": target_user_id,
            "last_delivery_mode": summary_delivery_mode,
            "last_summary_delivery_mode": summary_delivery_mode,
            "last_conversation_delivery_mode": conversation_delivery_mode,
            "last_cycle_signature": cycle_signature,
            "last_queue_generated_at": queue.get("generated_at"),
            "last_most_worth_watching": queue.get("most_worth_watching"),
            "last_message_preview": message[:400],
            "last_attempted_at": now_iso(),
            "last_send_transport": "weclaw_cli",
        }
    )

    if summary_delivery_mode in {"disabled", "unavailable"}:
        notification_state.update(
            {
                "last_send_status": "skipped_summary_unavailable",
                "last_error": None,
            }
        )
        save_notification_state(args.notification_state_file, notification_state)
        print(
            json.dumps(
                {
                    "status": "skipped",
                    "reason": "summary_unavailable",
                    "summary_delivery_mode": summary_delivery_mode,
                    "conversation_delivery_mode": conversation_delivery_mode,
                    "target_user_id": target_user_id,
                },
                ensure_ascii=False,
        )
        )
        return 0

    result = run_weclaw_send(args.weclaw_bin, target_user_id, message)

    if result.returncode == 0:
        notification_state.update(
            {
                "last_send_status": "sent",
                "last_sent_at": now_iso(),
                "last_error": None,
                "last_send_transport": "weclaw_cli",
            }
        )
        save_notification_state(args.notification_state_file, notification_state)
        print(json.dumps({"status": "sent", "target_user_id": target_user_id}, ensure_ascii=False))
        return 0

    if summary_delivery_mode == "background_summary":
        direct_ok, direct_error = send_direct_summary(args.accounts_dir, target_user_id, message)
        if direct_ok:
            notification_state.update(
                {
                    "last_send_status": "sent",
                    "last_sent_at": now_iso(),
                    "last_error": None,
                    "last_send_transport": "direct_ilink_no_context",
                }
            )
            save_notification_state(args.notification_state_file, notification_state)
            print(
                json.dumps(
                    {
                        "status": "sent",
                        "target_user_id": target_user_id,
                        "transport": "direct_ilink_no_context",
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        notification_state["last_send_transport"] = "direct_ilink_no_context"
        fallback_error = (direct_error or "").strip()
    else:
        fallback_error = ""

    notification_state.update(
        {
            "last_send_status": "failed",
            "last_error": (
                "\n".join(
                    item
                    for item in [
                        (result.stderr or result.stdout or "weclaw send failed").strip(),
                        f"direct_fallback: {fallback_error}" if fallback_error else "",
                    ]
                    if item
                )
            )[:500],
        }
    )
    save_notification_state(args.notification_state_file, notification_state)
    print(
        json.dumps(
            {
                "status": "failed",
                "target_user_id": target_user_id,
                "summary_delivery_mode": summary_delivery_mode,
                "conversation_delivery_mode": conversation_delivery_mode,
                "error": notification_state.get("last_error"),
            },
            ensure_ascii=False,
        )
    )
    return 0


def find_pending_task(task_state: dict) -> tuple[int, dict] | tuple[None, None]:
    for index, task in enumerate(task_state.get("tasks", [])):
        if task.get("status") == "pending":
            return index, task
    return None, None


def post_task_dispatch(api_addr: str, payload: dict) -> dict:
    request = urllib.request.Request(
        f"http://{api_addr}/api/task-dispatch",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def command_dispatch_next_task(args: argparse.Namespace) -> int:
    task_state = load_task_queue(args.task_queue_file)
    index, task = find_pending_task(task_state)
    if task is None:
        print(json.dumps({"status": "idle"}, ensure_ascii=False))
        return 0

    task_state["tasks"][index]["status"] = "running"
    task_state["tasks"][index]["started_at"] = now_iso()
    task_state["tasks"][index]["attempts"] = int(task_state["tasks"][index].get("attempts", 0)) + 1
    save_task_queue(args.task_queue_file, task_state)

    payload = {
        "to": task["source"]["from_user_id"],
        "text": task["task_text"],
        "task_id": task["id"],
    }

    try:
        response = post_task_dispatch(args.api_addr, payload)
    except urllib.error.HTTPError as exc:
        error = exc.read().decode("utf-8", errors="replace") or str(exc)
        response = {"status": "failed", "error": error}
    except Exception as exc:
        response = {"status": "failed", "error": str(exc)}

    task_state = load_task_queue(args.task_queue_file)
    current = task_state["tasks"][index]
    if response.get("status") == "ok":
        current["status"] = "completed"
        current["completed_at"] = now_iso()
        current["dispatched_mode"] = response.get("mode")
        current["dispatched_agent"] = response.get("agent")
        current["last_result"] = {"summary": response.get("reply_preview", "")}
        current["last_error"] = None
        save_task_queue(args.task_queue_file, task_state)
        print(
            json.dumps(
                {
                    "status": "completed",
                    "task_id": current["id"],
                    "agent": current.get("dispatched_agent"),
                },
                ensure_ascii=False,
            )
        )
        return 0

    current["status"] = "failed"
    current["completed_at"] = now_iso()
    current["last_error"] = response.get("error", "task dispatch failed")
    save_task_queue(args.task_queue_file, task_state)
    print(
        json.dumps(
            {
                "status": "failed",
                "task_id": current["id"],
                "error": current["last_error"],
            },
            ensure_ascii=False,
        )
    )
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Longclaw runtime WeChat summary and task control")
    runtime_state_dir = expand(os.getenv("LONGCLAW_RUNTIME_STATE_DIR", "~/.longclaw/runtime-v2/state"))
    subparsers = parser.add_subparsers(dest="command", required=True)

    summary = subparsers.add_parser("send-summary")
    summary.add_argument("--queue-file", type=expand, default=runtime_state_dir / "roadmap-queue.json")
    summary.add_argument("--task-queue-file", type=expand, default=runtime_state_dir / "wechat-task-queue.json")
    summary.add_argument(
        "--notification-state-file",
        type=expand,
        default=runtime_state_dir / "wechat-notification-state.json",
    )
    summary.add_argument("--weclaw-bin", type=expand, default=expand(os.getenv("WECLAW_BIN", "~/.weclaw/bin/weclaw")))
    summary.add_argument(
        "--accounts-dir",
        type=expand,
        default=expand(os.getenv("WECLAW_ACCOUNTS_DIR", "~/.weclaw/accounts")),
    )
    summary.add_argument("--target-user-id", default=os.getenv("LONGCLAW_WECHAT_TARGET_USER_ID"))
    summary.set_defaults(func=command_send_summary)

    dispatch = subparsers.add_parser("dispatch-next-task")
    dispatch.add_argument("--task-queue-file", type=expand, default=runtime_state_dir / "wechat-task-queue.json")
    dispatch.add_argument("--api-addr", default=os.getenv("WECLAW_API_ADDR", "127.0.0.1:18011"))
    dispatch.set_defaults(func=command_dispatch_next_task)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
