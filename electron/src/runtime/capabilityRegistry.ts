import fs from 'fs'
import path from 'path'

export type RuntimeCapabilityKind = 'skill' | 'plugin'
export type RuntimeCapabilityHealth =
  | 'ok'
  | 'missing_source'
  | 'missing_overlay'
  | 'invalid_manifest'

export type RuntimeCapabilityRegistryEntry = {
  registry_id: string
  kind: RuntimeCapabilityKind
  label: string
  source_path: string
  managed_path: string
  source: 'runtime_managed_overlay'
  installed_at: string
  removable: boolean
  health: RuntimeCapabilityHealth
  metadata: Record<string, unknown>
}

export type RuntimeCapabilityRegistry = {
  version: 1
  updated_at: string
  entries: RuntimeCapabilityRegistryEntry[]
}

export type RegisterRuntimeCapabilityInput = {
  runtimeDir: string
  registryPath: string
  kind: RuntimeCapabilityKind
  sourcePath: string
  label?: string
  metadata?: Record<string, unknown>
}

export type RemoveRuntimeCapabilityInput = {
  runtimeDir: string
  registryPath: string
  registryId: string
}

const REGISTRY_VERSION = 1

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'capability'
}

function normalizeSkillSourceRoot(sourcePath: string): string {
  const resolved = path.resolve(sourcePath)
  if (path.basename(resolved).toLowerCase() === 'skill.md') {
    return path.dirname(resolved)
  }
  return resolved
}

function hasSkillManifest(targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return false
  if (!fs.statSync(targetPath).isDirectory()) return false
  return (
    fs.existsSync(path.join(targetPath, 'SKILL.md')) ||
    fs.existsSync(path.join(targetPath, 'CLAUDE.md')) ||
    fs.existsSync(path.join(targetPath, '.claude', 'skills'))
  )
}

function hasPluginManifest(targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return false
  if (!fs.statSync(targetPath).isDirectory()) return false
  return (
    fs.existsSync(path.join(targetPath, '.codex-plugin', 'plugin.json')) ||
    fs.existsSync(path.join(targetPath, 'package.json')) ||
    fs.existsSync(path.join(targetPath, 'plugins')) ||
    fs.existsSync(path.join(targetPath, 'cowork_plugins'))
  )
}

function capabilityHealth(
  kind: RuntimeCapabilityKind,
  sourcePath: string,
  managedPath: string,
): RuntimeCapabilityHealth {
  if (!fs.existsSync(sourcePath)) return 'missing_source'
  if (!fs.existsSync(managedPath)) return 'missing_overlay'
  if (kind === 'skill') {
    return hasSkillManifest(managedPath) ? 'ok' : 'invalid_manifest'
  }
  return hasPluginManifest(managedPath) ? 'ok' : 'invalid_manifest'
}

export function runtimeCapabilityRoots(runtimeDir: string): {
  root: string
  skills: string
  plugins: string
} {
  const root = path.join(runtimeDir, 'capabilities')
  return {
    root,
    skills: path.join(root, 'skills'),
    plugins: path.join(root, 'plugins'),
  }
}

export function ensureRuntimeCapabilityRoots(runtimeDir: string): ReturnType<
  typeof runtimeCapabilityRoots
> {
  const roots = runtimeCapabilityRoots(runtimeDir)
  fs.mkdirSync(roots.skills, { recursive: true })
  fs.mkdirSync(roots.plugins, { recursive: true })
  return roots
}

function normalizeRegistryEntry(
  value: unknown,
  runtimeDir: string,
): RuntimeCapabilityRegistryEntry | null {
  if (!isPlainRecord(value)) return null
  const kind = value.kind === 'skill' || value.kind === 'plugin' ? value.kind : null
  const sourcePath = stringValue(value.source_path)
  const managedPath = stringValue(value.managed_path)
  if (!kind || !sourcePath || !managedPath) return null
  const registryId =
    stringValue(value.registry_id) ??
    `${kind}:${slugify(path.basename(managedPath))}`
  const label = stringValue(value.label) ?? path.basename(sourcePath)
  const installedAt = stringValue(value.installed_at) ?? new Date(0).toISOString()
  const metadata = isPlainRecord(value.metadata) ? value.metadata : {}
  const removable = value.removable !== false
  const health = capabilityHealth(kind, sourcePath, managedPath)
  const runtimeRoots = runtimeCapabilityRoots(runtimeDir)
  const safeManagedPath = path.resolve(managedPath)
  if (
    !safeManagedPath.startsWith(path.resolve(runtimeRoots.skills)) &&
    !safeManagedPath.startsWith(path.resolve(runtimeRoots.plugins))
  ) {
    return null
  }
  return {
    registry_id: registryId,
    kind,
    label,
    source_path: path.resolve(sourcePath),
    managed_path: safeManagedPath,
    source: 'runtime_managed_overlay',
    installed_at: installedAt,
    removable,
    health,
    metadata,
  }
}

function normalizeRegistry(
  value: unknown,
  runtimeDir: string,
): RuntimeCapabilityRegistry {
  const record = isPlainRecord(value) ? value : {}
  const entries = Array.isArray(record.entries)
    ? record.entries
        .map(entry => normalizeRegistryEntry(entry, runtimeDir))
        .filter((entry): entry is RuntimeCapabilityRegistryEntry => Boolean(entry))
        .sort((left, right) => left.label.localeCompare(right.label))
    : []
  return {
    version: REGISTRY_VERSION,
    updated_at: stringValue(record.updated_at) ?? new Date().toISOString(),
    entries,
  }
}

export function readRuntimeCapabilityRegistry(
  registryPath: string,
  runtimeDir: string,
): RuntimeCapabilityRegistry {
  try {
    if (!fs.existsSync(registryPath)) {
      return normalizeRegistry({}, runtimeDir)
    }
    return normalizeRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf-8')), runtimeDir)
  } catch {
    return normalizeRegistry({}, runtimeDir)
  }
}

export function writeRuntimeCapabilityRegistry(
  registryPath: string,
  runtimeDir: string,
  registry: RuntimeCapabilityRegistry,
): RuntimeCapabilityRegistry {
  const normalized = normalizeRegistry(
    {
      ...registry,
      updated_at: new Date().toISOString(),
    },
    runtimeDir,
  )
  fs.mkdirSync(path.dirname(registryPath), { recursive: true })
  fs.writeFileSync(registryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8')
  return normalized
}

function nextManagedPath(
  root: string,
  label: string,
  sourcePath: string,
): string {
  const base = slugify(label || path.basename(sourcePath))
  let candidate = path.join(root, base)
  let counter = 1
  while (fs.existsSync(candidate)) {
    try {
      if (fs.realpathSync(candidate) === fs.realpathSync(sourcePath)) {
        return candidate
      }
    } catch {
      // ignore broken symlink and keep searching
    }
    counter += 1
    candidate = path.join(root, `${base}-${counter}`)
  }
  return candidate
}

function createManagedOverlay(sourcePath: string, managedPath: string) {
  fs.mkdirSync(path.dirname(managedPath), { recursive: true })
  if (!fs.existsSync(managedPath)) {
    fs.symlinkSync(sourcePath, managedPath, 'dir')
  }
}

export function registerRuntimeCapability(
  input: RegisterRuntimeCapabilityInput,
): RuntimeCapabilityRegistry {
  const runtimeRoots = ensureRuntimeCapabilityRoots(input.runtimeDir)
  const registry = readRuntimeCapabilityRegistry(input.registryPath, input.runtimeDir)
  const rawSourcePath =
    input.kind === 'skill'
      ? normalizeSkillSourceRoot(input.sourcePath)
      : path.resolve(input.sourcePath)
  if (!fs.existsSync(rawSourcePath)) {
    throw new Error(`Capability source does not exist: ${rawSourcePath}`)
  }
  if (!fs.statSync(rawSourcePath).isDirectory()) {
    throw new Error(`Capability source must be a directory: ${rawSourcePath}`)
  }
  if (input.kind === 'skill' && !hasSkillManifest(rawSourcePath)) {
    throw new Error(`Skill source is missing SKILL.md/.claude/skills: ${rawSourcePath}`)
  }
  if (input.kind === 'plugin' && !hasPluginManifest(rawSourcePath)) {
    throw new Error(`Plugin source is missing a recognizable manifest: ${rawSourcePath}`)
  }
  const destinationRoot = input.kind === 'skill' ? runtimeRoots.skills : runtimeRoots.plugins
  const managedPath = nextManagedPath(
    destinationRoot,
    input.label ?? path.basename(rawSourcePath),
    rawSourcePath,
  )
  createManagedOverlay(rawSourcePath, managedPath)
  const now = new Date().toISOString()
  const realManagedPath = path.resolve(managedPath)
  const nextEntries = [
    ...registry.entries.filter(entry => entry.managed_path !== realManagedPath),
    {
      registry_id: `${input.kind}:${slugify(path.basename(realManagedPath))}`,
      kind: input.kind,
      label: input.label?.trim() || path.basename(rawSourcePath),
      source_path: path.resolve(rawSourcePath),
      managed_path: realManagedPath,
      source: 'runtime_managed_overlay' as const,
      installed_at: now,
      removable: true,
      health: capabilityHealth(input.kind, rawSourcePath, realManagedPath),
      metadata: {
        ...(input.metadata ?? {}),
        runtime_root: destinationRoot,
      },
    },
  ]
  return writeRuntimeCapabilityRegistry(
    input.registryPath,
    input.runtimeDir,
    {
      version: REGISTRY_VERSION,
      updated_at: now,
      entries: nextEntries,
    },
  )
}

export function removeRuntimeCapability(
  input: RemoveRuntimeCapabilityInput,
): RuntimeCapabilityRegistry {
  const registry = readRuntimeCapabilityRegistry(input.registryPath, input.runtimeDir)
  const target = registry.entries.find(entry => entry.registry_id === input.registryId)
  if (!target) {
    throw new Error(`Unknown runtime-managed capability: ${input.registryId}`)
  }
  if (!target.removable) {
    throw new Error(`Capability cannot be removed: ${input.registryId}`)
  }
  const roots = runtimeCapabilityRoots(input.runtimeDir)
  const managedPath = path.resolve(target.managed_path)
  if (
    !managedPath.startsWith(path.resolve(roots.skills)) &&
    !managedPath.startsWith(path.resolve(roots.plugins))
  ) {
    throw new Error(`Refusing to remove non-runtime-managed path: ${managedPath}`)
  }
  fs.rmSync(managedPath, { recursive: true, force: true })
  return writeRuntimeCapabilityRegistry(
    input.registryPath,
    input.runtimeDir,
    {
      version: REGISTRY_VERSION,
      updated_at: new Date().toISOString(),
      entries: registry.entries.filter(entry => entry.registry_id !== input.registryId),
    },
  )
}

export function rescanRuntimeCapabilityRegistry(
  registryPath: string,
  runtimeDir: string,
): RuntimeCapabilityRegistry {
  const registry = readRuntimeCapabilityRegistry(registryPath, runtimeDir)
  return writeRuntimeCapabilityRegistry(registryPath, runtimeDir, registry)
}

export function runtimeDiscoveryRoots(
  runtimeDir: string,
): { skills: string[]; plugins: string[] } {
  const roots = ensureRuntimeCapabilityRoots(runtimeDir)
  return {
    skills: uniqueStrings([roots.skills]),
    plugins: uniqueStrings([roots.plugins]),
  }
}
