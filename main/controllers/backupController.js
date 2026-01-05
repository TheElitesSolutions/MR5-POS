/**
 * BackupController - Manages database backup and restore operations
 *
 * This controller exposes IPC methods for:
 * 1. Creating manual backups
 * 2. Restoring from backups
 * 3. Listing available backups
 */
import { BaseController } from './baseController';
import BackupService from '../services/backupService';
import { DatabaseService } from '../utils/databaseService';
import { BACKUP_CHANNELS } from '../../shared/ipc-channels';
import { logInfo, logError } from '../error-handler';
export class BackupController extends BaseController {
    constructor() {
        super();
        const databaseService = DatabaseService.getInstance();
        this.backupService = BackupService.getInstance(databaseService);
        // Start the backup service with scheduled backups
        this.backupService.startScheduledBackups();
        // Initialize handlers
        // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    }
    /**
     * Initialize the controller
     */
    initialize() {
        this.registerHandlers();
    }
    /**
     * Register IPC handlers
     */
    registerHandlers() {
        this.registerHandler(BACKUP_CHANNELS.CREATE_BACKUP, this.createBackup.bind(this));
        this.registerHandler(BACKUP_CHANNELS.RESTORE_FROM_BACKUP, this.restoreFromBackup.bind(this));
        this.registerHandler(BACKUP_CHANNELS.GET_BACKUPS, this.getBackups.bind(this));
    }
    /**
     * Handle application shutdown
     */
    onShutdown() {
        this.backupService.stopScheduledBackups();
    }
    /**
     * Create a database backup
     */
    async createBackup(_event, params) {
        try {
            const isManual = params?.manual ?? true;
            logInfo(`Creating ${isManual ? 'manual' : 'automatic'} backup`, 'BackupController');
            const backup = await this.backupService.performBackup(!isManual);
            return this.createSuccessResponse(backup);
        }
        catch (error) {
            logError(error instanceof Error ? error : new Error(String(error)), 'BackupController - Create Backup Error');
            return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Restore database from a backup
     */
    async restoreFromBackup(_event, params) {
        try {
            if (!params?.backupId) {
                throw new Error('Backup ID is required');
            }
            logInfo(`Restoring from backup: ${params.backupId}`, 'BackupController');
            const result = await this.backupService.restoreFromBackup(params.backupId);
            return this.createSuccessResponse(result);
        }
        catch (error) {
            logError(error instanceof Error ? error : new Error(String(error)), 'BackupController - Restore Backup Error');
            return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Get list of available backups
     */
    async getBackups(_event) {
        try {
            const backups = await this.backupService.getBackups();
            return this.createSuccessResponse(backups);
        }
        catch (error) {
            logError(error instanceof Error ? error : new Error(String(error)), 'BackupController - Get Backups Error');
            return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
