import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const hookName = path.basename(process.argv[2] || 'git-hook')
const hookArgs = process.argv.slice(3)

if (process.env.LONGCLAW_SKIP_AUTO_PACKAGE === '1') {
  console.log(`[electron-auto-package] skipped for ${hookName}: LONGCLAW_SKIP_AUTO_PACKAGE=1`)
  process.exit(0)
}

if (hookName === 'post-checkout' && hookArgs[2] === '0') {
  console.log('[electron-auto-package] skipped for file checkout')
  process.exit(0)
}

console.log(`[electron-auto-package] ${hookName} changed code; running npm run electron:package:mac`)
const result = spawnSync('npm', ['run', 'electron:package:mac'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ELECTRON_AUTO_PACKAGE: '1',
  },
  stdio: 'inherit',
})

if (result.status !== 0) {
  console.error(`[electron-auto-package] package failed after ${hookName}; git operation is left intact`)
}

process.exit(0)
