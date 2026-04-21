import { inspectConfiguredAcpBridge } from './acp-client.js'

export type LocalRuntimeSeat = 'acp_bridge' | 'local_runtime_api' | 'unavailable'
export type LocalRuntimeSeatPreference =
  | 'auto'
  | 'force_acp'
  | 'force_local_runtime_api'
export type LocalRuntimeProfile =
  | 'dev_local_acp_bridge'
  | 'packaged_local_runtime'
  | 'cloud_managed_runtime'

export type LocalRuntimeSeatResolution = {
  preference: LocalRuntimeSeatPreference
  seat: LocalRuntimeSeat
  available: boolean
  runtimeProfile: LocalRuntimeProfile
  runtimeTarget: 'local_runtime' | 'cloud_runtime'
  modelPlane: 'cloud_provider'
  acpScript?: string
  acpSource?: string
  localRuntimeApiUrl?: string
  localRuntimeApiKeyConfigured: boolean
}

export type LocalRuntimeLaunchPayload = {
  launch_id: string
  task_id: string
  work_mode: string
  requested_outcome: string
  mentions: Array<Record<string, unknown>>
  workspace_root?: string
  runtime_profile: LocalRuntimeProfile
  model_plane: 'cloud_provider'
  raw_text: string
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function normalizeLocalRuntimeSeatPreference(
  value: unknown,
): LocalRuntimeSeatPreference {
  return value === 'force_acp' || value === 'force_local_runtime_api' ? value : 'auto'
}

export function resolveLocalRuntimeSeat(
  preference: LocalRuntimeSeatPreference = 'auto',
): LocalRuntimeSeatResolution {
  const acpBridge = inspectConfiguredAcpBridge()
  const localRuntimeApiUrl = envValue('LONGCLAW_LOCAL_RUNTIME_API_URL')
  const localRuntimeApiKey = envValue('LONGCLAW_LOCAL_RUNTIME_API_KEY')

  const unavailableResolution: LocalRuntimeSeatResolution = {
    preference,
    seat: 'unavailable',
    available: false,
    runtimeProfile: 'dev_local_acp_bridge',
    runtimeTarget: 'local_runtime',
    modelPlane: 'cloud_provider',
    acpScript: acpBridge.path,
    acpSource: acpBridge.source,
    localRuntimeApiUrl,
    localRuntimeApiKeyConfigured: Boolean(localRuntimeApiKey),
  }

  if (preference === 'force_acp') {
    return acpBridge.available
      ? {
          ...unavailableResolution,
          seat: 'acp_bridge',
          available: true,
          runtimeProfile: 'dev_local_acp_bridge',
        }
      : unavailableResolution
  }

  if (preference === 'force_local_runtime_api') {
    return localRuntimeApiUrl
      ? {
          ...unavailableResolution,
          seat: 'local_runtime_api',
          available: true,
          runtimeProfile: 'packaged_local_runtime',
        }
      : unavailableResolution
  }

  if (acpBridge.available) {
    return {
      ...unavailableResolution,
      seat: 'acp_bridge',
      available: true,
      runtimeProfile: 'dev_local_acp_bridge',
    }
  }

  if (localRuntimeApiUrl) {
    return {
      ...unavailableResolution,
      seat: 'local_runtime_api',
      available: true,
      runtimeProfile: 'packaged_local_runtime',
    }
  }

  return unavailableResolution
}

export async function probeLocalRuntimeSeat(
  preference: LocalRuntimeSeatPreference = 'auto',
  fetchImpl: typeof fetch = fetch,
): Promise<LocalRuntimeSeatResolution & { healthOk: boolean }> {
  const resolution = resolveLocalRuntimeSeat(preference)
  if (resolution.seat !== 'local_runtime_api' || !resolution.localRuntimeApiUrl) {
    return {
      ...resolution,
      healthOk: resolution.available,
    }
  }

  try {
    const response = await fetchImpl(
      `${resolution.localRuntimeApiUrl.replace(/\/$/, '')}/health`,
      {
        headers: buildLocalRuntimeHeaders(),
      },
    )
    return {
      ...resolution,
      available: response.ok,
      healthOk: response.ok,
    }
  } catch {
    return {
      ...resolution,
      available: false,
      healthOk: false,
    }
  }
}

function buildLocalRuntimeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const apiKey = envValue('LONGCLAW_LOCAL_RUNTIME_API_KEY')
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

export async function dispatchToLocalRuntimeApi(
  payload: LocalRuntimeLaunchPayload,
  preference: LocalRuntimeSeatPreference = 'auto',
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const resolution = resolveLocalRuntimeSeat(preference)
  if (resolution.seat !== 'local_runtime_api' || !resolution.localRuntimeApiUrl) {
    throw new Error('Local Runtime API is not configured.')
  }

  const response = await fetchImpl(
    `${resolution.localRuntimeApiUrl.replace(/\/$/, '')}/launches`,
    {
      method: 'POST',
      headers: buildLocalRuntimeHeaders(),
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw new Error(`Local Runtime API launch failed: ${response.status}`)
  }

  return (await response.json()) as Record<string, unknown>
}
