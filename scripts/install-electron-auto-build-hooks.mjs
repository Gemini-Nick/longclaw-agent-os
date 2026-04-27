import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const hooksPath = 'scripts/git-hooks'
const absoluteHooksPath = path.join(repoRoot, hooksPath)

fs.mkdirSync(absoluteHooksPath, { recursive: true })
for (const hook of ['post-merge', 'post-checkout', 'post-rewrite']) {
  fs.chmodSync(path.join(absoluteHooksPath, hook), 0o755)
}

let existing = ''
try {
  existing = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
} catch {
  existing = ''
}

if (existing && existing !== hooksPath) {
  console.error(`core.hooksPath is already set to ${existing}; not overwriting it automatically.`)
  console.error(`Run this manually if you want to replace it: git config core.hooksPath ${hooksPath}`)
  process.exit(1)
}

execFileSync('git', ['config', 'core.hooksPath', hooksPath], { cwd: repoRoot, stdio: 'inherit' })
console.log(`Installed Electron auto-package git hooks via core.hooksPath=${hooksPath}`)
console.log('Hooks run after git pull/merge, branch checkout, and rebase.')
console.log('Temporarily disable with LONGCLAW_SKIP_AUTO_PACKAGE=1.')
