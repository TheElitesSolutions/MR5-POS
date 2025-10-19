// Validation Middleware for Main Process IPC
import { IpcMainInvokeEvent } from 'electron';
import { ZodError, ZodSchema } from 'zod';
import { logDebug, logError, logWarning } from '../error-handler';

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  issues: any[];

  constructor(message: string, issues: any[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * Type for a validation function
 */
export type ValidatorFn = (data: any) => Promise<any> | any;

/**
 * Validation middleware for IPC calls
 * Ensures data integrity and prevents malformed requests
 */
class ValidationMiddleware {
  constructor() {
    logDebug('Validation middleware initialized', 'ValidationMiddleware');
  }

  /**
   * Validate required fields
   */
  public validateRequired(fields: string[]) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        logError(
          new Error('Invalid data: must be an object'),
          'ValidationMiddleware'
        );
        return false;
      }

      for (const field of fields) {
        if (
          !(field in data) ||
          data[field] === null ||
          data[field] === undefined
        ) {
          logError(
            new Error(`Missing required field: ${field}`),
            'ValidationMiddleware'
          );
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Validate data types
   */
  public validateTypes(schema: Record<string, string | string[]>) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        logError(
          new Error('Invalid data: must be an object'),
          'ValidationMiddleware'
        );
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
            logError(
              new Error(
                `Invalid type for field ${field}: expected ${allowedTypes.join(' or ')}, got ${actualType}`
              ),
              'ValidationMiddleware'
            );
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
  public validateStringLengths(
    limits: Record<string, { min?: number; max?: number }>
  ) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        return true; // Skip if no data
      }

      for (const [field, limit] of Object.entries(limits)) {
        if (field in data && typeof data[field] === 'string') {
          const value = data[field] as string;

          if (limit.min !== undefined && value.length < limit.min) {
            logError(
              new Error(
                `Field ${field} too short: minimum ${limit.min} characters, got ${value.length}`
              ),
              'ValidationMiddleware'
            );
            return false;
          }

          if (limit.max !== undefined && value.length > limit.max) {
            logError(
              new Error(
                `Field ${field} too long: maximum ${limit.max} characters, got ${value.length}`
              ),
              'ValidationMiddleware'
            );
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
  public validateNumericRanges(
    ranges: Record<string, { min?: number; max?: number }>
  ) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        return true; // Skip if no data
      }

      for (const [field, range] of Object.entries(ranges)) {
        if (field in data && typeof data[field] === 'number') {
          const value = data[field] as number;

          if (range.min !== undefined && value < range.min) {
            logError(
              new Error(
                `Field ${field} too small: minimum ${range.min}, got ${value}`
              ),
              'ValidationMiddleware'
            );
            return false;
          }

          if (range.max !== undefined && value > range.max) {
            logError(
              new Error(
                `Field ${field} too large: maximum ${range.max}, got ${value}`
              ),
              'ValidationMiddleware'
            );
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
  public validatePatterns(patterns: Record<string, RegExp>) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        return true; // Skip if no data
      }

      for (const [field, pattern] of Object.entries(patterns)) {
        if (field in data && typeof data[field] === 'string') {
          const value = data[field] as string;

          if (!pattern.test(value)) {
            logError(
              new Error(`Field ${field} doesn't match required pattern`),
              'ValidationMiddleware'
            );
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
  public validateAllowedValues(allowedValues: Record<string, any[]>) {
    return (event: IpcMainInvokeEvent, data: any): boolean => {
      if (!data || typeof data !== 'object') {
        return true; // Skip if no data
      }

      for (const [field, allowed] of Object.entries(allowedValues)) {
        if (field in data) {
          const value = data[field];

          if (!allowed.includes(value)) {
            logError(
              new Error(
                `Invalid value for field ${field}: must be one of ${allowed.join(', ')}`
              ),
              'ValidationMiddleware'
            );
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
  public sanitizeInput() {
    return (event: IpcMainInvokeEvent, data: any): any => {
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
  public createValidator(rules: {
    required?: string[];
    types?: Record<string, string | string[]>;
    stringLengths?: Record<string, { min?: number; max?: number }>;
    numericRanges?: Record<string, { min?: number; max?: number }>;
    patterns?: Record<string, RegExp>;
    allowedValues?: Record<string, any[]>;
    sanitize?: boolean;
  }) {
    return (
      event: IpcMainInvokeEvent,
      data: any
    ): { isValid: boolean; sanitizedData?: any; errors: string[] } => {
      const errors: string[] = [];
      let sanitizedData = data;

      // Sanitize first if requested
      if (rules.sanitize) {
        try {
          sanitizedData = this.sanitizeInput()(event, data);
        } catch (error) {
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
        if (
          !this.validateStringLengths(rules.stringLengths)(event, sanitizedData)
        ) {
          errors.push('String length validation failed');
        }
      }

      // Validate numeric ranges
      if (rules.numericRanges) {
        if (
          !this.validateNumericRanges(rules.numericRanges)(event, sanitizedData)
        ) {
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
        if (
          !this.validateAllowedValues(rules.allowedValues)(event, sanitizedData)
        ) {
          errors.push('Allowed values validation failed');
        }
      }

      const isValid = errors.length === 0;

      if (!isValid) {
        logWarning(
          `Validation failed: ${errors.join(', ')}`,
          'ValidationMiddleware'
        );
      }

      return {
        isValid,
        sanitizedData: isValid ? sanitizedData : undefined,
        errors,
      };
    };
  }

  /**
   * Common validators for POS data
   */
  public validators = {
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
}

// Export singleton instance
export const validationMiddleware = new ValidationMiddleware();
export default validationMiddleware;

/**
 * Validate request data against a schema
 */
export function validate<T>(schema: ZodSchema<T>): ValidatorFn {
  return (data: any) => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError('Validation failed', error.issues);
      }
      throw error;
    }
  };
}
