import { PrismaClient } from '../prisma';
import bcrypt from 'bcrypt';
import { AppError, logError } from '../error-handler';
import { IPCResponse, User, UserRole } from '../types';

// Define PrismaUser type based on the database schema
type PrismaUser = {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'OWNER' | 'WAITER' | 'KITCHEN';
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: number;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
};
import { comparePassword, hashPassword } from '../utils/auth';
import { logger } from '../utils/logger';

export type UserWithoutPassword = Omit<User, 'password'>;

/**
 * Interface for user update operations
 */
interface UserUpdate {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Map Prisma User to application User DTO
 */
export function mapPrismaUserToDTO(prismaUser: PrismaUser): User {
  // Helper to convert Date or string to ISO string
  const toISOString = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value.toISOString();
  };

  return {
    id: prismaUser.id,
    username: prismaUser.username,
    email: prismaUser.email,
    role: mapPrismaRoleToAppRole(prismaUser.role),
    firstName: prismaUser.firstName,
    lastName: prismaUser.lastName,
    phone: prismaUser.phone || '',
    isActive: Boolean(prismaUser.isActive),
    lastLogin: toISOString(prismaUser.lastLogin),
    createdAt: toISOString(prismaUser.createdAt)!,
    updatedAt: toISOString(prismaUser.updatedAt)!,
  };
}

/**
 * Map Prisma UserRole to application UserRole enum
 */
export function mapPrismaRoleToAppRole(
  prismaRole: PrismaUser['role']
): UserRole {
  // Map Prisma enum values to application enum values
  switch (prismaRole) {
    case 'ADMIN':
      return UserRole.ADMIN;
    case 'MANAGER':
      return UserRole.MANAGER;
    case 'CASHIER':
      return UserRole.CASHIER;
    case 'OWNER':
      return UserRole.OWNER;
    default:
      return UserRole.CASHIER; // Default fallback
  }
}

/**
 * Map application UserRole to Prisma UserRole
 */
export function mapAppRoleToPrismaRole(appRole: UserRole): PrismaUser['role'] {
  // Map application enum values to Prisma enum values
  switch (appRole) {
    case UserRole.ADMIN:
      return 'ADMIN';
    case UserRole.MANAGER:
      return 'MANAGER';
    case UserRole.CASHIER:
      return 'CASHIER';
    case UserRole.OWNER:
      return 'OWNER';
    default:
      return 'CASHIER'; // Default fallback
  }
}

/**
 * Validates if a string is a valid UserRole
 */
function isValidUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

export class UserModel {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Find a user by ID - internal helper method
   */
  private async getUserById(id: string): Promise<PrismaUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findById(id: string): Promise<IPCResponse<User | null>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: mapPrismaUserToDTO(user),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to find user by ID: ${
          error instanceof Error ? error.message : error
        }`,
        'UserModel'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findByCredentials(
    username: string,
    password: string
  ): Promise<IPCResponse<User | null>> {
    try {
      // Add detailed logging for debugging
      logger.info(
        `Attempting to find user by credentials: ${username}`,
        'UserModel'
      );

      // First, try to find the user
      // Use raw SQL with LOWER() for case-insensitive matching in SQLite
      const users = await this.prisma.$queryRaw<PrismaUser[]>`
        SELECT * FROM users
        WHERE (LOWER(username) = LOWER(${username}) OR LOWER(email) = LOWER(${username}))
        AND isActive = 1
        LIMIT 1
      `;

      const user: PrismaUser | null = users.length > 0 ? (users[0] as unknown as PrismaUser) : null;

      if (!user) {
        logger.warn(
          `No active user found with username/email: ${username}`,
          'UserModel'
        );
        return {
          success: false,
          error: 'Invalid username or email',
          timestamp: new Date().toISOString(),
        };
      }

      // Log that we found the user (without sensitive info)
      logger.info(
        `User found, checking password for user ID: ${user.id}`,
        'UserModel'
      );

      // Now check the password
      const passwordMatch = await comparePassword(password, user.password);
      if (!passwordMatch) {
        logger.warn(`Password mismatch for user: ${username}`, 'UserModel');
        return {
          success: false,
          error: 'Invalid password',
          timestamp: new Date().toISOString(),
        };
      }

      // Update last login time
      logger.info(`Updating last login time for user: ${user.id}`, 'UserModel');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date().toISOString() },
      });

      logger.info(
        `Authentication successful for user: ${user.id}`,
        'UserModel'
      );
      return {
        success: true,
        data: mapPrismaUserToDTO(user),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Enhanced error logging with more details
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Authentication error: ${errorMessage}`, 'UserModel');
      if (errorStack) {
        logger.debug(`Error stack: ${errorStack}`, 'UserModel');
      }

      // Return a more specific error message
      return {
        success: false,
        error: `Authentication error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async create(userData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
  }): Promise<IPCResponse<User>> {
    try {
      const hashedPassword = await hashPassword(userData.password);

      const user = await this.prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone || null,
          role: mapAppRoleToPrismaRole(userData.role),
          isActive: true,
        },
      });

      return {
        success: true,
        data: mapPrismaUserToDTO(user),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async update(
    id: string,
    updates: Partial<{
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      role: UserRole;
      isActive: boolean;
    }>
  ): Promise<IPCResponse<User>> {
    try {
      // Convert role if it's being updated
      const dbUpdates: any = { ...updates };
      if (updates.role) {
        dbUpdates.role = mapAppRoleToPrismaRole(updates.role);
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: dbUpdates,
      });

      return {
        success: true,
        data: mapPrismaUserToDTO(user),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ): Promise<IPCResponse<boolean>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { password: true },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect',
          timestamp: new Date().toISOString(),
        };
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id },
        data: { password: hashedNewPassword },
      });

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to change password',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findAll(options?: {
    role?: UserRole;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<IPCResponse<User[]>> {
    try {
      const where: any = {};

      if (options?.role) where.role = mapAppRoleToPrismaRole(options.role);
      if (options?.isActive !== undefined) where.isActive = options.isActive;

      const queryOptions: any = {
        where,
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      };

      if (options?.limit) {
        queryOptions.take = options.limit;
      }

      if (options?.offset) {
        queryOptions.skip = options.offset;
      }

      const users = await this.prisma.user.findMany(queryOptions);

      return {
        success: true,
        data: users.map(user => mapPrismaUserToDTO(user)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async delete(id: string): Promise<IPCResponse<boolean>> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to deactivate user',
        timestamp: new Date().toISOString(),
      };
    }
  }

  getRolePermissions(role: UserRole): string[] {
    try {
      switch (role) {
        case UserRole.ADMIN:
          return ['*']; // Admin has all permissions
        case UserRole.MANAGER:
          return [
            'orders:*',
            'menu:*',
            'inventory:*',
            'reports:view',
            'users:view',
            'settings:view',
            'settings:update',
          ];
        case UserRole.CASHIER:
          return ['orders:create', 'orders:update', 'orders:view', 'menu:view'];
        case UserRole.OWNER:
          return ['*']; // Owner has all permissions
        default:
          return []; // Default minimal permissions
      }
    } catch (error) {
      logError(`Failed to get role permissions: ${error}`, 'UserModel');
      return [];
    }
  }

  getRoleFromPermissions(permissions: string[]): UserRole {
    if (permissions.includes('*')) {
      return UserRole.ADMIN;
    }

    if (
      permissions.includes('orders:*') &&
      permissions.includes('menu:*') &&
      permissions.includes('inventory:*')
    ) {
      return UserRole.MANAGER;
    }

    if (
      permissions.includes('orders:create') &&
      permissions.includes('orders:update') &&
      permissions.includes('orders:view')
    ) {
      return UserRole.CASHIER;
    }

    return UserRole.CASHIER; // Default fallback
  }

  async updateUser(userId: string, updates: UserUpdate): Promise<User> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new AppError('User not found', true);
      }

      const dbUpdates: any = { ...updates };

      // If role is being updated, map it to Prisma role
      if (updates.role) {
        dbUpdates.role = mapAppRoleToPrismaRole(updates.role);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: dbUpdates,
      });

      return mapPrismaUserToDTO(updatedUser);
    } catch (error) {
      logError(`Failed to update user: ${error}`, 'UserModel');
      throw new AppError(`Failed to update user: ${error}`, true);
    }
  }

  private mapPrismaUserToUser(prismaUser: any): User {
    // Helper to convert Date or string to ISO string
    const toISOString = (value: Date | string | null | undefined): string | null => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      return value.toISOString();
    };

    return {
      id: prismaUser.id,
      username: prismaUser.username,
      email: prismaUser.email,
      firstName: prismaUser.firstName || '',
      lastName: prismaUser.lastName || '',
      phone: prismaUser.phone || '',
      role: mapPrismaRoleToAppRole(prismaUser.role),
      isActive: prismaUser.isActive,
      lastLogin: toISOString(prismaUser.lastLogin),
      createdAt: toISOString(prismaUser.createdAt)!,
      updatedAt: toISOString(prismaUser.updatedAt)!,
    };
  }
}
