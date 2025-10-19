/**
 * Startup Manager for MR5-POS-v2 (Nextron Edition)
 * Simplified version optimized for Nextron with better-sqlite3
 */

import { BrowserWindow } from 'electron';
import { logError, logInfo } from './error-handler';
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
import { SupabaseSyncService } from './services/supabaseSync';
import { SyncScheduler } from './services/syncScheduler';
import { SyncController } from './controllers/syncController';
import { DatabaseManagementController } from './controllers/databaseManagementController';
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
    logInfo('[StartupManager] Initializing Nextron startup manager');
  }

  /**
   * Initialize all controllers with IPC handlers
   */
  async initializeControllers(): Promise<void> {
    try {
      const startTime = Date.now();
      logInfo('[StartupManager] Initializing controllers...');

      // Test database connection first
      try {
        await prisma.$queryRaw('SELECT 1 as test');
        logInfo('[StartupManager] Database connection verified');
      } catch (dbError) {
        logError('[StartupManager] Database test failed:', dbError);
        throw new Error('Database not accessible');
      }

      // Initialize controllers in logical groups

      // Group 1: Core controllers (no dependencies on other controllers)
      logInfo('[StartupManager] Initializing core controllers...');
      const coreControllers = [
        { name: 'AuthController', instance: new AuthController() },
        { name: 'SystemController', instance: new SystemController() },
        { name: 'LogController', instance: new LogController() },
        { name: 'SettingsController', instance: new SettingsController() },
      ];

      for (const { name, instance } of coreControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          logInfo(`[StartupManager] ✓ ${name} initialized`);
        } catch (error) {
          logError(`[StartupManager] ✗ ${name} failed:`, error);
          throw error;
        }
      }

      // Group 2: Data controllers (depend on core but not on each other)
      logInfo('[StartupManager] Initializing data controllers...');
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
          logInfo(`[StartupManager] ✓ ${name} initialized`);
        } catch (error) {
          logError(`[StartupManager] ✗ ${name} failed:`, error);
          // Non-critical, continue
        }
      }

      // Group 3: Complex controllers (depend on multiple other controllers)
      logInfo('[StartupManager] Initializing complex controllers...');
      const complexControllers = [
        { name: 'OrderController', instance: new OrderController() },
        { name: 'DashboardController', instance: new DashboardController() },
        { name: 'PrinterController', instance: new PrinterController() },
      ];

      for (const { name, instance } of complexControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          logInfo(`[StartupManager] ✓ ${name} initialized`);
        } catch (error) {
          logError(`[StartupManager] ✗ ${name} failed:`, error);
          // Non-critical, continue
        }
      }

      // Group 4: Optional controllers
      logInfo('[StartupManager] Initializing optional controllers...');
      const optionalControllers = [
        { name: 'BackupController', instance: new BackupController() },
        { name: 'UpdaterController', instance: new UpdaterController() },
      ];

      for (const { name, instance } of optionalControllers) {
        try {
          instance.initialize();
          this.controllers.set(name, instance);
          logInfo(`[StartupManager] ✓ ${name} initialized`);
        } catch (error) {
          logError(`[StartupManager] ✗ ${name} failed (non-critical):`, error);
          // Completely optional, just log
        }
      }

      // Initialize OptimizedPrintingService
      logInfo('[StartupManager] Initializing OptimizedPrintingService...');
      try {
        const optimizedPrinting = OptimizedPrintingService.getInstance();
        optimizedPrinting.registerIPCHandlers(ipcMain);
        logInfo('[StartupManager] ✓ OptimizedPrintingService initialized');
      } catch (error) {
        logError('[StartupManager] ✗ OptimizedPrintingService failed (non-critical):', error);
      }

      // Initialize Supabase Sync Services
      logInfo('[StartupManager] Initializing Supabase Sync Services...');
      try {
        const supabaseSyncService = new SupabaseSyncService(prisma);
        const syncScheduler = new SyncScheduler(supabaseSyncService);
        const syncController = new SyncController(supabaseSyncService, syncScheduler);
        
        syncController.initialize();
        this.controllers.set('SyncController', syncController);
        logInfo('[StartupManager] ✓ Supabase Sync Services initialized');
        
        // Note: Auto-sync is not started by default. 
        // Users can enable it from the Menu sync button or Settings.
      } catch (error) {
        logError('[StartupManager] ✗ Supabase Sync Services failed (non-critical):', error);
      }

      // Initialize Database Management Controller
      logInfo('[StartupManager] Initializing Database Management Controller...');
      try {
        const dbManagementController = new DatabaseManagementController();
        dbManagementController.initialize();
        this.controllers.set('DatabaseManagementController', dbManagementController);
        logInfo('[StartupManager] ✓ Database Management Controller initialized');
      } catch (error) {
        logError('[StartupManager] ✗ Database Management Controller failed (non-critical):', error);
      }

      const duration = Date.now() - startTime;
      this.startupTimes.set('controllers_init', duration);
      logInfo(`[StartupManager] All controllers initialized in ${duration}ms`);
      logInfo(`[StartupManager] Total controllers: ${this.controllers.size}`);
    } catch (error) {
      logError('[StartupManager] Fatal error during controller initialization:', error);
      throw error;
    }
  }

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    logInfo('[StartupManager] Main window reference set');
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
    logInfo('[StartupManager] Cleaning up controllers...');

    for (const [name, controller] of Array.from(this.controllers.entries())) {
      try {
        controller.unregisterHandlers();
        if (controller.cleanup) {
          controller.cleanup();
        }
        logInfo(`[StartupManager] ✓ ${name} cleaned up`);
      } catch (error) {
        logError(`[StartupManager] ✗ ${name} cleanup failed:`, error);
      }
    }

    this.controllers.clear();
    logInfo('[StartupManager] All controllers cleaned up');
  }

  /**
   * Get startup metrics
   */
  getMetrics(): { [key: string]: number } {
    return Object.fromEntries(this.startupTimes);
  }
}
