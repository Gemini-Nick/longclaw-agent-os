import React, { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { fontStacks } from '../designSystem.js'
import type { LongclawLocale } from '../i18n.js'
import type { ShellBackgroundMode } from '../layout.js'
import { VectorIcon, type VectorIconName } from '../vectorIcons.js'

export type AgentConversationItem = {
  id: string
  title: string
  subtitle: string
  meta?: string
  preview?: string
  icon: VectorIconName
  kind: 'agent' | 'group' | 'thread' | 'wechat' | 'run'
  active?: boolean
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

const fallbackAgents: AgentConversationItem[] = [
  {
    id: 'agent-generalist',
    title: '通用执行专员',
    subtitle: '未命名任务',
    meta: '05:10',
    icon: 'agent',
    kind: 'agent',
    active: true,
  },
  {
    id: 'agent-web',
    title: '网页助手',
    subtitle: '未命名任务',
    meta: '昨天',
    icon: 'link',
    kind: 'agent',
  },
  {
    id: 'agent-data',
    title: '数据分析师',
    subtitle: '未命名任务',
    meta: '昨天',
    icon: 'data',
    kind: 'agent',
  },
  {
    id: 'agent-doc',
    title: '文档与版式专员',
    subtitle: '未命名任务',
    meta: '昨天',
    icon: 'document',
    kind: 'agent',
  },
  {
    id: 'agent-dev',
    title: '全栈软件开发工程师',
    subtitle: '未命名任务',
    meta: '昨天',
    icon: 'code',
    kind: 'agent',
  },
]

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
  return locale === 'zh-CN'
    ? '我是通用执行专员。跨网页、文件、Python、数据库、数据源与脚本的综合任务可以先从我开始。'
    : 'I am the general execution agent. Start here for broad tasks across browser, files, Python, data, and scripts.'
}

function normalizeItems(items: AgentConversationItem[]): AgentConversationItem[] {
  const group: AgentConversationItem = {
    id: 'agent-group',
    title: '隆小侠万能群',
    subtitle: '点击新建群任务',
    meta: '( 7 )',
    icon: 'group',
    kind: 'group',
  }
  const merged = [group, ...items, ...fallbackAgents]
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
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modelAliases, setModelAliases] = useState<ModelServiceAlias[]>([])
  const normalizedItems = useMemo(() => normalizeItems(items), [items])
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

  useEffect(() => {
    let cancelled = false
    window.longclawModelService
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

  return (
    <div style={sessionsShellStyle(backgroundMode)}>
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
        <div style={sectionLabelStyle}>{locale === 'zh-CN' ? '最近任务' : 'Recent'}</div>
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
              <button type="button" style={copyButtonStyle}>
                {locale === 'zh-CN' ? '复制' : 'Copy'}
              </button>
            </div>
          </article>
        </div>

        <div style={composerShellStyle}>
          <textarea
            rows={3}
            style={composerInputStyle}
            placeholder={locale === 'zh-CN' ? '输入消息，使用 @ 选择数据资源…' : 'Message, use @ to attach resources…'}
          />
          <div style={composerToolbarStyle}>
            <select style={composerSelectStyle} defaultValue="auto" aria-label={locale === 'zh-CN' ? '选择模型' : 'Select model'}>
              <option value="auto">auto</option>
              {modelAliases.map(item => (
                <option key={item.id} value={item.alias}>
                  {item.alias}
                </option>
              ))}
            </select>
            <button type="button" style={composerToolButtonStyle}>@</button>
            <button type="button" style={composerToolButtonStyle}>SKILL</button>
            <span style={{ flex: 1 }} />
            <button type="button" style={sendButtonStyle} aria-label={locale === 'zh-CN' ? '发送' : 'Send'}>
              <VectorIcon name="send" size={16} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </section>
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

const sessionsShellStyle = (backgroundMode: ShellBackgroundMode): CSSProperties => {
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
          '--session-stage-padding': '28px 34px 148px',
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
          '--session-stage-padding': '24px 28px 140px',
          '--session-list-padding': '12px 10px',
          '--session-font-size': '13px',
        }
  return {
    ...vars,
    minHeight: 'calc(100vh - 28px)',
    display: 'grid',
    gridTemplateColumns: backgroundMode === 'dark' ? '296px minmax(0, 1fr)' : '280px minmax(0, 1fr)',
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
  display: 'flex',
  flexDirection: 'column',
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
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 'var(--session-stage-padding)',
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

const copyButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: light.muted,
  padding: 0,
  fontFamily: fontStacks.ui,
  fontSize: 12,
  cursor: 'pointer',
}

const composerShellStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  margin: '0 20px 16px',
  border: `1px solid ${light.borderStrong}`,
  borderRadius: 16,
  background: 'var(--session-card)',
  boxShadow: 'var(--session-shadow)',
  overflow: 'hidden',
}

const composerInputStyle: CSSProperties = {
  width: '100%',
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
