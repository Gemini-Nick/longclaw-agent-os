# Guardian v2 Migration

This folder contains migration and lifecycle scripts for moving from legacy
`weclaw/watchdog/guardian` loops to launchd-managed services with a single
`weclaw-guardian` control plane.

## Workflow

1. Inventory legacy runtime state:

```bash
bash scripts/guardian/inventory-legacy.sh
```

2. Build guardian core binary (requires Go):

```bash
bash scripts/guardian/build-core.sh
```

3. Install v2 services (default: user-only launch agents):

```bash
bash scripts/guardian/install-v2.sh
```

After install, use guardian command entry:

```bash
weguard status
weguard restart codex
weguard runtime-status
```

Use mixed mode (codex + monitor as system daemons templates):

```bash
bash scripts/guardian/install-v2.sh --mixed
```

4. Verify v2 runtime:

```bash
bash scripts/guardian/verify-v2.sh
```

Import archived Claude project history into Obsidian knowledge/raw layers:

```bash
python3 scripts/guardian/import-claude-project-archives.py
```

5. Retire legacy launch labels/scripts after validation:

```bash
bash scripts/guardian/retire-legacy.sh
```

6. Rollback if needed:

```bash
bash scripts/guardian/rollback-v2.sh
```

## Harness Entry

Harness is now expected to run as a one-shot runtime tool instead of a dedicated launchd loop:

```bash
~/.longclaw/runtime-v2/bin/routing-controller reconcile
~/.longclaw/runtime-v2/bin/routing-controller status
~/.longclaw/runtime-v2/bin/runtime-status
~/.longclaw/runtime-v2/bin/harness tick
~/.longclaw/runtime-v2/bin/harness brief
~/.longclaw/runtime-v2/bin/harness doctor
~/.longclaw/runtime-v2/bin/harness eval watchdog
python3 ~/.longclaw/runtime-v2/bin/runtime-wechat-control.py send-summary
python3 ~/.longclaw/runtime-v2/bin/runtime-wechat-control.py dispatch-next-task
```

The installed runtime also provides `runtime-roadmap-sync.py` and `runtime-wechat-control.py`, which consume routing and harness outputs and update:

- `~/.longclaw/runtime-v2/state/roadmap-queue.json`
- `~/.longclaw/runtime-v2/state/weclaw-ingress.json`
- `~/.longclaw/runtime-v2/state/knowledge-projection.json`
- `~/.longclaw/runtime-v2/state/wechat-task-queue.json`
- `~/.longclaw/runtime-v2/state/wechat-notification-state.json`
- `00 Dashboard/Longclaw Runtime.md`
- `hermes-agent/docs/longclaw/status/runtime-status-latest.*`
