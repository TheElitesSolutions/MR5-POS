/**
 * Add-Ons System Error Handling
 *
 * Comprehensive error classes and codes for the add-ons system
 * Provides standardized error responses and proper HTTP status codes
 */

import createHttpError from 'http-errors';

/**
 * Standardized error codes for add-ons operations
 */
export enum AddonErrorCodes {
  // Add-on Group Errors
  ADDON_GROUP_NOT_FOUND = 'ADDON_GROUP_NOT_FOUND',
  ADDON_GROUP_NAME_EXISTS = 'ADDON_GROUP_NAME_EXISTS',
  ADDON_GROUP_HAS_ADDONS = 'ADDON_GROUP_HAS_ADDONS',

  // Add-on Errors
  ADDON_NOT_FOUND = 'ADDON_NOT_FOUND',
  ADDON_NAME_EXISTS = 'ADDON_NAME_EXISTS',
  ADDON_INVALID_PRICE = 'ADDON_INVALID_PRICE',

  // Category Assignment Errors
  INVALID_CATEGORY_ASSIGNMENT = 'INVALID_CATEGORY_ASSIGNMENT',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  ASSIGNMENT_ALREADY_EXISTS = 'ASSIGNMENT_ALREADY_EXISTS',
  ASSIGNMENT_NOT_FOUND = 'ASSIGNMENT_NOT_FOUND',

  // Inventory Errors
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVENTORY_LINK_FAILED = 'INVENTORY_LINK_FAILED',
  INVENTORY_NOT_FOUND = 'INVENTORY_NOT_FOUND',

  // Order Processing Errors
  ORDER_ITEM_NOT_FOUND = 'ORDER_ITEM_NOT_FOUND',
  ADDON_ALREADY_ADDED = 'ADDON_ALREADY_ADDED',
  PRICING_CALCULATION_ERROR = 'PRICING_CALCULATION_ERROR',

  // Selection Rules Errors
  MIN_SELECTIONS_NOT_MET = 'MIN_SELECTIONS_NOT_MET',
  MAX_SELECTIONS_EXCEEDED = 'MAX_SELECTIONS_EXCEEDED',
  REQUIRED_ADDON_GROUP_MISSING = 'REQUIRED_ADDON_GROUP_MISSING',

  // System Errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Custom error class for add-ons system
 * Extends the standard Error class with additional context
 */
export class AddonError extends Error {
  public readonly code: AddonErrorCodes;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    code: AddonErrorCodes,
    message: string,
    statusCode: number = 400,
    details?: any
  ) {
    super(message);
    this.name = 'AddonError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AddonError);
  }

  /**
   * Convert to HTTP error for consistent API responses
   */
  toHttpError() {
    return createHttpError(this.statusCode, this.message, {
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
    });
  }

  /**
   * Convert to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error factory functions for common add-ons errors
 * Provides consistent error messages and status codes
 */
export class AddonErrorFactory {
  // Add-on Group Errors
  static addonGroupNotFound(groupId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_GROUP_NOT_FOUND,
      `Add-on group with ID '${groupId}' not found`,
      404,
      { groupId }
    );
  }

  static addonGroupNameExists(name: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_GROUP_NAME_EXISTS,
      `Add-on group with name '${name}' already exists`,
      409,
      { name }
    );
  }

  static addonGroupHasAddons(groupId: string, addonCount: number): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_GROUP_HAS_ADDONS,
      `Cannot delete add-on group '${groupId}' because it has ${addonCount} active add-ons`,
      409,
      { groupId, addonCount }
    );
  }

  // Add-on Errors
  static addonNotFound(addonId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_NOT_FOUND,
      `Add-on with ID '${addonId}' not found`,
      404,
      { addonId }
    );
  }

  static addonNameExists(name: string, groupId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_NAME_EXISTS,
      `Add-on with name '${name}' already exists in group '${groupId}'`,
      409,
      { name, groupId }
    );
  }

  static addonInvalidPrice(price: number): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_INVALID_PRICE,
      `Invalid add-on price: ${price}. Price must be between $0.01 and $999.99`,
      400,
      { price }
    );
  }

  // Category Assignment Errors
  static categoryNotFound(categoryId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.CATEGORY_NOT_FOUND,
      `Category with ID '${categoryId}' not found`,
      404,
      { categoryId }
    );
  }

  static assignmentAlreadyExists(
    categoryId: string,
    groupId: string
  ): AddonError {
    return new AddonError(
      AddonErrorCodes.ASSIGNMENT_ALREADY_EXISTS,
      `Add-on group '${groupId}' is already assigned to category '${categoryId}'`,
      409,
      { categoryId, groupId }
    );
  }

  // Inventory Errors
  static insufficientStock(
    addonId: string,
    requested: number,
    available: number
  ): AddonError {
    return new AddonError(
      AddonErrorCodes.INSUFFICIENT_STOCK,
      `Insufficient stock for add-on '${addonId}'. Requested: ${requested}, Available: ${available}`,
      400,
      { addonId, requested, available }
    );
  }

  static inventoryNotFound(inventoryId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.INVENTORY_NOT_FOUND,
      `Inventory item with ID '${inventoryId}' not found`,
      404,
      { inventoryId }
    );
  }

  // Order Processing Errors
  static orderItemNotFound(orderItemId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ORDER_ITEM_NOT_FOUND,
      `Order item with ID '${orderItemId}' not found`,
      404,
      { orderItemId }
    );
  }

  static addonAlreadyAdded(orderItemId: string, addonId: string): AddonError {
    return new AddonError(
      AddonErrorCodes.ADDON_ALREADY_ADDED,
      `Add-on '${addonId}' is already added to order item '${orderItemId}'`,
      409,
      { orderItemId, addonId }
    );
  }

  // Selection Rules Errors
  static minSelectionsNotMet(
    groupName: string,
    required: number,
    selected: number
  ): AddonError {
    return new AddonError(
      AddonErrorCodes.MIN_SELECTIONS_NOT_MET,
      `'${groupName}' requires at least ${required} selections, but only ${selected} were selected`,
      400,
      { groupName, required, selected }
    );
  }

  static maxSelectionsExceeded(
    groupName: string,
    max: number,
    selected: number
  ): AddonError {
    return new AddonError(
      AddonErrorCodes.MAX_SELECTIONS_EXCEEDED,
      `'${groupName}' allows maximum ${max} selections, but ${selected} were selected`,
      400,
      { groupName, max, selected }
    );
  }

  static requiredAddonGroupMissing(groupName: string): AddonError {
    return new AddonError(
      AddonErrorCodes.REQUIRED_ADDON_GROUP_MISSING,
      `Required add-on group '${groupName}' has no selections`,
      400,
      { groupName }
    );
  }

  // System Errors
  static transactionFailed(operation: string, error: any): AddonError {
    return new AddonError(
      AddonErrorCodes.TRANSACTION_FAILED,
      `Transaction failed during ${operation}: ${error.message}`,
      500,
      { operation, originalError: error.message }
    );
  }

  static validationFailed(
    field: string,
    value: any,
    errors: any[]
  ): AddonError {
    return new AddonError(
      AddonErrorCodes.VALIDATION_FAILED,
      `Validation failed for field '${field}': ${errors.join(', ')}`,
      400,
      { field, value, errors }
    );
  }

  static databaseError(operation: string, error: any): AddonError {
    return new AddonError(
      AddonErrorCodes.DATABASE_ERROR,
      `Database error during ${operation}: ${error.message}`,
      500,
      { operation, originalError: error.message }
    );
  }
}

/**
 * Type guard to check if an error is an AddonError
 */
export function isAddonError(error: any): error is AddonError {
  return error instanceof AddonError;
}

/**
 * Error handler utility for consistent error formatting
 */
export class AddonErrorHandler {
  /**
   * Format error for API response
   */
  static formatForApi(error: any) {
    if (isAddonError(error)) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          details: error.details,
          timestamp: error.timestamp,
        },
      };
    }

    // Handle Prisma errors
    if (error.code === 'P2002') {
      return {
        success: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this value already exists',
          statusCode: 409,
          details: { constraint: error.meta?.target },
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (error.code === 'P2025') {
      return {
        success: false,
        error: {
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          statusCode: 400,
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Handle generic errors
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal error occurred'
            : error.message,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: any, context?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      context: context || {},
    };

    if (isAddonError(error)) {
      return {
        ...logEntry,
        ...error.toJSON(),
      };
    }

    return {
      ...logEntry,
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      originalError: error,
    };
  }
}

export default AddonError;
