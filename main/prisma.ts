/**
 * Prisma Client Compatibility Layer
 *
 * This file exports the Prisma-compatible wrapper to maintain
 * compatibility with existing code that imports from '../prisma'
 */

import { PrismaClient, getPrismaClient, prisma as prismaInstance } from './db/prisma-wrapper';

// Export the lazy-loaded prisma instance (uses Proxy for lazy init)
export const prisma = prismaInstance;

// Export the getPrismaClient function for code that calls it explicitly
export { getPrismaClient };

// Export the class for type compatibility
export { PrismaClient };

// Extended Prisma client type with additional methods for backward compatibility
export interface ExtendedPrismaClient extends PrismaClient {
  // Add menuItemInventory property to match the new model in schema.prisma
  menuItemInventory: any;
  // Add orderHistory property to match the model in schema.prisma
  orderHistory: any;
  // Add raw query methods for SQLite compatibility
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
}

// Export enums to match Prisma's generated client
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
  ADMIN = 'ADMIN',
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEOUT = 'TAKEOUT',
  DELIVERY = 'DELIVERY',
}

export enum OrderItemStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  CHECK = 'CHECK',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// Export Prisma namespace for type compatibility
export namespace Prisma {
  // User types
  export interface UserCreateInput {
    id?: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isActive?: boolean;
    lastLogin?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }

  export interface UserUpdateInput {
    username?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    isActive?: boolean;
    lastLogin?: Date | string | null;
  }

  export interface UserWhereInput {
    id?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
  }

  export interface UserWhereUniqueInput {
    id?: string;
    username?: string;
    email?: string;
  }

  // Order types
  export interface OrderCreateInput {
    id?: string;
    orderNumber: string;
    tableId?: string | null;
    customerId?: string | null;
    userId: string;
    status?: OrderStatus;
    type?: OrderType;
    subtotal: number;
    tax: number;
    discount?: number;
    deliveryFee?: number;
    total: number;
    notes?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    completedAt?: Date | string | null;
  }

  export interface OrderUpdateInput {
    orderNumber?: string;
    tableId?: string | null;
    customerId?: string | null;
    userId?: string;
    status?: OrderStatus;
    type?: OrderType;
    subtotal?: number;
    tax?: number;
    discount?: number;
    deliveryFee?: number;
    total?: number;
    notes?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    completedAt?: Date | string | null;
  }

  export interface OrderWhereInput {
    id?: string;
    orderNumber?: string;
    tableId?: string | null;
    customerId?: string | null;
    userId?: string;
    status?: OrderStatus;
    type?: OrderType;
  }

  export interface OrderWhereUniqueInput {
    id?: string;
    orderNumber?: string;
  }

  // MenuItem types
  export interface MenuItemCreateInput {
    id?: string;
    name: string;
    description?: string | null;
    price: number;
    categoryId: string;
    isActive?: boolean;
    isCustomizable?: boolean;
    imageUrl?: string | null;
    preparationTime?: number | null;
    ingredients?: string[];
    allergens?: string[];
    nutritionalInfo?: any;
    sortOrder?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }

  export interface MenuItemUpdateInput {
    name?: string;
    description?: string | null;
    price?: number;
    categoryId?: string;
    isActive?: boolean;
    isCustomizable?: boolean;
    imageUrl?: string | null;
    preparationTime?: number | null;
    ingredients?: string[];
    allergens?: string[];
    nutritionalInfo?: any;
    sortOrder?: number;
  }

  export interface MenuItemWhereInput {
    id?: string;
    categoryId?: string;
    isActive?: boolean;
    isCustomizable?: boolean;
  }

  export interface MenuItemWhereUniqueInput {
    id?: string;
  }

  // Add more types as needed for other models...
}

// Export default client
export default prisma;