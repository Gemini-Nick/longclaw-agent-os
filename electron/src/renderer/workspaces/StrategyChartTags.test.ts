import { describe, expect, it } from 'vitest'

import { tagsForWatchlist } from './StrategyChartTags.js'

describe('StrategyChart watchlist tags', () => {
  it('prioritizes knowledge conflict over generic source tags', () => {
    const tags = tagsForWatchlist({
      source_tags: ['technical_signal', 'chain_core_rep', 'custom_signal'],
      knowledge_confirmation: { status: 'conflict' },
      technical_evidence: { signal_type: '三买', freq: '30分钟' },
      signal_origin: 'technical_signal',
    }, 'stock')

    expect(tags[0]).toBe('知识冲突')
    expect(tags).toContain('硬技术')
    expect(tags).toHaveLength(4)
  })

  it('surfaces resonance tags before regular source tags', () => {
    const tags = tagsForWatchlist({
      source_tags: ['technical_signal', 'chain_core_rep'],
      resonance_context: {
        grade: 'multi_period',
        tags: ['多周期共振', '日周同向'],
      },
      technical_evidence: { signal_type: '趋势买', freq: '日线' },
    }, 'stock')

    expect(tags.slice(0, 2)).toEqual(['多周期共振', '日周同向'])
    expect(tags).toContain('硬技术')
  })

  it('keeps old rows renderable when new fields are absent', () => {
    const tags = tagsForWatchlist({
      source_tags: ['custom_signal'],
      trader_action: '等待5m确认',
      signal_origin: 'custom_signal',
    }, 'stock')

    expect(tags).toEqual(['custom_signal', '等待5m确认'])
  })
})
