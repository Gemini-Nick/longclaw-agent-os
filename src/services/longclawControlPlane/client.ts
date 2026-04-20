import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import {
  type DueDiligenceDashboard,
  DueDiligenceDashboardSchema,
  LongclawArtifactSchema,
  type LongclawArtifact,
  type LongclawControlPlaneOverview,
  LongclawControlPlaneOverviewSchema,
  type LongclawDomainPackDescriptor,
  LongclawDomainPackDescriptorSchema,
  type LongclawExecutionPlane,
  type LongclawInteractionSurface,
  type LongclawLaunchIntent,
  LongclawLaunchIntentSchema,
  type LongclawLaunchReceipt,
  LongclawLaunchReceiptSchema,
  type LongclawModelPlane,
  type LongclawModeSummary,
  type LongclawPackDashboard,
  type LongclawRuntimeProfile,
  type LongclawRuntimeTarget,
  type LongclawRun,
  LongclawRunSchema,
  type LongclawTask,
  LongclawTaskSchema,
  type LongclawWorkMode,
  type LongclawWorkItem,
  LongclawWorkItemSchema,
  type SignalsDashboard,
  SignalsDashboardSchema,
} from './models.js'

export type LongclawControlPlaneClientOptions = {
  hermesAgentOsBaseUrl?: string
  hermesApiKey?: string
  dueDiligenceBaseUrl?: string
  signalsStateRoot?: string
  fetchImpl?: typeof fetch
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function inferWorkMode(run: LongclawRun): LongclawWorkMode {
  const metadata = recordValue(run.metadata)
  const surface = inferInteractionSurface(run)
  const runtimeTarget = inferRuntimeTarget(run)

  if (run.work_mode) return run.work_mode
  if (runtimeTarget === 'local_runtime' && surface === 'weclaw') return 'weclaw_dispatch'
  return runtimeTarget === 'local_runtime' ? 'local' : 'cloud_sandbox'
}

function executionPlaneForMode(workMode: LongclawWorkMode): LongclawExecutionPlane {
  return runtimeTargetForMode(workMode) === 'cloud_runtime' ? 'cloud_executor' : 'local_executor'
}

function runtimeTargetForMode(workMode: LongclawWorkMode): LongclawRuntimeTarget {
  return workMode === 'cloud_sandbox' ? 'cloud_runtime' : 'local_runtime'
}

function interactionSurfaceForMode(workMode: LongclawWorkMode): LongclawInteractionSurface {
  return workMode === 'weclaw_dispatch' ? 'weclaw' : 'electron_home'
}

function modelPlaneForMode(): LongclawModelPlane {
  return 'cloud_provider'
}

function inferRuntimeProfile(run: LongclawRun): LongclawRuntimeProfile {
  const metadata = recordValue(run.metadata)
  return (
    (stringValue(run.runtime_profile) as LongclawRuntimeProfile | undefined) ??
    (stringValue(metadata.runtime_profile) as LongclawRuntimeProfile | undefined) ??
    'dev_local_acp_bridge'
  )
}

function inferRuntimeTarget(run: LongclawRun): LongclawRuntimeTarget {
  const metadata = recordValue(run.metadata)
  const explicit =
    (stringValue(run.runtime_target) as LongclawRuntimeTarget | undefined) ??
    (stringValue(metadata.runtime_target) as LongclawRuntimeTarget | undefined)
  if (explicit) return explicit

  const legacy = stringValue(run.execution_plane) ?? stringValue(metadata.execution_plane)
  if (legacy === 'weclaw_dispatch' || legacy === 'local_executor') return 'local_runtime'
  if (legacy === 'cloud_executor') return 'cloud_runtime'
  return runtimeTargetForMode(run.work_mode ?? 'cloud_sandbox')
}

function inferInteractionSurface(run: LongclawRun): LongclawInteractionSurface {
  const metadata = recordValue(run.metadata)
  const explicit =
    (stringValue(run.interaction_surface) as LongclawInteractionSurface | undefined) ??
    (stringValue(metadata.interaction_surface) as LongclawInteractionSurface | undefined)
  if (explicit) return explicit

  const candidate =
    stringValue(run.origin_surface) ??
    stringValue(metadata.origin_surface) ??
    stringValue(metadata.launch_surface) ??
    stringValue(metadata.launch_source) ??
    stringValue(metadata.source) ??
    stringValue(metadata.channel)
  if (candidate) {
    const normalized = candidate.toLowerCase()
    if (normalized.includes('weclaw') || normalized.includes('wechat') || normalized.includes('dispatch')) {
      return 'weclaw'
    }
    if (normalized.includes('electron') || normalized.includes('home') || normalized.includes('desktop')) {
      return 'electron_home'
    }
  }
  return interactionSurfaceForMode(run.work_mode ?? 'cloud_sandbox')
}

function inferOriginSurface(run: LongclawRun): string | null {
  return run.origin_surface ?? inferInteractionSurface(run)
}

function inferModelPlane(run: LongclawRun): LongclawModelPlane {
  const metadata = recordValue(run.metadata)
  return (
    (stringValue(run.model_plane) as LongclawModelPlane | undefined) ??
    (stringValue(metadata.model_plane) as LongclawModelPlane | undefined) ??
    modelPlaneForMode()
  )
}

function summarizeModes(
  tasks: LongclawTask[],
  runs: LongclawRun[],
  workItems: LongclawWorkItem[],
): LongclawModeSummary {
  const empty = (): LongclawModeSummary['tasks'] => ({
    local: 0,
    cloud_sandbox: 0,
    weclaw_dispatch: 0,
  })
  const summary: LongclawModeSummary = {
    tasks: empty(),
    runs: empty(),
    work_items: empty(),
  }

  for (const task of tasks) {
    summary.tasks[task.work_mode] += 1
  }
  for (const run of runs) {
    summary.runs[run.work_mode] += 1
  }
  for (const item of workItems) {
    summary.work_items[item.work_mode] += 1
  }

  return summary
}

export function createLongclawControlPlaneClientFromEnv(
  overrides: LongclawControlPlaneClientOptions = {},
): LongclawControlPlaneClient {
  return new LongclawControlPlaneClient({
    hermesAgentOsBaseUrl:
      overrides.hermesAgentOsBaseUrl ??
      envValue('LONGCLAW_HERMES_AGENT_OS_BASE_URL') ??
      envValue('LONGCLAW_AGENT_OS_BASE_URL'),
    hermesApiKey:
      overrides.hermesApiKey ??
      envValue('LONGCLAW_AGENT_OS_API_KEY') ??
      envValue('LONGCLAW_HERMES_API_KEY'),
    dueDiligenceBaseUrl:
      overrides.dueDiligenceBaseUrl ??
      envValue('LONGCLAW_DUE_DILIGENCE_BASE_URL'),
    signalsStateRoot:
      overrides.signalsStateRoot ??
      envValue('LONGCLAW_SIGNALS_STATE_ROOT'),
    fetchImpl: overrides.fetchImpl,
  })
}

const defaultPacks = (
  options: LongclawControlPlaneClientOptions,
): LongclawDomainPackDescriptor[] => {
  const packs: LongclawDomainPackDescriptor[] = []
  if (options.dueDiligenceBaseUrl) {
    packs.push(
      LongclawDomainPackDescriptorSchema.parse({
        pack_id: 'due_diligence',
        domain: 'due_diligence',
        version: '0.1.0',
        owner_repo: 'due-diligence-core',
        runtime: 'cloud',
        description:
          'Due-diligence flagship pack with runtime health, evidence bundles, and review queues.',
        metadata: {
          transport: 'http',
          baseUrl: options.dueDiligenceBaseUrl,
        },
      }),
    )
  }
  if (options.signalsStateRoot) {
    packs.push(
      LongclawDomainPackDescriptorSchema.parse({
        pack_id: 'signals',
        domain: 'financial_analysis',
        version: '0.1.0',
        owner_repo: 'Signals',
        runtime: 'cloud',
        description: 'Signals flagship pack backed by the LONG CLAW analysis ledger.',
        metadata: {
          transport: 'filesystem',
          stateRoot: options.signalsStateRoot,
        },
      }),
    )
  }
  return packs
}

function degradedDueDiligenceDashboard(
  status: 'healthy' | 'degraded' | 'not_connected',
  notice: string,
): DueDiligenceDashboard {
  return DueDiligenceDashboardSchema.parse({
    pack_id: 'due_diligence',
    title: 'Due Diligence',
    status,
    notice,
    recent_runs: [],
    manual_review_queue: [],
    repair_cases: [],
    site_health: [],
    operator_actions: [],
  })
}

function degradedSignalsDashboard(
  status: 'healthy' | 'degraded' | 'not_connected',
  notice: string,
): SignalsDashboard {
  return SignalsDashboardSchema.parse({
    pack_id: 'signals',
    title: 'Signals',
    status,
    notice,
    recent_runs: [],
    review_runs: [],
    backtest_summary: { total: 0, evaluated: 0, pending: 0 },
    pending_backlog_preview: [],
    connector_health: [],
    operator_actions: [],
  })
}

async function fetchJson<T>(
  url: string,
  parse: (value: unknown) => T,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchImpl(url, init)
  if (!response.ok) {
    throw new Error(`Longclaw control plane request failed: ${response.status} ${url}`)
  }
  return parse(await response.json())
}

async function readSignalsRunFiles(stateRoot: string): Promise<LongclawRun[]> {
  const runsRoot = join(stateRoot, 'runs')
  let entries: string[]
  try {
    entries = await readdir(runsRoot)
  } catch {
    return []
  }

  const runs = await Promise.all(
    entries.map(async entry => {
      try {
        const raw = await readFile(join(runsRoot, entry, 'run.json'), 'utf-8')
        return LongclawRunSchema.parse(JSON.parse(raw))
      } catch {
        return null
      }
    }),
  )

  return runs
    .filter((run): run is LongclawRun => Boolean(run))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function capabilityFromRun(run: LongclawRun): string {
  if (run.capability.includes('.')) return run.capability
  if (run.pack_id) return `${run.pack_id}.${run.capability}`
  const metadata = run.metadata as Record<string, unknown>
  const packId = metadata.pack_id
  return typeof packId === 'string' && packId ? `${packId}.${run.capability}` : run.capability
}

function provisionalTaskId(run: LongclawRun): string {
  return run.task_id ?? `task:provisional:${run.run_id}`
}

function updatedAtForRun(run: LongclawRun): string {
  return run.finished_at ?? run.started_at ?? run.created_at
}

function taskInputFromRun(run: LongclawRun): Record<string, unknown> {
  const metadata = run.metadata as Record<string, unknown>
  return {
    query:
      metadata.query ??
      metadata.requested_outcome ??
      metadata.raw_text ??
      metadata.summary ??
      run.summary,
    raw_text: metadata.raw_text ?? undefined,
    requested_outcome: metadata.requested_outcome ?? undefined,
  }
}

function provisionalTaskFromRun(run: LongclawRun): LongclawTask {
  const metadata = run.metadata as Record<string, unknown>
  const workMode = inferWorkMode(run)
  const originSurface = inferOriginSurface(run)
  const interactionSurface = inferInteractionSurface(run)
  const runtimeProfile = inferRuntimeProfile(run)
  const runtimeTarget = inferRuntimeTarget(run)
  const modelPlane = inferModelPlane(run)
  const executionPlane = run.execution_plane ?? executionPlaneForMode(workMode)
  return LongclawTaskSchema.parse({
    task_id: provisionalTaskId(run),
    capability: capabilityFromRun(run),
    session_id: run.session_id ?? null,
    channel:
      typeof metadata.channel === 'string'
        ? metadata.channel
        : typeof metadata.launch_source === 'string'
          ? metadata.launch_source
          : null,
    status: run.status,
    input: taskInputFromRun(run),
    work_mode: workMode,
    origin_surface: originSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: modelPlane,
    execution_plane: executionPlane,
    run_ids: [run.run_id],
    last_run_id: run.run_id,
    created_at: run.created_at,
    updated_at: updatedAtForRun(run),
    metadata: {
      ...metadata,
      provisional: true,
      derived_from_run: true,
      pack_id: run.pack_id ?? metadata.pack_id ?? null,
      work_mode: workMode,
      origin_surface: originSurface,
      interaction_surface: interactionSurface,
      runtime_profile: runtimeProfile,
      runtime_target: runtimeTarget,
      model_plane: modelPlane,
      execution_plane: executionPlane,
    },
  })
}

export class LongclawControlPlaneClient {
  private readonly hermesAgentOsBaseUrl?: string
  private readonly hermesApiKey?: string
  private readonly dueDiligenceBaseUrl?: string
  private readonly signalsStateRoot?: string
  private readonly fetchImpl: typeof fetch

  constructor(options: LongclawControlPlaneClientOptions = {}) {
    this.hermesAgentOsBaseUrl = options.hermesAgentOsBaseUrl?.replace(/\/$/, '')
    this.hermesApiKey = options.hermesApiKey
    this.dueDiligenceBaseUrl = options.dueDiligenceBaseUrl?.replace(/\/$/, '')
    this.signalsStateRoot = options.signalsStateRoot
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private authHeaders(): HeadersInit | undefined {
    if (!this.hermesApiKey) return undefined
    return { Authorization: `Bearer ${this.hermesApiKey}` }
  }

  isHermesBacked(): boolean {
    return Boolean(this.hermesAgentOsBaseUrl)
  }

  async launch(intent: LongclawLaunchIntent): Promise<LongclawLaunchReceipt> {
    if (!this.hermesAgentOsBaseUrl) {
      throw new Error('Launch requires Hermes Agent OS')
    }

    return fetchJson(
      `${this.hermesAgentOsBaseUrl}/agent-os/launches`,
      value => LongclawLaunchReceiptSchema.parse(value),
      this.fetchImpl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authHeaders() ?? {}),
        },
        body: JSON.stringify(LongclawLaunchIntentSchema.parse(intent)),
      },
    )
  }

  async listPacks(): Promise<LongclawDomainPackDescriptor[]> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/packs`,
          value => LongclawDomainPackDescriptorSchema.array().parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall back to known local descriptors when the control plane is configured
        // but not currently reachable.
      }
    }
    return defaultPacks({
      dueDiligenceBaseUrl: this.dueDiligenceBaseUrl,
      signalsStateRoot: this.signalsStateRoot,
    })
  }

  async listTasks(limit = 50): Promise<LongclawTask[]> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/tasks?limit=${encodeURIComponent(String(limit))}`,
          value => LongclawTaskSchema.array().parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall back to a provisional task view when Hermes is partially rolled out.
      }
    }

    const tasks = new Map<string, LongclawTask>()
    for (const run of await this.listRuns()) {
      const taskId = provisionalTaskId(run)
      const existing = tasks.get(taskId)
      const current = provisionalTaskFromRun(run)
      if (!existing) {
        tasks.set(taskId, current)
        continue
      }
      tasks.set(
        taskId,
        LongclawTaskSchema.parse({
          ...existing,
          status: current.status,
          work_mode: current.work_mode ?? existing.work_mode,
          origin_surface: current.origin_surface ?? existing.origin_surface,
          interaction_surface: current.interaction_surface ?? existing.interaction_surface,
          runtime_profile: current.runtime_profile ?? existing.runtime_profile,
          runtime_target: current.runtime_target ?? existing.runtime_target,
          model_plane: current.model_plane ?? existing.model_plane,
          execution_plane: current.execution_plane ?? existing.execution_plane,
          run_ids: [...new Set([...existing.run_ids, run.run_id])],
          last_run_id: run.run_id,
          updated_at: current.updated_at ?? existing.updated_at,
          metadata: {
            ...existing.metadata,
            ...current.metadata,
          },
        }),
      )
    }

    return [...tasks.values()]
      .sort((left, right) =>
        String(right.updated_at ?? right.created_at ?? '').localeCompare(
          String(left.updated_at ?? left.created_at ?? ''),
        ),
      )
      .slice(0, limit)
  }

  async getTask(taskId: string): Promise<LongclawTask> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/tasks/${encodeURIComponent(taskId)}`,
          value => LongclawTaskSchema.parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall through to provisional run-derived lookup when Hermes is partially rolled out.
      }
    }

    const task = (await this.listTasks(500)).find(item => item.task_id === taskId)
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`)
    }
    return task
  }

  async listRuns(): Promise<LongclawRun[]> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/runs`,
          value => LongclawRunSchema.array().parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall through to local descriptors so the renderer stays usable while
        // Longclaw Core is unavailable.
      }
    }

    const runs: LongclawRun[] = []
    if (this.dueDiligenceBaseUrl) {
      try {
        const payload = await fetchJson(
          `${this.dueDiligenceBaseUrl}/runs`,
          value => value as Array<Record<string, unknown>>,
          this.fetchImpl,
        )
        runs.push(
          ...payload.map(run =>
            LongclawRunSchema.parse({
              run_id: String(run.run_id),
              domain: 'due_diligence',
              capability: `${String(run.task_type ?? 'company')}_due_diligence`,
              status: String(run.status ?? 'queued'),
              requested_by: run.requested_by ? String(run.requested_by) : null,
              work_mode: run.work_mode,
              origin_surface:
                (run.origin_surface ? String(run.origin_surface) : null) ??
                (run.launch_surface ? String(run.launch_surface) : null) ??
                (run.launch_source ? String(run.launch_source) : null) ??
                (run.channel ? String(run.channel) : null),
              interaction_surface: run.interaction_surface,
              runtime_profile: run.runtime_profile,
              runtime_target: run.runtime_target,
              model_plane: run.model_plane,
              execution_plane: run.execution_plane,
              summary: String(run.legacy_summary_message ?? run.query ?? ''),
              created_at: String(run.created_at),
              started_at: run.started_at ? String(run.started_at) : null,
              finished_at: run.finished_at ? String(run.finished_at) : null,
              metadata: {
                pack_id: 'due_diligence',
                ...run,
              },
              pack_id: 'due_diligence',
            }),
          ),
        )
      } catch {
        // Keep degraded mode readable even when the Due Diligence service is down.
      }
    }
    if (this.signalsStateRoot) {
      runs.push(...(await readSignalsRunFiles(this.signalsStateRoot)))
    }
    return runs.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  async listArtifacts(runId: string, domain: string): Promise<LongclawArtifact[]> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/runs/${runId}/artifacts?domain=${encodeURIComponent(domain)}`,
          value => LongclawArtifactSchema.array().parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall through to pack-local artifact discovery when possible.
      }
    }

    if (domain === 'due_diligence' && this.dueDiligenceBaseUrl) {
      try {
        const manifest = await fetchJson(
          `${this.dueDiligenceBaseUrl}/runs/${runId}/artifacts`,
          value => value as Record<string, unknown>,
          this.fetchImpl,
        )
        const candidates = [
          manifest.delivery_zip_path
            ? {
                artifact_id: `${runId}:delivery_zip`,
                run_id: runId,
                kind: 'delivery_zip',
                uri: String(manifest.delivery_zip_path),
                title: 'delivery zip',
                metadata: {},
              }
            : null,
          manifest.diagnostic_manifest_path
            ? {
                artifact_id: `${runId}:diagnostic_manifest`,
                run_id: runId,
                kind: 'diagnostic_manifest',
                uri: String(manifest.diagnostic_manifest_path),
                title: 'diagnostic manifest',
                metadata: {},
              }
            : null,
        ].filter(Boolean)
        return candidates.map(artifact => LongclawArtifactSchema.parse(artifact))
      } catch {
        return []
      }
    }

    if (domain === 'financial_analysis' && this.signalsStateRoot) {
      try {
        const raw = await readFile(join(this.signalsStateRoot, 'runs', runId, 'run.json'), 'utf-8')
        const run = LongclawRunSchema.parse(JSON.parse(raw))
        const stdoutPath = String((run.metadata as Record<string, unknown>).stdout_path ?? '')
        if (!stdoutPath) return []
        return [
          LongclawArtifactSchema.parse({
            artifact_id: `${runId}:stdout`,
            run_id: runId,
            kind: 'stdout_log',
            uri: stdoutPath,
            title: 'signals stdout',
            metadata: {},
          }),
        ]
      } catch {
        return []
      }
    }

    return []
  }

  async listWorkItems(): Promise<LongclawWorkItem[]> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/work-items`,
          value => LongclawWorkItemSchema.array().parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Work items are optional in degraded mode.
      }
    }
    return []
  }

  async getPackDashboard(packId: string): Promise<LongclawPackDashboard> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/packs/${encodeURIComponent(packId)}/dashboard`,
          value =>
            packId === 'due_diligence'
              ? DueDiligenceDashboardSchema.parse(value)
              : SignalsDashboardSchema.parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch (error) {
        if (packId !== 'due_diligence' && packId !== 'signals') {
          throw error
        }
      }
    }

    if (packId === 'due_diligence' && this.dueDiligenceBaseUrl) {
      try {
        const [runs, manualReviewQueue, repairCases, siteHealth] = await Promise.all([
          this.listRuns(),
          fetchJson(
            `${this.dueDiligenceBaseUrl}/manual-review-queue`,
            value => value as Array<Record<string, unknown>>,
            this.fetchImpl,
          ),
          fetchJson(
            `${this.dueDiligenceBaseUrl}/repair-cases`,
            value => value as Array<Record<string, unknown>>,
            this.fetchImpl,
          ),
          fetchJson(
            `${this.dueDiligenceBaseUrl}/site-health`,
            value => value as Array<Record<string, unknown>>,
            this.fetchImpl,
          ),
        ])
        return DueDiligenceDashboardSchema.parse({
          pack_id: 'due_diligence',
          title: 'Due Diligence',
          status: 'healthy',
          notice: '',
          recent_runs: runs.filter(run => run.domain === 'due_diligence').slice(0, 20),
          manual_review_queue: manualReviewQueue.map(item => ({
            ...item,
            artifact_refs: [],
            operator_actions: [],
            metadata: item,
          })),
          repair_cases: repairCases.map(item => ({
            ...item,
            operator_actions: [],
          })),
          site_health: siteHealth.map(item => ({
            ...item,
            operator_actions: [],
          })),
          operator_actions: [],
        })
      } catch (error) {
        return degradedDueDiligenceDashboard(
          'degraded',
          error instanceof Error
            ? error.message
            : 'Due Diligence runtime is configured but currently unavailable.',
        )
      }
    }

    if (packId === 'signals') {
      if (!this.signalsStateRoot) {
        return degradedSignalsDashboard(
          'not_connected',
          'Signals state root is not configured for this Electron runtime.',
        )
      }

      try {
        const runs = await this.listRuns()
        return SignalsDashboardSchema.parse({
          pack_id: 'signals',
          title: 'Signals',
          status: 'healthy',
          notice: '',
          recent_runs: runs.filter(run => run.domain === 'financial_analysis').slice(0, 20),
          review_runs: runs.filter(run => run.capability === 'review').slice(0, 10),
          backtest_summary: { total: 0, evaluated: 0, pending: 0 },
          pending_backlog_preview: [],
          connector_health: [],
          operator_actions: [],
        })
      } catch (error) {
        return degradedSignalsDashboard(
          'degraded',
          error instanceof Error
            ? error.message
            : 'Signals runtime is configured but currently unavailable.',
        )
      }
    }

    if (packId === 'due_diligence') {
      return degradedDueDiligenceDashboard(
        'not_connected',
        'Due Diligence runtime is not configured for this Electron session.',
      )
    }

    throw new Error(`Unknown pack: ${packId}`)
  }

  async executeAction(actionId: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (!this.hermesAgentOsBaseUrl) {
      if (this.dueDiligenceBaseUrl && actionId.startsWith('pack:due_diligence:review:decision:')) {
        const reviewId = actionId.split(':').slice(-2, -1)[0]
        return fetchJson(
          `${this.dueDiligenceBaseUrl}/manual-review/${encodeURIComponent(reviewId)}/decision`,
          value => value as Record<string, unknown>,
          this.fetchImpl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
      }
      if (this.dueDiligenceBaseUrl && actionId.startsWith('pack:due_diligence:run:retry:')) {
        const runId = actionId.split(':').at(-1)
        if (!runId) {
          throw new Error(`Invalid action id: ${actionId}`)
        }
        return fetchJson(
          `${this.dueDiligenceBaseUrl}/runs/${encodeURIComponent(runId)}/retry`,
          value => value as Record<string, unknown>,
          this.fetchImpl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
      }
      throw new Error(`Action requires Hermes Agent OS: ${actionId}`)
    }

    return fetchJson(
      `${this.hermesAgentOsBaseUrl}/agent-os/actions/${encodeURIComponent(actionId)}`,
      value => value as Record<string, unknown>,
      this.fetchImpl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authHeaders() ?? {}),
        },
        body: JSON.stringify(payload),
      },
    )
  }

  async getOverview(): Promise<LongclawControlPlaneOverview> {
    if (this.hermesAgentOsBaseUrl) {
      try {
        return await fetchJson(
          `${this.hermesAgentOsBaseUrl}/agent-os/overview`,
          value => LongclawControlPlaneOverviewSchema.parse(value),
          this.fetchImpl,
          { headers: this.authHeaders() },
        )
      } catch {
        // Fall through to local overview synthesis when the configured control
        // plane is down or only partially rolled out.
      }
    }

    const [packs, runs, tasks, workItems] = await Promise.all([
      this.listPacks(),
      this.listRuns(),
      this.listTasks(200),
      this.listWorkItems(),
    ])
    const failedRuns = runs.filter(run =>
      ['failed', 'repair_required', 'partial'].includes(run.status),
    )
    return LongclawControlPlaneOverviewSchema.parse({
      packs,
      adapters: [],
      packHealth: [],
      adapterHealth: [],
      mode_summary: summarizeModes(tasks, runs, workItems),
      runs_summary: {
        total: runs.length,
        by_status: runs.reduce<Record<string, number>>((acc, run) => {
          acc[run.status] = (acc[run.status] ?? 0) + 1
          return acc
        }, {}),
        running: runs.filter(run => run.status === 'running').length,
        failed: runs.filter(run => ['failed', 'repair_required'].includes(run.status)).length,
        partial: runs.filter(run => run.status === 'partial').length,
        succeeded: runs.filter(run => run.status === 'succeeded').length,
      },
      work_items_summary: {
        total: workItems.length,
        open: workItems.filter(item => item.status === 'open').length,
        critical: workItems.filter(item => item.severity === 'critical').length,
        warning: workItems.filter(item => item.severity === 'warning').length,
        info: workItems.filter(item => item.severity === 'info').length,
      },
        recent_failures: failedRuns.slice(0, 8).map(run => ({
          run_id: run.run_id,
          pack_id: run.pack_id ?? String((run.metadata as Record<string, unknown>).pack_id ?? ''),
          status: run.status,
          work_mode: run.work_mode,
          runtime_profile: run.runtime_profile,
          runtime_target: run.runtime_target,
          interaction_surface: run.interaction_surface,
          model_plane: run.model_plane,
          execution_plane: run.execution_plane,
          summary: run.summary,
          created_at: run.created_at,
        })),
      memoryTargets: {
        raw: 'mempalace://raw',
        reviewed: 'obsidian://reviewed',
      },
    })
  }
}
