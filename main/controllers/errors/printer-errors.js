/**
 * Printer Error Classes for mr5-POS
 *
 * This module contains all custom error classes used throughout
 * the printer system for better error handling and debugging.
 */
// Enhanced error classes for printer operations
export class PrinterDetectionError extends Error {
    constructor(message, originalError, context) {
        super(message);
        this.originalError = originalError;
        this.context = context;
        this.name = 'PrinterDetectionError';
    }
}
export class PrinterValidationError extends Error {
    constructor(message, printerName, originalError, context) {
        super(message);
        this.printerName = printerName;
        this.originalError = originalError;
        this.context = context;
        this.name = 'PrinterValidationError';
    }
}
export class PrinterConnectionError extends Error {
    constructor(message, printerName, connectionType, attemptCount, originalError, context) {
        super(message);
        this.printerName = printerName;
        this.connectionType = connectionType;
        this.attemptCount = attemptCount;
        this.originalError = originalError;
        this.context = context;
        this.name = 'PrinterConnectionError';
    }
}
export class PrinterTimeoutError extends Error {
    constructor(message, printerName, timeoutMs, operation, originalError, context) {
        super(message);
        this.printerName = printerName;
        this.timeoutMs = timeoutMs;
        this.operation = operation;
        this.originalError = originalError;
        this.context = context;
        this.name = 'PrinterTimeoutError';
    }
}
export class PrinterConfigurationError extends Error {
    constructor(message, printerName, configIssue, suggestedFix, originalError, context) {
        super(message);
        this.printerName = printerName;
        this.configIssue = configIssue;
        this.suggestedFix = suggestedFix;
        this.originalError = originalError;
        this.context = context;
        this.name = 'PrinterConfigurationError';
    }
}
// Error aggregation utility for multiple printer operations
export class PrinterOperationError extends Error {
    constructor(message, operation, errors, successCount, totalCount, context) {
        super(message);
        this.operation = operation;
        this.errors = errors;
        this.successCount = successCount;
        this.totalCount = totalCount;
        this.context = context;
        this.name = 'PrinterOperationError';
    }
    // Get summary of error types
    getErrorSummary() {
        const summary = {};
        this.errors.forEach(error => {
            const errorType = error.constructor.name;
            summary[errorType] = (summary[errorType] || 0) + 1;
        });
        return summary;
    }
    // Check if operation partially succeeded
    hasPartialSuccess() {
        return this.successCount > 0 && this.successCount < this.totalCount;
    }
}
