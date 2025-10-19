/**
 * Menu Service - Domain Service for Menu Data Management
 *
 * This service provides:
 * 1. Centralized menu data access with smart caching
 * 2. Request deduplication for menu items and categories
 * 3. Cache invalidation on menu changes
 * 4. Type-safe menu operations
 * 5. Optimized queries for POS and admin use cases
 */

import { getRequestManager, RequestManager } from '../core/RequestManager';
import { menuAPI } from '@/lib/ipc-api';
import { UIMenuItem, convertToUIMenuItem } from '@/types/menu';

export interface MenuQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  availableOnly?: boolean;
}

export interface MenuItemsResponse {
  items: UIMenuItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateMenuItemData {
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable?: boolean;
  isActive?: boolean;
  ingredients?: any[];
}

export interface UpdateMenuItemData extends Partial<CreateMenuItemData> {
  id: string;
}

export class MenuService {
  private requestManager: RequestManager;

  // Cache TTL configurations
  private readonly CACHE_TTL = {
    MENU_ITEMS: 5 * 60 * 1000, // 5 minutes for menu items
    CATEGORIES: 10 * 60 * 1000, // 10 minutes for categories
    SINGLE_ITEM: 3 * 60 * 1000, // 3 minutes for single items
    AVAILABLE_ITEMS: 2 * 60 * 1000, // 2 minutes for available items (POS needs fresher data)
  };

  constructor(requestManager?: RequestManager) {
    this.requestManager = requestManager || getRequestManager();
  }

  /**
   * Get all menu items with optional filtering and pagination
   */
  async getMenuItems(params: MenuQueryParams = {}): Promise<MenuItemsResponse> {
    const cacheKey = this.generateMenuItemsCacheKey(params);

    return this.requestManager.execute(
      cacheKey,
      async () => {
        console.log('🍽️ MenuService: Fetching menu items from API', params);
        const response = await menuAPI.getAll(params);
        console.log('🍽️ MenuService: Raw API response:', {
          success: response.success,
          error: response.error,
          dataExists: !!response.data,
          dataItems: response.data?.items?.length,
          dataTotal: response.data?.total,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch menu items');
        }

        // Ensure items is always an array even if the backend response structure is unexpected
        let items: any[] = [];
        if (response.data) {
          if (Array.isArray(response.data.items)) {
            items = response.data.items;
          } else if (Array.isArray(response.data)) {
            // Handle case where response.data is directly an array
            items = response.data;
          }
        }

        // Convert backend MenuItem to UIMenuItem
        const uiItems = items.map(item => convertToUIMenuItem(item));

        const result = {
          items: uiItems,
          total: response.data?.total || items.length || 0,
          page: response.data?.page || 1,
          pageSize: response.data?.pageSize || 10,
        };
        console.log('🍽️ MenuService: Processed result:', result);
        return result;
      },
      {
        ttl: params.availableOnly
          ? this.CACHE_TTL.AVAILABLE_ITEMS
          : this.CACHE_TTL.MENU_ITEMS,
        retries: 3,
      }
    );
  }

  /**
   * Get available menu items only (optimized for POS)
   */
  async getAvailableMenuItems(
    params: Omit<MenuQueryParams, 'availableOnly'> = {}
  ): Promise<UIMenuItem[]> {
    const cacheKey = `menu:available:${JSON.stringify(params)}`;

    return this.requestManager.execute(
      cacheKey,
      async () => {
        console.log(
          '🟢 MenuService: Fetching available menu items for POS',
          params
        );
        const response = await menuAPI.getAvailable(params);
        console.log('🟢 MenuService: Available items raw API response:', {
          success: response.success,
          error: response.error,
          dataExists: !!response.data,
          dataItems: response.data?.items?.length,
          firstItem: response.data?.items?.[0],
        });

        if (!response.success) {
          throw new Error(
            response.error || 'Failed to fetch available menu items'
          );
        }

        // Ensure items is always a valid array
        let result: any[] = [];
        if (response.data) {
          if (Array.isArray(response.data.items)) {
            result = response.data.items;
          } else if (Array.isArray(response.data)) {
            // Handle case where response.data is directly an array
            result = response.data;
          }
        }

        // Convert to UIMenuItem
        const uiItems = result.map(item => convertToUIMenuItem(item));

        console.log('🟢 MenuService: Available items final result:', {
          resultLength: uiItems.length,
          firstResultItem: uiItems[0],
        });
        return uiItems;
      },
      {
        ttl: this.CACHE_TTL.AVAILABLE_ITEMS,
        retries: 3,
      }
    );
  }

  /**
   * Get menu categories
   */
  async getCategories(): Promise<Array<{id: string, name: string}>> {
    const cacheKey = 'menu:categories';

    return this.requestManager.execute(
      cacheKey,
      async () => {
        console.log('📂 MenuService: Fetching menu categories from API');
        const response = await menuAPI.getCategories();
        console.log('📂 MenuService: Raw categories API response:', {
          success: response.success,
          error: response.error,
          dataExists: !!response.data,
          dataLength: response.data?.length,
          rawData: response.data,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch categories');
        }

        // Return full category objects with id and name
        const categories = response.data || [];
        const processedCategories = Array.isArray(categories)
          ? categories
              .map(cat => {
                if (typeof cat === 'string') {
                  // If it's just a string, create an object with name as both id and name
                  return { id: cat, name: cat };
                }
                // Return full object with id and name
                return { id: cat.id, name: cat.name };
              })
              .filter(cat => cat && cat.id && cat.name)
          : [];
        console.log(
          '📂 MenuService: Processed categories with IDs:',
          processedCategories
        );
        return processedCategories;
      },
      {
        ttl: this.CACHE_TTL.CATEGORIES,
        retries: 3,
      }
    );
  }

  /**
   * Get menu items by category (optimized query)
   */
  async getMenuItemsByCategory(
    category: string,
    params: Pick<MenuQueryParams, 'page' | 'pageSize'> = {}
  ): Promise<MenuItemsResponse> {
    const cacheKey = `menu:category:${category}:${JSON.stringify(params)}`;

    return this.requestManager.execute(
      cacheKey,
      async () => {
        console.log(
          `🏷️ MenuService: Fetching menu items for category: ${category}`
        );
        const response = await menuAPI.getByCategory(category, params);

        if (!response.success) {
          throw new Error(
            response.error || `Failed to fetch items for category: ${category}`
          );
        }

        // Convert items to UIMenuItem
        const items = response.data?.items || [];
        const uiItems = items.map(item => convertToUIMenuItem(item));

        return {
          items: uiItems,
          total: response.data?.total || 0,
          page: response.data?.page || 1,
          pageSize: response.data?.pageSize || 10,
        };
      },
      {
        ttl: this.CACHE_TTL.MENU_ITEMS,
        retries: 3,
      }
    );
  }

  /**
   * Get single menu item by ID
   */
  async getMenuItemById(id: string): Promise<UIMenuItem | null> {
    const cacheKey = `menu:item:${id}`;

    return this.requestManager.execute(
      cacheKey,
      async () => {
        console.log(`🎯 MenuService: Fetching menu item by ID: ${id}`);
        const response = await menuAPI.getById(id);

        if (!response.success) {
          if (response.error?.includes('not found')) {
            return null;
          }
          throw new Error(response.error || `Failed to fetch menu item: ${id}`);
        }

        // Convert to UIMenuItem if data exists
        return response.data ? convertToUIMenuItem(response.data) : null;
      },
      {
        ttl: this.CACHE_TTL.SINGLE_ITEM,
        retries: 3,
      }
    );
  }

  /**
   * Create new menu item
   */
  async createMenuItem(data: CreateMenuItemData, userId: string): Promise<UIMenuItem> {
    console.log('➕ MenuService: Creating new menu item', data.name);

    const response = await menuAPI.create({
      menuItem: data,
      userId,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create menu item');
    }

    // Invalidate related caches
    this.invalidateMenuCaches();

    return convertToUIMenuItem(response.data);
  }

  /**
   * Update existing menu item
   */
  async updateMenuItem(data: UpdateMenuItemData, userId: string): Promise<UIMenuItem> {
    console.log(`✏️ MenuService: Updating menu item: ${data.id}`);

    const { id, ...updates } = data;
    const response = await menuAPI.update({
      id,
      updates,
      userId,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update menu item');
    }

    // Invalidate related caches
    this.invalidateMenuCaches();
    this.requestManager.invalidate(`menu:item:${data.id}`);

    return convertToUIMenuItem(response.data);
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(id: string, userId: string): Promise<void> {
    console.log(`🗑️ MenuService: Deleting menu item: ${id}`);

    const response = await menuAPI.delete({ id, userId });

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete menu item');
    }

    // Invalidate related caches
    this.invalidateMenuCaches();
    this.requestManager.invalidate(`menu:item:${id}`);
  }

  /**
   * Toggle menu item availability
   * Note: This method is not available in the current menuAPI
   */
  async toggleMenuItemAvailability(id: string, userId: string): Promise<UIMenuItem> {
    console.log(`🔄 MenuService: Toggling availability for menu item: ${id}`);

    // Since toggleAvailability is not in the API, we'll fetch and update manually
    const item = await this.getMenuItemById(id);
    if (!item) {
      throw new Error(`Menu item not found: ${id}`);
    }

    // Update with toggled availability
    return this.updateMenuItem(
      { id, isAvailable: !item.isAvailable },
      userId
    );
  }

  /**
   * Prefetch menu data for better UX
   */
  async prefetchMenuData(): Promise<void> {
    console.log('🚀 MenuService: Prefetching menu data for better UX');

    // Prefetch categories first (lightweight)
    await this.requestManager.prefetch('menu:categories', () =>
      this.getCategories()
    );

    // Prefetch available items for POS
    await this.requestManager.prefetch('menu:available:{}', () =>
      this.getAvailableMenuItems()
    );

    // Prefetch first page of all items
    await this.requestManager.prefetch(
      'menu:items:{"page":1,"pageSize":20}',
      () => this.getMenuItems({ page: 1, pageSize: 20 })
    );
  }

  /**
   * Refresh all menu data (force reload)
   */
  async refreshMenuData(): Promise<void> {
    console.log('🔄 MenuService: Force refreshing all menu data');

    // Clear all menu-related caches
    this.invalidateMenuCaches();

    // Prefetch fresh data
    await this.prefetchMenuData();
  }

  /**
   * Subscribe to menu data changes
   */
  subscribeToMenuChanges(
    callback: (key: string, data: any) => void
  ): () => void {
    return this.requestManager.subscribe('menu:', callback);
  }

  /**
   * Get menu service metrics
   */
  getMetrics() {
    const allMetrics = this.requestManager.getMetrics();
    const menuMetrics = new Map();

    for (const [key, metrics] of allMetrics) {
      if (key.startsWith('menu:')) {
        menuMetrics.set(key, metrics);
      }
    }

    return menuMetrics;
  }

  /**
   * Generate cache key for menu items query
   */
  private generateMenuItemsCacheKey(params: MenuQueryParams): string {
    const normalizedParams = {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      search: params.search || '',
      category: params.category || '',
      availableOnly: params.availableOnly || false,
    };

    return `menu:items:${JSON.stringify(normalizedParams)}`;
  }

  /**
   * Invalidate all menu-related caches
   */
  private invalidateMenuCaches(): void {
    const invalidatedCount = this.requestManager.invalidate(/^menu:/);
    console.log(
      `🗑️ MenuService: Invalidated ${invalidatedCount} menu cache entries`
    );
  }
}

// Singleton instance for easy access
let menuServiceInstance: MenuService | null = null;

export function getMenuService(): MenuService {
  if (!menuServiceInstance) {
    menuServiceInstance = new MenuService();
  }
  return menuServiceInstance;
}
