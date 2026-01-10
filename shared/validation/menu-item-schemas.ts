/**
 * Zod Validation Schemas for Menu Item Operations
 *
 * Implements comprehensive validation for menu item bulk operations
 * following MR5 patterns and best practices.
 */

import { z } from 'zod';

// ============================================================================
// BULK UPDATE VALIDATION
// ============================================================================

/**
 * Schema for bulk updating menu item properties
 *
 * Validates:
 * - At least one item ID is provided
 * - At least one property is being updated
 * - User ID is provided for audit trail
 * - Category ID filter is optional
 */
export const BulkUpdateMenuItemPropertiesSchema = z.object({
  itemIds: z
    .array(z.string().min(1, 'Item ID cannot be empty'))
    .min(1, 'At least one item ID is required')
    .max(1000, 'Cannot update more than 1000 items at once'),

  categoryId: z
    .string()
    .min(1, 'Category ID cannot be empty')
    .optional(),

  updates: z
    .object({
      isCustomizable: z.boolean().optional(),
      isPrintableInKitchen: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.isCustomizable !== undefined ||
        data.isPrintableInKitchen !== undefined,
      {
        message: 'At least one property must be specified for update',
      }
    ),

  userId: z
    .string()
    .min(1, 'User ID is required for audit trail'),
});

export type BulkUpdateMenuItemPropertiesInput = z.infer<
  typeof BulkUpdateMenuItemPropertiesSchema
>;
