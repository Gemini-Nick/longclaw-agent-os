import type { CSSProperties } from 'react'

import { fontStacks, motion, palette } from './designSystem.js'

export type ViewportTier = 'wide' | 'mid' | 'narrow'

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
  const overlayDetail = tier !== 'wide'
  const overlayThreadSidebar = tier === 'narrow'
  const railWidth = tier === 'narrow' ? 72 : 78
  const threadSidebarWidth = tier === 'narrow' ? Math.min(320, Math.max(280, width - 88)) : 304
  const detailWidth =
    tier === 'wide'
      ? 400
      : Math.min(420, Math.max(340, width - railWidth - (overlayThreadSidebar ? 0 : threadSidebarWidth) - 32))

  return {
    overlayDetail,
    overlayThreadSidebar,
    app: {
      display: 'flex',
      height: '100vh',
      background: `linear-gradient(180deg, ${palette.paper} 0%, ${palette.stone} 100%)`,
      color: palette.ink,
      fontFamily: fontStacks.ui,
      overflow: 'hidden',
      position: 'relative',
    },
    rail: {
      width: railWidth,
      flexShrink: 0,
      padding: tier === 'narrow' ? 14 : 16,
      borderRight: '1px solid rgba(247, 242, 232, 0.06)',
      background: `linear-gradient(180deg, ${palette.slate} 0%, ${palette.slateSoft} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minHeight: 0,
      overflowY: 'auto',
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
          boxShadow: '0 16px 40px rgba(23, 26, 31, 0.18)',
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
          overflow: 'auto',
          transform: detailOpen ? 'translateX(0)' : 'translateX(102%)',
          transition: `transform ${motion.medium}`,
          boxShadow: '0 16px 40px rgba(23, 26, 31, 0.22)',
          zIndex: 18,
        }
      : {
          width: detailWidth,
          flexShrink: 0,
          borderLeft: `1px solid ${palette.border}`,
          background: palette.panelRaised,
          padding: 22,
          overflow: 'auto',
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
