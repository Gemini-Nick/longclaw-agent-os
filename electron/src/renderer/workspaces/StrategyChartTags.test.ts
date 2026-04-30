import { describe, expect, it } from 'vitest'

import { rankLabelForWatchlist, rankReasonForWatchlist, signalScopeLabel, tagsForWatchlist } from './StrategyChartTags.js'

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

  it('formats backend ranking fields without client-side sorting', () => {
    const row = {
      rank: 2,
      rank_score: 142.5,
      rank_reason: '执行确认+36.0 · 5m/15m确认+24.0',
    }

    expect(rankLabelForWatchlist(row)).toBe('#2 142.5')
    expect(rankReasonForWatchlist(row)).toBe('执行确认+36.0 · 5m/15m确认+24.0')
  })

  it('labels signal display scopes for chart evidence groups', () => {
    expect(signalScopeLabel({ display_scope: 'higher_timeframe_context' })).toBe('上级周期')
    expect(signalScopeLabel({ display_scope: 'other_timeframe' })).toBe('其它周期')
    expect(signalScopeLabel({ display_scope: 'current_timeframe' })).toBe('本周期')
    expect(signalScopeLabel({ freq: '30分钟' }, '30min')).toBe('本周期')
  })
})
