import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dispose,
  init,
  registerOverlay,
  type Chart,
  type DeepPartial,
  type KLineData,
  type OverlayEvent,
  type OverlayCreateFiguresCallbackParams,
  type Styles,
} from 'klinecharts'

import type {
  LongclawRun,
  SignalsDashboard,
} from '../../../../src/services/longclawControlPlane/models.js'
import { fontStacks, interaction, palette, statusBadgeStyle, tradingDeskTheme } from '../designSystem.js'
import type { LongclawLocale } from '../i18n.js'
import { observedFetchJson, recordObservationEvent } from '../observation.js'

type BacktestDashboard = Pick<
  SignalsDashboard,
  'backtest_summary' | 'backtest_jobs' | 'pending_backlog_preview' | 'review_runs' | 'buy_candidates' | 'chart_context' | 'deep_links'
>

type BacktestWorkbenchProps = {
  locale: LongclawLocale
  dashboard: BacktestDashboard
  signalsWebBaseUrl?: string
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (title: string, record: Record<string, unknown>) => void
}

type ApiError = Error & { status?: number; payload?: Record<string, unknown> }
type BacktestTab = 'perf' | 'trades' | 'signals' | 'scan' | 'risk'
type SignalType =
  | 'all'
  | 'macd'
  | 'czsc'
  | 'gap'
  | 'trend_breakout'
  | 'vol_contraction'
  | 'candle_run'
  | 'candle_accel'

type BacktestSignal = {
  dt?: number
  time?: number
  date?: string
  date_str?: string
  type?: string
  group?: string
  price?: number
  confidence?: number
  ma_status?: string
  volume_status?: string
  return_t5?: number
  return_t10?: number
  return_t20?: number
  mfe_pct?: number
  mae_pct?: number
  index?: number
  eval?: Record<string, unknown>
}

type BoardMatch = { name?: string; kind?: string; source?: string; total?: number }

type BoardStocksResponse = {
  board?: string
  query?: string
  resolved_board?: string
  source?: string
  total?: number
  showing?: number
  matches?: BoardMatch[]
  stocks?: Array<{ symbol?: string; code?: string; name?: string }>
  error?: string
}

type SymbolLookupResponse = {
  target?: Record<string, unknown>
  matches?: Array<Record<string, unknown>>
  symbol?: string
  code?: string
  name?: string
  stock_name?: string
  label?: string
}

type BacktestTrade = {
  id?: string
  index?: number
  status?: string
  signal_date?: string
  signal_type?: string
  signal_group?: string
  entry_date?: string
  entry_price?: number | null
  exit_date?: string
  exit_price?: number | null
  exit_reason?: string
  fill_type?: string
  holding_days?: number
  return_pct?: number
  net_return_pct?: number
  cost_pct?: number
  mfe_pct?: number
  mae_pct?: number
  skip_reason?: string | null
}

type ElementSize = { width: number; height: number }
type MultiReportDensity = 'compact' | 'desk' | 'wide'
type SymbolOption = { code: string; name: string; group: string; role?: string; source?: string }
type SymbolBasket = {
  id: string
  label: string
  codes: SymbolOption[]
  source?: string
  domain?: string
  description?: string
  chain_id?: string
  node_id?: string
  confidence?: number
}
type DynamicBasketsResponse = {
  query?: string
  total?: number
  baskets?: SymbolBasket[]
  source_order?: string[]
}

type BacktestTerminalMetric = {
  key?: string
  label?: string
  value?: unknown
  unit?: string
  tone?: string
}

type DatePreset = {
  key?: string
  label?: string
  date?: string
  time?: number
  tier?: string
}

type DatePresetWindow = DatePreset & {
  key: string
  label: string
  shortLabel: string
  from: number
  to: number
  anchorTime: number
  displayRange: string
  barCount: number
}

type BacktestTerminal = {
  version?: string
  mode?: string
  target?: Record<string, unknown>
  market_snapshot?: Record<string, unknown>
  trade_assumptions?: Record<string, unknown>
  metrics?: Record<string, unknown>
  chart?: {
    ohlcv?: Record<string, unknown>[]
    date_presets?: DatePreset[]
    signal_markers?: Array<Record<string, unknown>>
    trade_markers?: Array<Record<string, unknown>>
    entry_exit_markers?: Array<Record<string, unknown>>
    risk_bands?: Array<Record<string, unknown>>
    multi_charts?: Array<Record<string, unknown>>
  }
  panels?: {
    perf?: Record<string, unknown>
    trades?: { rows?: BacktestTrade[]; filled_count?: number; skipped_count?: number }
    signals?: { rows?: BacktestSignal[]; count?: number; groups?: string[] }
    scan?: Record<string, unknown>
    risk?: Record<string, unknown>
    config?: Record<string, unknown>
    ranking?: { rows?: Array<Record<string, unknown>>; columns?: string[] }
    interval_overview?: { rows?: Array<Record<string, unknown>> }
    multi_charts?: { items?: Array<Record<string, unknown>> }
    scripts?: { cards?: Array<Record<string, unknown>> }
  }
}

type BacktestResult = {
  symbol?: string
  code?: string
  freq?: string
  data_source?: string
  data_source_detail?: string
  as_of?: string
  bar_count?: number
  freshness?: string
  derived_from?: string
  partial?: boolean
  last_upstream_error?: string
  ohlcv?: Record<string, unknown>[]
  signals?: BacktestSignal[]
  kpi?: Record<string, unknown>
  sim_kpi?: Record<string, unknown>
  sim_trades?: BacktestTrade[]
  sim_equity?: Record<string, unknown>[]
  sim_config?: Record<string, unknown>
  sim_skip_reasons?: Record<string, unknown>
  date_presets?: DatePreset[]
  warnings?: string[]
  terminal?: BacktestTerminal
}

type BacktestHistoryEntry = {
  id: string
  title: string
  meta: string
  mode: 'single' | 'multi'
  createdAt: string
  codes: string[]
  freq: string
  signalType?: string
  result?: BacktestResult
  batchResult?: BatchBacktestResult
}

type ScanResult = {
  best_params?: Record<string, unknown>
  scan_results?: Array<Record<string, unknown>>
  heatmap?: Record<string, unknown>
  error?: string
  terminal?: BacktestTerminal
}

type BatchBacktestResult = {
  summary?: Record<string, unknown>
  stocks?: Array<Record<string, unknown>>
  warnings?: string[]
  error?: string
  terminal?: BacktestTerminal
}

type MarkerData = {
  label: string
  color: string
  side: 'buy' | 'sell'
  kind?: 'signal' | 'trade' | 'date-preset'
  sourceIndex?: number
  tradeIndex?: number
}

type ResearchTone = 'success' | 'warning' | 'failed' | 'open' | 'running'

type StrategyResearchSummary = {
  tone: ResearchTone
  statusLabel: string
  headline: string
  detail: string
  cards: Array<{ label: string; value: string; tone?: string }>
  flow: Array<{ label: string; value: string; tone: ResearchTone }>
  issues: string[]
  actions: string[]
}

type StrategyResearchSummaryInput = {
  result?: unknown
  batchResult?: unknown
  error?: string | null
  loading?: boolean
  selectedCodes?: string[]
  freq?: string
  locale?: LongclawLocale
}

const BACKTEST_MARKER_OVERLAY = 'longclawBacktestMarker'
const BACKTEST_MARKER_GROUP = 'longclaw-backtest-markers'
const DATE_PRESET_BEFORE_DAYS = 30
const DATE_PRESET_AFTER_DAYS = 60
const MS_PER_DAY = 86_400_000
const MARKET_DATE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000
const MARKET_DATE_TIME_ZONE = 'Asia/Shanghai'
const BACKTEST_HISTORY_STORAGE_KEY = 'longclaw.backtestWorkbench.history.v1'
const BACKTEST_HISTORY_LIMIT = 8
let markerRegistered = false
const terminalTheme = tradingDeskTheme.colors
const emptyDisplay = '--'

const rootStyle: React.CSSProperties = {
  height: '100%',
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '40px auto minmax(0, 1fr)',
  background: terminalTheme.root,
  color: terminalTheme.text,
  fontFamily: fontStacks.ui,
}

const toolbarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(210px, 360px) auto auto auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 7,
  padding: '5px 9px',
  borderBottom: `1px solid ${terminalTheme.grid}`,
  background: terminalTheme.panel,
  minWidth: 0,
}

const basketBarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: '6px 8px',
  padding: '6px 9px',
  borderBottom: `1px solid ${terminalTheme.grid}`,
  background: terminalTheme.panel,
  minWidth: 0,
}

const basketSearchStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
}

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  flexWrap: 'wrap',
  overflow: 'hidden',
  paddingBottom: 0,
}

const compactChipRowStyle: React.CSSProperties = {
  ...chipRowStyle,
  maxHeight: 68,
}

const mainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(214px, 250px) minmax(0, 1fr) minmax(250px, 320px)',
  minHeight: 0,
  overflow: 'hidden',
  gap: 1,
  background: terminalTheme.grid,
}

const sideStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minHeight: 0,
  overflow: 'hidden',
  background: terminalTheme.grid,
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 9,
  minHeight: 0,
  overflow: 'hidden',
  background: terminalTheme.panel,
}

const chartPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  minHeight: 0,
  background: terminalTheme.root,
}

const chartHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1fr) auto',
  alignItems: 'center',
  gap: 8,
}

const chartTitleStyle: React.CSSProperties = {
  color: terminalTheme.textStrong,
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 800,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const chartShellStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  border: `1px solid ${terminalTheme.chartBorder}`,
  background: terminalTheme.chartPanel,
  overflow: 'hidden',
}

const datePresetFocusStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelInset,
  padding: '7px 8px',
  minHeight: 0,
}

const inputStyle: React.CSSProperties = {
  height: 30,
  minWidth: 0,
  border: `1px solid ${terminalTheme.borderStrong}`,
  borderRadius: 5,
  background: terminalTheme.root,
  color: terminalTheme.textStrong,
  padding: '0 9px',
  fontFamily: fontStacks.mono,
  fontSize: 13,
  outline: 'none',
  transition: interaction.transition,
  touchAction: interaction.touchAction,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  color: terminalTheme.text,
  fontFamily: fontStacks.ui,
}

const labelStyle: React.CSSProperties = {
  color: terminalTheme.mutedStrong,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const mutedStyle: React.CSSProperties = {
  color: terminalTheme.muted,
  fontSize: 12,
  lineHeight: 1.35,
}

const monoStyle: React.CSSProperties = {
  color: terminalTheme.mono,
  fontFamily: fontStacks.mono,
  fontSize: 12,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelSoft,
  padding: '7px 8px',
  minWidth: 0,
}

const compactListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 0,
  overflow: 'auto',
}

const metricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
}

const metricCardStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelInset,
  padding: '7px 8px',
  minWidth: 0,
}

const tableWrapStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
}

const emptyStyle: React.CSSProperties = {
  border: `1px dashed ${terminalTheme.borderMuted}`,
  borderRadius: 5,
  background: terminalTheme.empty,
  color: terminalTheme.muted,
  padding: '12px 10px',
  textAlign: 'center',
  fontSize: 13,
}

const warningStyle: React.CSSProperties = {
  border: `1px solid ${tradingDeskTheme.alpha.accentBorder}`,
  background: tradingDeskTheme.alpha.accentSurface,
  color: terminalTheme.accentText,
  padding: '8px 10px',
  fontSize: 13,
}

const researchPanelStyle: React.CSSProperties = {
  ...panelStyle,
  borderBottom: `1px solid ${terminalTheme.grid}`,
  background: terminalTheme.panelRaised,
  gap: 8,
}

const researchHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
}

const researchFlowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
}

const researchPillStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelInset,
  padding: '6px 7px',
  minWidth: 0,
}

const researchIssueRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
  minWidth: 0,
}

const researchActionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

const multiReportBaseStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  background: terminalTheme.root,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const reportTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  tableLayout: 'fixed',
}

function multiReportDensity(width: number, height: number): MultiReportDensity {
  if (width >= 1680 && height >= 720) return 'wide'
  if (width <= 1240 || height <= 760) return 'compact'
  return 'desk'
}

function multiReportStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    ...multiReportBaseStyle,
    padding: density === 'compact' ? 8 : 10,
    gap: density === 'compact' ? 8 : 10,
  }
}

function multiHeaderStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: density === 'compact' ? 7 : 10,
    alignItems: 'start',
  }
}

function multiKpiGridStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: density === 'compact'
      ? 'repeat(auto-fit, minmax(82px, 1fr))'
      : 'repeat(auto-fit, minmax(104px, 1fr))',
    gap: 6,
    width: '100%',
    minWidth: 0,
  }
}

function multiBandStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: density === 'compact' ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(300px, 0.62fr)',
    gap: density === 'compact' ? 8 : 10,
    minHeight: 0,
  }
}

function multiChartsGridStyle(density: MultiReportDensity, count: number): React.CSSProperties {
  if (density === 'compact') {
    return {
      display: 'grid',
      gridAutoFlow: 'column',
      gridAutoColumns: 'minmax(258px, 32%)',
      gap: 8,
      overflowX: 'auto',
      overflowY: 'hidden',
      paddingBottom: 2,
    }
  }
  if (density === 'wide') {
    if (count < 4) {
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(320px, 420px))`,
        justifyContent: 'start',
        gap: 10,
      }
    }
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.min(count, 5))}, minmax(0, 1fr))`,
      gap: 10,
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 420px))',
    justifyContent: 'start',
    gap: 10,
  }
}

function scriptGridStyle(density: MultiReportDensity, count: number): React.CSSProperties {
  if (density === 'compact') {
    return {
      display: 'grid',
      gridAutoFlow: 'column',
      gridAutoColumns: 'minmax(252px, 31%)',
      gap: 8,
      overflowX: 'auto',
      overflowY: 'hidden',
      paddingBottom: 2,
    }
  }
  if (density === 'wide') {
    if (count < 4) {
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(280px, 380px))`,
        justifyContent: 'start',
        gap: 10,
      }
    }
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.min(count, 5))}, minmax(0, 1fr))`,
      gap: 10,
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 10,
  }
}

function reportTableWrapStyle(kind: 'ranking' | 'overview', density: MultiReportDensity): React.CSSProperties {
  const compactHeight = kind === 'ranking' ? 212 : 202
  return {
    ...tableWrapStyle,
    flex: density === 'compact' ? `0 0 ${compactHeight}px` : '0 0 auto',
    flexShrink: 0,
    minHeight: density === 'compact' ? compactHeight : 0,
    height: density === 'compact' ? compactHeight : undefined,
    maxHeight: density === 'compact' ? compactHeight : 246,
  }
}

function signalBreakdownWrapStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    ...tableWrapStyle,
    flex: '0 0 auto',
    maxHeight: density === 'compact' ? 260 : 330,
  }
}

function multiPanelStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    flexShrink: 0,
    overflow: density === 'compact' ? 'visible' : 'hidden',
  }
}

function reportTableStyleFor(kind: 'ranking' | 'overview', density: MultiReportDensity): React.CSSProperties {
  return {
    ...reportTableStyle,
    minWidth: kind === 'ranking'
      ? (density === 'compact' ? 820 : 1180)
      : (density === 'compact' ? 760 : 820),
  }
}

function backtestDataSourceLabel(result: BacktestResult | null, locale: LongclawLocale): string {
  const target = terminalTarget(result)
  const dataSource = stringValue(target.data_source) ?? result?.data_source
  const dataSourceDetail = stringValue(target.data_source_detail) ?? result?.data_source_detail
  if (!dataSource) return ''
  if (dataSourceDetail) return dataSourceDetail
  const labels: Record<string, string> = locale === 'zh-CN'
    ? {
        disk_cache: '磁盘缓存',
        daily_cache_resampled_weekly: '日线聚合周线',
        daily_cache_resampled_monthly: '日线聚合月线',
        mongodb: 'MongoDB',
        mongodb_bars: 'MongoDB K线',
        mongodb_daily_resampled_weekly: 'Mongo日线聚合周线',
        mongodb_daily_resampled_monthly: 'Mongo日线聚合月线',
        eastmoney: '东财',
        eastmoney_minute: '东财分钟线',
        sina: '新浪',
      }
    : {
        disk_cache: 'Disk cache',
        daily_cache_resampled_weekly: 'Daily cache to weekly',
        daily_cache_resampled_monthly: 'Daily cache to monthly',
        mongodb: 'MongoDB',
        mongodb_bars: 'MongoDB bars',
        mongodb_daily_resampled_weekly: 'Mongo daily to weekly',
        mongodb_daily_resampled_monthly: 'Mongo daily to monthly',
        eastmoney: 'Eastmoney',
        eastmoney_minute: 'Eastmoney intraday',
        sina: 'Sina',
      }
  return labels[dataSource] ?? dataSource
}

function isFallbackDataSource(result: BacktestResult | null): boolean {
  const target = terminalTarget(result)
  const dataSource = stringValue(target.data_source) ?? result?.data_source ?? ''
  return [
    'disk_cache',
    'daily_cache_resampled_weekly',
    'daily_cache_resampled_monthly',
    'mongodb',
    'mongodb_bars',
    'mongodb_daily_resampled_weekly',
    'mongodb_daily_resampled_monthly',
  ].includes(dataSource)
}

function dataHealthText(result: BacktestResult | null, locale: LongclawLocale): string {
  if (!result) return ''
  const target = terminalTarget(result)
  const asOf = stringValue(target.as_of) ?? result.as_of
  const barCount = numberValue(target.bar_count) ?? result.bar_count
  const freshness = stringValue(target.freshness) ?? result.freshness
  const parts = [
    asOf ? `${locale === 'zh-CN' ? '截至' : 'as of'} ${asOf}` : '',
    typeof barCount === 'number' ? (locale === 'zh-CN' ? `${barCount}根K线` : `${barCount} bars`) : '',
    freshness ? freshnessLabel(freshness, locale) : '',
    result.derived_from ? `${locale === 'zh-CN' ? '聚合自' : 'derived from'} ${result.derived_from}` : '',
    result.partial ? (locale === 'zh-CN' ? '部分数据' : 'partial') : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function freqLabel(value: unknown, locale: LongclawLocale): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase()
  const labels: Record<string, string> = locale === 'zh-CN'
    ? {
        daily: '日线',
        day: '日线',
        d: '日线',
        weekly: '周线',
        week: '周线',
        w: '周线',
        monthly: '月线',
        month: '月线',
        m: '月线',
      }
    : {
        daily: 'Daily',
        day: 'Daily',
        d: 'Daily',
        weekly: 'Weekly',
        week: 'Weekly',
        w: 'Weekly',
        monthly: 'Monthly',
        month: 'Monthly',
        m: 'Monthly',
      }
  return labels[key] ?? raw
}

function freshnessLabel(value: unknown, locale: LongclawLocale): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase()
  const labels: Record<string, string> = locale === 'zh-CN'
    ? {
        fresh: '最新',
        stale: '陈旧',
        partial: '部分数据',
        missing: '缺失',
      }
    : {
        fresh: 'fresh',
        stale: 'stale',
        partial: 'partial',
        missing: 'missing',
      }
  return labels[key] ?? raw
}

function runStatusLabel(error: string | null, loading: boolean, hasResult: boolean, locale: LongclawLocale): string {
  if (locale !== 'zh-CN') return error ? 'error' : loading ? 'running' : hasResult ? 'ready' : 'idle'
  if (error) return '失败'
  if (loading) return '分析中'
  if (hasResult) return '已就绪'
  return '待运行'
}

function backtestTabLabel(tab: BacktestTab, locale: LongclawLocale): string {
  if (locale !== 'zh-CN') return tab
  return {
    perf: '绩效',
    trades: '交易',
    signals: '信号',
    scan: '扫描',
    risk: '风控',
  }[tab]
}

function boardKindLabel(kind: unknown, locale: LongclawLocale): string {
  const raw = String(kind ?? '').trim()
  if (!raw) return locale === 'zh-CN' ? '板块' : 'board'
  if (locale !== 'zh-CN') return raw
  return {
    board: '板块',
    concept: '概念',
    industry: '行业',
    chain: '产业链',
  }[raw.toLowerCase()] ?? raw
}

function buttonStyle(active = false, disabled = false): React.CSSProperties {
  return {
    height: 30,
    border: `1px solid ${active ? terminalTheme.accent : terminalTheme.borderStrong}`,
    borderRadius: 5,
    background: active ? terminalTheme.accentSoft : terminalTheme.control,
    color: active ? terminalTheme.accentText : terminalTheme.controlText,
    padding: '0 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontFamily: fontStacks.ui,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    transition: interaction.transition,
    touchAction: interaction.touchAction,
  }
}

function trimTrailingSlash(value?: string): string {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

function urlFromBacktestDashboard(dashboard: BacktestDashboard): string {
  const terminalLink = dashboard.deep_links?.find(link => link.link_id === 'signals-terminal')
  return trimTrailingSlash(terminalLink?.url)
}

function normalizeSymbolCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withoutPrefix = trimmed.replace(/^(SZ|SH|HK|US)\./i, '')
  const suffixMatch = withoutPrefix.match(/^([A-Za-z0-9]+)\.(SZ|SH|HK|US)$/i)
  return (suffixMatch?.[1] ?? withoutPrefix).toUpperCase()
}

const MAX_BACKTEST_BATCH_CODES = 20
const BATCH_BACKTEST_LOOKBACK_BARS = 360
const SYMBOL_NAME_LOOKUP_TIMEOUT_MS = 45_000

function isBacktestUnsupportedBoardCode(code: string): boolean {
  const normalized = normalizeSymbolCode(code)
  return /^(4|8|920)\d{3,5}$/.test(normalized)
}

function orderBacktestCandidateOptions(options: SymbolOption[]): SymbolOption[] {
  return options
    .map((option, index) => ({ option, index, unsupported: isBacktestUnsupportedBoardCode(option.code) }))
    .sort((left, right) => {
      if (left.unsupported === right.unsupported) return left.index - right.index
      return left.unsupported ? 1 : -1
    })
    .map(item => item.option)
}

function extractSymbolCandidates(value: string): string[] {
  const normalized = normalizeSymbolCode(value)
  if (!normalized) return []
  if (/^\d{5,6}$/.test(normalized) || /^[A-Z]{1,6}$/.test(normalized)) return [normalized]
  const aShareCodes = normalized.match(/\d{6}/g) ?? []
  if (aShareCodes.length) return aShareCodes
  return normalized.match(/\d{5}/g) ?? []
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function terminalOf(result: BacktestResult | null | undefined): BacktestTerminal | undefined {
  return result?.terminal?.version === 'backtest-terminal.v1' ? result.terminal : undefined
}

function terminalTarget(result: BacktestResult | null | undefined): Record<string, unknown> {
  return recordValue(terminalOf(result)?.target)
}

function terminalMetrics(result: BacktestResult | null | undefined): Record<string, unknown> {
  return recordValue(terminalOf(result)?.metrics)
}

function terminalPanels(result: BacktestResult | null | undefined): BacktestTerminal['panels'] {
  return terminalOf(result)?.panels
}

function terminalChart(result: BacktestResult | null | undefined): BacktestTerminal['chart'] {
  return terminalOf(result)?.chart
}

function isRecoverableBatchResult(value: unknown): value is BatchBacktestResult {
  const result = recordValue(value) as BatchBacktestResult
  const terminal = recordValue(result.terminal)
  const panels = recordValue(result.terminal?.panels)
  const multiCharts = Array.isArray(recordValue(panels.multi_charts).items)
    ? recordValue(panels.multi_charts).items as unknown[]
    : []
  return Boolean(
    result &&
      (terminal.mode === 'multi' ||
        Array.isArray(result.stocks) ||
        Object.keys(recordValue(result.summary)).length > 0 ||
        multiCharts.length > 0),
  )
}

function isRecoverableSingleResult(value: unknown): value is BacktestResult {
  const result = recordValue(value) as BacktestResult
  const terminal = terminalOf(result)
  return Boolean(
    result &&
      (terminal?.chart?.ohlcv?.length ||
        terminal?.panels?.signals?.rows?.length ||
        Array.isArray(result.ohlcv) ||
        Array.isArray(result.signals)),
  )
}

function resultCodesFromBatch(batchResult: BatchBacktestResult, fallbackCodes: string[]): string[] {
  const rankingRows = Array.isArray(batchResult.terminal?.panels?.ranking?.rows)
    ? batchResult.terminal?.panels?.ranking?.rows ?? []
    : []
  const stockRows = Array.isArray(batchResult.stocks) ? batchResult.stocks : []
  const codes = [...fallbackCodes, ...rankingRows, ...stockRows]
    .map(item => typeof item === 'string'
      ? item
      : stringValue(recordValue(item).code) ?? stringValue(recordValue(item).symbol) ?? '')
    .map(normalizeSymbolCode)
    .filter(Boolean)
  return [...new Set(codes)]
}

function resultCodesFromSingle(result: BacktestResult, fallbackCodes: string[]): string[] {
  const target = terminalTarget(result)
  const codes = [
    ...fallbackCodes,
    stringValue(target.code),
    stringValue(target.symbol),
    result.code,
    result.symbol,
  ]
    .map(item => normalizeSymbolCode(item ?? ''))
    .filter(Boolean)
  return [...new Set(codes)].slice(0, 1)
}

export function createBacktestHistoryEntry(input: {
  result?: BacktestResult | null
  batchResult?: BatchBacktestResult | null
  codes?: string[]
  freq?: string
  signalType?: string
  createdAt?: string
}): BacktestHistoryEntry | null {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const freq = input.freq || 'daily'
  const signalType = input.signalType || 'all'
  if (input.batchResult && isRecoverableBatchResult(input.batchResult)) {
    const codes = resultCodesFromBatch(input.batchResult, input.codes ?? [])
    const summary = recordValue(input.batchResult.summary)
    const metrics = recordValue(input.batchResult.terminal?.metrics)
    const totalStocks = numberValue(summary.total_stocks) ?? codes.length
    const totalSignals = numberValue(summary.total_signals) ?? numberValue(metrics.signal_count)
    const totalTrades = numberValue(summary.total_trades) ?? numberValue(metrics.filled_trades)
    return {
      id: `multi:${freq}:${codes.join(',')}:${createdAt}`,
      title: `多标的回测复盘`,
      meta: [
        `${formatNumber(totalStocks, 0)}标的`,
        totalSignals === undefined ? '' : `${formatNumber(totalSignals, 0)}信号`,
        totalTrades === undefined ? '' : `${formatNumber(totalTrades, 0)}成交`,
      ].filter(Boolean).join(' · '),
      mode: 'multi',
      createdAt,
      codes,
      freq,
      signalType,
      batchResult: input.batchResult,
    }
  }
  if (input.result && isRecoverableSingleResult(input.result)) {
    const codes = resultCodesFromSingle(input.result, input.codes ?? [])
    const target = terminalTarget(input.result)
    const metrics = terminalMetrics(input.result)
    const displayCode = codes[0] ?? normalizeSymbolCode(input.result.code ?? input.result.symbol ?? '')
    const displayName = stringValue(target.name)
    return {
      id: `single:${freq}:${displayCode}:${createdAt}`,
      title: [displayCode, displayName].filter(Boolean).join(' ') || '单票回测',
      meta: [
        `${formatNumber(numberValue(metrics.signal_count) ?? input.result.signals?.length ?? 0, 0)}信号`,
        `${formatNumber(numberValue(metrics.filled_trades) ?? input.result.sim_trades?.length ?? 0, 0)}成交`,
      ].join(' · '),
      mode: 'single',
      createdAt,
      codes: displayCode ? [displayCode] : codes,
      freq,
      signalType,
      result: input.result,
    }
  }
  return null
}

function isBacktestHistoryEntry(value: unknown): value is BacktestHistoryEntry {
  const record = recordValue(value)
  const mode = stringValue(record.mode)
  return Boolean(
    stringValue(record.id) &&
      (mode === 'single' || mode === 'multi') &&
      (isRecoverableBatchResult(record.batchResult) || isRecoverableSingleResult(record.result)),
  )
}

export function parseBacktestHistoryEntries(value: unknown): BacktestHistoryEntry[] {
  const rows = Array.isArray(value) ? value : []
  return rows
    .filter(isBacktestHistoryEntry)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function readBacktestHistoryEntries(): BacktestHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return parseBacktestHistoryEntries(JSON.parse(window.localStorage.getItem(BACKTEST_HISTORY_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function writeBacktestHistoryEntries(entries: BacktestHistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BACKTEST_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, BACKTEST_HISTORY_LIMIT)))
  } catch {
    try {
      window.localStorage.setItem(BACKTEST_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 3)))
    } catch {
      // Ignore storage quota or privacy-mode failures; the active result still renders.
    }
  }
}

function mergeBacktestHistoryEntries(entries: BacktestHistoryEntry[]): BacktestHistoryEntry[] {
  const byId = new Map<string, BacktestHistoryEntry>()
  entries.forEach(entry => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  })
  return [...byId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, BACKTEST_HISTORY_LIMIT)
}

export function backtestHistoryEntryFromRecord(title: string, record: Record<string, unknown>): BacktestHistoryEntry | null {
  const metadata = recordValue(record.metadata)
  const batchResult =
    record.batchResult ??
    record.batch_result ??
    metadata.batchResult ??
    metadata.batch_result ??
    metadata.result
  const singleResult =
    record.result ??
    record.backtest_result ??
    metadata.result ??
    metadata.backtest_result
  const codes = parseCodeList([
    stringValue(record.symbol),
    stringValue(metadata.symbol),
    stringValue(metadata.code),
    stringValue(record.code),
  ].filter(Boolean).join(','))
  const freq = stringValue(record.freq) ?? stringValue(metadata.freq) ?? 'daily'
  const entry = createBacktestHistoryEntry({
    batchResult: isRecoverableBatchResult(batchResult) ? batchResult : null,
    result: isRecoverableSingleResult(singleResult) ? singleResult : null,
    codes,
    freq,
    signalType: stringValue(metadata.signal_type) ?? stringValue(metadata.signal_group),
    createdAt: stringValue(record.updated_at) ?? stringValue(metadata.created_at) ?? stringValue(metadata.updated_at),
  })
  return entry ? { ...entry, title: entry.mode === 'multi' ? entry.title : (title || entry.title) } : null
}

function dashboardBacktestHistoryEntries(dashboard: BacktestDashboard): BacktestHistoryEntry[] {
  return dashboard.backtest_jobs
    .map(job => backtestHistoryEntryFromRecord(String(job.job_id ?? job.symbol ?? 'Backtest'), job as unknown as Record<string, unknown>))
    .filter((entry): entry is BacktestHistoryEntry => Boolean(entry))
}

function formatNumber(value: unknown, digits = 2): string {
  const number = numberValue(value)
  if (number === undefined) return emptyDisplay
  return number.toFixed(digits)
}

function formatPercent(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return emptyDisplay
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`
}

function formatUnsignedPercent(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return emptyDisplay
  return `${number.toFixed(2)}%`
}

function formatDrawdown(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return emptyDisplay
  return `-${Math.abs(number).toFixed(2)}%`
}

function formatMetricValue(value: unknown, unit?: string): string {
  if (unit === '%') return formatPercent(value)
  if (unit === 'D') return `${formatNumber(value, 1)}D`
  const number = numberValue(value)
  if (number === undefined) return String(value ?? emptyDisplay)
  if (Number.isInteger(number)) return String(number)
  return number.toFixed(2)
}

function toneColor(tone?: string): string {
  if (tone === 'up') return tradingDeskTheme.market.up
  if (tone === 'down') return tradingDeskTheme.market.down
  if (tone === 'warning') return palette.warning
  return terminalTheme.textStrong
}

function defaultCodeFromDashboard(dashboard: BacktestDashboard): string {
  const pending = dashboard.pending_backlog_preview[0]
  const candidate = dashboard.buy_candidates[0]
  const chartSymbol = dashboard.chart_context?.symbol
  return normalizeSymbolCode(
    stringValue(chartSymbol) ??
    stringValue(pending?.symbol) ??
    stringValue(candidate?.symbol) ??
    '002759',
  )
}

function toKLineData(rawRows: Record<string, unknown>[] | undefined): KLineData[] {
  const rows = Array.isArray(rawRows) ? rawRows : []
  return rows
    .map(row => {
      const time = numberValue(row.time ?? row.dt ?? row.timestamp)
      const close = numberValue(row.close)
      if (!time || close === undefined) return null
      const timestamp = time < 10_000_000_000 ? time * 1000 : time
      const open = numberValue(row.open) ?? close
      const high = numberValue(row.high) ?? Math.max(open, close)
      const low = numberValue(row.low) ?? Math.min(open, close)
      return {
        timestamp,
        open,
        high,
        low,
        close,
        volume: numberValue(row.volume) ?? numberValue(row.vol) ?? 0,
      } satisfies KLineData
    })
    .filter((item): item is KLineData => Boolean(item))
    .sort((left, right) => left.timestamp - right.timestamp)
}

function normalizeTimestampMs(value: unknown): number | undefined {
  const number = numberValue(value)
  if (number === undefined) return undefined
  return number < 10_000_000_000 ? number * 1000 : number
}

function parseDateTimestampMs(value: unknown): number | undefined {
  const text = stringValue(value)
  if (!text) return undefined
  const match = text.match(/\d{4}-\d{1,2}-\d{1,2}/)
  if (!match) return undefined
  const [year, month, day] = match[0].split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day) - MARKET_DATE_TZ_OFFSET_MS
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function datePresetTimestampMs(preset: DatePreset): number | undefined {
  return normalizeTimestampMs(preset.time) ?? parseDateTimestampMs(preset.date)
}

function dateKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_DATE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const year = parts.find(item => item.type === 'year')?.value
  const month = parts.find(item => item.type === 'month')?.value
  const day = parts.find(item => item.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : new Date(timestamp).toISOString().slice(0, 10)
}

function datePresetShortLabel(preset: DatePreset): string {
  const label = stringValue(preset.label) ?? stringValue(preset.date) ?? stringValue(preset.key) ?? ''
  return label.split('—')[0]?.trim() || label.trim()
}

function datePresetKey(preset: DatePreset, index: number): string {
  return stringValue(preset.key) ?? stringValue(preset.date) ?? stringValue(preset.label) ?? `preset-${index}`
}

export function buildDatePresetWindows(presets: DatePreset[] | undefined, data: KLineData[]): DatePresetWindow[] {
  if (!Array.isArray(presets) || presets.length === 0 || data.length === 0) return []
  const sortedData = data.slice().sort((left, right) => left.timestamp - right.timestamp)
  const first = sortedData[0]?.timestamp
  const last = sortedData[sortedData.length - 1]?.timestamp
  if (!first || !last) return []

  return presets
    .map((preset, index) => {
      const anchorTime = datePresetTimestampMs(preset)
      if (anchorTime === undefined) return null

      const inStrategyRange = anchorTime >= first - MS_PER_DAY && anchorTime <= last + MS_PER_DAY
      if (!inStrategyRange) return null

      const from = Math.max(first, anchorTime - DATE_PRESET_BEFORE_DAYS * MS_PER_DAY)
      const to = Math.min(last, anchorTime + DATE_PRESET_AFTER_DAYS * MS_PER_DAY)
      const barCount = sortedData.filter(item => item.timestamp >= from && item.timestamp <= to).length
      if (barCount === 0) return null

      const label = stringValue(preset.label) ?? stringValue(preset.date) ?? stringValue(preset.key) ?? ''
      return {
        ...preset,
        key: datePresetKey(preset, index),
        label,
        shortLabel: datePresetShortLabel(preset),
        from,
        to,
        anchorTime,
        displayRange: `${dateKey(from)} ~ ${dateKey(to)}`,
        barCount,
      } satisfies DatePresetWindow
    })
    .filter((item): item is DatePresetWindow => Boolean(item))
    .sort((left, right) => left.anchorTime - right.anchorTime)
}

function timestampInDateWindow(timestamp: number | undefined, window: DatePresetWindow | null): boolean {
  if (!window || timestamp === undefined) return false
  return timestamp >= window.from && timestamp <= window.to
}

function signalTimestampMs(signal: BacktestSignal): number | undefined {
  return normalizeTimestampMs(signal.dt ?? signal.time) ?? parseDateTimestampMs(signal.date ?? signal.date_str)
}

function tradeTimestampsMs(trade: BacktestTrade): number[] {
  return [trade.signal_date, trade.entry_date, trade.exit_date]
    .map(parseDateTimestampMs)
    .filter((item): item is number => item !== undefined)
}

export function filterSignalsForDateWindow(signals: BacktestSignal[], window: DatePresetWindow | null): BacktestSignal[] {
  if (!window) return signals
  return signals.filter(signal => timestampInDateWindow(signalTimestampMs(signal), window))
}

export function filterTradesForDateWindow(trades: BacktestTrade[], window: DatePresetWindow | null): BacktestTrade[] {
  if (!window) return trades
  return trades.filter(trade => tradeTimestampsMs(trade).some(timestamp => timestampInDateWindow(timestamp, window)))
}

function filterKLineDataForDateWindow(data: KLineData[], window: DatePresetWindow | null): KLineData[] {
  if (!window) return data
  return data.filter(item => timestampInDateWindow(item.timestamp, window))
}

function filterTradeMarkersForDateWindow(markers: Array<Record<string, unknown>>, window: DatePresetWindow | null): Array<Record<string, unknown>> {
  if (!window) return markers
  return markers.filter(marker => timestampInDateWindow(normalizeTimestampMs(marker.time), window))
}

function nearestKLineData(data: KLineData[], timestamp: number): KLineData | undefined {
  return data.reduce<KLineData | undefined>((nearest, item) => {
    if (!nearest) return item
    return Math.abs(item.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp) ? item : nearest
  }, undefined)
}

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  timeoutMs = 120_000,
  init?: {
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
  },
): Promise<T> {
  return observedFetchJson<T>(baseUrl, path, {
    timeoutMs,
    source: 'backtest.api',
    ...init,
  })
}

function parseCodeList(value: string): string[] {
  const seen = new Set<string>()
  return value
    .split(/[\s,，、;；]+/)
    .flatMap(item => extractSymbolCandidates(item))
    .filter(Boolean)
    .filter(item => {
      const key = item.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function symbolOptionKey(option: SymbolOption): string {
  return option.code.toUpperCase()
}

function hasReadableSymbolName(option: SymbolOption): boolean {
  return Boolean(option.name && option.name.toUpperCase() !== option.code.toUpperCase())
}

function uniqueSymbolOptions(options: SymbolOption[]): SymbolOption[] {
  const byCode = new Map<string, SymbolOption>()
  options.forEach(option => {
    const code = normalizeSymbolCode(option.code)
    if (!code) return
    const key = code.toUpperCase()
    const normalizedOption = { ...option, code, name: option.name || code }
    const existing = byCode.get(key)
    if (!existing) {
      byCode.set(key, normalizedOption)
      return
    }
    const nextHasName = hasReadableSymbolName(normalizedOption)
    const existingHasName = hasReadableSymbolName(existing)
    byCode.set(key, {
      ...existing,
      name: !existingHasName && nextHasName ? normalizedOption.name : existing.name,
      group: existing.group === '直接输入' || existing.group === '当前图表' ? normalizedOption.group : existing.group,
      role: existing.role ?? normalizedOption.role,
      source: existing.source ?? normalizedOption.source,
    })
  })
  return Array.from(byCode.values())
}

function symbolOptionsEqual(left: SymbolOption[], right: SymbolOption[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => {
    const other = right[index]
    return other &&
      item.code === other.code &&
      item.name === other.name &&
      item.group === other.group &&
      item.role === other.role &&
      item.source === other.source
  })
}

function symbolLabel(code: string, option?: SymbolOption): string {
  const normalized = normalizeSymbolCode(code)
  const name = option?.name?.trim()
  return name && name.toUpperCase() !== normalized.toUpperCase()
    ? `${normalized} ${name}`
    : normalized
}

function selectedSymbolDisplay(codes: string[], options: SymbolOption[], locale: LongclawLocale): { short: string; full: string } {
  const byCode = new Map(options.map(option => [symbolOptionKey(option), option]))
  const labels = codes.map(code => symbolLabel(code, byCode.get(code.toUpperCase())))
  const full = labels.join(locale === 'zh-CN' ? '、' : ', ')
  if (labels.length <= 3) return { short: full, full }
  const suffix = locale === 'zh-CN' ? ` 等${labels.length}只` : ` +${labels.length - 3} more`
  return {
    short: `${labels.slice(0, 3).join(locale === 'zh-CN' ? '、' : ', ')}${suffix}`,
    full,
  }
}

function symbolOptionFromRecord(row: Record<string, unknown>, group: string): SymbolOption | null {
  const code = normalizeSymbolCode(
    stringValue(row.code) ??
    stringValue(row.symbol) ??
    stringValue(row.ts_code) ??
    '',
  )
  if (!code) return null
  return {
    code,
    name: stringValue(row.name) ?? stringValue(row.stock_name) ?? stringValue(row.target_name) ?? code,
    group,
  }
}

export function symbolOptionFromLookupPayload(payload: SymbolLookupResponse, fallbackCode: string): SymbolOption | null {
  const target = recordValue(payload.target)
  const firstMatch = Array.isArray(payload.matches) ? recordValue(payload.matches[0]) : {}
  return symbolOptionFromRecord({
    code: target.symbol ?? target.code ?? payload.symbol ?? payload.code ?? firstMatch.symbol ?? firstMatch.code ?? fallbackCode,
    name: target.name ?? target.label ?? payload.name ?? payload.stock_name ?? payload.label ?? firstMatch.name,
  }, '名称查询')
}

export function symbolOptionsFromBacktestOutputs(
  result?: BacktestResult | null,
  batchResult?: BatchBacktestResult | null,
): SymbolOption[] {
  const options: SymbolOption[] = []
  const target = terminalTarget(result)
  const singleOption = symbolOptionFromRecord({
    code: target.symbol ?? target.code ?? result?.symbol ?? result?.code,
    name: target.name,
  }, '回测结果')
  if (singleOption) options.push(singleOption)

  const batchPanels = batchResult?.terminal?.panels ?? {}
  const batchChart = batchResult?.terminal?.chart ?? {}
  const recordGroups: Array<[Array<Record<string, unknown>> | undefined, string]> = [
    [Array.isArray(batchResult?.stocks) ? batchResult?.stocks : undefined, '批量结果'],
    [Array.isArray(batchPanels.ranking?.rows) ? batchPanels.ranking?.rows : undefined, '批量排名'],
    [Array.isArray(batchPanels.interval_overview?.rows) ? batchPanels.interval_overview?.rows : undefined, '区间概览'],
    [Array.isArray(batchPanels.multi_charts?.items) ? batchPanels.multi_charts?.items : undefined, '批量K线'],
    [Array.isArray(batchChart.multi_charts) ? batchChart.multi_charts : undefined, '批量K线'],
    [Array.isArray(batchPanels.scripts?.cards) ? batchPanels.scripts?.cards : undefined, '交易员结论'],
  ]
  recordGroups.forEach(([rows, group]) => {
    rows?.forEach(row => {
      const option = symbolOptionFromRecord(recordValue(row), group)
      if (option) options.push(option)
    })
  })
  return uniqueSymbolOptions(options)
}

function dashboardSymbolOptions(dashboard: BacktestDashboard): SymbolOption[] {
  const options: SymbolOption[] = []
  dashboard.buy_candidates.slice(0, 12).forEach(candidate => {
    const code = normalizeSymbolCode(candidate.symbol)
    if (code) {
      options.push({
        code,
        name: candidate.name || code,
        group: '观察池',
      })
    }
  })
  dashboard.pending_backlog_preview.slice(0, 8).forEach(item => {
    const code = normalizeSymbolCode(item.symbol)
    if (code) {
      options.push({
        code,
        name: code,
        group: '待复盘',
      })
    }
  })
  const chartCode = normalizeSymbolCode(dashboard.chart_context?.symbol ?? '')
  if (chartCode) {
    options.push({
      code: chartCode,
      name: chartCode,
      group: '当前图表',
    })
  }
  return uniqueSymbolOptions(options)
}

function symbolOptionsForPicker(dashboard: BacktestDashboard): SymbolOption[] {
  return dashboardSymbolOptions(dashboard)
}

function symbolOptionMatches(option: SymbolOption, query: string): boolean {
  if (!query) return true
  const haystack = [option.code, option.name, option.group].join(' ').toLowerCase()
  return haystack.includes(query)
}

function directSymbolOptionsFromQuery(query: string): SymbolOption[] {
  const chunks = query.split(/[\s,，、;；]+/).map(item => item.trim()).filter(Boolean)
  const codes = chunks.flatMap(item => {
    const normalized = normalizeSymbolCode(item)
    const hasMarketPrefix = /^(SZ|SH|HK|US)\./i.test(item)
    const hasMarketSuffix = /\.(SZ|SH|HK|US)$/i.test(item)
    const numericCode = /^\d{5,6}$/.test(normalized)
    if (!hasMarketPrefix && !hasMarketSuffix && !numericCode) return []
    return extractSymbolCandidates(item)
  })
  return uniqueSymbolOptions(codes.map(code => ({
    code,
    name: code,
    group: '直接输入',
  })))
}

function symbolOptionsMatchingQuery(query: string, options: SymbolOption[]): SymbolOption[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  const directOptions = directSymbolOptionsFromQuery(query)
  const matchedOptions = uniqueSymbolOptions([...directOptions, ...options])
    .filter(option => symbolOptionMatches(option, normalizedQuery))
  return uniqueSymbolOptions([...directOptions, ...matchedOptions])
}

function basketMatches(basket: SymbolBasket, query: string): boolean {
  if (!query) return true
  const haystack = [
    basket.label,
    basket.source,
    basket.domain,
    basket.description,
    basket.chain_id,
    basket.node_id,
    ...basket.codes.flatMap(item => [item.code, item.name, item.group]),
  ].join(' ').toLowerCase()
  return haystack.includes(query)
}

function normalizeDynamicBaskets(rawBaskets: SymbolBasket[] | undefined): SymbolBasket[] {
  if (!Array.isArray(rawBaskets)) return []
  const baskets: SymbolBasket[] = []
  rawBaskets.forEach((rawBasket, index) => {
    const label = stringValue(rawBasket.label) ?? ''
    const source = stringValue(rawBasket.source)
    const id = stringValue(rawBasket.id) ?? `${source ?? 'basket'}:${label || index}`
    const codes = uniqueSymbolOptions((Array.isArray(rawBasket.codes) ? rawBasket.codes : []).flatMap(rawOption => {
      const code = normalizeSymbolCode(rawOption.code)
      if (!code) return []
      return [{
        code,
        name: stringValue(rawOption.name) ?? code,
        group: stringValue(rawOption.group) ?? label,
        role: stringValue(rawOption.role),
        source: stringValue(rawOption.source) ?? source,
      }]
    }))
    if (!label || codes.length === 0) return
    baskets.push({
      id,
      label,
      source,
      domain: stringValue(rawBasket.domain),
      description: stringValue(rawBasket.description),
      chain_id: stringValue(rawBasket.chain_id),
      node_id: stringValue(rawBasket.node_id),
      confidence: numberValue(rawBasket.confidence),
      codes,
    })
  })
  return baskets
}

function selectedSymbolText(codes: string[]): string {
  return codes.join(',')
}

function sameCodeSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const keys = new Set(left.map(item => item.toUpperCase()))
  return right.every(item => keys.has(item.toUpperCase()))
}

function compactApiError(rawError: ApiError, locale: LongclawLocale, fallback: string): string {
  const payload = recordValue(rawError.payload)
  const rawMessage = stringValue(payload.last_upstream_error) ??
    stringValue(payload.error) ??
    stringValue(payload.detail) ??
    rawError.message
  if (!rawMessage) return fallback
  if (/timeout|timed out|abort/i.test(rawMessage)) {
    return locale === 'zh-CN'
      ? 'Signals 回测接口超时。先缩小标的篮子或换成日线单票；如果连续超时，再看数据源和回测队列。'
      : 'Signals backtest timed out. Narrow the basket or run one daily symbol first.'
  }
  if (/traceback|File\s+["'].*\.py["']|^\s*at\s+/i.test(rawMessage)) {
    return locale === 'zh-CN'
      ? '回测服务返回了内部错误。请确认输入的是股票代码，或从已选池勾选后重试。'
      : 'Backtest service returned an internal error. Check the symbol code or pick from the pool.'
  }
  return rawMessage.length > 140 ? `${rawMessage.slice(0, 140)}...` : rawMessage
}

function uniqueText(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const text = item.trim()
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  })
}

function classifyMetricTone(value: number | undefined, goodAtOrAbove = 0): string {
  if (value === undefined) return 'neutral'
  return value >= goodAtOrAbove ? 'up' : 'down'
}

function batchResearchSummary(
  batchResult: BatchBacktestResult,
  locale: LongclawLocale,
): StrategyResearchSummary {
  const zh = locale === 'zh-CN'
  const summary = recordValue(batchResult.summary)
  const metrics = recordValue(batchResult.terminal?.metrics)
  const totalStocks = numberValue(summary.total_stocks) ?? batchResult.stocks?.length ?? 0
  const okStocks = numberValue(summary.ok_stocks)
  const totalSignals = numberValue(summary.total_signals) ?? 0
  const totalTrades = numberValue(summary.total_trades) ?? 0
  const winRate = numberValue(metrics.win_rate)
  const avgReturn = numberValue(metrics.total_return_pct)
  const avgDrawdown = Math.abs(numberValue(metrics.max_drawdown_pct) ?? 0)
  const failureCount = okStocks !== undefined ? Math.max(0, totalStocks - okStocks) : 0
  const sampleThin = totalStocks < 3 || totalTrades < Math.max(12, totalStocks * 4)
  const warnings = uniqueText([...(batchResult.warnings ?? []), stringValue(batchResult.error) ?? ''])
  const issues = uniqueText([
    totalStocks === 0 ? (zh ? '没有有效标的样本' : 'No valid symbols') : '',
    sampleThin ? (zh ? '组合样本偏薄，不能直接沉淀策略' : 'Basket sample is too thin to promote') : '',
    failureCount > 0 ? (zh ? `${failureCount}只标的回测失败或跳过` : `${failureCount} symbols failed or skipped`) : '',
    avgDrawdown > 18 ? (zh ? `平均回撤压力 ${formatDrawdown(avgDrawdown)}` : `High average drawdown ${formatDrawdown(avgDrawdown)}`) : '',
    winRate !== undefined && winRate < 50 ? (zh ? `批量胜率不足 ${formatPercent(winRate)}` : `Batch win rate below 50% ${formatPercent(winRate)}`) : '',
    ...warnings,
  ])
  const tone: ResearchTone = issues.length
    ? totalTrades > 0 ? 'warning' : 'failed'
    : 'success'
  const actions = uniqueText([
    totalStocks < 3
      ? (zh ? '先扩到同一主线 5-10 只标的，再看规则是否跨标的有效。' : 'Expand to 5-10 names in the same theme before judging generalization.')
      : '',
    sampleThin
      ? (zh ? '优先补厚成交样本；样本薄时只做观察，不做参数优化。' : 'Thicken filled-trade samples before optimizing parameters.')
      : '',
    zh ? '先下钻排名第一和最大回撤标的，对照买卖点是否来自同一种信号。' : 'Drill into the top-ranked and worst-drawdown symbols and compare signal sources.',
    zh ? '只把跨标的、跨参数仍稳定的信号族推进到策略候选。' : 'Promote only signal families that stay stable across symbols and parameters.',
  ])
  return {
    tone,
    statusLabel: zh ? (tone === 'success' ? '组合可复核' : '先清洗样本') : (tone === 'success' ? 'Basket ready' : 'Clean sample'),
    headline: zh
      ? `${totalStocks}只标的 · ${totalSignals}个信号 · ${totalTrades}笔成交`
      : `${totalStocks} symbols · ${totalSignals} signals · ${totalTrades} trades`,
    detail: zh
      ? '批量回测不是看平均数好不好，而是判断同一规则能否在一组相似标的上重复出现。'
      : 'Batch backtest is for repeatability across comparable symbols, not just average metrics.',
    cards: [
      { label: zh ? '标的' : 'Symbols', value: formatNumber(totalStocks, 0) },
      { label: zh ? '信号' : 'Signals', value: formatNumber(totalSignals, 0) },
      { label: zh ? '成交' : 'Trades', value: formatNumber(totalTrades, 0), tone: totalTrades >= Math.max(8, totalStocks) ? 'up' : 'down' },
      { label: zh ? '胜率' : 'WinRate', value: formatPercent(winRate), tone: classifyMetricTone(winRate, 50) },
      { label: zh ? '均收益' : 'AvgRet', value: formatPercent(avgReturn), tone: classifyMetricTone(avgReturn) },
      { label: zh ? '均回撤' : 'AvgDD', value: formatDrawdown(avgDrawdown), tone: avgDrawdown <= 15 ? 'up' : 'down' },
    ],
    flow: [
      { label: zh ? '交易筛选' : 'Trade filter', value: totalStocks ? (zh ? `${totalStocks}只候选` : `${totalStocks} candidates`) : (zh ? '无候选' : 'No candidates'), tone: totalStocks ? 'success' : 'failed' },
      { label: zh ? '共性验证' : 'Repeatability', value: sampleThin ? (zh ? '样本偏薄' : 'Thin sample') : (zh ? '可比较' : 'Comparable'), tone: sampleThin ? 'warning' : 'success' },
      { label: zh ? '下钻动作' : 'Next drilldown', value: totalTrades > 0 ? (zh ? '强弱对照' : 'Compare winners/losers') : (zh ? '先补成交' : 'Get trades first'), tone: totalTrades > 0 ? 'success' : 'warning' },
    ],
    issues,
    actions,
  }
}

export function buildStrategyResearchSummary(input: StrategyResearchSummaryInput): StrategyResearchSummary {
  const locale = input.locale ?? 'zh-CN'
  const zh = locale === 'zh-CN'
  const result = input.result as BacktestResult | null | undefined
  const batchResult = input.batchResult as BatchBacktestResult | null | undefined
  const selectedCodes = input.selectedCodes ?? []
  const batchSelected = selectedCodes.length > 1
  if (input.loading) {
    return {
      tone: 'running',
      statusLabel: zh ? (batchSelected ? '批量验证中' : '正在验证') : 'Running',
      headline: zh ? (batchSelected ? '正在拉取批量回测证据' : '正在拉取回测证据') : 'Collecting backtest evidence',
      detail: zh
        ? (batchSelected ? '先等成功/失败标的、排名、信号拆解和成交样本返回，再判断规则共性。' : '先等数据、K线、信号和成交同时返回，再做策略判断。')
        : 'Wait for candles, signals, and trades before judging the rule.',
      cards: [
        { label: zh ? '标的' : 'Symbols', value: formatNumber(selectedCodes.length || 1, 0) },
        { label: zh ? '周期' : 'Freq', value: freqLabel(input.freq, locale) || emptyDisplay },
        { label: zh ? '状态' : 'Status', value: zh ? '运行中' : 'Running' },
      ],
      flow: [
        { label: zh ? (batchSelected ? '样本' : '盘中观察') : 'Sample', value: zh ? (batchSelected ? `${selectedCodes.length}只候选` : '保留候选') : 'Keep candidates', tone: 'open' },
        { label: zh ? (batchSelected ? '批量证据' : '盘后验证') : 'Evidence', value: zh ? '等待结果' : 'Waiting', tone: 'running' },
        { label: zh ? (batchSelected ? '下一步' : '研发推进') : 'Next step', value: zh ? '暂不下结论' : 'No verdict yet', tone: 'open' },
      ],
      issues: [],
      actions: [zh ? '如果超过一分钟仍无结果，先缩小到单票日线。' : 'If it takes over a minute, narrow to one daily symbol.'],
    }
  }
  if (input.error) {
    return {
      tone: 'failed',
      statusLabel: zh ? '异常优先' : 'Fix first',
      headline: zh ? '先处理回测异常，再判断策略质量' : 'Resolve the backtest issue before judging the strategy',
      detail: input.error,
      cards: [
        { label: zh ? '标的' : 'Symbols', value: formatNumber(selectedCodes.length || 1, 0) },
        { label: zh ? '周期' : 'Freq', value: freqLabel(input.freq, locale) || emptyDisplay },
        { label: zh ? '状态' : 'Status', value: zh ? '失败' : 'Failed', tone: 'down' },
      ],
      flow: [
        { label: zh ? '盘中观察' : 'Intraday', value: zh ? '保留原始线索' : 'Keep clues', tone: 'warning' },
        { label: zh ? '盘后验证' : 'Post-close', value: zh ? '数据/接口异常' : 'Data/API issue', tone: 'failed' },
        { label: zh ? '研发推进' : 'Research', value: zh ? '暂停结论' : 'Pause verdict', tone: 'warning' },
      ],
      issues: [input.error],
      actions: [
        zh ? '先确认代码是沪深/HK有效标的，或从已选池重新勾选。' : 'Confirm the symbol is supported or pick from the basket.',
        zh ? '若是超时，先单票日线，再逐步加回篮子。' : 'For timeouts, retry one daily symbol before expanding.',
      ],
    }
  }
  if (batchResult?.terminal?.mode === 'multi' || batchResult?.summary) {
    return batchResearchSummary(batchResult, locale)
  }
  if (!result) {
    if (batchSelected) {
      return {
        tone: 'open',
        statusLabel: zh ? '待批量验证' : 'Batch not run',
        headline: zh ? `${selectedCodes.length}只候选待验证` : `${selectedCodes.length} candidates ready`,
        detail: zh
          ? '批量回测用于判断规则能不能跨标的重复出现；先看共性和失败样本，再下钻单票。'
          : 'Use batch backtest to test repeatability, then drill into representative symbols.',
        cards: [
          { label: zh ? '标的' : 'Symbols', value: formatNumber(selectedCodes.length, 0) },
          { label: zh ? '周期' : 'Freq', value: freqLabel(input.freq, locale) || emptyDisplay },
          { label: zh ? '成交' : 'Trades', value: emptyDisplay },
        ],
        flow: [
          { label: zh ? '交易筛选' : 'Trade filter', value: zh ? '候选已就绪' : 'Candidates ready', tone: 'open' },
          { label: zh ? '共性验证' : 'Repeatability', value: zh ? '待回测' : 'Not run', tone: 'open' },
          { label: zh ? '下钻动作' : 'Next drilldown', value: zh ? '等排名' : 'Wait ranking', tone: 'open' },
        ],
        issues: [],
        actions: [
          zh ? '运行批量回测后，先看强弱排名、失败样本和信号族拆解。' : 'Run batch, then inspect ranking, failures, and signal families.',
          zh ? '不要直接用两三只样本优化参数，先扩到同一主线 5-10 只。' : 'Do not optimize on a tiny basket; expand to 5-10 comparable names first.',
        ],
      }
    }
    return {
      tone: 'open',
      statusLabel: zh ? '待建立样本' : 'No sample',
      headline: zh ? '先把盘中观察变成可验证样本' : 'Turn intraday observations into a testable sample',
      detail: zh
        ? '从买点池、盯盘池或产业链组合选标的，盘后用日线/周线验证，再用扫描看参数稳定性。'
        : 'Pick names from candidates or baskets, validate daily/weekly, then scan parameter stability.',
      cards: [
        { label: zh ? '标的' : 'Symbols', value: formatNumber(selectedCodes.length || 1, 0) },
        { label: zh ? '周期' : 'Freq', value: freqLabel(input.freq, locale) || emptyDisplay },
        { label: zh ? '成交' : 'Trades', value: emptyDisplay },
      ],
      flow: [
        { label: zh ? '盘中观察' : 'Intraday', value: zh ? '主线/买点/失效' : 'Theme, entry, invalidation', tone: 'open' },
        { label: zh ? '盘后验证' : 'Post-close', value: zh ? '收益/回撤/超额' : 'Return, drawdown, excess', tone: 'open' },
        { label: zh ? '研发推进' : 'Research', value: zh ? '扫描参数稳定性' : 'Scan parameter stability', tone: 'open' },
      ],
      issues: [],
      actions: [
        zh ? '先运行当前单票，确认有K线、信号和成交。' : 'Run the current symbol and confirm candles, signals, and trades.',
        zh ? '再换成产业链组合，检查规则是否只对单票有效。' : 'Then test a basket to see whether the rule generalizes.',
      ],
    }
  }

  const panels = terminalPanels(result)
  const metrics = terminalMetrics(result)
  const target = terminalTarget(result)
  const kpi = recordValue(result.kpi)
  const simKpi = recordValue(result.sim_kpi)
  const trades = panels?.trades?.rows ?? result.sim_trades ?? []
  const signals = panels?.signals?.rows ?? result.signals ?? []
  const totalReturn = numberValue(metrics.total_return_pct ?? simKpi.total_return_pct)
  const maxDrawdown = Math.abs(numberValue(metrics.max_drawdown_pct ?? simKpi.max_drawdown_pct) ?? 0)
  const winRate = numberValue(metrics.win_rate ?? simKpi.win_rate ?? kpi.win_rate)
  const sharpe = numberValue(metrics.sharpe ?? simKpi.sharpe)
  const excess = numberValue(metrics.excess_return_pct)
  const tradeCount = numberValue(metrics.filled_trades ?? simKpi.filled_trades) ?? trades.filter(trade => trade.entry_price !== null && trade.entry_price !== undefined).length
  const signalCount = numberValue(metrics.signal_count ?? kpi.total) ?? signals.length
  const freshness = stringValue(target.freshness) ?? result.freshness
  const warnings = uniqueText(result.warnings ?? [])
  const issues = uniqueText([
    freshness && freshness !== 'fresh' ? `${zh ? '数据新鲜度' : 'Freshness'}: ${freshnessLabel(freshness, locale)}` : '',
    result.partial ? (zh ? '仅返回部分数据' : 'Partial data returned') : '',
    result.last_upstream_error ? (zh ? `上游异常：${result.last_upstream_error}` : `Upstream: ${result.last_upstream_error}`) : '',
    signalCount === 0 ? (zh ? '没有信号样本' : 'No signal sample') : '',
    tradeCount === 0 ? (zh ? '没有成交样本' : 'No filled trades') : '',
    tradeCount > 0 && tradeCount < 8 ? (zh ? '成交样本偏少' : 'Too few trades') : '',
    totalReturn !== undefined && totalReturn < 0 ? (zh ? '策略收益为负' : 'Negative strategy return') : '',
    maxDrawdown > 20 ? (zh ? `最大回撤偏大 ${formatDrawdown(maxDrawdown)}` : `High drawdown ${formatDrawdown(maxDrawdown)}`) : '',
    sharpe !== undefined && sharpe < 0.8 ? (zh ? `Sharpe 不足 ${formatNumber(sharpe, 2)}` : `Low Sharpe ${formatNumber(sharpe, 2)}`) : '',
    excess !== undefined && excess < 0 ? (zh ? `未跑赢基准 ${formatPercent(excess)}` : `Under benchmark ${formatPercent(excess)}`) : '',
    ...warnings,
  ])
  const hasHardIssue = signalCount === 0 || tradeCount === 0 || (totalReturn !== undefined && totalReturn < 0)
  const tone: ResearchTone = hasHardIssue
    ? 'failed'
    : issues.length
      ? 'warning'
      : 'success'
  const actions = uniqueText([
    freshness && freshness !== 'fresh' ? (zh ? '先补齐最新K线或换数据源，再判断策略。' : 'Refresh bars or switch data source before judging.') : '',
    tradeCount < 8 ? (zh ? '扩大标的篮子或拉长区间，避免用薄样本研发。' : 'Widen the basket or range before optimizing.') : '',
    maxDrawdown > 20 ? (zh ? '优先扫描止损、移动止盈、均线离场，先压回撤。' : 'Scan stop loss, trailing stop, and MA exits to reduce drawdown.') : '',
    excess !== undefined && excess < 0 ? (zh ? '把同一主线强势股一起回测，确认是不是选股弱于基准。' : 'Backtest stronger peers in the same theme to separate selection from rule weakness.') : '',
    sharpe !== undefined && sharpe >= 1 && tradeCount >= 8 ? (zh ? '进入参数扫描，检查收益是否对单一参数过敏。' : 'Run parameter scans and check sensitivity.') : '',
    tone === 'success' ? (zh ? '用产业链组合复验，若仍稳定再沉淀为候选策略。' : 'Re-test on a basket, then promote if stable.') : '',
  ])
  return {
    tone,
    statusLabel: zh
      ? tone === 'success' ? '可继续研发' : tone === 'warning' ? '谨慎推进' : '先淘汰/重写'
      : tone === 'success' ? 'Researchable' : tone === 'warning' ? 'Proceed carefully' : 'Rewrite first',
    headline: zh
      ? `收益 ${formatPercent(totalReturn)} · 回撤 ${formatDrawdown(maxDrawdown)} · 超额 ${formatPercent(excess)}`
      : `Return ${formatPercent(totalReturn)} · DD ${formatDrawdown(maxDrawdown)} · Excess ${formatPercent(excess)}`,
    detail: zh
      ? '研发判断优先看样本厚度、回撤、超额收益和数据健康；单票好看但超额为负时不能直接升级为策略。'
      : 'Research judgment prioritizes sample depth, drawdown, excess return, and data health.',
    cards: [
      { label: zh ? '收益' : 'Return', value: formatPercent(totalReturn), tone: classifyMetricTone(totalReturn) },
      { label: zh ? '回撤' : 'Drawdown', value: formatDrawdown(maxDrawdown), tone: maxDrawdown <= 15 ? 'up' : 'down' },
      { label: zh ? '胜率' : 'WinRate', value: formatPercent(winRate), tone: classifyMetricTone(winRate, 50) },
      { label: zh ? '成交' : 'Trades', value: formatNumber(tradeCount, 0), tone: tradeCount >= 8 ? 'up' : 'down' },
      { label: 'Sharpe', value: formatNumber(sharpe, 2), tone: classifyMetricTone(sharpe, 1) },
      { label: zh ? '超额' : 'Excess', value: formatPercent(excess), tone: classifyMetricTone(excess) },
    ],
    flow: [
      { label: zh ? '盘中观察' : 'Intraday', value: signalCount > 0 ? (zh ? `${signalCount}个信号` : `${signalCount} signals`) : (zh ? '无信号' : 'No signal'), tone: signalCount > 0 ? 'success' : 'failed' },
      { label: zh ? '盘后验证' : 'Post-close', value: tradeCount > 0 ? (zh ? `${tradeCount}笔成交` : `${tradeCount} trades`) : (zh ? '无成交' : 'No trades'), tone: tradeCount >= 8 ? 'success' : tradeCount > 0 ? 'warning' : 'failed' },
      { label: zh ? '研发推进' : 'Research', value: tone === 'success' ? (zh ? '可扫描参数' : 'Scan params') : (zh ? '先修约束' : 'Fix constraints'), tone },
    ],
    issues,
    actions: actions.length ? actions : [zh ? '打开交易明细，确认收益不是少数异常成交贡献。' : 'Review trades and check that returns are not one-off outliers.'],
  }
}

function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }
    update()
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) {
        update()
        return
      }
      setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}

function buildBatchBody(
  codes: string[],
  freq: string,
  signalType: SignalType,
  simParams: Record<string, string>,
): Record<string, unknown> {
  const body: Record<string, unknown> = { codes, freq, lookback: BATCH_BACKTEST_LOOKBACK_BARS }
  if (signalType === 'all' || signalType === 'macd' || signalType === 'czsc') {
    body.signal_group = signalType
  } else {
    body.signal_group = 'all'
    body.factor = signalType
  }
  const numericKeys = [
    'stop_loss',
    'trail_stop',
    'max_hold',
    'slippage',
    'take_profit',
    'ma_exit_period',
    'profit_drawdown',
    'atr_exit_period',
    'atr_exit_mult',
  ]
  numericKeys.forEach(key => {
    const value = simParams[key]
    if (!value?.trim()) return
    const parsed = Number(value)
    body[key] = Number.isFinite(parsed) ? parsed : value
  })
  return body
}

function chartStyles(): DeepPartial<Styles> {
  return {
    grid: {
      horizontal: { color: tradingDeskTheme.chart.gridHorizontal },
      vertical: { color: tradingDeskTheme.chart.gridVertical },
    },
    candle: {
      bar: {
        upColor: tradingDeskTheme.market.up,
        downColor: tradingDeskTheme.market.down,
        upBorderColor: tradingDeskTheme.market.up,
        downBorderColor: tradingDeskTheme.market.down,
        upWickColor: tradingDeskTheme.market.up,
        downWickColor: tradingDeskTheme.market.down,
        noChangeColor: tradingDeskTheme.market.flat,
      },
      priceMark: {
        last: {
          line: { show: true, color: tradingDeskTheme.chart.line, size: 1 },
          text: { show: true, color: terminalTheme.white, backgroundColor: tradingDeskTheme.chart.line, size: 11 },
        },
      },
    },
    indicator: {
      lines: [
        { color: tradingDeskTheme.chart.orange, size: 1, style: 'solid' },
        { color: tradingDeskTheme.chart.line, size: 1, style: 'solid' },
        { color: tradingDeskTheme.chart.violet, size: 1, style: 'solid' },
        { color: tradingDeskTheme.market.down, size: 1, style: 'solid' },
      ],
    },
    xAxis: { tickText: { color: tradingDeskTheme.market.flat, size: 11 } },
    yAxis: { tickText: { color: tradingDeskTheme.market.flat, size: 11 } },
    crosshair: {
      horizontal: { line: { color: tradingDeskTheme.market.flat, size: 1 } },
      vertical: { line: { color: tradingDeskTheme.market.flat, size: 1 } },
    },
    separator: { color: tradingDeskTheme.chart.separator, size: 1 },
  }
}

function ensureMarkerOverlay() {
  if (markerRegistered) return
  registerOverlay({
    name: BACKTEST_MARKER_OVERLAY,
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }: OverlayCreateFiguresCallbackParams) => {
      const point = coordinates[0]
      if (!point) return []
      const data = recordValue(overlay.extendData) as MarkerData
      const label = data.label || 'SIG'
      const side = data.side === 'sell' ? 'sell' : 'buy'
      const color = data.color || (side === 'buy' ? tradingDeskTheme.chart.orange : tradingDeskTheme.chart.purple)
      const width = Math.max(32, Math.min(70, label.length * 8 + 14))
      const height = 18
      const rectX = point.x - width / 2
      const rectY = side === 'buy' ? point.y + 8 : point.y - height - 8
      return [
        {
          type: 'rect',
          attrs: { x: rectX, y: rectY, width, height },
          styles: { color, borderColor: tradingDeskTheme.alpha.textBorderStrong, borderRadius: 4 },
          ignoreEvent: true,
        },
        {
          type: 'text',
          attrs: {
            x: point.x,
            y: rectY + height / 2,
            text: label.slice(0, 8),
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            color: terminalTheme.white,
            size: 10,
            weight: 700,
            family: 'IBM Plex Mono, Menlo, monospace',
          },
          ignoreEvent: true,
        },
      ]
    },
  })
  markerRegistered = true
}

function signalLabel(signal: BacktestSignal): string {
  const raw = String(signal.type ?? signal.group ?? 'SIG').trim()
  if (!raw) return 'SIG'
  return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase().slice(0, 5) : raw.slice(0, 4)
}

function signalColor(signal: BacktestSignal): string {
  const group = String(signal.group ?? '').toLowerCase()
  if (group === 'macd') return tradingDeskTheme.market.down
  if (group === 'czsc') return tradingDeskTheme.chart.orange
  if (group.includes('trend')) return tradingDeskTheme.market.down
  if (group.includes('vol')) return tradingDeskTheme.chart.violet
  if (group.includes('candle')) return tradingDeskTheme.chart.gold
  if (group.includes('gap')) return tradingDeskTheme.chart.orange
  return tradingDeskTheme.chart.purple
}

function signalSide(signal: BacktestSignal): 'buy' | 'sell' {
  const text = String(signal.type ?? '').toLowerCase()
  return text.includes('卖') || text.includes('sell') || text.includes('exit') ? 'sell' : 'buy'
}

function createSignalOverlays(
  chart: Chart,
  data: KLineData[],
  signals: BacktestSignal[],
  tradeMarkers: Array<Record<string, unknown>> = [],
  activeDateWindow: DatePresetWindow | null = null,
  onSelectMarker?: (marker: MarkerData) => void,
) {
  chart.removeOverlay({ groupId: BACKTEST_MARKER_GROUP })
  if (data.length === 0) return
  const dataByTimestamp = new Map(data.map(item => [item.timestamp, item]))
  if (activeDateWindow) {
    const eventBar = nearestKLineData(data, activeDateWindow.anchorTime)
    if (eventBar) {
      chart.createOverlay({
        name: BACKTEST_MARKER_OVERLAY,
        groupId: BACKTEST_MARKER_GROUP,
        lock: true,
        points: [{ timestamp: eventBar.timestamp, value: eventBar.close }],
        extendData: {
          label: activeDateWindow.shortLabel,
          color: tradingDeskTheme.chart.gold,
          side: 'sell',
          kind: 'date-preset',
        } satisfies MarkerData,
      })
    }
  }
  signals.slice(-80).forEach(signal => {
    const rawTime = numberValue(signal.dt ?? signal.time)
    if (!rawTime) return
    const timestamp = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime
    const price = numberValue(signal.price) ?? dataByTimestamp.get(timestamp)?.close
    if (price === undefined) return
    chart.createOverlay({
      name: BACKTEST_MARKER_OVERLAY,
      groupId: BACKTEST_MARKER_GROUP,
      lock: true,
      points: [{ timestamp, value: price }],
      extendData: {
        label: signalLabel(signal),
        color: signalColor(signal),
        side: signalSide(signal),
        kind: 'signal',
        sourceIndex: signal.index ?? signals.indexOf(signal),
      } satisfies MarkerData,
      onClick: (event: OverlayEvent) => {
        onSelectMarker?.(recordValue(event.overlay.extendData) as MarkerData)
        return true
      },
    })
  })
  tradeMarkers.slice(-160).forEach(marker => {
    const rawTime = numberValue(marker.time)
    const price = numberValue(marker.price)
    if (!rawTime || price === undefined) return
    const timestamp = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime
    const kind = stringValue(marker.kind) ?? ''
    const isExit = kind === 'exit'
    chart.createOverlay({
      name: BACKTEST_MARKER_OVERLAY,
      groupId: BACKTEST_MARKER_GROUP,
      lock: true,
      points: [{ timestamp, value: price }],
      extendData: {
        label: isExit ? 'EXIT' : 'ENTRY',
        color: isExit ? tradingDeskTheme.market.down : tradingDeskTheme.market.up,
        side: isExit ? 'sell' : 'buy',
        kind: 'trade',
        tradeIndex: numberValue(marker.trade_index),
      } satisfies MarkerData,
      onClick: (event: OverlayEvent) => {
        onSelectMarker?.(recordValue(event.overlay.extendData) as MarkerData)
        return true
      },
    })
  })
}

function buildParams(
  code: string,
  freq: string,
  signalType: SignalType,
  simParams: Record<string, string>,
): URLSearchParams {
  const params = new URLSearchParams({ code, freq })
  if (signalType === 'all' || signalType === 'macd' || signalType === 'czsc') {
    params.set('signal_group', signalType)
  } else {
    params.set('signal_group', 'all')
    params.set('factor', signalType)
  }
  Object.entries(simParams).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value)
  })
  return params
}

export function BacktestWorkbench({
  locale,
  dashboard,
  signalsWebBaseUrl,
  onOpenRun,
  onOpenRecord,
}: BacktestWorkbenchProps) {
  const baseUrl = trimTrailingSlash(signalsWebBaseUrl) || urlFromBacktestDashboard(dashboard)
  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const [code, setCode] = useState(() => defaultCodeFromDashboard(dashboard))
  const [freq, setFreq] = useState('daily')
  const [signalType, setSignalType] = useState<SignalType>('all')
  const [tab, setTab] = useState<BacktestTab>('perf')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [batchResult, setBatchResult] = useState<BatchBacktestResult | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selectedSignalIndex, setSelectedSignalIndex] = useState<number | null>(null)
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null)
  const [selectedDatePresetKey, setSelectedDatePresetKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [symbolCatalog, setSymbolCatalog] = useState<SymbolOption[]>([])
  const [localHistory, setLocalHistory] = useState<BacktestHistoryEntry[]>(() => readBacktestHistoryEntries())
  const [simParams, setSimParams] = useState<Record<string, string>>({
    stop_loss: '5',
    trail_stop: '50',
    max_hold: '20',
    slippage: '0.1',
    take_profit: '0',
    ma_exit_period: '0',
    profit_drawdown: '0',
    atr_exit_period: '0',
    atr_exit_mult: '2.0',
  })
  const [scanParams, setScanParams] = useState<Record<string, string>>({
    scan_param: 'stop_loss_pct',
    scan_values: '3,5,7,10',
    scan_param2: '',
    scan_values2: '',
    scan_metric: 'sharpe',
  })

  const terminalPanelData = terminalPanels(result)
  const isMultiMode = batchResult?.terminal?.version === 'backtest-terminal.v1' && batchResult.terminal.mode === 'multi'
  const terminalChartData = terminalChart(result)
  const klineData = useMemo(() => toKLineData(terminalChartData?.ohlcv ?? result?.ohlcv), [result, terminalChartData])
  const signals = terminalPanelData?.signals?.rows ?? result?.signals ?? []
  const trades = terminalPanelData?.trades?.rows ?? result?.sim_trades ?? []
  const tradeMarkers = terminalChartData?.trade_markers ?? terminalChartData?.entry_exit_markers ?? []
  const datePresets = terminalChartData?.date_presets ?? result?.date_presets ?? []
  const datePresetWindows = useMemo(() => buildDatePresetWindows(datePresets, klineData), [datePresets, klineData])
  const activeDateWindow = useMemo(
    () => datePresetWindows.find(item => item.key === selectedDatePresetKey) ?? null,
    [datePresetWindows, selectedDatePresetKey],
  )
  const visibleKlineData = useMemo(() => filterKLineDataForDateWindow(klineData, activeDateWindow), [activeDateWindow, klineData])
  const visibleSignals = useMemo(() => filterSignalsForDateWindow(signals, activeDateWindow), [activeDateWindow, signals])
  const visibleTrades = useMemo(() => filterTradesForDateWindow(trades, activeDateWindow), [activeDateWindow, trades])
  const visibleTradeMarkers = useMemo(() => filterTradeMarkersForDateWindow(tradeMarkers, activeDateWindow), [activeDateWindow, tradeMarkers])
  const filledTrades = trades.filter(trade => trade.entry_price !== null && trade.entry_price !== undefined)
  const visibleFilledTrades = visibleTrades.filter(trade => trade.entry_price !== null && trade.entry_price !== undefined)
  const targetInfo = terminalTarget(result)
  const metrics = terminalMetrics(result)
  const displaySymbol = stringValue(targetInfo.symbol) ?? result?.symbol ?? result?.code ?? code
  const displayName = stringValue(targetInfo.name)
  const displayFreq = stringValue(targetInfo.freq) ?? result?.freq ?? freq
  const dataSourceLabel = backtestDataSourceLabel(result, locale)
  const dataHealthLabel = dataHealthText(result, locale)
  const selectedCodes = useMemo(() => parseCodeList(code), [code])
  const isBatchView = selectedCodes.length > 1 || isMultiMode
  const resultSymbolOptions = useMemo(() => symbolOptionsFromBacktestOutputs(result, batchResult), [batchResult, result])
  const dashboardHistory = useMemo(() => dashboardBacktestHistoryEntries(dashboard), [dashboard])
  const restorableHistory = useMemo(
    () => mergeBacktestHistoryEntries([...localHistory, ...dashboardHistory]),
    [dashboardHistory, localHistory],
  )
  const symbolOptions = useMemo(
    () => uniqueSymbolOptions([...symbolOptionsForPicker(dashboard), ...symbolCatalog, ...resultSymbolOptions]),
    [dashboard, resultSymbolOptions, symbolCatalog],
  )
  const selectedDisplay = useMemo(() => selectedSymbolDisplay(selectedCodes, symbolOptions, locale), [locale, selectedCodes, symbolOptions])
  const chartTitle = selectedDisplay.short || [displaySymbol, displayName].filter(Boolean).join(' · ')
  const chartTitleFull = selectedDisplay.full || chartTitle
  const researchSummary = useMemo(
    () => buildStrategyResearchSummary({
      result,
      batchResult,
      error,
      loading,
      selectedCodes,
      freq,
      locale,
    }),
    [batchResult, error, freq, loading, locale, result, selectedCodes],
  )
  const displayedSignalCount = activeDateWindow ? visibleSignals.length : (numberValue(metrics.signal_count) ?? signals.length)
  const displayedTradeCount = activeDateWindow ? visibleFilledTrades.length : (numberValue(metrics.filled_trades) ?? filledTrades.length)

  const rememberSymbolOptions = useCallback((nextOptions: SymbolOption[]) => {
    if (!nextOptions.length) return
    setSymbolCatalog(previous => {
      const merged = uniqueSymbolOptions([...previous, ...nextOptions])
      return symbolOptionsEqual(previous, merged) ? previous : merged
    })
  }, [])

  const rememberBacktestHistory = useCallback((entry: BacktestHistoryEntry | null) => {
    if (!entry) return
    setLocalHistory(previous => {
      const next = mergeBacktestHistoryEntries([entry, ...previous])
      writeBacktestHistoryEntries(next)
      return next
    })
  }, [])

  const setCodeList = useCallback((codes: string[]) => {
    setCode(selectedSymbolText(parseCodeList(codes.join(','))))
  }, [])

  const toggleSymbolCode = useCallback((nextCode: string) => {
    const normalized = normalizeSymbolCode(nextCode)
    if (!normalized) return
    const current = parseCodeList(code)
    const exists = current.some(item => item.toUpperCase() === normalized.toUpperCase())
    setCodeList(exists
      ? current.filter(item => item.toUpperCase() !== normalized.toUpperCase())
      : [...current, normalized])
  }, [code, setCodeList])

  const selectDatePreset = useCallback((key: string | null) => {
    setSelectedDatePresetKey(key)
    setSelectedSignalIndex(null)
    setSelectedTradeIndex(null)
    if (key && (tab === 'perf' || tab === 'scan' || tab === 'risk')) setTab('signals')
  }, [tab])

  const updateSimParam = useCallback((key: string, value: string) => {
    setSimParams(previous => ({ ...previous, [key]: value }))
  }, [])

  const updateScanParam = useCallback((key: string, value: string) => {
    setScanParams(previous => ({ ...previous, [key]: value }))
  }, [])

  const runAnalyze = useCallback(async () => {
    if (!baseUrl || !code.trim()) return
    const codeList = parseCodeList(code)
    if (codeList.length === 0) {
      setError(locale === 'zh-CN' ? '没有识别到有效代码。请输入 6 位代码，或从已选池勾选标的。' : 'No valid symbol code found. Type a code or pick symbols from the pool.')
      return
    }
    const normalizedCodeText = selectedSymbolText(codeList)
    if (normalizedCodeText !== code.trim()) setCode(normalizedCodeText)
    const multiMode = codeList.length > 1
    if (!multiMode && isBacktestUnsupportedBoardCode(codeList[0] ?? '')) {
      setError(locale === 'zh-CN'
        ? `当前回测暂不支持北交所/新三板标的：${codeList[0]}。请选择沪深或 HK 标的。`
        : `${codeList[0]} is not supported by the current backtest data path. Pick an SH/SZ or HK symbol.`)
      return
    }
    if (multiMode && codeList.length > MAX_BACKTEST_BATCH_CODES) {
      setError(locale === 'zh-CN'
        ? `批量回测最多支持 ${MAX_BACKTEST_BATCH_CODES} 只；请先缩小已选池。`
        : `Batch backtest supports up to ${MAX_BACKTEST_BATCH_CODES} symbols. Narrow the selected pool first.`)
      return
    }
    const hadResult = Boolean(result || batchResult)
    recordObservationEvent('backtest.analyze.submit', {
      code: code.trim(),
      codes: codeList,
      freq,
      signal_type: signalType,
      had_result: hadResult,
      mode: multiMode ? 'multi' : 'single',
    })
    setLoading(true)
    setError(null)
    try {
      if (multiMode) {
        const data = await fetchJson<BatchBacktestResult>(
          baseUrl,
          '/api/backtest/batch',
          300_000,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBatchBody(codeList, freq, signalType, simParams)),
          },
        )
        setBatchResult(data)
        setResult(null)
        setScan(null)
        setSelectedSignalIndex(null)
        setSelectedTradeIndex(null)
        setSelectedDatePresetKey(null)
        setTab('perf')
        rememberBacktestHistory(createBacktestHistoryEntry({
          batchResult: data,
          codes: codeList,
          freq,
          signalType,
        }))
        const summary = recordValue(data.summary)
        recordObservationEvent('backtest.batch.success', {
          code_count: codeList.length,
          total_stocks: summary.total_stocks,
          ok_stocks: summary.ok_stocks,
          total_signals: summary.total_signals,
          total_trades: summary.total_trades,
          terminal_version: data.terminal?.version,
          terminal_mode: data.terminal?.mode,
        })
        return
      }
      const params = buildParams(codeList[0] ?? code.trim(), freq, signalType, simParams)
      const data = await fetchJson<BacktestResult>(baseUrl, `/api/backtest/analyze?${params.toString()}`)
      setResult(data)
      setBatchResult(null)
      setScan(null)
      setSelectedSignalIndex(null)
      setSelectedTradeIndex(null)
      setSelectedDatePresetKey(null)
      if (!hadResult) setTab('perf')
      rememberBacktestHistory(createBacktestHistoryEntry({
        result: data,
        codes: codeList,
        freq,
        signalType,
      }))
      const metrics = recordValue(data.terminal?.metrics)
      recordObservationEvent('backtest.analyze.success', {
        code: data.code ?? code.trim(),
        symbol: data.symbol,
        freq: data.freq ?? freq,
        data_source: data.data_source,
        data_source_detail: data.data_source_detail,
        as_of: data.as_of,
        bar_count: data.bar_count,
        freshness: data.freshness,
        derived_from: data.derived_from,
        partial: data.partial,
        last_upstream_error: data.last_upstream_error,
        signals: numberValue(metrics.signal_count) ?? data.signals?.length ?? 0,
        trades: numberValue(metrics.filled_trades) ?? data.sim_trades?.length ?? 0,
        terminal_version: data.terminal?.version,
      })
    } catch (rawError) {
      const apiError = rawError as ApiError
      setError(compactApiError(apiError, locale, locale === 'zh-CN' ? '回测分析失败。' : 'Backtest analysis failed.'))
      recordObservationEvent('backtest.analyze.error', {
        code: code.trim(),
        freq,
        signal_type: signalType,
        status: apiError.status,
        error: apiError.message,
        upstream_error: apiError.payload?.last_upstream_error,
        payload_error: apiError.payload?.error,
        level: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [baseUrl, batchResult, code, freq, locale, rememberBacktestHistory, result, signalType, simParams])

  const runScan = useCallback(async () => {
    if (!baseUrl || !code.trim()) return
    const codeList = parseCodeList(code)
    if (codeList.length === 0) {
      setError(locale === 'zh-CN' ? '没有识别到有效代码。请输入 6 位代码，或从已选池勾选标的。' : 'No valid symbol code found. Type a code or pick a symbol from the pool.')
      return
    }
    recordObservationEvent('backtest.scan.submit', {
      code: codeList[0] ?? code.trim(),
      freq,
      signal_type: signalType,
      scan_params: scanParams,
    })
    setScanLoading(true)
    setError(null)
    try {
      const params = buildParams(codeList[0] ?? code.trim(), freq, signalType, simParams)
      Object.entries(scanParams).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value)
      })
      const data = await fetchJson<ScanResult>(baseUrl, `/api/backtest/scan?${params.toString()}`, 300_000)
      setScan(data)
      setTab('scan')
      if (data.error) setError(data.error)
      recordObservationEvent('backtest.scan.finish', {
        code: code.trim(),
        freq,
        result_count: data.scan_results?.length ?? 0,
        error: data.error,
        level: data.error ? 'error' : 'info',
      })
    } catch (rawError) {
      const apiError = rawError as ApiError
      setError(compactApiError(apiError, locale, locale === 'zh-CN' ? '参数扫描失败。' : 'Parameter scan failed.'))
      recordObservationEvent('backtest.scan.error', {
        code: code.trim(),
        freq,
        signal_type: signalType,
        status: apiError.status,
        error: apiError.message,
        level: 'error',
      })
    } finally {
      setScanLoading(false)
    }
  }, [baseUrl, code, freq, locale, scanParams, signalType, simParams])

  const exportCsv = useCallback(() => {
    if (!baseUrl || !code.trim()) return
    const codeList = parseCodeList(code)
    if (!codeList.length) return
    const params = buildParams(codeList[0] ?? code.trim(), freq, signalType, simParams)
    window.open(`${baseUrl}/api/backtest/export?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }, [baseUrl, code, freq, signalType, simParams])

  const handleMarkerSelect = useCallback((marker: MarkerData) => {
    if (marker.kind === 'signal' && marker.sourceIndex !== undefined) {
      setSelectedSignalIndex(marker.sourceIndex)
      setTab('signals')
      return
    }
    if (marker.kind === 'trade' && marker.tradeIndex !== undefined) {
      setSelectedTradeIndex(marker.tradeIndex)
      setTab('trades')
    }
  }, [])

  const drillIntoBatchSymbol = useCallback((nextCode: string) => {
    const normalized = normalizeSymbolCode(nextCode)
    if (!normalized) return
    setCode(normalized)
    setBatchResult(null)
    setResult(null)
    setScan(null)
    setSelectedSignalIndex(null)
    setSelectedTradeIndex(null)
    setSelectedDatePresetKey(null)
    setTab('perf')
  }, [])

  const restoreBacktestHistory = useCallback((entry: BacktestHistoryEntry) => {
    const codes = entry.codes.length ? entry.codes : parseCodeList(code)
    if (codes.length) setCode(selectedSymbolText(codes))
    setFreq(entry.freq || 'daily')
    if (entry.signalType && ['all', 'macd', 'czsc', 'gap', 'trend_breakout', 'vol_contraction', 'candle_run', 'candle_accel'].includes(entry.signalType)) {
      setSignalType(entry.signalType as SignalType)
    }
    if (entry.mode === 'multi' && entry.batchResult) {
      setBatchResult(entry.batchResult)
      setResult(null)
    } else if (entry.result) {
      setResult(entry.result)
      setBatchResult(null)
    }
    setScan(null)
    setError(null)
    setSelectedSignalIndex(null)
    setSelectedTradeIndex(null)
    setSelectedDatePresetKey(null)
    setTab('perf')
    recordObservationEvent('backtest.history.restore', {
      id: entry.id,
      mode: entry.mode,
      codes: entry.codes,
      freq: entry.freq,
    })
  }, [code])

  useEffect(() => {
    if (!selectedDatePresetKey) return
    if (datePresetWindows.some(item => item.key === selectedDatePresetKey)) return
    setSelectedDatePresetKey(null)
    setSelectedSignalIndex(null)
    setSelectedTradeIndex(null)
  }, [datePresetWindows, selectedDatePresetKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName.toLowerCase()
      const editing = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(target?.isContentEditable)
      const interactive = editing || tagName === 'button'

      if (event.key === '/' && !editing) {
        event.preventDefault()
        codeInputRef.current?.focus()
        codeInputRef.current?.select()
        return
      }
      if (event.key === 'Escape') {
        setSelectedSignalIndex(null)
        setSelectedTradeIndex(null)
        if (editing) target?.blur()
        return
      }
      if (interactive) return

      if (event.key === 'Enter') {
        event.preventDefault()
        void runAnalyze()
        return
      }
      const tabByKey: Record<string, BacktestTab> = {
        '1': 'perf',
        '2': 'trades',
        '3': 'signals',
        '4': 'scan',
        '5': 'risk',
      }
      const nextTab = tabByKey[event.key]
      if (nextTab) {
        event.preventDefault()
        setTab(nextTab)
        return
      }
      const freqByKey: Record<string, string> = { d: 'daily', w: 'weekly', m: 'monthly' }
      const nextFreq = freqByKey[event.key.toLowerCase()]
      if (nextFreq) {
        event.preventDefault()
        setFreq(nextFreq)
        recordObservationEvent('backtest.freq.hotkey', {
          previous: freq,
          next: nextFreq,
          code: code.trim(),
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [code, freq, runAnalyze])

  useEffect(() => {
    if (isBatchView) return
    if (!chartContainerRef.current) return
    ensureMarkerOverlay()
    const chart = init(chartContainerRef.current, {
      locale: locale === 'zh-CN' ? 'zh-CN' : 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      styles: chartStyles(),
    })
    if (!chart) return
    chartRef.current = chart
    chart.setBarSpace(7)
    chart.setOffsetRightDistance(34)
    chart.createIndicator('MA', true, { id: 'candle_pane' })
    chart.createIndicator('VOL')
    chart.createIndicator('MACD')
    resizeObserverRef.current = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null
        chart.resize()
      })
    })
    resizeObserverRef.current.observe(chartContainerRef.current)
    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      chartRef.current = null
      dispose(chart)
    }
  }, [isBatchView, locale])

  useEffect(() => {
    if (isBatchView) return
    const chart = chartRef.current
    if (!chart) return
    chart.removeOverlay({ groupId: BACKTEST_MARKER_GROUP })
    if (visibleKlineData.length === 0) {
      chart.clearData()
      return
    }
    chart.applyNewData(visibleKlineData)
    createSignalOverlays(chart, visibleKlineData, visibleSignals, visibleTradeMarkers, activeDateWindow, handleMarkerSelect)
    if (activeDateWindow) {
      chart.scrollToTimestamp(activeDateWindow.anchorTime, 300)
    } else {
      chart.scrollToRealTime()
    }
    chart.resize()
  }, [activeDateWindow, handleMarkerSelect, isBatchView, visibleKlineData, visibleSignals, visibleTradeMarkers])

  if (!baseUrl) {
    return (
      <div style={{ ...rootStyle, gridTemplateRows: 'auto minmax(0, 1fr)' }}>
        <div style={{ ...warningStyle, margin: 9 }}>
          {locale === 'zh-CN'
            ? 'Signals 服务未连接，先查看本地历史回测与待处理任务。'
            : 'Signals service is not connected. Showing local history and pending backtests.'}
        </div>
        <FallbackBacktest
          locale={locale}
          dashboard={dashboard}
          historyEntries={restorableHistory}
          onRestoreHistory={restoreBacktestHistory}
          onOpenRun={onOpenRun}
          onOpenRecord={onOpenRecord}
        />
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      <form
        style={toolbarStyle}
        onSubmit={event => {
          event.preventDefault()
          void runAnalyze()
        }}
      >
        <div style={labelStyle}>{locale === 'zh-CN' ? '标的篮子' : 'Symbol basket'}</div>
        <input
          ref={codeInputRef}
          aria-label={locale === 'zh-CN' ? '标的代码列表' : 'Symbol list'}
          name="backtest-symbols"
          autoComplete="off"
          spellCheck={false}
          style={inputStyle}
          value={code}
          placeholder={locale === 'zh-CN' ? '输入代码，逗号分隔…' : 'Type symbols, comma separated…'}
          onChange={event => setCode(event.target.value)}
        />
        <select
          style={selectStyle}
          value={freq}
          onChange={event => {
            const nextFreq = event.target.value
            recordObservationEvent('backtest.freq.change', {
              previous: freq,
              next: nextFreq,
              code: code.trim(),
            })
            setFreq(nextFreq)
          }}
        >
          <option value="daily">{locale === 'zh-CN' ? '日线' : 'Daily'}</option>
          <option value="weekly">{locale === 'zh-CN' ? '周线' : 'Weekly'}</option>
          <option value="monthly">{locale === 'zh-CN' ? '月线' : 'Monthly'}</option>
        </select>
        <select
          style={selectStyle}
          value={signalType}
          onChange={event => {
            const nextSignalType = event.target.value as SignalType
            recordObservationEvent('backtest.signal-type.change', {
              previous: signalType,
              next: nextSignalType,
              code: code.trim(),
              freq,
            })
            setSignalType(nextSignalType)
          }}
        >
          <option value="all">{locale === 'zh-CN' ? '全部信号' : 'All signals'}</option>
          <option value="macd">MACD</option>
          <option value="czsc">{locale === 'zh-CN' ? '缠论' : 'CZSC'}</option>
          <option value="gap">{locale === 'zh-CN' ? '跳空缺口' : 'Gap'}</option>
          <option value="trend_breakout">{locale === 'zh-CN' ? '趋势突破' : 'Breakout'}</option>
          <option value="vol_contraction">{locale === 'zh-CN' ? '波动收缩' : 'Vol squeeze'}</option>
          <option value="candle_run">{locale === 'zh-CN' ? '连续K线' : 'Candle run'}</option>
          <option value="candle_accel">{locale === 'zh-CN' ? '加速K线' : 'Acceleration'}</option>
        </select>
        <button type="submit" style={buttonStyle(true, loading)} disabled={loading}>
          {loading ? (locale === 'zh-CN' ? '分析中' : 'Running') : (locale === 'zh-CN' ? '运行回测' : 'Run')}
        </button>
        <div style={{ ...mutedStyle, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error ?? undefined}>
          {error ??
            (batchResult
              ? locale === 'zh-CN'
                ? `${numberValue(batchResult.summary?.total_stocks) ?? batchResult.stocks?.length ?? 0}标的 · ${numberValue(batchResult.summary?.total_signals) ?? 0}信号 · ${numberValue(batchResult.summary?.total_trades) ?? 0}笔交易`
                : `${numberValue(batchResult.summary?.total_stocks) ?? batchResult.stocks?.length ?? 0} symbols · ${numberValue(batchResult.summary?.total_signals) ?? 0} signals · ${numberValue(batchResult.summary?.total_trades) ?? 0} trades`
              : result
              ? `${locale === 'zh-CN'
                ? `${displaySymbol} · ${displayedSignalCount}信号 · ${displayedTradeCount}笔交易`
                : `${displaySymbol} · ${displayedSignalCount} signals · ${displayedTradeCount} trades`
              }${dataSourceLabel ? ` · ${dataSourceLabel}` : ''}`
              : locale === 'zh-CN'
                ? '从下方选择动态产业链组合或勾选多只标的'
                : 'Enter one symbol for single backtest, multiple symbols for portfolio review')}
        </div>
        <button type="button" style={buttonStyle(false, !result || Boolean(batchResult))} disabled={!result || Boolean(batchResult)} onClick={exportCsv}>
          {locale === 'zh-CN' ? '导出' : 'CSV'}
        </button>
      </form>

      <SymbolBasketBar
        locale={locale}
        baseUrl={baseUrl}
        selectedCodes={selectedCodes}
        options={symbolOptions}
        onApplyBasket={codes => setCodeList(codes)}
        onToggleCode={toggleSymbolCode}
        onSymbolOptionsSeen={rememberSymbolOptions}
        onClearCodes={() => {
          setCodeList([])
          setBatchResult(null)
          setResult(null)
          setSelectedDatePresetKey(null)
        }}
        onRemoveCode={codeToRemove => {
          setCodeList(selectedCodes.filter(item => item.toUpperCase() !== codeToRemove.toUpperCase()))
        }}
      />

      <div style={mainGridStyle}>
        <div style={sideStyle}>
          <Panel title={isBatchView
            ? (locale === 'zh-CN' ? '样本与参数' : 'Sample and params')
            : (locale === 'zh-CN' ? '模拟参数' : 'Simulation')}
          >
            {isBatchView ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={metricCardStyle}>
                  <div style={labelStyle}>{locale === 'zh-CN' ? '当前样本' : 'Current sample'}</div>
                  <div style={{ color: terminalTheme.textStrong, fontWeight: 800, lineHeight: 1.35 }}>
                    {selectedDisplay.full || emptyDisplay}
                  </div>
                </div>
              </div>
            ) : null}
            <ParamGrid params={simParams} onChange={updateSimParam} />
          </Panel>
          {isBatchView ? (
            <BatchSamplePanel
              locale={locale}
              batchResult={batchResult}
              selectedCodes={selectedCodes}
            />
          ) : (
          <Panel title={locale === 'zh-CN' ? '日期标签' : 'Date presets'}>
            {datePresetWindows.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  style={buttonStyle(!activeDateWindow)}
                  onClick={() => selectDatePreset(null)}
                  title={locale === 'zh-CN' ? '显示完整回测区间' : 'Show full backtest range'}
                >
                  {locale === 'zh-CN' ? '全部' : 'All'}
                </button>
                {datePresetWindows.slice(0, 12).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    style={buttonStyle(activeDateWindow?.key === item.key)}
                    title={`${item.displayRange} · ${item.label}`}
                    onClick={() => {
                      recordObservationEvent('backtest.date-preset.select', {
                        key: item.key,
                        label: item.shortLabel,
                        from: dateKey(item.from),
                        to: dateKey(item.to),
                        code: code.trim(),
                        freq,
                      })
                      selectDatePreset(item.key)
                    }}
                  >
                    {item.shortLabel}
                  </button>
                ))}
              </div>
            ) : result && datePresets.length ? (
              <div style={emptyStyle}>{locale === 'zh-CN' ? '当前策略区间没有匹配的事件标签。' : 'No event presets match this backtest range.'}</div>
            ) : (
              <div style={emptyStyle}>{locale === 'zh-CN' ? '运行后显示事件标签。' : 'Run to show event presets.'}</div>
            )}
            {activeDateWindow ? (
              <div style={mutedStyle}>
                {activeDateWindow.displayRange} · {activeDateWindow.barCount}{locale === 'zh-CN' ? '根K线' : ' bars'}
              </div>
            ) : null}
          </Panel>
          )}
          <Panel title={locale === 'zh-CN' ? '回测记录' : 'Backtest records'}>
            <BacktestHistoryRows
              locale={locale}
              entries={restorableHistory}
              onRestore={restoreBacktestHistory}
            />
          </Panel>
          {!isBatchView && !result ? (
            <Panel title={locale === 'zh-CN' ? '待处理线索' : 'Pending signals'}>
              <FallbackRows dashboard={dashboard} onOpenRun={onOpenRun} onOpenRecord={onOpenRecord} />
            </Panel>
          ) : null}
        </div>

        <div style={isBatchView ? { ...chartPanelStyle, padding: 0, gap: 0, overflow: 'hidden' } : chartPanelStyle}>
          {isBatchView ? (
            <MultiBacktestReport
              locale={locale}
              terminal={batchResult?.terminal}
              onSelectCode={drillIntoBatchSymbol}
            />
          ) : (
          <>
          <div style={chartHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>{[freqLabel(displayFreq, locale), dataSourceLabel].filter(Boolean).join(' · ')}</div>
              <div style={chartTitleStyle} title={chartTitleFull}>{chartTitle}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {dataSourceLabel ? (
                <span style={statusBadgeStyle(isFallbackDataSource(result) ? 'warning' : 'success')}>
                  {dataSourceLabel}
                </span>
              ) : null}
              {(stringValue(targetInfo.freshness) ?? result?.freshness) ? (
                <span style={statusBadgeStyle((stringValue(targetInfo.freshness) ?? result?.freshness) === 'fresh' ? 'success' : 'warning')}>
                  {freshnessLabel(stringValue(targetInfo.freshness) ?? result?.freshness, locale)}
                </span>
              ) : null}
              {(result?.warnings ?? []).slice(0, 2).map(item => (
                <span key={item} style={statusBadgeStyle('warning')}>{item}</span>
              ))}
              <span style={statusBadgeStyle(error ? 'failed' : loading ? 'running' : result ? 'success' : 'open')}>
                {runStatusLabel(error, loading, Boolean(result), locale)}
              </span>
            </div>
          </div>
          {dataHealthLabel ? (
            <div style={{ ...mutedStyle, padding: '0 2px', minHeight: 16 }}>
              {dataHealthLabel}
            </div>
          ) : null}
          <MetricStrip result={result} locale={locale} />
          {activeDateWindow ? (
            <div style={datePresetFocusStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={labelStyle}>{locale === 'zh-CN' ? '事件区间详情' : 'Event detail range'}</div>
                <div style={{ color: terminalTheme.textStrong, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeDateWindow.shortLabel} · {activeDateWindow.displayRange}
                </div>
                <div style={mutedStyle}>
                  {activeDateWindow.barCount}{locale === 'zh-CN' ? '根K线' : ' bars'} · {visibleSignals.length}{locale === 'zh-CN' ? '个信号' : ' signals'} · {visibleFilledTrades.length}{locale === 'zh-CN' ? '笔交易' : ' trades'}
                </div>
              </div>
              <button
                type="button"
                style={buttonStyle(false)}
                onClick={() => selectDatePreset(null)}
              >
                {locale === 'zh-CN' ? '回到全部' : 'All'}
              </button>
            </div>
          ) : null}
          <div style={chartShellStyle}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            {!result || visibleKlineData.length === 0 ? (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: terminalTheme.mutedStrong,
                background: result ? tradingDeskTheme.alpha.overlay : 'transparent',
              }}>
                {loading
                  ? (locale === 'zh-CN' ? '正在拉取 Signals 回测数据。' : 'Loading Signals backtest data.')
                  : (locale === 'zh-CN' ? '运行分析后显示 K线、信号、MACD 与成交。' : 'Run analysis to show candles, signals, MACD, and trades.')}
              </div>
            ) : null}
          </div>
          </>
          )}
        </div>

        <div style={sideStyle}>
          <StrategyResearchPanel summary={researchSummary} locale={locale} />
          {isBatchView ? (
            <BatchResearchDrilldownPanel
              locale={locale}
              batchResult={batchResult}
              onSelectCode={drillIntoBatchSymbol}
            />
          ) : (
          <>
          <div style={{ ...panelStyle, gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
              {(['perf', 'trades', 'signals', 'scan', 'risk'] as BacktestTab[]).map(item => (
                <button
                  key={item}
                  type="button"
                  style={buttonStyle(tab === item)}
                  onClick={() => {
                    recordObservationEvent('backtest.tab.click', {
                      previous: tab,
                      next: item,
                      code: code.trim(),
                      freq,
                    })
                    setTab(item)
                  }}
                >
                  {backtestTabLabel(item, locale)}
                </button>
              ))}
            </div>
          </div>
          {tab === 'perf' ? (
            <Panel title={locale === 'zh-CN' ? '绩效总览' : 'Performance'}>
              <KpiPanel result={result} />
            </Panel>
          ) : tab === 'trades' ? (
            <Panel title={locale === 'zh-CN' ? '交易明细' : 'Trades'} meta={String(visibleFilledTrades.length)}>
              <TradeTable
                trades={visibleTrades}
                selectedIndex={selectedTradeIndex}
                onSelect={(index, rawTime) => {
                  setSelectedTradeIndex(index)
                  setTab('trades')
                  const chart = chartRef.current
                  const time = normalizeTimestampMs(rawTime)
                  if (chart && time) chart.scrollToTimestamp(time, 300)
                }}
              />
            </Panel>
          ) : tab === 'signals' ? (
            <Panel title={locale === 'zh-CN' ? '信号详情' : 'Signals'} meta={String(visibleSignals.length)}>
              <SignalTable
                signals={visibleSignals}
                selectedIndex={selectedSignalIndex}
                onSelect={(index, rawTime) => {
                  setSelectedSignalIndex(index)
                  setTab('signals')
                  const chart = chartRef.current
                  const time = numberValue(rawTime)
                  if (chart && time) chart.scrollToTimestamp((time < 10_000_000_000 ? time * 1000 : time), 300)
                }}
              />
            </Panel>
          ) : tab === 'scan' ? (
            <Panel title={locale === 'zh-CN' ? '参数扫描' : 'Parameter scan'}>
              <ScanControls
                params={scanParams}
                loading={scanLoading}
                scan={scan}
                onChange={updateScanParam}
                onRun={() => {
                  void runScan()
                }}
              />
            </Panel>
          ) : (
            <Panel title={locale === 'zh-CN' ? '风控摘要' : 'Risk'}>
              <RiskPanel result={result} />
            </Panel>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  )
}

function StrategyResearchPanel({
  summary,
  locale,
  compact = false,
}: {
  summary: StrategyResearchSummary
  locale: LongclawLocale
  compact?: boolean
}) {
  const issueLimit = compact ? 3 : 4
  const actionLimit = compact ? 2 : 3
  return (
    <div style={{ ...researchPanelStyle, padding: compact ? '8px 10px' : researchPanelStyle.padding }}>
      <div style={researchHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>{locale === 'zh-CN' ? '策略研发判定' : 'Strategy research'}</div>
          <div style={{ color: terminalTheme.textStrong, fontSize: compact ? 14 : 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary.headline}
          </div>
        </div>
        <span style={statusBadgeStyle(summary.tone)}>{summary.statusLabel}</span>
      </div>
      <div style={mutedStyle}>{summary.detail}</div>
      <div style={researchFlowStyle}>
        {summary.flow.map(item => (
          <div key={item.label} style={researchPillStyle}>
            <div style={labelStyle}>{item.label}</div>
            <div style={{ color: statusBadgeStyle(item.tone).color, fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      {compact ? null : (
        <div style={{ ...metricGridStyle, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {summary.cards.slice(0, 6).map(card => (
            <div key={card.label} style={metricCardStyle}>
              <div style={mutedStyle}>{card.label}</div>
              <div style={{ color: toneColor(card.tone), fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}
      {summary.issues.length ? (
        <div style={researchIssueRowStyle}>
          {summary.issues.slice(0, issueLimit).map(issue => (
            <span key={issue} style={statusBadgeStyle(summary.tone === 'failed' ? 'failed' : 'warning')}>{issue}</span>
          ))}
        </div>
      ) : null}
      <ul style={researchActionStyle}>
        {summary.actions.slice(0, actionLimit).map(action => (
          <li key={action} style={{ ...mutedStyle, color: terminalTheme.text, lineHeight: 1.35 }}>
            {action}
          </li>
        ))}
      </ul>
    </div>
  )
}

function batchRankingRows(batchResult: BatchBacktestResult | null | undefined): Array<Record<string, unknown>> {
  const rows = batchResult?.terminal?.panels?.ranking?.rows
  return Array.isArray(rows) ? rows.map(recordValue) : []
}

function batchSignalRows(batchResult: BatchBacktestResult | null | undefined): Array<Record<string, unknown>> {
  const rows = batchResult?.terminal?.panels?.signals?.rows
  return Array.isArray(rows) ? rows.map(recordValue) : []
}

function recordSymbolLabel(row: Record<string, unknown>): string {
  const code = normalizeSymbolCode(stringValue(row.code) ?? stringValue(row.symbol) ?? '')
  const name = stringValue(row.name) ?? stringValue(row.stock_name)
  if (!code) return name ?? emptyDisplay
  return name && name.toUpperCase() !== code.toUpperCase() ? `${code} ${name}` : code
}

function BatchSamplePanel({
  locale,
  batchResult,
  selectedCodes,
}: {
  locale: LongclawLocale
  batchResult: BatchBacktestResult | null
  selectedCodes: string[]
}) {
  const zh = locale === 'zh-CN'
  const summary = recordValue(batchResult?.summary)
  const metrics = recordValue(batchResult?.terminal?.metrics)
  const target = recordValue(batchResult?.terminal?.target)
  const totalStocks = numberValue(summary.total_stocks) ?? selectedCodes.length
  const okStocks = numberValue(summary.ok_stocks)
  const failedStocks = okStocks === undefined ? undefined : Math.max(0, totalStocks - okStocks)
  const cards = [
    { label: zh ? '周期' : 'Freq', value: freqLabel(target.freq, locale) || emptyDisplay },
    { label: zh ? '截至' : 'As of', value: stringValue(target.as_of) ?? emptyDisplay },
    { label: zh ? '新鲜度' : 'Freshness', value: freshnessLabel(target.freshness, locale) || emptyDisplay },
    { label: zh ? '成功/失败' : 'OK/failed', value: failedStocks === undefined ? `${formatNumber(totalStocks, 0)} / --` : `${formatNumber(okStocks, 0)} / ${formatNumber(failedStocks, 0)}` },
    { label: zh ? '成交/标的' : 'Trades/symbol', value: totalStocks ? formatNumber((numberValue(metrics.filled_trades) ?? 0) / totalStocks, 1) : emptyDisplay },
    { label: zh ? '均回撤' : 'Avg DD', value: formatDrawdown(metrics.max_drawdown_pct) },
  ]
  return (
    <Panel title={zh ? '样本证据' : 'Sample evidence'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {cards.map(item => (
          <div key={item.label} style={metricCardStyle}>
            <div style={labelStyle}>{item.label}</div>
            <div style={{ color: terminalTheme.textStrong, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      {batchResult?.warnings?.length ? (
        <div style={researchIssueRowStyle}>
          {batchResult.warnings.slice(0, 3).map(item => (
            <span key={item} style={statusBadgeStyle('warning')}>{item}</span>
          ))}
        </div>
      ) : null}
    </Panel>
  )
}

function BatchResearchDrilldownPanel({
  locale,
  batchResult,
  onSelectCode,
}: {
  locale: LongclawLocale
  batchResult: BatchBacktestResult | null
  onSelectCode: (code: string) => void
}) {
  const zh = locale === 'zh-CN'
  const rankingRows = batchRankingRows(batchResult)
  const signalRows = batchSignalRows(batchResult)
  const topRow = rankingRows[0]
  const worstDrawdownRow = rankingRows.reduce<Record<string, unknown> | null>((worst, row) => {
    const value = Math.abs(numberValue(row.max_drawdown_pct) ?? 0)
    const worstValue = Math.abs(numberValue(worst?.max_drawdown_pct) ?? 0)
    return !worst || value > worstValue ? row : worst
  }, null)
  const bestSignal = signalRows.reduce<Record<string, unknown> | null>((best, row) => {
    const value = numberValue(row.avg_trade_return_pct ?? row.avg_t10_pct)
    if (value === undefined) return best
    const bestValue = numberValue(best?.avg_trade_return_pct ?? best?.avg_t10_pct)
    return !best || bestValue === undefined || value > bestValue ? row : best
  }, null)
  const drillButtons = [
    topRow ? { label: zh ? '下钻第一名' : 'Open top', row: topRow, meta: formatPercent(topRow.range_return_pct) } : null,
    worstDrawdownRow ? { label: zh ? '下钻最大回撤' : 'Open worst DD', row: worstDrawdownRow, meta: formatDrawdown(worstDrawdownRow.max_drawdown_pct) } : null,
  ].filter((item): item is { label: string; row: Record<string, unknown>; meta: string } => Boolean(item))
  return (
    <Panel title={zh ? '批量研发动作' : 'Batch research actions'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {drillButtons.map(item => {
          const code = normalizeSymbolCode(stringValue(item.row.code) ?? '')
          return (
            <button
              key={`${item.label}-${code}`}
              type="button"
              style={{ ...rowStyle, width: '100%', cursor: code ? 'pointer' : 'default', textAlign: 'left' }}
              disabled={!code}
              onClick={() => onSelectCode(code)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: terminalTheme.textStrong, fontWeight: 800 }}>{item.label}</div>
                <div style={mutedStyle}>{recordSymbolLabel(item.row)}</div>
              </div>
              <div style={{ color: cellToneColor('return_pct', item.meta), fontWeight: 800 }}>{item.meta}</div>
            </button>
          )
        })}
        {bestSignal ? (
          <div style={metricCardStyle}>
            <div style={labelStyle}>{zh ? '优先验证信号族' : 'Signal family to verify'}</div>
            <div style={{ color: terminalTheme.textStrong, fontWeight: 800 }}>
              {String(bestSignal.signal_type ?? emptyDisplay)}
            </div>
            <div style={mutedStyle}>
              {zh ? '成交均利' : 'Avg trade'} {formatPercent(bestSignal.avg_trade_return_pct)} · T+10 {formatPercent(bestSignal.avg_t10_pct)}
            </div>
          </div>
        ) : null}
        <div style={emptyStyle}>
          {zh
            ? '批量先找共性和失败样本，再选代表单票做交易明细与参数扫描。'
            : 'Use batch for repeatability and failure samples, then scan representative single symbols.'}
        </div>
      </div>
    </Panel>
  )
}

function SymbolBasketBar({
  locale,
  baseUrl,
  selectedCodes,
  options,
  onApplyBasket,
  onToggleCode,
  onSymbolOptionsSeen,
  onClearCodes,
  onRemoveCode,
}: {
  locale: LongclawLocale
  baseUrl: string
  selectedCodes: string[]
  options: SymbolOption[]
  onApplyBasket: (codes: string[]) => void
  onToggleCode: (code: string) => void
  onSymbolOptionsSeen: (options: SymbolOption[]) => void
  onClearCodes: () => void
  onRemoveCode: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const [boardOptions, setBoardOptions] = useState<SymbolOption[]>([])
  const [boardLabel, setBoardLabel] = useState('')
  const [boardMatches, setBoardMatches] = useState<BoardMatch[]>([])
  const [selectedBoardName, setSelectedBoardName] = useState('')
  const [selectedCandidateCode, setSelectedCandidateCode] = useState('')
  const [dynamicBaskets, setDynamicBaskets] = useState<SymbolBasket[]>([])
  const [basketLoading, setBasketLoading] = useState(false)
  const [basketMessage, setBasketMessage] = useState('')
  const [candidateExpanded, setCandidateExpanded] = useState(false)
  const [selectedExpanded, setSelectedExpanded] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupMessage, setLookupMessage] = useState('')
  const selectedSet = new Set(selectedCodes.map(item => item.toUpperCase()))
  const dynamicOptions = useMemo(() => uniqueSymbolOptions(dynamicBaskets.flatMap(basket => basket.codes)), [dynamicBaskets])
  const baseOptions = useMemo(
    () => uniqueSymbolOptions([...directSymbolOptionsFromQuery(query), ...dynamicOptions, ...options]),
    [dynamicOptions, options, query],
  )
  const mergedOptions = uniqueSymbolOptions([...boardOptions, ...baseOptions])
  const optionByCode = new Map(mergedOptions.map(option => [symbolOptionKey(option), option]))
  const selectedNameLookupKey = selectedCodes
    .map(code => {
      const normalized = normalizeSymbolCode(code)
      const option = optionByCode.get(normalized.toUpperCase())
      return `${normalized}:${option && hasReadableSymbolName(option) ? option.name : ''}`
    })
    .join('|')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredBaskets = dynamicBaskets.filter(basket => basketMatches(basket, normalizedQuery))
  const orderedBoardOptions = useMemo(() => orderBacktestCandidateOptions(boardOptions), [boardOptions])
  const boardBacktestReadyCodes = orderedBoardOptions
    .filter(option => !isBacktestUnsupportedBoardCode(option.code))
    .map(option => option.code)
  const candidateCodes = boardBacktestReadyCodes.slice(0, MAX_BACKTEST_BATCH_CODES)
  const unsupportedCandidateCount = orderedBoardOptions.length - boardBacktestReadyCodes.length
  const batchLimitHiddenCount = Math.max(0, boardBacktestReadyCodes.length - candidateCodes.length)
  const localCandidateOptions = (normalizedQuery
    ? symbolOptionsMatchingQuery(query, mergedOptions)
    : mergedOptions).slice(0, 28)
  const candidateOptions = boardOptions.length ? orderedBoardOptions : localCandidateOptions
  const displayBoardMatches = boardMatches.length
    ? boardMatches
    : boardLabel
      ? [{ name: boardLabel, kind: 'board', total: boardOptions.length }]
      : []
  const candidateLabel = boardOptions.length
    ? (locale === 'zh-CN' ? '成分股' : 'Constituents')
    : normalizedQuery
      ? (locale === 'zh-CN' ? '匹配标的' : 'Matched symbols')
      : (locale === 'zh-CN' ? '候选标的' : 'Symbols')
  const visibleSelectedCodes = selectedExpanded ? selectedCodes : selectedCodes.slice(0, 6)
  const hiddenSelectedCount = Math.max(0, selectedCodes.length - visibleSelectedCodes.length)
  const showCandidateChips = Boolean(boardOptions.length || normalizedQuery)
  const candidatePreviewLimit = showCandidateChips
    ? (boardOptions.length ? (candidateExpanded ? 18 : 6) : (candidateExpanded ? 18 : 5))
    : 0
  const visibleCandidateOptions = candidateOptions.slice(0, candidatePreviewLimit)
  const hiddenCandidateCount = Math.max(0, candidateOptions.length - visibleCandidateOptions.length)
  const loadDynamicBaskets = useCallback(async (search = ''): Promise<SymbolBasket[]> => {
    if (!baseUrl) return []
    setBasketLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '8')
      if (search.trim()) params.set('query', search.trim())
      const data = await fetchJson<DynamicBasketsResponse>(baseUrl, `/api/cluster/baskets?${params.toString()}`, 120_000)
      const baskets = normalizeDynamicBaskets(data.baskets)
      setDynamicBaskets(baskets)
      onSymbolOptionsSeen(baskets.flatMap(basket => basket.codes))
      setBasketMessage(baskets.length
        ? (locale === 'zh-CN'
          ? `动态组合 ${baskets.length} 个 · ${baskets[0]?.source ?? 'Signals'}`
          : `${baskets.length} dynamic baskets · ${baskets[0]?.source ?? 'Signals'}`)
        : (locale === 'zh-CN' ? '没有动态产业链组合。' : 'No dynamic chain baskets.'))
      return baskets
    } catch (rawError) {
      const apiError = rawError as ApiError
      setBasketMessage(compactApiError(apiError, locale, locale === 'zh-CN' ? '动态组合加载失败。' : 'Dynamic baskets failed to load.'))
      return []
    } finally {
      setBasketLoading(false)
    }
  }, [baseUrl, locale, onSymbolOptionsSeen])
  useEffect(() => {
    void loadDynamicBaskets()
  }, [loadDynamicBaskets])
  useEffect(() => {
    if (!baseUrl || !selectedCodes.length) return
    const missingCodes = selectedCodes
      .map(normalizeSymbolCode)
      .filter(Boolean)
      .filter(code => {
        const option = optionByCode.get(code.toUpperCase())
        return !option || !hasReadableSymbolName(option)
      })
      .slice(0, 6)
    if (!missingCodes.length) return
    let cancelled = false
    void Promise.allSettled(missingCodes.map(async code => {
      const data = await fetchJson<SymbolLookupResponse>(
        baseUrl,
        `/api/stock/resolve/${encodeURIComponent(code)}`,
        SYMBOL_NAME_LOOKUP_TIMEOUT_MS,
      )
      return symbolOptionFromLookupPayload(data, code)
    })).then(results => {
      if (cancelled) return
      const resolved = results
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter((option): option is SymbolOption => Boolean(option && hasReadableSymbolName(option)))
      if (resolved.length) onSymbolOptionsSeen(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [baseUrl, onSymbolOptionsSeen, selectedCodes, selectedNameLookupKey])
  useEffect(() => {
    if (candidateOptions.some(option => option.code === selectedCandidateCode)) return
    setSelectedCandidateCode(candidateOptions[0]?.code ?? '')
  }, [candidateOptions, selectedCandidateCode])
  const loadBoard = useCallback(async (name?: string) => {
    const board = (name ?? query).trim()
    if (!board) return
    const localMatches = symbolOptionsMatchingQuery(board, baseOptions).slice(0, 28)
    setLookupLoading(true)
    setLookupMessage('')
    try {
      const data = await fetchJson<BoardStocksResponse>(
        baseUrl,
        `/api/cluster/stocks?board=${encodeURIComponent(board)}`,
        120_000,
      )
      const rows = Array.isArray(data.stocks) ? data.stocks : []
      const matches = Array.isArray(data.matches) ? data.matches.filter(match => stringValue(match.name)) : []
      const resolvedBoard = stringValue(data.resolved_board) ?? stringValue(data.board) ?? board
      const nextSelectedBoard = matches.some(match => stringValue(match.name) === resolvedBoard)
        ? resolvedBoard
        : stringValue(matches[0]?.name) ?? resolvedBoard
      const nextOptions = uniqueSymbolOptions(rows.map(row => {
        const code = normalizeSymbolCode(row.code ?? row.symbol ?? '')
        const knownOption = baseOptions.find(option => option.code.toUpperCase() === code.toUpperCase())
        const rawName = stringValue(row.name)
        return {
          code,
          name: rawName && rawName !== code ? rawName : knownOption?.name ?? code,
          group: resolvedBoard,
        }
      }).filter(option => option.code))
      if (nextOptions.length === 0) {
        setBoardLabel('')
        setBoardMatches(matches)
        setSelectedBoardName(stringValue(matches[0]?.name) ?? '')
        setBoardOptions([])
        setSelectedCandidateCode('')
        setCandidateExpanded(false)
        if (localMatches.length) {
          setLookupMessage(locale === 'zh-CN'
            ? `找到${localMatches.length}个匹配标的，可在下方直接勾选。`
            : `${localMatches.length} matching symbols. Toggle them below.`)
        } else {
          setLookupMessage(data.error || (matches.length
            ? (locale === 'zh-CN' ? `找到${matches.length}个匹配来源，选择后点“载入成分股”。` : `${matches.length} matching sources. Pick one and load.`)
            : (locale === 'zh-CN' ? '没有找到成分股，换一个产业链、板块名或股票代码试试。' : 'No constituents found. Try another chain, board name, or symbol code.')))
        }
        return
      }
      setBoardLabel(resolvedBoard)
      setBoardMatches(matches)
      setSelectedBoardName(nextSelectedBoard)
      const orderedOptions = orderBacktestCandidateOptions(nextOptions).slice(0, 60)
      const readyCount = orderedOptions.filter(option => !isBacktestUnsupportedBoardCode(option.code)).length
      const unsupportedCount = orderedOptions.length - readyCount
      const batchCount = Math.min(readyCount, MAX_BACKTEST_BATCH_CODES)
      const limitedCount = Math.max(0, readyCount - MAX_BACKTEST_BATCH_CODES)
      setBoardOptions(orderedOptions)
      onSymbolOptionsSeen(nextOptions)
      setSelectedCandidateCode(orderedOptions.find(option => !isBacktestUnsupportedBoardCode(option.code))?.code ?? orderedOptions[0]?.code ?? '')
      setCandidateExpanded(false)
      setLookupMessage(locale === 'zh-CN'
        ? [
          `${resolvedBoard} · ${numberValue(data.total) ?? nextOptions.length}只成分股`,
          batchCount ? `批量默认取前${batchCount}只可回测标的` : '当前没有可批量回测标的',
          unsupportedCount ? `跳过${unsupportedCount}只暂不支持标的` : '',
          limitedCount ? `另有${limitedCount}只可手动勾选` : '',
        ].filter(Boolean).join('，') + '。'
        : [
          `${resolvedBoard} · ${numberValue(data.total) ?? nextOptions.length} constituents`,
          batchCount ? `batch uses the first ${batchCount} supported symbols` : 'no batch-ready symbols',
          unsupportedCount ? `${unsupportedCount} unsupported symbols skipped` : '',
          limitedCount ? `${limitedCount} more can be toggled manually` : '',
        ].filter(Boolean).join(', ') + '.')
    } catch (rawError) {
      const apiError = rawError as ApiError
      setBoardOptions([])
      setBoardLabel('')
      setBoardMatches([])
      setSelectedBoardName('')
      setSelectedCandidateCode('')
      setCandidateExpanded(false)
      setLookupMessage(localMatches.length
        ? (locale === 'zh-CN'
          ? `成分股接口暂不可用；已找到${localMatches.length}个本地匹配标的，可直接勾选。`
          : `Board lookup is unavailable. ${localMatches.length} local symbols are available below.`)
        : compactApiError(apiError, locale, locale === 'zh-CN' ? '板块搜索失败。' : 'Board lookup failed.'))
    } finally {
      setLookupLoading(false)
    }
  }, [baseOptions, baseUrl, locale, onSymbolOptionsSeen, query])
  const lookupBoard = useCallback(async () => {
    const search = query.trim()
    if (!search) return
    const [baskets] = await Promise.all([
      loadDynamicBaskets(search),
      loadBoard(search),
    ])
    if (baskets.length === 1) {
      const codes = baskets[0]?.codes.map(item => item.code) ?? []
      if (codes.length) {
        onApplyBasket(codes)
        setSelectedExpanded(false)
        setLookupMessage(locale === 'zh-CN'
          ? `已载入「${baskets[0]?.label}」首选组合，可直接运行回测。`
          : `Loaded ${baskets[0]?.label}. Ready to run.`)
      }
    }
  }, [loadBoard, loadDynamicBaskets, locale, onApplyBasket, query])
  return (
    <div style={basketBarStyle}>
      <div style={labelStyle}>{locale === 'zh-CN' ? '搜索' : 'Search'}</div>
      <div style={basketSearchStyle}>
        <input
          aria-label={locale === 'zh-CN' ? '搜索产业链、板块或标的' : 'Search chain, board, or symbol'}
          name="backtest-board-search"
          autoComplete="off"
          spellCheck={false}
          style={{ ...inputStyle, height: 28, fontFamily: fontStacks.ui, flex: '1 1 230px' }}
          value={query}
          placeholder={locale === 'zh-CN' ? '电解液 / 半导体设备 / 光模块 / 代码 / 名称…' : 'Chain, board, concept, code, or name…'}
          onChange={event => {
            setQuery(event.target.value)
            setBoardOptions([])
            setBoardLabel('')
            setBoardMatches([])
            setSelectedBoardName('')
            setSelectedCandidateCode('')
            setLookupMessage('')
            setCandidateExpanded(false)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void lookupBoard()
            }
          }}
        />
        <button
          type="button"
          style={buttonStyle(false, lookupLoading || basketLoading || !query.trim())}
          disabled={lookupLoading || basketLoading || !query.trim()}
          onClick={() => void lookupBoard()}
        >
          {lookupLoading || basketLoading ? (locale === 'zh-CN' ? '搜索中' : 'Loading') : (locale === 'zh-CN' ? '搜索/载入' : 'Search')}
        </button>
        <select
          aria-label={locale === 'zh-CN' ? '匹配来源' : 'Matched source'}
          style={{ ...selectStyle, height: 28, flex: '1 1 210px' }}
          disabled={displayBoardMatches.length === 0}
          value={selectedBoardName}
          onChange={event => {
            const nextBoard = event.target.value
            setSelectedBoardName(nextBoard)
            if (nextBoard) void loadBoard(nextBoard)
          }}
        >
          {displayBoardMatches.length === 0 ? (
            <option value="">{locale === 'zh-CN' ? '先搜索来源' : 'Search a source first'}</option>
          ) : displayBoardMatches.map(match => {
            const name = stringValue(match.name) ?? ''
            const total = numberValue(match.total)
            return (
              <option key={`${name}-${String(match.kind ?? '')}`} value={name}>
                {locale === 'zh-CN'
                  ? `${name} · ${boardKindLabel(match.kind, locale)}${total === undefined ? '' : ` · ${formatNumber(total, 0)}只`}`
                  : `${name} · ${boardKindLabel(match.kind, locale)}${total === undefined ? '' : ` · ${formatNumber(total, 0)}`}`}
              </option>
            )
          })}
        </select>
        <button type="button" style={buttonStyle(false, candidateCodes.length === 0)} disabled={candidateCodes.length === 0} onClick={() => onApplyBasket([...selectedCodes, ...candidateCodes])}>
          {locale === 'zh-CN'
            ? (batchLimitHiddenCount ? `加入前${candidateCodes.length}只` : (unsupportedCandidateCount ? '加入可回测' : '全加入篮子'))
            : (batchLimitHiddenCount ? `Add first ${candidateCodes.length}` : (unsupportedCandidateCount ? 'Add supported' : 'Add all'))}
        </button>
        <button type="button" style={buttonStyle(false, candidateCodes.length === 0)} disabled={candidateCodes.length === 0} onClick={() => onApplyBasket(candidateCodes)}>
          {locale === 'zh-CN'
            ? (batchLimitHiddenCount ? `替换前${candidateCodes.length}只` : (unsupportedCandidateCount ? '替换可回测' : '替换为成分股'))
            : (batchLimitHiddenCount ? `Replace first ${candidateCodes.length}` : (unsupportedCandidateCount ? 'Replace supported' : 'Replace'))}
        </button>
        <div style={{ ...mutedStyle, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[lookupMessage, basketMessage].filter(Boolean).join(' · ')}>
          {lookupMessage || basketMessage || (boardLabel ? `${boardLabel} · ${boardOptions.length}` : '')}
        </div>
      </div>

      <div style={labelStyle}>{locale === 'zh-CN' ? '样本来源' : 'Sample source'}</div>
      <div style={chipRowStyle}>
        {filteredBaskets.length ? filteredBaskets.slice(0, 6).map(basket => {
          const basketCodes = basket.codes.map(item => item.code)
          const active = sameCodeSet(selectedCodes, basketCodes)
          return (
            <button
              key={basket.id}
              type="button"
              aria-pressed={active}
              style={buttonStyle(active)}
              onClick={() => onApplyBasket(basketCodes)}
              title={[basket.source, basket.description].filter(Boolean).join(' · ')}
            >
              {basket.label}
            </button>
          )
        }) : <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>{basketLoading
          ? (locale === 'zh-CN' ? '正在加载动态产业链组合…' : 'Loading dynamic chain baskets…')
          : (locale === 'zh-CN' ? '没有匹配的动态组合；搜索后会用板块成分股兜底。' : 'No dynamic basket matches. Search falls back to constituents.')}</div>}
      </div>
      <div style={labelStyle}>{locale === 'zh-CN' ? '已选池' : 'Selected'}</div>
      <div style={chipRowStyle}>
        {selectedCodes.length ? visibleSelectedCodes.map(item => {
          const option = optionByCode.get(item.toUpperCase())
          return (
            <button
              key={`selected-${item}`}
              type="button"
              style={buttonStyle(true)}
              onClick={() => onRemoveCode(item)}
              title={locale === 'zh-CN'
                ? `${symbolLabel(item, option)} · 点击移除`
                : `${symbolLabel(item, option)} · click to remove`}
            >
              {symbolLabel(item, option)} ×
            </button>
          )
        }) : (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {locale === 'zh-CN' ? '选择组合、搜索板块，或勾选匹配标的。' : 'Pick a basket, search a board, or toggle symbols.'}
          </div>
        )}
        {hiddenSelectedCount > 0 ? (
          <button type="button" style={buttonStyle(false)} onClick={() => setSelectedExpanded(true)}>
            {locale === 'zh-CN' ? `展开 ${hiddenSelectedCount} 只` : `Show ${hiddenSelectedCount} more`}
          </button>
        ) : selectedExpanded && selectedCodes.length > 6 ? (
          <button type="button" style={buttonStyle(false)} onClick={() => setSelectedExpanded(false)}>
            {locale === 'zh-CN' ? '收起已选' : 'Collapse'}
          </button>
        ) : null}
        <button
          type="button"
          style={buttonStyle(false, selectedCodes.length === 0)}
          disabled={selectedCodes.length === 0}
          onClick={() => {
            setSelectedExpanded(false)
            onClearCodes()
          }}
        >
          {locale === 'zh-CN' ? '清空' : 'Clear'}
        </button>
      </div>
      {showCandidateChips ? (
      <>
      <div style={labelStyle}>{candidateLabel}</div>
      <div style={candidateExpanded ? chipRowStyle : compactChipRowStyle}>
        {boardOptions.length ? (
          <>
            <select
              aria-label={locale === 'zh-CN' ? '成分股选择' : 'Constituent picker'}
              style={{ ...selectStyle, height: 28, flex: '0 1 260px' }}
              value={selectedCandidateCode}
              onChange={event => setSelectedCandidateCode(event.target.value)}
            >
              {orderedBoardOptions.map(option => (
                <option key={`candidate-option-${option.code}`} value={option.code}>
                  {symbolLabel(option.code, option)}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={buttonStyle(false, !selectedCandidateCode)}
              disabled={!selectedCandidateCode}
              onClick={() => onToggleCode(selectedCandidateCode)}
            >
              {selectedSet.has(selectedCandidateCode.toUpperCase())
                ? (locale === 'zh-CN' ? '移出篮子' : 'Remove')
                : (locale === 'zh-CN' ? '加入篮子' : 'Add selected')}
            </button>
          </>
        ) : null}
        {visibleCandidateOptions.map(option => {
          const active = selectedSet.has(option.code.toUpperCase())
          const unsupported = isBacktestUnsupportedBoardCode(option.code)
          return (
            <button
              key={`${option.group}-${option.code}`}
              type="button"
              aria-pressed={active}
              style={buttonStyle(active)}
              onClick={() => onToggleCode(option.code)}
              title={locale === 'zh-CN'
                ? `${option.group} · ${unsupported ? '当前回测暂不支持批量运行 · ' : ''}点击${active ? '移出' : '加入'}标的篮子`
                : `${option.group} · ${unsupported ? 'not supported by batch backtest · ' : ''}click to ${active ? 'remove' : 'add'}`}
            >
              {symbolLabel(option.code, option)}
            </button>
          )
        })}
        {showCandidateChips && hiddenCandidateCount > 0 ? (
          <button type="button" style={buttonStyle(false)} onClick={() => setCandidateExpanded(previous => !previous)}>
            {candidateExpanded
              ? (locale === 'zh-CN' ? '收起候选' : 'Collapse')
              : (locale === 'zh-CN' ? `展开 ${hiddenCandidateCount} 只` : `Show ${hiddenCandidateCount} more`)}
          </button>
        ) : null}
        {!showCandidateChips ? (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {locale === 'zh-CN' ? '默认收起候选；搜索产业链、板块、股票代码或名称后再显示。' : 'Symbols stay collapsed by default. Search to reveal candidates.'}
          </div>
        ) : candidateOptions.length === 0 ? (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {normalizedQuery
              ? (locale === 'zh-CN' ? '没有匹配标的，试试板块名、股票代码或股票名称。' : 'No symbol matches. Try a board name, code, or stock name.')
              : (locale === 'zh-CN' ? '搜索板块后显示可勾选成分股。' : 'Search a board to show selectable constituents.')}
          </div>
        ) : unsupportedCandidateCount > 0 ? (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {locale === 'zh-CN'
              ? `已将${unsupportedCandidateCount}只暂不支持回测的标的排到后面。`
              : `${unsupportedCandidateCount} unsupported symbols are shown after supported ones.`}
          </div>
        ) : null}
      </div>
      </>
      ) : null}
    </div>
  )
}

function MultiBacktestReport({
  locale,
  terminal,
  onSelectCode,
}: {
  locale: LongclawLocale
  terminal?: BacktestTerminal
  onSelectCode: (code: string) => void
}) {
  const [reportRef, reportSize] = useElementSize<HTMLDivElement>()
  const [expandedKline, setExpandedKline] = useState<Record<string, unknown> | null>(null)
  const density = multiReportDensity(reportSize.width, reportSize.height)
  useEffect(() => {
    setExpandedKline(null)
  }, [terminal])
  useEffect(() => {
    if (!expandedKline) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedKline(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedKline])
  if (!terminal) {
    return <div ref={reportRef} style={{ ...multiReportStyle(density), justifyContent: 'center' }}><div style={emptyStyle}>暂无多标的结果。</div></div>
  }
  const panels = terminal.panels ?? {}
  const rankingRows = panels.ranking?.rows ?? []
  const overviewRows = panels.interval_overview?.rows ?? []
  const signalRows = Array.isArray(panels.signals?.rows) ? panels.signals.rows.map(recordValue) : []
  const chartItems = panels.multi_charts?.items ?? terminal.chart?.multi_charts ?? []
  const scriptCards = panels.scripts?.cards ?? []
  const metrics = recordValue(terminal.metrics)
  const target = recordValue(terminal.target)
  const kpiItems = [
    { label: locale === 'zh-CN' ? '标的数' : 'Symbols', value: rankingRows.length, tone: 'neutral' },
    { label: locale === 'zh-CN' ? '信号数' : 'Signals', value: formatNumber(metrics.signal_count, 0), tone: 'neutral' },
    { label: locale === 'zh-CN' ? '成交数' : 'Trades', value: formatNumber(metrics.filled_trades, 0), tone: 'neutral' },
    { label: locale === 'zh-CN' ? '胜率' : 'WinRate', value: formatPercent(metrics.win_rate), tone: (numberValue(metrics.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: locale === 'zh-CN' ? '平均收益' : 'Avg Ret', value: formatPercent(metrics.total_return_pct), tone: (numberValue(metrics.total_return_pct) ?? 0) >= 0 ? 'up' : 'down' },
    { label: locale === 'zh-CN' ? '5日波幅' : '5D Range', value: formatPercent(metrics.median_5d_high_low_pct), tone: 'warning' },
    { label: locale === 'zh-CN' ? '平均回撤' : 'Avg DD', value: formatDrawdown(metrics.max_drawdown_pct), tone: 'down' },
  ]
  return (
    <div ref={reportRef} style={multiReportStyle(density)}>
      <div style={multiHeaderStyle(density)}>
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>{locale === 'zh-CN' ? '多标的复盘' : 'Multi-symbol review'}</div>
          <div style={chartTitleStyle}>{String(target.name ?? (locale === 'zh-CN' ? '多标的回测' : 'Signals Batch'))}</div>
          <div style={mutedStyle}>
            {[freqLabel(target.freq, locale), target.as_of ? `${locale === 'zh-CN' ? '截至' : 'as of'} ${target.as_of}` : '', freshnessLabel(target.freshness, locale)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={multiKpiGridStyle(density)}>
          {kpiItems.map(item => (
            <div key={item.label} style={metricCardStyle}>
              <div style={labelStyle}>{item.label}</div>
              <div style={{ color: toneColor(item.tone), fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {String(item.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={multiBandStyle(density)}>
        <Panel title={locale === 'zh-CN' ? '排名与锐评' : 'Ranking'} style={multiPanelStyle(density)}>
          <MultiRankingTable rows={rankingRows} density={density} onSelectCode={onSelectCode} />
        </Panel>
        <Panel title={locale === 'zh-CN' ? '原始区间概览' : 'Interval overview'} style={multiPanelStyle(density)}>
          <IntervalOverviewTable rows={overviewRows} density={density} />
        </Panel>
      </div>

      <Panel title={locale === 'zh-CN' ? '全部信号收益拆解' : 'Signal return breakdown'} meta={signalRows.length ? String(signalRows.length) : undefined} style={multiPanelStyle(density)}>
        <BatchSignalBreakdownTable rows={signalRows} density={density} />
      </Panel>

      <Panel title={locale === 'zh-CN' ? '多股票 K线复盘' : 'Multi-symbol candles'} style={multiPanelStyle(density)}>
        {chartItems.length ? (
          <div style={multiChartsGridStyle(density, chartItems.length)}>
            {chartItems.map((item, index) => (
              <MiniKlineCard
                key={`${String(item.code ?? index)}-${index}`}
                item={item}
                density={density}
                onExpand={() => setExpandedKline(item)}
              />
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>暂无多标的图表。</div>
        )}
      </Panel>

      <Panel title={locale === 'zh-CN' ? '规则锐评 / 交易员结论' : 'Rule review cards'} style={multiPanelStyle(density)}>
        {scriptCards.length ? (
          <div style={scriptGridStyle(density, scriptCards.length)}>
            {scriptCards.map((card, index) => (
              <ReviewScriptCard key={`${String(card.code ?? index)}-${index}`} card={card} density={density} />
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>暂无锐评卡片。</div>
        )}
      </Panel>
      {expandedKline ? (
        <ExpandedKlineOverlay
          item={expandedKline}
          density={density}
          onClose={() => setExpandedKline(null)}
        />
      ) : null}
    </div>
  )
}

function MultiRankingTable({
  rows,
  density,
  onSelectCode,
}: {
  rows: Array<Record<string, unknown>>
  density: MultiReportDensity
  onSelectCode: (code: string) => void
}) {
  if (rows.length === 0) return <div style={emptyStyle}>暂无排名结果。</div>
  const fullHeaders = [
    ['rank', '排名'],
    ['code', '代码'],
    ['name', '股票'],
    ['benchmark_symbol', '对标指数'],
    ['strength_grade', '强弱'],
    ['range_return_pct', '区间收益'],
    ['max_drawdown_pct', '最大回撤'],
    ['median_5d_high_low_pct', '5日高低幅'],
    ['up_bar_ratio_pct', '上涨K占比'],
    ['relative_excess_pct', '相对超额'],
    ['current_character', '当前性质'],
    ['trade_difficulty', '交易难度'],
    ['review_level', '锐评档位'],
    ['review_conclusion', '锐评结论'],
  ] as const
  const compactHeaders = fullHeaders.filter(([key]) => [
    'rank',
    'code',
    'name',
    'range_return_pct',
    'max_drawdown_pct',
    'median_5d_high_low_pct',
    'trade_difficulty',
    'review_level',
    'review_conclusion',
  ].includes(key))
  const headers = density === 'compact' ? compactHeaders : fullHeaders
  return (
    <div style={reportTableWrapStyle('ranking', density)}>
      <table style={reportTableStyleFor('ranking', density)}>
        <thead>
          <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
            {headers.map(([key, label]) => (
              <th key={key} style={{ padding: 7, borderBottom: `1px solid ${terminalTheme.border}`, width: key === 'review_conclusion' ? 210 : undefined, whiteSpace: 'nowrap' }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const code = String(row.code ?? '')
            return (
              <tr
                key={`${code}-${index}`}
                style={{ borderTop: `1px solid ${terminalTheme.border}`, cursor: code ? 'pointer' : 'default' }}
                onClick={() => {
                  if (code) onSelectCode(code)
                }}
              >
                {headers.map(([key]) => (
                  <td key={key} style={{ padding: 7, color: cellToneColor(key, row[key]), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatReportCell(key, row[key])}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IntervalOverviewTable({ rows, density }: { rows: Array<Record<string, unknown>>; density: MultiReportDensity }) {
  if (rows.length === 0) return <div style={emptyStyle}>暂无区间概览。</div>
  const headers = [
    ['code', '代码'],
    ['name', '股票'],
    ['bar_count', 'K线数'],
    ['range_return_pct', '区间收益'],
    ['max_drawdown_pct', '最大回撤'],
    ['max_runup_pct', '最大浮盈'],
    ['median_5d_high_low_pct', '5日高低幅'],
    ['volatility_pct', '波动率'],
    ['up_bar_ratio_pct', '上涨K占比'],
  ] as const
  return (
    <div style={reportTableWrapStyle('overview', density)}>
      <table style={reportTableStyleFor('overview', density)}>
        <thead>
          <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
            {headers.map(([key, label]) => <th key={key} style={{ padding: 7, borderBottom: `1px solid ${terminalTheme.border}`, whiteSpace: 'nowrap' }}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${String(row.code ?? index)}-${index}`} style={{ borderTop: `1px solid ${terminalTheme.border}` }}>
              {headers.map(([key]) => (
                <td key={key} style={{ padding: 7, color: cellToneColor(key, row[key]), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatReportCell(key, row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BatchSignalBreakdownTable({ rows, density }: { rows: Array<Record<string, unknown>>; density: MultiReportDensity }) {
  if (rows.length === 0) return <div style={emptyStyle}>运行“全部信号”后显示各信号类型的 T+5/T+10、MFE/MAE 和成交收益。</div>
  const topBy = (key: string, direction: 'max' | 'min' = 'max') => rows.reduce<Record<string, unknown> | null>((best, row) => {
    const value = numberValue(row[key])
    if (value === undefined) return best
    if (!best) return row
    const bestValue = numberValue(best[key])
    if (bestValue === undefined) return row
    return direction === 'max'
      ? (value > bestValue ? row : best)
      : (value < bestValue ? row : best)
  }, null)
  const summaryItems = [
    { label: '覆盖最广', row: topBy('signal_count'), key: 'signal_count', format: (value: unknown) => formatNumber(value, 0) },
    { label: 'T+10最强', row: topBy('avg_t10_pct'), key: 'avg_t10_pct', format: formatPercent },
    { label: '成交均利', row: topBy('avg_trade_return_pct'), key: 'avg_trade_return_pct', format: formatPercent },
    { label: '回撤压力', row: topBy('avg_mae_pct', 'min'), key: 'avg_mae_pct', format: formatPercent },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: density === 'compact' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {summaryItems.map(item => (
          <div key={item.label} style={{ ...metricCardStyle, padding: '6px 8px' }}>
            <div style={labelStyle}>{item.label}</div>
            <div style={{ color: cellToneColor(item.key, item.row?.[item.key]), fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.row ? item.format(item.row[item.key]) : emptyDisplay}
            </div>
            <div style={{ ...mutedStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(item.row?.signal_type ?? emptyDisplay)}
            </div>
          </div>
        ))}
      </div>
      <div style={signalBreakdownWrapStyle(density)}>
        <table style={{ ...reportTableStyle, minWidth: density === 'compact' ? 820 : 1060 }}>
          <thead>
            <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
              {['信号类型', '样本', '胜率', '前瞻收益', '浮盈/回撤', '成交', '最佳标的'].map(label => (
                <th key={label} style={{ padding: 8, borderBottom: `1px solid ${terminalTheme.border}`, whiteSpace: 'nowrap' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const signalType = String(row.signal_type ?? 'unknown')
              return (
                <tr key={`${signalType}-${index}`} style={{ borderTop: `1px solid ${terminalTheme.border}` }}>
                  <td style={{ padding: 8, overflow: 'hidden' }}>
                    <div style={{ color: terminalTheme.textStrong, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{signalType}</div>
                    <div style={mutedStyle}>{formatNumber(row.symbol_count, 0)} 标的</div>
                  </td>
                  <td style={{ padding: 8, color: terminalTheme.textStrong, whiteSpace: 'nowrap' }}>
                    <div>{formatNumber(row.evaluated_count, 0)} / {formatNumber(row.signal_count, 0)}</div>
                    <div style={mutedStyle}>成交 {formatNumber(row.trade_count, 0)}</div>
                  </td>
                  <td style={{ padding: 8, color: cellToneColor('win_rate_pct', row.win_rate), whiteSpace: 'nowrap', fontWeight: 800 }}>
                    {formatUnsignedPercent(row.win_rate)}
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <div style={{ color: cellToneColor('avg_t5_pct', row.avg_t5_pct), fontWeight: 800 }}>T+5 {formatPercent(row.avg_t5_pct)}</div>
                    <div style={{ color: cellToneColor('avg_t10_pct', row.avg_t10_pct) }}>T+10 {formatPercent(row.avg_t10_pct)}</div>
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <div style={{ color: cellToneColor('avg_mfe_pct', row.avg_mfe_pct), fontWeight: 800 }}>MFE {formatPercent(row.avg_mfe_pct)}</div>
                    <div style={{ color: cellToneColor('avg_mae_pct', row.avg_mae_pct) }}>MAE {formatPercent(row.avg_mae_pct)}</div>
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <div style={{ color: cellToneColor('avg_trade_return_pct', row.avg_trade_return_pct), fontWeight: 800 }}>{formatPercent(row.avg_trade_return_pct)}</div>
                    <div style={mutedStyle}>胜率 {formatUnsignedPercent(row.trade_win_rate)}</div>
                  </td>
                  <td style={{ padding: 8, color: terminalTheme.textStrong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(row.best_symbol ?? emptyDisplay)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MiniKlineCard({
  item,
  density,
  onExpand,
}: {
  item: Record<string, unknown>
  density: MultiReportDensity
  onExpand?: () => void
}) {
  const rows = toKLineData(Array.isArray(item.ohlcv) ? item.ohlcv as Record<string, unknown>[] : [])
  const regimes = Array.isArray(item.regimes) ? item.regimes.map(recordValue) : []
  return (
    <button
      type="button"
      style={{
        ...metricCardStyle,
        padding: density === 'compact' ? 8 : 10,
        display: 'flex',
        flexDirection: 'column',
        gap: density === 'compact' ? 6 : 8,
        width: '100%',
        appearance: 'none',
        fontFamily: fontStacks.ui,
        color: terminalTheme.text,
        cursor: 'zoom-in',
        textAlign: 'left',
      }}
      onClick={onExpand}
      aria-label={`放大K线 ${String(item.name ?? item.code ?? '')}`}
      title="点击放大K线"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: terminalTheme.textStrong, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(item.name ?? item.code ?? '标的')}
          </div>
          <div style={monoStyle}>{String(item.code ?? item.symbol ?? '')}</div>
        </div>
        <div style={{ color: toneColor((numberValue(item.range_return_pct) ?? 0) >= 0 ? 'up' : 'down'), fontWeight: 800 }}>
          {formatPercent(item.range_return_pct)}
        </div>
      </div>
      <MiniKlineSvg rows={rows} regimes={regimes} density={density} />
    </button>
  )
}

function MiniKlineSvg({
  rows,
  regimes,
  density,
  variant = 'mini',
}: {
  rows: KLineData[]
  regimes: Array<Record<string, unknown>>
  density: MultiReportDensity
  variant?: 'mini' | 'expanded'
}) {
  const width = variant === 'expanded' ? 980 : 320
  const height = variant === 'expanded' ? (density === 'compact' ? 360 : 430) : (density === 'compact' ? 126 : 150)
  if (rows.length === 0) {
    return <div style={emptyStyle}>暂无K线。</div>
  }
  const highs = rows.map(row => row.high)
  const lows = rows.map(row => row.low)
  const maxPrice = Math.max(...highs)
  const minPrice = Math.min(...lows)
  const priceSpan = Math.max(maxPrice - minPrice, 0.0001)
  const xStep = width / Math.max(rows.length - 1, 1)
  const candleWidth = Math.max(2, Math.min(7, xStep * 0.56))
  const yFor = (price: number) => 12 + (maxPrice - price) / priceSpan * (height - 30)
  const points = rows.map((row, index) => `${index * xStep},${yFor(row.close)}`).join(' ')
  const firstDate = new Date(rows[0].timestamp).toISOString().slice(5, 10)
  const lastDate = new Date(rows[rows.length - 1].timestamp).toISOString().slice(5, 10)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', aspectRatio: `${width} / ${height}`, display: 'block' }} role="img" aria-label={variant === 'expanded' ? 'expanded kline' : 'mini kline'}>
      <rect x="0" y="0" width={width} height={height} fill={terminalTheme.chartPanel} />
      {[0, 1, 2, 3].map(item => (
        <line
          key={item}
          x1="0"
          x2={width}
          y1={14 + item * ((height - 34) / 3)}
          y2={14 + item * ((height - 34) / 3)}
          stroke={tradingDeskTheme.chart.gridHorizontal}
          strokeWidth="1"
        />
      ))}
      {regimes.map((regime, index) => {
        const start = numberValue(regime.start_index) ?? 0
        const end = numberValue(regime.end_index) ?? start
        const tone = String(regime.tone ?? '')
        const x = Math.max(0, start * xStep)
        const rectWidth = Math.max(8, (end - start + 1) * xStep)
        return (
          <g key={`${String(regime.label ?? index)}-${index}`}>
            <rect
              x={x}
              y="0"
              width={Math.min(rectWidth, width - x)}
              height={height - 18}
              fill={tone === 'down' ? tradingDeskTheme.market.down : tradingDeskTheme.market.up}
              fillOpacity="0.08"
            />
            <text x={x + 4} y={variant === 'expanded' ? 22 : 13} fill={terminalTheme.mutedStrong} fontSize={variant === 'expanded' ? 16 : 9}>{String(regime.label ?? '')}</text>
          </g>
        )
      })}
      <polyline points={points} fill="none" stroke={tradingDeskTheme.chart.line} strokeWidth={variant === 'expanded' ? 1.8 : 1.1} opacity="0.55" />
      {rows.map((row, index) => {
        const x = index * xStep
        const openY = yFor(row.open)
        const closeY = yFor(row.close)
        const highY = yFor(row.high)
        const lowY = yFor(row.low)
        const up = row.close >= row.open
        const color = up ? tradingDeskTheme.market.up : tradingDeskTheme.market.down
        return (
          <g key={`${row.timestamp}-${index}`}>
            <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={variant === 'expanded' ? 1.4 : 1} />
            <rect
              x={x - candleWidth / 2}
              y={Math.min(openY, closeY)}
              width={candleWidth}
              height={Math.max(1, Math.abs(openY - closeY))}
              fill={color}
              rx="0.8"
            />
          </g>
        )
      })}
      <text x="0" y={height - 3} fill={terminalTheme.muted} fontSize={variant === 'expanded' ? 14 : 9}>{firstDate}</text>
      <text x={width} y={height - 3} fill={terminalTheme.muted} fontSize={variant === 'expanded' ? 14 : 9} textAnchor="end">{lastDate}</text>
    </svg>
  )
}

function ExpandedKlineOverlay({
  item,
  density,
  onClose,
}: {
  item: Record<string, unknown>
  density: MultiReportDensity
  onClose: () => void
}) {
  const rows = toKLineData(Array.isArray(item.ohlcv) ? item.ohlcv as Record<string, unknown>[] : [])
  const regimes = Array.isArray(item.regimes) ? item.regimes.map(recordValue) : []
  const stats = [
    ['区间收益', 'range_return_pct'],
    ['最大回撤', 'max_drawdown_pct'],
    ['最大浮盈', 'max_runup_pct'],
    ['波动率', 'volatility_pct'],
    ['5日高低幅', 'median_5d_high_low_pct'],
    ['上涨K占比', 'up_bar_ratio_pct'],
    ['K线数', 'bar_count'],
    ['显示K线', 'visible_bar_count'],
  ] as const
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: tradingDeskTheme.alpha.overlay,
        display: 'grid',
        placeItems: 'center',
        padding: density === 'compact' ? 12 : 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="放大K线"
        style={{
          ...panelStyle,
          width: 'min(1480px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          boxShadow: tradingDeskTheme.shadows.island,
          border: `1px solid ${terminalTheme.borderStrong}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={labelStyle}>放大K线 · ESC</div>
            <div style={chartTitleStyle}>{String(item.name ?? item.code ?? '标的')}</div>
            <div style={monoStyle}>{String(item.code ?? item.symbol ?? '')}</div>
          </div>
          <button type="button" aria-label="关闭放大K线" style={buttonStyle(false)} onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 6 }}>
          {stats.map(([label, key]) => (
            <div key={key} style={metricCardStyle}>
              <div style={labelStyle}>{label}</div>
              <div style={{ color: cellToneColor(key, item[key]), fontWeight: 800 }}>
                {key === 'visible_bar_count'
                  ? formatNumber(rows.length, 0)
                  : key === 'bar_count'
                    ? formatNumber(item[key] ?? rows.length, 0)
                    : formatReportCell(key, item[key])}
              </div>
            </div>
          ))}
        </div>
        <MiniKlineSvg rows={rows} regimes={regimes} density={density} variant="expanded" />
      </div>
    </div>
  )
}

function ReviewScriptCard({ card, density }: { card: Record<string, unknown>; density: MultiReportDensity }) {
  const stats = Array.isArray(card.stats) ? card.stats.map(recordValue) : []
  const tone = String(card.tone ?? '') === 'down' ? 'down' : 'up'
  const compact = density === 'compact'
  return (
    <div style={{
      ...metricCardStyle,
      borderColor: tone === 'down' ? tradingDeskTheme.alpha.errorBorder : tradingDeskTheme.alpha.infoBorder,
      boxShadow: `inset 3px 0 ${tone === 'down' ? tradingDeskTheme.market.down : tradingDeskTheme.market.up}`,
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 7 : 9,
      padding: compact ? 9 : 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={labelStyle}>规则锐评</div>
          <div style={{ color: terminalTheme.textStrong, fontSize: compact ? 16 : 18, fontWeight: 900 }}>{String(card.name ?? card.code ?? '')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={monoStyle}>{String(card.code ?? '')}</div>
          <div style={labelStyle}>随回测刷新</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {stats.slice(0, 4).map((item, index) => (
          <div key={`${String(item.label ?? index)}-${index}`} style={{ ...metricCardStyle, padding: 7 }}>
            <div style={mutedStyle}>{String(item.label ?? '')}</div>
            <div style={{ color: cellToneColor(String(item.label ?? ''), item.value), fontWeight: 800 }}>
              {String(item.unit) === '%' ? formatPercent(item.value) : String(item.value ?? emptyDisplay)}
            </div>
          </div>
        ))}
      </div>
      {compact ? null : <ScriptLine title="定位" text={String(card.positioning ?? '')} />}
      {compact ? null : <ScriptLine title="交易难度" text={String(card.difficulty ?? '')} />}
      <ScriptLine title="一句话" text={String(card.one_liner ?? '')} strong />
    </div>
  )
}

function ScriptLine({ title, text, strong = false }: { title: string; text: string; strong?: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${terminalTheme.border}`, paddingTop: 8 }}>
      <div style={labelStyle}>{title}</div>
      <div style={{ color: strong ? terminalTheme.textStrong : terminalTheme.text, fontSize: 13, lineHeight: 1.55, fontWeight: strong ? 800 : 500 }}>
        {text || emptyDisplay}
      </div>
    </div>
  )
}

function formatReportCell(key: string, value: unknown): string {
  if (key.includes('pct') || key.includes('return') || key.includes('drawdown') || key.includes('ratio')) return formatPercent(value)
  if (key === 'rank' || key === 'bar_count' || key.endsWith('_count') || key === 'trade_count' || key === 'signal_count') return formatNumber(value, 0)
  if (key === 'sharpe') return formatNumber(value, 2)
  return String(value ?? emptyDisplay)
}

function cellToneColor(key: string, value: unknown): string {
  const numeric = numberValue(value)
  if (key.includes('drawdown')) return tradingDeskTheme.market.down
  if (numeric !== undefined && (key.includes('return') || key.includes('excess') || key.includes('pct'))) {
    return numeric >= 0 ? tradingDeskTheme.market.up : tradingDeskTheme.market.down
  }
  return terminalTheme.textStrong
}

function Panel({
  title,
  meta,
  style,
  children,
}: {
  title: string
  meta?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div style={{ ...panelStyle, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ color: terminalTheme.textStrong, fontSize: 13, fontWeight: 800 }}>{title}</div>
        {meta ? <div style={mutedStyle}>{meta}</div> : null}
      </div>
      {children}
    </div>
  )
}

function MetricStrip({ result, locale }: { result: BacktestResult | null; locale: LongclawLocale }) {
  const kpi = result?.kpi ?? {}
  const simKpi = result?.sim_kpi ?? {}
  const metrics = terminalMetrics(result)
  const pnlValue = numberValue(metrics.total_return_pct ?? simKpi.total_return_pct)
  const items = [
    { label: locale === 'zh-CN' ? '收益' : 'PnL', value: formatPercent(metrics.total_return_pct ?? simKpi.total_return_pct), tone: (pnlValue ?? 0) >= 0 ? 'up' : 'down' },
    { label: locale === 'zh-CN' ? '回撤' : 'DD', value: formatDrawdown(metrics.max_drawdown_pct ?? simKpi.max_drawdown_pct), tone: 'down' },
    { label: locale === 'zh-CN' ? '胜率' : 'WinRate', value: formatPercent(metrics.win_rate ?? simKpi.win_rate ?? kpi.win_rate), tone: (numberValue(metrics.win_rate ?? simKpi.win_rate ?? kpi.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: locale === 'zh-CN' ? '成交' : 'Trades', value: formatNumber(metrics.filled_trades ?? simKpi.filled_trades, 0), tone: 'neutral' },
    { label: locale === 'zh-CN' ? '夏普' : 'Sharpe', value: formatNumber(metrics.sharpe ?? simKpi.sharpe, 2), tone: (numberValue(metrics.sharpe ?? simKpi.sharpe) ?? 0) >= 1 ? 'up' : 'neutral' },
    { label: locale === 'zh-CN' ? '超额' : 'Excess', value: formatPercent(metrics.excess_return_pct), tone: (numberValue(metrics.excess_return_pct) ?? 0) >= 0 ? 'up' : 'down' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
      {items.map(item => (
        <div key={item.label} style={metricCardStyle}>
          <div style={labelStyle}>{item.label}</div>
          <div style={{ color: toneColor(item.tone), fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function ParamGrid({
  params,
  onChange,
}: {
  params: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const items = [
    ['stop_loss', '止损%'],
    ['trail_stop', '移动止盈%'],
    ['max_hold', '持仓日'],
    ['slippage', '滑点%'],
    ['take_profit', '固定止盈%'],
    ['ma_exit_period', '均线离场'],
    ['profit_drawdown', '利润回撤%'],
    ['atr_exit_period', 'ATR周期'],
    ['atr_exit_mult', 'ATR倍数'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
      {items.map(([key, label]) => (
        <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={mutedStyle}>{label}</span>
          <input
            style={{ ...inputStyle, height: 28 }}
            value={params[key] ?? ''}
            onChange={event => onChange(key, event.target.value)}
          />
        </label>
      ))}
    </div>
  )
}

function KpiPanel({ result }: { result: BacktestResult | null }) {
  const kpi = result?.kpi
  const simKpi = result?.sim_kpi
  const metrics = terminalMetrics(result)
  if (Object.keys(metrics).length > 0) {
    const metricRows = (key: string): Array<{ label: string; value: unknown; tone?: string }> =>
      (Array.isArray(metrics[key]) ? metrics[key] : [])
        .map(item => recordValue(item))
        .map(item => ({
          label: stringValue(item.label) ?? stringValue(item.key) ?? '',
          value: formatMetricValue(item.value, stringValue(item.unit)),
          tone: stringValue(item.tone),
        }))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto' }}>
        <MetricGroup title="绩效" items={metricRows('performance')} />
        <MetricGroup title="风险" items={metricRows('risk')} />
        <MetricGroup title="交易质量" items={metricRows('trade_quality')} />
        <MetricGroup title="执行体验" items={metricRows('execution')} />
        <MetricGroup title="信号质量" items={metricRows('signal_quality')} />
      </div>
    )
  }
  if (!kpi && !simKpi) return <div style={emptyStyle}>运行后显示绩效。</div>
  const signalItems = [
    { label: '总信号', value: kpi?.total },
    { label: '已评估', value: kpi?.evaluated },
    { label: '胜率', value: formatPercent(kpi?.win_rate), tone: (numberValue(kpi?.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: '期望', value: formatPercent(kpi?.expectancy), tone: (numberValue(kpi?.expectancy) ?? 0) >= 0 ? 'up' : 'down' },
    { label: 'T+10', value: formatPercent(kpi?.avg_return_t10), tone: (numberValue(kpi?.avg_return_t10) ?? 0) >= 0 ? 'up' : 'down' },
    { label: 'MFE/MAE', value: `${formatPercent(kpi?.avg_mfe)} / ${formatPercent(kpi?.avg_mae)}` },
  ]
  const simItems = [
    { label: '成交', value: simKpi?.filled_trades },
    { label: '胜率', value: formatPercent(simKpi?.win_rate), tone: (numberValue(simKpi?.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: '总收益', value: formatPercent(simKpi?.total_return_pct), tone: (numberValue(simKpi?.total_return_pct) ?? 0) >= 0 ? 'up' : 'down' },
    { label: 'Sharpe', value: formatNumber(simKpi?.sharpe, 2), tone: (numberValue(simKpi?.sharpe) ?? 0) >= 1 ? 'up' : 'neutral' },
    { label: '盈亏比', value: formatNumber(simKpi?.profit_factor, 2), tone: (numberValue(simKpi?.profit_factor) ?? 0) >= 1 ? 'up' : 'down' },
    { label: '最大回撤', value: formatDrawdown(simKpi?.max_drawdown_pct), tone: 'down' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto' }}>
      <MetricGroup title="信号质量" items={signalItems} />
      <MetricGroup title="交易模拟" items={simItems} />
    </div>
  )
}

function MetricGroup({ title, items }: { title: string; items: Array<{ label: string; value: unknown; tone?: string }> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={labelStyle}>{title}</div>
      <div style={metricGridStyle}>
        {items.map(({ label, value, tone }) => (
          <div key={label} style={metricCardStyle}>
            <div style={mutedStyle}>{label}</div>
            <div style={{ color: toneColor(tone), fontWeight: 800 }}>{String(value ?? emptyDisplay)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignalTable({
  signals,
  selectedIndex,
  onSelect,
}: {
  signals: BacktestSignal[]
  selectedIndex: number | null
  onSelect: (index: number, rawTime?: number) => void
}) {
  if (signals.length === 0) return <div style={emptyStyle}>暂无信号。</div>
  return (
    <div style={tableWrapStyle}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
            <th style={{ padding: 7 }}>日期</th>
            <th style={{ padding: 7 }}>信号</th>
            <th style={{ padding: 7 }}>价格</th>
            <th style={{ padding: 7 }}>T+10</th>
          </tr>
        </thead>
        <tbody>
          {signals.slice().reverse().map((signal, index) => {
            const sourceIndex = signal.index ?? signals.length - index - 1
            const returnT10 = numberValue(signal.eval?.return_t10 ?? signal.return_t10)
            const rowActive = selectedIndex === sourceIndex
            return (
              <tr
                key={`${signal.dt ?? signal.time ?? index}-${signal.type ?? 'signal'}`}
                style={{
                  borderTop: `1px solid ${terminalTheme.border}`,
                  background: rowActive ? tradingDeskTheme.alpha.accentSurface : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => onSelect(sourceIndex, signal.dt ?? signal.time)}
              >
                <td style={{ padding: 7, color: terminalTheme.mono }}>{signal.date_str ?? signal.date ?? ''}</td>
                <td style={{ padding: 7 }}>
                  <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{signal.type ?? signal.group ?? '信号'}</div>
                  <div style={mutedStyle}>{[signal.group, signal.ma_status, signal.volume_status].filter(Boolean).join(' · ')}</div>
                </td>
                <td style={{ padding: 7, color: terminalTheme.mono }}>{formatNumber(signal.price)}</td>
                <td style={{ padding: 7, color: (returnT10 ?? 0) >= 0 ? tradingDeskTheme.market.up : tradingDeskTheme.market.down }}>
                  {formatPercent(returnT10)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TradeTable({
  trades,
  selectedIndex,
  onSelect,
}: {
  trades: BacktestTrade[]
  selectedIndex: number | null
  onSelect: (index: number, rawTime?: number) => void
}) {
  const filled = trades.filter(trade => trade.entry_price !== null && trade.entry_price !== undefined)
  if (filled.length === 0) return <div style={emptyStyle}>暂无成交记录。</div>
  return (
    <div style={tableWrapStyle}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
            <th style={{ padding: 7 }}>信号</th>
            <th style={{ padding: 7 }}>入/出</th>
            <th style={{ padding: 7 }}>净利</th>
          </tr>
        </thead>
        <tbody>
          {filled.slice().reverse().map((trade, index) => {
            const sourceIndex = trade.index ?? filled.length - index - 1
            const rowActive = selectedIndex === sourceIndex
            return (
            <tr
              key={`${trade.id ?? trade.signal_date ?? index}-${trade.signal_type ?? 'trade'}`}
              style={{
                borderTop: `1px solid ${terminalTheme.border}`,
                background: rowActive ? tradingDeskTheme.alpha.accentSurface : 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => onSelect(sourceIndex, tradeTimestampsMs(trade)[0])}
            >
              <td style={{ padding: 7 }}>
                <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{trade.signal_type ?? '信号'}</div>
                <div style={mutedStyle}>{trade.signal_date}</div>
              </td>
              <td style={{ padding: 7, color: terminalTheme.mono }}>
                {formatNumber(trade.entry_price)} / {formatNumber(trade.exit_price)}
                <div style={mutedStyle}>{trade.exit_reason ?? ''}</div>
              </td>
              <td style={{ padding: 7, color: (trade.net_return_pct ?? 0) >= 0 ? tradingDeskTheme.market.up : tradingDeskTheme.market.down, fontWeight: 800 }}>
                {formatPercent(trade.net_return_pct)}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RiskPanel({ result }: { result: BacktestResult | null }) {
  const terminal = terminalOf(result)
  if (!terminal) return <div style={emptyStyle}>运行后显示风控摘要。</div>
  const risk = recordValue(terminal.panels?.risk)
  const config = recordValue(terminal.panels?.config)
  const dataHealth = recordValue(config.data_health)
  const assumptions = recordValue(terminal.trade_assumptions ?? risk.assumptions)
  const bands = Array.isArray(risk.bands) ? risk.bands.map(item => recordValue(item)) : []
  const skipReasons = recordValue(risk.skip_reasons)
  const riskMetrics = Array.isArray(terminal.metrics?.risk)
    ? (terminal.metrics?.risk as BacktestTerminalMetric[])
    : []
  const metricRows = riskMetrics.map(item => ({
    label: item.label ?? item.key ?? '',
    value: formatMetricValue(item.value, item.unit),
    tone: item.tone,
  }))
  const assumptionRows = [
    { label: '初始资金', value: formatNumber(assumptions.initial_capital, 0) },
    { label: '仓位', value: formatNumber(assumptions.position_size, 2) },
    { label: '佣金', value: formatPercent(assumptions.commission_pct) },
    { label: '印花税', value: formatPercent(assumptions.stamp_tax_pct) },
    { label: '滑点', value: formatPercent(assumptions.slippage_pct) },
    { label: '手数', value: formatNumber(assumptions.lot_size, 0) },
    { label: '最长持仓', value: `${formatNumber(assumptions.max_hold_days, 0)}D` },
  ]
  const bandRows = bands.length
    ? bands.map(item => ({
        label: stringValue(item.label) ?? stringValue(item.key) ?? '',
        value: [
          numberValue(item.price) === undefined ? '' : formatNumber(item.price, 3),
          numberValue(item.pct) === undefined ? '' : formatPercent(item.pct),
        ].filter(Boolean).join(' / ') || emptyDisplay,
        tone: numberValue(item.pct) !== undefined && (numberValue(item.pct) ?? 0) < 0 ? 'down' : 'up',
      }))
    : [{ label: '风控线', value: '未启用' }]
  const healthRows = [
    { label: '数据源', value: dataHealth.data_source_detail ?? dataHealth.data_source ?? emptyDisplay },
    { label: '新鲜度', value: freshnessLabel(dataHealth.freshness, 'zh-CN') || emptyDisplay },
    { label: '截至', value: dataHealth.as_of ?? emptyDisplay },
    { label: 'K线', value: dataHealth.bar_count ?? emptyDisplay },
  ]
  const skipRows = Object.keys(skipReasons).length
    ? Object.entries(skipReasons).map(([label, value]) => ({ label, value }))
    : [{ label: '跳过原因', value: '无' }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto' }}>
      <MetricGroup title="风险指标" items={metricRows} />
      <MetricGroup title="交易假设" items={assumptionRows} />
      <MetricGroup title="止损/止盈带" items={bandRows} />
      <MetricGroup title="配置与数据健康" items={[...healthRows, ...skipRows]} />
    </div>
  )
}

function ScanControls({
  params,
  scan,
  loading,
  onChange,
  onRun,
}: {
  params: Record<string, string>
  scan: ScanResult | null
  loading: boolean
  onChange: (key: string, value: string) => void
  onRun: () => void
}) {
  const scanPanel = recordValue(scan?.terminal?.panels?.scan)
  const bestParams = Object.keys(recordValue(scanPanel.best_params)).length
    ? recordValue(scanPanel.best_params)
    : scan?.best_params
  const scanRows = Array.isArray(scanPanel.rows)
    ? (scanPanel.rows as Array<Record<string, unknown>>)
    : scan?.scan_results
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <select style={selectStyle} value={params.scan_param} onChange={event => onChange('scan_param', event.target.value)}>
          <option value="stop_loss_pct">止损%</option>
          <option value="trail_stop_pct">移动止盈%</option>
          <option value="max_hold_days">最大持仓日</option>
          <option value="take_profit_pct">固定止盈%</option>
        </select>
        <input style={inputStyle} value={params.scan_values} onChange={event => onChange('scan_values', event.target.value)} />
        <select style={selectStyle} value={params.scan_metric} onChange={event => onChange('scan_metric', event.target.value)}>
          <option value="sharpe">Sharpe</option>
          <option value="win_rate">胜率</option>
          <option value="expectancy">期望</option>
          <option value="total_return_pct">总收益</option>
        </select>
        <button type="button" style={buttonStyle(true, loading)} disabled={loading} onClick={onRun}>
          {loading ? '扫描中' : '运行扫描'}
        </button>
      </div>
      {bestParams ? (
        <div style={warningStyle}>
          最优参数：{Object.entries(bestParams).map(([key, value]) => `${key}=${String(value)}`).join(', ')}
        </div>
      ) : null}
      {scanRows?.length ? (
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {scanRows.slice(0, 18).map((row, index) => (
                <tr key={index} style={{ borderTop: index === 0 ? 'none' : `1px solid ${terminalTheme.border}` }}>
                  <td style={{ padding: 7, color: terminalTheme.textStrong }}>
                    {Object.values(recordValue(row.params)).join(' / ')}
                  </td>
                  <td style={{ padding: 7, color: terminalTheme.mono }}>Sharpe {formatNumber(row.sharpe, 2)}</td>
                  <td style={{ padding: 7, color: terminalTheme.mono }}>WR {formatPercent(row.win_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={emptyStyle}>展开扫描参数后运行。</div>
      )}
    </div>
  )
}

function historyEntryTitle(entry: BacktestHistoryEntry, locale: LongclawLocale): string {
  if (entry.mode === 'multi') {
    const count = entry.codes.length
    return locale === 'zh-CN'
      ? `多标的回测${count ? ` · ${count}只` : ''}`
      : `Multi-symbol backtest${count ? ` · ${count}` : ''}`
  }
  return entry.title
}

function historyEntryMeta(entry: BacktestHistoryEntry, locale: LongclawLocale): string {
  const date = entry.createdAt ? entry.createdAt.slice(5, 16).replace('T', ' ') : ''
  return [
    entry.meta,
    freqLabel(entry.freq, locale),
    date,
  ].filter(Boolean).join(' · ')
}

function BacktestHistoryRows({
  locale,
  entries,
  onRestore,
}: {
  locale: LongclawLocale
  entries: BacktestHistoryEntry[]
  onRestore: (entry: BacktestHistoryEntry) => void
}) {
  if (entries.length === 0) {
    return (
      <div style={emptyStyle}>
        {locale === 'zh-CN' ? '暂无可复原回测。' : 'No restorable backtest yet.'}
      </div>
    )
  }
  return (
    <div style={compactListStyle}>
      {entries.slice(0, BACKTEST_HISTORY_LIMIT).map(entry => (
        <button
          key={entry.id}
          type="button"
          style={{ ...rowStyle, width: '100%', cursor: 'pointer', textAlign: 'left' }}
          onClick={() => onRestore(entry)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{historyEntryTitle(entry, locale)}</div>
            <div style={mutedStyle}>{historyEntryMeta(entry, locale)}</div>
          </div>
          <span style={statusBadgeStyle('success')}>{locale === 'zh-CN' ? '复原' : 'Restore'}</span>
        </button>
      ))}
    </div>
  )
}

function FallbackRows({
  dashboard,
  onOpenRun,
  onOpenRecord,
}: {
  dashboard: BacktestDashboard
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (title: string, record: Record<string, unknown>) => void
}) {
  const rows = [
    ...dashboard.pending_backlog_preview.map(item => ({
      title: item.symbol,
      meta: `${item.signal_type} · ${item.freq}`,
      record: item as unknown as Record<string, unknown>,
    })),
    ...dashboard.backtest_jobs.map(item => ({
      title: String(item.job_id ?? item.symbol ?? 'job'),
      meta: String(item.status ?? ''),
      record: item as unknown as Record<string, unknown>,
    })),
  ]
  return (
    <div style={compactListStyle}>
      {rows.length === 0 ? (
        <div style={emptyStyle}>暂无待处理回测。</div>
      ) : (
        rows.slice(0, 8).map((row, index) => (
          <button
            key={`${row.title}-${index}`}
            type="button"
            style={{ ...rowStyle, width: '100%', cursor: 'pointer', textAlign: 'left' }}
            onClick={() => onOpenRecord(`Backtest ${row.title}`, row.record)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{row.title}</div>
              <div style={mutedStyle}>{row.meta}</div>
            </div>
          </button>
        ))
      )}
      {dashboard.review_runs.slice(0, 4).map(run => (
        <button
          key={run.run_id}
          type="button"
          style={{ ...rowStyle, width: '100%', cursor: 'pointer', textAlign: 'left' }}
          onClick={() => {
            void onOpenRun(run as LongclawRun)
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{run.summary || run.run_id}</div>
            <div style={mutedStyle}>{run.status}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

function FallbackBacktest({
  locale,
  dashboard,
  historyEntries,
  onRestoreHistory,
  onOpenRun,
  onOpenRecord,
}: {
  locale: LongclawLocale
  dashboard: BacktestDashboard
  historyEntries: BacktestHistoryEntry[]
  onRestoreHistory: (entry: BacktestHistoryEntry) => void
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (title: string, record: Record<string, unknown>) => void
}) {
  return (
    <div style={{ ...mainGridStyle, gridTemplateColumns: '1fr' }}>
      <Panel title={locale === 'zh-CN' ? '回测记录' : 'Backtest records'}>
        <BacktestHistoryRows locale={locale} entries={historyEntries} onRestore={onRestoreHistory} />
      </Panel>
      <Panel title={locale === 'zh-CN' ? '待处理线索' : 'Pending signals'}>
        <FallbackRows dashboard={dashboard} onOpenRun={onOpenRun} onOpenRecord={onOpenRecord} />
      </Panel>
    </div>
  )
}
