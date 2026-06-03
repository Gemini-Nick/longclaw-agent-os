import type { CSSProperties } from 'react'

import { fontStacks, motion, palette, tradingDeskTheme } from './designSystem.js'

export type ViewportTier = 'wide' | 'mid' | 'narrow'
export type ShellBackgroundMode = 'light' | 'dark'

export function getViewportTier(width: number): ViewportTier {
  if (width >= 1360) return 'wide'
  if (width >= 1080) return 'mid'
  return 'narrow'
}

export function createShellLayout(
  width: number,
  tier: ViewportTier,
  threadSidebarOpen: boolean,
  detailOpen: boolean,
  backgroundMode: ShellBackgroundMode = 'dark',
): {
  app: CSSProperties
  rail: CSSProperties
  threadSidebar: CSSProperties
  content: CSSProperties
  mainWorkspace: CSSProperties
  detailPane: CSSProperties
  threadBackdrop: CSSProperties | null
  detailBackdrop: CSSProperties | null
  overlayThreadSidebar: boolean
  overlayDetail: boolean
} {
  const overlayDetail = true
  const overlayThreadSidebar = tier === 'narrow'
  const railWidth = tier === 'narrow' ? 58 : 64
  const lightMode = backgroundMode === 'light'
  const threadSidebarWidth = tier === 'narrow' ? Math.min(320, Math.max(280, width - 88)) : tier === 'mid' ? 258 : 286
  const detailWidth = Math.min(
    tier === 'narrow' ? 360 : 430,
    Math.max(330, width - railWidth - (overlayThreadSidebar ? 0 : threadSidebarWidth) - 28),
  )

  return {
    overlayDetail,
    overlayThreadSidebar,
    app: {
      display: 'flex',
      height: '100vh',
      background: lightMode
        ? 'linear-gradient(180deg, #FAFBFC 0%, #F2F4F7 100%)'
        : tradingDeskTheme.gradients.app,
      color: lightMode ? '#20242A' : palette.ink,
      fontFamily: fontStacks.ui,
      overflow: 'hidden',
      position: 'relative',
    },
    rail: {
      width: railWidth,
      flexShrink: 0,
      padding: tier === 'narrow' ? '8px 6px' : '9px 7px',
      borderRight: lightMode
        ? '1px solid rgba(17, 24, 39, 0.10)'
        : '1px solid rgba(255, 255, 255, 0.10)',
      background: lightMode
        ? 'linear-gradient(180deg, #F5F6F8 0%, #ECEFF3 100%)'
        : 'linear-gradient(180deg, #090D14 0%, #0F1620 100%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 0,
      overflow: 'visible',
      position: 'relative',
      zIndex: 24,
    },
    threadSidebar: overlayThreadSidebar
      ? {
          position: 'absolute',
          top: 0,
          left: railWidth,
          bottom: 0,
          width: threadSidebarWidth,
          maxWidth: '86vw',
          borderRight: `1px solid ${palette.border}`,
          background: palette.panel,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          transform: threadSidebarOpen ? 'translateX(0)' : 'translateX(-104%)',
          transition: `transform ${motion.medium}`,
          zIndex: 16,
          boxShadow: tradingDeskTheme.shadows.panel,
        }
      : {
          width: threadSidebarWidth,
          flexShrink: 0,
          borderRight: `1px solid ${palette.border}`,
          background: palette.panel,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
        },
    content: {
      flex: 1,
      display: 'flex',
      minWidth: 0,
      minHeight: 0,
      position: 'relative',
      overflow: 'hidden',
    },
    mainWorkspace: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    detailPane: overlayDetail
      ? {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: detailWidth,
          maxWidth: '92vw',
          borderLeft: `1px solid ${palette.border}`,
          background: palette.panelRaised,
          padding: tier === 'narrow' ? 18 : 22,
          overflowY: 'auto',
          overflowX: 'hidden',
          transform: detailOpen ? 'translateX(0)' : 'translateX(102%)',
          transition: `transform ${motion.medium}`,
          boxShadow: tradingDeskTheme.shadows.panel,
          zIndex: 18,
        }
      : {
          width: detailWidth,
          flexShrink: 0,
          borderLeft: `1px solid ${palette.border}`,
          background: palette.panelRaised,
          padding: 22,
          overflowY: 'auto',
          overflowX: 'hidden',
        },
    threadBackdrop:
      overlayThreadSidebar && threadSidebarOpen
        ? {
            position: 'absolute',
            top: 0,
            left: railWidth,
            right: 0,
            bottom: 0,
            background: palette.surfaceOverlay,
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            zIndex: 14,
          }
        : null,
    detailBackdrop:
      overlayDetail && detailOpen
        ? {
          position: 'absolute',
          inset: 0,
            background: palette.surfaceOverlay,
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            zIndex: 12,
          }
        : null,
  }
}
