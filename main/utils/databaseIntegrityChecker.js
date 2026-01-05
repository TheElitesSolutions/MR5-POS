import { app } from 'electron';
import * as path from 'path';
import { prisma } from '../db/prisma-wrapper';
import { logInfo, logError, logWarning } from '../error-handler';
/**
 * DatabaseIntegrityChecker
 * Performs comprehensive health checks on the SQLite database
 * Used before and after updates to ensure data integrity
 */
export class DatabaseIntegrityChecker {
    constructor() {
        try {
            const userDataPath = app.getPath('userData');
            this.dbPath = path.join(userDataPath, 'mr5-pos.db');
        }
        catch (error) {
            // Fallback if app.getPath fails
            this.dbPath = path.join(process.env.APPDATA || process.env.TEMP || '/tmp', 'mr5-pos', 'mr5-pos.db');
        }
    }
    /**
     * Run comprehensive health check on the database
     */
    async runHealthCheck() {
        logInfo('Starting database health check...');
        const result = {
            isHealthy: true,
            checks: {
                connection: false,
                integrity: false,
                requiredTables: false,
                writeable: false,
            },
            errors: [],
            warnings: [],
            databasePath: this.dbPath,
        };
        try {
            // Check 1: Database connection
            result.checks.connection = await this.checkDatabaseConnection();
            if (!result.checks.connection) {
                result.errors.push('Failed to connect to database');
                result.isHealthy = false;
            }
            // Check 2: Database integrity (SQLite PRAGMA integrity_check)
            result.checks.integrity = await this.checkDatabaseIntegrity();
            if (!result.checks.integrity) {
                result.errors.push('Database integrity check failed');
                result.isHealthy = false;
            }
            // Check 3: Required tables exist
            const tableCheck = await this.verifyRequiredTables();
            result.checks.requiredTables = tableCheck.allTablesExist;
            if (!result.checks.requiredTables) {
                result.errors.push(`Missing required tables: ${tableCheck.missingTables.join(', ')}`);
                result.isHealthy = false;
            }
            // Check 4: Database is writeable
            result.checks.writeable = await this.checkDatabaseWriteable();
            if (!result.checks.writeable) {
                result.errors.push('Database is not writeable');
                result.isHealthy = false;
            }
            // Get database file size
            try {
                const fs = require('fs');
                const stats = fs.statSync(this.dbPath);
                result.databaseSize = stats.size;
            }
            catch (error) {
                result.warnings.push('Could not determine database file size');
            }
            if (result.isHealthy) {
                logInfo('✓ Database health check PASSED - all checks successful');
            }
            else {
                logError(new Error('Database health check FAILED'), 'DatabaseIntegrityChecker');
                logError(new Error(`Errors: ${result.errors.join('; ')}`), 'DatabaseIntegrityChecker');
            }
            return result;
        }
        catch (error) {
            result.isHealthy = false;
            result.errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
            logError(error, 'DatabaseIntegrityChecker.runHealthCheck');
            return result;
        }
    }
    /**
     * Check if database connection is working
     */
    async checkDatabaseConnection() {
        try {
            // Simple query to test connection
            await prisma.$queryRaw `SELECT 1 as test`;
            logInfo('✓ Database connection test PASSED');
            return true;
        }
        catch (error) {
            logError(error, 'DatabaseIntegrityChecker.checkConnection');
            return false;
        }
    }
    /**
     * Run SQLite integrity check
     */
    async checkDatabaseIntegrity() {
        try {
            // SQLite PRAGMA integrity_check returns 'ok' if database is intact
            const result = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
            if (result && result.length > 0) {
                const integrityStatus = result[0].integrity_check;
                if (integrityStatus === 'ok') {
                    logInfo('✓ Database integrity check PASSED');
                    return true;
                }
                else {
                    logError(new Error(`Integrity check failed: ${integrityStatus}`), 'DatabaseIntegrityChecker');
                    return false;
                }
            }
            logWarning('Integrity check returned unexpected result', 'DatabaseIntegrityChecker');
            return false;
        }
        catch (error) {
            logError(error, 'DatabaseIntegrityChecker.checkIntegrity');
            return false;
        }
    }
    /**
     * Verify that all required tables exist
     */
    async verifyRequiredTables() {
        const requiredTables = [
            'users',
            'tables',
            'menu_items',
            'categories',
            'orders',
            'order_items',
            'payments',
            'expenses',
            'inventory',
            'settings',
        ];
        const missingTables = [];
        const tableChecks = {};
        try {
            // Check each required table
            for (const tableName of requiredTables) {
                try {
                    // Query to check if table exists and get record count
                    const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
                    const recordCount = result[0]?.count || 0;
                    tableChecks[tableName] = {
                        exists: true,
                        recordCount: Number(recordCount),
                    };
                }
                catch (error) {
                    // Table doesn't exist or is not accessible
                    missingTables.push(tableName);
                    tableChecks[tableName] = {
                        exists: false,
                        recordCount: 0,
                    };
                }
            }
            const allTablesExist = missingTables.length === 0;
            if (allTablesExist) {
                logInfo(`✓ All ${requiredTables.length} required tables verified`);
            }
            else {
                logError(new Error(`Missing tables: ${missingTables.join(', ')}`), 'DatabaseIntegrityChecker');
            }
            return {
                allTablesExist,
                missingTables,
                tableChecks,
            };
        }
        catch (error) {
            logError(error, 'DatabaseIntegrityChecker.verifyTables');
            return {
                allTablesExist: false,
                missingTables: requiredTables,
                tableChecks,
            };
        }
    }
    /**
     * Check if database is writeable by attempting a test write
     */
    async checkDatabaseWriteable() {
        try {
            // Try to update a setting (or insert if doesn't exist)
            // We use a special test setting that won't interfere with app functionality
            await prisma.$executeRawUnsafe(`
        INSERT OR REPLACE INTO settings (key, value, type, category)
        VALUES (
          'system.database_write_test',
          datetime('now'),
          'string',
          'system'
        )
      `);
            logInfo('✓ Database write test PASSED');
            return true;
        }
        catch (error) {
            logError(error, 'DatabaseIntegrityChecker.checkWriteable');
            return false;
        }
    }
    /**
     * Quick check - just verify connection and basic integrity
     * Used for frequent health checks that should be fast
     */
    async quickHealthCheck() {
        try {
            const connectionOk = await this.checkDatabaseConnection();
            if (!connectionOk)
                return false;
            const integrityOk = await this.checkDatabaseIntegrity();
            return integrityOk;
        }
        catch (error) {
            logError(error, 'DatabaseIntegrityChecker.quickHealthCheck');
            return false;
        }
    }
    /**
     * Get database file path
     */
    getDatabasePath() {
        return this.dbPath;
    }
    /**
     * Verify database file exists
     */
    databaseFileExists() {
        try {
            const fs = require('fs');
            return fs.existsSync(this.dbPath);
        }
        catch (error) {
            return false;
        }
    }
}
// Singleton instance
let _instance = null;
export function getDatabaseIntegrityChecker() {
    if (!_instance) {
        _instance = new DatabaseIntegrityChecker();
    }
    return _instance;
}
// Export singleton
export const databaseIntegrityChecker = new Proxy({}, {
    get(_target, prop) {
        return getDatabaseIntegrityChecker()[prop];
    },
});
