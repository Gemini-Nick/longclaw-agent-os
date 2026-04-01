import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('agentAPI', {
  query: (message: string) => ipcRenderer.invoke('agent:query', message),
  clear: () => ipcRenderer.invoke('agent:clear'),

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
