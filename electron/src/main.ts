import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { createBackend, AgentBackend, AgentMode } from './agent-backend.js'

function log(...args: any[]) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  process.stderr.write(`[longxiaoxia] ${msg}\n`)
}

let mainWindow: BrowserWindow | null = null
let backend: AgentBackend | null = null

function getAgentMode(): AgentMode {
  return (process.env.AGENT_MODE as AgentMode) || 'acp'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    y: 30,
    title: '隆小虾 Agent OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }
}

async function ensureBackend(): Promise<AgentBackend> {
  if (backend && backend.alive()) return backend

  const mode = getAgentMode()
  log(`initializing backend: mode=${mode}`)

  if (mode === 'acp') {
    backend = createBackend('acp', {
      cwd: process.env.AGENT_CWD || app.getPath('home'),
    })
  } else {
    backend = createBackend('sdk', {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      cwd: process.env.AGENT_CWD || app.getPath('home'),
      systemPrompt: '你是隆小虾，一个金融业务 AI 助手。你可以读写文件、执行命令、搜索代码。回复使用中文。',
    })
  }

  await backend.connect()
  return backend
}

async function handleQuery(_event: Electron.IpcMainInvokeEvent, message: string) {
  const sender = _event.sender
  const b = await ensureBackend()

  await b.query(message, (event) => {
    log(`event: type=${event.type} text="${(event.text || '').slice(0, 30)}"`)
    switch (event.type) {
      case 'text':
        sender.send('agent:text', event.text)
        break
      case 'tool':
        sender.send('agent:tool', { name: event.toolName, input: event.toolInput })
        break
      case 'result':
        sender.send('agent:result', event.result)
        break
      case 'error':
        sender.send('agent:error', event.error)
        break
    }
  })

  return { ok: true }
}

app.whenReady().then(() => {
  ipcMain.handle('agent:query', handleQuery)

  ipcMain.handle('agent:clear', async () => {
    backend?.clear()
    return { ok: true }
  })

  ipcMain.handle('agent:mode', () => {
    return { mode: getAgentMode(), alive: backend?.alive() ?? false }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  backend?.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
