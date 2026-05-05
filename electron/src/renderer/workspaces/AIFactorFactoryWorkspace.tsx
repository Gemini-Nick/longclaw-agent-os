import React from 'react'

import type {
  LongclawOperatorAction,
  SignalsDashboard,
} from '../../../../src/services/longclawControlPlane/models.js'
import {
  chromeStyles,
  palette,
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
  failure_samples: Array<Record<string, unknown>>
}

type AIFactorFactoryPayload = Record<string, unknown> & {
  ideas?: unknown
  factors?: unknown
  drafts?: unknown
  validation_results?: unknown
  failure_samples?: unknown
  live_status?: unknown
}

const factoryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 0.92fr) minmax(340px, 1.25fr) minmax(300px, 1fr)',
  gap: 12,
  alignItems: 'start',
}

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
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
  failure_samples: [],
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

function factorAction(actionKey: FactorActionKey, label: string, factor: AIFactorRecord): LongclawOperatorAction {
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
  const verified = booleanValue(
    metrics.verified ?? validation.verified,
    numberValue(raw.sample_count ?? metrics.sample_count ?? metrics.samples ?? raw.samples ?? raw.n_samples, 0) > 0,
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
    sample_count: numberValue(raw.sample_count ?? metrics.sample_count ?? metrics.samples ?? raw.samples ?? raw.n_samples, 0),
    win_rate: numberValue(raw.win_rate ?? metrics.win_rate ?? raw.hit_rate, 0),
    avg_return: numberValue(
      raw.avg_return ?? metrics.avg_return_t5 ?? metrics.return_t5 ?? raw.average_return ?? raw.mean_return,
      0,
    ),
    max_adverse_excursion: numberValue(
      raw.max_adverse_excursion ?? metrics.mae ?? raw.mae ?? raw.max_drawdown,
      0,
    ),
    verified,
    ic: numberValue(raw.ic ?? metrics.ic, 0),
    rank_ic: numberValue(raw.rank_ic ?? metrics.rank_ic, 0),
    long_short_return: numberValue(raw.long_short_return ?? metrics.long_short_return, 0),
    turnover: numberValue(raw.turnover ?? metrics.turnover, 0),
    live_enabled: booleanValue(raw.live_enabled ?? raw.enabled ?? raw.live, false),
    draft: draftText(raw.draft ?? raw.factor_draft ?? raw.definition ?? raw.formula, fallbackFactor.draft),
    validation_summary: textValue(
      raw.validation_summary ?? raw.validation_result ?? raw.backtest_summary ?? metrics.summary,
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

function FactorActionButton({
  actionKey,
  label,
  factor,
  onOpenRecord,
  onRunAction,
}: {
  actionKey: FactorActionKey
  label: string
  factor: AIFactorRecord
  onOpenRecord: AIFactorFactoryWorkspaceProps['onOpenRecord']
  onRunAction?: AIFactorFactoryWorkspaceProps['onRunAction']
}) {
  const action = factorAction(actionKey, label, factor)
  return (
    <button
      type="button"
      style={secondaryButtonStyle}
      onClick={() => {
        onOpenRecord(label, { ...factor, requested_action: label }, [action])
        if (action.kind === 'signals_api' && onRunAction) {
          void onRunAction(action)
        }
      }}
    >
      {label}
    </button>
  )
}

function MetricGrid({ factor, locale }: { factor: AIFactorRecord; locale: LongclawLocale }) {
  return (
    <div style={metricGridStyle}>
      {metricItems(factor, locale).map(item => (
        <div key={item.label} style={metricCellStyle}>
          <div style={metricValueStyle}>{item.value}</div>
          <div style={chromeStyles.quietMeta}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export function AIFactorFactoryWorkspace({
  locale,
  dashboard,
  signalsWebBaseUrl,
  onOpenRecord,
  onRunAction,
}: AIFactorFactoryWorkspaceProps) {
  const factors = React.useMemo(
    () => normalizeFactoryFactors(dashboard, signalsWebBaseUrl),
    [dashboard, signalsWebBaseUrl],
  )
  const [selectedFactorId, setSelectedFactorId] = React.useState<string>(() => (
    factors[0]?.factor_id ?? fallbackFactor.factor_id
  ))
  const selectedFactor = factors.find(factor => factor.factor_id === selectedFactorId) ?? factors[0]
  const labels = actionLabels(locale)
  const failureRows = selectedFactor?.failure_samples ?? []

  React.useEffect(() => {
    if (factors.length > 0 && !factors.some(factor => factor.factor_id === selectedFactorId)) {
      setSelectedFactorId(factors[0].factor_id)
    }
  }, [factors, selectedFactorId])

  if (!selectedFactor) return null

  return (
    <div style={factoryGridStyle}>
      <div style={columnStyle}>
        <Section
          title={locale === 'zh-CN' ? '因子想法列表' : 'Factor ideas'}
          subtitle={
            locale === 'zh-CN'
              ? '把 AI 研究假设拆成可验证、可停用、可进入观察池的因子卡。'
              : 'AI research hypotheses are organized as verifiable factor cards.'
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
                onClick={() => setSelectedFactorId(factor.factor_id)}
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
          title={locale === 'zh-CN' ? '因子草稿' : 'Factor draft'}
          subtitle={
            locale === 'zh-CN'
              ? '从想法进入可复现定义，保留验证入口而不直接交易。'
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
	              />
	              <FactorActionButton
	                actionKey="validate"
	                label={labels.validate}
	                factor={selectedFactor}
	                onOpenRecord={onOpenRecord}
	                onRunAction={onRunAction}
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
          title={locale === 'zh-CN' ? 'AI解释' : 'AI explanation'}
          subtitle={
            locale === 'zh-CN'
              ? '解释只服务交易研发，不作为聊天窗口或最终买卖建议。'
              : 'Explanation supports research only; this is not a chat window or final trade call.'
          }
          actions={
            <div style={actionRowStyle}>
	              <FactorActionButton
	                actionKey="publish"
	                label={labels.observe}
	                factor={selectedFactor}
	                onOpenRecord={onOpenRecord}
	                onRunAction={onRunAction}
	              />
	              <FactorActionButton
	                actionKey="disable"
	                label={labels.disable}
	                factor={selectedFactor}
	                onOpenRecord={onOpenRecord}
	                onRunAction={onRunAction}
	              />
            </div>
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
  )
}
