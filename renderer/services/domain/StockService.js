/**
 * Stock Service - Domain Service for Inventory/Stock Data Management
 *
 * This service provides:
 * 1. Centralized stock/inventory data access with optimized caching
 * 2. Request deduplication for stock items across multiple components
 * 3. Real-time stock level tracking and low stock alerts
 * 4. Cache invalidation on inventory changes
 * 5. Optimized queries for different use cases (POS, Menu, Expenses)
 */
import { getRequestManager } from '../core/RequestManager';
import { inventoryAPI } from '@/lib/ipc-api';
export class StockService {
    constructor(requestManager) {
        // Cache TTL configurations - Stock needs fresher data than menu
        this.CACHE_TTL = {
            STOCK_ITEMS: 2 * 60 * 1000, // 2 minutes for all stock items
            SINGLE_ITEM: 1 * 60 * 1000, // 1 minute for single items
            CATEGORIES: 5 * 60 * 1000, // 5 minutes for categories
            LOW_STOCK: 30 * 1000, // 30 seconds for low stock alerts
            AVAILABILITY: 10 * 1000, // 10 seconds for ingredient availability checks
        };
        this.requestManager = requestManager || getRequestManager();
    }
    /**
     * Get all stock items
     */
    async getStockItems(params = {}) {
        const cacheKey = this.generateStockItemsCacheKey(params);
        return this.requestManager.execute(cacheKey, async () => {
            const response = await inventoryAPI.getAllInventoryItems();
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch stock items');
            }
            let items = response.data || [];
            if (process.env.NODE_ENV === 'development') {
                console.log('📦 StockService: Loaded', items.length, 'stock items');
            }
            // Apply client-side filtering if needed
            if (params.category) {
                items = items.filter(item => item.category === params.category);
            }
            if (params.lowStockOnly) {
                items = items.filter(item => {
                    const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
                    const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
                    return currentQty <= minQty;
                });
            }
            if (params.search) {
                const searchLower = params.search.toLowerCase();
                items = items.filter(item => {
                    // ✅ Handle both 'name' and 'itemName' properties for robust searching
                    const itemName = item.name || item.itemName || '';
                    return (itemName.toLowerCase().includes(searchLower) ||
                        (item.category &&
                            item.category.toLowerCase().includes(searchLower)));
                });
            }
            // Apply pagination if specified
            if (params.page && params.pageSize) {
                const start = (params.page - 1) * params.pageSize;
                const end = start + params.pageSize;
                items = items.slice(start, end);
            }
            return items;
        }, {
            ttl: this.CACHE_TTL.STOCK_ITEMS,
            retries: 3,
            force: params.force || false, // Pass force option to bypass cache
        });
    }
    /**
     * Get single stock item by ID
     */
    async getStockItemById(id) {
        const cacheKey = `stock:item:${id}`;
        return this.requestManager.execute(cacheKey, async () => {
            console.log(`🎯 StockService: Fetching stock item by ID: ${id}`);
            const response = await inventoryAPI.getById(id);
            if (!response.success) {
                if (response.error?.includes('not found')) {
                    return null;
                }
                throw new Error(response.error || `Failed to fetch stock item: ${id}`);
            }
            return response.data || null;
        }, {
            ttl: this.CACHE_TTL.SINGLE_ITEM,
            retries: 3,
        });
    }
    /**
     * Get stock items by category
     */
    async getStockItemsByCategory(category) {
        const cacheKey = `stock:category:${category}`;
        return this.requestManager.execute(cacheKey, async () => {
            console.log(`🏷️ StockService: Fetching stock items for category: ${category}`);
            const allItems = await this.getStockItems();
            return allItems.filter(item => item.category === category);
        }, {
            ttl: this.CACHE_TTL.STOCK_ITEMS,
            retries: 3,
        });
    }
    /**
     * Get stock categories
     */
    async getStockCategories() {
        const cacheKey = 'stock:categories';
        return this.requestManager.execute(cacheKey, async () => {
            console.log('📂 StockService: Fetching stock categories from API');
            const response = await inventoryAPI.getCategories();
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch stock categories');
            }
            return response.data || [];
        }, {
            ttl: this.CACHE_TTL.CATEGORIES,
            retries: 3,
        });
    }
    /**
     * Create new stock category
     */
    async createStockCategory(name) {
        console.log('➕ StockService: Creating new stock category', name);
        // First check if the category already exists
        const existingCategories = await this.getStockCategories();
        if (existingCategories.includes(name)) {
            console.log(`Category "${name}" already exists, skipping creation`);
            return;
        }
        // Check if a placeholder item with this name already exists
        const placeholderItemName = `${name} Category Placeholder`;
        const allItems = await this.getStockItems();
        const existingPlaceholder = allItems.find(item => item.itemName === placeholderItemName);
        if (existingPlaceholder) {
            console.log(`Placeholder item "${placeholderItemName}" already exists, skipping creation`);
            // Just invalidate cache in case the category wasn't properly showing
            this.requestManager.invalidate('stock:categories');
            return;
        }
        // Create a placeholder inventory item to establish the category
        // This follows the same approach as the CategoryStore
        const stockItem = {
            itemName: placeholderItemName,
            category: name,
            currentStock: 0,
            minimumStock: 0,
            unit: 'unit',
            costPerUnit: 0,
            supplier: 'System-Generated Category',
        };
        console.log('Creating stock item to establish category:', stockItem);
        const response = await inventoryAPI.createInventoryItem(stockItem);
        if (!response.success) {
            throw new Error(response.error || 'Failed to create stock category');
        }
        console.log('Successfully created category with item:', response.data);
        // Invalidate all stock-related caches to refresh the lists
        this.requestManager.invalidate('stock:categories');
        this.requestManager.invalidate('stock:items');
        console.log('✅ StockService: Invalidated all stock caches after category creation');
    }
    /**
     * Update stock category name
     */
    async updateStockCategory(oldName, newName) {
        console.log(`✏️ StockService: Updating stock category: ${oldName} -> ${newName}`);
        const response = await inventoryAPI.updateCategoryName(oldName, newName);
        if (!response.success) {
            throw new Error(response.error || 'Failed to update stock category');
        }
        // Invalidate related caches
        this.requestManager.invalidate('stock:categories');
        this.invalidateStockCaches();
    }
    /**
     * Delete stock category
     */
    async deleteStockCategory(categoryName) {
        console.log(`🗑️ StockService: Deleting stock category: ${categoryName}`);
        const allItems = await this.getStockItems();
        const itemsInCategory = allItems.filter(item => item.category === categoryName);
        console.log(`Found ${itemsInCategory.length} items in category "${categoryName}"`);
        // Process each item in the category
        for (const item of itemsInCategory) {
            // Check if this is a system-generated placeholder item
            const isPlaceholder = item.supplier === 'System-Generated Category' &&
                item.itemName?.includes('Category Placeholder');
            if (isPlaceholder) {
                // Delete placeholder items completely
                console.log(`Deleting placeholder item: ${item.itemName}`);
                await this.deleteStockItem(item.id);
            }
            else {
                // For real inventory items, just remove the category (set to 'Uncategorized')
                console.log(`Uncategorizing real item: ${item.itemName}`);
                await this.updateStockItem({
                    id: item.id,
                    category: 'Uncategorized',
                });
            }
        }
        // Invalidate related caches
        this.requestManager.invalidate('stock:categories');
        this.invalidateStockCaches();
    }
    /**
     * Get low stock items (for alerts)
     */
    async getLowStockItems() {
        const cacheKey = 'stock:low-stock';
        return this.requestManager.execute(cacheKey, async () => {
            console.log('⚠️ StockService: Checking for low stock items');
            const allItems = await this.getStockItems();
            const lowStockItems = [];
            for (const item of allItems) {
                const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
                const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
                if (currentQty <= minQty) {
                    const percentageRemaining = minQty > 0
                        ? (currentQty / minQty) * 100
                        : 0;
                    lowStockItems.push({
                        item,
                        currentQuantity: currentQty,
                        minimumQuantity: minQty,
                        percentageRemaining,
                    });
                }
            }
            // Sort by most critical (lowest percentage remaining)
            lowStockItems.sort((a, b) => a.percentageRemaining - b.percentageRemaining);
            return lowStockItems;
        }, {
            ttl: this.CACHE_TTL.LOW_STOCK,
            retries: 3,
        });
    }
    /**
     * Check ingredient availability for menu items (optimized for POS)
     */
    async checkIngredientAvailability(ingredientIds, requiredQuantities) {
        const cacheKey = `stock:availability:${ingredientIds.join(',')}_${requiredQuantities.join(',')}`;
        return this.requestManager.execute(cacheKey, async () => {
            console.log('🔍 StockService: Checking ingredient availability for POS');
            const stockItems = await this.getStockItems();
            const availability = {};
            for (let i = 0; i < ingredientIds.length; i++) {
                const ingredientId = ingredientIds[i];
                if (!ingredientId)
                    continue; // Skip undefined ingredients
                const requiredQuantity = requiredQuantities[i] || 1;
                const stockItem = stockItems.find(item => item.id === ingredientId);
                if (stockItem) {
                    const currentQty = stockItem.currentQuantity ?? stockItem.currentStock ?? 0;
                    availability[ingredientId] = currentQty >= requiredQuantity;
                }
                else {
                    availability[ingredientId] = false;
                }
            }
            return availability;
        }, {
            ttl: this.CACHE_TTL.AVAILABILITY,
            retries: 3,
        });
    }
    /**
     * Create new stock item
     */
    async createStockItem(data) {
        console.log('➕ StockService: Creating new stock item', data.name);
        const response = await inventoryAPI.createInventoryItem(data);
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to create stock item');
        }
        // Invalidate all stock-related caches
        // Don't prefetch here - let the hooks fetch fresh data themselves
        this.invalidateStockCaches();
        return response.data;
    }
    /**
     * Update existing stock item
     */
    async updateStockItem(data) {
        console.log(`✏️ StockService: Updating stock item: ${data.id}`);
        const response = await inventoryAPI.updateInventoryItem(data.id, data);
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to update stock item');
        }
        // Invalidate related caches
        // Don't prefetch here - let the hooks fetch fresh data themselves
        this.invalidateStockCaches();
        this.requestManager.invalidate(`stock:item:${data.id}`);
        return response.data;
    }
    /**
     * Adjust stock quantity (usage, purchase, waste, etc.)
     */
    async adjustStockQuantity(data) {
        console.log(`📊 StockService: Adjusting stock quantity for: ${data.id}`);
        const response = await inventoryAPI.adjustStock(data.id, {
            quantity: data.quantity,
            reason: data.reason,
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to adjust stock quantity');
        }
        // Invalidate caches - especially availability and low stock
        // Don't prefetch here - let the hooks fetch fresh data themselves
        this.invalidateStockCaches();
        this.requestManager.invalidate(`stock:item:${data.id}`);
        return response.data;
    }
    /**
     * Delete stock item
     */
    async deleteStockItem(id) {
        console.log(`🗑️ StockService: Deleting stock item: ${id}`);
        const response = await inventoryAPI.deleteInventoryItem(id);
        if (!response.success) {
            throw new Error(response.error || 'Failed to delete stock item');
        }
        // Invalidate related caches
        this.invalidateStockCaches();
        this.requestManager.invalidate(`stock:item:${id}`);
    }
    /**
     * Prefetch stock data for better UX
     */
    async prefetchStockData() {
        console.log('🚀 StockService: Prefetching stock data for better UX');
        // Prefetch categories first (lightweight)
        await this.requestManager.prefetch('stock:categories', () => this.getStockCategories());
        // Prefetch all stock items
        await this.requestManager.prefetch('stock:items:{}', () => this.getStockItems());
        // Prefetch low stock alerts
        await this.requestManager.prefetch('stock:low-stock', () => this.getLowStockItems());
    }
    /**
     * Invalidate all stock caches without prefetching
     * Useful when you want to force fresh data on next fetch
     */
    invalidateAllCaches() {
        return this.invalidateStockCaches();
    }
    /**
     * Refresh all stock data (force reload)
     */
    async refreshStockData() {
        console.log('🔄 StockService: Force refreshing all stock data');
        // Clear all stock-related caches
        this.invalidateStockCaches();
        // Prefetch fresh data
        await this.prefetchStockData();
    }
    /**
     * Subscribe to stock data changes
     */
    subscribeToStockChanges(callback) {
        return this.requestManager.subscribe('stock:', callback);
    }
    /**
     * Get stock service metrics
     */
    getMetrics() {
        const allMetrics = this.requestManager.getMetrics();
        const stockMetrics = new Map();
        for (const [key, metrics] of allMetrics) {
            if (key.startsWith('stock:')) {
                stockMetrics.set(key, metrics);
            }
        }
        return stockMetrics;
    }
    /**
     * Generate cache key for stock items query
     */
    generateStockItemsCacheKey(params) {
        const normalizedParams = {
            category: params.category || '',
            lowStockOnly: params.lowStockOnly || false,
            search: params.search || '',
            page: params.page || 0,
            pageSize: params.pageSize || 0,
        };
        return `stock:items:${JSON.stringify(normalizedParams)}`;
    }
    /**
     * Invalidate all stock-related caches
     */
    invalidateStockCaches() {
        const invalidatedCount = this.requestManager.invalidate(/^stock:/);
        console.log(`🗑️ StockService: Invalidated ${invalidatedCount} stock cache entries`);
        return invalidatedCount;
    }
}
// Singleton instance for easy access
let stockServiceInstance = null;
export function getStockService() {
    if (!stockServiceInstance) {
        stockServiceInstance = new StockService();
    }
    return stockServiceInstance;
}
