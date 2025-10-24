import { SYSTEM_CHANNELS, BACKUP_CHANNELS } from '../../shared/ipc-channels';
import { AppError, logInfo } from '../error-handler';
import { BaseController } from './baseController';
import * as path from 'path';
import * as fs from 'fs';

export class SystemController extends BaseController {
  private appVersion: string = '2.3.0'; // Default version

  constructor() {
    super();
    // Load version from package.json
    this.loadAppVersion();
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  private loadAppVersion(): void {
    try {
      // In production: Read from app's package.json in resources
      // In development: Read from project root package.json
      const isDev = process.env.NODE_ENV !== 'production';

      let packageJsonPath: string;
      if (isDev) {
        // Development: Use project root
        packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      } else {
        // Production: package.json is in the app.asar or app folder
        packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      }

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        this.appVersion = packageJson.version || '2.3.0';
        logInfo(`App version loaded: ${this.appVersion}`);
      } else {
        logInfo(`package.json not found at ${packageJsonPath}, using default version`);
      }
    } catch (error) {
      logInfo(`Failed to load version from package.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  protected registerHandlers(): void {
    // Get system info
    this.registerHandler(
      SYSTEM_CHANNELS.GET_INFO,
      this.wrapHandler(async () => {
        // Return a properly formatted SystemInfo object
        return {
          platform: process.platform,
          arch: process.arch,
          electronVersion: process.versions.electron || 'unknown',
          nodeVersion: process.version,
          appVersion: this.appVersion, // Use dynamically loaded version
          isDevelopment: process.env.NODE_ENV !== 'production', // Required by interface
        };
      })
    );

    // Check for updates
    this.registerHandler(
      SYSTEM_CHANNELS.CHECK_FOR_UPDATES,
      this.wrapHandler(async () => {
        return {
          version: '1.0.0',
          updateAvailable: false,
          downloadUrl: null,
          releaseNotes: null,
        };
      })
    );

    // Install update
    this.registerHandler(
      SYSTEM_CHANNELS.INSTALL_UPDATE,
      this.wrapHandler(async () => {
        logInfo('Update installation requested');
        return true;
      })
    );

    // Restart app
    this.registerHandler(
      SYSTEM_CHANNELS.RESTART_APP,
      this.wrapHandler(async () => {
        logInfo('App restart requested');
        return true;
      })
    );

    // Quit app
    this.registerHandler(
      SYSTEM_CHANNELS.QUIT_APP,
      this.wrapHandler(async () => {
        logInfo('App quit requested');
        return true;
      })
    );

    // Get database status
    this.registerHandler(
      SYSTEM_CHANNELS.GET_DATABASE_STATUS,
      this.wrapHandler(async () => {
        // Return a properly formatted DatabaseStatus object
        return {
          connected: true, // Required by interface
          host: 'localhost',
          port: 5432,
          database: 'mr5-pos',
          error: undefined,
        };
      })
    );

    // Note: Backup/restore handlers are now managed by BackupController

    // Get logs
    this.registerHandler(
      SYSTEM_CHANNELS.GET_LOGS,
      this.wrapHandler(async (limit: number = 50) => {
        // Return empty array or mock data based on limit
        const mockLogs = [];
        const actualLimit = Math.min(limit, 200); // Cap at 200 logs

        for (let i = 0; i < actualLimit; i++) {
          mockLogs.push({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `Mock log entry ${i + 1}`,
          });
        }

        return mockLogs;
      })
    );

    logInfo('System IPC handlers registered');
  }

  public override unregisterHandlers(): void {
    const handlers = [
      SYSTEM_CHANNELS.GET_INFO,
      SYSTEM_CHANNELS.CHECK_FOR_UPDATES,
      SYSTEM_CHANNELS.INSTALL_UPDATE,
      SYSTEM_CHANNELS.RESTART_APP,
      SYSTEM_CHANNELS.QUIT_APP,
      SYSTEM_CHANNELS.GET_DATABASE_STATUS,
      SYSTEM_CHANNELS.GET_LOGS,
    ];

    handlers.forEach(handler => {
      this.unregisterHandler(handler);
    });

    logInfo('System IPC handlers unregistered');
  }
}
