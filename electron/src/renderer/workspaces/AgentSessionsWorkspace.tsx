import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { fontStacks } from '../designSystem.js'
import type { LongclawLocale } from '../i18n.js'
import type { ShellBackgroundMode } from '../layout.js'
import { VectorIcon, type VectorIconName } from '../vectorIcons.js'
import type { LongclawArtifact } from '../../../../src/services/longclawControlPlane/models.js'

export type AgentConversationItem = {
  id: string
  title: string
  subtitle: string
  meta?: string
  preview?: string
  icon: VectorIconName
  kind: 'agent' | 'group' | 'thread' | 'wechat' | 'run'
  active?: boolean
  defaultModel?: string
  definitionPath?: string
  instructions?: string
  skillMentions?: string[]
  skillContexts?: EmployeeSkillContext[]
}

export type AgentSessionsWorkspaceProps = {
  locale: LongclawLocale
  items: AgentConversationItem[]
  backgroundMode: ShellBackgroundMode
  onOpenChannels: () => void
  onOpenSettings: () => void
}

type ModelServiceAlias = {
  id: string
  model: string
  alias: string
  thinking: boolean
}

type ModelServiceSettings = {
  enabled: boolean
  baseUrl: string
  apiKeySet: boolean
  aliases: ModelServiceAlias[]
  lastModels: string[]
  updatedAt?: string
}

type ModelServiceResult = {
  ok: boolean
  message: string
  models?: string[]
  settings?: ModelServiceSettings
}

type ModelServiceChatResult = {
  ok: boolean
  message: string
  text?: string
  model?: string
}

type AgentChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  authorTitle?: string
  meta?: string
  pending?: boolean
  artifacts?: LongclawArtifact[]
}

type EmployeeDefinition = {
  id: string
  title: string
  subtitle: string
  preview?: string
  icon: string
  defaultModel: string
  order: number
  skillMentions: string[]
  instructions: string
  path: string
  skillContexts?: EmployeeSkillContext[]
}

type EmployeeSkillContext = {
  name: string
  path: string
  description: string
  excerpt: string
}

type EmployeeOpenResult = {
  ok: boolean
  path?: string
  message?: string
}

type LaunchAutomationReceipt = {
  launch_id?: string
  pack_id?: string
  task?: {
    task_id?: string
    status?: string
  }
  run?: {
    run_id?: string
    status?: string
  }
}

type AgentSessionsWindow = Window & {
  agentAPI?: {
    query: (message: string) => Promise<{ ok: boolean }>
    onText: (cb: (text: string) => void) => () => void
    onResult: (cb: (result: unknown) => void) => () => void
    onError: (cb: (error: string) => void) => () => void
  }
  longclawModelService?: {
    getSettings: () => Promise<ModelServiceSettings>
    updateSettings: (patch: Record<string, unknown>) => Promise<ModelServiceSettings>
    pullModels: () => Promise<ModelServiceResult>
    testConnection: () => Promise<ModelServiceResult>
    chat: (payload: Record<string, unknown>) => Promise<ModelServiceChatResult>
  }
  longclawEmployees?: {
    list: () => Promise<EmployeeDefinition[]>
    openDefinition: (idOrPath: string) => Promise<EmployeeOpenResult>
    openFolder: () => Promise<EmployeeOpenResult>
  }
  longclawControlPlane?: {
    performLocalAction: (action: {
      kind: string
      payload?: Record<string, unknown>
    }) => Promise<Record<string, unknown>>
    readArtifactPreview?: (uri: string) => Promise<Record<string, unknown>>
  }
  longclawLaunch?: {
    launch: (intent: Record<string, unknown>) => Promise<LaunchAutomationReceipt>
  }
}

function agentWindow(): AgentSessionsWindow {
  return window as AgentSessionsWindow
}

const supportedIconNames = new Set<VectorIconName>([
  'activity',
  'agent',
  'backtest',
  'channel',
  'chat',
  'code',
  'data',
  'document',
  'execution',
  'factory',
  'feishu',
  'group',
  'link',
  'longclaw',
  'moon',
  'send',
  'settings',
  'spark',
  'strategy',
  'sun',
  'terminal',
  'wechat',
  'wecom',
])

function coerceIconName(value: string | undefined): VectorIconName {
  return supportedIconNames.has(value as VectorIconName) ? (value as VectorIconName) : 'agent'
}

function definitionToConversationItem(definition: EmployeeDefinition): AgentConversationItem {
  return {
    id: `employee:${definition.id}`,
    title: definition.title,
    subtitle: definition.subtitle,
    meta: definition.defaultModel === 'auto' ? undefined : definition.defaultModel,
    preview: definition.preview,
    icon: coerceIconName(definition.icon),
    kind: 'agent',
    defaultModel: definition.defaultModel,
    definitionPath: definition.path,
    instructions: definition.instructions,
    skillMentions: definition.skillMentions,
    skillContexts: definition.skillContexts,
  }
}

const fallbackAgents: AgentConversationItem[] = [
  {
    id: 'employee:ppt-designer',
    title: 'PPT设计专员',
    subtitle: 'PPTX、汇报页与路演 deck',
    meta: 'deepseek',
    preview: '生成可编辑 PPTX、汇报页、路演 deck，支持模板继承、渲染预览和视觉 QA。',
    icon: 'document',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions:
      '你是 PPT设计专员。收到 PPT 或 deck 任务时，先判断任务模式、backend profile 和 deck profile；如果是从提示创建方案，先输出“已读完 Presentations 技能说明，下面按完整专业流程来设计这套方案。”，再给 Claim Spine、Contact Sheet、设计系统、逐页方案、质量检查。需要实际产出文件时，优先走 Presentations artifact-tool 的可编辑 PPTX、渲染预览和视觉 QA；用户显式要求 ppt-master 时，走 ppt-master SVG 到 DrawingML 的本地流水线；需要快速生成可打开的本地 PPTX 草稿时，默认调用 pptxgenjs 工具；需要数据处理、图表图片或兜底生成时，再调用 python-pptx 辅助 skill。',
    skillMentions: ['presentations', 'ppt-master', 'pptxgenjs', 'python-pptx'],
  },
  {
    id: 'employee:web-assistant',
    title: '网页助手',
    subtitle: '检索、登录、下载与网页整理',
    meta: 'deepseek',
    preview: '上网检索、页面信息提取、资料下载和浏览器 RPA 执行。',
    icon: 'link',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions:
      '你是网页助手。优先完成网页检索、页面阅读、资料下载、链接整理和来源核验。执行类网页任务要连接执行功能：执行本质是一个可控浏览器，浏览器负责跑 RPA；用户提出尽调、RPA、浏览器执行或模拟流程时，优先触发本机 due-diligence 成熟流程。',
    skillMentions: ['browser', 'playwright', 'browser-rpa'],
  },
  {
    id: 'employee:data-analyst',
    title: '数据分析师',
    subtitle: '表格清洗、统计分析与可视化',
    meta: 'deepseek',
    preview: '连接本地文件、表格和数据库，产出可复核的数据结论。',
    icon: 'data',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions: '你是数据分析师。优先完成数据清洗、统计口径说明、可视化建议和结果复核。',
    skillMentions: ['spreadsheets', 'python'],
  },
  {
    id: 'employee:sales-assistant',
    title: '销售助手',
    subtitle: '客户跟进、材料整理与行动计划',
    meta: 'deepseek',
    preview: '整理客户背景、跟进邮件、会议纪要和下一步销售动作。',
    icon: 'chat',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions: '你是销售助手。优先整理客户背景、会议纪要、跟进话术、采购风险和下一步行动。',
    skillMentions: ['sales'],
  },
  {
    id: 'employee:research-assistant',
    title: '投研助手',
    subtitle: '市场线索、产业链与策略复盘',
    meta: 'deepseek',
    preview: '围绕市场主线、产业链、公司线索和策略复盘做结构化研究。',
    icon: 'strategy',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions:
      '你是投研助手。核心能力绑定 Signals 系统的识别信号、策略复盘、回测能力和本地数据库上下文；优先通过 Signals Pack/API/MCP 边界读取本机真实上下文，再结合产业链和公司研究做结构化输出。避免直接买卖指令，明确证据、风险、回测口径和待验证信号。',
    skillMentions: ['signals-research', 'signals', 'daloopa'],
  },
  {
    id: 'employee:replay-review-assistant',
    title: '复盘助手',
    subtitle: '盘后长复盘、板块卡位与次日验证',
    meta: 'deepseek',
    preview: '按截图样例口吻复原全天资金流、板块15、三池共性、尾盘情绪和明日验证点。',
    icon: 'strategy',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions:
      '你是复盘助手。默认按用户截图样例写盘后长复盘：先讲市场真实结构，再讲资金流时间链、板块15卡位、三池共性、尾盘情绪和明日验证点。优先读取 Signals 本机真实数据，尤其是 /api/workbench/shell 的 indices、watchlist_groups.sector_boards、focus_stocks、watch_stocks、risk_stocks，以及 /api/pack/dashboard 的 overview.cluster_summary。需要生成正文时，默认运行 `bash scripts/python.sh -m signals.notify.trading_workbench_summary --window postmarket --max-items 5 --ignore-time --format narrative`；需要接入工具时，使用 `bash scripts/python.sh -m signals.mcp.review_assistant_server`。不要输出直接买卖指令，不要把 runtime/Mongo/cache 状态写进交易复盘。',
    skillMentions: ['signals-replay-review', 'signals-review', 'signals-research'],
  },
  {
    id: 'employee:document-specialist',
    title: '文档与版式专员',
    subtitle: 'PPT、文档结构与版式方案',
    meta: 'deepseek',
    preview: '生成 PPT 大纲、文档结构、页面叙事和版式建议。',
    icon: 'document',
    kind: 'agent',
    defaultModel: 'deepseek',
    instructions: '你是文档与版式专员。优先完成 PPT 大纲、页面叙事、版式建议、图表建议和演讲备注。',
    skillMentions: ['presentations', 'documents'],
  },
]

function cleanIntroText(value: string | undefined): string | undefined {
  const lines = value
    ?.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('---'))
  return lines?.[0]
}

function skillContextSummary(contexts: EmployeeSkillContext[] | undefined, locale: LongclawLocale): string {
  if (!contexts?.length) return ''
  const header =
    locale === 'zh-CN'
      ? 'Agent OS 已从本机加载以下技能文件摘要，回答时必须以这些摘要为准：'
      : 'Agent OS loaded these local skill summaries. Use them as the grounding context:'
  const body = contexts
    .map(
      context =>
        `skill_name: ${context.name}\nskill_path: ${context.path}\nskill_description: ${context.description}\nskill_excerpt:\n${context.excerpt}`,
    )
    .join('\n\n---\n\n')
  return `${header}\n\n${body}`
}

function recordString(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key]
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function recordNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function artifactArrayFromToolResult(result: Record<string, unknown> | undefined): LongclawArtifact[] {
  const artifacts = Array.isArray(result?.artifacts) ? result?.artifacts : []
  const parsed = artifacts
    .filter(isRecord)
    .map((artifact): LongclawArtifact | null => {
      const uri = recordString(artifact, 'uri')
      const artifactId = recordString(artifact, 'artifact_id') || recordString(artifact, 'artifactId')
      if (!uri || !artifactId) return null
      return {
        artifact_id: artifactId,
        run_id: recordString(artifact, 'run_id') || recordString(result, 'run_id') || 'local-tool',
        kind: recordString(artifact, 'kind') || 'file',
        uri,
        title: recordString(artifact, 'title') || fileNameFromUri(uri),
        metadata: isRecord(artifact.metadata) ? artifact.metadata : {},
      }
    })
    .filter((artifact): artifact is LongclawArtifact => Boolean(artifact))

  if (parsed.length > 0) return parsed

  const outputPath = recordString(result, 'output_path')
  if (!outputPath) return []
  return [
    {
      artifact_id: `${recordString(result, 'run_id') || 'local-tool'}:output`,
      run_id: recordString(result, 'run_id') || 'local-tool',
      kind: outputPath.toLowerCase().endsWith('.pptx') ? 'pptx' : 'file',
      uri: outputPath,
      title: fileNameFromUri(outputPath),
      metadata: {
        backend: recordString(result, 'backend'),
        slide_count: recordNumber(result, 'slide_count'),
        size_bytes: recordNumber(result, 'size_bytes'),
      },
    },
  ]
}

function fileNameFromUri(uri: string): string {
  const clean = uri.replace(/[?#].*$/, '')
  const parts = clean.split('/').filter(Boolean)
  return parts.at(-1) || clean || 'artifact'
}

function isLocalPathUri(uri: string): boolean {
  return uri.startsWith('/')
}

function isHttpUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri)
}

function isTextPreviewableArtifact(uri: string): boolean {
  return (
    isLocalPathUri(uri) &&
    ['.json', '.md', '.txt', '.log', '.csv', '.tsv'].some(ext => uri.toLowerCase().endsWith(ext))
  )
}

function isPptxArtifact(artifact: LongclawArtifact): boolean {
  return artifact.kind.toLowerCase() === 'pptx' || artifact.uri.toLowerCase().endsWith('.pptx')
}

function fileUrlFromPath(filePath: string): string {
  return `file://${filePath.split('/').map(part => encodeURIComponent(part)).join('/')}`
}

function isWebRpaRequest(item: AgentConversationItem, text: string): boolean {
  const skillMentions = item.skillMentions ?? []
  const isWebAssistant =
    item.id === 'employee:web-assistant' ||
    item.title.includes('网页') ||
    skillMentions.some(skill => /^(browser-rpa|execution-browser)$/i.test(skill))
  return isWebAssistant && /尽调|due[\s-]*diligence|rpa|RPA|浏览器执行|模拟流程|跑通流程/.test(text)
}

function isPptToolRequest(item: AgentConversationItem, text: string): boolean {
  const skillMentions = item.skillMentions ?? []
  const isPptEmployee =
    item.id === 'employee:ppt-designer' ||
    /PPT|deck|汇报|版式|文档/.test(item.title) ||
    skillMentions.some(skill => /^(presentations|ppt-master|pptxgenjs|python-pptx)$/i.test(skill))
  return isPptEmployee && /pptx|PPTX|生成文件|制作|创建|导出|草稿|实际产出|做一份|生成一份/.test(text)
}

function isSignalsResearchRequest(item: AgentConversationItem, text: string): boolean {
  const skillMentions = item.skillMentions ?? []
  const isResearchAssistant =
    item.id === 'employee:research-assistant' ||
    item.title.includes('投研') ||
    skillMentions.some(skill => /^(signals-research|signals|daloopa)$/i.test(skill))
  return isResearchAssistant && /signals?|Signals|信号|回测|策略|复盘|买点|卖点|产业链|板块|标的|候选|风险|SZ\.|SH\.|HK\.|\b[036][0-9]{5}\b/.test(text)
}

function extractDueDiligenceQuery(text: string): string {
  const quoted = /[“"']([^“"']{2,40})[”"']/.exec(text)
  if (quoted?.[1]) return quoted[1].trim()
  const companyMatch = /(国泰君安|天际股份|[\u4e00-\u9fa5A-Za-z0-9（）()]{2,24}(?:股份|证券|银行|集团|公司|有限|控股))/u.exec(text)
  return companyMatch?.[1]?.trim() || '国泰君安'
}

function extractPptTitle(text: string): string {
  const quoted = /[“"']([^“"']{2,60})[”"']/.exec(text)
  if (quoted?.[1]) return quoted[1].trim()
  const explicit = /(?:主题|标题|关于|为)[:：\s]*([^，。；;\n]{2,60})/u.exec(text)
  if (explicit?.[1]) return explicit[1].trim()
  return text
    .split(/[。；;\n]/)
    .map(item => item.trim())
    .find(Boolean)
    ?.slice(0, 48) || 'Longclaw PPT Draft'
}

function formatPptToolResult(result: Record<string, unknown> | undefined, locale: LongclawLocale): string {
  if (!result) return locale === 'zh-CN' ? 'PPT 工具结果不可用。' : 'PPT tool result is unavailable.'
  const ok = Boolean(result.ok)
  const lines =
    locale === 'zh-CN'
      ? [
          ok ? '本地 PPT 工具已生成草稿文件。' : '本地 PPT 工具未生成文件。',
          `backend：${recordString(result, 'backend') || '-'}`,
          `标题：${recordString(result, 'title') || '-'}`,
          `页数：${recordString(result, 'slide_count') || '-'}`,
          `大小：${recordString(result, 'size_bytes') || '-'}`,
          ok ? '产物已挂载为文件行，可在右侧预览面板打开、预览或下载。' : '',
          `说明：${recordString(result, 'message') || '-'}`,
        ]
      : [
          ok ? 'Local PPT tool generated a draft file.' : 'Local PPT tool did not generate a file.',
          `backend: ${recordString(result, 'backend') || '-'}`,
          `Title: ${recordString(result, 'title') || '-'}`,
          `Slides: ${recordString(result, 'slide_count') || '-'}`,
          `Size: ${recordString(result, 'size_bytes') || '-'}`,
          ok ? 'The file is attached below; use the preview pane to open, preview, or download it.' : '',
          `Message: ${recordString(result, 'message') || '-'}`,
        ]
  const error = recordString(result, 'pptxgenjs_error') || recordString(result, 'stderr_tail')
  if (!ok && error) lines.push(`${locale === 'zh-CN' ? '错误摘要' : 'Error'}：${error.slice(0, 600)}`)
  return lines.filter(Boolean).join('\n')
}

type ArtifactPreviewState = {
  kind: 'image' | 'text'
  uri: string
  text?: string
  imagePath?: string
}

type ActiveArtifactPreview = {
  artifact: LongclawArtifact
  preview?: ArtifactPreviewState
  status?: string
}

function AgentArtifactList({
  locale,
  artifacts,
  onPreviewChange,
}: {
  locale: LongclawLocale
  artifacts: LongclawArtifact[]
  onPreviewChange: (preview: ActiveArtifactPreview) => void
}) {
  const [statusById, setStatusById] = useState<Record<string, string>>({})

  if (artifacts.length === 0) return null

  const labels =
    locale === 'zh-CN'
      ? {
          open: '打开',
          preview: '预览',
          download: '下载',
          reveal: '显示',
          copy: '复制路径',
          opening: '正在打开…',
          previewing: '正在生成预览…',
          previewReady: '预览已生成。',
          downloading: '正在下载…',
          copied: '路径已复制。',
          revealed: '已在 Finder 中显示。',
          unavailable: '预览不可用',
          downloadedTo: '已下载到',
        }
      : {
          open: 'Open',
          preview: 'Preview',
          download: 'Download',
          reveal: 'Reveal',
          copy: 'Copy path',
          opening: 'Opening...',
          previewing: 'Generating preview...',
          previewReady: 'Preview ready.',
          downloading: 'Downloading...',
          copied: 'Path copied.',
          revealed: 'Revealed in Finder.',
          unavailable: 'Preview unavailable',
          downloadedTo: 'Downloaded to',
        }

  function setArtifactStatus(artifact: LongclawArtifact, status: string) {
    setStatusById(previous => ({ ...previous, [artifact.artifact_id]: status }))
  }

  async function openArtifact(artifact: LongclawArtifact) {
    setArtifactStatus(artifact, labels.opening)
    const api = agentWindow().longclawControlPlane
    if (!api) {
      setArtifactStatus(artifact, 'longclawControlPlane is unavailable')
      return
    }
    const uri = artifact.uri
    try {
      const kind = isHttpUri(uri) ? 'open_url' : isLocalPathUri(uri) ? 'open_path' : 'copy_value'
      const payload = isHttpUri(uri) ? { url: uri } : isLocalPathUri(uri) ? { path: uri } : { value: uri }
      const result = await api.performLocalAction({ kind, payload })
      const message = recordString(result, 'result') || recordString(result, 'message')
      setArtifactStatus(artifact, message || (locale === 'zh-CN' ? '已打开。' : 'Opened.'))
    } catch (error) {
      setArtifactStatus(artifact, error instanceof Error ? error.message : String(error))
    }
  }

  async function revealArtifact(artifact: LongclawArtifact) {
    const api = agentWindow().longclawControlPlane
    if (!api || !isLocalPathUri(artifact.uri)) {
      await copyArtifactPath(artifact)
      return
    }
    try {
      await api.performLocalAction({ kind: 'reveal_path', payload: { path: artifact.uri } })
      setArtifactStatus(artifact, labels.revealed)
    } catch (error) {
      setArtifactStatus(artifact, error instanceof Error ? error.message : String(error))
    }
  }

  async function copyArtifactPath(artifact: LongclawArtifact) {
    const api = agentWindow().longclawControlPlane
    if (!api) return
    try {
      await api.performLocalAction({ kind: 'copy_value', payload: { value: artifact.uri } })
      setArtifactStatus(artifact, labels.copied)
    } catch (error) {
      setArtifactStatus(artifact, error instanceof Error ? error.message : String(error))
    }
  }

  async function downloadArtifact(artifact: LongclawArtifact) {
    const api = agentWindow().longclawControlPlane
    if (!api || !isLocalPathUri(artifact.uri)) {
      await openArtifact(artifact)
      return
    }
    setArtifactStatus(artifact, labels.downloading)
    try {
      const result = await api.performLocalAction({
        kind: 'export_artifact_to_downloads',
        payload: { path: artifact.uri },
      })
      const downloadPath = recordString(result, 'download_path')
      setArtifactStatus(artifact, downloadPath ? `${labels.downloadedTo} ${downloadPath}` : 'Downloaded.')
    } catch (error) {
      setArtifactStatus(artifact, error instanceof Error ? error.message : String(error))
    }
  }

  async function previewArtifact(artifact: LongclawArtifact) {
    const api = agentWindow().longclawControlPlane
    if (!api) return
    const uri = artifact.uri
    setArtifactStatus(artifact, labels.previewing)
    onPreviewChange({ artifact, status: labels.previewing })
    try {
      if (isPptxArtifact(artifact)) {
        const result = await api.performLocalAction({
          kind: 'prepare_pptx_preview',
          payload: { path: uri },
        })
        const previewPath = recordString(result, 'preview_path')
        if (result.ok && previewPath) {
          const preview = { kind: 'image' as const, uri, imagePath: previewPath }
          onPreviewChange({ artifact, preview, status: labels.previewReady })
          setArtifactStatus(artifact, labels.previewReady)
        } else {
          const status = `${labels.unavailable}: ${
            recordString(result, 'message') || recordString(result, 'stderr_tail') || '-'
          }`
          onPreviewChange({ artifact, status })
          setArtifactStatus(artifact, status)
        }
        return
      }

      if (isTextPreviewableArtifact(uri) && api.readArtifactPreview) {
        const result = await api.readArtifactPreview(uri)
        if (result.ok && typeof result.text === 'string') {
          const preview = { kind: 'text' as const, uri, text: result.text }
          onPreviewChange({ artifact, preview, status: labels.previewReady })
          setArtifactStatus(artifact, labels.previewReady)
        } else {
          const status = `${labels.unavailable}: ${recordString(result, 'reason') || '-'}`
          onPreviewChange({ artifact, status })
          setArtifactStatus(artifact, status)
        }
        return
      }

      await openArtifact(artifact)
    } catch (error) {
      setArtifactStatus(artifact, error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div style={artifactListStyle}>
      {artifacts.map(artifact => {
        const metadata = artifact.metadata ?? {}
        const meta = [
          artifact.kind,
          recordString(metadata, 'backend'),
          recordNumber(metadata, 'slide_count')
            ? locale === 'zh-CN'
              ? `${recordNumber(metadata, 'slide_count')} 页`
              : `${recordNumber(metadata, 'slide_count')} slides`
            : '',
          recordNumber(metadata, 'size_bytes') ? `${recordNumber(metadata, 'size_bytes')} bytes` : '',
        ].filter(Boolean)
        return (
          <div key={artifact.artifact_id} style={artifactRowStyle}>
            <div style={artifactRowHeaderStyle}>
              <div style={artifactLeadStyle}>
                <div style={artifactTitleStyle}>{artifact.title || fileNameFromUri(artifact.uri)}</div>
                <div style={artifactUriStyle}>{artifact.uri}</div>
                {meta.length > 0 && <div style={artifactMetaStyle}>{meta.join(' · ')}</div>}
              </div>
              <div style={artifactActionsStyle}>
                <button type="button" style={artifactActionButtonStyle} onClick={() => void openArtifact(artifact)}>
                  {labels.open}
                </button>
                {(isPptxArtifact(artifact) || isTextPreviewableArtifact(artifact.uri)) && (
                  <button type="button" style={artifactActionButtonStyle} onClick={() => void previewArtifact(artifact)}>
                    {labels.preview}
                  </button>
                )}
                <button type="button" style={artifactActionButtonStyle} onClick={() => void downloadArtifact(artifact)}>
                  {labels.download}
                </button>
                <button type="button" style={artifactActionButtonStyle} onClick={() => void revealArtifact(artifact)}>
                  {labels.reveal}
                </button>
                <button type="button" style={artifactActionButtonStyle} onClick={() => void copyArtifactPath(artifact)}>
                  {labels.copy}
                </button>
              </div>
            </div>
            {statusById[artifact.artifact_id] && (
              <div style={artifactStatusStyle}>{statusById[artifact.artifact_id]}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArtifactPreviewPane({
  locale,
  active,
  onClose,
  onPreviewChange,
}: {
  locale: LongclawLocale
  active: ActiveArtifactPreview
  onClose: () => void
  onPreviewChange: (preview: ActiveArtifactPreview) => void
}) {
  const [status, setStatus] = useState(active.status ?? '')
  const artifact = active.artifact
  const metadata = artifact.metadata ?? {}
  const labels =
    locale === 'zh-CN'
      ? {
          preview: '预览',
          open: '打开',
          download: '下载',
          reveal: '显示',
          copied: '路径已复制。',
          previewing: '正在生成预览…',
          previewReady: '预览已生成。',
          downloadedTo: '已下载到',
          close: '关闭预览',
          placeholder: '点击预览生成文件缩略图',
        }
      : {
          preview: 'Preview',
          open: 'Open',
          download: 'Download',
          reveal: 'Reveal',
          copied: 'Path copied.',
          previewing: 'Generating preview...',
          previewReady: 'Preview ready.',
          downloadedTo: 'Downloaded to',
          close: 'Close preview',
          placeholder: 'Click Preview to generate a thumbnail',
        }

  useEffect(() => {
    setStatus(active.status ?? '')
  }, [active.artifact.artifact_id, active.status])

  async function perform(kind: string, payload: Record<string, unknown>) {
    const api = agentWindow().longclawControlPlane
    if (!api) return { ok: false, message: 'longclawControlPlane is unavailable' }
    return api.performLocalAction({ kind, payload })
  }

  async function openCurrent() {
    const uri = artifact.uri
    const kind = isHttpUri(uri) ? 'open_url' : isLocalPathUri(uri) ? 'open_path' : 'copy_value'
    const payload = isHttpUri(uri) ? { url: uri } : isLocalPathUri(uri) ? { path: uri } : { value: uri }
    const result = await perform(kind, payload)
    setStatus(recordString(result, 'result') || recordString(result, 'message') || (locale === 'zh-CN' ? '已打开。' : 'Opened.'))
  }

  async function revealCurrent() {
    if (!isLocalPathUri(artifact.uri)) {
      await perform('copy_value', { value: artifact.uri })
      setStatus(labels.copied)
      return
    }
    const result = await perform('reveal_path', { path: artifact.uri })
    setStatus(recordString(result, 'message') || (locale === 'zh-CN' ? '已在 Finder 中显示。' : 'Revealed in Finder.'))
  }

  async function downloadCurrent() {
    if (!isLocalPathUri(artifact.uri)) {
      await openCurrent()
      return
    }
    const result = await perform('export_artifact_to_downloads', { path: artifact.uri })
    const downloadPath = recordString(result, 'download_path')
    setStatus(downloadPath ? `${labels.downloadedTo} ${downloadPath}` : 'Downloaded.')
  }

  async function previewCurrent() {
    setStatus(labels.previewing)
    onPreviewChange({ artifact, preview: active.preview, status: labels.previewing })
    if (isPptxArtifact(artifact)) {
      const result = await perform('prepare_pptx_preview', { path: artifact.uri })
      const previewPath = recordString(result, 'preview_path')
      if (result.ok && previewPath) {
        const preview = { kind: 'image' as const, uri: artifact.uri, imagePath: previewPath }
        setStatus(labels.previewReady)
        onPreviewChange({ artifact, preview, status: labels.previewReady })
      } else {
        const nextStatus = recordString(result, 'message') || recordString(result, 'stderr_tail') || 'Preview unavailable'
        setStatus(nextStatus)
        onPreviewChange({ artifact, preview: active.preview, status: nextStatus })
      }
      return
    }

    if (isTextPreviewableArtifact(artifact.uri)) {
      const api = agentWindow().longclawControlPlane
      const result = await api?.readArtifactPreview?.(artifact.uri)
      if (result?.ok && typeof result.text === 'string') {
        const preview = { kind: 'text' as const, uri: artifact.uri, text: result.text }
        setStatus(labels.previewReady)
        onPreviewChange({ artifact, preview, status: labels.previewReady })
      } else {
        const nextStatus = recordString(result, 'reason') || 'Preview unavailable'
        setStatus(nextStatus)
        onPreviewChange({ artifact, preview: active.preview, status: nextStatus })
      }
    }
  }

  const title = artifact.title || fileNameFromUri(artifact.uri)
  const meta = [
    artifact.kind,
    recordString(metadata, 'backend'),
    recordNumber(metadata, 'slide_count')
      ? locale === 'zh-CN'
        ? `${recordNumber(metadata, 'slide_count')} 页`
        : `${recordNumber(metadata, 'slide_count')} slides`
      : '',
    recordNumber(metadata, 'size_bytes') ? `${recordNumber(metadata, 'size_bytes')} bytes` : '',
  ].filter(Boolean)

  return (
    <aside style={artifactPreviewPaneStyle}>
      <header style={artifactPreviewHeaderStyle}>
        <div style={artifactPreviewHeadingStyle}>
          <div style={artifactPreviewTitleStyle}>{title}</div>
          <div style={artifactPreviewUriStyle}>{artifact.uri}</div>
          {meta.length > 0 && <div style={artifactPreviewMetaStyle}>{meta.join(' · ')}</div>}
        </div>
        <button type="button" style={artifactPreviewCloseStyle} onClick={onClose} aria-label={labels.close}>
          ×
        </button>
      </header>
      <div style={artifactPreviewToolbarStyle}>
        {(isPptxArtifact(artifact) || isTextPreviewableArtifact(artifact.uri)) && (
          <button type="button" style={artifactPreviewButtonStyle} onClick={() => void previewCurrent()}>
            {labels.preview}
          </button>
        )}
        <button type="button" style={artifactPreviewButtonStyle} onClick={() => void openCurrent()}>
          {labels.open}
        </button>
        <button type="button" style={artifactPreviewButtonStyle} onClick={() => void downloadCurrent()}>
          {labels.download}
        </button>
        <button type="button" style={artifactPreviewButtonStyle} onClick={() => void revealCurrent()}>
          {labels.reveal}
        </button>
      </div>
      <div style={artifactPreviewCanvasStyle}>
        {active.preview?.kind === 'image' && active.preview.imagePath ? (
          <img
            src={fileUrlFromPath(active.preview.imagePath)}
            alt={title}
            style={artifactPreviewPaneImageStyle}
          />
        ) : active.preview?.kind === 'text' ? (
          <pre style={artifactPreviewPaneTextStyle}>{active.preview.text}</pre>
        ) : (
          <div style={artifactPreviewPlaceholderStyle}>
            <VectorIcon name="document" size={34} strokeWidth={1.7} />
            <div>{status || labels.placeholder}</div>
          </div>
        )}
      </div>
      {status && active.preview && <div style={artifactPreviewStatusStyle}>{status}</div>}
    </aside>
  )
}

function formatSignalsToolResult(result: Record<string, unknown> | undefined, locale: LongclawLocale): string {
  if (!result) {
    return locale === 'zh-CN' ? 'Signals 工具结果不可用。' : 'Signals tool result is unavailable.'
  }
  const ok = Boolean(result.ok)
  const dashboard = result.dashboard && typeof result.dashboard === 'object'
    ? (result.dashboard as Record<string, unknown>)
    : {}
  const dailyBrief = dashboard.daily_brief && typeof dashboard.daily_brief === 'object'
    ? (dashboard.daily_brief as Record<string, unknown>)
    : {}
  const chartContext = dashboard.chart_context && typeof dashboard.chart_context === 'object'
    ? (dashboard.chart_context as Record<string, unknown>)
    : {}
  const backtest = result.backtest && typeof result.backtest === 'object'
    ? (result.backtest as Record<string, unknown>)
    : {}
  const lines =
    locale === 'zh-CN'
      ? [
          ok ? 'Signals tool 已返回研究上下文。' : 'Signals tool 未取到有效上下文。',
          `base_url：${recordString(result, 'base_url') || '-'}`,
          `查询：${recordString(result, 'query') || '-'}`,
          `标的：${recordString(result, 'symbol') || recordString(chartContext, 'symbol') || '-'}`,
          `市场线：${recordString(dailyBrief, 'market_line') || '-'}`,
          `主线：${recordString(dailyBrief, 'primary_theme') || '-'}`,
          `首选候选：${recordString(dailyBrief, 'top_candidate') || '-'}`,
          `最新信号：${recordString(chartContext, 'latest_signal') || '-'}`,
          `回测：${backtest && Object.keys(backtest).length ? '已返回' : '未请求/未返回'}`,
        ]
      : [
          ok ? 'Signals tool returned research context.' : 'Signals tool did not return useful context.',
          `base_url: ${recordString(result, 'base_url') || '-'}`,
          `Query: ${recordString(result, 'query') || '-'}`,
          `Symbol: ${recordString(result, 'symbol') || recordString(chartContext, 'symbol') || '-'}`,
          `Market line: ${recordString(dailyBrief, 'market_line') || '-'}`,
          `Theme: ${recordString(dailyBrief, 'primary_theme') || '-'}`,
          `Top candidate: ${recordString(dailyBrief, 'top_candidate') || '-'}`,
          `Latest signal: ${recordString(chartContext, 'latest_signal') || '-'}`,
          `Backtest: ${backtest && Object.keys(backtest).length ? 'returned' : 'not requested/not returned'}`,
        ]
  const errors = result.errors && typeof result.errors === 'object' ? result.errors : null
  if (errors && Object.keys(errors).length > 0) {
    lines.push(`${locale === 'zh-CN' ? '接口提示' : 'API notes'}：${JSON.stringify(errors)}`)
  }
  return lines.filter(Boolean).join('\n')
}

function formatRpaResult(result: Record<string, unknown> | undefined, locale: LongclawLocale): string {
  if (!result) {
    return locale === 'zh-CN' ? 'RPA 执行结果不可用。' : 'RPA result is unavailable.'
  }
  const ok = Boolean(result.ok)
  const lines =
    locale === 'zh-CN'
      ? [
          ok ? '本地浏览器 RPA 已完成。' : '本地浏览器 RPA 未跑通。',
          `查询词：${recordString(result, 'query') || '-'}`,
          `站点：${recordString(result, 'site_name') || recordString(result, 'site_slug') || '-'}`,
          `状态：${recordString(result, 'validation_state') || recordString(result, 'execution_status') || '-'}`,
          `自动化：${recordString(result, 'current_automation_status') || '-'}`,
          `证据目录：${recordString(result, 'evidence_root') || recordString(result, 'output_root') || '-'}`,
          `报告：${recordString(result, 'report_path') || '-'}`,
          `下一步：${recordString(result, 'next_action') || recordString(result, 'message') || '-'}`,
        ]
      : [
          ok ? 'Local browser RPA completed.' : 'Local browser RPA did not complete.',
          `Query: ${recordString(result, 'query') || '-'}`,
          `Site: ${recordString(result, 'site_name') || recordString(result, 'site_slug') || '-'}`,
          `Status: ${recordString(result, 'validation_state') || recordString(result, 'execution_status') || '-'}`,
          `Automation: ${recordString(result, 'current_automation_status') || '-'}`,
          `Evidence: ${recordString(result, 'evidence_root') || recordString(result, 'output_root') || '-'}`,
          `Report: ${recordString(result, 'report_path') || '-'}`,
          `Next: ${recordString(result, 'next_action') || recordString(result, 'message') || '-'}`,
        ]
  if (!ok) {
    const stderr = recordString(result, 'stderr_tail')
    const stdout = recordString(result, 'stdout_tail')
    if (stderr) lines.push(`${locale === 'zh-CN' ? '错误摘要' : 'Error'}：${stderr.slice(0, 600)}`)
    if (!stderr && stdout) lines.push(`${locale === 'zh-CN' ? '输出摘要' : 'Output'}：${stdout.slice(0, 600)}`)
  }
  return lines.filter(Boolean).join('\n')
}

function buildBrowserRpaLaunchIntent(
  text: string,
  query: string,
  agentId: string,
): Record<string, unknown> {
  const createdAt = new Date().toISOString()
  return {
    source: 'electron_session_web_assistant',
    raw_text: `@pack due_diligence.company_due_diligence ${text}`,
    mentions: [
      {
        kind: 'pack',
        value: 'due_diligence.company_due_diligence',
        metadata: {
          automation_kind: 'browser_rpa',
          source_agent_id: agentId,
        },
      },
    ],
    requested_outcome: text,
    work_mode: 'local',
    launch_surface: 'electron_home',
    interaction_surface: 'electron_home',
    runtime_profile: 'dev_local_acp_bridge',
    runtime_target: 'local_runtime',
    model_plane: 'cloud_provider',
    local_runtime_seat: 'acp_bridge',
    workspace_target: '/Users/zhangqilong/github代码仓库/due-diligence-core',
    session_context: {
      session_id: agentId,
      channel: 'agent_session',
      user_id: 'local-user',
    },
    created_at: createdAt,
    metadata: {
      automation_kind: 'browser_rpa',
      browser_runtime: 'playwright',
      source_agent_id: agentId,
      pack_id: 'due_diligence',
      capability: 'due_diligence.company_due_diligence',
      query,
      requested_tools: ['due-diligence-core', 'playwright', 'validation-runner'],
      no_credentials: true,
      created_at: createdAt,
    },
  }
}

function formatLaunchReceipt(receipt: LaunchAutomationReceipt | undefined, locale: LongclawLocale): string {
  if (!receipt) return ''
  const taskId = receipt.task?.task_id
  const runId = receipt.run?.run_id
  if (locale === 'zh-CN') {
    return [
      '已登记到执行队列。',
      taskId ? `task_id：${taskId}` : '',
      runId ? `run_id：${runId}` : '',
      receipt.task?.status ? `任务状态：${receipt.task.status}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    'Registered in execution queue.',
    taskId ? `task_id: ${taskId}` : '',
    runId ? `run_id: ${runId}` : '',
    receipt.task?.status ? `Task status: ${receipt.task.status}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function agentIntro(locale: LongclawLocale, item: AgentConversationItem): string {
  if (item.kind === 'group') {
    return locale === 'zh-CN'
      ? '我是隆小侠万能群。适合把多个专员放进同一个任务里协作。'
      : 'This is the Longclaw agent group. Use it when a task needs several specialists.'
  }
  if (item.kind === 'wechat') {
    return locale === 'zh-CN'
      ? '这是一条移动端入站会话。你可以继续查看附件、上下文和关联任务。'
      : 'This is a mobile inbound session. Continue with attachments, context, and linked work.'
  }
  if (item.kind === 'thread' || item.kind === 'run') {
    return locale === 'zh-CN'
      ? '这是一个已有任务会话。你可以从这里继续，不必重新解释上下文。'
      : 'This is an existing work session. Continue without restating the context.'
  }
  const intro = cleanIntroText(item.instructions)
  if (intro) return intro
  return locale === 'zh-CN'
    ? '我是本地员工。请直接输入你要完成的结果。'
    : 'I am a local employee. Describe the outcome you want.'
}

function employeeSystemPrompt(item: AgentConversationItem, locale: LongclawLocale): string {
  if (item.kind !== 'agent') {
    return locale === 'zh-CN'
      ? '你是隆小侠 Agent OS 的会话助手。先理解目标，再协调合适员工完成。'
      : 'You are the Longclaw Agent OS session assistant. Understand the goal, then coordinate the right employees.'
  }

  const skillMentions = item.skillMentions ?? []
  const loadedSkillContext = skillContextSummary(item.skillContexts, locale)
  const parts = [
    locale === 'zh-CN'
      ? `你是隆小侠 Agent OS 的${item.title}。`
      : `You are the ${item.title} in Longclaw Agent OS.`,
    item.instructions?.trim(),
    skillMentions.length
      ? locale === 'zh-CN'
        ? `已绑定技能：${skillMentions.map(skill => `@skill ${skill}`).join('、')}。`
        : `Bound skills: ${skillMentions.map(skill => `@skill ${skill}`).join(', ')}.`
      : '',
    loadedSkillContext,
    locale === 'zh-CN'
      ? '回答时保持该员工角色，不要声称使用了未实际完成的外部文件或工具。需要真实文件产出时，明确下一步执行动作。'
      : 'Stay in this employee role. Do not claim external files or tools were completed unless they were actually completed.',
  ].filter(Boolean)

  const hasPresentationSkill =
    skillMentions.some(skill => /^(presentations|ppt-master|pptxgenjs|python-pptx)$/i.test(skill)) ||
    /ppt|deck|演示|汇报/.test(item.title)
  if (hasPresentationSkill) {
    parts.push(
      locale === 'zh-CN'
        ? '当用户提出 PPT、deck、汇报页、路演材料任务时，先输出“已读完 Presentations 技能说明，下面按完整专业流程来设计这套方案。”；然后按「任务模式 & 路由」「Claim Spine」「Contact Sheet」「设计系统」「逐页详细方案」「质量检查」「输出标记」组织。任务模式必须在 create、template-following、targeted-edit 中选择；backend profile 必须在 presentations-artifact-tool、ppt-master-svg-drawingml、pptxgenjs-draft、python-pptx-helper、python-image-deck 中选择。用户只要求方案时，不要声称已经生成 PPTX；用户要求文件时，先使用本地 tool 生成快速草稿，再说明最终高质量 deck 仍需可编辑 PPTX、渲染预览和视觉 QA 流程。'
        : 'For PPT, deck, and presentation tasks, first acknowledge that the Presentations skill has been read, then organize the answer by task routing, claim spine, contact sheet, design system, slide-by-slide plan, quality checks, and output marker.',
    )
  }

  return parts.join('\n')
}

function normalizeItems(employeeItems: AgentConversationItem[]): AgentConversationItem[] {
  const group: AgentConversationItem = {
    id: 'agent-group',
    title: '隆小侠万能群',
    subtitle: '点击新建群任务',
    meta: `( ${Math.max(employeeItems.length, fallbackAgents.length)} )`,
    icon: 'group',
    kind: 'group',
    preview: '多员工协作会话入口。先描述目标，再指定需要哪些员工参与。',
  }
  const merged = [group, ...employeeItems, ...fallbackAgents]
  const seen = new Set<string>()
  return merged.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function AgentSessionsWorkspace({
  locale,
  items,
  backgroundMode,
  onOpenChannels,
  onOpenSettings,
}: AgentSessionsWorkspaceProps) {
  void items
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [employeeItems, setEmployeeItems] = useState<AgentConversationItem[]>([])
  const [modelAliases, setModelAliases] = useState<ModelServiceAlias[]>([])
  const [selectedModel, setSelectedModel] = useState('auto')
  const [composerText, setComposerText] = useState('')
  const [chatMessagesByAgent, setChatMessagesByAgent] = useState<Record<string, AgentChatMessage[]>>({})
  const [sendBusy, setSendBusy] = useState(false)
  const [activeArtifactPreview, setActiveArtifactPreview] = useState<ActiveArtifactPreview | null>(null)
  const pendingAutoRef = useRef<{ id: string; agentId: string; receivedText: boolean } | null>(null)
  const normalizedItems = useMemo(() => normalizeItems(employeeItems), [employeeItems])
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return normalizedItems
    return normalizedItems.filter(item =>
      [item.title, item.subtitle, item.preview, item.meta]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(value),
    )
  }, [normalizedItems, query])
  const selected =
    normalizedItems.find(item => item.id === selectedId) ??
    normalizedItems.find(item => item.active) ??
    normalizedItems[0]
  const selectedAgentId = selected.id
  const chatMessages = chatMessagesByAgent[selectedAgentId] ?? []

  function updateAgentChatMessages(
    agentId: string,
    updater: (messages: AgentChatMessage[]) => AgentChatMessage[],
  ) {
    setChatMessagesByAgent(previous => ({
      ...previous,
      [agentId]: updater(previous[agentId] ?? []),
    }))
  }

  useEffect(() => {
    let cancelled = false
    agentWindow().longclawEmployees
      ?.list()
      .then(definitions => {
        if (!cancelled) setEmployeeItems(definitions.map(definitionToConversationItem))
      })
      .catch(() => {
        if (!cancelled) setEmployeeItems([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    agentWindow().longclawModelService
      ?.getSettings()
      .then(settings => {
        if (!cancelled) setModelAliases(settings.aliases ?? [])
      })
      .catch(() => {
        if (!cancelled) setModelAliases([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedModel !== 'auto' && !modelAliases.some(item => item.alias === selectedModel)) {
      setSelectedModel('auto')
    }
  }, [modelAliases, selectedModel])

  useEffect(() => {
    setActiveArtifactPreview(null)
  }, [selectedAgentId])

  useEffect(() => {
    const preferred = selected?.defaultModel
    if (!preferred) return
    if (preferred === 'auto') {
      setSelectedModel('auto')
      return
    }
    if (modelAliases.some(item => item.alias === preferred)) {
      setSelectedModel(preferred)
    }
  }, [modelAliases, selected?.defaultModel, selected?.id])

  useEffect(() => {
    const api = agentWindow().agentAPI
    const releaseText = api?.onText(text => {
      const pending = pendingAutoRef.current
      if (!pending) return
      updateAgentChatMessages(pending.agentId, previous =>
        previous.map(message =>
          message.id === pending.id
            ? {
                ...message,
                text: pending.receivedText ? `${message.text}${text}` : text,
                pending: true,
              }
            : message,
        ),
      )
      pending.receivedText = true
    })
    const releaseResult = api?.onResult(() => {
      const pending = pendingAutoRef.current
      if (!pending) return
      updateAgentChatMessages(pending.agentId, previous =>
        previous.map(message =>
          message.id === pending.id
            ? {
                ...message,
                text: pending.receivedText
                  ? message.text
                  : locale === 'zh-CN'
                    ? '请求已完成。'
                    : 'Request completed.',
                pending: false,
              }
            : message,
        ),
      )
      pendingAutoRef.current = null
      setSendBusy(false)
    })
    const releaseError = api?.onError(error => {
      const pending = pendingAutoRef.current
      if (!pending) return
      updateAgentChatMessages(pending.agentId, previous =>
        previous.map(message =>
          message.id === pending.id
            ? {
                ...message,
                text: error,
                pending: false,
              }
            : message,
        ),
      )
      pendingAutoRef.current = null
      setSendBusy(false)
    })
    return () => {
      releaseText?.()
      releaseResult?.()
      releaseError?.()
    }
  }, [locale])

  async function sendComposer() {
    const text = composerText.trim()
    if (!text || sendBusy) return
    const activeAgent = selected
    const activeAgentId = activeAgent.id
    const activeSystemPrompt = employeeSystemPrompt(activeAgent, locale)
    const userId = `user:${Date.now()}`
    const assistantId = `assistant:${Date.now()}`
    const modelLabel = selectedModel === 'auto' ? 'auto' : selectedModel
    updateAgentChatMessages(activeAgentId, previous => [
      ...previous,
      { id: userId, role: 'user', text, authorTitle: locale === 'zh-CN' ? '你' : 'You', meta: modelLabel },
      {
        id: assistantId,
        role: 'assistant',
        text: locale === 'zh-CN' ? '正在请求模型服务…' : 'Requesting model service...',
        authorTitle: activeAgent.title,
        meta: modelLabel,
        pending: true,
      },
    ])
    setComposerText('')
    setSendBusy(true)

    let messageForModel = text
    let localExecutionSummary = ''
    let modelMaxTokens: number | undefined
    if (isPptToolRequest(activeAgent, text)) {
      const pptTitle = extractPptTitle(text)
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text:
                  locale === 'zh-CN'
                    ? '正在调用本地 PPT tool 生成草稿文件…'
                    : 'Calling local PPT tool to generate a draft file...',
              }
            : message,
        ),
      )
      let pptResult: Record<string, unknown> | undefined
      try {
        pptResult = await agentWindow().longclawControlPlane?.performLocalAction({
          kind: 'run_pptx_draft',
          payload: {
            title: pptTitle,
            prompt: text,
          },
        })
      } catch (error) {
        pptResult = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          title: pptTitle,
        }
      }
      const pptArtifacts = artifactArrayFromToolResult(pptResult)
      if (pptArtifacts.length > 0) {
        setActiveArtifactPreview({
          artifact: pptArtifacts[0],
          status: locale === 'zh-CN' ? 'PPTX 已生成，点击预览生成缩略图。' : 'PPTX generated. Click Preview for a thumbnail.',
        })
      }
      localExecutionSummary = formatPptToolResult(pptResult, locale)
      modelMaxTokens = 360
      messageForModel =
        locale === 'zh-CN'
          ? `用户原始任务：${text}\n\n以下是 Agent OS 已经完成的本地 PPT tool use 结果。你只允许输出 4 行以内 receipt 摘要：文件路径、backend、页数、草稿性质，以及用户要求的标记。不要输出方案设计书，不要重复逐页内容，不要声称已经完成高质量最终交付：\n${JSON.stringify(
              { ppt: pptResult ?? null },
              null,
              2,
            )}`
          : `Original user task: ${text}\n\nAgent OS already ran this local PPT tool use. Output at most 4 receipt lines: file path, backend, slide count, draft caveat, and any marker requested by the user. Do not output a deck plan:\n${JSON.stringify(
              { ppt: pptResult ?? null },
              null,
              2,
            )}`
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                artifacts: pptArtifacts,
                text: `${localExecutionSummary}\n\n${
                  locale === 'zh-CN' ? '正在请求 DeepSeek 总结…' : 'Requesting DeepSeek summary...'
                }`,
              }
            : message,
        ),
      )
    } else if (isSignalsResearchRequest(activeAgent, text)) {
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text:
                  locale === 'zh-CN'
                    ? '正在调用 Signals tool 读取信号、策略和回测上下文…'
                    : 'Calling Signals tool for signals, strategy, and backtest context...',
              }
            : message,
        ),
      )

      let signalsResult: Record<string, unknown> | undefined
      try {
        signalsResult = await agentWindow().longclawControlPlane?.performLocalAction({
          kind: 'run_signals_research',
          payload: {
            query: text,
          },
        })
      } catch (error) {
        signalsResult = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          query: text,
        }
      }

      localExecutionSummary = formatSignalsToolResult(signalsResult, locale)
      messageForModel =
        locale === 'zh-CN'
          ? `用户原始任务：${text}\n\n以下是 Agent OS 已经完成的 Signals tool use 结果，请基于这些真实结果做投研总结。不要输出直接买卖指令；必须说明证据来源、回测/信号口径、数据状态、风险和待验证动作：\n${JSON.stringify(
              { signals: signalsResult ?? null },
              null,
              2,
            )}`
          : `Original user task: ${text}\n\nAgent OS already ran this Signals tool use. Summarize from these real results. Do not provide direct buy/sell instructions; include evidence, signal/backtest assumptions, data status, risks, and validation steps:\n${JSON.stringify(
              { signals: signalsResult ?? null },
              null,
              2,
            )}`
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text: `${localExecutionSummary}\n\n${
                  locale === 'zh-CN' ? '正在请求 DeepSeek 总结…' : 'Requesting DeepSeek summary...'
                }`,
              }
            : message,
        ),
      )
    } else if (isWebRpaRequest(activeAgent, text)) {
      const rpaQuery = extractDueDiligenceQuery(text)
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text:
                  locale === 'zh-CN'
                    ? '正在登记执行任务，并启动本地浏览器 RPA…'
                    : 'Registering execution task and starting local browser RPA...',
              }
            : message,
        ),
      )

      let launchReceipt: LaunchAutomationReceipt | undefined
      let launchError = ''
      try {
        launchReceipt = await agentWindow().longclawLaunch?.launch(
          buildBrowserRpaLaunchIntent(text, rpaQuery, activeAgentId),
        )
      } catch (error) {
        launchError = error instanceof Error ? error.message : String(error)
      }

      let rpaResult: Record<string, unknown> | undefined
      try {
        rpaResult = await agentWindow().longclawControlPlane?.performLocalAction({
          kind: 'run_due_diligence_rpa_demo',
          payload: {
            query: rpaQuery,
            site_slug: 'process49_www_baidu_com',
            headed: true,
            allow_headed_fallback: true,
          },
        })
      } catch (error) {
        rpaResult = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          query: rpaQuery,
          site_slug: 'process49_www_baidu_com',
        }
      }

      const launchSummary =
        formatLaunchReceipt(launchReceipt, locale) ||
        (launchError
          ? locale === 'zh-CN'
            ? `执行队列登记失败：${launchError}`
            : `Execution queue registration failed: ${launchError}`
          : '')
      const rpaSummary = formatRpaResult(rpaResult, locale)
      localExecutionSummary = [launchSummary, rpaSummary].filter(Boolean).join('\n\n')
      messageForModel =
        locale === 'zh-CN'
          ? `用户原始任务：${text}\n\n以下是 Agent OS 已经完成的本地浏览器 RPA 执行结果，请只基于这些真实结果总结，不要编造额外网页访问：\n${JSON.stringify(
              { launch: launchReceipt ?? null, launch_error: launchError, rpa: rpaResult ?? null },
              null,
              2,
            )}`
          : `Original user task: ${text}\n\nAgent OS already ran this local browser RPA. Summarize only from these real results:\n${JSON.stringify(
              { launch: launchReceipt ?? null, launch_error: launchError, rpa: rpaResult ?? null },
              null,
              2,
            )}`
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text: `${localExecutionSummary}\n\n${
                  locale === 'zh-CN' ? '正在请求 DeepSeek 总结…' : 'Requesting DeepSeek summary...'
                }`,
              }
            : message,
        ),
      )
    }

    if (selectedModel === 'auto') {
      const api = agentWindow().agentAPI
      if (!api) {
        updateAgentChatMessages(activeAgentId, previous =>
          previous.map(message =>
            message.id === assistantId
              ? {
                  ...message,
                  text: [localExecutionSummary, 'agentAPI is unavailable'].filter(Boolean).join('\n\n'),
                  pending: false,
                }
              : message,
          ),
        )
        setSendBusy(false)
        return
      }
      pendingAutoRef.current = { id: assistantId, agentId: activeAgentId, receivedText: false }
      try {
        await api.query(`${activeSystemPrompt}\n\n用户任务：${messageForModel}`)
      } catch (error) {
        if (pendingAutoRef.current?.id === assistantId) {
          updateAgentChatMessages(activeAgentId, previous =>
            previous.map(message =>
              message.id === assistantId
                ? {
                    ...message,
                    text: [
                      localExecutionSummary,
                      error instanceof Error ? error.message : String(error),
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                    pending: false,
                  }
                : message,
            ),
          )
          pendingAutoRef.current = null
        }
      } finally {
        if (pendingAutoRef.current?.id === assistantId) {
          const receivedText = pendingAutoRef.current.receivedText
          updateAgentChatMessages(activeAgentId, previous =>
            previous.map(message =>
              message.id === assistantId
                ? {
                    ...message,
                    text: receivedText
                      ? message.text
                      : locale === 'zh-CN'
                        ? '请求已完成。'
                        : 'Request completed.',
                    pending: false,
                  }
                : message,
            ),
          )
          pendingAutoRef.current = null
        }
        setSendBusy(false)
      }
      return
    }

    try {
      const result = await agentWindow().longclawModelService?.chat({
        message: messageForModel,
        alias: selectedModel,
        systemPrompt: activeSystemPrompt,
        maxTokens: modelMaxTokens,
      })
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text: [
                  localExecutionSummary,
                  result?.ok ? result.text || result.message : result?.message || 'model service unavailable',
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                meta: result?.model ?? modelLabel,
                pending: false,
              }
            : message,
        ),
      )
    } catch (error) {
      updateAgentChatMessages(activeAgentId, previous =>
        previous.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text: [
                  localExecutionSummary,
                  error instanceof Error ? error.message : String(error),
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                pending: false,
              }
            : message,
        ),
      )
    } finally {
      setSendBusy(false)
    }
  }

  async function openEmployeeFolder() {
    await agentWindow().longclawEmployees?.openFolder()
  }

  async function openSelectedEmployeeDefinition() {
    const target = selected.definitionPath ?? selected.id.replace(/^employee:/, '')
    await agentWindow().longclawEmployees?.openDefinition(target)
  }

  return (
    <div style={sessionsShellStyle(backgroundMode, Boolean(activeArtifactPreview))}>
      <aside style={conversationListStyle}>
        <div style={conversationHeaderStyle}>
          <div style={conversationTitleStyle}>{locale === 'zh-CN' ? '会话' : 'Sessions'}</div>
          <button type="button" style={smallPlainButtonStyle} onClick={onOpenChannels}>
            {locale === 'zh-CN' ? '频道' : 'Channels'}
          </button>
        </div>
        <input
          value={query}
          placeholder={locale === 'zh-CN' ? '搜索通讯录员工…' : 'Search agents…'}
          style={searchInputStyle}
          onChange={event => setQuery(event.target.value)}
        />
        <div style={sectionLabelStyle}>{locale === 'zh-CN' ? '关键员工' : 'Key employees'}</div>
        <div style={conversationRowsStyle}>
          {filteredItems.map(item => {
            const active = item.id === selected.id
            return (
              <button
                key={item.id}
                type="button"
                style={conversationRowStyle(active)}
                onClick={() => setSelectedId(item.id)}
              >
                <span style={avatarStyle(active)}>
                  <VectorIcon name={item.icon} size={17} strokeWidth={2} />
                </span>
                <span style={conversationRowTextStyle}>
                  <span style={conversationRowTitleStyle}>{item.title}</span>
                  <span style={conversationRowSubtitleStyle}>{item.subtitle}</span>
                </span>
                {item.meta && <span style={conversationRowMetaStyle}>{item.meta}</span>}
              </button>
            )
          })}
        </div>
      </aside>

      <section style={chatPaneStyle}>
        <header style={chatHeaderStyle}>
          <div style={chatHeaderLeadStyle}>
            <span style={chatHeaderGlyphStyle}>
              <VectorIcon name={selected.icon} size={18} strokeWidth={2} />
            </span>
            <span>
              <div style={chatTitleStyle}>{selected.title}</div>
              <div style={chatSubtitleStyle}>
                {locale === 'zh-CN' ? '当前任务：' : 'Current task: '}
                {selected.subtitle}
              </div>
            </span>
          </div>
          <div style={chatActionsStyle}>
            <button type="button" style={smallPlainButtonStyle} onClick={() => void openEmployeeFolder()}>
              {locale === 'zh-CN' ? '员工目录' : 'Employees'}
            </button>
            {selected.kind === 'agent' && (
              <button type="button" style={smallPlainButtonStyle} onClick={() => void openSelectedEmployeeDefinition()}>
                {locale === 'zh-CN' ? '编辑员工' : 'Edit'}
              </button>
            )}
            <button type="button" style={smallPlainButtonStyle}>
              {locale === 'zh-CN' ? '独立窗口' : 'Window'}
            </button>
            <button type="button" style={smallPlainButtonStyle}>
              {locale === 'zh-CN' ? '新建对话' : 'New chat'}
            </button>
            <button type="button" style={iconPlainButtonStyle} onClick={onOpenSettings} aria-label={locale === 'zh-CN' ? '设置' : 'Settings'}>
              <VectorIcon name="settings" size={15} strokeWidth={2.1} />
            </button>
          </div>
        </header>

        <div style={messageStageStyle}>
          <article style={assistantMessageStyle}>
            <div style={messageAvatarStyle}>
              <VectorIcon name={selected.icon} size={18} strokeWidth={2} />
            </div>
            <div style={messageBodyStyle}>
              <div style={messageAuthorStyle}>{selected.title}</div>
              <p style={messageParagraphStyle}>{agentIntro(locale, selected)}</p>
              <p style={messageParagraphStyle}>
                {selected.preview ||
                  (locale === 'zh-CN'
                    ? '请直接输入你要完成的结果。需要资料时用 @ 选择数据资源，系统会把上下文放进同一个会话里。'
                    : 'Describe the outcome directly. Use @ to attach data resources; context stays in this session.')}
              </p>
              {selected.skillMentions?.length ? (
                <div style={messageSkillStyle}>
                  {selected.skillMentions.map(skill => (
                    <span key={skill} style={messageSkillPillStyle}>
                      @{skill}
                    </span>
                  ))}
                </div>
              ) : null}
              <button type="button" style={copyButtonStyle}>
                {locale === 'zh-CN' ? '复制' : 'Copy'}
              </button>
            </div>
          </article>
          {chatMessages.length > 0 && (
            <div style={chatTranscriptStyle}>
              {chatMessages.map(message => (
                <article key={message.id} style={chatMessageStyle(message.role)}>
                  <div style={chatMessageMetaStyle}>
                    {message.authorTitle ??
                      (message.role === 'user' ? (locale === 'zh-CN' ? '你' : 'You') : selected.title)}
                    {message.meta ? ` · ${message.meta}` : ''}
                    {message.pending ? (locale === 'zh-CN' ? ' · 请求中' : ' · pending') : ''}
                  </div>
                  {message.artifacts?.length ? (
                    <AgentArtifactList
                      locale={locale}
                      artifacts={message.artifacts}
                      onPreviewChange={setActiveArtifactPreview}
                    />
                  ) : null}
                  <div style={chatMessageBubbleStyle(message.role)}>{message.text}</div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div style={composerShellStyle}>
          <textarea
            value={composerText}
            rows={3}
            style={composerInputStyle}
            placeholder={locale === 'zh-CN' ? '输入消息，使用 @ 选择数据资源…' : 'Message, use @ to attach resources…'}
            onChange={event => setComposerText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendComposer()
              }
            }}
          />
          <div style={composerToolbarStyle}>
            <select
              style={composerSelectStyle}
              value={selectedModel}
              aria-label={locale === 'zh-CN' ? '选择模型' : 'Select model'}
              onChange={event => setSelectedModel(event.target.value)}
            >
              <option value="auto">auto</option>
              {modelAliases.map(item => (
                <option key={item.id} value={item.alias}>
                  {item.alias}
                </option>
              ))}
            </select>
            <button type="button" style={composerToolButtonStyle}>@</button>
            <button
              type="button"
              style={composerToolButtonStyle}
              onClick={() => void openSelectedEmployeeDefinition()}
            >
              SKILL
            </button>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              style={{ ...sendButtonStyle, opacity: sendBusy ? 0.55 : 1 }}
              aria-label={locale === 'zh-CN' ? '发送' : 'Send'}
              disabled={sendBusy || !composerText.trim()}
              onClick={() => void sendComposer()}
            >
              <VectorIcon name="send" size={16} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </section>
      {activeArtifactPreview && (
        <ArtifactPreviewPane
          locale={locale}
          active={activeArtifactPreview}
          onClose={() => setActiveArtifactPreview(null)}
          onPreviewChange={setActiveArtifactPreview}
        />
      )}
    </div>
  )
}

export default AgentSessionsWorkspace

const light = {
  app: 'var(--session-app)',
  panel: 'var(--session-panel)',
  panelSoft: 'var(--session-panel-soft)',
  border: 'var(--session-border)',
  borderStrong: 'var(--session-border-strong)',
  text: 'var(--session-text)',
  muted: 'var(--session-muted)',
  mutedStrong: 'var(--session-muted-strong)',
  accent: 'var(--session-accent)',
}

const sessionsShellStyle = (backgroundMode: ShellBackgroundMode, previewOpen = false): CSSProperties => {
  const vars =
    backgroundMode === 'dark'
      ? {
          '--session-app': '#070A0F',
          '--session-panel': '#0D131C',
          '--session-panel-soft': '#151E2B',
          '--session-panel-muted': '#101722',
          '--session-card': '#101722',
          '--session-row-active': '#172231',
          '--session-border': 'rgba(226, 232, 240, 0.10)',
          '--session-border-strong': 'rgba(226, 232, 240, 0.18)',
          '--session-text': '#F4F7FB',
          '--session-muted': '#8F9BAD',
          '--session-muted-strong': '#B5C0CF',
          '--session-accent': '#F2B45C',
          '--session-shadow': '0 18px 40px rgba(0, 0, 0, 0.28)',
          '--session-stage-padding': 'clamp(18px, 2.2vh, 28px) clamp(20px, 2.2vw, 34px)',
          '--session-composer-margin': '0 clamp(16px, 2vw, 28px) clamp(12px, 1.8vh, 22px)',
          '--session-composer-height': 'clamp(96px, 14vh, 132px)',
          '--session-list-padding': '14px 11px',
          '--session-font-size': '14px',
        }
      : {
          '--session-app': '#F6F7F9',
          '--session-panel': '#FFFFFF',
          '--session-panel-soft': '#F2F3F5',
          '--session-panel-muted': '#FAFAFA',
          '--session-card': '#FFFFFF',
          '--session-row-active': '#E8E8E8',
          '--session-border': '#E0E3E8',
          '--session-border-strong': '#CBD1DA',
          '--session-text': '#20242A',
          '--session-muted': '#747B86',
          '--session-muted-strong': '#555E6A',
          '--session-accent': '#D79A16',
          '--session-shadow': '0 8px 26px rgba(15, 23, 42, 0.08)',
          '--session-stage-padding': 'clamp(16px, 2vh, 24px) clamp(18px, 2vw, 28px)',
          '--session-composer-margin': '0 clamp(14px, 1.8vw, 24px) clamp(12px, 1.6vh, 18px)',
          '--session-composer-height': 'clamp(90px, 13vh, 120px)',
          '--session-list-padding': '12px 10px',
          '--session-font-size': '13px',
        }
  return {
    ...vars,
    height: '100%',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: previewOpen
      ? backgroundMode === 'dark'
        ? '296px minmax(0, 1fr) minmax(340px, 34vw)'
        : '280px minmax(0, 1fr) minmax(340px, 34vw)'
      : backgroundMode === 'dark'
        ? '296px minmax(0, 1fr)'
        : '280px minmax(0, 1fr)',
    background: light.app,
    color: light.text,
    border: `1px solid ${light.border}`,
    overflow: 'hidden',
    fontFamily: fontStacks.ui,
  } as CSSProperties
}

const conversationListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 'var(--session-list-padding)',
  borderRight: `1px solid ${light.border}`,
  background: light.panel,
  minWidth: 0,
  minHeight: 0,
}

const conversationHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
}

const conversationTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.2,
}

const smallPlainButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 6,
  background: light.panelSoft,
  color: light.mutedStrong,
  height: 28,
  padding: '0 10px',
  fontFamily: fontStacks.ui,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const iconPlainButtonStyle: CSSProperties = {
  ...smallPlainButtonStyle,
  width: 28,
  padding: 0,
  fontSize: 18,
}

const searchInputStyle: CSSProperties = {
  height: 42,
  borderRadius: 8,
  border: `1px solid ${light.border}`,
  background: light.panel,
  color: light.text,
  padding: '0 12px',
  outline: 'none',
  fontFamily: fontStacks.ui,
  fontSize: 13,
}

const sectionLabelStyle: CSSProperties = {
  color: light.mutedStrong,
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1,
}

const conversationRowsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  overflowY: 'auto',
  minHeight: 0,
}

const conversationRowStyle = (active: boolean): CSSProperties => ({
  width: '100%',
  minHeight: 62,
  border: 'none',
  borderRadius: 8,
  background: active ? 'var(--session-row-active)' : 'transparent',
  color: light.text,
  display: 'grid',
  gridTemplateColumns: '28px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  padding: '8px 9px',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
})

const avatarStyle = (active: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: active ? light.panel : light.panelSoft,
  color: active ? light.text : light.mutedStrong,
  fontSize: 9,
  fontWeight: 900,
  lineHeight: 1,
})

const conversationRowTextStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
}

const conversationRowTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const conversationRowSubtitleStyle: CSSProperties = {
  color: light.muted,
  fontSize: 12,
  lineHeight: 1.15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const conversationRowMetaStyle: CSSProperties = {
  alignSelf: 'start',
  color: light.muted,
  fontSize: 12,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}

const chatPaneStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: '62px minmax(0, 1fr) auto',
  minWidth: 0,
  minHeight: 0,
  background: 'var(--session-panel-muted)',
}

const chatHeaderStyle: CSSProperties = {
  height: 62,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '0 20px',
  borderBottom: `1px solid ${light.border}`,
  background: light.panel,
}

const chatHeaderLeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
}

const chatHeaderGlyphStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9,
  background: light.panelSoft,
  color: light.accent,
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
}

const chatTitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.2,
  fontWeight: 850,
}

const chatSubtitleStyle: CSSProperties = {
  marginTop: 3,
  color: light.muted,
  fontSize: 12,
  lineHeight: 1.2,
}

const chatActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const messageStageStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  padding: 'var(--session-stage-padding)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const assistantMessageStyle: CSSProperties = {
  maxWidth: 760,
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 12,
}

const messageAvatarStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: light.panelSoft,
  color: light.accent,
  fontSize: 10,
  fontWeight: 900,
}

const messageBodyStyle: CSSProperties = {
  background: 'var(--session-card)',
  borderRadius: 10,
  padding: '16px 18px',
  boxShadow: 'var(--session-shadow)',
}

const messageAuthorStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.3,
  marginBottom: 12,
}

const messageParagraphStyle: CSSProperties = {
  margin: '0 0 12px',
  color: light.mutedStrong,
  fontSize: 14,
  lineHeight: 1.75,
}

const messageSkillStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  margin: '2px 0 12px',
}

const messageSkillPillStyle: CSSProperties = {
  border: `1px solid ${light.border}`,
  borderRadius: 999,
  background: light.panelSoft,
  color: light.mutedStrong,
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 750,
  lineHeight: 1.2,
}

const copyButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: light.muted,
  padding: 0,
  fontFamily: fontStacks.ui,
  fontSize: 12,
  cursor: 'pointer',
}

const chatTranscriptStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  maxWidth: 820,
}

const chatMessageStyle = (role: AgentChatMessage['role']): CSSProperties => ({
  alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
  width: 'min(100%, 760px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
})

const chatMessageMetaStyle: CSSProperties = {
  color: light.muted,
  fontSize: 11,
  fontWeight: 750,
}

const chatMessageBubbleStyle = (role: AgentChatMessage['role']): CSSProperties => ({
  borderRadius: 10,
  border: `1px solid ${role === 'user' ? light.borderStrong : light.border}`,
  background: role === 'user' ? light.panelSoft : 'var(--session-card)',
  color: light.text,
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  boxShadow: role === 'assistant' ? 'var(--session-shadow)' : 'none',
})

const artifactListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const artifactRowStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${light.border}`,
  background: 'var(--session-card)',
  padding: '10px 12px',
  boxShadow: 'var(--session-shadow)',
}

const artifactRowHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const artifactLeadStyle: CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const artifactTitleStyle: CSSProperties = {
  color: light.text,
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const artifactUriStyle: CSSProperties = {
  color: light.muted,
  fontFamily: fontStacks.mono,
  fontSize: 11,
  lineHeight: 1.45,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const artifactMetaStyle: CSSProperties = {
  color: light.mutedStrong,
  fontSize: 11,
  lineHeight: 1.35,
}

const artifactActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexWrap: 'wrap',
  flexShrink: 0,
}

const artifactActionButtonStyle: CSSProperties = {
  border: `1px solid ${light.border}`,
  borderRadius: 6,
  background: light.panelSoft,
  color: light.mutedStrong,
  height: 26,
  padding: '0 9px',
  fontFamily: fontStacks.ui,
  fontSize: 12,
  fontWeight: 750,
  cursor: 'pointer',
}

const artifactStatusStyle: CSSProperties = {
  marginTop: 8,
  color: light.muted,
  fontSize: 12,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const artifactPreviewPaneStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
  minWidth: 0,
  minHeight: 0,
  borderLeft: `1px solid ${light.border}`,
  background: light.panel,
}

const artifactPreviewHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
  padding: '18px 18px 12px',
  borderBottom: `1px solid ${light.border}`,
}

const artifactPreviewHeadingStyle: CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
}

const artifactPreviewTitleStyle: CSSProperties = {
  color: light.text,
  fontSize: 18,
  lineHeight: 1.25,
  fontWeight: 850,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const artifactPreviewUriStyle: CSSProperties = {
  color: light.muted,
  fontFamily: fontStacks.mono,
  fontSize: 11,
  lineHeight: 1.45,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const artifactPreviewMetaStyle: CSSProperties = {
  color: light.mutedStrong,
  fontSize: 12,
  lineHeight: 1.4,
}

const artifactPreviewCloseStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: light.mutedStrong,
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
}

const artifactPreviewToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  padding: '12px 18px',
  borderBottom: `1px solid ${light.border}`,
}

const artifactPreviewButtonStyle: CSSProperties = {
  ...artifactActionButtonStyle,
  height: 30,
  padding: '0 12px',
}

const artifactPreviewCanvasStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: 18,
  background: 'var(--session-panel-muted)',
}

const artifactPreviewPaneImageStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
  margin: '0 auto',
  borderRadius: 8,
  border: `1px solid ${light.border}`,
  background: light.panelSoft,
  boxShadow: 'var(--session-shadow)',
}

const artifactPreviewPaneTextStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  color: light.text,
  background: 'var(--session-card)',
  border: `1px solid ${light.border}`,
  borderRadius: 8,
  padding: 12,
  fontFamily: fontStacks.mono,
  fontSize: 12,
  lineHeight: 1.55,
}

const artifactPreviewPlaceholderStyle: CSSProperties = {
  minHeight: 260,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  borderRadius: 8,
  border: `1px dashed ${light.borderStrong}`,
  background: 'var(--session-card)',
  color: light.muted,
  fontSize: 13,
  lineHeight: 1.4,
  textAlign: 'center',
}

const artifactPreviewStatusStyle: CSSProperties = {
  borderTop: `1px solid ${light.border}`,
  color: light.mutedStrong,
  fontSize: 12,
  lineHeight: 1.45,
  padding: '10px 18px',
  overflowWrap: 'anywhere',
}

const composerShellStyle: CSSProperties = {
  margin: 'var(--session-composer-margin)',
  border: `1px solid ${light.borderStrong}`,
  borderRadius: 16,
  background: 'var(--session-card)',
  boxShadow: 'var(--session-shadow)',
  overflow: 'hidden',
}

const composerInputStyle: CSSProperties = {
  width: '100%',
  height: 'var(--session-composer-height)',
  resize: 'none',
  border: 'none',
  outline: 'none',
  padding: '16px 18px 8px',
  color: light.text,
  background: 'transparent',
  fontFamily: fontStacks.ui,
  fontSize: 'var(--session-font-size)',
  lineHeight: 1.5,
  boxSizing: 'border-box',
}

const composerToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 12px 10px',
}

const composerSelectStyle: CSSProperties = {
  height: 28,
  border: 'none',
  borderRadius: 6,
  background: light.panelSoft,
  color: light.mutedStrong,
  padding: '0 8px',
  fontFamily: fontStacks.ui,
  fontSize: 12,
}

const composerToolButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: light.mutedStrong,
  fontFamily: fontStacks.ui,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
}

const sendButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  borderRadius: 8,
  background: light.panelSoft,
  color: light.mutedStrong,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}
