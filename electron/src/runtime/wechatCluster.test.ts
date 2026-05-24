import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  completeWeChatClusterBindingSession,
  createWeChatClusterBindingSession,
  markWeChatClusterNodeHealth,
  readWeChatClusterState,
  recordWeChatClusterSession,
  selectWeChatClusterNode,
  type WeChatClusterNodeSeed,
} from './wechatCluster.js'

const tempDirs: string[] = []

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const defaultNodes: WeChatClusterNodeSeed[] = [
  { node_id: 'dimit', ssh_host: 'dimit', status: 'online', capacity: 1 },
  { node_id: 'vircs', ssh_host: 'vircs', status: 'online', capacity: 1 },
]

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('wechatCluster', () => {
  it('seeds cluster nodes without requiring a previous state file', () => {
    const root = makeTempDir('longclaw-wechat-cluster-seed-')
    const clusterPath = path.join(root, 'wechat-cluster.json')

    const state = readWeChatClusterState(clusterPath, { defaultNodes })

    expect(state.version).toBe('wechat-cluster-v1')
    expect(state.nodes.map(node => node.node_id)).toEqual(['dimit', 'vircs'])
    expect(state.bindings).toHaveLength(0)
  })

  it('selects the least loaded eligible node and skips drained nodes', () => {
    const root = makeTempDir('longclaw-wechat-cluster-select-')
    const clusterPath = path.join(root, 'wechat-cluster.json')
    markWeChatClusterNodeHealth(clusterPath, {
      nodeId: 'dimit',
      status: 'online',
      activeAccounts: 1,
      defaultNodes: [
        { node_id: 'dimit', status: 'online', capacity: 3 },
        { node_id: 'vircs', status: 'online', capacity: 3 },
      ],
    })

    let state = readWeChatClusterState(clusterPath)
    expect(selectWeChatClusterNode(state).node.node_id).toBe('vircs')

    state = {
      ...state,
      nodes: state.nodes.map(node =>
        node.node_id === 'vircs' ? { ...node, draining: true } : node,
      ),
    }

    expect(selectWeChatClusterNode(state).node.node_id).toBe('dimit')
  })

  it('allocates two phone QR scans across two VPS nodes', () => {
    const root = makeTempDir('longclaw-wechat-cluster-qr-')
    const clusterPath = path.join(root, 'wechat-cluster.json')

    const first = createWeChatClusterBindingSession(clusterPath, {
      defaultNodes,
      bindingSessionId: 'bind-phone-a',
      qrUrlBase: 'https://control.longclaw.test',
    })
    const second = createWeChatClusterBindingSession(clusterPath, {
      defaultNodes,
      qrUrlBase: 'https://control.longclaw.test',
    })

    expect(first.binding.state).toBe('qr_pending')
    expect(second.binding.state).toBe('qr_pending')
    expect(first.binding.node_id).toBe('dimit')
    expect(second.binding.node_id).toBe('vircs')
    expect(first.binding.binding_session_id).toBe('bind-phone-a')
    expect(first.binding.qr_url).toContain('node=dimit')
    expect(second.binding.qr_url).toContain('node=vircs')

    const state = readWeChatClusterState(clusterPath)
    expect(state.bindings).toHaveLength(2)
    expect(state.nodes.find(node => node.node_id === 'dimit')?.pending_scans).toBe(1)
    expect(state.nodes.find(node => node.node_id === 'vircs')?.pending_scans).toBe(1)
  })

  it('keeps account-to-node affinity after both phones confirm scan', () => {
    const root = makeTempDir('longclaw-wechat-cluster-bound-')
    const clusterPath = path.join(root, 'wechat-cluster.json')
    const first = createWeChatClusterBindingSession(clusterPath, { defaultNodes })
    const second = createWeChatClusterBindingSession(clusterPath, { defaultNodes })

    const accountA = completeWeChatClusterBindingSession(clusterPath, {
      bindingId: first.binding.binding_id,
      accountId: 'wx-phone-a',
      displayName: 'Phone A',
      remoteAccountPath: '~/.weclaw/accounts/wx-phone-a.json',
    })
    const accountB = completeWeChatClusterBindingSession(clusterPath, {
      bindingId: second.binding.binding_id,
      accountId: 'wx-phone-b',
      displayName: 'Phone B',
      remoteAccountPath: '~/.weclaw/accounts/wx-phone-b.json',
    })

    expect(accountA.binding.node_id).toBe('dimit')
    expect(accountA.binding.account_id).toBe('wx-phone-a')
    expect(accountB.binding.node_id).toBe('vircs')
    expect(accountB.binding.account_id).toBe('wx-phone-b')

    const state = readWeChatClusterState(clusterPath)
    expect(state.nodes.find(node => node.node_id === 'dimit')?.active_accounts).toBe(1)
    expect(state.nodes.find(node => node.node_id === 'dimit')?.pending_scans).toBe(0)
    expect(state.nodes.find(node => node.node_id === 'vircs')?.active_accounts).toBe(1)
    expect(state.nodes.find(node => node.node_id === 'vircs')?.pending_scans).toBe(0)
  })

  it('records sessions with node and account metadata for reply routing', () => {
    const root = makeTempDir('longclaw-wechat-cluster-session-')
    const clusterPath = path.join(root, 'wechat-cluster.json')
    const first = createWeChatClusterBindingSession(clusterPath, { defaultNodes })
    completeWeChatClusterBindingSession(clusterPath, {
      bindingId: first.binding.binding_id,
      accountId: 'wx-phone-a',
    })

    const state = recordWeChatClusterSession(clusterPath, {
      canonicalSessionId: 'wechat-thread-a',
      accountId: 'wx-phone-a',
      nodeId: 'dimit',
      title: 'ping from A',
    })

    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]?.canonical_session_id).toBe('wechat-thread-a')
    expect(state.sessions[0]?.account_id).toBe('wx-phone-a')
    expect(state.sessions[0]?.node_id).toBe('dimit')
  })
})
