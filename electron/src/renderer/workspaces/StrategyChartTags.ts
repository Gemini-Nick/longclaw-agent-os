type WatchlistSignalBadge = {
  label: string
  side: 'buy' | 'sell'
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function compactText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number'
      ? String(value)
      : fallback
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => compactText(item)).filter(Boolean)
    : []
}

function readTimeframeBadgeItems(value: unknown, side: WatchlistSignalBadge['side']): WatchlistSignalBadge[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      const record = recordValue(item)
      const label = compactText(record.badge) || compactText(record.freq)
      const itemSide = compactText(record.side) === 'sell' ? 'sell' : compactText(record.side) === 'buy' ? 'buy' : side
      return label ? { label, side: itemSide } : null
    })
    .filter((item): item is WatchlistSignalBadge => Boolean(item))
}

function timeframeSignalBadges(row: Record<string, unknown>): WatchlistSignalBadge[] {
  const sellBadges = readTimeframeBadgeItems(row.sell_timeframes, 'sell')
  const buyBadges = readTimeframeBadgeItems(row.buy_timeframes, 'buy')
  const seen = new Set<string>()
  return [...sellBadges, ...buyBadges].filter(item => {
    const key = `${item.side}:${item.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function timeframeBadges(row: Record<string, unknown>): string[] {
  return timeframeSignalBadges(row).map(item => item.label)
}

function knowledgeTags(row: Record<string, unknown>): string[] {
  const confirmation = recordValue(row.knowledge_confirmation)
  const status = compactText(confirmation.status)
  if (status === 'conflict') return ['知识冲突']
  if (status === 'confirmed') return ['知识确认']
  if (status === 'watch' || status === 'neutral') return ['知识观察']
  return []
}

function resonanceTags(row: Record<string, unknown>): string[] {
  const resonance = recordValue(row.resonance_context)
  const tags = stringArrayValue(resonance.tags)
  const grade = compactText(resonance.grade)
  const inferred = []
  if (grade === 'conflict') inferred.push('周期冲突')
  if (grade === 'multi_period' || grade === 'strong_resonance') inferred.push('多周期共振')
  if (grade === 'strong_resonance') inferred.push('强共振')
  return [...tags, ...inferred]
}

function technicalTags(row: Record<string, unknown>): string[] {
  const evidence = recordValue(row.technical_evidence)
  const sourceTags = stringArrayValue(row.source_tags)
  const signalType = compactText(evidence.signal_type)
  const freq = compactText(evidence.freq)
  const hasTechnical =
    sourceTags.includes('technical_signal') ||
    compactText(row.signal_origin) === 'technical_signal' ||
    Object.keys(evidence).length > 0
  if (!hasTechnical) return []
  return ['硬技术', signalType, freq].filter(Boolean)
}

export function tagsForWatchlist(row: Record<string, unknown>, kind: string): string[] {
  const mapping = recordValue(row.mapping_chain)
  const carrier = recordValue(row.carrier)
  const chainContext = recordValue(row.chain_context)
  const priorityTags = [
    ...knowledgeTags(row),
    ...resonanceTags(row),
    ...technicalTags(row),
  ]
  const sourceTags = [
    ...(kind === 'stock' ? timeframeBadges(row) : []),
    ...stringArrayValue(row.theme_tags),
    ...stringArrayValue(row.source_tags),
    compactText(row.trader_action),
    compactText(row.signal_origin),
    compactText(row.signal_family),
    compactText(mapping.chain_name),
    compactText(mapping.node_name),
    compactText(chainContext.chain_id),
    compactText(chainContext.node_id),
    compactText(carrier.name),
    compactText(row.source),
  ].filter(Boolean)
  return Array.from(new Set([...priorityTags, ...sourceTags])).slice(0, 4)
}
