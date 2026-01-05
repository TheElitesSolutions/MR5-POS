import { BaseController } from './baseController';
import { logInfo } from '../error-handler';
/**
 * IPC channels for sync operations
 */
export const SYNC_CHANNELS = {
    MANUAL_SYNC: 'mr5pos:sync:manual',
    GET_STATUS: 'mr5pos:sync:status',
    SET_AUTO_SYNC: 'mr5pos:sync:set-auto',
    SET_INTERVAL: 'mr5pos:sync:set-interval',
};
/**
 * Sync Controller
 * Handles IPC communication for Supabase sync operations
 */
export class SyncController extends BaseController {
    constructor(syncService, syncScheduler) {
        super();
        this.syncService = syncService;
        this.syncScheduler = syncScheduler;
        logInfo('SyncController initialized');
    }
    registerHandlers() {
        // Manual sync trigger
        this.registerHandler(SYNC_CHANNELS.MANUAL_SYNC, this.manualSync.bind(this));
        // Get sync status
        this.registerHandler(SYNC_CHANNELS.GET_STATUS, this.getStatus.bind(this));
        // Enable/disable auto-sync
        this.registerHandler(SYNC_CHANNELS.SET_AUTO_SYNC, this.setAutoSync.bind(this));
        // Set sync interval
        this.registerHandler(SYNC_CHANNELS.SET_INTERVAL, this.setInterval.bind(this));
        logInfo('All sync IPC handlers registered');
    }
    /**
     * IPC Handler: Perform manual sync
     */
    async manualSync(_event) {
        try {
            logInfo('Manual sync triggered from UI');
            const result = await this.syncService.syncAll();
            if (result.success) {
                return this.createSuccessResponse({
                    categoriesSynced: result.categoriesSynced,
                    itemsSynced: result.itemsSynced,
                    addOnsSynced: result.addOnsSynced,
                }, 'Menu synced successfully to website');
            }
            else {
                return this.createErrorResponse(result.error || 'Sync failed');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to sync menu');
        }
    }
    /**
     * IPC Handler: Get sync status
     */
    async getStatus(_event) {
        try {
            const syncStatus = this.syncService.getSyncStatus();
            const schedulerStatus = this.syncScheduler.getStatus();
            return this.createSuccessResponse({
                syncStatus,
                schedulerStatus,
                isConfigured: this.syncService.isConfigured(),
            });
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get sync status');
        }
    }
    /**
     * IPC Handler: Enable/disable auto-sync
     */
    async setAutoSync(_event, enabled) {
        try {
            if (enabled) {
                this.syncScheduler.start();
                logInfo('Auto-sync enabled from UI');
            }
            else {
                this.syncScheduler.stop();
                logInfo('Auto-sync disabled from UI');
            }
            return this.createSuccessResponse({ enabled }, `Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to toggle auto-sync');
        }
    }
    /**
     * IPC Handler: Set sync interval
     */
    async setInterval(_event, intervalMinutes) {
        try {
            if (intervalMinutes < 5 || intervalMinutes > 1440) {
                return this.createErrorResponse('Interval must be between 5 minutes and 24 hours');
            }
            this.syncScheduler.updateInterval(intervalMinutes);
            logInfo(`Sync interval updated to ${intervalMinutes} minutes`);
            return this.createSuccessResponse({ intervalMinutes }, `Sync interval set to ${intervalMinutes} minutes`);
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to set sync interval');
        }
    }
}
