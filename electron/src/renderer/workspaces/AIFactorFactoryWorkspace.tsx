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
  us_driver_nodes: USDriverNode[]
  cn_mapping_nodes: CNMappingNode[]
  rhythm_windows: RhythmWindow[]
  rhythm: RhythmState
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
  candidates?: AShareCandidate[]
  core_candidates?: AShareCandidate[]
  elastic_candidates?: AShareCandidate[]
  confidence?: number
  confirmation_rule?: string
}

type PortfolioConstruction = {
  us_trigger_basket: PortfolioLeg[]
  cn_reaction_basket: PortfolioLeg[]
  mapping_rule: string
  signal_formula: string
  rebalance: string
  portfolio_role: string
}

type USDriverNode = {
  node_id: string
  name: string
  role: string
  layer: string
  symbols: string[]
  conditional_symbols: string[]
  weight: number
  driver_rule: string
  benchmark_symbols: string[]
  kline_timeframes: Array<Record<string, unknown>>
}

type AShareCandidate = {
  symbol: string
  name: string
  role: string
  relation: string
  priority: number
  selection_score: number
  score_status: string
  mapping_reason: string
  exclusion_reason: string
}

type CNMappingNode = {
  source_node_id: string
  source_driver: string
  group: string
  target_chain_id: string
  symbols: string[]
  core_candidates: AShareCandidate[]
  elastic_candidates: AShareCandidate[]
  top_candidates: AShareCandidate[]
  mapping_reason: string
  confirmation_rule: string
  lag_rule: string
  confidence: number
  selection_status: string
  selection_score_formula: string
}

type RhythmWindow = {
  window_id: string
  label: string
  market: string
  timeframe: string
  question: string
  status: string
  demo_observation: string
  kline_marker: Record<string, unknown>
}

type RhythmState = {
  mode: string
  status: string
  demo: boolean
  no_auto_order: boolean
  windows: RhythmWindow[]
  path_samples: Array<Record<string, unknown>>
  selected_us_driver: Record<string, unknown>
  selected_cn_mapping: Record<string, unknown>
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

const tradingDeskGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(330px, 0.95fr) minmax(440px, 1.25fr) minmax(330px, 0.95fr)',
  gap: 12,
  alignItems: 'start',
}

const timelineGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 8,
}

const candidateRowStyle: React.CSSProperties = {
  ...surfaceStyles.listRow,
  display: 'grid',
  gridTemplateColumns: '86px minmax(0, 1fr) 58px',
  gap: 8,
  alignItems: 'center',
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
  us_driver_nodes: [
    {
      node_id: 'optical_interconnect',
      name: '光器件/光模块/CPO',
      role: 'primary_driver',
      layer: 'midstream',
      symbols: ['COHR', 'LITE', 'FN', 'AAOI', 'CIEN'],
      conditional_symbols: [],
      weight: 0.4,
      driver_rule: 'LITE/COHR/FN 是光器件和光模块直接触发源，AVGO 只作为网络 ASIC/硅光旁证。',
      benchmark_symbols: ['SOX', 'QQQ'],
      kline_timeframes: [],
    },
  ],
  cn_mapping_nodes: [
    {
      source_node_id: 'optical_interconnect',
      source_driver: '光器件/光模块/CPO',
      group: '光模块/CPO',
      target_chain_id: 'optical_module',
      symbols: ['SZ.300308', 'SZ.300502', 'SZ.300394'],
      core_candidates: [
        {
          symbol: 'SZ.300308',
          name: '中际旭创',
          role: 'core',
          relation: '高速光模块/CPO链主',
          priority: 100,
          selection_score: 0,
          score_status: 'draft_mapping_pending_kline',
          mapping_reason: 'A股光模块/CPO核心映射。',
          exclusion_reason: '',
        },
      ],
      elastic_candidates: [],
      top_candidates: [],
      mapping_reason: 'COHR/LITE/FN/AAOI/CIEN 是光器件和光模块直接触发源。',
      confirmation_rule: 'A股光模块/CPO池 T+1 开盘不过热，龙头和弹性标的出现量价承接。',
      lag_rule: 'US_T_close_to_A_T_plus_1',
      confidence: 0.88,
      selection_status: 'draft_mapping_pending_kline',
      selection_score_formula: 'mapping_confidence * us_driver_strength * cn_acceptance_strength * historical_lead_lag * liquidity - penalties',
    },
  ],
  rhythm_windows: [
    { window_id: 'us_overnight_close', label: '昨夜美股', market: 'US', timeframe: 'daily/60m/15m', question: '美股到底在炒哪条AI硬件支链？', status: 'pending_data', demo_observation: '', kline_marker: {} },
    { window_id: 'cn_call_auction', label: '今日竞价', market: 'A', timeframe: '集合竞价', question: 'A股映射池是否高开过热？', status: 'pending_data', demo_observation: '', kline_marker: {} },
    { window_id: 'cn_open_30m', label: '开盘30分钟', market: 'A', timeframe: '5m/30m', question: '高开后能否回踩承接？', status: 'pending_data', demo_observation: '', kline_marker: {} },
    { window_id: 'cn_intraday_confirm', label: '盘中确认', market: 'A', timeframe: '5m/30m', question: '同链条是否扩散？', status: 'pending_data', demo_observation: '', kline_marker: {} },
    { window_id: 'cn_close_review', label: '收盘复盘', market: 'A', timeframe: 'daily/30m', question: '样本如何归因？', status: 'pending_data', demo_observation: '', kline_marker: {} },
  ],
  rhythm: {
    mode: 'not_run',
    status: 'pending_kline_fusion',
    demo: false,
    no_auto_order: true,
    windows: [],
    path_samples: [],
    selected_us_driver: {},
    selected_cn_mapping: {},
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
    candidates: normalizeAShareCandidates(row.candidates),
    core_candidates: normalizeAShareCandidates(row.core_candidates),
    elastic_candidates: normalizeAShareCandidates(row.elastic_candidates),
    confidence: numberValue(row.confidence, 0),
    confirmation_rule: textValue(row.confirmation_rule),
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

function normalizeAShareCandidates(value: unknown): AShareCandidate[] {
  return asRecordArray(value).map((row, index) => ({
    symbol: textValue(row.symbol ?? row.code, ''),
    name: textValue(row.name ?? row.display_name, ''),
    role: textValue(row.role ?? row.type, index === 0 ? 'core' : 'elastic'),
    relation: textValue(row.relation ?? row.reason ?? row.description, ''),
    priority: numberValue(row.priority, 0),
    selection_score: numberValue(row.selection_score ?? row.score, 0),
    score_status: textValue(row.score_status ?? row.selection_status, ''),
    mapping_reason: textValue(row.mapping_reason, ''),
    exclusion_reason: textValue(row.exclusion_reason ?? row.blocker, ''),
  })).filter(item => item.symbol || item.name)
}

function normalizeUSDriverNodes(value: unknown, portfolio: PortfolioConstruction): USDriverNode[] {
  const rows = asRecordArray(value)
  if (rows.length === 0) {
    return portfolio.us_trigger_basket.map((leg, index) => ({
      node_id: `driver-${index + 1}`,
      name: leg.group,
      role: index === 0 ? 'primary_driver' : 'confirming_driver',
      layer: '',
      symbols: leg.symbols,
      conditional_symbols: [],
      weight: leg.weight,
      driver_rule: leg.role,
      benchmark_symbols: ['SOX', 'QQQ'],
      kline_timeframes: [],
    }))
  }
  return rows.map((row, index) => ({
    node_id: textValue(row.node_id ?? row.id, `driver-${index + 1}`),
    name: textValue(row.name ?? row.group, `driver-${index + 1}`),
    role: textValue(row.role, index === 0 ? 'primary_driver' : 'confirming_driver'),
    layer: textValue(row.layer, ''),
    symbols: stringArrayValue(row.symbols),
    conditional_symbols: stringArrayValue(row.conditional_symbols),
    weight: numberValue(row.weight, 0),
    driver_rule: textValue(row.driver_rule ?? row.rule ?? row.description, ''),
    benchmark_symbols: stringArrayValue(row.benchmark_symbols).length > 0
      ? stringArrayValue(row.benchmark_symbols)
      : ['SOX', 'QQQ'],
    kline_timeframes: asRecordArray(row.kline_timeframes),
  }))
}

function normalizeCNMappingNodes(value: unknown, portfolio: PortfolioConstruction): CNMappingNode[] {
  const rows = asRecordArray(value)
  if (rows.length === 0) {
    return portfolio.cn_reaction_basket.map((leg, index) => ({
      source_node_id: `mapping-${index + 1}`,
      source_driver: '',
      group: leg.group,
      target_chain_id: '',
      symbols: leg.symbols,
      core_candidates: leg.core_candidates ?? [],
      elastic_candidates: leg.elastic_candidates ?? [],
      top_candidates: [...(leg.core_candidates ?? []), ...(leg.elastic_candidates ?? [])].slice(0, 6),
      mapping_reason: leg.role,
      confirmation_rule: leg.confirmation_rule ?? '',
      lag_rule: 'US_T_close_to_A_T_plus_1',
      confidence: leg.confidence ?? 0,
      selection_status: 'draft_mapping_pending_kline',
      selection_score_formula: 'mapping_confidence * us_driver_strength * cn_acceptance_strength * historical_lead_lag * liquidity - penalties',
    }))
  }
  return rows.map((row, index) => {
    const core = normalizeAShareCandidates(row.core_candidates)
    const elastic = normalizeAShareCandidates(row.elastic_candidates)
    const top = normalizeAShareCandidates(row.top_candidates)
    return {
      source_node_id: textValue(row.source_node_id ?? row.node_id, `mapping-${index + 1}`),
      source_driver: textValue(row.source_driver, ''),
      group: textValue(row.group ?? row.name, `mapping-${index + 1}`),
      target_chain_id: textValue(row.target_chain_id, ''),
      symbols: stringArrayValue(row.symbols),
      core_candidates: core,
      elastic_candidates: elastic,
      top_candidates: top.length > 0 ? top : [...core, ...elastic].slice(0, 6),
      mapping_reason: textValue(row.mapping_reason ?? row.role ?? row.reason, ''),
      confirmation_rule: textValue(row.confirmation_rule, ''),
      lag_rule: textValue(row.lag_rule, 'US_T_close_to_A_T_plus_1'),
      confidence: numberValue(row.confidence, 0),
      selection_status: textValue(row.selection_status, 'draft_mapping_pending_kline'),
      selection_score_formula: textValue(
        row.selection_score_formula,
        'mapping_confidence * us_driver_strength * cn_acceptance_strength * historical_lead_lag * liquidity - penalties',
      ),
    }
  })
}

function normalizeRhythmWindow(value: unknown, fallback: RhythmWindow): RhythmWindow {
  const raw = asRecord(value)
  return {
    window_id: textValue(raw.window_id ?? raw.id, fallback.window_id),
    label: textValue(raw.label ?? raw.name, fallback.label),
    market: textValue(raw.market, fallback.market),
    timeframe: textValue(raw.timeframe ?? raw.freq, fallback.timeframe),
    question: textValue(raw.question ?? raw.description, fallback.question),
    status: textValue(raw.status, fallback.status),
    demo_observation: textValue(raw.demo_observation ?? raw.observation, fallback.demo_observation),
    kline_marker: asRecord(raw.kline_marker),
  }
}

function normalizeRhythmWindows(value: unknown): RhythmWindow[] {
  const rows = asRecordArray(value)
  const fallback = fallbackFactor.rhythm_windows
  if (rows.length === 0) return fallback
  return rows.map((row, index) => normalizeRhythmWindow(row, fallback[index] ?? fallback[0]))
}

function normalizeRhythm(value: unknown, windows: RhythmWindow[]): RhythmState {
  const raw = asRecord(value)
  const rawWindows = normalizeRhythmWindows(raw.windows)
  return {
    mode: textValue(raw.mode, fallbackFactor.rhythm.mode),
    status: textValue(raw.status, fallbackFactor.rhythm.status),
    demo: booleanValue(raw.demo, false),
    no_auto_order: booleanValue(raw.no_auto_order, true),
    windows: rawWindows.length > 0 ? rawWindows : windows,
    path_samples: asRecordArray(raw.path_samples),
    selected_us_driver: asRecord(raw.selected_us_driver),
    selected_cn_mapping: asRecord(raw.selected_cn_mapping),
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

type FactorActionKey = 'draft' | 'rhythm' | 'validate' | 'failures' | 'publish' | 'disable'

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
      ...(actionKey === 'rhythm' ? { mode: 'demo' } : {}),
      ...(actionKey === 'publish' ? { live_enabled: true } : {}),
    },
    metadata: {
      workspace: 'ai_factor_factory',
      signals_web_base_url: factor.signals_web_base_url ?? '',
      endpoint: actionKey === 'failures'
        ? ''
        : `/api/strategy/ai-factor-factory/${
            actionKey === 'publish' ? 'publish' : actionKey === 'rhythm' ? 'rhythm-demo' : actionKey
          }`,
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
  const portfolioSource = raw.portfolio_construction ?? development.portfolio_construction
  const portfolio = normalizePortfolio(portfolioSource)
  const rhythmWindows = normalizeRhythmWindows(asRecord(portfolioSource).rhythm_windows)
  const rhythm = normalizeRhythm(raw.rhythm, rhythmWindows)
  const sampleCount = numberValue(
    metrics.sample_count ?? metrics.samples ?? validation.sample_count ?? raw.sample_count ?? raw.samples ?? raw.n_samples,
    0,
  )
  const verified = booleanValue(
    metrics.verified ?? validation.verified,
    sampleCount > 0,
  )
  const rawLiveStatus = textValue(raw.live_status ?? raw.production_status)
  const derivedLiveStatus = verified
    ? (booleanValue(raw.live_enabled ?? raw.enabled ?? raw.live, false) ? 'live_enabled' : 'paper_only')
    : 'not_verified'
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
    live_status: rawLiveStatus && !(verified && rawLiveStatus === 'not_verified')
      ? rawLiveStatus
      : derivedLiveStatus,
    reproducibility_summary: textValue(
      reproducibility.as_of_boundary ?? reproducibility.data_snapshot ?? raw.reproducibility_summary,
      fallbackFactor.reproducibility_summary,
    ),
    paper_account: normalizePaperAccount(raw.paper_account, verified),
    draft_items: draftItems(draftSource, fallbackFactor.draft_items),
    workflow: normalizeResearchWorkflow(raw.research_workflow ?? development.research_workflow),
    portfolio,
    us_driver_nodes: normalizeUSDriverNodes(asRecord(portfolioSource).us_driver_nodes, portfolio),
    cn_mapping_nodes: normalizeCNMappingNodes(asRecord(portfolioSource).cn_mapping_nodes, portfolio),
    rhythm_windows: rhythmWindows,
    rhythm,
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
      draft: 'Generate mapping',
      rhythm: 'Fuse K-lines',
      validate: 'Run historical validation',
      failures: 'Failure samples',
      observe: 'Add to watch pool',
      disable: 'Disable factor',
    }
  }
  return {
    draft: '生成映射草稿',
    rhythm: '融合K线节奏',
    validate: '运行历史验证',
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

function roleText(role: string, locale: LongclawLocale) {
  if (locale !== 'zh-CN') return humanizeTokenLocale(locale, role)
  if (role === 'primary_driver') return '主驱动'
  if (role === 'confirming_driver') return '确认'
  if (role === 'core') return '核心'
  if (role === 'elastic') return '弹性'
  return humanizeTokenLocale(locale, role)
}

function RhythmTimeline({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  const windows = factor.rhythm.windows.length > 0 ? factor.rhythm.windows : factor.rhythm_windows
  return (
    <Section
      title={locale === 'zh-CN' ? '跨市场交易节奏' : 'Cross-market rhythm'}
      subtitle={
        locale === 'zh-CN'
          ? '从昨夜美股到今日A股承接，按交易窗口推进研究。'
          : 'Move from US overnight drivers to A-share acceptance windows.'
      }
    >
      <div style={timelineGridStyle}>
        {windows.map((window, index) => (
          <div key={`${window.window_id}:${index}`} style={fieldBoxStyle}>
            <div style={inlineMetaStyle}>
              <div style={stepNumberStyle}>{String(index + 1).padStart(2, '0')}</div>
              <span style={statusBadgeStyle(window.market === 'US' ? 'info' : 'specified')}>{window.market}</span>
            </div>
            <div style={{ ...stepLabelStyle, marginTop: 6 }}>{window.label}</div>
            <div style={chromeStyles.monoMeta}>{window.timeframe}</div>
            <p style={{ ...paragraphStyle, marginTop: 6 }}>
              {window.demo_observation || window.question}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function MarketDriverPanel({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  return (
    <Section
      title={locale === 'zh-CN' ? '美股在炒什么' : 'What US is trading'}
      subtitle={
        locale === 'zh-CN'
          ? '按AI硬件支链识别主驱动、确认和反证，不把 AVGO/SMCI 误当成光模块或液冷。'
          : 'Identify the US AI hardware leg, confirmations, and counter evidence.'
      }
    >
      <div style={columnStyle}>
        {factor.us_driver_nodes.slice(0, 6).map(node => (
          <div key={node.node_id} style={panelBlockStyle}>
            <div style={cardHeaderStyle}>
              <div style={titleBlockStyle}>
                <div style={cardTitleStyle}>{node.name}</div>
                <div style={chromeStyles.quietMeta}>{node.driver_rule}</div>
              </div>
              <span style={statusBadgeStyle(node.role)}>{roleText(node.role, locale)}</span>
            </div>
            <TokenList tokens={node.symbols} />
            {node.conditional_symbols.length > 0 ? (
              <div style={chromeStyles.quietMeta}>
                {locale === 'zh-CN' ? '条件证据：' : 'Conditional: '}
                {node.conditional_symbols.join(' / ')}
              </div>
            ) : null}
            <div style={inlineMetaStyle}>
              <span style={chromeStyles.monoMeta}>weight {percentText(node.weight)}</span>
              <span style={chromeStyles.monoMeta}>vs {node.benchmark_symbols.join('/')}</span>
              <span style={chromeStyles.monoMeta}>D / 60m / 15m</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function CandidateRow({ candidate, locale }: { candidate: AShareCandidate; locale: LongclawLocale }) {
  return (
    <div style={candidateRowStyle}>
      <div style={chromeStyles.monoMeta}>{candidate.symbol || '未映射'}</div>
      <div style={titleBlockStyle}>
        <div style={fieldValueStyle}>{candidate.name || candidate.relation}</div>
        <div style={chromeStyles.quietMeta}>{candidate.relation || candidate.mapping_reason}</div>
      </div>
      <div style={{ ...metricValueStyle, fontSize: 13, textAlign: 'right' }}>
        {candidate.selection_score > 0 ? candidate.selection_score.toFixed(1) : roleText(candidate.role, locale)}
      </div>
    </div>
  )
}

function ChinaMappingPanel({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  return (
    <Section
      title={locale === 'zh-CN' ? '中国该炒什么' : 'What China maps to'}
      subtitle={
        locale === 'zh-CN'
          ? '直接落到 A股代码池，按核心、弹性、补涨和剔除原因排序。'
          : 'Map to tradable A-share tickers with priority and exclusion reasons.'
      }
    >
      <div style={columnStyle}>
        {factor.cn_mapping_nodes.slice(0, 6).map(node => (
          <div key={`${node.source_node_id}:${node.group}`} style={panelBlockStyle}>
            <div style={cardHeaderStyle}>
              <div style={titleBlockStyle}>
                <div style={cardTitleStyle}>{node.group}</div>
                <div style={chromeStyles.quietMeta}>{node.mapping_reason}</div>
              </div>
              <span style={statusBadgeStyle('specified')}>{percentText(node.confidence)}</span>
            </div>
            <div style={chromeStyles.quietMeta}>{node.confirmation_rule}</div>
            <div style={columnStyle}>
              {(node.top_candidates.length > 0 ? node.top_candidates : [...node.core_candidates, ...node.elastic_candidates])
                .slice(0, 5)
                .map(candidate => (
                  <CandidateRow key={`${node.group}:${candidate.symbol}:${candidate.name}`} candidate={candidate} locale={locale} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function KlineFusionPanel({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  return (
    <Section
      title={locale === 'zh-CN' ? 'K线融合与路径样本' : 'K-line fusion and path samples'}
      subtitle={
        locale === 'zh-CN'
          ? 'demo 只验证前台交互路径；真实指标必须来自历史验证 artifact。'
          : 'Demo validates the UI path only; real metrics must come from validation artifacts.'
      }
    >
      <div style={validationDetailGridStyle}>
        <div style={panelBlockStyle}>
          <div style={inlineMetaStyle}>
            <span style={statusBadgeStyle(factor.rhythm.demo ? 'demo' : factor.rhythm.status)}>
              {factor.rhythm.demo ? 'demo' : factor.rhythm.status}
            </span>
            <span style={chromeStyles.monoMeta}>{'US D/60m/15m -> A D/30m/5m'}</span>
          </div>
          <p style={paragraphStyle}>
            {locale === 'zh-CN'
              ? '节奏融合不直接给买卖指令，只判断美股驱动是否能被 A股竞价、开盘30分钟和盘中扩散接住。'
              : 'Rhythm fusion never creates orders; it checks whether A-share windows accept the US driver.'}
          </p>
        </div>
        <div style={columnStyle}>
          {(factor.rhythm.path_samples.length > 0 ? factor.rhythm.path_samples : factor.failure_samples).slice(0, 3).map((row, index) => {
            const sample = asRecord(row)
            return (
              <div key={textValue(sample.case_id, `path-${index}`)} style={panelBlockStyle}>
                <div style={inlineMetaStyle}>
                  <span style={statusBadgeStyle(textValue(sample.outcome ?? sample.reason, 'sample'))}>
                    {textValue(sample.outcome, locale === 'zh-CN' ? '样本' : 'sample')}
                  </span>
                  <span style={chromeStyles.monoMeta}>{textValue(sample.cn_symbol ?? sample.symbol)}</span>
                </div>
                <p style={paragraphStyle}>
                  {textValue(sample.path ?? sample.failure_reason ?? sample.reason ?? sample.title, locale === 'zh-CN' ? '暂无路径样本。' : 'No path sample.')}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

function ObservationPanel({
  factor,
  locale,
  labels,
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
  labels: ReturnType<typeof actionLabels>
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  runningActionKey?: string
  ideaPayload: Record<string, unknown>
}) {
  const gate = gateItems(factor, locale)
  return (
    <Section
      title={locale === 'zh-CN' ? '验证与观察账户' : 'Validation and paper account'}
      subtitle={
        locale === 'zh-CN'
          ? '只有验证、批准、启用同时满足，才进入策略页盘前池。'
          : 'Only verified, approved, and enabled factors enter the strategy pre-market pool.'
      }
      actions={
        <div style={actionRowStyle}>
          <FactorActionButton
            actionKey="rhythm"
            label={labels.rhythm}
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
        </div>
      }
    >
      <div style={columnStyle}>
        <MetricGrid factor={factor} locale={locale} compact />
        <PaperAccountSummary factor={factor} locale={locale} />
        <div style={columnStyle}>
          {gate.map(item => (
            <div key={item.label} style={checklistRowStyle}>
              <span style={checkDotStyle(item.passed)} />
              <span>{item.label}</span>
            </div>
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
    const existingFactor = factors.find(factor => factor.factor_id === factorId)
    const base = existingFactor ?? (
      factorId === selectedFactor?.factor_id ? selectedFactor : undefined
    )
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

  const currentIdeaText = ideaText.trim()
  const ideaPayload = {
    idea: currentIdeaText || selectedFactor.thesis,
    factor_id: currentIdeaText && currentIdeaText !== selectedFactor.thesis ? '' : selectedFactor.factor_id,
  }
  const fields = intakeFields(selectedFactor, locale)
  const gate = gateItems(selectedFactor, locale)
  const primaryDriver = selectedFactor.us_driver_nodes[0]
  const primaryMapping = selectedFactor.cn_mapping_nodes[0]

  return (
    <div style={workspaceStackStyle}>
      <section style={intakeShellStyle}>
        <div style={compactColumnStyle}>
          <div style={cardHeaderStyle}>
            <div style={titleBlockStyle}>
              <h2 style={chromeStyles.sectionTitle}>
                {locale === 'zh-CN' ? '跨市场映射工作单' : 'Cross-market mapping ticket'}
              </h2>
              <div style={chromeStyles.subtleText}>
                {locale === 'zh-CN'
                  ? '输入美股驱动线索，生成 A股代码映射和多周期节奏。'
                  : 'Enter US driver clues, then build A-share mapping and multi-timeframe rhythm.'}
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
              <FactorActionButton
                actionKey="rhythm"
                label={labels.rhythm}
                factor={selectedFactor}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
                payloadOverrides={ideaPayload}
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
                ? '例：LITE/COHR/FN 光器件链尾盘加速，同时 VRT/ETN/NVT 液冷链走强后，A股光模块与液冷谁能在 T+1 竞价和开盘30分钟承接？'
                : 'Example: after LITE/COHR/FN optical and VRT/ETN/NVT cooling rally, which A-share mapped basket accepts on T+1?'
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
          <div style={fieldGridStyle}>
            <WorkflowField
              label={locale === 'zh-CN' ? '美股主驱动' : 'Primary US driver'}
              value={primaryDriver ? `${primaryDriver.name} · ${primaryDriver.symbols.join('/')}` : 'N/A'}
            />
            <WorkflowField
              label={locale === 'zh-CN' ? 'A股主映射' : 'Primary A mapping'}
              value={primaryMapping ? `${primaryMapping.group} · ${primaryMapping.symbols.slice(0, 4).join('/')}` : 'N/A'}
            />
            <WorkflowField
              label={locale === 'zh-CN' ? '节奏状态' : 'Rhythm'}
              value={selectedFactor.rhythm.demo ? 'demo simulated' : selectedFactor.rhythm.status}
            />
            <WorkflowField
              label={locale === 'zh-CN' ? '实盘门禁' : 'Live gate'}
              value={selectedFactor.verified ? (selectedFactor.live_enabled ? 'published' : 'verified') : 'not verified'}
            />
          </div>
          <MetricGrid factor={selectedFactor} locale={locale} compact />
          <div style={actionRowStyle}>
            <FactorActionButton
              actionKey="rhythm"
              label={labels.rhythm}
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

      <RhythmTimeline factor={selectedFactor} locale={locale} />

      <div style={tradingDeskGridStyle}>
        <MarketDriverPanel factor={selectedFactor} locale={locale} />
        <ChinaMappingPanel factor={selectedFactor} locale={locale} />
        <ObservationPanel
          factor={selectedFactor}
          locale={locale}
          labels={labels}
          onOpenRecord={onOpenRecord}
          onRunAction={onRunAction}
          onActionStart={handleActionStart}
          onActionResult={handleActionResult}
          onActionError={handleActionError}
          runningActionKey={runningActionKey}
          ideaPayload={ideaPayload}
        />
      </div>

      <KlineFusionPanel factor={selectedFactor} locale={locale} />

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
