/**
 * Zod Validation Schemas for Runtime Type Checking
 *
 * This file contains Zod schemas that validate data at runtime,
 * providing an additional layer of type safety beyond TypeScript's compile-time checks.
 */

import { z } from 'zod';

/**
 * Common validation helpers
 */
// Flexible ID schema that accepts multiple ID formats:
// 1. SQLite generates: lower(hex(randomblob(16))) = 32 hex characters
// 2. UUID format: 8-4-4-4-12 hex characters with dashes
// 3. Custom generateId() format: timestamp(base36) + random(base36)
// 4. Manual IDs: alphanumeric with hyphens/underscores
export const idSchema = z.string().min(1, 'ID is required').refine(
  (val) => {
    if (!val || val.trim().length === 0) return false;
    
    // Accept 32-character hex strings (SQLite format)
    const hexPattern = /^[a-f0-9]{32}$/i;
    // Accept standard UUID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Accept custom format (alphanumeric with hyphens/underscores, 3-50 chars)
    const customPattern = /^[a-z0-9_-]{3,50}$/i;
    
    return hexPattern.test(val) || uuidPattern.test(val) || customPattern.test(val);
  },
  { message: 'Invalid ID format' }
);

// Legacy UUID schema for backward compatibility
export const uuidSchema = idSchema;

export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const nonNegativeNumberSchema = z.number().nonnegative('Must be non-negative');

/**
 * Enum Schemas
 */
export const OrderStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
]);

export const OrderTypeSchema = z.enum(['DINE_IN', 'TAKEOUT', 'DELIVERY']);

export const TableStatusSchema = z.enum([
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'OUT_OF_ORDER',
]);

export const PaymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'DIGITAL_WALLET',
  'CHECK',
  'OTHER',
]);

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
]);

export const UserRoleSchema = z.enum([
  'OWNER',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'ADMIN',
]);

/**
 * Order Validation Schemas
 */
export const CreateOrderItemSchema = z.object({
  menuItemId: uuidSchema,
  quantity: positiveNumberSchema.int('Quantity must be an integer'),
  notes: z.string().optional(),
  addons: z
    .array(
      z.object({
        addonId: uuidSchema,
        quantity: positiveNumberSchema.int(),
      })
    )
    .optional(),
});

export const CreateOrderSchema = z.object({
  items: z.array(CreateOrderItemSchema).default([]), // Allow empty orders (items added later)
  tableId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  userId: uuidSchema,
  type: OrderTypeSchema,
  notes: z.string().optional(),
  deliveryFee: nonNegativeNumberSchema.optional(),
  customerDetails: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  id: uuidSchema,
  status: OrderStatusSchema,
  userId: uuidSchema.optional(),
});

/**
 * Menu Item Validation Schemas
 */
// Ingredient schema for menu items
export const IngredientSchema = z.object({
  id: z.string().min(1, 'Ingredient ID is required'),
  name: z.string().min(1, 'Ingredient name is required'),
  quantityRequired: nonNegativeNumberSchema,
  currentStock: nonNegativeNumberSchema.optional(),
  unit: z.string().min(1, 'Unit is required'),
  costPerUnit: nonNegativeNumberSchema.optional(),
  isRequired: z.boolean().optional(),
  isSelected: z.boolean().optional(),
  canAdjust: z.boolean().optional(),
});

export const CreateMenuItemSchema = z.object({
  menuItem: z.object({
    name: z.string().min(1, 'Menu item name is required'),
    description: z.string().optional(),
    price: positiveNumberSchema,
    categoryId: z.string().optional(), // Accept any string ID (not strict UUID)
    category: z.string().optional(),
    isActive: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    isAvailable: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    isCustomizable: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
    preparationTime: nonNegativeNumberSchema.int().optional(),
    ingredients: z.array(IngredientSchema).optional(), // ✅ ADDED
    allergens: z.array(z.string()).optional(),
    nutritionalInfo: z.record(z.string(), z.any()).optional(),
  }),
  userId: z.string().min(1, 'User ID is required'), // Accept any string ID (not strict UUID)
  restoreMode: z.boolean().optional(),
});

export const UpdateMenuItemSchema = z.object({
  id: z.string().min(1, 'Menu item ID is required'), // Accept any string ID (not strict UUID)
  updates: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: positiveNumberSchema.optional(),
    categoryId: z.string().optional(), // Accept any string ID (not strict UUID)
    category: z.string().optional(),
    isActive: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    isAvailable: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    isCustomizable: z.union([z.boolean(), z.number()]).transform(val => {
      if (typeof val === 'number') return val !== 0;
      return val;
    }).pipe(z.boolean()).optional(),
    imageUrl: z.string().url().optional(),
    preparationTime: nonNegativeNumberSchema.int().optional(),
    ingredients: z.array(IngredientSchema).optional(), // ✅ ADDED
    allergens: z.array(z.string()).optional(),
    nutritionalInfo: z.record(z.string(), z.any()).optional(),
    _lastKnownUpdatedAt: z.union([z.string(), z.date()]).optional(),
  }),
  userId: z.string().min(1, 'User ID is required'), // Accept any string ID (not strict UUID)
});

/**
 * Table Validation Schemas
 */
export const CreateTableSchema = z.object({
  name: z.string().min(1, 'Table name is required'),
  status: TableStatusSchema.optional(),
});

export const UpdateTableStatusSchema = z.object({
  id: uuidSchema,
  status: TableStatusSchema,
});

/**
 * Payment Validation Schemas
 */
export const CreatePaymentSchema = z.object({
  orderId: uuidSchema,
  amount: positiveNumberSchema,
  method: PaymentMethodSchema,
  transactionId: z.string().optional(),
  notes: z.string().optional(),
  userId: uuidSchema,
});

/**
 * Inventory Validation Schemas
 */
export const CreateInventoryItemSchema = z.object({
  // Accept both 'name' (frontend) and 'itemName' (backend)
  itemName: z.string().min(1, 'Item name is required').optional(),
  name: z.string().min(1, 'Item name is required').optional(),
  category: z.string().min(1, 'Category is required'),
  // Accept both 'currentQuantity' (frontend) and 'currentStock' (backend)
  currentStock: nonNegativeNumberSchema.optional(),
  currentQuantity: nonNegativeNumberSchema.optional(),
  // Accept both 'minimumQuantity' (frontend) and 'minimumStock' (backend)
  minimumStock: nonNegativeNumberSchema.optional(),
  minimumQuantity: nonNegativeNumberSchema.optional(),
  unit: z.string().min(1, 'Unit is required'),
  costPerUnit: nonNegativeNumberSchema,
  supplier: z.string().optional(),
  expiryDate: z.union([z.string(), z.date()]).optional(),
}).refine(
  (data) => data.itemName || data.name,
  { message: 'Item name is required', path: ['itemName'] }
).refine(
  (data) => data.currentStock !== undefined || data.currentQuantity !== undefined,
  { message: 'Current stock is required', path: ['currentStock'] }
).refine(
  (data) => data.minimumStock !== undefined || data.minimumQuantity !== undefined,
  { message: 'Minimum stock is required', path: ['minimumStock'] }
);

export const AdjustStockSchema = z.object({
  id: uuidSchema,
  adjustment: z.object({
    quantity: z.number(),
    reason: z.string().optional(),
  }),
});

/**
 * Expense Validation Schemas
 */
export const CreateExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: positiveNumberSchema,
  category: z.string().min(1, 'Category is required'),
  date: z.union([z.string(), z.date()]),
  receipt: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * User Validation Schemas
 */
export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: UserRoleSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
  accessToken: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * Type exports for validated data
 */
export type ValidatedCreateOrder = z.infer<typeof CreateOrderSchema>;
export type ValidatedUpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>;
export type ValidatedCreateMenuItem = z.infer<typeof CreateMenuItemSchema>;
export type ValidatedUpdateMenuItem = z.infer<typeof UpdateMenuItemSchema>;
export type ValidatedCreateTable = z.infer<typeof CreateTableSchema>;
export type ValidatedUpdateTableStatus = z.infer<typeof UpdateTableStatusSchema>;
export type ValidatedCreatePayment = z.infer<typeof CreatePaymentSchema>;
export type ValidatedCreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;
export type ValidatedAdjustStock = z.infer<typeof AdjustStockSchema>;
export type ValidatedCreateExpense = z.infer<typeof CreateExpenseSchema>;
export type ValidatedLogin = z.infer<typeof LoginSchema>;
export type ValidatedCreateUser = z.infer<typeof CreateUserSchema>;
export type ValidatedChangePassword = z.infer<typeof ChangePasswordSchema>;
