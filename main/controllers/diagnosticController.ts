/**
 * Diagnostic Controller
 * Provides IPC handlers for database diagnostics and manual admin user creation
 */

import { BaseController } from './baseController';
import { runDatabaseDiagnostics, DiagnosticResult } from '../utils/database-diagnostics';
import { createDefaultAdminUser } from '../utils/create-default-admin';
import { logInfo, logError } from '../error-handler';

export class DiagnosticController extends BaseController {
  protected registerHandlers(): void {
    // Register database diagnostics handler
    this.registerHandler<DiagnosticResult>(
      'diagnostic:run-database-diagnostics',
      this.wrapHandler(async () => {
        logInfo('Running database diagnostics via IPC', 'DiagnosticController');
        const result = await runDatabaseDiagnostics();
        return result;
      })
    );

    // Register manual admin user creation handler
    this.registerHandler<{ success: boolean; message: string }>(
      'diagnostic:create-admin-user',
      this.wrapHandler(async () => {
        logInfo('Creating admin user manually via IPC', 'DiagnosticController');
        const result = await createDefaultAdminUser();
        return result;
      })
    );
  }
}
