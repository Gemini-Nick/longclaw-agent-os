import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DueDiligenceDashboard,
  LongclawArtifact,
  LongclawCapabilitySubstrateSummary,
  LongclawControlPlaneOverview,
  LongclawLaunchIntent,
  LongclawLaunchMention,
  LongclawLaunchReceipt,
  LongclawOperatorAction,
  LongclawPackDashboard,
  LongclawRun,
  LongclawTask,
  LongclawWorkItem,
  SignalsDashboard,
} from '../../../src/services/longclawControlPlane/models.js'
import {
  chromeStyles,
  humanizeToken,
  navButtonStyle,
  palette,
  primaryButtonStyle,
  secondaryButtonStyle,
  segmentedButtonStyle,
  statusBadgeStyle,
  surfaceStyles,
  utilityStyles,
} from './designSystem.js'
import { type LongclawLocale, humanizeTokenLocale, t, tf } from './i18n.js'
import { createShellLayout, getViewportTier } from './layout.js'

type Page = 'home' | 'runs' | 'work_items' | 'packs' | 'studio'
type PackTab = 'due_diligence' | 'signals'
type WorkMode = 'local' | 'cloud_sandbox' | 'weclaw_dispatch'
type NavItemSpec = { id: Page; label: string; glyph: string; title: string }
type SkillInfo = { name: string; path: string; description: string; project?: string }
type AgentModeInfo = { mode: string; alive: boolean }
type CapabilityItem = {
  id: string
  label: string
  kind: 'pack' | 'skill' | 'plugin'
  mention: string
  hint: string
  description: string
}
type LaunchRecord = {
  id: string
  prompt: string
  status: 'running' | 'succeeded' | 'failed'
  started_at: string
  finished_at?: string
  text: string
  tool_names: string[]
  result_label?: string
  error?: string
  task_id?: string
  pack_id?: string
  source?: string
  work_mode?: string
  origin_surface?: string
  interaction_surface?: string
  runtime_profile?: string
  runtime_target?: string
  model_plane?: string
  local_runtime_seat?: string
  execution_plane?: string
  workspace_target?: string
}
type ThreadSummary = {
  id: string
  title: string
  subtitle?: string
  latestAt?: string
  status: string
  workMode?: string
  sessionId?: string
  workspaceTarget?: string
  localRuntimeSeat?: string
  itemCount: number
}
type ConversationEvent =
  | {
      id: string
      type: 'user_launch'
      timestamp: string
      status: string
      title: string
      body?: string
      meta?: string
      workMode?: string
      runtimeProfile?: string
      runtimeTarget?: string
      interactionSurface?: string
      localRuntimeSeat?: string
      launch: LaunchRecord
    }
  | {
      id: string
      type: 'task_receipt'
      timestamp: string
      status: string
      title: string
      body?: string
      meta?: string
      workMode?: string
      runtimeProfile?: string
      runtimeTarget?: string
      interactionSurface?: string
      localRuntimeSeat?: string
      task: LongclawTask
    }
  | {
      id: string
      type: 'run_receipt'
      timestamp: string
      status: string
      title: string
      body?: string
      meta?: string
      workMode?: string
      runtimeProfile?: string
      runtimeTarget?: string
      interactionSurface?: string
      localRuntimeSeat?: string
      run: LongclawRun
    }
  | {
      id: string
      type: 'work_item_receipt'
      timestamp: string
      status: string
      title: string
      body?: string
      meta?: string
      workMode?: string
      runtimeProfile?: string
      runtimeTarget?: string
      interactionSurface?: string
      localRuntimeSeat?: string
      workItem: LongclawWorkItem
    }
type SidebarStatusItem = {
  id: string
  label: string
  meta?: string
  status: string
}
type RuntimeStatusSummary = {
  longclawCoreConnected: boolean
  longclawCoreBaseUrl?: string
  dueDiligenceConnected: boolean
  dueDiligenceBaseUrl?: string
  signalsAvailable: boolean
  signalsStateRoot?: string
  localRuntimeSeat?: string
  localRuntimeAvailable: boolean
  localRuntimeApiUrl?: string
  localRuntimeApiAvailable: boolean
  localAcpAvailable: boolean
  localAcpScript?: string
  localAcpSource?: string
  stackEnvLoaded: boolean
  stackEnvPath?: string
}
type DetailTarget =
  | { type: 'run'; title: string; run: LongclawRun; actions: LongclawOperatorAction[] }
  | { type: 'work_item'; title: string; workItem: LongclawWorkItem }
  | {
      type: 'record'
      title: string
      record: Record<string, unknown>
      actions: LongclawOperatorAction[]
    }

const WORK_MODE_ORDER: WorkMode[] = ['local', 'cloud_sandbox', 'weclaw_dispatch']

const WORK_MODE_SPECS: Record<
  WorkMode,
  {
    label: string
    eyebrow: string
    summary: string
    detail: string
    runtimeTarget: string
    interactionSurface: string
    modelPlane: string
    workspaceLabel: string
    workspaceHint: string
    surfaceLabel: string
    launchButtonLabel: string
    launchHint: string
    placeholder: string
    preferredChannels: string[]
    fallbackChannels: string[]
  }
> = {
  local: {
    label: 'Local Work',
    eyebrow: 'Local environment',
    summary: 'Run against this machine and workspace, while keeping model inference on the cloud provider plane.',
    detail: 'Best for coding, terminal work, and direct file manipulation when the environment should stay local but the model stays remote.',
    runtimeTarget: 'local_runtime',
    interactionSurface: 'electron_home',
    modelPlane: 'cloud_provider',
    workspaceLabel: 'Current workspace',
    workspaceHint: 'Environment stays local. The model plane stays cloud-backed.',
    surfaceLabel: 'Electron Home',
    launchButtonLabel: 'Launch local work',
    launchHint:
      'Local Work keeps execution on this machine, keeps the model in the cloud, and still lands in the same task ledger.',
    placeholder:
      'Describe the local outcome you want, then optionally steer with @pack, @skill, or @plugin.',
    preferredChannels: ['desktop'],
    fallbackChannels: ['weclaw'],
  },
  cloud_sandbox: {
    label: 'Cloud Sandbox',
    eyebrow: 'Cloud environment',
    summary: 'Run in a remote sandbox where both the environment and model access stay on the cloud side.',
    detail: 'Best for isolated, long-running, or remote execution when the local machine should not be part of the environment.',
    runtimeTarget: 'cloud_runtime',
    interactionSurface: 'electron_home',
    modelPlane: 'cloud_provider',
    workspaceLabel: 'Cloud sandbox',
    workspaceHint: 'Environment and model access both stay on the cloud side.',
    surfaceLabel: 'Electron Home',
    launchButtonLabel: 'Launch in cloud sandbox',
    launchHint:
      'Cloud Sandbox keeps launch on desktop while routing environment execution to the cloud runtime.',
    placeholder:
      'Describe the cloud task, then optionally route it with @pack, @skill, or @plugin.',
    preferredChannels: ['desktop'],
    fallbackChannels: ['weclaw'],
  },
  weclaw_dispatch: {
    label: 'WeClaw Dispatch',
    eyebrow: 'WeChat-controlled local environment',
    summary: 'Launch or continue work from WeClaw while the environment stays local and the model stays on the cloud provider plane.',
    detail: 'Best for async dispatch, mobile continuity, and controlling the local environment from a WeChat thread without exposing the bridge as the product default.',
    runtimeTarget: 'local_runtime',
    interactionSurface: 'weclaw',
    modelPlane: 'cloud_provider',
    workspaceLabel: 'WeClaw thread',
    workspaceHint: 'WeChat controls the local environment. The model plane stays cloud-backed.',
    surfaceLabel: 'WeClaw + Electron',
    launchButtonLabel: 'Dispatch via WeClaw',
    launchHint:
      'WeClaw Dispatch keeps chat continuity while the canonical task ledger and governance stay in Electron.',
    placeholder:
      'Describe the dispatched task, then optionally steer with @pack, @skill, or @plugin.',
    preferredChannels: ['weclaw', 'desktop'],
    fallbackChannels: ['desktop'],
  },
}

function localizedWorkModeSpec(locale: LongclawLocale, mode: WorkMode) {
  const base = WORK_MODE_SPECS[mode]
  const prefix =
    mode === 'local'
      ? 'mode.local'
      : mode === 'cloud_sandbox'
        ? 'mode.cloud'
        : 'mode.weclaw'
  return {
    ...base,
    label: t(locale, `${prefix}.label`),
    eyebrow: t(locale, `${prefix}.eyebrow`),
    summary: t(locale, `${prefix}.summary`),
    detail: t(locale, `${prefix}.detail`),
    workspaceLabel: t(locale, `${prefix}.workspace_label`),
    workspaceHint: t(locale, `${prefix}.workspace_hint`),
    surfaceLabel: t(locale, `${prefix}.surface_label`),
    launchButtonLabel: t(locale, `${prefix}.launch_button`),
    launchHint: t(locale, `${prefix}.launch_hint`),
    placeholder: t(locale, `${prefix}.placeholder`),
  }
}

function workModeSpecFromValue(
  locale: LongclawLocale,
  value?: string | null,
): ReturnType<typeof localizedWorkModeSpec> | null {
  if (value === 'local' || value === 'cloud_sandbox' || value === 'weclaw_dispatch') {
    return localizedWorkModeSpec(locale, value)
  }
  return null
}

declare global {
  interface Window {
    agentAPI: {
      query: (message: string) => Promise<{ ok: boolean }>
      clear: () => Promise<{ ok: boolean }>
      getMode: () => Promise<AgentModeInfo>
      getCwd: () => Promise<string>
      getSkills: () => Promise<SkillInfo[]>
      onText: (cb: (text: string) => void) => () => void
      onTool: (cb: (tool: { name: string; input: unknown }) => void) => () => void
      onResult: (cb: (result: unknown) => void) => () => void
      onError: (cb: (error: string) => void) => () => void
    }
    longclawControlPlane: {
      getOverview: () => Promise<LongclawControlPlaneOverview>
      listRuns: () => Promise<LongclawRun[]>
      listWorkItems: () => Promise<LongclawWorkItem[]>
      getPackDashboard: (packId: PackTab) => Promise<LongclawPackDashboard>
      listArtifacts: (runId: string, domain: string) => Promise<LongclawArtifact[]>
      executeAction: (
        actionId: string,
        payload?: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>
      performLocalAction: (action: {
        kind: string
        payload?: Record<string, unknown>
      }) => Promise<Record<string, unknown>>
      readArtifactPreview: (uri: string) => Promise<{
        ok: boolean
        text?: string
        reason?: string
        size?: number
      }>
    }
    longclawLaunch: {
      launch: (intent: LongclawLaunchIntent) => Promise<LongclawLaunchReceipt>
      listTasks: (limit?: number) => Promise<LongclawTask[]>
      getTask: (taskId: string) => Promise<LongclawTask>
    }
    longclawCapabilitySubstrate: {
      getSummary: () => Promise<LongclawCapabilitySubstrateSummary>
    }
    longclawWindow: {
      setLocale: (locale: LongclawLocale) => Promise<{ ok: boolean }>
    }
  }
}

function formatTime(value?: string | null): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isTextPreviewable(uri: string): boolean {
  return (
    (uri.startsWith('/') &&
      ['.json', '.md', '.txt', '.log'].some(ext => uri.endsWith(ext))) ||
    uri.endsWith('stdout.log')
  )
}

function severityRank(value: string): number {
  if (value === 'critical') return 0
  if (value === 'warning') return 1
  if (value === 'info') return 2
  return 3
}

function pageTitle(locale: LongclawLocale, page: Page, packTab: PackTab): string {
  if (page === 'home') return t(locale, 'page.home.title')
  if (page === 'runs') return t(locale, 'page.runs.title')
  if (page === 'work_items') return t(locale, 'page.work_items.title')
  if (page === 'studio') return t(locale, 'page.studio.title')
  return packTab === 'due_diligence'
    ? t(locale, 'page.packs.title.due_diligence')
    : t(locale, 'page.packs.title.signals')
}

function pageEyebrow(locale: LongclawLocale, page: Page): string {
  if (page === 'home') return t(locale, 'page.home.eyebrow')
  if (page === 'studio') return t(locale, 'page.studio.eyebrow')
  if (page === 'packs') return t(locale, 'page.packs.eyebrow')
  return t(locale, page === 'runs' ? 'page.runs.eyebrow' : 'page.work_items.eyebrow')
}

function pageDescription(locale: LongclawLocale, page: Page): string {
  if (page === 'home') return t(locale, 'page.home.description')
  if (page === 'runs') return t(locale, 'page.runs.description')
  if (page === 'work_items') return t(locale, 'page.work_items.description')
  if (page === 'studio') return t(locale, 'page.studio.description')
  return t(locale, 'page.packs.description')
}

function modeSpec(mode: WorkMode | string | undefined) {
  if (mode === 'local' || mode === 'cloud_sandbox' || mode === 'weclaw_dispatch') {
    return WORK_MODE_SPECS[mode]
  }
  return undefined
}

function humanizeWorkMode(locale: LongclawLocale, mode?: string | null): string {
  if (mode === 'local') return t(locale, 'mode.local.label')
  if (mode === 'cloud_sandbox') return t(locale, 'mode.cloud.label')
  if (mode === 'weclaw_dispatch') return t(locale, 'mode.weclaw.label')
  return humanizeTokenLocale(locale, mode ?? 'unknown')
}

function packLabel(locale: LongclawLocale, packId?: string | null): string {
  const normalized = String(packId ?? '').replace(/-/g, '_')
  if (normalized === 'due_diligence') return t(locale, 'pack.due_diligence')
  if (normalized === 'signals') return t(locale, 'pack.signals')
  return humanizeTokenLocale(locale, packId ?? 'unknown')
}

function localizePackNotice(locale: LongclawLocale, notice?: string | null): string | null {
  if (!notice?.trim()) return null
  const normalized = notice.trim().toLowerCase()
  if (normalized === 'fetch failed' || normalized === 'failed to fetch') {
    return t(locale, 'notice.pack_fetch_failed')
  }
  return notice.trim()
}

function readMetadataString(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!value) return undefined
  const record = value as Record<string, unknown>
  const direct = record[key]
  if (typeof direct === 'string' && direct.trim()) return direct
  const metadata = record.metadata
  if (metadata && typeof metadata === 'object') {
    const nested = (metadata as Record<string, unknown>)[key]
    if (typeof nested === 'string' && nested.trim()) return nested
  }
  return undefined
}

function readMetadataBoolean(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
  key: string,
): boolean | undefined {
  if (!value) return undefined
  const record = value as Record<string, unknown>
  const direct = record[key]
  if (typeof direct === 'boolean') return direct
  const metadata = record.metadata
  if (metadata && typeof metadata === 'object') {
    const nested = (metadata as Record<string, unknown>)[key]
    if (typeof nested === 'boolean') return nested
  }
  return undefined
}

function readMetadataRecord(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | undefined {
  if (!value) return undefined
  const record = value as Record<string, unknown>
  const direct = record[key]
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>
  }
  const metadata = record.metadata
  if (metadata && typeof metadata === 'object') {
    const nested = (metadata as Record<string, unknown>)[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }
  return undefined
}

function workModeFromTask(task: LongclawTask): string | undefined {
  return readMetadataString(task as unknown as Record<string, unknown>, 'work_mode')
}

function workModeFromRun(run: LongclawRun): string | undefined {
  return readMetadataString(run as unknown as Record<string, unknown>, 'work_mode')
}

function workModeFromWorkItem(item: LongclawWorkItem): string | undefined {
  return readMetadataString(item as unknown as Record<string, unknown>, 'work_mode')
}

function originSurfaceFromTask(task: LongclawTask): string | undefined {
  return (
    readMetadataString(task as unknown as Record<string, unknown>, 'origin_surface') ??
    readMetadataString(task as unknown as Record<string, unknown>, 'launch_surface')
  )
}

function originSurfaceFromRun(run: LongclawRun): string | undefined {
  return (
    readMetadataString(run as unknown as Record<string, unknown>, 'origin_surface') ??
    readMetadataString(run as unknown as Record<string, unknown>, 'launch_surface')
  )
}

function originSurfaceFromWorkItem(item: LongclawWorkItem): string | undefined {
  return (
    readMetadataString(item as unknown as Record<string, unknown>, 'origin_surface') ??
    readMetadataString(item as unknown as Record<string, unknown>, 'launch_surface')
  )
}

function executionPlaneFromTask(task: LongclawTask): string | undefined {
  return readMetadataString(task as unknown as Record<string, unknown>, 'execution_plane')
}

function executionPlaneFromRun(run: LongclawRun): string | undefined {
  return readMetadataString(run as unknown as Record<string, unknown>, 'execution_plane')
}

function executionPlaneFromWorkItem(item: LongclawWorkItem): string | undefined {
  return readMetadataString(item as unknown as Record<string, unknown>, 'execution_plane')
}

function workspaceTargetFromTask(task: LongclawTask): string | undefined {
  return readMetadataString(task as unknown as Record<string, unknown>, 'workspace_target')
}

function interactionSurfaceFromTask(task: LongclawTask): string | undefined {
  return readMetadataString(task as unknown as Record<string, unknown>, 'interaction_surface')
}

function interactionSurfaceFromRun(run: LongclawRun): string | undefined {
  return readMetadataString(run as unknown as Record<string, unknown>, 'interaction_surface')
}

function interactionSurfaceFromWorkItem(item: LongclawWorkItem): string | undefined {
  return readMetadataString(item as unknown as Record<string, unknown>, 'interaction_surface')
}

function runtimeProfileFromRecord(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
): string | undefined {
  return readMetadataString(value, 'runtime_profile')
}

function runtimeTargetFromRecord(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
): string | undefined {
  return readMetadataString(value, 'runtime_target')
}

function modelPlaneFromRecord(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
): string | undefined {
  return readMetadataString(value, 'model_plane')
}

function localRuntimeSeatFromRecord(
  value: { metadata?: Record<string, unknown> } | Record<string, unknown> | null | undefined,
): string | undefined {
  return readMetadataString(value, 'local_runtime_seat')
}

function runtimeStatusFromSummary(
  summary: LongclawCapabilitySubstrateSummary | null,
): RuntimeStatusSummary {
  const runtimeStatus = readMetadataRecord(summary ?? undefined, 'runtime_status') ?? {}
  return {
    longclawCoreConnected: Boolean(runtimeStatus.longclaw_core_connected),
    longclawCoreBaseUrl:
      typeof runtimeStatus.longclaw_core_base_url === 'string'
        ? runtimeStatus.longclaw_core_base_url
        : undefined,
    dueDiligenceConnected: Boolean(runtimeStatus.due_diligence_connected),
    dueDiligenceBaseUrl:
      typeof runtimeStatus.due_diligence_base_url === 'string'
        ? runtimeStatus.due_diligence_base_url
        : undefined,
    signalsAvailable: Boolean(runtimeStatus.signals_available),
    signalsStateRoot:
      typeof runtimeStatus.signals_state_root === 'string'
        ? runtimeStatus.signals_state_root
        : undefined,
    localRuntimeSeat:
      typeof runtimeStatus.local_runtime_seat === 'string'
        ? runtimeStatus.local_runtime_seat
        : undefined,
    localRuntimeAvailable: Boolean(runtimeStatus.local_runtime_available),
    localRuntimeApiUrl:
      typeof runtimeStatus.local_runtime_api_url === 'string'
        ? runtimeStatus.local_runtime_api_url
        : undefined,
    localRuntimeApiAvailable: Boolean(runtimeStatus.local_runtime_api_available),
    localAcpAvailable: Boolean(runtimeStatus.local_acp_available),
    localAcpScript:
      typeof runtimeStatus.local_acp_script === 'string'
        ? runtimeStatus.local_acp_script
        : undefined,
    localAcpSource:
      typeof runtimeStatus.local_acp_source === 'string'
        ? runtimeStatus.local_acp_source
        : undefined,
    stackEnvLoaded: Boolean(runtimeStatus.stack_env_loaded),
    stackEnvPath:
      typeof runtimeStatus.stack_env_path === 'string'
        ? runtimeStatus.stack_env_path
        : undefined,
  }
}

function workModeAvailabilityNotice(
  locale: LongclawLocale,
  workMode: WorkMode,
  runtimeStatus: RuntimeStatusSummary,
): string | undefined {
  if (workMode === 'local' && !runtimeStatus.localRuntimeAvailable) {
    return t(locale, 'notice.local_unavailable')
  }
  if (workMode === 'cloud_sandbox' && !runtimeStatus.longclawCoreConnected) {
    return t(locale, 'notice.cloud_unavailable')
  }
  if (workMode === 'weclaw_dispatch' && (!runtimeStatus.longclawCoreConnected || !runtimeStatus.localRuntimeAvailable)) {
    return t(locale, 'notice.weclaw_unavailable')
  }
  return undefined
}

function workModeAvailabilityState(
  locale: LongclawLocale,
  workMode: WorkMode,
  runtimeStatus: RuntimeStatusSummary,
  selected: boolean,
): { tone: string; label: string } {
  const unavailable = workModeAvailabilityNotice(locale, workMode, runtimeStatus)
  if (unavailable) {
    return {
      tone: 'degraded',
      label: workMode === 'local' ? t(locale, 'state.unavailable') : t(locale, 'state.degraded'),
    }
  }
  if (selected) {
    return { tone: 'running', label: t(locale, 'state.ready') }
  }
  return { tone: 'open', label: t(locale, 'state.visible') }
}

function preferredHomeWorkMode(runtimeStatus: RuntimeStatusSummary): WorkMode {
  if (runtimeStatus.localRuntimeAvailable) return 'local'
  if (runtimeStatus.longclawCoreConnected) return 'cloud_sandbox'
  return 'local'
}

function formatModeMeta(parts: Array<string | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part && part.trim()))
  return values.length > 0 ? values.join(' · ') : undefined
}

function withMention(previous: string, mention: string): string {
  if (previous.includes(mention)) return previous
  const normalized = previous.trim()
  return normalized ? `${normalized} ${mention} ` : `${mention} `
}

function summarizeAgentResult(result: unknown): string {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    if (typeof record.subtype === 'string') return humanizeToken(record.subtype)
    if (typeof record.ok === 'boolean') return record.ok ? 'Completed' : 'Needs Review'
  }
  return 'Completed'
}

function patchLaunchRecord(
  launches: LaunchRecord[],
  id: string | null,
  updater: (record: LaunchRecord) => LaunchRecord,
): LaunchRecord[] {
  if (!id) return launches
  return launches.map(record => (record.id === id ? updater(record) : record))
}

function launchStatus(value?: string | null): LaunchRecord['status'] {
  if (['queued', 'routing', 'running', 'blocked'].includes(String(value))) return 'running'
  if (['failed', 'canceled'].includes(String(value))) return 'failed'
  return 'succeeded'
}

function launchPromptFromTask(task: LongclawTask): string {
  const input = task.input as Record<string, unknown>
  return String(input.requested_outcome ?? input.query ?? input.raw_text ?? task.capability)
}

function launchRecordFromTask(task: LongclawTask): LaunchRecord {
  const metadata = task.metadata as Record<string, unknown>
  return {
    id: task.task_id,
    task_id: task.task_id,
    pack_id: typeof metadata.pack_id === 'string' ? metadata.pack_id : undefined,
    source: typeof metadata.launch_source === 'string' ? metadata.launch_source : undefined,
    prompt: launchPromptFromTask(task),
    status: launchStatus(task.status),
    started_at: task.created_at ?? task.updated_at ?? new Date().toISOString(),
    finished_at:
      launchStatus(task.status) === 'running'
        ? undefined
        : task.updated_at ?? task.created_at ?? undefined,
    text: '',
    tool_names: [],
    result_label: humanizeToken(String(metadata.last_run_status ?? task.status)),
    error: typeof metadata.error === 'string' ? metadata.error : undefined,
    work_mode: workModeFromTask(task),
    origin_surface: originSurfaceFromTask(task),
    interaction_surface: interactionSurfaceFromTask(task),
    runtime_profile: runtimeProfileFromRecord(task),
    runtime_target: runtimeTargetFromRecord(task),
    model_plane: modelPlaneFromRecord(task),
    local_runtime_seat: localRuntimeSeatFromRecord(task),
    execution_plane: executionPlaneFromTask(task),
    workspace_target: workspaceTargetFromTask(task),
  }
}

function launchRecordFromReceipt(receipt: LongclawLaunchReceipt): LaunchRecord {
  const taskMode = workModeFromTask(receipt.task)
  return {
    id: receipt.task.task_id,
    task_id: receipt.task.task_id,
    pack_id: receipt.pack_id,
    source:
      typeof receipt.metadata.launch_source === 'string'
        ? receipt.metadata.launch_source
        : typeof receipt.metadata.source === 'string'
          ? receipt.metadata.source
          : undefined,
    prompt: launchPromptFromTask(receipt.task),
    status: launchStatus(receipt.task.status),
    started_at: receipt.task.created_at ?? receipt.run.created_at ?? new Date().toISOString(),
    finished_at: receipt.run.finished_at ?? receipt.task.updated_at ?? undefined,
    text: receipt.run.summary ?? '',
    tool_names: [],
    result_label: humanizeToken(receipt.run.status),
    work_mode: taskMode ?? workModeFromRun(receipt.run),
    origin_surface: originSurfaceFromTask(receipt.task) ?? originSurfaceFromRun(receipt.run),
    interaction_surface:
      interactionSurfaceFromTask(receipt.task) ?? interactionSurfaceFromRun(receipt.run),
    runtime_profile:
      runtimeProfileFromRecord(receipt.task) ?? runtimeProfileFromRecord(receipt.run),
    runtime_target:
      runtimeTargetFromRecord(receipt.task) ?? runtimeTargetFromRecord(receipt.run),
    model_plane: modelPlaneFromRecord(receipt.task) ?? modelPlaneFromRecord(receipt.run),
    local_runtime_seat:
      localRuntimeSeatFromRecord(receipt.task) ?? localRuntimeSeatFromRecord(receipt.run),
    execution_plane:
      executionPlaneFromTask(receipt.task) ?? executionPlaneFromRun(receipt.run),
    workspace_target: workspaceTargetFromTask(receipt.task),
  }
}

function mergeLaunchRecords(
  localRecords: LaunchRecord[],
  taskRecords: LaunchRecord[],
): LaunchRecord[] {
  const merged = new Map<string, LaunchRecord>()
  for (const record of taskRecords) {
    merged.set(record.id, record)
  }
  for (const record of localRecords) {
    const existing = merged.get(record.id)
    merged.set(
      record.id,
      existing
        ? {
            ...existing,
            ...record,
            text: record.text || existing.text,
            tool_names:
              record.tool_names.length > 0 ? record.tool_names : existing.tool_names,
            result_label: record.result_label ?? existing.result_label,
            error: record.error ?? existing.error,
          }
        : record,
    )
  }
  return [...merged.values()].sort((left, right) =>
    String(right.started_at ?? '').localeCompare(String(left.started_at ?? '')),
  )
}

const LAUNCH_MENTION_RE = /(^|\s)@(pack|skill|plugin)\s+([^\s]+)/gi

function parseLaunchMentions(rawText: string): LongclawLaunchMention[] {
  const mentions: LongclawLaunchMention[] = []
  for (const match of rawText.matchAll(LAUNCH_MENTION_RE)) {
    mentions.push({
      kind: match[2].toLowerCase(),
      value: match[3],
      metadata: {},
    })
  }
  return mentions
}

function stripLaunchMentions(rawText: string): string {
  return rawText.replace(LAUNCH_MENTION_RE, ' ').replace(/\s+/g, ' ').trim()
}

function buildLaunchIntent(
  rawText: string,
  workspaceRoot: string,
  workMode: WorkMode,
): LongclawLaunchIntent {
  const mentions = parseLaunchMentions(rawText)
  const requestedOutcome = stripLaunchMentions(rawText)
  const firstPackMention = mentions.find(mention => mention.kind === 'pack')
  const firstPackId =
    firstPackMention && firstPackMention.value.includes('.')
      ? firstPackMention.value.split('.')[0]
      : firstPackMention?.value
  const spec = WORK_MODE_SPECS[workMode]
  const workspaceTarget =
    workMode === 'local'
      ? workspaceRoot || undefined
      : workMode === 'cloud_sandbox'
        ? 'sandbox://longclaw/default'
        : 'weclaw://active-thread'

  return {
    source: 'electron_cowork',
    raw_text: rawText,
    mentions,
    requested_outcome: requestedOutcome || rawText.trim(),
    created_at: new Date().toISOString(),
    interaction_surface: spec.interactionSurface,
    runtime_profile: 'dev_local_acp_bridge',
    runtime_target: spec.runtimeTarget,
    model_plane: spec.modelPlane,
    session_context: {
      channel: 'desktop',
      user_id: 'desktop_operator',
      canonical_id: 'user:desktop_operator',
      canonical_session_id: 'session:desktop_operator',
      workspace_root: workspaceRoot || undefined,
    },
    delivery_preference: {
      policy_id: 'desktop_cowork',
      preferred_channels: spec.preferredChannels,
      fallback_channels: spec.fallbackChannels,
      windowed_proactive: false,
      desktop_fallback: true,
      requires_approval: false,
      metadata: {
        work_mode: workMode,
      },
    },
    metadata: {
      work_mode: workMode,
      launch_surface: spec.interactionSurface,
      origin_surface: spec.interactionSurface,
      interaction_surface: spec.interactionSurface,
      runtime_profile: 'dev_local_acp_bridge',
      runtime_target: spec.runtimeTarget,
      model_plane: spec.modelPlane,
      workspace_root: workspaceRoot || undefined,
      workspace_target: workspaceTarget,
      execution_plane: spec.runtimeTarget === 'cloud_runtime' ? 'cloud_executor' : 'local_executor',
      pack_id: firstPackId,
    },
  } as LongclawLaunchIntent
}

function launchPreview(record: LaunchRecord | null): string {
  if (!record) return ''
  if (record.error) return record.error
  if (!record.text.trim()) {
    if (record.tool_names.length > 0) {
      return `Tools: ${record.tool_names.join(', ')}`
    }
    return record.status === 'running'
      ? 'Waiting for the selected work mode to stream output.'
      : 'Launch finished without a text preview.'
  }
  return record.text.trim().slice(-720)
}

function threadIdFromTask(task: LongclawTask): string {
  return (
    task.session_id ??
    `${interactionSurfaceFromTask(task) ?? originSurfaceFromTask(task) ?? task.channel ?? 'session'}:${workspaceTargetFromTask(task) ?? task.capability}`
  )
}

function threadIdFromLaunch(record: LaunchRecord, taskMap: Map<string, LongclawTask>): string {
  if (record.task_id) {
    const task = taskMap.get(record.task_id)
    if (task) return threadIdFromTask(task)
  }
  return `${record.interaction_surface ?? record.origin_surface ?? record.source ?? 'session'}:${record.workspace_target ?? record.pack_id ?? record.id}`
}

function sortByTimestamp<T extends { latestAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = left.latestAt ? new Date(left.latestAt).getTime() : 0
    const rightValue = right.latestAt ? new Date(right.latestAt).getTime() : 0
    return rightValue - leftValue
  })
}

function deriveThreadSummaries(
  locale: LongclawLocale,
  launches: LaunchRecord[],
  tasks: LongclawTask[],
): ThreadSummary[] {
  const taskMap = new Map(tasks.map(task => [task.task_id, task]))
  const grouped = new Map<
    string,
    {
      task?: LongclawTask
      launches: LaunchRecord[]
      latestAt?: string
      status: string
    }
  >()

  for (const task of tasks) {
    const id = threadIdFromTask(task)
    grouped.set(id, {
      task,
      launches: [],
      latestAt: task.updated_at ?? task.created_at ?? undefined,
      status: task.status,
    })
  }

  for (const launch of launches) {
    const id = threadIdFromLaunch(launch, taskMap)
    const bucket = grouped.get(id) ?? {
      launches: [],
      latestAt: launch.finished_at ?? launch.started_at,
      status: launch.status,
    }
    bucket.launches.push(launch)
    const launchTime = launch.finished_at ?? launch.started_at
    if (!bucket.latestAt || new Date(launchTime).getTime() >= new Date(bucket.latestAt).getTime()) {
      bucket.latestAt = launchTime
      bucket.status = launch.status
    }
    grouped.set(id, bucket)
  }

  return sortByTimestamp(
    [...grouped.entries()].map(([id, bucket]) => {
      const leadLaunch = bucket.launches[0]
      const leadTask = bucket.task
      const prompt =
        leadLaunch?.prompt ||
        stringValue(leadTask?.input.requested_outcome) ||
        stringValue(leadTask?.input.raw_text) ||
        undefined
      const title =
        prompt?.trim().slice(0, 52) ||
        (leadTask
          ? `${humanizeWorkMode(locale, workModeFromTask(leadTask) ?? 'cloud_sandbox')} · ${humanizeTokenLocale(locale, leadTask.capability)}`
          : humanizeTokenLocale(locale, leadLaunch?.pack_id ?? 'launch'))
      const workMode = leadLaunch?.work_mode ?? workModeFromTask(leadTask ?? ({} as LongclawTask))
      return {
        id,
        title,
        subtitle: formatModeMeta([
          workMode ? humanizeWorkMode(locale, workMode) : undefined,
          leadLaunch?.runtime_target
            ? humanizeTokenLocale(locale, leadLaunch.runtime_target)
            : leadTask && runtimeTargetFromRecord(leadTask)
              ? humanizeTokenLocale(locale, runtimeTargetFromRecord(leadTask))
              : undefined,
          leadLaunch?.interaction_surface
            ? humanizeTokenLocale(locale, leadLaunch.interaction_surface)
            : leadTask && interactionSurfaceFromTask(leadTask)
              ? humanizeTokenLocale(locale, interactionSurfaceFromTask(leadTask))
              : undefined,
        ]),
        latestAt: bucket.latestAt,
        status: bucket.status,
        workMode,
        sessionId: leadTask?.session_id ?? undefined,
        workspaceTarget:
          leadLaunch?.workspace_target ?? (leadTask ? workspaceTargetFromTask(leadTask) : undefined),
        localRuntimeSeat:
          leadLaunch?.local_runtime_seat ??
          (leadTask ? localRuntimeSeatFromRecord(leadTask) : undefined),
        itemCount: bucket.launches.length + (leadTask ? 1 : 0),
      }
    }),
  )
}

function deriveConversationEvents(
  locale: LongclawLocale,
  threadId: string | null,
  threads: ThreadSummary[],
  launches: LaunchRecord[],
  tasks: LongclawTask[],
  runs: LongclawRun[],
  workItems: LongclawWorkItem[],
): ConversationEvent[] {
  if (!threadId) return []
  const taskMap = new Map(tasks.map(task => [task.task_id, task]))
  const runMap = new Map(runs.map(run => [run.run_id, run]))

  const threadTaskIds = tasks.filter(task => threadIdFromTask(task) === threadId).map(task => task.task_id)
  const taskIdSet = new Set(threadTaskIds)
  const launchesInThread = launches.filter(record => threadIdFromLaunch(record, taskMap) === threadId)
  for (const launch of launchesInThread) {
    if (launch.task_id) taskIdSet.add(launch.task_id)
  }

  const tasksInThread = tasks.filter(task => taskIdSet.has(task.task_id))
  const runIdSet = new Set<string>()
  for (const task of tasksInThread) {
    task.run_ids.forEach(runId => runIdSet.add(runId))
    if (task.last_run_id) runIdSet.add(task.last_run_id)
  }
  const runsInThread = runs.filter(run => (run.task_id ? taskIdSet.has(run.task_id) : runIdSet.has(run.run_id)))
  runsInThread.forEach(run => runIdSet.add(run.run_id))
  const workItemsInThread = workItems.filter(item => (item.run_id ? runIdSet.has(item.run_id) : false))

  const events: ConversationEvent[] = []

  for (const launch of launchesInThread) {
    const spec = workModeSpecFromValue(locale, launch.work_mode)
    events.push({
      id: `launch:${launch.id}`,
      type: 'user_launch',
      timestamp: launch.started_at,
      status: launch.status,
      title: launch.prompt,
      body: launch.text?.trim() ? launch.text.trim().slice(-240) : undefined,
      meta: formatModeMeta([
        spec?.label,
        launch.runtime_target ? humanizeTokenLocale(locale, launch.runtime_target) : undefined,
        launch.local_runtime_seat
          ? humanizeTokenLocale(locale, launch.local_runtime_seat)
          : undefined,
      ]),
      workMode: launch.work_mode,
      runtimeProfile: launch.runtime_profile,
      runtimeTarget: launch.runtime_target,
      interactionSurface: launch.interaction_surface,
      localRuntimeSeat: launch.local_runtime_seat,
      launch,
    })
  }

  for (const task of tasksInThread) {
    const workMode = workModeFromTask(task)
    const spec = workMode ? localizedWorkModeSpec(locale, workMode as WorkMode) : null
    events.push({
      id: `task:${task.task_id}`,
      type: 'task_receipt',
      timestamp: task.updated_at ?? task.created_at ?? new Date().toISOString(),
      status: task.status,
      title: spec ? `${spec.label} receipt` : `Task ${task.task_id}`,
      body:
        stringValue(task.input.requested_outcome) ||
        stringValue(task.input.raw_text) ||
        humanizeTokenLocale(locale, task.capability),
      meta: formatModeMeta([
        humanizeTokenLocale(locale, task.capability),
        runtimeTargetFromRecord(task)
          ? humanizeTokenLocale(locale, runtimeTargetFromRecord(task))
          : undefined,
        localRuntimeSeatFromRecord(task)
          ? humanizeTokenLocale(locale, localRuntimeSeatFromRecord(task))
          : undefined,
      ]),
      workMode,
      runtimeProfile: runtimeProfileFromRecord(task),
      runtimeTarget: runtimeTargetFromRecord(task),
      interactionSurface: interactionSurfaceFromTask(task),
      localRuntimeSeat: localRuntimeSeatFromRecord(task),
      task,
    })
  }

  for (const run of runsInThread) {
    events.push({
      id: `run:${run.run_id}`,
      type: 'run_receipt',
      timestamp: run.started_at ?? run.created_at,
      status: run.status,
      title: run.summary || `Run ${run.run_id}`,
      body: humanizeTokenLocale(locale, run.capability),
      meta: formatModeMeta([
        humanizeTokenLocale(locale, run.pack_id ?? run.domain),
        runtimeTargetFromRecord(run)
          ? humanizeTokenLocale(locale, runtimeTargetFromRecord(run))
          : undefined,
        localRuntimeSeatFromRecord(run)
          ? humanizeTokenLocale(locale, localRuntimeSeatFromRecord(run))
          : undefined,
      ]),
      workMode: workModeFromRun(run),
      runtimeProfile: runtimeProfileFromRecord(run),
      runtimeTarget: runtimeTargetFromRecord(run),
      interactionSurface: interactionSurfaceFromRun(run),
      localRuntimeSeat: localRuntimeSeatFromRecord(run),
      run,
    })
  }

  for (const item of workItemsInThread) {
    events.push({
      id: `work-item:${item.work_item_id}`,
      type: 'work_item_receipt',
      timestamp: item.updated_at ?? item.created_at,
      status: item.severity,
      title: item.title,
      body: item.summary,
      meta: formatModeMeta([
        humanizeTokenLocale(locale, item.pack_id),
        runtimeTargetFromRecord(item)
          ? humanizeTokenLocale(locale, runtimeTargetFromRecord(item))
          : undefined,
        localRuntimeSeatFromRecord(item)
          ? humanizeTokenLocale(locale, localRuntimeSeatFromRecord(item))
          : undefined,
      ]),
      workMode: workModeFromWorkItem(item),
      runtimeProfile: runtimeProfileFromRecord(item),
      runtimeTarget: runtimeTargetFromRecord(item),
      interactionSurface: interactionSurfaceFromWorkItem(item),
      localRuntimeSeat: localRuntimeSeatFromRecord(item),
      workItem: item,
    })
  }

  return [...events].sort((left, right) => {
    const leftValue = new Date(left.timestamp).getTime()
    const rightValue = new Date(right.timestamp).getTime()
    return leftValue - rightValue
  })
}

function QueueRow({
  locale,
  title,
  meta,
  status,
  description,
  nextAction,
  onSelect,
}: {
  locale: LongclawLocale
  title: string
  meta?: string
  status?: string
  description?: string
  nextAction?: string
  onSelect: () => void
}) {
  return (
    <button type="button" style={queueRowButtonStyle} onClick={onSelect}>
      <div style={queueRowLeadStyle}>
        <div style={queueRowTitleStyle}>{title}</div>
        {meta && <div style={chromeStyles.quietMeta}>{meta}</div>}
        {description && <div style={queueRowDescriptionStyle}>{description}</div>}
      </div>
      <div style={queueRowTailStyle}>
        {nextAction && <div style={queueRowNextActionStyle}>{nextAction}</div>}
        {status && (
          <span style={statusBadgeStyle(status)}>{humanizeTokenLocale(locale, status)}</span>
        )}
      </div>
    </button>
  )
}

function StatusStrip({
  locale,
  items,
}: {
  locale: LongclawLocale
  items: Array<{ label: string; value: number; tone?: string }>
}) {
  return (
    <div style={surfaceStyles.strip}>
      {items.map(item => {
        const toneLabel = item.tone ? humanizeTokenLocale(locale, item.tone) : undefined
        const showToneBadge =
          Boolean(toneLabel) && toneLabel.toLowerCase() !== item.label.trim().toLowerCase()
        return (
          <div key={item.label} style={surfaceStyles.stripItem}>
            <div style={statusStripValueStyle}>{item.value}</div>
            <div style={statusStripLabelRowStyle}>
              <span>{item.label}</span>
              {item.tone && showToneBadge && (
                <span style={statusBadgeStyle(item.tone)}>{toneLabel}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section style={surfaceStyles.section}>
      <div style={sectionHeaderStyle}>
        <div style={sectionHeadingBlockStyle}>
          <h2 style={chromeStyles.sectionTitle}>{title}</h2>
          {subtitle && <div style={chromeStyles.subtleText}>{subtitle}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function ActionButtons({
  actions,
  onRun,
}: {
  actions: LongclawOperatorAction[]
  onRun: (action: LongclawOperatorAction) => Promise<void>
}) {
  if (actions.length === 0) return null
  return (
    <div style={utilityStyles.buttonCluster}>
      {actions.map(action => (
        <button
          key={action.action_id}
          type="button"
          style={secondaryButtonStyle}
          onClick={() => {
            void onRun(action)
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function ArtifactList({
  locale,
  artifacts,
  onOpen,
  onPreview,
}: {
  locale: LongclawLocale
  artifacts: LongclawArtifact[]
  onOpen: (uri: string) => Promise<void>
  onPreview: (uri: string) => Promise<void>
}) {
  if (artifacts.length === 0) {
    return <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_artifacts')}</div>
  }

  return (
    <div style={utilityStyles.stackedList}>
      {artifacts.map(artifact => (
        <div key={artifact.artifact_id} style={surfaceStyles.listRow}>
          <div style={queueRowLeadStyle}>
            <div style={queueRowTitleStyle}>
              {artifact.title || humanizeTokenLocale(locale, artifact.kind)}
            </div>
            <div style={chromeStyles.monoMeta}>{artifact.uri}</div>
          </div>
          <div style={utilityStyles.buttonCluster}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                void onOpen(artifact.uri)
              }}
            >
              {t(locale, 'action.open')}
            </button>
            {isTextPreviewable(artifact.uri) && (
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  void onPreview(artifact.uri)
                }}
              >
                {t(locale, 'action.preview')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ArtifactRefList({
  locale,
  items,
  onOpen,
  onPreview,
}: {
  locale: LongclawLocale
  items: Array<{ kind: string; uri: string; title: string }>
  onOpen: (uri: string) => Promise<void>
  onPreview: (uri: string) => Promise<void>
}) {
  if (items.length === 0) return null
  return (
    <div style={utilityStyles.stackedList}>
      {items.map(item => (
        <div key={`${item.kind}-${item.uri}`} style={surfaceStyles.listRow}>
          <div style={queueRowLeadStyle}>
            <div style={queueRowTitleStyle}>{item.title}</div>
            <div style={chromeStyles.monoMeta}>{item.uri}</div>
          </div>
          <div style={utilityStyles.buttonCluster}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                void onOpen(item.uri)
              }}
            >
              {t(locale, 'action.open')}
            </button>
            {isTextPreviewable(item.uri) && (
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  void onPreview(item.uri)
                }}
              >
                {t(locale, 'action.preview')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CapabilityChip({
  item,
  onUse,
}: {
  item: CapabilityItem
  onUse: (item: CapabilityItem) => void
}) {
  return (
    <button
      type="button"
      style={capabilityChipStyle(item.kind)}
      onClick={() => onUse(item)}
      title={item.description}
    >
      <div style={capabilityChipBodyStyle}>
        <div style={capabilityChipLabelStyle}>{item.label}</div>
        <div style={capabilityChipHintStyle}>{item.hint}</div>
      </div>
      <span style={statusBadgeStyle(item.kind === 'pack' ? 'running' : 'open')}>
        {item.kind === 'pack' ? '@pack' : item.kind === 'plugin' ? '@plugin' : '@skill'}
      </span>
    </button>
  )
}

function PackListSection({
  locale,
  title,
  subtitle,
  rows,
  onOpen,
}: {
  locale: LongclawLocale
  title: string
  subtitle?: string
  rows: Array<Record<string, unknown>>
  onOpen: (item: Record<string, unknown>) => void
}) {
  return (
    <Section title={title} subtitle={subtitle}>
      <div style={utilityStyles.stackedList}>
        {rows.length === 0 ? (
          <div style={utilityStyles.emptyState}>{t(locale, 'empty.nothing_waiting')}</div>
        ) : (
          rows.map((row, index) => {
            const key = String(
              row.run_id ??
                row.review_id ??
                row.case_id ??
                row.site_slug ??
                row.connector_id ??
                index,
            )
            const titleValue = String(
              row.summary ??
                row.title ??
                row.run_id ??
                row.review_id ??
                row.case_id ??
                row.site_slug ??
                row.connector_id ??
                key,
            )
            const meta = String(
              row.lane ??
                row.capability ??
                row.failure_fingerprint ??
                row.summary ??
                row.channel ??
                '',
            ).trim()
            const status = String(row.status ?? row.recommended_action ?? '')
            return (
              <QueueRow
                key={key}
                locale={locale}
                title={titleValue}
                meta={meta || undefined}
                status={status || undefined}
                onSelect={() => onOpen(row)}
              />
            )
          })
        )}
      </div>
    </Section>
  )
}

function DueDiligencePackView({
  locale,
  dashboard,
  onOpenRun,
  onOpenRecord,
}: {
  locale: LongclawLocale
  dashboard: DueDiligenceDashboard
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (
    title: string,
    record: Record<string, unknown>,
    actions?: LongclawOperatorAction[],
  ) => void
}) {
  return (
    <div style={packGridStyle}>
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.due.recent_runs.title')}
        subtitle={t(locale, 'section.pack.due.recent_runs.subtitle')}
        rows={dashboard.recent_runs}
        onOpen={run => {
          void onOpenRun(run as LongclawRun)
        }}
      />
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.due.manual_review.title')}
        subtitle={t(locale, 'section.pack.due.manual_review.subtitle')}
        rows={dashboard.manual_review_queue}
        onOpen={item =>
          onOpenRecord(
            `Review ${String(item.site_slug ?? item.review_id ?? 'record')}`,
            item,
            Array.isArray(item.operator_actions)
              ? (item.operator_actions as LongclawOperatorAction[])
              : [],
          )
        }
      />
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.due.repair_cases.title')}
        subtitle={t(locale, 'section.pack.due.repair_cases.subtitle')}
        rows={dashboard.repair_cases}
        onOpen={item =>
          onOpenRecord(
            `Repair ${String(item.site_slug ?? item.case_id ?? 'record')}`,
            item,
            Array.isArray(item.operator_actions)
              ? (item.operator_actions as LongclawOperatorAction[])
              : [],
          )
        }
      />
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.due.site_health.title')}
        subtitle={t(locale, 'section.pack.due.site_health.subtitle')}
        rows={dashboard.site_health}
        onOpen={item =>
          onOpenRecord(
            `Site ${String(item.site_slug ?? 'record')}`,
            item,
            Array.isArray(item.operator_actions)
              ? (item.operator_actions as LongclawOperatorAction[])
              : [],
          )
        }
      />
    </div>
  )
}

function SignalsPackView({
  locale,
  dashboard,
  onOpenRun,
  onOpenRecord,
}: {
  locale: LongclawLocale
  dashboard: SignalsDashboard
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (
    title: string,
    record: Record<string, unknown>,
    actions?: LongclawOperatorAction[],
  ) => void
}) {
  return (
    <div style={packGridStyle}>
      <Section
        title={t(locale, 'section.pack.signals.backtest_backlog.title')}
        subtitle={t(locale, 'section.pack.signals.backtest_backlog.subtitle')}
      >
        <StatusStrip
          locale={locale}
          items={[
            { label: t(locale, 'label.total'), value: dashboard.backtest_summary.total },
            {
              label: t(locale, 'label.evaluated'),
              value: dashboard.backtest_summary.evaluated,
              tone: 'success',
            },
            {
              label: t(locale, 'label.pending'),
              value: dashboard.backtest_summary.pending,
              tone: 'needs_review',
            },
          ]}
        />
        <div style={{ ...utilityStyles.stackedList, marginTop: 12 }}>
          {dashboard.pending_backlog_preview.length === 0 ? (
            <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_backlog')}</div>
          ) : (
            dashboard.pending_backlog_preview.map(item => (
              <div
                key={`${item.symbol}-${item.signal_date}-${item.signal_type}`}
                style={surfaceStyles.listRow}
              >
                <div style={queueRowLeadStyle}>
                  <div style={queueRowTitleStyle}>{item.symbol}</div>
                  <div style={chromeStyles.quietMeta}>
                    {item.signal_type} · {item.freq}
                  </div>
                </div>
                <div style={chromeStyles.monoMeta}>{item.signal_date}</div>
              </div>
            ))
          )}
        </div>
      </Section>

      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.signals.recent_runs.title')}
        subtitle={t(locale, 'section.pack.signals.recent_runs.subtitle')}
        rows={dashboard.recent_runs}
        onOpen={run => {
          void onOpenRun(run as LongclawRun)
        }}
      />
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.signals.review_runs.title')}
        subtitle={t(locale, 'section.pack.signals.review_runs.subtitle')}
        rows={dashboard.review_runs}
        onOpen={run => {
          void onOpenRun(run as LongclawRun)
        }}
      />
      <PackListSection
        locale={locale}
        title={t(locale, 'section.pack.signals.connector_health.title')}
        subtitle={t(locale, 'section.pack.signals.connector_health.subtitle')}
        rows={dashboard.connector_health}
        onOpen={item => onOpenRecord(`Connector ${String(item.connector_id ?? 'record')}`, item)}
      />
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [packTab, setPackTab] = useState<PackTab>('due_diligence')
  const [overview, setOverview] = useState<LongclawControlPlaneOverview | null>(null)
  const [runs, setRuns] = useState<LongclawRun[]>([])
  const [workItems, setWorkItems] = useState<LongclawWorkItem[]>([])
  const [dashboard, setDashboard] = useState<LongclawPackDashboard | null>(null)
  const [selected, setSelected] = useState<DetailTarget | null>(null)
  const [selectedArtifacts, setSelectedArtifacts] = useState<LongclawArtifact[]>([])
  const [preview, setPreview] = useState<{ uri: string; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [runFilter, setRunFilter] = useState('all')
  const [workItemFilter, setWorkItemFilter] = useState('all')
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const [threadSidebarOpen, setThreadSidebarOpen] = useState(() => window.innerWidth >= 1080)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [agentMode, setAgentMode] = useState<AgentModeInfo | null>(null)
  const [agentCwd, setAgentCwd] = useState('')
  const [substrateSummary, setSubstrateSummary] =
    useState<LongclawCapabilitySubstrateSummary | null>(null)
  const [launchTasks, setLaunchTasks] = useState<LongclawTask[]>([])
  const [locale, setLocale] = useState<LongclawLocale>(() => {
    try {
      return window.localStorage.getItem('longclaw.locale') === 'en-US' ? 'en-US' : 'zh-CN'
    } catch {
      return 'zh-CN'
    }
  })
  const [selectedWorkMode, setSelectedWorkMode] = useState<WorkMode>('local')
  const [launchInput, setLaunchInput] = useState('')
  const [launchBusy, setLaunchBusy] = useState(false)
  const [launches, setLaunches] = useState<LaunchRecord[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const activeLaunchIdRef = useRef<string | null>(null)
  const workModeTouchedRef = useRef(false)

  const viewportTier = getViewportTier(viewportWidth)
  const shellLayout = useMemo(
    () => createShellLayout(viewportWidth, viewportTier, threadSidebarOpen, Boolean(selected)),
    [selected, threadSidebarOpen, viewportTier, viewportWidth],
  )
  const runtimeStatus = useMemo(
    () => runtimeStatusFromSummary(substrateSummary),
    [substrateSummary],
  )
  const localizedDashboardNotice = useMemo(
    () => localizePackNotice(locale, dashboard?.notice),
    [dashboard?.notice, locale],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem('longclaw.locale', locale)
    } catch {
      // ignore storage failures in constrained environments
    }
    if (window.longclawWindow) {
      void window.longclawWindow.setLocale(locale)
    }
  }, [locale])

  useEffect(() => {
    if (workModeTouchedRef.current) return
    const preferredMode = preferredHomeWorkMode(runtimeStatus)
    if (preferredMode !== selectedWorkMode) {
      setSelectedWorkMode(preferredMode)
    }
  }, [
    runtimeStatus.localRuntimeAvailable,
    runtimeStatus.longclawCoreConnected,
    selectedWorkMode,
  ])

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await window.longclawControlPlane.getOverview())
    } catch {
      setOverview(null)
      throw new Error(t(locale, 'error.overview_unavailable'))
    }
  }, [locale])

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await window.longclawControlPlane.listRuns())
    } catch {
      setRuns([])
      throw new Error(t(locale, 'error.runs_unavailable'))
    }
  }, [locale])

  const loadWorkItems = useCallback(async () => {
    try {
      setWorkItems(await window.longclawControlPlane.listWorkItems())
    } catch {
      setWorkItems([])
      throw new Error(t(locale, 'error.work_items_unavailable'))
    }
  }, [locale])

  const loadDashboard = useCallback(async (targetPack: PackTab) => {
    try {
      setDashboard(await window.longclawControlPlane.getPackDashboard(targetPack))
    } catch {
      setDashboard(null)
      throw new Error(
        tf(locale, 'error.pack_dashboard_unavailable', {
          pack: humanizeTokenLocale(locale, targetPack),
        }),
      )
    }
  }, [locale])

  const loadLaunchTasks = useCallback(async () => {
    try {
      setLaunchTasks(await window.longclawLaunch.listTasks(8))
    } catch {
      setLaunchTasks([])
      throw new Error(t(locale, 'error.launch_history_unavailable'))
    }
  }, [locale])

  const loadCapabilitySubstrate = useCallback(async () => {
    const [summaryResult, modeResult, cwdResult, skillsResult] = await Promise.allSettled([
      window.longclawCapabilitySubstrate.getSummary(),
      window.agentAPI.getMode(),
      window.agentAPI.getCwd(),
      window.agentAPI.getSkills(),
    ])

    if (summaryResult.status === 'fulfilled') {
      setSubstrateSummary(summaryResult.value)
      setSkills(
        summaryResult.value.skills.map(skill => ({
          name: skill.label,
          path: String(skill.metadata.path ?? ''),
          description: skill.description,
          project:
            typeof skill.metadata.project === 'string' ? skill.metadata.project : undefined,
        })),
      )
    } else {
      setSubstrateSummary(null)
      if (skillsResult.status === 'fulfilled') setSkills(skillsResult.value)
    }
    if (modeResult.status === 'fulfilled') setAgentMode(modeResult.value)
    else if (summaryResult.status === 'fulfilled') {
      const mode = summaryResult.value.metadata.agent_mode
      if (typeof mode === 'string' && mode) {
        setAgentMode({ mode, alive: false })
      }
    }
    if (cwdResult.status === 'fulfilled') setAgentCwd(cwdResult.value)
    else if (summaryResult.status === 'fulfilled') {
      const cwd = summaryResult.value.metadata.cwd
      if (typeof cwd === 'string') setAgentCwd(cwd)
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (viewportTier !== 'narrow') {
      setThreadSidebarOpen(true)
    }
  }, [viewportTier])

  useEffect(() => {
    if (!selected) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  useEffect(() => {
    const releaseText = window.agentAPI.onText(text => {
      setLaunches(previous =>
        patchLaunchRecord(previous, activeLaunchIdRef.current, record => ({
          ...record,
          text: record.text + text,
        })),
      )
    })
    const releaseTool = window.agentAPI.onTool(tool => {
      setLaunches(previous =>
        patchLaunchRecord(previous, activeLaunchIdRef.current, record => ({
          ...record,
          tool_names: record.tool_names.includes(tool.name)
            ? record.tool_names
            : [...record.tool_names, tool.name],
        })),
      )
    })
    const releaseResult = window.agentAPI.onResult(result => {
      const activeId = activeLaunchIdRef.current
      activeLaunchIdRef.current = null
      setLaunchBusy(false)
      setLaunches(previous =>
        patchLaunchRecord(previous, activeId, record => ({
          ...record,
          status: record.status === 'failed' ? 'failed' : 'succeeded',
          finished_at: new Date().toISOString(),
          result_label: summarizeAgentResult(result),
        })),
      )
      void loadCapabilitySubstrate()
    })
    const releaseError = window.agentAPI.onError(message => {
      const activeId = activeLaunchIdRef.current
      activeLaunchIdRef.current = null
      setLaunchBusy(false)
      setError(message)
      setLaunches(previous =>
        patchLaunchRecord(previous, activeId, record => ({
          ...record,
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: message,
        })),
      )
      void loadCapabilitySubstrate()
    })

    return () => {
      releaseText()
      releaseTool()
      releaseResult()
      releaseError()
    }
  }, [loadCapabilitySubstrate])

  const refresh = useCallback(
    async (targetPage: Page = page, targetPack: PackTab = packTab) => {
      setLoading(true)
      setError(null)
      if (targetPage === 'home') {
        await Promise.allSettled([
          loadOverview(),
          loadRuns(),
          loadWorkItems(),
          loadLaunchTasks(),
          loadCapabilitySubstrate(),
        ])
      }
      if (targetPage === 'runs') {
        await Promise.allSettled([loadRuns(), loadCapabilitySubstrate()])
      }
      if (targetPage === 'work_items') {
        await Promise.allSettled([loadWorkItems(), loadCapabilitySubstrate()])
      }
      if (targetPage === 'packs') {
        await Promise.allSettled([loadDashboard(targetPack), loadCapabilitySubstrate()])
      }
      if (targetPage === 'studio') {
        await Promise.allSettled([loadOverview(), loadLaunchTasks(), loadCapabilitySubstrate()])
      }
      setLoading(false)
    },
    [
      loadCapabilitySubstrate,
      loadDashboard,
      loadLaunchTasks,
      loadOverview,
      loadRuns,
      loadWorkItems,
      page,
      packTab,
    ],
  )

  useEffect(() => {
    void refresh(page, packTab)
  }, [page, packTab, refresh])

  useEffect(() => {
    const intervalMs = page === 'home' || page === 'work_items' ? 10_000 : 15_000
    const timer = window.setInterval(() => {
      void refresh(page, packTab)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [page, packTab, refresh])

  const openRun = useCallback(async (run: LongclawRun) => {
    setSelected({
      type: 'run',
      title: run.summary || run.run_id,
      run,
      actions: [],
    })
    setPreview(null)
    try {
      setSelectedArtifacts(await window.longclawControlPlane.listArtifacts(run.run_id, run.domain))
    } catch {
      setSelectedArtifacts([])
    }
  }, [])

  const openWorkItem = useCallback((workItem: LongclawWorkItem) => {
    setSelected({
      type: 'work_item',
      title: workItem.title,
      workItem,
    })
    setSelectedArtifacts([])
    setPreview(null)
  }, [])

  const openRecord = useCallback(
    (
      title: string,
      record: Record<string, unknown>,
      actions: LongclawOperatorAction[] = [],
    ) => {
      setSelected({ type: 'record', title, record, actions })
      setSelectedArtifacts([])
      setPreview(null)
    },
    [],
  )

  const runAction = useCallback(
    async (action: LongclawOperatorAction) => {
      setActionMessage(null)
      try {
        if (['open_path', 'open_url', 'copy_value'].includes(action.kind)) {
          await window.longclawControlPlane.performLocalAction(action)
          setActionMessage(`${action.label} completed`)
          return
        }
        if (!runtimeStatus.longclawCoreConnected) {
          setActionMessage(
            'This action needs Longclaw Core connectivity. The client is currently running in degraded mode.',
          )
          return
        }
        const result = await window.longclawControlPlane.executeAction(
          action.action_id,
          action.payload,
        )
        setActionMessage(`${action.label} completed`)
        if (result?.result && typeof result.result === 'object' && 'run' in result.result) {
          const runResult = result.result as { run?: LongclawRun }
          if (runResult.run) {
            await openRun(runResult.run)
          }
        }
        await refresh(page, packTab)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [openRun, page, packTab, refresh, runtimeStatus.longclawCoreConnected],
  )

  const openArtifact = useCallback(async (uri: string) => {
    const kind =
      uri.startsWith('http://') || uri.startsWith('https://')
        ? 'open_url'
        : uri.startsWith('/')
          ? 'open_path'
          : 'copy_value'
    const payload =
      kind === 'open_url'
        ? { url: uri }
        : kind === 'open_path'
          ? { path: uri }
          : { value: uri }
    await window.longclawControlPlane.performLocalAction({ kind, payload })
  }, [])

  const previewArtifact = useCallback(async (uri: string) => {
    const result = await window.longclawControlPlane.readArtifactPreview(uri)
    if (result.ok && result.text) {
      setPreview({ uri, text: result.text })
    } else if (result.reason === 'too_large') {
      setError(`Preview skipped: file exceeds 256KB (${result.size ?? 0} bytes)`)
    } else {
      setError('Preview unavailable for this artifact')
    }
  }, [])

  const filteredRuns = useMemo(
    () => (runFilter === 'all' ? runs : runs.filter(run => run.status === runFilter)),
    [runFilter, runs],
  )

  const filteredWorkItems = useMemo(
    () =>
      workItemFilter === 'all'
        ? workItems
        : workItems.filter(item => item.severity === workItemFilter),
    [workItemFilter, workItems],
  )

  const priorityWorkItems = useMemo(
    () =>
      [...workItems]
        .filter(item => ['critical', 'warning'].includes(item.severity))
        .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
        .slice(0, 6),
    [workItems],
  )

  const packCapabilities = useMemo<CapabilityItem[]>(
    () =>
      (substrateSummary?.flagship_packs ?? overview?.packs ?? []).map(pack => ({
        id: `pack:${pack.pack_id}`,
        label: packLabel(locale, pack.pack_id),
        kind: 'pack',
        mention: `@pack ${pack.pack_id}`,
        hint: humanizeTokenLocale(locale, pack.runtime),
        description: pack.description,
      })),
    [locale, overview, substrateSummary],
  )

  const skillCapabilities = useMemo<CapabilityItem[]>(
    () =>
      substrateSummary
        ? substrateSummary.skills.slice(0, 8).map(skill => ({
            id: skill.capability_id,
            label: skill.label,
            kind: 'skill',
            mention: skill.mention,
            hint:
              skill.summary || (skill.owner ? humanizeToken(skill.owner) : 'Workspace skill'),
            description: skill.description,
          }))
        : skills.slice(0, 8).map(skill => ({
            id: `skill:${skill.project ?? 'workspace'}:${skill.name}`,
            label: skill.name,
            kind: 'skill',
            mention: `@skill ${skill.name}`,
            hint: skill.project ? humanizeToken(skill.project) : 'Workspace skill',
            description: skill.description,
          })),
    [skills, substrateSummary],
  )

  const pluginCapabilities = useMemo<CapabilityItem[]>(
    () =>
      (substrateSummary?.plugins ?? []).slice(0, 4).map(plugin => ({
        id: plugin.capability_id,
        label: plugin.label,
        kind: 'plugin',
        mention: plugin.mention,
        hint: plugin.summary || 'Capability plugin',
        description: plugin.description,
      })),
    [substrateSummary],
  )

  const modeAwareCapabilities = useMemo(() => {
    const localPreferred = [...skillCapabilities, ...pluginCapabilities, ...packCapabilities].slice(
      0,
      6,
    )
    const cloudPreferred = [...packCapabilities, ...pluginCapabilities, ...skillCapabilities].slice(
      0,
      6,
    )
    const weclawPreferred = [...packCapabilities, ...skillCapabilities, ...pluginCapabilities].slice(
      0,
      6,
    )
    return {
      local: localPreferred,
      cloud_sandbox: cloudPreferred,
      weclaw_dispatch: weclawPreferred,
    } satisfies Record<WorkMode, CapabilityItem[]>
  }, [packCapabilities, pluginCapabilities, skillCapabilities])

  const selectedModeSpec = localizedWorkModeSpec(locale, selectedWorkMode)
  const selectedModeCapabilities = modeAwareCapabilities[selectedWorkMode]
  const selectedModeNotice = useMemo(
    () => workModeAvailabilityNotice(locale, selectedWorkMode, runtimeStatus),
    [locale, runtimeStatus, selectedWorkMode],
  )
  const launchDisabled = launchBusy || launchInput.trim().length === 0 || Boolean(selectedModeNotice)
  const resetRuntimeDisabled = !runtimeStatus.localRuntimeAvailable

  const skillGroups = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>()
    for (const skill of skills) {
      const key = skill.project || 'workspace'
      const bucket = groups.get(key)
      if (bucket) bucket.push(skill)
      else groups.set(key, [skill])
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([project, items]) => ({
        project,
        skills: [...items].sort((left, right) => left.name.localeCompare(right.name)),
      }))
  }, [skills])

  const flagshipPacks = useMemo(
    () =>
      (substrateSummary?.flagship_packs ?? overview?.packs ?? []).filter(pack =>
        ['signals', 'due_diligence'].includes(pack.pack_id),
      ),
    [overview, substrateSummary],
  )

  const recentLaunches = useMemo(
    () => mergeLaunchRecords(launches, launchTasks.map(launchRecordFromTask)).slice(0, 8),
    [launchTasks, launches],
  )
  const threadSummaries = useMemo(
    () => deriveThreadSummaries(locale, recentLaunches, launchTasks),
    [launchTasks, locale, recentLaunches],
  )
  const latestLaunch = recentLaunches[0] ?? null
  const studioSummaryItems = useMemo(
    () => [
      { label: t(locale, 'label.packs'), value: overview?.packs.length ?? 0, tone: 'running' },
      { label: t(locale, 'label.skills'), value: skills.length, tone: 'open' },
      { label: t(locale, 'label.plugins'), value: substrateSummary?.plugins.length ?? 0, tone: 'open' },
      { label: t(locale, 'label.launches'), value: recentLaunches.length, tone: latestLaunch?.status },
    ],
    [
      latestLaunch?.status,
      locale,
      overview?.packs.length,
      recentLaunches.length,
      skills.length,
      substrateSummary?.plugins.length,
    ],
  )

  const modePosture = useMemo(
    () =>
      WORK_MODE_ORDER.map(mode => ({
        mode,
        spec: localizedWorkModeSpec(locale, mode),
        capabilities: modeAwareCapabilities[mode].slice(0, 3),
      })),
    [locale, modeAwareCapabilities],
  )
  const conversationEvents = useMemo(
    () =>
      deriveConversationEvents(
        locale,
        selectedThreadId,
        threadSummaries,
        recentLaunches,
        launchTasks,
        runs,
        workItems,
      ),
    [launchTasks, locale, recentLaunches, runs, selectedThreadId, threadSummaries, workItems],
  )
  const compactHomeZeroState =
    conversationEvents.length === 0 && (viewportTier !== 'wide' || viewportHeight < 820)
  const selectedThread = useMemo(
    () => threadSummaries.find(thread => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threadSummaries],
  )
  const navItems = useMemo<NavItemSpec[]>(
    () =>
      [
        { id: 'home', label: t(locale, 'nav.home'), glyph: locale === 'zh-CN' ? '首' : 'H' },
        { id: 'runs', label: t(locale, 'nav.runs'), glyph: locale === 'zh-CN' ? '记' : 'R' },
        {
          id: 'work_items',
          label: t(locale, 'nav.work_items'),
          glyph: locale === 'zh-CN' ? '办' : 'T',
        },
        { id: 'packs', label: t(locale, 'nav.packs'), glyph: locale === 'zh-CN' ? '专' : 'P' },
        {
          id: 'studio',
          label: t(locale, 'nav.studio'),
          glyph: locale === 'zh-CN' ? '能' : 'C',
        },
      ].map(item => ({ ...item, title: item.label })),
    [locale],
  )
  const homeRecentLaunches = recentLaunches.slice(0, 4)
  const homeRecentThreads = threadSummaries.slice(0, 4)
  const homePendingItems = priorityWorkItems.slice(0, 4)
  const sidebarStatusItems = useMemo<SidebarStatusItem[]>(
    () => [
      {
        id: 'core',
        label: t(locale, 'runtime.longclaw_core'),
        meta: runtimeStatus.longclawCoreBaseUrl || t(locale, 'runtime.no_control_plane_url'),
        status: runtimeStatus.longclawCoreConnected ? 'connected' : 'degraded',
      },
      {
        id: 'due',
        label: t(locale, 'runtime.due_diligence'),
        meta: runtimeStatus.dueDiligenceBaseUrl || t(locale, 'runtime.no_due_diligence_url'),
        status: runtimeStatus.dueDiligenceConnected ? 'connected' : 'degraded',
      },
      {
        id: 'signals',
        label: t(locale, 'runtime.signals_workspace'),
        meta: runtimeStatus.signalsStateRoot || t(locale, 'runtime.no_signals_state_root'),
        status: runtimeStatus.signalsAvailable ? 'available' : 'degraded',
      },
      {
        id: 'seat',
        label: t(locale, 'runtime.local_runtime_seat'),
        meta: runtimeStatus.localRuntimeSeat
          ? humanizeTokenLocale(locale, runtimeStatus.localRuntimeSeat)
          : humanizeTokenLocale(locale, 'unavailable'),
        status: runtimeStatus.localRuntimeAvailable ? 'available' : 'unavailable',
      },
      {
        id: 'acp',
        label: t(locale, 'runtime.local_acp_bridge'),
        meta: runtimeStatus.localAcpScript || t(locale, 'runtime.no_acp_bridge'),
        status: runtimeStatus.localAcpAvailable ? 'available' : 'unavailable',
      },
      {
        id: 'local-api',
        label: t(locale, 'runtime.local_runtime_api'),
        meta: runtimeStatus.localRuntimeApiUrl || t(locale, 'runtime.no_local_runtime_api'),
        status: runtimeStatus.localRuntimeApiAvailable ? 'available' : 'unavailable',
      },
    ],
    [locale, runtimeStatus],
  )

  useEffect(() => {
    if (!threadSummaries.length) {
      setSelectedThreadId(null)
      return
    }
    if (!selectedThreadId || !threadSummaries.some(thread => thread.id === selectedThreadId)) {
      setSelectedThreadId(threadSummaries[0].id)
    }
  }, [selectedThreadId, threadSummaries])

  const useCapability = useCallback((item: CapabilityItem) => {
    setLaunchInput(previous => withMention(previous, item.mention))
    setPage('home')
  }, [])

  const openLaunchRecord = useCallback(
    (record: LaunchRecord) => {
      openRecord(
        `${t(locale, 'section.recent_launches.title')} ${formatTime(record.started_at)}${record.work_mode ? ` · ${humanizeWorkMode(locale, record.work_mode)}` : ''}`,
        record as unknown as Record<string, unknown>,
      )
    },
    [locale, openRecord],
  )

  const openPackWorkspace = useCallback((packId: PackTab) => {
    setPackTab(packId)
    setPage('packs')
  }, [])

  const openConversationEvent = useCallback(
    (event: ConversationEvent) => {
      if (event.type === 'user_launch') {
        openLaunchRecord(event.launch)
        return
      }
      if (event.type === 'task_receipt') {
        openRecord(
          event.title,
          event.task as unknown as Record<string, unknown>,
        )
        return
      }
      if (event.type === 'run_receipt') {
        void openRun(event.run)
        return
      }
      openWorkItem(event.workItem)
    },
    [openLaunchRecord, openRecord, openRun, openWorkItem],
  )

  const resetCoworkRuntime = useCallback(async () => {
    if (!runtimeStatus.localRuntimeAvailable) {
      setActionMessage(t(locale, 'notice.local_unavailable'))
      return
    }
    try {
      await window.agentAPI.clear()
      setActionMessage(t(locale, 'action.runtime_reset_done'))
      await loadCapabilitySubstrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [loadCapabilitySubstrate, locale, runtimeStatus.localRuntimeAvailable])

  const submitLaunch = useCallback(async () => {
    const prompt = launchInput.trim()
    if (!prompt || launchBusy) return
    if (selectedModeNotice) {
      setActionMessage(selectedModeNotice)
      return
    }

    const tempLaunchId = `launch-${Date.now()}`
    const selectedMode = selectedWorkMode
    const selectedSpec = localizedWorkModeSpec(locale, selectedMode)
    activeLaunchIdRef.current = tempLaunchId
    setLaunchBusy(true)
    setActionMessage(null)
    setError(null)
    setLaunchInput('')
    setLaunches(previous =>
      [
        {
          id: tempLaunchId,
          prompt,
          status: 'running',
          started_at: new Date().toISOString(),
          text: '',
          tool_names: [],
          source: 'electron_cowork',
          work_mode: selectedMode,
          origin_surface: selectedSpec.interactionSurface,
          interaction_surface: selectedSpec.interactionSurface,
          runtime_profile: 'dev_local_acp_bridge',
          runtime_target: selectedSpec.runtimeTarget,
          model_plane: selectedSpec.modelPlane,
          execution_plane:
            selectedSpec.runtimeTarget === 'cloud_runtime' ? 'cloud_executor' : 'local_executor',
          workspace_target:
            selectedMode === 'local'
              ? agentCwd || undefined
              : selectedMode === 'cloud_sandbox'
                ? 'sandbox://longclaw/default'
                : 'weclaw://active-thread',
        },
        ...previous,
      ].slice(0, 8),
    )

    try {
      const receipt = await window.longclawLaunch.launch(
        buildLaunchIntent(prompt, agentCwd, selectedMode),
      )
      activeLaunchIdRef.current = null
      setLaunchBusy(false)
      const receiptRecord = launchRecordFromReceipt(receipt)
      setLaunches(previous =>
        previous
          .map(record =>
            record.id === tempLaunchId
              ? {
                  ...receiptRecord,
                  text: record.text || receiptRecord.text,
                  tool_names:
                    record.tool_names.length > 0
                      ? record.tool_names
                      : receiptRecord.tool_names,
                }
              : record,
          )
          .slice(0, 8),
      )
      setActionMessage(
        receipt.work_items.length > 0
          ? tf(locale, 'action.launch_created_work_items', {
              mode: humanizeWorkMode(locale, selectedMode),
              count: receipt.work_items.length,
              target: humanizeTokenLocale(locale, receipt.pack_id),
            })
          : tf(locale, 'action.launch_completed', {
              mode: humanizeWorkMode(locale, selectedMode),
              target: humanizeTokenLocale(locale, receipt.pack_id),
            }),
      )
      await Promise.all([
        loadOverview(),
        loadWorkItems(),
        loadLaunchTasks(),
        loadCapabilitySubstrate(),
      ])
    } catch (err) {
      activeLaunchIdRef.current = null
      setLaunchBusy(false)
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setLaunches(previous =>
        patchLaunchRecord(previous, tempLaunchId, record => ({
          ...record,
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: message,
        })),
      )
    }
  }, [
    agentCwd,
    launchBusy,
    launchInput,
    loadCapabilitySubstrate,
    loadLaunchTasks,
    loadOverview,
    loadWorkItems,
    selectedModeNotice,
    selectedWorkMode,
    locale,
  ])

  const pageHeading = pageTitle(locale, page, packTab)
  const selectedThreadModeSpec = workModeSpecFromValue(
    locale,
    selectedThread?.workMode ?? selectedWorkMode,
  )

  return (
    <div style={shellLayout.app}>
      <aside style={shellLayout.rail}>
        <div style={railBrandStyle}>
          <div style={railMonogramStyle}>LC</div>
          <div style={railBrandLabelStyle}>{t(locale, 'app.brand')}</div>
        </div>

        <nav aria-label="Primary navigation" style={railNavStyle}>
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              title={item.title}
              style={railNavButtonStyle(page === item.id)}
              onClick={() => setPage(item.id)}
            >
              <span style={railNavButtonGlyphStyle(page === item.id)}>{item.glyph}</span>
              <span style={railNavButtonLabelStyle}>{item.label}</span>
            </button>
          ))}
        </nav>

        {viewportTier === 'narrow' && (
          <button
            type="button"
            style={buttonStyleForState(secondaryButtonStyle, false)}
            aria-label={
              threadSidebarOpen ? t(locale, 'sidebar.toggle_close') : t(locale, 'sidebar.toggle_open')
            }
            onClick={() => setThreadSidebarOpen(previous => !previous)}
          >
            {threadSidebarOpen ? t(locale, 'sidebar.toggle_close') : t(locale, 'sidebar.threads')}
          </button>
        )}

        <div style={{ marginTop: 'auto' }} />
      </aside>

      {shellLayout.threadBackdrop && (
        <button
          type="button"
          aria-label={t(locale, 'action.close')}
          style={shellLayout.threadBackdrop}
          onClick={() => setThreadSidebarOpen(false)}
        />
      )}

      <aside style={shellLayout.threadSidebar}>
        <div style={threadSidebarSectionStyle}>
          <div style={threadSidebarSectionHeaderStyle}>
            <div>
              <div style={chromeStyles.eyebrowLight}>{t(locale, 'context.workspace_root')}</div>
              <div style={threadSidebarHeadingStyle}>
                {agentCwd ? agentCwd.split('/').filter(Boolean).slice(-2).join('/') : t(locale, 'context.workspace_pending')}
              </div>
            </div>
            <button
              type="button"
              style={buttonStyleForState(secondaryButtonStyle, loading)}
              disabled={loading}
              onClick={() => {
                void refresh(page, packTab)
              }}
            >
              {loading ? t(locale, 'action.refreshing') : t(locale, 'action.refresh')}
            </button>
          </div>
          <div style={threadSidebarWorkspaceCardStyle}>
            <div style={threadSidebarWorkspaceValueStyle}>
              {agentCwd ? agentCwd.split('/').filter(Boolean).slice(-1)[0] : t(locale, 'context.workspace_not_resolved')}
            </div>
            <div style={chromeStyles.monoMeta}>
              {agentCwd || t(locale, 'context.workspace_not_resolved')}
            </div>
          </div>
        </div>

        <div style={threadSidebarSectionStyle}>
          <div style={threadSidebarSectionHeaderStyle}>
            <div>
              <div style={chromeStyles.eyebrowLight}>{t(locale, 'sidebar.threads')}</div>
              <div style={threadSidebarHeadingStyle}>{t(locale, 'sidebar.session_ledger')}</div>
            </div>
            <span style={statusBadgeStyle('open')}>{threadSummaries.length}</span>
          </div>
          <div style={threadListStyle}>
            {threadSummaries.length === 0 ? (
              <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_launch_history')}</div>
            ) : (
              threadSummaries.map(thread => (
                <button
                  key={thread.id}
                  type="button"
                  style={threadRowStyle(selectedThreadId === thread.id)}
                  onClick={() => {
                    setSelectedThreadId(thread.id)
                    setPage('home')
                    if (viewportTier === 'narrow') setThreadSidebarOpen(false)
                  }}
                >
                  <div style={threadRowHeaderStyle}>
                    <div style={threadRowTitleStyle}>{thread.title}</div>
                    <span style={statusBadgeStyle(thread.status)}>{humanizeTokenLocale(locale, thread.status)}</span>
                  </div>
                  {thread.subtitle && <div style={threadRowMetaStyle}>{thread.subtitle}</div>}
                  <div style={threadRowMetaStyle}>
                    {formatModeMeta([
                      thread.latestAt ? formatTime(thread.latestAt) : undefined,
                      thread.localRuntimeSeat
                        ? humanizeTokenLocale(locale, thread.localRuntimeSeat)
                        : undefined,
                      tf(locale, 'sidebar.events_count', { count: thread.itemCount }),
                    ])}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div style={threadSidebarSectionStyle}>
          <div style={threadSidebarSectionHeaderStyle}>
            <div>
              <div style={chromeStyles.eyebrowLight}>{t(locale, 'nav.work_items')}</div>
              <div style={threadSidebarHeadingStyle}>{t(locale, 'section.priority_queue.title')}</div>
            </div>
          </div>
          <div style={threadSidebarQuickListStyle}>
            {priorityWorkItems.length === 0 ? (
              <div style={utilityStyles.emptyState}>{t(locale, 'empty.priority_queue')}</div>
            ) : (
              priorityWorkItems.slice(0, 4).map(item => (
                <button
                  key={item.work_item_id}
                  type="button"
                  style={threadSidebarMiniRowStyle}
                  onClick={() => {
                    setPage('work_items')
                    openWorkItem(item)
                  }}
                >
                  <div style={threadMiniTitleStyle}>{item.title}</div>
                  <div style={threadRowMetaStyle}>
                    {humanizeTokenLocale(locale, item.pack_id)} · {humanizeTokenLocale(locale, item.severity)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main style={shellLayout.content}>
        {shellLayout.detailBackdrop && (
          <button
            type="button"
            aria-label={t(locale, 'action.close')}
            style={shellLayout.detailBackdrop}
            onClick={() => setSelected(null)}
          />
        )}

        <div style={shellLayout.mainWorkspace}>
          {(error || actionMessage) && (
            <div style={workspaceBannerRowStyle}>
              {error && <div style={utilityStyles.errorBanner}>{error}</div>}
              {!error && actionMessage && <div style={utilityStyles.noticeBanner}>{actionMessage}</div>}
            </div>
          )}

          {page === 'home' ? (
            <div style={workspaceScrollStyle}>
              <div style={pageStackStyle}>
                <div style={pageHeaderShellStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={chromeStyles.eyebrow}>{pageEyebrow(locale, page)}</div>
                    <h1 style={chromeStyles.headerTitle}>{pageHeading}</h1>
                    <div style={chromeStyles.subtleText}>{pageDescription(locale, page)}</div>
                  </div>
                  <div style={pageHeaderActionsStyle}>
                    <span style={statusBadgeStyle(selectedModeNotice ? 'degraded' : 'running')}>
                      {selectedModeSpec.label}
                    </span>
                    <button
                      type="button"
                      style={buttonStyleForState(secondaryButtonStyle, loading)}
                      disabled={loading}
                      onClick={() => {
                        void refresh(page, packTab)
                      }}
                    >
                      {loading ? t(locale, 'action.refreshing') : t(locale, 'action.refresh')}
                    </button>
                  </div>
                </div>

                <Section
                  title={t(locale, 'section.home.current_context.title')}
                  subtitle={t(locale, 'section.home.current_context.subtitle')}
                >
                  <div style={homeContextGridStyle}>
                    <div style={homeContextCardStyle}>
                      <div style={chromeStyles.eyebrowLight}>{t(locale, 'context.workspace_root')}</div>
                      <div style={homeContextValueStyle}>
                        {agentCwd ? agentCwd.split('/').filter(Boolean).slice(-2).join('/') : t(locale, 'context.workspace_pending')}
                      </div>
                      <div style={homeContextMetaStyle}>
                        {agentCwd || t(locale, 'context.workspace_not_resolved')}
                      </div>
                    </div>
                    <div style={homeContextCardStyle}>
                      <div style={chromeStyles.eyebrowLight}>{t(locale, 'context.selected_home_mode')}</div>
                      <div style={homeContextValueStyle}>{selectedModeSpec.label}</div>
                      <div style={homeContextMetaStyle}>{selectedModeSpec.summary}</div>
                    </div>
                    <div style={homeContextCardStyle}>
                      <div style={chromeStyles.eyebrowLight}>{t(locale, 'sidebar.session_ledger')}</div>
                      <div style={homeContextValueStyle}>
                        {selectedThread?.title || t(locale, 'state.pending')}
                      </div>
                      <div style={homeContextMetaStyle}>
                        {formatModeMeta([
                          selectedThreadModeSpec?.label,
                          selectedThread?.latestAt ? formatTime(selectedThread.latestAt) : undefined,
                        ]) || t(locale, 'section.continue_threads.subtitle')}
                      </div>
                    </div>
                  </div>
                </Section>

                <Section
                  title={t(locale, 'section.mode_launcher.title')}
                  subtitle={t(locale, 'section.mode_launcher.subtitle')}
                  actions={
                    <span style={statusBadgeStyle(selectedModeNotice ? 'degraded' : 'running')}>
                      {selectedModeNotice
                        ? selectedWorkMode === 'local'
                          ? t(locale, 'state.unavailable')
                          : t(locale, 'state.degraded')
                        : t(locale, 'state.ready')}
                    </span>
                  }
                >
                  <div style={homeLauncherSurfaceStyle}>
                    <div style={composerHeaderRowStyle}>
                      <select
                        value={selectedWorkMode}
                        onChange={event => {
                          workModeTouchedRef.current = true
                          setSelectedWorkMode(event.target.value as WorkMode)
                        }}
                        style={chatComposerSelectStyle}
                      >
                        {WORK_MODE_ORDER.map(mode => {
                          const spec = localizedWorkModeSpec(locale, mode)
                          return (
                            <option key={mode} value={mode}>
                              {spec.label}
                            </option>
                          )
                        })}
                      </select>
                      <div style={composerStatusRowStyle}>
                        <div style={chromeStyles.quietMeta}>{selectedModeSpec.detail}</div>
                        <div style={chromeStyles.monoMeta}>
                          {formatModeMeta([
                            selectedModeSpec.workspaceLabel,
                            selectedModeSpec.surfaceLabel,
                          ])}
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={launchInput}
                      onChange={event => setLaunchInput(event.target.value)}
                      onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          event.preventDefault()
                          void submitLaunch()
                        }
                      }}
                      placeholder={selectedModeSpec.placeholder}
                      style={chatComposerTextareaStyle}
                    />
                    {selectedModeNotice && <div style={utilityStyles.warningBanner}>{selectedModeNotice}</div>}

                    <div style={chatComposerFooterStyle}>
                      <div style={chatComposerHintsStyle}>
                        {selectedModeCapabilities.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            style={chatHintChipStyle}
                            onClick={() => useCapability(item)}
                          >
                            {item.mention}
                          </button>
                        ))}
                      </div>
                      <div style={utilityStyles.buttonCluster}>
                        <button
                          type="button"
                          style={buttonStyleForState(secondaryButtonStyle, resetRuntimeDisabled)}
                          disabled={resetRuntimeDisabled}
                          onClick={() => {
                            void resetCoworkRuntime()
                          }}
                        >
                          {t(locale, 'action.reset_runtime')}
                        </button>
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => setLaunchInput('')}
                        >
                          {t(locale, 'action.clear_draft')}
                        </button>
                        <button
                          type="button"
                          style={buttonStyleForState(primaryButtonStyle, launchDisabled)}
                          disabled={launchDisabled}
                          onClick={() => {
                            void submitLaunch()
                          }}
                        >
                          {launchBusy ? t(locale, 'action.launching') : selectedModeSpec.launchButtonLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                </Section>

                <div style={homeGridStyle}>
                  <Section
                    title={t(locale, 'section.recent_launches.title')}
                    subtitle={t(locale, 'section.recent_launches.subtitle')}
                  >
                    <div style={utilityStyles.stackedList}>
                      {homeRecentLaunches.length === 0 ? (
                        <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_recent_launches')}</div>
                      ) : (
                        homeRecentLaunches.map(record => (
                          <QueueRow
                            key={record.id}
                            locale={locale}
                            title={record.prompt.trim().slice(0, 52) || humanizeTokenLocale(locale, record.pack_id ?? 'launch')}
                            meta={formatModeMeta([
                              record.work_mode ? humanizeWorkMode(locale, record.work_mode) : undefined,
                              record.pack_id ? humanizeTokenLocale(locale, record.pack_id) : undefined,
                              formatTime(record.started_at),
                            ])}
                            status={record.status}
                            description={
                              record.error ||
                              record.text.trim().slice(0, 120) ||
                              record.result_label ||
                              undefined
                            }
                            nextAction={t(locale, 'action.inspect_launch')}
                            onSelect={() => openLaunchRecord(record)}
                          />
                        ))
                      )}
                    </div>
                  </Section>

                  <Section
                    title={t(locale, 'section.continue_threads.title')}
                    subtitle={t(locale, 'section.continue_threads.subtitle')}
                  >
                    <div style={utilityStyles.stackedList}>
                      {homeRecentThreads.length === 0 ? (
                        <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_continue_tasks')}</div>
                      ) : (
                        homeRecentThreads.map(thread => (
                          <QueueRow
                            key={thread.id}
                            locale={locale}
                            title={thread.title}
                            meta={formatModeMeta([
                              thread.subtitle,
                              thread.latestAt ? formatTime(thread.latestAt) : undefined,
                            ])}
                            status={thread.status}
                            description={thread.localRuntimeSeat ? humanizeTokenLocale(locale, thread.localRuntimeSeat) : undefined}
                            nextAction={t(locale, 'action.switch_context')}
                            onSelect={() => setSelectedThreadId(thread.id)}
                          />
                        ))
                      )}
                    </div>
                  </Section>
                </div>

                <Section
                  title={t(locale, 'section.pending_actions.title')}
                  subtitle={t(locale, 'section.pending_actions.subtitle')}
                >
                  <div style={utilityStyles.stackedList}>
                    {homePendingItems.length === 0 ? (
                      <div style={utilityStyles.emptyState}>{t(locale, 'empty.priority_queue')}</div>
                    ) : (
                      homePendingItems.map(item => (
                        <QueueRow
                          key={item.work_item_id}
                          locale={locale}
                          title={item.title}
                          meta={formatModeMeta([
                            humanizeTokenLocale(locale, item.pack_id),
                            humanizeTokenLocale(locale, item.kind),
                            humanizeTokenLocale(locale, item.status),
                          ])}
                          status={item.severity}
                          description={item.summary}
                          nextAction={item.operator_actions[0]?.label ?? t(locale, 'action.inspect_launch')}
                          onSelect={() => openWorkItem(item)}
                        />
                      ))
                    )}
                  </div>
                </Section>
              </div>
            </div>
          ) : (
            <div style={workspaceScrollStyle}>
              <div style={pageHeaderShellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={chromeStyles.eyebrow}>{pageEyebrow(locale, page)}</div>
                  <h1 style={chromeStyles.headerTitle}>{pageHeading}</h1>
                  <div style={chromeStyles.subtleText}>{pageDescription(locale, page)}</div>
                </div>
                <div style={utilityStyles.buttonCluster}>
                  <button
                    type="button"
                    style={buttonStyleForState(secondaryButtonStyle, loading)}
                    disabled={loading}
                    onClick={() => {
                      void refresh(page, packTab)
                    }}
                  >
                    {loading ? t(locale, 'action.refreshing') : t(locale, 'action.refresh')}
                  </button>
                  {page === 'packs' && (
                    <>
                      <button
                        type="button"
                        style={segmentedButtonStyle(packTab === 'due_diligence')}
                        onClick={() => setPackTab('due_diligence')}
                      >
                        {t(locale, 'pack.due_diligence')}
                      </button>
                      <button
                        type="button"
                        style={segmentedButtonStyle(packTab === 'signals')}
                        onClick={() => setPackTab('signals')}
                      >
                        {t(locale, 'pack.signals')}
                      </button>
                    </>
                  )}
                  {page === 'studio' && (
                    <>
                      <button
                        type="button"
                        style={segmentedButtonStyle(locale === 'zh-CN')}
                        onClick={() => setLocale('zh-CN')}
                      >
                        中文
                      </button>
                      <button
                        type="button"
                        style={segmentedButtonStyle(locale === 'en-US')}
                        onClick={() => setLocale('en-US')}
                      >
                        English
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={pageStackStyle}>
                {page === 'runs' && (
                  <Section
                    title={t(locale, 'page.runs.title')}
                    subtitle={t(locale, 'page.runs.description')}
                    actions={
                      <select
                        value={runFilter}
                        onChange={event => setRunFilter(event.target.value)}
                        style={utilityStyles.select}
                      >
                        {['all', 'running', 'failed', 'repair_required', 'partial', 'succeeded'].map(
                          filter => (
                            <option key={filter} value={filter}>
                              {humanizeTokenLocale(locale, filter)}
                            </option>
                          ),
                        )}
                      </select>
                    }
                  >
                    <div style={utilityStyles.stackedList}>
                      {filteredRuns.length === 0 ? (
                        <div style={utilityStyles.emptyState}>
                          {runtimeStatus.longclawCoreConnected
                            ? t(locale, 'empty.runs_filtered_connected')
                            : t(locale, 'empty.runs_filtered_disconnected')}
                        </div>
                      ) : (
                        filteredRuns.map(run => (
                          <QueueRow
                            key={run.run_id}
                            locale={locale}
                            title={run.summary || run.run_id}
                            meta={formatModeMeta([
                              humanizeTokenLocale(locale, run.pack_id ?? run.domain),
                              humanizeTokenLocale(locale, run.capability),
                              workModeFromRun(run)
                                ? humanizeWorkMode(locale, workModeFromRun(run))
                                : undefined,
                              runtimeTargetFromRecord(run)
                                ? humanizeTokenLocale(locale, runtimeTargetFromRecord(run))
                                : undefined,
                              formatTime(run.created_at),
                            ])}
                            status={run.status}
                            nextAction={t(locale, 'action.inspect_launch')}
                            onSelect={() => {
                              void openRun(run)
                            }}
                          />
                        ))
                      )}
                    </div>
                  </Section>
                )}

                {page === 'work_items' && (
                  <Section
                    title={t(locale, 'page.work_items.title')}
                    subtitle={t(locale, 'page.work_items.description')}
                    actions={
                      <select
                        value={workItemFilter}
                        onChange={event => setWorkItemFilter(event.target.value)}
                        style={utilityStyles.select}
                      >
                        {['all', 'critical', 'warning', 'info'].map(filter => (
                          <option key={filter} value={filter}>
                            {humanizeTokenLocale(locale, filter)}
                          </option>
                        ))}
                      </select>
                    }
                  >
                    <div style={utilityStyles.stackedList}>
                      {filteredWorkItems.length === 0 ? (
                        <div style={utilityStyles.emptyState}>
                          {runtimeStatus.longclawCoreConnected
                            ? t(locale, 'empty.work_items_filtered_connected')
                            : t(locale, 'empty.work_items_filtered_disconnected')}
                        </div>
                      ) : (
                        filteredWorkItems.map(item => (
                          <QueueRow
                            key={item.work_item_id}
                            locale={locale}
                            title={item.title}
                            meta={formatModeMeta([
                              humanizeTokenLocale(locale, item.pack_id),
                              humanizeTokenLocale(locale, item.kind),
                              workModeFromWorkItem(item)
                                ? humanizeWorkMode(locale, workModeFromWorkItem(item))
                                : undefined,
                              runtimeTargetFromRecord(item)
                                ? humanizeTokenLocale(locale, runtimeTargetFromRecord(item))
                                : undefined,
                              humanizeTokenLocale(locale, item.status),
                            ])}
                            status={item.severity}
                            description={item.summary}
                            nextAction={item.operator_actions[0]?.label ?? t(locale, 'action.inspect_launch')}
                            onSelect={() => openWorkItem(item)}
                          />
                        ))
                      )}
                    </div>
                  </Section>
                )}

                {page === 'packs' && dashboard && (
                  <Section
                    title={packLabel(locale, dashboard.pack_id)}
                    subtitle={
                      dashboard.pack_id === 'due_diligence'
                        ? locale === 'zh-CN'
                          ? '这是重证据、重复核的专业工作面，运行、证据和复核统一回到 Longclaw Core。'
                          : 'Evidence-heavy specialist workspace. Runs, evidence, and review converge in Longclaw Core.'
                        : locale === 'zh-CN'
                          ? '这是 Signals 的专业工作面，用来承接分析、回测与审核后洞察。'
                          : 'Signals specialist workspace for analysis, backtesting, and reviewed insight.'
                    }
                    actions={
                      'operator_actions' in dashboard && dashboard.operator_actions.length > 0 ? (
                        <ActionButtons actions={dashboard.operator_actions} onRun={runAction} />
                      ) : undefined
                    }
                  >
                    {localizedDashboardNotice && (
                      <div style={{ ...utilityStyles.warningBanner, marginBottom: 12 }}>
                        {localizedDashboardNotice}
                      </div>
                    )}
                    {dashboard.pack_id === 'due_diligence' ? (
                      <DueDiligencePackView
                        locale={locale}
                        dashboard={dashboard as DueDiligenceDashboard}
                        onOpenRun={openRun}
                        onOpenRecord={openRecord}
                      />
                    ) : (
                      <SignalsPackView
                        locale={locale}
                        dashboard={dashboard as SignalsDashboard}
                        onOpenRun={openRun}
                        onOpenRecord={openRecord}
                      />
                    )}
                  </Section>
                )}

                {page === 'studio' && (
                  <>
                    <Section
                      title={t(locale, 'section.studio.capability_posture.title')}
                      subtitle={t(locale, 'section.studio.capability_posture.subtitle')}
                    >
                      <StatusStrip locale={locale} items={studioSummaryItems} />
                    </Section>

                    <Section
                      title={t(locale, 'section.studio.mode_recommendations.title')}
                      subtitle={t(locale, 'section.studio.mode_recommendations.subtitle')}
                    >
                      <div style={modePostureGridStyle}>
                        {modePosture.map(({ mode, spec, capabilities }) => {
                          const availabilityState = workModeAvailabilityState(
                            locale,
                            mode,
                            runtimeStatus,
                            selectedWorkMode === mode,
                          )
                          return (
                            <div key={mode} style={modePostureCardStyle}>
                              <div style={modeCardHeaderStyle}>
                                <div style={chromeStyles.eyebrowLight}>{spec.eyebrow}</div>
                                <span style={statusBadgeStyle(availabilityState.tone)}>
                                  {selectedWorkMode === mode && availabilityState.tone === 'running'
                                    ? t(locale, 'context.selected_home_mode')
                                    : availabilityState.label}
                                </span>
                              </div>
                              <div style={modeCardTitleStyle}>{spec.label}</div>
                              <div style={queueRowDescriptionStyle}>{spec.detail}</div>
                              <div style={chromeStyles.quietMeta}>
                                {humanizeTokenLocale(locale, spec.runtimeTarget)} · {humanizeTokenLocale(locale, spec.modelPlane)} ·{' '}
                                {humanizeTokenLocale(locale, spec.interactionSurface)}
                              </div>
                              <div style={chromeStyles.quietMeta}>{spec.workspaceHint}</div>
                              {capabilities.length === 0 ? (
                                <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_capabilities')}</div>
                              ) : (
                                <div style={capabilityRailStyle}>
                                  {capabilities.map(item => (
                                    <CapabilityChip
                                      key={`${mode}:${item.id}`}
                                      item={item}
                                      onUse={useCapability}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </Section>

                    <div style={studioGridStyle}>
                      <Section
                        title={t(locale, 'section.runtime_health.title')}
                        subtitle={t(locale, 'section.runtime_health.subtitle')}
                      >
                        <div style={utilityStyles.stackedList}>
                          {sidebarStatusItems.map(item => (
                            <div key={item.id} style={surfaceStyles.listRow}>
                              <div style={queueRowLeadStyle}>
                                <div style={queueRowTitleStyle}>{item.label}</div>
                                {item.meta && <div style={chromeStyles.quietMeta}>{item.meta}</div>}
                              </div>
                              <span style={statusBadgeStyle(item.status)}>
                                {humanizeTokenLocale(locale, item.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </Section>

                      <Section
                        title={t(locale, 'section.workspace_context.title')}
                        subtitle={t(locale, 'section.workspace_context.subtitle')}
                      >
                        <div style={utilityStyles.stackedList}>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'context.local_executor_runtime')}</div>
                              <div style={chromeStyles.quietMeta}>{t(locale, 'context.local_executor_runtime_desc')}</div>
                            </div>
                            <span style={statusBadgeStyle(launchBusy ? 'running' : agentMode?.alive ? 'open' : 'info')}>
                              {launchBusy
                                ? t(locale, 'state.launching')
                                : agentMode
                                  ? humanizeTokenLocale(locale, agentMode.mode)
                                  : t(locale, 'state.pending')}
                            </span>
                          </div>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'runtime.local_runtime_seat')}</div>
                              <div style={chromeStyles.quietMeta}>
                                {runtimeStatus.localRuntimeApiUrl || runtimeStatus.localAcpScript
                                  ? formatModeMeta([
                                      runtimeStatus.localAcpScript,
                                      runtimeStatus.localRuntimeApiUrl,
                                    ])
                                  : t(locale, 'runtime.no_local_runtime_api')}
                              </div>
                            </div>
                            <span style={statusBadgeStyle(runtimeStatus.localRuntimeAvailable ? 'open' : 'degraded')}>
                              {humanizeTokenLocale(locale, runtimeStatus.localRuntimeSeat ?? 'unavailable')}
                            </span>
                          </div>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'context.selected_home_mode')}</div>
                              <div style={chromeStyles.quietMeta}>{t(locale, 'context.selected_home_mode_desc')}</div>
                            </div>
                            <span style={statusBadgeStyle('running')}>{selectedModeSpec.label}</span>
                          </div>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'context.workspace_root')}</div>
                              <div style={chromeStyles.quietMeta}>{t(locale, 'context.workspace_root_desc')}</div>
                            </div>
                            <div style={chromeStyles.monoMeta}>{agentCwd || humanizeTokenLocale(locale, 'unavailable')}</div>
                          </div>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'context.runtime_profile')}</div>
                              <div style={chromeStyles.quietMeta}>{t(locale, 'context.runtime_profile_desc')}</div>
                            </div>
                            <span style={statusBadgeStyle('open')}>
                              {humanizeTokenLocale(
                                locale,
                                String(substrateSummary?.metadata.runtime_profile ?? 'dev_local_acp_bridge'),
                              )}
                            </span>
                          </div>
                          <div style={surfaceStyles.listRow}>
                            <div style={queueRowLeadStyle}>
                              <div style={queueRowTitleStyle}>{t(locale, 'context.plugin_visibility')}</div>
                              <div style={chromeStyles.quietMeta}>{t(locale, 'context.plugin_visibility_desc')}</div>
                            </div>
                            <span style={statusBadgeStyle((substrateSummary?.plugins.length ?? 0) > 0 ? 'open' : 'degraded')}>
                              {(substrateSummary?.plugins.length ?? 0) > 0 ? t(locale, 'state.visible') : t(locale, 'state.pending')}
                            </span>
                          </div>
                        </div>
                      </Section>
                    </div>

                    <Section
                      title={t(locale, 'section.skill_inventory.title')}
                      subtitle={t(locale, 'section.skill_inventory.subtitle')}
                    >
                      {skillGroups.length === 0 ? (
                        <div style={utilityStyles.emptyState}>{t(locale, 'empty.no_local_skills')}</div>
                      ) : (
                        <div style={studioGroupStackStyle}>
                          {skillGroups.map(group => (
                            <div key={group.project} style={studioGroupStyle}>
                              <div style={studioGroupHeaderStyle}>
                                <div style={queueRowTitleStyle}>{humanizeToken(group.project)}</div>
                                <div style={chromeStyles.quietMeta}>
                                  {tf(locale, 'label.skill_count', { count: group.skills.length })}
                                </div>
                              </div>
                              <div style={capabilityRailStyle}>
                                {group.skills.map(skill => (
                                  <CapabilityChip
                                    key={`${group.project}:${skill.name}`}
                                    item={{
                                      id: `${group.project}:${skill.name}`,
                                      label: skill.name,
                                      kind: 'skill',
                                      mention: `@skill ${skill.name}`,
                                      hint: humanizeToken(group.project),
                                      description: skill.description,
                                    }}
                                    onUse={useCapability}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>
                  </>
                )}
              </div>
            </div>
          )}

          <aside aria-label={t(locale, 'section.detail.drawer')} style={shellLayout.detailPane}>
            {selected ? (
              <div style={pageStackStyle}>
                <div style={detailHeaderStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={chromeStyles.eyebrowLight}>{t(locale, 'section.detail.drawer')}</div>
                    <h2 style={chromeStyles.sectionTitle}>{selected.title}</h2>
                  </div>
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={() => setSelected(null)}
                  >
                    {t(locale, 'action.close')}
                  </button>
                </div>

                {selected.type === 'run' && (
                  <>
                    <Section
                      title={t(locale, 'section.detail.run_summary.title')}
                      subtitle={t(locale, 'section.detail.run_summary.subtitle')}
                    >
                      <div style={utilityStyles.stackedList}>
                        <span style={statusBadgeStyle(selected.run.status)}>
                          {humanizeTokenLocale(locale, selected.run.status)}
                        </span>
                        {workModeFromRun(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.work_mode')}: {humanizeWorkMode(locale, workModeFromRun(selected.run))}
                          </div>
                        )}
                        {runtimeTargetFromRecord(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.runtime_target')}:{' '}
                            {humanizeTokenLocale(locale, runtimeTargetFromRecord(selected.run))}
                          </div>
                        )}
                        {interactionSurfaceFromRun(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.interaction_surface')}:{' '}
                            {humanizeTokenLocale(locale, interactionSurfaceFromRun(selected.run))}
                          </div>
                        )}
                        {runtimeProfileFromRecord(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.runtime_profile')}:{' '}
                            {humanizeTokenLocale(locale, runtimeProfileFromRecord(selected.run))}
                          </div>
                        )}
                        {modelPlaneFromRecord(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.model_plane')}:{' '}
                            {humanizeTokenLocale(locale, modelPlaneFromRecord(selected.run))}
                          </div>
                        )}
                        {localRuntimeSeatFromRecord(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.local_runtime_seat')}:{' '}
                            {humanizeTokenLocale(locale, localRuntimeSeatFromRecord(selected.run))}
                          </div>
                        )}
                        {originSurfaceFromRun(selected.run) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.origin_surface')}:{' '}
                            {humanizeTokenLocale(locale, originSurfaceFromRun(selected.run))}
                          </div>
                        )}
                        <div style={chromeStyles.quietMeta}>
                          {t(locale, 'label.domain')}: {humanizeTokenLocale(locale, selected.run.domain)}
                        </div>
                        <div style={chromeStyles.quietMeta}>
                          {t(locale, 'label.capability')}: {humanizeTokenLocale(locale, selected.run.capability)}
                        </div>
                        <div style={chromeStyles.monoMeta}>
                          {t(locale, 'label.created')}: {formatTime(selected.run.created_at)}
                        </div>
                        <div style={chromeStyles.monoMeta}>
                          {t(locale, 'label.run_id')}: {selected.run.run_id}
                        </div>
                      </div>
                    </Section>

                    <Section
                      title={t(locale, 'section.detail.artifacts.title')}
                      subtitle={t(locale, 'section.detail.artifacts.subtitle')}
                    >
                      <ArtifactList
                        locale={locale}
                        artifacts={selectedArtifacts}
                        onOpen={openArtifact}
                        onPreview={previewArtifact}
                      />
                    </Section>

                    <Section
                      title={t(locale, 'section.detail.run_metadata.title')}
                      subtitle={t(locale, 'section.detail.run_metadata.subtitle')}
                    >
                      <pre style={surfaceStyles.drawerPre}>
                        {JSON.stringify(selected.run.metadata, null, 2)}
                      </pre>
                    </Section>
                  </>
                )}

                {selected.type === 'work_item' && (
                  <>
                    <Section
                      title={t(locale, 'section.detail.work_item.title')}
                      subtitle={t(locale, 'section.detail.work_item.subtitle')}
                    >
                      <div style={utilityStyles.stackedList}>
                        <span style={statusBadgeStyle(selected.workItem.severity)}>
                          {humanizeTokenLocale(locale, selected.workItem.severity)}
                        </span>
                        {workModeFromWorkItem(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.work_mode')}: {humanizeWorkMode(locale, workModeFromWorkItem(selected.workItem))}
                          </div>
                        )}
                        {runtimeTargetFromRecord(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.runtime_target')}:{' '}
                            {humanizeTokenLocale(locale, runtimeTargetFromRecord(selected.workItem))}
                          </div>
                        )}
                        {interactionSurfaceFromWorkItem(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.interaction_surface')}:{' '}
                            {humanizeTokenLocale(locale, interactionSurfaceFromWorkItem(selected.workItem))}
                          </div>
                        )}
                        {runtimeProfileFromRecord(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.runtime_profile')}:{' '}
                            {humanizeTokenLocale(locale, runtimeProfileFromRecord(selected.workItem))}
                          </div>
                        )}
                        {modelPlaneFromRecord(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.model_plane')}:{' '}
                            {humanizeTokenLocale(locale, modelPlaneFromRecord(selected.workItem))}
                          </div>
                        )}
                        {localRuntimeSeatFromRecord(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.local_runtime_seat')}:{' '}
                            {humanizeTokenLocale(
                              locale,
                              localRuntimeSeatFromRecord(selected.workItem),
                            )}
                          </div>
                        )}
                        {originSurfaceFromWorkItem(selected.workItem) && (
                          <div style={chromeStyles.quietMeta}>
                            {t(locale, 'label.origin_surface')}:{' '}
                            {humanizeTokenLocale(locale, originSurfaceFromWorkItem(selected.workItem))}
                          </div>
                        )}
                        <div style={chromeStyles.quietMeta}>
                          {t(locale, 'label.status')}: {humanizeTokenLocale(locale, selected.workItem.status)}
                        </div>
                        <div style={chromeStyles.quietMeta}>
                          {t(locale, 'label.pack')}: {humanizeTokenLocale(locale, selected.workItem.pack_id)}
                        </div>
                        <div style={workItemSummaryStyle}>{selected.workItem.summary}</div>
                        <ActionButtons
                          actions={selected.workItem.operator_actions}
                          onRun={runAction}
                        />
                      </div>
                    </Section>

                    <Section
                      title={t(locale, 'section.detail.referenced_artifacts.title')}
                      subtitle={t(locale, 'section.detail.referenced_artifacts.subtitle')}
                    >
                      <ArtifactRefList
                        locale={locale}
                        items={selected.workItem.artifact_refs}
                        onOpen={openArtifact}
                        onPreview={previewArtifact}
                      />
                    </Section>
                  </>
                )}

                {selected.type === 'record' && (
                  <>
                    {(readMetadataString(selected.record, 'work_mode') ||
                      readMetadataString(selected.record, 'runtime_target') ||
                      readMetadataString(selected.record, 'interaction_surface') ||
                      readMetadataString(selected.record, 'runtime_profile')) && (
                      <Section
                        title={t(locale, 'section.detail.mode_context.title')}
                        subtitle={t(locale, 'section.detail.mode_context.subtitle')}
                      >
                        <div style={utilityStyles.stackedList}>
                          {readMetadataString(selected.record, 'work_mode') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.work_mode')}:{' '}
                              {humanizeWorkMode(locale, readMetadataString(selected.record, 'work_mode'))}
                            </div>
                          )}
                          {readMetadataString(selected.record, 'runtime_target') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.runtime_target')}:{' '}
                              {humanizeTokenLocale(locale,
                                readMetadataString(selected.record, 'runtime_target'),
                              )}
                            </div>
                          )}
                          {readMetadataString(selected.record, 'interaction_surface') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.interaction_surface')}:{' '}
                              {humanizeTokenLocale(locale,
                                readMetadataString(selected.record, 'interaction_surface'),
                              )}
                            </div>
                          )}
                          {readMetadataString(selected.record, 'runtime_profile') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.runtime_profile')}:{' '}
                              {humanizeTokenLocale(locale,
                                readMetadataString(selected.record, 'runtime_profile'),
                              )}
                            </div>
                          )}
                          {readMetadataString(selected.record, 'model_plane') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.model_plane')}:{' '}
                              {humanizeTokenLocale(locale, readMetadataString(selected.record, 'model_plane'))}
                            </div>
                          )}
                          {readMetadataString(selected.record, 'local_runtime_seat') && (
                            <div style={chromeStyles.quietMeta}>
                              {t(locale, 'label.local_runtime_seat')}:{' '}
                              {humanizeTokenLocale(
                                locale,
                                readMetadataString(selected.record, 'local_runtime_seat'),
                              )}
                            </div>
                          )}
                        </div>
                      </Section>
                    )}
                    <Section
                      title={t(locale, 'section.detail.operator_actions.title')}
                      subtitle={t(locale, 'section.detail.operator_actions.subtitle')}
                    >
                      <ActionButtons actions={selected.actions} onRun={runAction} />
                    </Section>
                    <Section
                      title={t(locale, 'section.detail.record_payload.title')}
                      subtitle={t(locale, 'section.detail.record_payload.subtitle')}
                    >
                      <pre style={surfaceStyles.drawerPre}>
                        {JSON.stringify(selected.record, null, 2)}
                      </pre>
                    </Section>
                  </>
                )}

                {preview && (
                  <Section title={t(locale, 'section.detail.preview.title')} subtitle={preview.uri}>
                    <pre style={surfaceStyles.drawerPre}>{preview.text}</pre>
                  </Section>
                )}
              </div>
            ) : (
              <div style={utilityStyles.emptyState}>{t(locale, 'empty.select_detail')}</div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

const pageStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 12,
}

const sectionHeadingBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const statusStripValueStyle: React.CSSProperties = {
  fontFamily: chromeStyles.headerTitle.fontFamily,
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 600,
  color: palette.ink,
  letterSpacing: '-0.03em',
}

const statusStripLabelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  marginTop: 10,
  color: palette.textMuted,
  fontSize: 12,
}

const queueRowButtonStyle: React.CSSProperties = {
  ...surfaceStyles.listRow,
  ...surfaceStyles.listRowInteractive,
}

const queueRowLeadStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
}

const queueRowTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 15,
  lineHeight: 1.35,
  fontWeight: 600,
}

const queueRowDescriptionStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 13,
  lineHeight: 1.45,
}

const queueRowTailStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  minWidth: 140,
}

const queueRowNextActionStyle: React.CSSProperties = {
  color: palette.copper,
  fontSize: 12,
  lineHeight: 1.3,
  textAlign: 'right',
}

const healthGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 12,
}

const subsectionTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 14,
  fontWeight: 600,
}

const detailHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
}

const workItemSummaryStyle: React.CSSProperties = {
  color: palette.ink,
  lineHeight: 1.55,
}

const railBrandStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
}

const railMonogramStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: 'rgba(247, 242, 232, 0.12)',
  border: '1px solid rgba(247, 242, 232, 0.16)',
  color: palette.paper,
  display: 'grid',
  placeItems: 'center',
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.08em',
}

const railBrandLabelStyle: React.CSSProperties = {
  color: 'rgba(247, 242, 232, 0.72)',
  fontSize: 11,
  lineHeight: 1.35,
  textAlign: 'center',
}

const railNavStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

function railNavButtonStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${active ? 'rgba(247, 242, 232, 0.16)' : 'transparent'}`,
    background: active ? 'rgba(247, 242, 232, 0.12)' : 'transparent',
    color: active ? palette.paper : 'rgba(247, 242, 232, 0.74)',
    minHeight: 52,
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'center',
    cursor: 'pointer',
  }
}

function railNavButtonGlyphStyle(active: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: active ? 'rgba(247, 242, 232, 0.18)' : 'rgba(247, 242, 232, 0.08)',
    border: `1px solid ${active ? 'rgba(247, 242, 232, 0.2)' : 'rgba(247, 242, 232, 0.06)'}`,
    color: palette.paper,
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  }
}

const railNavButtonLabelStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 600,
  whiteSpace: 'normal',
}

const railStatusStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const railStatusItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '10px 8px',
  borderRadius: 16,
  background: 'rgba(247, 242, 232, 0.06)',
  border: '1px solid rgba(247, 242, 232, 0.08)',
}

const railStatusLabelStyle: React.CSSProperties = {
  color: palette.paper,
  fontSize: 11,
  lineHeight: 1.25,
  textAlign: 'center',
}

const railStatusMetaStyle: React.CSSProperties = {
  color: 'rgba(247, 242, 232, 0.48)',
  fontSize: 10,
  lineHeight: 1.3,
  textAlign: 'center',
  wordBreak: 'break-word',
}

const threadSidebarSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '20px 18px 0',
}

const threadSidebarSectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
}

const threadSidebarHeadingStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 17,
  lineHeight: 1.25,
  fontWeight: 600,
}

const threadSidebarQuickStackStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const threadSidebarChipStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  padding: '7px 10px',
}

const threadSidebarWorkspaceCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 13px',
  borderRadius: 16,
  border: `1px solid ${palette.border}`,
  background: palette.panelRaised,
}

const threadSidebarWorkspaceValueStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 15,
  lineHeight: 1.35,
  fontWeight: 600,
}

const threadListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 0,
}

function threadRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 13px',
    borderRadius: 16,
    border: `1px solid ${active ? 'rgba(184, 100, 59, 0.32)' : palette.border}`,
    background: active ? 'rgba(184, 100, 59, 0.08)' : palette.panelRaised,
    textAlign: 'left',
    cursor: 'pointer',
  }
}

const threadRowHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 8,
}

const threadRowTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 600,
}

const threadRowMetaStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 12,
  lineHeight: 1.4,
}

const threadSidebarQuickListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const threadSidebarMiniRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${palette.border}`,
  background: palette.panelRaised,
  textAlign: 'left',
  cursor: 'pointer',
}

const threadMiniTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 600,
}

const workspaceBannerRowStyle: React.CSSProperties = {
  padding: '18px 22px 0',
}

const threadHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
  padding: '22px 24px 16px',
  borderBottom: `1px solid ${palette.border}`,
  background: 'rgba(251, 247, 240, 0.72)',
  backdropFilter: 'blur(14px)',
}

const threadHeaderLeadStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
}

const threadHeaderMetaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  flexShrink: 0,
}

const transcriptViewportStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '18px 24px 24px',
}

const transcriptEmptyStateStyle: React.CSSProperties = {
  ...surfaceStyles.section,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 240,
  justifyContent: 'center',
}

const transcriptStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

function conversationEventStyle(type: ConversationEvent['type']): React.CSSProperties {
  const userLaunch = type === 'user_launch'
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: userLaunch ? '16px 18px' : '14px 16px',
    borderRadius: 20,
    border: `1px solid ${userLaunch ? 'rgba(184, 100, 59, 0.22)' : palette.border}`,
    background: userLaunch ? 'rgba(184, 100, 59, 0.08)' : palette.panelRaised,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: userLaunch ? '0 12px 28px rgba(23, 26, 31, 0.05)' : 'none',
  }
}

const conversationEventHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const conversationEventTypeStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 11,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: '"IBM Plex Mono", monospace',
}

const conversationEventTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 16,
  lineHeight: 1.4,
  fontWeight: 600,
}

const conversationEventBodyStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
}

const conversationEventMetaStyle: React.CSSProperties = {
  color: palette.textSoft,
  fontSize: 12,
  lineHeight: 1.45,
}

const composerDockStyle: React.CSSProperties = {
  padding: '0 24px 22px',
  borderTop: `1px solid ${palette.border}`,
  background: 'linear-gradient(180deg, rgba(247, 242, 232, 0) 0%, rgba(247, 242, 232, 0.78) 32%, rgba(247, 242, 232, 0.98) 100%)',
}

const composerSurfaceStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 24,
  border: `1px solid ${palette.borderStrong}`,
  background: palette.panelRaised,
  boxShadow: '0 18px 40px rgba(23, 26, 31, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const homeLauncherSurfaceStyle: React.CSSProperties = {
  ...composerSurfaceStyle,
  marginTop: 0,
}

const composerHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
}

const composerStatusRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 6,
}

const chatComposerSelectStyle: React.CSSProperties = {
  ...utilityStyles.select,
  minWidth: 220,
  borderRadius: 14,
}

const chatComposerTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 116,
  borderRadius: 18,
  border: `1px solid ${palette.borderStrong}`,
  background: palette.paper,
  color: palette.ink,
  padding: '14px 16px',
  resize: 'vertical',
  fontSize: 14,
  lineHeight: 1.55,
  outline: 'none',
}

const chatComposerFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 16,
  flexWrap: 'wrap',
}

const chatComposerHintsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const chatHintChipStyle: React.CSSProperties = {
  borderRadius: 999,
  border: `1px solid ${palette.border}`,
  background: palette.panel,
  color: palette.textMuted,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
}

const workspaceScrollStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '22px 24px 24px',
}

const pageHeaderShellStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 16,
}

const pageHeaderActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 8,
}

const homeContextGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const homeContextCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 16,
  border: `1px solid ${palette.border}`,
  background: palette.panel,
  minWidth: 0,
}

const homeContextValueStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 16,
  lineHeight: 1.35,
  fontWeight: 600,
  wordBreak: 'break-word',
}

const homeContextMetaStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 12,
  lineHeight: 1.45,
  wordBreak: 'break-word',
}

const packGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
}

const homeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

const homePrimaryColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const homeSecondaryColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const launchComposerStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const modeSelectorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
}

function modeCardStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '14px 16px',
    borderRadius: 16,
    border: `1px solid ${active ? 'rgba(184, 100, 59, 0.38)' : palette.border}`,
    background: active ? 'rgba(184, 100, 59, 0.08)' : palette.panel,
    color: palette.ink,
    textAlign: 'left',
    cursor: 'pointer',
  }
}

const modeCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 10,
}

const modeCardTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 16,
  lineHeight: 1.3,
  fontWeight: 600,
}

const launchContextGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
}

const launchContextTileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  borderRadius: 12,
  background: 'rgba(247, 242, 232, 0.04)',
  border: '1px solid rgba(247, 242, 232, 0.08)',
}

const contextValueStyle: React.CSSProperties = {
  color: palette.inspectText,
  fontSize: 15,
  lineHeight: 1.35,
  fontWeight: 600,
}

const launchTextAreaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const launchTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 156,
  borderRadius: 16,
  border: `1px solid ${palette.borderStrong}`,
  background: palette.panelRaised,
  color: palette.ink,
  padding: '16px 18px',
  resize: 'vertical',
  fontSize: 14,
  lineHeight: 1.55,
  outline: 'none',
}

const capabilityRailStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
}

function capabilityChipStyle(kind: CapabilityItem['kind']): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    border: `1px solid ${kind === 'pack' ? 'rgba(44, 122, 120, 0.22)' : palette.border}`,
    background: kind === 'pack' ? 'rgba(44, 122, 120, 0.08)' : palette.panel,
    color: palette.ink,
    cursor: 'pointer',
    textAlign: 'left',
  }
}

function buttonStyleForState(
  base: React.CSSProperties,
  disabled = false,
): React.CSSProperties {
  if (!disabled) return base
  return {
    ...base,
    opacity: 0.54,
    cursor: 'not-allowed',
    boxShadow: 'none',
  }
}

const capabilityChipBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
}

const capabilityChipLabelStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 600,
  color: palette.ink,
}

const capabilityChipHintStyle: React.CSSProperties = {
  color: palette.textMuted,
  fontSize: 12,
  lineHeight: 1.4,
}

const launchPreviewStyle: React.CSSProperties = {
  margin: 0,
  marginTop: 8,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 220,
  overflow: 'auto',
  fontSize: 12,
  lineHeight: 1.55,
  color: palette.inspectText,
}

const snapshotLeadStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '4px 2px 2px',
}

const studioGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
}

const modePostureGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 12,
}

const modePostureCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 16,
  background: palette.panel,
  border: `1px solid ${palette.border}`,
}

const studioGroupStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const studioGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 16,
  background: palette.panel,
  border: `1px solid ${palette.border}`,
}

const studioGroupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 10,
}
