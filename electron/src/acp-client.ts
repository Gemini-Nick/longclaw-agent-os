/**
 * ACP Client — TypeScript port of Chanless/internal/acp/client.go
 *
 * Connects to CC Desktop (claude-agent-acp) via JSON-RPC over stdio.
 */
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import { createInterface, Interface } from 'readline'
import path from 'path'
import os from 'os'

interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: any
}

interface RpcResponse {
  jsonrpc: string
  id?: number
  result?: any
  error?: { code: number; message: string }
  method?: string
  params?: any
}

export interface AcpClientOptions {
  cwd?: string
  acpScript?: string
  claudeExecutable?: string
}

export interface AcpChunkHandler {
  onText?: (text: string) => void
  onToolUse?: (name: string, input: any) => void
}

export function defaultLegacyAcpScriptPath(): string {
  return path.join(os.homedir(), '.weclaw', 'claude-acp.sh')
}

export function defaultLegacyCodexAcpScriptPath(): string {
  return path.join(os.homedir(), '.weclaw', 'codex-acp.sh')
}

export function resolveConfiguredAcpScriptPath(
  options: Pick<AcpClientOptions, 'acpScript'> = {},
): { path: string; source: 'option' | 'env' | 'legacy_default' } {
  const explicitOption = options.acpScript?.trim()
  if (explicitOption) {
    return { path: explicitOption, source: 'option' }
  }

  const envScript = process.env.LONGCLAW_LOCAL_ACP_SCRIPT?.trim()
  if (envScript) {
    return { path: envScript, source: 'env' }
  }

  const codexDefault = defaultLegacyCodexAcpScriptPath()
  if (fs.existsSync(codexDefault)) {
    return { path: codexDefault, source: 'legacy_default' }
  }

  return { path: defaultLegacyAcpScriptPath(), source: 'legacy_default' }
}

export function inspectConfiguredAcpBridge(
  options: Pick<AcpClientOptions, 'acpScript'> = {},
): { path: string; source: 'option' | 'env' | 'legacy_default'; available: boolean } {
  const resolved = resolveConfiguredAcpScriptPath(options)
  return {
    ...resolved,
    available: fs.existsSync(resolved.path),
  }
}

export class AcpClient {
  private proc: ChildProcess | null = null
  private rl: Interface | null = null
  private nextId = 0
  private sessionId = ''
  private cwd: string
  private acpScript: string
  private claudeExecutable: string

  // Active chunk handler for current prompt
  private chunkHandler: AcpChunkHandler = {}

  // Serialise prompts — one at a time, like Chanless client.go
  private promptLock: Promise<any> = Promise.resolve()

  private pending = new Map<number, {
    resolve: (resp: RpcResponse) => void
    reject: (err: Error) => void
  }>()

  constructor(options: AcpClientOptions = {}) {
    this.cwd = options.cwd || os.homedir()
    this.acpScript = resolveConfiguredAcpScriptPath(options).path
    this.claudeExecutable = options.claudeExecutable || path.join(os.homedir(), '.local', 'bin', 'claude')
  }

  async connect(): Promise<void> {
    console.error(`[acp] spawning: ${this.acpScript}`)
    console.error(`[acp] cwd: ${this.cwd}`)

    this.proc = spawn(this.acpScript, [], {
      env: {
        ...process.env,
        CLAUDE_CODE_EXECUTABLE: this.claudeExecutable,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      console.error(`[acp stderr] ${data.toString().trim()}`)
    })

    this.rl = createInterface({ input: this.proc.stdout! })
    this.rl.on('line', (line) => this.handleLine(line))

    this.proc.on('error', (err) => {
      console.error(`[acp] spawn error:`, err)
      this.rejectAll(new Error(`ACP spawn error: ${err.message}`))
    })

    this.proc.on('exit', (code, signal) => {
      console.error(`[acp] process exited: code=${code} signal=${signal}`)
      this.rejectAll(new Error(`ACP process exited: code=${code}`))
    })

    // Handshake
    console.error('[acp] sending initialize...')
    await this.send('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'longxiaoxia', version: '0.1.0' },
      clientCapabilities: {},
    })
    console.error('[acp] initialize OK')

    // Create session
    console.error(`[acp] creating session, cwd=${this.cwd}`)
    const resp = await this.send('session/new', {
      cwd: this.cwd,
      mcpServers: [],
    })
    this.sessionId = resp.result?.sessionId || ''
    console.error(`[acp] connected, session=${this.sessionId}`)
  }

  private handleLine(line: string) {
    let resp: RpcResponse
    try {
      resp = JSON.parse(line)
    } catch {
      return
    }

    // Notification (no id) — stream chunks
    if (resp.id === undefined || resp.id === null) {
      if (resp.method === 'session/update' && resp.params) {
        const update = resp.params
        const su = update.update?.sessionUpdate
        if (su === 'agent_message_chunk') {
          const content = update.update.content
          console.error(`[acp chunk] type=${content?.type} text="${(content?.text || '').slice(0, 50)}"`)
          if (content?.type === 'text' && content.text) {
            this.chunkHandler.onText?.(content.text)
          }
          if (content?.type === 'tool_use') {
            console.error(`[acp tool] name=${content.name} input=${JSON.stringify(content.input).slice(0, 80)}`)
            this.chunkHandler.onToolUse?.(content.name || '', content.input || {})
          }
        } else {
          // Log other session update types to see what tool events look like
          console.error(`[acp update] sessionUpdate=${su}`)
        }
      }
      return
    }

    // Response with ID
    const pending = this.pending.get(resp.id)
    if (pending) {
      this.pending.delete(resp.id)
      if (resp.error) {
        pending.reject(new Error(`RPC error ${resp.error.code}: ${resp.error.message}`))
      } else {
        pending.resolve(resp)
      }
    }
  }

  private send(method: string, params: any): Promise<RpcResponse> {
    const id = ++this.nextId
    const req: RpcRequest = { jsonrpc: '2.0', id, method, params }

    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin?.writable) {
        reject(new Error('ACP stdin not writable'))
        return
      }
      this.pending.set(id, { resolve, reject })
      const data = JSON.stringify(req) + '\n'
      this.proc!.stdin!.write(data, (err) => {
        if (err) {
          this.pending.delete(id)
          reject(err)
        }
      })
    })
  }

  /**
   * Send a prompt. Chunks stream via handler callbacks during execution.
   */
  async prompt(text: string, handler: AcpChunkHandler = {}): Promise<string> {
    // Serialise: wait for any previous prompt to finish first
    const prev = this.promptLock
    let resolve: () => void
    this.promptLock = new Promise<void>(r => { resolve = r })

    try {
      await prev // wait for previous prompt to complete
    } catch {} // ignore previous errors

    this.chunkHandler = handler
    let collected = ''
    const origOnText = handler.onText
    this.chunkHandler.onText = (chunk) => {
      collected += chunk
      origOnText?.(chunk)
    }

    console.error(`[acp] prompt: "${text.slice(0, 50)}..."`)
    try {
      await this.send('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text }],
      })
    } finally {
      this.chunkHandler = {}
      resolve!()
    }

    console.error(`[acp] response: ${collected.length} chars`)
    return collected
  }

  alive(): boolean {
    return this.proc !== null && !this.proc.killed
  }

  close(): void {
    this.rl?.close()
    this.rl = null
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }
    this.rejectAll(new Error('ACP client closed'))
  }

  private rejectAll(err: Error) {
    for (const [, p] of this.pending) {
      p.reject(err)
    }
    this.pending.clear()
  }
}
