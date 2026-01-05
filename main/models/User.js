import bcrypt from 'bcrypt';
import { AppError, logError } from '../error-handler';
import { UserRole } from '../types';
import { comparePassword, hashPassword } from '../utils/auth';
import { logger } from '../utils/logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * Map Prisma User to application User DTO
 */
export function mapPrismaUserToDTO(prismaUser) {
    // Helper to convert Date or string to ISO string
    const toISOString = (value) => {
        if (!value)
            return null;
        if (typeof value === 'string')
            return value;
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
        createdAt: toISOString(prismaUser.createdAt),
        updatedAt: toISOString(prismaUser.updatedAt),
    };
}
/**
 * Map Prisma UserRole to application UserRole enum
 */
export function mapPrismaRoleToAppRole(prismaRole) {
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
export function mapAppRoleToPrismaRole(appRole) {
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
function isValidUserRole(role) {
    return Object.values(UserRole).includes(role);
}
export class UserModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Find a user by ID - internal helper method
     */
    async getUserById(id) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }
    async findById(id) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            return {
                success: true,
                data: mapPrismaUserToDTO(user),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to find user by ID: ${error instanceof Error ? error.message : error}`, 'UserModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to find user',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByCredentials(username, password) {
        try {
            // Add detailed logging for debugging
            logger.info(`Attempting to find user by credentials: ${username}`, 'UserModel');
            // First, try to find the user
            // Use raw SQL with LOWER() for case-insensitive matching in SQLite
            const users = await this.prisma.$queryRaw `
        SELECT * FROM users
        WHERE (LOWER(username) = LOWER(${username}) OR LOWER(email) = LOWER(${username}))
        AND isActive = 1
        LIMIT 1
      `;
            const user = users.length > 0 ? users[0] : null;
            if (!user) {
                logger.warn(`No active user found with username/email: ${username}`, 'UserModel');
                return {
                    success: false,
                    error: 'Invalid username or email',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Log that we found the user (without sensitive info)
            logger.info(`User found, checking password for user ID: ${user.id}`, 'UserModel');
            // Now check the password
            const passwordMatch = await comparePassword(password, user.password);
            if (!passwordMatch) {
                logger.warn(`Password mismatch for user: ${username}`, 'UserModel');
                return {
                    success: false,
                    error: 'Invalid password',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Update last login time
            logger.info(`Updating last login time for user: ${user.id}`, 'UserModel');
            await this.prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: getCurrentLocalDateTime() },
            });
            logger.info(`Authentication successful for user: ${user.id}`, 'UserModel');
            return {
                success: true,
                data: mapPrismaUserToDTO(user),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            // Enhanced error logging with more details
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.error(`Authentication error: ${errorMessage}`, 'UserModel');
            if (errorStack) {
                logger.debug(`Error stack: ${errorStack}`, 'UserModel');
            }
            // Return a more specific error message
            return {
                success: false,
                error: `Authentication error: ${errorMessage}`,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async create(userData) {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create user',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async update(id, updates) {
        try {
            // Convert role if it's being updated
            const dbUpdates = { ...updates };
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update user',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async changePassword(id, currentPassword, newPassword) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id },
                select: { password: true },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return {
                    success: false,
                    error: 'Current password is incorrect',
                    timestamp: getCurrentLocalDateTime(),
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to change password',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findAll(options) {
        try {
            const where = {};
            if (options?.role)
                where.role = mapAppRoleToPrismaRole(options.role);
            if (options?.isActive !== undefined)
                where.isActive = options.isActive;
            const queryOptions = {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch users',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async delete(id) {
        try {
            await this.prisma.user.update({
                where: { id },
                data: { isActive: false },
            });
            return {
                success: true,
                data: true,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to deactivate user',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    getRolePermissions(role) {
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
        }
        catch (error) {
            logError(`Failed to get role permissions: ${error}`, 'UserModel');
            return [];
        }
    }
    getRoleFromPermissions(permissions) {
        if (permissions.includes('*')) {
            return UserRole.ADMIN;
        }
        if (permissions.includes('orders:*') &&
            permissions.includes('menu:*') &&
            permissions.includes('inventory:*')) {
            return UserRole.MANAGER;
        }
        if (permissions.includes('orders:create') &&
            permissions.includes('orders:update') &&
            permissions.includes('orders:view')) {
            return UserRole.CASHIER;
        }
        return UserRole.CASHIER; // Default fallback
    }
    async updateUser(userId, updates) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new AppError('User not found', true);
            }
            const dbUpdates = { ...updates };
            // If role is being updated, map it to Prisma role
            if (updates.role) {
                dbUpdates.role = mapAppRoleToPrismaRole(updates.role);
            }
            const updatedUser = await this.prisma.user.update({
                where: { id: userId },
                data: dbUpdates,
            });
            return mapPrismaUserToDTO(updatedUser);
        }
        catch (error) {
            logError(`Failed to update user: ${error}`, 'UserModel');
            throw new AppError(`Failed to update user: ${error}`, true);
        }
    }
    mapPrismaUserToUser(prismaUser) {
        // Helper to convert Date or string to ISO string
        const toISOString = (value) => {
            if (!value)
                return null;
            if (typeof value === 'string')
                return value;
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
            createdAt: toISOString(prismaUser.createdAt),
            updatedAt: toISOString(prismaUser.updatedAt),
        };
    }
}
