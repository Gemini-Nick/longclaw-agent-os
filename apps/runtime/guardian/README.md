# weclaw-guardian core

`weclaw-guardian` is the unified supervision plane for Longclaw runtime services.

It belongs to the `Client Runtime（端侧）` layer. It is not the product home, not the
`Governance Console`, and not a second control plane. Its job is strictly
device-side supervision and recovery.

The runtime now exposes a separate `routing-controller` entrypoint for
primary/backup agent routing. `weclaw-guardian` still provides the underlying
health and failover primitives, but the intended boundary is:

- `weclaw-guardian`: service supervision, restart, backoff, health checks
- `routing-controller`: canonical `active-agent.json` reconciliation
- `repo.scheduler`: one-shot automation host that runs routing, harness, roadmap sync, remote companion summaries, and queued task dispatch

User-facing terminology around these services should align with Longclaw's
product language:

- `weclaw` = remote cowork companion
- `reviewed handoff` = reviewed knowledge compatibility path
- `reviewed knowledge plane` = downstream reviewed outputs, not raw runtime inboxes

## Commands

```bash
weclaw-guardian monitor --config ~/.weclaw/services.json
weclaw-guardian status --config ~/.weclaw/services.json
weclaw-guardian restart --config ~/.weclaw/services.json --service codex
routing-controller reconcile
routing-controller status
```

## Config

Configuration file format (JSON):

- `poll_interval_seconds`: monitor cycle interval.
- `log_file`: JSONL event log path.
- `services[]`:
  - `name`: logical service name.
  - `label`: launchd label.
  - `domain`: `system`, `gui`, or `user`.
- `uid`: used for `gui`/`user` domain resolution.
- `restart_base_seconds`: restart backoff base.
- `max_backoff_seconds`: upper bound for backoff.
