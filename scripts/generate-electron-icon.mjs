import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const resourcesDir = path.join(repoRoot, 'electron', 'build-resources')
const iconsetDir = path.join(resourcesDir, 'icon.iconset')
const svgPath = path.join(resourcesDir, 'icon.svg')
const pngPath = path.join(resourcesDir, 'icon.png')
const icnsPath = path.join(resourcesDir, 'icon.icns')

const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="34" flood-color="#0F172A" flood-opacity="0.22"/>
    </filter>
  </defs>

  <rect x="72" y="72" width="880" height="880" rx="218" fill="#F8FAFC" stroke="#D9DEE7" stroke-width="12" filter="url(#shadow)"/>
  <rect x="212" y="212" width="600" height="600" rx="136" fill="#05070B"/>
  <path d="M348 292 V708 H638" fill="none" stroke="#FFFFFF" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M452 292 V600 H678" fill="none" stroke="#FFFFFF" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M628 504 L748 604 L628 704" fill="none" stroke="#FFFFFF" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

async function renderPng(targetPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(targetPath)
}

async function main() {
  fs.mkdirSync(resourcesDir, { recursive: true })
  fs.rmSync(iconsetDir, { recursive: true, force: true })
  fs.mkdirSync(iconsetDir, { recursive: true })
  fs.writeFileSync(svgPath, svg, 'utf8')

  await renderPng(pngPath, 1024)
  await Promise.all(
    sizes.map(([filename, size]) => renderPng(path.join(iconsetDir, filename), size)),
  )

  if (process.platform === 'darwin') {
    try {
      execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath], { stdio: 'inherit' })
    } catch (error) {
      if (!fs.existsSync(icnsPath)) {
        throw error
      }
      console.warn(`iconutil failed; keeping existing Electron icon: ${icnsPath}`)
    }
  } else {
    console.warn('Skipping .icns generation because iconutil is only available on macOS.')
  }

  console.log(`Electron icon generated: ${icnsPath}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
