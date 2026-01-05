/**
 * useMenuData Hook - React Integration for Menu Service
 *
 * This hook provides:
 * 1. Clean React integration with MenuService
 * 2. Automatic data fetching with proper loading states
 * 3. Error handling and retry mechanisms
 * 4. Memoized queries to prevent unnecessary re-renders
 * 5. Cache invalidation and refresh capabilities
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMenuService } from '../services/ServiceContainer';
import { applyCachedPrices, cacheMenuItemPrices, } from '@/utils/priceCacheUtils';
/**
 * Hook for fetching menu items with pagination and filtering
 */
export function useMenuItems(options = {}) {
    const { enabled = true, refetchOnMount = false, refetchOnWindowFocus = false, ...queryParams } = options;
    const menuService = getMenuService();
    // State
    const [data, setData] = useState({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
    });
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    // Memoize query params to prevent unnecessary re-fetches
    const stableQueryParams = useMemo(() => {
        return {
            page: queryParams.page || 1,
            pageSize: queryParams.pageSize || 12,
            search: queryParams.search || '',
            category: queryParams.category || '',
            availableOnly: queryParams.availableOnly || false,
        };
    }, [
        queryParams.page,
        queryParams.pageSize,
        queryParams.search,
        queryParams.category,
        queryParams.availableOnly,
    ]);
    // Fetch function
    const fetchData = useCallback(async (isRefresh = false) => {
        if (!enabled)
            return;
        try {
            if (isRefresh) {
                setIsRefreshing(true);
            }
            else {
                setIsLoading(true);
            }
            setError(null);
            // Fetch menu items and categories in parallel
            const [menuItemsResponse, categoriesResponse] = await Promise.all([
                menuService.getMenuItems(stableQueryParams),
                menuService.getCategories(),
            ]);
            setData(menuItemsResponse);
            setCategories(categoriesResponse);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch menu data';
            setError(errorMessage);
            console.error('useMenuItems: Failed to fetch data:', err);
        }
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [enabled, stableQueryParams, menuService]);
    // Refresh function (force reload)
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Invalidate cache
    const invalidateCache = useCallback(() => {
        menuService.refreshMenuData();
    }, [menuService]);
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    // Refetch on mount if requested
    useEffect(() => {
        if (refetchOnMount) {
            refresh();
        }
    }, [refetchOnMount, refresh]);
    // Refetch on window focus if requested
    useEffect(() => {
        if (!refetchOnWindowFocus)
            return;
        const handleFocus = () => {
            refresh();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [refetchOnWindowFocus, refresh]);
    return {
        // Data
        menuItems: data.items,
        categories,
        totalItems: data.total,
        currentPage: data.page,
        pageSize: data.pageSize,
        // State
        isLoading,
        isRefreshing,
        error,
        // Actions
        refetch: fetchData,
        refresh,
        clearError,
        // Cache management
        invalidateCache,
    };
}
/**
 * Hook for fetching available menu items (optimized for POS)
 */
export function useAvailableMenuItems(params = {}) {
    const menuService = getMenuService();
    // State
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    // Memoize params
    const stableParams = useMemo(() => params, [params.search, params.category]);
    // Fetch function
    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setIsRefreshing(true);
            }
            else {
                setIsLoading(true);
            }
            setError(null);
            // Fetch available items and categories in parallel
            const [itemsResponse, categoriesResponse] = await Promise.all([
                menuService.getAvailableMenuItems(stableParams),
                menuService.getCategories(),
            ]);
            // Apply cached prices to any menu items that might have lost their prices
            const enhancedItems = applyCachedPrices(itemsResponse);
            // Also update the cache with any valid prices from the response
            cacheMenuItemPrices(itemsResponse);
            setMenuItems(enhancedItems);
            setCategories(categoriesResponse);
        }
        catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : 'Failed to fetch available menu items';
            setError(errorMessage);
            console.error('useAvailableMenuItems: Failed to fetch data:', err);
        }
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [stableParams, menuService]);
    // Refresh function
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Invalidate cache
    const invalidateCache = useCallback(() => {
        menuService.refreshMenuData();
    }, [menuService]);
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    return {
        // Data
        menuItems,
        categories,
        // State
        isLoading,
        isRefreshing,
        error,
        // Actions
        refetch: fetchData,
        refresh,
        clearError,
        // Cache management
        invalidateCache,
    };
}
/**
 * Hook for fetching a single menu item by ID
 */
export function useMenuItemById(id, enabled = true) {
    const menuService = getMenuService();
    // State
    const [menuItem, setMenuItem] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled || !id) {
            setMenuItem(null);
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            const item = await menuService.getMenuItemById(id);
            setMenuItem(item);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch menu item';
            setError(errorMessage);
            console.error('useMenuItemById: Failed to fetch item:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, id, menuService]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    return {
        // Data
        menuItem,
        // State
        isLoading,
        error,
        // Actions
        refetch: fetchData,
        clearError,
    };
}
/**
 * Hook for fetching menu categories only
 */
export function useMenuCategories(enabled = true) {
    const menuService = getMenuService();
    // State
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled)
            return;
        try {
            setIsLoading(true);
            setError(null);
            const categoriesResponse = await menuService.getCategories();
            setCategories(categoriesResponse);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
            setError(errorMessage);
            console.error('useMenuCategories: Failed to fetch categories:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, menuService]);
    // Refresh function (force reload with cache invalidation)
    const refresh = useCallback(async () => {
        // Invalidate cache before fetching
        menuService.refreshMenuData();
        await fetchData();
    }, [fetchData, menuService]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    return {
        // Data
        categories,
        // State
        isLoading,
        error,
        // Actions
        refetch: fetchData,
        refresh,
        clearError,
    };
}
/**
 * Hook for menu items by category (optimized query)
 */
export function useMenuItemsByCategory(category, params = {}, enabled = true) {
    const menuService = getMenuService();
    // State
    const [data, setData] = useState({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    // Memoize params
    const stableParams = useMemo(() => ({
        page: params.page || 1,
        pageSize: params.pageSize || 12,
    }), [params.page, params.pageSize]);
    // Fetch function
    const fetchData = useCallback(async (isRefresh = false) => {
        if (!enabled || !category) {
            setData({ items: [], total: 0, page: 1, pageSize: 12 });
            return;
        }
        try {
            if (isRefresh) {
                setIsRefreshing(true);
            }
            else {
                setIsLoading(true);
            }
            setError(null);
            const response = await menuService.getMenuItemsByCategory(category, stableParams);
            setData(response);
        }
        catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : 'Failed to fetch menu items by category';
            setError(errorMessage);
            console.error('useMenuItemsByCategory: Failed to fetch data:', err);
        }
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [enabled, category, stableParams, menuService]);
    // Refresh function
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Invalidate cache
    const invalidateCache = useCallback(() => {
        menuService.refreshMenuData();
    }, [menuService]);
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    return {
        // Data
        menuItems: data.items,
        categories: [], // Not applicable for this hook
        totalItems: data.total,
        currentPage: data.page,
        pageSize: data.pageSize,
        // State
        isLoading,
        isRefreshing,
        error,
        // Actions
        refetch: fetchData,
        refresh,
        clearError,
        // Cache management
        invalidateCache,
    };
}
