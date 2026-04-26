import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const releaseDir = path.resolve(repoRoot, process.argv[2] || 'release/mac-arm64')
const iconIcns = path.join(repoRoot, 'electron', 'build-resources', 'icon.icns')
const iconPng = path.join(repoRoot, 'electron', 'build-resources', 'icon.png')
const plistBuddy = '/usr/libexec/PlistBuddy'

function findAppBundles(root) {
  const output = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || !fs.existsSync(current)) continue
    const stat = fs.statSync(current)
    if (!stat.isDirectory()) continue
    if (current.endsWith('.app')) {
      output.push(current)
    }
    for (const entry of fs.readdirSync(current)) {
      if (entry === 'node_modules' || entry === 'app.asar.unpacked') continue
      const next = path.join(current, entry)
      if (fs.existsSync(next) && fs.statSync(next).isDirectory()) {
        stack.push(next)
      }
    }
  }
  return output.sort()
}

function setPlistValue(plistPath, key, value) {
  try {
    execFileSync(plistBuddy, ['-c', `Set :${key} ${value}`, plistPath], { stdio: 'ignore' })
  } catch {
    execFileSync(plistBuddy, ['-c', `Add :${key} string ${value}`, plistPath], { stdio: 'ignore' })
  }
}

function stampApp(appPath) {
  const contentsDir = path.join(appPath, 'Contents')
  const resourcesDir = path.join(contentsDir, 'Resources')
  const plistPath = path.join(contentsDir, 'Info.plist')
  if (!fs.existsSync(plistPath)) return false
  fs.mkdirSync(resourcesDir, { recursive: true })
  fs.copyFileSync(iconIcns, path.join(resourcesDir, 'icon.icns'))
  fs.copyFileSync(iconPng, path.join(resourcesDir, 'icon.png'))
  setPlistValue(plistPath, 'CFBundleIconFile', 'icon.icns')
  return true
}

if (!fs.existsSync(iconIcns) || !fs.existsSync(iconPng)) {
  throw new Error(`Missing generated icons under ${path.dirname(iconIcns)}`)
}

const apps = findAppBundles(releaseDir)
if (apps.length === 0) {
  throw new Error(`No .app bundles found under ${releaseDir}`)
}

const stamped = apps.filter(stampApp)
console.log(`Stamped Electron icons for ${stamped.length} app bundle(s):`)
for (const appPath of stamped) {
  console.log(`- ${path.relative(repoRoot, appPath)}`)
}
