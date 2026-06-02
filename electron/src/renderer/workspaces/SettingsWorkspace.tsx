import React, { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { fontStacks, statusBadgeStyle } from '../designSystem.js'
import { humanizeTokenLocale, type LongclawLocale } from '../i18n.js'
import type { ShellBackgroundMode } from '../layout.js'
import { VectorIcon } from '../vectorIcons.js'

type RuntimeStatusLike = {
  runtimeProfile?: string
  localRuntimeSeat?: string
  localRuntimeAvailable: boolean
  localAcpAvailable: boolean
  localRuntimeApiAvailable: boolean
}

type AgentModeLike = {
  mode: string
  alive: boolean
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

declare global {
  interface Window {
    longclawModelService?: {
      getSettings: () => Promise<ModelServiceSettings>
      updateSettings: (patch: Record<string, unknown>) => Promise<ModelServiceSettings>
      pullModels: () => Promise<ModelServiceResult>
      testConnection: () => Promise<ModelServiceResult>
    }
  }
}

export type SettingsWorkspaceProps = {
  locale: LongclawLocale
  backgroundMode: ShellBackgroundMode
  runtimeStatus: RuntimeStatusLike
  agentMode: AgentModeLike | null
  agentCwd: string
  localSeatPreference: string
}

const defaultSettings: ModelServiceSettings = {
  enabled: false,
  baseUrl: 'https://api.example.com/v1',
  apiKeySet: false,
  aliases: [],
  lastModels: [],
}

export function SettingsWorkspace({
  locale,
  backgroundMode,
  runtimeStatus,
  agentMode,
  agentCwd,
  localSeatPreference,
}: SettingsWorkspaceProps) {
  const zh = locale === 'zh-CN'
  const [settings, setSettings] = useState<ModelServiceSettings>(defaultSettings)
  const [baseUrl, setBaseUrl] = useState(defaultSettings.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [alias, setAlias] = useState('')
  const [thinking, setThinking] = useState(false)
  const [busy, setBusy] = useState<'save' | 'pull' | 'test' | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    window.longclawModelService
      ?.getSettings()
      .then(next => {
        if (cancelled) return
        setSettings(next)
        setBaseUrl(next.baseUrl)
      })
      .catch(error => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const modelOptions = useMemo(
    () => [...new Set([modelName, ...settings.lastModels, ...settings.aliases.map(item => item.model)].filter(Boolean))],
    [modelName, settings.aliases, settings.lastModels],
  )

  async function updateSettings(patch: Record<string, unknown>) {
    if (!window.longclawModelService) return
    const next = await window.longclawModelService.updateSettings(patch)
    setSettings(next)
    setBaseUrl(next.baseUrl)
  }

  async function saveSettings(kind: 'save' | 'pull' | 'test') {
    if (!window.longclawModelService || busy) return
    setBusy(kind)
    setNotice('')
    try {
      await updateSettings({
        enabled: settings.enabled,
        baseUrl,
        apiKey,
        aliases: settings.aliases,
      })
      if (kind === 'pull') {
        const result = await window.longclawModelService.pullModels()
        if (result.settings) setSettings(result.settings)
        setNotice(result.ok ? (zh ? '模型已拉取' : 'Models fetched') : result.message)
      } else if (kind === 'test') {
        const result = await window.longclawModelService.testConnection()
        if (result.settings) setSettings(result.settings)
        setNotice(result.ok ? (zh ? '连接可用' : 'Connection works') : result.message)
      } else {
        setApiKey('')
        setNotice(zh ? '配置已保存' : 'Settings saved')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  async function toggleEnabled(nextEnabled: boolean) {
    setSettings(previous => ({ ...previous, enabled: nextEnabled }))
    try {
      await updateSettings({ enabled: nextEnabled, baseUrl, aliases: settings.aliases })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }

  async function addAlias() {
    const model = modelName.trim()
    const label = alias.trim()
    if (!model || !label) return
    const nextAliases = [
      ...settings.aliases.filter(item => item.alias !== label),
      {
        id: `alias:${Date.now()}`,
        model,
        alias: label,
        thinking,
      },
    ]
    setModelName('')
    setAlias('')
    setThinking(false)
    await updateSettings({ enabled: settings.enabled, baseUrl, aliases: nextAliases })
  }

  async function removeAlias(id: string) {
    await updateSettings({
      enabled: settings.enabled,
      baseUrl,
      aliases: settings.aliases.filter(item => item.id !== id),
    })
  }

  return (
    <div style={settingsShellStyle(backgroundMode)}>
      <section style={settingsCardStyle}>
        <div style={settingsCardHeaderStyle}>
          <div style={cardTitleBlockStyle}>
            <div style={settingsIconTitleStyle}>
              <VectorIcon name="settings" size={17} strokeWidth={2} />
              <h2 style={settingsTitleStyle}>{zh ? '模型服务' : 'Model service'}</h2>
            </div>
            <p style={settingsTextStyle}>
              {zh
                ? '配置 OpenAI 兼容文本模型接口，自定义别名会出现在会话输入框模型下拉中。'
                : 'Configure an OpenAI-compatible text model endpoint. Aliases appear in the session model picker.'}
            </p>
          </div>
          <label style={switchShellStyle}>
            <span style={settingsMetaStyle}>{settings.enabled ? (zh ? '已启用' : 'Enabled') : (zh ? '未启用' : 'Disabled')}</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              style={hiddenCheckboxStyle}
              onChange={event => {
                void toggleEnabled(event.currentTarget.checked)
              }}
            />
            <span style={switchTrackStyle(settings.enabled)}>
              <span style={switchThumbStyle(settings.enabled)} />
            </span>
          </label>
        </div>

        <div style={modelFormStyle}>
          <input
            value={baseUrl}
            placeholder="https://api.example.com/v1"
            style={settingsInputStyle}
            onChange={event => setBaseUrl(event.target.value)}
          />
          <input
            value={apiKey}
            type="password"
            placeholder={settings.apiKeySet ? (zh ? 'API Key 已保存，留空则保留' : 'API Key saved; leave blank to keep it') : 'API Key'}
            style={settingsInputStyle}
            onChange={event => setApiKey(event.target.value)}
          />
          <div style={buttonRowStyle}>
            <button type="button" style={settingsButtonStyle} onClick={() => void saveSettings('save')}>
              {busy === 'save' ? (zh ? '保存中' : 'Saving') : (zh ? '保存配置' : 'Save')}
            </button>
            <button type="button" style={settingsButtonStyle} onClick={() => void saveSettings('pull')}>
              {busy === 'pull' ? (zh ? '拉取中' : 'Fetching') : (zh ? '拉取模型' : 'Pull models')}
            </button>
            <button type="button" style={successButtonStyle} onClick={() => void saveSettings('test')}>
              {busy === 'test' ? (zh ? '测试中' : 'Testing') : (zh ? '测试连接' : 'Test connection')}
            </button>
            {settings.apiKeySet && <span style={statusBadgeStyle('open')}>{zh ? 'API Key 已保存' : 'API key saved'}</span>}
          </div>

          <div style={aliasEditorStyle}>
            <input
              value={modelName}
              list="longclaw-model-options"
              placeholder={zh ? '模型名' : 'Model name'}
              style={settingsInputStyle}
              onChange={event => setModelName(event.target.value)}
            />
            <datalist id="longclaw-model-options">
              {modelOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <input
              value={alias}
              placeholder={zh ? '别名' : 'Alias'}
              style={settingsInputStyle}
              onChange={event => setAlias(event.target.value)}
            />
            <label style={thinkingToggleStyle}>
              <input
                type="checkbox"
                checked={thinking}
                onChange={event => setThinking(event.currentTarget.checked)}
              />
              <span>thinking</span>
            </label>
            <button type="button" style={iconAddButtonStyle} onClick={() => void addAlias()}>
              +
            </button>
          </div>

          {notice && <div style={noticeStyle}>{notice}</div>}
          <div style={aliasListStyle}>
            {settings.aliases.length === 0 ? (
              <div style={settingsMetaStyle}>{zh ? '尚未添加自定义模型别名' : 'No custom model aliases yet'}</div>
            ) : (
              settings.aliases.map(item => (
                <div key={item.id} style={aliasRowStyle}>
                  <div style={aliasLeadStyle}>
                    <div style={settingValueStyle}>{item.alias}</div>
                    <div style={settingsMetaStyle}>
                      {item.model}
                      {item.thinking ? ' · thinking' : ''}
                    </div>
                  </div>
                  <button type="button" style={plainActionButtonStyle} onClick={() => void removeAlias(item.id)}>
                    {zh ? '删除' : 'Remove'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section style={settingsGridStyle}>
        <div style={settingsCardStyle}>
          <h2 style={settingsTitleStyle}>{zh ? '工作目录' : 'Working directory'}</h2>
          <p style={settingsTextStyle}>
            {zh
              ? 'Agent OS 会把任务文件、运行环境和相关缓存统一存放到当前目录。'
              : 'Agent OS stores task files, runtime assets, and caches in the current directory.'}
          </p>
          <SettingRow
            label={zh ? '当前目录' : 'Current directory'}
            value={agentCwd || (zh ? '未探测' : 'Unknown')}
            note={runtimeStatus.runtimeProfile ? humanizeTokenLocale(locale, runtimeStatus.runtimeProfile) : undefined}
          />
        </div>

        <div style={settingsCardStyle}>
          <h2 style={settingsTitleStyle}>{zh ? '执行端系统版本' : 'Runtime system'}</h2>
          <div style={settingsRowsStyle}>
            <SettingRow
              label={zh ? '本机 Agent' : 'Local agent'}
              value={
                agentMode
                  ? humanizeTokenLocale(locale, agentMode.mode)
                  : humanizeTokenLocale(locale, 'unknown')
              }
              note={agentMode?.alive ? (zh ? '运行中' : 'Running') : (zh ? '未确认运行' : 'Not confirmed running')}
            />
            <SettingRow
              label={zh ? '本机执行席位' : 'Local runtime seat'}
              value={runtimeStatus.localRuntimeSeat ? humanizeTokenLocale(locale, runtimeStatus.localRuntimeSeat) : humanizeTokenLocale(locale, 'unavailable')}
              note={zh ? `偏好：${humanizeTokenLocale(locale, localSeatPreference)}` : `Preference: ${humanizeTokenLocale(locale, localSeatPreference)}`}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

export default SettingsWorkspace

function SettingRow({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div style={settingRowStyle}>
      <div style={settingLabelStyle}>{label}</div>
      <div style={settingValueStyle}>{value}</div>
      {note && <div style={settingNoteStyle}>{note}</div>}
    </div>
  )
}

const theme = {
  panel: 'var(--settings-panel)',
  panelSoft: 'var(--settings-panel-soft)',
  root: 'var(--settings-root)',
  border: 'var(--settings-border)',
  borderStrong: 'var(--settings-border-strong)',
  text: 'var(--settings-text)',
  muted: 'var(--settings-muted)',
  mutedStrong: 'var(--settings-muted-strong)',
  control: 'var(--settings-control)',
  controlText: 'var(--settings-control-text)',
  success: 'var(--settings-success)',
  successBg: 'var(--settings-success-bg)',
}

const settingsShellStyle = (backgroundMode: ShellBackgroundMode): CSSProperties => {
  const vars =
    backgroundMode === 'dark'
      ? {
          '--settings-root': '#070A0F',
          '--settings-panel': '#0D131C',
          '--settings-panel-soft': '#141D29',
          '--settings-border': 'rgba(226, 232, 240, 0.10)',
          '--settings-border-strong': 'rgba(226, 232, 240, 0.18)',
          '--settings-text': '#F4F7FB',
          '--settings-muted': '#8F9BAD',
          '--settings-muted-strong': '#B5C0CF',
          '--settings-control': '#151F2D',
          '--settings-control-text': '#E7ECF3',
          '--settings-success': '#7CE3A2',
          '--settings-success-bg': 'rgba(124, 227, 162, 0.12)',
        }
      : {
          '--settings-root': '#F6F7F9',
          '--settings-panel': '#FFFFFF',
          '--settings-panel-soft': '#F4F5F7',
          '--settings-border': '#E0E3E8',
          '--settings-border-strong': '#CBD1DA',
          '--settings-text': '#20242A',
          '--settings-muted': '#747B86',
          '--settings-muted-strong': '#555E6A',
          '--settings-control': '#F2F3F5',
          '--settings-control-text': '#374151',
          '--settings-success': '#14804A',
          '--settings-success-bg': '#E7F7ED',
        }
  return {
    ...vars,
    display: 'flex',
    flexDirection: 'column',
    gap: backgroundMode === 'dark' ? 16 : 14,
    color: theme.text,
    fontFamily: fontStacks.ui,
    background: theme.root,
  } as CSSProperties
}

const settingsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 14,
}

const settingsCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  background: theme.panel,
  padding: 16,
}

const settingsCardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
}

const cardTitleBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
}

const settingsIconTitleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: theme.text,
}

const settingsTitleStyle: CSSProperties = {
  margin: 0,
  color: theme.text,
  fontSize: 18,
  fontWeight: 850,
  lineHeight: 1.2,
}

const settingsTextStyle: CSSProperties = {
  margin: 0,
  color: theme.muted,
  fontSize: 13,
  lineHeight: 1.55,
}

const settingsMetaStyle: CSSProperties = {
  color: theme.muted,
  fontSize: 12,
  lineHeight: 1.4,
}

const settingsRowsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const modelFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const settingsInputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 6,
  border: `1px solid ${theme.borderStrong}`,
  background: theme.panel,
  color: theme.text,
  padding: '0 10px',
  fontFamily: fontStacks.ui,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const settingsButtonStyle: CSSProperties = {
  height: 32,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  background: theme.control,
  color: theme.controlText,
  padding: '0 11px',
  fontFamily: fontStacks.ui,
  fontSize: 13,
  fontWeight: 750,
  cursor: 'pointer',
}

const successButtonStyle: CSSProperties = {
  ...settingsButtonStyle,
  background: theme.successBg,
  color: theme.success,
}

const aliasEditorStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto 34px',
  gap: 8,
  alignItems: 'center',
  borderTop: `1px solid ${theme.border}`,
  paddingTop: 10,
}

const thinkingToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: theme.mutedStrong,
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const iconAddButtonStyle: CSSProperties = {
  ...settingsButtonStyle,
  width: 34,
  padding: 0,
  fontSize: 18,
}

const noticeStyle: CSSProperties = {
  color: theme.mutedStrong,
  fontSize: 12,
  lineHeight: 1.45,
}

const aliasListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const aliasRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  borderRadius: 6,
  background: theme.panelSoft,
  padding: '9px 10px',
}

const aliasLeadStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
}

const plainActionButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: theme.mutedStrong,
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
  fontSize: 12,
  fontWeight: 750,
}

const switchShellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
}

const hiddenCheckboxStyle: CSSProperties = {
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
}

const switchTrackStyle = (active: boolean): CSSProperties => ({
  width: 34,
  height: 20,
  borderRadius: 999,
  background: active ? theme.successBg : theme.control,
  border: `1px solid ${active ? theme.success : theme.borderStrong}`,
  display: 'flex',
  alignItems: 'center',
  padding: 2,
  boxSizing: 'border-box',
})

const switchThumbStyle = (active: boolean): CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: 999,
  background: active ? theme.success : theme.muted,
  transform: active ? 'translateX(14px)' : 'translateX(0)',
  transition: 'transform 160ms ease-out',
})

const settingRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '150px minmax(0, 1fr)',
  gap: '4px 12px',
  borderRadius: 6,
  background: theme.panelSoft,
  padding: '10px 12px',
}

const settingLabelStyle: CSSProperties = {
  color: theme.muted,
  fontSize: 12,
  fontWeight: 750,
}

const settingValueStyle: CSSProperties = {
  color: theme.text,
  fontSize: 13,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const settingNoteStyle: CSSProperties = {
  gridColumn: '2 / -1',
  color: theme.muted,
  fontSize: 12,
  lineHeight: 1.45,
}
