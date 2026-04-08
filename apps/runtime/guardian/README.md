# weclaw-guardian core

`weclaw-guardian` is the unified control plane for runtime services.

## Commands

```bash
weclaw-guardian monitor --config ~/.weclaw/services.json
weclaw-guardian status --config ~/.weclaw/services.json
weclaw-guardian restart --config ~/.weclaw/services.json --service codex
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
