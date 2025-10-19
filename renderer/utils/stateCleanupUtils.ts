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
 */
export const resetAllStores = () => {
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
 */
export const checkForStaleData = async (): Promise<boolean> => {
  let staleDataFound = false;

  // Check POS store for inconsistencies
  const posStore = usePOSStore.getState();

  // Check for orders with invalid tables
  if (posStore.currentOrder && posStore.currentOrder.tableId) {
    const tableExists = posStore.tables.some(
      t => t.id === posStore.currentOrder?.tableId
    );
    if (!tableExists) {
      console.warn(
        '🔍 Detected stale data: Current order references non-existent table'
      );
      staleDataFound = true;
    }
  }

  // Check for tables with non-existent orders
  for (const table of posStore.tables) {
    if (table.activeOrder) {
      const orderExists = posStore.allOrders.some(
        o => o.id === table.activeOrder?.id
      );
      if (!orderExists) {
        console.warn(
          '🔍 Detected stale data: Table references non-existent order'
        );
        staleDataFound = true;
      }
    }
  }

  // Add more checks as needed...

  return staleDataFound;
};

/**
 * Apply state cleanup on application startup
 */
export const applyStateCleanup = async () => {
  console.log('🔄 Performing application state cleanup on startup...');

  try {
    // First check if we have stale data
    const hasStaleData = await checkForStaleData();

    // If stale data is detected, reset all stores
    if (hasStaleData) {
      console.log('⚠️ Stale data detected, performing full state reset');
      resetAllStores();
    } else {
      console.log('✅ No stale data detected, state cleanup not needed');
    }
  } catch (error) {
    console.error('❌ Error during state cleanup:', error);
    // Reset anyway as a precaution if the check fails
    resetAllStores();
  }

  console.log('✅ State cleanup process complete');
};
