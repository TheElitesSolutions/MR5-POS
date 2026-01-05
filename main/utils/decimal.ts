/**
 * Decimal utilities for mr5-POS application
 *
 * This module provides utilities for working with Decimal values for currency
 * to ensure proper handling of money calculations and prevent floating-point errors.
 */

import { Decimal as DecimalJS } from 'decimal.js';
import { logError } from '../error-handler';

export type Decimal = DecimalJS;

/**
 * Compare two Decimal values
 * @returns negative if a < b, 0 if a = b, positive if a > b
 */
export function compareDecimals(a: Decimal, b: Decimal): number {
  const decimalA = toDecimal(a);
  const decimalB = toDecimal(b);
  return decimalA.cmp(decimalB);
}

/**
 * Check if a value is a valid input for Decimal conversion
 */
export function isValidDecimalInput(
  value: unknown
): value is string | number | Decimal {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    (value instanceof Object && 'toNumber' in value) ||
    value instanceof DecimalJS
  );
}

/**
 * Convert various input types to Prisma.Decimal
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof DecimalJS) {
    return value;
  }

  if (!isValidDecimalInput(value)) {
    throw new Error(`Invalid decimal input: ${value}`);
  }

  try {
    return new DecimalJS(value.toString());
  } catch (error) {
    logError(error as Error, 'Decimal Conversion Error');
    return new DecimalJS(0);
  }
}

/**
 * Convert Prisma.Decimal to number for display/calculation where precision loss is acceptable
 * This function handles null/undefined inputs and ensures a valid number is always returned
 */
export function decimalToNumber(value: Decimal | null | undefined): number {
  if (!value) return 0;

  // Safety check for Prisma Decimal corruption cases
  if (typeof value === 'object' && 'toNumber' in value) {
    try {
      const num = value.toNumber();

      // Handle NaN/Infinity edge cases which can cause display issues
      if (!isFinite(num)) {
        logError(
          new Error(`Invalid decimal value converted to ${num}`),
          'Decimal Conversion'
        );
        return 0;
      }

      return num;
    } catch (error) {
      logError(error as Error, 'Decimal Conversion Error');
      return 0;
    }
  }

  // Handle string or number values that might be passed
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    try {
      const num = parseFloat(value);
      return isFinite(num) ? num : 0;
    } catch (error) {
      return 0;
    }
  }

  // Default case for unknown types
  return 0;
}

/**
 * Convert Prisma.Decimal to string with specified precision
 */
export function decimalToString(
  value: Decimal | null | undefined,
  precision: number = 2
): string {
  if (!value) return '0.00';

  try {
    // Convert to number first for safety, then format
    let numValue: number;

    if (typeof value === 'number') {
      numValue = value;
    } else if (typeof value === 'string') {
      numValue = parseFloat(value);
    } else if (typeof value === 'object' && value !== null) {
      // Handle Decimal objects with toNumber or valueOf methods
      if ('toNumber' in value && typeof value.toNumber === 'function') {
        numValue = value.toNumber();
      } else if ('valueOf' in value && typeof value.valueOf === 'function') {
        const rawValue = value.valueOf();
        numValue =
          typeof rawValue === 'number'
            ? rawValue
            : parseFloat(String(rawValue));
      } else {
        // Last resort - try to convert to string first, then parse
        numValue = parseFloat(String(value));
      }
    } else {
      return '0.00';
    }

    // Format the number with proper precision
    return isFinite(numValue) ? numValue.toFixed(precision) : '0.00';
  } catch (error) {
    logError(error as Error, 'Decimal String Conversion Error');
    return '0.00';
  }
}

/**
 * Add two decimal values safely
 */
export function addDecimals(a: Decimal, b: Decimal): Decimal {
  try {
    // Convert to DecimalJS if needed
    const decimalA = toDecimal(a);
    const decimalB = toDecimal(b);

    // Perform addition
    return decimalA.plus(decimalB);
  } catch (error) {
    logError(error as Error, 'Decimal Addition Error');
    return new DecimalJS(0);
  }
}

/**
 * Subtract two decimal values safely
 */
export function subtractDecimals(a: Decimal, b: Decimal): Decimal {
  try {
    // Convert to DecimalJS if needed
    const decimalA = toDecimal(a);
    const decimalB = toDecimal(b);

    // Perform subtraction
    return decimalA.minus(decimalB);
  } catch (error) {
    logError(error as Error, 'Decimal Subtraction Error');
    return new DecimalJS(0);
  }
}

/**
 * Multiply a decimal by another decimal or a number safely
 */
export function multiplyDecimals(a: Decimal, b: Decimal | number): Decimal {
  try {
    // Convert to DecimalJS if needed
    const decimalA = toDecimal(a);
    const decimalB = typeof b === 'number' ? new DecimalJS(b) : toDecimal(b);

    // Perform multiplication
    return decimalA.times(decimalB);
  } catch (error) {
    logError(error as Error, 'Decimal Multiplication Error');
    return new DecimalJS(0);
  }
}

/**
 * Divide a decimal by another decimal or a number safely
 */
export function divideDecimals(
  a: Decimal,
  b: Decimal | number,
  precision: number = 2
): Decimal {
  try {
    // Convert to DecimalJS if needed
    const decimalA = toDecimal(a);
    const decimalB = typeof b === 'number' ? new DecimalJS(b) : toDecimal(b);

    // Check for division by zero
    if (decimalB.equals(0)) {
      logError(new Error('Division by zero'), 'Decimal Division Error');
      return new DecimalJS(0);
    }

    // Perform division with specified precision
    return decimalA.dividedBy(decimalB).toDecimalPlaces(precision);
  } catch (error) {
    logError(error as Error, 'Decimal Division Error');
    return new DecimalJS(0);
  }
}

/**
 * Sum an array of decimal values safely
 */
export function sumDecimals(values: Decimal[]): Decimal {
  try {
    return values.reduce((sum, value) => {
      return addDecimals(sum, value);
    }, new DecimalJS(0));
  } catch (error) {
    logError(error as Error, 'Decimal Sum Error');
    return new DecimalJS(0);
  }
}

/**
 * Calculate average of decimal values safely
 */
export function averageDecimals(values: Decimal[]): Decimal {
  if (values.length === 0) return new DecimalJS(0);
  return divideDecimals(sumDecimals(values), values.length);
}

/**
 * Validate that a value is within acceptable range for currency
 * Handles both Decimal objects and regular numbers
 */
export function validateCurrencyAmount(
  value: any,
  min: number = 0,
  max: number = 999999.99
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  let num: number;

  try {
    if (typeof value === 'number') {
      // It's already a number
      num = value;
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value
    ) {
      // It's a Decimal object
      num = value.toNumber();
    } else if (typeof value === 'string') {
      // Try to parse string to number
      num = parseFloat(value);
      if (isNaN(num)) {
        return false;
      }
    } else {
      // Unsupported type
      return false;
    }

    return isFinite(num) && num >= min && num <= max;
  } catch (error) {
    logError(error as Error, 'Currency Validation Error');
    return false;
  }
}

/**
 * Convert JSON representation back to Decimal
 * Useful for database serialization/deserialization
 */
export function fromJSON(json: string | number): Decimal {
  try {
    return new DecimalJS(json);
  } catch (error) {
    logError(error as Error, 'Decimal JSON Conversion Error');
    return new DecimalJS(0);
  }
}

/**
 * Format a decimal as currency string with proper localization
 */
export function formatAsCurrency(
  value: Decimal | number | null | undefined,
  locale: string = 'en-US',
  currency: string = 'USD'
): string {
  try {
    const num =
      typeof value === 'object' && value && 'toNumber' in value
        ? value.toNumber()
        : typeof value === 'number'
          ? value
          : 0;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    logError(error as Error, 'Currency Formatting Error');
    return '$0.00'; // Default fallback
  }
}
