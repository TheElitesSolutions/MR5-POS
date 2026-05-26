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
  toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'),
}

// Website Manager API — typed wrappers around the WEBSITE_CHANNELS in
// shared/ipc-channels.ts. Strings are duplicated here because preload runs
// in a sandboxed context and cannot easily import from src.
const websiteAPI = {
  listItems: () =>
    ipcRenderer.invoke('mr5pos:website:list-items'),
  listCategories: () =>
    ipcRenderer.invoke('mr5pos:website:list-categories'),
  listAddOns: () =>
    ipcRenderer.invoke('mr5pos:website:list-addons'),
  setCategoryVisibility: (payload: { categoryUuid: string; visible: boolean; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:set-category-visibility', payload),
  // Destructive wipe-and-replace: deletes everything on Supabase, re-inserts
  // from POS. Requires `{ confirmed: true }` — invoking without it returns
  // `{ data: { requiresConfirmation: true } }` and does NOT touch Supabase.
  syncFromPos: (opts?: { confirmed?: boolean }) =>
    ipcRenderer.invoke('mr5pos:sync:manual', opts),
  getSettings: () =>
    ipcRenderer.invoke('mr5pos:website:get-settings'),
  updateSettings: (payload: { patch: Record<string, unknown>; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:update-settings', payload),
  reorderItems: (payload: { categoryUuid: string; orderedUuids: string[]; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:reorder-items', payload),
  setFeatured: (payload: { itemUuid: string; value: boolean; actor: string; expectedUpdatedAt?: string }) =>
    ipcRenderer.invoke('mr5pos:website:set-featured', payload),
  setVisibility: (payload: { itemUuid: string; visible: boolean; actor: string; expectedUpdatedAt?: string }) =>
    ipcRenderer.invoke('mr5pos:website:set-visibility', payload),
  bulkSetVisibility: (payload: { itemUuids: string[]; visible: boolean; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:bulk-set-visibility', payload),
  updateItemContent: (payload: { itemUuid: string; patch: { description?: string | null }; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:update-item-content', payload),
  uploadItemImage: (payload: { itemUuid: string; bytes: ArrayBuffer; mime: string; actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:upload-item-image', payload),
  resetWebsite: (payload: { actor: string }) =>
    ipcRenderer.invoke('mr5pos:website:reset', payload),
}

// Expose at the correct path that matches TypeScript definitions
contextBridge.exposeInMainWorld('electronAPI', {
  ipc: handler,
  updater: updaterAPI,
  diagnostic: diagnosticAPI,
  app: appAPI,
  website: websiteAPI,
})

export type IpcHandler = typeof handler
export type UpdaterAPI = typeof updaterAPI
export type DiagnosticAPI = typeof diagnosticAPI
export type AppAPI = typeof appAPI
export type WebsiteAPI = typeof websiteAPI
