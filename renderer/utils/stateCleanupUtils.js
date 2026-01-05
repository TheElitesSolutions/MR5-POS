/**
 * State Cleanup Utilities
 *
 * These utilities help ensure clean application state when starting/restarting the app.
 * They prevent data inconsistencies by resetting store states to their initial values.
 */
import { usePOSStore } from '@/stores/posStore';
import { useAuthStore } from '@/stores/authStore';
import { useMenuStore } from '@/stores/menuStore';
import { useOrdersStore } from '@/stores/ordersStore';
import { useStockStore } from '@/stores/stockStore';
import { useExpensesStore } from '@/stores/expensesStore';
/**
 * Reset all application stores to their initial state
 *
 * ⚠️ WARNING: This function clears ALL store state including active orders!
 * Only call this when absolutely necessary (e.g., actual data corruption detected)
 */
export const resetAllStores = () => {
    const posStore = usePOSStore.getState();
    // Log the reset with full context for debugging
    console.warn('⚠️ RESETTING ALL STORES - Current state before reset:', {
        hadCurrentOrder: !!posStore.currentOrder,
        currentOrderId: posStore.currentOrder?.id,
        currentOrderItems: posStore.currentOrder?.items?.length || 0,
        selectedTable: posStore.selectedTable?.name,
        tablesCount: posStore.tables.length,
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack, // Capture where this was called from
    });
    // Reset POS store state
    usePOSStore.setState({
        tables: [],
        isLoading: false,
        error: null,
        selectedTable: null,
        activeOrder: null,
        currentOrder: null,
        allOrders: [],
        isLoadingOrders: false,
        ordersError: null,
        lastOrdersRefresh: 0,
        isOnline: true,
        pendingActions: [],
        offlineMode: false,
        menuItems: [],
        categories: [],
        pendingItems: [],
        viewMode: 'tables',
        orderType: 'DINE_IN',
    });
    // Reset Auth store state (preserve tokens for authentication)
    const currentUser = useAuthStore.getState().user;
    const accessToken = useAuthStore.getState().accessToken;
    const refreshToken = useAuthStore.getState().refreshToken;
    useAuthStore.setState({
        user: currentUser, // Keep user info
        accessToken, // Keep access token
        refreshToken, // Keep refresh token
        isAuthenticated: !!accessToken,
        isLoading: false,
        error: null,
    });
    // Reset Menu store state
    useMenuStore.setState({
        menuItems: [],
        categories: [],
        isLoading: false,
        error: null,
    });
    // Reset Orders store state
    useOrdersStore.setState({
        orders: [],
        isLoading: false,
        error: null,
    });
    // Reset Stock store state
    useStockStore.setState({
        stockItems: [],
        isLoading: false,
        error: null,
    });
    // Reset Expenses store state
    useExpensesStore.setState({
        expenses: [],
        isLoading: false,
        error: null,
    });
    console.log('✅ Application state reset complete');
};
/**
 * Check for stale data conditions that might indicate data corruption
 *
 * IMPORTANT: This function should only run after stores are properly initialized
 * to avoid false positives from race conditions.
 */
export const checkForStaleData = async () => {
    let staleDataFound = false;
    // Check POS store for inconsistencies
    const posStore = usePOSStore.getState();
    // ⚠️ CRITICAL FIX: Only run checks if stores are actually initialized
    // Prevents false positives when tables array hasn't been populated yet
    const isInitialized = posStore.tables.length > 0;
    if (!isInitialized) {
        console.log('🔍 Stale data check: Stores not yet initialized, skipping checks');
        return false; // No stale data - just not initialized yet
    }
    console.log('🔍 Running stale data checks:', {
        tablesCount: posStore.tables.length,
        hasCurrentOrder: !!posStore.currentOrder,
        currentOrderId: posStore.currentOrder?.id,
        currentOrderTableId: posStore.currentOrder?.tableId,
    });
    // Check for orders with invalid tables (only for DINE_IN orders with tableId)
    if (posStore.currentOrder && posStore.currentOrder.tableId) {
        const tableExists = posStore.tables.some(t => t.id === posStore.currentOrder?.tableId);
        if (!tableExists) {
            console.warn('🔍 Detected stale data: Current order references non-existent table', {
                orderId: posStore.currentOrder.id,
                tableId: posStore.currentOrder.tableId,
                availableTables: posStore.tables.map(t => t.id),
            });
            staleDataFound = true;
        }
    }
    // ⚠️ CRITICAL FIX: Removed broken check for table.activeOrder in allOrders
    // The original check was fundamentally broken because:
    // 1. allOrders only contains TAKEOUT/DELIVERY orders (see posStore.fetchAllOrders)
    // 2. Dine-in orders are NEVER in allOrders, causing false positives
    // 3. This caused all table orders to be flagged as "stale" incorrectly
    //
    // If we need to validate table.activeOrder exists, we should:
    // - Query the database directly via orderAPI.getById(table.activeOrder.id)
    // - OR: Accept that table.activeOrder might be temporarily out of sync
    // - OR: Add dine-in orders to allOrders array (requires significant refactoring)
    console.log('🔍 Stale data check complete:', {
        staleDataFound,
        reason: staleDataFound ? 'Invalid table reference' : 'No issues detected',
    });
    return staleDataFound;
};
/**
 * Apply state cleanup on application startup
 *
 * This function is designed to detect and recover from data corruption.
 * It should ONLY be called on actual app startup, not on navigation or focus events.
 */
export const applyStateCleanup = async () => {
    const timestamp = new Date().toISOString();
    console.log('🔄 Performing application state cleanup on startup...', {
        timestamp,
        caller: new Error().stack?.split('\n')[2]?.trim(), // Log where this was called from
    });
    try {
        // First check if we have stale data
        const hasStaleData = await checkForStaleData();
        // If stale data is detected, reset all stores
        if (hasStaleData) {
            console.warn('⚠️ STALE DATA DETECTED - Performing full state reset', {
                timestamp,
                reason: 'Stale data validation failed',
            });
            resetAllStores();
        }
        else {
            console.log('✅ No stale data detected, state cleanup not needed', {
                timestamp,
            });
        }
    }
    catch (error) {
        console.error('❌ Error during state cleanup:', error, {
            timestamp,
            errorDetails: error instanceof Error ? error.message : 'Unknown error',
        });
        // CRITICAL DECISION: Should we reset on error?
        // Conservative approach: Don't reset unless we have clear evidence of corruption
        // This prevents accidental data loss from transient errors
        console.warn('⚠️ Skipping state reset due to check error - maintaining current state');
        // resetAllStores(); // DISABLED: Don't reset on error to prevent data loss
    }
    console.log('✅ State cleanup process complete', { timestamp });
};
