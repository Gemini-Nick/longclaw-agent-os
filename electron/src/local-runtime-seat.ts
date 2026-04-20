import { inspectConfiguredAcpBridge } from './acp-client.js'

export type LocalRuntimeSeat = 'acp_bridge' | 'local_runtime_api' | 'unavailable'
export type LocalRuntimeProfile =
  | 'dev_local_acp_bridge'
  | 'packaged_local_runtime'
  | 'cloud_managed_runtime'

export type LocalRuntimeSeatResolution = {
  seat: LocalRuntimeSeat
  available: boolean
  runtimeProfile: LocalRuntimeProfile
  runtimeTarget: 'local_runtime'
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

export function resolveLocalRuntimeSeat(): LocalRuntimeSeatResolution {
  const acpBridge = inspectConfiguredAcpBridge()
  const localRuntimeApiUrl = envValue('LONGCLAW_LOCAL_RUNTIME_API_URL')
  const localRuntimeApiKey = envValue('LONGCLAW_LOCAL_RUNTIME_API_KEY')

  if (acpBridge.available) {
    return {
      seat: 'acp_bridge',
      available: true,
      runtimeProfile: 'dev_local_acp_bridge',
      runtimeTarget: 'local_runtime',
      modelPlane: 'cloud_provider',
      acpScript: acpBridge.path,
      acpSource: acpBridge.source,
      localRuntimeApiUrl,
      localRuntimeApiKeyConfigured: Boolean(localRuntimeApiKey),
    }
  }

  if (localRuntimeApiUrl) {
    return {
      seat: 'local_runtime_api',
      available: true,
      runtimeProfile: 'packaged_local_runtime',
      runtimeTarget: 'local_runtime',
      modelPlane: 'cloud_provider',
      localRuntimeApiUrl,
      localRuntimeApiKeyConfigured: Boolean(localRuntimeApiKey),
    }
  }

  return {
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
}

export async function probeLocalRuntimeSeat(
  fetchImpl: typeof fetch = fetch,
): Promise<LocalRuntimeSeatResolution & { healthOk: boolean }> {
  const resolution = resolveLocalRuntimeSeat()
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
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const resolution = resolveLocalRuntimeSeat()
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
