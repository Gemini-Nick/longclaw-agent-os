import { describe, expect, it } from 'vitest'

import {
  dailyMaAcceptanceSignalForChart,
  displaySignalsForChart,
  looksLikeIndexValue,
  maAcceptanceFromSymbolData,
  maPeriodsForChart,
  signalCalloutBadgeSummary,
  signalEvidenceCalloutsForChart,
  signalOverlayPriority,
  signalsFromSymbolData,
  shouldAddManualClueForSearch,
  sourceMonitorSummary,
  withSignalCalloutIds,
} from './StrategyChartTerminal.js'

describe('StrategyChartTerminal search clues', () => {
  it('adds a manual clue for every non-index search', () => {
    expect(shouldAddManualClueForSearch('SZ.002759', false)).toBe(true)
    expect(shouldAddManualClueForSearch('天际股份', false)).toBe(true)
  })

  it('does not add manual clues for blank or index searches', () => {
    expect(shouldAddManualClueForSearch('', false)).toBe(false)
    expect(shouldAddManualClueForSearch('沪深300', true)).toBe(false)
  })

  it('does not confuse prefixed stock codes with indices', () => {
    expect(looksLikeIndexValue('SZ.300394')).toBe(false)
    expect(looksLikeIndexValue('SH.000300')).toBe(true)
    expect(looksLikeIndexValue('沪深300')).toBe(true)
  })
})

describe('StrategyChartTerminal source monitor', () => {
  it('shows loaded provider records instead of zero when sources are healthy', () => {
    const summary = sourceMonitorSummary([
      { provider: 'eastmoney', endpoint: 'fullmarket_spot_snapshot', domain: 'market_data', status: 'ok', last_success_at: '2026-05-13T09:44:00' },
      { provider: 'sina', endpoint: 'stock_minute', domain: 'minute', status: 'ok', last_success_at: '2026-05-13T09:43:00' },
    ], [], 'zh-CN')

    expect(summary.value).toBe('2')
    expect(summary.statusLabel).toBe('OK')
    expect(summary.detail).toBe('无阻塞源')
  })

  it('marks provider health as not loaded when no source records arrive', () => {
    const summary = sourceMonitorSummary([], [{ scope: 'postmarket_backfill' }], 'zh-CN')

    expect(summary.value).toBe('0')
    expect(summary.status).toBe('partial')
    expect(summary.statusLabel).toBe('未加载')
    expect(summary.detail).toBe('provider_health 未加载')
  })
})

describe('StrategyChartTerminal MA acceptance evidence', () => {
  it('reads MA acceptance from the symbol summary', () => {
    const acceptance = maAcceptanceFromSymbolData({
      summary: {
        ma_acceptance: {
          summary: 'MA13回踩承接',
          periods: [13],
          primary: {
            period: 13,
            value: 56.787,
            touch_distance_pct: -0.046,
          },
          detail: 'MA13 56.79 / 触线 -0.046%',
        },
      },
    } as any)

    expect(acceptance?.summary).toBe('MA13回踩承接')
    expect(acceptance?.periods).toEqual([13])
    expect(acceptance?.primary.touch_distance_pct).toBe(-0.046)
  })

  it('falls back to signal MA alignment fields', () => {
    const acceptance = maAcceptanceFromSymbolData({
      signals: [
        {
          type: '一买',
          freq: '30min',
          ma_alignment: {
            fib_accept_periods: [13],
            fib_array_summary: 'MA13回踩承接',
            fib_ma_array: [
              {
                period: 13,
                pullback_acceptance: true,
                touch_distance_pct: -0.046,
              },
            ],
          },
        },
      ],
    } as any)

    expect(acceptance?.summary).toBe('MA13回踩承接')
    expect(acceptance?.freq).toBe('daily')
    expect(acceptance?.primary.period).toBe(13)
  })

  it('prioritizes the synthetic daily MA acceptance marker over ordinary technical labels', () => {
    const maPriority = signalOverlayPriority({
      type: 'MA承接',
      signal_family: 'ma_acceptance',
      freq: 'daily',
      ma_acceptance: {
        summary: 'MA13回踩承接',
        periods: [13],
      },
    } as any)
    const macdPriority = signalOverlayPriority({ type: 'MACD' } as any)

    expect(maPriority).toBeGreaterThan(macdPriority)
  })

  it('does not promote 30m technical signals into MA acceptance chart markers', () => {
    const signalPriority = signalOverlayPriority({
      type: '一买',
      freq: '30min',
      ma_acceptance: {
        summary: 'MA13回踩承接',
        periods: [13],
      },
    } as any)
    const maPriority = signalOverlayPriority({
      type: 'MA承接',
      signal_family: 'ma_acceptance',
      freq: 'daily',
      ma_acceptance: {
        summary: 'MA13回踩承接',
        periods: [13],
      },
    } as any)

    expect(signalPriority).toBeLessThan(maPriority)
  })

  it('creates the MA acceptance marker only on the daily chart', () => {
    const acceptance = maAcceptanceFromSymbolData({
      summary: {
        ma_acceptance: {
          summary: 'MA13回踩承接',
          periods: [13],
          primary: {
            period: 13,
            value: 56.787,
          },
          event_dt: '2026-05-12',
        },
      },
    } as any)
    const bars = [
      { timestamp: Date.UTC(2026, 4, 12), open: 59.24, high: 59.8, low: 56.05, close: 58.59, volume: 139 },
    ]

    expect(dailyMaAcceptanceSignalForChart(bars as any, acceptance, '30min')).toBeNull()
    const signal = dailyMaAcceptanceSignalForChart(bars as any, acceptance, 'daily')
    expect(signal?.freq).toBe('daily')
    expect(signal?.signal_family).toBe('ma_acceptance')
    expect(signal?.price).toBe(56.787)
  })
})

describe('StrategyChartTerminal index multi-timeframe signals', () => {
  const bars = [
    { timestamp: Date.UTC(2026, 4, 11, 1, 30), open: 3860, high: 3890, low: 3840, close: 3880, volume: 1200 },
    { timestamp: Date.UTC(2026, 4, 12, 7, 0), open: 3920, high: 3950, low: 3910, close: 3934, volume: 1800 },
  ]

  it('reads index chart signals from the Signals payload', () => {
    const signals = signalsFromSymbolData({
      target: { kind: 'index', label: '创业板指', effective_freq: '30min' },
      chart: {
        signals: [
          {
            dt: bars[1].timestamp / 1000,
            type: '二买',
            freq: '30min',
            display_scope: 'current_timeframe',
            signal_side: 'buy',
          },
        ],
      },
    } as any)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('二买')
    expect(signals[0].display_scope).toBe('current_timeframe')
  })

  it('keeps current, higher, and lower timeframe index markers visible on the chart', () => {
    const visible = displaySignalsForChart(
      bars as any,
      [
        {
          dt: bars[1].timestamp / 1000,
          type: '二买',
          freq: '30min',
          display_scope: 'current_timeframe',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
        {
          dt: bars[1].timestamp / 1000,
          type: '多头上行',
          freq: 'daily',
          display_scope: 'higher_timeframe_context',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
        {
          dt: bars[1].timestamp / 1000,
          type: '一卖',
          freq: '15min',
          display_scope: 'lower_timeframe_context',
          signal_side: 'sell',
          source: 'signals.index_report',
        },
      ] as any,
      '30min',
    )

    expect(visible.map(signal => signal.type)).toEqual(expect.arrayContaining(['二买', '多头上行', '一卖']))
    expect(visible.map(signal => signal.display_scope)).toEqual(expect.arrayContaining([
      'current_timeframe',
      'higher_timeframe_context',
      'lower_timeframe_context',
    ]))
  })

  it('uses Fibonacci MA periods for index price charts', () => {
    expect(maPeriodsForChart('daily', 'index')).toEqual([8, 13, 21, 34, 55, 89])
    expect(maPeriodsForChart('30min', 'index')).toEqual([8, 13, 21, 34, 55, 89])
    expect(maPeriodsForChart('daily', 'stock')).toEqual([5, 10, 20, 60])
  })
})

describe('StrategyChartTerminal signal callouts', () => {
  const bars = [
    { timestamp: Date.UTC(2026, 4, 12, 1, 30), open: 36, high: 38, low: 35, close: 37, volume: 1200 },
    { timestamp: Date.UTC(2026, 4, 12, 2, 0), open: 37, high: 39, low: 36, close: 38, volume: 1800 },
    { timestamp: Date.UTC(2026, 4, 12, 2, 30), open: 38, high: 40, low: 37, close: 39, volume: 2200 },
    { timestamp: Date.UTC(2026, 4, 12, 3, 0), open: 39, high: 41, low: 38, close: 40, volume: 2100 },
    { timestamp: Date.UTC(2026, 4, 12, 3, 30), open: 40, high: 42, low: 39, close: 41, volume: 2400 },
  ]

  it('wraps adjacent multi-timeframe markers into one guided evidence box', () => {
    const callouts = signalEvidenceCalloutsForChart(
      bars as any,
      [
        {
          dt: bars[3].timestamp / 1000,
          type: '二买',
          freq: '30min',
          display_scope: 'current_timeframe',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
        {
          dt: bars[4].timestamp / 1000,
          type: '多头上行',
          freq: 'daily',
          display_scope: 'higher_timeframe_context',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
        {
          dt: bars[4].timestamp / 1000,
          type: '一卖',
          freq: '15min',
          display_scope: 'lower_timeframe_context',
          signal_side: 'sell',
          source: 'signals.index_report',
        },
      ] as any,
      '30min',
    )

    expect(callouts).toHaveLength(1)
    expect(callouts[0].label).toBe('多周期证据')
    expect(callouts[0].itemCount).toBe(3)
    expect(callouts[0].items.map(item => item.freq)).toEqual(expect.arrayContaining(['30m', '日↧', '15m↥']))
  })

  it('renders main chart aggregation as a compact badge summary', () => {
    const summary = signalCalloutBadgeSummary([
      { label: '二买', side: 'buy', color: '#f59e0b', freq: '30m' },
      { label: '多头上行', side: 'buy', color: '#f59e0b', freq: '日↧' },
      { label: '一卖', side: 'sell', color: '#ef4444', freq: '15m↥' },
      { label: 'MA承接', side: 'buy', color: '#f59e0b', freq: '周↧' },
    ], 4, '多周期证据')

    expect(summary.title).toBe('共振 4')
    expect(summary.subtitle).toBe('二买/多头上行')
  })

  it('adds stable chart ids for right-rail callout details', () => {
    const callouts = withSignalCalloutIds(signalEvidenceCalloutsForChart(
      bars as any,
      [
        {
          dt: bars[3].timestamp / 1000,
          type: '二买',
          freq: '30min',
          display_scope: 'current_timeframe',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
        {
          dt: bars[4].timestamp / 1000,
          type: 'MACD金叉',
          freq: 'daily',
          display_scope: 'higher_timeframe_context',
          signal_side: 'buy',
          source: 'signals.index_report',
        },
      ] as any,
      '30min',
    ))

    expect(callouts[0].calloutId).toBe('G1')
    expect(signalCalloutBadgeSummary(
      callouts[0].items,
      callouts[0].itemCount,
      callouts[0].label,
      callouts[0].freq,
      callouts[0].calloutId,
    ).title).toBe('G1 共振 2')
  })

  it('keeps volume and price-volume markers out of main chart callouts', () => {
    const signals = [
      {
        dt: bars[4].timestamp / 1000,
        type: '量价背离',
        freq: '30min',
        source: 'terminal_volume_signals',
      },
      {
        dt: bars[4].timestamp / 1000,
        type: '二买',
        freq: '30min',
        display_scope: 'current_timeframe',
        signal_side: 'buy',
        source: 'signals.stock_report',
      },
    ] as any

    expect(displaySignalsForChart(bars as any, signals, '30min').map(signal => signal.type)).toEqual(['二买'])
    const callouts = signalEvidenceCalloutsForChart(bars as any, signals, '30min')
    expect(callouts).toHaveLength(1)
    expect(callouts[0].items).toHaveLength(1)
    expect(callouts[0].items[0].label).not.toContain('量')
  })
})
