/**
 * Zod Validation Schemas for Add-Ons System
 *
 * Phase 1 - Task 1.4: Data Validation & Integrity
 * Implements comprehensive validation following MR5 patterns
 */

import { z } from 'zod';

// ============================================================================
// ADDON GROUP VALIDATION
// ============================================================================

export const AddonGroupSchema = z.object({
  id: z.string().min(1).optional(), // Optional for creation - accepts database-generated hex IDs
  name: z
    .string()
    .min(1, 'Add-on group name is required')
    .max(100, 'Add-on group name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')),
  isActive: z
    .union([z.boolean(), z.number()])
    .transform(val => {
      if (typeof val === 'number') {
        return val !== 0; // Convert 0 to false, any other number to true
      }
      return val;
    })
    .pipe(z.boolean())
    .default(true),
  sortOrder: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .default(0),
});

export const CreateAddonGroupSchema = AddonGroupSchema.omit({ id: true });
export const UpdateAddonGroupSchema = AddonGroupSchema.partial().required({
  id: true,
});

export type AddonGroupInput = z.infer<typeof AddonGroupSchema>;
export type CreateAddonGroupInput = z.infer<typeof CreateAddonGroupSchema>;
export type UpdateAddonGroupInput = z.infer<typeof UpdateAddonGroupSchema>;

// ============================================================================
// ADDON VALIDATION
// ============================================================================

// Schema for individual inventory item in an addon
export const AddonInventoryItemSchema = z.object({
  inventoryId: z.string().min(1, 'Inventory item is required'),
  quantity: z.number().min(0, 'Quantity cannot be negative').default(0),
});

export const AddonSchema = z.object({
  id: z.string().min(1).optional(), // Optional for creation - accepts database-generated hex IDs
  addonGroupId: z.string().min(1, 'Invalid addon group ID format'),
  name: z
    .string()
    .min(1, 'Add-on name is required')
    .max(100, 'Add-on name must be 100 characters or less')
    .trim(),
  price: z
    .union([z.number(), z.string(), z.any()]) // Accept number, string, or Decimal
    .transform(val => {
      // Handle Prisma Decimal objects
      if (val && typeof val === 'object' && 'toNumber' in val) {
        return val.toNumber();
      }
      // Handle strings
      if (typeof val === 'string') {
        return parseFloat(val);
      }
      return val;
    })
    .pipe(
      z
        .number()
        .positive('Price must be positive')
        .max(999.99, 'Price cannot exceed $999.99')
        .multipleOf(0.01, 'Price must have at most 2 decimal places')
    ),
  isActive: z
    .union([z.boolean(), z.number()])
    .transform(val => {
      if (typeof val === 'number') {
        return val !== 0; // Convert 0 to false, any other number to true
      }
      return val;
    })
    .pipe(z.boolean())
    .default(true),
  sortOrder: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .default(0),
  imageUrl: z.string().url('Invalid image URL format').optional().nullable(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
});

export const CreateAddonSchema = AddonSchema.omit({ id: true }).extend({
  inventoryItems: z.array(AddonInventoryItemSchema).optional().default([]),
});

export const UpdateAddonSchema = AddonSchema.partial().required({ id: true }).extend({
  inventoryItems: z.array(AddonInventoryItemSchema).optional(),
});

export type AddonInput = z.infer<typeof AddonSchema>;
export type CreateAddonInput = z.infer<typeof CreateAddonSchema>;
export type UpdateAddonInput = z.infer<typeof UpdateAddonSchema>;

// ============================================================================
// CATEGORY ADDON GROUP VALIDATION
// ============================================================================

const BaseCategoryAddonGroupSchema = z.object({
  id: z.string().min(1).optional(), // Optional for creation - accepts database-generated hex IDs
  categoryId: z.string().min(1, 'Invalid category ID format'),
  addonGroupId: z.string().min(1, 'Invalid addon group ID format'),
  isRequired: z.boolean().default(false),
  minSelections: z
    .number()
    .int('Minimum selections must be an integer')
    .min(0, 'Minimum selections must be non-negative')
    .default(0),
  maxSelections: z
    .number()
    .int('Maximum selections must be an integer')
    .positive('Maximum selections must be positive')
    .default(10),
  isActive: z
    .union([z.boolean(), z.number()])
    .transform(val => {
      if (typeof val === 'number') {
        return val !== 0; // Convert 0 to false, any other number to true
      }
      return val;
    })
    .pipe(z.boolean())
    .default(true),
});

export const CategoryAddonGroupSchema = BaseCategoryAddonGroupSchema.refine(
  data => data.minSelections <= data.maxSelections,
  {
    message:
      'Minimum selections must be less than or equal to maximum selections',
    path: ['minSelections'],
  }
);

export const CreateCategoryAddonGroupSchema = BaseCategoryAddonGroupSchema.omit(
  {
    id: true,
  }
).refine(data => data.minSelections <= data.maxSelections, {
  message:
    'Minimum selections must be less than or equal to maximum selections',
  path: ['minSelections'],
});

export const UpdateCategoryAddonGroupSchema =
  BaseCategoryAddonGroupSchema.partial()
    .required({ id: true })
    .refine(
      data => {
        if (
          data.minSelections !== undefined &&
          data.maxSelections !== undefined
        ) {
          return data.minSelections <= data.maxSelections;
        }
        return true;
      },
      {
        message:
          'Minimum selections must be less than or equal to maximum selections',
        path: ['minSelections'],
      }
    );

export type CategoryAddonGroupInput = z.infer<typeof CategoryAddonGroupSchema>;
export type CreateCategoryAddonGroupInput = z.infer<
  typeof CreateCategoryAddonGroupSchema
>;
export type UpdateCategoryAddonGroupInput = z.infer<
  typeof UpdateCategoryAddonGroupSchema
>;

// ============================================================================
// ORDER ITEM ADDON VALIDATION
// ============================================================================

const BaseOrderItemAddonSchema = z.object({
  id: z.string().min(1).optional(), // Optional for creation - accepts database-generated hex IDs
  orderItemId: z.string().min(1, 'Invalid order item ID format'),
  addonId: z.string().min(1, 'Invalid addon ID format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive')
    .max(99, 'Quantity cannot exceed 99'),
  unitPrice: z
    .number()
    .positive('Unit price must be positive')
    .max(999.99, 'Unit price cannot exceed $999.99')
    .multipleOf(0.01, 'Unit price must have at most 2 decimal places'),
  totalPrice: z
    .number()
    .positive('Total price must be positive')
    .max(99999.99, 'Total price cannot exceed $99,999.99')
    .multipleOf(0.01, 'Total price must have at most 2 decimal places'),
});

export const OrderItemAddonSchema = BaseOrderItemAddonSchema.refine(
  data => {
    const expectedTotal =
      Math.round(data.unitPrice * data.quantity * 100) / 100;
    return Math.abs(data.totalPrice - expectedTotal) < 0.01;
  },
  {
    message: 'Total price must equal unit price × quantity',
    path: ['totalPrice'],
  }
);

export const CreateOrderItemAddonSchema = BaseOrderItemAddonSchema.omit({
  id: true,
}).refine(
  data => {
    const expectedTotal =
      Math.round(data.unitPrice * data.quantity * 100) / 100;
    return Math.abs(data.totalPrice - expectedTotal) < 0.01;
  },
  {
    message: 'Total price must equal unit price × quantity',
    path: ['totalPrice'],
  }
);

export const UpdateOrderItemAddonSchema = BaseOrderItemAddonSchema.partial()
  .required({ id: true })
  .refine(
    data => {
      if (
        data.unitPrice !== undefined &&
        data.quantity !== undefined &&
        data.totalPrice !== undefined
      ) {
        const expectedTotal =
          Math.round(data.unitPrice * data.quantity * 100) / 100;
        return Math.abs(data.totalPrice - expectedTotal) < 0.01;
      }
      return true;
    },
    {
      message: 'Total price must equal unit price × quantity',
      path: ['totalPrice'],
    }
  );

export type OrderItemAddonInput = z.infer<typeof OrderItemAddonSchema>;
export type CreateOrderItemAddonInput = z.infer<
  typeof CreateOrderItemAddonSchema
>;
export type UpdateOrderItemAddonInput = z.infer<
  typeof UpdateOrderItemAddonSchema
>;

// ============================================================================
// ADDON SELECTION VALIDATION (for frontend)
// ============================================================================

export const AddonSelectionSchema = z.object({
  addonId: z.string().min(1, 'Invalid addon ID format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive')
    .max(99, 'Quantity cannot exceed 99')
    .default(1),
});

export const AddonSelectionsSchema = z.object({
  categoryId: z.string().min(1, 'Invalid category ID format'),
  selections: z
    .array(AddonSelectionSchema)
    .max(20, 'Cannot select more than 20 add-ons per item'),
});

export type AddonSelection = z.infer<typeof AddonSelectionSchema>;
export type AddonSelections = z.infer<typeof AddonSelectionsSchema>;

// ============================================================================
// BULK OPERATIONS VALIDATION
// ============================================================================

export const BulkAddonGroupSchema = z.object({
  addonGroups: z
    .array(CreateAddonGroupSchema)
    .min(1, 'At least one addon group is required')
    .max(50, 'Cannot create more than 50 addon groups at once'),
});

export const BulkAddonSchema = z.object({
  addons: z
    .array(CreateAddonSchema)
    .min(1, 'At least one addon is required')
    .max(100, 'Cannot create more than 100 addons at once'),
});

export type BulkAddonGroups = z.infer<typeof BulkAddonGroupSchema>;
export type BulkAddons = z.infer<typeof BulkAddonSchema>;

// ============================================================================
// API REQUEST/RESPONSE VALIDATION
// ============================================================================

export const AddonGroupQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'sortOrder', 'createdAt']).default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const AddonQuerySchema = z.object({
  addonGroupId: z.string().min(1).optional(),
  inventoryId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  search: z.string().max(100).optional(),
  priceMin: z.number().positive().optional(),
  priceMax: z.number().positive().optional(),
  sortBy: z
    .enum(['name', 'price', 'sortOrder', 'createdAt'])
    .default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type AddonGroupQuery = z.infer<typeof AddonGroupQuerySchema>;
export type AddonQuery = z.infer<typeof AddonQuerySchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validates addon selections against category rules
 */
export function validateAddonSelections(
  selections: AddonSelection[],
  categoryRules: {
    addonGroupId: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
  }[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Group selections by addon group
  const selectionsByGroup = new Map<string, number>();

  for (const selection of selections) {
    // This would require addon lookup - implement in service layer
    // For now, basic validation
    const current = selectionsByGroup.get(selection.addonId) || 0;
    selectionsByGroup.set(selection.addonId, current + selection.quantity);
  }

  // Validate against rules (implement in service layer with full data)
  // This is a placeholder for the validation logic

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates total price for addon selections
 */
export function calculateAddonTotal(
  selections: AddonSelection[],
  addonPrices: Map<string, number>
): number {
  return selections.reduce((total, selection) => {
    const addonPrice = addonPrices.get(selection.addonId) || 0;
    return total + addonPrice * selection.quantity;
  }, 0);
}

/**
 * Validates price precision (max 2 decimal places)
 */
export function validatePricePrecision(price: number): boolean {
  return Number.isInteger(price * 100);
}
