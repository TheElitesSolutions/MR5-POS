import { logInfo, logError } from '../error-handler';
/**
 * Sync Scheduler
 * Handles automated periodic syncing to Supabase
 */
export class SyncScheduler {
    constructor(syncService) {
        this.intervalId = null;
        this.intervalMinutes = 60;
        this.isRunning = false;
        this.syncService = syncService;
    }
    /**
     * Start scheduled sync (every X minutes)
     */
    start(intervalMinutes = 60) {
        if (this.intervalId) {
            logInfo('Sync scheduler already running, stopping previous schedule');
            this.stop();
        }
        if (!this.syncService.isConfigured()) {
            logInfo('Supabase not configured, sync scheduler will not start. ' +
                'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables.');
            return;
        }
        this.intervalMinutes = intervalMinutes;
        this.isRunning = true;
        // Initial sync on start (after 30 seconds to allow app to fully initialize)
        setTimeout(() => {
            if (this.isRunning) {
                this.performSync('initial');
            }
        }, 30 * 1000);
        // Schedule periodic syncs
        this.intervalId = setInterval(() => {
            if (this.isRunning) {
                this.performSync('scheduled');
            }
        }, intervalMinutes * 60 * 1000);
        logInfo(`✅ Scheduled sync started (every ${intervalMinutes} minutes)`);
    }
    /**
     * Stop scheduled sync
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            logInfo('Scheduled sync stopped');
        }
    }
    /**
     * Perform a sync operation
     */
    async performSync(type) {
        try {
            logInfo(`🔄 Starting ${type} sync...`);
            const result = await this.syncService.syncAll();
            if (result.success) {
                logInfo(`✅ ${type} sync completed - ` +
                    `Categories: ${result.categoriesSynced}, ` +
                    `Items: ${result.itemsSynced}, ` +
                    `Add-ons: ${result.addOnsSynced}`);
            }
            else {
                logError(new Error(`${type} sync failed: ${result.error}`), 'SyncScheduler');
            }
        }
        catch (error) {
            logError(error, `SyncScheduler ${type} sync`);
        }
    }
    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalMinutes: this.intervalMinutes,
            nextSyncIn: this.isRunning ? this.intervalMinutes * 60 : null, // seconds
        };
    }
    /**
     * Update sync interval (will restart scheduler)
     */
    updateInterval(intervalMinutes) {
        if (this.isRunning) {
            this.stop();
            this.start(intervalMinutes);
        }
        else {
            this.intervalMinutes = intervalMinutes;
        }
    }
    /**
     * Check if scheduler is running
     */
    isSchedulerRunning() {
        return this.isRunning;
    }
}
