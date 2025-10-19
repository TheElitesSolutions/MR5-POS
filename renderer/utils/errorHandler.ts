/**
 * Error handling utility
 *
 * Provides consistent error handling functions for the application
 */

import * as React from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';

// Different error severity levels
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Error source categories
export enum ErrorSource {
  API = 'api',
  VALIDATION = 'validation',
  AUTH = 'auth',
  NETWORK = 'network',
  DATABASE = 'database',
  UNKNOWN = 'unknown',
}

// Error details interface
export interface ErrorDetails {
  message: string;
  severity?: ErrorSeverity;
  source?: ErrorSource;
  fieldErrors?: Record<string, string>;
  originalError?: unknown;
  retry?: () => Promise<any>;
}

/**
 * Handle errors consistently throughout the application
 *
 * @param error The error to handle
 * @param context Additional context about where the error occurred
 * @param defaultMessage Default message to show if the error doesn't have one
 * @param options Additional options for error handling
 */
export function handleError(
  error: unknown,
  context: string,
  defaultMessage: string,
  options: {
    showToast?: boolean;
    severity?: ErrorSeverity;
    retry?: () => Promise<any>;
    logToConsole?: boolean;
  } = {}
): ErrorDetails {
  const {
    showToast = true,
    severity = ErrorSeverity.ERROR,
    retry,
    logToConsole = true,
  } = options;

  // Extract appropriate error message
  let message = defaultMessage;
  let source = ErrorSource.UNKNOWN;
  let fieldErrors: Record<string, string> | undefined = undefined;

  // Try to extract structured information from different error types
  if (error instanceof Error) {
    message = error.message || defaultMessage;
    // Check for special error types
    if (
      'validationErrors' in error &&
      typeof (error as any).validationErrors === 'object'
    ) {
      source = ErrorSource.VALIDATION;
      fieldErrors = (error as any).validationErrors;
    } else if (error.name === 'AuthError') {
      source = ErrorSource.AUTH;
    } else if (error.name === 'NetworkError' || error.name === 'AbortError') {
      source = ErrorSource.NETWORK;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as any).message === 'string') {
      message = (error as any).message;
    }
    if ('errors' in error && typeof (error as any).errors === 'object') {
      fieldErrors = (error as any).errors;
      source = ErrorSource.VALIDATION;
    }
  }

  // Log the error to console
  if (logToConsole) {
    console.error(`[${context}] ${message}`, error);
  }

  // Show toast notification
  if (showToast) {
    const variant =
      severity === ErrorSeverity.INFO || severity === ErrorSeverity.WARNING
        ? 'default'
        : 'destructive';

    toast({
      title: context,
      description: message,
      variant,
      action: retry
        ? (React.createElement(
            ToastAction,
            { altText: 'Retry', onClick: () => retry() },
            'Retry'
          ) as unknown as ToastActionElement)
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
export async function tryCatch<T>(
  operation: () => Promise<T>,
  context: string,
  errorMessage: string,
  options: {
    showToast?: boolean;
    severity?: ErrorSeverity;
    rethrow?: boolean;
  } = {}
): Promise<T | undefined> {
  const {
    showToast = true,
    severity = ErrorSeverity.ERROR,
    rethrow = true,
  } = options;

  try {
    return await operation();
  } catch (error) {
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
