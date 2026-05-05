import React from 'react'

import type {
  LongclawOperatorAction,
  SignalsDashboard,
} from '../../../../src/services/longclawControlPlane/models.js'
import {
  buttonStyleForState,
  chromeStyles,
  palette,
  primaryButtonStyle,
  secondaryButtonStyle,
  statusBadgeStyle,
  surfaceStyles,
  utilityStyles,
} from '../designSystem.js'
import { type LongclawLocale, humanizeTokenLocale } from '../i18n.js'
import { PackListSection, Section } from './shared.js'

type AIFactorFactoryWorkspaceProps = {
  locale: LongclawLocale
  dashboard: SignalsDashboard | null
  signalsWebBaseUrl?: string
  onOpenRecord: (
    title: string,
    record: Record<string, unknown>,
    actions?: LongclawOperatorAction[],
  ) => void
  onRunAction?: (action: LongclawOperatorAction) => Promise<void>
}

type AIFactorRecord = Record<string, unknown> & {
  factor_id: string
  title: string
  thesis: string
  status: string
  last_verified_at: string
  sample_count: number
  win_rate: number
  avg_return: number
  max_adverse_excursion: number
  verified: boolean
  ic: number
  rank_ic: number
  long_short_return: number
  turnover: number
  live_enabled: boolean
  draft: string
  validation_summary: string
  ai_explanation: string
  live_status: string
  reproducibility_summary: string
  paper_account: Record<string, unknown>
  draft_items: Array<{ label: string; value: string }>
  workflow: ResearchWorkflow
  portfolio: PortfolioConstruction
  failure_samples: Array<Record<string, unknown>>
}

type ResearchSignal = {
  name: string
  layer: string
  source: string
  definition: string
}

type ResearchEvent = {
  operate: string
  signals_all: string[]
  signals_any: string[]
  signals_not: string[]
  next: string
}

type ResearchLifecycleStep = {
  state: string
  action: string
  gate: string
}

type ResearchWorkflow = {
  signals: ResearchSignal[]
  event: ResearchEvent
  trade_observation: Record<string, string>
  lifecycle: ResearchLifecycleStep[]
  local_simulation: Record<string, string>
}

type WorkflowStageKey = 'idea' | 'signals' | 'event' | 'validation' | 'lifecycle'

type PortfolioLeg = {
  group: string
  symbols: string[]
  weight: number
  role: string
}

type PortfolioConstruction = {
  us_trigger_basket: PortfolioLeg[]
  cn_reaction_basket: PortfolioLeg[]
  mapping_rule: string
  signal_formula: string
  rebalance: string
  portfolio_role: string
}

type AIFactorFactoryPayload = Record<string, unknown> & {
  ideas?: unknown
  factors?: unknown
  drafts?: unknown
  validation_results?: unknown
  failure_samples?: unknown
  live_status?: unknown
}

type ActionRunState = {
  actionKey: string
  label: string
  state: 'running' | 'completed' | 'failed'
  message: string
}

const factoryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(310px, 0.9fr) minmax(410px, 1.25fr) minmax(320px, 0.92fr)',
  gap: 12,
  alignItems: 'start',
}

const workspaceStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const intakeShellStyle: React.CSSProperties = {
  ...surfaceStyles.section,
  display: 'grid',
  gridTemplateColumns: 'minmax(420px, 1.12fr) minmax(380px, 0.88fr)',
  gap: 12,
  alignItems: 'stretch',
}

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const compactColumnStyle: React.CSSProperties = {
  ...columnStyle,
  gap: 8,
}

const ideaCardStyle: React.CSSProperties = {
  ...surfaceStyles.listRow,
  ...surfaceStyles.listRowInteractive,
  flexDirection: 'column',
  cursor: 'pointer',
}

const activeIdeaCardStyle: React.CSSProperties = {
  ...ideaCardStyle,
  borderColor: 'rgba(208, 138, 84, 0.44)',
  background: 'rgba(208, 138, 84, 0.08)',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 10,
  width: '100%',
}

const titleBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
}

const cardTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.3,
}

const metricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  width: '100%',
}

const metricCellStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  background: palette.stone,
  padding: '8px 9px',
  minWidth: 0,
}

const compactMetricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
}

const metricValueStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 16,
  fontWeight: 750,
  lineHeight: 1.15,
  fontVariantNumeric: 'tabular-nums',
}

const panelBlockStyle: React.CSSProperties = {
  ...surfaceStyles.mutedSection,
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const ticketInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 96,
  resize: 'vertical',
  boxSizing: 'border-box',
  border: `1px solid ${palette.borderStrong}`,
  borderRadius: 8,
  background: palette.stone,
  color: palette.ink,
  padding: '11px 12px',
  fontFamily: chromeStyles.subtleText.fontFamily,
  fontSize: 14,
  lineHeight: 1.5,
  outline: 'none',
}

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
}

const fieldBoxStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  background: palette.panel,
  padding: '9px 10px',
  minWidth: 0,
}

const fieldLabelStyle: React.CSSProperties = {
  ...chromeStyles.quietMeta,
  fontWeight: 700,
}

const fieldValueStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 13,
  lineHeight: 1.45,
  marginTop: 4,
}

const stepGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 8,
}

const stepBoxStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  background: palette.panel,
  padding: '9px 10px',
  minWidth: 0,
}

const stepNumberStyle: React.CSSProperties = {
  color: palette.copper,
  fontFamily: chromeStyles.monoMeta.fontFamily,
  fontSize: 11,
  fontWeight: 800,
}

const stepLabelStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.25,
  marginTop: 3,
}

const checklistStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
}

const checklistRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'start',
  color: palette.textMuted,
  fontSize: 13,
  lineHeight: 1.45,
}

const checkDotStyle = (passed: boolean): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: 999,
  marginTop: 5,
  background: passed ? palette.success : palette.warning,
  boxShadow: passed ? '0 0 0 3px rgba(89, 217, 142, 0.12)' : '0 0 0 3px rgba(242, 184, 91, 0.12)',
})

const portfolioGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const basketPanelStyle: React.CSSProperties = {
  ...surfaceStyles.mutedSection,
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
}

const basketHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const basketTitleStyle: React.CSSProperties = {
  color: palette.ink,
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.25,
}

const basketLegStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(90px, 0.72fr) minmax(120px, 1.1fr) 52px',
  gap: 8,
  alignItems: 'start',
  borderTop: `1px solid ${palette.border}`,
  paddingTop: 8,
}

const symbolPillRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
}

const symbolPillStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 999,
  color: palette.ink,
  background: palette.stone,
  padding: '3px 7px',
  fontFamily: chromeStyles.monoMeta.fontFamily,
  fontSize: 11,
  lineHeight: 1.1,
}

const formulaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 8,
}

const workflowPanelStyle: React.CSSProperties = {
  ...surfaceStyles.section,
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 0.72fr) minmax(420px, 1.28fr)',
  gap: 12,
  alignItems: 'stretch',
}

const workflowStageListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const workflowStageButtonStyle = (active: boolean): React.CSSProperties => ({
  ...surfaceStyles.listRow,
  ...surfaceStyles.listRowInteractive,
  cursor: 'pointer',
  textAlign: 'left',
  borderColor: active ? 'rgba(208, 138, 84, 0.46)' : palette.border,
  background: active ? 'rgba(208, 138, 84, 0.10)' : palette.panel,
})

const workflowContentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
}

const workflowWideGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
}

const validationDetailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
  gap: 8,
}

const paragraphStyle: React.CSSProperties = {
  ...chromeStyles.subtleText,
  margin: 0,
  whiteSpace: 'pre-wrap',
}

const inlineMetaStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

const actionRowStyle: React.CSSProperties = {
  ...utilityStyles.buttonCluster,
  marginTop: 2,
}

const fallbackFactor: AIFactorRecord = {
  factor_id: 'fallback-ai-hardware-cpo-memory',
  title: '美股 AI 硬件 -> A股光模块/CPO/存储联动因子',
  thesis:
    '跟踪美股 AI 硬件链的隔夜强度、订单/资本开支线索与 A 股光模块、CPO、存储方向的开盘承接和量价确认。',
  status: 'idea',
  last_verified_at: '未验证',
  sample_count: 0,
  win_rate: 0,
  avg_return: 0,
  max_adverse_excursion: 0,
  verified: false,
  ic: 0,
  rank_ic: 0,
  long_short_return: 0,
  turnover: 0,
  live_enabled: false,
  draft:
    '输入：NVDA/AMD/AVGO/SMCI 组合隔夜收益、SOX 指数强度、AI server 供应链新闻强度；映射：A 股光模块、CPO、HBM/存储、PCB 代表板块；触发：美股硬件强势且 A 股开盘 30 分钟放量承接。',
  validation_summary:
    '未运行验证。样本数、胜率、收益、IC 和失败样本必须来自 Signals 验证 artifact。',
  ai_explanation:
    'AI 解释重点不是给单票结论，而是把海外硬件景气变化转成 A 股产业链观察假设，并要求盘中量价确认后才进入观察池。',
  live_status: 'not_verified',
  reproducibility_summary:
    'US T close 只能影响 A股 T+1 及之后；验证需固定数据快照、交易日历、成本、滑点和股票池。',
  paper_account: {
    enabled: false,
    mode: 'observe_only',
    no_auto_order: true,
    estimated_exposure: 0,
    tracks: ['position_exposure', 'paper_pnl', 'drawdown', 'hit_rate'],
  },
  failure_samples: [],
  draft_items: [
    {
      label: '标的池',
      value: 'A股光模块、CPO、存储/HBM、PCB、算力链高暴露股票池',
    },
    {
      label: '触发',
      value: '美股 AI 硬件链 T 日收盘强势后，A股相关池 T+1 开盘承接或盘中放量确认',
    },
    {
      label: '失效',
      value: '海外映射反转、A股板块退潮、个股高开低走、系统性风险覆盖',
    },
  ],
  workflow: {
    signals: [
      {
        name: 'us_ai_hardware_strength',
        layer: 'signal',
        source: 'US trigger basket',
        definition: 'NVDA/AMD/AVGO/SMCI 与 SOX/QQQ 的隔夜超额、上涨宽度和新闻强度，T 日收盘后定格。',
      },
      {
        name: 'cn_opening_acceptance',
        layer: 'signal',
        source: 'A-share reaction basket',
        definition: 'A股光模块/CPO/存储/PCB/算力池 T+1 开盘不过热，并出现回踩承接或盘中放量确认。',
      },
      {
        name: 'risk_filter',
        layer: 'signals_not',
        source: 'market risk',
        definition: '海外映射反转、指数宽度恶化、板块退潮或个股高开低走时禁止进入观察。',
      },
    ],
    event: {
      operate: 'LO',
      signals_all: ['us_ai_hardware_strength', 'cn_opening_acceptance'],
      signals_any: ['volume_confirmation', 'opening_pullback_support'],
      signals_not: ['risk_filter'],
      next: 'event true -> paper observation only',
    },
    trade_observation: {
      position: 'watch_pool_candidate',
      entry: '进入盘前池或盘中提醒，不生成自动下单指令。',
      exit: '失效条件触发后停用，或回到研究修正失败样本。',
    },
    lifecycle: [
      { state: 'created', action: '保存因子想法、标的池和参数', gate: 'factor_id 唯一，参数可复现' },
      { state: 'inited', action: '固定数据快照、交易日历、成本、滑点和 as-of 边界', gate: 'US T close 只能影响 A股 T+1' },
      { state: 'validated', action: '运行 T+1/T+5/T+10/T+20、IC、分层收益、MFE/MAE、失败样本', gate: '有验证 artifact 和样本数' },
      { state: 'trading_false', action: '通过门禁后进入 paper factor account', gate: '只观察，不自动交易' },
      { state: 'disabled', action: '失败样本或失效条件触发后停用', gate: '不会污染策略页盘前池' },
    ],
    local_simulation: {
      data: 'Signals 本地数据快照；美股/A股日历按 as-of 固定。',
      account: 'paper factor account；记录模拟持仓、收益、回撤、暴露和换手。',
      portfolio: '美股篮子只做触发源，A股反应池才做观察组合。',
      storage: '实验账本写入 ai_factor_experiment_ledger，发布门禁写入 strategy_snapshot 前。',
    },
  },
  portfolio: {
    us_trigger_basket: [
      { group: 'GPU/加速卡', symbols: ['NVDA', 'AMD'], weight: 0.35, role: 'AI 算力需求和估值锚' },
      { group: 'ASIC/网络', symbols: ['AVGO', 'ANET'], weight: 0.25, role: 'AI 集群网络与专用芯片景气' },
      { group: '服务器/OEM', symbols: ['SMCI', 'DELL'], weight: 0.20, role: 'AI server 订单和交付弹性' },
      { group: '指数校准', symbols: ['SOX', 'QQQ'], weight: 0.20, role: '剔除半导体/纳指 beta' },
    ],
    cn_reaction_basket: [
      { group: '光模块/CPO', symbols: ['concept:光模块', 'concept:CPO'], weight: 0.35, role: '高速光互联映射' },
      { group: '存储/HBM', symbols: ['concept:存储芯片', 'concept:HBM'], weight: 0.25, role: 'AI 服务器存储链映射' },
      { group: 'PCB/连接', symbols: ['concept:PCB', 'concept:高速连接器'], weight: 0.20, role: '服务器材料侧映射' },
      { group: '算力基础设施', symbols: ['concept:液冷', 'concept:数据中心'], weight: 0.20, role: '本地算力链情绪扩散' },
    ],
    mapping_rule: '美股触发篮子先算相对强度，再映射到 A股产业链暴露；A股必须用 T+1 开盘承接或盘中量价确认二次过滤。',
    signal_formula: 'us_strength = 0.45*AI硬件等权超额 + 0.25*SOX超额 + 0.20*上涨家数宽度 + 0.10*订单/新闻强度；cn_score = 产业链暴露权重 * T+1承接确认 * 放量确认。',
    rebalance: '日频；US T 日收盘定格，美股信号只允许影响 A股 T+1 及之后。',
    portfolio_role: '触发篮子只负责方向和强度，反应篮子才进入观察池；两者都不是自动下单组合。',
  },
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
    : []
}

function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return fallback
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'enabled', 'active', 'live'].includes(normalized)) return true
    if (['false', 'no', 'disabled', 'inactive', 'paper_only'].includes(normalized)) return false
  }
  return fallback
}

function stringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => textValue(item)).filter(Boolean)
  }
  const text = textValue(value)
  return text ? text.split(/[,\n/]+/).map(item => item.trim()).filter(Boolean) : []
}

function joinedText(value: unknown, fallback = ''): string {
  if (Array.isArray(value)) {
    return value.map(item => textValue(item)).filter(Boolean).join('\n')
  }
  return textValue(value, fallback)
}

function draftText(value: unknown, fallback: string): string {
  const draft = asRecord(value)
  if (Object.keys(draft).length === 0) return textValue(value, fallback)
  const parts = [
    ['为什么有效', draft.why_effective ?? draft.why],
    ['哪些股票适用', draft.target_universe ?? draft.universe],
    ['什么时候触发', draft.trigger_condition ?? draft.trigger],
    ['什么时候回避', draft.avoid_condition ?? draft.avoid],
    ['什么时候失效', draft.invalidation_condition ?? draft.invalidation],
    ['历史证明如何', draft.proof ?? draft.historical_proof],
  ]
    .map(([label, content]) => {
      const text = textValue(content)
      return text ? `${label}: ${text}` : ''
    })
    .filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : fallback
}

function draftItems(value: unknown, fallback: AIFactorRecord['draft_items']): AIFactorRecord['draft_items'] {
  const draft = asRecord(value)
  if (Object.keys(draft).length === 0) return fallback
  const items = [
    ['为什么有效', draft.why_effective ?? draft.why],
    ['标的池', draft.target_universe ?? draft.universe],
    ['触发', draft.trigger_condition ?? draft.trigger],
    ['回避', draft.avoid_condition ?? draft.avoid],
    ['失效', draft.invalidation_condition ?? draft.invalidation],
    ['历史证明', draft.proof ?? draft.historical_proof],
  ]
    .map(([label, content]) => ({
      label: String(label),
      value: textValue(content),
    }))
    .filter(item => item.value)
  return items.length > 0 ? items : fallback
}

function normalizePortfolioLegs(value: unknown, fallback: PortfolioLeg[]): PortfolioLeg[] {
  const rows = asRecordArray(value)
  if (rows.length === 0) return fallback
  return rows.map((row, index) => ({
    group: textValue(row.group ?? row.name ?? row.label, fallback[index]?.group ?? `group-${index + 1}`),
    symbols: stringArrayValue(row.symbols ?? row.tickers ?? row.codes ?? row.concepts),
    weight: numberValue(row.weight ?? row.target_weight, fallback[index]?.weight ?? 0),
    role: textValue(row.role ?? row.reason ?? row.description, fallback[index]?.role ?? ''),
  }))
}

function normalizePortfolio(value: unknown): PortfolioConstruction {
  const raw = asRecord(value)
  const fallback = fallbackFactor.portfolio
  return {
    us_trigger_basket: normalizePortfolioLegs(raw.us_trigger_basket ?? raw.us_basket, fallback.us_trigger_basket),
    cn_reaction_basket: normalizePortfolioLegs(raw.cn_reaction_basket ?? raw.cn_basket, fallback.cn_reaction_basket),
    mapping_rule: textValue(raw.mapping_rule, fallback.mapping_rule),
    signal_formula: textValue(raw.signal_formula ?? raw.formula, fallback.signal_formula),
    rebalance: textValue(raw.rebalance ?? raw.frequency, fallback.rebalance),
    portfolio_role: textValue(raw.portfolio_role ?? raw.role, fallback.portfolio_role),
  }
}

function normalizeTextRecord(value: unknown, fallback: Record<string, string>): Record<string, string> {
  const raw = asRecord(value)
  const normalized = Object.entries(raw).reduce<Record<string, string>>((acc, [key, item]) => {
    const text = textValue(item)
    if (text) acc[key] = text
    return acc
  }, {})
  return Object.keys(normalized).length > 0 ? normalized : fallback
}

function normalizePaperAccount(value: unknown, verified: boolean): Record<string, unknown> {
  const raw = asRecord(value)
  const tracks = stringArrayValue(raw.tracks)
  return {
    ...raw,
    enabled: booleanValue(raw.enabled, verified),
    mode: textValue(raw.mode, verified ? 'paper_observation' : 'observe_only'),
    no_auto_order: booleanValue(raw.no_auto_order, true),
    estimated_exposure: numberValue(raw.estimated_exposure, 0),
    tracks: tracks.length > 0
      ? tracks
      : ['position_exposure', 'paper_pnl', 'drawdown', 'hit_rate'],
  }
}

function normalizeResearchSignal(value: unknown, fallback: ResearchSignal): ResearchSignal {
  const raw = asRecord(value)
  return {
    name: textValue(raw.name ?? raw.id ?? raw.signal, fallback.name),
    layer: textValue(raw.layer ?? raw.type, fallback.layer),
    source: textValue(raw.source ?? raw.basket ?? raw.data, fallback.source),
    definition: textValue(raw.definition ?? raw.rule ?? raw.description, fallback.definition),
  }
}

function normalizeLifecycleStep(value: unknown, fallback: ResearchLifecycleStep): ResearchLifecycleStep {
  const raw = asRecord(value)
  return {
    state: textValue(raw.state ?? raw.name, fallback.state),
    action: textValue(raw.action ?? raw.description, fallback.action),
    gate: textValue(raw.gate ?? raw.condition, fallback.gate),
  }
}

function normalizeResearchWorkflow(value: unknown): ResearchWorkflow {
  const raw = asRecord(value)
  const fallback = fallbackFactor.workflow
  const czscLayer = asRecord(raw.czsc_signal_event_trade ?? raw.czsc ?? raw.signal_event_trade)
  const event = asRecord(czscLayer.event ?? raw.event)
  const signals = asRecordArray(czscLayer.signals ?? raw.signals)
  const lifecycle = asRecordArray(raw.vnpy_lifecycle ?? raw.lifecycle)

  return {
    signals: signals.length > 0
      ? signals.map((signal, index) => normalizeResearchSignal(signal, fallback.signals[index] ?? fallback.signals[0]))
      : fallback.signals,
    event: {
      operate: textValue(event.operate ?? event.operation, fallback.event.operate),
      signals_all: stringArrayValue(event.signals_all ?? event.all).length > 0
        ? stringArrayValue(event.signals_all ?? event.all)
        : fallback.event.signals_all,
      signals_any: stringArrayValue(event.signals_any ?? event.any).length > 0
        ? stringArrayValue(event.signals_any ?? event.any)
        : fallback.event.signals_any,
      signals_not: stringArrayValue(event.signals_not ?? event.not).length > 0
        ? stringArrayValue(event.signals_not ?? event.not)
        : fallback.event.signals_not,
      next: textValue(event.next ?? event.result, fallback.event.next),
    },
    trade_observation: normalizeTextRecord(
      czscLayer.trade_observation ?? raw.trade_observation,
      fallback.trade_observation,
    ),
    lifecycle: lifecycle.length > 0
      ? lifecycle.map((step, index) => normalizeLifecycleStep(step, fallback.lifecycle[index] ?? fallback.lifecycle[0]))
      : fallback.lifecycle,
    local_simulation: normalizeTextRecord(
      raw.quantaxis_local_simulation ?? raw.local_simulation,
      fallback.local_simulation,
    ),
  }
}

function percentText(value: number): string {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value
  return `${normalized.toFixed(1)}%`
}

function signedPercentText(value: number): string {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value
  const prefix = normalized > 0 ? '+' : ''
  return `${prefix}${normalized.toFixed(1)}%`
}

type FactorActionKey = 'draft' | 'validate' | 'failures' | 'publish' | 'disable'

function factorAction(
  actionKey: FactorActionKey,
  label: string,
  factor: AIFactorRecord,
  payloadOverrides: Record<string, unknown> = {},
): LongclawOperatorAction {
  const apiActionId = `pack:signals:ai_factor:${actionKey}`
  return {
    action_id: actionKey === 'failures'
      ? `ai_factor_factory.${factor.factor_id}.${label}`
      : apiActionId,
    run_id: factor.factor_id,
    kind: actionKey === 'failures' ? 'open_record' : 'signals_api',
    label,
    payload: {
      factor_id: factor.factor_id,
      idea: factor.thesis,
      label,
      ...payloadOverrides,
      ...(actionKey === 'validate' ? { demo_mode: true, mode: 'demo' } : {}),
      ...(actionKey === 'publish' ? { live_enabled: true } : {}),
    },
    metadata: {
      workspace: 'ai_factor_factory',
      signals_web_base_url: factor.signals_web_base_url ?? '',
      endpoint: actionKey === 'failures'
        ? ''
        : `/api/strategy/ai-factor-factory/${actionKey === 'publish' ? 'publish' : actionKey}`,
    },
  }
}

function normalizeFactor(raw: Record<string, unknown>, index: number): AIFactorRecord {
  const failureSamples = asRecordArray(
    raw.failure_samples ?? raw.failures ?? raw.failed_samples ?? raw.error_samples,
  )
  const metrics = asRecord(raw.metrics ?? raw.validation ?? raw.verification)
  const validation = asRecord(raw.validation)
  const reproducibility = asRecord(raw.reproducibility)
  const development = asRecord(raw.development)
  const feedback = asRecord(raw.feedback)
  const draftSource = raw.draft ?? raw.research ?? raw.factor_draft ?? raw.definition ?? raw.formula
  const sampleCount = numberValue(
    metrics.sample_count ?? metrics.samples ?? validation.sample_count ?? raw.sample_count ?? raw.samples ?? raw.n_samples,
    0,
  )
  const verified = booleanValue(
    metrics.verified ?? validation.verified,
    sampleCount > 0,
  )
  return {
    ...raw,
    factor_id: textValue(raw.factor_id ?? raw.id ?? raw.idea_id, `ai-factor-${index + 1}`),
    title: textValue(raw.title ?? raw.name ?? raw.summary, fallbackFactor.title),
    thesis: textValue(raw.thesis ?? raw.hypothesis ?? raw.description ?? raw.idea, fallbackFactor.thesis),
    status: textValue(raw.status ?? raw.state, 'idea'),
    last_verified_at: textValue(
      raw.last_verified_at ?? raw.last_validation_at ?? raw.updated_at,
      'N/A',
    ),
    sample_count: sampleCount,
    win_rate: numberValue(metrics.win_rate ?? raw.win_rate ?? raw.hit_rate, 0),
    avg_return: numberValue(
      metrics.avg_return_t5 ?? metrics.return_t5 ?? raw.avg_return ?? raw.average_return ?? raw.mean_return,
      0,
    ),
    max_adverse_excursion: numberValue(
      metrics.mae ?? raw.max_adverse_excursion ?? raw.mae ?? raw.max_drawdown,
      0,
    ),
    verified,
    ic: numberValue(metrics.ic ?? raw.ic, 0),
    rank_ic: numberValue(metrics.rank_ic ?? raw.rank_ic, 0),
    long_short_return: numberValue(metrics.long_short_return ?? raw.long_short_return, 0),
    turnover: numberValue(metrics.turnover ?? raw.turnover, 0),
    live_enabled: booleanValue(raw.live_enabled ?? raw.enabled ?? raw.live, false),
    draft: draftText(draftSource, fallbackFactor.draft),
    validation_summary: textValue(
      feedback.summary ?? metrics.summary ?? raw.validation_summary ?? raw.validation_result ?? raw.backtest_summary,
      verified
        ? '验证 artifact 已生成；指标来自 Signals 因子研发内核。'
        : '未运行验证。没有验证 artifact，因此不显示胜率和收益。',
    ),
    ai_explanation: joinedText(
      raw.ai_explanation ?? raw.explanation ?? raw.rationale,
      fallbackFactor.ai_explanation,
    ),
    live_status: textValue(
      raw.live_status ?? raw.production_status,
      verified
        ? (booleanValue(raw.live_enabled ?? raw.enabled ?? raw.live, false) ? 'live_enabled' : 'paper_only')
        : 'not_verified',
    ),
    reproducibility_summary: textValue(
      reproducibility.as_of_boundary ?? reproducibility.data_snapshot ?? raw.reproducibility_summary,
      fallbackFactor.reproducibility_summary,
    ),
    paper_account: normalizePaperAccount(raw.paper_account, verified),
    draft_items: draftItems(draftSource, fallbackFactor.draft_items),
    workflow: normalizeResearchWorkflow(raw.research_workflow ?? development.research_workflow),
    portfolio: normalizePortfolio(raw.portfolio_construction ?? development.portfolio_construction),
    failure_samples: failureSamples,
  }
}

function normalizeFactoryFactors(
  dashboard: SignalsDashboard | null,
  signalsWebBaseUrl?: string,
): AIFactorRecord[] {
  const rawFactoryValue = (dashboard as (SignalsDashboard & { ai_factor_factory?: unknown }) | null)
    ?.ai_factor_factory
  const rawFactory = asRecord(rawFactoryValue) as AIFactorFactoryPayload
  const rawFactors = [
    ...asRecordArray(rawFactoryValue),
    ...asRecordArray(rawFactory.ideas),
    ...asRecordArray(rawFactory.factors),
  ]

  const factors = rawFactors.length > 0
    ? rawFactors.map(normalizeFactor)
    : [{ ...fallbackFactor }]
  const seen = new Set<string>()
  const uniqueFactors = factors.filter(factor => {
    if (seen.has(factor.factor_id)) return false
    seen.add(factor.factor_id)
    return true
  })

  return uniqueFactors.map(factor => ({
    ...factor,
    signals_web_base_url: signalsWebBaseUrl ?? '',
  }))
}

function hasFactorPayload(record: Record<string, unknown>): boolean {
  return Boolean(
    textValue(record.factor_id ?? record.id ?? record.idea_id) ||
      Object.prototype.hasOwnProperty.call(record, 'metrics') ||
      Object.prototype.hasOwnProperty.call(record, 'validation') ||
      Object.prototype.hasOwnProperty.call(record, 'draft') ||
      Object.prototype.hasOwnProperty.call(record, 'research') ||
      Object.prototype.hasOwnProperty.call(record, 'paper_account') ||
      Object.prototype.hasOwnProperty.call(record, 'failure_samples'),
  )
}

function actionRunKey(action: LongclawOperatorAction): string {
  const payload = asRecord(action.payload)
  return `${action.action_id}:${textValue(payload.factor_id, action.run_id)}`
}

function factorRecordFromActionResult(
  result: Record<string, unknown>,
  action: LongclawOperatorAction,
): Record<string, unknown> {
  const root = asRecord(result)
  const nestedResult = asRecord(root.result)
  const candidates = [
    asRecord(nestedResult.factor),
    asRecord(nestedResult.factor_doc),
    asRecord(nestedResult.report),
    asRecord(nestedResult.data),
    nestedResult,
    asRecord(root.factor),
    asRecord(root.factor_doc),
    asRecord(root.report),
    asRecord(root.data),
    root,
  ]
  const payload = asRecord(action.payload)
  const candidate = candidates.find(hasFactorPayload) ?? {}
  return {
    ...candidate,
    factor_id: textValue(candidate.factor_id ?? candidate.id ?? candidate.idea_id ?? payload.factor_id, action.run_id),
  }
}

function mergeFactorPayload(
  base: AIFactorRecord | undefined,
  payload: Record<string, unknown>,
  index: number,
): AIFactorRecord {
  const merged = {
    ...(base ?? {}),
    ...payload,
    metrics: {
      ...asRecord(base?.metrics),
      ...asRecord(payload.metrics),
    },
    validation: {
      ...asRecord(base?.validation),
      ...asRecord(payload.validation),
    },
    reproducibility: {
      ...asRecord(base?.reproducibility),
      ...asRecord(payload.reproducibility),
    },
    paper_account: {
      ...asRecord(base?.paper_account),
      ...asRecord(payload.paper_account),
    },
    development: {
      ...asRecord(base?.development),
      ...asRecord(payload.development),
    },
  }
  return normalizeFactor(merged, index)
}

function mergeFactorOverrides(
  baseFactors: AIFactorRecord[],
  overrides: Record<string, AIFactorRecord>,
): AIFactorRecord[] {
  const merged = new Map<string, AIFactorRecord>()
  baseFactors.forEach((factor, index) => {
    merged.set(factor.factor_id, mergeFactorPayload(factor, {}, index))
  })
  Object.values(overrides).forEach((override, index) => {
    const existing = merged.get(override.factor_id)
    merged.set(
      override.factor_id,
      existing ? mergeFactorPayload(existing, override, baseFactors.length + index) : override,
    )
  })
  return [...merged.values()]
}

function metricItems(factor: AIFactorRecord, locale: LongclawLocale) {
  const notVerified = locale === 'zh-CN' ? '未验证' : 'Unverified'
  const valueOrUnverified = (value: string) => factor.verified ? value : notVerified
  return [
    {
      label: locale === 'zh-CN' ? '最近验证' : 'Last verified',
      value: factor.verified ? factor.last_verified_at : notVerified,
    },
    {
      label: locale === 'zh-CN' ? '样本数' : 'Samples',
      value: factor.verified ? String(factor.sample_count) : notVerified,
    },
    {
      label: locale === 'zh-CN' ? '胜率' : 'Win rate',
      value: valueOrUnverified(percentText(factor.win_rate)),
    },
    {
      label: locale === 'zh-CN' ? 'T+5均值' : 'T+5 avg',
      value: valueOrUnverified(signedPercentText(factor.avg_return)),
    },
    {
      label: locale === 'zh-CN' ? 'Rank IC' : 'Rank IC',
      value: valueOrUnverified(factor.rank_ic.toFixed(3)),
    },
    {
      label: locale === 'zh-CN' ? '多空分位差' : 'Long-short',
      value: valueOrUnverified(signedPercentText(factor.long_short_return)),
    },
    {
      label: locale === 'zh-CN' ? 'MAE' : 'MAE',
      value: valueOrUnverified(signedPercentText(factor.max_adverse_excursion)),
    },
    {
      label: locale === 'zh-CN' ? '实盘启用' : 'Live',
      value: factor.live_enabled
        ? locale === 'zh-CN' ? '已启用' : 'Enabled'
        : locale === 'zh-CN' ? '未启用' : 'Disabled',
    },
  ]
}

function actionLabels(locale: LongclawLocale) {
  if (locale !== 'zh-CN') {
    return {
      draft: 'Generate draft',
      validate: 'Run validation',
      failures: 'Failure samples',
      observe: 'Add to watch pool',
      disable: 'Disable factor',
    }
  }
  return {
    draft: '生成因子草稿',
    validate: '运行验证',
    failures: '查看失败样本',
    observe: '加入观察池',
    disable: '停用因子',
  }
}

function researchSteps(locale: LongclawLocale): Array<{ id: WorkflowStageKey; label: string; detail: string }> {
  if (locale !== 'zh-CN') {
    return [
      { id: 'idea', label: 'Idea', detail: 'Trading hypothesis' },
      { id: 'signals', label: 'Signals', detail: 'czsc atomic signals' },
      { id: 'event', label: 'Event', detail: 'all / any / not' },
      { id: 'validation', label: 'Validation', detail: 'Alphalens-style evidence' },
      { id: 'lifecycle', label: 'Lifecycle', detail: 'init / observe / disable' },
    ]
  }
  return [
    { id: 'idea', label: '写想法', detail: '交易假设' },
    { id: 'signals', label: '信号层', detail: 'czsc 原子信号' },
    { id: 'event', label: '事件层', detail: 'all / any / not' },
    { id: 'validation', label: '验证层', detail: '分层与失败样本' },
    { id: 'lifecycle', label: '生命周期', detail: '初始化/观察/停用' },
  ]
}

function intakeFields(factor: AIFactorRecord, locale: LongclawLocale) {
  const items = factor.draft_items.length > 0 ? factor.draft_items : fallbackFactor.draft_items
  const first = (label: string, fallback: string) => (
    items.find(item => item.label.includes(label))?.value ?? fallback
  )
  if (locale !== 'zh-CN') {
    return [
      { label: 'Universe', value: first('标的池', 'CN optical/CPO/memory/PCB/AI compute chain') },
      { label: 'Trigger', value: first('触发', 'US AI hardware strength, then CN T+1 confirmation') },
      { label: 'Invalidation', value: first('失效', 'US reversal, CN theme fade, failed gap, systemic risk') },
    ]
  }
  return [
    { label: '股票池', value: first('标的池', 'A股光模块/CPO/存储/PCB/算力链') },
    { label: '触发条件', value: first('触发', '美股硬件强势后，A股 T+1 承接确认') },
    { label: '失效条件', value: first('失效', '海外反转、板块退潮、高开低走、系统性风险') },
  ]
}

function gateItems(factor: AIFactorRecord, locale: LongclawLocale) {
  const verified = factor.verified && factor.sample_count > 0
  const failuresReviewed = factor.failure_samples.length === 0 ? verified : false
  const approved = ['observable', 'published'].includes(factor.status) || factor.live_enabled
  if (locale !== 'zh-CN') {
    return [
      { label: 'Validation artifact exists', passed: verified },
      { label: 'Failure samples reviewed', passed: failuresReviewed },
      { label: 'Trader approved observation', passed: approved },
      { label: 'No auto-order instruction', passed: true },
    ]
  }
  return [
    { label: '已有验证 artifact 和样本数', passed: verified },
    { label: '失败样本已复核并形成边界', passed: failuresReviewed },
    { label: '交易员允许进入观察池', passed: approved },
    { label: 'AI 不产生自动下单指令', passed: true },
  ]
}

function FactorActionButton({
  actionKey,
  label,
  factor,
  onOpenRecord,
  onRunAction,
  onActionStart,
  onActionResult,
  onActionError,
  payloadOverrides,
  tone = 'secondary',
  disabled = false,
  runningActionKey,
}: {
  actionKey: FactorActionKey
  label: string
  factor: AIFactorRecord
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  payloadOverrides?: Record<string, unknown>
  tone?: 'primary' | 'secondary'
  disabled?: boolean
  runningActionKey?: string
}) {
  const action = factorAction(actionKey, label, factor, payloadOverrides)
  const running = runningActionKey === actionRunKey(action)
  const buttonDisabled = disabled || running
  return (
    <button
      type="button"
      disabled={buttonDisabled}
      style={buttonStyleForState(
        tone === 'primary' ? primaryButtonStyle : secondaryButtonStyle,
        buttonDisabled,
        tone,
      )}
      onClick={() => {
        if (buttonDisabled) return
        onOpenRecord(label, { ...factor, requested_action: label }, [action])
        if (action.kind === 'signals_api') {
          void (async () => {
            const hasLocalHandlers = Boolean(onActionStart || onActionResult || onActionError)
            if (!hasLocalHandlers) {
              await onRunAction(action)
              return
            }
            onActionStart?.(action)
            try {
              const executeAction = typeof window !== 'undefined'
                ? window.longclawControlPlane?.executeAction
                : undefined
              const result = executeAction
                ? await executeAction(action.action_id, action.payload)
                : onRunAction
                  ? await onRunAction(action)
                  : {}
              onActionResult?.(
                action,
                result && typeof result === 'object' ? result as Record<string, unknown> : {},
              )
            } catch (error) {
              onActionError?.(action, error instanceof Error ? error.message : String(error))
            }
          })()
        }
      }}
    >
      {running ? `${label}...` : label}
    </button>
  )
}

function MetricGrid({
  factor,
  locale,
  compact = false,
}: {
  factor: AIFactorRecord
  locale: LongclawLocale
  compact?: boolean
}) {
  return (
    <div style={compact ? compactMetricGridStyle : metricGridStyle}>
      {metricItems(factor, locale).map(item => (
        <div key={item.label} style={metricCellStyle}>
          <div style={metricValueStyle}>{item.value}</div>
          <div style={chromeStyles.quietMeta}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function PaperAccountSummary({
  factor,
  locale,
}: {
  factor: AIFactorRecord
  locale: LongclawLocale
}) {
  const account = factor.paper_account
  const enabled = booleanValue(account.enabled, factor.verified)
  const mode = textValue(account.mode, factor.verified ? 'paper_observation' : 'observe_only')
  const noAutoOrder = booleanValue(account.no_auto_order, true)
  const exposure = numberValue(account.estimated_exposure, 0)
  const tracks = stringArrayValue(account.tracks)
  return (
    <div style={panelBlockStyle}>
      <div style={fieldLabelStyle}>{locale === 'zh-CN' ? 'paper account' : 'Paper account'}</div>
      <div style={inlineMetaStyle}>
        <span style={statusBadgeStyle(enabled ? 'active' : 'disabled')}>
          {enabled
            ? locale === 'zh-CN' ? '模拟观察已启用' : 'Paper observation on'
            : locale === 'zh-CN' ? '未启用' : 'Not enabled'}
        </span>
        <span style={statusBadgeStyle(noAutoOrder ? 'specified' : 'warning')}>
          {noAutoOrder
            ? locale === 'zh-CN' ? '不自动下单' : 'No auto-order'
            : locale === 'zh-CN' ? '需复核交易权限' : 'Review order permission'}
        </span>
      </div>
      <div style={fieldValueStyle}>
        <span style={chromeStyles.monoMeta}>{mode}</span>
        {exposure ? ` · exposure ${exposure.toFixed(4)}` : ''}
      </div>
      {tracks.length > 0 ? <TokenList tokens={tracks} /> : null}
    </div>
  )
}

function FailureSamplePreview({
  rows,
  locale,
}: {
  rows: Array<Record<string, unknown>>
  locale: LongclawLocale
}) {
  return (
    <div style={panelBlockStyle}>
      <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '失败样本' : 'Failure samples'}</div>
      {rows.length === 0 ? (
        <div style={chromeStyles.quietMeta}>
          {locale === 'zh-CN' ? '暂无失败样本。' : 'No failure samples yet.'}
        </div>
      ) : (
        rows.slice(0, 3).map((row, index) => (
          <div key={textValue(row.case_id ?? row.symbol, `failure-${index}`)} style={fieldBoxStyle}>
            <div style={inlineMetaStyle}>
              <span style={chromeStyles.monoMeta}>{textValue(row.symbol, `sample-${index + 1}`)}</span>
              <span style={statusBadgeStyle('warning')}>
                {signedPercentText(numberValue(row.return_t5 ?? row.forward_return_t5, 0))}
              </span>
            </div>
            <div style={fieldValueStyle}>
              {textValue(
                row.reason ?? row.title,
                locale === 'zh-CN' ? '验证后回看边界。' : 'Review boundary after validation.',
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function currencyText(value: unknown): string {
  const amount = numberValue(value, 0)
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function PaperAccountPanel({
  factor,
  locale,
}: {
  factor: AIFactorRecord
  locale: LongclawLocale
}) {
  const paper = asRecord(factor.paper_account)
  const equityCurve = asRecordArray(paper.equity_curve)
  const positions = asRecordArray(paper.positions)
  const trades = asRecordArray(paper.trades)
  const enabled = booleanValue(paper.enabled, factor.verified)
  const summary = [
    {
      label: locale === 'zh-CN' ? '模拟权益' : 'Paper equity',
      value: enabled ? currencyText(paper.ending_equity) : locale === 'zh-CN' ? '未启动' : 'Not started',
    },
    {
      label: locale === 'zh-CN' ? '累计收益' : 'Total return',
      value: enabled ? signedPercentText(numberValue(paper.total_return, 0)) : locale === 'zh-CN' ? '未验证' : 'Not verified',
    },
    {
      label: locale === 'zh-CN' ? '最大回撤' : 'Max drawdown',
      value: enabled ? signedPercentText(numberValue(paper.max_drawdown, 0)) : locale === 'zh-CN' ? '未验证' : 'Not verified',
    },
    {
      label: locale === 'zh-CN' ? '模拟暴露' : 'Exposure',
      value: enabled ? percentText(numberValue(paper.gross_exposure ?? paper.estimated_exposure, 0)) : locale === 'zh-CN' ? '未启动' : 'Not started',
    },
  ]

  return (
    <div style={columnStyle}>
      <div style={metricGridStyle}>
        {summary.map(item => (
          <div key={item.label} style={metricCellStyle}>
            <div style={metricValueStyle}>{item.value}</div>
            <div style={chromeStyles.quietMeta}>{item.label}</div>
          </div>
        ))}
      </div>
      <div style={panelBlockStyle}>
        <div style={inlineMetaStyle}>
          <span style={statusBadgeStyle(enabled ? 'paper_only' : 'not_verified')}>
            {enabled
              ? locale === 'zh-CN' ? '模拟观察中' : 'Paper observation'
              : locale === 'zh-CN' ? '等待验证' : 'Waiting validation'}
          </span>
          <span style={statusBadgeStyle(booleanValue(paper.no_auto_order, true) ? 'disabled' : 'risk')}>
            {locale === 'zh-CN' ? '不自动下单' : 'No auto order'}
          </span>
        </div>
        <div style={chromeStyles.quietMeta}>
          {equityCurve.length > 0
            ? `${locale === 'zh-CN' ? '权益曲线样本' : 'Equity curve points'}: ${equityCurve.length}`
            : locale === 'zh-CN'
              ? '运行验证后生成模拟权益曲线。'
              : 'Run validation to generate a paper equity curve.'}
        </div>
      </div>
      {positions.length > 0 && (
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '观察持仓' : 'Observed positions'}</div>
          <div style={utilityStyles.stackedList}>
            {positions.slice(0, 5).map((position, index) => (
              <div key={`${position.symbol ?? index}`} style={fieldValueStyle}>
                <span style={chromeStyles.monoMeta}>{textValue(position.symbol)}</span>
                {' '}
                {textValue(position.name)}
                {' · '}
                {textValue(position.group)}
                {' · '}
                {percentText(numberValue(position.target_weight, 0))}
              </div>
            ))}
          </div>
        </div>
      )}
      {trades.length > 0 && (
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '最近模拟命中' : 'Recent paper hits'}</div>
          <div style={utilityStyles.stackedList}>
            {trades.slice(-4).map((trade, index) => (
              <div key={`${trade.symbol ?? index}:${trade.date ?? index}`} style={fieldValueStyle}>
                {textValue(trade.date)}
                {' '}
                <span style={chromeStyles.monoMeta}>{textValue(trade.symbol)}</span>
                {' '}
                {textValue(trade.name)}
                {' · T+5 '}
                {signedPercentText(numberValue(trade.return_t5, 0))}
                {' · pnl '}
                {currencyText(trade.paper_pnl)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TokenList({ tokens }: { tokens: string[] }) {
  return (
    <div style={symbolPillRowStyle}>
      {tokens.map(token => (
        <span key={token} style={symbolPillStyle}>{token}</span>
      ))}
    </div>
  )
}

function WorkflowField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div style={fieldBoxStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{value}</div>
    </div>
  )
}

function ResearchWorkflowPanel({
  factor,
  locale,
  activeStage,
  onStageChange,
  onOpenRecord,
  onRunAction,
  onActionStart,
  onActionResult,
  onActionError,
  runningActionKey,
  ideaPayload,
}: {
  factor: AIFactorRecord
  locale: LongclawLocale
  activeStage: WorkflowStageKey
  onStageChange: (stage: WorkflowStageKey) => void
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  runningActionKey?: string
  ideaPayload: Record<string, unknown>
}) {
  const labels = actionLabels(locale)
  const stages = researchSteps(locale)
  const validationRequirements = locale === 'zh-CN'
    ? [
        '固定 US T 收盘 -> A股 T+1 as-of 边界',
        '计算 T+1/T+5/T+10/T+20 forward return',
        '输出 IC、Rank IC、分位收益和 long-short spread',
        '输出 MFE/MAE、turnover、行业/概念分组表现',
        '沉淀失败样本，用于回到信号/事件层修正',
      ]
    : [
        'Lock US T close -> CN T+1 as-of boundary',
        'Compute T+1/T+5/T+10/T+20 forward return',
        'Output IC, Rank IC, quantile return, and long-short spread',
        'Output MFE/MAE, turnover, industry/concept slices',
        'Persist failures to refine signal and event layers',
      ]

  const renderStageContent = () => {
    if (activeStage === 'signals') {
      return (
        <div style={columnStyle}>
          <div style={workflowWideGridStyle}>
            {factor.workflow.signals.map(signal => (
              <div key={signal.name} style={panelBlockStyle}>
                <div style={inlineMetaStyle}>
                  <span style={statusBadgeStyle(signal.layer)}>{signal.layer}</span>
                  <span style={chromeStyles.monoMeta}>{signal.name}</span>
                </div>
                <WorkflowField label={locale === 'zh-CN' ? '来源' : 'Source'} value={signal.source} />
                <p style={paragraphStyle}>{signal.definition}</p>
              </div>
            ))}
          </div>
          <div style={actionRowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => onStageChange('event')}>
              {locale === 'zh-CN' ? '编成事件' : 'Compose event'}
            </button>
          </div>
        </div>
      )
    }

    if (activeStage === 'event') {
      return (
        <div style={columnStyle}>
          <div style={workflowContentGridStyle}>
            <WorkflowField
              label={locale === 'zh-CN' ? 'czsc Operate' : 'czsc Operate'}
              value={<span style={statusBadgeStyle('specified')}>{factor.workflow.event.operate}</span>}
            />
            <WorkflowField
              label={locale === 'zh-CN' ? '事件输出' : 'Event output'}
              value={factor.workflow.event.next}
            />
            <WorkflowField label="signals_all" value={<TokenList tokens={factor.workflow.event.signals_all} />} />
            <WorkflowField label="signals_any" value={<TokenList tokens={factor.workflow.event.signals_any} />} />
            <WorkflowField label="signals_not" value={<TokenList tokens={factor.workflow.event.signals_not} />} />
            <div style={fieldBoxStyle}>
              <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '交易观察' : 'Trade observation'}</div>
              {Object.entries(factor.workflow.trade_observation).map(([key, value]) => (
                <div key={key} style={fieldValueStyle}>
                  <span style={chromeStyles.monoMeta}>{key}</span>: {value}
                </div>
              ))}
            </div>
          </div>
          <div style={actionRowStyle}>
            <FactorActionButton
              actionKey="validate"
              label={labels.validate}
              factor={factor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={onActionStart}
              onActionResult={onActionResult}
              onActionError={onActionError}
              runningActionKey={runningActionKey}
              payloadOverrides={ideaPayload}
            />
            <button type="button" style={secondaryButtonStyle} onClick={() => onStageChange('validation')}>
              {locale === 'zh-CN' ? '去验证' : 'Go to validation'}
            </button>
          </div>
        </div>
      )
    }

    if (activeStage === 'validation') {
      return (
        <div style={columnStyle}>
          <div style={workflowContentGridStyle}>
            {validationRequirements.map(item => (
              <div key={item} style={checklistRowStyle}>
                <span style={checkDotStyle(factor.verified)} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <MetricGrid factor={factor} locale={locale} compact />
          <div style={validationDetailGridStyle}>
            <PaperAccountSummary factor={factor} locale={locale} />
            <FailureSamplePreview rows={factor.failure_samples} locale={locale} />
          </div>
          <div style={actionRowStyle}>
            <FactorActionButton
              actionKey="validate"
              label={labels.validate}
              factor={factor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={onActionStart}
              onActionResult={onActionResult}
              onActionError={onActionError}
              runningActionKey={runningActionKey}
              payloadOverrides={ideaPayload}
            />
            <FactorActionButton
              actionKey="failures"
              label={labels.failures}
              factor={factor}
              onOpenRecord={onOpenRecord}
            />
          </div>
        </div>
      )
    }

    if (activeStage === 'lifecycle') {
      return (
        <div style={columnStyle}>
          <div style={workflowWideGridStyle}>
            {factor.workflow.lifecycle.map(step => (
              <div key={step.state} style={panelBlockStyle}>
                <div style={inlineMetaStyle}>
                  <span style={statusBadgeStyle(step.state)}>{step.state}</span>
                </div>
                <p style={paragraphStyle}>{step.action}</p>
                <div style={chromeStyles.quietMeta}>{step.gate}</div>
              </div>
            ))}
          </div>
          <div style={workflowContentGridStyle}>
            {Object.entries(factor.workflow.local_simulation).map(([key, value]) => (
              <WorkflowField key={key} label={key} value={value} />
            ))}
          </div>
          <div style={actionRowStyle}>
            <FactorActionButton
              actionKey="publish"
              label={labels.observe}
              factor={factor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={onActionStart}
              onActionResult={onActionResult}
              onActionError={onActionError}
              runningActionKey={runningActionKey}
              disabled={!factor.verified}
            />
            <FactorActionButton
              actionKey="disable"
              label={labels.disable}
              factor={factor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={onActionStart}
              onActionResult={onActionResult}
              onActionError={onActionError}
              runningActionKey={runningActionKey}
            />
          </div>
        </div>
      )
    }

    return (
      <div style={columnStyle}>
        <div style={workflowContentGridStyle}>
          {factor.draft_items.map(item => (
            <WorkflowField key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '当前输入' : 'Current input'}</div>
          <p style={paragraphStyle}>{String(ideaPayload.idea ?? factor.thesis)}</p>
        </div>
        <div style={actionRowStyle}>
          <FactorActionButton
            actionKey="draft"
            label={labels.draft}
            factor={factor}
            onOpenRecord={onOpenRecord}
            onRunAction={onRunAction}
            onActionStart={onActionStart}
            onActionResult={onActionResult}
            onActionError={onActionError}
            runningActionKey={runningActionKey}
            payloadOverrides={ideaPayload}
            tone="primary"
            disabled={!String(ideaPayload.idea ?? '').trim()}
          />
          <button type="button" style={secondaryButtonStyle} onClick={() => onStageChange('signals')}>
            {locale === 'zh-CN' ? '进入信号层' : 'Go to signals'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section style={workflowPanelStyle}>
      <div style={compactColumnStyle}>
        <div>
          <h2 style={chromeStyles.sectionTitle}>
            {locale === 'zh-CN' ? '因子研发流程' : 'Factor research workflow'}
          </h2>
          <div style={chromeStyles.subtleText}>
            {locale === 'zh-CN'
              ? '从交易想法开始，逐层生成 signal、event、验证证据和观察生命周期。'
              : 'Start from an idea, then build signals, event, evidence, and lifecycle gates.'}
          </div>
        </div>
        <div style={workflowStageListStyle}>
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              style={workflowStageButtonStyle(activeStage === stage.id)}
              onClick={() => onStageChange(stage.id)}
            >
              <div style={stepNumberStyle}>{String(index + 1).padStart(2, '0')}</div>
              <div style={stepLabelStyle}>{stage.label}</div>
              <div style={chromeStyles.quietMeta}>{stage.detail}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={columnStyle}>{renderStageContent()}</div>
    </section>
  )
}

function BasketPanel({
  title,
  subtitle,
  legs,
}: {
  title: string
  subtitle: string
  legs: PortfolioLeg[]
}) {
  return (
    <div style={basketPanelStyle}>
      <div style={basketHeaderStyle}>
        <div>
          <div style={basketTitleStyle}>{title}</div>
          <div style={chromeStyles.quietMeta}>{subtitle}</div>
        </div>
        <span style={statusBadgeStyle('specified')}>100%</span>
      </div>
      {legs.map(leg => (
        <div key={`${leg.group}:${leg.symbols.join(',')}`} style={basketLegStyle}>
          <div>
            <div style={fieldLabelStyle}>{leg.group}</div>
            <div style={{ ...chromeStyles.quietMeta, marginTop: 3 }}>{leg.role}</div>
          </div>
          <div style={symbolPillRowStyle}>
            {leg.symbols.map(symbol => (
              <span key={symbol} style={symbolPillStyle}>{symbol}</span>
            ))}
          </div>
          <div style={{ ...metricValueStyle, fontSize: 13, textAlign: 'right' }}>
            {percentText(leg.weight)}
          </div>
        </div>
      ))}
    </div>
  )
}

function CrossMarketPortfolio({
  factor,
  locale,
}: {
  factor: AIFactorRecord
  locale: LongclawLocale
}) {
  return (
    <Section
      title={locale === 'zh-CN' ? '跨市场组合构建' : 'Cross-market portfolio construction'}
      subtitle={
        locale === 'zh-CN'
          ? '先构建美股触发篮子，再映射 A股反应池；权重和 as-of 边界必须固定。'
          : 'Build the US trigger basket first, then map to the CN reaction basket with fixed weights and as-of boundaries.'
      }
    >
      <div style={columnStyle}>
        <div style={portfolioGridStyle}>
          <BasketPanel
            title={locale === 'zh-CN' ? '美股触发篮子' : 'US trigger basket'}
            subtitle={locale === 'zh-CN' ? '只产生方向和强度' : 'Produces direction and strength only'}
            legs={factor.portfolio.us_trigger_basket}
          />
          <BasketPanel
            title={locale === 'zh-CN' ? 'A股反应池' : 'CN reaction basket'}
            subtitle={locale === 'zh-CN' ? '通过确认后进入观察池' : 'Enters watch pool only after confirmation'}
            legs={factor.portfolio.cn_reaction_basket}
          />
        </div>
        <div style={formulaGridStyle}>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '映射规则' : 'Mapping rule'}</div>
            <p style={paragraphStyle}>{factor.portfolio.mapping_rule}</p>
          </div>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '信号公式' : 'Signal formula'}</div>
            <p style={paragraphStyle}>{factor.portfolio.signal_formula}</p>
          </div>
        </div>
        <div style={panelBlockStyle}>
          <div style={inlineMetaStyle}>
            <span style={statusBadgeStyle('specified')}>{factor.portfolio.rebalance}</span>
            <span style={statusBadgeStyle('info')}>{factor.portfolio.portfolio_role}</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

export function AIFactorFactoryWorkspace({
  locale,
  dashboard,
  signalsWebBaseUrl,
  onOpenRecord,
  onRunAction,
}: AIFactorFactoryWorkspaceProps) {
  const dashboardFactors = React.useMemo(
    () => normalizeFactoryFactors(dashboard, signalsWebBaseUrl),
    [dashboard, signalsWebBaseUrl],
  )
  const [factorOverrides, setFactorOverrides] = React.useState<Record<string, AIFactorRecord>>({})
  const factors = React.useMemo(
    () => mergeFactorOverrides(dashboardFactors, factorOverrides),
    [dashboardFactors, factorOverrides],
  )
  const [selectedFactorId, setSelectedFactorId] = React.useState<string>(() => (
    factors[0]?.factor_id ?? fallbackFactor.factor_id
  ))
  const selectedFactor = factors.find(factor => factor.factor_id === selectedFactorId) ?? factors[0]
  const labels = actionLabels(locale)
  const failureRows = selectedFactor?.failure_samples ?? []
  const [ideaText, setIdeaText] = React.useState<string>(() => selectedFactor?.thesis ?? fallbackFactor.thesis)
  const [activeWorkflowStage, setActiveWorkflowStage] = React.useState<WorkflowStageKey>('idea')
  const [runningActionKey, setRunningActionKey] = React.useState<string>('')
  const [actionRunState, setActionRunState] = React.useState<ActionRunState | null>(null)

  React.useEffect(() => {
    if (factors.length > 0 && !factors.some(factor => factor.factor_id === selectedFactorId)) {
      setSelectedFactorId(factors[0].factor_id)
    }
  }, [factors, selectedFactorId])

  React.useEffect(() => {
    const current = factors.find(factor => factor.factor_id === selectedFactorId)
    if (current) setIdeaText(current.thesis)
  }, [factors, selectedFactorId])

  const handleActionStart = React.useCallback((action: LongclawOperatorAction) => {
    const key = actionRunKey(action)
    setRunningActionKey(key)
    setActionRunState({
      actionKey: key,
      label: action.label,
      state: 'running',
      message: locale === 'zh-CN'
        ? `${action.label} 运行中...`
        : `${action.label} is running...`,
    })
  }, [locale])

  const handleActionResult = React.useCallback((
    action: LongclawOperatorAction,
    result: Record<string, unknown>,
  ) => {
    const payload = factorRecordFromActionResult(result, action)
    const factorId = textValue(payload.factor_id, selectedFactor?.factor_id ?? fallbackFactor.factor_id)
    const base = factors.find(factor => factor.factor_id === factorId) ?? selectedFactor
    const merged = mergeFactorPayload(base, payload, factors.length)
    setFactorOverrides(previous => ({
      ...previous,
      [merged.factor_id]: merged,
    }))
    setSelectedFactorId(merged.factor_id)
    const actionName = action.action_id.split(':').at(-1)
    if (actionName === 'validate') setActiveWorkflowStage('validation')
    if (actionName === 'draft') setActiveWorkflowStage('signals')
    if (actionName === 'publish' || actionName === 'observe' || actionName === 'disable') {
      setActiveWorkflowStage('lifecycle')
    }
    setRunningActionKey('')
    setActionRunState({
      actionKey: actionRunKey(action),
      label: action.label,
      state: 'completed',
      message: locale === 'zh-CN'
        ? `${action.label} 已合并到当前页面。`
        : `${action.label} merged into this page.`,
    })
  }, [factors, locale, selectedFactor])

  const handleActionError = React.useCallback((action: LongclawOperatorAction, message: string) => {
    setRunningActionKey('')
    setActionRunState({
      actionKey: actionRunKey(action),
      label: action.label,
      state: 'failed',
      message: locale === 'zh-CN'
        ? `${action.label} 失败：${message}`
        : `${action.label} failed: ${message}`,
    })
  }, [locale])

  if (!selectedFactor) return null

  const ideaPayload = { idea: ideaText.trim() || selectedFactor.thesis }
  const fields = intakeFields(selectedFactor, locale)
  const steps = researchSteps(locale)
  const gate = gateItems(selectedFactor, locale)

  return (
    <div style={workspaceStackStyle}>
      <section style={intakeShellStyle}>
        <div style={compactColumnStyle}>
          <div style={cardHeaderStyle}>
            <div style={titleBlockStyle}>
              <h2 style={chromeStyles.sectionTitle}>
                {locale === 'zh-CN' ? '因子工作单' : 'Factor ticket'}
              </h2>
              <div style={chromeStyles.subtleText}>
                {locale === 'zh-CN'
                  ? '先写交易假设，再让 Signals 复现和验证。'
                  : 'Start with a trading hypothesis, then let Signals reproduce and validate it.'}
              </div>
            </div>
            <div style={actionRowStyle}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  setIdeaText('')
                  setActiveWorkflowStage('idea')
                }}
              >
                {locale === 'zh-CN' ? '新建研究' : 'New research'}
              </button>
              <FactorActionButton
                actionKey="draft"
                label={labels.draft}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
                payloadOverrides={ideaPayload}
                tone="primary"
                disabled={!ideaText.trim()}
              />
            </div>
          </div>
          <textarea
            value={ideaText}
            onChange={event => setIdeaText(event.target.value)}
            style={ticketInputStyle}
            placeholder={
              locale === 'zh-CN'
                ? '例：美股 AI 硬件链大涨后，A股光模块/CPO/存储是否存在 T+1 联动，开盘承接和放量确认哪个更有效？'
                : 'Example: after US AI hardware rallies, does CN optical/CPO/memory show T+1 linkage, and which confirmation works better?'
            }
          />
          <div style={fieldGridStyle}>
            {fields.map(field => (
              <div key={field.label} style={fieldBoxStyle}>
                <div style={fieldLabelStyle}>{field.label}</div>
                <div style={fieldValueStyle}>{field.value}</div>
              </div>
            ))}
          </div>
          {actionRunState ? (
            <div
              style={
                actionRunState.state === 'failed'
                  ? utilityStyles.warningBanner
                  : utilityStyles.noticeBanner
              }
            >
              {actionRunState.message}
            </div>
          ) : null}
        </div>
        <div style={compactColumnStyle}>
          <div style={stepGridStyle}>
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                style={{
                  ...stepBoxStyle,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderColor: activeWorkflowStage === step.id ? 'rgba(208, 138, 84, 0.46)' : palette.border,
                  background: activeWorkflowStage === step.id ? 'rgba(208, 138, 84, 0.10)' : palette.panel,
                }}
                onClick={() => setActiveWorkflowStage(step.id)}
              >
                <div style={stepNumberStyle}>{String(index + 1).padStart(2, '0')}</div>
                <div style={stepLabelStyle}>{step.label}</div>
                <div style={chromeStyles.quietMeta}>{step.detail}</div>
              </button>
            ))}
          </div>
          <MetricGrid factor={selectedFactor} locale={locale} compact />
          <div style={actionRowStyle}>
            <FactorActionButton
              actionKey="validate"
              label={labels.validate}
              factor={selectedFactor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={handleActionStart}
              onActionResult={handleActionResult}
              onActionError={handleActionError}
              runningActionKey={runningActionKey}
              payloadOverrides={ideaPayload}
            />
            <FactorActionButton
              actionKey="failures"
              label={labels.failures}
              factor={selectedFactor}
              onOpenRecord={onOpenRecord}
            />
            <FactorActionButton
              actionKey="publish"
              label={labels.observe}
              factor={selectedFactor}
              onOpenRecord={onOpenRecord}
              onRunAction={onRunAction}
              onActionStart={handleActionStart}
              onActionResult={handleActionResult}
              onActionError={handleActionError}
              runningActionKey={runningActionKey}
              disabled={!selectedFactor.verified}
            />
          </div>
        </div>
      </section>

      <ResearchWorkflowPanel
        factor={selectedFactor}
        locale={locale}
        activeStage={activeWorkflowStage}
        onStageChange={setActiveWorkflowStage}
        onOpenRecord={onOpenRecord}
        onRunAction={onRunAction}
        onActionStart={handleActionStart}
        onActionResult={handleActionResult}
        onActionError={handleActionError}
        runningActionKey={runningActionKey}
        ideaPayload={ideaPayload}
      />

      <CrossMarketPortfolio factor={selectedFactor} locale={locale} />

      <div style={factoryGridStyle}>
        <div style={columnStyle}>
        <Section
          title={locale === 'zh-CN' ? '实验账本' : 'Experiment ledger'}
          subtitle={
            locale === 'zh-CN'
              ? '每张卡是一条可复现因子实验，不是聊天记录。'
              : 'Each card is a reproducible factor experiment, not a chat transcript.'
          }
        >
          <div style={utilityStyles.stackedList}>
            {factors.map(factor => (
              <button
                key={factor.factor_id}
                type="button"
                style={
                  factor.factor_id === selectedFactor.factor_id
                    ? activeIdeaCardStyle
                    : ideaCardStyle
                }
                onClick={() => {
                  setSelectedFactorId(factor.factor_id)
                  setActiveWorkflowStage('idea')
                }}
              >
                <div style={cardHeaderStyle}>
                  <div style={titleBlockStyle}>
                    <div style={cardTitleStyle}>{factor.title}</div>
                    <div style={chromeStyles.quietMeta}>{factor.thesis}</div>
                  </div>
                  <span style={statusBadgeStyle(factor.status)}>
                    {humanizeTokenLocale(locale, factor.status)}
                  </span>
                </div>
                <MetricGrid factor={factor} locale={locale} />
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div style={columnStyle}>
        <Section
          title={locale === 'zh-CN' ? '可验证定义' : 'Verifiable definition'}
          subtitle={
            locale === 'zh-CN'
              ? '把一句盘面判断拆成股票池、触发、回避、失效和证明口径。'
              : 'Convert the idea into a reproducible definition before trading.'
          }
          actions={
            <div style={actionRowStyle}>
              <FactorActionButton
                actionKey="draft"
                label={labels.draft}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
                payloadOverrides={ideaPayload}
              />
              <FactorActionButton
                actionKey="validate"
                label={labels.validate}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
                payloadOverrides={ideaPayload}
              />
            </div>
          }
        >
          <div style={panelBlockStyle}>
            <div style={inlineMetaStyle}>
              <span style={statusBadgeStyle(selectedFactor.status)}>
                {humanizeTokenLocale(locale, selectedFactor.status)}
              </span>
              <span style={chromeStyles.monoMeta}>{selectedFactor.factor_id}</span>
            </div>
            <p style={paragraphStyle}>{selectedFactor.draft}</p>
          </div>
        </Section>

        <Section
          title={locale === 'zh-CN' ? '可复现边界' : 'Reproducibility'}
          subtitle={
            locale === 'zh-CN'
              ? '固定 as-of、数据快照、成本、滑点和股票池，避免未来函数。'
              : 'Lock as-of, data snapshot, costs, slippage, and universe to prevent leakage.'
          }
        >
          <div style={panelBlockStyle}>
            <p style={paragraphStyle}>{selectedFactor.reproducibility_summary}</p>
          </div>
        </Section>

        <Section
          title={locale === 'zh-CN' ? '验证结果' : 'Validation result'}
          subtitle={
            locale === 'zh-CN'
              ? '展示样本覆盖、胜率、收益和最大不利波动，避免只看 AI 解释。'
              : 'Show coverage, win rate, return, and adverse movement before relying on AI text.'
          }
        >
          <div style={columnStyle}>
            <MetricGrid factor={selectedFactor} locale={locale} />
            <div style={validationDetailGridStyle}>
              <PaperAccountSummary factor={selectedFactor} locale={locale} />
              <FailureSamplePreview rows={failureRows} locale={locale} />
            </div>
            <div style={panelBlockStyle}>
              <div style={chromeStyles.quietMeta}>
                {locale === 'zh-CN' ? '验证摘要' : 'Validation summary'}
              </div>
              <p style={paragraphStyle}>{selectedFactor.validation_summary}</p>
            </div>
          </div>
        </Section>
      </div>

      <div style={columnStyle}>
        <Section
          title={locale === 'zh-CN' ? '发布门禁' : 'Promotion gate'}
          subtitle={
            locale === 'zh-CN'
              ? '只有通过验证和人工确认，才能进入策略页盘前池。'
              : 'Only validated and approved factors can enter the strategy pre-market pool.'
          }
          actions={
            <div style={actionRowStyle}>
              <FactorActionButton
                actionKey="publish"
                label={labels.observe}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
                disabled={!selectedFactor.verified}
              />
              <FactorActionButton
                actionKey="disable"
                label={labels.disable}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
              />
            </div>
          }
        >
          <div style={panelBlockStyle}>
            <div style={checklistStyle}>
              {gate.map(item => (
                <div key={item.label} style={checklistRowStyle}>
                  <span style={checkDotStyle(item.passed)} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title={locale === 'zh-CN' ? 'AI解释' : 'AI explanation'}
          subtitle={
            locale === 'zh-CN'
              ? '只保留因子逻辑、边界和反馈建议。'
              : 'Keep only factor logic, boundaries, and feedback suggestions.'
          }
        >
          <div style={panelBlockStyle}>
            <p style={paragraphStyle}>{selectedFactor.ai_explanation}</p>
          </div>
        </Section>

        <PackListSection
          locale={locale}
          title={locale === 'zh-CN' ? '失败样本' : 'Failure samples'}
          subtitle={
            locale === 'zh-CN'
              ? '优先打开失败样本，反推因子边界。'
              : 'Open failures first to refine factor boundaries.'
          }
          rows={failureRows}
          onOpen={item =>
            onOpenRecord(
              labels.failures,
              {
                ...item,
                factor_id: selectedFactor.factor_id,
                parent_factor_title: selectedFactor.title,
              },
              [factorAction('failures', labels.failures, selectedFactor)],
            )
          }
        />

        <Section
          title={locale === 'zh-CN' ? '实盘状态' : 'Live status'}
          subtitle={
            locale === 'zh-CN'
              ? '只展示是否启用和运行状态，真实交易开关仍留给外部控制面。'
              : 'Expose enablement and runtime state while actual trading stays outside this component.'
          }
          actions={
            <FactorActionButton
              actionKey="failures"
              label={labels.failures}
              factor={selectedFactor}
              onOpenRecord={onOpenRecord}
            />
          }
        >
          <div style={panelBlockStyle}>
            <div style={inlineMetaStyle}>
              <span style={statusBadgeStyle(selectedFactor.live_status)}>
                {humanizeTokenLocale(locale, selectedFactor.live_status)}
              </span>
              <span style={statusBadgeStyle(selectedFactor.live_enabled ? 'active' : 'disabled')}>
                {selectedFactor.live_enabled
                  ? locale === 'zh-CN' ? '实盘已启用' : 'Live enabled'
                  : locale === 'zh-CN' ? '实盘未启用' : 'Live disabled'}
              </span>
            </div>
            <div style={chromeStyles.quietMeta}>
              {signalsWebBaseUrl
                ? `${locale === 'zh-CN' ? 'Signals 端点' : 'Signals endpoint'}: ${signalsWebBaseUrl}`
                : locale === 'zh-CN'
                  ? 'Signals 端点未传入'
                  : 'Signals endpoint is not configured'}
            </div>
          </div>
        </Section>
      </div>
      </div>
    </div>
  )
}
