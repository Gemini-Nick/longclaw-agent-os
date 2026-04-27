import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dispose,
  init,
  IndicatorSeries,
  registerIndicator,
  registerOverlay,
  type Chart,
  type DeepPartial,
  type IndicatorStyle,
  type KLineData,
  type OverlayCreateFiguresCallbackParams,
  type Styles,
} from 'klinecharts'

import type { SignalsDashboard } from '../../../../src/services/longclawControlPlane/models.js'
import { fontStacks, statusBadgeStyle, tradingDeskTheme } from '../designSystem.js'
import { type LongclawLocale, humanizeTokenLocale, localizeSystemText } from '../i18n.js'
import { observedFetchJson, recordObservationEvent } from '../observation.js'

type StrategyDashboard = Pick<
  SignalsDashboard,
  | 'buy_candidates'
  | 'sell_warnings'
  | 'chart_context'
  | 'review_runs'
  | 'connector_health'
  | 'deep_links'
  | 'daily_brief'
  | 'decision_queue'
  | 'strategy_kpis'
  | 'source_confidence'
>

type StrategyChartTerminalProps = {
  locale: LongclawLocale
  dashboard: StrategyDashboard
  signalsWebBaseUrl?: string
  onOpenRecord: (title: string, record: Record<string, unknown>) => void
}

type WorkbenchSession = {
  ready?: boolean
  running?: boolean
  label?: string
  mode?: string
  a_live?: boolean
  hk_live?: boolean
  us_live?: boolean
  data_as_of?: string
  error?: string
}

type WorkbenchShell = {
  session?: WorkbenchSession
  indices?: Record<string, unknown>[]
  buy_candidates?: Record<string, unknown>[]
  watchlist?: Record<string, unknown>[]
  watchlist_groups?: {
    macro_indices?: Record<string, unknown>[]
    sector_boards?: Record<string, unknown>[]
    focus_stocks?: Record<string, unknown>[]
  }
  watchlist_range_columns?: Record<string, unknown>[]
  cluster_summary?: Record<string, unknown>
  sync_lanes?: Record<string, unknown>
  decision_queue?: Record<string, unknown>[]
  strategy_kpis?: Record<string, unknown>[]
  source_confidence?: Record<string, unknown>[]
  default_target?: {
    kind?: string
    label?: string
    freq?: string
  }
  notices?: string[]
}

type WorkbenchTarget = {
  kind?: string
  label?: string
  symbol?: string
  requested_freq?: string
  effective_freq?: string
  available_freqs?: string[]
  carrier_kind?: string
  carrier_symbol?: string
}

type StrategySignal = {
  dt?: number
  time?: number
  timestamp?: number
  date_str?: string
  type?: string
  price?: number
  confidence?: number
  freq?: string
  details?: string
}

type StrategyKeyLevel = {
  name?: string
  value?: number
  position?: string
  distance_pct?: number | null
  direction?: string
  role?: string
  timeframe?: string
}

type WorkbenchSymbolData = {
  target?: WorkbenchTarget
  chart?: Record<string, unknown>
  summary?: Record<string, unknown>
  signals?: StrategySignal[]
  plan?: Record<string, unknown> | null
  review?: Record<string, unknown>
  trade?: Record<string, unknown>
  analysis_target?: string
  candidate_stocks?: Record<string, unknown>[]
  stock_analysis?: Record<string, unknown>
}

type ChartTarget = {
  label: string
  kind: string
  freq: string
}

type FrequencyOption = {
  value: string
  label: string
}

type WatchlistRangeColumn = {
  key: string
  label: string
  aliases?: string[]
}

type WatchlistSignalBadge = {
  label: string
  side: 'buy' | 'sell' | 'neutral'
}

type WatchlistRow = {
  id: string
  kind: string
  label: string
  name: string
  code: string
  typeLabel: string
  latest: string
  dayChange: string
  rangeValues: string[]
  signal: string
  signalBadges: WatchlistSignalBadge[]
  tags: string[]
  lane: string
  freshness: string
  traderAction: string
  invalidatesWhen: string
  explanation: string
  targetKind: string
  targetLabel: string
  targetFreq: string
  raw: Record<string, unknown>
}

type WatchlistTabKey = 'macro_indices' | 'sector_boards' | 'focus_stocks'

type ApiError = Error & {
  status?: number
  payload?: Record<string, unknown>
}

type SignalOverlayData = {
  label: string
  side: 'buy' | 'sell'
  color: string
}

type DivergenceOverlayData = {
  label: string
  side: 'top' | 'bottom'
  color: string
  compact?: boolean
}

type MacdPoint = {
  timestamp: number
  dif?: number
  dea?: number
  histogram?: number
}

type PivotPoint = {
  index: number
  timestamp: number
  price: number
  dif: number
  histogram: number
}

type MacdDivergenceSignal = {
  id: string
  type: 'bearish' | 'bullish'
  timestamp: number
  price: number
  previousTimestamp: number
  previousPrice: number
  macdValue: number
  previousMacdValue: number
  confidence: number
  metric: 'dif' | 'histogram'
}

const FREQ_OPTIONS: FrequencyOption[] = [
  { value: '5min', label: '5m' },
  { value: '15min', label: '15m' },
  { value: '30min', label: '30m' },
  { value: 'daily', label: '日' },
  { value: 'weekly', label: '周' },
]
const WATCHLIST_RANGE_COLUMNS: WatchlistRangeColumn[] = [
  { key: '5d', label: '5日', aliases: ['5d', '5日', 'week', '1w', '1week', 'weekly'] },
  { key: '20d', label: '20日', aliases: ['20d', '20日', 'month', '1m', '1month', 'monthly'] },
  { key: '60d', label: '60日', aliases: ['60d', '60日', 'quarter', '3m', '3month', 'quarterly'] },
]
const SIGNAL_OVERLAY_NAME = 'longclawSignalMarker'
const SIGNAL_OVERLAY_GROUP = 'longclaw-signals'
const DIVERGENCE_OVERLAY_NAME = 'longclawMacdDivergenceMarker'
const DIVERGENCE_OVERLAY_GROUP = 'longclaw-macd-divergence'
const LEVEL_OVERLAY_GROUP = 'longclaw-levels'
const CANDLE_PANE_ID = 'candle_pane'
const MACD_PANE_ID = 'macd_pane'
const MACD_ZERO_INDICATOR_NAME = 'LONGCLAW_MACD_ZERO'
const MACD_PARAMS = [12, 26, 9]
const MA_COLORS = [
  tradingDeskTheme.chart.orange,
  tradingDeskTheme.chart.line,
  tradingDeskTheme.chart.violet,
  tradingDeskTheme.market.down,
  tradingDeskTheme.chart.gold,
  tradingDeskTheme.colors.textStrong,
]
const MACD_LINE_COLORS = [tradingDeskTheme.chart.line, tradingDeskTheme.chart.orange]

let signalOverlayRegistered = false
let divergenceOverlayRegistered = false
let macdZeroIndicatorRegistered = false
const terminalTheme = tradingDeskTheme.colors

function solidLineStyle(color: string, size = 1) {
  return { color, size, style: 'solid' as const, dashedValue: [0, 0] }
}

const terminalRootStyle: React.CSSProperties = {
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  background: terminalTheme.root,
  color: terminalTheme.text,
  fontFamily: fontStacks.ui,
}

const terminalTopBarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 6,
  padding: '3px 7px',
  borderBottom: `1px solid ${terminalTheme.grid}`,
  background: terminalTheme.panel,
}

const searchFormStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) auto',
  gap: 6,
  minWidth: 0,
}

const searchInputStyle: React.CSSProperties = {
  height: 28,
  minWidth: 0,
  border: `1px solid ${terminalTheme.borderStrong}`,
  borderRadius: 5,
  background: terminalTheme.root,
  color: terminalTheme.textStrong,
  padding: '0 8px',
  fontFamily: fontStacks.mono,
  fontSize: 13,
  outline: 'none',
}

const terminalGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(420px, 460px) minmax(0, 1fr) minmax(218px, 276px)',
  gridTemplateRows: 'minmax(0, 1fr)',
  gap: 1,
  alignItems: 'stretch',
  minHeight: 0,
  overflow: 'hidden',
}

const fallbackGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 1,
  minHeight: 0,
  overflow: 'auto',
  background: terminalTheme.grid,
}

const terminalSideStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  background: terminalTheme.grid,
}

const terminalPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  minHeight: 0,
  flexShrink: 0,
  padding: 6,
  border: 'none',
  borderRadius: 0,
  background: terminalTheme.panel,
  color: terminalTheme.text,
  overflow: 'hidden',
}

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
}

const panelTitleStyle: React.CSSProperties = {
  color: terminalTheme.textStrong,
  fontSize: 11,
  fontWeight: 700,
}

const mutedTextStyle: React.CSSProperties = {
  color: terminalTheme.muted,
  fontSize: 12,
  lineHeight: 1.35,
}

const monoTextStyle: React.CSSProperties = {
  color: terminalTheme.mono,
  fontFamily: fontStacks.mono,
  fontSize: 12,
  lineHeight: 1.35,
}

const eyebrowDarkStyle: React.CSSProperties = {
  color: terminalTheme.mutedStrong,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const rowTitleStyle: React.CSSProperties = {
  color: terminalTheme.textStrong,
  fontWeight: 700,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const dataRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelSoft,
  padding: '4px 6px',
  minWidth: 0,
}

const emptyStateDarkStyle: React.CSSProperties = {
  border: `1px dashed ${terminalTheme.borderMuted}`,
  borderRadius: 5,
  background: terminalTheme.empty,
  color: terminalTheme.muted,
  padding: '12px 10px',
  textAlign: 'center',
  fontSize: 13,
}

const noticeDarkStyle: React.CSSProperties = {
  border: `1px solid ${tradingDeskTheme.alpha.infoBorder}`,
  background: tradingDeskTheme.alpha.infoSurface,
  color: terminalTheme.infoText,
  padding: '5px 8px',
  fontSize: 12,
}

const warningDarkStyle: React.CSSProperties = {
  ...noticeDarkStyle,
  border: `1px solid ${tradingDeskTheme.alpha.accentBorder}`,
  background: tradingDeskTheme.alpha.accentSurface,
  color: terminalTheme.accentText,
}

const errorDarkStyle: React.CSSProperties = {
  ...noticeDarkStyle,
  border: `1px solid ${tradingDeskTheme.alpha.errorBorder}`,
  background: tradingDeskTheme.alpha.errorSurface,
  color: terminalTheme.errorText,
}

const compactListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
}

const targetButtonStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  padding: '5px 7px',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  background: terminalTheme.panelSoft,
  color: terminalTheme.text,
  fontFamily: fontStacks.ui,
}

const watchlistTableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflowX: 'auto',
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 4,
  background: terminalTheme.panelInset,
}

const watchlistGridRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(126px, 1.35fr) 58px 52px 76px repeat(4, 56px)',
  minWidth: 0,
}

const watchlistButtonRowStyle: React.CSSProperties = {
  ...watchlistGridRowStyle,
  width: '100%',
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
}

const watchlistButtonActiveRowStyle: React.CSSProperties = {
  ...watchlistButtonRowStyle,
  background: terminalTheme.accentSoft,
}

const watchlistHeaderCellStyle: React.CSSProperties = {
  padding: '5px 4px',
  borderBottom: `1px solid ${terminalTheme.borderStrong}`,
  color: terminalTheme.mutedStrong,
  fontSize: 10,
  fontWeight: 800,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const watchlistNameHeaderCellStyle: React.CSSProperties = {
  ...watchlistHeaderCellStyle,
  textAlign: 'left',
  paddingLeft: 6,
}

const watchlistCellStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '5px 4px',
  borderBottom: `1px solid ${terminalTheme.borderMuted}`,
  color: terminalTheme.text,
  fontFamily: fontStacks.mono,
  fontSize: 11,
  lineHeight: 1.2,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const watchlistNameCellStyle: React.CSSProperties = {
  ...watchlistCellStyle,
  textAlign: 'left',
  fontFamily: fontStacks.ui,
  paddingLeft: 6,
}

const watchlistNameStyle: React.CSSProperties = {
  color: terminalTheme.textStrong,
  fontSize: 12,
  fontWeight: 750,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const watchlistSubStyle: React.CSSProperties = {
  color: terminalTheme.muted,
  fontFamily: fontStacks.mono,
  fontSize: 10,
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const indicatorLegendStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 9px',
  alignItems: 'center',
  color: terminalTheme.muted,
  fontFamily: fontStacks.mono,
  fontSize: 10,
  lineHeight: 1.2,
}

const indicatorLegendItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
}

const watchlistTabsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 4,
}

const watchlistTabButtonStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.control,
  color: terminalTheme.controlText,
  height: 28,
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const watchlistTabButtonActiveStyle: React.CSSProperties = {
  ...watchlistTabButtonStyle,
  border: `1px solid ${terminalTheme.accent}`,
  background: terminalTheme.accentSoft,
  color: terminalTheme.accentText,
}

const signalBadgeRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 3,
  justifyContent: 'flex-end',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
}

const miniSignalBadgeStyle: React.CSSProperties = {
  border: `1px solid ${tradingDeskTheme.alpha.infoBorder}`,
  borderRadius: 3,
  background: tradingDeskTheme.alpha.infoSurface,
  color: terminalTheme.infoText,
  padding: '1px 3px',
  fontFamily: fontStacks.mono,
  fontSize: 9,
  lineHeight: 1.2,
  fontWeight: 800,
}

const miniSellSignalBadgeStyle: React.CSSProperties = {
  ...miniSignalBadgeStyle,
  border: `1px solid ${tradingDeskTheme.alpha.errorBorder}`,
  background: tradingDeskTheme.alpha.errorSurface,
  color: tradingDeskTheme.market.down,
}

const miniNeutralSignalBadgeStyle: React.CSSProperties = {
  ...miniSignalBadgeStyle,
  border: `1px solid ${terminalTheme.borderStrong}`,
  background: terminalTheme.surfaceSoft,
  color: terminalTheme.textMuted,
}

const indicatorLegendSwatchStyle: React.CSSProperties = {
  width: 14,
  height: 2,
  borderRadius: 1,
  background: terminalTheme.muted,
}

const chartStageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  minHeight: 0,
  padding: 6,
  border: 'none',
  borderRadius: 0,
  background: terminalTheme.root,
  overflow: 'hidden',
}

const chartHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
}

const chartTitleStyle: React.CSSProperties = {
  color: terminalTheme.textStrong,
  fontSize: 17,
  lineHeight: 1.1,
  fontWeight: 800,
}

const chartMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
}

const chartHeaderRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'flex-end',
  minWidth: 0,
}

const headerMetricsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(62px, 78px))',
  gap: 4,
}

const headerMetricStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 4,
  background: terminalTheme.panelInset,
  padding: '4px 6px',
  minWidth: 0,
}

const chartConclusionStyle: React.CSSProperties = {
  ...noticeDarkStyle,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const chartCanvasShellStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: 0,
  flex: 1,
  overflow: 'hidden',
  border: `1px solid ${terminalTheme.chartBorder}`,
  borderRadius: 3,
  background: terminalTheme.chartPanel,
}

const chartCanvasStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 0,
}

const chartOverlayMessageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  color: terminalTheme.text,
  textAlign: 'center',
  background: 'rgba(8, 11, 18, 0.88)',
  zIndex: 2,
}

const signalRowStyle: React.CSSProperties = {
  display: 'flex',
  border: `1px solid ${terminalTheme.border}`,
  borderRadius: 5,
  background: terminalTheme.panelSoft,
  padding: '5px 7px',
  alignItems: 'center',
}

const quickChipStyle: React.CSSProperties = {
  border: `1px solid ${terminalTheme.borderStrong}`,
  borderRadius: 5,
  background: terminalTheme.control,
  color: terminalTheme.controlText,
  padding: '5px 7px',
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
  fontSize: 13,
  fontWeight: 600,
  justifyContent: 'center',
  minHeight: 26,
}

const quickChipActiveStyle: React.CSSProperties = {
  ...quickChipStyle,
  border: `1px solid ${terminalTheme.accent}`,
  background: terminalTheme.accentSoft,
  color: terminalTheme.accentText,
  justifyContent: 'center',
  minHeight: 26,
}

function terminalButtonStyle(active = false, disabled = false): React.CSSProperties {
  return {
    height: 28,
    border: `1px solid ${active ? terminalTheme.accent : terminalTheme.borderStrong}`,
    borderRadius: 5,
    background: active ? terminalTheme.accentSoft : terminalTheme.control,
    color: active ? terminalTheme.accentText : terminalTheme.controlText,
    padding: '0 9px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontFamily: fontStacks.ui,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }
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

function compactText(value: unknown, fallback = ''): string {
  return stringValue(value) ?? (typeof value === 'number' ? String(value) : fallback)
}

function trimTrailingSlash(value?: string): string {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

function urlFromDashboard(dashboard: StrategyDashboard): string {
  const terminalLink = dashboard.deep_links.find(link => link.link_id === 'signals-terminal')
  return trimTrailingSlash(terminalLink?.url)
}

function normalizeTimestamp(value: unknown): number | undefined {
  const raw = numberValue(value)
  if (!raw || raw <= 0) return undefined
  return raw < 10_000_000_000 ? raw * 1000 : raw
}

function isBuySignal(value?: string): boolean {
  const normalized = String(value ?? '').toLowerCase()
  return (
    normalized.includes('buy') ||
    normalized.includes('long') ||
    normalized.includes('entry') ||
    normalized.includes('买')
  )
}

function isSellSignal(value?: string): boolean {
  const normalized = String(value ?? '').toLowerCase()
  return (
    normalized.includes('sell') ||
    normalized.includes('short') ||
    normalized.includes('exit') ||
    normalized.includes('卖')
  )
}

function signalTone(value?: string): string {
  if (isSellSignal(value)) return 'warning'
  if (isBuySignal(value)) return 'success'
  return 'open'
}

function marketLabel(session?: WorkbenchSession, locale: LongclawLocale = 'zh-CN'): string {
  if (!session) return locale === 'zh-CN' ? '未连接' : 'Disconnected'
  if (session.a_live || session.hk_live || session.us_live) {
    const liveMarkets = [
      session.a_live ? 'A' : '',
      session.hk_live ? 'H' : '',
      session.us_live ? 'US' : '',
    ].filter(Boolean)
    return `${liveMarkets.join('+')} live`
  }
  return session.ready
    ? (locale === 'zh-CN' ? '已就绪' : 'Ready')
    : (session.running ? (locale === 'zh-CN' ? '启动中' : 'Booting') : (locale === 'zh-CN' ? '等待' : 'Idle'))
}

function shouldUseLiveRefresh(session?: WorkbenchSession): boolean {
  return Boolean(session?.a_live || session?.hk_live || session?.us_live)
}

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  signal: AbortSignal | undefined,
  source: string,
  action?: string,
): Promise<T> {
  return observedFetchJson<T>(baseUrl, path, {
    signal,
    source,
    action,
    timeoutMs: 45_000,
  })
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
        noChangeColor: tradingDeskTheme.market.flat,
        upBorderColor: tradingDeskTheme.market.up,
        downBorderColor: tradingDeskTheme.market.down,
        noChangeBorderColor: tradingDeskTheme.market.flat,
        upWickColor: tradingDeskTheme.market.up,
        downWickColor: tradingDeskTheme.market.down,
        noChangeWickColor: tradingDeskTheme.market.flat,
      },
      tooltip: {
        text: {
          color: terminalTheme.text,
          size: 12,
          family: 'IBM Plex Mono, Menlo, monospace',
        },
      },
      priceMark: {
        last: {
          line: { show: true, ...solidLineStyle(tradingDeskTheme.chart.line, 1) },
          text: {
            show: true,
            color: terminalTheme.white,
            backgroundColor: tradingDeskTheme.chart.line,
            size: 11,
            borderRadius: 4,
          },
        },
      },
    },
    indicator: {
      lines: MA_COLORS.map(color => solidLineStyle(color, 1)),
      bars: [
        {
          upColor: tradingDeskTheme.market.up,
          downColor: tradingDeskTheme.market.down,
          noChangeColor: tradingDeskTheme.market.flat,
        },
      ],
      tooltip: {
        text: {
          color: terminalTheme.text,
          size: 11,
          family: 'IBM Plex Mono, Menlo, monospace',
        },
      },
    },
    xAxis: {
      axisLine: { color: tradingDeskTheme.alpha.textBorderStrong },
      tickText: { color: tradingDeskTheme.market.flat, size: 11 },
    },
    yAxis: {
      axisLine: { color: tradingDeskTheme.alpha.textBorderStrong },
      tickText: { color: tradingDeskTheme.market.flat, size: 11 },
    },
    crosshair: {
      horizontal: {
        line: solidLineStyle(tradingDeskTheme.market.flat, 1),
        text: { color: terminalTheme.white, backgroundColor: terminalTheme.crosshair },
      },
      vertical: {
        line: solidLineStyle(tradingDeskTheme.market.flat, 1),
        text: { color: terminalTheme.white, backgroundColor: terminalTheme.crosshair },
      },
    },
    separator: {
      color: tradingDeskTheme.chart.separator,
      size: 1,
    },
  }
}

function maPeriodsForFreq(freq?: string): number[] {
  const normalized = String(freq ?? '').toLowerCase()
  if (normalized.includes('week') || normalized === 'w' || normalized === '1w') {
    return [5, 10, 20, 50]
  }
  if (normalized.includes('day') || normalized === 'd' || normalized === '1d' || normalized === 'daily') {
    return [5, 10, 20, 60]
  }
  return [5, 10, 20, 60]
}

function maIndicatorStyles(periods: number[]): DeepPartial<IndicatorStyle> {
  return {
    lines: periods.map((period, index) => ({
      ...solidLineStyle(MA_COLORS[index % MA_COLORS.length], period >= 100 ? 1 : 1.2),
    })),
  }
}

function macdIndicatorStyles(): DeepPartial<IndicatorStyle> {
  return {
    lines: MACD_LINE_COLORS.map(color => solidLineStyle(color, 1.2)),
    bars: [
      {
        upColor: tradingDeskTheme.market.up,
        downColor: tradingDeskTheme.market.down,
        noChangeColor: tradingDeskTheme.market.flat,
      },
    ],
  }
}

function macdZeroIndicatorStyles(): DeepPartial<IndicatorStyle> {
  return {
    lines: [
      {
        color: tradingDeskTheme.alpha.textBorderStrong,
        size: 1,
        style: 'dashed',
        dashedValue: [4, 4],
      },
    ],
    tooltip: { showName: false, showParams: false },
  }
}

function ensureMacdZeroIndicator() {
  if (macdZeroIndicatorRegistered) return
  registerIndicator<{ zero: number }>({
    name: MACD_ZERO_INDICATOR_NAME,
    shortName: 'MACD 0',
    precision: 2,
    calcParams: [],
    shouldOhlc: false,
    shouldFormatBigNumber: false,
    series: IndicatorSeries.Normal,
    figures: [{ key: 'zero', title: '0轴: ', type: 'line' }],
    calc: dataList => dataList.map(() => ({ zero: 0 })),
  })
  macdZeroIndicatorRegistered = true
}

function applyMovingAverageIndicator(chart: Chart, freq?: string) {
  const periods = maPeriodsForFreq(freq)
  chart.overrideIndicator(
    {
      name: 'MA',
      calcParams: periods,
      styles: maIndicatorStyles(periods),
    },
    CANDLE_PANE_ID,
  )
}

function createChartIndicators(chart: Chart, freq?: string) {
  const periods = maPeriodsForFreq(freq)
  chart.createIndicator(
    {
      name: 'MA',
      calcParams: periods,
      styles: maIndicatorStyles(periods),
    },
    true,
    { id: CANDLE_PANE_ID },
  )
  chart.createIndicator('VOL', false, { minHeight: 64, height: 82 })
  chart.createIndicator(
    {
      name: 'MACD',
      calcParams: MACD_PARAMS,
      styles: macdIndicatorStyles(),
    },
    false,
    { id: MACD_PANE_ID, minHeight: 86, height: 116 },
  )
  chart.createIndicator(
    {
      name: MACD_ZERO_INDICATOR_NAME,
      styles: macdZeroIndicatorStyles(),
    },
    true,
    { id: MACD_PANE_ID },
  )
}

function ensureSignalOverlay() {
  if (signalOverlayRegistered) return
  registerOverlay({
    name: SIGNAL_OVERLAY_NAME,
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }: OverlayCreateFiguresCallbackParams) => {
      const point = coordinates[0]
      if (!point) return []
      const data = recordValue(overlay.extendData) as SignalOverlayData
      const label = data.label || 'SIG'
      const side = data.side === 'sell' ? 'sell' : 'buy'
      const color = data.color || (side === 'buy' ? tradingDeskTheme.chart.orange : tradingDeskTheme.chart.purple)
      const width = Math.max(34, Math.min(78, label.length * 9 + 14))
      const height = 20
      const gap = 10
      const rectX = point.x - width / 2
      const rectY = side === 'buy' ? point.y + gap : point.y - gap - height
      const stemEndY = side === 'buy' ? rectY : rectY + height
      const triangleBaseY = side === 'buy' ? rectY : rectY + height
      const triangleTipY = side === 'buy' ? point.y + 3 : point.y - 3

      return [
        {
          type: 'line',
          attrs: {
            coordinates: [
              { x: point.x, y: triangleTipY },
              { x: point.x, y: stemEndY },
            ],
          },
          styles: solidLineStyle(color, 1),
          ignoreEvent: true,
        },
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              { x: point.x, y: triangleTipY },
              { x: point.x - 4, y: triangleBaseY },
              { x: point.x + 4, y: triangleBaseY },
            ],
          },
          styles: { color, borderColor: color },
          ignoreEvent: true,
        },
        {
          type: 'rect',
          attrs: { x: rectX, y: rectY, width, height },
          styles: {
            color,
            borderColor: tradingDeskTheme.alpha.textBorderStrong,
            borderRadius: 5,
          },
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
  signalOverlayRegistered = true
}

function ensureDivergenceOverlay() {
  if (divergenceOverlayRegistered) return
  registerOverlay({
    name: DIVERGENCE_OVERLAY_NAME,
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }: OverlayCreateFiguresCallbackParams) => {
      const previous = coordinates[0]
      const current = coordinates[1] ?? coordinates[0]
      if (!previous || !current) return []
      const data = recordValue(overlay.extendData) as DivergenceOverlayData
      const side = data.side === 'bottom' ? 'bottom' : 'top'
      const color = data.color || (side === 'top' ? tradingDeskTheme.market.up : tradingDeskTheme.market.down)
      const label = data.label || (side === 'top' ? '顶背离' : '底背离')
      const compact = Boolean(data.compact)
      const width = compact ? Math.max(42, label.length * 8 + 12) : 58
      const height = compact ? 16 : 20
      const gap = compact ? 6 : 10
      const rectX = current.x - width / 2
      const rectY = side === 'top' ? current.y - gap - height : current.y + gap
      const pointerY = side === 'top' ? rectY + height : rectY
      const tipY = side === 'top' ? current.y - 2 : current.y + 2

      return [
        {
          type: 'line',
          attrs: {
            coordinates: [
              { x: previous.x, y: previous.y },
              { x: current.x, y: current.y },
            ],
          },
          styles: { color, size: compact ? 1 : 1.4, style: 'dashed', dashedValue: [4, 3] },
          ignoreEvent: true,
        },
        {
          type: 'line',
          attrs: {
            coordinates: [
              { x: current.x, y: tipY },
              { x: current.x, y: pointerY },
            ],
          },
          styles: solidLineStyle(color, 1),
          ignoreEvent: true,
        },
        {
          type: 'rect',
          attrs: { x: rectX, y: rectY, width, height },
          styles: {
            color,
            borderColor: tradingDeskTheme.alpha.textBorderStrong,
            borderRadius: 4,
          },
          ignoreEvent: true,
        },
        {
          type: 'text',
          attrs: {
            x: current.x,
            y: rectY + height / 2,
            text: label,
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            color: terminalTheme.white,
            size: compact ? 9 : 10,
            weight: 800,
            family: fontStacks.ui,
          },
          ignoreEvent: true,
        },
      ]
    },
  })
  divergenceOverlayRegistered = true
}

function toKLineData(rawChart: Record<string, unknown> | undefined): KLineData[] {
  const rows = Array.isArray(rawChart?.ohlcv) ? rawChart.ohlcv : []
  return rows
    .map(item => {
      const record = recordValue(item)
      const timestamp = normalizeTimestamp(record.time ?? record.dt ?? record.timestamp)
      const close = numberValue(record.close)
      if (!timestamp || close === undefined) return null
      const open = numberValue(record.open) ?? close
      const high = numberValue(record.high) ?? Math.max(open, close)
      const low = numberValue(record.low) ?? Math.min(open, close)
      return {
        timestamp,
        open,
        high,
        low,
        close,
        volume: numberValue(record.volume) ?? numberValue(record.vol) ?? 0,
        turnover: numberValue(record.turnover),
      } satisfies KLineData
    })
    .filter((item): item is KLineData => Boolean(item))
    .sort((left, right) => left.timestamp - right.timestamp)
}

function signalsFromSymbolData(symbolData: WorkbenchSymbolData | null): StrategySignal[] {
  if (!symbolData) return []
  if (Array.isArray(symbolData.signals)) return symbolData.signals
  const chartSignals = symbolData.chart?.signals
  return Array.isArray(chartSignals) ? (chartSignals as StrategySignal[]) : []
}

function keyLevelsFromSymbolData(symbolData: WorkbenchSymbolData | null): StrategyKeyLevel[] {
  if (!symbolData) return []
  const summaryLevels = symbolData.summary?.key_levels
  if (Array.isArray(summaryLevels)) return summaryLevels as StrategyKeyLevel[]
  const chartReport = recordValue(symbolData.chart?.report)
  const chartLevels = chartReport.key_levels
  return Array.isArray(chartLevels) ? (chartLevels as StrategyKeyLevel[]) : []
}

function latestClose(data: KLineData[]): number | undefined {
  return data[data.length - 1]?.close
}

function movingAverageLevel(data: KLineData[], period: number): number | undefined {
  if (data.length < period) return undefined
  const window = data.slice(-period)
  const sum = window.reduce((total, item) => total + item.close, 0)
  return sum / period
}

function isDailyFreq(freq?: string): boolean {
  const normalized = String(freq ?? '').toLowerCase()
  return normalized.includes('day') || normalized === 'd' || normalized === '1d' || normalized === 'daily'
}

function derivedMaKeyLevels(data: KLineData[], freq?: string): StrategyKeyLevel[] {
  if (!isDailyFreq(freq)) return []
  return [50, 200]
    .map(period => {
      const value = movingAverageLevel(data, period)
      if (value === undefined) return null
      const close = latestClose(data)
      return {
        name: `${period}日线`,
        value,
        role: period === 200 ? '长期趋势压力/支撑' : '阶段底部/成本线',
        position: close !== undefined && close >= value ? '下方' : '上方',
        distance_pct: close !== undefined && value > 0 ? ((value - close) / close) * 100 : null,
        timeframe: 'daily',
      } satisfies StrategyKeyLevel
    })
    .filter((item): item is StrategyKeyLevel => Boolean(item))
}

function mergeKeyLevels(base: StrategyKeyLevel[], derived: StrategyKeyLevel[]): StrategyKeyLevel[] {
  const output: StrategyKeyLevel[] = []
  const seen = new Set<string>()
  ;[...base, ...derived].forEach(level => {
    const value = numberValue(level.value)
    const name = compactText(level.name)
    const key = `${name}:${value === undefined ? '' : value.toFixed(2)}`
    if (!name && value === undefined) return
    if (seen.has(key)) return
    seen.add(key)
    output.push(level)
  })
  return output
}

function divergenceWindowForFreq(freq?: string): number {
  const normalized = String(freq ?? '').toLowerCase()
  if (normalized.includes('week') || normalized === 'w' || normalized === '1w') return 2
  if (normalized.includes('day') || normalized === 'd' || normalized === '1d' || normalized === 'daily') return 3
  return 4
}

function divergenceMinPriceMoveForFreq(freq?: string): number {
  const normalized = String(freq ?? '').toLowerCase()
  if (normalized.includes('week') || normalized === 'w' || normalized === '1w') return 0.012
  if (normalized.includes('day') || normalized === 'd' || normalized === '1d' || normalized === 'daily') return 0.008
  return 0.003
}

function calculateMacdPoints(data: KLineData[]): MacdPoint[] {
  let closeSum = 0
  let emaShort: number | undefined
  let emaLong: number | undefined
  let dif = 0
  let difSum = 0
  let dea = 0
  const [shortPeriod, longPeriod, signalPeriod] = MACD_PARAMS
  const maxPeriod = Math.max(shortPeriod, longPeriod)

  return data.map((item, index) => {
    const close = item.close
    closeSum += close
    if (index >= shortPeriod - 1) {
      emaShort = index > shortPeriod - 1 && emaShort !== undefined
        ? (2 * close + (shortPeriod - 1) * emaShort) / (shortPeriod + 1)
        : closeSum / shortPeriod
    }
    if (index >= longPeriod - 1) {
      emaLong = index > longPeriod - 1 && emaLong !== undefined
        ? (2 * close + (longPeriod - 1) * emaLong) / (longPeriod + 1)
        : closeSum / longPeriod
    }
    const macd: MacdPoint = { timestamp: item.timestamp }
    if (index >= maxPeriod - 1 && emaShort !== undefined && emaLong !== undefined) {
      dif = emaShort - emaLong
      macd.dif = dif
      difSum += dif
      if (index >= maxPeriod + signalPeriod - 2) {
        dea = index > maxPeriod + signalPeriod - 2
          ? (dif * 2 + dea * (signalPeriod - 1)) / (signalPeriod + 1)
          : difSum / signalPeriod
        macd.dea = dea
        macd.histogram = (dif - dea) * 2
      }
    }
    return macd
  })
}

function hasMacdValue(value: MacdPoint | undefined): value is MacdPoint & { dif: number; histogram: number } {
  return value?.dif !== undefined && value.histogram !== undefined
}

function findSwingHighs(data: KLineData[], macd: MacdPoint[], windowSize: number): PivotPoint[] {
  const output: PivotPoint[] = []
  for (let index = windowSize; index < data.length - windowSize; index += 1) {
    const current = data[index]
    const macdPoint = macd[index]
    if (!current || !hasMacdValue(macdPoint)) continue
    let isPivot = true
    for (let offset = 1; offset <= windowSize; offset += 1) {
      if (current.high <= data[index - offset].high || current.high < data[index + offset].high) {
        isPivot = false
        break
      }
    }
    if (isPivot) {
      output.push({
        index,
        timestamp: current.timestamp,
        price: current.high,
        dif: macdPoint.dif,
        histogram: macdPoint.histogram,
      })
    }
  }
  return output
}

function findSwingLows(data: KLineData[], macd: MacdPoint[], windowSize: number): PivotPoint[] {
  const output: PivotPoint[] = []
  for (let index = windowSize; index < data.length - windowSize; index += 1) {
    const current = data[index]
    const macdPoint = macd[index]
    if (!current || !hasMacdValue(macdPoint)) continue
    let isPivot = true
    for (let offset = 1; offset <= windowSize; offset += 1) {
      if (current.low >= data[index - offset].low || current.low > data[index + offset].low) {
        isPivot = false
        break
      }
    }
    if (isPivot) {
      output.push({
        index,
        timestamp: current.timestamp,
        price: current.low,
        dif: macdPoint.dif,
        histogram: macdPoint.histogram,
      })
    }
  }
  return output
}

function weakeningRatio(previousValue: number, currentValue: number, type: 'bearish' | 'bullish'): number {
  const denominator = Math.max(Math.abs(previousValue), Math.abs(currentValue), 0.000001)
  const delta = type === 'bearish' ? previousValue - currentValue : currentValue - previousValue
  return delta / denominator
}

function divergenceConfidence(priceMove: number, indicatorWeakening: number): number {
  return Math.min(0.99, 0.45 + Math.min(priceMove * 18, 0.28) + Math.min(indicatorWeakening * 1.1, 0.26))
}

function divergenceFromPivots(
  previous: PivotPoint,
  current: PivotPoint,
  type: 'bearish' | 'bullish',
  minPriceMove: number,
): MacdDivergenceSignal | null {
  const priceMove = type === 'bearish'
    ? (current.price - previous.price) / Math.max(Math.abs(previous.price), 0.000001)
    : (previous.price - current.price) / Math.max(Math.abs(previous.price), 0.000001)
  if (priceMove < minPriceMove) return null

  const difWeakening = weakeningRatio(previous.dif, current.dif, type)
  const histogramWeakening = weakeningRatio(previous.histogram, current.histogram, type)
  const metric = histogramWeakening >= difWeakening ? 'histogram' : 'dif'
  const indicatorWeakening = Math.max(difWeakening, histogramWeakening)
  if (indicatorWeakening < 0.08) return null

  const macdValue = metric === 'histogram' ? current.histogram : current.dif
  const previousMacdValue = metric === 'histogram' ? previous.histogram : previous.dif
  return {
    id: `${type}:${previous.timestamp}:${current.timestamp}:${metric}`,
    type,
    timestamp: current.timestamp,
    price: current.price,
    previousTimestamp: previous.timestamp,
    previousPrice: previous.price,
    macdValue,
    previousMacdValue,
    confidence: divergenceConfidence(priceMove, indicatorWeakening),
    metric,
  }
}

function macdDivergences(data: KLineData[], freq?: string): MacdDivergenceSignal[] {
  if (data.length < 42) return []
  const windowSize = divergenceWindowForFreq(freq)
  const minPriceMove = divergenceMinPriceMoveForFreq(freq)
  const macd = calculateMacdPoints(data)
  const highs = findSwingHighs(data, macd, windowSize)
  const lows = findSwingLows(data, macd, windowSize)
  const candidates: MacdDivergenceSignal[] = []
  for (let index = 1; index < highs.length; index += 1) {
    const signal = divergenceFromPivots(highs[index - 1], highs[index], 'bearish', minPriceMove)
    if (signal) candidates.push(signal)
  }
  for (let index = 1; index < lows.length; index += 1) {
    const signal = divergenceFromPivots(lows[index - 1], lows[index], 'bullish', minPriceMove)
    if (signal) candidates.push(signal)
  }
  return candidates
    .filter(signal => signal.confidence >= 0.58)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-6)
}

function signalTimestamp(signal: StrategySignal): number | undefined {
  return normalizeTimestamp(signal.dt ?? signal.time ?? signal.timestamp)
}

function signalPrice(signal: StrategySignal, dataByTimestamp: Map<number, KLineData>): number | undefined {
  const explicit = numberValue(signal.price)
  if (explicit !== undefined) return explicit
  const timestamp = signalTimestamp(signal)
  return timestamp ? dataByTimestamp.get(timestamp)?.close : undefined
}

function shortSignalLabel(value?: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'SIG'
  if (/^[\x00-\x7F]+$/.test(raw)) return raw.toUpperCase().slice(0, 4)
  return raw.slice(0, 3)
}

function createSignalOverlays(chart: Chart, data: KLineData[], signals: StrategySignal[]) {
  chart.removeOverlay({ groupId: SIGNAL_OVERLAY_GROUP })
  const dataByTimestamp = new Map(data.map(item => [item.timestamp, item]))
  signals.slice(-30).forEach(signal => {
    const timestamp = signalTimestamp(signal)
    const price = signalPrice(signal, dataByTimestamp)
    if (!timestamp || price === undefined) return
    const label = shortSignalLabel(signal.type)
    const side = isSellSignal(signal.type) && !isBuySignal(signal.type) ? 'sell' : 'buy'
    chart.createOverlay({
      name: SIGNAL_OVERLAY_NAME,
      groupId: SIGNAL_OVERLAY_GROUP,
      lock: true,
      points: [{ timestamp, value: price }],
      extendData: {
        label,
        side,
        color: side === 'buy' ? tradingDeskTheme.chart.orange : tradingDeskTheme.chart.purple,
      } satisfies SignalOverlayData,
    })
  })
}

function createLevelOverlays(chart: Chart, data: KLineData[], keyLevels: StrategyKeyLevel[]) {
  chart.removeOverlay({ groupId: LEVEL_OVERLAY_GROUP })
  const timestamp = data[data.length - 1]?.timestamp
  if (!timestamp) return
  const close = latestClose(data)
  const visibleLevels: StrategyKeyLevel[] = []
  keyLevels
    .map(level => ({ level, value: numberValue(level.value) }))
    .filter((item): item is { level: StrategyKeyLevel; value: number } => item.value !== undefined)
    .sort((left, right) => {
      if (close === undefined) return 0
      return Math.abs(left.value - close) - Math.abs(right.value - close)
    })
    .forEach(item => {
      const tooClose = visibleLevels.some(existing => {
        const existingValue = numberValue(existing.value)
        if (existingValue === undefined) return false
        return Math.abs(existingValue - item.value) / Math.max(Math.abs(item.value), 0.000001) < 0.003
      })
      if (!tooClose && visibleLevels.length < 8) visibleLevels.push(item.level)
    })
  visibleLevels.forEach(level => {
    const value = numberValue(level.value)
    if (value === undefined) return
    chart.createOverlay({
      name: 'simpleTag',
      groupId: LEVEL_OVERLAY_GROUP,
      lock: true,
      points: [{ timestamp, value }],
      extendData: [level.name, value.toFixed(2)].filter(Boolean).join(' '),
      styles: {
        line: solidLineStyle(tradingDeskTheme.chart.line, 1),
        text: {
          color: terminalTheme.white,
          backgroundColor: tradingDeskTheme.chart.line,
          size: 10,
        },
      },
    })
  })
}

function createDivergenceOverlays(chart: Chart, divergences: MacdDivergenceSignal[]) {
  chart.removeOverlay({ groupId: DIVERGENCE_OVERLAY_GROUP })
  divergences.forEach(signal => {
    const bearish = signal.type === 'bearish'
    const color = bearish ? tradingDeskTheme.market.up : tradingDeskTheme.market.down
    const label = bearish ? '顶背离' : '底背离'
    const side = bearish ? 'top' : 'bottom'
    chart.createOverlay(
      {
        name: DIVERGENCE_OVERLAY_NAME,
        groupId: DIVERGENCE_OVERLAY_GROUP,
        lock: true,
        points: [
          { timestamp: signal.previousTimestamp, value: signal.previousPrice },
          { timestamp: signal.timestamp, value: signal.price },
        ],
        extendData: {
          label,
          side,
          color,
        } satisfies DivergenceOverlayData,
      },
      CANDLE_PANE_ID,
    )
    chart.createOverlay(
      {
        name: DIVERGENCE_OVERLAY_NAME,
        groupId: DIVERGENCE_OVERLAY_GROUP,
        lock: true,
        points: [
          { timestamp: signal.previousTimestamp, value: signal.previousMacdValue },
          { timestamp: signal.timestamp, value: signal.macdValue },
        ],
        extendData: {
          label: signal.metric === 'histogram' ? '柱背离' : 'DIF背离',
          side,
          color,
          compact: true,
        } satisfies DivergenceOverlayData,
      },
      MACD_PANE_ID,
    )
  })
}

function initialTargetFrom(
  shell: WorkbenchShell | null,
  dashboard: StrategyDashboard,
): ChartTarget {
  const shellTarget = shell?.default_target
  const chartContext = dashboard.chart_context
  const buyCandidate = dashboard.buy_candidates[0]
  const inferredKind = shellTarget?.label
    ? 'index'
    : (chartContext?.symbol ? 'stock' : (buyCandidate?.symbol ? 'stock' : 'index'))
  return {
    label:
      shellTarget?.label ??
      chartContext?.symbol ??
      buyCandidate?.symbol ??
      '沪深300',
    kind: shellTarget?.kind ?? inferredKind,
    freq: shellTarget?.freq ?? chartContext?.freq ?? 'daily',
  }
}

function availableFreqs(symbolData: WorkbenchSymbolData | null): string[] {
  const freqs = symbolData?.target?.available_freqs
  return Array.isArray(freqs) && freqs.length > 0 ? freqs : ['daily']
}

function formatNumber(value: unknown, digits = 2): string {
  const number = numberValue(value)
  if (number === undefined) return 'N/A'
  return number.toFixed(digits)
}

function formatPercent(value: unknown): string {
  const number =
    typeof value === 'string'
      ? numberValue(value.replace('%', '').replace('+', '').trim())
      : numberValue(value)
  if (number === undefined) return 'N/A'
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`
}

function percentTone(value: string): React.CSSProperties {
  if (value.startsWith('+')) return { color: tradingDeskTheme.market.up }
  if (value.startsWith('-')) return { color: tradingDeskTheme.market.down }
  return { color: terminalTheme.muted }
}

function formatConfidence(value: unknown): string {
  const number = numberValue(value)
  if (number === undefined) return compactText(value, 'N/A')
  const percent = number <= 1 ? number * 100 : number
  return `${percent.toFixed(0)}%`
}

function strategyKpiLabel(row: Record<string, unknown>): string {
  const key = compactText(row.kpi_id) || compactText(row.label)
  const labels: Record<string, string> = {
    signals_total: '信号总数',
    signals_evaluated: '已验证信号',
    signals_pending: '待验证信号',
    pool_size: '观察池',
    candidate_count: '买入候选',
    warning_count: '风险预警',
    win_rate: '历史胜率',
    avg_return_t5: 'T+5均值',
  }
  return labels[key] || compactText(row.label) || key || 'KPI'
}

function sourceConfidenceLabel(row: Record<string, unknown>): string {
  const key = compactText(row.source_id) || compactText(row.label)
  const labels: Record<string, string> = {
    board: '行业板块',
    concept: '概念板块',
    market_pool: '观察池',
    quote: '行情快照',
    signal: '信号池',
  }
  return labels[key] || compactText(row.label) || key || 'Source'
}

function readableTime(value?: Date | null, locale: LongclawLocale = 'zh-CN'): string {
  if (!value) return ''
  return value.toLocaleTimeString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function rowsFromCluster(value: unknown): Record<string, unknown>[] {
  const record = recordValue(value)
  const industryTop = recordValue(record.industry).top ?? record.industry_top
  const conceptTop = recordValue(record.concept).top ?? record.concept_top
  return [
    ...(Array.isArray(industryTop)
      ? industryTop.map(item => ({ ...recordValue(item), kind: 'industry', cluster_kind: 'industry' }))
      : []),
    ...(Array.isArray(conceptTop)
      ? conceptTop.map(item => ({ ...recordValue(item), kind: 'concept', cluster_kind: 'concept' }))
      : []),
  ].map(item => recordValue(item))
}

function labelForTarget(row: Record<string, unknown>): string {
  return (
    stringValue(row.label) ??
    stringValue(row.name) ??
    stringValue(row.symbol) ??
    stringValue(row.code) ??
    ''
  )
}

function targetMatchesSearchValue(row: Record<string, unknown>, value: string): boolean {
  const normalized = value.toLowerCase()
  const candidates = [
    labelForTarget(row),
    compactText(row.symbol),
    compactText(row.code),
    compactText(row.name),
  ].filter(Boolean)
  return candidates.some(candidate => candidate === value || candidate.toLowerCase() === normalized)
}

function looksLikeIndexValue(value: string): boolean {
  const normalized = value.toLowerCase()
  return (
    value.endsWith('指') ||
    value.includes('指数') ||
    value.includes('300') ||
    value.includes('500') ||
    value.includes('1000') ||
    /^s[hz](000|399)\d{3}$/.test(normalized) ||
    ['创业板指', '沪深300', '深证成指', '上证指数', '中证500', '中证1000'].includes(value)
  )
}

function kindForTarget(row: Record<string, unknown>, fallback = 'auto'): string {
  return stringValue(row.kind) ?? (stringValue(row.symbol) ? 'stock' : fallback)
}

function normalizeReturnKey(value: string): string {
  return value.toLowerCase().replace(/[\s_\-./]/g, '')
}

function readRangeReturn(row: Record<string, unknown>, column: WatchlistRangeColumn): unknown {
  const candidates = [row.range_returns, row.period_returns, row.interval_returns, row.carrier_range_returns]
  for (const candidate of candidates) {
    const record = recordValue(candidate)
    if (Object.keys(record).length > 0) {
      const normalizedEntries = new Map(
        Object.entries(record).map(([key, value]) => [normalizeReturnKey(key), value]),
      )
      for (const alias of [column.key, ...(column.aliases ?? [])]) {
        const value = normalizedEntries.get(normalizeReturnKey(alias))
        if (value !== undefined) return value
      }
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const record = recordValue(item)
        const key = compactText(record.key) || compactText(record.period) || compactText(record.interval) || compactText(record.label)
        if (!key) continue
        const matched = [column.key, ...(column.aliases ?? [])].some(alias => normalizeReturnKey(alias) === normalizeReturnKey(key))
        if (matched) return record.return_pct ?? record.change_pct ?? record.gain_pct ?? record.value
      }
    }
  }
  return undefined
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

function signalForWatchlist(row: Record<string, unknown>, kind: string): string {
  const badges = timeframeSignalBadges(row)
  if (badges.length > 0) return badges.map(item => item.label).join('/')
  const stackedSignals = [
    compactText(row.daily_latest_signal),
    compactText(row.f30_latest_signal),
    compactText(row.f15_latest_signal),
  ].filter(value => value && value !== '无')
  if (stackedSignals.length > 0) return stackedSignals.slice(0, 2).join('/')
  const evidenceSignal = compactText(recordValue(row.signal_evidence).signal_type)
  if (evidenceSignal) return evidenceSignal
  if (kind === 'industry' || kind === 'concept') {
    return (
      compactText(row.latest_signal) ||
      compactText(row.leader) ||
      compactText(recordValue(row.carrier).name) ||
      compactText(row.source)
    )
  }
  return (
    compactText(row.latest_signal) ||
    compactText(row.signal) ||
    compactText(row.reason) ||
    compactText(row.direction)
  )
}

function tagsForWatchlist(row: Record<string, unknown>, kind: string): string[] {
  const mapping = recordValue(row.mapping_chain)
  const carrier = recordValue(row.carrier)
  const tags = [
    ...stringArrayValue(row.theme_tags),
    compactText(row.trader_action),
    compactText(mapping.chain_name),
    compactText(mapping.node_name),
    compactText(carrier.name),
    compactText(row.source),
  ].filter(Boolean)
  if (kind === 'stock') {
    tags.unshift(...timeframeBadges(row))
  }
  return Array.from(new Set(tags)).slice(0, 4)
}

function latestValueForWatchlist(row: Record<string, unknown>): string {
  const value =
    row.latest_price ??
    row.last_price ??
    row.price ??
    row.close ??
    row.latest ??
    row.current_price ??
    row.value
  const carrierValue = row.carrier_latest_price
  if (numberValue(value) === undefined && numberValue(carrierValue) !== undefined) {
    return `承接 ${formatNumber(carrierValue)}`
  }
  return numberValue(value) !== undefined ? formatNumber(value) : compactText(value, 'N/A')
}

function dayChangeForWatchlist(row: Record<string, unknown>): string {
  return formatPercent(
    row.day_change_pct ??
      row.daily_change_pct ??
      row.change_pct ??
      row.gain_pct ??
      row.return_pct ??
      row.daily_return ??
      row.intraday_change ??
      row.pct_chg,
  )
}

function codeForWatchlist(row: Record<string, unknown>): string {
  return (
    compactText(row.symbol) ||
    compactText(row.code) ||
    compactText(row.ts_code) ||
    compactText(row.ticker) ||
    compactText(row.label)
  )
}

function nameForWatchlist(row: Record<string, unknown>): string {
  return (
    compactText(row.name) ||
    compactText(row.stock_name) ||
    compactText(row.display_name) ||
    compactText(row.label) ||
    codeForWatchlist(row) ||
    'N/A'
  )
}

function labelForWatchlist(row: Record<string, unknown>): string {
  return compactText(row.label) || compactText(row.symbol) || compactText(row.code) || nameForWatchlist(row)
}

function watchlistTypeLabel(kind: string): string {
  if (kind === 'index') return '指数'
  if (kind === 'industry') return '行业'
  if (kind === 'concept') return '概念'
  return '股票'
}

function watchlistDedupeKey(row: Record<string, unknown>, kind: string): string {
  const identity = codeForWatchlist(row) || labelForWatchlist(row) || nameForWatchlist(row)
  return `${kind}:${identity.toLowerCase()}`
}

function toWatchlistRow(
  row: Record<string, unknown>,
  fallbackKind: string,
  index: number,
  rangeColumns: WatchlistRangeColumn[],
): WatchlistRow | null {
  const kind = kindForTarget(row, fallbackKind)
  const label = labelForWatchlist(row)
  const name = nameForWatchlist(row)
  if (!label && !name) return null
  const code = codeForWatchlist(row)
  const dayChange = dayChangeForWatchlist(row)
  const rangeValues = rangeColumns.map((column, columnIndex) => {
    const explicit = readRangeReturn(row, column)
    if (explicit !== undefined) return formatPercent(explicit)
    if (columnIndex === 0) return dayChange
    return 'N/A'
  })
  const targetKind = compactText(row.target_kind) || kind
  const targetLabel = compactText(row.target_label) || label
  const signalBadges = timeframeSignalBadges(row)
  const laneStatus = recordValue(row.lane_status)
  return {
    id: `${watchlistDedupeKey(row, kind)}:${index}`,
    kind,
    label,
    name,
    code,
    typeLabel: watchlistTypeLabel(kind),
    latest: latestValueForWatchlist(row),
    dayChange,
    rangeValues,
    signal: signalBadges.length > 0 ? signalBadges.map(item => item.label).join('/') : signalForWatchlist(row, kind),
    signalBadges,
    tags: tagsForWatchlist(row, kind),
    lane: compactText(row.lane),
    freshness: compactText(row.freshness) || compactText(laneStatus.freshness) || compactText(laneStatus.status),
    traderAction: compactText(row.trader_action) || compactText(row.action_status),
    invalidatesWhen: compactText(row.invalidates_when),
    explanation: compactText(row.explanation),
    targetKind,
    targetLabel,
    targetFreq: compactText(row.target_freq) || (kind === 'industry' || kind === 'concept' ? 'daily' : ''),
    raw: row,
  }
}

function buildRowsForGroup(
  rows: Record<string, unknown>[],
  fallbackKind: string,
  rangeColumns: WatchlistRangeColumn[],
): WatchlistRow[] {
  const seen = new Set<string>()
  const output: WatchlistRow[] = []
  rows.forEach((row, index) => {
    const kind = kindForTarget(row, fallbackKind)
    const key = watchlistDedupeKey(row, kind)
    if (seen.has(key)) return
    seen.add(key)
    const item = toWatchlistRow(row, kind, index, rangeColumns)
    if (item) output.push(item)
  })
  return output
}

function buildWatchlistRows({
  watchlist,
  indices,
  buyRows,
  sellRows,
  decisionRows,
  clusterRows,
  rangeColumns,
}: {
  watchlist: Record<string, unknown>[]
  indices: Record<string, unknown>[]
  buyRows: Record<string, unknown>[]
  sellRows: Record<string, unknown>[]
  decisionRows: Record<string, unknown>[]
  clusterRows: Record<string, unknown>[]
  rangeColumns: WatchlistRangeColumn[]
}): WatchlistRow[] {
  const sources: Array<{ rows: Record<string, unknown>[]; kind: string }> = [
    { rows: watchlist.map(row => ({ ...row, kind: kindForTarget(row, 'auto') })), kind: 'auto' },
    { rows: indices.map(row => ({ ...row, kind: 'index' })), kind: 'index' },
    { rows: buyRows.map(row => ({ ...row, kind: kindForTarget(row, 'stock') })), kind: 'stock' },
    { rows: sellRows.map(row => ({ ...row, kind: kindForTarget(row, 'stock') })), kind: 'stock' },
    { rows: decisionRows.map(row => ({ ...row, kind: kindForTarget(row, 'stock') })), kind: 'stock' },
    { rows: clusterRows, kind: 'industry' },
  ]
  const seen = new Set<string>()
  const output: WatchlistRow[] = []
  sources.forEach(source => {
    source.rows.forEach((row, index) => {
      const kind = kindForTarget(row, source.kind)
      const key = watchlistDedupeKey(row, kind)
      if (seen.has(key)) return
      seen.add(key)
      const item = toWatchlistRow(row, kind, output.length + index, rangeColumns)
      if (item) output.push(item)
    })
  })
  return output
}

function watchlistRangeColumnsFromShell(shell: WorkbenchShell | null): WatchlistRangeColumn[] {
  const rawColumns = Array.isArray(shell?.watchlist_range_columns) ? shell.watchlist_range_columns : []
  const columns = rawColumns
    .map(column => {
      const record = recordValue(column)
      const key = compactText(record.key)
      if (!key) return null
      return {
        key,
        label: compactText(record.label, key),
        aliases: Array.isArray(record.aliases)
          ? record.aliases.map(alias => compactText(alias)).filter(Boolean)
          : [],
      } satisfies WatchlistRangeColumn
    })
    .filter((column): column is WatchlistRangeColumn => Boolean(column))
  return columns.length > 0 ? columns : WATCHLIST_RANGE_COLUMNS
}

function watchlistRowIsActive(row: WatchlistRow, target: ChartTarget): boolean {
  if ((row.targetKind || row.kind) !== target.kind) return false
  return row.targetLabel === target.label || row.label === target.label || row.code === target.label || row.name === target.label
}

export function StrategyChartTerminal({
  locale,
  dashboard,
  signalsWebBaseUrl,
  onOpenRecord,
}: StrategyChartTerminalProps) {
  const baseUrl = trimTrailingSlash(signalsWebBaseUrl) || urlFromDashboard(dashboard)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const activeRequestRef = useRef(0)
  const dashboardRef = useRef(dashboard)
  const lastChartUpdateSilentRef = useRef(false)
  const [shell, setShell] = useState<WorkbenchShell | null>(null)
  const [target, setTarget] = useState<ChartTarget>(() => initialTargetFrom(null, dashboard))
  const [symbolData, setSymbolData] = useState<WorkbenchSymbolData | null>(null)
  const [searchDraft, setSearchDraft] = useState(target.label)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<WatchlistTabKey>('macro_indices')

  const klineData = useMemo(() => toKLineData(symbolData?.chart), [symbolData])
  const signals = useMemo(() => signalsFromSymbolData(symbolData), [symbolData])
  const keyLevels = useMemo(() => keyLevelsFromSymbolData(symbolData), [symbolData])
  const targetFreqs = useMemo(() => availableFreqs(symbolData), [symbolData])
  const liveRefresh = shouldUseLiveRefresh(shell?.session)
  const connectorAlerts = useMemo(
    () =>
      dashboard.connector_health.filter(item => {
        const status = String(item.status ?? '').toLowerCase()
        return status && !['available', 'connected', 'open', 'ready', 'success'].includes(status)
      }).length,
    [dashboard.connector_health],
  )

  const dailyBrief = dashboard.daily_brief
  const dailyBriefBullets = Array.isArray(dailyBrief.bullets) ? dailyBrief.bullets : []
  const decisionRows = (Array.isArray(shell?.decision_queue) && shell.decision_queue.length > 0
    ? shell.decision_queue
    : dashboard.decision_queue) as Array<Record<string, unknown>>
  const strategyKpis = (Array.isArray(shell?.strategy_kpis) && shell.strategy_kpis.length > 0
    ? shell.strategy_kpis
    : dashboard.strategy_kpis) as Array<Record<string, unknown>>
  const sourceConfidence = (Array.isArray(shell?.source_confidence) && shell.source_confidence.length > 0
    ? shell.source_confidence
    : dashboard.source_confidence) as Array<Record<string, unknown>>
  const shellBuyCandidates = Array.isArray(shell?.buy_candidates) ? shell.buy_candidates : []
  const buyRows = shellBuyCandidates.length > 0
    ? shellBuyCandidates
    : dashboard.buy_candidates as Array<Record<string, unknown>>
  const targetCandidateRows = Array.isArray(symbolData?.candidate_stocks) ? symbolData.candidate_stocks : []
  const sellRows = dashboard.sell_warnings as Array<Record<string, unknown>>
  const indexTargets = shell?.indices ?? []
  const clusterRows = rowsFromCluster(shell?.cluster_summary)
  const shellWatchlist = Array.isArray(shell?.watchlist) ? shell.watchlist : []
  const watchlistRangeColumns = useMemo(() => watchlistRangeColumnsFromShell(shell), [shell])
  const groupedWatchlistRows = useMemo(() => {
    const groups = shell?.watchlist_groups ?? {}
    const macroRows = Array.isArray(groups.macro_indices) && groups.macro_indices.length > 0
      ? groups.macro_indices
      : indexTargets
    const sectorRows = Array.isArray(groups.sector_boards) && groups.sector_boards.length > 0
      ? groups.sector_boards
      : clusterRows
    const focusRows = Array.isArray(groups.focus_stocks) && groups.focus_stocks.length > 0
      ? groups.focus_stocks
      : buyRows
    const legacyRows = buildWatchlistRows({
      watchlist: shellWatchlist,
      indices: indexTargets,
      buyRows,
      sellRows,
      decisionRows,
      clusterRows,
      rangeColumns: watchlistRangeColumns,
    })
    return {
      macro_indices: buildRowsForGroup(macroRows, 'index', watchlistRangeColumns),
      sector_boards: buildRowsForGroup(sectorRows, 'industry', watchlistRangeColumns),
      focus_stocks: buildRowsForGroup(focusRows, 'stock', watchlistRangeColumns),
      legacy: legacyRows,
    }
  }, [buyRows, clusterRows, decisionRows, indexTargets, sellRows, shell?.watchlist_groups, shellWatchlist, watchlistRangeColumns])
  const activeWatchlistRows = groupedWatchlistRows[activeWatchlistTab].length > 0
    ? groupedWatchlistRows[activeWatchlistTab]
    : groupedWatchlistRows.legacy
  const latestSignal = compactText(symbolData?.summary?.latest_signal, dashboard.chart_context?.latest_signal ?? '')
  const summaryTitle =
    compactText(symbolData?.summary?.title) ||
    compactText(symbolData?.target?.label) ||
    target.label
  const summarySubtitle =
    compactText(symbolData?.summary?.subtitle) ||
    compactText(symbolData?.target?.symbol) ||
    compactText(symbolData?.target?.kind, target.kind)
  const currentFreq = symbolData?.target?.effective_freq ?? target.freq
  const activeMaPeriods = useMemo(() => maPeriodsForFreq(currentFreq), [currentFreq])
  const divergences = useMemo(() => macdDivergences(klineData, currentFreq), [currentFreq, klineData])
  const chartKeyLevels = useMemo(
    () => mergeKeyLevels(keyLevels, derivedMaKeyLevels(klineData, currentFreq)),
    [currentFreq, keyLevels, klineData],
  )
  const requestedFreq = symbolData?.target?.requested_freq
  const effectiveFreq = symbolData?.target?.effective_freq
  const freqFallbackNotice =
    requestedFreq && effectiveFreq && requestedFreq !== effectiveFreq
      ? (locale === 'zh-CN'
          ? `${requestedFreq} 暂不可用，已使用 ${effectiveFreq}。`
          : `${requestedFreq} is unavailable; using ${effectiveFreq}.`)
      : null

  const loadShell = useCallback(
    async (signal?: AbortSignal) => {
      if (!baseUrl) return null
      const nextShell = await fetchJson<WorkbenchShell>(
        baseUrl,
        '/api/workbench/shell',
        signal,
        'strategy.shell',
      )
      setShell(nextShell)
      return nextShell
    },
    [baseUrl],
  )

  const loadSymbol = useCallback(
    async (nextTarget: ChartTarget, options: { signal?: AbortSignal; silent?: boolean } = {}) => {
      if (!baseUrl) return
      const requestId = activeRequestRef.current + 1
      activeRequestRef.current = requestId
      if (!options.silent) setLoading(true)
      setError(null)
      try {
        const nextSymbolData = await fetchJson<WorkbenchSymbolData>(
          baseUrl,
          `/api/workbench/symbol/${encodeURIComponent(nextTarget.label)}?${new URLSearchParams({
            kind: nextTarget.kind || 'auto',
            freq: nextTarget.freq || 'daily',
          }).toString()}`,
          options.signal,
          'strategy.symbol',
          options.silent ? 'background-refresh' : 'load-symbol',
        )
        if (requestId !== activeRequestRef.current) return
        lastChartUpdateSilentRef.current = Boolean(options.silent)
        setSymbolData(nextSymbolData)
        setBooting(false)
        setBootAttempt(0)
        setLastUpdated(new Date())
        const effectiveTarget = nextSymbolData.target
        if (effectiveTarget) {
          const requested = compactText(effectiveTarget.requested_freq, nextTarget.freq)
          const effective = compactText(effectiveTarget.effective_freq, nextTarget.freq)
          if (requested && effective && requested !== effective) {
            recordObservationEvent('strategy.freq.fallback', {
              requested_freq: requested,
              effective_freq: effective,
              target: nextTarget.label,
              kind: nextTarget.kind,
              silent: Boolean(options.silent),
              level: 'warning',
            })
          }
          setTarget(previous => {
            const effectiveKind = compactText(effectiveTarget.kind, previous.kind)
            const keepsLogicalLabel = ['index', 'industry', 'concept'].includes(effectiveKind)
            return {
              label: keepsLogicalLabel
                ? compactText(effectiveTarget.label, previous.label)
                : compactText(effectiveTarget.symbol) || compactText(effectiveTarget.label) || previous.label,
              kind: effectiveKind,
              freq: compactText(effectiveTarget.effective_freq, previous.freq),
            }
          })
        }
      } catch (rawError) {
        if (options.signal?.aborted) return
        const apiError = rawError as ApiError
        if (apiError.status === 503) {
          const session = recordValue(apiError.payload?.session) as WorkbenchSession
          setShell(previous => ({ ...(previous ?? {}), session }))
          setBooting(true)
          setBootAttempt(previous => previous + 1)
          setError(apiError.message)
          return
        }
        setBooting(false)
        setError(apiError.message || (locale === 'zh-CN' ? 'Signals 图表数据加载失败。' : 'Failed to load Signals chart data.'))
      } finally {
        if (requestId === activeRequestRef.current) setLoading(false)
      }
    },
    [baseUrl, locale],
  )

  useEffect(() => {
    dashboardRef.current = dashboard
  }, [dashboard])

  useEffect(() => {
    setSearchDraft(target.label)
  }, [target.label])

  useEffect(() => {
    if (!baseUrl) return
    const controller = new AbortController()
    setShell(null)
    setSymbolData(null)
    setError(null)
    setBooting(false)
    setLoading(true)
    void (async () => {
      try {
        const nextShell = await loadShell(controller.signal)
        const nextTarget = initialTargetFrom(nextShell, dashboardRef.current)
        recordObservationEvent('strategy.init-target', {
          target: nextTarget,
          reason: 'initial-shell-load',
        })
        setTarget(nextTarget)
        setSearchDraft(nextTarget.label)
        await loadSymbol(nextTarget, { signal: controller.signal })
      } catch (rawError) {
        if (controller.signal.aborted) return
        const apiError = rawError as ApiError
        setError(apiError.message || (locale === 'zh-CN' ? 'Signals 终端初始化失败。' : 'Failed to initialize Signals terminal.'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [baseUrl, loadShell, loadSymbol, locale])

  useEffect(() => {
    if (!baseUrl || !target.label) return
    const controllers = new Set<AbortController>()
    const refreshMs = liveRefresh ? 5_000 : 30_000
    const timer = window.setInterval(() => {
      const controller = new AbortController()
      controllers.add(controller)
      void loadShell(controller.signal).catch(() => undefined)
      void loadSymbol(target, { signal: controller.signal, silent: true })
        .finally(() => {
          controllers.delete(controller)
        })
    }, refreshMs)
    return () => {
      window.clearInterval(timer)
      controllers.forEach(controller => controller.abort())
      controllers.clear()
    }
  }, [baseUrl, liveRefresh, loadShell, loadSymbol, target])

  useEffect(() => {
    if (!baseUrl || !booting || !target.label) return
    const controller = new AbortController()
    const delay = Math.min(8_000, 1_200 * Math.max(bootAttempt, 1))
    const timer = window.setTimeout(() => {
      void loadShell(controller.signal).catch(() => undefined)
      void loadSymbol(target, { signal: controller.signal, silent: true })
    }, delay)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [baseUrl, bootAttempt, booting, loadShell, loadSymbol, target])

  useEffect(() => {
    if (!chartContainerRef.current) return
    ensureSignalOverlay()
    ensureDivergenceOverlay()
    ensureMacdZeroIndicator()
    const chart = init(chartContainerRef.current, {
      locale: locale === 'zh-CN' ? 'zh-CN' : 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      styles: chartStyles(),
    })
    if (!chart) return
    chartRef.current = chart
    chart.setBarSpace(8)
    chart.setOffsetRightDistance(36)
    createChartIndicators(chart, target.freq)
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
  }, [baseUrl, locale])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    applyMovingAverageIndicator(chart, currentFreq)
  }, [currentFreq])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setStyles(chartStyles())
    chart.setLocale(locale === 'zh-CN' ? 'zh-CN' : 'en-US')
  }, [locale])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.removeOverlay({ groupId: SIGNAL_OVERLAY_GROUP })
    chart.removeOverlay({ groupId: LEVEL_OVERLAY_GROUP })
    chart.removeOverlay({ groupId: DIVERGENCE_OVERLAY_GROUP })
    if (klineData.length === 0) {
      chart.clearData()
      return
    }
    chart.applyNewData(klineData)
    createSignalOverlays(chart, klineData, signals)
    createLevelOverlays(chart, klineData, chartKeyLevels)
    createDivergenceOverlays(chart, divergences)
    if (!lastChartUpdateSilentRef.current) {
      chart.scrollToRealTime()
    }
    chart.resize()
  }, [chartKeyLevels, divergences, klineData, signals])

  const selectTarget = useCallback(
    (next: ChartTarget, source = 'strategy.target.select') => {
      recordObservationEvent(source, {
        previous: target,
        next,
      })
      setTarget(next)
      setSearchDraft(next.label)
      void loadSymbol(next)
    },
    [loadSymbol, target],
  )

  const submitSearch = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const value = searchDraft.trim()
      if (!value) return
      const isIndex = indexTargets.some(row => targetMatchesSearchValue(row, value)) || looksLikeIndexValue(value)
      selectTarget(
        { label: value, kind: isIndex ? 'index' : 'auto', freq: target.freq || 'daily' },
        'strategy.search.submit',
      )
    },
    [indexTargets, searchDraft, selectTarget, target.freq],
  )

  const refreshNow = useCallback(() => {
    if (!target.label) return
    recordObservationEvent('strategy.refresh.click', { target })
    void loadShell().catch(() => undefined)
    void loadSymbol(target)
  }, [loadShell, loadSymbol, target])

  if (!baseUrl) {
    return (
      <div style={terminalRootStyle}>
        <div style={warningDarkStyle}>
          {locale === 'zh-CN'
            ? '信号实时入口未配置，当前显示降级摘要。'
            : 'Signals live endpoint is not configured. Showing a degraded summary.'}
        </div>
        <div style={fallbackGridStyle}>
          <Panel
            title={locale === 'zh-CN' ? 'Daily brief' : 'Daily brief'}
            meta={compactText(dailyBrief.market_bias)}
          >
            <div style={compactListStyle}>
              <div style={dataRowStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div style={rowTitleStyle}>
                    {compactText(dailyBrief.headline, locale === 'zh-CN' ? '暂无摘要标题' : 'No brief headline')}
                  </div>
                  <div style={mutedTextStyle}>
                    {compactText(dailyBrief.summary, locale === 'zh-CN' ? '暂无策略摘要。' : 'No strategy summary yet.')}
                  </div>
                </div>
              </div>
              {dailyBriefBullets.slice(0, 3).map((item, index) => (
                <div key={`${item}-${index}`} style={dataRowStyle}>
                  <div style={mutedTextStyle}>{item}</div>
                </div>
              ))}
            </div>
          </Panel>
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '买入候选' : 'Buy candidates'}
            rows={dashboard.buy_candidates as Array<Record<string, unknown>>}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `买入 ${String(item.symbol ?? '候选')}`
                  : `Buy ${String(item.symbol ?? 'candidate')}`,
                item,
              )
            }
          />
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '卖出预警' : 'Sell warnings'}
            rows={dashboard.sell_warnings as Array<Record<string, unknown>>}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `卖出 ${String(item.symbol ?? '预警')}`
                  : `Sell ${String(item.symbol ?? 'warning')}`,
                item,
              )
            }
          />
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '交易员待办' : 'Trader queue'}
            rows={decisionRows.map(item => ({
              ...item,
              name: compactText(item.title) || compactText(item.symbol) || compactText(item.decision_id),
            }))}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `决策 ${String(item.symbol ?? item.decision_id ?? 'queue')}`
                  : `Decision ${String(item.symbol ?? item.decision_id ?? 'queue')}`,
                item,
              )
            }
          />
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '策略证据' : 'Strategy evidence'}
            rows={strategyKpis.map(item => ({
              ...item,
              name: compactText(item.label) || compactText(item.kpi_id),
              summary: [
                compactText(item.value),
                compactText(item.unit),
                compactText(item.status),
              ].filter(Boolean).join(' '),
            }))}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `KPI ${String(item.label ?? item.kpi_id ?? 'strategy')}`
                  : `KPI ${String(item.label ?? item.kpi_id ?? 'strategy')}`,
                item,
              )
            }
          />
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '数据源状态' : 'Data source status'}
            rows={sourceConfidence.map(item => ({
              ...item,
              connector_id: compactText(item.source_id) || compactText(item.label),
              name: compactText(item.label) || compactText(item.source_id),
              summary: [
                formatConfidence(item.confidence),
                compactText(item.status),
                compactText(item.summary),
              ].filter(Boolean).join(' · '),
            }))}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `来源 ${String(item.label ?? item.source_id ?? 'source')}`
                  : `Source ${String(item.label ?? item.source_id ?? 'source')}`,
                item,
              )
            }
          />
          <FallbackList
            locale={locale}
            title={locale === 'zh-CN' ? '连接器' : 'Connectors'}
            rows={dashboard.connector_health as Array<Record<string, unknown>>}
            onOpen={item =>
              onOpenRecord(
                locale === 'zh-CN'
                  ? `连接器 ${humanizeTokenLocale(locale, String(item.connector_id ?? 'record'))}`
                  : `Connector ${String(item.connector_id ?? 'record')}`,
                item,
              )
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div style={terminalRootStyle}>
      <div style={terminalTopBarStyle}>
        <form style={searchFormStyle} onSubmit={submitSearch}>
        <input
            aria-label={locale === 'zh-CN' ? '搜索标的' : 'Search symbol'}
            style={searchInputStyle}
            value={searchDraft}
            placeholder={locale === 'zh-CN' ? '输入指数 / 行业 / 股票代码或名称…' : 'Index, sector, ticker, or name…'}
            onChange={event => setSearchDraft(event.target.value)}
          />
          <button type="submit" style={terminalButtonStyle(false)}>
            {locale === 'zh-CN' ? '切换' : 'Switch'}
          </button>
        </form>
        <div style={chartMetaRowStyle}>
          {FREQ_OPTIONS.map(freq => {
            const active = currentFreq === freq.value
            const disabled = !targetFreqs.includes(freq.value)
            return (
              <button
                key={freq.value}
                type="button"
                style={terminalButtonStyle(active, disabled)}
                disabled={disabled}
                onClick={() => selectTarget({ ...target, freq: freq.value }, 'strategy.freq.click')}
              >
                {freq.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          style={terminalButtonStyle(false, loading)}
          disabled={loading}
          onClick={refreshNow}
        >
          {loading ? (locale === 'zh-CN' ? '刷新中' : 'Refreshing') : (locale === 'zh-CN' ? '刷新' : 'Refresh')}
        </button>
      </div>

      {shell?.notices?.length ? (
        <div style={noticeDarkStyle}>{shell.notices.join(' ')}</div>
      ) : null}
      {freqFallbackNotice ? (
        <div style={warningDarkStyle}>{freqFallbackNotice}</div>
      ) : null}
      {error ? (
        <div style={booting ? warningDarkStyle : errorDarkStyle}>{error}</div>
      ) : null}
      {compactText(dailyBrief.headline) || compactText(dailyBrief.summary) ? (
        <div style={noticeDarkStyle}>
          {[
            compactText(dailyBrief.headline),
            compactText(dailyBrief.summary),
            compactText(dailyBrief.market_bias),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      ) : null}

      <div style={terminalGridStyle}>
        <div style={terminalSideStyle}>
          <Panel
            title={locale === 'zh-CN' ? '交易员第二屏' : 'Trader second screen'}
            meta={marketLabel(shell?.session, locale)}
          >
            <WatchlistTabbedTable
              locale={locale}
              activeTab={activeWatchlistTab}
              onTabChange={setActiveWatchlistTab}
              groups={groupedWatchlistRows}
              rows={activeWatchlistRows}
              target={target}
              rangeColumns={watchlistRangeColumns}
              emptyText={locale === 'zh-CN' ? '等待 Signals shell。' : 'Waiting for Signals shell.'}
              onSelect={row =>
                selectTarget(
                  {
                    label: row.targetLabel || row.label,
                    kind: row.targetKind || row.kind,
                    freq: row.targetFreq || target.freq,
                  },
                  'strategy.watchlist.click',
                )
              }
            />
          </Panel>
        </div>

        <div style={chartStageStyle}>
          <div style={chartHeaderStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={eyebrowDarkStyle}>
                {compactText(symbolData?.target?.kind, target.kind).toUpperCase()}
              </div>
              <div style={chartTitleStyle}>{summaryTitle}</div>
              <div style={mutedTextStyle}>
                {[summarySubtitle, currentFreq, latestSignal || undefined].filter(Boolean).join(' · ')}
              </div>
              <div style={indicatorLegendStyle}>
                {activeMaPeriods.map((period, index) => (
                  <span key={`ma-${period}`} style={indicatorLegendItemStyle}>
                    <span style={{ ...indicatorLegendSwatchStyle, background: MA_COLORS[index % MA_COLORS.length] }} />
                    {`MA${period}`}
                  </span>
                ))}
                {MACD_LINE_COLORS.map((color, index) => (
                  <span key={`macd-${index}`} style={indicatorLegendItemStyle}>
                    <span style={{ ...indicatorLegendSwatchStyle, background: color }} />
                    {index === 0 ? 'DIF' : 'DEA'}
                  </span>
                ))}
                <span style={indicatorLegendItemStyle}>
                  <span style={{ ...indicatorLegendSwatchStyle, background: tradingDeskTheme.alpha.textBorderStrong }} />
                  MACD 0
                </span>
                {isDailyFreq(currentFreq) ? (
                  <span style={indicatorLegendItemStyle}>
                    <span style={{ ...indicatorLegendSwatchStyle, background: tradingDeskTheme.chart.line }} />
                    MA50/200关键位
                  </span>
                ) : null}
                <span style={indicatorLegendItemStyle}>
                  <span style={{ ...indicatorLegendSwatchStyle, background: tradingDeskTheme.market.up }} />
                  {locale === 'zh-CN' ? `背离 ${divergences.length}` : `Divergence ${divergences.length}`}
                </span>
              </div>
            </div>
            <div style={chartHeaderRightStyle}>
              <div style={headerMetricsStyle}>
                {[
                  [locale === 'zh-CN' ? '最新价' : 'Last', formatNumber(symbolData?.summary?.latest_price ?? latestClose(klineData))],
                  [locale === 'zh-CN' ? '信号' : 'Signal', latestSignal || 'N/A'],
                  [locale === 'zh-CN' ? '涨幅' : 'Change', formatPercent(symbolData?.summary?.gain_pct)],
                ].map(([label, value]) => (
                  <div key={label} style={headerMetricStyle}>
                    <div style={eyebrowDarkStyle}>{label}</div>
                    <div style={{ color: terminalTheme.textStrong, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {connectorAlerts > 0 ? (
                    <span style={statusBadgeStyle('warning')}>
                      {locale === 'zh-CN' ? `连接 ${connectorAlerts}` : `${connectorAlerts} connectors`}
                    </span>
                  ) : null}
                  <span style={statusBadgeStyle(booting ? 'warning' : loading ? 'running' : 'open')}>
                    {booting
                      ? (locale === 'zh-CN' ? '启动中' : 'Booting')
                      : loading
                        ? (locale === 'zh-CN' ? '刷新中' : 'Refreshing')
                        : marketLabel(shell?.session, locale)}
                  </span>
                </div>
                <div style={mutedTextStyle}>
                  {lastUpdated
                    ? `${locale === 'zh-CN' ? '更新' : 'Updated'} ${readableTime(lastUpdated, locale)}`
                    : (locale === 'zh-CN' ? '等待数据' : 'Waiting for data')}
                </div>
              </div>
            </div>
          </div>

          {symbolData?.summary?.conclusion ? (
            <div style={chartConclusionStyle}>{String(symbolData.summary.conclusion)}</div>
          ) : null}

          <div style={chartCanvasShellStyle}>
            <div ref={chartContainerRef} style={chartCanvasStyle} />
            {klineData.length === 0 ? (
              <div style={chartOverlayMessageStyle}>
                {loading || booting
                  ? (locale === 'zh-CN' ? '正在等待 Signals 输出 K 线和买卖点。' : 'Waiting for Signals to provide candles and signals.')
                  : (locale === 'zh-CN' ? '当前标的没有可用 OHLCV。' : 'No OHLCV is available for this target.')}
              </div>
            ) : null}
          </div>
        </div>

        <div style={terminalSideStyle}>
          <Panel
            title={locale === 'zh-CN' ? '交易员待办' : 'Trader queue'}
            meta={String(decisionRows.length)}
          >
            {decisionRows.length === 0 ? (
              <div style={emptyStateDarkStyle}>
                {locale === 'zh-CN' ? '暂无待决策事项。' : 'No decisions waiting.'}
              </div>
            ) : (
              <div style={compactListStyle}>
                {decisionRows.slice(0, 5).map((row, index) => (
                  <button
                    key={`${compactText(row.decision_id, 'decision')}-${index}`}
                    type="button"
                    style={targetButtonStyle}
                    onClick={() =>
                      onOpenRecord(
                        locale === 'zh-CN'
                          ? `决策 ${String(row.symbol ?? row.decision_id ?? 'queue')}`
                          : `Decision ${String(row.symbol ?? row.decision_id ?? 'queue')}`,
                        row,
                      )
                    }
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={rowTitleStyle}>
                        {compactText(row.title) || compactText(row.symbol) || 'Decision'}
                      </div>
                      <div style={monoTextStyle}>{compactText(row.priority)}</div>
                    </div>
                    <div style={mutedTextStyle}>
                      {[compactText(row.action_label) || compactText(row.action), compactText(row.summary), compactText(row.recommended_action)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={locale === 'zh-CN' ? '卖出预警' : 'Sell warnings'}
            meta={String(sellRows.length)}
          >
            <TargetRows
              rows={sellRows}
              emptyText={locale === 'zh-CN' ? '暂无卖出预警。' : 'No sell warnings.'}
              onSelect={row => {
                const label = labelForTarget(row)
                if (label) {
                  selectTarget(
                    { label, kind: kindForTarget(row, 'stock'), freq: target.freq },
                    'strategy.sell-warning.click',
                  )
                }
              }}
            />
          </Panel>

          <Panel
            title={locale === 'zh-CN' ? '买卖点' : 'Signals'}
            meta={String(signals.length)}
          >
            {signals.length === 0 ? (
              <div style={emptyStateDarkStyle}>
                {locale === 'zh-CN' ? '当前标的暂无信号。' : 'No signals for this target.'}
              </div>
            ) : (
              <div style={compactListStyle}>
                {signals.slice(-9).reverse().map((signal, index) => (
                  <div key={`${signal.dt ?? signal.time ?? index}-${signal.type ?? 'signal'}`} style={signalRowStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={statusBadgeStyle(signalTone(signal.type))}>
                          {signal.type || 'Signal'}
                        </span>
                        <span style={monoTextStyle}>{formatNumber(signal.price)}</span>
                      </div>
                      <div style={mutedTextStyle}>
                        {[signal.freq, signal.date_str, signal.confidence !== undefined ? `conf ${formatNumber(signal.confidence, 2)}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {targetCandidateRows.length > 0 ? (
            <Panel
              title={locale === 'zh-CN' ? '代表股候选' : 'Representatives'}
              meta={String(targetCandidateRows.length)}
            >
              <TargetRows
                rows={targetCandidateRows}
                emptyText={locale === 'zh-CN' ? '暂无代表股候选。' : 'No representatives.'}
                onSelect={row => {
                  const label = labelForTarget(row)
                  if (label) {
                    selectTarget(
                      { label, kind: kindForTarget(row, 'stock'), freq: target.freq },
                      'strategy.representative.click',
                    )
                  }
                }}
              />
            </Panel>
          ) : null}

          <Panel
            title={locale === 'zh-CN' ? '关键位' : 'Key levels'}
            meta={String(chartKeyLevels.length)}
          >
            {chartKeyLevels.length === 0 ? (
              <div style={emptyStateDarkStyle}>
                {locale === 'zh-CN' ? '暂无关键位。' : 'No key levels.'}
              </div>
            ) : (
              <div style={compactListStyle}>
                {chartKeyLevels.slice(0, 8).map(level => (
                  <div key={`${level.name ?? 'level'}-${level.value ?? ''}`} style={dataRowStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <div style={rowTitleStyle}>{level.name || 'Level'}</div>
                      <div style={mutedTextStyle}>
                        {[
                          level.position,
                          level.direction ? `${level.direction}` : '',
                          level.role,
                          level.distance_pct !== undefined ? formatPercent(level.distance_pct) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div style={monoTextStyle}>{formatNumber(level.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={locale === 'zh-CN' ? '策略证据' : 'Strategy evidence'}
            meta={String(strategyKpis.length)}
          >
            {strategyKpis.length === 0 ? (
              <div style={emptyStateDarkStyle}>
                {locale === 'zh-CN' ? '暂无策略证据。' : 'No strategy evidence.'}
              </div>
            ) : (
              <div style={compactListStyle}>
                {strategyKpis.slice(0, 5).map((row, index) => (
                  <div key={`${compactText(row.kpi_id, 'kpi')}-${index}`} style={dataRowStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <div style={rowTitleStyle}>
                        {strategyKpiLabel(row)}
                      </div>
                      <div style={mutedTextStyle}>
                        {[compactText(row.status), compactText(row.trend)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div style={monoTextStyle}>
                      {compactText(row.value, 'N/A')}
                      {compactText(row.unit) ? ` ${compactText(row.unit)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={locale === 'zh-CN' ? '数据源状态' : 'Data source status'}
            meta={String(sourceConfidence.length)}
          >
            {sourceConfidence.length === 0 ? (
              <div style={emptyStateDarkStyle}>
                {locale === 'zh-CN' ? '暂无数据源状态。' : 'No data source status.'}
              </div>
            ) : (
              <div style={compactListStyle}>
                {sourceConfidence.slice(0, 5).map((row, index) => (
                  <div key={`${compactText(row.source_id, 'source')}-${index}`} style={dataRowStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <div style={rowTitleStyle}>
                        {sourceConfidenceLabel(row)}
                      </div>
                      <div style={mutedTextStyle}>
                        {[compactText(row.status), compactText(row.summary)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div style={monoTextStyle}>{formatConfidence(row.confidence)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <div style={terminalPanelStyle}>
      <div style={panelHeaderStyle}>
        <div style={panelTitleStyle}>{title}</div>
        {meta ? <div style={mutedTextStyle}>{meta}</div> : null}
      </div>
      {children}
    </div>
  )
}

function WatchlistTabbedTable({
  locale,
  activeTab,
  onTabChange,
  groups,
  rows,
  target,
  rangeColumns,
  emptyText,
  onSelect,
}: {
  locale: LongclawLocale
  activeTab: WatchlistTabKey
  onTabChange: (tab: WatchlistTabKey) => void
  groups: {
    macro_indices: WatchlistRow[]
    sector_boards: WatchlistRow[]
    focus_stocks: WatchlistRow[]
    legacy: WatchlistRow[]
  }
  rows: WatchlistRow[]
  target: ChartTarget
  rangeColumns: WatchlistRangeColumn[]
  emptyText: string
  onSelect: (row: WatchlistRow) => void
}) {
  const tabs: Array<{ key: WatchlistTabKey; label: string; count: number }> = [
    {
      key: 'macro_indices',
      label: locale === 'zh-CN' ? '宏观指数' : 'Macro',
      count: groups.macro_indices.length,
    },
    {
      key: 'sector_boards',
      label: locale === 'zh-CN' ? '异动板块' : 'Hot boards',
      count: groups.sector_boards.length,
    },
    {
      key: 'focus_stocks',
      label: locale === 'zh-CN' ? '关注个股' : 'Stocks',
      count: groups.focus_stocks.length,
    },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <div style={watchlistTabsStyle}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            style={tab.key === activeTab ? watchlistTabButtonActiveStyle : watchlistTabButtonStyle}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>
      <WatchlistTable
        rows={rows}
        target={target}
        rangeColumns={rangeColumns}
        emptyText={emptyText}
        onSelect={onSelect}
      />
    </div>
  )
}

function WatchlistTable({
  rows,
  target,
  rangeColumns,
  emptyText,
  onSelect,
}: {
  rows: WatchlistRow[]
  target: ChartTarget
  rangeColumns: WatchlistRangeColumn[]
  emptyText: string
  onSelect: (row: WatchlistRow) => void
}) {
  if (rows.length === 0) {
    return <div style={emptyStateDarkStyle}>{emptyText}</div>
  }
  const gridTemplateColumns = `minmax(132px, 1.35fr) 58px 52px 76px repeat(${rangeColumns.length}, 56px)`
  const headerRowStyle = { ...watchlistGridRowStyle, gridTemplateColumns }
  const buttonRowStyle = { ...watchlistButtonRowStyle, gridTemplateColumns }
  const activeButtonRowStyle = { ...watchlistButtonActiveRowStyle, gridTemplateColumns }
  return (
    <div style={watchlistTableStyle}>
      <div style={headerRowStyle}>
        <div style={watchlistNameHeaderCellStyle}>标的</div>
        <div style={watchlistHeaderCellStyle}>最新</div>
        <div style={watchlistHeaderCellStyle}>日</div>
        <div style={watchlistHeaderCellStyle}>信号</div>
        {rangeColumns.map(column => (
          <div key={column.key} style={watchlistHeaderCellStyle}>{column.label}</div>
        ))}
      </div>
      {rows.map(row => {
        const active = watchlistRowIsActive(row, target)
        return (
          <button
            key={row.id}
            type="button"
            style={active ? activeButtonRowStyle : buttonRowStyle}
            onClick={() => onSelect(row)}
          >
            <div style={watchlistNameCellStyle}>
              <div style={watchlistNameStyle}>{row.name}</div>
              <div style={watchlistSubStyle}>
                {[row.typeLabel, row.code, ...row.tags].filter(Boolean).join(' · ')}
              </div>
              {row.explanation || row.traderAction ? (
                <div style={watchlistSubStyle}>
                  {[row.traderAction, row.explanation].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>
            <div style={watchlistCellStyle}>{row.latest}</div>
            <div style={{ ...watchlistCellStyle, ...percentTone(row.dayChange) }}>{row.dayChange}</div>
            <div style={watchlistCellStyle}>
              {row.signalBadges.length > 0 ? (
                <span style={signalBadgeRowStyle}>
                  {row.signalBadges.slice(0, 4).map(badge => (
                    <span
                      key={`${row.id}-${badge.side}-${badge.label}`}
                      style={badge.side === 'sell' ? miniSellSignalBadgeStyle : badge.side === 'buy' ? miniSignalBadgeStyle : miniNeutralSignalBadgeStyle}
                    >
                      {badge.label}
                    </span>
                  ))}
                </span>
              ) : (
                row.signal || 'N/A'
              )}
            </div>
            {row.rangeValues.map((value, index) => (
              <div key={`${row.id}-range-${index}`} style={{ ...watchlistCellStyle, ...percentTone(value) }}>
                {value}
              </div>
            ))}
          </button>
        )
      })}
    </div>
  )
}

function TargetRows({
  rows,
  emptyText,
  onSelect,
}: {
  rows: Record<string, unknown>[]
  emptyText: string
  onSelect: (row: Record<string, unknown>) => void
}) {
  if (rows.length === 0) {
    return <div style={emptyStateDarkStyle}>{emptyText}</div>
  }
  return (
    <div style={compactListStyle}>
      {rows.slice(0, 8).map((row, index) => {
        const label = labelForTarget(row)
        return (
          <button
            key={`${label || 'target'}-${index}`}
            type="button"
            style={targetButtonStyle}
            onClick={() => onSelect(row)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={rowTitleStyle}>
                {compactText(row.name) || label || 'N/A'}
              </div>
              <div style={monoTextStyle}>
                {compactText(row.fused_total) || compactText(row.total_score) || compactText(row.score)}
              </div>
            </div>
            <div style={mutedTextStyle}>
              {[
                compactText(row.symbol) || compactText(row.code),
                compactText(row.representative_type),
                compactText(row.relation),
                compactText(row.source),
                compactText(row.direction),
                compactText(row.reason),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FallbackList({
  locale,
  title,
  rows,
  onOpen,
}: {
  locale: LongclawLocale
  title: string
  rows: Record<string, unknown>[]
  onOpen: (row: Record<string, unknown>) => void
}) {
  return (
    <Panel title={title} meta={String(rows.length)}>
      {rows.length === 0 ? (
        <div style={emptyStateDarkStyle}>
          {locale === 'zh-CN' ? '暂无数据。' : 'No data.'}
        </div>
      ) : (
        <div style={compactListStyle}>
          {rows.slice(0, 8).map((row, index) => (
            <button
              key={`${title}-${index}`}
              type="button"
              style={targetButtonStyle}
              onClick={() => onOpen(row)}
            >
              <div style={rowTitleStyle}>
                {compactText(row.name) ||
                  compactText(row.symbol) ||
                  humanizeTokenLocale(locale, compactText(row.connector_id)) ||
                  'N/A'}
              </div>
              <div style={mutedTextStyle}>
                {[
                  compactText(row.status)
                    ? humanizeTokenLocale(locale, compactText(row.status))
                    : '',
                  compactText(row.direction),
                  localizeSystemText(locale, compactText(row.summary)),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}
