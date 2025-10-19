/**
 * Printer Error Classes for mr5-POS
 * 
 * This module contains all custom error classes used throughout
 * the printer system for better error handling and debugging.
 */

// Enhanced error classes for printer operations
export class PrinterDetectionError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterDetectionError';
  }
}

export class PrinterValidationError extends Error {
  constructor(
    message: string,
    public readonly printerName?: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterValidationError';
  }
}

export class PrinterConnectionError extends Error {
  constructor(
    message: string,
    public readonly printerName?: string,
    public readonly connectionType?: string,
    public readonly attemptCount?: number,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterConnectionError';
  }
}

export class PrinterTimeoutError extends Error {
  constructor(
    message: string,
    public readonly printerName?: string,
    public readonly timeoutMs?: number,
    public readonly operation?: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterTimeoutError';
  }
}

export class PrinterConfigurationError extends Error {
  constructor(
    message: string,
    public readonly printerName?: string,
    public readonly configIssue?: string,
    public readonly suggestedFix?: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterConfigurationError';
  }
}

// Error aggregation utility for multiple printer operations
export class PrinterOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly errors: Error[],
    public readonly successCount: number,
    public readonly totalCount: number,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PrinterOperationError';
  }

  // Get summary of error types
  getErrorSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    this.errors.forEach(error => {
      const errorType = error.constructor.name;
      summary[errorType] = (summary[errorType] || 0) + 1;
    });
    return summary;
  }

  // Check if operation partially succeeded
  hasPartialSuccess(): boolean {
    return this.successCount > 0 && this.successCount < this.totalCount;
  }
} 