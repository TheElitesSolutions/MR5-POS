/**
 * Utility to create a default admin user
 * Can be called during app initialization or manually via IPC
 */

import bcrypt from 'bcrypt';
import { getPrismaClient } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';

export async function createDefaultAdminUser(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[CreateAdminUser] ===== Starting admin user creation process =====');
    logInfo('Checking for default admin user...', 'CreateAdminUser');

    // CRITICAL: Get the actual Prisma client instance (not the lazy proxy)
    // This ensures the client is properly initialized before we use it
    console.log('[CreateAdminUser] Step 1: Getting Prisma client instance...');
    const prisma = getPrismaClient();
    console.log('[CreateAdminUser] ✓ Prisma client instance obtained');

    // CRITICAL: Ensure the PrismaClient is fully initialized
    // This triggers the lazy db getter which initializes all model properties
    console.log('[CreateAdminUser] Step 2: Ensuring Prisma client is initialized...');
    prisma.ensureInitialized();
    console.log('[CreateAdminUser] ✓ Prisma client initialized (isInitialized:', prisma.isInitialized(), ')');

    // Now we can safely access the user model
    const userModel = prisma.user;
    if (!userModel) {
      throw new Error('Prisma user model is still undefined after initialization - this should not happen!');
    }
    console.log('[CreateAdminUser] ✓ User model is available');

    // Verify database is accessible by counting users
    console.log('[CreateAdminUser] Step 3: Verifying database access...');
    try {
      const userCount = await userModel.count();
      console.log(`[CreateAdminUser] ✓ Database accessible. Current user count: ${userCount}`);
    } catch (countError) {
      console.error('[CreateAdminUser] ✗ Cannot access users table:', countError);
      logError(`Database verification failed: ${countError}`, 'CreateAdminUser');
      throw new Error(`Database is not accessible: ${countError instanceof Error ? countError.message : String(countError)}`);
    }

    // Check if admin user already exists
    console.log('[CreateAdminUser] Step 4: Checking for existing admin user...');
    const existingAdmin = await userModel.findFirst({
      where: {
        username: 'admin'
      }
    });

    if (existingAdmin) {
      console.log('[CreateAdminUser] ✓ Admin user already exists (ID: ' + existingAdmin.id + ')');
      logInfo('Admin user already exists, skipping creation', 'CreateAdminUser');
      return {
        success: true,
        message: 'Admin user already exists'
      };
    }

    console.log('[CreateAdminUser] Step 5: No admin user found, creating new one...');

    // Hash the password
    console.log('[CreateAdminUser] Step 6: Hashing password...');
    const hashedPassword = await bcrypt.hash('admin', 10);
    console.log('[CreateAdminUser] ✓ Password hashed successfully');

    // Create the admin user
    console.log('[CreateAdminUser] Step 7: Inserting admin user into database...');
    console.log('[CreateAdminUser] User data:', {
      id: 'admin-user-001',
      username: 'admin',
      email: 'admin@mr5pos.local',
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      isActive: 1
    });

    const adminUser = await userModel.create({
      data: {
        id: 'admin-user-001',
        username: 'admin',
        email: 'admin@mr5pos.local',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: 1  // SQLite uses INTEGER for boolean (1 = true, 0 = false)
      }
    });

    console.log('[CreateAdminUser] ✓ Admin user created successfully!');
    console.log('[CreateAdminUser] User details:', {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role
    });
    console.log('[CreateAdminUser] ===== Admin user creation completed successfully =====');

    logInfo(`Admin user created successfully: ${adminUser.username}`, 'CreateAdminUser');

    return {
      success: true,
      message: 'Admin user created successfully with credentials: admin/admin'
    };

  } catch (error) {
    console.error('[CreateAdminUser] ===== ADMIN USER CREATION FAILED =====');
    console.error('[CreateAdminUser] Error type:', error.constructor.name);
    console.error('[CreateAdminUser] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[CreateAdminUser] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError(`Failed to create admin user: ${errorMessage}`, 'CreateAdminUser');

    // Try fallback method using better-sqlite3 directly
    console.log('[CreateAdminUser] Attempting fallback method using better-sqlite3 directly...');
    try {
      const fallbackResult = await createAdminUserFallback();
      if (fallbackResult.success) {
        console.log('[CreateAdminUser] ✓ Fallback method succeeded!');
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error('[CreateAdminUser] ✗ Fallback method also failed:', fallbackError);
      logError(`Fallback method failed: ${fallbackError}`, 'CreateAdminUser');
    }

    return {
      success: false,
      message: `Failed to create admin user: ${errorMessage}`
    };
  }
}

/**
 * Fallback method to create admin user using better-sqlite3 directly
 * This bypasses Prisma entirely and uses raw SQL
 */
async function createAdminUserFallback(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[CreateAdminUser:Fallback] Using direct better-sqlite3 approach...');

    // Import getDatabase from db/index
    const { getDatabase } = await import('../db/index');
    const db = getDatabase();

    // Check if admin user already exists
    const existingAdmin = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin');

    if (existingAdmin) {
      console.log('[CreateAdminUser:Fallback] Admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists'
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin', 10);
    const userId = 'admin-user-' + Date.now();
    const now = new Date().toISOString();

    // Insert admin user directly
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      'admin',
      'admin@mr5pos.local',
      hashedPassword,
      'ADMIN',
      'Admin',
      'User',
      1, // isActive (SQLite uses 1 for true)
      now,
      now
    );

    if (result.changes > 0) {
      console.log('[CreateAdminUser:Fallback] ✓ Admin user created via fallback method!');
      return {
        success: true,
        message: 'Admin user created successfully with credentials: admin/admin (via fallback)'
      };
    } else {
      throw new Error('No rows were inserted');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CreateAdminUser:Fallback] ✗ Fallback failed:', errorMessage);
    return {
      success: false,
      message: `Fallback method failed: ${errorMessage}`
    };
  }
}

// Auto-create admin user on module load (when app starts)
export async function ensureDefaultAdminExists(): Promise<void> {
  try {
    console.log('[CreateAdminUser] ensureDefaultAdminExists() called - starting process...');
    const result = await createDefaultAdminUser();

    if (result.success) {
      console.log('[CreateAdminUser] ✓ SUCCESS:', result.message);
      logInfo(result.message, 'CreateAdminUser');
    } else {
      console.error('[CreateAdminUser] ✗ FAILED:', result.message);
      logError(result.message, 'CreateAdminUser');
    }

    return Promise.resolve();
  } catch (error) {
    console.error('[CreateAdminUser] ✗ EXCEPTION in ensureDefaultAdminExists:', error);
    logError(`Error ensuring default admin exists: ${error}`, 'CreateAdminUser');
    return Promise.resolve(); // Don't throw, just log
  }
}
