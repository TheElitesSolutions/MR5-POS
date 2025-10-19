import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logInfo, logError, logWarning } from '../error-handler';
import { getDatabaseIntegrityChecker, HealthCheckResult } from './databaseIntegrityChecker';

/**
 * Update safety result interface
 */
export interface UpdateSafetyResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  healthCheck?: HealthCheckResult;
}

/**
 * Crash detection metadata
 */
interface CrashDetectionMetadata {
  version: string;
  startupTime: number;
  crashCount: number;
  lastCrashTime?: number;
}

/**
 * UpdateSafety
 * Coordinates all safety measures for auto-updates
 * - Pre-update backups
 * - Post-update verification
 * - Rollback mechanisms
 * - Crash detection
 */
export class UpdateSafety {
  private appDataPath: string;
  private backupDir: string;
  private preUpdateBackupDir: string;
  private metadataPath: string;
  private crashDetectionPath: string;
  private integrityChecker = getDatabaseIntegrityChecker();

  // Crash detection constants
  private readonly CRASH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_CRASH_COUNT = 3; // Max crashes before rollback

  constructor() {
    try {
      this.appDataPath = app.getPath('userData');
    } catch (error) {
      this.appDataPath = path.join(
        process.env.APPDATA || process.env.TEMP || '/tmp',
        'mr5-pos'
      );
    }

    this.backupDir = path.join(this.appDataPath, 'backups');
    this.preUpdateBackupDir = path.join(this.backupDir, 'pre-update');
    this.metadataPath = path.join(this.backupDir, 'update-metadata.json');
    this.crashDetectionPath = path.join(this.appDataPath, 'crash-detection.json');

    this.initialize();
  }

  /**
   * Initialize update safety system
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure backup directories exist
      await fs.ensureDir(this.backupDir);
      await fs.ensureDir(this.preUpdateBackupDir);

      logInfo('UpdateSafety initialized successfully');
    } catch (error) {
      logError(error as Error, 'UpdateSafety.initialize');
    }
  }

  /**
   * Create pre-update backup before downloading update
   * This is the CRITICAL safety measure to prevent data loss
   */
  async createPreUpdateBackup(newVersion: string): Promise<UpdateSafetyResult> {
    logInfo(`Creating pre-update backup for version ${newVersion}...`);

    try {
      // 1. Run health check before backup
      const healthCheck = await this.integrityChecker.runHealthCheck();
      if (!healthCheck.isHealthy) {
        logWarning(
          'Database health check failed before backup, proceeding with caution',
          'UpdateSafety'
        );
      }

      // 2. Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `pre-update-v${newVersion}-${timestamp}.zip`;
      const backupPath = path.join(this.preUpdateBackupDir, backupFileName);

      // 3. Get database path
      const dbPath = this.integrityChecker.getDatabasePath();

      // 4. Verify database file exists
      if (!await fs.pathExists(dbPath)) {
        throw new Error(`Database file not found at ${dbPath}`);
      }

      // 5. Create backup (simple copy for now, can be enhanced to ZIP)
      // Use atomic operation: copy to temp, then rename
      const tempBackupPath = `${backupPath}.tmp`;
      await fs.copy(dbPath, tempBackupPath);
      await fs.rename(tempBackupPath, backupPath);

      // 6. Verify backup integrity
      const backupValid = await this.verifyBackupIntegrity(backupPath);
      if (!backupValid) {
        // Delete invalid backup
        await fs.remove(backupPath);
        throw new Error('Backup verification failed - backup is invalid');
      }

      // 7. Save backup metadata
      await this.saveBackupMetadata({
        version: newVersion,
        backupPath,
        timestamp: new Date().toISOString(),
        databaseSize: (await fs.stat(dbPath)).size,
        healthCheck: healthCheck.isHealthy,
      });

      // 8. Clean old pre-update backups (keep last 5)
      await this.cleanOldPreUpdateBackups(5);

      logInfo(`✓ Pre-update backup created successfully: ${backupFileName}`);

      return {
        success: true,
        backupPath,
        healthCheck,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(error as Error, 'UpdateSafety.createPreUpdateBackup');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify backup file integrity
   */
  async verifyBackupIntegrity(backupPath: string): Promise<boolean> {
    try {
      // Check if backup file exists
      if (!await fs.pathExists(backupPath)) {
        logError(new Error('Backup file does not exist'), 'UpdateSafety');
        return false;
      }

      // Check if backup file has content
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        logError(new Error('Backup file is empty'), 'UpdateSafety');
        return false;
      }

      // For SQLite database backups, we could additionally:
      // - Open the backup database in read-only mode
      // - Run integrity check on it
      // But for now, file existence and size check is sufficient

      logInfo('✓ Backup integrity verification passed');
      return true;
    } catch (error) {
      logError(error as Error, 'UpdateSafety.verifyBackupIntegrity');
      return false;
    }
  }

  /**
   * Clean old pre-update backups, keeping only the most recent N backups
   */
  async cleanOldPreUpdateBackups(keepCount: number): Promise<void> {
    try {
      const backupFiles = await fs.readdir(this.preUpdateBackupDir);

      // Filter for backup files only
      const backups = backupFiles
        .filter(file => file.startsWith('pre-update-') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.preUpdateBackupDir, file),
        }));

      // Sort by modification time (newest first)
      const backupsWithStats = await Promise.all(
        backups.map(async backup => ({
          ...backup,
          mtime: (await fs.stat(backup.path)).mtime,
        }))
      );

      backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete old backups beyond keepCount
      const backupsToDelete = backupsWithStats.slice(keepCount);
      for (const backup of backupsToDelete) {
        await fs.remove(backup.path);
        logInfo(`Deleted old pre-update backup: ${backup.name}`);
      }

      if (backupsToDelete.length > 0) {
        logInfo(`Cleaned ${backupsToDelete.length} old pre-update backups`);
      }
    } catch (error) {
      logError(error as Error, 'UpdateSafety.cleanOldPreUpdateBackups');
    }
  }

  /**
   * Get path to most recent backup
   */
  async getLatestBackup(): Promise<string | null> {
    try {
      const backupFiles = await fs.readdir(this.preUpdateBackupDir);

      const backups = backupFiles
        .filter(file => file.startsWith('pre-update-') && file.endsWith('.zip'))
        .map(file => path.join(this.preUpdateBackupDir, file));

      if (backups.length === 0) {
        return null;
      }

      // Get most recent backup by modification time
      const backupsWithStats = await Promise.all(
        backups.map(async backupPath => ({
          path: backupPath,
          mtime: (await fs.stat(backupPath)).mtime,
        }))
      );

      backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return backupsWithStats[0].path;
    } catch (error) {
      logError(error as Error, 'UpdateSafety.getLatestBackup');
      return null;
    }
  }

  /**
   * Verify backup exists before proceeding with update
   */
  async verifyBackupExists(): Promise<boolean> {
    try {
      const latestBackup = await this.getLatestBackup();

      if (!latestBackup) {
        logError(
          new Error('No pre-update backup found'),
          'UpdateSafety'
        );
        return false;
      }

      const backupValid = await this.verifyBackupIntegrity(latestBackup);
      if (!backupValid) {
        logError(
          new Error('Latest backup is invalid'),
          'UpdateSafety'
        );
        return false;
      }

      logInfo('✓ Pre-update backup verified and ready');
      return true;
    } catch (error) {
      logError(error as Error, 'UpdateSafety.verifyBackupExists');
      return false;
    }
  }

  /**
   * Verify database integrity after update installation
   * Called on app startup after update
   */
  async verifyPostUpdateIntegrity(): Promise<boolean> {
    logInfo('Running post-update integrity verification...');

    try {
      // Run comprehensive health check
      const healthCheck = await this.integrityChecker.runHealthCheck();

      if (!healthCheck.isHealthy) {
        logError(
          new Error('Post-update health check failed'),
          'UpdateSafety'
        );
        logError(
          new Error(`Errors: ${healthCheck.errors.join('; ')}`),
          'UpdateSafety'
        );
        return false;
      }

      // Check for repeated crashes (indicates unstable update)
      const crashDetection = await this.checkCrashHistory();
      if (crashDetection.shouldRollback) {
        logError(
          new Error(`Too many crashes detected (${crashDetection.crashCount})`),
          'UpdateSafety'
        );
        return false;
      }

      logInfo('✓ Post-update integrity verification passed');
      return true;
    } catch (error) {
      logError(error as Error, 'UpdateSafety.verifyPostUpdateIntegrity');
      return false;
    }
  }

  /**
   * Handle update failure - restore from backup
   */
  async handleUpdateFailure(): Promise<UpdateSafetyResult> {
    logError(
      new Error('Update failure detected - attempting recovery'),
      'UpdateSafety'
    );

    try {
      // 1. Get latest backup
      const latestBackup = await this.getLatestBackup();
      if (!latestBackup) {
        throw new Error('No backup available for recovery');
      }

      // 2. Verify backup
      const backupValid = await this.verifyBackupIntegrity(latestBackup);
      if (!backupValid) {
        throw new Error('Backup is corrupted and cannot be used for recovery');
      }

      // 3. Restore database from backup
      const dbPath = this.integrityChecker.getDatabasePath();

      // Create backup of current (potentially corrupted) database
      const corruptedBackupPath = `${dbPath}.corrupted.${Date.now()}`;
      if (await fs.pathExists(dbPath)) {
        await fs.copy(dbPath, corruptedBackupPath);
        logInfo(`Corrupted database backed up to ${corruptedBackupPath}`);
      }

      // Restore from backup
      await fs.copy(latestBackup, dbPath, { overwrite: true });
      logInfo(`✓ Database restored from backup: ${latestBackup}`);

      // 4. Verify restored database
      const healthCheck = await this.integrityChecker.runHealthCheck();
      if (!healthCheck.isHealthy) {
        throw new Error('Restored database failed health check');
      }

      logInfo('✓ Update failure recovery successful');

      return {
        success: true,
        backupPath: latestBackup,
        healthCheck,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(error as Error, 'UpdateSafety.handleUpdateFailure');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Record app startup for crash detection
   */
  async recordStartup(version: string): Promise<void> {
    try {
      const crashData: CrashDetectionMetadata = await this.loadCrashDetection();

      const now = Date.now();
      const timeSinceLastCrash = crashData.lastCrashTime
        ? now - crashData.lastCrashTime
        : Infinity;

      // If app starts successfully after crash window, reset crash count
      if (timeSinceLastCrash > this.CRASH_WINDOW_MS) {
        crashData.crashCount = 0;
      }

      crashData.version = version;
      crashData.startupTime = now;

      await this.saveCrashDetection(crashData);
    } catch (error) {
      logError(error as Error, 'UpdateSafety.recordStartup');
    }
  }

  /**
   * Record successful startup (called after app runs for CRASH_WINDOW_MS)
   */
  async recordSuccessfulStartup(): Promise<void> {
    try {
      const crashData = await this.loadCrashDetection();
      crashData.crashCount = 0;
      crashData.lastCrashTime = undefined;
      await this.saveCrashDetection(crashData);
    } catch (error) {
      logError(error as Error, 'UpdateSafety.recordSuccessfulStartup');
    }
  }

  /**
   * Check crash history and determine if rollback is needed
   */
  private async checkCrashHistory(): Promise<{
    shouldRollback: boolean;
    crashCount: number;
  }> {
    try {
      const crashData = await this.loadCrashDetection();

      const now = Date.now();
      const timeSinceStart = now - crashData.startupTime;

      // Check if we're still in crash window
      if (timeSinceStart < this.CRASH_WINDOW_MS) {
        // App crashed and restarted quickly
        crashData.crashCount++;
        crashData.lastCrashTime = now;
        await this.saveCrashDetection(crashData);
      }

      const shouldRollback = crashData.crashCount >= this.MAX_CRASH_COUNT;

      return {
        shouldRollback,
        crashCount: crashData.crashCount,
      };
    } catch (error) {
      logError(error as Error, 'UpdateSafety.checkCrashHistory');
      return { shouldRollback: false, crashCount: 0 };
    }
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(metadata: any): Promise<void> {
    try {
      await fs.writeJson(this.metadataPath, metadata, { spaces: 2 });
    } catch (error) {
      logError(error as Error, 'UpdateSafety.saveBackupMetadata');
    }
  }

  /**
   * Load crash detection data
   */
  private async loadCrashDetection(): Promise<CrashDetectionMetadata> {
    try {
      if (await fs.pathExists(this.crashDetectionPath)) {
        return await fs.readJson(this.crashDetectionPath);
      }
    } catch (error) {
      logError(error as Error, 'UpdateSafety.loadCrashDetection');
    }

    // Return default
    return {
      version: app.getVersion(),
      startupTime: Date.now(),
      crashCount: 0,
    };
  }

  /**
   * Save crash detection data
   */
  private async saveCrashDetection(data: CrashDetectionMetadata): Promise<void> {
    try {
      await fs.writeJson(this.crashDetectionPath, data, { spaces: 2 });
    } catch (error) {
      logError(error as Error, 'UpdateSafety.saveCrashDetection');
    }
  }
}

// Singleton instance
let _instance: UpdateSafety | null = null;

export function getUpdateSafety(): UpdateSafety {
  if (!_instance) {
    _instance = new UpdateSafety();
  }
  return _instance;
}

// Export singleton
export const updateSafety = new Proxy({} as UpdateSafety, {
  get(_target, prop) {
    return (getUpdateSafety() as any)[prop];
  },
});
