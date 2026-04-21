import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  readRuntimeCapabilityRegistry,
  registerRuntimeCapability,
  removeRuntimeCapability,
  runtimeCapabilityRoots,
  writeRuntimeCapabilityRegistry,
} from './capabilityRegistry.js'

const tempDirs: string[] = []

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('capabilityRegistry', () => {
  it('registers and removes a runtime-managed skill overlay without deleting the source', () => {
    const root = makeTempDir('longclaw-capability-')
    const runtimeDir = path.join(root, 'runtime-v2')
    const registryPath = path.join(runtimeDir, 'capability-registry.json')
    const sourceDir = path.join(root, 'sample-skill')
    fs.mkdirSync(sourceDir, { recursive: true })
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), '# Sample Skill\n\nA managed skill.\n')

    const registered = registerRuntimeCapability({
      runtimeDir,
      registryPath,
      kind: 'skill',
      sourcePath: sourceDir,
      label: 'Sample Skill',
    })

    expect(registered.entries).toHaveLength(1)
    expect(registered.entries[0]?.health).toBe('ok')
    expect(fs.existsSync(registered.entries[0]!.managed_path)).toBe(true)
    expect(fs.existsSync(sourceDir)).toBe(true)

    const removed = removeRuntimeCapability({
      runtimeDir,
      registryPath,
      registryId: registered.entries[0]!.registry_id,
    })

    expect(removed.entries).toHaveLength(0)
    expect(fs.existsSync(sourceDir)).toBe(true)
    expect(fs.existsSync(registered.entries[0]!.managed_path)).toBe(false)
  })

  it('refuses to remove paths outside the runtime-managed roots', () => {
    const root = makeTempDir('longclaw-capability-')
    const runtimeDir = path.join(root, 'runtime-v2')
    const registryPath = path.join(runtimeDir, 'capability-registry.json')
    const outsideDir = path.join(root, 'outside-plugin')
    fs.mkdirSync(outsideDir, { recursive: true })
    fs.writeFileSync(path.join(outsideDir, 'package.json'), '{"name":"outside-plugin"}\n')

    writeRuntimeCapabilityRegistry(registryPath, runtimeDir, {
      version: 1,
      updated_at: new Date().toISOString(),
      entries: [
        {
          registry_id: 'plugin:outside',
          kind: 'plugin',
          label: 'outside',
          source_path: outsideDir,
          managed_path: outsideDir,
          source: 'runtime_managed_overlay',
          installed_at: new Date().toISOString(),
          removable: true,
          health: 'ok',
          metadata: {},
        },
      ],
    })

    expect(() =>
      removeRuntimeCapability({
        runtimeDir,
        registryPath,
        registryId: 'plugin:outside',
      }),
    ).toThrow(/Unknown runtime-managed capability|Refusing to remove non-runtime-managed path/)
  })

  it('exposes the runtime capability roots in a stable location', () => {
    const runtimeDir = '/tmp/runtime-v2'
    expect(runtimeCapabilityRoots(runtimeDir)).toEqual({
      root: '/tmp/runtime-v2/capabilities',
      skills: '/tmp/runtime-v2/capabilities/skills',
      plugins: '/tmp/runtime-v2/capabilities/plugins',
    })
    expect(readRuntimeCapabilityRegistry('/tmp/missing.json', runtimeDir).entries).toEqual([])
  })
})
