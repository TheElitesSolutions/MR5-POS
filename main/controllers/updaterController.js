import { autoUpdater } from 'electron-updater';
import { BaseController } from './baseController';
import { logInfo, logError, logDebug } from '../error-handler';
import { getIsDev } from '../utils/environment';
import { getBackupManager } from '../utils/backupManager';
/**
 * IPC channels for updater operations
 */
export const UPDATER_CHANNELS = {
    CHECK_FOR_UPDATES: 'mr5pos:updater:check-for-updates',
    DOWNLOAD_UPDATE: 'mr5pos:updater:download-update',
    INSTALL_UPDATE: 'mr5pos:updater:install-update',
    GET_UPDATE_STATUS: 'mr5pos:updater:get-status',
    SET_AUTO_UPDATE: 'mr5pos:updater:set-auto-update',
    CANCEL_UPDATE: 'mr5pos:updater:cancel-update',
    SKIP_VERSION: 'mr5pos:updater:skip-version',
};
/**
 * Updater events sent to renderer
 */
export const UPDATER_EVENTS = {
    CHECKING_FOR_UPDATE: 'updater:checking-for-update',
    UPDATE_AVAILABLE: 'updater:update-available',
    UPDATE_NOT_AVAILABLE: 'updater:update-not-available',
    DOWNLOAD_PROGRESS: 'updater:download-progress',
    UPDATE_DOWNLOADED: 'updater:update-downloaded',
    ERROR: 'updater:error',
};
/**
 * UpdaterController
 * Manages application auto-updates using electron-updater
 * Follows the IPC pattern used throughout the application
 */
export class UpdaterController extends BaseController {
    constructor() {
        super();
        this.mainWindow = null;
        this.updateCheckInterval = null;
        this.status = {
            checking: false,
            available: false,
            downloading: false,
            downloaded: false,
            error: null,
            updateInfo: null,
            progress: null,
            getIsDev: getIsDev,
            autoUpdateEnabled: !getIsDev(),
        };
        this.skippedVersions = new Set();
        logInfo('Initializing UpdaterController');
        this.setupController();
    }
    /**
     * Initialize the updater controller (called by BaseController)
     */
    setupController() {
        this.setupAutoUpdater();
        this.setupEventHandlers();
    }
    /**
     * Setup auto-updater configuration
     * IMPORTANT: This must be called AFTER app.whenReady() because autoUpdater
     * accesses app.getVersion() during initialization
     */
    setupAutoUpdater() {
        // Skip in development mode
        if (getIsDev()) {
            logInfo('Auto-updater disabled in development mode');
            return;
        }
        // Skip if running in Node.js mode (not Electron)
        try {
            const { app } = require('electron');
            if (!app || !app.isReady || !app.isReady()) {
                logInfo('Auto-updater initialization skipped - app not ready yet');
                return;
            }
        }
        catch (error) {
            logInfo('Auto-updater initialization skipped - Electron app not available');
            return;
        }
        try {
            // Configure auto-updater
            autoUpdater.autoDownload = true; // Automatically download updates in background
            autoUpdater.autoInstallOnAppQuit = true; // Auto install when app quits
            autoUpdater.allowDowngrade = false; // Don't allow downgrades
            autoUpdater.allowPrerelease = false; // Only stable releases
            // For private repositories, set GitHub token if available
            // Token can be set via environment variable or hardcoded (not recommended for production)
            if (process.env.GH_TOKEN) {
                autoUpdater.setFeedURL({
                    provider: 'github',
                    owner: 'TheElitesSolutions',
                    repo: 'MR5-POS',
                    private: true,
                    token: process.env.GH_TOKEN,
                });
                logInfo('Auto-updater configured with GitHub token for private repository');
            }
            else {
                logInfo('Auto-updater configured for public repository (no GH_TOKEN found)');
            }
            // Configure logging
            autoUpdater.logger = {
                info: message => logInfo(message, 'AutoUpdater'),
                warn: message => logInfo(message, 'AutoUpdater'),
                error: message => logError(new Error(message), 'AutoUpdater'),
                debug: message => logDebug(message, 'AutoUpdater'),
            };
            logInfo('Auto-updater configured successfully');
        }
        catch (error) {
            logError(error, 'UpdaterController setup');
        }
    }
    /**
     * Setup all auto-updater event handlers
     */
    setupEventHandlers() {
        if (getIsDev())
            return;
        // Skip if app is not ready (prevents crash during module initialization)
        try {
            const { app } = require('electron');
            if (!app || !app.isReady || !app.isReady()) {
                logInfo('Auto-updater event handlers skipped - app not ready yet');
                return;
            }
        }
        catch (error) {
            logInfo('Auto-updater event handlers skipped - Electron app not available');
            return;
        }
        // Checking for updates
        autoUpdater.on('checking-for-update', () => {
            this.status.checking = true;
            this.status.error = null;
            logInfo('Checking for application updates...');
            this.notifyRenderer(UPDATER_EVENTS.CHECKING_FOR_UPDATE, null);
        });
        // Update available
        autoUpdater.on('update-available', (info) => {
            this.status.checking = false;
            this.status.available = true;
            this.status.updateInfo = info;
            // Check if this version was skipped
            if (this.skippedVersions.has(info.version)) {
                logInfo(`Update ${info.version} was previously skipped by user`);
                this.status.available = false;
                return;
            }
            logInfo(`Update available: ${info.version}`);
            this.notifyRenderer(UPDATER_EVENTS.UPDATE_AVAILABLE, info);
        });
        // No update available
        autoUpdater.on('update-not-available', (info) => {
            this.status.checking = false;
            this.status.available = false;
            logInfo('Application is up to date');
            this.notifyRenderer(UPDATER_EVENTS.UPDATE_NOT_AVAILABLE, info);
        });
        // Download progress
        autoUpdater.on('download-progress', (progress) => {
            this.status.downloading = true;
            this.status.progress = progress;
            const message = `Download speed: ${Math.round(progress.bytesPerSecond / 1024)}KB/s - ${Math.round(progress.percent)}%`;
            logDebug(message);
            this.notifyRenderer(UPDATER_EVENTS.DOWNLOAD_PROGRESS, progress);
            // Update window progress bar
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.setProgressBar(progress.percent / 100);
            }
        });
        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            this.status.downloading = false;
            this.status.downloaded = true;
            this.status.progress = null;
            logInfo(`Update downloaded: ${info.version}`);
            // Clear progress bar
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.setProgressBar(-1);
            }
            this.notifyRenderer(UPDATER_EVENTS.UPDATE_DOWNLOADED, info);
        });
        // Error occurred
        autoUpdater.on('error', (error) => {
            this.status.checking = false;
            this.status.downloading = false;
            this.status.error = error.message;
            logError(error, 'AutoUpdater');
            // Clear progress bar on error
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.setProgressBar(-1);
            }
            this.notifyRenderer(UPDATER_EVENTS.ERROR, {
                message: error.message,
                stack: error.stack,
            });
        });
        logInfo('Auto-updater event handlers configured');
    }
    /**
     * Register IPC handlers
     */
    registerHandlers() {
        // Check for updates
        this.registerHandler(UPDATER_CHANNELS.CHECK_FOR_UPDATES, this.checkForUpdates.bind(this));
        // Download update
        this.registerHandler(UPDATER_CHANNELS.DOWNLOAD_UPDATE, this.downloadUpdate.bind(this));
        // Install update
        this.registerHandler(UPDATER_CHANNELS.INSTALL_UPDATE, this.installUpdate.bind(this));
        // Get update status
        this.registerHandler(UPDATER_CHANNELS.GET_UPDATE_STATUS, this.getUpdateStatus.bind(this));
        // Set auto-update enabled/disabled
        this.registerHandler(UPDATER_CHANNELS.SET_AUTO_UPDATE, this.setAutoUpdate.bind(this));
        // Cancel update download
        this.registerHandler(UPDATER_CHANNELS.CANCEL_UPDATE, this.cancelUpdate.bind(this));
        // Skip version
        this.registerHandler(UPDATER_CHANNELS.SKIP_VERSION, this.skipVersion.bind(this));
        logInfo('All updater IPC handlers registered');
    }
    /**
     * Set the main window reference
     */
    setMainWindow(window) {
        this.mainWindow = window;
        logInfo('Main window reference set for updater');
    }
    /**
     * Start automatic update checking
     */
    startAutoUpdateCheck(intervalHours = 6) {
        if (getIsDev() || !this.status.autoUpdateEnabled) {
            logInfo('Auto-update checking disabled');
            return;
        }
        // Initial check after 5 minutes
        setTimeout(() => {
            this.performUpdateCheck();
        }, 5 * 60 * 1000);
        // Periodic checks
        this.updateCheckInterval = setInterval(() => {
            this.performUpdateCheck();
        }, intervalHours * 60 * 60 * 1000);
        logInfo(`Auto-update checking started (every ${intervalHours} hours)`);
    }
    /**
     * Stop automatic update checking
     */
    stopAutoUpdateCheck() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
            logInfo('Auto-update checking stopped');
        }
    }
    /**
     * Perform update check
     */
    async performUpdateCheck() {
        if (getIsDev())
            return;
        try {
            await autoUpdater.checkForUpdates();
        }
        catch (error) {
            logError(error, 'Update check failed');
        }
    }
    /**
     * IPC Handler: Check for updates
     */
    async checkForUpdates(_event) {
        try {
            if (getIsDev()) {
                return this.createSuccessResponse({
                    updateInfo: null,
                    checking: false,
                }, 'Update checking disabled in development mode');
            }
            await this.performUpdateCheck();
            return this.createSuccessResponse({
                updateInfo: this.status.updateInfo,
                checking: this.status.checking,
            });
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to check for updates');
        }
    }
    /**
     * IPC Handler: Download update
     */
    async downloadUpdate(_event) {
        try {
            if (getIsDev()) {
                return this.createErrorResponse('Update download disabled in development mode');
            }
            if (!this.status.available) {
                return this.createErrorResponse('No update available to download');
            }
            // CRITICAL: Create pre-update backup before downloading
            logInfo('Creating pre-update backup before download...');
            const backupManager = getBackupManager();
            const updateVersion = this.status.updateInfo?.version || 'unknown';
            const backupResult = await backupManager.createPreUpdateBackup(updateVersion);
            if (!backupResult.success) {
                logError(new Error(`Failed to create pre-update backup: ${backupResult.error}`), 'UpdaterController');
                return this.createErrorResponse(`Cannot proceed with update - backup failed: ${backupResult.error}`);
            }
            logInfo(`Pre-update backup created successfully: ${backupResult.path}`);
            // Proceed with download now that backup is safe
            await autoUpdater.downloadUpdate();
            return this.createSuccessResponse({
                downloading: true,
            }, 'Update download started (backup created)');
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to download update');
        }
    }
    /**
     * IPC Handler: Install update
     */
    async installUpdate(_event) {
        try {
            if (getIsDev()) {
                return this.createErrorResponse('Update installation disabled in development mode');
            }
            if (!this.status.downloaded) {
                return this.createErrorResponse('No update downloaded to install');
            }
            // This will quit the app and install the update
            autoUpdater.quitAndInstall(false, true);
            return this.createSuccessResponse({
                installing: true,
            }, 'Installing update and restarting...');
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to install update');
        }
    }
    /**
     * IPC Handler: Get update status
     */
    async getUpdateStatus(_event) {
        try {
            return this.createSuccessResponse(this.status);
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get update status');
        }
    }
    /**
     * IPC Handler: Set auto-update enabled
     */
    async setAutoUpdate(_event, enabled) {
        try {
            this.status.autoUpdateEnabled = enabled && !getIsDev();
            if (enabled && !getIsDev()) {
                this.startAutoUpdateCheck();
            }
            else {
                this.stopAutoUpdateCheck();
            }
            return this.createSuccessResponse({
                autoUpdateEnabled: this.status.autoUpdateEnabled,
            }, `Auto-update ${enabled ? 'enabled' : 'disabled'}`);
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to set auto-update');
        }
    }
    /**
     * IPC Handler: Cancel update download
     */
    async cancelUpdate(_event) {
        try {
            // electron-updater doesn't provide a direct cancel method
            // but we can reset the state
            this.status.downloading = false;
            this.status.available = false;
            this.status.progress = null;
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.setProgressBar(-1);
            }
            return this.createSuccessResponse({
                cancelled: true,
            }, 'Update cancelled');
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to cancel update');
        }
    }
    /**
     * IPC Handler: Skip version
     */
    async skipVersion(_event, version) {
        try {
            this.skippedVersions.add(version);
            this.status.available = false;
            this.status.updateInfo = null;
            logInfo(`Version ${version} skipped by user`);
            return this.createSuccessResponse({
                skipped: true,
            }, `Version ${version} will be skipped`);
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to skip version');
        }
    }
    /**
     * Notify renderer process about update events
     */
    notifyRenderer(event, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(event, data);
        }
    }
    /**
     * Cleanup on controller shutdown
     */
    shutdown() {
        this.stopAutoUpdateCheck();
        this.unregisterHandlers();
        logInfo('UpdaterController shutdown complete');
    }
}
// Lazy singleton
let _updaterControllerInstance = null;
export function getUpdaterController() {
    if (!_updaterControllerInstance) {
        _updaterControllerInstance = new UpdaterController();
    }
    return _updaterControllerInstance;
}
// Backward compatibility - lazy getter
export const updaterController = new Proxy({}, {
    get(_target, prop) {
        return getUpdaterController()[prop];
    }
});
