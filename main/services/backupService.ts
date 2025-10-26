/**
 * BackupService - Automatic database backup and recovery system
 *
 * This service handles:
 * 1. Scheduled automated backups of the database
 * 2. Recovery from backup when database corruption is detected
 * 3. Tracking backup history and maintenance
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import { logInfo, logError, logWarning } from '../error-handler';
import { DatabaseService } from '../utils/databaseService';
import { getCurrentLocalDateTime } from '../utils/dateTime';

const execAsync = promisify(exec);

// Backup configuration
const BACKUP_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const MAX_BACKUP_COUNT = 5; // Keep last 5 backups
const BACKUP_FOLDER = 'backups';

export interface BackupInfo {
  id: string;
  timestamp: string;
  filename: string;
  size: number; // in bytes
  path: string;
  isAutomatic: boolean;
}

export class BackupService {
  private static instance: BackupService;
  private backupPath: string;
  private backupTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private databaseService: DatabaseService;

  private constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    // Create backup directory in user data folder - with fallback
    let userDataPath: string;
    try {
      if (app && app.getPath) {
        userDataPath = app.getPath('userData');
      } else {
        userDataPath = path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos');
      }
    } catch (e) {
      userDataPath = path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos');
    }
    this.backupPath = path.join(userDataPath, BACKUP_FOLDER);

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(databaseService: DatabaseService): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService(databaseService);
    }
    return BackupService.instance;
  }

  /**
   * Start the backup service with scheduled backups
   */
  public startScheduledBackups(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    // Run initial backup on startup after a small delay
    setTimeout(
      () => {
        this.performBackup(true).catch(err => {
          logError(
            err instanceof Error ? err : new Error(String(err)),
            'BackupService - Initial Backup Error'
          );
        });
      },
      2 * 60 * 1000
    ); // 2-minute delay for initial backup

    // Schedule regular backups
    this.backupTimer = setInterval(() => {
      this.performBackup(true).catch(err => {
        logError(
          err instanceof Error ? err : new Error(String(err)),
          'BackupService - Scheduled Backup Error'
        );
      });
    }, BACKUP_INTERVAL_MS);

    logInfo('Automated backup service started', 'BackupService');
  }

  /**
   * Stop the scheduled backups
   */
  public stopScheduledBackups(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      logInfo('Automated backup service stopped', 'BackupService');
    }
  }

  /**
   * Get database path for SQLite
   */
  private getConnectionUrl(): string {
    // For SQLite, return the database file path
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'mr5-pos.db');
  }

  /**
   * Perform a database backup
   * @param isAutomatic Whether this is an automatic or manual backup
   * @returns Information about the created backup
   */
  public async performBackup(isAutomatic = false): Promise<BackupInfo> {
    if (this.isRunning) {
      throw new Error('Backup is already in progress');
    }

    try {
      this.isRunning = true;
      const timestamp = getCurrentLocalDateTime().replace(/[:.]/g, '-');
      const backupId = `backup-${timestamp}`;
      const filename = `${backupId}.sql`;
      const backupFilePath = path.join(this.backupPath, filename);

      logInfo(
        `Starting database backup: ${filename} (${isAutomatic ? 'automatic' : 'manual'})`,
        'BackupService'
      );

      // Get database connection info
      const dbUrl = this.getConnectionUrl();
      const parsedUrl = new URL(dbUrl);
      const database = parsedUrl.pathname.slice(1);
      const user = parsedUrl.username;
      const port = parsedUrl.port;
      const host = parsedUrl.hostname;

      // Create backup using pg_dump
      const pgDumpPath = this.getPgDumpPath();
      const command = `"${pgDumpPath}" -h ${host} -p ${port} -U ${user} -F p -f "${backupFilePath}" ${database}`;

      await execAsync(command);

      // Get file size
      const stats = fs.statSync(backupFilePath);

      // Clean up old backups
      await this.cleanupOldBackups();

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: getCurrentLocalDateTime(),
        filename,
        size: stats.size,
        path: backupFilePath,
        isAutomatic,
      };

      logInfo(
        `Backup completed successfully: ${filename} (${this.formatBytes(stats.size)})`,
        'BackupService'
      );

      return backupInfo;
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupService - Backup Failed'
      );
      throw new Error(
        `Backup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Restore database from a backup file
   * @param backupId ID of the backup to restore
   * @returns Success status
   */
  public async restoreFromBackup(backupId: string): Promise<boolean> {
    if (this.isRunning) {
      throw new Error('Cannot restore while a backup is in progress');
    }

    try {
      this.isRunning = true;
      const backups = await this.getBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        throw new Error(`Backup with ID ${backupId} not found`);
      }

      logInfo(
        `Starting database restore from backup: ${backup.filename}`,
        'BackupService'
      );

      // Disconnect database before restore (SQLite handles this automatically)
      // await this.databaseService.shutdown();

      // Get database connection info
      const dbUrl = this.getConnectionUrl();
      const parsedUrl = new URL(dbUrl);
      const database = parsedUrl.pathname.slice(1);
      const user = parsedUrl.username;
      const port = parsedUrl.port;
      const host = parsedUrl.hostname;

      // Create temporary database for restore
      const psqlPath = this.getPsqlPath();

      // Drop connections to the database
      await execAsync(
        `"${psqlPath}" -h ${host} -p ${port} -U ${user} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();" postgres`
      );

      // Drop and recreate the database
      await execAsync(
        `"${psqlPath}" -h ${host} -p ${port} -U ${user} -c "DROP DATABASE IF EXISTS ${database};" postgres`
      );
      await execAsync(
        `"${psqlPath}" -h ${host} -p ${port} -U ${user} -c "CREATE DATABASE ${database};" postgres`
      );

      // Restore the backup
      await execAsync(
        `"${psqlPath}" -h ${host} -p ${port} -U ${user} -d ${database} -f "${backup.path}"`
      );

      logInfo(
        `Database restore completed successfully: ${backup.filename}`,
        'BackupService'
      );

      // Reconnect to the database (SQLite handles this automatically)
      // await this.databaseService.initialize();

      return true;
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupService - Restore Failed'
      );
      throw new Error(
        `Restore failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get list of available backups
   */
  public async getBackups(): Promise<BackupInfo[]> {
    try {
      const files = fs.readdirSync(this.backupPath);
      const backupFiles = files.filter(
        file => file.startsWith('backup-') && file.endsWith('.sql')
      );

      const backups: BackupInfo[] = [];
      for (const file of backupFiles) {
        const stats = fs.statSync(path.join(this.backupPath, file));
        const backupId = file.replace('.sql', '');

        // Extract timestamp from the backup ID
        const timestampStr = backupId.replace('backup-', '');
        const timestamp = new Date(
          timestampStr.replace(/-/g, ':')
        ).toISOString();

        backups.push({
          id: backupId,
          timestamp,
          filename: file,
          size: stats.size,
          path: path.join(this.backupPath, file),
          isAutomatic: true, // Assume automatic by default
        });
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => {
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        'BackupService - Error Getting Backups'
      );
      return [];
    }
  }

  /**
   * Clean up old backups, keeping only the MAX_BACKUP_COUNT most recent ones
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.getBackups();

      // Skip cleanup if we have fewer than the max
      if (backups.length <= MAX_BACKUP_COUNT) {
        return;
      }

      // Delete oldest backups
      const toDelete = backups.slice(MAX_BACKUP_COUNT);
      for (const backup of toDelete) {
        fs.unlinkSync(backup.path);
        logInfo(`Deleted old backup: ${backup.filename}`, 'BackupService');
      }
    } catch (error) {
      logWarning(
        `Failed to clean up old backups: ${error instanceof Error ? error.message : String(error)}`,
        'BackupService'
      );
    }
  }

  /**
   * Get the path to the pg_dump utility
   */
  private getPgDumpPath(): string {
    // Platform-specific paths
    if (process.platform === 'win32') {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'windows',
        'bin',
        'pg_dump.exe'
      );
    } else if (process.platform === 'darwin') {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'macos',
        'bin',
        'pg_dump'
      );
    } else {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'linux',
        'bin',
        'pg_dump'
      );
    }
  }

  /**
   * Get the path to the psql utility
   */
  private getPsqlPath(): string {
    // Platform-specific paths
    if (process.platform === 'win32') {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'windows',
        'bin',
        'psql.exe'
      );
    } else if (process.platform === 'darwin') {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'macos',
        'bin',
        'psql'
      );
    } else {
      return path.join(
        app.getAppPath(),
        'resources',
        'postgresql',
        'linux',
        'bin',
        'psql'
      );
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default BackupService;
