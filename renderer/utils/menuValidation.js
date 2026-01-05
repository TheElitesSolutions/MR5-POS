/**
 * Menu validation utilities
 *
 * This module provides validation functions for menu-related operations
 * to ensure data consistency and integrity
 */
import { menuAPI } from '@/lib/ipc-api';
import * as z from 'zod';
// Validation schema for menu items
export const menuItemSchema = z
    .object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    description: z
        .string()
        .max(500, 'Description must be 500 characters or less')
        .optional()
        .or(z.literal('')),
    price: z.coerce
        .number({ message: 'Price must be a number' })
        .min(0.01, 'Price must be greater than 0')
        .max(10000, 'Price exceeds maximum allowed'),
    category: z
        .string()
        .min(1, 'Category is required')
        .max(50, 'Category name too long'),
    isAvailable: z.boolean().default(true),
    isCustomizable: z.boolean().default(false), // ✅ NEW: Add isCustomizable field
    ingredients: z
        .array(z.union([
        z.string(),
        z
            .object({
            stockItemId: z.string(),
            quantityRequired: z.number().or(z.string()),
            unit: z.string().optional().nullable(),
        })
            .passthrough(),
    ]))
        .optional()
        .default([]),
})
    .passthrough(); // Allow additional properties for flexibility
/**
 * Check if a menu item with the same name already exists
 *
 * @param name The name to check for duplicates
 * @param currentItemId Optional ID of the current item (for updates)
 * @returns Object indicating if the name is unique and any error message
 */
export async function checkDuplicateName(name, currentItemId) {
    try {
        // First trim the name to ensure consistent comparison
        const trimmedName = name.trim();
        if (!trimmedName) {
            return { isUnique: false, message: 'Item name cannot be empty' };
        }
        // Get all menu items
        const response = await menuAPI.getAll();
        if (!response.success || !response.data) {
            // If we can't check, we'll assume it's unique rather than blocking the operation
            console.error('Failed to check for duplicate names:', response.error);
            return { isUnique: true };
        }
        // Check if any existing item (except the current one) has the same name
        // ✅ Fix: Handle paginated response structure
        const items = response.data?.items || response.data || [];
        // Ensure items is an array before using find
        if (!Array.isArray(items)) {
            console.error('Menu items data is not an array:', items);
            return { isUnique: true }; // Assume unique if data is invalid
        }
        const duplicate = items.find(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
            item.id !== currentItemId);
        if (duplicate) {
            return {
                isUnique: false,
                message: `A menu item with the name "${trimmedName}" already exists`,
            };
        }
        return { isUnique: true };
    }
    catch (error) {
        console.error('Error checking for duplicate names:', error);
        // In case of error, we'll allow the operation to proceed
        return { isUnique: true };
    }
}
/**
 * Validate a menu item before saving
 *
 * @param data The menu item data to validate
 * @param itemId Optional ID of the current item (for updates)
 * @returns Object with validation result and any error messages
 */
export async function validateMenuItem(data, itemId) {
    console.log('Validating menu item data:', JSON.stringify(data, null, 2));
    // First, try direct validation to get better error messages
    try {
        menuItemSchema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            console.log('Zod validation error details:', error.issues);
            // Convert Zod errors to a simpler format
            const errors = {};
            error.issues.forEach(err => {
                // Get the field path (e.g., "name", "price", etc.)
                const field = err.path.length > 0 ? err.path.join('.') : 'form';
                errors[field] = err.message;
                console.log(`Field ${field} error:`, err.message);
            });
            // If no errors were extracted but validation failed, add a generic error
            if (Object.keys(errors).length === 0) {
                errors.form = 'Please check all required fields';
            }
            console.log('Extracted validation errors:', errors);
            return { isValid: false, errors };
        }
    }
    // If direct validation didn't catch anything, try the safe parse approach
    const schemaValidation = menuItemSchema.safeParse(data);
    if (!schemaValidation.success) {
        // Extract validation errors from Zod
        const formattedErrors = schemaValidation.error.format();
        console.log('Validation failed (safeParse):', formattedErrors);
        // Convert to a simpler error format
        const errors = {};
        // Handle both nested and top-level errors
        Object.keys(formattedErrors).forEach(key => {
            if (key === '_errors' && formattedErrors._errors.length > 0) {
                errors.form = formattedErrors._errors[0];
            }
            else if (key !== '_errors') {
                if (formattedErrors[key]?._errors?.[0]) {
                    errors[key] = formattedErrors[key]._errors[0];
                }
            }
        });
        // If we still have no errors, add a generic one
        if (Object.keys(errors).length === 0) {
            errors.form = 'Please check all fields and try again';
        }
        console.log('Extracted errors (safeParse):', errors);
        return { isValid: false, errors };
    }
    // Check for duplicate name
    const nameCheck = await checkDuplicateName(data.name, itemId);
    if (!nameCheck.isUnique) {
        return {
            isValid: false,
            errors: { name: nameCheck.message || 'Duplicate name' },
        };
    }
    // All validations passed
    return { isValid: true, errors: {} };
}
export default {
    menuItemSchema,
    checkDuplicateName,
    validateMenuItem,
};
