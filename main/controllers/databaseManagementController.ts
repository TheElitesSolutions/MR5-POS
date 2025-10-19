import { IpcMainInvokeEvent } from 'electron';
import { BaseController } from './baseController';
import { IPCResponse } from '../types';
import { logInfo } from '../error-handler';
import { DatabaseManagementService } from '../services/databaseManagementService';
import { SupabaseImportService } from '../services/supabaseImportService';
import { prisma } from '../db/prisma-wrapper';

/**
 * IPC channels for database management operations
 */
export const DATABASE_MANAGEMENT_CHANNELS = {
  CLEAR_DATABASE: 'mr5pos:db:clear',
  IMPORT_FROM_SUPABASE: 'mr5pos:db:import-from-supabase',
  VERIFY_ADMIN_PASSWORD: 'mr5pos:db:verify-password',
} as const;

/**
 * Database Management Controller
 * Handles dangerous database operations with proper authorization
 */
export class DatabaseManagementController extends BaseController {
  private dbService: DatabaseManagementService;
  private importService: SupabaseImportService;

  constructor() {
    super();
    this.dbService = new DatabaseManagementService(prisma);
    this.importService = new SupabaseImportService(prisma);
    logInfo('DatabaseManagementController initialized');
  }

  protected registerHandlers(): void {
    this.registerHandler(
      DATABASE_MANAGEMENT_CHANNELS.VERIFY_ADMIN_PASSWORD,
      this.verifyAdminPassword.bind(this)
    );

    this.registerHandler(
      DATABASE_MANAGEMENT_CHANNELS.CLEAR_DATABASE,
      this.clearDatabase.bind(this)
    );

    this.registerHandler(
      DATABASE_MANAGEMENT_CHANNELS.IMPORT_FROM_SUPABASE,
      this.importFromSupabase.bind(this)
    );

    logInfo('All database management IPC handlers registered');
  }

  /**
   * Verify admin password before allowing dangerous operations
   */
  private async verifyAdminPassword(
    _event: IpcMainInvokeEvent,
    username: string,
    password: string
  ): Promise<IPCResponse<{ valid: boolean }>> {
    try {
      const valid = await this.dbService.verifyAdminPassword(username, password);
      return this.createSuccessResponse({ valid });
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Password verification failed'
      );
    }
  }

  /**
   * Clear all database data except admin user
   */
  private async clearDatabase(
    _event: IpcMainInvokeEvent,
    adminUsername: string
  ): Promise<
    IPCResponse<{
      deletedCounts: {
        orders: number;
        orderItems: number;
        customers: number;
        menuItems: number;
        categories: number;
        addons: number;
        inventory: number;
        expenses: number;
        tables: number;
        users: number;
      };
    }>
  > {
    try {
      logInfo(`Clear database requested by user: ${adminUsername}`);

      const result = await this.dbService.clearDatabase(adminUsername);

      if (result.success) {
        return this.createSuccessResponse(
          { deletedCounts: result.deletedCounts! },
          'Database cleared successfully'
        );
      } else {
        return this.createErrorResponse(result.error || 'Failed to clear database');
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to clear database'
      );
    }
  }

  /**
   * Import menu data from Supabase
   */
  private async importFromSupabase(
    _event: IpcMainInvokeEvent
  ): Promise<
    IPCResponse<{
      importedCounts: {
        categories: number;
        items: number;
        addons: number;
        assignments: number;
      };
    }>
  > {
    try {
      logInfo('Import from Supabase requested');

      if (!this.importService.isConfigured()) {
        return this.createErrorResponse(
          'Supabase not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
        );
      }

      const result = await this.importService.importFromSupabase();

      if (result.success) {
        return this.createSuccessResponse(
          { importedCounts: result.importedCounts! },
          'Data imported successfully from Supabase'
        );
      } else {
        return this.createErrorResponse(
          result.error || 'Failed to import from Supabase'
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to import from Supabase'
      );
    }
  }
}

