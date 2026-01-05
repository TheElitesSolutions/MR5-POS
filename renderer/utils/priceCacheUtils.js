/**
 * Price Cache Utilities
 *
 * This module provides utilities for caching menu item prices to ensure
 * they persist across system restarts and maintain consistency.
 */
// Local storage key for the price cache
const PRICE_CACHE_KEY = 'mr5-pos-price-cache';
// Cache expiration time (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000;
/**
 * Load the price cache from local storage
 */
function loadPriceCache() {
    try {
        const cacheData = localStorage.getItem(PRICE_CACHE_KEY);
        if (!cacheData)
            return {};
        const parsedCache = JSON.parse(cacheData);
        // Clean up expired cache entries
        const now = Date.now();
        Object.keys(parsedCache).forEach(key => {
            if (now - parsedCache[key].timestamp > CACHE_TTL) {
                delete parsedCache[key];
            }
        });
        return parsedCache;
    }
    catch (error) {
        console.error('Error loading price cache:', error);
        return {};
    }
}
/**
 * Save the price cache to local storage
 */
function savePriceCache(cache) {
    try {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
    }
    catch (error) {
        console.error('Error saving price cache:', error);
    }
}
/**
 * Cache a menu item's price
 */
export function cacheMenuItemPrice(menuItem) {
    if (!menuItem || !menuItem.id || !menuItem.price)
        return;
    try {
        const cache = loadPriceCache();
        cache[menuItem.id] = {
            itemId: menuItem.id,
            price: menuItem.price,
            name: menuItem.name,
            timestamp: Date.now(),
        };
        savePriceCache(cache);
    }
    catch (error) {
        console.error('Error caching menu item price:', error);
    }
}
/**
 * Cache prices for multiple menu items
 */
export function cacheMenuItemPrices(menuItems) {
    if (!menuItems || !Array.isArray(menuItems))
        return;
    try {
        const cache = loadPriceCache();
        const now = Date.now();
        menuItems.forEach(item => {
            if (item && item.id && item.price > 0) {
                cache[item.id] = {
                    itemId: item.id,
                    price: item.price,
                    name: item.name,
                    timestamp: now,
                };
            }
        });
        savePriceCache(cache);
    }
    catch (error) {
        console.error('Error caching menu item prices:', error);
    }
}
/**
 * Cache an order item's price
 */
export function cacheOrderItemPrice(orderItem) {
    if (!orderItem || !orderItem.menuItemId)
        return;
    try {
        const cache = loadPriceCache();
        const price = orderItem.unitPrice || orderItem.price || 0;
        // Only cache if we have a valid price
        if (price > 0) {
            cache[orderItem.menuItemId] = {
                itemId: orderItem.menuItemId,
                price: price,
                name: orderItem.menuItemName || orderItem.name || 'Unknown Item',
                timestamp: Date.now(),
            };
            savePriceCache(cache);
        }
    }
    catch (error) {
        console.error('Error caching order item price:', error);
    }
}
/**
 * Get a cached price for a menu item
 *
 * @param itemId The menu item ID
 * @returns The cached price or undefined if not in cache
 */
export function getCachedPrice(itemId) {
    if (!itemId)
        return undefined;
    try {
        const cache = loadPriceCache();
        const cachedItem = cache[itemId];
        return cachedItem?.price;
    }
    catch (error) {
        console.error('Error getting cached price:', error);
        return undefined;
    }
}
/**
 * Apply cached prices to a collection of menu items
 *
 * @param menuItems Array of menu items to enhance with cached prices
 * @returns The same menu items with prices enhanced from cache where needed
 */
export function applyCachedPrices(menuItems) {
    if (!menuItems || !Array.isArray(menuItems))
        return menuItems;
    try {
        const cache = loadPriceCache();
        return menuItems.map(item => {
            // Only apply cached price if the current price is missing or zero
            if (item && item.id && (!item.price || item.price === 0)) {
                const cachedItem = cache[item.id];
                if (cachedItem && cachedItem.price > 0) {
                    return {
                        ...item,
                        price: cachedItem.price,
                    };
                }
            }
            return item;
        });
    }
    catch (error) {
        console.error('Error applying cached prices:', error);
        return menuItems;
    }
}
/**
 * Initialize menu item price monitoring
 * This should be called on application startup
 */
export function initializePriceMonitoring() {
    // Intercept menu item responses and cache prices
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const response = await originalFetch(input, init);
        // Clone the response to avoid consuming it
        const responseClone = response.clone();
        // Only process GET requests that might contain menu items
        if (response.ok &&
            input &&
            typeof input === 'string' &&
            (input.includes('menu-items') || input.includes('menuItems'))) {
            try {
                const data = await responseClone.json();
                // Handle different response shapes
                if (data && data.success && data.data) {
                    // Handle array responses
                    if (Array.isArray(data.data)) {
                        cacheMenuItemPrices(data.data);
                    }
                    // Handle paginated responses
                    else if (data.data.items && Array.isArray(data.data.items)) {
                        cacheMenuItemPrices(data.data.items);
                    }
                    // Handle single item response
                    else if (data.data.id && typeof data.data.price === 'number') {
                        cacheMenuItemPrice(data.data);
                    }
                }
            }
            catch (error) {
                // Silently ignore errors in our monitoring code
                console.debug('Error in price monitoring intercept:', error);
            }
        }
        return response;
    };
    console.log('✅ Price monitoring initialized');
}
