#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


DEFAULT_PROJECTS = [
    "~/.claude/projects/-Users-zhangqilong--weclaw-chat",
    "~/.claude/projects/-Users-zhangqilong--weclaw-workspace",
    "~/.claude/projects/-Users-zhangqilong-Downloads-src",
    "~/.claude/projects/-Users-zhangqilong",
    "~/.claude/projects/-Users-zhangqilong-Desktop",
]

DEFAULT_VAULT = "~/Documents/Obsidian Vault"
DEFAULT_KNOWLEDGE_DIR = "wiki/Claude Memory"
DEFAULT_RAW_DIR = "raw/Claude Sessions"
DEFAULT_ARCHIVE_ROOT = "~/.claude/projects-archived"
MERGE_TARGETS = {
    "-Users-zhangqilong-Desktop-github代码仓库-Signals": ("Signals", "Signals"),
    "-Users-zhangqilong-Desktop-github-----Signals": ("Signals", "Signals"),
    "-Users-zhangqilong-Desktop-github-----aippt": ("aippt", "aippt"),
    "-Users-zhangqilong-Desktop-github----": ("desktop-github-repos", "desktop-github-repos"),
}


@dataclass
class SessionSummary:
    session_id: str
    attachment_rel: str
    source_jsonl: Path
    start_at: str
    end_at: str
    entrypoints: list[str]
    cwd: str
    first_user_intent: str
    tags: list[str]
    has_subagents: bool
    has_tool_results: bool


@dataclass
class NoteImportResult:
    created: list[Path]
    skipped_existing: int


@dataclass
class TargetProject:
    slug: str
    display_name: str


def expand(path_str: str) -> Path:
    return Path(path_str).expanduser().resolve()


def default_vault_dir() -> str:
    obsidian_state = Path("~/Library/Application Support/obsidian/obsidian.json").expanduser()
    try:
        if obsidian_state.exists():
            state = json.loads(obsidian_state.read_text(encoding="utf-8"))
            vaults = state.get("vaults") or {}
            for vault in vaults.values():
                path_str = vault.get("path")
                if vault.get("open") and path_str:
                    return path_str
    except Exception:
        pass
    return DEFAULT_VAULT


def slugify(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return slug or "untitled"


def human_project_name(name: str) -> str:
    normalized = name.removeprefix("-Users-zhangqilong-")
    normalized = normalized.removeprefix("-Users-zhangqilong")
    normalized = normalized.strip("-")
    normalized = normalized.replace("github代码仓库", "github-repos")
    normalized = normalized.replace("-----", "-")
    normalized = normalized.replace("----", "-")
    normalized = normalized.replace("--", "-")
    normalized = normalized.replace("-", " ").strip()
    return normalized or name


def target_project_for(project_dir: Path) -> TargetProject:
    mapped = MERGE_TARGETS.get(project_dir.name)
    if mapped:
        return TargetProject(slug=slugify(mapped[0]), display_name=mapped[1])
    return TargetProject(slug=slugify(project_dir.name), display_name=human_project_name(project_dir.name))


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    parts = text.split("\n---\n", 1)
    if len(parts) != 2:
        return {}, text
    fm_raw = parts[0][4:]
    body = parts[1]
    frontmatter: dict[str, str] = {}
    for line in fm_raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip()
    return frontmatter, body


def render_frontmatter(metadata: dict[str, str]) -> str:
    lines = ["---"]
    for key, value in metadata.items():
        escaped = value.replace('"', '\\"')
        lines.append(f'{key}: "{escaped}"')
    lines.append("---")
    return "\n".join(lines)


def write_note(path: Path, metadata: dict[str, str], body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = render_frontmatter(metadata) + "\n\n" + body.strip() + "\n"
    path.write_text(content, encoding="utf-8")


def normalize_body_for_hash(body: str) -> str:
    return body.strip().replace("\r\n", "\n")


def file_body_hash(body: str) -> str:
    return hashlib.sha256(normalize_body_for_hash(body).encode("utf-8")).hexdigest()


def pick_memory_bucket(path: Path) -> tuple[str, str]:
    stem = path.stem
    if path.name == "MEMORY.md":
        return "indexes", "memory-index"
    if stem.startswith("feedback_"):
        return "feedback", stem
    if stem.startswith("project_"):
        return "projects", stem
    return "notes", stem


def extract_text_from_content(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text":
                text = (item.get("text") or "").strip()
                if text:
                    parts.append(text)
        return "\n".join(parts).strip()
    return ""


def find_first_user_intent(events: Iterable[dict]) -> str:
    for event in events:
        if event.get("type") != "user":
            continue
        if event.get("isMeta"):
            continue
        message = event.get("message") or {}
        text = extract_text_from_content(message.get("content"))
        if not text:
            continue
        if "local-command-caveat" in text:
            continue
        if text.startswith("<command-name>") or text.startswith("<local-command-stdout>"):
            continue
        return text.splitlines()[0][:240]
    return ""


def extract_session_summary(jsonl_path: Path, attachment_rel: str) -> SessionSummary:
    events = []
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    timestamps = [event.get("timestamp") for event in events if event.get("timestamp")]
    entrypoints = sorted({event.get("entrypoint") for event in events if event.get("entrypoint")})
    cwd_counter = Counter(event.get("cwd") for event in events if event.get("cwd"))
    cwd = cwd_counter.most_common(1)[0][0] if cwd_counter else ""
    first_user_intent = find_first_user_intent(events)
    session_dir = jsonl_path.with_suffix("")
    tags = []
    for raw_tag in [human_project_name(jsonl_path.parent.name), *(entrypoints or []), Path(cwd).name if cwd else ""]:
        tag = slugify(raw_tag.lower())
        if tag and tag not in tags:
            tags.append(tag)

    return SessionSummary(
        session_id=jsonl_path.stem,
        attachment_rel=attachment_rel,
        source_jsonl=jsonl_path,
        start_at=min(timestamps) if timestamps else "",
        end_at=max(timestamps) if timestamps else "",
        entrypoints=entrypoints,
        cwd=cwd,
        first_user_intent=first_user_intent,
        tags=tags,
        has_subagents=session_dir.joinpath("subagents").exists(),
        has_tool_results=session_dir.joinpath("tool-results").exists(),
    )


def build_session_note(summary: SessionSummary, archived_project_dir: Path) -> str:
    lines = [
        f"# Session {summary.session_id}",
        "",
        f"- Session ID: `{summary.session_id}`",
        f"- Time Range: `{summary.start_at or 'unknown'}` -> `{summary.end_at or 'unknown'}`",
        f"- Entrypoint: `{', '.join(summary.entrypoints) if summary.entrypoints else 'unknown'}`",
        f"- CWD: `{summary.cwd or 'unknown'}`",
        f"- First User Intent: {summary.first_user_intent or 'N/A'}",
        f"- Raw JSONL: [{Path(summary.attachment_rel).name}]({summary.attachment_rel})",
        f"- Archived Source Dir: `{archived_project_dir}`",
        f"- Subagents Dir Present: `{'yes' if summary.has_subagents else 'no'}`",
        f"- Tool Results Present: `{'yes' if summary.has_tool_results else 'no'}`",
    ]
    if summary.tags:
        lines.extend(["", "## Tags", "", " ".join(f"`{tag}`" for tag in summary.tags)])
    return "\n".join(lines)


def build_project_index(
    project_name: str,
    display_name: str,
    source_dir: Path,
    archived_dir: Path,
    imported_memory_notes: list[Path],
    session_summaries: list[SessionSummary],
) -> str:
    cwd_counter = Counter(summary.cwd for summary in session_summaries if summary.cwd)
    lines = [
        f"# {display_name}",
        "",
        f"- Source Project Dir: `{source_dir}`",
        f"- Archived Dir: `{archived_dir}`",
        f"- Session Count: `{len(session_summaries)}`",
        f"- Memory Notes Imported: `{len(imported_memory_notes)}`",
    ]
    if session_summaries:
        starts = [summary.start_at for summary in session_summaries if summary.start_at]
        ends = [summary.end_at for summary in session_summaries if summary.end_at]
        lines.extend(
            [
                f"- Time Range: `{min(starts) if starts else 'unknown'}` -> `{max(ends) if ends else 'unknown'}`",
            ]
        )
    if imported_memory_notes:
        lines.extend(["", "## Knowledge Notes", ""])
        for note in imported_memory_notes:
            rel = note.name
            lines.append(f"- [{note.stem}]({rel})")
    if cwd_counter:
        lines.extend(["", "## Key CWDs", ""])
        for cwd, count in cwd_counter.most_common(10):
            lines.append(f"- `{cwd}` ({count})")
    if session_summaries:
        lines.extend(["", "## Session Summaries", ""])
        for summary in session_summaries:
            lines.append(f"- [{summary.session_id}](sessions/{summary.session_id}.md) — {summary.first_user_intent or 'No explicit user prompt captured'}")
    return "\n".join(lines)


def copy_memory_notes(
    project_dir: Path,
    knowledge_project_dir: Path,
    imported_at: str,
) -> NoteImportResult:
    imported: list[Path] = []
    skipped_existing = 0
    memory_dir = project_dir / "memory"
    if not memory_dir.exists():
        return NoteImportResult(created=imported, skipped_existing=skipped_existing)

    existing_source_paths: set[str] = set()
    existing_hashes: set[str] = set()
    for existing in knowledge_project_dir.rglob("*.md"):
        frontmatter, body = parse_frontmatter(existing.read_text(encoding="utf-8"))
        source_path = frontmatter.get("source_path")
        if source_path:
            existing_source_paths.add(source_path)
        existing_hashes.add(file_body_hash(body))

    for src in sorted(memory_dir.glob("*.md")):
        frontmatter, body = parse_frontmatter(src.read_text(encoding="utf-8"))
        bucket, stem = pick_memory_bucket(src)
        dest = knowledge_project_dir / bucket / f"{stem}.md"
        body_to_write = body.strip()
        if src.name == "MEMORY.md" and not body_to_write.startswith("# "):
            body_to_write = f"# {human_project_name(project_dir.name)} Memory Index\n\n{body_to_write}"
        else:
            title = frontmatter.get("name") or src.stem.replace("_", " ")
            if not body_to_write.startswith("# "):
                body_to_write = f"# {title}\n\n{body_to_write}"

        source_path = str(src)
        body_hash = file_body_hash(body_to_write)
        if source_path in existing_source_paths or body_hash in existing_hashes:
            skipped_existing += 1
            continue

        metadata = {
            **frontmatter,
            "source": "claude-project-archive",
            "source_project": project_dir.name,
            "source_path": source_path,
            "imported_at": imported_at,
        }
        write_note(dest, metadata, body_to_write)
        imported.append(dest)
        existing_source_paths.add(source_path)
        existing_hashes.add(body_hash)
    return NoteImportResult(created=imported, skipped_existing=skipped_existing)


def import_project(
    project_dir: Path,
    vault_dir: Path,
    knowledge_root: Path,
    raw_root: Path,
    archive_batch_dir: Path,
    imported_at: str,
) -> dict:
    target = target_project_for(project_dir)
    project_slug = target.slug
    display_name = target.display_name
    knowledge_project_dir = knowledge_root / project_slug
    raw_project_dir = raw_root / project_slug
    attachments_dir = raw_project_dir / "attachments"
    sessions_dir = raw_project_dir / "sessions"
    attachments_dir.mkdir(parents=True, exist_ok=True)
    sessions_dir.mkdir(parents=True, exist_ok=True)

    note_result = copy_memory_notes(project_dir, knowledge_project_dir, imported_at)

    session_summaries: list[SessionSummary] = []
    attachment_count = 0
    skipped_existing_sessions = 0
    for jsonl_src in sorted(project_dir.glob("*.jsonl")):
        attachment_dest = attachments_dir / jsonl_src.name
        if attachment_dest.exists():
            skipped_existing_sessions += 1
            continue
        shutil.copy2(jsonl_src, attachment_dest)
        attachment_count += 1
        summary = extract_session_summary(
            jsonl_src,
            attachment_rel=str(Path("attachments") / jsonl_src.name),
        )
        session_summaries.append(summary)

    archived_project_dir = archive_batch_dir / project_dir.name
    archived_project_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(project_dir), str(archived_project_dir))

    for summary in session_summaries:
        session_note = build_session_note(summary, archived_project_dir)
        metadata = {
            "source": "claude-project-archive",
            "source_project": project_dir.name,
            "source_path": str(summary.source_jsonl),
            "imported_at": imported_at,
            "session_id": summary.session_id,
            "entrypoint": ",".join(summary.entrypoints) if summary.entrypoints else "unknown",
            "cwd": summary.cwd or "unknown",
            "type": "raw-session-summary",
        }
        write_note(sessions_dir / f"{summary.session_id}.md", metadata, session_note)

    project_index = build_project_index(
        project_name=project_dir.name,
        display_name=display_name,
        source_dir=project_dir,
        archived_dir=archived_project_dir,
        imported_memory_notes=note_result.created,
        session_summaries=session_summaries,
    )
    project_index += (
        "\n\n## Import Result\n\n"
        f"- Mode: `merged`\n"
        f"- New Knowledge Notes: `{len(note_result.created)}`\n"
        f"- Skipped Duplicate Knowledge Notes: `{note_result.skipped_existing}`\n"
        f"- New Session Summaries: `{len(session_summaries)}`\n"
        f"- Skipped Duplicate Sessions: `{skipped_existing_sessions}`\n"
    )
    write_note(
        raw_project_dir / "index.md",
        {
            "source": "claude-project-archive",
            "source_project": project_dir.name,
            "source_path": str(project_dir),
            "imported_at": imported_at,
            "type": "project-archive-index",
        },
        project_index,
    )
    if note_result.created:
        knowledge_index_lines = [
            f"# {display_name}",
            "",
            f"- Source Project Dir: `{project_dir}`",
            f"- Imported At: `{imported_at}`",
            f"- Import Mode: `merged`",
            f"- New Knowledge Notes: `{len(note_result.created)}`",
            f"- Skipped Duplicate Knowledge Notes: `{note_result.skipped_existing}`",
            f"- Raw Archive Index: [index.md](../../../{raw_root.relative_to(vault_dir)}/{project_slug}/index.md)",
            "",
            "## Notes",
            "",
        ]
        for note in note_result.created:
            rel = note.relative_to(knowledge_project_dir)
            knowledge_index_lines.append(f"- [{note.stem}]({rel.as_posix()})")
        write_note(
            knowledge_project_dir / "index.md",
            {
                "source": "claude-project-archive",
                "source_project": project_dir.name,
                "source_path": str(project_dir / "memory"),
                "imported_at": imported_at,
                "type": "knowledge-project-index",
            },
            "\n".join(knowledge_index_lines),
        )

    return {
        "project": project_dir.name,
        "target_project": project_slug,
        "mode": "merged" if project_dir.name in MERGE_TARGETS else "created",
        "knowledge_notes_created": len(note_result.created),
        "knowledge_notes_skipped_existing": note_result.skipped_existing,
        "session_summaries_created": len(session_summaries),
        "session_summaries_skipped_existing": skipped_existing_sessions,
        "attachments_created": attachment_count,
        "archived_to": str(archived_project_dir),
    }


def write_import_report(raw_root: Path, imported_at: str, results: list[dict]) -> Path:
    report_path = raw_root / f"import-report-{imported_at.replace(':', '').replace('-', '')}.md"
    total_knowledge_created = sum(item["knowledge_notes_created"] for item in results)
    total_knowledge_skipped = sum(item["knowledge_notes_skipped_existing"] for item in results)
    total_sessions_created = sum(item["session_summaries_created"] for item in results)
    total_sessions_skipped = sum(item["session_summaries_skipped_existing"] for item in results)
    total_attachments = sum(item["attachments_created"] for item in results)
    lines = [
        "# Claude Project Archive Import Report",
        "",
        f"- Imported At: `{imported_at}`",
        f"- Projects Imported: `{len(results)}`",
        f"- Knowledge Notes Created: `{total_knowledge_created}`",
        f"- Knowledge Notes Skipped Existing: `{total_knowledge_skipped}`",
        f"- Session Summaries Created: `{total_sessions_created}`",
        f"- Session Summaries Skipped Existing: `{total_sessions_skipped}`",
        f"- Raw Attachments Created: `{total_attachments}`",
        "",
        "## Projects",
        "",
    ]
    for item in results:
        lines.extend(
            [
                f"### {item['project']}",
                "",
                f"- Target Project: `{item['target_project']}`",
                f"- Mode: `{item['mode']}`",
                f"- Knowledge Notes Created: `{item['knowledge_notes_created']}`",
                f"- Knowledge Notes Skipped Existing: `{item['knowledge_notes_skipped_existing']}`",
                f"- Session Summaries Created: `{item['session_summaries_created']}`",
                f"- Session Summaries Skipped Existing: `{item['session_summaries_skipped_existing']}`",
                f"- Raw Attachments Created: `{item['attachments_created']}`",
                f"- Archived To: `{item['archived_to']}`",
                "",
            ]
        )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return report_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Claude project archives into Obsidian")
    parser.add_argument("--vault-dir", default=default_vault_dir())
    parser.add_argument("--knowledge-dir", default=DEFAULT_KNOWLEDGE_DIR)
    parser.add_argument("--raw-dir", default=DEFAULT_RAW_DIR)
    parser.add_argument("--archive-root", default=DEFAULT_ARCHIVE_ROOT)
    parser.add_argument("--project", action="append", default=[])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    vault_dir = expand(args.vault_dir)
    knowledge_root = vault_dir / args.knowledge_dir
    raw_root = vault_dir / args.raw_dir
    archive_root = expand(args.archive_root)
    imported_at = datetime.now().astimezone().isoformat(timespec="seconds")
    archive_batch_dir = archive_root / datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")

    project_args = args.project or DEFAULT_PROJECTS
    project_dirs = [expand(path_str) for path_str in project_args]
    existing_projects = [path for path in project_dirs if path.exists()]
    if not existing_projects:
        raise SystemExit("No Claude project directories found to import")

    results = []
    for project_dir in existing_projects:
        results.append(
            import_project(
                project_dir=project_dir,
                vault_dir=vault_dir,
                knowledge_root=knowledge_root,
                raw_root=raw_root,
                archive_batch_dir=archive_batch_dir,
                imported_at=imported_at,
            )
        )

    report_path = write_import_report(raw_root, imported_at, results)
    print(json.dumps({"imported_at": imported_at, "report_path": str(report_path), "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
