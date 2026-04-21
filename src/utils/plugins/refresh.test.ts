import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearAllCaches: vi.fn(),
  getPluginCommands: vi.fn(),
  getPluginSkills: vi.fn(),
  loadPluginHooks: vi.fn(),
  loadPluginLspServers: vi.fn(),
  loadPluginMcpServers: vi.fn(),
  clearPluginCacheExclusions: vi.fn(),
  loadAllPlugins: vi.fn(),
  getAgentDefinitionsWithOverrides: vi.fn(),
  reinitializeLspServerManager: vi.fn(),
}))

vi.mock('../../bootstrap/state.js', () => ({
  getOriginalCwd: () => '/tmp/project',
}))

vi.mock('../../services/lsp/manager.js', () => ({
  reinitializeLspServerManager: mocks.reinitializeLspServerManager,
}))

vi.mock('../../tools/AgentTool/loadAgentsDir.js', () => ({
  getAgentDefinitionsWithOverrides: mocks.getAgentDefinitionsWithOverrides,
}))

vi.mock('./cacheUtils.js', () => ({
  clearAllCaches: mocks.clearAllCaches,
}))

vi.mock('./loadPluginCommands.js', () => ({
  getPluginCommands: mocks.getPluginCommands,
  getPluginSkills: mocks.getPluginSkills,
}))

vi.mock('./loadPluginHooks.js', () => ({
  loadPluginHooks: mocks.loadPluginHooks,
}))

vi.mock('./lspPluginIntegration.js', () => ({
  loadPluginLspServers: mocks.loadPluginLspServers,
}))

vi.mock('./mcpPluginIntegration.js', () => ({
  loadPluginMcpServers: mocks.loadPluginMcpServers,
}))

vi.mock('./orphanedPluginFilter.js', () => ({
  clearPluginCacheExclusions: mocks.clearPluginCacheExclusions,
}))

vi.mock('./pluginLoader.js', () => ({
  loadAllPlugins: mocks.loadAllPlugins,
}))

import { refreshActivePlugins } from './refresh.js'

describe('refreshActivePlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadPluginHooks.mockResolvedValue(undefined)
    mocks.loadPluginLspServers.mockResolvedValue(null)
    mocks.loadPluginMcpServers.mockResolvedValue(null)
    mocks.getAgentDefinitionsWithOverrides.mockResolvedValue({ allAgents: [] })
  })

  it('adds plugin skills to the refreshed REPL command state', async () => {
    const pluginCommand = {
      name: 'andrej-karpathy-skills:about',
      type: 'prompt',
      source: 'plugin',
    }
    const pluginSkill = {
      name: 'andrej-karpathy-skills:karpathy-guidelines',
      type: 'prompt',
      source: 'plugin',
      loadedFrom: 'plugin',
    }
    const enabledPlugin = { name: 'andrej-karpathy-skills' }

    mocks.loadAllPlugins.mockResolvedValue({
      enabled: [enabledPlugin],
      disabled: [],
      errors: [],
    })
    mocks.getPluginCommands.mockResolvedValue([pluginCommand])
    mocks.getPluginSkills.mockResolvedValue([pluginSkill])

    let state: any = {
      plugins: {
        enabled: [],
        disabled: [],
        commands: [],
        errors: [],
        needsRefresh: true,
      },
      agentDefinitions: { allAgents: [] },
      mcp: { pluginReconnectKey: 0 },
    }

    const setAppState = (updater: (prev: typeof state) => typeof state) => {
      state = updater(state)
      return state
    }

    const result = await refreshActivePlugins(setAppState)

    expect(mocks.clearAllCaches).toHaveBeenCalledOnce()
    expect(mocks.clearPluginCacheExclusions).toHaveBeenCalledOnce()
    expect(mocks.getPluginSkills).toHaveBeenCalledOnce()
    expect(state.plugins.commands).toEqual([pluginCommand, pluginSkill])
    expect(state.plugins.enabled).toEqual([enabledPlugin])
    expect(state.plugins.needsRefresh).toBe(false)
    expect(state.mcp.pluginReconnectKey).toBe(1)
    expect(result.command_count).toBe(2)
    expect(result.pluginCommands).toEqual([pluginCommand, pluginSkill])
    expect(mocks.reinitializeLspServerManager).toHaveBeenCalledOnce()
  })
})
