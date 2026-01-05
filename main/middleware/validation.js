import { ZodError } from 'zod';
import { logDebug, logError, logWarning } from '../error-handler';
/**
 * Custom validation error class
 */
export class ValidationError extends Error {
    constructor(message, issues) {
        super(message);
        this.name = 'ValidationError';
        this.issues = issues;
    }
}
/**
 * Validation middleware for IPC calls
 * Ensures data integrity and prevents malformed requests
 */
class ValidationMiddleware {
    constructor() {
        /**
         * Common validators for POS data
         */
        this.validators = {
            email: this.validatePatterns({
                email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            }),
            order: this.createValidator({
                required: ['items', 'total'],
                types: {
                    items: 'array',
                    total: 'number',
                    tableNumber: 'number',
                    status: 'string',
                },
                numericRanges: {
                    total: { min: 0 },
                    tableNumber: { min: 1, max: 100 },
                },
                allowedValues: {
                    status: ['pending', 'preparing', 'ready', 'served', 'paid'],
                },
                sanitize: true,
            }),
            menuItem: this.createValidator({
                required: ['name', 'price', 'category'],
                types: {
                    name: 'string',
                    price: 'number',
                    category: 'string',
                    description: 'string',
                    isAvailable: 'boolean',
                },
                stringLengths: {
                    name: { min: 1, max: 100 },
                    description: { max: 500 },
                    category: { min: 1, max: 50 },
                },
                numericRanges: {
                    price: { min: 0 },
                },
                sanitize: true,
            }),
            table: this.createValidator({
                required: ['name'],
                types: {
                    name: 'string',
                    status: 'string',
                },
                stringLengths: {
                    name: { min: 1, max: 50 },
                },
                allowedValues: {
                    status: ['available', 'occupied', 'reserved', 'cleaning'],
                },
                sanitize: true,
            }),
            user: this.createValidator({
                required: ['email', 'name', 'role'],
                types: {
                    email: 'string',
                    name: 'string',
                    role: 'string',
                    isActive: 'boolean',
                },
                stringLengths: {
                    email: { min: 5, max: 100 },
                    name: { min: 1, max: 100 },
                },
                patterns: {
                    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                },
                allowedValues: {
                    role: ['admin', 'manager', 'cashier'],
                },
                sanitize: true,
            }),
        };
        logDebug('Validation middleware initialized', 'ValidationMiddleware');
    }
    /**
     * Validate required fields
     */
    validateRequired(fields) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                logError(new Error('Invalid data: must be an object'), 'ValidationMiddleware');
                return false;
            }
            for (const field of fields) {
                if (!(field in data) ||
                    data[field] === null ||
                    data[field] === undefined) {
                    logError(new Error(`Missing required field: ${field}`), 'ValidationMiddleware');
                    return false;
                }
            }
            return true;
        };
    }
    /**
     * Validate data types
     */
    validateTypes(schema) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                logError(new Error('Invalid data: must be an object'), 'ValidationMiddleware');
                return false;
            }
            for (const [field, expectedType] of Object.entries(schema)) {
                if (field in data) {
                    const value = data[field];
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    const allowedTypes = Array.isArray(expectedType)
                        ? expectedType
                        : [expectedType];
                    if (!allowedTypes.includes(actualType)) {
                        logError(new Error(`Invalid type for field ${field}: expected ${allowedTypes.join(' or ')}, got ${actualType}`), 'ValidationMiddleware');
                        return false;
                    }
                }
            }
            return true;
        };
    }
    /**
     * Validate string lengths
     */
    validateStringLengths(limits) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                return true; // Skip if no data
            }
            for (const [field, limit] of Object.entries(limits)) {
                if (field in data && typeof data[field] === 'string') {
                    const value = data[field];
                    if (limit.min !== undefined && value.length < limit.min) {
                        logError(new Error(`Field ${field} too short: minimum ${limit.min} characters, got ${value.length}`), 'ValidationMiddleware');
                        return false;
                    }
                    if (limit.max !== undefined && value.length > limit.max) {
                        logError(new Error(`Field ${field} too long: maximum ${limit.max} characters, got ${value.length}`), 'ValidationMiddleware');
                        return false;
                    }
                }
            }
            return true;
        };
    }
    /**
     * Validate numeric ranges
     */
    validateNumericRanges(ranges) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                return true; // Skip if no data
            }
            for (const [field, range] of Object.entries(ranges)) {
                if (field in data && typeof data[field] === 'number') {
                    const value = data[field];
                    if (range.min !== undefined && value < range.min) {
                        logError(new Error(`Field ${field} too small: minimum ${range.min}, got ${value}`), 'ValidationMiddleware');
                        return false;
                    }
                    if (range.max !== undefined && value > range.max) {
                        logError(new Error(`Field ${field} too large: maximum ${range.max}, got ${value}`), 'ValidationMiddleware');
                        return false;
                    }
                }
            }
            return true;
        };
    }
    /**
     * Validate using regex patterns
     */
    validatePatterns(patterns) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                return true; // Skip if no data
            }
            for (const [field, pattern] of Object.entries(patterns)) {
                if (field in data && typeof data[field] === 'string') {
                    const value = data[field];
                    if (!pattern.test(value)) {
                        logError(new Error(`Field ${field} doesn't match required pattern`), 'ValidationMiddleware');
                        return false;
                    }
                }
            }
            return true;
        };
    }
    /**
     * Validate allowed values (enum-like validation)
     */
    validateAllowedValues(allowedValues) {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                return true; // Skip if no data
            }
            for (const [field, allowed] of Object.entries(allowedValues)) {
                if (field in data) {
                    const value = data[field];
                    if (!allowed.includes(value)) {
                        logError(new Error(`Invalid value for field ${field}: must be one of ${allowed.join(', ')}`), 'ValidationMiddleware');
                        return false;
                    }
                }
            }
            return true;
        };
    }
    /**
     * Sanitize input data
     */
    sanitizeInput() {
        return (event, data) => {
            if (!data || typeof data !== 'object') {
                return data;
            }
            const sanitized = { ...data };
            // Remove null bytes
            for (const [key, value] of Object.entries(sanitized)) {
                if (typeof value === 'string') {
                    sanitized[key] = value.replace(/\0/g, '');
                }
            }
            return sanitized;
        };
    }
    /**
     * Create a comprehensive validator with multiple rules
     */
    createValidator(rules) {
        return (event, data) => {
            const errors = [];
            let sanitizedData = data;
            // Sanitize first if requested
            if (rules.sanitize) {
                try {
                    sanitizedData = this.sanitizeInput()(event, data);
                }
                catch (error) {
                    errors.push('Data sanitization failed');
                }
            }
            // Validate required fields
            if (rules.required) {
                if (!this.validateRequired(rules.required)(event, sanitizedData)) {
                    errors.push('Required field validation failed');
                }
            }
            // Validate types
            if (rules.types) {
                if (!this.validateTypes(rules.types)(event, sanitizedData)) {
                    errors.push('Type validation failed');
                }
            }
            // Validate string lengths
            if (rules.stringLengths) {
                if (!this.validateStringLengths(rules.stringLengths)(event, sanitizedData)) {
                    errors.push('String length validation failed');
                }
            }
            // Validate numeric ranges
            if (rules.numericRanges) {
                if (!this.validateNumericRanges(rules.numericRanges)(event, sanitizedData)) {
                    errors.push('Numeric range validation failed');
                }
            }
            // Validate patterns
            if (rules.patterns) {
                if (!this.validatePatterns(rules.patterns)(event, sanitizedData)) {
                    errors.push('Pattern validation failed');
                }
            }
            // Validate allowed values
            if (rules.allowedValues) {
                if (!this.validateAllowedValues(rules.allowedValues)(event, sanitizedData)) {
                    errors.push('Allowed values validation failed');
                }
            }
            const isValid = errors.length === 0;
            if (!isValid) {
                logWarning(`Validation failed: ${errors.join(', ')}`, 'ValidationMiddleware');
            }
            return {
                isValid,
                sanitizedData: isValid ? sanitizedData : undefined,
                errors,
            };
        };
    }
}
// Export singleton instance
export const validationMiddleware = new ValidationMiddleware();
export default validationMiddleware;
/**
 * Validate request data against a schema
 */
export function validate(schema) {
    return (data) => {
        try {
            return schema.parse(data);
        }
        catch (error) {
            if (error instanceof ZodError) {
                throw new ValidationError('Validation failed', error.issues);
            }
            throw error;
        }
    };
}
