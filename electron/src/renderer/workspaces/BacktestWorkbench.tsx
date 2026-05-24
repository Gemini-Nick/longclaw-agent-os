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
  'backtest_summary' | 'backtest_jobs' | 'pending_backlog_preview' | 'review_runs' | 'buy_candidates' | 'chart_context'
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

type BoardStocksResponse = {
  board?: string
  total?: number
  showing?: number
  stocks?: Array<{ symbol?: string; code?: string; name?: string }>
  error?: string
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
type SymbolOption = { code: string; name: string; group: string }
type SymbolBasket = { id: string; label: string; codes: SymbolOption[] }

type BacktestTerminalMetric = {
  key?: string
  label?: string
  value?: unknown
  unit?: string
  tone?: string
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
    date_presets?: Array<{ key?: string; label?: string; date?: string; time?: number }>
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
  date_presets?: Array<{ key?: string; label?: string; date?: string; time?: number }>
  warnings?: string[]
  terminal?: BacktestTerminal
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
  kind?: 'signal' | 'trade'
  sourceIndex?: number
  tradeIndex?: number
}

const BACKTEST_MARKER_OVERLAY = 'longclawBacktestMarker'
const BACKTEST_MARKER_GROUP = 'longclaw-backtest-markers'
let markerRegistered = false
const terminalTheme = tradingDeskTheme.colors

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
  display: 'grid',
  gridTemplateColumns: 'minmax(190px, 300px) auto auto auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
}

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 1,
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

const presetSymbolBaskets: SymbolBasket[] = [
  {
    id: 'ai_semis',
    label: 'AI算力半导体',
    codes: [
      { code: '300394', name: '天孚通信', group: 'AI算力半导体' },
      { code: '688041', name: '海光信息', group: 'AI算力半导体' },
      { code: '688521', name: '芯原股份', group: 'AI算力半导体' },
    ],
  },
  {
    id: 'semiconductor_equipment',
    label: '半导体设备',
    codes: [
      { code: '688012', name: '中微公司', group: '半导体设备' },
      { code: '688072', name: '拓荆科技', group: '半导体设备' },
      { code: '688082', name: '盛美上海', group: '半导体设备' },
      { code: '688120', name: '华海清科', group: '半导体设备' },
      { code: '688478', name: '晶升股份', group: '半导体设备' },
      { code: '002371', name: '北方华创', group: '半导体设备' },
    ],
  },
  {
    id: 'optical_cpo',
    label: '光模块/CPO',
    codes: [
      { code: '300308', name: '中际旭创', group: '光模块/CPO' },
      { code: '300502', name: '新易盛', group: '光模块/CPO' },
      { code: '300394', name: '天孚通信', group: '光模块/CPO' },
      { code: '002281', name: '光迅科技', group: '光模块/CPO' },
      { code: '603083', name: '剑桥科技', group: '光模块/CPO' },
    ],
  },
  {
    id: 'pcb_ccl',
    label: 'PCB/CCL',
    codes: [
      { code: '300476', name: '胜宏科技', group: 'PCB/CCL' },
      { code: '600183', name: '生益科技', group: 'PCB/CCL' },
      { code: '688183', name: '生益电子', group: 'PCB/CCL' },
      { code: '002463', name: '沪电股份', group: 'PCB/CCL' },
      { code: '002916', name: '深南电路', group: 'PCB/CCL' },
    ],
  },
  {
    id: 'battery_materials',
    label: '电池材料',
    codes: [
      { code: '002709', name: '天赐材料', group: '电池材料' },
      { code: '300750', name: '宁德时代', group: '电池材料' },
      { code: '002460', name: '赣锋锂业', group: '电池材料' },
    ],
  },
  {
    id: 'consumer_core',
    label: '消费权重',
    codes: [
      { code: '600519', name: '贵州茅台', group: '消费权重' },
      { code: '601888', name: '中国中免', group: '消费权重' },
      { code: '000858', name: '五粮液', group: '消费权重' },
    ],
  },
  {
    id: 'review_sample',
    label: '当前复盘篮子',
    codes: [
      { code: '002709', name: '天赐材料', group: '当前复盘篮子' },
      { code: '688041', name: '海光信息', group: '当前复盘篮子' },
      { code: '688521', name: '芯原股份', group: '当前复盘篮子' },
      { code: '600519', name: '贵州茅台', group: '当前复盘篮子' },
      { code: '601888', name: '中国中免', group: '当前复盘篮子' },
    ],
  },
]

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
    gridTemplateColumns: density === 'compact' ? 'minmax(0, 1fr)' : 'minmax(220px, 1fr) auto',
    gap: density === 'compact' ? 7 : 10,
    alignItems: 'end',
  }
}

function multiKpiGridStyle(density: MultiReportDensity): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: density === 'compact'
      ? 'repeat(auto-fit, minmax(74px, 1fr))'
      : 'repeat(auto-fit, minmax(86px, 1fr))',
    gap: 6,
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
        mongodb_bars: 'MongoDB bars',
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
    typeof barCount === 'number' ? `${barCount} bars` : '',
    freshness ? freshness : '',
    result.derived_from ? `${locale === 'zh-CN' ? '聚合自' : 'derived from'} ${result.derived_from}` : '',
    result.partial ? (locale === 'zh-CN' ? 'partial' : 'partial') : '',
  ].filter(Boolean)
  return parts.join(' · ')
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

function normalizeSymbolCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withoutPrefix = trimmed.replace(/^(SZ|SH|HK|US)\./i, '')
  const suffixMatch = withoutPrefix.match(/^([A-Za-z0-9]+)\.(SZ|SH|HK|US)$/i)
  return (suffixMatch?.[1] ?? withoutPrefix).toUpperCase()
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

function formatNumber(value: unknown, digits = 2): string {
  const number = numberValue(value)
  if (number === undefined) return 'N/A'
  return number.toFixed(digits)
}

function formatPercent(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return 'N/A'
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`
}

function formatDrawdown(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return 'N/A'
  return `-${Math.abs(number).toFixed(2)}%`
}

function formatMetricValue(value: unknown, unit?: string): string {
  if (unit === '%') return formatPercent(value)
  if (unit === 'D') return `${formatNumber(value, 1)}D`
  const number = numberValue(value)
  if (number === undefined) return String(value ?? 'N/A')
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

function uniqueSymbolOptions(options: SymbolOption[]): SymbolOption[] {
  const byCode = new Map<string, SymbolOption>()
  options.forEach(option => {
    const code = normalizeSymbolCode(option.code)
    if (!code) return
    const key = code.toUpperCase()
    const existing = byCode.get(key)
    if (existing && existing.name) return
    byCode.set(key, { ...option, code })
  })
  return Array.from(byCode.values())
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
  const presetOptions = presetSymbolBaskets.flatMap(basket => basket.codes)
  return uniqueSymbolOptions([...dashboardSymbolOptions(dashboard), ...presetOptions]).slice(0, 24)
}

function symbolOptionMatches(option: SymbolOption, query: string): boolean {
  if (!query) return true
  const haystack = [option.code, option.name, option.group].join(' ').toLowerCase()
  return haystack.includes(query)
}

function presetOptionByCode(code: string): SymbolOption | undefined {
  const key = normalizeSymbolCode(code).toUpperCase()
  if (!key) return undefined
  return presetSymbolBaskets.flatMap(basket => basket.codes).find(option => option.code.toUpperCase() === key)
}

function basketMatches(basket: SymbolBasket, query: string): boolean {
  if (!query) return true
  const haystack = [
    basket.label,
    ...basket.codes.flatMap(item => [item.code, item.name, item.group]),
  ].join(' ').toLowerCase()
  return haystack.includes(query)
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
  if (/traceback|File\s+["'].*\.py["']|^\s*at\s+/i.test(rawMessage)) {
    return locale === 'zh-CN'
      ? '回测服务返回了内部错误。请确认输入的是股票代码，或从已选池勾选后重试。'
      : 'Backtest service returned an internal error. Check the symbol code or pick from the pool.'
  }
  return rawMessage.length > 140 ? `${rawMessage.slice(0, 140)}...` : rawMessage
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
  const body: Record<string, unknown> = { codes, freq, lookback: 999 }
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
  onSelectMarker?: (marker: MarkerData) => void,
) {
  chart.removeOverlay({ groupId: BACKTEST_MARKER_GROUP })
  if (data.length === 0) return
  const dataByTimestamp = new Map(data.map(item => [item.timestamp, item]))
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
  const baseUrl = trimTrailingSlash(signalsWebBaseUrl)
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
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const filledTrades = trades.filter(trade => trade.entry_price !== null && trade.entry_price !== undefined)
  const targetInfo = terminalTarget(result)
  const metrics = terminalMetrics(result)
  const displaySymbol = stringValue(targetInfo.symbol) ?? result?.symbol ?? result?.code ?? code
  const displayName = stringValue(targetInfo.name)
  const displayFreq = stringValue(targetInfo.freq) ?? result?.freq ?? freq
  const dataSourceLabel = backtestDataSourceLabel(result, locale)
  const dataHealthLabel = dataHealthText(result, locale)
  const selectedCodes = useMemo(() => parseCodeList(code), [code])
  const symbolOptions = useMemo(() => symbolOptionsForPicker(dashboard), [dashboard])

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
        setTab('perf')
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
      if (!hadResult) setTab('perf')
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
  }, [baseUrl, batchResult, code, freq, locale, result, signalType, simParams])

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
    if (isMultiMode) return
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
  }, [isMultiMode, locale])

  useEffect(() => {
    if (isMultiMode) return
    const chart = chartRef.current
    if (!chart) return
    chart.removeOverlay({ groupId: BACKTEST_MARKER_GROUP })
    if (klineData.length === 0) {
      chart.clearData()
      return
    }
    chart.applyNewData(klineData)
    createSignalOverlays(chart, klineData, signals, tradeMarkers, handleMarkerSelect)
    chart.scrollToRealTime()
    chart.resize()
  }, [handleMarkerSelect, isMultiMode, klineData, signals, tradeMarkers])

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
                ? `${displaySymbol} · ${numberValue(metrics.signal_count) ?? signals.length}信号 · ${numberValue(metrics.filled_trades) ?? filledTrades.length}笔交易`
                : `${displaySymbol} · ${numberValue(metrics.signal_count) ?? signals.length} signals · ${numberValue(metrics.filled_trades) ?? filledTrades.length} trades`
              }${dataSourceLabel ? ` · ${dataSourceLabel}` : ''}`
              : locale === 'zh-CN'
                ? '从下方选择板块组合或勾选多只标的'
                : 'Enter one symbol for single backtest, multiple symbols for portfolio review')}
        </div>
        <button type="button" style={buttonStyle(false, !result || Boolean(batchResult))} disabled={!result || Boolean(batchResult)} onClick={exportCsv}>
          CSV
        </button>
      </form>

      <SymbolBasketBar
        locale={locale}
        baseUrl={baseUrl}
        selectedCodes={selectedCodes}
        options={symbolOptions}
        onApplyBasket={codes => setCodeList(codes)}
        onToggleCode={toggleSymbolCode}
        onClearCodes={() => {
          setCodeList([])
          setBatchResult(null)
          setResult(null)
        }}
        onRemoveCode={codeToRemove => {
          setCodeList(selectedCodes.filter(item => item.toUpperCase() !== codeToRemove.toUpperCase()))
        }}
      />

      {isMultiMode ? (
        <MultiBacktestReport
          locale={locale}
          terminal={batchResult?.terminal}
          onSelectCode={nextCode => {
            setCode(nextCode)
            setBatchResult(null)
          }}
        />
      ) : (
      <div style={mainGridStyle}>
        <div style={sideStyle}>
          <Panel title={locale === 'zh-CN' ? '模拟参数' : 'Simulation'}>
            <ParamGrid params={simParams} onChange={updateSimParam} />
          </Panel>
          <Panel title={locale === 'zh-CN' ? '日期标签' : 'Date presets'}>
            {datePresets.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {datePresets.slice(0, 12).map(item => (
                  <button
                    key={item.key ?? item.label ?? item.date}
                    type="button"
                    style={buttonStyle(false)}
                    onClick={() => {
                      const chart = chartRef.current
                      const time = numberValue(item.time)
                      if (chart && time) chart.scrollToTimestamp(time * 1000, 300)
                    }}
                  >
                    {String(item.label ?? item.date ?? item.key ?? '').split('—')[0].trim()}
                  </button>
                ))}
              </div>
            ) : (
              <div style={emptyStyle}>{locale === 'zh-CN' ? '运行后显示事件标签。' : 'Run to show event presets.'}</div>
            )}
          </Panel>
          <Panel title={locale === 'zh-CN' ? '回测记录' : 'Backtest records'}>
            <FallbackRows dashboard={dashboard} onOpenRun={onOpenRun} onOpenRecord={onOpenRecord} />
          </Panel>
        </div>

        <div style={chartPanelStyle}>
          <div style={chartHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>{[displayFreq, dataSourceLabel].filter(Boolean).join(' · ')}</div>
              <div style={chartTitleStyle}>{[displaySymbol, displayName].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {dataSourceLabel ? (
                <span style={statusBadgeStyle(isFallbackDataSource(result) ? 'warning' : 'success')}>
                  {dataSourceLabel}
                </span>
              ) : null}
              {(stringValue(targetInfo.freshness) ?? result?.freshness) ? (
                <span style={statusBadgeStyle((stringValue(targetInfo.freshness) ?? result?.freshness) === 'fresh' ? 'success' : 'warning')}>
                  {stringValue(targetInfo.freshness) ?? result?.freshness}
                </span>
              ) : null}
              {(result?.warnings ?? []).slice(0, 2).map(item => (
                <span key={item} style={statusBadgeStyle('warning')}>{item}</span>
              ))}
              <span style={statusBadgeStyle(error ? 'failed' : loading ? 'running' : result ? 'success' : 'open')}>
                {error ? 'error' : loading ? 'running' : result ? 'ready' : 'idle'}
              </span>
            </div>
          </div>
          {dataHealthLabel ? (
            <div style={{ ...mutedStyle, padding: '0 2px', minHeight: 16 }}>
              {dataHealthLabel}
            </div>
          ) : null}
          <MetricStrip result={result} />
          <div style={chartShellStyle}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            {!result || klineData.length === 0 ? (
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
        </div>

        <div style={sideStyle}>
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
                  {item}
                </button>
              ))}
            </div>
          </div>
          {tab === 'perf' ? (
            <Panel title={locale === 'zh-CN' ? '绩效总览' : 'Performance'}>
              <KpiPanel result={result} />
            </Panel>
          ) : tab === 'trades' ? (
            <Panel title={locale === 'zh-CN' ? '交易明细' : 'Trades'} meta={String(filledTrades.length)}>
              <TradeTable
                trades={trades}
                selectedIndex={selectedTradeIndex}
                onSelect={index => {
                  setSelectedTradeIndex(index)
                  setTab('trades')
                }}
              />
            </Panel>
          ) : tab === 'signals' ? (
            <Panel title={locale === 'zh-CN' ? '信号详情' : 'Signals'} meta={String(signals.length)}>
              <SignalTable
                signals={signals}
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
        </div>
      </div>
      )}
    </div>
  )
}

function SymbolBasketBar({
  locale,
  baseUrl,
  selectedCodes,
  options,
  onApplyBasket,
  onToggleCode,
  onClearCodes,
  onRemoveCode,
}: {
  locale: LongclawLocale
  baseUrl: string
  selectedCodes: string[]
  options: SymbolOption[]
  onApplyBasket: (codes: string[]) => void
  onToggleCode: (code: string) => void
  onClearCodes: () => void
  onRemoveCode: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const [boardOptions, setBoardOptions] = useState<SymbolOption[]>([])
  const [boardLabel, setBoardLabel] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupMessage, setLookupMessage] = useState('')
  const selectedSet = new Set(selectedCodes.map(item => item.toUpperCase()))
  const mergedOptions = uniqueSymbolOptions([...boardOptions, ...options])
  const optionByCode = new Map(mergedOptions.map(option => [symbolOptionKey(option), option]))
  const normalizedQuery = query.trim().toLowerCase()
  const filteredBaskets = presetSymbolBaskets.filter(basket => basketMatches(basket, normalizedQuery))
  const availableOptions = mergedOptions
    .filter(option => !selectedSet.has(option.code.toUpperCase()))
    .filter(option => symbolOptionMatches(option, normalizedQuery))
    .slice(0, 40)
  const dynamicCodes = boardOptions.map(option => option.code)
  const lookupBoard = useCallback(async () => {
    const board = query.trim()
    if (!board) return
    setLookupLoading(true)
    setLookupMessage('')
    try {
      const data = await fetchJson<BoardStocksResponse>(
        baseUrl,
        `/api/cluster/stocks?board=${encodeURIComponent(board)}`,
        120_000,
      )
      const rows = Array.isArray(data.stocks) ? data.stocks : []
      const nextOptions = uniqueSymbolOptions(rows.map(row => {
        const code = normalizeSymbolCode(row.code ?? row.symbol ?? '')
        const preset = presetOptionByCode(code)
        const rawName = stringValue(row.name)
        return {
          code,
          name: rawName && rawName !== code ? rawName : preset?.name ?? code,
          group: stringValue(data.board) ?? board,
        }
      }).filter(option => option.code))
      setBoardLabel(stringValue(data.board) ?? board)
      setBoardOptions(nextOptions.slice(0, 60))
      if (nextOptions.length === 0) {
        setLookupMessage(data.error || (locale === 'zh-CN' ? '没有找到成分股，换一个板块名试试。' : 'No constituents found. Try another board name.'))
      } else {
        setLookupMessage(locale === 'zh-CN'
          ? `${stringValue(data.board) ?? board} · ${numberValue(data.total) ?? nextOptions.length}只`
          : `${stringValue(data.board) ?? board} · ${numberValue(data.total) ?? nextOptions.length} symbols`)
      }
    } catch (rawError) {
      const apiError = rawError as ApiError
      setBoardOptions([])
      setBoardLabel('')
      setLookupMessage(compactApiError(apiError, locale, locale === 'zh-CN' ? '板块搜索失败。' : 'Board lookup failed.'))
    } finally {
      setLookupLoading(false)
    }
  }, [baseUrl, locale, query])
  return (
    <div style={basketBarStyle}>
      <div style={labelStyle}>{locale === 'zh-CN' ? '搜索' : 'Search'}</div>
      <div style={basketSearchStyle}>
        <input
          aria-label={locale === 'zh-CN' ? '搜索板块或标的' : 'Search board or symbol'}
          name="backtest-board-search"
          autoComplete="off"
          spellCheck={false}
          style={{ ...inputStyle, height: 28, fontFamily: fontStacks.ui }}
          value={query}
          placeholder={locale === 'zh-CN' ? '半导体设备 / 光模块 / 代码 / 名称…' : 'Board, concept, code, or name…'}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void lookupBoard()
            }
          }}
        />
        <button type="button" style={buttonStyle(false, lookupLoading || !query.trim())} disabled={lookupLoading || !query.trim()} onClick={() => void lookupBoard()}>
          {lookupLoading ? (locale === 'zh-CN' ? '搜索中' : 'Loading') : (locale === 'zh-CN' ? '搜板块' : 'Board')}
        </button>
        <button type="button" style={buttonStyle(false, dynamicCodes.length === 0)} disabled={dynamicCodes.length === 0} onClick={() => onApplyBasket([...selectedCodes, ...dynamicCodes])}>
          {locale === 'zh-CN' ? '加入全部' : 'Add all'}
        </button>
        <button type="button" style={buttonStyle(false, dynamicCodes.length === 0)} disabled={dynamicCodes.length === 0} onClick={() => onApplyBasket(dynamicCodes)}>
          {locale === 'zh-CN' ? '替换已选' : 'Replace'}
        </button>
        <div style={{ ...mutedStyle, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lookupMessage}>
          {lookupMessage || (boardLabel ? `${boardLabel} · ${boardOptions.length}` : '')}
        </div>
      </div>

      <div style={labelStyle}>{locale === 'zh-CN' ? '组合' : 'Baskets'}</div>
      <div style={chipRowStyle}>
        {filteredBaskets.length ? filteredBaskets.map(basket => {
          const basketCodes = basket.codes.map(item => item.code)
          const active = sameCodeSet(selectedCodes, basketCodes)
          return (
            <button
              key={basket.id}
              type="button"
              aria-pressed={active}
              style={buttonStyle(active)}
              onClick={() => onApplyBasket(basketCodes)}
            >
              {basket.label}
            </button>
          )
        }) : <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>{locale === 'zh-CN' ? '没有匹配的本地组合，可直接搜板块。' : 'No local basket matches. Search a board directly.'}</div>}
      </div>
      <div style={labelStyle}>{locale === 'zh-CN' ? '已选池' : 'Selected'}</div>
      <div style={chipRowStyle}>
        {selectedCodes.length ? selectedCodes.map(item => {
          const option = optionByCode.get(item.toUpperCase())
          return (
            <button
              key={`selected-${item}`}
              type="button"
              style={buttonStyle(true)}
              onClick={() => onRemoveCode(item)}
              title={locale === 'zh-CN' ? '点击移除' : 'Click to remove'}
            >
              {[item, option?.name].filter(Boolean).join(' ')} ×
            </button>
          )
        }) : (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {locale === 'zh-CN' ? '选择一个板块组合，或勾选右侧标的。' : 'Pick a basket or toggle symbols.'}
          </div>
        )}
        <button type="button" style={buttonStyle(false, selectedCodes.length === 0)} disabled={selectedCodes.length === 0} onClick={onClearCodes}>
          {locale === 'zh-CN' ? '清空' : 'Clear'}
        </button>
      </div>
      <div style={labelStyle}>{locale === 'zh-CN' ? '候选' : 'Candidates'}</div>
      <div style={chipRowStyle}>
        {availableOptions.map(option => {
          const active = selectedSet.has(option.code.toUpperCase())
          return (
            <button
              key={`${option.group}-${option.code}`}
              type="button"
              aria-pressed={active}
              style={buttonStyle(active)}
              onClick={() => onToggleCode(option.code)}
              title={option.group}
            >
              {[option.code, option.name].filter(Boolean).join(' ')}
            </button>
          )
        })}
        {availableOptions.length === 0 ? (
          <div style={{ ...mutedStyle, whiteSpace: 'nowrap' }}>
            {locale === 'zh-CN' ? '没有更多候选。可搜索板块或清空已选池。' : 'No more candidates. Search a board or clear selected symbols.'}
          </div>
        ) : null}
      </div>
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
    { label: 'Symbols', value: rankingRows.length, tone: 'neutral' },
    { label: 'Signals', value: formatNumber(metrics.signal_count, 0), tone: 'neutral' },
    { label: 'Trades', value: formatNumber(metrics.filled_trades, 0), tone: 'neutral' },
    { label: 'WinRate', value: formatPercent(metrics.win_rate), tone: (numberValue(metrics.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: 'Avg Ret', value: formatPercent(metrics.total_return_pct), tone: (numberValue(metrics.total_return_pct) ?? 0) >= 0 ? 'up' : 'down' },
    { label: '5D Range', value: formatPercent(metrics.median_5d_high_low_pct), tone: 'warning' },
    { label: 'Avg DD', value: formatDrawdown(metrics.max_drawdown_pct), tone: 'down' },
  ]
  return (
    <div ref={reportRef} style={multiReportStyle(density)}>
      <div style={multiHeaderStyle(density)}>
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>{locale === 'zh-CN' ? '多标的复盘' : 'Multi-symbol review'}</div>
          <div style={chartTitleStyle}>{String(target.name ?? 'Signals Batch')}</div>
          <div style={mutedStyle}>
            {[target.freq, target.as_of ? `${locale === 'zh-CN' ? '截至' : 'as of'} ${target.as_of}` : '', target.freshness].filter(Boolean).join(' · ')}
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
  const fullHeaders = [
    ['signal_type', '信号'],
    ['symbol_count', '标的'],
    ['signal_count', '信号数'],
    ['evaluated_count', '已评估'],
    ['trade_count', '成交'],
    ['win_rate', '信号胜率'],
    ['avg_t5_pct', 'T+5'],
    ['avg_t10_pct', 'T+10'],
    ['avg_mfe_pct', 'MFE'],
    ['avg_mae_pct', 'MAE'],
    ['avg_trade_return_pct', '成交均利'],
    ['best_symbol', '最佳标的'],
  ] as const
  const compactHeaders = fullHeaders.filter(([key]) => [
    'signal_type',
    'signal_count',
    'trade_count',
    'win_rate',
    'avg_t10_pct',
    'avg_mfe_pct',
    'avg_mae_pct',
    'best_symbol',
  ].includes(key))
  const headers = density === 'compact' ? compactHeaders : fullHeaders
  return (
    <div style={reportTableWrapStyle('overview', density)}>
      <table style={reportTableStyleFor('overview', density)}>
        <thead>
          <tr style={{ color: terminalTheme.mutedStrong, textAlign: 'left' }}>
            {headers.map(([key, label]) => (
              <th key={key} style={{ padding: 7, borderBottom: `1px solid ${terminalTheme.border}`, whiteSpace: 'nowrap' }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${String(row.signal_type ?? index)}-${index}`} style={{ borderTop: `1px solid ${terminalTheme.border}` }}>
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
            {String(item.name ?? item.code ?? 'Symbol')}
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
            <div style={chartTitleStyle}>{String(item.name ?? item.code ?? 'Symbol')}</div>
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
              {String(item.unit) === '%' ? formatPercent(item.value) : String(item.value ?? 'N/A')}
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
        {text || 'N/A'}
      </div>
    </div>
  )
}

function formatReportCell(key: string, value: unknown): string {
  if (key.includes('pct') || key.includes('return') || key.includes('drawdown') || key.includes('ratio')) return formatPercent(value)
  if (key === 'rank' || key === 'bar_count' || key.endsWith('_count') || key === 'trade_count' || key === 'signal_count') return formatNumber(value, 0)
  if (key === 'sharpe') return formatNumber(value, 2)
  return String(value ?? 'N/A')
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

function MetricStrip({ result }: { result: BacktestResult | null }) {
  const kpi = result?.kpi ?? {}
  const simKpi = result?.sim_kpi ?? {}
  const metrics = terminalMetrics(result)
  const pnlValue = numberValue(metrics.total_return_pct ?? simKpi.total_return_pct)
  const items = [
    { label: 'PnL', value: formatPercent(metrics.total_return_pct ?? simKpi.total_return_pct), tone: (pnlValue ?? 0) >= 0 ? 'up' : 'down' },
    { label: 'DD', value: formatDrawdown(metrics.max_drawdown_pct ?? simKpi.max_drawdown_pct), tone: 'down' },
    { label: 'WinRate', value: formatPercent(metrics.win_rate ?? simKpi.win_rate ?? kpi.win_rate), tone: (numberValue(metrics.win_rate ?? simKpi.win_rate ?? kpi.win_rate) ?? 0) >= 50 ? 'up' : 'down' },
    { label: 'Trades', value: formatNumber(metrics.filled_trades ?? simKpi.filled_trades, 0), tone: 'neutral' },
    { label: 'Sharpe', value: formatNumber(metrics.sharpe ?? simKpi.sharpe, 2), tone: (numberValue(metrics.sharpe ?? simKpi.sharpe) ?? 0) >= 1 ? 'up' : 'neutral' },
    { label: 'Excess', value: formatPercent(metrics.excess_return_pct), tone: (numberValue(metrics.excess_return_pct) ?? 0) >= 0 ? 'up' : 'down' },
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
            <div style={{ color: toneColor(tone), fontWeight: 800 }}>{String(value ?? 'N/A')}</div>
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
                  <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{signal.type ?? signal.group ?? 'Signal'}</div>
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
  onSelect: (index: number) => void
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
              onClick={() => onSelect(sourceIndex)}
            >
              <td style={{ padding: 7 }}>
                <div style={{ color: terminalTheme.textStrong, fontWeight: 700 }}>{trade.signal_type ?? 'Signal'}</div>
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
        ].filter(Boolean).join(' / ') || 'N/A',
        tone: numberValue(item.pct) !== undefined && (numberValue(item.pct) ?? 0) < 0 ? 'down' : 'up',
      }))
    : [{ label: '风控线', value: '未启用' }]
  const healthRows = [
    { label: '数据源', value: dataHealth.data_source_detail ?? dataHealth.data_source ?? 'N/A' },
    { label: '新鲜度', value: dataHealth.freshness ?? 'N/A' },
    { label: '截至', value: dataHealth.as_of ?? 'N/A' },
    { label: 'K线', value: dataHealth.bar_count ?? 'N/A' },
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
  onOpenRun,
  onOpenRecord,
}: {
  locale: LongclawLocale
  dashboard: BacktestDashboard
  onOpenRun: (run: LongclawRun) => Promise<void>
  onOpenRecord: (title: string, record: Record<string, unknown>) => void
}) {
  return (
    <div style={{ ...mainGridStyle, gridTemplateColumns: '1fr' }}>
      <Panel title={locale === 'zh-CN' ? '回测记录' : 'Backtest records'}>
        <FallbackRows dashboard={dashboard} onOpenRun={onOpenRun} onOpenRecord={onOpenRecord} />
      </Panel>
    </div>
  )
}
