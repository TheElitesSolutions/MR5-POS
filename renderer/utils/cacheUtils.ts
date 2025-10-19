/**
 * Cache utilities for data persistence and optimistic updates
 */

// Default cache expiration time in milliseconds (15 minutes)
const DEFAULT_CACHE_EXPIRATION = 15 * 60 * 1000;

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Simple in-memory cache with expiration
 */
class SimpleCache {
  private cache: Record<string, CacheEntry<any>> = {};

  /**
   * Set a value in the cache
   *
   * @param key The cache key
   * @param value The value to cache
   * @param expirationMs Expiration time in milliseconds (default: 15 minutes)
   */
  set<T>(
    key: string,
    value: T,
    expirationMs: number = DEFAULT_CACHE_EXPIRATION
  ): void {
    const now = Date.now();
    this.cache[key] = {
      data: value,
      timestamp: now,
      expiresAt: now + expirationMs,
    };
  }

  /**
   * Get a value from the cache
   *
   * @param key The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache[key];
    const now = Date.now();

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < now) {
      // Expired - remove from cache
      delete this.cache[key];
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Check if a key exists in the cache and is not expired
   *
   * @param key The cache key to check
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache[key];
    const now = Date.now();

    if (!entry || entry.expiresAt < now) {
      return false;
    }

    return true;
  }

  /**
   * Remove a key from the cache
   *
   * @param key The cache key to remove
   */
  remove(key: string): void {
    delete this.cache[key];
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache = {};
  }

  /**
   * Get all cache keys
   *
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Object.keys(this.cache);
  }

  /**
   * Remove all expired entries from the cache
   *
   * @returns Number of entries removed
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    Object.entries(this.cache).forEach(([key, entry]) => {
      if (entry.expiresAt < now) {
        delete this.cache[key];
        removed++;
      }
    });

    return removed;
  }

  /**
   * Remove all cache entries that start with a specific prefix
   *
   * @param prefix The prefix to match
   * @returns Number of entries removed
   */
  removeByPrefix(prefix: string): number {
    let removed = 0;
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(prefix)) {
        delete this.cache[key];
        removed++;
      }
    });
    return removed;
  }

  /**
   * Update a specific field in a cached object
   *
   * @param key The cache key
   * @param fieldPath Path to the field to update (dot notation)
   * @param value The new value
   * @returns True if the update was successful
   */
  updateField<T>(key: string, fieldPath: string, value: any): boolean {
    const entry = this.cache[key];

    if (!entry) {
      return false;
    }

    // Navigate to the field
    const fields = fieldPath.split('.');
    let current: any = entry.data;

    // Navigate to the parent object of the field
    for (let i = 0; i < fields.length - 1; i++) {
      if (current[fields[i]] === undefined) {
        return false;
      }
      current = current[fields[i]];
    }

    // Update the field
    const lastField = fields[fields.length - 1];
    current[lastField] = value;

    return true;
  }
}

// Create a global instance
export const cache = new SimpleCache();

/**
 * Generate a cache key from a base key and parameters
 *
 * @param baseKey The base cache key
 * @param params Additional parameters to include in the key
 * @returns A consistent cache key
 */
export function generateCacheKey(
  baseKey: string,
  params: Record<string, any> = {}
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return sortedParams ? `${baseKey}?${sortedParams}` : baseKey;
}

export default {
  cache,
  generateCacheKey,
};
