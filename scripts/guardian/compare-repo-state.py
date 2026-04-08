#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def run(cmd, cwd=None, check=True):
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        text=True,
        capture_output=True,
    )


def git(repo: Path, *args, check=True):
    return run(["git", "-C", str(repo), *args], check=check)


def discover_git_repos(repo_root: Path):
    repos = []
    for root, dirs, files in os.walk(repo_root):
        root_path = Path(root)
        if ".git" in dirs or ".git" in files:
            repos.append(root_path)
            dirs[:] = []
            continue
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".codex", ".claude", ".venv"}]
    return sorted(set(repos))


def relative_repo_key(repo_root: Path, repo: Path):
    try:
        return repo.relative_to(repo_root).as_posix()
    except ValueError:
        return repo.name


def load_policy(path: Path):
    config = {
        "default": {
            "mode": "mirror_origin",
            "canonical_remote": "origin",
            "branch": "main",
            "allow_local_commits": False,
            "allow_dependency_updates": False,
            "upstream_remote": "",
        },
        "repos": {},
    }
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            config["default"].update(loaded.get("default") or {})
            config["repos"].update(loaded.get("repos") or {})
    return config


def merge_policy(policy, repo_key: str):
    merged = dict(policy["default"])
    merged.update(policy["repos"].get(repo_key, {}))
    return merged


def remote_exists(repo: Path, name: str):
    if not name:
        return False
    return git(repo, "remote", "get-url", name, check=False).returncode == 0


def ref_exists(repo: Path, ref: str):
    return git(repo, "rev-parse", "--verify", ref, check=False).returncode == 0


def rev_parse(repo: Path, ref: str):
    proc = git(repo, "rev-parse", ref, check=False)
    return proc.stdout.strip() if proc.returncode == 0 else ""


def rev_list_counts(repo: Path, left: str, right: str):
    proc = git(repo, "rev-list", "--left-right", "--count", f"{left}...{right}", check=False)
    if proc.returncode != 0:
        return 0, 0
    parts = proc.stdout.strip().split()
    if len(parts) != 2:
        return 0, 0
    return int(parts[0]), int(parts[1])


def current_branch(repo: Path):
    proc = git(repo, "branch", "--show-current", check=False)
    return proc.stdout.strip() or "HEAD"


def dirty_reason(repo: Path):
    proc = git(repo, "status", "--porcelain", "--untracked-files=all", check=False)
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    if not lines:
        return "", False
    has_tracked = any(not line.startswith("??") for line in lines)
    has_untracked = any(line.startswith("??") for line in lines)
    if has_tracked and has_untracked:
        return "tracked+untracked", True
    if has_tracked:
        return "tracked", True
    return "untracked", True


def local_vs_origin_status(has_remote_ref, ahead, behind, dirty, mode):
    if mode == "local_git_pending_remote":
        return "no_remote_expected"
    if not has_remote_ref:
        return "missing_remote_ref"
    if dirty:
        return "dirty"
    if ahead == 0 and behind == 0:
        return "synced"
    if ahead > 0 and behind == 0:
        return "ahead"
    if ahead == 0 and behind > 0:
        return "behind"
    return "diverged"


def origin_vs_upstream_status(mode, has_origin_ref, has_upstream_ref, ahead, behind):
    if mode != "fork_origin_with_upstream":
      return "not_applicable"
    if not has_origin_ref or not has_upstream_ref:
        return "missing_remote_ref"
    if ahead == 0 and behind == 0:
        return "synced"
    if ahead > 0 and behind == 0:
        return "ahead_allowed"
    if ahead == 0 and behind > 0:
        return "behind_upstream"
    return "diverged"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default="~/github代码仓库")
    parser.add_argument("--policy", default="~/github代码仓库/longclaw-agent-os/apps/runtime/config/repo-sync-policy.json")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()

    repo_root = Path(os.path.expanduser(args.repo_root)).resolve()
    policy_path = Path(os.path.expanduser(args.policy)).resolve()
    output_dir = Path(os.path.expanduser(args.output_dir)).resolve() if args.output_dir else None
    policy = load_policy(policy_path)

    rows = []
    for repo in discover_git_repos(repo_root):
        repo_key = relative_repo_key(repo_root, repo)
        cfg = merge_policy(policy, repo_key)
        canonical_remote = str(cfg.get("canonical_remote", "") or "")
        branch = str(cfg.get("branch", "main") or "main")
        upstream_remote = str(cfg.get("upstream_remote", "") or "")
        mode = str(cfg.get("mode", "mirror_origin"))

        if args.fetch:
            if canonical_remote and remote_exists(repo, canonical_remote):
                git(repo, "fetch", canonical_remote, check=False)
            if upstream_remote and remote_exists(repo, upstream_remote):
                git(repo, "fetch", upstream_remote, check=False)

        local_branch = current_branch(repo)
        local_sha = rev_parse(repo, "HEAD")
        dirty_reason_value, dirty = dirty_reason(repo)

        remote_ref = f"{canonical_remote}/{branch}" if canonical_remote else ""
        has_remote_ref = bool(remote_ref) and ref_exists(repo, remote_ref)
        remote_sha = rev_parse(repo, remote_ref) if has_remote_ref else ""
        ahead_origin, behind_origin = rev_list_counts(repo, "HEAD", remote_ref) if has_remote_ref else (0, 0)

        upstream_ref = f"{upstream_remote}/{branch}" if upstream_remote else ""
        has_upstream_ref = bool(upstream_ref) and ref_exists(repo, upstream_ref)
        upstream_sha = rev_parse(repo, upstream_ref) if has_upstream_ref else ""
        origin_ahead_upstream, origin_behind_upstream = rev_list_counts(repo, remote_ref, upstream_ref) if has_remote_ref and has_upstream_ref else (0, 0)

        rows.append(
            {
                "repo": repo_key,
                "path": str(repo),
                "policy_mode": mode,
                "canonical_remote": canonical_remote,
                "branch": branch,
                "upstream_remote": upstream_remote,
                "local_branch": local_branch,
                "local_sha": local_sha,
                "remote_sha": remote_sha,
                "upstream_sha": upstream_sha,
                "ahead_origin": ahead_origin,
                "behind_origin": behind_origin,
                "dirty": dirty,
                "dirty_reason": dirty_reason_value,
                "local_vs_origin_status": local_vs_origin_status(has_remote_ref, ahead_origin, behind_origin, dirty, mode),
                "origin_vs_upstream_status": origin_vs_upstream_status(
                    mode,
                    has_remote_ref,
                    has_upstream_ref,
                    origin_ahead_upstream,
                    origin_behind_upstream,
                ),
                "origin_ahead_upstream": origin_ahead_upstream,
                "origin_behind_upstream": origin_behind_upstream,
            }
        )

    summary = {
        "repo_root": str(repo_root),
        "policy_path": str(policy_path),
        "rows": rows,
    }

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        with (output_dir / "summary.json").open("w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
            f.write("\n")
        with (output_dir / "report.tsv").open("w", encoding="utf-8") as f:
            headers = [
                "repo",
                "policy_mode",
                "local_vs_origin_status",
                "origin_vs_upstream_status",
                "ahead_origin",
                "behind_origin",
                "dirty",
                "dirty_reason",
                "origin_ahead_upstream",
                "origin_behind_upstream",
                "path",
            ]
            f.write("\t".join(headers) + "\n")
            for row in rows:
                f.write(
                    "\t".join(
                        [
                            str(row[h]).lower() if isinstance(row[h], bool) else str(row[h])
                            for h in headers
                        ]
                    )
                    + "\n"
                )

    json.dump(summary, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
