import { describe, expect, it } from 'vitest'

import {
  BACKTEST_HISTORY_SCHEMA_VERSION,
  backtestHistoryEntryFromRecord,
  backtestRestoreStateFromHistory,
  batchKlineDateRangeLabel,
  buildDatePresetDetailRows,
  buildDatePresetWindows,
  buildExpandedKlineRangeOptions,
  buildMiniKlineTradeMarkers,
  buildStrategyResearchSummary,
  createBacktestHistoryEntry,
  filterSignalsForDateWindow,
  filterTradesForDateWindow,
  klineIntervalStats,
  parseBacktestHistoryEntries,
  symbolOptionFromLookupPayload,
  symbolOptionsFromBacktestOutputs,
  tradeOutcomeForSignal,
} from './BacktestWorkbench.js'

function dayTimestamp(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

function daySeconds(date: string): number {
  return Math.floor(dayTimestamp(date) / 1000)
}

function dayOffset(date: string, offset: number): string {
  return new Date(dayTimestamp(date) + offset * 86_400_000).toISOString().slice(0, 10)
}

function klineBar(date: string) {
  return {
    timestamp: dayTimestamp(date),
    open: 1,
    high: 1,
    low: 1,
    close: 1,
  }
}

function pricedKlineBar(date: string, open: number, close: number) {
  return {
    timestamp: dayTimestamp(date),
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
  }
}

describe('BacktestWorkbench strategy research summary', () => {
  it('blocks strategy judgment when the backtest has no result yet', () => {
    const summary = buildStrategyResearchSummary({
      selectedCodes: ['300394'],
      freq: 'daily',
      locale: 'zh-CN',
    })

    expect(summary.tone).toBe('open')
    expect(summary.statusLabel).toBe('待建立样本')
    expect(summary.actions[0]).toContain('运行当前单票')
  })

  it('flags profitable but benchmark-lagging single-symbol results as constrained research', () => {
    const summary = buildStrategyResearchSummary({
      locale: 'zh-CN',
      result: {
        symbol: 'SZ.300394',
        freshness: 'fresh',
        terminal: {
          version: 'backtest-terminal.v1',
          target: { symbol: 'SZ.300394', freshness: 'fresh' },
          metrics: {
            total_return_pct: 8.95,
            max_drawdown_pct: 18.16,
            win_rate: 47.8,
            filled_trades: 23,
            signal_count: 115,
            sharpe: 1.16,
            excess_return_pct: -506.13,
          },
          panels: {
            signals: { rows: Array.from({ length: 115 }, (_, index) => ({ index })) },
            trades: { rows: Array.from({ length: 23 }, (_, index) => ({ index, entry_price: 10 })) },
          },
        },
      },
    })

    expect(summary.tone).toBe('warning')
    expect(summary.issues).toContain('未跑赢基准 -506.13%')
    expect(summary.actions.join(' ')).toContain('同一主线强势股')
  })

  it('marks empty-trade outputs as rewrite-first instead of researchable', () => {
    const summary = buildStrategyResearchSummary({
      locale: 'zh-CN',
      result: {
        terminal: {
          version: 'backtest-terminal.v1',
          target: { freshness: 'fresh' },
          metrics: {
            total_return_pct: 0,
            max_drawdown_pct: 0,
            win_rate: 0,
            filled_trades: 0,
            signal_count: 0,
            sharpe: 0,
          },
          panels: {
            signals: { rows: [] },
            trades: { rows: [] },
          },
        },
      },
    })

    expect(summary.tone).toBe('failed')
    expect(summary.issues).toContain('没有信号样本')
    expect(summary.issues).toContain('没有成交样本')
  })

  it('treats narrow batch samples as reviewable evidence, not strategy proof', () => {
    const summary = buildStrategyResearchSummary({
      locale: 'zh-CN',
      selectedCodes: ['300394', '002409'],
      batchResult: {
        summary: {
          total_stocks: 2,
          ok_stocks: 2,
          total_signals: 145,
          total_trades: 33,
        },
        terminal: {
          version: 'backtest-terminal.v1',
          mode: 'multi',
          metrics: {
            signal_count: 145,
            filled_trades: 33,
            win_rate: 48.5,
            total_return_pct: 21.73,
            max_drawdown_pct: -13.01,
          },
        },
      },
    })

    expect(summary.tone).toBe('warning')
    expect(summary.statusLabel).toBe('先清洗样本')
    expect(summary.issues).toContain('组合样本偏薄，不能直接沉淀策略')
    expect(summary.actions.join(' ')).toContain('5-10 只标的')
  })

  it('learns stock names from batch output so selected codes render with names', () => {
    const options = symbolOptionsFromBacktestOutputs(null, {
      terminal: {
        version: 'backtest-terminal.v1',
        mode: 'multi',
        panels: {
          ranking: {
            rows: [
              { code: '002409', name: '雅克科技' },
              { code: '300394', name: '天孚通信' },
            ],
          },
        },
      },
    })

    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '002409', name: '雅克科技' }),
      expect.objectContaining({ code: '300394', name: '天孚通信' }),
    ]))
  })

  it('learns stock names from workbench symbol lookup before a batch run finishes', () => {
    const option = symbolOptionFromLookupPayload({
      symbol: 'SZ.002409',
      name: '雅克科技',
    }, '002409')

    expect(option).toEqual(expect.objectContaining({
      code: '002409',
      name: '雅克科技',
      group: '名称查询',
    }))
  })

  it('syncs date presets to the current backtest candle range', () => {
    const windows = buildDatePresetWindows([
      { key: 'old', label: '924新政 — 央行三箭齐发', date: '2024-09-24', time: daySeconds('2024-09-24') },
      { key: 'deepseek', label: 'DeepSeek行情 — AI新纪元', date: '2025-01-23', time: daySeconds('2025-01-23') },
      { key: 'late', label: '未来事件', date: '2026-01-01', time: daySeconds('2026-01-01') },
    ], [
      klineBar('2025-01-01'),
      klineBar('2025-01-23'),
      klineBar('2025-02-15'),
    ])

    expect(windows.map(item => item.key)).toEqual(['deepseek'])
    expect(windows[0]?.shortLabel).toBe('DeepSeek行情')
    expect(windows[0]?.displayRange).toBe('2025-01-01 ~ 2025-02-15')
  })

  it('filters signal and trade detail rows by selected date preset window', () => {
    const [window] = buildDatePresetWindows([
      { key: 'deepseek', label: 'DeepSeek行情 — AI新纪元', date: '2025-01-23', time: daySeconds('2025-01-23') },
    ], [
      klineBar('2025-01-01'),
      klineBar('2025-01-23'),
      klineBar('2025-02-15'),
      klineBar('2025-05-12'),
    ])

    const signals = filterSignalsForDateWindow([
      { date: '2024-12-15', type: 'old' },
      { dt: daySeconds('2025-01-24'), type: 'inside' },
      { date_str: '2025-05-12', type: 'outside' },
    ], window ?? null)
    const trades = filterTradesForDateWindow([
      { signal_date: '2024-12-15', entry_price: 1 },
      { signal_date: '2025-01-24', entry_date: '2025-01-27', exit_date: '2025-01-30', entry_price: 1 },
      { signal_date: '2025-05-12', entry_price: 1 },
    ], window ?? null)

    expect(signals.map(item => item.type)).toEqual(['inside'])
    expect(trades.map(item => item.signal_date)).toEqual(['2025-01-24'])
  })

  it('keeps date preset filtering scoped to the detail rows', () => {
    const [window] = buildDatePresetWindows([
      { key: 'deepseek', label: 'DeepSeek行情 — AI新纪元', date: '2025-01-23', time: daySeconds('2025-01-23') },
    ], [
      klineBar('2025-01-01'),
      klineBar('2025-01-23'),
      klineBar('2025-02-15'),
      klineBar('2025-05-12'),
    ])
    const allSignals = [
      { dt: daySeconds('2025-01-24'), type: 'inside' },
      { date_str: '2025-05-12', type: 'outside' },
    ]
    const allTrades = [
      { signal_date: '2025-01-24', entry_price: 1 },
      { signal_date: '2025-05-12', entry_price: 1 },
    ]

    const detail = buildDatePresetDetailRows(allSignals, allTrades, window ?? null)

    expect(allSignals.map(item => item.type)).toEqual(['inside', 'outside'])
    expect(allTrades.map(item => item.signal_date)).toEqual(['2025-01-24', '2025-05-12'])
    expect(detail.signals.map(item => item.type)).toEqual(['inside'])
    expect(detail.trades.map(item => item.signal_date)).toEqual(['2025-01-24'])
  })

  it('links signal rows to filled trade holding period and exit reason', () => {
    const outcome = tradeOutcomeForSignal(
      { date_str: '2025-01-24', type: 'MACD-零上回踩', group: 'macd' },
      [
        {
          signal_date: '2025-01-24',
          signal_type: 'MACD-零上回踩',
          signal_group: 'macd',
          entry_price: 10,
          exit_reason: 'stop_loss',
          holding_days: 4,
          net_return_pct: -5.2,
        },
      ],
    )

    expect(outcome).toMatchObject({
      holdingDays: 4,
      netReturnPct: -5.2,
      exitReason: 'stop_loss',
    })
  })

  it('builds batch kline trade markers and full-year date labels', () => {
    const rows = [
      klineBar('2025-01-01'),
      klineBar('2025-01-02'),
      klineBar('2025-01-03'),
    ]

    const markers = buildMiniKlineTradeMarkers([
      { kind: 'entry', time: daySeconds('2025-01-02'), price: 1.2, signal_type: 'MACD-零上回踩' },
      { kind: 'exit', date: '2025-01-03', price: 1.4, exit_reason: 'stop_loss', return_pct: -5 },
      { kind: 'entry', date: '2025-04-01', price: 1.5 },
    ], rows)

    expect(markers.map(item => [item.kind, item.index])).toEqual([['entry', 1], ['exit', 2]])
    expect(markers[0]).toMatchObject({ signalType: 'MACD-零上回踩' })
    expect(markers[1]).toMatchObject({ exitReason: 'stop_loss', returnPct: -5 })
    expect(batchKlineDateRangeLabel({
      start_date: '2024-12-01',
      end_date: '2025-06-01',
      visible_start_date: '2025-01-01',
      visible_end_date: '2025-01-03',
    }, rows)).toBe('2025-01-01 ~ 2025-01-03')
    expect(batchKlineDateRangeLabel({
      start_date: '2024-12-01',
      end_date: '2025-06-01',
      visible_start_date: '2025-01-01',
      visible_end_date: '2025-01-03',
    }, rows, false)).toBe('2024-12-01 ~ 2025-06-01')
  })

  it('builds expanded kline range choices from backtest and strategy event intervals', () => {
    const rows = Array.from({ length: 70 }, (_, index) => klineBar(dayOffset('2026-03-01', index)))
    const options = buildExpandedKlineRangeOptions(rows, [
      { key: 'event', label: '成长反弹确认', date: '2026-04-08', time: daySeconds('2026-04-08') },
    ])

    expect(options.map(item => item.key)).toEqual(expect.arrayContaining([
      'visible_all',
      'strategy_ytd',
      'strategy_5d',
      'strategy_20d',
      'strategy_60d',
      'event_event',
    ]))
    expect(options.find(item => item.key === 'strategy_20d')?.barCount).toBe(20)
  })

  it('calculates interval return from the currently selected kline range', () => {
    const stats = klineIntervalStats([
      pricedKlineBar('2026-05-01', 10, 10),
      pricedKlineBar('2026-05-02', 10, 12),
      pricedKlineBar('2026-05-03', 12, 11),
    ])

    expect(stats.range_return_pct).toBeCloseTo(10)
    expect(stats.max_drawdown_pct).toBeCloseTo(-8.333, 2)
    expect(stats.max_runup_pct).toBeCloseTo(20)
  })

  it('serializes multi-symbol batch output as a restorable history entry', () => {
    const entry = createBacktestHistoryEntry({
      createdAt: '2026-05-29T15:00:00.000Z',
      codes: ['002409', '300394'],
      freq: 'daily',
      signalType: 'all',
      simParams: { stop_loss: '5' },
      rendererState: { tab: 'risk', selectedDatePresetKey: 'event-1' },
      batchResult: {
        summary: { total_stocks: 2, total_signals: 8, total_trades: 3 },
        terminal: {
          version: 'backtest-terminal.v1',
          mode: 'multi',
          panels: {
            ranking: { rows: [{ code: '002409', name: '雅克科技' }] },
            multi_charts: { items: [{ code: '002409', ohlcv: [klineBar('2026-05-29')] }] },
          },
        },
      },
    })

    expect(entry).toMatchObject({
      schema_version: BACKTEST_HISTORY_SCHEMA_VERSION,
      mode: 'multi',
      codes: ['002409', '300394'],
      freq: 'daily',
      simParams: { stop_loss: '5' },
      rendererState: { tab: 'risk', selectedDatePresetKey: 'event-1' },
    })
    expect(parseBacktestHistoryEntries([entry])[0]?.batchResult?.terminal?.mode).toBe('multi')
    expect(backtestRestoreStateFromHistory(entry!, ['fallback'])).toMatchObject({
      codes: ['002409', '300394'],
      tab: 'risk',
      selectedDatePresetKey: 'event-1',
      simParams: { stop_loss: '5' },
    })
  })

  it('keeps v1 history parseable but skips deleted tombstones', () => {
    const v1 = {
      id: 'single:daily:300394:2026-05-29T15:00:00.000Z',
      title: '300394 300394',
      meta: '1信号 · 1成交',
      mode: 'single',
      createdAt: '2026-05-29T15:00:00.000Z',
      codes: ['300394'],
      freq: 'daily',
      result: {
        terminal: {
          version: 'backtest-terminal.v1',
          target: { code: '300394', name: '300394' },
          chart: { ohlcv: [klineBar('2026-05-29')] },
        },
      },
    }

    const rows = parseBacktestHistoryEntries([
      { ...v1, id: 'deleted', deletedAt: '2026-05-30T00:00:00.000Z' },
      v1,
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.schema_version).toBe(BACKTEST_HISTORY_SCHEMA_VERSION)
    expect(rows[0]?.title).toBe('300394 300394')
    expect(backtestRestoreStateFromHistory(rows[0]!, [])).toMatchObject({
      codes: ['300394'],
      tab: 'perf',
      result: rows[0]?.result,
    })
  })

  it('deduplicates single-symbol titles when code and name match', () => {
    const entry = createBacktestHistoryEntry({
      createdAt: '2026-05-29T15:00:00.000Z',
      codes: ['300394'],
      freq: 'daily',
      result: {
        terminal: {
          version: 'backtest-terminal.v1',
          target: { code: '300394', name: '300394' },
          metrics: { signal_count: 1, filled_trades: 1 },
          chart: { ohlcv: [klineBar('2026-05-29')] },
        },
      },
    })

    expect(entry?.title).toBe('300394')
  })

  it('does not turn strategy snapshots into restorable backtest records', () => {
    expect(backtestHistoryEntryFromRecord('strategy-snapshot-2026-05-29', {
      job_id: 'strategy-snapshot-2026-05-29',
      status: 'completed',
      metadata: {
        as_of: '2026-05-29',
        candidate_count: 12,
      },
    })).toBeNull()
  })
})
