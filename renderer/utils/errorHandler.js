/**
 * Error handling utility
 *
 * Provides consistent error handling functions for the application
 */
import * as React from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
// Different error severity levels
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
// Error source categories
export var ErrorSource;
(function (ErrorSource) {
    ErrorSource["API"] = "api";
    ErrorSource["VALIDATION"] = "validation";
    ErrorSource["AUTH"] = "auth";
    ErrorSource["NETWORK"] = "network";
    ErrorSource["DATABASE"] = "database";
    ErrorSource["UNKNOWN"] = "unknown";
})(ErrorSource || (ErrorSource = {}));
/**
 * Handle errors consistently throughout the application
 *
 * @param error The error to handle
 * @param context Additional context about where the error occurred
 * @param defaultMessage Default message to show if the error doesn't have one
 * @param options Additional options for error handling
 */
export function handleError(error, context, defaultMessage, options = {}) {
    const { showToast = true, severity = ErrorSeverity.ERROR, retry, logToConsole = true, } = options;
    // Extract appropriate error message
    let message = defaultMessage;
    let source = ErrorSource.UNKNOWN;
    let fieldErrors = undefined;
    // Try to extract structured information from different error types
    if (error instanceof Error) {
        message = error.message || defaultMessage;
        // Check for special error types
        if ('validationErrors' in error &&
            typeof error.validationErrors === 'object') {
            source = ErrorSource.VALIDATION;
            fieldErrors = error.validationErrors;
        }
        else if (error.name === 'AuthError') {
            source = ErrorSource.AUTH;
        }
        else if (error.name === 'NetworkError' || error.name === 'AbortError') {
            source = ErrorSource.NETWORK;
        }
    }
    else if (typeof error === 'string') {
        message = error;
    }
    else if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
            message = error.message;
        }
        if ('errors' in error && typeof error.errors === 'object') {
            fieldErrors = error.errors;
            source = ErrorSource.VALIDATION;
        }
    }
    // Log the error to console
    if (logToConsole) {
        console.error(`[${context}] ${message}`, error);
    }
    // Show toast notification
    if (showToast) {
        const variant = severity === ErrorSeverity.INFO || severity === ErrorSeverity.WARNING
            ? 'default'
            : 'destructive';
        toast({
            title: context,
            description: message,
            variant,
            action: retry
                ? React.createElement(ToastAction, { altText: 'Retry', onClick: () => retry() }, 'Retry')
                : undefined,
        });
    }
    // Return structured error details
    return {
        message,
        severity,
        source,
        fieldErrors,
        originalError: error,
        retry,
    };
}
/**
 * Try to execute an operation with proper error handling
 *
 * @param operation The async operation to attempt
 * @param context The context/title for error messages
 * @param errorMessage Default error message
 * @param options Additional options
 * @returns The result of the operation if successful
 * @throws The original error if the operation fails
 */
export async function tryCatch(operation, context, errorMessage, options = {}) {
    const { showToast = true, severity = ErrorSeverity.ERROR, rethrow = true, } = options;
    try {
        return await operation();
    }
    catch (error) {
        handleError(error, context, errorMessage, { showToast, severity });
        if (rethrow) {
            throw error;
        }
        return undefined;
    }
}
export default {
    handleError,
    tryCatch,
    ErrorSeverity,
    ErrorSource,
};
