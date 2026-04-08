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

## Harness Loop Service

Install the harness control loop as a user launch agent:

```bash
bash scripts/guardian/install-harness-loop.sh
```

Remove it if needed:

```bash
bash scripts/guardian/uninstall-harness-loop.sh
```
