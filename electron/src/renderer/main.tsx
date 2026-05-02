import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

type RendererErrorBoundaryState = {
  error: Error | null
}

class RendererErrorBoundary extends React.Component<React.PropsWithChildren, RendererErrorBoundaryState> {
  state: RendererErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[longclaw-renderer] recovered from render crash', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh',
        background: '#070d14',
        color: '#d6e2f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        padding: 24,
        boxSizing: 'border-box',
      }}>
        <div style={{
          maxWidth: 820,
          border: '1px solid #233246',
          borderRadius: 8,
          background: '#101923',
          padding: 20,
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
        }}>
          <div style={{ color: '#ff647d', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Renderer recovered</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>交易终端渲染异常，已阻止黑屏</div>
          <div style={{ color: '#8fa3b8', lineHeight: 1.6, marginBottom: 14 }}>
            请保留这个窗口状态，Electron 日志里已经记录了异常堆栈。可以刷新或重新打开应用继续验证。
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            border: '1px solid #233246',
            borderRadius: 6,
            padding: 12,
            margin: 0,
            color: '#d6e2f0',
            background: '#07111b',
            fontSize: 12,
          }}>
            {this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('app')!).render(
  <RendererErrorBoundary>
    <App />
  </RendererErrorBoundary>,
)
