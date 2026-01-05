import { contextBridge, ipcRenderer } from 'electron';
const handler = {
    send(channel, value) {
        ipcRenderer.send(channel, value);
    },
    on(channel, callback) {
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    },
    invoke(channel, ...args) {
        return ipcRenderer.invoke(channel, ...args);
    },
    once(channel, callback) {
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.once(channel, subscription);
    },
    removeAllListeners(channel) {
        ipcRenderer.removeAllListeners(channel);
    },
};
// Updater event channels
const UPDATER_EVENTS = {
    CHECKING_FOR_UPDATE: 'updater:checking-for-update',
    UPDATE_AVAILABLE: 'updater:update-available',
    UPDATE_NOT_AVAILABLE: 'updater:update-not-available',
    DOWNLOAD_PROGRESS: 'updater:download-progress',
    UPDATE_DOWNLOADED: 'updater:update-downloaded',
    ERROR: 'updater:error',
};
// Updater API for renderer process
const updaterAPI = {
    // IPC invoke methods
    checkForUpdates: () => ipcRenderer.invoke('mr5pos:updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('mr5pos:updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('mr5pos:updater:install-update'),
    getStatus: () => ipcRenderer.invoke('mr5pos:updater:get-status'),
    setAutoUpdate: (enabled) => ipcRenderer.invoke('mr5pos:updater:set-auto-update', enabled),
    cancelUpdate: () => ipcRenderer.invoke('mr5pos:updater:cancel-update'),
    skipVersion: (version) => ipcRenderer.invoke('mr5pos:updater:skip-version', version),
    // Event listeners
    onUpdateChecking: (callback) => {
        ipcRenderer.on(UPDATER_EVENTS.CHECKING_FOR_UPDATE, callback);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.CHECKING_FOR_UPDATE, callback);
    },
    onUpdateAvailable: (callback) => {
        const handler = (_event, info) => callback(info);
        ipcRenderer.on(UPDATER_EVENTS.UPDATE_AVAILABLE, handler);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_AVAILABLE, handler);
    },
    onUpdateNotAvailable: (callback) => {
        ipcRenderer.on(UPDATER_EVENTS.UPDATE_NOT_AVAILABLE, callback);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_NOT_AVAILABLE, callback);
    },
    onDownloadProgress: (callback) => {
        const handler = (_event, progress) => callback(progress);
        ipcRenderer.on(UPDATER_EVENTS.DOWNLOAD_PROGRESS, handler);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.DOWNLOAD_PROGRESS, handler);
    },
    onUpdateDownloaded: (callback) => {
        const handler = (_event, info) => callback(info);
        ipcRenderer.on(UPDATER_EVENTS.UPDATE_DOWNLOADED, handler);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.UPDATE_DOWNLOADED, handler);
    },
    onUpdateError: (callback) => {
        const handler = (_event, error) => callback(error);
        ipcRenderer.on(UPDATER_EVENTS.ERROR, handler);
        return () => ipcRenderer.removeListener(UPDATER_EVENTS.ERROR, handler);
    },
};
// Diagnostic API for renderer process
const diagnosticAPI = {
    runDatabaseDiagnostics: () => ipcRenderer.invoke('diagnostic:run-database-diagnostics'),
    createAdminUser: () => ipcRenderer.invoke('diagnostic:create-admin-user'),
};
// App control API for renderer process
const appAPI = {
    quit: () => ipcRenderer.invoke('app:quit'),
    toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'),
};
// Expose at the correct path that matches TypeScript definitions
contextBridge.exposeInMainWorld('electronAPI', {
    ipc: handler,
    updater: updaterAPI,
    diagnostic: diagnosticAPI,
    app: appAPI,
});
