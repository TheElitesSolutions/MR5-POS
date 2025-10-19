/**
 * Add-On Cache Service
 *
 * Redis-based caching for frequently accessed addon data
 * Provides performance optimization for category-addon lookups
 */

import Redis from 'ioredis';
import { PrismaClient } from '../db/prisma-wrapper';
import { AddonService, ServiceResponse } from './AddonService';
import { AddonErrorFactory } from '../errors/AddonError';
import type { z } from 'zod';
import { AddonGroupSchema } from '../../shared/validation/addon-schemas';

type AddonGroupData = z.infer<typeof AddonGroupSchema>;

export interface CacheConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  ttl?: {
    categoryAddons: number; // seconds
    addonGroups: number;
    addons: number;
  };
  enabled?: boolean;
}

export interface CategoryAddonsCache {
  groups: AddonGroupData[];
  totalAddons: number;
  cachedAt: string;
  ttl: number;
}

/**
 * AddonCacheService - Performance caching for add-ons system
 *
 * Features:
 * - Redis-based caching with fallback to in-memory
 * - Smart cache invalidation
 * - Category-specific add-on caching
 * - Performance metrics tracking
 * - Graceful degradation when Redis unavailable
 */
export class AddonCacheService {
  private redis?: Redis;
  private memoryCache: Map<string, any> = new Map();
  private addonService: AddonService;
  private config: CacheConfig;
  private isRedisConnected = false;

  constructor(addonService: AddonService, config: CacheConfig = {}) {
    this.addonService = addonService;
    this.config = {
      ttl: {
        categoryAddons: 300, // 5 minutes
        addonGroups: 600, // 10 minutes
        addons: 300, // 5 minutes
      },
      enabled: true,
      ...config,
    };

    this.initializeRedis();
  }

  /**
   * Initialize Redis connection with error handling
   */
  private initializeRedis() {
    if (!this.config.enabled) return;

    try {
      if (this.config.redis) {
        this.redis = new Redis({
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
        });

        this.redis.on('connect', () => {
          console.log('✅ Redis connected for addon caching');
          this.isRedisConnected = true;
        });

        this.redis.on('error', error => {
          console.warn(
            '⚠️ Redis connection error, falling back to memory cache:',
            error.message
          );
          this.isRedisConnected = false;
        });

        this.redis.on('close', () => {
          console.log('🔌 Redis connection closed, using memory cache');
          this.isRedisConnected = false;
        });
      } else {
        // Use environment variables if config not provided
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          });
        }
      }
    } catch (error) {
      console.warn(
        '⚠️ Failed to initialize Redis, using memory cache only:',
        error
      );
      this.isRedisConnected = false;
    }
  }

  /**
   * Get cached data with fallback chain: Redis → Memory → Database
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    try {
      // Try Redis first
      if (this.redis && this.isRedisConnected) {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Fallback to memory cache
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        // Check if expired
        if (cached.expiresAt > Date.now()) {
          return cached.data;
        } else {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    return null;
  }

  /**
   * Set cache data in both Redis and memory
   */
  private async setCache<T>(
    key: string,
    data: T,
    ttlSeconds: number
  ): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const serializedData = JSON.stringify(data);

      // Set in Redis
      if (this.redis && this.isRedisConnected) {
        await this.redis.setex(key, ttlSeconds, serializedData);
      }

      // Set in memory cache as fallback
      this.memoryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });

      // Cleanup memory cache if it gets too large
      if (this.memoryCache.size > 1000) {
        this.cleanupMemoryCache();
      }
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  /**
   * Delete cache entry
   */
  private async deleteFromCache(key: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Delete from Redis
      if (this.redis && this.isRedisConnected) {
        await this.redis.del(key);
      }

      // Delete from memory cache
      this.memoryCache.delete(key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  private async deleteCachePattern(pattern: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Delete from Redis using pattern
      if (this.redis && this.isRedisConnected) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Delete from memory cache
      for (const key of Array.from(this.memoryCache.keys())) {
        if (key.includes(pattern.replace('*', ''))) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache pattern delete error:', error);
    }
  }

  /**
   * Cleanup expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get category add-ons with caching
   */
  async getCategoryAddons(
    categoryId: string,
    useCache: boolean = true
  ): Promise<
    ServiceResponse<{
      groups: AddonGroupData[];
      totalAddons: number;
    }>
  > {
    const cacheKey = `category:${categoryId}:addons`;

    try {
      // Try cache first
      if (useCache) {
        const cached = await this.getFromCache<CategoryAddonsCache>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: {
              groups: cached.groups,
              totalAddons: cached.totalAddons,
            },
          };
        }
      }

      // Fetch from database
      const result = await this.addonService.getAddonsByCategory(categoryId);

      if (!result.success) {
        return result;
      }

      // Cache the result
      if (useCache) {
        const cacheData: CategoryAddonsCache = {
          groups: result.data.groups,
          totalAddons: result.data.totalAddons,
          cachedAt: new Date().toISOString(),
          ttl: this.config.ttl!.categoryAddons,
        };

        await this.setCache(
          cacheKey,
          cacheData,
          this.config.ttl!.categoryAddons
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getCategoryAddons', error),
      };
    }
  }

  /**
   * Get addon groups with caching
   */
  async getAddonGroups(
    filters?: {
      isActive?: boolean;
      categoryId?: string;
      includeAddons?: boolean;
    },
    useCache: boolean = true
  ): Promise<ServiceResponse<AddonGroupData[]>> {
    // Create cache key based on filters
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const cacheKey = `addon-groups:${Buffer.from(filterKey).toString('base64')}`;

    try {
      // Try cache first
      if (useCache) {
        const cached = await this.getFromCache<AddonGroupData[]>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
          };
        }
      }

      // Fetch from database
      const result = await this.addonService.getAddonGroups(filters);

      if (!result.success) {
        return result;
      }

      // Cache the result
      if (useCache) {
        await this.setCache(
          cacheKey,
          result.data,
          this.config.ttl!.addonGroups
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddonGroups', error),
      };
    }
  }

  /**
   * Invalidate category-specific caches
   */
  async invalidateCategoryCache(categoryId: string): Promise<void> {
    await this.deleteFromCache(`category:${categoryId}:addons`);

    // Also invalidate related addon group caches that might include this category
    await this.deleteCachePattern('addon-groups:*');
  }

  /**
   * Invalidate addon group caches
   */
  async invalidateAddonGroupCache(groupId?: string): Promise<void> {
    if (groupId) {
      // Invalidate specific group cache and related caches
      await this.deleteCachePattern(`addon-groups:*`);
      await this.deleteCachePattern(`category:*:addons`);
    } else {
      // Invalidate all addon group caches
      await this.deleteCachePattern('addon-groups:*');
    }
  }

  /**
   * Invalidate all addon-related caches
   */
  async invalidateAllCaches(): Promise<void> {
    await this.deleteCachePattern('category:*:addons');
    await this.deleteCachePattern('addon-groups:*');
    await this.deleteCachePattern('addons:*');

    // Clear memory cache
    this.memoryCache.clear();
  }

  /**
   * Warm up cache for popular categories
   */
  async warmUpCache(categoryIds: string[]): Promise<void> {
    console.log(`🔄 Warming up cache for ${categoryIds.length} categories...`);

    const promises = categoryIds.map(categoryId =>
      this.getCategoryAddons(categoryId, true).catch(error =>
        console.warn(`Failed to warm cache for category ${categoryId}:`, error)
      )
    );

    await Promise.all(promises);
    console.log('✅ Cache warm-up completed');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    memoryCache: {
      size: number;
      keys: string[];
    };
    redis: {
      connected: boolean;
      info?: any;
    };
    config: CacheConfig;
  }> {
    const stats = {
      memoryCache: {
        size: this.memoryCache.size,
        keys: Array.from(this.memoryCache.keys()),
      },
      redis: {
        connected: this.isRedisConnected,
        info: undefined as any,
      },
      config: this.config,
    };

    // Get Redis info if connected
    if (this.redis && this.isRedisConnected) {
      try {
        stats.redis.info = await this.redis.info('memory');
      } catch (error) {
        console.warn('Failed to get Redis info:', error);
      }
    }

    return stats;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }
}

export default AddonCacheService;
