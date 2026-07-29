import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  compactPercentTextStyle,
  dailyMaAcceptanceSignalForChart,
  displaySignalsForChart,
  isMovingAverageLevelName,
  looksLikeIndexValue,
  maAcceptanceFromSymbolData,
  maPeriodsForChart,
  marketSnapshotFromSymbolData,
  missingRangeReturnLabel,
  mongoCoverageState,
  sectorTargetCountForContext,
  sectorTargetRowsForContext,
  SectorTransitionRadarPanel,
  sectorTransitionHasNewUnreadEvents,
  sectorTransitionRadarFromShell,
  sectorTransitionStockAnnotation,
  shellGroupCount,
  shellNeedsWarmRefresh,
  signalCalloutBadgeSummary,
  signalEvidenceCalloutsForChart,
  signalForWatchlist,
  signalOverlayPriority,
  signalsFromSymbolData,
  shouldAddManualClueForSearch,
  sourceMonitorSummary,
  stockHardSignalBadgeLabels,
  stockIdentityDisplay,
  strategyTradeActionPlanFromState,
  symbolDataCacheKey,
  traderDisplayText,
  TEST_CHART_FREQ_VALUES,
  TEST_TIMEFRAME_SNAPSHOT_FREQ_VALUES,
  terminalListTargetFreq,
  timeframeBadgeDisplayLabel,
  watchlistGridTemplate,
  withSignalCalloutIds,
} from './StrategyChartTerminal.js'

describe('StrategyChartTerminal trader-facing text', () => {
  it('converts internal states and source tokens into readable Chinese', () => {
    expect(traderDisplayText(
      'technical_trigger · security_chain_memberships · context_only · stale · conf 0.88 · index_report · BLOCKED',
      'zh-CN',
    )).toBe('技术信号 · 产业链归属 · 仅作背景参考 · 数据待更新 · 可信度 88% · 指数信号 · 待恢复')
    expect(traderDisplayText(
      'Signals shell 正在构建 · signals-web2 · standby',
      'zh-CN',
    )).toBe('机会池 正在构建 · 备用行情服务 · 备用通道')
    expect(traderDisplayText(
      'Signals 策略简报 · 0 buy candidates · 0 sell warnings',
      'zh-CN',
    )).toBe('盘后策略简报 · 0 个买点候选 · 0 个卖出预警')
    expect(traderDisplayText(
      'quote_lane · workbench_lane · chain_heat_snapshots · terminal_pool · current_timeframe_ma · index_timeframe_signal · HISTOGRAM',
      'zh-CN',
    )).toBe('行情快照 · 机会池 · 产业链热度 · 股票池 · 当前周期均线 · 指数周期信号 · MACD柱')
  })
})

describe('StrategyChartTerminal search clues', () => {
  it('never persists a manual clue from search navigation', () => {
    expect(shouldAddManualClueForSearch('SZ.002759', false)).toBe(false)
    expect(shouldAddManualClueForSearch('天际股份', false)).toBe(false)
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

describe('StrategyChartTerminal watchlist range layout', () => {
  it('uses compact responsive range columns for narrow and wide screens', () => {
    expect(watchlistGridTemplate('all_etfs', 1)).toContain('minmax(44px, 0.44fr)')
    expect(watchlistGridTemplate('focus_stocks', 1)).toContain('minmax(166px, 1.62fr)')
    expect(watchlistGridTemplate('focus_stocks', 1)).not.toContain('minmax(108px, 1.32fr)')
    expect(watchlistGridTemplate('focus_stocks', 1)).not.toContain('minmax(150px, 1.72fr)')
    expect(watchlistGridTemplate('focus_stocks', 1)).not.toContain('minmax(46px, 0.42fr)')
    expect(watchlistGridTemplate('focus_stocks', 1)).not.toContain('72px')
    expect(watchlistGridTemplate('major_indices', 1)).not.toContain('64px')
  })

  it('keeps non-stock return columns compact', () => {
    const tabs = [
      'major_indices',
      'industry_etfs',
      'all_etfs',
      'sector_boards',
    ] as const
    for (const tab of tabs) {
      expect(watchlistGridTemplate(tab, 1)).toContain('minmax(44px, 0.44fr)')
    }
  })

  it('gives stock decision tabs enough room for the selected range return', () => {
    const tabs = [
      'focus_stocks',
      'risk_stocks',
      'watch_stocks',
      'buy_candidates',
    ] as const
    for (const tab of tabs) {
      expect(watchlistGridTemplate(tab, 1)).toContain('minmax(58px, 0.56fr)')
    }
  })

  it('keeps percent text tabular and bounded for 13-inch and 27-inch layouts', () => {
    expect(compactPercentTextStyle('+123.45%')).toMatchObject({
      minWidth: 46,
      maxWidth: 76,
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    })
  })

  it('labels ETF spot-only range returns without treating them as missing K lines', () => {
    expect(missingRangeReturnLabel({ range_return_status: 'spot_only' }, 'stock')).toBe('现货')
    expect(missingRangeReturnLabel({ range_return_status: 'range_returns_kline_empty' }, 'stock')).toBe('缺K')
    expect(missingRangeReturnLabel({ range_return_status: 'range_returns_kline_empty' }, 'index')).toBe('缺K')
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

describe('StrategyChartTerminal stock hard-signal badges', () => {
  it('uses structured display badges, sorted and capped, without falling back to role badges', () => {
    const labels = stockHardSignalBadgeLabels({
      display_badges: [
        { kind: 'trade_role', label: '右侧进攻', priority: 120 },
        { kind: 'risk', label: '风险', tone: 'risk', priority: 110 },
        { kind: 'new_high', label: '200日新高', tone: 'hot', priority: 90 },
        { kind: 'buy_point', label: '30m二买', tone: 'buy', priority: 100 },
        { kind: 'ma_climb', label: '日线攀爬', tone: 'buy', priority: 80 },
        { kind: 'gap_volume_price', label: '强缺口量价', tone: 'hot', priority: 70 },
      ],
    })

    expect(labels).toEqual(['30m二买', '日线攀爬', '200日新高'])
  })

  it('reserves a climb slot when buy, sell, breakout, and climb coexist', () => {
    const labels = stockHardSignalBadgeLabels({
      display_badges: [
        { kind: 'new_high', label: '200日新高', tone: 'hot', priority: 930 },
        { kind: 'buy_point', label: '30m二买', tone: 'buy', priority: 970 },
        { kind: 'sell_point', label: '5m一卖', tone: 'risk', priority: 1020 },
        { kind: 'ma_climb', label: '周线攀爬', tone: 'buy', priority: 965 },
      ],
    })

    expect(labels).toEqual(['5m一卖', '30m二买', '周线攀爬'])
  })

  it('uses narrow legacy fallback and ignores summary/source text and ordinary shrink', () => {
    const labels = stockHardSignalBadgeLabels({
      display_summary: '右侧进攻 主线加强 风险解除 200日新高',
      evidence_summary: '普通缩量后观察',
      source_tags: ['breakout_200d'],
      buy_timeframes: [{ badge: '30m' }],
      sell_timeframes: [{ badge: '日线' }],
      technical_signal_groups: {
        right: [{ freq: '15m', label: '三买' }],
      },
      technical_evidence: {
        ma_climb: { label: '周线攀爬' },
      },
      display_breakout: '200日新高',
    })

    expect(labels).toEqual(['日线卖点', '30m买点', '周线攀爬'])
    expect(labels.join(' ')).not.toContain('风险')
    expect(labels.join(' ')).not.toContain('普通缩量')
  })

  it('allows an empty hard-signal row instead of falling back to role or risk labels', () => {
    expect(stockHardSignalBadgeLabels({
      display_badges: [
        { kind: 'trade_role', label: '右侧进攻', priority: 100 },
        { kind: 'risk', label: '风险', tone: 'risk', priority: 90 },
        { kind: 'volume_price', label: '普通缩量', tone: 'neutral', priority: 80 },
      ],
      display_summary: '只保留这一行结论',
    })).toEqual([])
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

describe('StrategyChartTerminal sector transition radar', () => {
  it('marks a three-pool row with its sector state and the next individual gate', () => {
    const annotation = sectorTransitionStockAnnotation({
      source: 'sector_transition',
      turn_state: 'stable_turn',
      sector_transition_pool: 'watch',
      sector_transition_eligibility: 'buy_review_pending_individual_gates',
      sector_transition_annotation: '板块稳定转折，已具备买点复核的上游资格；个股仍在盯盘池，不能当成买点。',
      sector_transition_next_gate: '等待个股买点、关键均线共振、位置和执行周期确认。',
      sector_transition_promoted: false,
    }, 'zh-CN')

    expect(annotation).toEqual({
      badgeLabel: '板块·稳定转折',
      tone: 'hot',
      summary: '板块稳定转折，已具备买点复核的上游资格；个股仍在盯盘池，不能当成买点。',
      nextGate: '等待个股买点、关键均线共振、位置和执行周期确认。',
    })
  })

  it('keeps legacy shell payloads backward compatible', () => {
    expect(sectorTransitionRadarFromShell({
      cache: { status: 'hit' },
      watchlist_groups: { sector_boards: [] },
    } as any)).toBeNull()
  })

  it('normalizes the canonical radar counts, state cards, freshness, and evidence', () => {
    const radar = sectorTransitionRadarFromShell({
      sector_transition_radar: {
        as_of: '2026-07-29T14:35:00+08:00',
        counts: {
          pressure: 2,
          release: 3,
          repair: 4,
          confirmed_intraday: 1,
          stable: 2,
          failed: 1,
        },
        unread_event_ids: ['evt-2'],
        events: [
          {
            event_id: 'evt-2',
            sector_id: 'digital-chip',
            sector_name: '数字芯片设计',
            from_state: 'pressure',
            to_state: 'release',
          },
        ],
        states: [
          {
            sector_id: 'digital-chip',
            sector_name: '数字芯片设计',
            sector_kind: 'concept',
            turn_state: 'confirmed_intraday',
            flow_state: 'active_acceptance',
            sentinels: {
              capacity_core: [{ symbol: 'SH.603986', name: '兆易创新' }],
              high_beta: ['SZ.001309 德明利'],
            },
            sentinel_symbols: ['SH.688012'],
            evidence: { summary: '板块宽度率先修复' },
            metrics: {
              breadth_ratio: 0.58,
              change_pct: 0.5,
              amount_share: 0.071,
              relative_strength: 1.36,
            },
            blockers: ['半导体ETF尚未收复30m MA20'],
            next_checks: [{ condition: '连续两根30m收盘确认' }],
            weaker_if: ['跌破事件低点', '重新封死跌停'],
          },
        ],
        freshness: {
          status: 'fresh',
          as_of: '2026-07-29T14:35:00+08:00',
          blockers: ['设备与材料仍弱'],
        },
      },
    } as any)

    expect(radar?.counts).toEqual({
      pressure: 2,
      release: 3,
      repair: 4,
      intraday: 1,
      stable: 2,
      failed: 1,
    })
    expect(radar?.unreadEventIds).toEqual(['evt-2'])
    expect(radar?.states[0]).toMatchObject({
      sectorName: '数字芯片设计',
      sectorKind: 'concept',
      turnState: 'confirmed_intraday',
      sentinels: ['SH.603986 兆易创新', 'SZ.001309 德明利', 'SH.688012'],
      evidence: ['板块宽度率先修复', '宽度 58.0% · 涨幅 +0.50% · 成交占比 7.1% · 相对强弱 +1.36'],
      blockers: ['半导体ETF尚未收复30m MA20'],
      nextChecks: ['连续两根30m收盘确认'],
      weakerIf: '跌破事件低点 / 重新封死跌停',
    })
    expect(radar?.freshness).toMatchObject({
      status: 'fresh',
      blockers: ['设备与材料仍弱'],
    })
    const markup = renderToStaticMarkup(
      <SectorTransitionRadarPanel locale="zh-CN" radar={radar!} pendingUpdate onSelectSentinel={() => undefined} />,
    )
    expect(markup).toContain('板块转折雷达 · 有新事件')
    expect(markup).toContain('数字芯片设计')
    expect(markup).toContain('宽度 58.0%')
    expect(markup).toContain('下一确认')
    expect(markup).toContain('打开 SH.603986 兆易创新 图表')
  })

  it('marks pending only when a new unread event id appears', () => {
    const sameEventShell = {
      sector_transition_radar: {
        unread_event_ids: ['evt-1'],
        events: [{ event_id: 'evt-1', sector_name: '半导体', to_state: 'release' }],
      },
    } as any
    const newEventShell = {
      sector_transition_radar: {
        unread_event_ids: ['evt-1', 'evt-2'],
        events: [
          { event_id: 'evt-1', sector_name: '半导体', to_state: 'release' },
          { event_id: 'evt-2', sector_name: '保险', to_state: 'repair' },
        ],
      },
    } as any

    expect(sectorTransitionHasNewUnreadEvents(['evt-1'], sameEventShell)).toBe(false)
    expect(sectorTransitionHasNewUnreadEvents(['evt-1'], newEventShell)).toBe(true)
    expect(sectorTransitionHasNewUnreadEvents(['evt-1', 'evt-2'], newEventShell)).toBe(false)
    expect(sectorTransitionHasNewUnreadEvents([], {
      sector_transition_radar: {
        unread_event_ids: [],
        events: [{ event_id: 'evt-historical', sector_name: '银行', to_state: 'stable' }],
      },
    } as any)).toBe(false)
  })
})

describe('StrategyChartTerminal source monitor', () => {
  it('shows loaded provider records instead of zero when sources are healthy', () => {
    const summary = sourceMonitorSummary([
      { provider: 'eastmoney', endpoint: 'fullmarket_spot_snapshot', domain: 'market_data', status: 'ok', last_success_at: '2026-05-13T09:44:00' },
      { provider: 'sina', endpoint: 'stock_minute', domain: 'minute', status: 'ok', last_success_at: '2026-05-13T09:43:00' },
    ], [], 'zh-CN')

    expect(summary.value).toBe('2')
    expect(summary.statusLabel).toBe('正常')
    expect(summary.detail).toBe('行情通道畅通')
  })

  it('marks provider health as not loaded when no source records arrive', () => {
    const summary = sourceMonitorSummary([], [{ scope: 'postmarket_backfill' }], 'zh-CN')

    expect(summary.value).toBe('0')
    expect(summary.status).toBe('partial')
    expect(summary.statusLabel).toBe('未加载')
    expect(summary.detail).toBe('行情通道未加载')
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

    expect(summary.statusLabel).toBe('待恢复')
    expect(summary.detail).toBe('部分行情暂未更新')
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
    expect(summary.statusLabel).toBe('正常')
    expect(summary.detail).toBe('行情通道畅通')
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
    expect(summary.compactLabel).toBe('日 2026-05-29 3,244/5,506 · 周 等待更新 · 月 等待更新')
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
    expect(summary.compactLabel).toBe('日 2026-05-12 5,498/5,498 · 周 等待更新 · 月 等待更新')
    expect(summary.detail).toContain('旧行情可读')
  })

  it('summarizes derived weekly/monthly periods and provisional daily quality', () => {
    const summary = mongoCoverageState({
      available: true,
      trade_date: '2026-05-15',
      daily_coverage_date: '2026-05-15',
      live_low_latency: { modules: [], summary: {} },
      postmarket_backfill: { run: null, tasks: [], summary: {} },
      mongo_stock_cache: {
        freqs: [
          { freq: '日线', symbols: 5506, today_symbols: 5506, coverage_date: '2026-05-15', quality: 'provisional_close' },
          { freq: '周线', symbols: 5506, latest_dt: '2026-05-15', is_partial_period: false },
          { freq: '月线', symbols: 5506, latest_dt: '2026-05-15', is_partial_period: true },
        ],
        summary: { daily_coverage_date: '2026-05-15' },
      },
      terminal_outputs: [],
      provider_health: [],
      blockers: [],
    } as any, 'zh-CN')

    expect(summary.compactLabel).toBe(
      '日 2026-05-15 5,506/5,506 · 周 已派生 · 月 周期未结束 · 临时收盘',
    )
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
  it('keeps monthly out of chart switches while adding it to snapshot rows', () => {
    expect(TEST_CHART_FREQ_VALUES).toEqual(['5min', '15min', '30min', 'daily', 'weekly'])
    expect(TEST_TIMEFRAME_SNAPSHOT_FREQ_VALUES).toEqual(['5min', '15min', '30min', 'daily', 'weekly', 'monthly'])
  })

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
    expect(snapshot.statusText).toContain('股票分钟行情未就绪')
  })

  it('supports monthly snapshot labels without requiring a top-level chart switch', () => {
    const snapshot = marketSnapshotFromSymbolData({
      target: {
        kind: 'stock',
        symbol: 'SH.600000',
        requested_freq: 'monthly',
        effective_freq: 'monthly',
      },
      chart: {
        meta: {
          freq: 'monthly',
          cache_status: 'ready',
          data_quality: 'official',
          bars: 1,
        },
        ohlcv: [
          { time: 1_780_000_000, open: 10, high: 12, low: 9, close: 11, volume: 1_000_000, amount: 10_000_000 },
        ],
      },
    } as any, 'monthly', 'zh-CN')

    expect(snapshot.freq).toBe('monthly')
    expect(snapshot.label).toBe('月')
    expect(snapshot.qualityLabel).toBe('已收盘')
  })

  it('distinguishes waiting source, provisional close, and partial-period quality', () => {
    expect(marketSnapshotFromSymbolData({
      target: { kind: 'stock', symbol: 'SH.600000', requested_freq: 'monthly', effective_freq: 'monthly' },
      chart: { meta: { freq: 'monthly', cache_status: 'not_ready', load_status: 'pending' }, ohlcv: [] },
    } as any, 'monthly', 'zh-CN').qualityLabel).toBe('等待更新')

    expect(marketSnapshotFromSymbolData({
      target: { kind: 'stock', symbol: 'SH.600000', requested_freq: 'daily', effective_freq: 'daily' },
      chart: {
        meta: { freq: 'daily', quality: 'provisional_close', bars: 1 },
        ohlcv: [{ time: 1_780_000_000, open: 10, high: 11, low: 9, close: 10.5 }],
      },
    } as any, 'daily', 'zh-CN').qualityLabel).toBe('临时收盘')

    expect(marketSnapshotFromSymbolData({
      target: { kind: 'stock', symbol: 'SH.600000', requested_freq: 'weekly', effective_freq: 'weekly' },
      chart: {
        meta: { freq: 'weekly', is_partial_period: true, time_semantics: 'partial_period', bars: 1 },
        ohlcv: [{ time: 1_780_000_000, open: 10, high: 11, low: 9, close: 10.5 }],
      },
    } as any, 'weekly', 'zh-CN').qualityLabel).toBe('周期未结束')
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
    expect(callouts[0].label).toBe('多周期共振')
    expect(callouts[0].itemCount).toBe(3)
    expect(callouts[0].items.map(item => item.freq)).toEqual(expect.arrayContaining(['30m', '日↧', '15m↥']))
  })

  it('renders main chart aggregation as a compact badge summary', () => {
    const summary = signalCalloutBadgeSummary([
      { label: '二买', side: 'buy', color: '#f59e0b', freq: '30m' },
      { label: '多头上行', side: 'buy', color: '#f59e0b', freq: '日↧' },
      { label: '一卖', side: 'sell', color: '#ef4444', freq: '15m↥' },
      { label: 'MA承接', side: 'buy', color: '#f59e0b', freq: '周↧' },
    ], 4, '多周期共振')

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

  it('carries explicit dates into chart callouts and item metadata', () => {
    const callouts = signalEvidenceCalloutsForChart(
      bars as any,
      [
        {
          dt: bars[2].timestamp / 1000,
          type: '二买',
          freq: 'daily',
          display_scope: 'current_timeframe',
          signal_side: 'buy',
          source: 'signals.stock_report',
        },
      ] as any,
      'daily',
      'dark',
      'Asia/Shanghai',
    )

    expect(callouts).toHaveLength(1)
    expect(callouts[0].dateLabel).toBe('2026-05-12')
    expect(callouts[0].signalDateLabel).toBe('2026-05-12')
    expect(callouts[0].items[0].dateLabel).toBe('2026-05-12')
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

describe('StrategyChartTerminal chart display filters', () => {
  it('treats moving-average level names as duplicate chart overlays', () => {
    expect(isMovingAverageLevelName('MA5')).toBe(true)
    expect(isMovingAverageLevelName('日MA5')).toBe(true)
    expect(isMovingAverageLevelName('周MA21')).toBe(true)
    expect(isMovingAverageLevelName('日线MA20')).toBe(true)
    expect(isMovingAverageLevelName('10日线')).toBe(true)
    expect(isMovingAverageLevelName('5周线')).toBe(true)
    expect(isMovingAverageLevelName('21日线')).toBe(true)
    expect(isMovingAverageLevelName('二买 日')).toBe(false)
    expect(isMovingAverageLevelName('前高压力')).toBe(false)
  })
})
