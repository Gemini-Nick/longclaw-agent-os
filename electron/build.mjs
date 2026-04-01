import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')

mkdirSync(path.join(distDir, 'renderer'), { recursive: true })

// 1. Bundle main process (CJS for Electron, external electron + OAS SDK)
console.log('[1/3] Bundling main process...')
await build({
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  bundle: true,
  outfile: path.join(distDir, 'main.cjs'),
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['electron', '../../dist/*'],
  loader: { '.ts': 'ts' },
})

// 2. Bundle preload (CJS for Electron)
console.log('[2/3] Bundling preload...')
await build({
  entryPoints: [path.join(__dirname, 'src/preload.ts')],
  bundle: true,
  outfile: path.join(distDir, 'preload.cjs'),
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['electron'],
  loader: { '.ts': 'ts' },
})

// 3. Bundle renderer (ESM for browser)
console.log('[3/3] Bundling renderer...')
await build({
  entryPoints: [path.join(__dirname, 'src/renderer/main.tsx')],
  bundle: true,
  outfile: path.join(distDir, 'renderer/main.js'),
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
})

// Copy index.html
copyFileSync(
  path.join(__dirname, 'src/renderer/index.html'),
  path.join(distDir, 'renderer/index.html'),
)

console.log('Build complete.')
