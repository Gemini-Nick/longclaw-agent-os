import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

import type {
  WeChatBindingProvider,
  WeChatBindingStateValue,
  WeChatIdentityStatus,
  WeChatScanStatus,
} from './wechatPluginDev.js'

export type WeChatClusterNodeStatus = 'unknown' | 'online' | 'degraded' | 'offline'

export type WeChatClusterNode = {
  node_id: string
  ssh_host: string
  status: WeChatClusterNodeStatus
  capacity: number
  active_accounts: number
  pending_scans: number
  queue_lag_ms: number
  draining: boolean
  api_addr?: string
  last_heartbeat_at?: string
  last_error?: string
}

export type WeChatClusterBinding = {
  binding_id: string
  binding_session_id: string
  node_id: string
  state: WeChatBindingStateValue | 'offline'
  provider: WeChatBindingProvider
  qr_url?: string
  expires_at?: string
  account_id?: string
  display_name?: string
  remote_account_path?: string
  scan_status?: WeChatScanStatus
  identity_status: WeChatIdentityStatus
  created_at: string
  bound_at?: string
  last_seen_at?: string
}

export type WeChatClusterSession = {
  canonical_session_id: string
  account_id: string
  node_id: string
  status: 'active' | 'idle' | 'closed'
  title?: string
  last_message_at?: string
}

export type WeChatClusterState = {
  version: 'wechat-cluster-v1'
  updated_at: string
  nodes: WeChatClusterNode[]
  bindings: WeChatClusterBinding[]
  sessions: WeChatClusterSession[]
}

export type WeChatClusterNodeSeed = {
  node_id: string
  ssh_host?: string
  status?: WeChatClusterNodeStatus
  capacity?: number
  api_addr?: string
}

export type WeChatClusterSelection = {
  node: WeChatClusterNode
  score: number
  reason: string
}

export type WeChatClusterBindingResult = {
  state: WeChatClusterState
  binding: WeChatClusterBinding
  selected_node: WeChatClusterNode
  selection_reason: string
}

type WeChatClusterStateFile = WeChatClusterState

function nowIso(): string {
  return new Date().toISOString()
}

function readJson(pathname: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(pathname, 'utf-8')) as unknown
  } catch {
    return null
  }
}

function writeJson(pathname: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true })
  fs.writeFileSync(pathname, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(asNumber(value, fallback)))
}

function asNodeStatus(value: unknown): WeChatClusterNodeStatus {
  if (value === 'online' || value === 'degraded' || value === 'offline') return value
  return 'unknown'
}

function asBindingState(value: unknown): WeChatClusterBinding['state'] {
  if (
    value === 'qr_pending' ||
    value === 'bound' ||
    value === 'expired' ||
    value === 'revoked' ||
    value === 'offline'
  ) {
    return value
  }
  return 'unbound'
}

function asProvider(value: unknown): WeChatBindingProvider {
  return value === 'local_lan_callback' ? 'local_lan_callback' : 'ilink_service_account'
}

function asIdentityStatus(value: unknown): WeChatIdentityStatus {
  if (
    value === 'local_runtime_bound' ||
    value === 'ilink_pending' ||
    value === 'ilink_scanned' ||
    value === 'ilink_verified' ||
    value === 'ilink_failed'
  ) {
    return value
  }
  return 'unconfigured'
}

function asScanStatus(value: unknown): WeChatScanStatus | undefined {
  if (value === 'wait' || value === 'scaned' || value === 'confirmed' || value === 'expired') {
    return value
  }
  return undefined
}

function normalizeNode(value: unknown): WeChatClusterNode | null {
  const record = asRecord(value)
  const nodeId = asString(record.node_id)
  if (!nodeId) return null
  return {
    node_id: nodeId,
    ssh_host: asString(record.ssh_host) ?? nodeId,
    status: asNodeStatus(record.status),
    capacity: Math.max(1, nonNegativeInt(record.capacity, 1)),
    active_accounts: nonNegativeInt(record.active_accounts, 0),
    pending_scans: nonNegativeInt(record.pending_scans, 0),
    queue_lag_ms: nonNegativeInt(record.queue_lag_ms, 0),
    draining: record.draining === true,
    api_addr: asString(record.api_addr),
    last_heartbeat_at: asString(record.last_heartbeat_at),
    last_error: asString(record.last_error),
  }
}

function normalizeNodeSeed(seed: WeChatClusterNodeSeed): WeChatClusterNode {
  return {
    node_id: seed.node_id,
    ssh_host: seed.ssh_host ?? seed.node_id,
    status: seed.status ?? 'unknown',
    capacity: Math.max(1, Math.floor(seed.capacity ?? 1)),
    active_accounts: 0,
    pending_scans: 0,
    queue_lag_ms: 0,
    draining: false,
    api_addr: seed.api_addr,
  }
}

function normalizeBinding(value: unknown): WeChatClusterBinding | null {
  const record = asRecord(value)
  const bindingId = asString(record.binding_id)
  const sessionId = asString(record.binding_session_id)
  const nodeId = asString(record.node_id)
  if (!bindingId || !sessionId || !nodeId) return null
  return {
    binding_id: bindingId,
    binding_session_id: sessionId,
    node_id: nodeId,
    state: asBindingState(record.state),
    provider: asProvider(record.provider),
    qr_url: asString(record.qr_url),
    expires_at: asString(record.expires_at),
    account_id: asString(record.account_id),
    display_name: asString(record.display_name),
    remote_account_path: asString(record.remote_account_path),
    scan_status: asScanStatus(record.scan_status),
    identity_status: asIdentityStatus(record.identity_status),
    created_at: asString(record.created_at) ?? nowIso(),
    bound_at: asString(record.bound_at),
    last_seen_at: asString(record.last_seen_at),
  }
}

function normalizeSession(value: unknown): WeChatClusterSession | null {
  const record = asRecord(value)
  const sessionId = asString(record.canonical_session_id)
  const accountId = asString(record.account_id)
  const nodeId = asString(record.node_id)
  if (!sessionId || !accountId || !nodeId) return null
  return {
    canonical_session_id: sessionId,
    account_id: accountId,
    node_id: nodeId,
    status: record.status === 'idle' || record.status === 'closed' ? record.status : 'active',
    title: asString(record.title),
    last_message_at: asString(record.last_message_at),
  }
}

function mergeSeedNodes(
  nodes: WeChatClusterNode[],
  seeds: WeChatClusterNodeSeed[] = [],
): WeChatClusterNode[] {
  const byId = new Map(nodes.map(node => [node.node_id, node]))
  for (const seed of seeds) {
    if (!seed.node_id || byId.has(seed.node_id)) continue
    byId.set(seed.node_id, normalizeNodeSeed(seed))
  }
  return Array.from(byId.values())
}

function defaultClusterState(seeds: WeChatClusterNodeSeed[] = []): WeChatClusterState {
  return {
    version: 'wechat-cluster-v1',
    updated_at: nowIso(),
    nodes: seeds.map(normalizeNodeSeed),
    bindings: [],
    sessions: [],
  }
}

export function readWeChatClusterState(
  statePath: string,
  options: { defaultNodes?: WeChatClusterNodeSeed[] } = {},
): WeChatClusterState {
  const raw = asRecord(readJson(statePath))
  if (raw.version !== 'wechat-cluster-v1') return defaultClusterState(options.defaultNodes)
  return {
    version: 'wechat-cluster-v1',
    updated_at: asString(raw.updated_at) ?? nowIso(),
    nodes: mergeSeedNodes(
      Array.isArray(raw.nodes)
        ? raw.nodes.map(normalizeNode).filter((node): node is WeChatClusterNode => Boolean(node))
        : [],
      options.defaultNodes,
    ),
    bindings: Array.isArray(raw.bindings)
      ? raw.bindings
          .map(normalizeBinding)
          .filter((binding): binding is WeChatClusterBinding => Boolean(binding))
      : [],
    sessions: Array.isArray(raw.sessions)
      ? raw.sessions
          .map(normalizeSession)
          .filter((session): session is WeChatClusterSession => Boolean(session))
      : [],
  }
}

export function persistWeChatClusterState(
  statePath: string,
  state: WeChatClusterState,
): WeChatClusterState {
  const normalized: WeChatClusterStateFile = {
    version: 'wechat-cluster-v1',
    updated_at: nowIso(),
    nodes: mergeSeedNodes(state.nodes).sort((a, b) => a.node_id.localeCompare(b.node_id)),
    bindings: state.bindings.slice(0, 200),
    sessions: state.sessions.slice(0, 500),
  }
  writeJson(statePath, normalized)
  return normalized
}

function nodeScore(node: WeChatClusterNode): number {
  const load = node.active_accounts * 10 + node.pending_scans * 3
  const lagPenalty = Math.ceil(node.queue_lag_ms / 1000)
  const statusPenalty = node.status === 'degraded' ? 25 : 0
  return load + lagPenalty + statusPenalty
}

function isEligibleNode(node: WeChatClusterNode): boolean {
  if (node.draining) return false
  if (node.status !== 'online' && node.status !== 'degraded') return false
  return node.active_accounts + node.pending_scans < node.capacity
}

export function selectWeChatClusterNode(
  state: WeChatClusterState,
  options: { preferredNodeId?: string } = {},
): WeChatClusterSelection {
  if (options.preferredNodeId) {
    const preferred = state.nodes.find(node => node.node_id === options.preferredNodeId)
    if (!preferred) throw new Error(`WeChat cluster node not found: ${options.preferredNodeId}`)
    if (!isEligibleNode(preferred)) {
      throw new Error(`WeChat cluster node is not eligible for new scans: ${preferred.node_id}`)
    }
    return {
      node: preferred,
      score: nodeScore(preferred),
      reason: `preferred node ${preferred.node_id}`,
    }
  }

  const ranked = state.nodes
    .filter(isEligibleNode)
    .map(node => ({ node, score: nodeScore(node) }))
    .sort((a, b) => a.score - b.score || a.node.node_id.localeCompare(b.node.node_id))

  const selected = ranked[0]
  if (!selected) throw new Error('No eligible WeChat cluster node for new scans.')
  return {
    ...selected,
    reason: `least loaded node ${selected.node.node_id}`,
  }
}

function updateNode(
  state: WeChatClusterState,
  nodeId: string,
  updater: (node: WeChatClusterNode) => WeChatClusterNode,
): WeChatClusterNode {
  let updated: WeChatClusterNode | null = null
  state.nodes = state.nodes.map(node => {
    if (node.node_id !== nodeId) return node
    updated = updater(node)
    return updated
  })
  if (!updated) throw new Error(`WeChat cluster node not found: ${nodeId}`)
  return updated
}

export function markWeChatClusterNodeHealth(
  statePath: string,
  input: {
    nodeId: string
    status: WeChatClusterNodeStatus
    capacity?: number
    activeAccounts?: number
    pendingScans?: number
    queueLagMs?: number
    apiAddr?: string
    lastError?: string
    defaultNodes?: WeChatClusterNodeSeed[]
  },
): WeChatClusterState {
  const state = readWeChatClusterState(statePath, { defaultNodes: input.defaultNodes })
  updateNode(state, input.nodeId, node => ({
    ...node,
    status: input.status,
    capacity: input.capacity === undefined ? node.capacity : Math.max(1, Math.floor(input.capacity)),
    active_accounts:
      input.activeAccounts === undefined
        ? node.active_accounts
        : Math.max(0, Math.floor(input.activeAccounts)),
    pending_scans:
      input.pendingScans === undefined ? node.pending_scans : Math.max(0, Math.floor(input.pendingScans)),
    queue_lag_ms:
      input.queueLagMs === undefined ? node.queue_lag_ms : Math.max(0, Math.floor(input.queueLagMs)),
    api_addr: input.apiAddr ?? node.api_addr,
    last_heartbeat_at: nowIso(),
    last_error: input.lastError,
  }))
  return persistWeChatClusterState(statePath, state)
}

export function createWeChatClusterBindingSession(
  statePath: string,
  input: {
    bindingSessionId?: string
    preferredNodeId?: string
    provider?: WeChatBindingProvider
    qrUrl?: string
    qrUrlBase?: string
    expiresInMs?: number
    defaultNodes?: WeChatClusterNodeSeed[]
  } = {},
): WeChatClusterBindingResult {
  const state = readWeChatClusterState(statePath, { defaultNodes: input.defaultNodes })
  const selection = selectWeChatClusterNode(state, { preferredNodeId: input.preferredNodeId })
  const createdAt = Date.now()
  const sessionId = input.bindingSessionId ?? `bind-${crypto.randomUUID()}`
  const provider = input.provider ?? 'ilink_service_account'
  const qrUrlBase = input.qrUrlBase?.replace(/\/+$/g, '')
  const qrUrl =
    input.qrUrl ??
    (qrUrlBase
      ? `${qrUrlBase}/wechat/bind?session=${encodeURIComponent(sessionId)}&node=${encodeURIComponent(selection.node.node_id)}`
      : `longclaw-wechat://bind?session=${encodeURIComponent(sessionId)}&node=${encodeURIComponent(selection.node.node_id)}`)
  const binding: WeChatClusterBinding = {
    binding_id: sessionId,
    binding_session_id: sessionId,
    node_id: selection.node.node_id,
    state: 'qr_pending',
    provider,
    qr_url: qrUrl,
    expires_at: new Date(createdAt + (input.expiresInMs ?? 2 * 60 * 1000)).toISOString(),
    scan_status: provider === 'ilink_service_account' ? 'wait' : undefined,
    identity_status:
      provider === 'ilink_service_account' ? 'ilink_pending' : 'unconfigured',
    created_at: new Date(createdAt).toISOString(),
  }

  state.bindings = [binding, ...state.bindings]
  const updatedNode = updateNode(state, selection.node.node_id, node => ({
    ...node,
    pending_scans: node.pending_scans + 1,
  }))
  const persisted = persistWeChatClusterState(statePath, state)
  return {
    state: persisted,
    binding,
    selected_node: updatedNode,
    selection_reason: selection.reason,
  }
}

export function completeWeChatClusterBindingSession(
  statePath: string,
  input: {
    bindingId?: string
    bindingSessionId?: string
    accountId: string
    displayName?: string
    remoteAccountPath?: string
    identityStatus?: WeChatIdentityStatus
    defaultNodes?: WeChatClusterNodeSeed[]
  },
): WeChatClusterBindingResult {
  const state = readWeChatClusterState(statePath, { defaultNodes: input.defaultNodes })
  const bindingIndex = state.bindings.findIndex(binding =>
    input.bindingId
      ? binding.binding_id === input.bindingId
      : binding.binding_session_id === input.bindingSessionId,
  )
  if (bindingIndex < 0) throw new Error('No pending WeChat cluster binding session.')
  const existing = state.bindings[bindingIndex]!
  if (existing.state !== 'qr_pending') {
    throw new Error(`WeChat cluster binding is not pending: ${existing.state}`)
  }

  const now = nowIso()
  const binding: WeChatClusterBinding = {
    ...existing,
    state: 'bound',
    qr_url: undefined,
    expires_at: undefined,
    account_id: input.accountId,
    display_name: input.displayName,
    remote_account_path: input.remoteAccountPath,
    scan_status: 'confirmed',
    identity_status: input.identityStatus ?? 'ilink_verified',
    bound_at: now,
    last_seen_at: now,
  }
  state.bindings[bindingIndex] = binding
  const updatedNode = updateNode(state, binding.node_id, node => ({
    ...node,
    pending_scans: Math.max(0, node.pending_scans - 1),
    active_accounts: node.active_accounts + 1,
  }))
  const persisted = persistWeChatClusterState(statePath, state)
  return {
    state: persisted,
    binding,
    selected_node: updatedNode,
    selection_reason: `bound on node ${binding.node_id}`,
  }
}

export function recordWeChatClusterSession(
  statePath: string,
  input: {
    canonicalSessionId: string
    accountId: string
    nodeId: string
    title?: string
    status?: WeChatClusterSession['status']
    lastMessageAt?: string
    defaultNodes?: WeChatClusterNodeSeed[]
  },
): WeChatClusterState {
  const state = readWeChatClusterState(statePath, { defaultNodes: input.defaultNodes })
  const session: WeChatClusterSession = {
    canonical_session_id: input.canonicalSessionId,
    account_id: input.accountId,
    node_id: input.nodeId,
    status: input.status ?? 'active',
    title: input.title,
    last_message_at: input.lastMessageAt ?? nowIso(),
  }
  state.sessions = [
    session,
    ...state.sessions.filter(item => item.canonical_session_id !== session.canonical_session_id),
  ]
  return persistWeChatClusterState(statePath, state)
}
