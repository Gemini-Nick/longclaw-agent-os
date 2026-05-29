import { describe, expect, it } from 'vitest'

import {
  dailyMaAcceptanceSignalForChart,
  displaySignalsForChart,
  looksLikeIndexValue,
  maAcceptanceFromSymbolData,
  maPeriodsForChart,
  marketSnapshotFromSymbolData,
  mongoCoverageState,
  sectorTargetCountForContext,
  sectorTargetRowsForContext,
  shellGroupCount,
  shellNeedsWarmRefresh,
  signalCalloutBadgeSummary,
  signalEvidenceCalloutsForChart,
  signalForWatchlist,
  signalOverlayPriority,
  signalsFromSymbolData,
  shouldAddManualClueForSearch,
  sourceMonitorSummary,
  stockIdentityDisplay,
  strategyTradeActionPlanFromState,
  symbolDataCacheKey,
  terminalListTargetFreq,
  timeframeBadgeDisplayLabel,
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

describe('StrategyChartTerminal default timeframe', () => {
  it('uses daily when a row or search has no explicit timeframe', () => {
    expect(terminalListTargetFreq(undefined)).toBe('daily')
    expect(terminalListTargetFreq('', '')).toBe('daily')
  })

  it('still preserves an explicit timeframe when supplied', () => {
    expect(terminalListTargetFreq('30m')).toBe('30min')
    expect(terminalListTargetFreq('15分钟')).toBe('15min')
  })
})

describe('StrategyChartTerminal symbol cache', () => {
  it('normalizes symbol cache keys across freq aliases and casing', () => {
    expect(symbolDataCacheKey({ label: ' sh.601398 ', kind: 'STOCK', freq: '日线' })).toBe('stock|SH.601398|daily')
  })
})

describe('StrategyChartTerminal stock identity display', () => {
  it('keeps stock code and name together for trader-facing labels', () => {
    expect(stockIdentityDisplay({ symbol: 'SZ.300394', name: '天孚通信' })).toBe('SZ.300394 天孚通信')
    expect(stockIdentityDisplay({ code: '002409', stock_name: '雅克科技' })).toBe('002409 雅克科技')
  })
})

describe('StrategyChartTerminal trader action plan', () => {
  it('turns entry-ready names into review actions with post-close backtest guidance', () => {
    const plan = strategyTradeActionPlanFromState({
      decisionStage: 'entry_ready',
      tradeRole: 'right_attack',
      identity: '右侧进攻',
      confirmation: '买点已出 30m 二买',
    }, 'zh-CN')

    expect(plan.action).toBe('看')
    expect(plan.reason).toBe('右侧进攻')
    expect(plan.postmarket).toContain('T+5/T+10')
  })

  it('does not spend intraday attention on off-pool names without evidence', () => {
    const plan = strategyTradeActionPlanFromState({
      targetKind: 'stock',
      identity: '池外观察',
      hasEvidence: false,
    }, 'zh-CN')

    expect(plan.action).toBe('忽略')
    expect(plan.next).toContain('不占用盘中注意力')
  })

  it('treats indices as market context instead of single-name entries', () => {
    const plan = strategyTradeActionPlanFromState({
      targetKind: 'index',
      identity: '背景锚点',
    }, 'zh-CN')

    expect(plan.action).toBe('看大盘')
    expect(plan.postmarket).toContain('指数环境')
  })
})

describe('StrategyChartTerminal shell refresh', () => {
  it('keeps warming when the shell is missing, building, or empty', () => {
    expect(shellNeedsWarmRefresh(null)).toBe(true)
    expect(shellNeedsWarmRefresh({ cache: { status: 'building' }, watchlist_groups: {} } as any)).toBe(true)
    expect(shellNeedsWarmRefresh({ watchlist_groups: { focus_stocks: [] } } as any)).toBe(true)
  })

  it('uses the normal refresh cadence once watchlist groups are populated', () => {
    const shell = {
      cache: { status: 'hit' },
      watchlist_groups: {
        major_indices: [{ label: '上证指数' }],
        focus_stocks: [{ label: '张江高科' }],
      },
    } as any

    expect(shellGroupCount(shell)).toBe(2)
    expect(shellNeedsWarmRefresh(shell)).toBe(false)
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

  it('shows the concrete provider endpoint when fullmarket is blocked', () => {
    const summary = sourceMonitorSummary([
      {
        provider: 'eastmoney',
        endpoint: 'fullmarket_spot_snapshot',
        domain: 'market_data',
        status: 'degraded',
        last_error_type: 'SSLError',
        updated_at: '2026-05-13T09:44:00',
      },
    ], [], 'zh-CN')

    expect(summary.statusLabel).toBe('BLOCKED')
    expect(summary.detail).toBe('eastmoney · fullmarket_spot_snapshot')
    expect(summary.subdetail).toBe('SSLError')
  })

  it('drops stale blocker state after the fullmarket provider recovers', () => {
    const summary = sourceMonitorSummary([
      {
        provider: 'eastmoney',
        endpoint: 'fullmarket_spot_snapshot',
        domain: 'market_data',
        status: 'ok',
        last_success_at: '2026-05-13T09:45:00',
        last_error_type: 'old SSLError',
        updated_at: '2026-05-13T09:45:00',
      },
    ], [{ scope: 'postmarket_backfill', module: 'fullmarket_spot_snapshot', status: 'degraded' }], 'zh-CN')

    expect(summary.status).toBe('ok')
    expect(summary.statusLabel).toBe('OK')
    expect(summary.detail).toBe('无阻塞源')
  })
})

describe('StrategyChartTerminal mongo coverage', () => {
  it('labels current-day catch-up as running while postmarket backfill is active', () => {
    const summary = mongoCoverageState({
      available: true,
      mode: 'mongo',
      updated_at: '2026-05-29T14:13:00',
      trade_date: '2026-05-29',
      daily_coverage_date: '2026-05-29',
      live_low_latency: { modules: [], summary: {} },
      postmarket_backfill: {
        run: { status: 'running', recovery_state: 'postmarket_running' },
        tasks: [],
        summary: { critical_status: 'running' },
      },
      mongo_stock_cache: {
        freqs: [
          {
            freq: '日线',
            symbols: 5506,
            today_symbols: 3244,
            coverage_date: '2026-05-29',
          },
        ],
        summary: {
          daily_coverage_date: '2026-05-29',
          minute_universe_total: 72,
          minute_universe_cached: 72,
          minute_universe_pending: 0,
          minute_universe_error: 0,
        },
      },
      terminal_outputs: [],
      provider_health: [],
      blockers: [],
    } as any, 'zh-CN')

    expect(summary.status).toBe('running')
    expect(summary.isCurrent).toBe(true)
    expect(summary.compactLabel).toBe('2026-05-29 3,244/5,506')
  })

  it('labels old daily coverage as partial instead of ok', () => {
    const summary = mongoCoverageState({
      available: true,
      mode: 'mongo',
      updated_at: '2026-05-13T09:45:00',
      trade_date: '2026-05-13',
      daily_coverage_date: '2026-05-12',
      live_low_latency: { modules: [], summary: {} },
      postmarket_backfill: { run: null, tasks: [], summary: {} },
      mongo_stock_cache: {
        freqs: [
          {
            freq: '日线',
            symbols: 5498,
            today_symbols: 5498,
            coverage_date: '2026-05-12',
          },
        ],
        summary: {
          daily_coverage_date: '2026-05-12',
          minute_universe_total: 0,
        },
      },
      terminal_outputs: [],
      provider_health: [],
      blockers: [],
    } as any, 'zh-CN')

    expect(summary.status).toBe('partial')
    expect(summary.isCurrent).toBe(false)
    expect(summary.compactLabel).toBe('2026-05-12 5,498/5,498')
    expect(summary.detail).toContain('旧缓存可读')
  })
})

describe('StrategyChartTerminal sector target context', () => {
  it('counts unique grouped sector targets for the right-side panel', () => {
    const row = {
      source: 'chain_heat_snapshots',
      candidate_groups: {
        leaders: [
          { symbol: 'SZ.000002', name: '万科A', leader_tier: '龙头' },
          { symbol: 'SH.601668', name: '中国建筑', leader_tier: '龙二' },
        ],
        weighted: [
          { symbol: 'SZ.000002', name: '万科A', chain_role: '房地产开发链主' },
        ],
        elastic: [
          { symbol: 'SH.600585', name: '海螺水泥', chain_role: '水泥弹性标的' },
        ],
      },
    }

    expect(sectorTargetCountForContext(row)).toBe(3)
    expect(sectorTargetRowsForContext(row).map(item => item.name)).toEqual(['万科A', '中国建筑', '海螺水泥'])
  })

  it('falls back to focus stock previews when grouped candidates are missing', () => {
    const row = {
      focus_stocks_preview: [
        { symbol: 'SH.601888', name: '中国中免' },
        { symbol: 'SH.600185', name: '珠免集团' },
      ],
    }

    expect(sectorTargetCountForContext(row)).toBe(2)
  })
})

describe('StrategyChartTerminal timeframe market snapshots', () => {
  it('formats latest price, period change, volume, and amount from chart bars', () => {
    const snapshot = marketSnapshotFromSymbolData({
      target: {
        kind: 'stock',
        symbol: 'SH.600000',
        requested_freq: '30min',
        effective_freq: '30min',
      },
      chart: {
        meta: {
          freq: '30min',
          source: 'bars',
          cache_status: 'ready',
          data_as_of: '2026-05-29',
          latest_bar_time: '2026-05-29T14:30:00',
          bars: 2,
        },
        ohlcv: [
          { time: 1_780_000_000, open: 10, high: 10.2, low: 9.9, close: 10, volume: 1_000_000, amount: 10_000_000 },
          { time: 1_780_001_800, open: 10.2, high: 11.2, low: 10.1, close: 11, volume: 2_000_000, amount: 22_000_000 },
        ],
      },
      summary: {
        latest_price: 11.01,
        latest_signal: 'MACD零上',
      },
    } as any, '30min', 'zh-CN')

    expect(snapshot.status).toBe('ready')
    expect(snapshot.latestPrice).toBe('11.00')
    expect(snapshot.periodChange).toBe('+10.00%')
    expect(snapshot.volume).toBe('2.00万手')
    expect(snapshot.amount).toBe('2200.00万')
    expect(snapshot.bars).toBe('2')
    expect(snapshot.signal).toBe('MACD零上')
  })

  it('keeps not-ready minute periods visible as loading rows', () => {
    const snapshot = marketSnapshotFromSymbolData({
      target: {
        kind: 'stock',
        label: 'SH.600000',
        symbol: 'SH.600000',
        requested_freq: '5min',
        effective_freq: '5min',
        not_ready_reason: 'stock_minute_not_ready',
      },
      chart: {
        meta: {
          freq: '5min',
          cache_status: 'not_ready',
          load_status: 'running',
          bars: 0,
        },
        ohlcv: [],
      },
      summary: {},
    } as any, '5min', 'zh-CN')

    expect(snapshot.status).toBe('loading')
    expect(snapshot.latestPrice).toBe('N/A')
    expect(snapshot.statusText).toContain('股票分钟缓存未就绪')
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

  it('does not promote touch-only MA alignment into acceptance evidence', () => {
    const acceptance = maAcceptanceFromSymbolData({
      summary: {
        ma_alignment: {
          fib_accept_periods: [],
          fib_touch_periods: [21, 13],
          fib_breakdown_periods: [21],
          fib_array_summary: 'MA21跌破待修复 / MA13触碰待确认',
          fib_ma_array: [
            {
              period: 21,
              pullback_touch: true,
              pullback_acceptance: false,
              pullback_breakdown: true,
            },
            {
              period: 13,
              pullback_touch: true,
              pullback_acceptance: false,
            },
          ],
        },
      },
    } as any)

    expect(acceptance).toBeNull()
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

  it('uses the same key MA periods for every chart target', () => {
    expect(maPeriodsForChart('daily', 'index')).toEqual([5, 8, 10, 13, 20, 21])
    expect(maPeriodsForChart('weekly', 'industry')).toEqual([5, 8, 10, 13, 20, 21])
    expect(maPeriodsForChart('30min', 'stock')).toEqual([5, 8, 10, 13, 20, 21])
  })

  it('uses readable timeframe labels instead of compact codes', () => {
    expect(timeframeBadgeDisplayLabel('D', 'zh-CN')).toBe('日线')
    expect(timeframeBadgeDisplayLabel('30M', 'zh-CN')).toBe('30分钟')
    expect(timeframeBadgeDisplayLabel('15min', 'zh-CN')).toBe('15分钟')
  })

  it('keeps explicit index risk text ahead of timeframe badges', () => {
    const signal = signalForWatchlist({
      latest_signal: '未站稳5周线',
      signal_detail: '上周五收盘价没站稳5周线',
      sell_timeframes: [{ badge: 'D', side: 'sell' }],
      buy_timeframes: [{ badge: '30m', side: 'buy' }],
    }, 'index')

    expect(signal).toBe('未站稳5周线')
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
