# Longclaw Agent OS Build Assessment - 2026-04-24

## Commands rerun

- `npm run build`
  - Log: `reports/npm-build-2026-04-24.log`
  - Result: passed
- `npm run build:electron`
  - Log: `reports/npm-build-electron-2026-04-24.log`
  - Result: passed
- `npm run electron:observe -- codex-computer-use-build-runtime-test`
  - Log: `reports/electron-observe-computer-use-2026-04-24.log`
  - Observation: `reports/product-observations/20260424t074635z-codex-computer-use-build-runtime-test/observation.md`
  - Result: passed runtime smoke validation with Computer Use

## Current log findings

### Blocking errors

- None. `tsc` completed successfully.
- None. Electron main, preload, and renderer bundles completed successfully.
- None. Computer Use confirmed the Electron window rendered and primary pages were clickable.

### Warnings

- Electron emitted a dev-only security warning: the renderer has no Content Security Policy or uses `unsafe-eval`.
- Electron emitted a deprecation warning for the `console-message` event argument shape; migrate to `Event<WebContentsConsoleMessageEventParams>`.
- macOS emitted `error messaging the mach port for IMKCFRunLoopWakeUpReliable`; this appears to be an input-method/system log line and did not block rendering or clicks in this run.

### Runtime validation

- Renderer lifecycle: `renderer.did-finish-load` recorded.
- Computer Use rendered window title: `隆小侠 Agent OS`.
- Strategy page: visible and updated from Signals web1.
- WeChat page: visible; session source rendered.
- Factory page: visible; plugin/skill/runtime sections rendered; Signals web1 and web2 showed `可用`.
- Backtest page: visible; `运行` on `002759 daily` returned `55 signals`, `24 trades` in the UI, and the observation event recorded `signals=55`, `trades=27`.
- Execution page: visible; due-diligence runtime showed `fetch failed` / `降级`, which is a surfaced downstream-service state rather than an Electron crash.
- Observation summary: `events=60`, `api_timings=39`, `error_events=0`, `failed_api=0`.
- Slowest API in this run: `/api/backtest/analyze?...` at `395ms`, status `200`.

### Observability gaps

- The `npm run build` log only shows the npm script header and `tsc`; it does not report elapsed time, TypeScript version, Node/npm version, output directory, or emitted file count.
- The `npm run build:electron` log only shows three esbuild steps and `Build complete.`; it does not print bundle sizes, build duration, sourcemap status, or destination paths.
- The Electron build script does not enable esbuild `metafile`, so bundle composition cannot be inspected when `renderer/main.js` grows.
- The plain build pipeline verifies static compilation only. Runtime coverage currently depends on the separate observed Electron wrapper.

## Artifact snapshot

- `dist`: 58M
- `electron/dist`: 2.0M
- `electron/dist/main.cjs`: 569K
- `electron/dist/preload.cjs`: 4.9K
- `electron/dist/renderer/main.js`: 1.4M
- `electron/dist/renderer/index.html`: 3.4K

## Optimization plan

1. Add a `scripts/build-report.mjs` wrapper that records command, versions, elapsed time, exit code, and artifact sizes into `reports/build-latest.json`.
2. Update `electron/build.mjs` to print resolved output paths and file sizes after each bundle.
3. Enable optional esbuild `metafile` output behind `BUILD_ANALYZE=1` for bundle growth diagnosis without slowing normal builds.
4. Add a smoke command such as `npm run electron:smoke` that wraps `electron:observe`, exercises a minimal page-click path, and fails on renderer `console.error`, `did-fail-load`, `render-process-gone`, or failed API timings.
5. Fix the renderer CSP warning by adding a production-safe Content Security Policy in `electron/src/renderer/index.html` or equivalent response metadata.
6. Migrate the Electron `console-message` handler to the new event object signature before the old arguments are removed.
7. Add a CI/local quality shortcut that runs `npm run build && npm run build:electron && npm test` when broader verification is needed.
