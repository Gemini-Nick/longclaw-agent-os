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
  onAddStrategySignal?: (signal: AiFactorStrategySignal) => void
}

type AIFactorRecord = Record<string, unknown> & {
  factor_id: string
  title: string
  thesis: string
  status: string
  research_mode: string
  factor_origin: string
  factor_family: Record<string, unknown>
  industry_beta: Record<string, unknown>
  expectation_alpha: Record<string, unknown>
  technical_confirmation: Record<string, unknown>
  strategy_integration: Record<string, unknown>
  factor_exposures: Record<string, unknown>
  validation_status: string
  risk_overlay_flags: string[]
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
type WorkbenchMode = 'research_first' | 'signal_first'

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
  rl_environments?: unknown
  candidate_factor_ideas?: unknown
  factor_idea_queue?: unknown
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

type DraftFieldKey =
  | 'why_effective'
  | 'target_universe'
  | 'trigger_condition'
  | 'avoid_condition'
  | 'invalidation_condition'
  | 'proof'

type DraftEditValues = Record<DraftFieldKey, string>

const wideDraftFieldKeys = new Set<DraftFieldKey>(['why_effective', 'proof'])

type TechnicalReviewKey =
  | 'industry_attribution'
  | 'beta_alpha_judgement'
  | 'supporting_evidence'
  | 'counter_evidence'
  | 'research_thesis'

type TechnicalReviewValues = Record<TechnicalReviewKey, string>

export type AiFactorStrategySignal = {
  id: string
  factorId: string
  title: string
  thesis: string
  origin: 'research_first' | 'signal_first'
  factorOrigin: string
  sourceCandidateTitle?: string
  industryAttribution: string
  betaAlphaJudgement: string
  supportingEvidence: string
  counterEvidence: string
  sourceSymbols: string[]
  factorExposure: string[]
  riskOverlayFlags: string[]
  strategyRole: string
  createdAt: string
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

const modeSwitchStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  ...surfaceStyles.listRow,
  ...surfaceStyles.listRowInteractive,
  flex: '0 1 320px',
  minHeight: 74,
  padding: '9px 12px',
  borderColor: active ? 'rgba(208, 138, 84, 0.55)' : palette.border,
  background: active ? 'rgba(208, 138, 84, 0.10)' : palette.surface,
  cursor: 'pointer',
  alignItems: 'flex-start',
})

const strategyWorkbenchGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 0.72fr) minmax(430px, 1.35fr) minmax(270px, 0.78fr)',
  gap: 12,
  alignItems: 'start',
}

const strategyPrimaryColumnStyle: React.CSSProperties = {
  ...columnStyle,
  gap: 12,
}

const strategyContextColumnStyle: React.CSSProperties = {
  ...columnStyle,
  gap: 12,
  position: 'sticky',
  top: 0,
}

const strategyInsightGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 8,
}

const strategyTwoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

const candidateQueueGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(250px, 0.72fr) minmax(420px, 1.28fr) minmax(250px, 0.78fr)',
  gap: 12,
  alignItems: 'start',
}

const technicalQueueListStyle: React.CSSProperties = {
  ...utilityStyles.stackedList,
  maxHeight: 'calc(100vh - 250px)',
  overflowY: 'auto',
  paddingRight: 2,
}

const technicalCandidateButtonStyle = (active: boolean): React.CSSProperties => ({
  ...surfaceStyles.listRow,
  ...surfaceStyles.listRowInteractive,
  flexDirection: 'column',
  gap: 8,
  cursor: 'pointer',
  borderColor: active ? 'rgba(208, 138, 84, 0.54)' : palette.border,
  background: active ? 'rgba(208, 138, 84, 0.09)' : palette.panel,
})

const compactScoreRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  width: '100%',
}

const compactScoreCellStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  background: palette.stone,
  padding: '6px 7px',
  minWidth: 0,
}

const discoveryWorkbenchGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
}

const discoveryWideBlockStyle: React.CSSProperties = {
  ...surfaceStyles.mutedSection,
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  gridColumn: '1 / -1',
}

const discoveryStepGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
}

const discoveryStepStyle = (active: boolean): React.CSSProperties => ({
  ...fieldBoxStyle,
  borderColor: active ? 'rgba(89, 217, 142, 0.34)' : palette.border,
  background: active ? 'rgba(89, 217, 142, 0.08)' : palette.panel,
})

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

const draftEditorWideBlockStyle: React.CSSProperties = {
  ...panelBlockStyle,
  gridColumn: '1 / -1',
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

const compactTextAreaStyle: React.CSSProperties = {
  ...ticketInputStyle,
  minHeight: 76,
  fontSize: 13,
  padding: '9px 10px',
}

const generatorStepGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 8,
}

const draftEditorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
  gap: 8,
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: 8,
}

const workflowPanelStyle: React.CSSProperties = {
  ...surfaceStyles.section,
  display: 'grid',
  gridTemplateColumns: 'minmax(190px, 0.42fr) minmax(0, 1fr)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 8,
}

const workflowWideGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 8,
}

const validationDetailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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

const researchBookListStyle: React.CSSProperties = {
  ...utilityStyles.stackedList,
  maxHeight: 'calc(100vh - 390px)',
  overflowY: 'auto',
  paddingRight: 2,
}

const fallbackFactor: AIFactorRecord = {
  factor_id: 'fallback-ai-hardware-cpo-memory',
  title: '美股 AI 硬件 -> A股光模块/CPO/存储联动因子',
  thesis:
    '跟踪美股 AI 硬件链的隔夜强度、订单/资本开支线索与 A 股光模块、CPO、存储方向的开盘承接和量价确认。',
  status: 'idea',
  research_mode: 'research_first',
  factor_origin: 'industry_research',
  factor_family: {
    family_id: 'industry_factor.ai_hardware',
    label: 'AI硬件行业因子',
    mode: 'research_first',
  },
  industry_beta: {
    name: 'ai_hardware_industry_chain',
    label: 'AI硬件产业链行业 beta',
  },
  expectation_alpha: {
    name: 'ai_expectation_revision',
    label: 'AI 产业预期修正 alpha',
  },
  technical_confirmation: {
    chan: '一买/二买/三买、中枢突破、背驰',
    macd: 'MACD 面积和背驰确认趋势是否破坏',
  },
  strategy_integration: {
    outputs: ['factor_exposure', 'factor_origin', 'validation_status'],
  },
  factor_exposures: {
    primary: 'industry_factor.ai_hardware',
    mode: 'research_first',
    origin: 'industry_research',
  },
  validation_status: 'not_run',
  risk_overlay_flags: ['gap_overheat', 'chain_divergence', 'support_break_without_reclaim'],
  last_verified_at: '未复盘',
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
    '未完成样本复盘。样本数、胜率、收益、IC 和失败样本必须来自 Signals 复盘结果。',
  ai_explanation:
    'AI 解释重点不是给单票结论，而是把海外硬件景气变化转成 A 股产业链观察假设，并要求盘中量价确认后才进入观察池。',
  live_status: 'not_verified',
  reproducibility_summary:
    'US T close 只能影响 A股 T+1 及之后；复盘需固定数据快照、交易日历、成本、滑点和股票池。',
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
      { state: 'sample_replayed', action: '复盘 T+1/T+5/T+10/T+20、IC、分层收益、MFE/MAE、失败样本', gate: '有样本复盘结果和样本数' },
      { state: 'observation_ready', action: '样本复盘通过后进入观察账户', gate: '只观察，不自动交易' },
      { state: 'disabled', action: '失败样本或失效条件触发后停用', gate: '不会污染策略页盘前池' },
    ],
    local_simulation: {
      data: 'Signals 本地数据快照；美股/A股日历按 as-of 固定。',
      account: 'paper factor account；记录模拟持仓、收益、回撤、暴露和换手。',
      portfolio: '美股篮子只做触发源，A股反应池才做观察组合。',
      storage: '研究账本写入 ai_factor_experiment_ledger，进入观察池前同步 strategy_snapshot。',
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
      ...(actionKey === 'validate' ? { demo_mode: true, mode: 'demo' } : {}),
      ...(actionKey === 'rhythm' ? { mode: 'demo' } : {}),
      ...(actionKey === 'publish' ? { live_enabled: true } : {}),
      ...payloadOverrides,
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
  const factorFamily = asRecord(raw.factor_family)
  const industryBeta = asRecord(raw.industry_beta)
  const expectationAlpha = asRecord(raw.expectation_alpha)
  const technicalConfirmation = asRecord(raw.technical_confirmation)
  const strategyIntegration = asRecord(raw.strategy_integration)
  const factorExposures = asRecord(raw.factor_exposures)
  return {
    ...raw,
    factor_id: textValue(raw.factor_id ?? raw.id ?? raw.idea_id ?? raw.environment_id, `ai-factor-${index + 1}`),
    title: textValue(raw.title ?? raw.name ?? raw.summary, fallbackFactor.title),
    thesis: textValue(raw.thesis ?? raw.hypothesis ?? raw.description ?? raw.idea, fallbackFactor.thesis),
    status: textValue(raw.status ?? raw.state, 'idea'),
    research_mode: textValue(raw.research_mode ?? raw.mode, fallbackFactor.research_mode),
    factor_origin: textValue(raw.factor_origin ?? raw.origin, fallbackFactor.factor_origin),
    factor_family: Object.keys(factorFamily).length > 0 ? factorFamily : fallbackFactor.factor_family,
    industry_beta: Object.keys(industryBeta).length > 0 ? industryBeta : fallbackFactor.industry_beta,
    expectation_alpha: Object.keys(expectationAlpha).length > 0 ? expectationAlpha : fallbackFactor.expectation_alpha,
    technical_confirmation: Object.keys(technicalConfirmation).length > 0 ? technicalConfirmation : fallbackFactor.technical_confirmation,
    strategy_integration: Object.keys(strategyIntegration).length > 0 ? strategyIntegration : fallbackFactor.strategy_integration,
    factor_exposures: Object.keys(factorExposures).length > 0 ? factorExposures : fallbackFactor.factor_exposures,
    validation_status: textValue(validation.status ?? raw.validation_status, fallbackFactor.validation_status),
    risk_overlay_flags: stringArrayValue(raw.risk_overlay_flags ?? raw.risk_tags),
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
        ? '样本复盘已生成；指标来自 Signals 因子研发内核。'
        : '未完成样本复盘。没有复盘结果，因此不显示胜率和收益。',
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

function normalizeCandidateFactorIdeas(
  dashboard: SignalsDashboard | null,
  signalsWebBaseUrl?: string,
): AIFactorRecord[] {
  const rawFactoryValue = (dashboard as (SignalsDashboard & { ai_factor_factory?: unknown }) | null)
    ?.ai_factor_factory
  const rawFactory = asRecord(rawFactoryValue) as AIFactorFactoryPayload
  const rawEnvironments = asRecordArray(rawFactory.rl_environments)
  const rawCandidates = rawEnvironments.length > 0
    ? rawEnvironments
    : [
        ...asRecordArray(rawFactory.candidate_factor_ideas),
        ...asRecordArray(rawFactory.factor_idea_queue),
      ]
  const seen = new Set<string>()
  return rawCandidates
    .map(normalizeFactor)
    .filter(factor => {
      if (seen.has(factor.factor_id)) return false
      seen.add(factor.factor_id)
      return true
    })
    .map(factor => ({
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
  const notVerified = locale === 'zh-CN' ? '未复盘' : 'Not replayed'
  const valueOrUnverified = (value: string) => factor.verified ? value : notVerified
  return [
    {
      label: locale === 'zh-CN' ? '最近复盘' : 'Last replay',
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
      draft: 'Build factor definition',
      rhythm: 'Review price rhythm',
      validate: 'Replay samples',
      failures: 'Failure samples',
      observe: 'Move to observation',
      disable: 'Stop tracking',
    }
  }
  return {
    draft: '生成因子定义',
    rhythm: '推演K线节奏',
    validate: '复盘历史样本',
    failures: '查看失败样本',
    observe: '进入观察池',
    disable: '停止跟踪',
  }
}

function researchSteps(locale: LongclawLocale): Array<{ id: WorkflowStageKey; label: string; detail: string }> {
  if (locale !== 'zh-CN') {
    return [
      { id: 'idea', label: 'Idea', detail: 'Trading hypothesis' },
      { id: 'signals', label: 'Signals', detail: 'czsc atomic signals' },
      { id: 'event', label: 'Event', detail: 'all / any / not' },
      { id: 'validation', label: 'Sample replay', detail: 'Alphalens-style evidence' },
      { id: 'lifecycle', label: 'Lifecycle', detail: 'init / observe / disable' },
    ]
  }
  return [
    { id: 'idea', label: '提出假设', detail: '行业 beta / 预期 alpha' },
    { id: 'signals', label: '拆量价证据', detail: '趋势、震荡、背驰、量能' },
    { id: 'event', label: '形成观察条件', detail: '必须满足/任选确认/风险覆盖' },
    { id: 'validation', label: '复盘样本', detail: '收益、失败、回撤、扩散率' },
    { id: 'lifecycle', label: '策略赋能', detail: '候选排序/观察池/风险覆盖' },
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
      { label: 'Sample replay evidence exists', passed: verified },
      { label: 'Failure samples reviewed', passed: failuresReviewed },
      { label: 'Trader approved observation', passed: approved },
      { label: 'No auto-order instruction', passed: true },
    ]
  }
  return [
    { label: '已有样本复盘和样本数', passed: verified },
    { label: '失败样本已复核并形成边界', passed: failuresReviewed },
    { label: '交易员允许进入观察池', passed: approved },
    { label: 'AI 不产生自动下单指令', passed: true },
  ]
}

function researchModeLabel(mode: string, locale: LongclawLocale): string {
  if (mode === 'signal_first') {
    return locale === 'zh-CN' ? '盘面线索因子' : 'Market-signal factor'
  }
  if (mode === 'research_first') {
    return locale === 'zh-CN' ? '投研发现因子' : 'Research-first'
  }
  return humanizeTokenLocale(locale, mode || 'unknown')
}

function rewardRecord(factor: AIFactorRecord): Record<string, unknown> {
  return asRecord(asRecord(factor.evaluation).reward)
}

function factorEvaluationRecord(factor: AIFactorRecord): Record<string, unknown> {
  return asRecord(asRecord(factor.evaluation).factor_evaluation)
}

function portfolioEvaluationRecord(factor: AIFactorRecord): Record<string, unknown> {
  return asRecord(asRecord(factor.evaluation).portfolio_evaluation)
}

function environmentMetricsRecord(factor: AIFactorRecord): Record<string, unknown> {
  return asRecord(factor.environment_metrics)
}

function splitKeysRecord(factor: AIFactorRecord): Record<string, unknown> {
  return asRecord(factor.split_keys)
}

function signalFirstTheme(candidate: AIFactorRecord, locale: LongclawLocale): string {
  const splitKeys = splitKeysRecord(candidate)
  const theme = textValue(splitKeys.theme ?? candidate.factor_exposures.theme)
  if (!theme || theme === '技术结构共振') {
    return locale === 'zh-CN' ? '主题待归因' : 'Theme pending'
  }
  return theme
}

function factorResearchQuestion(candidate: AIFactorRecord, locale: LongclawLocale): string {
  const splitKeys = splitKeysRecord(candidate)
  const theme = signalFirstTheme(candidate, locale)
  const signalType = humanizeTokenLocale(locale, textValue(splitKeys.signal_type_family, 'technical'))
  const freq = humanizeTokenLocale(locale, textValue(splitKeys.freq_bucket, 'daily'))
  const scope = humanizeTokenLocale(locale, textValue(splitKeys.scan_scope, 'postmarket'))
  if (locale !== 'zh-CN') {
    return `Does ${theme} ${scope}/${freq}/${signalType} predict forward returns?`
  }
  return `${theme}的${scope}/${freq}/${signalType}，是否有未来收益预测力？`
}

function themeQualityText(candidate: AIFactorRecord, locale: LongclawLocale): string {
  const splitKeys = splitKeysRecord(candidate)
  const theme = textValue(splitKeys.theme ?? candidate.factor_exposures.theme)
  const metrics = environmentMetricsRecord(candidate)
  const cleanliness = numberValue(metrics.cluster_cleanliness, 0)
  const reward = rewardRecord(candidate)
  const gates = stringArrayValue(reward.blocking_gates ?? candidate.blocking_gates)
  if (gates.some(gate => gate.includes('overbroad'))) {
    return locale === 'zh-CN' ? '过宽' : 'Broad'
  }
  if (!theme || theme === '技术结构共振' || cleanliness <= 0.65) {
    return locale === 'zh-CN' ? '待归因' : 'Pending'
  }
  if (cleanliness >= 0.9) {
    return locale === 'zh-CN' ? '集中' : 'Focused'
  }
  return locale === 'zh-CN' ? '待确认' : 'Review'
}

function signalFirstDecision(
  candidate: AIFactorRecord | undefined,
  locale: LongclawLocale,
): { label: string; detail: string; tone: string } {
  if (!candidate) {
    return {
      label: locale === 'zh-CN' ? '先选择一个因子问题' : 'Select a factor question',
      detail: locale === 'zh-CN' ? '左侧选中一个问题后，再定义股票池、信号和复盘规则。' : 'Pick a question first, then define universe, signal, and replay rule.',
      tone: 'pending',
    }
  }
  const reward = rewardRecord(candidate)
  const status = textValue(reward.status ?? candidate.status ?? candidate.validation_status, 'pending_validation')
  const gates = stringArrayValue(reward.blocking_gates ?? candidate.blocking_gates)
  if (status === 'validated') {
    return {
      label: locale === 'zh-CN' ? '可进入观察' : 'Ready for observation',
      detail: locale === 'zh-CN' ? '预测力和组合承接都通过后，才允许进入观察草稿。' : 'Predictive power and portfolio fit passed.',
      tone: 'validated',
    }
  }
  if (status === 'observation_only') {
    return {
      label: locale === 'zh-CN' ? '只能观察' : 'Observation only',
      detail: locale === 'zh-CN' ? '盘中边界或样本不足时，只保留为研究线索，不发布为策略。' : 'Intraday boundary or weak sample support keeps this as research context.',
      tone: 'observation_only',
    }
  }
  if (status === 'not_evaluable') {
    return {
      label: locale === 'zh-CN' ? '暂不可评估' : 'Not evaluable',
      detail: gates.length > 0
        ? `${locale === 'zh-CN' ? '阻塞：' : 'Blocked by: '}${gates.map(gate => humanizeTokenLocale(locale, gate)).join(' / ')}`
        : (locale === 'zh-CN' ? '主题过宽、样本不足或数据边界不清。' : 'Theme is too broad, samples are insufficient, or data boundary is unclear.'),
      tone: 'not_evaluable',
    }
  }
  if (status === 'rejected') {
    return {
      label: locale === 'zh-CN' ? '淘汰或重写' : 'Reject or rewrite',
      detail: locale === 'zh-CN' ? '预测力、分位扩散或组合承接没有通过。' : 'Predictive power, quantile spread, or portfolio fit failed.',
      tone: 'rejected',
    }
  }
  return {
    label: locale === 'zh-CN' ? '先跑预测力复盘' : 'Replay predictive power first',
    detail: locale === 'zh-CN' ? '不要看技术指标本身，先验证它对 T+5/T+20 forward return 是否有排序能力。' : 'Do not judge the indicator itself; first test whether it ranks T+5/T+20 forward returns.',
    tone: 'pending_validation',
  }
}

function signalFirstRewardItems(candidate: AIFactorRecord | undefined, locale: LongclawLocale) {
  if (!candidate) return []
  const reward = rewardRecord(candidate)
  const factorEval = factorEvaluationRecord(candidate)
  const portfolioEval = portfolioEvaluationRecord(candidate)
  const scoreText = (value: unknown) => {
    const score = numberValue(value, 0)
    return score > 0 ? score.toFixed(1) : (locale === 'zh-CN' ? '待复盘' : 'Pending')
  }
  const returnText = (value: unknown) => {
    const score = numberValue(value, 0)
    return score !== 0 ? signedPercentText(score) : (locale === 'zh-CN' ? '待复盘' : 'Pending')
  }
  return [
    {
      label: locale === 'zh-CN' ? '预测力分' : 'Factor score',
      value: scoreText(reward.factor_score),
    },
    {
      label: locale === 'zh-CN' ? 'Rank IC' : 'Rank IC',
      value: numberValue(factorEval.rank_ic, 0) !== 0
        ? numberValue(factorEval.rank_ic, 0).toFixed(3)
        : (locale === 'zh-CN' ? '待复盘' : 'Pending'),
    },
    {
      label: locale === 'zh-CN' ? '分位扩散' : 'Quantile spread',
      value: returnText(factorEval.quantile_spread),
    },
    {
      label: locale === 'zh-CN' ? '组合承接' : 'Portfolio score',
      value: scoreText(reward.portfolio_score ?? portfolioEval.portfolio_score),
    },
  ]
}

function technicalCandidateAdvice(
  candidate: AIFactorRecord,
  locale: LongclawLocale,
): { label: string; tone: string } {
  const splitKeys = asRecord(candidate.split_keys)
  const reward = rewardRecord(candidate)
  const blockingGates = stringArrayValue(reward.blocking_gates ?? candidate.blocking_gates)
  const status = textValue(reward.status ?? candidate.status ?? candidate.validation_status)
  const scanScope = textValue(splitKeys.scan_scope ?? candidate.scan_scope)
  const resonanceGrade = textValue(splitKeys.resonance_grade ?? candidate.resonance_grade)
  const isIntraday = scanScope.includes('intraday')
  const isOverbroad = blockingGates.some(gate => gate.includes('overbroad')) || status === 'not_evaluable'

  if (isOverbroad) {
    return {
      label: locale === 'zh-CN' ? '先补主题归因' : 'Attribute first',
      tone: 'not_evaluable',
    }
  }
  if (isIntraday || status === 'observation_only') {
    return {
      label: locale === 'zh-CN' ? '盘中只观察' : 'Intraday observe',
      tone: 'observation_only',
    }
  }
  if (resonanceGrade.includes('conflict')) {
    return {
      label: locale === 'zh-CN' ? '先写失效条件' : 'Define invalidation',
      tone: 'warning',
    }
  }
  if (resonanceGrade.includes('strong_resonance') || resonanceGrade.includes('multi_period')) {
    return {
      label: locale === 'zh-CN' ? '进入预测力复盘' : 'Replay predictive power',
      tone: 'validated',
    }
  }
  return {
    label: locale === 'zh-CN' ? '定义后复盘' : 'Define then replay',
    tone: status || 'pending_validation',
  }
}

function factorScoreItems(factor: AIFactorRecord, locale: LongclawLocale) {
  const environmentMetrics = environmentMetricsRecord(factor)
  if (factor.research_mode === 'signal_first' && Object.keys(environmentMetrics).length > 0) {
    const sourceSignals = asRecordArray(factor.source_signals)
    const sourceSignalCount = numberValue(
      environmentMetrics.source_signal_count ?? environmentMetrics.signal_count,
      sourceSignals.length,
    )
    const uniqueSymbolCount = numberValue(
      environmentMetrics.unique_symbol_count ?? environmentMetrics.symbol_count,
      technicalSourceSymbols(factor).length,
    )
    return [
      {
        label: locale === 'zh-CN' ? '线索数' : 'Clues',
        value: sourceSignalCount > 0 ? String(sourceSignalCount) : (locale === 'zh-CN' ? '待扫描' : 'Pending'),
      },
      {
        label: locale === 'zh-CN' ? '标的数' : 'Symbols',
        value: uniqueSymbolCount > 0 ? String(uniqueSymbolCount) : (locale === 'zh-CN' ? '待扫描' : 'Pending'),
      },
      {
        label: locale === 'zh-CN' ? '主题质量' : 'Theme quality',
        value: themeQualityText(factor, locale),
      },
    ]
  }
  const assessment = asRecord(factor.beta_alpha_assessment)
  const breakdown = asRecord(factor.factor_score_breakdown)
  const technical = asRecord(factor.technical_confirmation)
  const score = (key: string) => numberValue(
    factor[key] ??
      assessment[key] ??
      breakdown[key] ??
      technical[key],
    0,
  )
  const text = (value: number) => value > 0 ? value.toFixed(1) : (locale === 'zh-CN' ? '待复盘' : 'Pending')
  return [
    {
      label: locale === 'zh-CN' ? '行业 beta' : 'Industry beta',
      value: text(score('industry_beta_score')),
    },
    {
      label: locale === 'zh-CN' ? '预期 alpha' : 'Expectation alpha',
      value: text(score('expectation_alpha_score')),
    },
    {
      label: locale === 'zh-CN' ? '技术确认' : 'Technical confirmation',
      value: text(score('technical_confirmation_score')),
    },
  ]
}

function draftFieldSpecs(locale: LongclawLocale): Array<{ key: DraftFieldKey; label: string }> {
  if (locale !== 'zh-CN') {
    return [
      { key: 'why_effective', label: 'Why it should work' },
      { key: 'target_universe', label: 'Universe' },
      { key: 'trigger_condition', label: 'Trigger' },
      { key: 'avoid_condition', label: 'Avoid' },
      { key: 'invalidation_condition', label: 'Invalidation' },
      { key: 'proof', label: 'Replay plan' },
    ]
  }
  return [
    { key: 'why_effective', label: '为什么有效' },
    { key: 'target_universe', label: '股票池' },
    { key: 'trigger_condition', label: '触发条件' },
    { key: 'avoid_condition', label: '回避条件' },
    { key: 'invalidation_condition', label: '失效条件' },
    { key: 'proof', label: '复盘要求' },
  ]
}

function draftValuesFromFactor(factor: AIFactorRecord): DraftEditValues {
  const research = asRecord(factor.research)
  const draft = asRecord(factor.draft)
  const rawDraft = Object.keys(research).length > 0 ? research : draft
  const itemByLabel = (label: string) => (
    factor.draft_items.find(item => item.label.includes(label))?.value ?? ''
  )
  return {
    why_effective: textValue(rawDraft.why_effective ?? rawDraft.why, itemByLabel('为什么有效')),
    target_universe: textValue(rawDraft.target_universe ?? rawDraft.universe, itemByLabel('标的池')),
    trigger_condition: textValue(rawDraft.trigger_condition ?? rawDraft.trigger, itemByLabel('触发')),
    avoid_condition: textValue(rawDraft.avoid_condition ?? rawDraft.avoid, itemByLabel('回避')),
    invalidation_condition: textValue(rawDraft.invalidation_condition ?? rawDraft.invalidation, itemByLabel('失效')),
    proof: textValue(rawDraft.proof ?? rawDraft.historical_proof, itemByLabel('历史证明')),
  }
}

function draftPayloadFromValues(values: DraftEditValues): Record<string, string> {
  return {
    why_effective: values.why_effective,
    target_universe: values.target_universe,
    trigger_condition: values.trigger_condition,
    avoid_condition: values.avoid_condition,
    invalidation_condition: values.invalidation_condition,
    proof: values.proof,
  }
}

function draftValuesEqual(left: DraftEditValues, right: DraftEditValues): boolean {
  return (Object.keys(left) as DraftFieldKey[]).every(key => left[key] === right[key])
}

function technicalSignalLines(candidate: AIFactorRecord): string[] {
  const sourceSignals = asRecordArray(candidate.source_signals)
  return sourceSignals.slice(0, 8).map((signal, index) => {
    const symbol = textValue(signal.symbol ?? signal.raw_code ?? signal.code, `signal-${index + 1}`)
    const signalType = textValue(signal.signal_type ?? signal.type ?? signal.name, '技术信号')
    const freq = textValue(signal.freq ?? signal.level ?? signal.timeframe)
    return [symbol, signalType, freq].filter(Boolean).join(' · ')
  })
}

function technicalSourceSymbols(candidate: AIFactorRecord): string[] {
  const seen = new Set<string>()
  return asRecordArray(candidate.source_signals)
    .map(signal => textValue(signal.symbol ?? signal.raw_code ?? signal.code))
    .filter(symbol => {
      const key = symbol.trim().toUpperCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function technicalReviewValuesFromCandidate(
  candidate: AIFactorRecord,
  locale: LongclawLocale,
): TechnicalReviewValues {
  const groups = stringArrayValue(candidate.factor_exposures.groups)
  const betaLabel = textValue(candidate.industry_beta.label ?? candidate.industry_beta.name, candidate.title)
  const alphaLabel = textValue(candidate.expectation_alpha.label ?? candidate.expectation_alpha.name, candidate.title)
  const evidenceLines = technicalSignalLines(candidate)
  const exposureText = groups.length > 0 ? groups.join(' / ') : candidate.title
  if (locale !== 'zh-CN') {
    return {
      industry_attribution: exposureText,
      beta_alpha_judgement: `Trigger: same-theme signal appears after close; classify whether it is broad beta (${betaLabel}) or expectation alpha (${alphaLabel}).`,
      supporting_evidence: evidenceLines.length > 0 ? evidenceLines.join('\n') : candidate.thesis,
      counter_evidence: 'Invalidate if signals are isolated, the leader does not confirm, quantile spread is not positive, or cost-adjusted return is negative.',
      research_thesis: `Replay rule: rank by signal strength, test Rank IC, quantile spread, T+5/T+20 returns, then gate with cost-adjusted return, drawdown, and turnover.`,
    }
  }
  return {
    industry_attribution: exposureText,
    beta_alpha_judgement: `触发定义：收盘后出现同主题技术线索；先判断这是行业 beta（${betaLabel}），还是少数高暴露标的先走强的预期 alpha（${alphaLabel}）。`,
    supporting_evidence: evidenceLines.length > 0 ? evidenceLines.join('\n') : candidate.thesis,
    counter_evidence: '如果只是单票孤立拉升、链主不确认、分位收益不扩散、成本后收益为负，就不进入观察。',
    research_thesis: '复盘规则：按信号强度排序，先看 Rank IC、分位收益、T+5/T+20 forward return，再用成本后收益、回撤和换手做组合 gate。',
  }
}

function strategySignalFromTechnicalCandidate(
  candidate: AIFactorRecord,
  values: TechnicalReviewValues,
): AiFactorStrategySignal {
  const groups = stringArrayValue(candidate.factor_exposures.groups)
  const outputs = stringArrayValue(candidate.strategy_integration.outputs)
  return {
    id: `ai-factor-signal:${candidate.factor_id}:${Date.now()}`,
    factorId: candidate.factor_id,
    title: candidate.title,
    thesis: values.research_thesis.trim() || candidate.thesis,
    origin: 'signal_first',
    factorOrigin: candidate.factor_origin,
    sourceCandidateTitle: candidate.title,
    industryAttribution: values.industry_attribution.trim(),
    betaAlphaJudgement: values.beta_alpha_judgement.trim(),
    supportingEvidence: values.supporting_evidence.trim(),
    counterEvidence: values.counter_evidence.trim(),
    sourceSymbols: technicalSourceSymbols(candidate),
    factorExposure: groups.length > 0 ? groups : [candidate.title],
    riskOverlayFlags: candidate.risk_overlay_flags.length > 0
      ? candidate.risk_overlay_flags
      : ['isolated_move', 'leader_not_confirmed', 'range_rebound'],
    strategyRole: outputs.length > 0
      ? outputs.join(' / ')
      : 'candidate_sorting / watch_pool / risk_review',
    createdAt: new Date().toISOString(),
  }
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
                locale === 'zh-CN' ? '复盘后回看边界。' : 'Review boundary after sample replay.',
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
      value: enabled ? signedPercentText(numberValue(paper.total_return, 0)) : locale === 'zh-CN' ? '未复盘' : 'Not replayed',
    },
    {
      label: locale === 'zh-CN' ? '最大回撤' : 'Max drawdown',
      value: enabled ? signedPercentText(numberValue(paper.max_drawdown, 0)) : locale === 'zh-CN' ? '未复盘' : 'Not replayed',
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
              : locale === 'zh-CN' ? '等待样本复盘' : 'Waiting sample replay'}
          </span>
          <span style={statusBadgeStyle(booleanValue(paper.no_auto_order, true) ? 'disabled' : 'risk')}>
            {locale === 'zh-CN' ? '不自动下单' : 'No auto order'}
          </span>
        </div>
        <div style={chromeStyles.quietMeta}>
          {equityCurve.length > 0
            ? `${locale === 'zh-CN' ? '权益曲线样本' : 'Equity curve points'}: ${equityCurve.length}`
            : locale === 'zh-CN'
              ? '复盘样本后生成模拟权益曲线。'
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
        '复盘 T+1/T+5/T+10/T+20 后续收益',
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
              {locale === 'zh-CN' ? '形成观察条件' : 'Build observation setup'}
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
              label={locale === 'zh-CN' ? '观察方向' : 'Observation side'}
              value={<span style={statusBadgeStyle('specified')}>{factor.workflow.event.operate}</span>}
            />
            <WorkflowField
              label={locale === 'zh-CN' ? '条件成立后' : 'When conditions hold'}
              value={factor.workflow.event.next}
            />
            <WorkflowField label={locale === 'zh-CN' ? '必须满足' : 'Must hold'} value={<TokenList tokens={factor.workflow.event.signals_all} />} />
            <WorkflowField label={locale === 'zh-CN' ? '任选确认' : 'Any confirmation'} value={<TokenList tokens={factor.workflow.event.signals_any} />} />
            <WorkflowField label={locale === 'zh-CN' ? '风险排除' : 'Risk exclusions'} value={<TokenList tokens={factor.workflow.event.signals_not} />} />
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
              {locale === 'zh-CN' ? '去复盘样本' : 'Go to sample replay'}
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
            {locale === 'zh-CN' ? '拆量价证据' : 'Break down evidence'}
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
              ? '从行业故事开始，逐层拆成量价证据、观察条件、样本复盘和策略使用。'
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
          ? 'demo 只检查前台交互路径；真实指标必须来自历史样本复盘。'
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
      title={locale === 'zh-CN' ? '样本复盘与观察账户' : 'Sample replay and paper account'}
      subtitle={
        locale === 'zh-CN'
          ? '只有样本复盘、人工确认、观察启用同时满足，才进入策略页盘前池。'
          : 'Only sample replay, trader review, and observation enablement enter the strategy pre-market pool.'
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

function WorkbenchModeSwitch({
  mode,
  locale,
  onChange,
}: {
  mode: WorkbenchMode
  locale: LongclawLocale
  onChange: (mode: WorkbenchMode) => void
}) {
  const items: Array<{ mode: WorkbenchMode; title: string; detail: string }> = locale === 'zh-CN'
    ? [
        { mode: 'research_first', title: '已有行业假设', detail: '先写产业链逻辑，再验证量价承接和组合风险。' },
        { mode: 'signal_first', title: '从盘面线索找因子', detail: '先形成可验证问题，再跑预测力和组合承接。' },
      ]
    : [
        { mode: 'research_first', title: 'Existing industry thesis', detail: 'Write the chain logic first, then validate price acceptance and risk.' },
        { mode: 'signal_first', title: 'Find factors from market clues', detail: 'Define a testable question, then replay predictive power and portfolio fit.' },
      ]
  return (
    <div style={modeSwitchStyle}>
      {items.map(item => (
        <button
          key={item.mode}
          type="button"
          style={modeButtonStyle(mode === item.mode)}
          onClick={() => onChange(item.mode)}
        >
          <div style={titleBlockStyle}>
            <div style={inlineMetaStyle}>
              <span style={statusBadgeStyle(item.mode)}>{researchModeLabel(item.mode, locale)}</span>
              {mode === item.mode ? <span style={statusBadgeStyle('active')}>{locale === 'zh-CN' ? '当前路径' : 'Current'}</span> : null}
            </div>
            <div style={cardTitleStyle}>{item.title}</div>
            <div style={chromeStyles.quietMeta}>{item.detail}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

function FactorIdentityPanel({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  const familyLabel = textValue(factor.factor_family.label, factor.title)
  const betaLabel = textValue(factor.industry_beta.label ?? factor.industry_beta.name, 'industry beta')
  const alphaLabel = textValue(factor.expectation_alpha.label ?? factor.expectation_alpha.name, 'expectation alpha')
  return (
    <Section
      title={locale === 'zh-CN' ? '因子定位' : 'Factor positioning'}
      subtitle={
        locale === 'zh-CN'
          ? '先说清楚这条因子为什么存在，再讨论买点和观察池。'
          : 'Clarify why the factor exists before discussing entries and watch lists.'
      }
    >
      <div style={columnStyle}>
        <div style={inlineMetaStyle}>
          <span style={statusBadgeStyle(factor.research_mode)}>
            {researchModeLabel(factor.research_mode, locale)}
          </span>
          <span style={statusBadgeStyle(factor.factor_origin)}>
            {humanizeTokenLocale(locale, factor.factor_origin)}
          </span>
          <span style={statusBadgeStyle(factor.validation_status)}>
            {humanizeTokenLocale(locale, factor.validation_status)}
          </span>
        </div>
        <div style={strategyInsightGridStyle}>
          <WorkflowField label={locale === 'zh-CN' ? '因子族' : 'Family'} value={familyLabel} />
          <WorkflowField label={locale === 'zh-CN' ? '行业 beta' : 'Industry beta'} value={betaLabel} />
          <WorkflowField label={locale === 'zh-CN' ? '预期 alpha' : 'Expectation alpha'} value={alphaLabel} />
        </div>
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '因子假设' : 'Thesis'}</div>
          <p style={paragraphStyle}>{factor.thesis}</p>
        </div>
      </div>
    </Section>
  )
}

function FactorScoreGrid({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  return (
    <div style={strategyInsightGridStyle}>
      {factorScoreItems(factor, locale).map(item => (
        <div key={item.label} style={metricCellStyle}>
          <div style={metricValueStyle}>{item.value}</div>
          <div style={chromeStyles.quietMeta}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function PendingFactorGeneratorPanel({
  locale,
  idea,
  source,
  factor,
  labels,
  ideaPayload,
  onOpenRecord,
  onRunAction,
  onActionStart,
  onActionResult,
  onActionError,
  runningActionKey,
}: {
  locale: LongclawLocale
  idea: string
  source: Record<string, unknown> | null
  factor: AIFactorRecord
  labels: ReturnType<typeof actionLabels>
  ideaPayload: Record<string, unknown>
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  runningActionKey?: string
}) {
  const sourceTitle = textValue(source?.source_candidate_title ?? source?.title)
  const steps = locale === 'zh-CN'
    ? [
        ['输入假设', '先保留你的原始判断，不套旧模板。'],
        ['生成草案', '产出因子ID、股票池、触发、回避、失效和复盘口径。'],
        ['进入研发', '生成后再拆量价证据、复盘样本和观察池。'],
      ]
    : [
        ['Input thesis', 'Keep the raw hypothesis without reusing the old template.'],
        ['Generate draft', 'Create ID, universe, trigger, avoid, invalidation, and replay plan.'],
        ['Research loop', 'Then break down evidence, replay samples, and observe.'],
      ]
  return (
    <Section
      title={locale === 'zh-CN' ? '因子生成器' : 'Factor generator'}
      subtitle={
        locale === 'zh-CN'
          ? '当前还没有生成草案；这里不再显示上一条因子的结果。'
          : 'No draft has been generated yet; this panel will not show the previous factor.'
      }
      actions={
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
          disabled={!idea.trim()}
        />
      }
    >
      <div style={columnStyle}>
        <div style={inlineMetaStyle}>
          <span style={statusBadgeStyle('idea')}>{locale === 'zh-CN' ? '待生成' : 'Pending generation'}</span>
          {sourceTitle ? (
            <span style={statusBadgeStyle('signal_first')}>
              {locale === 'zh-CN' ? `来自技术发现：${sourceTitle}` : `From discovery: ${sourceTitle}`}
            </span>
          ) : (
            <span style={statusBadgeStyle('research_first')}>
              {locale === 'zh-CN' ? '投研输入' : 'Research input'}
            </span>
          )}
        </div>
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '原始假设' : 'Raw thesis'}</div>
          <p style={paragraphStyle}>{idea || (locale === 'zh-CN' ? '先在左侧写入因子假设。' : 'Write a thesis on the left first.')}</p>
        </div>
        <div style={generatorStepGridStyle}>
          {steps.map(([title, detail], index) => (
            <div key={title} style={fieldBoxStyle}>
              <div style={stepNumberStyle}>{String(index + 1).padStart(2, '0')}</div>
              <div style={stepLabelStyle}>{title}</div>
              <div style={chromeStyles.quietMeta}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function FactorGenerationResultPanel({
  factor,
  locale,
  draftValues,
  hasLocalEdits,
  labels,
  onDraftValueChange,
  onApplyDraftEdits,
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
  draftValues: DraftEditValues
  hasLocalEdits: boolean
  labels: ReturnType<typeof actionLabels>
  onDraftValueChange: (key: DraftFieldKey, value: string) => void
  onApplyDraftEdits: () => void
  onStageChange: (stage: WorkflowStageKey) => void
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  runningActionKey?: string
  ideaPayload: Record<string, unknown>
}) {
  return (
    <Section
      title={locale === 'zh-CN' ? '生成出的因子草案' : 'Generated factor draft'}
      subtitle={
        locale === 'zh-CN'
          ? '这不是只读说明；你可以直接改股票池、触发、回避和失效条件，再进入样本复盘。'
          : 'This is editable: adjust universe, trigger, avoid, and invalidation before replay.'
      }
      actions={
        <div style={actionRowStyle}>
          <button
            type="button"
            style={buttonStyleForState(primaryButtonStyle, !hasLocalEdits, 'primary')}
            disabled={!hasLocalEdits}
            onClick={onApplyDraftEdits}
          >
            {locale === 'zh-CN' ? '应用草案调整' : 'Apply edits'}
          </button>
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
        <div style={inlineMetaStyle}>
          <span style={statusBadgeStyle(factor.status)}>{humanizeTokenLocale(locale, factor.status)}</span>
          <span style={statusBadgeStyle(factor.validation_status)}>{humanizeTokenLocale(locale, factor.validation_status)}</span>
          <span style={chromeStyles.monoMeta}>{factor.factor_id}</span>
        </div>
        <div style={panelBlockStyle}>
          <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '生成标题' : 'Generated title'}</div>
          <div style={cardTitleStyle}>{factor.title}</div>
          <p style={paragraphStyle}>{factor.thesis}</p>
        </div>
        <div style={draftEditorGridStyle}>
          {draftFieldSpecs(locale).map(field => (
            <label
              key={field.key}
              style={wideDraftFieldKeys.has(field.key) ? draftEditorWideBlockStyle : panelBlockStyle}
            >
              <span style={fieldLabelStyle}>{field.label}</span>
              <textarea
                value={draftValues[field.key]}
                onChange={event => onDraftValueChange(field.key, event.target.value)}
                style={compactTextAreaStyle}
              />
            </label>
          ))}
        </div>
        <div style={strategyTwoColumnStyle}>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '量价证据骨架' : 'Signal skeleton'}</div>
            {factor.workflow.signals.slice(0, 4).map(signal => (
              <div key={signal.name} style={fieldValueStyle}>
                <span style={chromeStyles.monoMeta}>{signal.name}</span>
                {' · '}
                {signal.definition}
              </div>
            ))}
          </div>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '观察条件' : 'Observation setup'}</div>
            <WorkflowField label={locale === 'zh-CN' ? '必须满足' : 'Must hold'} value={<TokenList tokens={factor.workflow.event.signals_all} />} />
            <WorkflowField label={locale === 'zh-CN' ? '任选确认' : 'Any confirmation'} value={<TokenList tokens={factor.workflow.event.signals_any} />} />
            <WorkflowField label={locale === 'zh-CN' ? '风险排除' : 'Risk exclusions'} value={<TokenList tokens={factor.workflow.event.signals_not} />} />
          </div>
        </div>
        <div style={actionRowStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => onStageChange('signals')}>
            {locale === 'zh-CN' ? '继续拆量价证据' : 'Break down evidence'}
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => onStageChange('validation')}>
            {locale === 'zh-CN' ? '查看复盘口径' : 'Review replay setup'}
          </button>
        </div>
      </div>
    </Section>
  )
}

function StrategyEnablementPanel({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  const outputs = stringArrayValue(factor.strategy_integration.outputs)
  const groups = stringArrayValue(factor.factor_exposures.groups)
  const risks = factor.risk_overlay_flags.length > 0 ? factor.risk_overlay_flags : ['gap_overheat', 'chain_divergence']
  return (
    <Section
      title={locale === 'zh-CN' ? '策略赋能' : 'Strategy use'}
      subtitle={
        locale === 'zh-CN'
          ? '策略模块拿到的是因子暴露、承接强度和风险覆盖，不只是买点。'
          : 'The strategy module receives exposure, acceptance strength, and risk overlays, not just entries.'
      }
    >
      <div style={columnStyle}>
        <FactorScoreGrid factor={factor} locale={locale} />
        <div style={strategyTwoColumnStyle}>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '影响位置' : 'Where it affects strategy'}</div>
            <TokenList tokens={outputs.length > 0 ? outputs : ['candidate_sorting', 'watch_pool', 'risk_review']} />
          </div>
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '风险覆盖' : 'Risk overlays'}</div>
            <TokenList tokens={risks} />
          </div>
        </div>
        {groups.length > 0 ? (
          <div style={panelBlockStyle}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '行业暴露' : 'Exposure groups'}</div>
            <TokenList tokens={groups} />
          </div>
        ) : null}
      </div>
    </Section>
  )
}

function ResearchBookPanel({
  factors,
  selectedFactor,
  locale,
  onSelect,
}: {
  factors: AIFactorRecord[]
  selectedFactor: AIFactorRecord
  locale: LongclawLocale
  onSelect: (factorId: string) => void
}) {
  return (
    <Section
      title={locale === 'zh-CN' ? '研究账本' : 'Research book'}
      subtitle={
        locale === 'zh-CN'
          ? '这里放已经进入研发链路的因子，不放未复核的盘面异动。'
          : 'This holds factors already in the research loop, not unreviewed market-action ideas.'
      }
    >
      <div style={researchBookListStyle}>
        {factors.map(factor => (
          <button
            key={factor.factor_id}
            type="button"
            style={factor.factor_id === selectedFactor.factor_id ? activeIdeaCardStyle : ideaCardStyle}
            onClick={() => onSelect(factor.factor_id)}
          >
            <div style={cardHeaderStyle}>
              <div style={titleBlockStyle}>
                <div style={inlineMetaStyle}>
                  <span style={statusBadgeStyle(factor.research_mode)}>
                    {researchModeLabel(factor.research_mode, locale)}
                  </span>
                  <span style={statusBadgeStyle(factor.status)}>
                    {humanizeTokenLocale(locale, factor.status)}
                  </span>
                </div>
                <div style={cardTitleStyle}>{factor.title}</div>
                <div style={chromeStyles.quietMeta}>{factor.thesis}</div>
              </div>
            </div>
            <FactorScoreGrid factor={factor} locale={locale} />
          </button>
        ))}
      </div>
    </Section>
  )
}

function TechnicalDiscoveryQueue({
  candidates,
  selectedCandidateId,
  locale,
  onSelect,
}: {
  candidates: AIFactorRecord[]
  selectedCandidateId: string
  locale: LongclawLocale
  onSelect: (candidateId: string) => void
}) {
  return (
    <Section
      title={locale === 'zh-CN' ? '1 选择因子问题' : '1 Select factor question'}
      subtitle={
        locale === 'zh-CN'
          ? '这里不是指标清单，只选一个要验证的问题：它是否能预测未来收益。'
          : 'This is not an indicator list. Pick one question: does it predict future returns?'
      }
    >
      <div style={technicalQueueListStyle}>
        {candidates.length === 0 ? (
          <div style={panelBlockStyle}>
            <div style={fieldValueStyle}>
              {locale === 'zh-CN'
                ? '暂无技术发现候选。等待全市场技术扫描写入 terminal_technical_signals。'
                : 'No market-action discoveries yet. Waiting for the technical signal scan.'}
            </div>
          </div>
        ) : candidates.map(candidate => {
          const signalLines = technicalSignalLines(candidate)
          const scoreItems = factorScoreItems(candidate, locale)
          const advice = technicalCandidateAdvice(candidate, locale)
          const active = candidate.factor_id === selectedCandidateId
          return (
            <button
              key={candidate.factor_id}
              type="button"
              style={technicalCandidateButtonStyle(active)}
              onClick={() => onSelect(candidate.factor_id)}
            >
              <div style={cardHeaderStyle}>
                <div style={titleBlockStyle}>
                  <div style={inlineMetaStyle}>
                    <span style={statusBadgeStyle(candidate.research_mode)}>
                      {researchModeLabel(candidate.research_mode, locale)}
                    </span>
                    <span style={statusBadgeStyle(advice.tone)}>
                      {advice.label}
                    </span>
                  </div>
                  <div style={cardTitleStyle}>{factorResearchQuestion(candidate, locale)}</div>
                  <div style={chromeStyles.quietMeta}>
                    {locale === 'zh-CN' ? '来源线索：' : 'Source clues: '}
                    {candidate.title}
                  </div>
                </div>
              </div>
              <div style={compactScoreRowStyle}>
                {scoreItems.map(item => (
                  <div key={item.label} style={compactScoreCellStyle}>
                    <div style={{ ...metricValueStyle, fontSize: 14 }}>{item.value}</div>
                    <div style={chromeStyles.quietMeta}>{item.label}</div>
                  </div>
                ))}
              </div>
              {signalLines.length > 0 ? (
                <div style={{ ...fieldValueStyle, color: palette.textSoft }}>
                  {signalLines.slice(0, 3).join(' / ')}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </Section>
  )
}

function TechnicalReviewTextArea({
  label,
  value,
  onChange,
  placeholder,
  wide,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  wide?: boolean
}) {
  return (
    <label style={wide ? discoveryWideBlockStyle : panelBlockStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        style={compactTextAreaStyle}
      />
    </label>
  )
}

function TechnicalFactorResearchPanel({
  candidate,
  locale,
  values,
  onValueChange,
  onOpenRecord,
  onRunAction,
  onActionStart,
  onActionResult,
  onActionError,
  onUseCandidate,
  onAddStrategySignal,
  runningActionKey,
}: {
  candidate: AIFactorRecord | undefined
  locale: LongclawLocale
  values: TechnicalReviewValues | null
  onValueChange: (key: TechnicalReviewKey, value: string) => void
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
  onActionStart?: (action: LongclawOperatorAction) => void
  onActionResult?: (action: LongclawOperatorAction, result: Record<string, unknown>) => void
  onActionError?: (action: LongclawOperatorAction, message: string) => void
  onUseCandidate: (candidate: AIFactorRecord) => void
  onAddStrategySignal?: AIFactorFactoryWorkspaceProps['onAddStrategySignal']
  runningActionKey?: string
}) {
  if (!candidate || !values) {
    return (
      <Section
        title={locale === 'zh-CN' ? '2 定义因子' : '2 Define factor'}
        subtitle={locale === 'zh-CN' ? '等待技术信号池出现候选。' : 'Waiting for discovery candidates.'}
      >
        <div style={fieldValueStyle}>
          {locale === 'zh-CN' ? '没有候选时不能生成因子假设。' : 'No candidate can be converted yet.'}
        </div>
      </Section>
    )
  }

  const steps = locale === 'zh-CN'
    ? ['股票池', '信号定义', '预测力假设', '复盘验证']
    : ['Universe', 'Signal', 'Edge', 'Replay']
  const thesisReady = values.research_thesis.trim().length > 0
  const evidenceReady = values.supporting_evidence.trim().length > 0
  const attributionReady = values.industry_attribution.trim().length > 0
  const strategyReady = thesisReady && evidenceReady && attributionReady
  const environmentId = textValue(candidate.environment_id ?? candidate.factor_id)
  const replayLabel = locale === 'zh-CN' ? '跑预测力复盘' : 'Replay predictive power'
  const replayPayload = {
    mode: 'signal_first',
    environment_id: environmentId,
    persist: true,
    demo_mode: false,
  }
  const syntheticCandidate = {
    ...candidate,
    thesis: values.research_thesis.trim() || candidate.thesis,
    research_review: values,
  }
  const handleAddStrategySignal = () => {
    onAddStrategySignal?.(strategySignalFromTechnicalCandidate(syntheticCandidate, values))
  }

  return (
    <Section
      title={locale === 'zh-CN' ? '2 定义因子' : '2 Define factor'}
      subtitle={
        locale === 'zh-CN'
          ? '先把盘面线索翻译成因子定义：股票池、触发信号、预测力假设、失效条件。'
          : 'Translate market clues into factor definition: universe, trigger, edge, and invalidation.'
      }
      actions={
        <div style={actionRowStyle}>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => onOpenRecord(candidate.title, { ...candidate, research_review: values })}
          >
            {locale === 'zh-CN' ? '打开复核' : 'Open review'}
          </button>
          <FactorActionButton
            actionKey="validate"
            label={replayLabel}
            factor={candidate}
            onOpenRecord={onOpenRecord}
            onRunAction={onRunAction}
            onActionStart={onActionStart}
            onActionResult={onActionResult}
            onActionError={onActionError}
            payloadOverrides={replayPayload}
            tone="primary"
            disabled={!onRunAction}
            runningActionKey={runningActionKey}
          />
          <button
            type="button"
            style={buttonStyleForState(primaryButtonStyle, !thesisReady, 'primary')}
            disabled={!thesisReady}
            onClick={() => onUseCandidate(syntheticCandidate)}
          >
            {locale === 'zh-CN' ? '保存因子定义' : 'Save factor definition'}
          </button>
          <button
            type="button"
            style={buttonStyleForState(primaryButtonStyle, !strategyReady || !onAddStrategySignal, 'primary')}
            disabled={!strategyReady || !onAddStrategySignal}
            onClick={handleAddStrategySignal}
          >
            {locale === 'zh-CN' ? '送入观察草稿' : 'Draft observation'}
          </button>
        </div>
      }
    >
      <div style={columnStyle}>
        <div style={inlineMetaStyle}>
          <span style={statusBadgeStyle(candidate.research_mode)}>
            {researchModeLabel(candidate.research_mode, locale)}
          </span>
          <span style={statusBadgeStyle(technicalCandidateAdvice(candidate, locale).tone)}>
            {technicalCandidateAdvice(candidate, locale).label}
          </span>
          <span style={chromeStyles.monoMeta}>{candidate.factor_id}</span>
        </div>
        <div style={discoveryStepGridStyle}>
          {steps.map((step, index) => {
            const complete = index === 0 || (index === 1 && attributionReady) || (index === 2 && evidenceReady) || (index === 3 && thesisReady)
            return (
              <div key={step} style={discoveryStepStyle(complete)}>
                <div style={stepNumberStyle}>{String(index + 1).padStart(2, '0')}</div>
                <div style={stepLabelStyle}>{step}</div>
              </div>
            )
          })}
        </div>
        <div style={discoveryWorkbenchGridStyle}>
          <TechnicalReviewTextArea
            label={locale === 'zh-CN' ? '股票池 / 主题归因' : 'Universe / theme attribution'}
            value={values.industry_attribution}
            placeholder={locale === 'zh-CN' ? '例：光模块/CPO 链条，不是单票孤立异动；如果只是技术结构共振，就写“主题待归因”' : 'Example: optical/CPO chain, not isolated names; write theme pending if attribution is weak'}
            onChange={value => onValueChange('industry_attribution', value)}
          />
          <TechnicalReviewTextArea
            label={locale === 'zh-CN' ? '信号触发定义' : 'Signal trigger definition'}
            value={values.beta_alpha_judgement}
            placeholder={locale === 'zh-CN' ? '例：收盘后出现同主题 gap/daily/strong_resonance，按信号强度排序' : 'Example: postmarket same-theme gap/daily/strong_resonance, ranked by signal strength'}
            onChange={value => onValueChange('beta_alpha_judgement', value)}
          />
          <TechnicalReviewTextArea
            label={locale === 'zh-CN' ? '为什么应该有预测力？' : 'Why should it predict?'}
            value={values.supporting_evidence}
            placeholder={locale === 'zh-CN' ? '写交易逻辑：资金扩散、同链条确认、强者恒强、还是风险释放后的修复' : 'Write the trading logic: diffusion, chain confirmation, momentum, or post-risk repair'}
            onChange={value => onValueChange('supporting_evidence', value)}
          />
          <TechnicalReviewTextArea
            label={locale === 'zh-CN' ? '失效条件 / 反证' : 'Invalidation / counter-evidence'}
            value={values.counter_evidence}
            placeholder={locale === 'zh-CN' ? '例：链主不确认、放量回落、分位收益不扩散、成本后收益为负' : 'Example: leader fails, volume fades, spread negative, cost-adjusted return negative'}
            onChange={value => onValueChange('counter_evidence', value)}
          />
          <TechnicalReviewTextArea
            label={locale === 'zh-CN' ? '复盘规则' : 'Replay rule'}
            value={values.research_thesis}
            placeholder={locale === 'zh-CN' ? '例：按 factor_value 分组，看 Rank IC、分位收益、T+5/T+20 forward return，再看成本后收益和回撤' : 'Example: bucket by factor_value, inspect Rank IC, quantile spread, T+5/T+20 returns, then cost and drawdown'}
            onChange={value => onValueChange('research_thesis', value)}
            wide
          />
        </div>
      </div>
    </Section>
  )
}

function TechnicalResearchProgressPanel({
  candidate,
  locale,
  values,
}: {
  candidate: AIFactorRecord | undefined
  locale: LongclawLocale
  values: TechnicalReviewValues | null
}) {
  const sourceSignals = candidate ? technicalSignalLines(candidate) : []
  const exposureGroups = candidate ? stringArrayValue(candidate.factor_exposures.groups) : []
  const hasThesis = Boolean(values?.research_thesis.trim())
  const hasAttribution = Boolean(values?.industry_attribution.trim())
  const hasEvidence = Boolean(values?.supporting_evidence.trim())
  const hasSignalDefinition = Boolean(values?.beta_alpha_judgement.trim())
  const reward = candidate ? rewardRecord(candidate) : {}
  const rewardStatus = candidate
    ? textValue(reward.status ?? candidate.status ?? candidate.validation_status, 'pending_validation')
    : ''
  const blockingGates = candidate ? stringArrayValue(reward.blocking_gates ?? candidate.blocking_gates) : []
  const decision = signalFirstDecision(candidate, locale)
  const rewardItems = signalFirstRewardItems(candidate, locale)
  const replayDone = Boolean(candidate && rewardStatus !== 'pending_validation')
  return (
    <div style={columnStyle}>
      <Section
        title={locale === 'zh-CN' ? '3 研发判定' : '3 Research decision'}
        subtitle={
          locale === 'zh-CN'
            ? '先判预测力，再判组合承接；没有通过 gate 就不能发布。'
            : 'Judge predictive power first, then portfolio fit; no publish without gates.'
        }
      >
        <div style={panelBlockStyle}>
          <div style={inlineMetaStyle}>
            <span style={statusBadgeStyle(decision.tone)}>{decision.label}</span>
          </div>
          <div style={fieldValueStyle}>{decision.detail}</div>
        </div>
        {rewardItems.length > 0 ? (
          <div style={{ ...compactScoreRowStyle, marginTop: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {rewardItems.map(item => (
              <div key={item.label} style={compactScoreCellStyle}>
                <div style={{ ...metricValueStyle, fontSize: 14 }}>{item.value}</div>
                <div style={chromeStyles.quietMeta}>{item.label}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={checklistStyle}>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(Boolean(candidate))} />
            <span>{locale === 'zh-CN' ? '选了一个可验证因子问题' : 'Testable factor question selected'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(hasAttribution)} />
            <span>{locale === 'zh-CN' ? '股票池/主题归因已定义' : 'Universe/theme defined'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(hasSignalDefinition)} />
            <span>{locale === 'zh-CN' ? '信号触发已定义' : 'Signal trigger defined'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(hasEvidence)} />
            <span>{locale === 'zh-CN' ? '预测力假设已写清' : 'Predictive thesis written'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(hasThesis)} />
            <span>{locale === 'zh-CN' ? '复盘规则已定义' : 'Replay rule defined'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(replayDone)} />
            <span>{locale === 'zh-CN' ? '已跑预测力复盘' : 'Predictive replay run'}</span>
          </div>
          <div style={checklistRowStyle}>
            <span style={checkDotStyle(rewardStatus === 'validated')} />
            <span>{locale === 'zh-CN' ? '组合承接 gate 通过' : 'Portfolio gate passed'}</span>
          </div>
        </div>
        {candidate ? (
          <div style={{ ...panelBlockStyle, marginTop: 10 }}>
            <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '阻塞 gate' : 'Blocking gates'}</div>
            <div style={inlineMetaStyle}>
              <span style={statusBadgeStyle(rewardStatus)}>
                {humanizeTokenLocale(locale, rewardStatus)}
              </span>
              {(blockingGates.length > 0 ? blockingGates : ['none']).slice(0, 3).map(gate => (
                <span key={gate} style={statusBadgeStyle('warning')}>
                  {gate === 'none'
                    ? (locale === 'zh-CN' ? '暂无' : 'None')
                    : humanizeTokenLocale(locale, gate)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Section>
      <Section
        title={locale === 'zh-CN' ? '原始盘面线索' : 'Raw market clues'}
        subtitle={locale === 'zh-CN' ? '这里只是证据来源，不是交易结论。' : 'These are evidence sources, not trading conclusions.'}
      >
        <div style={columnStyle}>
          {sourceSignals.length > 0 ? sourceSignals.slice(0, 6).map(line => (
            <div key={line} style={fieldValueStyle}>{line}</div>
          )) : (
            <div style={fieldValueStyle}>
              {locale === 'zh-CN' ? '暂无来源信号。' : 'No source signals.'}
            </div>
          )}
          {exposureGroups.length > 0 ? (
            <div style={panelBlockStyle}>
              <div style={fieldLabelStyle}>{locale === 'zh-CN' ? '可能行业暴露' : 'Possible exposure'}</div>
              <TokenList tokens={exposureGroups} />
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  )
}

export function AIFactorFactoryWorkspace({
  locale,
  dashboard,
  signalsWebBaseUrl,
  onOpenRecord,
  onRunAction,
  onAddStrategySignal,
}: AIFactorFactoryWorkspaceProps) {
  const dashboardFactors = React.useMemo(
    () => normalizeFactoryFactors(dashboard, signalsWebBaseUrl),
    [dashboard, signalsWebBaseUrl],
  )
  const candidateIdeas = React.useMemo(
    () => normalizeCandidateFactorIdeas(dashboard, signalsWebBaseUrl),
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
  const selectedFactor = factors.find(factor => factor.factor_id === selectedFactorId) ?? factors[0] ?? fallbackFactor
  const labels = actionLabels(locale)
  const [ideaText, setIdeaText] = React.useState<string>(() => selectedFactor?.thesis ?? fallbackFactor.thesis)
  const [activeWorkflowStage, setActiveWorkflowStage] = React.useState<WorkflowStageKey>('idea')
  const [workbenchMode, setWorkbenchMode] = React.useState<WorkbenchMode>('signal_first')
  const [runningActionKey, setRunningActionKey] = React.useState<string>('')
  const [actionRunState, setActionRunState] = React.useState<ActionRunState | null>(null)
  const [pendingIdeaSource, setPendingIdeaSource] = React.useState<Record<string, unknown> | null>(null)
  const [draftEditsByFactorId, setDraftEditsByFactorId] = React.useState<Record<string, DraftEditValues>>({})
  const [selectedTechnicalCandidateId, setSelectedTechnicalCandidateId] = React.useState<string>('')
  const [technicalReviewsByCandidateId, setTechnicalReviewsByCandidateId] = React.useState<Record<string, TechnicalReviewValues>>({})

  React.useEffect(() => {
    if (factors.length > 0 && !factors.some(factor => factor.factor_id === selectedFactorId)) {
      setSelectedFactorId(factors[0].factor_id)
    }
  }, [factors, selectedFactorId])

  React.useEffect(() => {
    const current = factors.find(factor => factor.factor_id === selectedFactorId)
    if (current) setIdeaText(current.thesis)
  }, [factors, selectedFactorId])

  React.useEffect(() => {
    if (candidateIdeas.length > 0 && !candidateIdeas.some(candidate => candidate.factor_id === selectedTechnicalCandidateId)) {
      setSelectedTechnicalCandidateId(candidateIdeas[0].factor_id)
    }
  }, [candidateIdeas, selectedTechnicalCandidateId])

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
    if (actionName === 'draft') {
      setActiveWorkflowStage('idea')
      setPendingIdeaSource(null)
      setDraftEditsByFactorId(previous => ({
        ...previous,
        [merged.factor_id]: draftValuesFromFactor(merged),
      }))
    }
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

  const currentIdeaText = ideaText.trim()
  const hasPendingIdea = Boolean(currentIdeaText && currentIdeaText !== selectedFactor.thesis)
  const ideaPayload = {
    idea: currentIdeaText || selectedFactor.thesis,
    factor_id: currentIdeaText && currentIdeaText !== selectedFactor.thesis ? '' : selectedFactor.factor_id,
  }
  const baseDraftValues = React.useMemo(
    () => draftValuesFromFactor(selectedFactor),
    [selectedFactor],
  )
  const draftValues = draftEditsByFactorId[selectedFactor.factor_id] ?? baseDraftValues
  const hasLocalDraftEdits = !draftValuesEqual(draftValues, baseDraftValues)
  const handleDraftValueChange = React.useCallback((key: DraftFieldKey, value: string) => {
    setDraftEditsByFactorId(previous => ({
      ...previous,
      [selectedFactor.factor_id]: {
        ...(previous[selectedFactor.factor_id] ?? baseDraftValues),
        [key]: value,
      },
    }))
  }, [baseDraftValues, selectedFactor.factor_id])
  const handleApplyDraftEdits = React.useCallback(() => {
    const draftPayload = draftPayloadFromValues(draftValues)
    const merged = mergeFactorPayload(
      selectedFactor,
      {
        ...selectedFactor,
        draft: draftPayload,
        research: {
          ...asRecord(selectedFactor.research),
          ...draftPayload,
          idea: selectedFactor.thesis,
        },
      },
      factors.length,
    )
    setFactorOverrides(previous => ({
      ...previous,
      [merged.factor_id]: merged,
    }))
    setSelectedFactorId(merged.factor_id)
    setDraftEditsByFactorId(previous => ({
      ...previous,
      [merged.factor_id]: draftValuesFromFactor(merged),
    }))
    setActionRunState({
      actionKey: `draft-edit:${merged.factor_id}`,
      label: locale === 'zh-CN' ? '应用草案调整' : 'Apply draft edits',
      state: 'completed',
      message: locale === 'zh-CN'
        ? '草案调整已应用到当前因子；下一步可以拆量价证据或复盘样本。'
        : 'Draft edits applied; next step is evidence breakdown or sample replay.',
    })
  }, [draftValues, factors.length, locale, selectedFactor])
  const selectedTechnicalCandidate = candidateIdeas.find(candidate => (
    candidate.factor_id === selectedTechnicalCandidateId
  )) ?? candidateIdeas[0]
  const defaultTechnicalReviewValues = React.useMemo(
    () => selectedTechnicalCandidate
      ? technicalReviewValuesFromCandidate(selectedTechnicalCandidate, locale)
      : null,
    [locale, selectedTechnicalCandidate],
  )
  const technicalReviewValues = selectedTechnicalCandidate
    ? technicalReviewsByCandidateId[selectedTechnicalCandidate.factor_id] ?? defaultTechnicalReviewValues
    : null
  const handleTechnicalReviewValueChange = React.useCallback((key: TechnicalReviewKey, value: string) => {
    if (!selectedTechnicalCandidate || !defaultTechnicalReviewValues) return
    setTechnicalReviewsByCandidateId(previous => ({
      ...previous,
      [selectedTechnicalCandidate.factor_id]: {
        ...(previous[selectedTechnicalCandidate.factor_id] ?? defaultTechnicalReviewValues),
        [key]: value,
      },
    }))
  }, [defaultTechnicalReviewValues, selectedTechnicalCandidate])
  const handleUseCandidate = (candidate: AIFactorRecord) => {
    setWorkbenchMode('research_first')
    setSelectedFactorId(selectedFactor.factor_id)
    setIdeaText(candidate.thesis)
    setActiveWorkflowStage('idea')
    setPendingIdeaSource({
      source_candidate_factor_id: candidate.factor_id,
      source_candidate_title: candidate.title,
      factor_origin: candidate.factor_origin,
    })
    onOpenRecord(
      locale === 'zh-CN' ? '技术发现转投研假设' : 'Discovery to thesis',
      {
        source_candidate_factor_id: candidate.factor_id,
        source_candidate_title: candidate.title,
        idea: candidate.thesis,
        research_mode: 'research_first',
        factor_origin: 'research_from_technical_discovery',
      },
    )
  }

  const factorReadyText = selectedFactor.verified
    ? selectedFactor.live_enabled
      ? locale === 'zh-CN' ? '已进入观察池' : 'In observation'
      : locale === 'zh-CN' ? '样本已复盘' : 'Samples replayed'
    : locale === 'zh-CN' ? '等待样本复盘' : 'Waiting sample replay'

  return (
    <div style={workspaceStackStyle}>
      <WorkbenchModeSwitch mode={workbenchMode} locale={locale} onChange={setWorkbenchMode} />

      {workbenchMode === 'signal_first' ? (
        <div style={candidateQueueGridStyle}>
          <TechnicalDiscoveryQueue
            candidates={candidateIdeas}
            selectedCandidateId={selectedTechnicalCandidate?.factor_id ?? ''}
            locale={locale}
            onSelect={setSelectedTechnicalCandidateId}
          />
          <TechnicalFactorResearchPanel
            candidate={selectedTechnicalCandidate}
            locale={locale}
            values={technicalReviewValues}
            onValueChange={handleTechnicalReviewValueChange}
            onOpenRecord={onOpenRecord}
            onRunAction={onRunAction}
            onActionStart={handleActionStart}
            onActionResult={handleActionResult}
            onActionError={handleActionError}
            onUseCandidate={handleUseCandidate}
            onAddStrategySignal={onAddStrategySignal}
            runningActionKey={runningActionKey}
          />
          <TechnicalResearchProgressPanel
            candidate={selectedTechnicalCandidate}
            locale={locale}
            values={technicalReviewValues}
          />
        </div>
      ) : (
        <div style={strategyWorkbenchGridStyle}>
          <div style={columnStyle}>
            <Section
              title={locale === 'zh-CN' ? '因子假设区' : 'Factor thesis'}
              subtitle={
                locale === 'zh-CN'
                  ? '先写清楚行业故事，再让系统拆成可复盘的因子定义。'
                  : 'Write the industry story first, then turn it into a replayable factor definition.'
              }
              actions={
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => {
                    setIdeaText('')
                    setPendingIdeaSource(null)
                    setActiveWorkflowStage('idea')
                  }}
                >
                  {locale === 'zh-CN' ? '新建假设' : 'New thesis'}
                </button>
              }
            >
              <div style={columnStyle}>
                <textarea
                  value={ideaText}
                  onChange={event => setIdeaText(event.target.value)}
                  style={ticketInputStyle}
                  placeholder={
                    locale === 'zh-CN'
                      ? '例：AI 硬件链存在行业 beta，GB200、光模块、液冷、铜连接、PCB、存储的预期变化可能带来 alpha；今天 A股是否出现真实承接？'
                      : 'Example: AI hardware has industry beta and expectation alpha across GB200, optical, cooling, copper, PCB, and memory; did A-shares accept it today?'
                  }
                />
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
            </Section>

            <ResearchBookPanel
              factors={factors}
              selectedFactor={selectedFactor}
              locale={locale}
              onSelect={factorId => {
                setSelectedFactorId(factorId)
                setPendingIdeaSource(null)
                setActiveWorkflowStage('idea')
              }}
            />
          </div>

          <div style={strategyPrimaryColumnStyle}>
            {hasPendingIdea ? (
              <PendingFactorGeneratorPanel
                locale={locale}
                idea={currentIdeaText}
                source={pendingIdeaSource}
                factor={selectedFactor}
                labels={labels}
                ideaPayload={ideaPayload}
                onOpenRecord={onOpenRecord}
                onRunAction={onRunAction}
                onActionStart={handleActionStart}
                onActionResult={handleActionResult}
                onActionError={handleActionError}
                runningActionKey={runningActionKey}
              />
            ) : (
              <>
                <FactorGenerationResultPanel
                  factor={selectedFactor}
                  locale={locale}
                  draftValues={draftValues}
                  hasLocalEdits={hasLocalDraftEdits}
                  labels={labels}
                  onDraftValueChange={handleDraftValueChange}
                  onApplyDraftEdits={handleApplyDraftEdits}
                  onStageChange={setActiveWorkflowStage}
                  onOpenRecord={onOpenRecord}
                  onRunAction={onRunAction}
                  onActionStart={handleActionStart}
                  onActionResult={handleActionResult}
                  onActionError={handleActionError}
                  runningActionKey={runningActionKey}
                  ideaPayload={ideaPayload}
                />
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
              </>
            )}
          </div>

          <div style={strategyContextColumnStyle}>
            {hasPendingIdea ? (
              <Section
                title={locale === 'zh-CN' ? '生成前校准' : 'Pre-generation calibration'}
                subtitle={
                  locale === 'zh-CN'
                    ? '先确认这条假设能被拆成股票池、触发、回避和失效条件。'
                    : 'Check that the thesis can become universe, trigger, avoid, and invalidation rules.'
                }
              >
                <div style={checklistStyle}>
                  <div style={checklistRowStyle}>
                    <span style={checkDotStyle(Boolean(currentIdeaText))} />
                    <span>{locale === 'zh-CN' ? '原始假设已经写清楚' : 'Raw thesis is written'}</span>
                  </div>
                  <div style={checklistRowStyle}>
                    <span style={checkDotStyle(Boolean(pendingIdeaSource))} />
                    <span>{locale === 'zh-CN' ? '如果来自技术异动，保留来源线索' : 'Keep source evidence if it came from a discovery'}</span>
                  </div>
                  <div style={checklistRowStyle}>
                    <span style={checkDotStyle(false)} />
                    <span>{locale === 'zh-CN' ? '生成后再确认行业 beta、预期 alpha 和承接条件' : 'After generation, check beta, alpha, and acceptance setup'}</span>
                  </div>
                  <div style={checklistRowStyle}>
                    <span style={checkDotStyle(false)} />
                    <span>{locale === 'zh-CN' ? '没有样本复盘前不进入观察池' : 'Do not enter observation before sample replay'}</span>
                  </div>
                </div>
              </Section>
            ) : (
              <>
                <FactorIdentityPanel factor={selectedFactor} locale={locale} />
                <Section
                  title={locale === 'zh-CN' ? '当前研发状态' : 'Current research state'}
                  subtitle={
                    locale === 'zh-CN'
                      ? '这里直接回答：这条因子现在能不能给策略模块使用。'
                      : 'This answers whether the strategy module can use this factor now.'
                  }
                >
                  <div style={strategyInsightGridStyle}>
                    <WorkflowField
                      label={locale === 'zh-CN' ? '样本复盘' : 'Sample replay'}
                      value={selectedFactor.verified ? `${selectedFactor.sample_count}` : (locale === 'zh-CN' ? '未完成' : 'Not done')}
                    />
                    <WorkflowField
                      label={locale === 'zh-CN' ? '观察状态' : 'Observation'}
                      value={factorReadyText}
                    />
                    <WorkflowField
                      label={locale === 'zh-CN' ? '策略使用' : 'Strategy use'}
                      value={selectedFactor.live_enabled ? (locale === 'zh-CN' ? '可进入候选排序' : 'Can rank candidates') : (locale === 'zh-CN' ? '先做观察复核' : 'Review first')}
                    />
                  </div>
                </Section>
                <StrategyEnablementPanel factor={selectedFactor} locale={locale} />
                <Section
                  title={locale === 'zh-CN' ? '模拟观察' : 'Paper observation'}
                  subtitle={
                    locale === 'zh-CN'
                      ? '样本复盘后才生成模拟权益、持仓和命中记录。'
                      : 'Sample replay drives paper equity, positions, and hit records.'
                  }
                >
                  <PaperAccountPanel factor={selectedFactor} locale={locale} />
                </Section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
