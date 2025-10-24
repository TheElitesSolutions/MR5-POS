/**
 * Startup Manager for MR5-POS-v2 (Nextron Edition)
 * Simplified version optimized for Nextron with better-sqlite3
 */

import { BrowserWindow } from 'electron';
import { enhancedLogger, LogCategory } from './utils/enhanced-logger';
import { prisma } from './db/prisma-wrapper';

// Controller imports
import { AddonController } from './controllers/addonController';
import { AuthController } from './controllers/authController';
import { BackupController } from './controllers/backupController';
import { DashboardController } from './controllers/dashboardController';
import { ExpenseController } from './controllers/expenseController';
import { InventoryController } from './controllers/inventoryController';
import { LogController } from './controllers/logController';
import { MenuController } from './controllers/menuController';
import { MenuItemController } from './controllers/menuItemController';
import { OrderController } from './controllers/orderController';
import { PrinterController } from './controllers/printerController';
import { ReportController } from './controllers/reportController';
import { SettingsController } from './controllers/settingsController';
import { StockController } from './controllers/stockController';
import { SystemController } from './controllers/systemController';
import { TableController } from './controllers/tableController';
import { UpdaterController } from './controllers/updaterController';

// Service imports
import { OptimizedPrintingService } from './services/optimizedPrintingService';
import { printerSpoolerService } from './services/printerSpoolerService';
import { nativePrinterDetection } from './services/nativePrinterDetection';
import { SupabaseSyncService } from './services/supabaseSync';
import { SyncScheduler } from './services/syncScheduler';
import { SyncController } from './controllers/syncController';
import { DatabaseManagementController } from './controllers/databaseManagementController';
import { DiagnosticController } from './controllers/diagnosticController';
import { ipcMain } from 'electron';

// Controller interface
interface Controller {
  initialize(): void;
  unregisterHandlers(): void;
  cleanup?(): void;
}

export class StartupManagerNextron {
  private controllers: Map<string, Controller> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private startupTimes: Map<string, number> = new Map();

  constructor() {
    enhancedLogger.info('[StartupManager] Initializing Nextron startup manager', LogCategory.SYSTEM, 'StartupManager');
  }

  /**
   * Initialize all controllers with IPC handlers
   */
  async initializeControllers(): Promise<void> {
    try {
      const startTime = Date.now();
      enhancedLogger.info('[StartupManager] Initializing controllers...', LogCategory.SYSTEM, 'StartupManager');

      // Test database connection first
      try {
        await prisma.$queryRaw('SELECT 1 as test');
        enhancedLogger.info('[StartupManager] Database connection verified', LogCategory.SYSTEM, 'StartupManager');
      } catch (dbError) {
        enhancedLogger.error('[StartupManager] Database test failed', LogCategory.SYSTEM, 'StartupManager', { error: dbError });
        throw new Error('Database not accessible');
      }

      // Initialize controllers in logical groups

      // Group 1: Core controllers (no dependencies on other controllers)
      enhancedLogger.info('[StartupManager] Initializing core controllers...', LogCategory.SYSTEM, 'StartupManager');
      const coreControllers = [
        { name: 'AuthController', instance: new AuthController() },
        { name: 'SystemController', instance: new SystemController() },
        { name: 'LogController', instance: new LogController() },
        { name: 'SettingsController', instance: new SettingsController() },
        { name: 'DiagnosticController', instance: new DiagnosticController() },
      ];

      for (const { name, instance } of coreControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          enhancedLogger.info(`[StartupManager] ✓ ${name} initialized`, LogCategory.SYSTEM, 'StartupManager');
        } catch (error) {
          enhancedLogger.error(`[StartupManager] ✗ ${name} failed`, LogCategory.SYSTEM, 'StartupManager', { error });
          // Only throw for critical controllers that break the entire system
          if (name === 'AuthController' || name === 'SettingsController') {
            enhancedLogger.error(`[StartupManager] CRITICAL: ${name} is required for system operation`, LogCategory.SYSTEM, 'StartupManager');
            throw error;
          }
          // Non-critical controllers: log error and continue
          enhancedLogger.error(`[StartupManager] ${name} failed but continuing initialization`, LogCategory.SYSTEM, 'StartupManager');
        }
      }

      // Group 2: Data controllers (depend on core but not on each other)
      enhancedLogger.info('[StartupManager] Initializing data controllers...', LogCategory.SYSTEM, 'StartupManager');
      const dataControllers = [
        { name: 'MenuController', instance: new MenuController(prisma) },
        { name: 'MenuItemController', instance: new MenuItemController() },
        { name: 'TableController', instance: new TableController() },
        { name: 'AddonController', instance: new AddonController() },
        { name: 'StockController', instance: new StockController() },
        { name: 'InventoryController', instance: new InventoryController() },
        { name: 'ExpenseController', instance: new ExpenseController() },
        { name: 'ReportController', instance: new ReportController() },
      ];

      for (const { name, instance } of dataControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          enhancedLogger.info(`[StartupManager] ✓ ${name} initialized`, LogCategory.SYSTEM, 'StartupManager');
        } catch (error) {
          enhancedLogger.error(`[StartupManager] ✗ ${name} failed`, LogCategory.SYSTEM, 'StartupManager', { error });
          // Non-critical, continue
        }
      }

      // Group 3: Complex controllers (depend on multiple other controllers)
      enhancedLogger.info('[StartupManager] Initializing complex controllers...', LogCategory.SYSTEM, 'StartupManager');
      const complexControllers = [
        { name: 'OrderController', instance: new OrderController() },
        { name: 'DashboardController', instance: new DashboardController() },
        { name: 'PrinterController', instance: new PrinterController() },
      ];

      for (const { name, instance } of complexControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          enhancedLogger.info(`[StartupManager] ✓ ${name} initialized`, LogCategory.SYSTEM, 'StartupManager');
        } catch (error) {
          enhancedLogger.error(`[StartupManager] ✗ ${name} failed`, LogCategory.SYSTEM, 'StartupManager', { error });
          // Non-critical, continue
        }
      }

      // Group 4: Optional controllers
      enhancedLogger.info('[StartupManager] Initializing optional controllers...', LogCategory.SYSTEM, 'StartupManager');
      const optionalControllers = [
        { name: 'BackupController', instance: new BackupController() },
        { name: 'UpdaterController', instance: new UpdaterController() },
      ];

      for (const { name, instance } of optionalControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          enhancedLogger.info(`[StartupManager] ✓ ${name} initialized`, LogCategory.SYSTEM, 'StartupManager');
        } catch (error) {
          enhancedLogger.error(`[StartupManager] ✗ ${name} failed (non-critical)`, LogCategory.SYSTEM, 'StartupManager', { error });
          // Completely optional, just log
        }
      }

      // Initialize OptimizedPrintingService
      enhancedLogger.info('[StartupManager] Initializing OptimizedPrintingService...', LogCategory.SYSTEM, 'StartupManager');
      try {
        const optimizedPrinting = OptimizedPrintingService.getInstance();
        optimizedPrinting.registerIPCHandlers(ipcMain);
        enhancedLogger.info('[StartupManager] ✓ OptimizedPrintingService initialized', LogCategory.SYSTEM, 'StartupManager');
      } catch (error) {
        enhancedLogger.error('[StartupManager] ✗ OptimizedPrintingService failed (non-critical)', LogCategory.SYSTEM, 'StartupManager', { error });
      }

      // Initialize PrinterSpoolerService for background optimization
      enhancedLogger.info('[StartupManager] Initializing PrinterSpoolerService...', LogCategory.SYSTEM, 'StartupManager');
      try {
        printerSpoolerService.startMonitoring();
        enhancedLogger.info('[StartupManager] ✓ PrinterSpoolerService monitoring started', LogCategory.SYSTEM, 'StartupManager');
      } catch (error) {
        enhancedLogger.error('[StartupManager] ✗ PrinterSpoolerService failed (non-critical)', LogCategory.SYSTEM, 'StartupManager', { error });
      }

      // Initialize NativePrinterDetection service (Phase 2 - Native Win32 API detection)
      enhancedLogger.info('[StartupManager] Initializing NativePrinterDetection service...', LogCategory.SYSTEM, 'StartupManager');
      try {
        // Service auto-initializes as singleton, just log stats
        const stats = nativePrinterDetection.getStats();
        enhancedLogger.info('[StartupManager] ✓ NativePrinterDetection service ready', LogCategory.SYSTEM, 'StartupManager', { stats });
      } catch (error) {
        enhancedLogger.error('[StartupManager] ✗ NativePrinterDetection service failed (non-critical)', LogCategory.SYSTEM, 'StartupManager', { error });
      }

      // Initialize Supabase Sync Services
      enhancedLogger.info('[StartupManager] Initializing Supabase Sync Services...', LogCategory.SYSTEM, 'StartupManager');
      try {
        const supabaseSyncService = new SupabaseSyncService(prisma);
        const syncScheduler = new SyncScheduler(supabaseSyncService);
        const syncController = new SyncController(supabaseSyncService, syncScheduler);

        syncController.initialize();
        this.controllers.set('SyncController', syncController);
        enhancedLogger.info('[StartupManager] ✓ Supabase Sync Services initialized', LogCategory.SYSTEM, 'StartupManager');

        // Note: Auto-sync is not started by default.
        // Users can enable it from the Menu sync button or Settings.
      } catch (error) {
        enhancedLogger.error('[StartupManager] ✗ Supabase Sync Services failed (non-critical)', LogCategory.SYSTEM, 'StartupManager', { error });
      }

      // Initialize Database Management Controller
      enhancedLogger.info('[StartupManager] Initializing Database Management Controller...', LogCategory.SYSTEM, 'StartupManager');
      try {
        const dbManagementController = new DatabaseManagementController();
        dbManagementController.initialize();
        this.controllers.set('DatabaseManagementController', dbManagementController);
        enhancedLogger.info('[StartupManager] ✓ Database Management Controller initialized', LogCategory.SYSTEM, 'StartupManager');
      } catch (error) {
        enhancedLogger.error('[StartupManager] ✗ Database Management Controller failed (non-critical)', LogCategory.SYSTEM, 'StartupManager', { error });
      }

      const duration = Date.now() - startTime;
      this.startupTimes.set('controllers_init', duration);
      enhancedLogger.info(`[StartupManager] All controllers initialized in ${duration}ms`, LogCategory.SYSTEM, 'StartupManager');
      enhancedLogger.info(`[StartupManager] Total controllers: ${this.controllers.size}`, LogCategory.SYSTEM, 'StartupManager');
    } catch (error) {
      enhancedLogger.error('[StartupManager] Fatal error during controller initialization', LogCategory.SYSTEM, 'StartupManager', { error });
      throw error;
    }
  }

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    enhancedLogger.info('[StartupManager] Main window reference set', LogCategory.SYSTEM, 'StartupManager');
  }

  /**
   * Get the main window
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Cleanup all controllers on shutdown
   */
  async cleanup(): Promise<void> {
    enhancedLogger.info('[StartupManager] Cleaning up controllers...', LogCategory.SYSTEM, 'StartupManager');

    // Stop PrinterSpoolerService monitoring
    try {
      printerSpoolerService.stopMonitoring();
      enhancedLogger.info('[StartupManager] ✓ PrinterSpoolerService stopped', LogCategory.SYSTEM, 'StartupManager');
    } catch (error) {
      enhancedLogger.error('[StartupManager] ✗ PrinterSpoolerService stop failed', LogCategory.SYSTEM, 'StartupManager', { error });
    }

    for (const [name, controller] of Array.from(this.controllers.entries())) {
      try {
        controller.unregisterHandlers();
        if (controller.cleanup) {
          controller.cleanup();
        }
        enhancedLogger.info(`[StartupManager] ✓ ${name} cleaned up`, LogCategory.SYSTEM, 'StartupManager');
      } catch (error) {
        enhancedLogger.error(`[StartupManager] ✗ ${name} cleanup failed`, LogCategory.SYSTEM, 'StartupManager', { error });
      }
    }

    this.controllers.clear();
    enhancedLogger.info('[StartupManager] All controllers cleaned up', LogCategory.SYSTEM, 'StartupManager');
  }

  /**
   * Get startup metrics
   */
  getMetrics(): { [key: string]: number } {
    return Object.fromEntries(this.startupTimes);
  }
}