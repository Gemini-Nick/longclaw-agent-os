# Controlled Signals runtime activation

These are review instructions, not an executed deployment. The currently installed
wrapper was an unmanaged copy: this change establishes
`apps/runtime/bin/signals-runtime.sh` as its source. The general guardian installer
is intentionally unchanged; do not run that installer to activate this patch.

## Dependencies and behavior

The launchd job is `com.zhangqilong.ai.signals.runtime` in the user's GUI domain,
with RunAtLoad/KeepAlive enabled. Its supervisor owns Web, four lanes, and the
postmarket daemon. Existing supervisors cannot be upgraded in memory: terminating
one child or invoking the old `restart-child` restarts every service. A first
whole-stack migration is necessary; subsequent `restart-web` requests preserve
all other PIDs.

The new command verifies a supervisor PID plus its process start time, then sends
USR1. Only the upgraded supervisor publishes the identity. Both caller and handler
validate Signals' bounded-startup capability before touching Web. The handler sets
`SIGNALS_RUNTIME_STARTUP_PROFILE=bounded_readonly` on the replacement Web. It reports
process creation, not API readiness. Unexpected child failure retains the previous
whole-stack shutdown/KeepAlive behavior.

## First migration (root operator only)

1. Run the mock tests and Signals startup-profile tests. Confirm the Signals gate
   handles run.py, app startup hooks, workbench automatic starts, and the broad
   worker modules. No imported preflight module may perform DB/service work.
2. Back up these two installed files into an explicit timestamped review directory:
   `/Users/zhangqilong/.longclaw/runtime-v2/bin/signals-runtime.sh` and
   `/Users/zhangqilong/Library/LaunchAgents/com.zhangqilong.ai.signals.runtime.plist`.
3. Set only that plist's `EnvironmentVariables.SIGNALS_RUNTIME_STARTUP_PROFILE` to
   `bounded_no_backfill`. Do not use global `launchctl setenv` and do not edit .env.
   Preserve every other field. `plutil -lint` the edited plist.
4. Install the reviewed wrapper using:

   ```sh
   install -m 755 '/Users/zhangqilong/github代码仓库/longclaw-agent-os/apps/runtime/bin/signals-runtime.sh' '/Users/zhangqilong/.longclaw/runtime-v2/bin/signals-runtime.sh'
   ```

5. After the gates and rollback are reviewed, re-register the service to load its
   process environment (kickstart alone does not reload an edited plist):

   ```sh
   launchctl bootout "gui/$(id -u)/com.zhangqilong.ai.signals.runtime"
   launchctl bootstrap "gui/$(id -u)" '/Users/zhangqilong/Library/LaunchAgents/com.zhangqilong.ai.signals.runtime.plist'
   ```

6. Verify the new supervisor and six children, process start times, API health,
   `/api/workbench/shell`'s `session.ready` and read-model freshness, current Git
   blockers, and persisted sync task counts. Inspect task-count deltas to confirm
   no full-market 30m/cache-preheat/backfill task was released. HTTP 200 alone is
   insufficient. Preserve the bounded service profile across crashes.

## Subsequent Web-only activation

```sh
'/Users/zhangqilong/.longclaw/runtime-v2/bin/signals-runtime.sh' restart-web
```

Record all seven PIDs before/after. Only Web must change. Validate API, session,
Git blockers and no broad task-count growth. `restart-child web` is a compatible
alias. Other `restart-child` targets retain their old whole-stack behavior and
must not be used for an isolated activation.

## Rollback

Restore the saved wrapper and reviewed client artifact if needed, but retain the
bounded Signals guards and the service-specific `bounded_no_backfill` environment.
Do not blindly restore a pre-gate plist or Signals tree: that would release the
broad workloads this deployment is meant to block. Re-register only after reviewing
that bounded profile; then repeat every health/task delta check above. Restoring
only the disk wrapper does not change code already running in the supervisor.
