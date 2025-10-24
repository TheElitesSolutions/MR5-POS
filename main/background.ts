/**
 * MR5 POS v2 - Main Process Entry Point
 * Electron main process with database initialization
 */

// Load environment variables from .env file FIRST
import dotenv from 'dotenv';
import path from 'path';
import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';

// In production, the .env file should be in the unpacked asar directory
const isProdEnv = process.env.NODE_ENV === 'production';
if (isProdEnv) {
  // Try unpacked path first (outside asar), then fallback to other locations
  const possiblePaths = [
    path.join(process.resourcesPath, '.env'),                    // resources/.env
    path.join(process.resourcesPath, 'app.asar.unpacked', '.env'), // unpacked from asar
    path.join(app.getAppPath(), '.env'),                         // inside asar (fallback)
    path.join(__dirname, '..', '.env'),
  ];

  let envLoaded = false;
  for (const envPath of possiblePaths) {
    try {
      const result = dotenv.config({ path: envPath });
      if (!result.error) {
        console.log('[ENV] ✅ Loaded environment variables from:', envPath);
        console.log('[ENV] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
        console.log('[ENV] SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ?
          'SET (length: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET');
        envLoaded = true;
        break;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  if (!envLoaded) {
    console.error('[ENV] ❌ Could not find .env file in production.');
    console.error('[ENV] Tried paths:', possiblePaths);
    console.error('[ENV] Supabase import will not work without environment variables.');
  }
} else {
  // Development mode - load from project root
  dotenv.config();
  console.log('[ENV] ✅ Loaded environment variables from project root');
  console.log('[ENV] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
}
import serve from 'electron-serve';
import { createWindow } from './helpers';
import { initializeDatabase, closeDatabase } from './db';
import { StartupManagerNextron } from './startup-manager-nextron';
import { ServiceFactory } from './services/serviceFactory';
import { prisma } from './prisma';
import { ensureDefaultAdminExists } from './utils/create-default-admin';
import { getUpdateSafety } from './utils/updateSafety';
import { getUpdaterController } from './controllers/updaterController';
import { logInfo, logError } from './error-handler';
import { enhancedLogger, LogCategory } from './utils/enhanced-logger';

const isProd = process.env.NODE_ENV === 'production';

// Serve static files in production
if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

// Global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let startupManager: StartupManagerNextron | null = null;

// Initialize application
(async () => {
  await app.whenReady();

  // CRITICAL: Verify post-update integrity FIRST (before initializing database)
  console.log('[Main] Checking post-update integrity...');
  try {
    const updateSafety = getUpdateSafety();
    const integrityOk = await updateSafety.verifyPostUpdateIntegrity();

    if (!integrityOk) {
      logError(
        new Error('Post-update integrity check failed - attempting recovery'),
        'Main'
      );

      // Attempt recovery from backup
      const recoveryResult = await updateSafety.handleUpdateFailure();

      if (!recoveryResult.success) {
        dialog.showErrorBox(
          'Update Recovery Failed',
          `The application failed to recover from an update error.\n\n${recoveryResult.error}\n\nPlease contact support.`
        );
        app.quit();
        return;
      }

      logInfo('Successfully recovered from update failure', 'Main');
    } else {
      logInfo('Post-update integrity check passed', 'Main');
    }

    // Record successful startup for crash detection
    await updateSafety.recordStartup(app.getVersion());

    // After CRASH_WINDOW_MS (2 minutes), mark startup as successful
    setTimeout(async () => {
      await updateSafety.recordSuccessfulStartup();
      logInfo('Startup completed successfully - crash detection window closed', 'Main');
    }, 2 * 60 * 1000);

  } catch (error) {
    logError(error as Error, 'Main - Update Safety Check');
    // Continue anyway - don't block app startup on update safety checks
  }

  // CRITICAL: Initialize database before creating window
  console.log('[Main] Initializing database...');
  try {
    initializeDatabase();
    console.log('[Main] Database initialized successfully');
  } catch (error) {
    console.error('[Main] Database initialization failed:', error);
    dialog.showErrorBox(
      'Database Initialization Error',
      `Failed to initialize database:\n\n${error instanceof Error ? error.message : String(error)}\n\nStack:\n${error instanceof Error ? error.stack : ''}`
    );
  }

  // Initialize all services BEFORE controllers
  console.log('[Main] Initializing services...');
  try {
    ServiceFactory.initializeServices(prisma as any);
    console.log('[Main] All services initialized successfully');
  } catch (error) {
    console.error('[Main] Service initialization failed:', error);
    dialog.showErrorBox(
      'Service Initialization Error',
      `Failed to initialize services:\n\n${error instanceof Error ? error.message : String(error)}\n\nStack:\n${error instanceof Error ? error.stack : ''}`
    );
  }

  // Ensure default admin user exists
  console.log('[Main] ===== Ensuring default admin user exists =====');
  try {
    await ensureDefaultAdminExists();
    console.log('[Main] ===== Default admin user check complete =====');
  } catch (error) {
    console.error('[Main] ===== FAILED to create default admin user =====');
    console.error('[Main] Error details:', error);
    console.error('[Main] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    // Show warning in console but don't block app startup
    console.warn('[Main] WARNING: Admin user may not have been created. Check logs above for details.');
    console.warn('[Main] You can manually create an admin user using the scripts in /scripts directory.');
  }

  // Initialize startup manager and controllers
  console.log('[Main] Initializing controllers...');
  try {
    startupManager = new StartupManagerNextron();
    await startupManager.initializeControllers();
    console.log('[Main] All IPC handlers registered successfully');
  } catch (error) {
    console.error('[Main] Controller initialization failed:', error);
    dialog.showErrorBox(
      'Controller Initialization Error',
      `Failed to initialize controllers:\n\n${error instanceof Error ? error.message : String(error)}\n\nStack:\n${error instanceof Error ? error.stack : ''}`
    );
  }

  // Create main window
  mainWindow = createWindow('main', {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    frame: false,             // Remove window frame and title bar
    titleBarStyle: 'hidden',  // Hide title bar on macOS
    fullscreen: true,         // Open in fullscreen mode
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,  // Security: prevent node in renderer
      contextIsolation: true,   // Security: isolate contexts
      sandbox: false,           // Required for better-sqlite3
    },
  });

  // Set main window reference in startup manager
  if (startupManager) {
    startupManager.setMainWindow(mainWindow);
  }

  // Disable application menu (removes File, Edit, View, Window, Help menu bar)
  Menu.setApplicationMenu(null);

  // Initialize auto-update system (only in production)
  if (isProd) {
    try {
      logInfo('[Main] Initializing auto-update system...', 'Main');

      const updaterController = getUpdaterController();
      const updateSafety = getUpdateSafety();

      // Set main window reference for progress updates
      updaterController.setMainWindow(mainWindow);

      // Configure auto-update behavior
      // - Auto-download: true (download updates automatically)
      // - Auto-install on quit: true (install when app quits)
      updaterController.setAutoUpdate(true);

      // Start checking for updates every 6 hours
      updaterController.startAutoUpdateCheck(6);

      logInfo('[Main] Auto-update system initialized successfully', 'Main');

      // Note: Update lifecycle is now managed by UpdaterController
      // Pre-update backups are created automatically before download
      // Post-update verification happens on next app startup
    } catch (error) {
      logError(error as Error, 'Main - Auto-update initialization');
      // Don't block app startup if auto-update fails to initialize
    }
  } else {
    logInfo('[Main] Auto-update disabled in development mode', 'Main');
  }

  // Load application
  if (isProd) {
    await mainWindow.loadURL('app://./index.html');
  } else {
    const port = process.argv[2] || 8000;
    await mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  }

  // Prevent closing app without logging out
  let isForceClosing = false;

  mainWindow.on('close', async (event) => {
    if (isForceClosing) {
      // Allow close if force closing
      return;
    }

    // Prevent default close
    event.preventDefault();

    try {
      // Check if user is authenticated by reading localStorage
      const result = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const authStorage = localStorage.getItem('auth-storage');
            if (authStorage) {
              const parsed = JSON.parse(authStorage);
              return {
                isAuthenticated: parsed.state?.isAuthenticated || false,
                user: parsed.state?.user?.username || 'Unknown'
              };
            }
            return { isAuthenticated: false, user: null };
          } catch (e) {
            return { isAuthenticated: false, user: null };
          }
        })()
      `);

      if (result.isAuthenticated) {
        // User is still logged in - show dialog
        const response = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Logout Required',
          message: 'You are still logged in',
          detail: `User "${result.user}" is still authenticated. Please logout before closing the app, or click "Force Quit" to logout and close.`,
          buttons: ['Cancel', 'Force Quit & Logout'],
          defaultId: 0,
          cancelId: 0
        });

        if (response.response === 1) {
          // Force Quit & Logout selected
          enhancedLogger.info(
            'Force quit requested - clearing authentication and closing',
            LogCategory.SECURITY,
            'Main',
            { user: result.user, action: 'force-quit' }
          );

          // Clear localStorage
          await mainWindow.webContents.executeJavaScript(`
            localStorage.removeItem('auth-storage');
          `);

          enhancedLogger.info(
            'Authentication cleared - closing application',
            LogCategory.SECURITY,
            'Main',
            { user: result.user }
          );

          // Reset crash count before closing (this is a normal close, not a crash)
          await getUpdateSafety().recordSuccessfulStartup();

          // Now close for real - use destroy to avoid re-triggering close event
          isForceClosing = true;
          mainWindow.destroy();
        } else {
          // User cancelled - don't close
          enhancedLogger.info(
            'Close cancelled - user still logged in',
            LogCategory.SECURITY,
            'Main',
            { user: result.user }
          );
        }
      } else {
        // Not authenticated - allow close - use destroy to avoid re-triggering close event
        enhancedLogger.info(
          'Closing app - user not authenticated',
          LogCategory.SECURITY,
          'Main'
        );

        // Reset crash count before closing (this is a normal close, not a crash)
        await getUpdateSafety().recordSuccessfulStartup();

        isForceClosing = true;
        mainWindow.destroy();
      }
    } catch (error) {
      // Error checking auth - allow close to prevent app being stuck
      enhancedLogger.error(
        'Error checking authentication status - allowing close',
        LogCategory.SECURITY,
        'Main',
        { error: (error as Error).message },
        error as Error
      );

      // Reset crash count before closing (this is a normal close, not a crash)
      await getUpdateSafety().recordSuccessfulStartup();

      isForceClosing = true;
      mainWindow.destroy();
    }
  });

  // Prevent window from being garbage collected
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
})();

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  // Cleanup controllers
  if (startupManager) {
    await startupManager.cleanup();
  }

  // Close database connection
  closeDatabase();

  // On macOS, keep app active until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Reactivate app on macOS
app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = createWindow('main', {
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      frame: false,
      titleBarStyle: 'hidden',
      fullscreen: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });
  }
});

// IPC handler for app quit (used by custom close button)
ipcMain.handle('app:quit', async () => {
  try {
    logInfo('App quit requested via IPC', 'Main');

    // Reset crash count before closing (this is a normal close, not a crash)
    await getUpdateSafety().recordSuccessfulStartup();

    // Quit the application
    app.quit();
    return { success: true };
  } catch (error) {
    logError(error as Error, 'Main - App Quit Handler');
    return { success: false, error: (error as Error).message };
  }
});

// Example IPC handler (to be replaced with actual handlers)
ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`);
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
});
