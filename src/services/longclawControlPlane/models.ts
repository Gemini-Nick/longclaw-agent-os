import { z } from 'zod/v4'

const JsonRecordSchema = z.record(z.string(), z.unknown()).default({})
const WorkModeValues = ['local', 'cloud_sandbox', 'weclaw_dispatch'] as const
const ExecutionPlaneValues = ['local_executor', 'cloud_executor'] as const
const RuntimeProfileValues = [
  'dev_local_acp_bridge',
  'packaged_local_runtime',
  'cloud_managed_runtime',
] as const
const RuntimeTargetValues = ['local_runtime', 'cloud_runtime'] as const
const InteractionSurfaceValues = ['electron_home', 'weclaw'] as const
const ModelPlaneValues = ['cloud_provider'] as const
const LocalRuntimeSeatValues = ['acp_bridge', 'local_runtime_api', 'unavailable'] as const
type ModeCounts = {
  local: number
  cloud_sandbox: number
  weclaw_dispatch: number
}

const DefaultModeCounts: ModeCounts = {
  local: 0,
  cloud_sandbox: 0,
  weclaw_dispatch: 0,
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function stringListValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => stringValue(item) ?? (typeof item === 'number' ? String(item) : undefined))
    .filter((item): item is string => Boolean(item))
}

function recordListValue(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map(item => recordValue(item))
}

function metricRecordListValue(
  value: unknown,
  labelKey: string,
  valueKey: string,
): Record<string, unknown>[] {
  if (Array.isArray(value)) return recordListValue(value)
  const record = recordValue(value)
  const nested = record.items ?? record.kpis ?? record.metrics ?? record.sources
  if (Array.isArray(nested)) return recordListValue(nested)
  return Object.entries(record).map(([key, item]) => {
    const itemRecord = recordValue(item)
    if (Array.isArray(item)) {
      return { [labelKey]: key, [valueKey]: item.length, metadata: { items: item } }
    }
    return Object.keys(itemRecord).length > 0
      ? { [labelKey]: key, ...itemRecord }
      : { [labelKey]: key, [valueKey]: item }
  })
}

function enumValue<T extends readonly string[]>(value: unknown, candidates: T): T[number] | undefined {
  const normalized = stringValue(value)
  return normalized && (candidates as readonly string[]).includes(normalized)
    ? (normalized as T[number])
    : undefined
}

function runtimeTargetForMode(
  workMode: (typeof WorkModeValues)[number],
): (typeof RuntimeTargetValues)[number] {
  return workMode === 'cloud_sandbox' ? 'cloud_runtime' : 'local_runtime'
}

function interactionSurfaceForMode(
  workMode: (typeof WorkModeValues)[number],
): (typeof InteractionSurfaceValues)[number] {
  return workMode === 'weclaw_dispatch' ? 'weclaw' : 'electron_home'
}

function modelPlaneForMode(): (typeof ModelPlaneValues)[number] {
  return 'cloud_provider'
}

function executionPlaneForMode(
  workMode: (typeof WorkModeValues)[number],
): (typeof ExecutionPlaneValues)[number] {
  return runtimeTargetForMode(workMode) === 'cloud_runtime' ? 'cloud_executor' : 'local_executor'
}

function modeForExecutionPlane(value: unknown): (typeof WorkModeValues)[number] | undefined {
  const executionPlane = stringValue(value)
  if (executionPlane === 'weclaw_dispatch') return 'weclaw_dispatch'
  if (executionPlane === 'local_executor') return 'local'
  if (executionPlane === 'cloud_executor') return 'cloud_sandbox'
  return undefined
}

function inferRuntimeProfile(
  value: unknown,
  metadata: Record<string, unknown> = {},
): (typeof RuntimeProfileValues)[number] {
  return (
    enumValue(value, RuntimeProfileValues) ??
    enumValue(metadata.runtime_profile, RuntimeProfileValues) ??
    'dev_local_acp_bridge'
  )
}

function inferRuntimeTarget(
  value: unknown,
  metadata: Record<string, unknown> = {},
  workMode?: (typeof WorkModeValues)[number],
): (typeof RuntimeTargetValues)[number] {
  const explicit =
    enumValue(value, RuntimeTargetValues) ??
    enumValue(metadata.runtime_target, RuntimeTargetValues)
  if (explicit) return explicit

  const legacy = stringValue(value) ?? stringValue(metadata.execution_plane)
  if (legacy === 'weclaw_dispatch' || legacy === 'local_executor') return 'local_runtime'
  if (legacy === 'cloud_executor') return 'cloud_runtime'

  return runtimeTargetForMode(workMode ?? inferWorkMode(undefined, metadata))
}

function inferInteractionSurface(
  value: unknown,
  metadata: Record<string, unknown> = {},
  workMode?: (typeof WorkModeValues)[number],
  ...fallbacks: unknown[]
): (typeof InteractionSurfaceValues)[number] {
  const explicit =
    enumValue(value, InteractionSurfaceValues) ??
    enumValue(metadata.interaction_surface, InteractionSurfaceValues)
  if (explicit) return explicit

  const candidate =
    stringValue(value) ??
    stringValue(metadata.origin_surface) ??
    stringValue(metadata.launch_surface) ??
    stringValue(metadata.launch_source) ??
    stringValue(metadata.source) ??
    stringValue(metadata.channel) ??
    fallbacks.map(item => stringValue(item)).find((item): item is string => Boolean(item))

  if (candidate) {
    const normalized = candidate.toLowerCase()
    if (normalized.includes('weclaw') || normalized.includes('wechat') || normalized.includes('dispatch')) {
      return 'weclaw'
    }
    if (normalized.includes('electron') || normalized.includes('home') || normalized.includes('desktop')) {
      return 'electron_home'
    }
  }

  return interactionSurfaceForMode(workMode ?? 'cloud_sandbox')
}

function inferModelPlane(
  value: unknown,
  metadata: Record<string, unknown> = {},
): (typeof ModelPlaneValues)[number] {
  return (
    enumValue(value, ModelPlaneValues) ??
    enumValue(metadata.model_plane, ModelPlaneValues) ??
    modelPlaneForMode()
  )
}

function inferLocalRuntimeSeat(
  value: unknown,
  metadata: Record<string, unknown> = {},
  runtimeTarget?: (typeof RuntimeTargetValues)[number],
  runtimeProfile?: (typeof RuntimeProfileValues)[number],
): (typeof LocalRuntimeSeatValues)[number] {
  const explicit =
    enumValue(value, LocalRuntimeSeatValues) ??
    enumValue(metadata.local_runtime_seat, LocalRuntimeSeatValues)
  if (explicit) return explicit

  const effectiveTarget = runtimeTarget ?? inferRuntimeTarget(undefined, metadata)
  if (effectiveTarget === 'cloud_runtime') return 'unavailable'

  const effectiveProfile =
    runtimeProfile ?? inferRuntimeProfile(undefined, metadata)
  if (effectiveProfile === 'packaged_local_runtime') return 'local_runtime_api'
  if (effectiveProfile === 'dev_local_acp_bridge') return 'acp_bridge'
  return 'unavailable'
}

function inferWorkMode(
  value: unknown,
  metadata: Record<string, unknown> = {},
  ...hints: unknown[]
): (typeof WorkModeValues)[number] {
  const runtimeTarget =
    enumValue(value, RuntimeTargetValues) ??
    enumValue(metadata.runtime_target, RuntimeTargetValues)
  const interactionSurface = inferInteractionSurface(undefined, metadata)
  if (runtimeTarget === 'local_runtime' && interactionSurface === 'weclaw') return 'weclaw_dispatch'

  const explicit =
    enumValue(value, WorkModeValues) ??
    enumValue(metadata.work_mode, WorkModeValues) ??
    modeForExecutionPlane(value) ??
    modeForExecutionPlane(metadata.execution_plane)
  if (explicit) return explicit

  const candidates = [
    metadata.origin_surface,
    metadata.launch_surface,
    metadata.launch_source,
    metadata.source,
    metadata.channel,
    ...hints,
  ]
    .map(item => stringValue(item)?.toLowerCase())
    .filter((item): item is string => Boolean(item))

  if (candidates.some(item => item.includes('weclaw') || item.includes('wechat') || item.includes('dispatch'))) {
    return 'weclaw_dispatch'
  }
  if (
    candidates.some(
      item =>
        item.includes('local') ||
        item.includes('workspace') ||
        item.includes('desktop') ||
        item.includes('cli'),
    )
  ) {
    return 'local'
  }
  return runtimeTarget === 'local_runtime' ? 'local' : 'cloud_sandbox'
}

function inferExecutionPlane(
  value: unknown,
  metadata: Record<string, unknown> = {},
  workMode?: (typeof WorkModeValues)[number],
): (typeof ExecutionPlaneValues)[number] {
  return (
    (stringValue(value) === 'weclaw_dispatch' ? 'local_executor' : undefined) ??
    (stringValue(metadata.execution_plane) === 'weclaw_dispatch' ? 'local_executor' : undefined) ??
    enumValue(value, ExecutionPlaneValues) ??
    enumValue(metadata.execution_plane, ExecutionPlaneValues) ??
    executionPlaneForMode(workMode ?? inferWorkMode(undefined, metadata))
  )
}

function inferWorkspaceTarget(
  value: unknown,
  metadata: Record<string, unknown> = {},
  sessionContext: Record<string, unknown> = {},
): string | undefined {
  return (
    stringValue(value) ??
    stringValue(metadata.workspace_target) ??
    stringValue(sessionContext.workspace_root)
  )
}

function normalizeModeCounts(value: unknown): ModeCounts {
  const counts = recordValue(value)
  return {
    local: typeof counts.local === 'number' ? counts.local : 0,
    cloud_sandbox: typeof counts.cloud_sandbox === 'number' ? counts.cloud_sandbox : 0,
    weclaw_dispatch: typeof counts.weclaw_dispatch === 'number' ? counts.weclaw_dispatch : 0,
  }
}

export const LongclawWorkModeSchema = z.enum(WorkModeValues)
export const LongclawExecutionPlaneSchema = z.enum(ExecutionPlaneValues)
export const LongclawRuntimeProfileSchema = z.enum(RuntimeProfileValues)
export const LongclawRuntimeTargetSchema = z.enum(RuntimeTargetValues)
export const LongclawInteractionSurfaceSchema = z.enum(InteractionSurfaceValues)
export const LongclawModelPlaneSchema = z.enum(ModelPlaneValues)
export const LongclawLocalRuntimeSeatSchema = z.enum(LocalRuntimeSeatValues)
export const LongclawModeCountsSchema = z.preprocess(
  normalizeModeCounts,
  z.object({
    local: z.number().default(0),
    cloud_sandbox: z.number().default(0),
    weclaw_dispatch: z.number().default(0),
  }),
)
export const LongclawModeSummarySchema = z.object({
  tasks: LongclawModeCountsSchema.default(DefaultModeCounts),
  runs: LongclawModeCountsSchema.default(DefaultModeCounts),
  work_items: LongclawModeCountsSchema.default(DefaultModeCounts),
})

export const LongclawDomainPackDescriptorSchema = z.object({
  pack_id: z.string(),
  domain: z.string(),
  version: z.string(),
  owner_repo: z.string(),
  runtime: z.string(),
  description: z.string(),
  metadata: JsonRecordSchema,
})

export const LongclawAdapterDescriptorSchema = z.object({
  adapter_id: z.string(),
  channel: z.string(),
  owner_repo: z.string(),
  description: z.string(),
  metadata: JsonRecordSchema,
})

export const LongclawOperatorActionSchema = z.object({
  action_id: z.string(),
  run_id: z.string(),
  kind: z.string(),
  label: z.string(),
  payload: JsonRecordSchema,
  metadata: JsonRecordSchema,
})

export const LongclawDeliveryPreferenceSchema = z.object({
  policy_id: z.string().default('default'),
  live_reply_channel: z.string().nullable().optional(),
  preferred_channels: z.array(z.string()).default([]),
  fallback_channels: z.array(z.string()).default([]),
  windowed_proactive: z.boolean().default(false),
  desktop_fallback: z.boolean().default(true),
  requires_approval: z.boolean().default(false),
  metadata: JsonRecordSchema,
})

export const LongclawRunSchema = z.preprocess(value => {
  const data = recordValue(value)
  const metadata = recordValue(data.metadata)
  const workMode = inferWorkMode(data.work_mode, metadata, data.requested_by)
  const runtimeProfile = inferRuntimeProfile(data.runtime_profile, metadata)
  const runtimeTarget = inferRuntimeTarget(data.runtime_target, metadata, workMode)
  const interactionSurface = inferInteractionSurface(
    data.interaction_surface,
    metadata,
    workMode,
    data.origin_surface,
    data.requested_by,
  )
  return {
    ...data,
    work_mode: workMode,
    origin_surface:
      stringValue(data.origin_surface) ??
      stringValue(metadata.origin_surface) ??
      interactionSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: inferModelPlane(data.model_plane, metadata),
    local_runtime_seat: inferLocalRuntimeSeat(
      data.local_runtime_seat,
      metadata,
      runtimeTarget,
      runtimeProfile,
    ),
    execution_plane: inferExecutionPlane(data.execution_plane, metadata, workMode),
    metadata,
  }
}, z.object({
  run_id: z.string(),
  domain: z.string(),
  capability: z.string(),
  status: z.string(),
  session_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  requested_by: z.string().nullable().optional(),
  work_mode: LongclawWorkModeSchema.default('cloud_sandbox'),
  origin_surface: z.string().nullable().optional(),
  interaction_surface: LongclawInteractionSurfaceSchema.default('electron_home'),
  runtime_profile: LongclawRuntimeProfileSchema.default('dev_local_acp_bridge'),
  runtime_target: LongclawRuntimeTargetSchema.default('cloud_runtime'),
  model_plane: LongclawModelPlaneSchema.default('cloud_provider'),
  local_runtime_seat: LongclawLocalRuntimeSeatSchema.default('unavailable'),
  execution_plane: LongclawExecutionPlaneSchema.default('cloud_executor'),
  summary: z.string().default(''),
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  metadata: JsonRecordSchema,
  pack_id: z.string().optional(),
}))

export const LongclawTaskSchema = z.preprocess(value => {
  const data = recordValue(value)
  const metadata = recordValue(data.metadata)
  const workMode = inferWorkMode(data.work_mode, metadata, data.channel)
  const runtimeProfile = inferRuntimeProfile(data.runtime_profile, metadata)
  const runtimeTarget = inferRuntimeTarget(data.runtime_target, metadata, workMode)
  const interactionSurface = inferInteractionSurface(
    data.interaction_surface,
    metadata,
    workMode,
    data.origin_surface,
    data.channel,
  )
  return {
    ...data,
    work_mode: workMode,
    origin_surface:
      stringValue(data.origin_surface) ??
      stringValue(metadata.origin_surface) ??
      interactionSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: inferModelPlane(data.model_plane, metadata),
    local_runtime_seat: inferLocalRuntimeSeat(
      data.local_runtime_seat,
      metadata,
      runtimeTarget,
      runtimeProfile,
    ),
    execution_plane: inferExecutionPlane(data.execution_plane, metadata, workMode),
    metadata,
  }
}, z.object({
  task_id: z.string(),
  capability: z.string(),
  session_id: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  status: z.string().default('queued'),
  input: JsonRecordSchema,
  work_mode: LongclawWorkModeSchema.default('cloud_sandbox'),
  origin_surface: z.string().nullable().optional(),
  interaction_surface: LongclawInteractionSurfaceSchema.default('electron_home'),
  runtime_profile: LongclawRuntimeProfileSchema.default('dev_local_acp_bridge'),
  runtime_target: LongclawRuntimeTargetSchema.default('cloud_runtime'),
  model_plane: LongclawModelPlaneSchema.default('cloud_provider'),
  local_runtime_seat: LongclawLocalRuntimeSeatSchema.default('unavailable'),
  execution_plane: LongclawExecutionPlaneSchema.default('cloud_executor'),
  run_ids: z.array(z.string()).default([]),
  last_run_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  metadata: JsonRecordSchema,
}))

export const LongclawArtifactSchema = z.object({
  artifact_id: z.string(),
  run_id: z.string(),
  kind: z.string(),
  uri: z.string(),
  title: z.string().default(''),
  metadata: JsonRecordSchema,
})

export const LongclawArtifactRefSchema = z.object({
  kind: z.string(),
  uri: z.string(),
  title: z.string(),
})

export const LongclawLaunchMentionSchema = z.object({
  kind: z.string(),
  value: z.string(),
  label: z.string().nullable().optional(),
  metadata: JsonRecordSchema,
})

export const LongclawLaunchIntentSchema = z.preprocess(value => {
  const data = recordValue(value)
  const metadata = recordValue(data.metadata)
  const sessionContext = recordValue(data.session_context)
  const workMode = inferWorkMode(data.work_mode, metadata, data.source)
  const runtimeProfile = inferRuntimeProfile(data.runtime_profile, metadata)
  const runtimeTarget = inferRuntimeTarget(data.runtime_target, metadata, workMode)
  const interactionSurface = inferInteractionSurface(
    data.interaction_surface,
    metadata,
    workMode,
    data.launch_surface,
    data.source,
  )
  return {
    ...data,
    work_mode: workMode,
    launch_surface:
      stringValue(data.launch_surface) ??
      stringValue(metadata.launch_surface) ??
      interactionSurface,
    interaction_surface: interactionSurface,
    runtime_profile: runtimeProfile,
    runtime_target: runtimeTarget,
    model_plane: inferModelPlane(data.model_plane, metadata),
    local_runtime_seat: inferLocalRuntimeSeat(
      data.local_runtime_seat,
      metadata,
      runtimeTarget,
      runtimeProfile,
    ),
    workspace_target: inferWorkspaceTarget(data.workspace_target, metadata, sessionContext),
    metadata,
    session_context: sessionContext,
  }
}, z.object({
  launch_id: z.string().optional(),
  source: z.string(),
  raw_text: z.string(),
  mentions: z.array(LongclawLaunchMentionSchema).default([]),
  requested_outcome: z.string().nullable().optional(),
  work_mode: LongclawWorkModeSchema.default('cloud_sandbox'),
  launch_surface: z.string().nullable().optional(),
  interaction_surface: LongclawInteractionSurfaceSchema.default('electron_home'),
  runtime_profile: LongclawRuntimeProfileSchema.default('dev_local_acp_bridge'),
  runtime_target: LongclawRuntimeTargetSchema.default('cloud_runtime'),
  model_plane: LongclawModelPlaneSchema.default('cloud_provider'),
  local_runtime_seat: LongclawLocalRuntimeSeatSchema.default('unavailable'),
  workspace_target: z.string().nullable().optional(),
  session_context: JsonRecordSchema,
  delivery_preference: LongclawDeliveryPreferenceSchema.default({
    policy_id: 'default',
    preferred_channels: [],
    fallback_channels: [],
    windowed_proactive: false,
    desktop_fallback: true,
    requires_approval: false,
    metadata: {},
  }),
  created_at: z.string().nullable().optional(),
  metadata: JsonRecordSchema,
}))

export const LongclawPackHealthSchema = z.object({
  pack_id: z.string(),
  health: z
    .object({
      status: z.string().default('unknown'),
      checks: JsonRecordSchema,
    })
    .default({ status: 'unknown', checks: {} }),
})

export const LongclawAdapterHealthSchema = z.object({
  adapter_id: z.string(),
  channel: z.string(),
  status: z.string(),
  last_ingest_at: z.string().nullable().optional(),
  last_delivery_at: z.string().nullable().optional(),
  notes: z.array(z.string()).default([]),
})

export const LongclawRunsSummarySchema = z.object({
  total: z.number().default(0),
  by_status: z.record(z.string(), z.number()).default({}),
  running: z.number().default(0),
  failed: z.number().default(0),
  partial: z.number().default(0),
  succeeded: z.number().default(0),
})

export const LongclawWorkItemsSummarySchema = z.object({
  total: z.number().default(0),
  open: z.number().default(0),
  critical: z.number().default(0),
  warning: z.number().default(0),
  info: z.number().default(0),
})

export const LongclawRecentFailureSchema = z.object({
  run_id: z.string(),
  pack_id: z.string().nullable().optional(),
  status: z.string(),
  work_mode: LongclawWorkModeSchema.default('cloud_sandbox'),
  runtime_profile: LongclawRuntimeProfileSchema.default('dev_local_acp_bridge'),
  runtime_target: LongclawRuntimeTargetSchema.default('cloud_runtime'),
  interaction_surface: LongclawInteractionSurfaceSchema.default('electron_home'),
  model_plane: LongclawModelPlaneSchema.default('cloud_provider'),
  execution_plane: LongclawExecutionPlaneSchema.default('cloud_executor'),
  summary: z.string().default(''),
  created_at: z.string().nullable().optional(),
})

export const LongclawMemoryTargetsSchema = z.object({
  raw: z.string().default(''),
  reviewed: z.string().default(''),
})

export const LongclawWorkItemSchema = z.preprocess(value => {
  const data = recordValue(value)
  const metadata = recordValue(data.metadata)
  const workMode = inferWorkMode(data.work_mode, metadata)
  const interactionSurface = inferInteractionSurface(
    data.interaction_surface,
    metadata,
    workMode,
    data.origin_surface,
  )
  return {
    ...data,
    work_mode: workMode,
    origin_surface:
      stringValue(data.origin_surface) ??
      stringValue(metadata.origin_surface) ??
      interactionSurface,
    interaction_surface: interactionSurface,
    runtime_profile: inferRuntimeProfile(data.runtime_profile, metadata),
    runtime_target: inferRuntimeTarget(data.runtime_target, metadata, workMode),
    model_plane: inferModelPlane(data.model_plane, metadata),
    execution_plane: inferExecutionPlane(data.execution_plane, metadata, workMode),
    metadata,
  }
}, z.object({
  work_item_id: z.string(),
  pack_id: z.string(),
  kind: z.string(),
  title: z.string(),
  summary: z.string().default(''),
  severity: z.string().default('info'),
  status: z.string().default('open'),
  run_id: z.string().nullable().optional(),
  work_mode: LongclawWorkModeSchema.default('cloud_sandbox'),
  origin_surface: z.string().nullable().optional(),
  interaction_surface: LongclawInteractionSurfaceSchema.default('electron_home'),
  runtime_profile: LongclawRuntimeProfileSchema.default('dev_local_acp_bridge'),
  runtime_target: LongclawRuntimeTargetSchema.default('cloud_runtime'),
  model_plane: LongclawModelPlaneSchema.default('cloud_provider'),
  execution_plane: LongclawExecutionPlaneSchema.default('cloud_executor'),
  artifact_refs: z.array(LongclawArtifactRefSchema).default([]),
  operator_actions: z.array(LongclawOperatorActionSchema).default([]),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  metadata: JsonRecordSchema,
}))

export const LongclawConnectorHealthSchema = z.object({
  connector_id: z.string(),
  status: z.string(),
  summary: z.string().default(''),
  details: JsonRecordSchema,
})

export const LongclawPackDiagnosticSchema = z.object({
  diagnostic_id: z.string(),
  status: z.string().default('info'),
  label: z.string(),
  detail: z.string().default(''),
  metadata: JsonRecordSchema.default({}),
})

export const LongclawLaunchReceiptSchema = z.object({
  launch_id: z.string(),
  pack_id: z.string(),
  task: LongclawTaskSchema,
  run: LongclawRunSchema,
  artifacts: z.array(LongclawArtifactSchema).default([]),
  review_actions: z.array(LongclawOperatorActionSchema).default([]),
  work_items: z.array(LongclawWorkItemSchema).default([]),
  compiled_input: JsonRecordSchema,
  metadata: JsonRecordSchema,
})

export const LongclawCapabilityEntrySchema = z.object({
  capability_id: z.string(),
  kind: z.enum(['skill', 'plugin', 'pack']),
  label: z.string(),
  mention: z.string().default(''),
  source: z.string().default('local'),
  description: z.string().default(''),
  summary: z.string().default(''),
  owner: z.string().nullable().optional(),
  curated: z.boolean().default(false),
  provisional: z.boolean().default(false),
  metadata: JsonRecordSchema,
})

export const LongclawCapabilityAliasSchema = z.object({
  alias_id: z.string(),
  label: z.string(),
  mention: z.string(),
  target_kind: z.string(),
  target_value: z.string(),
  description: z.string().default(''),
  curated: z.boolean().default(false),
  metadata: JsonRecordSchema,
})

export const LongclawCapabilityPresetSchema = z.object({
  preset_id: z.string(),
  label: z.string(),
  description: z.string().default(''),
  mentions: z.array(LongclawLaunchMentionSchema).default([]),
  default_pack_id: z.string().nullable().optional(),
  curated: z.boolean().default(false),
  metadata: JsonRecordSchema,
})

export const LongclawCapabilityVisibilitySchema = z.object({
  curated: z.boolean().default(false),
  shows_provisional_inventory: z.boolean().default(true),
  skills_source: z.string().default('filesystem'),
  plugins_source: z.string().default('local_fallback'),
  packs_source: z.string().default('control_plane'),
})

export const LongclawCapabilitySubstrateSummarySchema = z.object({
  generated_at: z.string(),
  source: z.string().default('local_fallback'),
  provisional: z.boolean().default(true),
  flagship_packs: z.array(LongclawDomainPackDescriptorSchema).default([]),
  skills: z.array(LongclawCapabilityEntrySchema).default([]),
  plugins: z.array(LongclawCapabilityEntrySchema).default([]),
  packs: z.array(LongclawCapabilityEntrySchema).default([]),
  aliases: z.array(LongclawCapabilityAliasSchema).default([]),
  presets: z.array(LongclawCapabilityPresetSchema).default([]),
  last_used_capabilities: z.array(LongclawCapabilityEntrySchema).default([]),
  visibility: LongclawCapabilityVisibilitySchema.default({
    curated: false,
    shows_provisional_inventory: true,
    skills_source: 'filesystem',
    plugins_source: 'local_fallback',
    packs_source: 'control_plane',
  }),
  metadata: JsonRecordSchema,
})

export const LongclawControlPlaneOverviewSchema = z.object({
  packs: z.array(LongclawDomainPackDescriptorSchema).default([]),
  adapters: z.array(LongclawAdapterDescriptorSchema).default([]),
  packHealth: z.array(LongclawPackHealthSchema).default([]),
  adapterHealth: z.array(LongclawAdapterHealthSchema).default([]),
  mode_summary: LongclawModeSummarySchema.default({
    tasks: DefaultModeCounts,
    runs: DefaultModeCounts,
    work_items: DefaultModeCounts,
  }),
  runs_summary: LongclawRunsSummarySchema.default({
    total: 0,
    by_status: {},
    running: 0,
    failed: 0,
    partial: 0,
    succeeded: 0,
  }),
  work_items_summary: LongclawWorkItemsSummarySchema.default({
    total: 0,
    open: 0,
    critical: 0,
    warning: 0,
    info: 0,
  }),
  recent_failures: z.array(LongclawRecentFailureSchema).default([]),
  memoryTargets: LongclawMemoryTargetsSchema.default({ raw: '', reviewed: '' }),
})

export const DueDiligenceDashboardSchema = z.object({
  pack_id: z.literal('due_diligence'),
  title: z.string().default('Due Diligence'),
  status: z.string().default('healthy'),
  notice: z.string().default(''),
  diagnostics: z.array(LongclawPackDiagnosticSchema).default([]),
  recent_runs: z.array(LongclawRunSchema).default([]),
  manual_review_queue: z.array(z.object({
    review_id: z.string(),
    run_id: z.string(),
    site_slug: z.string(),
    lane: z.string(),
    status: z.string(),
    summary: z.string().default(''),
    artifact_refs: z.array(LongclawArtifactRefSchema).default([]),
    operator_actions: z.array(LongclawOperatorActionSchema).default([]),
    created_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    evidence_root: z.string().nullable().optional(),
    report_path: z.string().nullable().optional(),
    report_json_path: z.string().nullable().optional(),
    metadata: JsonRecordSchema.optional(),
  })).default([]),
  repair_cases: z.array(z.object({
    case_id: z.string(),
    site_slug: z.string(),
    lane: z.string(),
    failure_fingerprint: z.string(),
    trigger_reason: z.string().default(''),
    status: z.string(),
    recent_run_ids: z.array(z.string()).default([]),
    replay_pack_path: z.string().nullable().optional(),
    operator_actions: z.array(LongclawOperatorActionSchema).default([]),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })).default([]),
  site_health: z.array(z.object({
    site_slug: z.string(),
    lane: z.string(),
    total_runs: z.number().default(0),
    recent_success_rate: z.number().default(0),
    last_run_status: z.string().default(''),
    failure_fingerprints: z.array(z.string()).default([]),
    recommended_action: z.string().default('continue'),
    operator_actions: z.array(LongclawOperatorActionSchema).default([]),
  })).default([]),
  operator_actions: z.array(LongclawOperatorActionSchema).default([]),
})

const SignalsCandidateSchema = z.object({
  symbol: z.string(),
  name: z.string().default(''),
  score: z.number().default(0),
  direction: z.string().default(''),
  reason: z.string().default(''),
  status: z.string().default('open'),
  metadata: JsonRecordSchema.default({}),
})

const SignalsChartContextSchema = z.object({
  symbol: z.string().default(''),
  freq: z.string().default('daily'),
  conclusion: z.string().default(''),
  latest_signal: z.string().default(''),
  key_levels: z.array(z.object({
    name: z.string(),
    value: z.number(),
    position: z.string().default(''),
    distance_pct: z.number().nullable().optional(),
  })).default([]),
  signal_markers: z.array(z.object({
    time: z.number().optional(),
    date_str: z.string().default(''),
    type: z.string().default(''),
    price: z.number().nullable().optional(),
    confidence: z.number().nullable().optional(),
  })).default([]),
  ohlcv_preview: z.array(z.object({
    time: z.number(),
    close: z.number(),
  })).default([]),
  metadata: JsonRecordSchema.default({}),
})

const SignalsBacktestJobSchema = z.object({
  job_id: z.string(),
  status: z.string().default('idle'),
  symbol: z.string().default(''),
  freq: z.string().default(''),
  summary: z.string().default(''),
  updated_at: z.string().nullable().optional(),
  source: z.string().default('web2'),
  metadata: JsonRecordSchema.default({}),
})

const SignalsDeepLinkSchema = z.object({
  link_id: z.string(),
  label: z.string(),
  url: z.string(),
  kind: z.string().default('web'),
})

const SignalsOverviewSchema = z.object({
  market_regime: JsonRecordSchema.default({}),
  cluster_summary: JsonRecordSchema.default({}),
  review_summary: JsonRecordSchema.default({}),
  data_warning: z.string().default(''),
})

const SignalsDailyBriefSchema = z.preprocess(value => {
  if (typeof value === 'string') return { summary: value }
  const record = recordValue(value)
  const riskNotes = stringListValue(record.risk_notes).join(' · ')
  return {
    ...record,
    as_of:
      stringValue(record.as_of) ??
      stringValue(record.updated_at) ??
      stringValue(record.generated_at) ??
      '',
    headline:
      stringValue(record.headline) ??
      stringValue(record.title) ??
      '',
    summary:
      stringValue(record.summary) ??
      stringValue(record.text) ??
      stringValue(record.brief) ??
      '',
    bullets: stringListValue(
      record.bullets ??
        record.items ??
        record.highlights ??
        record.next_actions,
    ),
    market_bias:
      stringValue(record.market_bias) ??
      stringValue(record.market_line) ??
      stringValue(record.bias) ??
      '',
    risk_note:
      stringValue(record.risk_note) ??
      (riskNotes || stringValue(record.warning)) ??
      '',
    metadata: recordValue(record.metadata),
  }
}, z.object({
  as_of: z.string().default(''),
  headline: z.string().default(''),
  summary: z.string().default(''),
  bullets: z.array(z.string()).default([]),
  market_bias: z.string().default(''),
  risk_note: z.string().default(''),
  metadata: JsonRecordSchema.default({}),
}).passthrough().default({
  as_of: '',
  headline: '',
  summary: '',
  bullets: [],
  market_bias: '',
  risk_note: '',
  metadata: {},
}))

const SignalsDecisionQueueItemSchema = z.preprocess(value => {
  if (typeof value === 'string') return { title: value }
  const record = recordValue(value)
  return {
    ...record,
    decision_id:
      stringValue(record.decision_id) ??
      stringValue(record.action_id) ??
      stringValue(record.id) ??
      stringValue(record.queue_id) ??
      '',
    title:
      stringValue(record.title) ??
      stringValue(record.label) ??
      stringValue(record.symbol) ??
      '',
    summary:
      stringValue(record.summary) ??
      stringValue(record.next_action) ??
      stringValue(record.reason) ??
      stringValue(record.rationale) ??
      '',
    status: stringValue(record.status) ?? 'open',
    priority: stringValue(record.priority) ?? '',
    symbol: stringValue(record.symbol) ?? '',
    action:
      stringValue(record.action) ??
      stringValue(record.recommended_action) ??
      '',
    rationale:
      stringValue(record.rationale) ??
      stringValue(record.reason) ??
      '',
    metadata: recordValue(record.metadata),
    operator_actions: Array.isArray(record.operator_actions) ? record.operator_actions : [],
  }
}, z.object({
  decision_id: z.string().default(''),
  title: z.string().default(''),
  summary: z.string().default(''),
  status: z.string().default('open'),
  priority: z.string().default(''),
  symbol: z.string().default(''),
  action: z.string().default(''),
  rationale: z.string().default(''),
  metadata: JsonRecordSchema.default({}),
  operator_actions: z.array(LongclawOperatorActionSchema).default([]),
}).passthrough())

const SignalsStrategyKpiSchema = z.preprocess(value => {
  const record = recordValue(value)
  return {
    ...record,
    kpi_id:
      stringValue(record.kpi_id) ??
      stringValue(record.id) ??
      stringValue(record.label) ??
      '',
    label:
      stringValue(record.label) ??
      stringValue(record.name) ??
      stringValue(record.kpi_id) ??
      '',
    value: record.value ?? record.current ?? record.count ?? 0,
    unit: stringValue(record.unit) ?? '',
    status: stringValue(record.status) ?? '',
    trend: stringValue(record.trend) ?? '',
    metadata: recordValue(record.metadata),
  }
}, z.object({
  kpi_id: z.string().default(''),
  label: z.string().default(''),
  value: z.union([z.number(), z.string()]).default(0),
  unit: z.string().default(''),
  status: z.string().default(''),
  trend: z.string().default(''),
  metadata: JsonRecordSchema.default({}),
}).passthrough())

const SignalsSourceConfidenceSchema = z.preprocess(value => {
  const record = recordValue(value)
  return {
    ...record,
    source_id:
      stringValue(record.source_id) ??
      stringValue(record.connector_id) ??
      stringValue(record.name) ??
      stringValue(record.id) ??
      stringValue(record.label) ??
      '',
    label:
      stringValue(record.label) ??
      stringValue(record.name) ??
      stringValue(record.source_id) ??
      '',
    confidence: record.confidence ?? record.score ?? 0,
    status: stringValue(record.status) ?? stringValue(record.freshness) ?? '',
    summary:
      stringValue(record.summary) ??
      stringValue(record.source) ??
      stringValue(record.detail) ??
      '',
    metadata: recordValue(record.metadata),
  }
}, z.object({
  source_id: z.string().default(''),
  label: z.string().default(''),
  confidence: z.union([z.number(), z.string()]).default(0),
  status: z.string().default(''),
  summary: z.string().default(''),
  metadata: JsonRecordSchema.default({}),
}).passthrough())

export const SignalsDashboardSchema = z.object({
  pack_id: z.literal('signals'),
  title: z.string().default('Signals'),
  status: z.string().default('healthy'),
  notice: z.string().default(''),
  diagnostics: z.array(LongclawPackDiagnosticSchema).default([]),
  overview: SignalsOverviewSchema.default({
    market_regime: {},
    cluster_summary: {},
    review_summary: {},
    data_warning: '',
  }),
  daily_brief: SignalsDailyBriefSchema,
  decision_queue: z.array(SignalsDecisionQueueItemSchema).default([]),
  strategy_kpis: z.preprocess(
    value => metricRecordListValue(value, 'label', 'value'),
    z.array(SignalsStrategyKpiSchema).default([]),
  ),
  source_confidence: z.preprocess(
    value => metricRecordListValue(value, 'label', 'confidence'),
    z.array(SignalsSourceConfidenceSchema).default([]),
  ),
  recent_runs: z.array(LongclawRunSchema).default([]),
  review_runs: z.array(LongclawRunSchema).default([]),
  buy_candidates: z.array(SignalsCandidateSchema).default([]),
  sell_warnings: z.array(SignalsCandidateSchema).default([]),
  chart_context: SignalsChartContextSchema.nullable().default(null),
  backtest_summary: z.object({
    total: z.number().default(0),
    evaluated: z.number().default(0),
    pending: z.number().default(0),
  }).default({ total: 0, evaluated: 0, pending: 0 }),
  backtest_jobs: z.array(SignalsBacktestJobSchema).default([]),
  pending_backlog_preview: z.array(z.object({
    symbol: z.string(),
    signal_date: z.string(),
    signal_type: z.string(),
    freq: z.string(),
    created_at: z.string().nullable().optional(),
  })).default([]),
  connector_health: z.array(LongclawConnectorHealthSchema).default([]),
  deep_links: z.array(SignalsDeepLinkSchema).default([]),
  operator_actions: z.array(LongclawOperatorActionSchema).default([]),
})

export type LongclawDomainPackDescriptor = z.infer<typeof LongclawDomainPackDescriptorSchema>
export type LongclawAdapterDescriptor = z.infer<typeof LongclawAdapterDescriptorSchema>
export type LongclawOperatorAction = z.infer<typeof LongclawOperatorActionSchema>
export type LongclawDeliveryPreference = z.infer<typeof LongclawDeliveryPreferenceSchema>
export type LongclawWorkMode = z.infer<typeof LongclawWorkModeSchema>
export type LongclawExecutionPlane = z.infer<typeof LongclawExecutionPlaneSchema>
export type LongclawRuntimeProfile = z.infer<typeof LongclawRuntimeProfileSchema>
export type LongclawRuntimeTarget = z.infer<typeof LongclawRuntimeTargetSchema>
export type LongclawInteractionSurface = z.infer<typeof LongclawInteractionSurfaceSchema>
export type LongclawModelPlane = z.infer<typeof LongclawModelPlaneSchema>
export type LongclawModeCounts = z.infer<typeof LongclawModeCountsSchema>
export type LongclawModeSummary = z.infer<typeof LongclawModeSummarySchema>
export type LongclawRun = z.infer<typeof LongclawRunSchema>
export type LongclawTask = z.infer<typeof LongclawTaskSchema>
export type LongclawArtifact = z.infer<typeof LongclawArtifactSchema>
export type LongclawArtifactRef = z.infer<typeof LongclawArtifactRefSchema>
export type LongclawLaunchMention = z.infer<typeof LongclawLaunchMentionSchema>
export type LongclawLaunchIntent = z.infer<typeof LongclawLaunchIntentSchema>
export type LongclawPackHealth = z.infer<typeof LongclawPackHealthSchema>
export type LongclawAdapterHealth = z.infer<typeof LongclawAdapterHealthSchema>
export type LongclawWorkItem = z.infer<typeof LongclawWorkItemSchema>
export type LongclawLaunchReceipt = z.infer<typeof LongclawLaunchReceiptSchema>
export type LongclawCapabilityEntry = z.infer<typeof LongclawCapabilityEntrySchema>
export type LongclawCapabilityAlias = z.infer<typeof LongclawCapabilityAliasSchema>
export type LongclawCapabilityPreset = z.infer<typeof LongclawCapabilityPresetSchema>
export type LongclawCapabilityVisibility = z.infer<typeof LongclawCapabilityVisibilitySchema>
export type LongclawCapabilitySubstrateSummary = z.infer<
  typeof LongclawCapabilitySubstrateSummarySchema
>
export type LongclawStudioSummary = LongclawCapabilitySubstrateSummary
export type LongclawControlPlaneOverview = z.infer<typeof LongclawControlPlaneOverviewSchema>
export type DueDiligenceDashboard = z.infer<typeof DueDiligenceDashboardSchema>
export type SignalsDashboard = z.infer<typeof SignalsDashboardSchema>
export type LongclawPackDashboard = DueDiligenceDashboard | SignalsDashboard
