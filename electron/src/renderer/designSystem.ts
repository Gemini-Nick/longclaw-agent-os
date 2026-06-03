import type { CSSProperties } from 'react'

export const fontStacks = {
  display:
    '"Instrument Sans", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  ui: '"Instrument Sans", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  mono:
    '"Departure Mono", "DepartureMono", "IBM Plex Mono", "SFMono-Regular", "Menlo", "Consolas", monospace',
} as const

type ThemeVariableMap = CSSProperties & Record<string, string>

const themeVar = (name: string, fallback: string) => `var(--lc-${name}, ${fallback})`

export const tradingDeskTheme = {
  name: 'aurora-native-trading-desk',
  colors: {
    root: themeVar('root', '#080B12'),
    rootElevated: themeVar('root-elevated', '#0B1118'),
    surface: themeVar('surface', '#0B1118'),
    surfaceSoft: themeVar('surface-soft', '#111827'),
    panel: themeVar('panel', '#0F1620'),
    panelSoft: themeVar('panel-soft', '#121B27'),
    panelRaised: themeVar('panel-raised', '#151F2D'),
    panelInset: themeVar('panel-inset', '#101926'),
    control: themeVar('control', '#111A25'),
    grid: themeVar('grid', '#1C2633'),
    empty: themeVar('empty', '#0E1722'),
    chartPanel: themeVar('chart-panel', '#131722'),
    chartBorder: themeVar('chart-border', '#202A38'),
    border: themeVar('border', '#222D3B'),
    borderStrong: themeVar('border-strong', '#263244'),
    borderMuted: themeVar('border-muted', '#2A3748'),
    text: themeVar('text', '#D7DEE8'),
    textStrong: themeVar('text-strong', '#F2F6FB'),
    textMuted: themeVar('text-muted', '#7F8EA3'),
    muted: themeVar('muted', '#7F8EA3'),
    mutedStrong: themeVar('muted-strong', '#8EA0B8'),
    mono: themeVar('mono', '#9CB1CE'),
    controlText: themeVar('control-text', '#B7C2D0'),
    inspectText: themeVar('inspect-text', '#F6EFE4'),
    white: '#FFFFFF',
    accent: themeVar('accent', '#D08A54'),
    accentText: themeVar('accent-text', '#FFD0A8'),
    accentSoft: themeVar('accent-soft', 'rgba(208, 138, 84, 0.18)'),
    auroraBlue: '#2F8CFF',
    auroraViolet: '#8B6DFF',
    auroraGold: '#FFB86B',
    infoText: themeVar('info-text', '#BFD9F5'),
    errorText: themeVar('error-text', '#FFB4BD'),
    crosshair: themeVar('crosshair', '#2A2E39'),
  },
  alpha: {
    textHairline: themeVar('alpha-text-hairline', 'rgba(215, 222, 232, 0.06)'),
    textBorder: themeVar('alpha-text-border', 'rgba(215, 222, 232, 0.12)'),
    textBorderStrong: themeVar('alpha-text-border-strong', 'rgba(215, 222, 232, 0.22)'),
    panelWash: themeVar('alpha-panel-wash', 'rgba(215, 222, 232, 0.055)'),
    panelWashStrong: themeVar('alpha-panel-wash-strong', 'rgba(215, 222, 232, 0.11)'),
    auroraBlue: 'rgba(47, 140, 255, 0.18)',
    auroraViolet: 'rgba(139, 109, 255, 0.18)',
    auroraGold: 'rgba(255, 184, 107, 0.18)',
    accentBorder: themeVar('alpha-accent-border', 'rgba(208, 138, 84, 0.38)'),
    accentSurface: themeVar('alpha-accent-surface', 'rgba(208, 138, 84, 0.16)'),
    infoBorder: themeVar('alpha-info-border', 'rgba(70, 132, 194, 0.35)'),
    infoSurface: themeVar('alpha-info-surface', 'rgba(43, 91, 137, 0.16)'),
    errorBorder: themeVar('alpha-error-border', 'rgba(242, 54, 69, 0.38)'),
    errorSurface: themeVar('alpha-error-surface', 'rgba(242, 54, 69, 0.14)'),
    overlay: themeVar('alpha-overlay', 'rgba(2, 5, 10, 0.64)'),
  },
  gradients: {
    app:
      'linear-gradient(180deg, #080B12 0%, #0B1118 52%, #0A0F16 100%)',
    rail:
      'linear-gradient(180deg, #05070B 0%, #0B1118 48%, #111827 100%)',
    island:
      'linear-gradient(145deg, rgba(215, 222, 232, 0.18), rgba(208, 138, 84, 0.18) 44%, rgba(47, 140, 255, 0.12))',
    header:
      'linear-gradient(135deg, rgba(21, 31, 45, 0.94), rgba(15, 22, 32, 0.84))',
    auroraLine:
      'linear-gradient(90deg, rgba(47, 140, 255, 0.0), rgba(47, 140, 255, 0.72), rgba(255, 184, 107, 0.72), rgba(139, 109, 255, 0.0))',
  },
  radius: {
    compact: 5,
    control: 8,
    panel: 8,
    island: 16,
    pill: 999,
  },
  shadows: {
    panel: '0 10px 24px rgba(0, 0, 0, 0.22)',
    island:
      '0 18px 46px rgba(0, 0, 0, 0.34), inset 0 1px rgba(255, 255, 255, 0.12)',
    glow: '0 0 0 1px rgba(208, 138, 84, 0.18), 0 18px 48px rgba(47, 140, 255, 0.12)',
  },
  market: {
    up: '#F23645',
    down: '#26A69A',
    flat: '#787B86',
  },
  chart: {
    axis: '#787B86',
    line: '#2F8CFF',
    orange: '#F7931A',
    violet: '#E040FB',
    purple: '#9C27B0',
    gold: '#FF9800',
    separator: 'rgba(120, 123, 134, 0.25)',
    gridHorizontal: 'rgba(120, 123, 134, 0.18)',
    gridVertical: 'rgba(120, 123, 134, 0.12)',
  },
} as const

export const palette = {
  paper: tradingDeskTheme.colors.root,
  stone: tradingDeskTheme.colors.rootElevated,
  surface: tradingDeskTheme.colors.surface,
  panel: tradingDeskTheme.colors.panel,
  panelRaised: tradingDeskTheme.colors.panelRaised,
  ink: tradingDeskTheme.colors.textStrong,
  slate: '#05070B',
  slateSoft: tradingDeskTheme.colors.rootElevated,
  copper: tradingDeskTheme.colors.accent,
  teal: '#4FBFCB',
  success: themeVar('success-text', '#59D98E'),
  warning: themeVar('warning-text', '#F2B85B'),
  error: themeVar('error-text', '#FF5D6C'),
  info: themeVar('info-text', '#BFD9F5'),
  border: tradingDeskTheme.alpha.textBorder,
  borderStrong: tradingDeskTheme.alpha.textBorderStrong,
  surfaceOverlay: tradingDeskTheme.alpha.overlay,
  textMuted: tradingDeskTheme.colors.muted,
  textSoft: tradingDeskTheme.colors.mono,
  inspect: tradingDeskTheme.colors.root,
  inspectSoft: tradingDeskTheme.colors.panel,
  inspectText: tradingDeskTheme.colors.inspectText,
} as const

export type ChartColorTokens = {
  chartBg: string
  chartPanel: string
  panelSoft: string
  chartBorder: string
  gridMajor: string
  gridMinor: string
  axis: string
  axisStrong: string
  crosshair: string
  textStrong: string
  text: string
  textMuted: string
  textFaint: string
  marketUp: string
  marketDown: string
  marketFlat: string
  volumeUp: string
  volumeDown: string
  volumeNeutral: string
  ma: readonly string[]
  macdDif: string
  macdDea: string
  macdHistUp: string
  macdHistDown: string
  macdZero: string
  semanticSuccess: string
  semanticDanger: string
  semanticWarning: string
  semanticInfo: string
  tooltipBg: string
  signalCalloutBg: string
  signalCalloutSelectedBg: string
  signalCalloutText: string
  signalCalloutMuted: string
}

const chartColorTokenMap = {
  dark: {
    chartBg: '#101720',
    chartPanel: '#111923',
    panelSoft: '#202838',
    chartBorder: '#2A3444',
    gridMajor: 'rgba(122, 138, 160, 0.18)',
    gridMinor: 'rgba(122, 138, 160, 0.11)',
    axis: '#93A1B5',
    axisStrong: '#B8C3D2',
    crosshair: '#7A8AA0',
    textStrong: '#F4F7FB',
    text: '#D9E2EC',
    textMuted: '#A5B1C2',
    textFaint: '#7E8DA3',
    marketUp: '#FF4D5E',
    marketDown: '#22B8A8',
    marketFlat: '#7F8A99',
    volumeUp: '#A94A55',
    volumeDown: '#2D8F86',
    volumeNeutral: '#687487',
    ma: ['#F59E0B', '#3B82F6', '#A78BFA', '#22D3EE', '#94A3B8', '#F97316'],
    macdDif: '#60A5FA',
    macdDea: '#F59E0B',
    macdHistUp: '#FF4D5E',
    macdHistDown: '#22B8A8',
    macdZero: '#6B7280',
    semanticSuccess: '#34D399',
    semanticDanger: '#FB7185',
    semanticWarning: '#FBBF24',
    semanticInfo: '#60A5FA',
    tooltipBg: 'rgba(15, 22, 32, 0.95)',
    signalCalloutBg: 'rgba(15, 23, 42, 0.94)',
    signalCalloutSelectedBg: 'rgba(15, 23, 42, 0.98)',
    signalCalloutText: '#F4F7FB',
    signalCalloutMuted: '#A5B1C2',
  },
  light: {
    chartBg: '#F8FAFC',
    chartPanel: '#FFFFFF',
    panelSoft: '#E8EEF5',
    chartBorder: '#CBD5E1',
    gridMajor: 'rgba(100, 116, 139, 0.18)',
    gridMinor: 'rgba(100, 116, 139, 0.10)',
    axis: '#64748B',
    axisStrong: '#334155',
    crosshair: '#475569',
    textStrong: '#0F172A',
    text: '#27364A',
    textMuted: '#526276',
    textFaint: '#6B7A90',
    marketUp: '#D92D20',
    marketDown: '#087443',
    marketFlat: '#64748B',
    volumeUp: '#E07A84',
    volumeDown: '#42A89B',
    volumeNeutral: '#8290A3',
    ma: ['#B45309', '#2563EB', '#9333EA', '#0891B2', '#64748B', '#C2410C'],
    macdDif: '#1D4ED8',
    macdDea: '#B45309',
    macdHistUp: '#D92D20',
    macdHistDown: '#087443',
    macdZero: '#94A3B8',
    semanticSuccess: '#047857',
    semanticDanger: '#DC2626',
    semanticWarning: '#B45309',
    semanticInfo: '#2563EB',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    signalCalloutBg: 'rgba(255, 255, 255, 0.96)',
    signalCalloutSelectedBg: 'rgba(248, 250, 252, 0.98)',
    signalCalloutText: '#0F172A',
    signalCalloutMuted: '#526276',
  },
} as const satisfies Record<'light' | 'dark', ChartColorTokens>

export function chartColorTokens(mode: 'light' | 'dark'): ChartColorTokens {
  return chartColorTokenMap[mode]
}

export function designThemeVariables(mode: 'light' | 'dark'): ThemeVariableMap {
  if (mode === 'light') {
    return {
      '--lc-root': '#F3F6FA',
      '--lc-root-elevated': '#FFFFFF',
      '--lc-surface': '#FFFFFF',
      '--lc-surface-soft': '#F6F8FB',
      '--lc-panel': '#FFFFFF',
      '--lc-panel-soft': '#F4F7FA',
      '--lc-panel-raised': '#FFFFFF',
      '--lc-panel-inset': '#F8FAFD',
      '--lc-control': '#EEF3F8',
      '--lc-grid': '#DDE4EE',
      '--lc-empty': '#FFFFFF',
      '--lc-chart-panel': '#FBFCFF',
      '--lc-chart-border': '#C9D3E1',
      '--lc-border': '#E2E8F0',
      '--lc-border-strong': '#C8D2DF',
      '--lc-border-muted': '#EEF2F7',
      '--lc-text': '#2F3B4A',
      '--lc-text-strong': '#142033',
      '--lc-text-muted': '#667586',
      '--lc-muted': '#667586',
      '--lc-muted-strong': '#465568',
      '--lc-mono': '#5E6D80',
      '--lc-control-text': '#243247',
      '--lc-inspect-text': '#142033',
      '--lc-accent': '#B55F22',
      '--lc-accent-text': '#8A3D10',
      '--lc-accent-soft': 'rgba(181, 95, 34, 0.11)',
      '--lc-info-text': '#1E5B91',
      '--lc-error-text': '#B42318',
      '--lc-success-text': '#0F7A55',
      '--lc-warning-text': '#B76B00',
      '--lc-crosshair': '#506176',
      '--lc-alpha-text-hairline': 'rgba(20, 32, 51, 0.055)',
      '--lc-alpha-text-border': 'rgba(20, 32, 51, 0.105)',
      '--lc-alpha-text-border-strong': 'rgba(20, 32, 51, 0.20)',
      '--lc-alpha-panel-wash': 'rgba(20, 32, 51, 0.04)',
      '--lc-alpha-panel-wash-strong': 'rgba(20, 32, 51, 0.085)',
      '--lc-alpha-accent-border': 'rgba(181, 95, 34, 0.30)',
      '--lc-alpha-accent-surface': 'rgba(181, 95, 34, 0.095)',
      '--lc-alpha-info-border': 'rgba(30, 91, 145, 0.26)',
      '--lc-alpha-info-surface': 'rgba(30, 91, 145, 0.085)',
      '--lc-alpha-error-border': 'rgba(180, 35, 24, 0.28)',
      '--lc-alpha-error-surface': 'rgba(180, 35, 24, 0.08)',
      '--lc-alpha-overlay': 'rgba(20, 32, 51, 0.20)',
    }
  }

  return {
    '--lc-root': '#080B12',
    '--lc-root-elevated': '#0B1118',
    '--lc-surface': '#0B1118',
    '--lc-surface-soft': '#111827',
    '--lc-panel': '#0F1620',
    '--lc-panel-soft': '#121B27',
    '--lc-panel-raised': '#151F2D',
    '--lc-panel-inset': '#101926',
    '--lc-control': '#111A25',
    '--lc-grid': '#1C2633',
    '--lc-empty': '#0E1722',
    '--lc-chart-panel': '#131722',
    '--lc-chart-border': '#202A38',
    '--lc-border': '#222D3B',
    '--lc-border-strong': '#263244',
    '--lc-border-muted': '#2A3748',
    '--lc-text': '#D7DEE8',
    '--lc-text-strong': '#F2F6FB',
    '--lc-text-muted': '#7F8EA3',
    '--lc-muted': '#7F8EA3',
    '--lc-muted-strong': '#8EA0B8',
    '--lc-mono': '#9CB1CE',
    '--lc-control-text': '#B7C2D0',
    '--lc-inspect-text': '#F6EFE4',
    '--lc-accent': '#D08A54',
    '--lc-accent-text': '#FFD0A8',
    '--lc-accent-soft': 'rgba(208, 138, 84, 0.18)',
    '--lc-info-text': '#BFD9F5',
    '--lc-error-text': '#FFB4BD',
    '--lc-success-text': '#59D98E',
    '--lc-warning-text': '#F2B85B',
    '--lc-crosshair': '#2A2E39',
    '--lc-alpha-text-hairline': 'rgba(215, 222, 232, 0.06)',
    '--lc-alpha-text-border': 'rgba(215, 222, 232, 0.12)',
    '--lc-alpha-text-border-strong': 'rgba(215, 222, 232, 0.22)',
    '--lc-alpha-panel-wash': 'rgba(215, 222, 232, 0.055)',
    '--lc-alpha-panel-wash-strong': 'rgba(215, 222, 232, 0.11)',
    '--lc-alpha-accent-border': 'rgba(208, 138, 84, 0.38)',
    '--lc-alpha-accent-surface': 'rgba(208, 138, 84, 0.16)',
    '--lc-alpha-info-border': 'rgba(70, 132, 194, 0.35)',
    '--lc-alpha-info-surface': 'rgba(43, 91, 137, 0.16)',
    '--lc-alpha-error-border': 'rgba(242, 54, 69, 0.38)',
    '--lc-alpha-error-surface': 'rgba(242, 54, 69, 0.14)',
    '--lc-alpha-overlay': 'rgba(2, 5, 10, 0.64)',
  }
}

export function designThemeColor(
  mode: 'light' | 'dark',
  name: string,
  fallback: string,
): string {
  return designThemeVariables(mode)[`--lc-${name}`] ?? fallback
}

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const

export const motion = {
  micro: '120ms cubic-bezier(0.2, 0, 0.2, 1)',
  short: '170ms cubic-bezier(0.2, 0, 0.2, 1)',
  medium: '240ms cubic-bezier(0.2, 0, 0.2, 1)',
} as const

export const interaction = {
  focusRing: `0 0 0 2px ${tradingDeskTheme.colors.root}, 0 0 0 4px rgba(255, 184, 107, 0.7)`,
  hoverLift: 'translateY(-1px)',
  press: 'translateY(0)',
  transition:
    `background ${motion.micro}, border-color ${motion.micro}, color ${motion.micro}, box-shadow ${motion.micro}, transform ${motion.micro}, opacity ${motion.micro}`,
  touchAction: 'manipulation',
} as const

export function humanizeToken(value?: string | null): string {
  if (!value) return 'Unknown'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function statusPalette(status: string) {
  const normalized = String(status).toLowerCase()
  if (
    ['failed', 'repair_required', 'critical', 'delivery_failed', 'rejected'].includes(
      normalized,
    )
  ) {
    return {
      background: tradingDeskTheme.alpha.errorSurface,
      border: tradingDeskTheme.alpha.errorBorder,
      color: palette.error,
    }
  }
  if (
    ['partial', 'warning', 'needs_review', 'needs retry', 'needs_retry', 'degraded'].includes(
      normalized,
    )
  ) {
    return {
      background: tradingDeskTheme.alpha.accentSurface,
      border: tradingDeskTheme.alpha.accentBorder,
      color: palette.warning,
    }
  }
  if (['succeeded', 'ok', 'approved', 'reviewed_insight', 'success'].includes(normalized)) {
    return {
      background: 'rgba(89, 217, 142, 0.12)',
      border: 'rgba(89, 217, 142, 0.28)',
      color: palette.success,
    }
  }
  if (['running', 'active', 'open', 'info'].includes(normalized)) {
    return {
      background: tradingDeskTheme.alpha.auroraBlue,
      border: 'rgba(47, 140, 255, 0.32)',
      color: palette.teal,
    }
  }
  return {
    background: tradingDeskTheme.alpha.panelWashStrong,
    border: tradingDeskTheme.alpha.textBorder,
    color: palette.info,
  }
}

export function statusBadgeStyle(status: string): CSSProperties {
  const tone = statusPalette(status)
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    padding: '5px 10px',
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  }
}

export function navButtonStyle(active = false): CSSProperties {
  return {
    width: '100%',
    borderRadius: tradingDeskTheme.radius.panel,
    border: `1px solid ${active ? tradingDeskTheme.alpha.textBorderStrong : 'transparent'}`,
    background: active ? tradingDeskTheme.alpha.panelWashStrong : 'transparent',
    color: active ? palette.ink : palette.textMuted,
    padding: '11px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: interaction.transition,
    fontFamily: fontStacks.ui,
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    touchAction: interaction.touchAction,
  }
}

export function segmentedButtonStyle(active = false): CSSProperties {
  return {
    borderRadius: radii.pill,
    border: `1px solid ${active ? palette.copper : palette.borderStrong}`,
    background: active ? tradingDeskTheme.colors.accentSoft : palette.panelRaised,
    color: active ? tradingDeskTheme.colors.accentText : palette.textMuted,
    padding: '8px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: interaction.transition,
    fontFamily: fontStacks.ui,
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    touchAction: interaction.touchAction,
  }
}

export const primaryButtonStyle: CSSProperties = {
  border: `1px solid ${palette.copper}`,
  borderRadius: tradingDeskTheme.radius.pill,
  padding: '10px 14px',
  background: palette.copper,
  color: '#14100D',
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
  fontSize: 13,
  fontWeight: 700,
  boxShadow: tradingDeskTheme.shadows.glow,
  transition: interaction.transition,
  touchAction: interaction.touchAction,
}

export const secondaryButtonStyle: CSSProperties = {
  border: `1px solid ${palette.borderStrong}`,
  borderRadius: tradingDeskTheme.radius.pill,
  padding: '8px 12px',
  background: tradingDeskTheme.colors.control,
  color: palette.ink,
  cursor: 'pointer',
  fontFamily: fontStacks.ui,
  fontSize: 13,
  fontWeight: 650,
  transition: interaction.transition,
  touchAction: interaction.touchAction,
}

export type ButtonTone = 'primary' | 'secondary'

export function buttonStyleForState(
  base: CSSProperties,
  disabled = false,
  tone: ButtonTone = 'secondary',
): CSSProperties {
  if (!disabled) return base

  if (tone === 'primary') {
    return {
      ...base,
      border: `1px solid ${palette.borderStrong}`,
      background: palette.stone,
      color: palette.textMuted,
      cursor: 'not-allowed',
      boxShadow: 'none',
      opacity: 1,
    }
  }

  return {
    ...base,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    color: palette.textSoft,
    cursor: 'not-allowed',
    boxShadow: 'none',
    opacity: 1,
  }
}

export const chromeStyles = {
  brand: {
    fontFamily: fontStacks.display,
    fontSize: 24,
    lineHeight: 1.05,
    fontWeight: 600,
    color: palette.paper,
    letterSpacing: 0,
  } satisfies CSSProperties,
  eyebrow: {
    fontFamily: fontStacks.mono,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'uppercase',
    color: 'rgba(247, 242, 232, 0.56)',
  } satisfies CSSProperties,
  eyebrowLight: {
    fontFamily: fontStacks.mono,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'uppercase',
    color: palette.textMuted,
  } satisfies CSSProperties,
  headerTitle: {
    margin: 0,
    fontFamily: fontStacks.display,
    fontSize: 30,
    lineHeight: 1.05,
    fontWeight: 800,
    color: palette.ink,
    letterSpacing: 0,
  } satisfies CSSProperties,
  sectionTitle: {
    margin: 0,
    fontFamily: fontStacks.display,
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 800,
    color: palette.ink,
    letterSpacing: 0,
  } satisfies CSSProperties,
  subtleText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  quietMeta: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 1.4,
    fontFamily: fontStacks.ui,
  } satisfies CSSProperties,
  monoMeta: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 1.45,
    fontFamily: fontStacks.mono,
    fontVariantNumeric: 'tabular-nums',
  } satisfies CSSProperties,
} as const

export const surfaceStyles = {
  section: {
    background: palette.panelRaised,
    border: `1px solid ${palette.border}`,
    borderRadius: radii.md,
    padding: '10px',
    boxShadow: 'none',
  } satisfies CSSProperties,
  mutedSection: {
    background: palette.panel,
    border: `1px solid ${palette.border}`,
    borderRadius: radii.lg,
    padding: spacing.md,
  } satisfies CSSProperties,
  listRow: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: radii.sm,
    background: palette.panel,
    border: `1px solid ${palette.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    textAlign: 'left',
    color: palette.ink,
  } satisfies CSSProperties,
  listRowInteractive: {
    cursor: 'pointer',
    transition: `transform ${motion.micro}, border-color ${motion.micro}, background ${motion.micro}`,
  } satisfies CSSProperties,
  strip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
    gap: spacing.xs,
  } satisfies CSSProperties,
  stripItem: {
    background: palette.stone,
    borderRadius: radii.sm,
    border: `1px solid ${palette.border}`,
    padding: '7px 9px',
  } satisfies CSSProperties,
  drawerPre: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    background: palette.inspect,
    color: palette.inspectText,
    overflow: 'auto',
    maxWidth: '100%',
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: fontStacks.mono,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  } satisfies CSSProperties,
  inspectPanel: {
    background: palette.inspectSoft,
    color: palette.inspectText,
    borderRadius: radii.md,
    border: '1px solid rgba(247, 242, 232, 0.08)',
    padding: spacing.sm,
  } satisfies CSSProperties,
} as const

export const utilityStyles = {
  stackedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  } satisfies CSSProperties,
  splitMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
  } satisfies CSSProperties,
  buttonCluster: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
  } satisfies CSSProperties,
  emptyState: {
    padding: spacing.md,
    borderRadius: radii.md,
    background: palette.panel,
    border: `1px dashed ${palette.borderStrong}`,
    color: palette.textMuted,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  errorBanner: {
    padding: '10px 14px',
    borderRadius: radii.md,
    background: 'rgba(200, 79, 68, 0.12)',
    color: palette.error,
    border: '1px solid rgba(200, 79, 68, 0.18)',
  } satisfies CSSProperties,
  noticeBanner: {
    padding: '10px 14px',
    borderRadius: radii.md,
    background: 'rgba(44, 122, 120, 0.12)',
    color: palette.teal,
    border: '1px solid rgba(44, 122, 120, 0.18)',
  } satisfies CSSProperties,
  warningBanner: {
    padding: '8px 10px',
    borderRadius: radii.sm,
    background: 'rgba(199, 146, 47, 0.14)',
    color: palette.warning,
    border: '1px solid rgba(199, 146, 47, 0.22)',
    lineHeight: 1.35,
  } satisfies CSSProperties,
  select: {
    borderRadius: radii.pill,
    padding: '8px 12px',
    border: `1px solid ${palette.borderStrong}`,
    background: palette.panelRaised,
    color: palette.ink,
    fontFamily: fontStacks.ui,
    fontSize: 13,
  } satisfies CSSProperties,
} as const
