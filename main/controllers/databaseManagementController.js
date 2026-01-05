import { BaseController } from './baseController';
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
};
/**
 * Database Management Controller
 * Handles dangerous database operations with proper authorization
 */
export class DatabaseManagementController extends BaseController {
    constructor() {
        super();
        this.dbService = new DatabaseManagementService(prisma);
        this.importService = new SupabaseImportService(prisma);
        logInfo('DatabaseManagementController initialized');
    }
    registerHandlers() {
        this.registerHandler(DATABASE_MANAGEMENT_CHANNELS.VERIFY_ADMIN_PASSWORD, this.verifyAdminPassword.bind(this));
        this.registerHandler(DATABASE_MANAGEMENT_CHANNELS.CLEAR_DATABASE, this.clearDatabase.bind(this));
        this.registerHandler(DATABASE_MANAGEMENT_CHANNELS.IMPORT_FROM_SUPABASE, this.importFromSupabase.bind(this));
        logInfo('All database management IPC handlers registered');
    }
    /**
     * Verify admin password before allowing dangerous operations
     */
    async verifyAdminPassword(_event, username, password) {
        try {
            const valid = await this.dbService.verifyAdminPassword(username, password);
            return this.createSuccessResponse({ valid });
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Password verification failed');
        }
    }
    /**
     * Clear all database data except admin user
     */
    async clearDatabase(_event, adminUsername) {
        try {
            logInfo(`Clear database requested by user: ${adminUsername}`);
            const result = await this.dbService.clearDatabase(adminUsername);
            if (result.success) {
                return this.createSuccessResponse({ deletedCounts: result.deletedCounts }, 'Database cleared successfully');
            }
            else {
                return this.createErrorResponse(result.error || 'Failed to clear database');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to clear database');
        }
    }
    /**
     * Import menu data from Supabase
     */
    async importFromSupabase(_event) {
        try {
            logInfo('Import from Supabase requested');
            if (!this.importService.isConfigured()) {
                return this.createErrorResponse('Supabase not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
            }
            const result = await this.importService.importFromSupabase();
            if (result.success) {
                return this.createSuccessResponse({ importedCounts: result.importedCounts }, 'Data imported successfully from Supabase');
            }
            else {
                return this.createErrorResponse(result.error || 'Failed to import from Supabase');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to import from Supabase');
        }
    }
}
