/**
 * Request Manager - Core Infrastructure for Request Deduplication and Caching
 *
 * This class provides:
 * 1. Request deduplication - prevents multiple identical API calls
 * 2. Smart caching with TTL (Time To Live) management
 * 3. Cache invalidation patterns for data freshness
 * 4. Event-driven cache updates and subscriptions
 * 5. Request analytics and monitoring
 *
 * Now with enhanced deduplication via RequestManagerConfig
 */

import { REQUEST_MANAGER_CONFIG } from './RequestManagerConfig';

export interface RequestOptions {
  ttl?: number; // Time to live in milliseconds
  force?: boolean; // Force refresh ignoring cache
  retries?: number; // Number of retry attempts
  timeout?: number; // Request timeout in milliseconds
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface RequestMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  duplicatesBlocked: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

export type CacheInvalidationPattern = string | RegExp;
export type CacheUpdateListener = (key: string, data: any) => void;

export class RequestManager {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<any>>();
  private metrics = new Map<string, RequestMetrics>();
  private listeners = new Map<string, Set<CacheUpdateListener>>();

  // Track recent requests for global deduplication across components
  private recentRequests = new Map<string, number>();

  // Default options
  private defaultOptions: RequestOptions = {
    ttl: 5 * 60 * 1000, // 5 minutes default TTL
    force: false,
    retries: 3,
    timeout: 30000, // 30 seconds timeout
  };

  constructor() {
    // Start cache cleanup interval
    this.startCacheCleanup();
  }

  /**
   * Execute a request with deduplication and caching
   */
  async execute<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // Check cache first (unless force refresh)
      if (!opts.force && this.isCacheValid(key, opts.ttl!)) {
        this.updateMetrics(key, Date.now() - startTime, true);
        console.log(`🎯 RequestManager: Cache HIT for ${key}`);
        return this.cache.get(key)!.data;
      }

      // ENHANCED: Check for pending requests or recent identical requests (global deduplication)
      if (this.pendingRequests.has(key)) {
        this.updateMetrics(key, 0, false, true); // Duplicate blocked
        console.log(`🚫 RequestManager: Blocked duplicate request for ${key}`);
        return await this.pendingRequests.get(key)!;
      }

      // STRICT MODE: Check if this exact request was made very recently across ANY component
      if (REQUEST_MANAGER_CONFIG.STRICT_DEDUPLICATION) {
        const lastRequestTime = this.recentRequests.get(key);
        if (
          lastRequestTime &&
          Date.now() - lastRequestTime <
            REQUEST_MANAGER_CONFIG.DUPLICATE_REQUEST_THROTTLE
        ) {
          this.updateMetrics(key, 0, false, true); // Duplicate blocked
          console.log(
            `🔒 RequestManager: Blocked cross-component duplicate request for ${key}`
          );

          if (this.isCacheValid(key, opts.ttl!)) {
            return this.cache.get(key)!.data;
          }

          // Wait for any pending request to complete
          if (this.pendingRequests.has(key)) {
            return await this.pendingRequests.get(key)!;
          }
        }
      }

      // Execute new request
      console.log(`🔥 RequestManager: Executing fresh request for ${key}`);
      const promise = this.executeWithRetry(fetcher, opts);
      this.pendingRequests.set(key, promise);

      try {
        const result = await promise;

        // Cache the result
        this.setCacheEntry(key, result, opts.ttl!);

        // Track this request for global deduplication
        this.recentRequests.set(key, Date.now());

        // Notify listeners
        this.notifyListeners(key, result);

        // Update metrics
        this.updateMetrics(key, Date.now() - startTime, false);

        // Log differently based on config
        if (REQUEST_MANAGER_CONFIG.DEBUG_MODE) {
          console.log(`✅ RequestManager: Request completed for ${key}`);
        }

        return result;
      } finally {
        this.pendingRequests.delete(key);

        // Auto-cleanup recent requests after throttle period
        setTimeout(() => {
          if (this.recentRequests.get(key) === Date.now()) {
            this.recentRequests.delete(key);
          }
        }, REQUEST_MANAGER_CONFIG.DUPLICATE_REQUEST_THROTTLE * 2);
      }
    } catch (error) {
      console.error(`❌ RequestManager: Request failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    fetcher: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.retries!; attempt++) {
      try {
        // Add timeout to the request
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Request timeout')),
            options.timeout
          );
        });

        const result = await Promise.race([fetcher(), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < options.retries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.warn(
            `⚠️ RequestManager: Retry ${attempt}/${options.retries} after ${delay}ms`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const isExpired = now - entry.timestamp > ttl;

    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set cache entry with TTL
   */
  private setCacheEntry<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: CacheInvalidationPattern): number {
    let invalidatedCount = 0;

    for (const [key] of this.cache) {
      const shouldInvalidate =
        typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key);

      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    console.log(
      `🗑️ RequestManager: Invalidated ${invalidatedCount} cache entries matching pattern:`,
      pattern
    );
    return invalidatedCount;
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🧹 RequestManager: Cleared ${count} cache entries`);
  }

  /**
   * Subscribe to cache updates for a key pattern
   */
  subscribe(pattern: string, callback: CacheUpdateListener): () => void {
    if (!this.listeners.has(pattern)) {
      this.listeners.set(pattern, new Set());
    }

    this.listeners.get(pattern)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(pattern);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(pattern);
        }
      }
    };
  }

  /**
   * Notify listeners of cache updates
   */
  private notifyListeners(key: string, data: any): void {
    for (const [pattern, listeners] of this.listeners) {
      if (key.includes(pattern)) {
        listeners.forEach(callback => {
          try {
            callback(key, data);
          } catch (error) {
            console.error('Error in cache listener:', error);
          }
        });
      }
    }
  }

  /**
   * Update request metrics
   */
  private updateMetrics(
    key: string,
    responseTime: number,
    cacheHit: boolean,
    duplicateBlocked = false
  ): void {
    const existing = this.metrics.get(key) || {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      duplicatesBlocked: 0,
      averageResponseTime: 0,
      lastRequestTime: 0,
    };

    existing.totalRequests++;
    existing.lastRequestTime = Date.now();

    if (duplicateBlocked) {
      existing.duplicatesBlocked++;
    } else if (cacheHit) {
      existing.cacheHits++;
    } else {
      existing.cacheMisses++;
    }

    // Update average response time
    if (responseTime > 0) {
      existing.averageResponseTime =
        (existing.averageResponseTime * (existing.totalRequests - 1) +
          responseTime) /
        existing.totalRequests;
    }

    this.metrics.set(key, existing);
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): Map<string, RequestMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Periodic cache cleanup of expired entries
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(
          `🧽 RequestManager: Cleaned up ${cleanedCount} expired cache entries`
        );
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Force refresh data for a specific key
   */
  async refresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.execute(key, fetcher, { ...options, force: true });
  }

  /**
   * Prefetch data to warm the cache
   */
  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<void> {
    try {
      await this.execute(key, fetcher, options);
      console.log(`🔥 RequestManager: Prefetched data for ${key}`);
    } catch (error) {
      console.warn(`⚠️ RequestManager: Prefetch failed for ${key}:`, error);
    }
  }
}

// Singleton instance
let instance: RequestManager | null = null;

export function getRequestManager(): RequestManager {
  if (!instance) {
    instance = new RequestManager();
  }
  return instance;
}
