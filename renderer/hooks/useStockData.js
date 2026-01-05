/**
 * useStockData Hook - React Integration for Stock Service
 *
 * This hook provides:
 * 1. Clean React integration with StockService
 * 2. Automatic data fetching with proper loading states
 * 3. Error handling and retry mechanisms
 * 4. Memoized queries to prevent unnecessary re-renders
 * 5. Cache invalidation and refresh capabilities
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getStockService } from '../services/ServiceContainer';
// Shared ref to track if the initial fetch has been made
// This prevents duplicate requests during component mounting
const hasInitialFetchRef = { current: false };
// Reset function to clear the global ref if needed
export const resetStockDataFetch = () => {
    hasInitialFetchRef.current = false;
};
/**
 * Hook for fetching stock items with filtering
 */
export function useStockItems(options = {}) {
    const { enabled = true, refetchOnMount = false, refetchInterval, ...queryParams } = options;
    const stockService = getStockService();
    // State
    const [stockItems, setStockItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    // Component-specific ref to track if this instance has fetched
    const componentHasFetchedRef = useRef(false);
    // Memoize query params to prevent unnecessary re-fetches
    const stableQueryParams = useMemo(() => {
        return {
            category: queryParams.category || '',
            lowStockOnly: queryParams.lowStockOnly || false,
            search: queryParams.search || '',
            page: queryParams.page || 0,
            pageSize: queryParams.pageSize || 0,
        };
    }, [
        queryParams.category,
        queryParams.lowStockOnly,
        queryParams.search,
        queryParams.page,
        queryParams.pageSize,
    ]);
    // Fetch function
    const fetchData = useCallback(async (isRefresh = false, forceRefresh = false) => {
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
            const queryParams = forceRefresh
                ? { ...stableQueryParams, force: true }
                : stableQueryParams;
            const items = await stockService.getStockItems(queryParams);
            console.log('useStockItems: Fetched items from service:', items);
            setStockItems(items);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock data';
            setError(errorMessage);
            console.error('useStockItems: Failed to fetch data:', err);
        }
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [enabled, stableQueryParams, stockService]);
    // Refresh function (force reload)
    const refresh = useCallback(async () => {
        // Invalidate cache and force fresh fetch bypassing RequestManager cache checks
        const invalidatedCount = stockService.invalidateAllCaches();
        console.log(`🔄 useStockItems: Invalidated ${invalidatedCount} cache entries before refresh`);
        await fetchData(true, true); // isRefresh=true, forceRefresh=true
    }, [fetchData, stockService]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Invalidate cache
    const invalidateCache = useCallback(() => {
        stockService.refreshStockData();
    }, [stockService]);
    // Initial fetch - improved to refresh after changes
    useEffect(() => {
        console.log('useStockItems: Initial fetch check', {
            enabled,
            hasInitialFetchRef: hasInitialFetchRef.current,
            componentHasFetchedRef: componentHasFetchedRef.current,
        });
        // Always fetch on component mount to ensure freshness
        if (enabled) {
            console.log('useStockItems: Starting fetch');
            // Reset the global ref on each mount to force new data fetch
            hasInitialFetchRef.current = false;
            componentHasFetchedRef.current = true;
            fetchData();
        }
        else {
            console.log('useStockItems: Skipping fetch - not enabled');
        }
    }, [enabled, fetchData]);
    // Refetch on mount if requested
    useEffect(() => {
        if (refetchOnMount) {
            refresh();
        }
    }, [refetchOnMount, refresh]);
    // Auto-refetch interval
    useEffect(() => {
        if (!refetchInterval || refetchInterval <= 0)
            return;
        const interval = setInterval(() => {
            fetchData(true);
        }, refetchInterval);
        return () => clearInterval(interval);
    }, [refetchInterval, fetchData]);
    return {
        // Data
        stockItems,
        totalItems: stockItems.length,
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
 * Hook for fetching a single stock item by ID
 */
export function useStockItemById(id, enabled = true) {
    const stockService = getStockService();
    // State
    const [stockItem, setStockItem] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled || !id) {
            setStockItem(null);
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            const item = await stockService.getStockItemById(id);
            setStockItem(item);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock item';
            setError(errorMessage);
            console.error('useStockItemById: Failed to fetch item:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, id, stockService]);
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
        stockItem,
        // State
        isLoading,
        error,
        // Actions
        refetch: fetchData,
        clearError,
    };
}
/**
 * Hook for fetching stock categories only
 */
export function useStockCategories(enabled = true) {
    const stockService = getStockService();
    // State
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Component-specific ref to track if this instance has fetched
    const componentHasFetchedRef = useRef(false);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled)
            return;
        try {
            setIsLoading(true);
            setError(null);
            const categoriesResponse = await stockService.getStockCategories();
            setCategories(categoriesResponse);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
            setError(errorMessage);
            console.error('useStockCategories: Failed to fetch categories:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, stockService]);
    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Refresh function to invalidate cache and refetch
    const refresh = useCallback(async () => {
        // Invalidate cache ONLY - don't prefetch to avoid reading stale prefetched data
        const invalidatedCount = stockService.invalidateAllCaches();
        console.log(`🔄 useStockCategories: Invalidated ${invalidatedCount} cache entries before refresh`);
        await fetchData();
    }, [fetchData, stockService]);
    // Initial fetch - let service layer handle deduplication
    useEffect(() => {
        // Only fetch if enabled and this component hasn't fetched yet
        if (enabled && !componentHasFetchedRef.current) {
            componentHasFetchedRef.current = true;
            fetchData();
        }
    }, [enabled, fetchData]);
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
 * Hook for fetching low stock alerts
 */
export function useLowStockAlerts(enabled = true) {
    const stockService = getStockService();
    // State
    const [lowStockItems, setLowStockItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled)
            return;
        try {
            setIsLoading(true);
            setError(null);
            const alerts = await stockService.getLowStockItems();
            const items = alerts.map(alert => alert.item);
            setLowStockItems(items);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch low stock alerts';
            setError(errorMessage);
            console.error('useLowStockAlerts: Failed to fetch alerts:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, stockService]);
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
        lowStockItems,
        totalAlerts: lowStockItems.length,
        // State
        isLoading,
        error,
        // Actions
        refetch: fetchData,
        clearError,
    };
}
/**
 * Hook for checking ingredient availability for menu items
 */
export function useIngredientAvailability(ingredientIds, requiredQuantities, enabled = true) {
    const stockService = getStockService();
    // State
    const [availableIngredients, setAvailableIngredients] = useState([]);
    const [unavailableIngredients, setUnavailableIngredients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Memoize params to prevent unnecessary re-fetches
    const stableParams = useMemo(() => ({
        ingredientIds,
        requiredQuantities,
    }), [ingredientIds.join(','), requiredQuantities.join(',')]);
    // Fetch function
    const fetchData = useCallback(async () => {
        if (!enabled || ingredientIds.length === 0) {
            setAvailableIngredients([]);
            setUnavailableIngredients([]);
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            const availability = await stockService.checkIngredientAvailability(stableParams.ingredientIds, stableParams.requiredQuantities);
            const available = [];
            const unavailable = [];
            for (const [ingredientId, isAvailable] of Object.entries(availability)) {
                if (isAvailable) {
                    available.push(ingredientId);
                }
                else {
                    unavailable.push(ingredientId);
                }
            }
            setAvailableIngredients(available);
            setUnavailableIngredients(unavailable);
        }
        catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : 'Failed to check ingredient availability';
            setError(errorMessage);
            console.error('useIngredientAvailability: Failed to check availability:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [enabled, stockService, stableParams]);
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
        availableIngredients,
        unavailableIngredients,
        isAllAvailable: unavailableIngredients.length === 0,
        // State
        isLoading,
        error,
        // Actions
        refetch: fetchData,
        clearError,
    };
}
/**
 * Hook for all stock data (for dashboard)
 */
export function useAllStockData(enabled = true) {
    const { stockItems, isLoading: itemsLoading, error: itemsError, } = useStockItems({ enabled });
    const { lowStockItems, isLoading: alertsLoading, error: alertsError, } = useLowStockAlerts(enabled);
    const { categories, isLoading: categoriesLoading, error: categoriesError, } = useStockCategories(enabled);
    // Combined state
    const isLoading = itemsLoading || alertsLoading || categoriesLoading;
    const error = itemsError || alertsError || categoriesError;
    // Computed metrics
    const totalValue = useMemo(() => {
        return stockItems.reduce((sum, item) => sum + item.currentQuantity * item.costPerUnit, 0);
    }, [stockItems]);
    const categoryBreakdown = useMemo(() => {
        const breakdown = {};
        stockItems.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!breakdown[category]) {
                breakdown[category] = { count: 0, value: 0, lowStock: 0 };
            }
            breakdown[category].count += 1;
            breakdown[category].value += item.currentQuantity * item.costPerUnit;
            if (item.currentQuantity <= item.minimumQuantity) {
                breakdown[category].lowStock += 1;
            }
        });
        return breakdown;
    }, [stockItems]);
    return {
        // Data
        stockItems,
        lowStockItems,
        categories,
        totalValue,
        categoryBreakdown,
        // State
        isLoading,
        error,
    };
}
