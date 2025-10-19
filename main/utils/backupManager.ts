import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { format } from 'date-fns';
import { app, dialog } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

const BACKUP_DIR_NAME = 'backups';
const DATABASE_FILE_NAME = 'mr5-pos.db'; // Actual database file name
const SETTINGS_FILE_NAME = 'config.json'; // From electron-store default

interface BackupMetadata {
  timestamp: string;
  version: string;
  size: number;
  files: string[];
  notes?: string;
}

interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
}

interface RestoreResult {
  success: boolean;
  error?: string;
}

/**
 * Manages application data backups and restoration.
 * Handles database, user settings, and other critical files.
 */
class BackupManager {
  private backupDir: string;
  private appDataPath: string;
  private dbPath: string;
  private settingsPath: string;
  private isInitialized: boolean = false;

  constructor() {
    // Delay app.getPath usage with fallback
    try {
      if (app && app.getPath) {
        this.appDataPath = app.getPath('userData');
      } else {
        // Fallback for when app is not ready
        this.appDataPath = path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos');
      }
    } catch (e) {
      // Fallback if app.getPath fails
      this.appDataPath = path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos');
    }

    this.backupDir = path.join(this.appDataPath, BACKUP_DIR_NAME);
    this.dbPath = path.join(this.appDataPath, DATABASE_FILE_NAME);
    this.settingsPath = path.join(this.appDataPath, SETTINGS_FILE_NAME);

    // Don't call initialize in constructor - will be called when actually needed
  }

  /**
   * Initializes the backup manager, ensuring the backup directory exists.
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.backupDir);
      this.isInitialized = true;
      logger.info('BackupManager initialized successfully.', 'BackupManager');
    } catch (error) {
      this.isInitialized = false;
      logger.error(
        `Failed to create backup directory: ${error}`,
        'BackupManager'
      );
    }
  }

  /**
   * Get the database path
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if backup manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Creates a full backup of the application data.
   * @param notes Optional notes to include in the backup metadata.
   * @returns A promise that resolves with the backup result.
   */
  public async createBackup(notes?: string): Promise<BackupResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'BackupManager not initialized.' };
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const backupFileName = `backup-${timestamp}.zip`;
    const backupFilePath = path.join(this.backupDir, backupFileName);

    try {
      const output = fs.createWriteStream(backupFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Set the compression level.
      });

      return new Promise((resolve, reject) => {
        output.on('close', async () => {
          logger.info(
            `Backup created successfully: ${backupFileName}`,
            'BackupManager'
          );
          const stats = await fs.stat(backupFilePath);
          const metadata: BackupMetadata = {
            timestamp,
            version: app.getVersion(),
            size: stats.size,
            files: [DATABASE_FILE_NAME, SETTINGS_FILE_NAME],
          };

          if (notes !== undefined) {
            metadata.notes = notes;
          }
          await fs.writeJson(`${backupFilePath}.meta`, metadata, { spaces: 2 });

          resolve({ success: true, path: backupFilePath });
        });

        archive.on('warning', (err: any) => {
          if (err.code === 'ENOENT') {
            logger.warn(
              `File not found during backup: ${err.path}`,
              'BackupManager'
            );
          } else {
            reject(err);
          }
        });

        archive.on('error', (err: any) => {
          reject(err);
        });

        archive.pipe(output);

        // Add database file if it exists
        if (fs.existsSync(this.dbPath)) {
          archive.file(this.dbPath, { name: DATABASE_FILE_NAME });
        }

        // Add settings file if it exists
        if (fs.existsSync(this.settingsPath)) {
          archive.file(this.settingsPath, { name: SETTINGS_FILE_NAME });
        }

        archive.finalize();
      });
    } catch (error) {
      logger.error(`Failed to create backup: ${error}`, 'BackupManager');
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Lists all available backups.
   * @returns A promise that resolves with an array of backup metadata.
   */
  public async listBackups(): Promise<BackupMetadata[]> {
    if (!this.isInitialized) {
      logger.error(
        'Cannot list backups, manager not initialized.',
        'BackupManager'
      );
      return [];
    }

    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.zip.meta'));

      const backups = await Promise.all(
        backupFiles.map(async file => {
          const metaPath = path.join(this.backupDir, file);
          const metadata: BackupMetadata = await fs.readJson(metaPath);
          return metadata;
        })
      );

      // Sort backups from newest to oldest
      return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      logger.error(`Failed to list backups: ${error}`, 'BackupManager');
      return [];
    }
  }

  /**
   * Restores application data from a selected backup file.
   * This is a destructive operation.
   * @param timestamp The timestamp of the backup to restore.
   * @returns A promise that resolves with the restore result.
   */
  public async restoreBackup(timestamp: string): Promise<RestoreResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'BackupManager not initialized.' };
    }

    const backupFileName = `backup-${timestamp}.zip`;
    const backupFilePath = path.join(this.backupDir, backupFileName);

    if (!fs.existsSync(backupFilePath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`,
      };
    }

    // Optional: Add a confirmation dialog before proceeding
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Restore', 'Cancel'],
      defaultId: 1,
      title: 'Confirm Restore',
      message: 'Are you sure you want to restore this backup?',
      detail:
        'This will overwrite your current data. The application will restart after the restore.',
    });

    if (confirmation.response === 1) {
      // User clicked 'Cancel'
      return { success: false, error: 'Restore cancelled by user.' };
    }

    try {
      // Unzip the backup to a temporary location
      const tempDir = path.join(this.appDataPath, `restore-temp-${Date.now()}`);
      await fs.ensureDir(tempDir);

      const zip = new AdmZip(backupFilePath);
      zip.extractAllTo(tempDir, /*overwrite*/ true);

      logger.info(
        `Backup extracted to temporary directory: ${tempDir}`,
        'BackupManager'
      );

      // Restore database
      const dbSourcePath = path.join(tempDir, DATABASE_FILE_NAME);
      if (fs.existsSync(dbSourcePath)) {
        await fs.move(dbSourcePath, this.dbPath, { overwrite: true });
        logger.info(
          `Database restored from backup: ${dbSourcePath}`,
          'BackupManager'
        );
      }

      // Restore settings
      const settingsSourcePath = path.join(tempDir, SETTINGS_FILE_NAME);
      if (fs.existsSync(settingsSourcePath)) {
        await fs.move(settingsSourcePath, this.settingsPath, {
          overwrite: true,
        });
        logger.info(
          `Settings restored from backup: ${settingsSourcePath}`,
          'BackupManager'
        );
      }

      // Clean up temporary directory
      await fs.remove(tempDir);

      logger.info(
        `Backup restoration completed successfully: ${backupFileName}`,
        'BackupManager'
      );

      return { success: true };
    } catch (error) {
      logger.error(`Failed to restore backup: ${error}`, 'BackupManager');
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Schedules automatic backups.
   * @param intervalHours The interval in hours between backups.
   */
  public scheduleAutoBackups(intervalHours: number): void {
    if (!this.isInitialized) {
      logger.warn(
        'Cannot schedule auto-backups, manager not initialized.',
        'BackupManager'
      );
      return;
    }

    logger.info(
      `Scheduling automatic backups every ${intervalHours} hours.`,
      'BackupManager'
    );

    // Note: Cleanup of old backups would need to be implemented in a separate async method

    setInterval(
      () => {
        logger.info('Running scheduled automatic backup...', 'BackupManager');
        this.createBackup('Scheduled automatic backup');
      },
      intervalHours * 60 * 60 * 1000
    );
  }

  /**
   * Create a pre-update backup specifically for auto-update safety
   * This creates a simple copy of the database without compression for faster recovery
   * @param version The version being updated to
   * @returns A promise that resolves with the backup result
   */
  public async createPreUpdateBackup(version: string): Promise<BackupResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const backupFileName = `pre-update-v${version}-${timestamp}.db`;
    const preUpdateDir = path.join(this.backupDir, 'pre-update');

    try {
      // Ensure pre-update backup directory exists
      await fs.ensureDir(preUpdateDir);

      const backupFilePath = path.join(preUpdateDir, backupFileName);

      // Check if database exists
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Database file not found at ${this.dbPath}`);
      }

      // Create backup using atomic operation (copy to temp, then rename)
      const tempBackupPath = `${backupFilePath}.tmp`;
      await fs.copy(this.dbPath, tempBackupPath);
      await fs.rename(tempBackupPath, backupFilePath);

      // Verify backup
      const backupValid = await this.verifyBackupIntegrity(backupFilePath);
      if (!backupValid) {
        await fs.remove(backupFilePath);
        throw new Error('Backup verification failed');
      }

      // Save metadata
      const stats = await fs.stat(backupFilePath);
      const metadata: BackupMetadata = {
        timestamp,
        version,
        size: stats.size,
        files: [DATABASE_FILE_NAME],
        notes: `Pre-update backup for version ${version}`,
      };
      await fs.writeJson(`${backupFilePath}.meta`, metadata, { spaces: 2 });

      logger.info(
        `Pre-update backup created successfully: ${backupFileName}`,
        'BackupManager'
      );

      // Clean old pre-update backups (keep last 5)
      await this.cleanOldPreUpdateBackups(5);

      return { success: true, path: backupFilePath };
    } catch (error) {
      logger.error(`Failed to create pre-update backup: ${error}`, 'BackupManager');
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Verify backup file integrity
   * @param backupPath Path to the backup file
   * @returns True if backup is valid, false otherwise
   */
  public async verifyBackupIntegrity(backupPath: string): Promise<boolean> {
    try {
      if (!await fs.pathExists(backupPath)) {
        logger.error('Backup file does not exist', 'BackupManager');
        return false;
      }

      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        logger.error('Backup file is empty', 'BackupManager');
        return false;
      }

      // For SQLite database files, we could open and verify
      // but for now, file existence and size check is sufficient
      return true;
    } catch (error) {
      logger.error(`Backup integrity verification failed: ${error}`, 'BackupManager');
      return false;
    }
  }

  /**
   * Clean old pre-update backups, keeping only the most recent N backups
   * @param keepCount Number of backups to keep
   */
  public async cleanOldPreUpdateBackups(keepCount: number): Promise<void> {
    try {
      const preUpdateDir = path.join(this.backupDir, 'pre-update');

      if (!await fs.pathExists(preUpdateDir)) {
        return;
      }

      const files = await fs.readdir(preUpdateDir);
      const backupFiles = files
        .filter(file => file.startsWith('pre-update-') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(preUpdateDir, file),
        }));

      // Sort by modification time (newest first)
      const backupsWithStats = await Promise.all(
        backupFiles.map(async backup => ({
          ...backup,
          mtime: (await fs.stat(backup.path)).mtime,
        }))
      );

      backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete old backups beyond keepCount
      const backupsToDelete = backupsWithStats.slice(keepCount);
      for (const backup of backupsToDelete) {
        await fs.remove(backup.path);
        // Also remove metadata file if it exists
        const metaPath = `${backup.path}.meta`;
        if (await fs.pathExists(metaPath)) {
          await fs.remove(metaPath);
        }
        logger.info(`Deleted old pre-update backup: ${backup.name}`, 'BackupManager');
      }

      if (backupsToDelete.length > 0) {
        logger.info(
          `Cleaned ${backupsToDelete.length} old pre-update backups`,
          'BackupManager'
        );
      }
    } catch (error) {
      logger.error(`Failed to clean old pre-update backups: ${error}`, 'BackupManager');
    }
  }

  /**
   * Get the most recent pre-update backup
   * @returns Path to the latest backup, or null if none exist
   */
  public async getLatestPreUpdateBackup(): Promise<string | null> {
    try {
      const preUpdateDir = path.join(this.backupDir, 'pre-update');

      if (!await fs.pathExists(preUpdateDir)) {
        return null;
      }

      const files = await fs.readdir(preUpdateDir);
      const backupFiles = files
        .filter(file => file.startsWith('pre-update-') && file.endsWith('.db'))
        .map(file => path.join(preUpdateDir, file));

      if (backupFiles.length === 0) {
        return null;
      }

      // Get most recent by modification time
      const backupsWithStats = await Promise.all(
        backupFiles.map(async file => ({
          path: file,
          mtime: (await fs.stat(file)).mtime,
        }))
      );

      backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      return backupsWithStats[0].path;
    } catch (error) {
      logger.error(`Failed to get latest pre-update backup: ${error}`, 'BackupManager');
      return null;
    }
  }

  /**
   * Restore database from a specific backup file
   * @param backupPath Path to the backup file
   * @returns A promise that resolves with the restore result
   */
  public async restoreFromBackupFile(backupPath: string): Promise<RestoreResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!await fs.pathExists(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Verify backup integrity
      const backupValid = await this.verifyBackupIntegrity(backupPath);
      if (!backupValid) {
        throw new Error('Backup file is corrupted');
      }

      // Create backup of current (potentially corrupted) database
      const corruptedBackupPath = `${this.dbPath}.corrupted.${Date.now()}`;
      if (await fs.pathExists(this.dbPath)) {
        await fs.copy(this.dbPath, corruptedBackupPath);
        logger.info(
          `Current database backed up to ${corruptedBackupPath}`,
          'BackupManager'
        );
      }

      // Restore from backup
      await fs.copy(backupPath, this.dbPath, { overwrite: true });

      logger.info(
        `Database restored successfully from ${backupPath}`,
        'BackupManager'
      );

      return { success: true };
    } catch (error) {
      logger.error(`Failed to restore from backup: ${error}`, 'BackupManager');
      return { success: false, error: (error as Error).message };
    }
  }
}

// Lazy singleton instance
let _backupManagerInstance: BackupManager | null = null;

export function getBackupManager(): BackupManager {
  if (!_backupManagerInstance) {
    _backupManagerInstance = new BackupManager();
  }
  return _backupManagerInstance;
}

// Backward compatibility - lazy getter
export const backupManager = new Proxy({} as BackupManager, {
  get(_target, prop) {
    return (getBackupManager() as any)[prop];
  }
});
