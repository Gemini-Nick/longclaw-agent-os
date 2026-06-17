import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import http from 'http'
import net from 'net'
import { execFile, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import PptxGenJS from 'pptxgenjs'
import { createBackend, AgentBackend, AgentMode } from './agent-backend.js'
import { inspectConfiguredAcpBridge } from './acp-client.js'
import {
  dispatchToLocalRuntimeApi,
  normalizeLocalRuntimeSeatPreference,
  probeLocalRuntimeSeat,
  resolveLocalRuntimeSeat,
  type LocalRuntimeSeat,
  type LocalRuntimeSeatPreference,
  type LocalRuntimeSeatResolution,
} from './local-runtime-seat.js'
import {
  readRuntimeCapabilityRegistry,
  registerRuntimeCapability,
  removeRuntimeCapability,
  rescanRuntimeCapabilityRegistry,
  runtimeDiscoveryRoots,
  type RuntimeCapabilityKind,
  type RuntimeCapabilityRegistry,
} from './runtime/capabilityRegistry.js'
import {
  canonicalWeclawSessionId,
  mergeWeclawSessionUiFlags,
  normalizeWeclawSessionUiState,
  type WeclawSessionUiState,
} from './runtime/weclawSessionState.js'
import {
  completeWeChatBindingSession,
  createWeChatBindingSession,
  mergePluginDevIssue,
  readPluginDevState,
  readWeChatBindingStatus,
  registerPluginDevArtifact,
  revokeWeChatBinding,
  routeWeChatMessage,
  runPluginDevCi,
  startPluginDevImplementation,
  updateWeChatBindingScanStatus,
} from './runtime/wechatPluginDev.js'
import {
  completeWeChatClusterBindingSession,
  createWeChatClusterBindingSession,
  markWeChatClusterNodeHealth,
  readWeChatClusterState,
  type WeChatClusterBinding,
  type WeChatClusterNodeSeed,
} from './runtime/wechatCluster.js'
import { createLongclawControlPlaneClientFromEnv } from '../../src/services/longclawControlPlane/client.js'
import {
  LongclawCapabilitySubstrateSummarySchema,
  type LongclawCapabilityEntry,
  type LongclawCapabilitySubstrateSummary,
  type LongclawDomainPackDescriptor,
  type LongclawLaunchIntent,
  type LongclawLaunchMention,
  type LongclawTask,
  LongclawLaunchIntentSchema,
  LongclawLaunchReceiptSchema,
  LongclawRunSchema,
  LongclawTaskSchema,
  LongclawWorkItemSchema,
} from '../../src/services/longclawControlPlane/models.js'

const ELECTRON_DIST_DIR = __dirname
const REPO_ROOT = path.resolve(ELECTRON_DIST_DIR, '..', '..')
const PRODUCT_OBSERVATION_ROOT = path.resolve(
  process.env.LONGCLAW_OBSERVATION_ROOT
    || (
      app.isPackaged
        ? path.join(app.getPath('userData'), 'product-observations')
        : path.join(REPO_ROOT, 'reports', 'product-observations')
    ),
)
const LONGCLAW_LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Longclaw')
const OBSERVATION_PRODUCT_LINE = 'longclaw-electron-signals'

function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(REPO_ROOT, 'electron', 'build-resources', 'icon.png'),
  ]
  return candidates.find(candidate => candidate && fs.existsSync(candidate))
}

type ObservationCounterKey = 'events' | 'api_timings' | 'main_logs' | 'renderer_errors'

type ObservationState = {
  run_id: string
  product_line: string
  scenario: string
  started_at: string
  repo_root: string
  observation_dir: string
  logs: {
    electron_current: string
    electron_session: string
    electron_observation: string
  }
  git: {
    sha: string | null
    dirty: boolean
    status_short: string
  }
  runtime: {
    electron_pid: number
    node_version: string
    platform: string
    signals_web_port: string
  }
  counters: Record<ObservationCounterKey, number>
  memory_refs: string[]
}

function timestampSlug(value = new Date()): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function sanitizeSlug(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function safeExecGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const observationStartedAt = new Date()
const observationScenario = sanitizeSlug(
  process.env.LONGCLAW_OBSERVATION_SCENARIO ?? 'manual-electron-session',
  'manual-electron-session',
)
const observationRunId = sanitizeSlug(
  process.env.LONGCLAW_OBSERVATION_RUN_ID ?? `${timestampSlug(observationStartedAt)}-${observationScenario}`,
  `${timestampSlug(observationStartedAt)}-${observationScenario}`,
)
const observationDir = path.resolve(
  process.env.LONGCLAW_OBSERVATION_DIR || path.join(PRODUCT_OBSERVATION_ROOT, observationRunId),
)
const observationScreenshotsDir = path.join(observationDir, 'screenshots')
const electronSessionLogPath = path.join(
  LONGCLAW_LOG_DIR,
  `electron-${timestampSlug(observationStartedAt)}.log`,
)
const electronCurrentLogPath = path.join(LONGCLAW_LOG_DIR, 'electron-current.log')
const observationElectronLogPath = path.join(observationDir, 'electron.log')
const observationEventsPath = path.join(observationDir, 'events.jsonl')
const observationApiTimingsPath = path.join(observationDir, 'api-timings.jsonl')
const observationJsonPath = path.join(observationDir, 'observation.json')
const observationMarkdownPath = path.join(observationDir, 'observation.md')

const gitStatusShort = safeExecGit(['status', '--short']) ?? ''
const observationState: ObservationState = {
  run_id: observationRunId,
  product_line: OBSERVATION_PRODUCT_LINE,
  scenario: observationScenario,
  started_at: observationStartedAt.toISOString(),
  repo_root: REPO_ROOT,
  observation_dir: observationDir,
  logs: {
    electron_current: electronCurrentLogPath,
    electron_session: electronSessionLogPath,
    electron_observation: observationElectronLogPath,
  },
  git: {
    sha: safeExecGit(['rev-parse', '--short', 'HEAD']),
    dirty: Boolean(gitStatusShort),
    status_short: gitStatusShort,
  },
  runtime: {
    electron_pid: process.pid,
    node_version: process.version,
    platform: `${process.platform}-${process.arch}`,
    signals_web_port: process.env.LONGCLAW_SIGNALS_WEB_PORT ?? '8011',
  },
  counters: {
    events: 0,
    api_timings: 0,
    main_logs: 0,
    renderer_errors: 0,
  },
  memory_refs: [],
}

function ensureObservationFiles() {
  fs.mkdirSync(LONGCLAW_LOG_DIR, { recursive: true })
  fs.mkdirSync(observationScreenshotsDir, { recursive: true })
  fs.writeFileSync(electronCurrentLogPath, '', 'utf-8')
  for (const filePath of [observationEventsPath, observationApiTimingsPath, observationElectronLogPath]) {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', 'utf-8')
  }
  writeObservationJson()
  if (!fs.existsSync(observationMarkdownPath)) {
    fs.writeFileSync(observationMarkdownPath, renderObservationMarkdown(), 'utf-8')
  }
}

function readExistingObservationJson(): Record<string, unknown> {
  try {
    if (!fs.existsSync(observationJsonPath)) return {}
    const parsed = JSON.parse(fs.readFileSync(observationJsonPath, 'utf-8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function mergeMemoryRefs(...values: unknown[]): string[] {
  const refs = new Set<string>()
  for (const value of values) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) refs.add(item)
    }
  }
  return [...refs].sort()
}

function writeObservationJson() {
  try {
    fs.mkdirSync(observationDir, { recursive: true })
    const existing = readExistingObservationJson()
    const payload = {
      ...existing,
      ...observationState,
      memory_refs: mergeMemoryRefs(existing.memory_refs, observationState.memory_refs),
    }
    fs.writeFileSync(
      observationJsonPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    )
  } catch (error) {
    process.stderr.write(`[longxiaoxia] failed to write observation.json ${String(error)}\n`)
  }
}

function renderObservationMarkdown(): string {
  return [
    `# Longclaw 产品观察日记`,
    ``,
    `## 假设`,
    ``,
    `本次观察用于保留 Electron + Signals 人工体验和自动 smoke 的上下文；具体问题由 events/api-timings/electron.log 共同复盘。`,
    ``,
    `## 复现`,
    ``,
    `打开 Electron 后按场景执行操作，页面行为、tab/周期/标的切换和 API 请求会写入本目录。`,
    ``,
    `## 最小改动`,
    ``,
    `本轮先建立观察日记、持久日志和 API telemetry，不改 control-plane schema。`,
    ``,
    `## 验证`,
    ``,
    `检查 observation.json、events.jsonl、api-timings.jsonl、electron.log 是否完整生成；必要时运行 observation:finalize 写入 MemPalace。`,
    ``,
    `## 上下文`,
    ``,
    `- run_id: ${observationState.run_id}`,
    `- product_line: ${observationState.product_line}`,
    `- scenario: ${observationState.scenario}`,
    `- started_at: ${observationState.started_at}`,
    `- git_sha: ${observationState.git.sha ?? 'unknown'}`,
    `- git_dirty: ${observationState.git.dirty ? 'yes' : 'no'}`,
    `- electron_pid: ${observationState.runtime.electron_pid}`,
    `## 证据路径`,
    ``,
    `- observation.json: ${observationJsonPath}`,
    `- events.jsonl: ${observationEventsPath}`,
    `- api-timings.jsonl: ${observationApiTimingsPath}`,
    `- electron.log: ${observationElectronLogPath}`,
    `- screenshots: ${observationScreenshotsDir}`,
    ``,
  ].join('\n')
}

function appendLine(filePath: string, line: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${line}\n`, 'utf-8')
}

function writePersistentLog(line: string) {
  try {
    appendLine(electronSessionLogPath, line)
    fs.writeFileSync(electronCurrentLogPath, `${line}\n`, { encoding: 'utf-8', flag: 'a' })
    appendLine(observationElectronLogPath, line)
    observationState.counters.main_logs += 1
    writeObservationJson()
  } catch (error) {
    process.stderr.write(`[longxiaoxia] failed to persist log ${String(error)}\n`)
  }
}

function log(...args: any[]) {
  const msg = args.map(stringifyLogValue).join(' ')
  const line = `[${new Date().toISOString()}] [longxiaoxia] ${msg}`
  process.stderr.write(`${line}\n`)
  writePersistentLog(line)
}

let wechatBindingCallbackServer: http.Server | null = null
let wechatBindingCallbackPort = Number.isFinite(WECHAT_BINDING_CALLBACK_PORT)
  ? WECHAT_BINDING_CALLBACK_PORT
  : 18744
let activeWechatIlinkPoller: { sessionId: string; cancelled: boolean } | null = null
const WECLAW_BRIDGE_LAUNCHD_LABEL =
  process.env.LONGCLAW_WECLAW_BRIDGE_LAUNCHD_LABEL ?? 'com.zhangqilong.ai.weclaw.bridge'

type IlinkQrResponse = {
  qrcode?: string
  qrcode_img_content?: string
}

type IlinkQrStatusResponse = {
  status?: string
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

function localNetworkAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  }
  return '127.0.0.1'
}

function wechatBindingCallbackBaseUrl(): string {
  return `http://${localNetworkAddress()}:${wechatBindingCallbackPort}`
}

function wechatIlinkBaseUrl(): string {
  return (process.env.LONGCLAW_WECHAT_ILINK_BASE_URL ?? 'https://ilinkai.weixin.qq.com').replace(
    /\/+$/g,
    '',
  )
}

function normalizeIlinkAccountId(raw: string): string {
  return path.basename(raw.replace(/[@.:]/g, '-')) || `ilink-${Date.now()}`
}

function saveIlinkCredentials(creds: Required<Pick<IlinkQrStatusResponse, 'bot_token' | 'ilink_bot_id'>> & IlinkQrStatusResponse): string {
  const accountsDir = path.join(os.homedir(), '.weclaw', 'accounts')
  fs.mkdirSync(accountsDir, { recursive: true, mode: 0o700 })
  const accountPath = path.join(accountsDir, `${normalizeIlinkAccountId(creds.ilink_bot_id)}.json`)
  fs.writeFileSync(
    accountPath,
    `${JSON.stringify(
      {
        bot_token: creds.bot_token,
        ilink_bot_id: creds.ilink_bot_id,
        baseurl: creds.baseurl ?? wechatIlinkBaseUrl(),
        ilink_user_id: creds.ilink_user_id,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf-8', mode: 0o600 },
  )
  fs.chmodSync(accountPath, 0o600)
  return accountPath
}

function findWeChatClusterBindingBySession(sessionId: string): WeChatClusterBinding | undefined {
  return getWeChatClusterStatus().bindings.find(binding => binding.binding_session_id === sessionId)
}

function writeIlinkCredentialsToRemoteNode(
  nodeId: string,
  creds: Required<Pick<IlinkQrStatusResponse, 'bot_token' | 'ilink_bot_id'>> & IlinkQrStatusResponse,
): string {
  const node = getWeChatClusterStatus().nodes.find(item => item.node_id === nodeId)
  if (!node) throw new Error(`WeChat cluster node not found: ${nodeId}`)
  const accountFile = `${normalizeIlinkAccountId(creds.ilink_bot_id)}.json`
  const remotePath = `~/.weclaw/accounts/${accountFile}`
  const payload = `${JSON.stringify(
    {
      bot_token: creds.bot_token,
      ilink_bot_id: creds.ilink_bot_id,
      baseurl: creds.baseurl ?? wechatIlinkBaseUrl(),
      ilink_user_id: creds.ilink_user_id,
    },
    null,
    2,
  )}\n`
  execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=8',
      node.ssh_host,
      `umask 077; mkdir -p "$HOME/.weclaw/accounts" "$HOME/.weclaw/workspace"; cat > "$HOME/.weclaw/accounts/${accountFile}"; chmod 600 "$HOME/.weclaw/accounts/${accountFile}"`,
    ],
    {
      encoding: 'utf-8',
      input: payload,
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  return remotePath
}

function startRemoteWeclawBridge(nodeId: string) {
  const node = getWeChatClusterStatus().nodes.find(item => item.node_id === nodeId)
  if (!node) throw new Error(`WeChat cluster node not found: ${nodeId}`)
  const output = execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=8',
      node.ssh_host,
      [
        'set -e',
        'mkdir -p "$HOME/.weclaw"',
        'if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":18011 "; then echo already-running; exit 0; fi',
        'if [ ! -x "$HOME/.weclaw/bin/weclaw-real" ]; then echo missing-weclaw-real >&2; exit 2; fi',
        'nohup "$HOME/.weclaw/bin/weclaw-real" start -f > "$HOME/.weclaw/weclaw.log" 2>&1 &',
        'echo $! > "$HOME/.weclaw/weclaw.pid"',
        'sleep 2',
        'if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":18011 "; then echo listener=18011; else echo listener=missing; fi',
      ].join('; '),
    ],
    { encoding: 'utf-8', timeout: 18_000 },
  )
  markWeChatClusterNodeHealth(WECHAT_CLUSTER_STATE_PATH, {
    nodeId,
    status: output.includes('listener=18011') || output.includes('already-running') ? 'online' : 'degraded',
    lastError:
      output.includes('listener=18011') || output.includes('already-running')
        ? undefined
        : 'Remote WeClaw started but listener 18011 was not detected.',
    defaultNodes: getConfiguredWeChatClusterNodes(),
  })
}

function kickstartWeclawBridgeAfterBinding(accountPath: string) {
  const target = `gui/${os.userInfo().uid}/${WECLAW_BRIDGE_LAUNCHD_LABEL}`
  try {
    execFileSync('launchctl', ['kickstart', '-k', target], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    })
    log('wechat ilink binding kickstarted weclaw bridge', {
      launchd_label: WECLAW_BRIDGE_LAUNCHD_LABEL,
      account_path: accountPath,
    })
  } catch (error) {
    const details =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error)
    log('wechat ilink binding could not kickstart weclaw bridge', {
      launchd_label: WECLAW_BRIDGE_LAUNCHD_LABEL,
      account_path: accountPath,
      error: details,
    })
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
    return JSON.parse(body) as unknown
  } finally {
    clearTimeout(timer)
  }
}

async function fetchIlinkBindingQr(): Promise<IlinkQrResponse> {
  const payload = (await fetchJsonWithTimeout(
    `${wechatIlinkBaseUrl()}/ilink/bot/get_bot_qrcode?bot_type=3`,
    20_000,
  )) as IlinkQrResponse
  if (!payload.qrcode || !payload.qrcode_img_content) {
    throw new Error('iLink QR response missing qrcode fields.')
  }
  return payload
}

function cancelWechatIlinkPolling() {
  if (activeWechatIlinkPoller) activeWechatIlinkPoller.cancelled = true
  activeWechatIlinkPoller = null
}

function startWechatIlinkPolling(sessionId: string, ilinkQrcode: string) {
  cancelWechatIlinkPolling()
  const poller = { sessionId, cancelled: false }
  activeWechatIlinkPoller = poller
  void pollWechatIlinkBinding(poller, ilinkQrcode).catch(error => {
    log('wechat ilink polling failed', {
      session_id: sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
    updateWeChatBindingScanStatus(WECHAT_BINDING_STATE_PATH, {
      bindingSessionId: sessionId,
      scanStatus: 'wait',
      identityStatus: 'ilink_failed',
      identityError: error instanceof Error ? error.message : String(error),
    })
  })
}

async function pollWechatIlinkBinding(
  poller: { sessionId: string; cancelled: boolean },
  ilinkQrcode: string,
) {
  const statusUrl = `${wechatIlinkBaseUrl()}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(ilinkQrcode)}`
  let lastStatus = ''
  while (!poller.cancelled) {
    const payload = (await fetchJsonWithTimeout(statusUrl, 45_000)) as IlinkQrStatusResponse
    const scanStatus =
      payload.status === 'scaned' ||
      payload.status === 'confirmed' ||
      payload.status === 'expired'
        ? payload.status
        : 'wait'
    if (scanStatus !== lastStatus) {
      lastStatus = scanStatus
      log('wechat ilink qr status', {
        session_id: poller.sessionId,
        scan_status: scanStatus,
        has_ilink_bot_id: Boolean(payload.ilink_bot_id),
        has_ilink_user_id: Boolean(payload.ilink_user_id),
        has_bot_token: Boolean(payload.bot_token),
      })
    }

    if (scanStatus === 'scaned') {
      updateWeChatBindingScanStatus(WECHAT_BINDING_STATE_PATH, {
        bindingSessionId: poller.sessionId,
        scanStatus,
        identityStatus: 'ilink_scanned',
        identityNote: 'QR scanned in WeChat; waiting for phone confirmation.',
      })
    } else if (scanStatus === 'expired') {
      updateWeChatBindingScanStatus(WECHAT_BINDING_STATE_PATH, {
        bindingSessionId: poller.sessionId,
        scanStatus,
        identityStatus: 'ilink_failed',
        identityNote: 'iLink QR expired before confirmation.',
      })
      return
    } else if (scanStatus === 'confirmed') {
      if (!payload.bot_token || !payload.ilink_bot_id || !payload.ilink_user_id) {
        throw new Error('iLink confirmed without required identity fields.')
      }
      const accountPath = saveIlinkCredentials({
        bot_token: payload.bot_token,
        ilink_bot_id: payload.ilink_bot_id,
        baseurl: payload.baseurl ?? wechatIlinkBaseUrl(),
        ilink_user_id: payload.ilink_user_id,
        status: payload.status,
      })
      let remoteAccountPath: string | undefined
      const clusterBinding = findWeChatClusterBindingBySession(poller.sessionId)
      if (clusterBinding) {
        remoteAccountPath = writeIlinkCredentialsToRemoteNode(clusterBinding.node_id, {
          bot_token: payload.bot_token,
          ilink_bot_id: payload.ilink_bot_id,
          baseurl: payload.baseurl ?? wechatIlinkBaseUrl(),
          ilink_user_id: payload.ilink_user_id,
          status: payload.status,
        })
        completeWeChatClusterBindingSession(WECHAT_CLUSTER_STATE_PATH, {
          bindingId: clusterBinding.binding_id,
          accountId: payload.ilink_user_id,
          displayName: `iLink ${payload.ilink_user_id}`,
          remoteAccountPath,
          defaultNodes: getConfiguredWeChatClusterNodes(),
        })
      }
      const bound = completeWeChatBindingSession(WECHAT_BINDING_STATE_PATH, {
        bindingSessionId: poller.sessionId,
        provider: 'ilink_service_account',
        wechatUserId: payload.ilink_user_id,
        ilinkBotId: payload.ilink_bot_id,
        ilinkUserId: payload.ilink_user_id,
        ilinkBaseurl: payload.baseurl ?? wechatIlinkBaseUrl(),
        botTokenPresent: true,
        accountPath,
        identityStatus: 'ilink_verified',
        identityNote: 'iLink QR confirmed; token stored in runtime account file and hidden from renderer.',
      })
      log('wechat ilink binding completed', {
        session_id: bound.binding_session_id,
        has_ilink_bot_id: Boolean(bound.ilink_bot_id),
        has_ilink_user_id: Boolean(bound.ilink_user_id),
        account_saved: Boolean(bound.account_path),
        bound_at: bound.bound_at,
      })
      if (clusterBinding) {
        startRemoteWeclawBridge(clusterBinding.node_id)
        log('wechat cluster remote binding completed', {
          session_id: bound.binding_session_id,
          node_id: clusterBinding.node_id,
          remote_account_saved: Boolean(remoteAccountPath),
        })
      } else {
        kickstartWeclawBridgeAfterBinding(accountPath)
      }
      return
    }
  }
}

async function createIlinkWeChatBindingSession() {
  const qr = await fetchIlinkBindingQr()
  const status = createWeChatBindingSession(WECHAT_BINDING_STATE_PATH, {
    provider: 'ilink_service_account',
    qrUrl: qr.qrcode_img_content,
    ilinkQrcode: qr.qrcode,
    ilinkBaseurl: wechatIlinkBaseUrl(),
    identityNote: 'iLink QR issued; scan with WeChat and confirm on phone.',
    expiresInMs: 2 * 60 * 1000,
  })
  if (status.binding_session_id) {
    const cluster = createClusterBindingSessionWithProbe({
      bindingSessionId: status.binding_session_id,
      qrUrl: status.qr_url,
      expiresInMs: 2 * 60 * 1000,
    })
    log('wechat cluster qr assigned', {
      session_id: status.binding_session_id,
      node_id: cluster.binding.node_id,
      selection_reason: cluster.selection_reason,
    })
  }
  log('wechat ilink qr created', {
    session_id: status.binding_session_id,
    expires_at: status.expires_at,
    ilink_baseurl: status.ilink_baseurl,
  })
  if (status.binding_session_id && qr.qrcode) startWechatIlinkPolling(status.binding_session_id, qr.qrcode)
  return status
}

function createLocalWeChatBindingSession(identityOverride?: { status?: 'ilink_failed'; note?: string }) {
  const status = createWeChatBindingSession(WECHAT_BINDING_STATE_PATH, {
    provider: 'local_lan_callback',
    qrUrlBase: wechatBindingCallbackBaseUrl(),
    identityStatus: identityOverride?.status,
    identityNote: identityOverride?.note,
  })
  log('wechat local binding qr created', {
    session_id: status.binding_session_id,
    qr_url: status.qr_url,
    expires_at: status.expires_at,
  })
  return status
}

function sendWechatBindingHtml(
  response: http.ServerResponse,
  statusCode: number,
  title: string,
  body: string,
) {
  response.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' })
  response.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 28px; font: 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
    main { max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #d1d5db; border-radius: 12px; background: #fff; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0; line-height: 1.6; color: #4b5563; }
  </style>
</head>
<body><main><h1>${title}</h1><p>${body}</p></main></body>
</html>`)
}

function startWechatBindingCallbackServer() {
  if (wechatBindingCallbackServer) return
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    if (requestUrl.pathname !== '/wechat/bind') {
      sendWechatBindingHtml(response, 404, '未找到绑定入口', '请重新扫描 Agent OS 里的微信绑定二维码。')
      return
    }
    const sessionId = requestUrl.searchParams.get('session') ?? ''
    const remoteAddress = request.socket.remoteAddress ?? 'unknown'
    log('wechat binding scan received', {
      session_id: sessionId,
      remote_address: remoteAddress,
      user_agent: request.headers['user-agent'],
    })
    try {
      const status = completeWeChatBindingSession(WECHAT_BINDING_STATE_PATH, {
        bindingSessionId: sessionId,
        provider: 'local_lan_callback',
        wechatUserId: `wechat-scan-${sessionId.slice(-8)}`,
        displayName: 'WeChat scanner',
        scanRemoteAddress: remoteAddress,
        scanUserAgent:
          typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent']
            : undefined,
        identityStatus: 'local_runtime_bound',
        identityNote:
          'Local LAN QR callback reached runtime. This proves scan-to-runtime only; it is not OpenID/iLink identity proof.',
      })
      log('wechat binding scan completed', {
        session_id: status.binding_session_id,
        wechat_user_id: status.wechat_user_id,
        bound_at: status.bound_at,
      })
      sendWechatBindingHtml(
        response,
        200,
        '绑定成功',
        '微信扫码已被本机 Agent OS 接收。现在可以回到 Electron 查看绑定状态。',
      )
    } catch (error) {
      log('wechat binding scan failed', {
        session_id: sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
      sendWechatBindingHtml(
        response,
        400,
        '绑定失败',
        error instanceof Error ? error.message : String(error),
      )
    }
  })
  server.on('error', error => {
    log('wechat binding callback server failed', error)
  })
  server.listen(wechatBindingCallbackPort, '0.0.0.0', () => {
    const address = server.address()
    if (address && typeof address === 'object') wechatBindingCallbackPort = address.port
    log('wechat binding callback server listening', wechatBindingCallbackBaseUrl())
  })
  wechatBindingCallbackServer = server
}

function compactObservationValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.length > 2_000 ? `${value.slice(0, 2_000)}…[truncated]` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 50).map(compactObservationValue)
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      result[key] = compactObservationValue(nested)
    }
    return result
  }
  return String(value)
}

function classifyRendererConsoleMessage(
  level: number,
  message: string,
): { level: 'info' | 'warning' | 'error'; category?: string; dev_only?: boolean } {
  if (message.includes('Electron Security Warning')) {
    return {
      level: 'warning',
      category: 'electron-security-warning',
      dev_only: true,
    }
  }
  if (level >= 2) return { level: 'error' }
  if (level === 1) return { level: 'warning' }
  return { level: 'info' }
}

function appendObservationJsonl(
  filePath: string,
  counter: 'events' | 'api_timings',
  payload: Record<string, unknown>,
) {
  try {
    appendLine(
      filePath,
      JSON.stringify({
        at: new Date().toISOString(),
        run_id: observationState.run_id,
        ...(compactObservationValue(payload) as Record<string, unknown>),
      }),
    )
    observationState.counters[counter] += 1
    if (payload.level === 'error' || payload.ok === false) {
      observationState.counters.renderer_errors += 1
    }
    writeObservationJson()
  } catch (error) {
    log('failed to append observation jsonl', { filePath, error: String(error) })
  }
}

ensureObservationFiles()

const STACK_ENV_PATH = path.join(os.homedir(), '.longclaw', 'runtime-v2', 'stack.env')
const LONGCLAW_RUNTIME_DIR = path.join(os.homedir(), '.longclaw', 'runtime-v2')
const CAPABILITY_MANAGER_SETTINGS_PATH = path.join(
  LONGCLAW_RUNTIME_DIR,
  'capability-manager.json',
)
const CAPABILITY_REGISTRY_PATH = path.join(LONGCLAW_RUNTIME_DIR, 'capability-registry.json')
const MODEL_SERVICE_SETTINGS_PATH = path.join(LONGCLAW_RUNTIME_DIR, 'model-service.json')
const EMPLOYEE_DEFINITIONS_DIR = path.join(LONGCLAW_RUNTIME_DIR, 'employees')
const EMPLOYEE_SUPPORT_SKILLS_DIR = path.join(LONGCLAW_RUNTIME_DIR, 'skills')
const DUE_DILIGENCE_RPA_RUNS_DIR = path.join(LONGCLAW_RUNTIME_DIR, 'rpa-runs')
const PPT_TOOL_RUNS_DIR = path.join(LONGCLAW_RUNTIME_DIR, 'ppt-tool-runs')
const WECLAW_SESSION_UI_STATE_PATH = path.join(
  LONGCLAW_RUNTIME_DIR,
  'weclaw-session-state.json',
)
const WECHAT_BINDING_STATE_PATH = path.join(LONGCLAW_RUNTIME_DIR, 'wechat-binding.json')
const WECHAT_CLUSTER_STATE_PATH = path.join(LONGCLAW_RUNTIME_DIR, 'wechat-cluster.json')
const PLUGIN_DEV_STATE_PATH = path.join(LONGCLAW_RUNTIME_DIR, 'plugin-dev.json')
const WECHAT_BINDING_CALLBACK_PORT = Number(process.env.LONGCLAW_WECHAT_BIND_PORT ?? 18744)
const WECLAW_CONFIG_PATH = path.join(os.homedir(), '.weclaw', 'config.json')
const DEFAULT_WECLAW_WORKSPACE = path.join(os.homedir(), '.weclaw', 'workspace')

function stripShellQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function loadRuntimeStackEnv(): { loaded: boolean; path: string; appliedKeys: string[] } {
  if (!fs.existsSync(STACK_ENV_PATH)) {
    return { loaded: false, path: STACK_ENV_PATH, appliedKeys: [] }
  }

  const appliedKeys: string[] = []
  try {
    const raw = fs.readFileSync(STACK_ENV_PATH, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = stripShellQuotes(trimmed.slice(separatorIndex + 1))
      if (!key || process.env[key]) continue
      process.env[key] = value
      appliedKeys.push(key)
    }
  } catch (error) {
    log('failed to load stack env', STACK_ENV_PATH, error)
    return { loaded: false, path: STACK_ENV_PATH, appliedKeys: [] }
  }

  if (!process.env.LONGCLAW_AGENT_OS_BASE_URL && process.env.LONGCLAW_HERMES_AGENT_OS_BASE_URL) {
    process.env.LONGCLAW_AGENT_OS_BASE_URL = process.env.LONGCLAW_HERMES_AGENT_OS_BASE_URL
  }
  if (!process.env.LONGCLAW_AGENT_OS_API_KEY && process.env.LONGCLAW_HERMES_API_KEY) {
    process.env.LONGCLAW_AGENT_OS_API_KEY = process.env.LONGCLAW_HERMES_API_KEY
  }

  return { loaded: true, path: STACK_ENV_PATH, appliedKeys }
}

const runtimeStackEnv = loadRuntimeStackEnv()

let mainWindow: BrowserWindow | null = null
let backend: AgentBackend | null = null
let controlPlaneClient = createLongclawControlPlaneClientFromEnv()
let currentCwd = process.env.AGENT_CWD || app.getPath('home')
let localRuntimeSeatPreference: LocalRuntimeSeatPreference =
  normalizeLocalRuntimeSeatPreference(process.env.LONGCLAW_LOCAL_RUNTIME_SEAT_OVERRIDE)
const DEFAULT_LOCALE = 'zh-CN'

function getAgentMode(): AgentMode {
  return (process.env.AGENT_MODE as AgentMode) || 'codex-app-server'
}

function windowTitleForLocale(locale: string): string {
  return locale === 'en-US' ? 'Longclaw Agent OS' : '隆小侠 Agent OS'
}

function applyWindowLocale(locale: string) {
  if (!mainWindow) return
  mainWindow.setTitle(windowTitleForLocale(locale))
}

function createWindow() {
  const appIconPath = resolveAppIconPath()
  if (process.platform === 'darwin' && appIconPath) {
    app.dock?.setIcon(nativeImage.createFromPath(appIconPath))
  }
  log('creating electron window', {
    run_id: observationState.run_id,
    observation_dir: observationState.observation_dir,
    app_icon_path: appIconPath,
  })
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    x: 80,
    y: 30,
    title: windowTitleForLocale(DEFAULT_LOCALE),
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.show()
    mainWindow.moveTop()
    mainWindow.focus()
    setTimeout(() => {
      if (!mainWindow) return
      mainWindow.setAlwaysOnTop(false)
      mainWindow.setVisibleOnAllWorkspaces(false)
    }, 1200)
    log('electron window ready-to-show', {
      visible: mainWindow.isVisible(),
      focused: mainWindow.isFocused(),
      bounds: mainWindow.getBounds(),
    })
  })
  mainWindow.show()
  mainWindow.focus()

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    log('renderer did-fail-load', { code, description, validatedURL })
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'electron-main',
      name: 'renderer.did-fail-load',
      level: 'error',
      code,
      description,
      validatedURL,
    })
  })

  mainWindow.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      const classification = classifyRendererConsoleMessage(level, message)
      log('renderer console', { level, message, line, sourceId, classification })
      appendObservationJsonl(observationEventsPath, 'events', {
        source: 'renderer-console',
        name: 'console-message',
        ...classification,
        console_level: level,
        message,
        line,
        sourceId,
      })
    },
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('renderer process gone', details)
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'electron-main',
      name: 'renderer.render-process-gone',
      level: 'error',
      details,
    })
  })

  mainWindow.webContents.on('unresponsive', () => {
    log('renderer unresponsive')
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'electron-main',
      name: 'renderer.unresponsive',
      level: 'error',
    })
  })

  mainWindow.webContents.on('responsive', () => {
    log('renderer responsive')
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'electron-main',
      name: 'renderer.responsive',
      level: 'info',
    })
  })

  mainWindow.webContents.on('did-finish-load', () => {
    log('renderer did-finish-load')
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'electron-main',
      name: 'renderer.did-finish-load',
      level: 'info',
    })
  })
}

async function ensureBackend(): Promise<AgentBackend> {
  if (backend && backend.alive()) return backend

  const mode = getAgentMode()
  log(`initializing backend: mode=${mode} cwd=${currentCwd}`)

  if (mode === 'acp') {
    backend = createBackend('acp', { cwd: currentCwd })
  } else if (mode === 'codex-app-server') {
    backend = createBackend('codex-app-server', { cwd: currentCwd })
  } else {
    backend = createBackend('sdk', {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      cwd: currentCwd,
      systemPrompt: '你是隆小虾，一个金融业务 AI 助手。你可以读写文件、执行命令、搜索代码。回复使用中文。',
    })
  }

  await backend.connect()
  return backend
}

function getControlPlaneClient() {
  return controlPlaneClient
}

function currentRuntimeProfile(
  workMode: LongclawLaunchIntent['work_mode'],
  seatResolution?: LocalRuntimeSeatResolution,
): string {
  if (workMode === 'cloud_sandbox') {
    return 'cloud_managed_runtime'
  }
  if (process.env.LONGCLAW_RUNTIME_PROFILE?.trim()) {
    return process.env.LONGCLAW_RUNTIME_PROFILE.trim()
  }
  return seatResolution?.runtimeProfile ?? 'dev_local_acp_bridge'
}

function getLocalRuntimeSeatPreference(): LocalRuntimeSeatPreference {
  return localRuntimeSeatPreference
}

function setLocalRuntimeSeatPreference(value: unknown): LocalRuntimeSeatPreference {
  localRuntimeSeatPreference = normalizeLocalRuntimeSeatPreference(value)
  return localRuntimeSeatPreference
}

function resolveLaunchSeat(
  workMode: LongclawLaunchIntent['work_mode'],
  preference: LocalRuntimeSeatPreference = getLocalRuntimeSeatPreference(),
): LocalRuntimeSeatResolution {
  if (workMode === 'cloud_sandbox') {
    return {
      preference,
      seat: 'unavailable',
      available: false,
      runtimeProfile: 'cloud_managed_runtime',
      runtimeTarget: 'cloud_runtime',
      modelPlane: 'cloud_provider',
      localRuntimeApiKeyConfigured: Boolean(process.env.LONGCLAW_LOCAL_RUNTIME_API_KEY?.trim()),
      localRuntimeApiUrl: process.env.LONGCLAW_LOCAL_RUNTIME_API_URL?.trim(),
    }
  }
  return resolveLocalRuntimeSeat(preference)
}

function withLaunchSeatMetadata(
  intent: LongclawLaunchIntent,
  seatResolution: LocalRuntimeSeatResolution,
): LongclawLaunchIntent {
  const runtimeProfile = currentRuntimeProfile(intent.work_mode, seatResolution)
  const runtimeTarget = intent.work_mode === 'cloud_sandbox' ? 'cloud_runtime' : 'local_runtime'
  const interactionSurface = intent.work_mode === 'weclaw_dispatch' ? 'weclaw' : 'electron_home'
  const executionPlane = runtimeTarget === 'cloud_runtime' ? 'cloud_executor' : 'local_executor'

  return LongclawLaunchIntentSchema.parse({
    ...intent,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: 'cloud_provider',
    metadata: {
      ...(intent.metadata ?? {}),
      work_mode: intent.work_mode,
      launch_surface: intent.launch_surface ?? interactionSurface,
      origin_surface: intent.launch_surface ?? interactionSurface,
      interaction_surface: interactionSurface,
      runtime_profile: runtimeProfile,
      runtime_target: runtimeTarget,
      model_plane: 'cloud_provider',
      execution_plane: executionPlane,
      local_runtime_seat: seatResolution.seat,
      local_runtime_seat_preference: seatResolution.preference,
      dev_machine_acp_takeover:
        seatResolution.preference === 'auto' && seatResolution.seat === 'acp_bridge',
      local_runtime_api_url: seatResolution.localRuntimeApiUrl,
      local_acp_script: seatResolution.acpScript,
    },
  })
}

type WeclawWorkspaceResolution = {
  workspaceRoot: string | null
  source: 'config' | 'env' | 'default' | 'unresolved'
}

type WeclawSessionSourceStatus = {
  workspaceRoot: string | null
  workspaceSource: WeclawWorkspaceResolution['source']
  sessionsDir: string | null
  sessionsDirExists: boolean
  sessionCount: number
}

type WeclawSessionAttachment = {
  attachmentId: string
  title: string
  kind: string
  path?: string
  url?: string
  mimeType?: string
  size?: number
  text?: string
  origin: 'session' | 'message'
  messageId?: string
  metadata: Record<string, unknown>
}

type WeclawSessionMessage = {
  messageId: string
  role: string
  kind?: string
  text?: string
  agentName?: string
  createdAt?: string
  attachments: WeclawSessionAttachment[]
  metadata: Record<string, unknown>
}

type WeclawSessionDetail = {
  sessionId: string
  canonicalSessionId: string
  duplicateSessionIds: string[]
  hidden: boolean
  archived: boolean
  filePath: string
  userId?: string
  updatedAt?: string
  title: string
  preview?: string
  messageCount: number
  agentReplyCount: number
  mediaCount: number
  canonicalMetadata: Record<string, unknown>
  messages: WeclawSessionMessage[]
  media: WeclawSessionAttachment[]
}

type WeclawSessionSummary = Pick<
  WeclawSessionDetail,
  | 'sessionId'
  | 'canonicalSessionId'
  | 'duplicateSessionIds'
  | 'hidden'
  | 'archived'
  | 'filePath'
  | 'userId'
  | 'updatedAt'
  | 'title'
  | 'preview'
  | 'messageCount'
  | 'agentReplyCount'
  | 'mediaCount'
> & {
  sourceLabel: string
  canonicalMetadata: Record<string, unknown>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeWeclawAttachmentPath(filePath: string, candidate: unknown): string | undefined {
  const rawValue = readString(candidate)
  if (!rawValue) return undefined
  if (/^https?:\/\//i.test(rawValue)) return rawValue
  if (rawValue.startsWith('file://')) {
    try {
      return fileURLToPath(rawValue)
    } catch {
      return rawValue
    }
  }
  if (path.isAbsolute(rawValue)) return rawValue
  return path.resolve(path.dirname(filePath), rawValue)
}

function collectAttachmentRecords(value: unknown): Array<Record<string, unknown> | string> {
  if (Array.isArray(value)) {
    return value.flatMap(item => collectAttachmentRecords(item))
  }
  if (typeof value === 'string' || isPlainRecord(value)) return [value]
  return []
}

function parseWeclawAttachment(
  filePath: string,
  source: unknown,
  origin: WeclawSessionAttachment['origin'],
  messageId?: string,
): WeclawSessionAttachment | null {
  if (typeof source === 'string') {
    const resolvedPath = normalizeWeclawAttachmentPath(filePath, source)
    const title = resolvedPath ? path.basename(resolvedPath) : source
    return {
      attachmentId: `${origin}:${messageId ?? 'session'}:${title}`,
      title,
      kind: path.extname(title).slice(1) || 'attachment',
      path: resolvedPath && path.isAbsolute(resolvedPath) ? resolvedPath : undefined,
      url: /^https?:\/\//i.test(source) ? source : undefined,
      origin,
      messageId,
      metadata: {},
    }
  }
  if (!isPlainRecord(source)) return null

  const pathValue =
    normalizeWeclawAttachmentPath(
      filePath,
      source.path ?? source.file_path ?? source.filePath ?? source.uri ?? source.url,
    )
  const title =
    readString(source.title) ??
    readString(source.name) ??
    readString(source.label) ??
    readString(source.filename) ??
    (pathValue ? path.basename(pathValue) : undefined) ??
    '附件'
  const kind =
    readString(source.kind) ??
    readString(source.type) ??
    (pathValue ? path.extname(pathValue).slice(1) || 'attachment' : 'attachment')
  const url = readString(source.url)

  return {
    attachmentId:
      readString(source.id) ??
      readString(source.attachment_id) ??
      `${origin}:${messageId ?? 'session'}:${title}`,
    title,
    kind,
    path: pathValue && path.isAbsolute(pathValue) ? pathValue : undefined,
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
    mimeType: readString(source.mime_type) ?? readString(source.mimeType),
    size: readNumber(source.size) ?? readNumber(source.bytes),
    text: readString(source.text) ?? readString(source.caption) ?? readString(source.description),
    origin,
    messageId,
    metadata: Object.fromEntries(
      Object.entries(source).filter(
        ([key]) =>
          ![
            'id',
            'attachment_id',
            'title',
            'name',
            'label',
            'filename',
            'kind',
            'type',
            'path',
            'file_path',
            'filePath',
            'uri',
            'url',
            'mime_type',
            'mimeType',
            'size',
            'bytes',
            'text',
            'caption',
            'description',
          ].includes(key),
      ),
    ),
  }
}

function parseWeclawMessage(filePath: string, source: unknown): WeclawSessionMessage | null {
  if (!isPlainRecord(source)) return null
  const messageId =
    readString(source.message_id) ??
    readString(source.id) ??
    readString(source.uuid) ??
    `${readString(source.created_at) ?? readString(source.createdAt) ?? 'message'}:${readString(source.role) ?? 'unknown'}`
  const attachments = collectAttachmentRecords(
    source.attachments ?? source.attachment ?? source.media ?? source.files,
  )
    .map(item => parseWeclawAttachment(filePath, item, 'message', messageId))
    .filter((item): item is WeclawSessionAttachment => Boolean(item))
  const metadata = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        ![
          'message_id',
          'id',
          'uuid',
          'role',
          'kind',
          'text',
          'content',
          'message',
          'agent_name',
          'agentName',
          'created_at',
          'createdAt',
          'attachments',
          'attachment',
          'media',
          'files',
        ].includes(key),
    ),
  )
  const text =
    readString(source.text) ??
    readString(source.content) ??
    readString(source.message) ??
    readString(source.summary)

  return {
    messageId,
    role: readString(source.role) ?? 'unknown',
    kind: readString(source.kind),
    text,
    agentName: readString(source.agent_name) ?? readString(source.agentName),
    createdAt: readString(source.created_at) ?? readString(source.createdAt),
    attachments,
    metadata,
  }
}

function summarizeWeclawSession(filePath: string, raw: Record<string, unknown>): WeclawSessionDetail {
  const messages = collectAttachmentRecords(raw.messages ?? raw.conversation ?? raw.turns ?? [])
  const parsedMessages = messages
    .map(message => parseWeclawMessage(filePath, message))
    .filter((message): message is WeclawSessionMessage => Boolean(message))
  const topLevelMedia = collectAttachmentRecords(raw.media ?? raw.attachments ?? raw.files ?? [])
    .map(item => parseWeclawAttachment(filePath, item, 'session'))
    .filter((item): item is WeclawSessionAttachment => Boolean(item))
  const canonicalMetadata = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !['messages', 'media'].includes(key)),
  )
  const sessionId = path.basename(filePath, path.extname(filePath))
  const userId = readString(raw.user_id) ?? readString(raw.userId)
  const updatedAt = readString(raw.updated_at) ?? readString(raw.updatedAt)
  const preview =
    [...parsedMessages]
      .reverse()
      .map(message => message.text?.trim())
      .find(Boolean) ??
    readString(raw.preview) ??
    readString(raw.title)
  const title =
    readString(raw.title) ??
    readString(raw.session_title) ??
    readString(raw.subject) ??
    preview?.split(/\r?\n/).find(Boolean)?.slice(0, 96) ??
    userId ??
    sessionId
  const agentReplyCount = parsedMessages.filter(message =>
    ['agent', 'assistant'].includes(message.role) ||
    ['reply', 'response'].includes(String(message.kind ?? '').toLowerCase()),
  ).length
  const nestedMediaCount = parsedMessages.reduce(
    (count, message) => count + message.attachments.length,
    0,
  )
  const canonicalSessionId = canonicalWeclawSessionId({
    sessionId,
    userId,
    title,
    canonicalMetadata,
  })

  return {
    sessionId,
    canonicalSessionId,
    duplicateSessionIds: [],
    hidden: false,
    archived: false,
    filePath,
    userId,
    updatedAt,
    title,
    preview,
    messageCount: parsedMessages.length,
    agentReplyCount,
    mediaCount: topLevelMedia.length + nestedMediaCount,
    canonicalMetadata,
    messages: parsedMessages,
    media: topLevelMedia,
  }
}

function readWeclawConfigSaveDir(): string | undefined {
  if (!fs.existsSync(WECLAW_CONFIG_PATH)) return undefined
  try {
    const raw = JSON.parse(fs.readFileSync(WECLAW_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
    return readString(raw.save_dir)
  } catch {
    return undefined
  }
}

function resolveWeclawWorkspaceResolution(): WeclawWorkspaceResolution {
  const candidates = [
    { value: readWeclawConfigSaveDir(), source: 'config' as const },
    { value: readString(process.env.WECLAW_SAVE_DIR), source: 'env' as const },
    { value: DEFAULT_WECLAW_WORKSPACE, source: 'default' as const },
  ].filter((candidate): candidate is { value: string; source: 'config' | 'env' | 'default' } =>
    Boolean(candidate.value),
  )

  for (const candidate of candidates) {
    if (fs.existsSync(candidate.value) && fs.statSync(candidate.value).isDirectory()) {
      return { workspaceRoot: candidate.value, source: candidate.source }
    }
  }

  if (candidates[0]) {
    return { workspaceRoot: candidates[0].value, source: candidates[0].source }
  }

  return { workspaceRoot: null, source: 'unresolved' }
}

function resolveWeclawWorkspaceRoot(): string | null {
  return resolveWeclawWorkspaceResolution().workspaceRoot
}

function resolveWeclawSessionsDir(): string | null {
  const workspaceRoot = resolveWeclawWorkspaceRoot()
  if (!workspaceRoot) return null
  return path.join(workspaceRoot, '.obsidian', 'sessions')
}

function getWeclawSessionSourceStatus(): WeclawSessionSourceStatus {
  const resolution = resolveWeclawWorkspaceResolution()
  const sessionsDir = resolution.workspaceRoot
    ? path.join(resolution.workspaceRoot, '.obsidian', 'sessions')
    : null
  const sessionsDirExists = Boolean(
    sessionsDir && fs.existsSync(sessionsDir) && fs.statSync(sessionsDir).isDirectory(),
  )
  const sessionCount = sessionsDirExists
    ? fs.readdirSync(sessionsDir!, { withFileTypes: true }).filter(
        entry => entry.isFile() && entry.name.endsWith('.json'),
      ).length
    : 0

  return {
    workspaceRoot: resolution.workspaceRoot,
    workspaceSource: resolution.source,
    sessionsDir,
    sessionsDirExists,
    sessionCount,
  }
}

function loadWeclawSessionFiles(): Array<{ sessionId: string; filePath: string; mtimeMs: number }> {
  const sessionsDir = resolveWeclawSessionsDir()
  if (!sessionsDir || !fs.existsSync(sessionsDir)) return []
  return fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(sessionsDir, entry.name))
    .map(filePath => {
      const stat = fs.statSync(filePath)
      return {
        sessionId: path.basename(filePath, path.extname(filePath)),
        filePath,
        mtimeMs: stat.mtimeMs,
      }
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
}

function readWeclawSessionDetailByFile(filePath: string): WeclawSessionDetail | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
    if (!isPlainRecord(raw)) return null
    return summarizeWeclawSession(filePath, raw)
  } catch (error) {
    log('failed to read weclaw session', { filePath, error })
    return null
  }
}

function listWeclawSessions(): WeclawSessionSummary[] {
  const deduped = new Map<string, WeclawSessionDetail>()
  for (const session of loadWeclawSessionFiles()
    .map(({ filePath }) => readWeclawSessionDetailByFile(filePath))
    .filter((session): session is WeclawSessionDetail => Boolean(session))
  ) {
    const existing = deduped.get(session.canonicalSessionId)
    if (!existing) {
      deduped.set(session.canonicalSessionId, session)
      continue
    }
    const existingTs = Date.parse(existing.updatedAt ?? '') || 0
    const currentTs = Date.parse(session.updatedAt ?? '') || 0
    const primary = currentTs >= existingTs ? session : existing
    const secondary = currentTs >= existingTs ? existing : session
    primary.duplicateSessionIds = [...new Set([
      ...primary.duplicateSessionIds,
      secondary.sessionId,
      ...secondary.duplicateSessionIds,
    ])]
    deduped.set(session.canonicalSessionId, primary)
  }
  return [...deduped.values()].map(session => {
    const uiFlags =
      getWeclawSessionUiState()[session.canonicalSessionId] ?? {
        hidden: false,
        archived: false,
      }
    return {
      sessionId: session.sessionId,
      canonicalSessionId: session.canonicalSessionId,
      duplicateSessionIds: session.duplicateSessionIds,
      hidden: uiFlags.hidden,
      archived: uiFlags.archived,
      filePath: session.filePath,
      userId: session.userId,
      updatedAt: session.updatedAt,
      title: session.title,
      preview: session.preview,
      messageCount: session.messageCount,
      agentReplyCount: session.agentReplyCount,
      mediaCount: session.mediaCount,
      sourceLabel: session.userId ? 'WeChat 会话' : 'WeClaw 会话',
      canonicalMetadata: session.canonicalMetadata,
    }
  })
}

function getWeclawSession(sessionId: string): WeclawSessionDetail | null {
  const target = readString(sessionId)
  if (!target) return null
  for (const entry of loadWeclawSessionFiles()) {
    if (entry.sessionId === target) {
      const session = readWeclawSessionDetailByFile(entry.filePath)
      if (!session) return null
      const uiFlags =
        getWeclawSessionUiState()[session.canonicalSessionId] ?? {
          hidden: false,
          archived: false,
        }
      return {
        ...session,
        hidden: uiFlags.hidden,
        archived: uiFlags.archived,
        duplicateSessionIds: listWeclawSessions()
          .find(item => item.sessionId === session.sessionId)
          ?.duplicateSessionIds ?? [],
      }
    }
  }
  return null
}

async function probeHttpOk(url: string | undefined, timeoutMs = 2500): Promise<boolean> {
  if (!url) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function probeTcpOpen(url: string | undefined, timeoutMs = 700): Promise<boolean> {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80))
  if (!parsed.hostname || !Number.isFinite(port)) return false
  return new Promise(resolve => {
    const socket = net.createConnection({ host: parsed.hostname, port })
    const finish = (ok: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function execFileText(
  file: string,
  args: string[],
  options: { cwd?: string; timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout ?? 300_000,
        maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
        encoding: 'utf-8',
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }))
          return
        }
        resolve({ stdout, stderr })
      },
    )
  })
}

function resolveDueDiligenceRepoRoot(): string | null {
  const candidates = [
    process.env.LONGCLAW_DUE_DILIGENCE_REPO,
    path.join(os.homedir(), 'github代码仓库', 'due-diligence-core'),
    path.resolve(REPO_ROOT, '..', 'due-diligence-core'),
    path.resolve(currentCwd, 'due-diligence-core'),
    path.resolve(currentCwd, '..', 'due-diligence-core'),
  ].filter((candidate): candidate is string => Boolean(candidate))
  return (
    candidates.find(candidate =>
      fs.existsSync(path.join(candidate, 'scripts', 'python.sh')) &&
      fs.existsSync(path.join(candidate, 'src', 'due_diligence_core', 'cli.py')),
    ) ?? null
  )
}

function parseJsonFromCommandOutput(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    return isPlainRecord(parsed) ? parsed : null
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1))
      return isPlainRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function tailText(value: unknown, limit = 2400): string {
  const text = String(value ?? '')
  return text.length > limit ? text.slice(-limit) : text
}

function nestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key]
  return isPlainRecord(value) ? value : {}
}

function nestedString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

async function runDueDiligenceRpaDemo(payload: Record<string, unknown>) {
  const repoRoot = resolveDueDiligenceRepoRoot()
  const query =
    readString(payload.query) ??
    readString(payload.company) ??
    readString(payload.issuer_name) ??
    '国泰君安'
  const siteSlug = readString(payload.site_slug) ?? readString(payload.siteSlug) ?? 'process49_www_baidu_com'
  const headed = payload.headed === undefined ? true : Boolean(payload.headed)
  const allowHeadedFallback =
    payload.allow_headed_fallback === undefined ? headed : Boolean(payload.allow_headed_fallback)
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${siteSlug}`
  const outputRoot = path.join(DUE_DILIGENCE_RPA_RUNS_DIR, runId)
  const args = [
    path.join('scripts', 'python.sh'),
    '-m',
    'due_diligence_core.cli',
    'validate-site',
    siteSlug,
    query,
    '--output-dir',
    outputRoot,
    headed ? '--headed' : '--headless',
    '--browser-backend',
    readString(payload.browser_backend) ?? 'playwright',
    '--http-backend',
    readString(payload.http_backend) ?? 'auto',
  ]
  if (!allowHeadedFallback) args.push('--no-headed-fallback')
  if (readString(payload.credit_code)) args.push('--credit-code', readString(payload.credit_code)!)

  fs.mkdirSync(outputRoot, { recursive: true })

  if (!repoRoot) {
    return {
      ok: false,
      kind: 'run_due_diligence_rpa_demo',
      message: 'due-diligence-core repo not found',
      query,
      site_slug: siteSlug,
      output_root: outputRoot,
    }
  }

  const command = ['bash', ...args].join(' ')
  try {
    const { stdout, stderr } = await execFileText('/bin/bash', args, {
      cwd: repoRoot,
      timeout: Number(payload.timeout_ms) || 300_000,
      maxBuffer: 12 * 1024 * 1024,
    })
    const report = parseJsonFromCommandOutput(stdout) ?? {}
    const site = nestedRecord(report, 'site')
    const executionResult = nestedRecord(report, 'execution_result')
    const evidence = nestedRecord(executionResult, 'evidence')
    return {
      ok: true,
      kind: 'run_due_diligence_rpa_demo',
      message: 'due diligence browser RPA completed',
      run_id: runId,
      query,
      site_slug: siteSlug,
      site_name: nestedString(site, 'display_name') || siteSlug,
      validation_state: nestedString(report, 'validation_state'),
      current_automation_status: nestedString(report, 'current_automation_status'),
      phenomenon_status: nestedString(report, 'phenomenon_status'),
      risk_rating: nestedString(report, 'risk_rating'),
      next_action: nestedString(report, 'next_action'),
      execution_status: nestedString(executionResult, 'status'),
      execution_summary: nestedString(executionResult, 'summary'),
      report_path: nestedString(report, 'report_path'),
      shadow_compare_path: nestedString(report, 'shadow_compare_path'),
      evidence_root: nestedString(evidence, 'root_dir'),
      output_root: outputRoot,
      repo_root: repoRoot,
      command,
      stdout_tail: tailText(stdout, 1200),
      stderr_tail: tailText(stderr, 1200),
    }
  } catch (error) {
    const record = error as Error & { stdout?: string; stderr?: string; code?: string | number | null }
    return {
      ok: false,
      kind: 'run_due_diligence_rpa_demo',
      message: record.message || 'due diligence browser RPA failed',
      code: record.code ?? null,
      query,
      site_slug: siteSlug,
      output_root: outputRoot,
      repo_root: repoRoot,
      command,
      stdout_tail: tailText(record.stdout, 2400),
      stderr_tail: tailText(record.stderr, 2400),
    }
  }
}

function resolveWorkspacePythonExecutable(): string {
  const bundled = path.join(
    os.homedir(),
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'bin',
    'python3',
  )
  const candidates = [
    process.env.LONGCLAW_WORKSPACE_PYTHON,
    process.env.PYTHON_BIN,
    bundled,
    '/usr/bin/python3',
  ].filter((candidate): candidate is string => Boolean(candidate))
  return candidates.find(candidate => fs.existsSync(candidate)) ?? 'python3'
}

function safeFileSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'deck').slice(0, 48)
}

function pptxArtifactForRun(
  runId: string,
  title: string,
  outputPath: string,
  backend: string,
  slideCount: number,
  sizeBytes: number,
  outputRoot: string,
) {
  const artifactTitle = `${title}.pptx`
  const artifact = {
    artifact_id: `${runId}:pptx`,
    run_id: runId,
    kind: 'pptx',
    uri: outputPath,
    title: artifactTitle,
    metadata: {
      backend,
      slide_count: slideCount,
      size_bytes: sizeBytes,
      output_root: outputRoot,
    },
  }
  return {
    artifact,
    artifact_ref: {
      kind: 'pptx',
      uri: outputPath,
      title: artifactTitle,
    },
  }
}

function splitPromptLinesForSlides(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*#\d.、]+\s*/, '').trim())
    .filter(Boolean)
  if (lines.length > 0) return lines
  return text
    .split(/[。；;.!?！？]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function buildDraftSlidePlan(title: string, prompt: string): Array<{ title: string; bullets: string[] }> {
  const lines = splitPromptLinesForSlides(prompt)
  const fallback = ['任务理解', '结构规划', '视觉建议', '下一步完善']
  const content = lines.length ? lines : fallback
  return [
    {
      title: title || 'Longclaw PPT Draft',
      bullets: ['PPTXGenJS draft', new Date().toISOString().slice(0, 10)],
    },
    { title: '任务理解', bullets: content.slice(0, 3) },
    { title: '内容结构', bullets: content.slice(3, 7).length ? content.slice(3, 7) : ['封面', '核心论点', '数据与证据', '行动建议'] },
    { title: '视觉与图表', bullets: content.slice(7, 11).length ? content.slice(7, 11) : ['统一版式', '可复核图表', '来源脚注'] },
    { title: '待完善项', bullets: content.slice(11, 15).length ? content.slice(11, 15) : ['补充真实数据', '替换模板母版', '渲染和视觉 QA'] },
  ].slice(0, 8)
}

async function runPptxgenjsDraft(payload: Record<string, unknown>) {
  const prompt = readString(payload.prompt) ?? readString(payload.message) ?? ''
  const title =
    readString(payload.title) ??
    prompt.match(/[“"']([^“"']{2,48})[”"']/)?.[1] ??
    prompt
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean)
      ?.slice(0, 48) ??
    'Longclaw PPT Draft'
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeFileSegment(title)}`
  const outputRoot = path.join(PPT_TOOL_RUNS_DIR, runId)
  const outputPath = path.join(outputRoot, `${safeFileSegment(title)}.pptx`)
  fs.mkdirSync(outputRoot, { recursive: true })
  const slidePlan = buildDraftSlidePlan(title, prompt)

  try {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'
    pptx.author = 'Longclaw Agent OS'
    pptx.company = 'Longclaw'
    pptx.subject = 'PPTXGenJS quick draft'
    pptx.title = title
    pptx.lang = 'zh-CN'
    pptx.theme = {
      headFontFace: 'Microsoft YaHei',
      bodyFontFace: 'Microsoft YaHei',
      lang: 'zh-CN',
    }
    for (const [index, planned] of slidePlan.entries()) {
      const slide = pptx.addSlide()
      slide.background = { color: index === 0 ? '111827' : 'F8FAFC' }
      const titleColor = index === 0 ? 'FFFFFF' : '111827'
      const bodyColor = index === 0 ? 'E5E7EB' : '374151'
      slide.addText(planned.title, {
        x: 0.7,
        y: index === 0 ? 1.35 : 0.5,
        w: 11.9,
        h: 0.7,
        fontFace: 'Microsoft YaHei',
        fontSize: index === 0 ? 34 : 28,
        bold: true,
        color: titleColor,
        margin: 0.04,
        fit: 'shrink',
      })
      const bulletText = planned.bullets.map(item => `• ${item}`).join('\n')
      slide.addText(bulletText || '• Draft slide', {
        x: index === 0 ? 0.9 : 1.0,
        y: index === 0 ? 2.35 : 1.55,
        w: index === 0 ? 11.0 : 10.9,
        h: 4.3,
        fontFace: 'Microsoft YaHei',
        fontSize: index === 0 ? 19 : 20,
        color: bodyColor,
        breakLine: false,
        valign: 'top',
        fit: 'shrink',
        margin: 0.06,
      })
      slide.addText('Generated by Longclaw pptxgenjs tool', {
        x: 0.7,
        y: 6.85,
        w: 11.9,
        h: 0.25,
        fontSize: 8,
        color: index === 0 ? '9CA3AF' : '6B7280',
        margin: 0.02,
      })
    }
    await pptx.writeFile({ fileName: outputPath })
    const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
    const artifactBundle = pptxArtifactForRun(
      runId,
      title,
      outputPath,
      'pptxgenjs',
      slidePlan.length,
      size,
      outputRoot,
    )
    return {
      ok: size > 0,
      kind: 'run_pptx_draft',
      message: size > 0 ? 'PPTXGenJS draft generated' : 'PPTXGenJS draft failed',
      run_id: runId,
      title,
      output_path: outputPath,
      output_root: outputRoot,
      backend: 'pptxgenjs',
      slide_count: slidePlan.length,
      size_bytes: size,
      artifacts: size > 0 ? [artifactBundle.artifact] : [],
      artifact_refs: size > 0 ? [artifactBundle.artifact_ref] : [],
    }
  } catch (error) {
    const fallback = await runPythonPptxDraft({ ...payload, title, prompt })
    return {
      ...fallback,
      kind: 'run_pptx_draft',
      preferred_backend: 'pptxgenjs',
      backend: fallback.backend ? `fallback:${fallback.backend}` : 'fallback:python',
      message: `PPTXGenJS failed; ${fallback.message}`,
      pptxgenjs_error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function resolveSignalsWebBaseUrl(): Promise<string | null> {
  const configured = process.env.LONGCLAW_SIGNALS_WEB_BASE_URL?.replace(/\/$/, '')
  const candidates = [
    configured,
    `http://127.0.0.1:${process.env.LONGCLAW_SIGNALS_WEB_PORT ?? '8011'}`,
  ].filter((candidate): candidate is string => Boolean(candidate))
  for (const baseUrl of candidates) {
    try {
      await fetchJsonWithTimeout(`${baseUrl}/api/pack/descriptor`, 3_000)
      return baseUrl
    } catch {
      // Try the next configured endpoint.
    }
  }
  return null
}

function compactRecordList(value: unknown, limit: number): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (isPlainRecord(item) ? item : {}))
    .filter(item => Object.keys(item).length > 0)
    .slice(0, limit)
}

function compactSignalsDashboard(dashboard: Record<string, unknown>) {
  const cacheStatus = nestedRecord(dashboard, 'cache_status')
  const dailyBrief = nestedRecord(dashboard, 'daily_brief')
  return {
    status: nestedString(dashboard, 'status'),
    notice: nestedString(dashboard, 'notice'),
    daily_brief: {
      as_of: nestedString(dailyBrief, 'as_of') || nestedString(dailyBrief, 'as_of_date'),
      title: nestedString(dailyBrief, 'title') || nestedString(dailyBrief, 'headline'),
      summary: nestedString(dailyBrief, 'summary'),
      market_line: nestedString(dailyBrief, 'market_line') || nestedString(dailyBrief, 'market_bias'),
      primary_theme: nestedString(dailyBrief, 'primary_theme'),
      top_candidate: nestedString(dailyBrief, 'top_candidate'),
      next_actions: Array.isArray(dailyBrief.next_actions)
        ? dailyBrief.next_actions.slice(0, 5)
        : Array.isArray(dailyBrief.bullets)
          ? dailyBrief.bullets.slice(0, 5)
          : [],
      risk_notes: Array.isArray(dailyBrief.risk_notes) ? dailyBrief.risk_notes.slice(0, 5) : [],
    },
    overview: nestedRecord(dashboard, 'overview'),
    buy_candidates: compactRecordList(dashboard.buy_candidates, 6).map(item => ({
      symbol: item.symbol,
      name: item.name ?? item.display_name,
      score: item.score,
      direction: item.direction,
      reason: item.reason,
      status: item.status,
      decision_stage: item.decision_stage,
      recommended_action: item.recommended_action,
      metadata: nestedRecord(item, 'metadata'),
    })),
    sell_warnings: compactRecordList(dashboard.sell_warnings, 4).map(item => ({
      symbol: item.symbol,
      name: item.name ?? item.display_name,
      score: item.score,
      reason: item.reason,
      status: item.status,
      recommended_action: item.recommended_action,
    })),
    chart_context: dashboard.chart_context ?? null,
    backtest_summary: nestedRecord(dashboard, 'backtest_summary'),
    backtest_jobs: compactRecordList(dashboard.backtest_jobs, 4),
    pending_backlog_preview: compactRecordList(dashboard.pending_backlog_preview, 6),
    strategy_kpis: compactRecordList(dashboard.strategy_kpis, 8),
    source_confidence: compactRecordList(dashboard.source_confidence, 6),
    cache_status: {
      available: Boolean(cacheStatus.available),
      mode: nestedString(cacheStatus, 'mode'),
      updated_at: nestedString(cacheStatus, 'updated_at'),
      trade_date: nestedString(cacheStatus, 'trade_date'),
      recovery_state: nestedString(cacheStatus, 'recovery_state'),
      critical_blocker: cacheStatus.critical_blocker ?? null,
      mongo_stock_cache: cacheStatus.mongo_stock_cache ?? {},
      provider_health: compactRecordList(cacheStatus.provider_health, 6),
      blockers: compactRecordList(cacheStatus.blockers, 6),
    },
    diagnostics: compactRecordList(dashboard.diagnostics, 6),
  }
}

function extractSignalsSymbol(text: string): string {
  const futu = /\b(?:SH|SZ|HK|US)\.[A-Za-z0-9]{4,8}\b/i.exec(text)
  if (futu?.[0]) return futu[0].toUpperCase()
  const cn = /\b[036][0-9]{5}\b/.exec(text)
  if (cn?.[0]) {
    return cn[0].startsWith('6') || cn[0].startsWith('5') ? `SH.${cn[0]}` : `SZ.${cn[0]}`
  }
  const hk = /\b[0-9]{5}\b/.exec(text)
  if (hk?.[0]) return `HK.${hk[0]}`
  return ''
}

function signalsBacktestCode(symbol: string): string {
  if (!symbol) return ''
  const parts = symbol.split('.')
  return parts.at(-1) ?? symbol
}

async function runSignalsResearchTool(payload: Record<string, unknown>) {
  const query = readString(payload.query) ?? readString(payload.message) ?? ''
  const symbol = readString(payload.symbol) ?? extractSignalsSymbol(query)
  const freq = readString(payload.freq) ?? (/30m|30min|30分钟/.test(query) ? '30min' : 'daily')
  const baseUrl = await resolveSignalsWebBaseUrl()
  if (!baseUrl) {
    return {
      ok: false,
      kind: 'run_signals_research',
      message: 'Signals web endpoint is unavailable',
      query,
      symbol,
      expected_base_url: process.env.LONGCLAW_SIGNALS_WEB_BASE_URL ?? 'http://127.0.0.1:8011',
    }
  }
  const errors: Record<string, string> = {}
  let dashboard: Record<string, unknown> | null = null
  let shell: Record<string, unknown> | null = null
  let symbolPayload: Record<string, unknown> | null = null
  let resolvePayload: Record<string, unknown> | null = null
  let backtestPayload: Record<string, unknown> | null = null
  try {
    const value = await fetchJsonWithTimeout(`${baseUrl}/api/pack/dashboard?recent_limit=10&backlog_limit=8`, 25_000)
    dashboard = isPlainRecord(value) ? value : null
  } catch (error) {
    errors.dashboard = error instanceof Error ? error.message : String(error)
  }
  try {
    const value = await fetchJsonWithTimeout(`${baseUrl}/api/workbench/shell`, 25_000)
    shell = isPlainRecord(value) ? value : null
  } catch (error) {
    errors.shell = error instanceof Error ? error.message : String(error)
  }
  if (symbol) {
    try {
      const codeForResolve = signalsBacktestCode(symbol)
      const value = await fetchJsonWithTimeout(
        `${baseUrl}/api/stock/resolve/${encodeURIComponent(codeForResolve || symbol)}`,
        12_000,
      )
      resolvePayload = isPlainRecord(value) ? value : null
    } catch (error) {
      errors.resolve = error instanceof Error ? error.message : String(error)
    }
    try {
      const value = await fetchJsonWithTimeout(
        `${baseUrl}/api/workbench/symbol/${encodeURIComponent(symbol)}?kind=stock&freq=${encodeURIComponent(freq)}`,
        30_000,
      )
      symbolPayload = isPlainRecord(value) ? value : null
    } catch (error) {
      errors.symbol = error instanceof Error ? error.message : String(error)
    }
    if (/回测|backtest|胜率|收益|信号/.test(query)) {
      try {
        const params = new URLSearchParams({
          code: signalsBacktestCode(symbol),
          freq: freq === 'weekly' || freq === 'monthly' ? freq : 'daily',
          signal_group: 'all',
          lookback: readString(payload.lookback) ?? '120',
          stop_loss: readString(payload.stop_loss) ?? '5',
          trail_stop: readString(payload.trail_stop) ?? '50',
          max_hold: readString(payload.max_hold) ?? '20',
          slippage: readString(payload.slippage) ?? '0.1',
        })
        const value = await fetchJsonWithTimeout(
          `${baseUrl}/api/backtest/analyze?${params.toString()}`,
          45_000,
        )
        backtestPayload = isPlainRecord(value) ? value : null
      } catch (error) {
        errors.backtest = error instanceof Error ? error.message : String(error)
      }
    }
  }

  return {
    ok: Boolean(dashboard || shell || symbolPayload || backtestPayload),
    kind: 'run_signals_research',
    message: 'Signals tool result',
    query,
    symbol,
    freq,
    base_url: baseUrl,
    resolve: resolvePayload,
    dashboard: dashboard ? compactSignalsDashboard(dashboard) : null,
    workbench_shell: shell
      ? {
          updated_at: shell.updated_at ?? shell.generated_at ?? '',
          trade_date: shell.trade_date ?? '',
          lanes: shell.lanes ?? null,
          quote_watermark: shell.quote_watermark ?? '',
          cache: shell.cache ?? null,
          selected: shell.selected ?? null,
          watchlist_groups: Array.isArray(shell.watchlist_groups) ? shell.watchlist_groups.slice(0, 4) : [],
        }
      : null,
    symbol_payload: symbolPayload
      ? {
          target: symbolPayload.target ?? null,
          summary: symbolPayload.summary ?? symbolPayload.report ?? null,
          chart_context: symbolPayload.chart_context ?? null,
          signals: Array.isArray(symbolPayload.signals) ? symbolPayload.signals.slice(-10) : [],
          backtest: symbolPayload.backtest ?? null,
        }
      : null,
    backtest: backtestPayload
      ? {
          target: backtestPayload.target ?? backtestPayload.meta ?? null,
          kpi: backtestPayload.kpi ?? backtestPayload.summary ?? backtestPayload.metrics ?? null,
          signals: Array.isArray(backtestPayload.signals)
            ? backtestPayload.signals.slice(-10)
            : Array.isArray(backtestPayload.signal_evals)
              ? backtestPayload.signal_evals.slice(-10)
              : [],
          trades: Array.isArray(backtestPayload.trades) ? backtestPayload.trades.slice(-10) : [],
          terminal: backtestPayload.terminal ?? null,
        }
      : null,
    errors,
  }
}

const PYTHON_PPTX_DRAFT_SCRIPT = String.raw`
from __future__ import annotations

import datetime
import html
import json
import os
import re
import sys
import zipfile
from pathlib import Path


def split_lines(text: str) -> list[str]:
    lines = []
    for raw in re.split(r"[\r\n]+", text or ""):
        item = re.sub(r"^\s*[-*#\d.、]+\s*", "", raw).strip()
        if item:
            lines.append(item)
    if lines:
        return lines
    chunks = re.split(r"[。；;.!?！？]+", text or "")
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def build_slide_plan(title: str, prompt: str) -> list[tuple[str, list[str]]]:
    lines = split_lines(prompt)
    slides: list[tuple[str, list[str]]] = [
        (title or "Longclaw PPT Draft", ["Python PPTX helper draft", datetime.date.today().isoformat()])
    ]
    if not lines:
        lines = ["任务理解", "结构规划", "视觉建议", "下一步完善"]
    buckets = [
        ("任务理解", lines[:3]),
        ("内容结构", lines[3:7] or ["封面", "核心论点", "数据与证据", "行动建议"]),
        ("视觉与图表", lines[7:11] or ["保留统一版式", "优先使用可复核图表", "保留来源脚注"]),
        ("待完善项", lines[11:15] or ["补充真实数据", "替换模板母版", "进行渲染和视觉 QA"]),
    ]
    slides.extend((heading, bullets[:5]) for heading, bullets in buckets)
    return slides[:8]


def esc(value: str) -> str:
    return html.escape(str(value), quote=False)


def paragraph(text: str, size: int = 2000, bold: bool = False) -> str:
    return (
        '<a:p><a:r><a:rPr lang="zh-CN" sz="%d"%s/><a:t>%s</a:t></a:r></a:p>'
        % (size, ' b="1"' if bold else "", esc(text))
    )


def text_shape(shape_id: int, name: str, x: int, y: int, cx: int, cy: int, paragraphs: list[str], size: int, bold: bool = False) -> str:
    body = "".join(paragraph(item, size=size, bold=bold and index == 0) for index, item in enumerate(paragraphs))
    return f'''
      <p:sp>
        <p:nvSpPr><p:cNvPr id="{shape_id}" name="{esc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
        <p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>{body}</p:txBody>
      </p:sp>'''


def slide_xml(title: str, bullets: list[str]) -> str:
    bullet_lines = [f"• {item}" for item in bullets if item]
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      {text_shape(2, "Title", 548640, 457200, 8046720, 914400, [title], 3400, True)}
      {text_shape(3, "Body", 731520, 1600200, 7680960, 3657600, bullet_lines or ["• Draft slide"], 2000)}
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Footer"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="548640" y="6400800"/><a:ext cx="8046720" cy="365760"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>{paragraph("Generated by Longclaw python-pptx-helper", 1200)}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>'''


def write_zip_fallback(output_path: Path, slides: list[tuple[str, list[str]]]) -> None:
    slide_overrides = "\n".join(
        f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(1, len(slides) + 1)
    )
    slide_ids = "\n".join(
        f'<p:sldId id="{255 + i}" r:id="rId{i}"/>' for i in range(1, len(slides) + 1)
    )
    slide_rels = "\n".join(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
        for i in range(1, len(slides) + 1)
    )
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  {slide_overrides}
</Types>''')
        z.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>''')
        z.writestr("docProps/app.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Longclaw Agent OS</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>{len(slides)}</Slides></Properties>''')
        z.writestr("docProps/core.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{esc(slides[0][0])}</dc:title><dc:creator>Longclaw Agent OS</dc:creator><cp:lastModifiedBy>Longclaw Agent OS</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{datetime.datetime.utcnow().isoformat()}Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{datetime.datetime.utcnow().isoformat()}Z</dcterms:modified></cp:coreProperties>''')
        z.writestr("ppt/presentation.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId{len(slides)+1}"/></p:sldMasterIdLst><p:sldIdLst>{slide_ids}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>''')
        z.writestr("ppt/_rels/presentation.xml.rels", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{slide_rels}<Relationship Id="rId{len(slides)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>''')
        z.writestr("ppt/theme/theme1.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Longclaw"><a:themeElements><a:clrScheme name="Longclaw"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="EA580C"/></a:accent2><a:accent3><a:srgbClr val="059669"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="DB2777"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Longclaw"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="Longclaw"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>''')
        z.writestr("ppt/slideMasters/slideMaster1.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>''')
        z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>''')
        z.writestr("ppt/slideLayouts/slideLayout1.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>''')
        z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>''')
        for i, (slide_title, bullets) in enumerate(slides, start=1):
            z.writestr(f"ppt/slides/slide{i}.xml", slide_xml(slide_title, bullets))
            z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>''')


def write_with_python_pptx(output_path: Path, slides: list[tuple[str, list[str]]]) -> bool:
    try:
        from pptx import Presentation  # type: ignore
        from pptx.util import Inches, Pt  # type: ignore
    except Exception:
        return False
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    for index, (heading, bullets) in enumerate(slides):
        layout = prs.slide_layouts[0] if index == 0 else prs.slide_layouts[1]
        slide = prs.slides.add_slide(layout)
        if slide.shapes.title:
            slide.shapes.title.text = heading
        if index == 0:
            subtitle = slide.placeholders[1] if len(slide.placeholders) > 1 else None
            if subtitle:
                subtitle.text = "\n".join(bullets)
        else:
            body = slide.placeholders[1] if len(slide.placeholders) > 1 else slide.shapes.add_textbox(Inches(1), Inches(1.8), Inches(11), Inches(4.8))
            frame = body.text_frame
            frame.clear()
            for item in bullets:
                p = frame.add_paragraph()
                p.text = item
                p.level = 0
                p.font.size = Pt(20)
    prs.save(output_path)
    return True


def main() -> None:
    output_path = Path(sys.argv[1])
    title = sys.argv[2]
    prompt = sys.argv[3]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    slides = build_slide_plan(title, prompt)
    backend = "python-pptx" if write_with_python_pptx(output_path, slides) else "python-openxml-zip"
    if backend == "python-openxml-zip":
        write_zip_fallback(output_path, slides)
    result = {
        "ok": output_path.exists() and output_path.stat().st_size > 0,
        "backend": backend,
        "output_path": str(output_path),
        "slide_count": len(slides),
        "title": title,
        "size_bytes": output_path.stat().st_size if output_path.exists() else 0,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
`

async function runPythonPptxDraft(payload: Record<string, unknown>) {
  const prompt = readString(payload.prompt) ?? readString(payload.message) ?? ''
  const title =
    readString(payload.title) ??
    prompt.match(/[“"']([^“"']{2,48})[”"']/)?.[1] ??
    prompt
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean)
      ?.slice(0, 48) ??
    'Longclaw PPT Draft'
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeFileSegment(title)}`
  const outputRoot = path.join(PPT_TOOL_RUNS_DIR, runId)
  const outputPath = path.join(outputRoot, `${safeFileSegment(title)}.pptx`)
  fs.mkdirSync(outputRoot, { recursive: true })
  const python = resolveWorkspacePythonExecutable()
  try {
    const { stdout, stderr } = await execFileText(
      python,
      ['-c', PYTHON_PPTX_DRAFT_SCRIPT, outputPath, title, prompt],
      {
        timeout: Number(payload.timeout_ms) || 180_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    )
    const parsed = parseJsonFromCommandOutput(stdout) ?? {}
    const slideCount = Number(parsed.slide_count ?? 0)
    const sizeBytes = Number(parsed.size_bytes ?? 0)
    const backend = nestedString(parsed, 'backend') || 'python-openxml-zip'
    const artifactBundle = pptxArtifactForRun(
      runId,
      title,
      outputPath,
      backend,
      slideCount,
      sizeBytes,
      outputRoot,
    )
    return {
      ok: Boolean(parsed.ok),
      kind: 'run_python_pptx_draft',
      message: parsed.ok ? 'python PPTX draft generated' : 'python PPTX draft failed',
      run_id: runId,
      title,
      output_path: outputPath,
      output_root: outputRoot,
      backend,
      slide_count: slideCount,
      size_bytes: sizeBytes,
      artifacts: parsed.ok ? [artifactBundle.artifact] : [],
      artifact_refs: parsed.ok ? [artifactBundle.artifact_ref] : [],
      python,
      stdout_tail: tailText(stdout, 1200),
      stderr_tail: tailText(stderr, 1200),
    }
  } catch (error) {
    const record = error as Error & { stdout?: string; stderr?: string; code?: string | number | null }
    return {
      ok: false,
      kind: 'run_python_pptx_draft',
      message: record.message || 'python PPTX draft failed',
      code: record.code ?? null,
      title,
      output_path: outputPath,
      output_root: outputRoot,
      python,
      stdout_tail: tailText(record.stdout, 2400),
      stderr_tail: tailText(record.stderr, 2400),
    }
  }
}

async function collectRuntimeStatus(
  packs: LongclawDomainPackDescriptor[],
  overviewReady: boolean,
): Promise<Record<string, unknown>> {
  const coreBaseUrl =
    process.env.LONGCLAW_AGENT_OS_BASE_URL ?? process.env.LONGCLAW_HERMES_AGENT_OS_BASE_URL
  const dueDiligenceBaseUrl = process.env.LONGCLAW_DUE_DILIGENCE_BASE_URL
  const signalsStateRoot = process.env.LONGCLAW_SIGNALS_STATE_ROOT
  const configuredSignalsWebBaseUrl = process.env.LONGCLAW_SIGNALS_WEB_BASE_URL?.replace(/\/$/, '')
  const defaultSignalsWebBaseUrl = `http://127.0.0.1:${process.env.LONGCLAW_SIGNALS_WEB_PORT ?? '8011'}`
  const signalsWebCandidateUrl = configuredSignalsWebBaseUrl || defaultSignalsWebBaseUrl
  const acpBridge = inspectConfiguredAcpBridge()
  const currentSeatPreference = getLocalRuntimeSeatPreference()
  const localRuntimeSeat = await probeLocalRuntimeSeat(currentSeatPreference)
  const localRuntimeApiSeat = await probeLocalRuntimeSeat('force_local_runtime_api')

  const duePackVisible = packs.some(pack => pack.pack_id === 'due_diligence')
  const signalsPackVisible = packs.some(pack => pack.pack_id === 'signals')
  const normalizedCoreBaseUrl = coreBaseUrl?.replace(/\/$/, '')
  const [coreHealthReady, dueHealthReady, signalsWebReady, signalsWebPortOpen] = await Promise.all([
    // `getOverview()` can fall back to a synthesized local summary when Hermes is down,
    // so connectivity must come from a direct probe rather than the fulfilled state alone.
    probeHttpOk(
      normalizedCoreBaseUrl
        ? `${normalizedCoreBaseUrl}/agent-os/overview`
        : undefined,
    ),
    probeHttpOk(
      dueDiligenceBaseUrl
        ? `${dueDiligenceBaseUrl.replace(/\/$/, '')}/healthz`
        : undefined,
    ),
    probeHttpOk(`${signalsWebCandidateUrl}/api/pack/descriptor`),
    probeTcpOpen(signalsWebCandidateUrl),
  ])
  const signalsWebBaseUrl = configuredSignalsWebBaseUrl || (signalsWebReady || signalsWebPortOpen ? signalsWebCandidateUrl : '')

  return {
    stack_env_loaded: runtimeStackEnv.loaded,
    stack_env_path: runtimeStackEnv.path,
    stack_env_applied_keys: runtimeStackEnv.appliedKeys,
    longclaw_core_connected: Boolean(
      normalizedCoreBaseUrl &&
        getControlPlaneClient().isHermesBacked() &&
        overviewReady &&
        coreHealthReady,
    ),
    longclaw_core_base_url: coreBaseUrl ?? '',
    due_diligence_connected: Boolean(duePackVisible || dueHealthReady),
    due_diligence_base_url: dueDiligenceBaseUrl ?? '',
    signals_available: Boolean(
      signalsPackVisible ||
        (signalsStateRoot && fs.existsSync(signalsStateRoot)) ||
        signalsWebBaseUrl,
    ),
    signals_state_root: signalsStateRoot ?? '',
    signals_web_base_url: signalsWebBaseUrl ?? '',
    local_acp_available: acpBridge.available,
    local_acp_script: acpBridge.path,
    local_acp_source: acpBridge.source,
    local_runtime_seat: localRuntimeSeat.seat,
    local_runtime_seat_preference: currentSeatPreference,
    local_runtime_seat_override_active: currentSeatPreference !== 'auto',
    local_runtime_available: localRuntimeSeat.available,
    local_runtime_api_url: localRuntimeSeat.localRuntimeApiUrl ?? '',
    local_runtime_api_available: localRuntimeApiSeat.healthOk,
    dev_machine_acp_takeover:
      currentSeatPreference === 'auto' &&
      acpBridge.available &&
      localRuntimeSeat.seat === 'acp_bridge',
    runtime_profile:
      process.env.LONGCLAW_RUNTIME_PROFILE ??
      localRuntimeSeat.runtimeProfile,
  }
}

function requireExistingAbsolutePath(rawPath: unknown): string {
  const filePath = readString(rawPath)
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error('absolute path is required')
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`file does not exist: ${filePath}`)
  }
  return filePath
}

function uniqueDownloadsPath(sourcePath: string): string {
  const downloadsDir = app.getPath('downloads') || path.join(os.homedir(), 'Downloads')
  fs.mkdirSync(downloadsDir, { recursive: true })
  const parsed = path.parse(sourcePath)
  const baseName = parsed.name || 'artifact'
  const extension = parsed.ext || ''
  let candidate = path.join(downloadsDir, `${baseName}${extension}`)
  let index = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(downloadsDir, `${baseName}-${index}${extension}`)
    index += 1
  }
  return candidate
}

async function exportArtifactToDownloads(payload: Record<string, unknown>) {
  const sourcePath = requireExistingAbsolutePath(payload.path ?? payload.uri)
  const destinationPath = uniqueDownloadsPath(sourcePath)
  fs.copyFileSync(sourcePath, destinationPath)
  const size = fs.statSync(destinationPath).size
  return {
    ok: true,
    kind: 'export_artifact_to_downloads',
    source_path: sourcePath,
    download_path: destinationPath,
    size_bytes: size,
  }
}

async function preparePptxPreview(payload: Record<string, unknown>) {
  const sourcePath = requireExistingAbsolutePath(payload.path ?? payload.uri)
  const previewDir = path.join(path.dirname(sourcePath), 'preview')
  fs.mkdirSync(previewDir, { recursive: true })
  const before = Date.now()
  try {
    const { stdout, stderr } = await execFileText(
      '/usr/bin/qlmanage',
      ['-t', '-s', String(readNumber(payload.size) ?? 960), '-o', previewDir, sourcePath],
      {
        timeout: readNumber(payload.timeout_ms) ?? 30_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )
    const previews = fs
      .readdirSync(previewDir)
      .filter(fileName => fileName.toLowerCase().endsWith('.png'))
      .map(fileName => path.join(previewDir, fileName))
      .filter(candidate => fs.statSync(candidate).mtimeMs >= before - 1000)
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    const previewPath = previews[0]
    if (!previewPath) {
      return {
        ok: false,
        kind: 'prepare_pptx_preview',
        message: 'QuickLook did not produce a PNG preview',
        source_path: sourcePath,
        preview_dir: previewDir,
        stdout_tail: tailText(stdout, 1200),
        stderr_tail: tailText(stderr, 1200),
      }
    }
    return {
      ok: true,
      kind: 'prepare_pptx_preview',
      message: 'QuickLook preview generated',
      source_path: sourcePath,
      preview_path: previewPath,
      preview_dir: previewDir,
      size_bytes: fs.statSync(previewPath).size,
      stdout_tail: tailText(stdout, 1200),
      stderr_tail: tailText(stderr, 1200),
    }
  } catch (error) {
    const record = error as Error & { stdout?: string; stderr?: string; code?: string | number | null }
    return {
      ok: false,
      kind: 'prepare_pptx_preview',
      message: record.message || 'QuickLook preview failed',
      code: record.code ?? null,
      source_path: sourcePath,
      preview_dir: previewDir,
      stdout_tail: tailText(record.stdout, 1200),
      stderr_tail: tailText(record.stderr, 1200),
    }
  }
}

async function handleLocalAction(_event: Electron.IpcMainInvokeEvent, action: { kind: string; payload?: any }) {
  const payload = action?.payload ?? {}
  switch (action?.kind) {
    case 'open_path':
      return { ok: true, kind: action.kind, result: await shell.openPath(String(payload.path || '')) }
    case 'reveal_path': {
      const filePath = requireExistingAbsolutePath(payload.path ?? payload.uri)
      shell.showItemInFolder(filePath)
      return { ok: true, kind: action.kind, path: filePath }
    }
    case 'open_url':
      await shell.openExternal(String(payload.url || ''))
      return { ok: true, kind: action.kind }
    case 'copy_value':
      clipboard.writeText(String(payload.value || ''))
      return { ok: true, kind: action.kind }
    case 'export_artifact_to_downloads':
      return exportArtifactToDownloads(payload)
    case 'prepare_pptx_preview':
      return preparePptxPreview(payload)
    case 'run_pptx_draft':
      return runPptxgenjsDraft(payload)
    case 'run_python_pptx_draft':
      return runPythonPptxDraft(payload)
    case 'run_due_diligence_rpa_demo':
      return runDueDiligenceRpaDemo(payload)
    case 'run_signals_research':
      return runSignalsResearchTool(payload)
    default:
      throw new Error(`Unsupported local action: ${action?.kind}`)
  }
}

async function handleReadArtifactPreview(_event: Electron.IpcMainInvokeEvent, uri: string) {
  if (!uri || !path.isAbsolute(uri) || !fs.existsSync(uri)) {
    return { ok: false, reason: 'missing_file' }
  }

  const stat = fs.statSync(uri)
  if (stat.size > 256 * 1024) {
    return { ok: false, reason: 'too_large', size: stat.size }
  }

  const text = fs.readFileSync(uri, 'utf-8')
  return { ok: true, text, size: stat.size }
}

// --- Skills discovery ---

interface SkillInfo {
  name: string
  path: string
  description: string
  project?: string
  source?: string
  registry_id?: string
  managed?: boolean
  health?: string
}

interface PluginInfo {
  plugin_id: string
  label: string
  path: string
  description: string
  source: string
  project?: string
  registry_id?: string
  managed?: boolean
  health?: string
}

type CapabilityManagerSettings = {
  disabled_capabilities: string[]
  capability_groups: Record<string, string>
  extra_skill_roots: string[]
  extra_plugin_roots: string[]
}

type AgentStreamEvent = {
  type: 'text' | 'tool' | 'result' | 'error'
  text?: string
  toolName?: string
  toolInput?: unknown
  result?: unknown
  error?: string
}

const WORKSPACE_ROOT_CANDIDATES = [
  path.join(os.homedir(), 'github代码仓库'),
  path.join(os.homedir(), 'Desktop', 'github代码仓库'),
]

const KNOWN_SKILL_PROJECTS = [
  'Signals',
  'aippt',
  'aippt/ppt-master',
  'Chanless',
  'gstack',
  'superpowers',
  'compound-engineering-plugin',
]

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean).map(item => path.resolve(item)))]
}

function expandUserPath(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '~') return os.homedir()
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2))
  return trimmed
}

function normalizeCapabilityIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))].sort()
}

function normalizeCapabilityGroupMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, group]) => [String(key).trim(), String(group ?? '').trim()] as const)
      .filter(([key, group]) => Boolean(key) && Boolean(group))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function normalizeDiscoveryRoots(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return uniquePaths(
    value
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
      .map(expandUserPath),
  )
}

function defaultCapabilityManagerSettings(): CapabilityManagerSettings {
  return {
    disabled_capabilities: [],
    capability_groups: {},
    extra_skill_roots: [],
    extra_plugin_roots: [],
  }
}

function normalizeCapabilityManagerSettings(
  value: unknown,
  base: CapabilityManagerSettings = defaultCapabilityManagerSettings(),
): CapabilityManagerSettings {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  return {
    disabled_capabilities:
      'disabled_capabilities' in record
        ? normalizeCapabilityIdList(record.disabled_capabilities)
        : base.disabled_capabilities,
    capability_groups:
      'capability_groups' in record
        ? normalizeCapabilityGroupMap(record.capability_groups)
        : base.capability_groups,
    extra_skill_roots:
      'extra_skill_roots' in record
        ? normalizeDiscoveryRoots(record.extra_skill_roots)
        : base.extra_skill_roots,
    extra_plugin_roots:
      'extra_plugin_roots' in record
        ? normalizeDiscoveryRoots(record.extra_plugin_roots)
        : base.extra_plugin_roots,
  }
}

function loadCapabilityManagerSettings(): CapabilityManagerSettings {
  if (!fs.existsSync(CAPABILITY_MANAGER_SETTINGS_PATH)) {
    return defaultCapabilityManagerSettings()
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(CAPABILITY_MANAGER_SETTINGS_PATH, 'utf-8'),
    ) as Record<string, unknown>
    return normalizeCapabilityManagerSettings(raw)
  } catch (error) {
    log('failed to load capability manager settings', CAPABILITY_MANAGER_SETTINGS_PATH, error)
    return defaultCapabilityManagerSettings()
  }
}

function persistCapabilityManagerSettings(settings: CapabilityManagerSettings): CapabilityManagerSettings {
  const normalized = normalizeCapabilityManagerSettings(settings)
  fs.mkdirSync(LONGCLAW_RUNTIME_DIR, { recursive: true })
  fs.writeFileSync(
    CAPABILITY_MANAGER_SETTINGS_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf-8',
  )
  return normalized
}

let capabilityManagerSettings = loadCapabilityManagerSettings()
let runtimeCapabilityRegistry = readRuntimeCapabilityRegistry(
  CAPABILITY_REGISTRY_PATH,
  LONGCLAW_RUNTIME_DIR,
)

type ModelServiceAlias = {
  id: string
  model: string
  alias: string
  thinking: boolean
}

type ModelServiceSettingsPrivate = {
  enabled: boolean
  baseUrl: string
  apiKey: string
  aliases: ModelServiceAlias[]
  lastModels: string[]
  updatedAt?: string
}

type ModelServiceSettingsPublic = Omit<ModelServiceSettingsPrivate, 'apiKey'> & {
  apiKeySet: boolean
}

type ModelServiceResult = {
  ok: boolean
  message: string
  models?: string[]
  settings?: ModelServiceSettingsPublic
}

type ModelServiceChatResult = {
  ok: boolean
  message: string
  text?: string
  model?: string
  usage?: unknown
}

type EmployeeSeedDefinition = {
  id: string
  title: string
  subtitle: string
  icon: string
  defaultModel: string
  order: number
  preview: string
  skillMentions: string[]
  instructions: string
}

type EmployeeSkillContext = {
  name: string
  path: string
  description: string
  excerpt: string
}

type EmployeeSupportSkillSeed = {
  id: string
  title: string
  description: string
  instructions: string
}

type EmployeeDefinition = EmployeeSeedDefinition & {
  enabled: boolean
  path: string
  source: 'filesystem'
  skillContexts: EmployeeSkillContext[]
}

const DEFAULT_EMPLOYEE_DEFINITIONS: EmployeeSeedDefinition[] = [
  {
    id: 'ppt-designer',
    title: 'PPT设计专员',
    subtitle: 'PPTX、汇报页与路演 deck',
    icon: 'document',
    defaultModel: 'deepseek',
    order: 5,
    preview: '生成可编辑 PPTX、汇报页、路演 deck，支持模板继承、渲染预览和视觉 QA。',
    skillMentions: ['presentations', 'ppt-master', 'pptxgenjs', 'python-pptx'],
    instructions:
      '你是 PPT设计专员。收到 PPT 或 deck 任务时，先判断任务模式、backend profile 和 deck profile；如果是从提示创建方案，先输出“已读完 Presentations 技能说明，下面按完整专业流程来设计这套方案。”，再给 Claim Spine、Contact Sheet、设计系统、逐页方案、质量检查。需要实际产出文件时，优先走 Presentations artifact-tool 的可编辑 PPTX、渲染预览和视觉 QA；用户显式要求 ppt-master 时，走 ppt-master SVG 到 DrawingML 的本地流水线；需要快速生成可打开的本地 PPTX 草稿时，默认调用 pptxgenjs 工具；需要数据处理、图表图片或兜底生成时，再调用 python-pptx 辅助 skill。不要把快速草稿夸大为最终高质量交付。',
  },
  {
    id: 'web-assistant',
    title: '网页助手',
    subtitle: '检索、登录、下载与网页整理',
    icon: 'link',
    defaultModel: 'deepseek',
    order: 10,
    preview: '上网检索、页面信息提取、资料下载和浏览器 RPA 执行。',
    skillMentions: ['browser', 'playwright', 'browser-rpa'],
    instructions:
      '你是网页助手。优先完成网页检索、页面阅读、资料下载、链接整理和来源核验。执行类网页任务要连接到执行功能：执行本质是一个可控浏览器，浏览器负责跑 RPA。用户提出尽调、RPA、浏览器执行或模拟流程时，优先触发本机 due-diligence 成熟流程，并基于真实运行结果总结，不要编造网页内容。',
  },
  {
    id: 'data-analyst',
    title: '数据分析师',
    subtitle: '表格清洗、统计分析与可视化',
    icon: 'data',
    defaultModel: 'deepseek',
    order: 20,
    preview: '连接本地文件、表格和数据库，产出可复核的数据结论。',
    skillMentions: ['spreadsheets', 'python'],
    instructions:
      '你是数据分析师。优先完成数据清洗、统计口径说明、可视化建议和结果复核。回答时先给结论，再列数据口径、异常值和可复现步骤。',
  },
  {
    id: 'sales-assistant',
    title: '销售助手',
    subtitle: '客户跟进、材料整理与行动计划',
    icon: 'chat',
    defaultModel: 'deepseek',
    order: 30,
    preview: '整理客户背景、跟进邮件、会议纪要和下一步销售动作。',
    skillMentions: ['sales'],
    instructions:
      '你是销售助手。优先整理客户背景、会议纪要、跟进话术、采购风险和下一步行动。输出要克制、具体、可直接执行。',
  },
  {
    id: 'research-assistant',
    title: '投研助手',
    subtitle: '市场线索、产业链与策略复盘',
    icon: 'strategy',
    defaultModel: 'deepseek',
    order: 40,
    preview: '围绕市场主线、产业链、公司线索和策略复盘做结构化研究。',
    skillMentions: ['signals-research', 'signals', 'daloopa'],
    instructions:
      '你是投研助手。核心能力绑定 Signals 系统的识别信号、策略复盘、回测能力和本地数据库上下文；优先通过 Signals Pack/API/MCP 边界读取本机真实上下文，再结合产业链和公司研究做结构化输出。避免直接买卖指令，明确证据、风险、回测口径和待验证信号。',
  },
  {
    id: 'replay-review-assistant',
    title: '复盘助手',
    subtitle: '盘后长复盘、板块卡位与次日验证',
    icon: 'strategy',
    defaultModel: 'deepseek',
    order: 45,
    preview: '按截图样例口吻复原全天资金流、板块15、三池共性、尾盘情绪和明日验证点。',
    skillMentions: ['signals-replay-review', 'signals-review', 'signals-research'],
    instructions:
      '你是复盘助手。默认按用户截图样例写盘后长复盘：先讲市场真实结构，再讲资金流时间链、板块15卡位、三池共性、尾盘情绪和明日验证点。优先读取 Signals 本机真实数据，尤其是 /api/workbench/shell 的 indices、watchlist_groups.sector_boards、focus_stocks、watch_stocks、risk_stocks，以及 /api/pack/dashboard 的 overview.cluster_summary。需要生成正文时，默认运行 `bash scripts/python.sh -m signals.notify.trading_workbench_summary --window postmarket --max-items 5 --ignore-time --format narrative`；需要接入工具时，使用 `bash scripts/python.sh -m signals.mcp.review_assistant_server`。不要输出直接买卖指令，不要把 runtime/Mongo/cache 状态写进交易复盘。',
  },
  {
    id: 'document-specialist',
    title: '文档与版式专员',
    subtitle: 'PPT、文档结构与版式方案',
    icon: 'document',
    defaultModel: 'deepseek',
    order: 50,
    preview: '生成 PPT 大纲、文档结构、页面叙事和版式建议。',
    skillMentions: ['presentations', 'documents'],
    instructions:
      '你是文档与版式专员。优先完成 PPT 大纲、页面叙事、版式建议、图表建议和演讲备注。输出要按页组织，便于直接交给制作工具。',
  },
]

const DEFAULT_EMPLOYEE_SUPPORT_SKILLS: EmployeeSupportSkillSeed[] = [
  {
    id: 'pptxgenjs',
    title: 'PPTXGenJS 快速草稿生成',
    description: '用 Electron 内置 Node 依赖生成可打开、可编辑的 PPTX 快速草稿，是 Agent OS 本地 PPT tool 的默认轻量后端。',
    instructions: `# PPTXGenJS 快速草稿生成

该 skill 是 PPT设计专员的默认本地 tool backend，用来快速生成可打开的 PPTX 草稿。它不替代 Presentations artifact-tool 的最终高质量 deck 流水线。

## 适用场景

- 用户明确要求“生成文件”“做一份 PPTX”“先出草稿”。
- 需要在 Electron Agent OS 内稳定打包、离线生成基础 PPTX。
- 需要输出可打开的占位页、结构页、会议初稿，供后续 Presentations/ppt-master 精修。

## 不适用场景

- 高保真模板继承、复杂设计系统、视觉 QA 后的最终交付。
- 需要严肃 finance/IR deck 的精确来源脚注、复杂图表和渲染预览闭环。
- 用户显式要求 ppt-master 或 Presentations artifact-tool 时。

## 打包原则

- Node runtime 随 Electron 一起存在，只需要把 pptxgenjs 作为 app 依赖打包。
- 不把 Python 作为硬依赖塞进第一版 Agent；Python 只作为可选 sidecar/fallback。
- 回答时标注 backend profile：pptxgenjs-draft，并说明它是快速草稿。
`,
  },
  {
    id: 'python-pptx',
    title: 'Python PPTX 辅助生成',
    description: '用 Python 生成快速 PPTX 草稿、数据图表页、图片式页面和批量占位页，作为 Presentations/ppt-master 的辅助流水线。',
    instructions: `# Python PPTX 辅助生成

该 skill 是 PPT设计专员的辅助 backend profile，不是高质量商务 deck 的默认最终产线。

## 适用场景

- 快速生成可打开的 PPTX 草稿、批量占位页、会议初稿。
- 用 Python 数据处理生成图表图片，再嵌入 PPTX。
- 将已有图片、截图、SVG/PNG 预览组合成图片式 PPT。
- 在 artifact-tool 或 ppt-master 不适合时，作为临时 fallback 或中间产物。

## 不适用场景

- 高保真模板跟随、复杂版式、精细可编辑图形、最终交付级视觉 QA。
- 用户要求“高质量可编辑 deck”时，默认仍应使用 Presentations artifact-tool。
- 用户显式要求 ppt-master 时，走 SVG 到 DrawingML 的本地流水线。

## 推荐实现

- 使用 Codex workspace dependencies 提供的 Python 运行时和库，不依赖系统 Python。
- 优先使用 python-pptx 创建基础 PPTX；用 matplotlib/Pillow 生成数据图或页面图片。
- 输出前检查：PPTX 存在、非空、页数符合预期；必要时渲染/截图抽检。
- 回答时明确标注 backend profile：python-pptx-helper 或 python-image-deck。

## 路由关系

- presentations-artifact-tool：默认高质量可编辑 PPTX。
- ppt-master-svg-drawingml：显式要求 ppt-master 或 SVG 到 DrawingML。
- python-pptx-helper：快速草稿、数据图、批量页、图片式 deck 辅助。
`,
  },
  {
    id: 'browser-rpa',
    title: '浏览器 RPA 执行',
    description: '把网页助手连接到执行页浏览器能力，优先复用 due-diligence-core 的成熟 Playwright 尽调流程。',
    instructions: `# 浏览器 RPA 执行

该 skill 绑定给网页助手，用来把“网页理解/检索”升级为“浏览器执行/RPA”。

## 运行模型

- 执行本质是一个可控浏览器。
- 浏览器负责点击、输入、等待、截图、下载和证据留存。
- 网页助手负责理解目标、选择流程、总结真实运行结果。

## 默认成熟流程

- 默认复用本机仓库：/Users/zhangqilong/github代码仓库/due-diligence-core
- 默认命令：bash scripts/python.sh -m due_diligence_core.cli validate-site process49_www_baidu_com "国泰君安"
- 输出会写入 ~/.longclaw/runtime-v2/rpa-runs/<run-id>
- 结果以 validation_state、current_automation_status、report_path、shadow_compare_path、evidence_root 为准。

## 触发规则

- 用户提到“尽调”“RPA”“浏览器执行”“模拟流程”“跑通流程”时，优先触发本地 RPA action。
- 如果用户只要求资料整理或链接核验，可以只走 browser/playwright 阅读流程。
- 不要声称已经访问网页或生成证据，除非本地 action 返回了真实路径或报告。

## 输出要求

- 先给运行结论，再给站点、查询词、状态、证据路径和下一步。
- 失败时要给命令、错误摘要和可复现输出目录。
- 需要完整交付 zip 时，再升级到 due-diligence-core 的 desktop-server simulation。
	`,
  },
  {
    id: 'signals-research',
    title: 'Signals 投研工具',
    description: '把投研助手绑定到 Signals Pack/API、信号识别、策略复盘、回测和本地数据库上下文。',
    instructions: `# Signals 投研工具

该 skill 绑定给投研助手，用来读取本机 Signals 系统中的真实市场上下文。优先走 Signals Web/Pack API；只有本地 MCP 服务可用且权限明确时，才通过 MCP 读取数据库。

## 默认读取边界

- /api/pack/dashboard：市场线、主线、候选池、风险提示和 cache/provider 状态。
- /api/workbench/shell：交易台 shell、watchlist 分组、行情水位和策略摘要。
- /api/workbench/symbol/{symbol}：单标的上下文、最新信号、图表上下文。
- /api/backtest/analyze：指定标的、频率和参数的只读回测分析。

## 输出要求

- 先给结论，再给证据来源和回测口径。
- 明确数据状态：cache、provider blocker、trade_date、freq、lookback、stop_loss、max_hold、slippage。
- 不输出直接买/卖指令；只输出研究判断、风险和待验证动作。
- 不声称读取了数据库/MCP，除非 tool result 明确包含该来源。
`,
  },
]

function defaultModelServiceSettings(): ModelServiceSettingsPrivate {
  return {
    enabled: false,
    baseUrl: 'https://api.example.com/v1',
    apiKey: '',
    aliases: [],
    lastModels: [],
  }
}

function normalizeModelServiceAlias(value: unknown): ModelServiceAlias | null {
  if (!isPlainRecord(value)) return null
  const model = readString(value.model)
  const alias = readString(value.alias)
  if (!model || !alias) return null
  const id = readString(value.id) ?? `alias:${createHash('sha1').update(`${model}:${alias}`).digest('hex').slice(0, 12)}`
  return {
    id,
    model,
    alias,
    thinking: value.thinking === true,
  }
}

function normalizeModelServiceSettings(
  value: unknown,
  base: ModelServiceSettingsPrivate = defaultModelServiceSettings(),
): ModelServiceSettingsPrivate {
  const record = isPlainRecord(value) ? value : {}
  const aliases = Array.isArray(record.aliases)
    ? record.aliases
        .map(normalizeModelServiceAlias)
        .filter((item): item is ModelServiceAlias => Boolean(item))
    : base.aliases
  const lastModels = Array.isArray(record.lastModels)
    ? record.lastModels.map(readString).filter((item): item is string => Boolean(item))
    : base.lastModels
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : base.enabled,
    baseUrl: readString(record.baseUrl) ?? base.baseUrl,
    apiKey: readString(record.apiKey) ?? base.apiKey,
    aliases,
    lastModels: [...new Set(lastModels)].slice(0, 80),
    updatedAt: readString(record.updatedAt) ?? base.updatedAt,
  }
}

function publicModelServiceSettings(
  settings: ModelServiceSettingsPrivate,
): ModelServiceSettingsPublic {
  return {
    enabled: settings.enabled,
    baseUrl: settings.baseUrl,
    aliases: settings.aliases,
    lastModels: settings.lastModels,
    updatedAt: settings.updatedAt,
    apiKeySet: Boolean(settings.apiKey),
  }
}

function loadModelServiceSettings(): ModelServiceSettingsPrivate {
  if (!fs.existsSync(MODEL_SERVICE_SETTINGS_PATH)) return defaultModelServiceSettings()
  try {
    return normalizeModelServiceSettings(
      JSON.parse(fs.readFileSync(MODEL_SERVICE_SETTINGS_PATH, 'utf-8')),
    )
  } catch (error) {
    log('failed to load model service settings', MODEL_SERVICE_SETTINGS_PATH, error)
    return defaultModelServiceSettings()
  }
}

function persistModelServiceSettings(
  settings: ModelServiceSettingsPrivate,
): ModelServiceSettingsPrivate {
  const normalized = normalizeModelServiceSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  })
  fs.mkdirSync(LONGCLAW_RUNTIME_DIR, { recursive: true })
  fs.writeFileSync(
    MODEL_SERVICE_SETTINGS_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf-8',
  )
  try {
    fs.chmodSync(MODEL_SERVICE_SETTINGS_PATH, 0o600)
  } catch {
    // Best effort on platforms that support POSIX permissions.
  }
  return normalized
}

let modelServiceSettings = loadModelServiceSettings()

function getModelServiceSettings(): ModelServiceSettingsPublic {
  modelServiceSettings = loadModelServiceSettings()
  return publicModelServiceSettings(modelServiceSettings)
}

function updateModelServiceSettings(patch: unknown): ModelServiceSettingsPublic {
  const record = isPlainRecord(patch) ? patch : {}
  const aliases =
    'aliases' in record && Array.isArray(record.aliases)
      ? record.aliases
          .map(normalizeModelServiceAlias)
          .filter((item): item is ModelServiceAlias => Boolean(item))
      : modelServiceSettings.aliases
  modelServiceSettings = persistModelServiceSettings({
    ...modelServiceSettings,
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : modelServiceSettings.enabled,
    baseUrl: readString(record.baseUrl) ?? modelServiceSettings.baseUrl,
    apiKey:
      'apiKey' in record
        ? readString(record.apiKey) ?? modelServiceSettings.apiKey
        : modelServiceSettings.apiKey,
    aliases,
  })
  return publicModelServiceSettings(modelServiceSettings)
}

function modelServiceModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('baseUrl is required')
  return `${trimmed}/models`
}

function modelServiceChatUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('baseUrl is required')
  return `${trimmed}/chat/completions`
}

async function fetchModelServiceModels(): Promise<ModelServiceResult> {
  const settings = modelServiceSettings
  const url = modelServiceModelsUrl(settings.baseUrl)
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`
  try {
    const response = await fetch(url, { headers })
    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status} ${response.statusText}`,
      }
    }
    const payload = (await response.json()) as unknown
    const data = isPlainRecord(payload) && Array.isArray(payload.data) ? payload.data : []
    const models = data
      .map(item => (isPlainRecord(item) ? readString(item.id) : undefined))
      .filter((item): item is string => Boolean(item))
    modelServiceSettings = persistModelServiceSettings({
      ...settings,
      lastModels: models,
    })
    return {
      ok: true,
      message: models.length > 0 ? 'models fetched' : 'connection ok; no models returned',
      models,
      settings: publicModelServiceSettings(modelServiceSettings),
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function resolveModelServiceModel(settings: ModelServiceSettingsPrivate, requested?: string): string | null {
  const match = requested
    ? settings.aliases.find(item => item.alias === requested || item.model === requested)
    : settings.aliases[0]
  return match?.model ?? requested ?? settings.lastModels[0] ?? null
}

function extractModelServiceChatText(payload: unknown): string {
  if (!isPlainRecord(payload) || !Array.isArray(payload.choices)) return ''
  const first = payload.choices[0]
  if (!isPlainRecord(first)) return ''
  const message = first.message
  if (isPlainRecord(message) && typeof message.content === 'string') return message.content
  if (typeof first.text === 'string') return first.text
  return ''
}

function employeeDefinitionMarkdown(seed: EmployeeSeedDefinition): string {
  return `---
id: ${seed.id}
title: ${seed.title}
subtitle: ${seed.subtitle}
icon: ${seed.icon}
default_model: ${seed.defaultModel}
order: ${seed.order}
enabled: true
skill_mentions: ${seed.skillMentions.join(', ')}
preview: ${seed.preview}
---

# ${seed.title}

${seed.instructions}

## Skill

- 默认模型：${seed.defaultModel}
- 绑定技能：${seed.skillMentions.map(item => `@skill ${item}`).join('、') || '无'}
- 输出要求：先给结论，再给可执行步骤；需要资料时说明要读取的资源。
`
}

function employeeSupportSkillMarkdown(seed: EmployeeSupportSkillSeed): string {
  return `---
id: ${seed.id}
title: ${seed.title}
description: ${seed.description}
---

${seed.instructions}
`
}

function parseEmployeeFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  if (!content.startsWith('---\n')) {
    return { frontmatter: {}, body: content.trim() }
  }
  const endIndex = content.indexOf('\n---', 4)
  if (endIndex < 0) return { frontmatter: {}, body: content.trim() }
  const rawFrontmatter = content.slice(4, endIndex).trim()
  const body = content.slice(endIndex + 4).trim()
  const frontmatter: Record<string, string> = {}
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (key) frontmatter[key] = value
  }
  return { frontmatter, body }
}

function parseEmployeeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  if (/^(false|0|no|off)$/i.test(value)) return false
  if (/^(true|1|yes|on)$/i.test(value)) return true
  return fallback
}

function parseEmployeeList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function employeePreviewFromBody(body: string): string {
  return (
    body
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#') && !line.startsWith('-')) ?? ''
  ).slice(0, 140)
}

function findNewestSkillPath(root: string, relativeSkillPath: string): string | null {
  if (!fs.existsSync(root)) return null
  try {
    const candidates = fs
      .readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(root, entry.name, relativeSkillPath))
      .filter(candidate => fs.existsSync(candidate))
      .sort()
    return candidates.at(-1) ?? null
  } catch {
    return null
  }
}

function ensureEmployeeSupportSkillSeeds(): void {
  fs.mkdirSync(EMPLOYEE_SUPPORT_SKILLS_DIR, { recursive: true })
  for (const seed of DEFAULT_EMPLOYEE_SUPPORT_SKILLS) {
    const skillDir = path.join(EMPLOYEE_SUPPORT_SKILLS_DIR, seed.id)
    const skillPath = path.join(skillDir, 'SKILL.md')
    fs.mkdirSync(skillDir, { recursive: true })
    if (fs.existsSync(skillPath)) continue
    fs.writeFileSync(skillPath, employeeSupportSkillMarkdown(seed), 'utf-8')
  }
}

function knownEmployeeSkillPath(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase()
  if (normalized === 'pptxgenjs' || normalized === 'pptxgenjs-draft') {
    ensureEmployeeSupportSkillSeeds()
    const direct = path.join(EMPLOYEE_SUPPORT_SKILLS_DIR, 'pptxgenjs', 'SKILL.md')
    return fs.existsSync(direct) ? direct : null
  }
  if (normalized === 'python-pptx' || normalized === 'python') {
    ensureEmployeeSupportSkillSeeds()
    const direct = path.join(EMPLOYEE_SUPPORT_SKILLS_DIR, 'python-pptx', 'SKILL.md')
    return fs.existsSync(direct) ? direct : null
  }
  if (normalized === 'browser-rpa' || normalized === 'execution-browser') {
    ensureEmployeeSupportSkillSeeds()
    const direct = path.join(EMPLOYEE_SUPPORT_SKILLS_DIR, 'browser-rpa', 'SKILL.md')
    return fs.existsSync(direct) ? direct : null
  }
  if (normalized === 'signals-research' || normalized === 'signals') {
    ensureEmployeeSupportSkillSeeds()
    const direct = path.join(EMPLOYEE_SUPPORT_SKILLS_DIR, 'signals-research', 'SKILL.md')
    return fs.existsSync(direct) ? direct : null
  }
  if (normalized === 'signals-replay-review' || normalized === 'signals-review') {
    const direct = path.join(
      os.homedir(),
      'github代码仓库',
      'Signals',
      'skills',
      'signals-replay-review',
      'SKILL.md',
    )
    return fs.existsSync(direct) ? direct : null
  }
  if (normalized === 'presentations') {
    return findNewestSkillPath(
      path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-primary-runtime', 'presentations'),
      path.join('skills', 'presentations', 'SKILL.md'),
    )
  }
  if (normalized === 'documents') {
    return findNewestSkillPath(
      path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-primary-runtime', 'documents'),
      path.join('skills', 'documents', 'SKILL.md'),
    )
  }
  if (normalized === 'spreadsheets') {
    return findNewestSkillPath(
      path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-primary-runtime', 'spreadsheets'),
      path.join('skills', 'spreadsheets', 'SKILL.md'),
    )
  }
  if (normalized === 'ppt-master') {
    const direct = path.join(
      os.homedir(),
      'github代码仓库',
      'aippt',
      'ppt-master',
      'skills',
      'ppt-master',
      'SKILL.md',
    )
    return fs.existsSync(direct) ? direct : null
  }
  return null
}

function compactSkillExcerpt(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim())
  const preferred = lines.filter(line => {
    const trimmed = line.trim()
    return (
      trimmed.startsWith('#') ||
      /^[-*]\s/.test(trimmed) ||
      /task mode|profile|workflow|quality|render|pptx|claim|contact|editable|template|SVG|DrawingML|QA/i.test(
        trimmed,
      )
    )
  })
  const excerpt = (preferred.length ? preferred : lines).slice(0, 90).join('\n')
  return excerpt.slice(0, 2800)
}

function resolveEmployeeSkillContext(skillName: string): EmployeeSkillContext | null {
  const directPath = knownEmployeeSkillPath(skillName)
  const discovered =
    directPath === null
      ? discoverAllSkills().find(skill => {
          const normalizedName = skill.name.toLowerCase()
          const target = skillName.toLowerCase()
          return normalizedName === target || normalizedName.endsWith(`/${target}`)
        })
      : null
  const skillPath = directPath ?? discovered?.path
  if (!skillPath || !fs.existsSync(skillPath)) return null
  try {
    const content = fs.readFileSync(skillPath, 'utf-8')
    return {
      name: skillName,
      path: skillPath,
      description:
        discovered?.description ??
        content
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(line => line && !line.startsWith('#') && !line.startsWith('---')) ??
        skillName,
      excerpt: compactSkillExcerpt(content),
    }
  } catch (error) {
    log('failed to read employee skill context', skillPath, error)
    return null
  }
}

function resolveEmployeeSkillContexts(skillMentions: string[]): EmployeeSkillContext[] {
  return skillMentions
    .map(resolveEmployeeSkillContext)
    .filter((context): context is EmployeeSkillContext => context !== null)
}

function normalizeEmployeeDefinition(filePath: string, content: string): EmployeeDefinition | null {
  const { frontmatter, body } = parseEmployeeFrontmatter(content)
  const id = readString(frontmatter.id) ?? path.basename(filePath, path.extname(filePath))
  const title = readString(frontmatter.title) ?? id
  const orderValue = Number(frontmatter.order)
  const instructions = body.trim() || title
  const skillMentions = parseEmployeeList(frontmatter.skill_mentions ?? frontmatter.skillMentions)
  return {
    id,
    title,
    subtitle: readString(frontmatter.subtitle) ?? '未命名任务',
    icon: readString(frontmatter.icon) ?? 'agent',
    defaultModel: readString(frontmatter.default_model) ?? readString(frontmatter.defaultModel) ?? 'auto',
    order: Number.isFinite(orderValue) ? orderValue : 100,
    preview: readString(frontmatter.preview) ?? employeePreviewFromBody(instructions),
    skillMentions,
    instructions,
    enabled: parseEmployeeBoolean(frontmatter.enabled, true),
    path: filePath,
    source: 'filesystem',
    skillContexts: resolveEmployeeSkillContexts(skillMentions),
  }
}

function ensureEmployeeDefinitionSeeds(): void {
  fs.mkdirSync(EMPLOYEE_DEFINITIONS_DIR, { recursive: true })
  for (const seed of DEFAULT_EMPLOYEE_DEFINITIONS) {
    const filePath = path.join(EMPLOYEE_DEFINITIONS_DIR, `${seed.id}.md`)
    if (fs.existsSync(filePath)) continue
    fs.writeFileSync(filePath, employeeDefinitionMarkdown(seed), 'utf-8')
  }
}

function listEmployeeDefinitions(): EmployeeDefinition[] {
  ensureEmployeeDefinitionSeeds()
  const definitions: EmployeeDefinition[] = []
  for (const entry of fs.readdirSync(EMPLOYEE_DEFINITIONS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue
    const filePath = path.join(EMPLOYEE_DEFINITIONS_DIR, entry.name)
    try {
      const definition = normalizeEmployeeDefinition(filePath, fs.readFileSync(filePath, 'utf-8'))
      if (definition?.enabled) definitions.push(definition)
    } catch (error) {
      log('failed to read employee definition', filePath, error)
    }
  }
  return definitions.sort((left, right) => {
    const byOrder = left.order - right.order
    return byOrder || left.title.localeCompare(right.title)
  })
}

function findEmployeeDefinition(idOrPath: string): EmployeeDefinition | null {
  const candidate = readString(idOrPath)
  if (!candidate) return null
  return (
    listEmployeeDefinitions().find(item => item.id === candidate || item.path === candidate) ??
    null
  )
}

async function openEmployeeDefinitionFile(idOrPath: string): Promise<{ ok: boolean; path?: string; message?: string }> {
  const definition = findEmployeeDefinition(idOrPath)
  if (!definition) return { ok: false, message: 'employee definition not found' }
  const message = await shell.openPath(definition.path)
  return message ? { ok: false, path: definition.path, message } : { ok: true, path: definition.path }
}

async function openEmployeeDefinitionsFolder(): Promise<{ ok: boolean; path: string; message?: string }> {
  ensureEmployeeDefinitionSeeds()
  const message = await shell.openPath(EMPLOYEE_DEFINITIONS_DIR)
  return message
    ? { ok: false, path: EMPLOYEE_DEFINITIONS_DIR, message }
    : { ok: true, path: EMPLOYEE_DEFINITIONS_DIR }
}

async function runModelServiceChat(input: unknown): Promise<ModelServiceChatResult> {
  const record = isPlainRecord(input) ? input : {}
  const message = readString(record.message)
  if (!message) {
    return { ok: false, message: 'message is required' }
  }

  modelServiceSettings = loadModelServiceSettings()
  const settings = modelServiceSettings
  if (!settings.enabled) {
    return { ok: false, message: 'model service is disabled' }
  }
  if (!settings.apiKey) {
    return { ok: false, message: 'API key is not configured' }
  }

  const model = resolveModelServiceModel(settings, readString(record.alias))
  if (!model) {
    return { ok: false, message: 'model alias is not configured' }
  }

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content:
          readString(record.systemPrompt) ??
          readString(record.system) ??
          '你是隆小侠 Agent OS 的会话助手。用中文简洁回答，优先说明已经完成的动作和可验证结果。',
      },
      { role: 'user', content: message },
    ],
    temperature: 0.2,
    max_tokens: readNumber(record.maxTokens) ?? 1400,
    stream: false,
  }

  const timeoutMs = readNumber(record.timeoutMs) ?? 60_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(modelServiceChatUrl(settings.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const raw = await response.text()
    let payload: unknown = null
    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      const detail =
        isPlainRecord(payload) && isPlainRecord(payload.error)
          ? readString(payload.error.message) ?? raw
          : raw
      return {
        ok: false,
        message: `HTTP ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 500)}` : ''}`,
        model,
      }
    }
    const text = extractModelServiceChatText(payload)
    return {
      ok: Boolean(text),
      message: text ? 'chat completed' : 'chat response did not include text',
      text,
      model,
      usage: isPlainRecord(payload) ? payload.usage : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      model,
    }
  } finally {
    clearTimeout(timer)
  }
}

function getRuntimeCapabilityRegistry(): RuntimeCapabilityRegistry {
  runtimeCapabilityRegistry = readRuntimeCapabilityRegistry(
    CAPABILITY_REGISTRY_PATH,
    LONGCLAW_RUNTIME_DIR,
  )
  return runtimeCapabilityRegistry
}

function registerManagedCapability(
  input: { kind: RuntimeCapabilityKind; sourcePath: string; label?: string },
): RuntimeCapabilityRegistry {
  runtimeCapabilityRegistry = registerRuntimeCapability({
    runtimeDir: LONGCLAW_RUNTIME_DIR,
    registryPath: CAPABILITY_REGISTRY_PATH,
    kind: input.kind,
    sourcePath: input.sourcePath,
    label: input.label,
    metadata: {
      current_cwd: currentCwd,
    },
  })
  return runtimeCapabilityRegistry
}

function removeManagedCapability(registryId: string): RuntimeCapabilityRegistry {
  runtimeCapabilityRegistry = removeRuntimeCapability({
    runtimeDir: LONGCLAW_RUNTIME_DIR,
    registryPath: CAPABILITY_REGISTRY_PATH,
    registryId,
  })
  return runtimeCapabilityRegistry
}

function rescanManagedCapabilities(): RuntimeCapabilityRegistry {
  runtimeCapabilityRegistry = rescanRuntimeCapabilityRegistry(
    CAPABILITY_REGISTRY_PATH,
    LONGCLAW_RUNTIME_DIR,
  )
  return runtimeCapabilityRegistry
}

function loadWeclawSessionUiState(): WeclawSessionUiState {
  if (!fs.existsSync(WECLAW_SESSION_UI_STATE_PATH)) return {}
  try {
    return normalizeWeclawSessionUiState(
      JSON.parse(fs.readFileSync(WECLAW_SESSION_UI_STATE_PATH, 'utf-8')),
    )
  } catch (error) {
    log('failed to load weclaw session ui state', WECLAW_SESSION_UI_STATE_PATH, error)
    return {}
  }
}

function persistWeclawSessionUiState(state: WeclawSessionUiState): WeclawSessionUiState {
  const normalized = normalizeWeclawSessionUiState(state)
  fs.mkdirSync(LONGCLAW_RUNTIME_DIR, { recursive: true })
  fs.writeFileSync(
    WECLAW_SESSION_UI_STATE_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf-8',
  )
  return normalized
}

let weclawSessionUiState = loadWeclawSessionUiState()

function getWeclawSessionUiState(): WeclawSessionUiState {
  return weclawSessionUiState
}

function updateWeclawSessionUiState(
  canonicalSessionId: string,
  patch: Partial<{ hidden: boolean; archived: boolean }>,
): WeclawSessionUiState {
  const target = readString(canonicalSessionId)
  if (!target) {
    throw new Error('canonical session id is required')
  }
  weclawSessionUiState = persistWeclawSessionUiState(
    mergeWeclawSessionUiFlags(weclawSessionUiState, target, patch),
  )
  return weclawSessionUiState
}

function getWeChatBindingStatus() {
  return readWeChatBindingStatus(WECHAT_BINDING_STATE_PATH)
}

function getConfiguredWeChatClusterNodes(): WeChatClusterNodeSeed[] {
  const raw = process.env.LONGCLAW_WECHAT_CLUSTER_NODES ?? 'dimit,vircs'
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [nodeIdPart, sshHostPart] = item.split('@')
      const nodeId = nodeIdPart?.trim()
      const [sshHost, capacityRaw] = (sshHostPart ?? nodeId ?? '').split('#')
      const capacity = Number(capacityRaw)
      return {
        node_id: nodeId || sshHost,
        ssh_host: sshHost || nodeId,
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 2,
      }
    })
    .filter(node => Boolean(node.node_id))
}

function getWeChatClusterStatus() {
  return readWeChatClusterState(WECHAT_CLUSTER_STATE_PATH, {
    defaultNodes: getConfiguredWeChatClusterNodes(),
  })
}

function createClusterBindingSessionWithProbe(input: {
  bindingSessionId: string
  qrUrl?: string
  expiresInMs: number
}) {
  const defaultNodes = getConfiguredWeChatClusterNodes()
  try {
    return createWeChatClusterBindingSession(WECHAT_CLUSTER_STATE_PATH, {
      bindingSessionId: input.bindingSessionId,
      provider: 'ilink_service_account',
      qrUrl: input.qrUrl,
      expiresInMs: input.expiresInMs,
      defaultNodes,
    })
  } catch (error) {
    if (!(error instanceof Error) || !/No eligible WeChat cluster node/i.test(error.message)) {
      throw error
    }
    probeWeChatClusterNodes()
    return createWeChatClusterBindingSession(WECHAT_CLUSTER_STATE_PATH, {
      bindingSessionId: input.bindingSessionId,
      provider: 'ilink_service_account',
      qrUrl: input.qrUrl,
      expiresInMs: input.expiresInMs,
      defaultNodes,
    })
  }
}

function probeWeChatClusterNodes() {
  const defaultNodes = getConfiguredWeChatClusterNodes()
  const state = readWeChatClusterState(WECHAT_CLUSTER_STATE_PATH, { defaultNodes })
  for (const node of state.nodes) {
    try {
      const output = execFileSync(
        'ssh',
        [
          '-o',
          'BatchMode=yes',
          '-o',
          'ConnectTimeout=6',
          node.ssh_host,
          [
            'set -e',
            'printf "hostname=%s\\n" "$(hostname)"',
            'if command -v codex >/dev/null 2>&1; then printf "codex=%s\\n" "$(codex --version 2>/dev/null | head -n 1)"; else echo "codex=missing"; fi',
            'if command -v weclaw >/dev/null 2>&1; then echo "weclaw=present"; elif [ -x "$HOME/.weclaw/bin/weclaw-real" ]; then echo "weclaw=weclaw-real"; else echo "weclaw=missing"; fi',
            'if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":18011 "; then echo "listener=18011"; else echo "listener=missing"; fi',
          ].join('; '),
        ],
        { encoding: 'utf-8', timeout: 9000 },
      )
      markWeChatClusterNodeHealth(WECHAT_CLUSTER_STATE_PATH, {
        nodeId: node.node_id,
        status: output.includes('listener=18011') ? 'online' : 'degraded',
        lastError: output.includes('listener=18011') ? undefined : 'WeClaw listener 18011 not detected.',
        defaultNodes,
      })
    } catch (error) {
      markWeChatClusterNodeHealth(WECHAT_CLUSTER_STATE_PATH, {
        nodeId: node.node_id,
        status: 'offline',
        lastError: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
        defaultNodes,
      })
    }
  }
  return getWeChatClusterStatus()
}

function getPluginDevIssues() {
  return readPluginDevState(PLUGIN_DEV_STATE_PATH).issues
}

function getPluginDevReceipts() {
  return readPluginDevState(PLUGIN_DEV_STATE_PATH).receipts
}

function getCapabilityManagerSettings(): CapabilityManagerSettings {
  return capabilityManagerSettings
}

function updateCapabilityManagerSettings(
  patch: unknown,
): CapabilityManagerSettings {
  capabilityManagerSettings = persistCapabilityManagerSettings(
    normalizeCapabilityManagerSettings(patch, capabilityManagerSettings),
  )
  return capabilityManagerSettings
}

function workspaceRoots(): string[] {
  return uniquePaths(
    WORKSPACE_ROOT_CANDIDATES.filter(candidate => fs.existsSync(candidate)),
  )
}

function runtimeRegistryEntryByManagedPath(): Map<string, RuntimeCapabilityRegistry['entries'][number]> {
  return new Map(
    getRuntimeCapabilityRegistry().entries.map(entry => [path.resolve(entry.managed_path), entry] as const),
  )
}

function configuredSkillScanDirs(
  settings: CapabilityManagerSettings = getCapabilityManagerSettings(),
): string[] {
  const runtimeRoots = runtimeDiscoveryRoots(LONGCLAW_RUNTIME_DIR)
  return uniquePaths([
    ...workspaceRoots().flatMap(root =>
      KNOWN_SKILL_PROJECTS.map(project => path.join(root, project)),
    ),
    ...runtimeRoots.skills,
    ...settings.extra_skill_roots,
  ])
}

function scanDirForSkills(dir: string, projectName: string): SkillInfo[] {
  const skills: SkillInfo[] = []
  if (!fs.existsSync(dir)) return skills
  const registryEntry = runtimeRegistryEntryByManagedPath().get(path.resolve(dir))

  // CLAUDE.md
  const claudeMd = path.join(dir, 'CLAUDE.md')
  if (fs.existsSync(claudeMd)) {
    const content = fs.readFileSync(claudeMd, 'utf-8')
    const title = content.split('\n').find(l => l.startsWith('# '))?.replace('# ', '') || projectName
    skills.push({
      name: `${projectName}/CLAUDE.md`,
      path: claudeMd,
      description: title.slice(0, 80),
      project: projectName,
      source: registryEntry?.source ?? 'filesystem',
      registry_id: registryEntry?.registry_id,
      managed: Boolean(registryEntry),
      health: registryEntry?.health,
    })
  }

  // Direct SKILL.md capability roots, used by runtime-managed overlays.
  const directSkillMd = path.join(dir, 'SKILL.md')
  if (fs.existsSync(directSkillMd)) {
    const content = fs.readFileSync(directSkillMd, 'utf-8')
    const description =
      content
        .split('\n')
        .find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
        ?.trim()
        .slice(0, 80) || projectName
    skills.push({
      name: registryEntry?.label ?? projectName,
      path: directSkillMd,
      description,
      project: projectName,
      source: registryEntry?.source ?? 'filesystem',
      registry_id: registryEntry?.registry_id,
      managed: Boolean(registryEntry),
      health: registryEntry?.health,
    })
  }

  // .claude/skills/
  const skillsDir = path.join(dir, '.claude', 'skills')
  if (fs.existsSync(skillsDir)) {
    try {
      for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md')
        if (fs.existsSync(skillMd)) {
          const content = fs.readFileSync(skillMd, 'utf-8')
          const desc = content.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---')) || ''
          skills.push({
            name: entry.name,
            path: skillMd,
            description: desc.trim().slice(0, 80),
            project: projectName,
            source: registryEntry?.source ?? 'filesystem',
            registry_id: registryEntry?.registry_id,
            managed: Boolean(registryEntry),
            health: registryEntry?.health,
          })
        }
      }
    } catch {}
  }

  return skills
}

function discoverAllSkills(
  settings: CapabilityManagerSettings = getCapabilityManagerSettings(),
): SkillInfo[] {
  const all: SkillInfo[] = []
  const scanDirs = configuredSkillScanDirs(settings)
  for (const dir of scanDirs) {
    const projectName = path.basename(dir)
    all.push(...scanDirForSkills(dir, projectName))
  }
  if (!scanDirs.includes(currentCwd)) {
    all.push(...scanDirForSkills(currentCwd, path.basename(currentCwd)))
  }
  const unique = new Map<string, SkillInfo>()
  for (const skill of all) {
    unique.set(skill.path, skill)
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function discoverSkills(cwd: string): SkillInfo[] {
  const skills = [...discoverAllSkills(), ...scanDirForSkills(cwd, path.basename(cwd))]
  const unique = new Map<string, SkillInfo>()
  for (const skill of skills) {
    unique.set(skill.path, skill)
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function pluginInfoForDir(dir: string): PluginInfo | null {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null

  const baseName = path.basename(dir)
  const registryEntry = runtimeRegistryEntryByManagedPath().get(path.resolve(dir))
  const codexPluginPath = path.join(dir, '.codex-plugin', 'plugin.json')
  const packageJsonPath = path.join(dir, 'package.json')
  const isPluginLike =
    baseName.toLowerCase().includes('plugin') ||
    fs.existsSync(codexPluginPath) ||
    fs.existsSync(path.join(dir, 'plugins')) ||
    fs.existsSync(path.join(dir, 'cowork_plugins'))

  if (!isPluginLike) return null

  const pluginManifest = readJsonFile(codexPluginPath)
  const packageManifest = readJsonFile(packageJsonPath)
  const pluginId =
    String(pluginManifest?.id ?? packageManifest?.name ?? baseName).trim() || baseName
  const label =
    String(pluginManifest?.name ?? packageManifest?.name ?? baseName).trim() || baseName
  const description =
    String(pluginManifest?.description ?? packageManifest?.description ?? '')
      .trim()
      .slice(0, 160) || `${baseName} plugin bundle`

  return {
    plugin_id: pluginId,
    label,
    path: dir,
    description,
    source: registryEntry?.source ?? (fs.existsSync(codexPluginPath) ? 'codex_plugin' : 'workspace_package'),
    project: baseName,
    registry_id: registryEntry?.registry_id,
    managed: Boolean(registryEntry),
    health: registryEntry?.health,
  }
}

function discoverCapabilityPlugins(
  settings: CapabilityManagerSettings = getCapabilityManagerSettings(),
): PluginInfo[] {
  const runtimeRoots = runtimeDiscoveryRoots(LONGCLAW_RUNTIME_DIR)
  const roots = uniquePaths([
    ...workspaceRoots(),
    currentCwd,
    ...runtimeRoots.plugins,
    ...settings.extra_plugin_roots,
  ])
  const discovered = new Map<string, PluginInfo>()

  for (const root of roots) {
    const direct = pluginInfoForDir(root)
    if (direct) discovered.set(direct.path, direct)

    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const info = pluginInfoForDir(path.join(root, entry.name))
      if (info) discovered.set(info.path, info)
    }
  }

  return [...discovered.values()].sort((left, right) => left.label.localeCompare(right.label))
}

function forwardAgentEvent(sender: Electron.WebContents, event: AgentStreamEvent) {
  log(`event: type=${event.type} text="${(event.text || '').slice(0, 30)}"`)
  switch (event.type) {
    case 'text':
      sender.send('agent:text', event.text)
      break
    case 'tool':
      sender.send('agent:tool', { name: event.toolName, input: event.toolInput })
      break
    case 'result':
      sender.send('agent:result', event.result)
      break
    case 'error':
      sender.send('agent:error', event.error)
      break
  }
}

function launchPackMention(intent: LongclawLaunchIntent): LongclawLaunchMention | undefined {
  return intent.mentions.find(mention => mention.kind === 'pack')
}

function launchPackId(intent: LongclawLaunchIntent): string {
  const metadataPack = intent.metadata.pack_id
  const hintedValue =
    launchPackMention(intent)?.value ??
    (typeof metadataPack === 'string' ? metadataPack : '')
  if (!hintedValue) return 'local_agent'
  return hintedValue.includes('.') ? hintedValue.split('.')[0] : hintedValue
}

function launchTaskCapability(intent: LongclawLaunchIntent, packId: string): string {
  const metadataCapability = intent.metadata.capability
  const hintedValue =
    launchPackMention(intent)?.value ??
    (typeof metadataCapability === 'string' ? metadataCapability : '')
  if (hintedValue.includes('.')) return hintedValue
  if (hintedValue) return `${packId}.${hintedValue}`
  return `${packId}.cowork_launch`
}

function launchRunCapability(taskCapability: string): string {
  return taskCapability.includes('.') ? taskCapability.split('.').slice(1).join('.') : taskCapability
}

function launchDomain(packId: string): string {
  if (packId === 'signals') return 'financial_analysis'
  if (packId === 'due_diligence') return 'due_diligence'
  return packId || 'local_agent'
}

function capabilityEntryFromPack(pack: LongclawDomainPackDescriptor): LongclawCapabilityEntry {
  return {
    capability_id: `pack:${pack.pack_id}`,
    kind: 'pack',
    label: pack.pack_id,
    mention: `@pack ${pack.pack_id}`,
    source: pack.runtime,
    description: pack.description,
    summary: `${pack.runtime} runtime`,
    owner: pack.owner_repo,
    curated: ['signals', 'due_diligence'].includes(pack.pack_id),
    provisional: false,
    metadata: pack.metadata ?? {},
  }
}

function capabilityEntryFromSkill(skill: SkillInfo): LongclawCapabilityEntry {
  const configPath = fs.existsSync(skill.path) ? skill.path : null
  return {
    capability_id: `skill:${skill.project ?? 'workspace'}:${skill.name}`,
    kind: 'skill',
    label: skill.name,
    mention: `@skill ${skill.name}`,
    source: 'filesystem',
    description: skill.description,
    summary: skill.project ?? 'workspace',
    owner: skill.project ?? null,
    curated: false,
    provisional: true,
    metadata: {
      path: skill.path,
      project: skill.project ?? null,
      config_path: configPath,
      managed: skill.managed ?? false,
      registry_id: skill.registry_id ?? null,
      health: skill.health ?? null,
      source: skill.source ?? 'filesystem',
    },
  }
}

function capabilityEntryFromPlugin(plugin: PluginInfo): LongclawCapabilityEntry {
  const configPath = path.join(plugin.path, '.codex-plugin', 'plugin.json')
  return {
    capability_id: `plugin:${plugin.plugin_id}`,
    kind: 'plugin',
    label: plugin.label,
    mention: `@plugin ${plugin.plugin_id}`,
    source: plugin.source,
    description: plugin.description,
    summary: plugin.project ?? 'workspace plugin',
    owner: plugin.project ?? null,
    curated: false,
    provisional: true,
    metadata: {
      path: plugin.path,
      config_path: fs.existsSync(configPath) ? configPath : null,
      managed: plugin.managed ?? false,
      registry_id: plugin.registry_id ?? null,
      health: plugin.health ?? null,
    },
  }
}

function applyCapabilityManagerOverlay(
  capability: LongclawCapabilityEntry,
  settings: CapabilityManagerSettings,
): LongclawCapabilityEntry {
  const disabled = settings.disabled_capabilities.includes(capability.capability_id)
  const group = settings.capability_groups[capability.capability_id]
  return {
    ...capability,
    metadata: {
      ...capability.metadata,
      disabled,
      group: group ?? null,
    },
  }
}

function recentCapabilityEntry(task: LongclawTask): LongclawCapabilityEntry {
  const metadata = task.metadata as Record<string, unknown>
  const packId =
    typeof metadata.pack_id === 'string' && metadata.pack_id
      ? metadata.pack_id
      : task.capability.includes('.')
        ? task.capability.split('.')[0]
        : ''
  const skillMention = Array.isArray(metadata.skill_mentions) ? metadata.skill_mentions[0] : null
  const pluginMention = Array.isArray(metadata.plugin_mentions) ? metadata.plugin_mentions[0] : null

  if (typeof skillMention === 'string' && skillMention) {
    return {
      capability_id: `recent:skill:${skillMention}`,
      kind: 'skill',
      label: skillMention,
      mention: `@skill ${skillMention}`,
      source: String(metadata.launch_source ?? 'launch_history'),
      description: 'Recently launched skill mention',
      summary: task.status,
      owner: null,
      curated: false,
      provisional: false,
      metadata: { task_id: task.task_id, run_ids: task.run_ids },
    }
  }

  if (typeof pluginMention === 'string' && pluginMention) {
    return {
      capability_id: `recent:plugin:${pluginMention}`,
      kind: 'plugin',
      label: pluginMention,
      mention: `@plugin ${pluginMention}`,
      source: String(metadata.launch_source ?? 'launch_history'),
      description: 'Recently launched plugin bundle',
      summary: task.status,
      owner: null,
      curated: false,
      provisional: false,
      metadata: { task_id: task.task_id, run_ids: task.run_ids },
    }
  }

  return {
    capability_id: `recent:pack:${task.capability}`,
    kind: 'pack',
    label: task.capability,
    mention: packId ? `@pack ${task.capability}` : `@pack ${task.capability}`,
    source: String(metadata.launch_source ?? 'launch_history'),
    description: 'Recently launched pack capability',
    summary: task.status,
    owner: packId || null,
    curated: ['signals', 'due_diligence'].includes(packId),
    provisional: false,
    metadata: { task_id: task.task_id, run_ids: task.run_ids },
  }
}

async function buildCapabilitySubstrateSummary(): Promise<LongclawCapabilitySubstrateSummary> {
  const settings = getCapabilityManagerSettings()
  const [overviewResult, packsResult, tasksResult] = await Promise.allSettled([
    getControlPlaneClient().getOverview(),
    getControlPlaneClient().listPacks(),
    getControlPlaneClient().listTasks(8),
  ])
  const skills = discoverAllSkills(settings)
  const plugins = discoverCapabilityPlugins(settings)
  const capabilityRegistry = getRuntimeCapabilityRegistry()
  const packs =
    packsResult.status === 'fulfilled'
      ? packsResult.value
      : overviewResult.status === 'fulfilled'
        ? overviewResult.value.packs
        : []
  const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : []
  const source = getControlPlaneClient().isHermesBacked() ? 'hybrid' : 'local_fallback'
  const runtimeStatus = await collectRuntimeStatus(
    packs,
    overviewResult.status === 'fulfilled' && getControlPlaneClient().isHermesBacked(),
  )
  const seatResolution = resolveLocalRuntimeSeat(getLocalRuntimeSeatPreference())

  return LongclawCapabilitySubstrateSummarySchema.parse({
    generated_at: new Date().toISOString(),
    source,
    provisional: true,
    flagship_packs: packs.filter(pack => ['signals', 'due_diligence'].includes(pack.pack_id)),
    skills: skills.map(capabilityEntryFromSkill).map(entry => applyCapabilityManagerOverlay(entry, settings)),
    plugins: plugins
      .map(capabilityEntryFromPlugin)
      .map(entry => applyCapabilityManagerOverlay(entry, settings)),
    packs: packs.map(capabilityEntryFromPack),
    aliases: [],
    presets: [
      packs.some(pack => pack.pack_id === 'signals')
        ? {
            preset_id: 'signals-review',
            label: 'Signals Review',
            description: 'Launch the flagship review flow in Signals.',
            mentions: [{ kind: 'pack', value: 'signals.review', metadata: {} }],
            default_pack_id: 'signals',
            curated: true,
            metadata: {},
          }
        : null,
      packs.some(pack => pack.pack_id === 'signals')
        ? {
            preset_id: 'signals-backtest',
            label: 'Signals Backtest',
            description: 'Run backlog evaluation and backtest in the Signals pack.',
            mentions: [{ kind: 'pack', value: 'signals.backtest', metadata: {} }],
            default_pack_id: 'signals',
            curated: true,
            metadata: {},
          }
        : null,
      packs.some(pack => pack.pack_id === 'due_diligence')
        ? {
            preset_id: 'due-diligence-company',
            label: 'Company Due Diligence',
            description: 'Launch the due-diligence runtime for a company investigation.',
            mentions: [{ kind: 'pack', value: 'due_diligence.company_due_diligence', metadata: {} }],
            default_pack_id: 'due_diligence',
            curated: true,
            metadata: {},
          }
        : null,
    ].filter(Boolean),
    last_used_capabilities: tasks.map(recentCapabilityEntry),
    visibility: {
      curated: false,
      shows_provisional_inventory: true,
      skills_source: 'filesystem',
      plugins_source: plugins.length > 0 ? 'workspace_scan' : 'local_fallback',
      packs_source: packsResult.status === 'fulfilled' ? 'control_plane' : 'overview',
    },
    metadata: {
      cwd: currentCwd,
      agent_mode: getAgentMode(),
      runtime_profile: currentRuntimeProfile('local', seatResolution),
      model_plane: 'cloud_provider',
      local_runtime_seat: seatResolution.seat,
      local_runtime_seat_preference: seatResolution.preference,
      runtime_status: runtimeStatus,
      packs_count: packs.length,
      skills_count: skills.length,
      plugins_count: plugins.length,
      tasks_count: tasks.length,
      capability_manager: settings,
      capability_manager_settings_path: CAPABILITY_MANAGER_SETTINGS_PATH,
      capability_registry: capabilityRegistry,
      capability_registry_path: CAPABILITY_REGISTRY_PATH,
      runtime_capability_roots: runtimeDiscoveryRoots(LONGCLAW_RUNTIME_DIR),
    },
  })
}

async function handleProvisionalLaunch(
  event: Electron.IpcMainInvokeEvent,
  intent: LongclawLaunchIntent,
) {
  const sender = event.sender
  const startedAt = new Date().toISOString()
  const launchId = intent.launch_id ?? `launch-local-${Date.now()}`
  const packId = launchPackId(intent)
  const taskCapability = launchTaskCapability(intent, packId)
  const taskId = `task-local-${Date.now()}`
  const runId = `run-local-${Date.now()}`
  const prompt = String(intent.requested_outcome ?? intent.raw_text).trim()
  const workMode = intent.work_mode
  const seatPreference = normalizeLocalRuntimeSeatPreference(
    intent.metadata.local_runtime_seat_preference,
  )
  const seatResolution = resolveLaunchSeat(workMode, seatPreference)
  const localRuntimeSeat = String(
    intent.metadata.local_runtime_seat ?? seatResolution.seat,
  ) as LocalRuntimeSeat
  const runtimeProfile = intent.runtime_profile ?? currentRuntimeProfile(workMode, seatResolution)
  const runtimeTarget = workMode === 'cloud_sandbox' ? 'cloud_runtime' : 'local_runtime'
  const interactionSurface =
    workMode === 'weclaw_dispatch' ? 'weclaw' : 'electron_home'
  const modelPlane = intent.model_plane ?? 'cloud_provider'
  const executionPlane = runtimeTarget === 'cloud_runtime' ? 'cloud_executor' : 'local_executor'
  const launchSurface = intent.launch_surface ?? interactionSurface
  const workspaceTarget =
    intent.workspace_target ??
    (workMode === 'local'
      ? currentCwd
      : workMode === 'cloud_sandbox'
        ? 'sandbox://longclaw/default'
        : 'weclaw://active-thread')
  const input = {
    query: prompt,
    raw_text: intent.raw_text,
    requested_outcome: intent.requested_outcome ?? intent.raw_text,
    work_mode: workMode,
    launch_surface: launchSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: modelPlane,
    workspace_target: workspaceTarget,
    local_runtime_seat: localRuntimeSeat,
  }

  let failed = false
  let errorMessage = ''
  let taskStatus = 'succeeded'
  let runStatus = 'succeeded'
  let runtimeSummary = 'Completed via local cowork runtime'
  let seatDispatchResult: Record<string, unknown> | undefined
  try {
    if (workMode === 'cloud_sandbox') {
      failed = true
      errorMessage = 'Cloud Sandbox requires Longclaw Core.'
      taskStatus = 'failed'
      runStatus = 'failed'
      runtimeSummary = errorMessage
    } else if (localRuntimeSeat === 'acp_bridge') {
      const b = await ensureBackend()
      await b.query(prompt, rawEvent => {
        forwardAgentEvent(sender, rawEvent as AgentStreamEvent)
      })
    } else if (localRuntimeSeat === 'local_runtime_api') {
      seatDispatchResult = await dispatchToLocalRuntimeApi({
        launch_id: launchId,
        task_id: taskId,
        work_mode: workMode,
        requested_outcome: String(input.requested_outcome ?? prompt),
        mentions: intent.mentions as Array<Record<string, unknown>>,
        workspace_root: typeof workspaceTarget === 'string' ? workspaceTarget : currentCwd,
        runtime_profile: runtimeProfile as 'dev_local_acp_bridge' | 'packaged_local_runtime' | 'cloud_managed_runtime',
        model_plane: 'cloud_provider',
        raw_text: intent.raw_text,
      }, seatResolution.preference)
      taskStatus = 'running'
      runStatus = 'running'
      runtimeSummary = 'Accepted by local runtime API'
      forwardAgentEvent(sender, {
        type: 'result',
        result: {
          local_runtime_seat: localRuntimeSeat,
          accepted: Boolean(seatDispatchResult.accepted ?? true),
          dispatch: seatDispatchResult,
        },
      })
    } else {
      failed = true
      errorMessage =
        'Local Work and WeClaw Dispatch need either a local ACP bridge or LONGCLAW_LOCAL_RUNTIME_API_URL.'
      taskStatus = 'failed'
      runStatus = 'failed'
      runtimeSummary = errorMessage
    }
  } catch (error) {
    failed = true
    errorMessage = error instanceof Error ? error.message : String(error)
    taskStatus = 'failed'
    runStatus = 'failed'
    runtimeSummary = `Fallback cowork launch failed: ${errorMessage}`
    forwardAgentEvent(sender, { type: 'error', error: errorMessage })
  }

  const finishedAt = new Date().toISOString()
  const task = LongclawTaskSchema.parse({
    task_id: taskId,
    capability: taskCapability,
    session_id:
      typeof intent.session_context.session_id === 'string'
        ? intent.session_context.session_id
        : null,
    channel:
      typeof intent.session_context.channel === 'string'
        ? intent.session_context.channel
        : intent.source,
    status: taskStatus,
    input,
    work_mode: workMode,
    origin_surface: launchSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: modelPlane,
    execution_plane: executionPlane,
    run_ids: [runId],
    last_run_id: runId,
    created_at: startedAt,
    updated_at: finishedAt,
    metadata: {
      ...intent.metadata,
      provisional: true,
      pack_id: packId,
      launch_source: intent.source,
      work_mode: workMode,
      launch_surface: launchSurface,
      interaction_surface: interactionSurface,
      runtime_profile: runtimeProfile,
      runtime_target: runtimeTarget,
      model_plane: modelPlane,
      execution_plane: executionPlane,
      workspace_target: workspaceTarget,
      local_runtime_seat: localRuntimeSeat,
      local_runtime_seat_preference: seatResolution.preference,
      mentions: intent.mentions,
      fallback_runtime: localRuntimeSeat === 'acp_bridge' ? getAgentMode() : localRuntimeSeat,
      error: errorMessage || undefined,
      local_runtime_dispatch: seatDispatchResult,
    },
  })
  const run = LongclawRunSchema.parse({
    run_id: runId,
    domain: launchDomain(packId),
    capability: launchRunCapability(taskCapability),
    status: runStatus,
    session_id: task.session_id,
    task_id: taskId,
    requested_by:
      typeof intent.session_context.user_id === 'string'
        ? intent.session_context.user_id
        : null,
    work_mode: workMode,
    origin_surface: launchSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: modelPlane,
    execution_plane: executionPlane,
    summary: runtimeSummary,
    created_at: startedAt,
    started_at: startedAt,
    finished_at: finishedAt,
    metadata: {
      ...intent.metadata,
      provisional: true,
      pack_id: packId,
      launch_source: intent.source,
      work_mode: workMode,
      launch_surface: launchSurface,
      interaction_surface: interactionSurface,
      runtime_profile: runtimeProfile,
      runtime_target: runtimeTarget,
      model_plane: modelPlane,
      execution_plane: executionPlane,
      workspace_target: workspaceTarget,
      fallback_runtime: localRuntimeSeat === 'acp_bridge' ? getAgentMode() : localRuntimeSeat,
      local_runtime_seat: localRuntimeSeat,
      local_runtime_seat_preference: seatResolution.preference,
      local_runtime_dispatch: seatDispatchResult,
      raw_text: intent.raw_text,
    },
    pack_id: packId,
  })
  const workItems = failed
    ? [
        LongclawWorkItemSchema.parse({
          work_item_id: `work-local-${Date.now()}`,
          pack_id: packId,
          kind: 'delivery_failed',
          title: 'Fallback cowork launch failed',
          summary: errorMessage || 'Local cowork runtime failed before Hermes was available.',
          severity: 'warning',
          status: 'open',
          run_id: runId,
          work_mode: workMode,
          origin_surface: launchSurface,
          interaction_surface: interactionSurface,
          runtime_profile: runtimeProfile,
          runtime_target: runtimeTarget,
          model_plane: modelPlane,
          execution_plane: executionPlane,
          artifact_refs: [],
          operator_actions: [],
          created_at: finishedAt,
          updated_at: finishedAt,
          metadata: {
            provisional: true,
            launch_id: launchId,
            work_mode: workMode,
            launch_surface: launchSurface,
            interaction_surface: interactionSurface,
            runtime_profile: runtimeProfile,
            runtime_target: runtimeTarget,
            model_plane: modelPlane,
            execution_plane: executionPlane,
            workspace_target: workspaceTarget,
            local_runtime_seat: localRuntimeSeat,
            local_runtime_seat_preference: seatResolution.preference,
          },
        }),
      ]
    : []

  return LongclawLaunchReceiptSchema.parse({
    launch_id: launchId,
    pack_id: packId,
    task,
    run,
    artifacts: [],
    review_actions: [],
    work_items: workItems,
    compiled_input: input,
    metadata: {
      source: 'local_fallback',
      provisional: true,
      work_mode: workMode,
      launch_surface: launchSurface,
      interaction_surface: interactionSurface,
      runtime_profile: runtimeProfile,
      runtime_target: runtimeTarget,
      model_plane: modelPlane,
      execution_plane: executionPlane,
      workspace_target: workspaceTarget,
      fallback_runtime: localRuntimeSeat === 'acp_bridge' ? getAgentMode() : localRuntimeSeat,
      local_runtime_seat: localRuntimeSeat,
      local_runtime_seat_preference: seatResolution.preference,
      local_runtime_dispatch: seatDispatchResult,
    },
  })
}

async function handleLaunchIntent(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
) {
  const parsedIntent = LongclawLaunchIntentSchema.parse(payload)
  const seatPreference = normalizeLocalRuntimeSeatPreference(
    parsedIntent.metadata.local_runtime_seat_preference,
  )
  const seatResolution = resolveLaunchSeat(parsedIntent.work_mode, seatPreference)
  const intent = withLaunchSeatMetadata(parsedIntent, seatResolution)
  try {
    const receipt = await getControlPlaneClient().launch(intent)
    const hasPackMention = intent.mentions.some(mention => mention.kind === 'pack')
    const shouldDispatchLocalSeat =
      intent.work_mode !== 'cloud_sandbox' &&
      seatResolution.available &&
      (receipt.pack_id === 'local_runtime' || !hasPackMention)

    if (shouldDispatchLocalSeat) {
      if (seatResolution.seat === 'acp_bridge') {
        const sender = event.sender
        const b = await ensureBackend()
        await b.query(String(intent.requested_outcome ?? intent.raw_text).trim(), rawEvent => {
          forwardAgentEvent(sender, rawEvent as AgentStreamEvent)
        })
      } else if (seatResolution.seat === 'local_runtime_api') {
        await dispatchToLocalRuntimeApi({
          launch_id: receipt.launch_id,
          task_id: receipt.task.task_id,
          work_mode: intent.work_mode,
          requested_outcome: String(intent.requested_outcome ?? intent.raw_text).trim(),
          mentions: intent.mentions as Array<Record<string, unknown>>,
          workspace_root:
            typeof intent.workspace_target === 'string' && intent.workspace_target
              ? intent.workspace_target
              : currentCwd,
          runtime_profile:
            currentRuntimeProfile(intent.work_mode, seatResolution) as
              | 'dev_local_acp_bridge'
              | 'packaged_local_runtime'
              | 'cloud_managed_runtime',
          model_plane: 'cloud_provider',
          raw_text: intent.raw_text,
        }, seatResolution.preference)
      }
    }

    return LongclawLaunchReceiptSchema.parse({
      ...receipt,
      task: {
        ...receipt.task,
        metadata: {
          ...(receipt.task.metadata ?? {}),
          local_runtime_seat: seatResolution.seat,
          local_runtime_seat_preference: seatResolution.preference,
        },
      },
      run: {
        ...receipt.run,
        metadata: {
          ...(receipt.run.metadata ?? {}),
          local_runtime_seat: seatResolution.seat,
          local_runtime_seat_preference: seatResolution.preference,
        },
      },
      metadata: {
        ...(receipt.metadata ?? {}),
        local_runtime_seat: seatResolution.seat,
        local_runtime_seat_preference: seatResolution.preference,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const hasPackMention = intent.mentions.some(mention => mention.kind === 'pack')
    const missingPackRouting =
      /LaunchIntent requires an @pack mention/.test(message) && !hasPackMention
    const shouldFallback =
      !getControlPlaneClient().isHermesBacked() ||
      /404\b/.test(message) ||
      /Launch requires Hermes Agent OS/.test(message) ||
      missingPackRouting

    if (!shouldFallback) {
      throw error
    }
    return handleProvisionalLaunch(event, intent)
  }
}

type StrategyAiTaskKind = 'rank_candidates' | 'review_candidate'

function strategyAiInputHash(kind: StrategyAiTaskKind, payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ kind, payload }))
    .digest('hex')
    .slice(0, 16)
}

function strategyAiRunId(kind: StrategyAiTaskKind): string {
  const compactIso = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `strategy-ai-${kind.replace('_', '-')}-${compactIso}`
}

function compactStrategyAiPayload(payload: unknown, maxLength = 16000): string {
  const raw = JSON.stringify(payload, null, 2)
  if (raw.length <= maxLength) return raw
  return `${raw.slice(0, maxLength)}\n/* truncated */`
}

function extractJsonObjectFromText(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || text.trim()
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed }
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const sliced = candidate.slice(start, end + 1)
      const parsed = JSON.parse(sliced)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed }
    }
    throw new Error('AI response did not contain a JSON object')
  }
}

function strategyAiPrompt(kind: StrategyAiTaskKind, payload: unknown): string {
  const schema = kind === 'rank_candidates'
    ? `{
  "summary": "one sentence",
  "selected": [
    {
      "rank": 1,
      "symbol": "string",
      "name": "string",
      "verdict": "focus|wait|avoid|remove",
      "why_watch": "string",
      "wait_for": ["string"],
      "risk_flags": ["string"],
      "dont_do": "string",
      "invalidation": "string"
    }
  ]
}`
    : `{
  "symbol": "string",
  "name": "string",
  "verdict": "focus|wait|avoid|remove",
  "why_watch": "string",
  "wait_for": ["string"],
  "risk_flags": ["string"],
  "dont_do": "string",
  "invalidation": "string",
  "next_action": "string"
}`
  const task = kind === 'rank_candidates'
    ? '从 Signals 候选池中选出今天最值得盯的 5-10 个标的，并降噪排序。'
    : '复核当前候选是否值得行动，给出交易员可执行的等待条件、风险和失效条件。'
  return [
    '你是一个 A 股交易员的第二交易员，只基于输入的 Signals 证据做判断。',
    '不要编造行情、价格、财务数据或新闻。没有证据就写“证据不足”。',
    '不要给自动下单指令。只输出 JSON，不要 Markdown，不要解释 JSON 外的文字。',
    `任务：${task}`,
    `输出 schema：${schema}`,
    `输入证据：${compactStrategyAiPayload(payload)}`,
  ].join('\n\n')
}

async function handleStrategyAiTask(kind: StrategyAiTaskKind, payload: unknown) {
  const startedAt = Date.now()
  const runId = strategyAiRunId(kind)
  const inputHash = strategyAiInputHash(kind, payload)
  const mode = getAgentMode()
  const model = mode === 'sdk' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6') : mode
  const runBase = {
    run_id: runId,
    task: kind,
    provider: `agent-os-${mode}`,
    model,
    prompt_version: 'signals-trader-v1',
    input_hash: inputHash,
    output_schema: kind === 'rank_candidates' ? 'ai_candidate_ranking.v1' : 'ai_candidate_review.v1',
    created_at: new Date(startedAt).toISOString(),
  }
  const textParts: string[] = []

  try {
    const b = await ensureBackend()
    await b.query(strategyAiPrompt(kind, payload), rawEvent => {
      const event = rawEvent as AgentStreamEvent
      if (event.type === 'text' && event.text) textParts.push(event.text)
      if (event.type === 'error') throw new Error(event.error)
    })
    const output = extractJsonObjectFromText(textParts.join('\n'))
    return {
      ok: true,
      output,
      run: {
        ...runBase,
        status: 'success',
        latency_ms: Date.now() - startedAt,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: message,
      output: null,
      run: {
        ...runBase,
        status: 'failed',
        latency_ms: Date.now() - startedAt,
      },
    }
  }
}

// --- IPC Handlers ---

async function handleQuery(_event: Electron.IpcMainInvokeEvent, message: string) {
  const sender = _event.sender
  const b = await ensureBackend()

  await b.query(message, (event) => {
    forwardAgentEvent(sender, event as AgentStreamEvent)
  })

  return { ok: true }
}

app.whenReady().then(() => {
  log('app ready', {
    run_id: observationState.run_id,
    observation_dir: observationState.observation_dir,
    logs: observationState.logs,
  })
  startWechatBindingCallbackServer()
  // Agent
  ipcMain.handle('agent:query', handleQuery)
  ipcMain.handle('agent:clear', async () => {
    backend?.clear()
    return { ok: true }
  })
  ipcMain.handle('agent:mode', () => {
    return { mode: getAgentMode(), alive: backend?.alive() ?? false }
  })
  ipcMain.handle('strategy-ai:rank-candidates', (_event, payload: unknown) =>
    handleStrategyAiTask('rank_candidates', payload))
  ipcMain.handle('strategy-ai:review-candidate', (_event, payload: unknown) =>
    handleStrategyAiTask('review_candidate', payload))

  // CWD management
  ipcMain.handle('cwd:get', () => currentCwd)

  ipcMain.handle('cwd:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择项目目录',
      defaultPath: currentCwd,
    })
    if (!result.canceled && result.filePaths[0]) {
      const newCwd = result.filePaths[0]
      currentCwd = newCwd
      if (backend) {
        backend.close()
        backend = null
      }
      log(`cwd changed to: ${newCwd}`)
      return { cwd: newCwd, skills: discoverSkills(newCwd) }
    }
    return null
  })

  ipcMain.handle('cwd:set', (_event, newCwd: string) => {
    if (fs.existsSync(newCwd)) {
      currentCwd = newCwd
      if (backend) {
        backend.close()
        backend = null
      }
      log(`cwd set to: ${newCwd}`)
      return { cwd: newCwd, skills: discoverSkills(newCwd) }
    }
    return null
  })

  // Skills
  ipcMain.handle('skills:list', () => discoverAllSkills())

  // Cowork front door + capability substrate
  ipcMain.handle('launch:submit', handleLaunchIntent)
  ipcMain.handle('launch:list-tasks', async (_event, limit?: number) =>
    getControlPlaneClient().listTasks(typeof limit === 'number' ? limit : 50),
  )
  ipcMain.handle('launch:get-task', async (_event, taskId: string) =>
    getControlPlaneClient().getTask(taskId),
  )
  ipcMain.handle('weclaw:list-sessions', () => listWeclawSessions())
  ipcMain.handle('weclaw:get-session', (_event, sessionId: string) => getWeclawSession(sessionId))
  ipcMain.handle('weclaw:get-source-status', () => getWeclawSessionSourceStatus())
  ipcMain.handle('wechat:get-binding-status', () => getWeChatBindingStatus())
  ipcMain.handle('wechat:get-cluster-status', () => getWeChatClusterStatus())
  ipcMain.handle('wechat:probe-cluster-nodes', () => probeWeChatClusterNodes())
  ipcMain.handle('wechat:create-binding-session', async () => {
    try {
      return await createIlinkWeChatBindingSession()
    } catch (error) {
      log('wechat ilink qr creation failed; falling back to local callback', {
        error: error instanceof Error ? error.message : String(error),
      })
      return createLocalWeChatBindingSession({
        status: 'ilink_failed',
        note:
          error instanceof Error
            ? `iLink QR unavailable: ${error.message}`
            : `iLink QR unavailable: ${String(error)}`,
      })
    }
  })
  ipcMain.handle('wechat:create-local-binding-session', () => {
    cancelWechatIlinkPolling()
    return createLocalWeChatBindingSession()
  })
  ipcMain.handle('wechat:complete-binding-session', () => {
    const pending = readWeChatBindingStatus(WECHAT_BINDING_STATE_PATH)
    const status = completeWeChatBindingSession(WECHAT_BINDING_STATE_PATH, {
      provider: pending.provider,
      identityStatus:
        pending.provider === 'local_lan_callback' ? 'local_runtime_bound' : 'ilink_failed',
      identityNote:
        pending.provider === 'local_lan_callback'
          ? 'Manual local completion. OpenID/iLink identity was not provided by this callback.'
          : 'Manual completion cannot verify iLink identity; scan and confirm the iLink QR instead.',
    })
    log('wechat binding manually completed', {
      session_id: status.binding_session_id,
      wechat_user_id: status.wechat_user_id,
      identity_status: status.identity_status,
      bound_at: status.bound_at,
    })
    return status
  })
  ipcMain.handle('wechat:revoke-binding', () => {
    cancelWechatIlinkPolling()
    const status = revokeWeChatBinding(WECHAT_BINDING_STATE_PATH)
    log('wechat binding revoked')
    return status
  })
  ipcMain.handle('wechat:route-message', (_event, text: string) =>
    routeWeChatMessage({
      bindingPath: WECHAT_BINDING_STATE_PATH,
      pluginDevPath: PLUGIN_DEV_STATE_PATH,
      text,
      targetRepo: currentCwd || REPO_ROOT,
    }),
  )
  ipcMain.handle(
    'weclaw:update-session-state',
    (_event, canonicalSessionId: string, patch: Partial<{ hidden: boolean; archived: boolean }>) =>
      updateWeclawSessionUiState(canonicalSessionId, patch),
  )
  ipcMain.handle('plugin-dev:list-issues', () => getPluginDevIssues())
  ipcMain.handle('plugin-dev:list-receipts', () => getPluginDevReceipts())
  ipcMain.handle('plugin-dev:start-implementation', (_event, issueId: string) =>
    startPluginDevImplementation(PLUGIN_DEV_STATE_PATH, issueId),
  )
  ipcMain.handle('plugin-dev:run-ci', (_event, issueId: string) =>
    runPluginDevCi(PLUGIN_DEV_STATE_PATH, issueId),
  )
  ipcMain.handle('plugin-dev:merge', (_event, issueId: string) =>
    mergePluginDevIssue(PLUGIN_DEV_STATE_PATH, issueId),
  )
  ipcMain.handle('plugin-dev:register-artifact', (_event, issueId: string) =>
    registerPluginDevArtifact(PLUGIN_DEV_STATE_PATH, issueId),
  )
  ipcMain.handle('capability-substrate:get-summary', buildCapabilitySubstrateSummary)
  ipcMain.handle('capability-manager:get-settings', () => getCapabilityManagerSettings())
  ipcMain.handle('capability-manager:update-settings', (_event, patch: unknown) =>
    updateCapabilityManagerSettings(patch),
  )
  ipcMain.handle('capability-manager:get-registry', () => getRuntimeCapabilityRegistry())
  ipcMain.handle(
    'capability-manager:register',
    (_event, payload: { kind: RuntimeCapabilityKind; sourcePath: string; label?: string }) =>
      registerManagedCapability(payload),
  )
  ipcMain.handle('capability-manager:remove', (_event, registryId: string) =>
    removeManagedCapability(registryId),
  )
  ipcMain.handle('capability-manager:rescan', () => rescanManagedCapabilities())
  ipcMain.handle('runtime:get-local-seat-preference', () => getLocalRuntimeSeatPreference())
  ipcMain.handle('runtime:set-local-seat-preference', (_event, value: unknown) => ({
    preference: setLocalRuntimeSeatPreference(value),
  }))
  ipcMain.handle('model-service:get-settings', () => getModelServiceSettings())
  ipcMain.handle('model-service:update-settings', (_event, patch: unknown) =>
    updateModelServiceSettings(patch),
  )
  ipcMain.handle('model-service:pull-models', () => fetchModelServiceModels())
  ipcMain.handle('model-service:test-connection', () => fetchModelServiceModels())
  ipcMain.handle('model-service:chat', (_event, payload: unknown) => runModelServiceChat(payload))
  ipcMain.handle('employees:list', () => listEmployeeDefinitions())
  ipcMain.handle('employees:open-definition', (_event, idOrPath: string) =>
    openEmployeeDefinitionFile(idOrPath),
  )
  ipcMain.handle('employees:open-folder', () => openEmployeeDefinitionsFolder())

  // Control plane
  ipcMain.handle('control-plane:get-overview', async () => getControlPlaneClient().getOverview())
  ipcMain.handle('control-plane:list-runs', async () => getControlPlaneClient().listRuns())
  ipcMain.handle('control-plane:list-work-items', async () => getControlPlaneClient().listWorkItems())
  ipcMain.handle('control-plane:get-pack-dashboard', async (_event, packId: string) => getControlPlaneClient().getPackDashboard(packId))
  ipcMain.handle('control-plane:list-artifacts', async (_event, runId: string, domain: string) => getControlPlaneClient().listArtifacts(runId, domain))
  ipcMain.handle('control-plane:execute-action', async (_event, actionId: string, payload: any) => getControlPlaneClient().executeAction(actionId, payload ?? {}))
  ipcMain.handle('control-plane:local-action', handleLocalAction)
  ipcMain.handle('control-plane:read-artifact-preview', handleReadArtifactPreview)
  ipcMain.handle('window:set-locale', async (_event, locale: string) => {
    applyWindowLocale(locale === 'en-US' ? 'en-US' : 'zh-CN')
    return { ok: true }
  })
  ipcMain.handle('observation:get-context', () => ({
    ok: true,
    run_id: observationState.run_id,
    product_line: observationState.product_line,
    scenario: observationState.scenario,
    observation_dir: observationState.observation_dir,
    logs: observationState.logs,
    git: observationState.git,
    runtime: observationState.runtime,
  }))
  ipcMain.handle('observation:record-event', (_event, payload: Record<string, unknown>) => {
    appendObservationJsonl(observationEventsPath, 'events', {
      source: 'renderer',
      ...(compactObservationValue(payload) as Record<string, unknown>),
    })
    return {
      ok: true,
      run_id: observationState.run_id,
      observation_dir: observationState.observation_dir,
    }
  })
  ipcMain.handle('observation:record-api-timing', (_event, payload: Record<string, unknown>) => {
    appendObservationJsonl(observationApiTimingsPath, 'api_timings', {
      source: 'renderer-api',
      ...(compactObservationValue(payload) as Record<string, unknown>),
    })
    return {
      ok: true,
      run_id: observationState.run_id,
      observation_dir: observationState.observation_dir,
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  log('window-all-closed')
  backend?.close()
  cancelWechatIlinkPolling()
  wechatBindingCallbackServer?.close()
  wechatBindingCallbackServer = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  log('app activate')
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

process.on('uncaughtException', error => {
  log('uncaughtException', error?.stack || error?.message || String(error))
  appendObservationJsonl(observationEventsPath, 'events', {
    source: 'electron-main',
    name: 'process.uncaughtException',
    level: 'error',
    message: error?.message,
    stack: error?.stack,
  })
})

process.on('unhandledRejection', reason => {
  log('unhandledRejection', reason instanceof Error ? reason.stack || reason.message : String(reason))
  appendObservationJsonl(observationEventsPath, 'events', {
    source: 'electron-main',
    name: 'process.unhandledRejection',
    level: 'error',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})
