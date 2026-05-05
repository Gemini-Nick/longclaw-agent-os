/**
 * Agent Backend — 双模式切换
 *
 * mode=acp:  通过 ACP 连接 CC Desktop（当前默认）
 * mode=sdk:  直接用 OAS createAgent() 调 API（未来）
 */
import { AcpClient, AcpClientOptions, CodexAppServerClient } from './acp-client.js'

export type AgentMode = 'acp' | 'sdk' | 'codex-app-server'

export interface AgentEvent {
  type: 'text' | 'tool' | 'result' | 'error'
  text?: string
  toolName?: string
  toolInput?: any
  result?: any
  error?: string
}

export interface AgentBackend {
  mode: AgentMode
  connect(): Promise<void>
  query(message: string, onEvent: (event: AgentEvent) => void): Promise<void>
  clear(): void
  close(): void
  alive(): boolean
}

// --- ACP Mode ---

export class AcpBackend implements AgentBackend {
  mode: AgentMode = 'acp'
  private client: AcpClient | null = null
  private clientOptions: AcpClientOptions

  constructor(options: AcpClientOptions = {}) {
    this.clientOptions = options
  }

  async connect(): Promise<void> {
    this.client = new AcpClient(this.clientOptions)
    await this.client.connect()
  }

  async query(message: string, onEvent: (event: AgentEvent) => void): Promise<void> {
    if (!this.client || !this.client.alive()) {
      await this.connect()
    }

    try {
      await this.client!.prompt(message, {
        onText: (text) => onEvent({ type: 'text', text }),
        onToolUse: (name, input) => onEvent({ type: 'tool', toolName: name, toolInput: input }),
      })
      onEvent({ type: 'result', result: { ok: true } })
    } catch (err: any) {
      console.error('[acp-backend] query error:', err)
      onEvent({ type: 'error', error: err.message || String(err) })
    }
  }

  clear(): void {
    if (this.client) {
      this.client.close()
      this.client = null
    }
  }

  close(): void {
    this.client?.close()
    this.client = null
  }

  alive(): boolean {
    return this.client?.alive() ?? false
  }
}

// --- Codex App-Server Mode ---

export class CodexAppServerBackend implements AgentBackend {
  mode: AgentMode = 'codex-app-server'
  private client: CodexAppServerClient | null = null
  private options: { cwd?: string; model?: string }

  constructor(options: { cwd?: string; model?: string } = {}) {
    this.options = options
  }

  async connect(): Promise<void> {
    this.client = new CodexAppServerClient({
      cwd: this.options.cwd,
      model: this.options.model,
    })
    await this.client.connect()
  }

  async query(message: string, onEvent: (event: AgentEvent) => void): Promise<void> {
    if (!this.client || !this.client.alive()) {
      await this.connect()
    }
    try {
      await this.client!.prompt(message, {
        onText: (text) => onEvent({ type: 'text', text }),
        onToolUse: (name, input) => onEvent({ type: 'tool', toolName: name, toolInput: input }),
      })
      onEvent({ type: 'result', result: { ok: true } })
    } catch (err: any) {
      console.error('[codex-backend] query error:', err)
      onEvent({ type: 'error', error: err.message || String(err) })
    }
  }

  clear(): void {
    if (this.client) {
      this.client.close()
      this.client = null
    }
  }

  close(): void {
    this.client?.close()
    this.client = null
  }

  alive(): boolean {
    return this.client?.alive() ?? false
  }
}

// --- SDK Mode (future) ---

export class SdkBackend implements AgentBackend {
  mode: AgentMode = 'sdk'
  private agent: any = null
  private sdkModule: any = null
  private options: {
    model?: string
    cwd?: string
    systemPrompt?: string
  }

  constructor(options: { model?: string; cwd?: string; systemPrompt?: string } = {}) {
    this.options = options
  }

  async connect(): Promise<void> {
    if (!this.sdkModule) {
      this.sdkModule = await import('../../dist/sdk.js')
    }
    this.agent = this.sdkModule.createAgent({
      model: this.options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      cwd: this.options.cwd || process.env.AGENT_CWD,
      maxTurns: 15,
      permissionMode: 'bypassPermissions' as any,
      appendSystemPrompt: this.options.systemPrompt || '你是隆小虾，一个金融业务 AI 助手。回复使用中文。',
    })
  }

  async query(message: string, onEvent: (event: AgentEvent) => void): Promise<void> {
    if (!this.agent) await this.connect()

    try {
      for await (const ev of this.agent.query(message)) {
        const msg = ev as any
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              onEvent({ type: 'text', text: block.text })
            }
            if (block.type === 'tool_use') {
              onEvent({ type: 'tool', toolName: block.name, toolInput: block.input })
            }
          }
        }
        if (msg.type === 'result') {
          onEvent({ type: 'result', result: {
            subtype: msg.subtype,
            inputTokens: msg.usage?.input_tokens,
            outputTokens: msg.usage?.output_tokens,
          }})
        }
      }
    } catch (err: any) {
      onEvent({ type: 'error', error: err.message || String(err) })
    }
  }

  clear(): void {
    if (this.agent) this.agent.clear()
  }

  close(): void {
    this.agent = null
    this.sdkModule = null
  }

  alive(): boolean {
    return this.agent !== null
  }
}

// --- Factory ---

export function createBackend(mode: AgentMode, options: any = {}): AgentBackend {
  switch (mode) {
    case 'acp': return new AcpBackend(options)
    case 'sdk': return new SdkBackend(options)
    case 'codex-app-server': return new CodexAppServerBackend(options)
    default: throw new Error(`Unknown agent mode: ${mode}`)
  }
}
