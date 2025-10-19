/**
 * Backup API - Interface for interacting with the backup system
 *
 * This API provides methods for:
 * 1. Creating manual backups
 * 2. Viewing available backups
 * 3. Restoring from backups
 */

import { BackupInfo } from '@/types';
import { BACKUP_CHANNELS } from '../../shared/ipc-channels';

/**
 * Safe access to ipcRenderer through window.electronAPI
 */
const ipcRenderer =
  typeof window !== 'undefined' && window.electronAPI?.ipc
    ? window.electronAPI.ipc
    : {
        // Provide mock implementation for browser environment
        invoke: async (..._args: unknown[]) => {
          return { success: false, error: 'Not running in Electron' };
        },
      };

export interface CreateBackupResponse {
  success: boolean;
  data?: BackupInfo;
  error?: string;
}

export interface RestoreBackupResponse {
  success: boolean;
  data?: boolean;
  error?: string;
}

export interface GetBackupsResponse {
  success: boolean;
  data?: BackupInfo[];
  error?: string;
}

/**
 * BackupAPI - Provides methods for interacting with the backup system
 */
export const BackupAPI = {
  /**
   * Create a manual backup of the database
   * @returns Promise with backup info
   */
  createBackup: async (): Promise<CreateBackupResponse> => {
    try {
      const response = await ipcRenderer.invoke(BACKUP_CHANNELS.CREATE_BACKUP, {
        manual: true,
      });

      return response;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return {
        success: false,
        error: `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * Restore the database from a backup
   * @param backupId ID of the backup to restore
   * @returns Promise with success status
   */
  restoreFromBackup: async (
    backupId: string
  ): Promise<RestoreBackupResponse> => {
    try {
      const response = await ipcRenderer.invoke(
        BACKUP_CHANNELS.RESTORE_FROM_BACKUP,
        {
          backupId,
        }
      );

      return response;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return {
        success: false,
        error: `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * Get list of available backups
   * @returns Promise with array of backup info
   */
  getBackups: async (): Promise<GetBackupsResponse> => {
    try {
      const response = await ipcRenderer.invoke(BACKUP_CHANNELS.GET_BACKUPS);

      return response;
    } catch (error) {
      console.error('Failed to get backups:', error);
      return {
        success: false,
        error: `Failed to get backups: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
