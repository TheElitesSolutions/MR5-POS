/**
 * Diagnostic Controller
 * Provides IPC handlers for database diagnostics and manual admin user creation
 */
import { BaseController } from './baseController';
import { runDatabaseDiagnostics } from '../utils/database-diagnostics';
import { createDefaultAdminUser } from '../utils/create-default-admin';
import { logInfo } from '../error-handler';
export class DiagnosticController extends BaseController {
    registerHandlers() {
        // Register database diagnostics handler
        this.registerHandler('diagnostic:run-database-diagnostics', this.wrapHandler(async () => {
            logInfo('Running database diagnostics via IPC', 'DiagnosticController');
            const result = await runDatabaseDiagnostics();
            return result;
        }));
        // Register manual admin user creation handler
        this.registerHandler('diagnostic:create-admin-user', this.wrapHandler(async () => {
            logInfo('Creating admin user manually via IPC', 'DiagnosticController');
            const result = await createDefaultAdminUser();
            return result;
        }));
    }
}
