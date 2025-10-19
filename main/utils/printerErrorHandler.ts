/**
 * Enhanced Printer Error Handling and Recovery System
 *
 * This module provides comprehensive error categorization, retry logic,
 * and recovery mechanisms for thermal printer operations.
 */

import { AdvancedLogger } from './advancedLogger';

/**
 * Printer error classification interface
 */
export interface PrinterError {
  code: string;
  message: string;
  category:
    | 'CONNECTION'
    | 'DRIVER'
    | 'HARDWARE'
    | 'DATA'
    | 'TIMEOUT'
    | 'PERMISSION'
    | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestion: string;
  recoverable: boolean;
}

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Result of a retry attempt
 */
export interface RetryAttemptResult<T> {
  attempt: number;
  success: boolean;
  result?: T;
  error?: any;
  duration: number;
  timestamp: Date;
}

/**
 * Complete result of a retry operation
 */
export interface RetryOperationResult<T> {
  success: boolean;
  result?: T;
  totalAttempts: number;
  totalDuration: number;
  attempts: RetryAttemptResult<T>[];
  finalError?: PrinterError;
}

/**
 * Printer Error Handler Class
 *
 * Provides centralized error categorization and analysis
 */
export class PrinterErrorHandler {
  private static readonly ERROR_CATALOG: { [key: string]: PrinterError } = {
    PRINTER_NOT_FOUND: {
      code: 'PRINTER_NOT_FOUND',
      message: 'Specified printer was not found in the system',
      category: 'CONNECTION',
      severity: 'HIGH',
      suggestion:
        'Check printer name and ensure printer is connected and powered on',
      recoverable: true,
    },
    PRINTER_OFFLINE: {
      code: 'PRINTER_OFFLINE',
      message: 'Printer is offline or not responding',
      category: 'CONNECTION',
      severity: 'HIGH',
      suggestion:
        'Check printer connection, power status, and network connectivity',
      recoverable: true,
    },
    DRIVER_ERROR: {
      code: 'DRIVER_ERROR',
      message: 'Printer driver error or incompatibility',
      category: 'DRIVER',
      severity: 'CRITICAL',
      suggestion:
        'Update or reinstall printer drivers, ensure RONGTA drivers are properly installed',
      recoverable: false,
    },
    SPOOLER_ERROR: {
      code: 'SPOOLER_ERROR',
      message: 'Windows print spooler service error',
      category: 'SYSTEM',
      severity: 'CRITICAL',
      suggestion: 'Restart Windows print spooler service, clear print queue',
      recoverable: true,
    },
    BUFFER_GENERATION_FAILED: {
      code: 'BUFFER_GENERATION_FAILED',
      message: 'Failed to generate print buffer or format data',
      category: 'DATA',
      severity: 'MEDIUM',
      suggestion: 'Check receipt data format and try with simpler content',
      recoverable: true,
    },
    TIMEOUT_ERROR: {
      code: 'TIMEOUT_ERROR',
      message: 'Print operation timed out',
      category: 'TIMEOUT',
      severity: 'MEDIUM',
      suggestion: 'Check printer queue, increase timeout, or try again',
      recoverable: true,
    },
    PERMISSION_DENIED: {
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions to access printer',
      category: 'PERMISSION',
      severity: 'HIGH',
      suggestion:
        'Run application as administrator or check printer permissions',
      recoverable: false,
    },
    PAPER_JAM: {
      code: 'PAPER_JAM',
      message: 'Paper jam detected',
      category: 'HARDWARE',
      severity: 'MEDIUM',
      suggestion: 'Clear paper jam and ensure proper paper loading',
      recoverable: true,
    },
    NO_PAPER: {
      code: 'NO_PAPER',
      message: 'Printer is out of paper',
      category: 'HARDWARE',
      severity: 'MEDIUM',
      suggestion: 'Load paper into the printer',
      recoverable: true,
    },
    RONGTA_COMMUNICATION_ERROR: {
      code: 'RONGTA_COMMUNICATION_ERROR',
      message: 'Communication error with RONGTA printer',
      category: 'CONNECTION',
      severity: 'HIGH',
      suggestion:
        'Check USB connection, restart printer, or reinstall RONGTA drivers',
      recoverable: true,
    },
    THERMAL_PRINTER_SPECIFIC_ERROR: {
      code: 'THERMAL_PRINTER_SPECIFIC_ERROR',
      message:
        'Thermal printer specific error (overheating, print head issues)',
      category: 'HARDWARE',
      severity: 'HIGH',
      suggestion:
        'Allow printer to cool down, check thermal print head condition',
      recoverable: true,
    },
    XPS_PASS_ERROR: {
      code: 'XPS_PASS_ERROR',
      message: 'XPS_PASS datatype error for v4 printer driver',
      category: 'DRIVER',
      severity: 'HIGH',
      suggestion:
        'Switch to RAW datatype or update printer driver to v4 compatible version',
      recoverable: true,
    },
    UNKNOWN_ERROR: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred during printing',
      category: 'SYSTEM',
      severity: 'MEDIUM',
      suggestion: 'Try again, check logs for details, or contact support',
      recoverable: true,
    },
  };

  /**
   * Analyze and categorize an error for appropriate handling
   */
  static categorizeError(error: any): PrinterError {
    const errorMessage = String(error?.message || error || '').toLowerCase();
    const errorCode = error?.code || '';

    // Pattern matching for common error types
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist')
    ) {
      return this.ERROR_CATALOG['PRINTER_NOT_FOUND']!;
    }
    if (
      errorMessage.includes('offline') ||
      errorMessage.includes('not responding') ||
      errorCode === 'ECONNREFUSED'
    ) {
      return this.ERROR_CATALOG['PRINTER_OFFLINE']!;
    }
    if (
      errorMessage.includes('driver') ||
      errorMessage.includes('incompatible')
    ) {
      return this.ERROR_CATALOG['DRIVER_ERROR']!;
    }
    if (errorMessage.includes('xps') || errorMessage.includes('xps_pass')) {
      return this.ERROR_CATALOG['XPS_PASS_ERROR']!;
    }
    if (
      errorMessage.includes('spooler') ||
      errorMessage.includes('print service')
    ) {
      return this.ERROR_CATALOG['SPOOLER_ERROR']!;
    }
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorCode === 'ETIMEDOUT'
    ) {
      return this.ERROR_CATALOG['TIMEOUT_ERROR']!;
    }
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('access denied') ||
      errorCode === 'EACCES'
    ) {
      return this.ERROR_CATALOG['PERMISSION_DENIED']!;
    }
    if (errorMessage.includes('paper jam')) {
      return this.ERROR_CATALOG['PAPER_JAM']!;
    }
    if (
      errorMessage.includes('no paper') ||
      errorMessage.includes('out of paper')
    ) {
      return this.ERROR_CATALOG['NO_PAPER']!;
    }
    if (
      errorMessage.includes('buffer') ||
      errorMessage.includes('format') ||
      errorMessage.includes('generate')
    ) {
      return this.ERROR_CATALOG['BUFFER_GENERATION_FAILED']!;
    }
    if (errorMessage.includes('rongta') || errorMessage.includes('thermal')) {
      return this.ERROR_CATALOG['RONGTA_COMMUNICATION_ERROR']!;
    }
    if (
      errorMessage.includes('overheating') ||
      errorMessage.includes('print head')
    ) {
      return this.ERROR_CATALOG['THERMAL_PRINTER_SPECIFIC_ERROR']!;
    }

    return this.ERROR_CATALOG['UNKNOWN_ERROR']!;
  }

  /**
   * Get user-friendly error information
   */
  static getErrorInfo(error: any): {
    title: string;
    description: string;
    suggestion: string;
    severity: string;
    canRetry: boolean;
  } {
    const categorized = this.categorizeError(error);

    return {
      title: categorized.code
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase()),
      description: categorized.message,
      suggestion: categorized.suggestion,
      severity: categorized.severity,
      canRetry: categorized.recoverable,
    };
  }
}

/**
 * Retry Manager Class
 *
 * Provides intelligent retry logic with exponential backoff
 */
export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 8000, // 8 seconds
    backoffMultiplier: 2,
  };

  /**
   * Execute an operation with retry logic and exponential backoff
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    useLogging: boolean = true,
    operationName?: string
  ): Promise<RetryOperationResult<T>> {
    const finalConfig: RetryConfig = { ...this.DEFAULT_CONFIG, ...config };
    const attempts: RetryAttemptResult<T>[] = [];
    const startTime = Date.now();

    if (useLogging && operationName) {
      AdvancedLogger.info(`Starting retry operation: ${operationName}`, {
        maxAttempts: finalConfig.maxAttempts,
        initialDelay: finalConfig.initialDelay,
      });
    }

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await operation();
        const duration = Date.now() - attemptStart;

        const attemptResult: RetryAttemptResult<T> = {
          attempt,
          success: true,
          result,
          duration,
          timestamp: new Date(attemptStart),
        };

        attempts.push(attemptResult);

        if (attempt > 1 && useLogging) {
          AdvancedLogger.info(
            `Operation succeeded on attempt ${attempt}/${finalConfig.maxAttempts}`
          );
        }

        return {
          success: true,
          result,
          totalAttempts: attempt,
          totalDuration: Date.now() - startTime,
          attempts,
        };
      } catch (error) {
        const duration = Date.now() - attemptStart;
        const errorInfo = PrinterErrorHandler.categorizeError(error);

        const attemptResult: RetryAttemptResult<T> = {
          attempt,
          success: false,
          error: errorInfo,
          duration,
          timestamp: new Date(attemptStart),
        };

        attempts.push(attemptResult);

        if (useLogging) {
          AdvancedLogger.warn(
            `Attempt ${attempt}/${finalConfig.maxAttempts} failed: ${errorInfo.message}`,
            {
              errorCode: errorInfo.code,
              category: errorInfo.category,
              recoverable: errorInfo.recoverable,
            }
          );
        }

        // Don't retry if error is not recoverable
        if (!errorInfo.recoverable) {
          if (useLogging) {
            AdvancedLogger.error(
              `Non-recoverable error encountered: ${errorInfo.code}`
            );
          }

          return {
            success: false,
            totalAttempts: attempt,
            totalDuration: Date.now() - startTime,
            attempts,
            finalError: errorInfo,
          };
        }

        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          if (useLogging) {
            AdvancedLogger.error(
              `All retry attempts exhausted for operation: ${operationName || 'unknown'}`
            );
          }

          return {
            success: false,
            totalAttempts: attempt,
            totalDuration: Date.now() - startTime,
            attempts,
            finalError: errorInfo,
          };
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay =
          finalConfig.initialDelay *
          Math.pow(finalConfig.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
        const delay = Math.min(baseDelay + jitter, finalConfig.maxDelay);

        if (useLogging) {
          AdvancedLogger.info(`Waiting ${Math.round(delay)}ms before retry...`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry logic');
  }

  /**
   * Quick retry for simple operations
   */
  static async quickRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 2,
    delay: number = 500
  ): Promise<T> {
    const result = await this.executeWithRetry(
      operation,
      {
        maxAttempts,
        initialDelay: delay,
        maxDelay: delay,
        backoffMultiplier: 1,
      },
      false
    );

    if (result.success && result.result !== undefined) {
      return result.result;
    }

    throw result.finalError || new Error('Operation failed after retries');
  }
}

/**
 * Printer Health Monitor
 *
 * Tracks printer status and provides health insights
 */
export class PrinterHealthMonitor {
  private static printerStats: Map<
    string,
    {
      successCount: number;
      failureCount: number;
      lastSuccess: Date | null;
      lastFailure: Date | null;
      averageResponseTime: number;
      commonErrors: string[];
    }
  > = new Map();

  /**
   * Record a successful print operation
   */
  static recordSuccess(printerName: string, responseTime: number): void {
    const stats = this.getOrCreateStats(printerName);
    stats.successCount++;
    stats.lastSuccess = new Date();
    stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
    this.printerStats.set(printerName, stats);
  }

  /**
   * Record a failed print operation
   */
  static recordFailure(printerName: string, error: PrinterError): void {
    const stats = this.getOrCreateStats(printerName);
    stats.failureCount++;
    stats.lastFailure = new Date();
    stats.commonErrors.push(error.code);

    // Keep only last 10 errors
    if (stats.commonErrors.length > 10) {
      stats.commonErrors.shift();
    }

    this.printerStats.set(printerName, stats);
  }

  /**
   * Get printer health status
   */
  static getHealthStatus(printerName: string): {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
    successRate: number;
    lastSuccessAge: number | null;
    mostCommonError: string | null;
    recommendation: string;
  } {
    const stats = this.printerStats.get(printerName);

    if (!stats) {
      return {
        status: 'UNKNOWN',
        successRate: 0,
        lastSuccessAge: null,
        mostCommonError: null,
        recommendation: 'No data available - try printing a test page',
      };
    }

    const totalOperations = stats.successCount + stats.failureCount;
    const successRate =
      totalOperations > 0 ? (stats.successCount / totalOperations) * 100 : 0;
    const lastSuccessAge = stats.lastSuccess
      ? Date.now() - stats.lastSuccess.getTime()
      : null;

    // Find most common error
    const errorCounts = stats.commonErrors.reduce(
      (acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const mostCommonError =
      Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
    let recommendation: string;

    if (successRate >= 95) {
      status = 'HEALTHY';
      recommendation = 'Printer is operating normally';
    } else if (successRate >= 80) {
      status = 'DEGRADED';
      recommendation =
        'Printer has some issues but is functional. Monitor closely.';
    } else if (successRate >= 50) {
      status = 'UNHEALTHY';
      recommendation =
        'Printer has significant issues. Check connection and drivers.';
    } else {
      status = 'UNHEALTHY';
      recommendation =
        'Printer is not functioning properly. Troubleshooting required.';
    }

    return {
      status,
      successRate,
      lastSuccessAge,
      mostCommonError,
      recommendation,
    };
  }

  private static getOrCreateStats(printerName: string) {
    if (!this.printerStats.has(printerName)) {
      this.printerStats.set(printerName, {
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        lastFailure: null,
        averageResponseTime: 0,
        commonErrors: [],
      });
    }
    return this.printerStats.get(printerName)!;
  }
}
