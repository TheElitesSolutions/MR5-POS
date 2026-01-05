/**
 * Validation Helper Utilities
 *
 * Provides utilities for runtime validation using Zod schemas
 */
import { z } from 'zod';
import { logger } from './logger';
/**
 * Validate data against a Zod schema
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @param context - Optional context for logging
 * @returns Validation result with typed data or error details
 */
export function validateWithSchema(schema, data, context) {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            }));
            const errorMessage = errors
                .map((e) => `${e.path}: ${e.message}`)
                .join('; ');
            logger.warn(`Validation failed${context ? ` [${context}]` : ''}: ${errorMessage}`, context || 'Validation');
            return {
                success: false,
                error: `Validation error: ${errorMessage}`,
                errors,
            };
        }
        // Non-Zod error
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        logger.error(`Unexpected validation error${context ? ` [${context}]` : ''}: ${errorMessage}`, context || 'Validation');
        return {
            success: false,
            error: errorMessage,
        };
    }
}
/**
 * Safely parse data with a Zod schema, returning null on error
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Validated data or null
 */
export function safeParse(schema, data) {
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
}
/**
 * Type guard generator using Zod schema
 *
 * @param schema - The Zod schema to use for validation
 * @returns Type guard function
 */
export function createTypeGuard(schema) {
    return (data) => {
        return schema.safeParse(data).success;
    };
}
/**
 * Validate enum value
 *
 * @param value - Value to validate
 * @param enumObj - Enum object
 * @param fieldName - Field name for error message
 * @returns Validation result
 */
export function validateEnum(value, enumObj, fieldName = 'value') {
    if (typeof value !== 'string') {
        return {
            success: false,
            error: `${fieldName} must be a string`,
        };
    }
    const enumValues = Object.values(enumObj);
    if (!enumValues.includes(value)) {
        return {
            success: false,
            error: `Invalid ${fieldName}: ${value}. Valid values: ${enumValues.join(', ')}`,
        };
    }
    return {
        success: true,
        data: value,
    };
}
/**
 * Validate UUID format
 *
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @returns Validation result
 */
export function validateUUID(value, fieldName = 'ID') {
    if (typeof value !== 'string') {
        return {
            success: false,
            error: `${fieldName} must be a string`,
        };
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
        return {
            success: false,
            error: `Invalid ${fieldName} format`,
        };
    }
    return {
        success: true,
        data: value,
    };
}
/**
 * Validate positive number
 *
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @returns Validation result
 */
export function validatePositiveNumber(value, fieldName = 'value') {
    if (typeof value !== 'number') {
        return {
            success: false,
            error: `${fieldName} must be a number`,
        };
    }
    if (value <= 0) {
        return {
            success: false,
            error: `${fieldName} must be positive`,
        };
    }
    return {
        success: true,
        data: value,
    };
}
/**
 * Create a validated IPC response
 *
 * @param validationResult - Result from validation
 * @param timestamp - Optional timestamp
 * @returns IPC response format
 */
export function createValidationResponse(validationResult, timestamp) {
    return {
        success: validationResult.success,
        data: validationResult.data,
        error: validationResult.error,
        timestamp: timestamp || new Date().toISOString(),
    };
}
