import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('agentAPI', {
  // Agent communication
  query: (message: string) => ipcRenderer.invoke('agent:query', message),
  clear: () => ipcRenderer.invoke('agent:clear'),
  getMode: () => ipcRenderer.invoke('agent:mode'),

  // CWD management
  getCwd: () => ipcRenderer.invoke('cwd:get'),
  selectCwd: () => ipcRenderer.invoke('cwd:select'),
  setCwd: (path: string) => ipcRenderer.invoke('cwd:set', path),

  // Skills
  getSkills: () => ipcRenderer.invoke('skills:list'),

  // Streaming events
  onText: (cb: (text: string) => void) => {
    const listener = (_: any, text: string) => cb(text)
    ipcRenderer.on('agent:text', listener)
    return () => ipcRenderer.removeListener('agent:text', listener)
  },

  onTool: (cb: (tool: { name: string; input: any }) => void) => {
    const listener = (_: any, tool: any) => cb(tool)
    ipcRenderer.on('agent:tool', listener)
    return () => ipcRenderer.removeListener('agent:tool', listener)
  },

  onResult: (cb: (result: any) => void) => {
    const listener = (_: any, result: any) => cb(result)
    ipcRenderer.on('agent:result', listener)
    return () => ipcRenderer.removeListener('agent:result', listener)
  },

  onError: (cb: (error: string) => void) => {
    const listener = (_: any, error: string) => cb(error)
    ipcRenderer.on('agent:error', listener)
    return () => ipcRenderer.removeListener('agent:error', listener)
  },
})

contextBridge.exposeInMainWorld('longclawControlPlane', {
  getOverview: () => ipcRenderer.invoke('control-plane:get-overview'),
  listRuns: () => ipcRenderer.invoke('control-plane:list-runs'),
  listWorkItems: () => ipcRenderer.invoke('control-plane:list-work-items'),
  getPackDashboard: (packId: string) =>
    ipcRenderer.invoke('control-plane:get-pack-dashboard', packId),
  listArtifacts: (runId: string, domain: string) =>
    ipcRenderer.invoke('control-plane:list-artifacts', runId, domain),
  executeAction: (actionId: string, payload?: Record<string, unknown>) =>
    ipcRenderer.invoke('control-plane:execute-action', actionId, payload ?? {}),
  performLocalAction: (action: { kind: string; payload?: Record<string, unknown> }) =>
    ipcRenderer.invoke('control-plane:local-action', action),
  readArtifactPreview: (uri: string) =>
    ipcRenderer.invoke('control-plane:read-artifact-preview', uri),
})

contextBridge.exposeInMainWorld('longclawLaunch', {
  launch: (intent: Record<string, unknown>) => ipcRenderer.invoke('launch:submit', intent),
  listTasks: (limit?: number) => ipcRenderer.invoke('launch:list-tasks', limit),
  getTask: (taskId: string) => ipcRenderer.invoke('launch:get-task', taskId),
})

contextBridge.exposeInMainWorld('longclawCapabilitySubstrate', {
  getSummary: () => ipcRenderer.invoke('capability-substrate:get-summary'),
})

contextBridge.exposeInMainWorld('longclawWindow', {
  setLocale: (locale: 'zh-CN' | 'en-US') => ipcRenderer.invoke('window:set-locale', locale),
})
