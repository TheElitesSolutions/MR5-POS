/**
 * Retry utilities for robust IPC communication
 */
/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    initialDelay: 300,
    maxDelay: 3000,
    factor: 2,
    jitter: true,
    retryableErrors: [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'ERR_IPC_CHANNEL_CLOSED',
        'ERR_IPC_CONNECTION_CLOSED',
        /network error/i,
        /timeout/i,
        /connection.*refused/i,
        /socket.*hang.*/i,
    ],
    onRetry: (error, attempt) => {
        console.warn(`Retrying operation after error (attempt ${attempt}):`, error.message);
    },
};
/**
 * Calculate delay for exponential backoff with optional jitter
 *
 * @param attempt Current attempt number
 * @param options Retry options
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt, options) {
    // Calculate exponential backoff
    let delay = options.initialDelay * Math.pow(options.factor, attempt - 1);
    // Apply maximum delay
    delay = Math.min(delay, options.maxDelay);
    // Add jitter if enabled
    if (options.jitter) {
        delay = delay * (0.5 + Math.random() / 2);
    }
    return delay;
}
/**
 * Check if an error is retryable
 *
 * @param error The error to check
 * @param retryableErrors Array of error messages or RegExp to match
 * @returns True if the error is retryable
 */
function isRetryableError(error, retryableErrors) {
    if (!error)
        return false;
    const errorMessage = error.message || '';
    const errorName = error.name || '';
    const errorCode = error.code || '';
    return retryableErrors.some(pattern => {
        if (typeof pattern === 'string') {
            return (errorCode === pattern ||
                errorName === pattern ||
                errorMessage.includes(pattern));
        }
        else if (pattern instanceof RegExp) {
            return (pattern.test(errorMessage) ||
                pattern.test(errorName) ||
                pattern.test(errorCode));
        }
        return false;
    });
}
/**
 * Execute a function with retry logic on failure
 *
 * @param fn The function to execute with retry
 * @param options Retry options
 * @returns Result of the function
 */
export async function retry(fn, options = {}) {
    // Merge options with defaults
    const mergedOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        ...options,
    };
    let lastError;
    let attempt = 1;
    while (attempt <= mergedOptions.maxAttempts) {
        try {
            // Attempt the operation
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if we've reached max attempts
            if (attempt >= mergedOptions.maxAttempts) {
                break;
            }
            // Check if error is retryable
            if (!isRetryableError(lastError, mergedOptions.retryableErrors)) {
                throw lastError;
            }
            // Calculate delay for next retry
            const delay = calculateDelay(attempt, mergedOptions);
            // Call onRetry callback if provided
            if (mergedOptions.onRetry) {
                mergedOptions.onRetry(lastError, attempt);
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            // Increment attempt counter
            attempt++;
        }
    }
    // If we get here, all retries failed
    throw lastError;
}
export default retry;
