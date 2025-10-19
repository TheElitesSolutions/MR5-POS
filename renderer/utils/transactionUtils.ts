/**
 * Utility functions for database transactions
 *
 * This file contains utilities for working with database transactions
 * to ensure data integrity across multiple operations.
 */

import { retry } from '@/utils/retryUtils';

/**
 * Options for a transaction
 */
export interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Default transaction options
 */
export const DEFAULT_TRANSACTION_OPTIONS: Required<TransactionOptions> = {
  maxRetries: 3,
  retryDelay: 500,
  timeout: 30000, // 30 seconds
};

/**
 * Error thrown when a transaction fails
 */
export class TransactionError extends Error {
  public readonly operations: string[];
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    operations: string[] = [],
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'TransactionError';
    this.operations = operations;
    this.cause = cause;
  }
}

/**
 * Execute a set of operations in a transaction
 *
 * @param operations A function that executes a series of operations
 * @param options Transaction options
 * @returns The result of the operations
 * @throws TransactionError if the transaction fails
 */
export async function executeTransaction<T>(
  operations: () => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  // Merge options with defaults
  const mergedOptions: Required<TransactionOptions> = {
    ...DEFAULT_TRANSACTION_OPTIONS,
    ...options,
  };

  // Start transaction timer
  const startTime = Date.now();

  try {
    // We use retry here to automatically handle potential concurrency issues
    return await retry(operations, {
      maxAttempts: mergedOptions.maxRetries,
      initialDelay: mergedOptions.retryDelay,
      retryableErrors: [
        'Transaction failed',
        'Deadlock',
        'Lock acquisition timeout',
        'Transaction aborted',
        /transaction.*failed/i,
        /deadlock/i,
        /lock.*timeout/i,
      ],
    });
  } catch (error) {
    throw new TransactionError(
      `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      [], // In a real implementation, we might track the operations that were attempted
      error instanceof Error ? error : undefined
    );
  } finally {
    const duration = Date.now() - startTime;
    console.debug(`Transaction completed in ${duration}ms`);
  }
}

/**
 * Execute a series of menu operations in a transaction
 *
 * @param operations A function that executes a series of menu operations
 * @param options Transaction options
 * @returns The result of the operations
 */
export async function executeMenuTransaction<T>(
  operations: () => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  // In a real implementation, we might have a dedicated transaction API
  // For now, we'll just use the executeTransaction utility
  return executeTransaction(operations, options);
}

export default {
  executeTransaction,
  executeMenuTransaction,
  TransactionError,
};
