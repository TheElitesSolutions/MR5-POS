/**
 * BackupController - Manages database backup and restore operations
 *
 * This controller exposes IPC methods for:
 * 1. Creating manual backups
 * 2. Restoring from backups
 * 3. Listing available backups
 */

import { IpcMainInvokeEvent } from 'electron';
import { BaseController } from './baseController';
import BackupService, { BackupInfo } from '../services/backupService';
import { DatabaseService } from '../utils/databaseService';
import { IPCResponse } from '../../shared/ipc-types';
import { BACKUP_CHANNELS } from '../../shared/ipc-channels';
import { logInfo, logError } from '../error-handler';

interface CreateBackupParams {
  manual?: boolean;
}

interface RestoreBackupParams {
  backupId: string;
}

export class BackupController extends BaseController {
  private backupService: BackupService;

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
  public override initialize(): void {
    this.registerHandlers();
  }

  /**
   * Register IPC handlers
   */
  protected registerHandlers(): void {
    this.registerHandler(
      BACKUP_CHANNELS.CREATE_BACKUP,
      this.createBackup.bind(this)
    );
    this.registerHandler(
      BACKUP_CHANNELS.RESTORE_FROM_BACKUP,
      this.restoreFromBackup.bind(this)
    );
    this.registerHandler(
      BACKUP_CHANNELS.GET_BACKUPS,
      this.getBackups.bind(this)
    );
  }

  /**
   * Handle application shutdown
   */
  public onShutdown(): void {
    this.backupService.stopScheduledBackups();
  }

  /**
   * Create a database backup
   */
  private async createBackup(
    _event: IpcMainInvokeEvent,
    params: CreateBackupParams
  ): Promise<IPCResponse<BackupInfo>> {
    try {
      const isManual = params?.manual ?? true;
      logInfo(
        `Creating ${isManual ? 'manual' : 'automatic'} backup`,
        'BackupController'
      );

      const backup = await this.backupService.performBackup(!isManual);

      return this.createSuccessResponse(backup);
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupController - Create Backup Error'
      );
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Restore database from a backup
   */
  private async restoreFromBackup(
    _event: IpcMainInvokeEvent,
    params: RestoreBackupParams
  ): Promise<IPCResponse<boolean>> {
    try {
      if (!params?.backupId) {
        throw new Error('Backup ID is required');
      }

      logInfo(`Restoring from backup: ${params.backupId}`, 'BackupController');

      const result = await this.backupService.restoreFromBackup(
        params.backupId
      );

      return this.createSuccessResponse(result);
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupController - Restore Backup Error'
      );
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get list of available backups
   */
  private async getBackups(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<BackupInfo[]>> {
    try {
      const backups = await this.backupService.getBackups();

      return this.createSuccessResponse(backups);
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupController - Get Backups Error'
      );
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
