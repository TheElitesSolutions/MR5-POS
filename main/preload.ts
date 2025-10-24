import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value)
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  },
  once(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.once(channel, subscription)
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel)
  },
}

// Updater event channels
const UPDATER_EVENTS = {
  CHECKING_FOR_UPDATE: 'updater:checking-for-update',
  UPDATE_AVAILABLE: 'updater:update-available',
  UPDATE_NOT_AVAILABLE: 'updater:update-not-available',
  DOWNLOAD_PROGRESS: 'updater:download-progress',
  UPDATE_DOWNLOADED: 'updater:update-downloaded',
  ERROR: 'updater:error',
}

// Updater API for renderer process
const updaterAPI = {
  // IPC invoke methods
  checkForUpdates: () => ipcRenderer.invoke('mr5pos:updater:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('mr5pos:updater:download-update'),
  installUpdate: () => ipcRenderer.invoke('mr5pos:updater:install-update'),
  getStatus: () => ipcRenderer.invoke('mr5pos:updater:get-status'),
  setAutoUpdate: (enabled: boolean) => ipcRenderer.invoke('mr5pos:updater:set-auto-update', enabled),
  cancelUpdate: () => ipcRenderer.invoke('mr5pos:updater:cancel-update'),
  skipVersion: (version: string) => ipcRenderer.invoke('mr5pos:updater:skip-version', version),

  // Event listeners
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on(UPDATER_EVENTS.CHECKING_FOR_UPDATE, callback)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.CHECKING_FOR_UPDATE, callback)
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on(UPDATER_EVENTS.UPDATE_AVAILABLE, handler)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_AVAILABLE, handler)
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on(UPDATER_EVENTS.UPDATE_NOT_AVAILABLE, callback)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_NOT_AVAILABLE, callback)
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_event: IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on(UPDATER_EVENTS.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.DOWNLOAD_PROGRESS, handler)
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on(UPDATER_EVENTS.UPDATE_DOWNLOADED, handler)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_DOWNLOADED, handler)
  },
  onUpdateError: (callback: (error: any) => void) => {
    const handler = (_event: IpcRendererEvent, error: any) => callback(error)
    ipcRenderer.on(UPDATER_EVENTS.ERROR, handler)
    return () => ipcRenderer.removeListener(UPDATER_EVENTS.ERROR, handler)
  },
}

// Diagnostic API for renderer process
const diagnosticAPI = {
  runDatabaseDiagnostics: () => ipcRenderer.invoke('diagnostic:run-database-diagnostics'),
  createAdminUser: () => ipcRenderer.invoke('diagnostic:create-admin-user'),
}

// App control API for renderer process
const appAPI = {
  quit: () => ipcRenderer.invoke('app:quit'),
}

// Expose at the correct path that matches TypeScript definitions
contextBridge.exposeInMainWorld('electronAPI', {
  ipc: handler,
  updater: updaterAPI,
  diagnostic: diagnosticAPI,
  app: appAPI,
})

export type IpcHandler = typeof handler
export type UpdaterAPI = typeof updaterAPI
export type DiagnosticAPI = typeof diagnosticAPI
export type AppAPI = typeof appAPI
