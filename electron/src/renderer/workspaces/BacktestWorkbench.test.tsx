import { describe, expect, it } from 'vitest'

import { buildStrategyResearchSummary } from './BacktestWorkbench.js'

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
})
