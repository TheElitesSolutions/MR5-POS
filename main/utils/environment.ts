import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment Utilities for mr5-POS Electron Application
 */

/**
 * Check if the application is running in development mode
 * Note: app.isPackaged is only available after app is ready
 */
// Lazy evaluation - don't access app until actually needed
let _isDev: boolean | null = null;
let _isInitialized: boolean = false;

/**
 * Initialize environment settings after app is ready
 * This should be called once after app.whenReady()
 */
export function initializeEnvironment(): void {
  if (_isInitialized) return;

  // Now safe to access app properties
  try {
    // Check NODE_ENV first - it takes precedence for development convenience
    // This allows running built app in production mode with: NODE_ENV=production npm run electron
    if (process.env.NODE_ENV) {
      _isDev = process.env.NODE_ENV === 'development';
      console.log(`Environment set from NODE_ENV: ${process.env.NODE_ENV} -> isDev = ${_isDev}`);
    } else if (app && typeof app.isPackaged === 'boolean') {
      _isDev = !app.isPackaged;
      console.log(`Environment set from app.isPackaged: ${app.isPackaged} -> isDev = ${_isDev}`);
    } else {
      _isDev = false; // Default to production for safety
      console.log('Environment defaulted to production (isDev = false)');
    }
  } catch (e) {
    console.warn('Could not determine environment, defaulting to production:', e);
    _isDev = false;
  }

  _isInitialized = true;
  console.log(`Environment initialized: isDev = ${_isDev}`);
}

/**
 * Get isDev value - safe to call anytime
 */
export function getIsDev(): boolean {
  if (_isDev === null) {
    // Not initialized yet, use NODE_ENV as fallback
    return process.env.NODE_ENV === 'development';
  }
  return _isDev;
}

/**
 * Get the application data directory path
 * This is where user data, logs, and settings are stored
 */
export const getAppDataPath = (): string => {
  if (getIsDev()) {
    // In development, use a local directory
    return path.join(process.cwd(), 'app-data');
  } else {
    // In production, use the system's app data directory
    try {
      // Check if app is ready before using getPath
      if (app && app.getPath && app.isReady && app.isReady()) {
        return app.getPath('userData');
      }
    } catch (e) {
      // If app is not ready, use a fallback
      // Don't log to avoid noise during initialization
    }
    // Fallback to temp directory if app is not ready
    return path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos');
  }
};

/**
 * Get the logs directory path
 */
export const getLogPath = (): string => {
  return path.join(getAppDataPath(), 'logs');
};

/**
 * Get the database directory path
 */
export const getDatabasePath = (): string => {
  return path.join(getAppDataPath(), 'database');
};

/**
 * Get the temporary files directory path
 */
export const getTempPath = (): string => {
  return path.join(getAppDataPath(), 'temp');
};

/**
 * Get the backup directory path
 */
export const getBackupPath = (): string => {
  return path.join(getAppDataPath(), 'backups');
};

/**
 * Get the resources directory path
 */
export const getResourcesPath = (): string => {
  if (getIsDev()) {
    return path.join(process.cwd(), 'resources');
  } else {
    return path.join(process.resourcesPath, 'app');
  }
};

/**
 * Get the PostgreSQL installation path
 */
export const getPostgresPath = (): string => {
  if (getIsDev()) {
    // In development, use system PostgreSQL
    return '';
  } else {
    // In production, use bundled PostgreSQL
    return path.join(getResourcesPath(), 'postgresql');
  }
};

/**
 * Get the frontend build path or URL
 */
export const getFrontendPath = (): string => {
  if (getIsDev()) {
    // Development: Use Next.js development server
    return 'http://localhost:3000';
  } else {
    // Production: Frontend is built to dist-electron/renderer
    // In packaged app, this is inside app.asar or app.asar.unpacked
    try {
      if (app && app.isPackaged !== undefined && app.isPackaged) {
        // In packaged app, frontend is at app.asar/dist-electron/renderer
        if (app.getAppPath) {
          return path.join(app.getAppPath(), 'dist-electron', 'renderer');
        }
      }
    } catch (e) {
      // If app is not ready or isPackaged not available
    }
    // Fallback: In unpackaged production build or app not ready
    return path.join(process.cwd(), 'dist-electron', 'renderer');
  }
};

/**
 * Get the backend server path
 */
export const getBackendPath = (): string => {
  if (getIsDev()) {
    return path.join(process.cwd(), 'backend');
  } else {
    return path.join(getResourcesPath(), 'backend');
  }
};

/**
 * Get the preload script path
 */
export const getPreloadPath = (): string => {
  if (getIsDev()) {
    return path.join(process.cwd(), 'dist', 'main', 'preload.js');
  } else {
    // In production, __dirname is dist/main/utils, so go up one level
    return path.join(__dirname, '..', 'preload.js');
  }
};

/**
 * Get application configuration directory
 */
export const getConfigPath = (): string => {
  return path.join(getAppDataPath(), 'config');
};

/**
 * Get plugins directory path
 */
export const getPluginsPath = (): string => {
  return path.join(getAppDataPath(), 'plugins');
};

/**
 * Get crash reports directory path
 */
export const getCrashReportsPath = (): string => {
  return path.join(getAppDataPath(), 'crash-reports');
};

/**
 * Ensure all required directories exist
 */
export const ensureDirectories = (): void => {
  const directories = [
    getAppDataPath(),
    getLogPath(),
    getDatabasePath(),
    getTempPath(),
    getBackupPath(),
    getConfigPath(),
    getPluginsPath(),
    getCrashReportsPath(),
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  });
};

/**
 * Get comprehensive environment information
 */
export const getEnvironmentInfo = () => {
  // Safe defaults when app is not ready
  let appName = 'mr5-POS';
  let appVersion = '0.1.0';

  // Try to get actual values if app is ready
  try {
    if (app && app.getName) {
      appName = app.getName();
    }
    if (app && app.getVersion) {
      appVersion = app.getVersion();
    }
  } catch (e) {
    // Use defaults if app methods fail
  }

  return {
    // Application information
    appName,
    appVersion,

    // System information (always available)
    platform: process.platform,
    arch: process.arch,

    // Runtime versions (always available)
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    v8Version: process.versions.v8,

    // Environment flags
    isDev: getIsDev(),
    isPackaged: (app && app.isPackaged !== undefined) ? app.isPackaged : false,

    // Process information
    pid: process.pid,
    uptime: Math.floor(process.uptime()),

    // Memory information
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },

    // Paths
    paths: {
      appData: getAppDataPath(),
      logs: getLogPath(),
      database: getDatabasePath(),
      temp: getTempPath(),
      backup: getBackupPath(),
      config: getConfigPath(),
      resources: getResourcesPath(),
      frontend: getFrontendPath(),
      backend: getBackendPath(),
    },
  };
};

/**
 * Get system resource limits and capabilities
 */
export const getSystemCapabilities = () => {
  return {
    // File system limits
    maxFileDescriptors: process.getMaxListeners
      ? process.getMaxListeners()
      : 'Unknown',

    // Memory limits
    maxOldSpaceSize: process.execArgv.find(arg =>
      arg.includes('--max-old-space-size')
    ),

    // CPU information
    cpuUsage: process.cpuUsage ? process.cpuUsage() : null,

    // Feature flags
    features: {
      nodeIntegration: false, // Security: Always disabled
      contextIsolation: true, // Security: Always enabled
      webSecurity: true, // Security: Always enabled
      allowRunningInsecureContent: false, // Security: Always disabled
    },

    // Development features
    devFeatures: getIsDev()
      ? {
          devTools: true,
          hotReload: true,
          sourceMap: true,
          debugging: true,
        }
      : null,
  };
};

/**
 * Check if a path exists and is accessible
 */
export const isPathAccessible = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get disk space information for the app data directory
 */
export const getDiskSpaceInfo = (): { free: number; total: number } => {
  try {
    // Note: This is a simplified implementation
    // In a real application, you might want to use a library like 'node-disk-info'
    return {
      free: 1024 * 1024 * 1024 * 10, // 10GB placeholder
      total: 1024 * 1024 * 1024 * 100, // 100GB placeholder
    };
  } catch {
    return { free: 0, total: 0 };
  }
};

/**
 * Clean up temporary files and old logs
 */
export const cleanupTempFiles = (
  maxAge: number = 7 * 24 * 60 * 60 * 1000
): void => {
  const tempDir = getTempPath();
  const logsDir = getLogPath();

  const cleanup = (directory: string) => {
    try {
      if (!fs.existsSync(directory)) return;

      const files = fs.readdirSync(directory);
      const now = Date.now();

      files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error(`Failed to cleanup ${directory}:`, error);
    }
  };

  cleanup(tempDir);
  cleanup(logsDir);
};

/**
 * Get application startup time
 */
export const getStartupTime = (): number => {
  return Date.now() - process.uptime() * 1000;
};

/**
 * Check if running in a sandboxed environment
 */
export const isSandboxed = (): boolean => {
  // This would be true if the app is running in a sandboxed environment
  // like macOS App Store or Windows Store
  return process.mas === true || process.windowsStore === true;
};

/**
 * Get the current working directory safely
 */
export const getSafeWorkingDirectory = (): string => {
  try {
    return process.cwd();
  } catch {
    return app.getAppPath();
  }
};
