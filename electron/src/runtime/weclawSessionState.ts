export type WeclawSessionUiFlags = {
  hidden: boolean
  archived: boolean
  updated_at: string
}

export type WeclawSessionUiState = Record<string, WeclawSessionUiFlags>

type WeclawCanonicalSessionInput = {
  sessionId: string
  userId?: string
  title?: string
  canonicalMetadata?: Record<string, unknown>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session'
}

export function canonicalWeclawSessionId(input: WeclawCanonicalSessionInput): string {
  const metadata = isPlainRecord(input.canonicalMetadata) ? input.canonicalMetadata : {}
  const metadataKeys = [
    'canonical_session_id',
    'canonicalSessionID',
    'canonical_session',
    'conversation_id',
    'conversationId',
    'thread_id',
    'threadId',
    'chat_id',
    'chatId',
    'room_id',
    'roomId',
  ]
  for (const key of metadataKeys) {
    const value = stringValue(metadata[key])
    if (value) {
      return `canonical:${slugify(value)}`
    }
  }
  if (input.userId) return `user:${slugify(input.userId)}`
  if (input.title) return `title:${slugify(input.title)}`
  return `session:${slugify(input.sessionId)}`
}

export function normalizeWeclawSessionUiState(value: unknown): WeclawSessionUiState {
  if (!isPlainRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => {
        const record = isPlainRecord(entry) ? entry : {}
        return [
          key,
          {
            hidden: record.hidden === true,
            archived: record.archived === true,
            updated_at:
              stringValue(record.updated_at) ??
              stringValue(record.updatedAt) ??
              new Date(0).toISOString(),
          },
        ] as const
      })
      .filter(([key]) => Boolean(key)),
  )
}

export function mergeWeclawSessionUiFlags(
  current: WeclawSessionUiState,
  canonicalSessionId: string,
  patch: Partial<Pick<WeclawSessionUiFlags, 'hidden' | 'archived'>>,
): WeclawSessionUiState {
  const previous = current[canonicalSessionId] ?? {
    hidden: false,
    archived: false,
    updated_at: new Date(0).toISOString(),
  }
  return {
    ...current,
    [canonicalSessionId]: {
      hidden: patch.hidden ?? previous.hidden,
      archived: patch.archived ?? previous.archived,
      updated_at: new Date().toISOString(),
    },
  }
}

export function sessionMatchesSource(
  sourceLabel: string | undefined,
  filter: 'all' | 'wechat' | 'weclaw',
): boolean {
  if (filter === 'all') return true
  const normalized = String(sourceLabel ?? '').toLowerCase()
  return filter === 'wechat' ? normalized.includes('wechat') : normalized.includes('weclaw')
}
