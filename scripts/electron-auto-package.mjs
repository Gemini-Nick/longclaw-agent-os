import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import chokidar from 'chokidar'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const watchMode = args.includes('--watch') || !args.includes('--once')
const skipInitial = args.includes('--no-initial')
const commandArg = args.find(arg => arg.startsWith('--command='))
const debounceArg = args.find(arg => arg.startsWith('--debounce='))
const packageCommand = commandArg?.split('=', 2)[1] || process.env.ELECTRON_PACKAGE_COMMAND || 'electron:package:mac'
const debounceMs = Number(debounceArg?.split('=', 2)[1] || process.env.ELECTRON_PACKAGE_DEBOUNCE_MS || 2500)

const watchRoots = [
  'src',
  'electron',
  'scripts',
  'electron-builder.yml',
  'package.json',
  'package-lock.json',
]

const watchedScriptFiles = new Set([
  'scripts/generate-electron-icon.mjs',
  'scripts/stamp-electron-app-icons.mjs',
])

const watchedRootFileNames = new Set([
  'electron-builder.yml',
  'package.json',
  'package-lock.json',
])

const ignored = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  'electron/dist/**',
  'electron/build-resources/**',
  'release/**',
  'reports/**',
  '.cache/**',
  'coverage/**',
]

let running = false
let queuedReason = ''
let timer = null
let runCount = 0

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function log(message) {
  console.log(`[electron-auto-package ${now()}] ${message}`)
}

function runPackage(reason) {
  if (running) {
    queuedReason = reason
    log(`build already running; queued another package (${reason})`)
    return
  }
  running = true
  runCount += 1
  log(`starting #${runCount}: npm run ${packageCommand} (${reason})`)
  const child = spawn('npm', ['run', packageCommand], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ELECTRON_AUTO_PACKAGE: '1',
    },
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    running = false
    if (code === 0) {
      log(`package #${runCount} finished`)
    } else {
      log(`package #${runCount} failed code=${code ?? ''} signal=${signal ?? ''}`)
    }
    if (queuedReason) {
      const nextReason = queuedReason
      queuedReason = ''
      runPackage(`queued after ${nextReason}`)
    } else if (!watchMode && code !== 0) {
      process.exit(code ?? 1)
    }
  })
}

function shouldPackage(filePath) {
  const normalized = filePath.split(path.sep).join('/')
  if (normalized.startsWith('src/')) return true
  if (normalized.startsWith('electron/src/')) return true
  if (/^electron\/[^/]+\.(mjs|json)$/.test(normalized)) return true
  if (/^tsconfig.*\.json$/.test(normalized)) return true
  if (watchedRootFileNames.has(normalized)) return true
  if (watchedScriptFiles.has(normalized)) return true
  return false
}

function schedule(event, filePath) {
  if (!shouldPackage(filePath)) return
  const reason = `${event}:${filePath}`
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    runPackage(reason)
  }, Number.isFinite(debounceMs) ? debounceMs : 2500)
}

if (!watchMode) {
  runPackage('once')
} else {
  const watcher = chokidar.watch(watchRoots, {
    cwd: repoRoot,
    ignoreInitial: true,
    ignored,
    awaitWriteFinish: {
      stabilityThreshold: 750,
      pollInterval: 100,
    },
  })

  watcher.on('ready', () => {
    log(`watching ${watchRoots.length} path roots; command=npm run ${packageCommand}`)
    if (!skipInitial) runPackage('initial')
  })
  watcher.on('add', filePath => schedule('add', filePath))
  watcher.on('change', filePath => schedule('change', filePath))
  watcher.on('unlink', filePath => schedule('unlink', filePath))
  watcher.on('error', error => {
    log(`watch error: ${error?.message || error}`)
  })

  process.on('SIGINT', async () => {
    log('stopping watcher')
    if (timer) clearTimeout(timer)
    await watcher.close()
    process.exit(0)
  })
}
