import React from 'react'
import type { CSSProperties } from 'react'

export type VectorIconName =
  | 'activity'
  | 'agent'
  | 'backtest'
  | 'channel'
  | 'chat'
  | 'code'
  | 'data'
  | 'document'
  | 'execution'
  | 'factory'
  | 'feishu'
  | 'group'
  | 'link'
  | 'longclaw'
  | 'moon'
  | 'send'
  | 'settings'
  | 'spark'
  | 'strategy'
  | 'sun'
  | 'terminal'
  | 'wechat'
  | 'wecom'

export function VectorIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
  style,
}: {
  name: VectorIconName
  size?: number
  strokeWidth?: number
  style?: CSSProperties
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={{ display: 'block', ...style }}
    >
      {iconPath(name)}
    </svg>
  )
}

function iconPath(name: VectorIconName): React.ReactNode {
  switch (name) {
    case 'activity':
      return <path d="M3 12h4l2-6 4 12 2-6h6" />
    case 'agent':
      return (
        <>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 20c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2" />
          <path d="M8 4.5 6.5 3M16 4.5 17.5 3" />
        </>
      )
    case 'backtest':
      return (
        <>
          <path d="M7 7h10v10H7z" />
          <path d="M4 12h3M17 12h3M12 4v3M12 17v3" />
          <path d="m9.5 13 2-2 1.8 1.8 2.2-3" />
        </>
      )
    case 'channel':
      return (
        <>
          <path d="M5 7.5h6.5M5 12h10M5 16.5h6.5" />
          <path d="m16.5 8 3.5 4-3.5 4" />
        </>
      )
    case 'chat':
      return <path d="M5 6.5h14v9H9l-4 3.2z" />
    case 'code':
      return (
        <>
          <path d="m9 8-4 4 4 4" />
          <path d="m15 8 4 4-4 4" />
          <path d="m13 6-2 12" />
        </>
      )
    case 'data':
      return (
        <>
          <ellipse cx="12" cy="6" rx="6" ry="2.5" />
          <path d="M6 6v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6" />
          <path d="M6 12v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-6" />
        </>
      )
    case 'document':
      return (
        <>
          <path d="M7 3.5h7l3 3V20H7z" />
          <path d="M14 3.5V7h3" />
          <path d="M9.5 11h5M9.5 14h5M9.5 17h3" />
        </>
      )
    case 'execution':
      return (
        <>
          <path d="M5 5.5h14v13H5z" />
          <path d="m8 9 3 3-3 3" />
          <path d="M12.5 15h4" />
        </>
      )
    case 'factory':
      return (
        <>
          <path d="M4 18.5V9l4 3V9l4 3V7l4-2v13.5" />
          <path d="M3 18.5h18" />
          <path d="M8 15h1M12 15h1M16 15h1" />
        </>
      )
    case 'feishu':
      return (
        <>
          <path d="M7 8.5 12 4l5 4.5-5 4.5z" />
          <path d="M7 14.5 12 19l5-4.5" />
        </>
      )
    case 'group':
      return (
        <>
          <circle cx="9" cy="8.5" r="2.5" />
          <circle cx="16" cy="9.5" r="2" />
          <path d="M4.5 19c.6-3.2 2.4-4.7 5.5-4.7 2.6 0 4.2 1.1 5 3.4" />
          <path d="M14.5 14.6c2.2.1 3.7 1.1 4.5 3.4" />
        </>
      )
    case 'link':
      return (
        <>
          <path d="M9.5 14.5 14.5 9.5" />
          <path d="M8.5 10.5 7 12a3.4 3.4 0 0 0 4.8 4.8l1.5-1.5" />
          <path d="M15.5 13.5 17 12a3.4 3.4 0 0 0-4.8-4.8l-1.5 1.5" />
        </>
      )
    case 'longclaw':
      return (
        <>
          <path d="M6 4.5v15h10.5" />
          <path d="M9.5 4.5v11h8" />
          <path d="m16.5 12 2.5 3.5-2.5 3.5" />
        </>
      )
    case 'moon':
      return <path d="M18.8 15.1A7.1 7.1 0 0 1 8.9 5.2 8 8 0 1 0 18.8 15.1z" />
    case 'send':
      return (
        <>
          <path d="m4 12 16-8-6 16-3-7z" />
          <path d="m11 13 9-9" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="2.8" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.4 7.4 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.4 7.4 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </>
      )
    case 'spark':
      return (
        <>
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
          <path d="m6.5 6.5 3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />
        </>
      )
    case 'strategy':
      return (
        <>
          <path d="M4 18h16" />
          <path d="M6 15.5 10 11l3 2 5-7" />
          <path d="M18 6v5h-5" />
        </>
      )
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </>
      )
    case 'terminal':
      return (
        <>
          <path d="M4 5h16v14H4z" />
          <path d="m7 10 3 2.5L7 15" />
          <path d="M12 15h5" />
        </>
      )
    case 'wechat':
      return (
        <>
          <path d="M10.5 15.5a6.2 6.2 0 0 1-2.1.4L5 18l.8-2.7A5.3 5.3 0 0 1 3.5 11c0-3.2 3.1-5.8 6.9-5.8 3 0 5.6 1.7 6.5 4" />
          <path d="M13.5 10.2c3.5 0 6.3 2.2 6.3 5 0 1.2-.5 2.3-1.5 3.2l.6 2.2-2.9-1.7a7.3 7.3 0 0 1-2.5.4c-3.5 0-6.3-2.2-6.3-5s2.8-5.1 6.3-5.1Z" />
        </>
      )
    case 'wecom':
      return (
        <>
          <path d="M5 19V6.5L12 3l7 3.5V19" />
          <path d="M8 19v-7h8v7M9 8.5h1M12 8.5h1M15 8.5h1" />
        </>
      )
    default:
      return <circle cx="12" cy="12" r="8" />
  }
}
