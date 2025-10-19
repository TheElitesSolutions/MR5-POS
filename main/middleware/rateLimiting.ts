// Rate Limiting Middleware for Main Process IPC
import { IpcMainInvokeEvent } from 'electron';
import { logDebug, logWarning } from '../error-handler';

/**
 * Rate limiting middleware for IPC calls
 * Prevents abuse and ensures system stability
 */
class RateLimitingMiddleware {
  private requestCounts: Map<string, { count: number; resetTime: number }> =
    new Map();
  private readonly defaultLimit: number = 100; // requests per minute
  private readonly defaultWindow: number = 60 * 1000; // 1 minute in milliseconds

  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Create a rate limiter for specific IPC channels
   */
  public createLimiter(
    options: {
      limit?: number;
      windowMs?: number;
      skipSuccessfulRequests?: boolean;
    } = {}
  ) {
    const limit = options.limit || this.defaultLimit;
    const windowMs = options.windowMs || this.defaultWindow;

    return (event: IpcMainInvokeEvent, channel: string): boolean => {
      const identifier = this.getIdentifier(event, channel);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.requestCounts.get(identifier);

      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired one
        entry = {
          count: 0,
          resetTime: now + windowMs,
        };
        this.requestCounts.set(identifier, entry);
      }

      // Increment request count
      entry.count++;

      // Check if limit exceeded
      if (entry.count > limit) {
        logWarning(
          `Rate limit exceeded for ${identifier}. Count: ${entry.count}/${limit}`,
          'RateLimitingMiddleware'
        );
        return false;
      }

      // Log debug info for high usage
      if (entry.count > limit * 0.8) {
        logDebug(
          `High usage detected for ${identifier}. Count: ${entry.count}/${limit}`,
          'RateLimitingMiddleware'
        );
      }

      return true;
    };
  }

  /**
   * Get a unique identifier for the request
   */
  private getIdentifier(event: IpcMainInvokeEvent, channel: string): string {
    // For desktop apps, we use the channel as the primary identifier
    // In a multi-user scenario, you might want to include user ID
    return `${channel}:${event.sender.id}`;
  }

  /**
   * Create a burst limiter (higher limit for short duration)
   */
  public createBurstLimiter(
    options: {
      burstLimit?: number;
      burstWindowMs?: number;
      sustainedLimit?: number;
      sustainedWindowMs?: number;
    } = {}
  ) {
    const burstLimit = options.burstLimit || 20;
    const burstWindowMs = options.burstWindowMs || 10 * 1000; // 10 seconds
    const sustainedLimit = options.sustainedLimit || 100;
    const sustainedWindowMs = options.sustainedWindowMs || 60 * 1000; // 1 minute

    return (event: IpcMainInvokeEvent, channel: string): boolean => {
      const identifier = this.getIdentifier(event, channel);
      const now = Date.now();

      // Check burst limit
      const burstKey = `${identifier}:burst`;
      let burstEntry = this.requestCounts.get(burstKey);

      if (!burstEntry || now > burstEntry.resetTime) {
        burstEntry = {
          count: 0,
          resetTime: now + burstWindowMs,
        };
        this.requestCounts.set(burstKey, burstEntry);
      }

      burstEntry.count++;

      if (burstEntry.count > burstLimit) {
        logWarning(
          `Burst rate limit exceeded for ${identifier}. Count: ${burstEntry.count}/${burstLimit}`,
          'RateLimitingMiddleware'
        );
        return false;
      }

      // Check sustained limit
      const sustainedKey = `${identifier}:sustained`;
      let sustainedEntry = this.requestCounts.get(sustainedKey);

      if (!sustainedEntry || now > sustainedEntry.resetTime) {
        sustainedEntry = {
          count: 0,
          resetTime: now + sustainedWindowMs,
        };
        this.requestCounts.set(sustainedKey, sustainedEntry);
      }

      sustainedEntry.count++;

      if (sustainedEntry.count > sustainedLimit) {
        logWarning(
          `Sustained rate limit exceeded for ${identifier}. Count: ${sustainedEntry.count}/${sustainedLimit}`,
          'RateLimitingMiddleware'
        );
        return false;
      }

      return true;
    };
  }

  /**
   * Create a priority limiter (different limits based on operation type)
   */
  public createPriorityLimiter(priorityConfig: {
    high?: { limit: number; windowMs: number };
    medium?: { limit: number; windowMs: number };
    low?: { limit: number; windowMs: number };
  }) {
    const config = {
      high: priorityConfig.high || { limit: 200, windowMs: 60 * 1000 },
      medium: priorityConfig.medium || { limit: 100, windowMs: 60 * 1000 },
      low: priorityConfig.low || { limit: 50, windowMs: 60 * 1000 },
    };

    return (
      event: IpcMainInvokeEvent,
      channel: string,
      priority: 'high' | 'medium' | 'low' = 'medium'
    ): boolean => {
      const { limit, windowMs } = config[priority];
      const identifier = `${this.getIdentifier(event, channel)}:${priority}`;
      const now = Date.now();

      let entry = this.requestCounts.get(identifier);

      if (!entry || now > entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + windowMs,
        };
        this.requestCounts.set(identifier, entry);
      }

      entry.count++;

      if (entry.count > limit) {
        logWarning(
          `Priority rate limit (${priority}) exceeded for ${identifier}. Count: ${entry.count}/${limit}`,
          'RateLimitingMiddleware'
        );
        return false;
      }

      return true;
    };
  }

  /**
   * Get current rate limit status for debugging
   */
  public getStatus(
    event: IpcMainInvokeEvent,
    channel: string
  ): {
    identifier: string;
    currentCount: number;
    resetTime: number;
    timeToReset: number;
  } | null {
    const identifier = this.getIdentifier(event, channel);
    const entry = this.requestCounts.get(identifier);

    if (!entry) {
      return null;
    }

    return {
      identifier,
      currentCount: entry.count,
      resetTime: entry.resetTime,
      timeToReset: Math.max(0, entry.resetTime - Date.now()),
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Array.from(this.requestCounts.entries())) {
      if (now > entry.resetTime) {
        this.requestCounts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logDebug(
        `Cleaned up ${cleaned} expired rate limit entries`,
        'RateLimitingMiddleware'
      );
    }
  }

  /**
   * Reset rate limits for a specific identifier
   */
  public resetLimits(event: IpcMainInvokeEvent, channel: string): void {
    const identifier = this.getIdentifier(event, channel);

    // Remove all entries for this identifier
    for (const key of Array.from(this.requestCounts.keys())) {
      if (key.startsWith(identifier)) {
        this.requestCounts.delete(key);
      }
    }

    logDebug(`Reset rate limits for ${identifier}`, 'RateLimitingMiddleware');
  }

  /**
   * Get statistics about rate limiting
   */
  public getStatistics(): {
    totalTrackedIdentifiers: number;
    totalActiveWindows: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let activeWindows = 0;

    for (const entry of Array.from(this.requestCounts.values())) {
      if (now <= entry.resetTime) {
        activeWindows++;
      }
    }

    return {
      totalTrackedIdentifiers: this.requestCounts.size,
      totalActiveWindows: activeWindows,
      memoryUsage: this.requestCounts.size * 64, // Rough estimate in bytes
    };
  }
}

// Export singleton instance
export const rateLimitingMiddleware = new RateLimitingMiddleware();
export default rateLimitingMiddleware;
