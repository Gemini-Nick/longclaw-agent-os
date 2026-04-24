type ObservationIpcResult = {
  ok: boolean
  run_id?: string
  observation_dir?: string
}

type ApiError = Error & {
  status?: number
  payload?: Record<string, unknown>
}

type ObservedFetchOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  source: string
  action?: string
}

declare global {
  interface Window {
    longclawObservation?: {
      getContext: () => Promise<ObservationIpcResult & Record<string, unknown>>
      recordEvent: (payload: Record<string, unknown>) => Promise<ObservationIpcResult>
      recordApiTiming: (payload: Record<string, unknown>) => Promise<ObservationIpcResult>
    }
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function safeInvoke(callback: () => Promise<unknown>) {
  void callback().catch(() => {
    // Observation must never break the product surface.
  })
}

export function recordObservationEvent(name: string, payload: Record<string, unknown> = {}) {
  if (!window.longclawObservation) return
  safeInvoke(() =>
    window.longclawObservation!.recordEvent({
      name,
      level: payload.level ?? 'info',
      ...payload,
    }),
  )
}

export async function observedFetchJson<T>(
  baseUrl: string,
  path: string,
  options: ObservedFetchOptions,
): Promise<T> {
  const startedAt = performance.now()
  const timeoutMs = options.timeoutMs ?? 120_000
  const controller = new AbortController()
  let didTimeout = false
  const abortFromCaller = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timer = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  let status: number | undefined
  let ok = false
  let errorMessage: string | undefined

  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal })
    status = response.status
    let payload: unknown = {}
    try {
      payload = await response.json()
    } catch {
      payload = {}
    }
    if (!response.ok) {
      const error = new Error(
        stringValue(recordValue(payload).detail) ??
          stringValue(recordValue(payload).error) ??
          `${response.status} ${path}`,
      ) as ApiError
      error.status = response.status
      error.payload = recordValue(payload)
      throw error
    }
    ok = true
    return payload as T
  } catch (rawError) {
    const error = rawError as ApiError
    errorMessage = didTimeout ? `timeout after ${timeoutMs}ms` : error.message
    if (didTimeout) {
      throw new Error(errorMessage) as ApiError
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortFromCaller)
    const durationMs = Math.round(performance.now() - startedAt)
    if (window.longclawObservation) {
      safeInvoke(() =>
        window.longclawObservation!.recordApiTiming({
          source: options.source,
          action: options.action,
          endpoint: path,
          method: 'GET',
          status,
          ok,
          aborted: options.signal?.aborted || controller.signal.aborted,
          timeout: didTimeout,
          timeout_ms: timeoutMs,
          duration_ms: durationMs,
          error: errorMessage,
        }),
      )
    }
  }
}

export {}
