/**
 * Script to create admin user - to be called from electron main process
 */

import * as bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { generateId } from '../db';

export async function createAdminUser() {
  try {
    console.log('🔍 Checking for existing admin user...');

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('Updating password to "admin"...');

      // Update password
      const hashedPassword = await bcrypt.hash('admin', 10);

      await prisma.user.update({
        where: { username: 'admin' },
        data: {
          password: hashedPassword
        }
      });

      console.log('✅ Admin password updated successfully!');
      console.log('\nCredentials:');
      console.log('  Username: admin');
      console.log('  Password: admin');
      console.log('  Role:', existingAdmin.role);
      return;
    }

    console.log('📝 Creating new admin user...');

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin', 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        id: generateId(),
        username: 'admin',
        email: 'admin@mr5pos.com',
        password: hashedPassword,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        isActive: 1
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('\nCredentials:');
    console.log('  Username: admin');
    console.log('  Password: admin');
    console.log('  Role:', adminUser.role);
    console.log('  Email:', adminUser.email);
    console.log('\n⚠️  Please change this password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Export for use in other scripts
export default createAdminUser;
