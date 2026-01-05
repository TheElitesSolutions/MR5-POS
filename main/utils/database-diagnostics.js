/**
 * Database Diagnostics Utility
 * Provides tools to diagnose database issues and verify data integrity
 */
import { getDatabase } from '../db/index';
import { getPrismaClient } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';
/**
 * Run comprehensive database diagnostics
 */
export async function runDatabaseDiagnostics() {
    try {
        console.log('[DatabaseDiagnostics] Starting comprehensive database diagnostics...');
        logInfo('Running database diagnostics', 'DatabaseDiagnostics');
        const details = {
            databaseExists: false,
            tablesCount: 0,
            usersCount: 0,
            adminUserExists: false,
            schemaValid: false,
            tables: []
        };
        // Step 1: Check if database exists and get basic info
        try {
            const db = getDatabase();
            details.databaseExists = true;
            console.log('[DatabaseDiagnostics] ✓ Database connection established');
        }
        catch (error) {
            console.error('[DatabaseDiagnostics] ✗ Failed to connect to database:', error);
            return {
                success: false,
                message: 'Failed to connect to database',
                details
            };
        }
        // Step 2: Get list of tables
        try {
            const db = getDatabase();
            const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
      `).all();
            details.tables = tables.map(t => t.name);
            details.tablesCount = tables.length;
            console.log(`[DatabaseDiagnostics] ✓ Found ${details.tablesCount} tables:`, details.tables.join(', '));
        }
        catch (error) {
            console.error('[DatabaseDiagnostics] ✗ Failed to get table list:', error);
            return {
                success: false,
                message: 'Failed to read database schema',
                details
            };
        }
        // Step 3: Validate critical tables exist
        const criticalTables = ['users', 'settings', 'orders', 'menu_items', 'categories', 'tables'];
        const missingTables = criticalTables.filter(table => !details.tables?.includes(table));
        if (missingTables.length > 0) {
            console.error('[DatabaseDiagnostics] ✗ Missing critical tables:', missingTables.join(', '));
            details.schemaValid = false;
            return {
                success: false,
                message: `Database schema incomplete. Missing tables: ${missingTables.join(', ')}`,
                details
            };
        }
        details.schemaValid = true;
        console.log('[DatabaseDiagnostics] ✓ All critical tables exist');
        // Step 4: Check users table
        try {
            const db = getDatabase();
            const userCountResult = db.prepare('SELECT COUNT(*) as count FROM users').get();
            details.usersCount = userCountResult.count;
            console.log(`[DatabaseDiagnostics] ✓ Users table has ${details.usersCount} users`);
        }
        catch (error) {
            console.error('[DatabaseDiagnostics] ✗ Failed to count users:', error);
            return {
                success: false,
                message: 'Failed to access users table',
                details
            };
        }
        // Step 5: Check for admin user specifically
        try {
            const db = getDatabase();
            const adminUser = db.prepare(`
        SELECT id, username, email, role, isActive
        FROM users
        WHERE username = ?
      `).get('admin');
            if (adminUser) {
                details.adminUserExists = true;
                details.adminUser = {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                    role: adminUser.role,
                    isActive: Boolean(adminUser.isActive)
                };
                console.log('[DatabaseDiagnostics] ✓ Admin user found:', {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                    role: adminUser.role,
                    isActive: adminUser.isActive
                });
            }
            else {
                details.adminUserExists = false;
                console.log('[DatabaseDiagnostics] ⚠ Admin user NOT found in database');
            }
        }
        catch (error) {
            console.error('[DatabaseDiagnostics] ✗ Failed to check for admin user:', error);
            return {
                success: false,
                message: 'Failed to query admin user',
                details
            };
        }
        // Step 6: Verify Prisma connection
        try {
            console.log('[DatabaseDiagnostics] Verifying Prisma connection...');
            const prisma = getPrismaClient();
            prisma.ensureInitialized();
            const userModel = prisma.user;
            if (!userModel) {
                console.error('[DatabaseDiagnostics] ✗ Prisma user model is undefined');
                return {
                    success: false,
                    message: 'Prisma initialization failed - user model is undefined',
                    details
                };
            }
            const prismaUserCount = await userModel.count();
            console.log(`[DatabaseDiagnostics] ✓ Prisma connection verified. User count via Prisma: ${prismaUserCount}`);
            if (prismaUserCount !== details.usersCount) {
                console.warn(`[DatabaseDiagnostics] ⚠ User count mismatch! Direct SQL: ${details.usersCount}, Prisma: ${prismaUserCount}`);
            }
        }
        catch (error) {
            console.error('[DatabaseDiagnostics] ✗ Prisma verification failed:', error);
            return {
                success: false,
                message: `Prisma connection failed: ${error instanceof Error ? error.message : String(error)}`,
                details
            };
        }
        // Generate summary message
        let message = 'Database diagnostics completed successfully.\n\n';
        message += `Database Status: ${details.databaseExists ? 'Connected' : 'Not Connected'}\n`;
        message += `Tables: ${details.tablesCount} (${details.schemaValid ? 'Schema Valid' : 'Schema Invalid'})\n`;
        message += `Total Users: ${details.usersCount}\n`;
        message += `Admin User: ${details.adminUserExists ? '✓ Exists' : '✗ Missing'}\n`;
        if (details.adminUserExists && details.adminUser) {
            message += `\nAdmin User Details:\n`;
            message += `- ID: ${details.adminUser.id}\n`;
            message += `- Username: ${details.adminUser.username}\n`;
            message += `- Email: ${details.adminUser.email}\n`;
            message += `- Role: ${details.adminUser.role}\n`;
            message += `- Active: ${details.adminUser.isActive ? 'Yes' : 'No'}\n`;
        }
        console.log('[DatabaseDiagnostics] Diagnostics complete:', message);
        logInfo('Database diagnostics completed successfully', 'DatabaseDiagnostics');
        return {
            success: true,
            message,
            details
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[DatabaseDiagnostics] ✗ Diagnostics failed with error:', errorMessage);
        logError(`Database diagnostics failed: ${errorMessage}`, 'DatabaseDiagnostics');
        return {
            success: false,
            message: `Diagnostics failed: ${errorMessage}`
        };
    }
}
/**
 * Quick check if admin user exists
 */
export function checkAdminUserExists() {
    try {
        const db = getDatabase();
        const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        return !!adminUser;
    }
    catch (error) {
        console.error('[DatabaseDiagnostics] Error checking admin user:', error);
        return false;
    }
}
/**
 * Get basic database info
 */
export function getDatabaseInfo() {
    try {
        const db = getDatabase();
        const tables = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();
        const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
        return {
            path: db.name,
            exists: true,
            tablesCount: tables.count,
            usersCount: users.count
        };
    }
    catch (error) {
        console.error('[DatabaseDiagnostics] Error getting database info:', error);
        return {
            path: '',
            exists: false,
            tablesCount: 0,
            usersCount: 0
        };
    }
}
