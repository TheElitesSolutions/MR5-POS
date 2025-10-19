/**
 * Retry Utility for mr5-POS
 * 
 * This module provides a generic retry mechanism with exponential backoff
 * and configurable retry policies for handling transient failures.
 */

import { RetryConfig, RetryAttemptResult, RetryOperationResult } from '../types/printer-types';
import { AdvancedLogger } from '../../utils/advancedLogger';

// Retry utility class with exponential backoff
export class RetryUtility {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryableErrors: [
      'timeout',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'network',
      'connection',
      'temporary',
      'busy',
      'unavailable',
    ],
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
        baseDelay: finalConfig.baseDelayMs,
      });
    }

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();

      try {
        const data = await operation();
        const attemptResult: RetryAttemptResult<T> = {
          success: true,
          data,
          attemptNumber: attempt,
          delayMs: 0,
          totalElapsedMs: Date.now() - attemptStartTime,
        };

        attempts.push(attemptResult);

        if (useLogging && operationName) {
          AdvancedLogger.info(
            `Retry operation succeeded on attempt ${attempt}: ${operationName}`
          );
        }

        return {
          success: true,
          data,
          attempts,
          totalAttempts: attempt,
          totalElapsedMs: Date.now() - startTime,
        };
      } catch (error) {
        const attemptResult: RetryAttemptResult<T> = {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          attemptNumber: attempt,
          delayMs: 0,
          totalElapsedMs: Date.now() - attemptStartTime,
        };

        attempts.push(attemptResult);

        // Check if this is the last attempt
        if (attempt === finalConfig.maxAttempts) {
          if (useLogging && operationName) {
            AdvancedLogger.error(
              `Retry operation failed after ${attempt} attempts: ${operationName}`,
              error
            );
          }

          return {
            success: false,
            finalError:
              error instanceof Error ? error : new Error(String(error)),
            attempts,
            totalAttempts: attempt,
            totalElapsedMs: Date.now() - startTime,
          };
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, finalConfig.retryableErrors)) {
          if (useLogging && operationName) {
            AdvancedLogger.warn(
              `Non-retryable error encountered, stopping retry: ${operationName}`,
              error
            );
          }

          return {
            success: false,
            finalError:
              error instanceof Error ? error : new Error(String(error)),
            attempts,
            totalAttempts: attempt,
            totalElapsedMs: Date.now() - startTime,
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, finalConfig);
        attemptResult.delayMs = delay;

        if (useLogging && operationName) {
          AdvancedLogger.warn(
            `Retry operation failed on attempt ${attempt}, retrying in ${delay}ms: ${operationName}`,
            error
          );
        }

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // This should never be reached, but just in case
    return {
      success: false,
      finalError: new Error('Unexpected retry loop completion'),
      attempts,
      totalAttempts: finalConfig.maxAttempts,
      totalElapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private static isRetryableError(
    error: unknown,
    retryableErrors: string[]
  ): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : '';

    // Check for specific error patterns
    return retryableErrors.some(
      pattern =>
        errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
        errorType.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(
    attemptNumber: number,
    config: RetryConfig
  ): number {
    // Calculate exponential backoff
    const exponentialDelay =
      config.baseDelayMs *
      Math.pow(config.backoffMultiplier, attemptNumber - 1);

    // Cap at maximum delay
    let delay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter if enabled (randomize ±25% of calculated delay)
    if (config.jitterEnabled) {
      const jitterFactor = 0.25;
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
      delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
  }

  /**
   * Sleep utility for delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry configuration for specific printer operations
   */
  static createPrinterConfig(
    operation: 'detection' | 'validation' | 'connection'
  ): RetryConfig {
    const baseConfig = { ...this.DEFAULT_CONFIG };

    switch (operation) {
      case 'detection':
        return {
          ...baseConfig,
          maxAttempts: 2,
          baseDelayMs: 500,
          maxDelayMs: 5000,
          retryableErrors: ['timeout', 'ETIMEDOUT', 'temporary', 'busy'],
        };

      case 'validation':
        return {
          ...baseConfig,
          maxAttempts: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          retryableErrors: [
            'timeout',
            'ETIMEDOUT',
            'busy',
            'unavailable',
            'connection',
          ],
        };

      case 'connection':
        return {
          ...baseConfig,
          maxAttempts: 4,
          baseDelayMs: 2000,
          maxDelayMs: 15000,
          retryableErrors: [
            'ECONNREFUSED',
            'network',
            'connection',
            'timeout',
            'busy',
          ],
        };

      default:
        return baseConfig;
    }
  }
} 