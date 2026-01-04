import { inventoryAPI, menuAPI, orderAPI, tableAPI } from '@/lib/ipc-api';
import type { MenuItem, Order, OrderItem, Table } from '@/types';
import { create } from 'zustand';
import { TableStatus, OrderType } from '../../shared/ipc-types';
import type { Order as IPCOrder, Table as IPCTable } from '../../shared/ipc-types';
import { useAuthStore } from './authStore';
import type { SimpleOrderTracking } from '@/hooks/useSimpleOrderTracking';
import { getMenuService } from '@/services/domain/MenuService';

// Helper function to convert IPC Order to renderer Order
function convertIPCOrderToRendererOrder(ipcOrder: IPCOrder): Order {
  return {
    id: ipcOrder.id,
    orderNumber: ipcOrder.orderNumber,
    tableId: ipcOrder.tableId,
    tableNumber: undefined,
    type: ipcOrder.type as any,
    status: ipcOrder.status as any,
    items: (ipcOrder.items || []) as any[],
    totalAmount: ipcOrder.total,
    total: ipcOrder.total,
    subtotal: ipcOrder.subtotal,
    tax: ipcOrder.tax,
    deliveryFee: undefined,
    customerName: ipcOrder.customerName,
    customerPhone: ipcOrder.customerPhone,
    deliveryAddress: ipcOrder.deliveryAddress,
    notes: ipcOrder.notes,
    createdAt: typeof ipcOrder.createdAt === 'string' ? ipcOrder.createdAt : ipcOrder.createdAt.toISOString(),
    updatedAt: typeof ipcOrder.updatedAt === 'string' ? ipcOrder.updatedAt : ipcOrder.updatedAt.toISOString(),
  };
}

// Helper function to convert IPC Table to renderer Table
function convertIPCTableToRendererTable(ipcTable: IPCTable): Table {
  return {
    id: ipcTable.id,
    name: ipcTable.name,
    status: ipcTable.status as string,
    isPayLater: ipcTable.isPayLater,
    createdAt: ipcTable.createdAt as any,
    updatedAt: ipcTable.updatedAt as any,
    activeOrder: ipcTable.activeOrder ? convertIPCOrderToRendererOrder(ipcTable.activeOrder) : null,
  };
}

interface Customization {
  type: string;
  name: string; // Changed from 'value' to 'name' for consistency
  priceAdjustment: number;
}

interface PosState {
  tables: Table[];
  isLoading: boolean;
  error: string | null;
  selectedTable: Table | null;
  activeOrder: Order | null;
  currentOrder: Order | null;
  // Global orders management for takeout/delivery
  allOrders: Order[];
  isLoadingOrders: boolean;
  ordersError: string | null;
  lastOrdersRefresh: number;
  // Network and offline handling
  isOnline: boolean;
  pendingActions: Array<{ action: string; data: any; timestamp: number }>;
  offlineMode: boolean;
  menuItems: MenuItem[];
  categories: string[];
  pendingItems: OrderItem[];
  viewMode: string;
  orderType: OrderType;
  tableTab: 'DINE_IN' | 'NOT_PAID';

  // Enhanced order change tracking with data loss prevention
  orderChanges: Map<string, SimpleOrderTracking>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveRetryCount: Map<string, number>;
  fetchInProgress: boolean; // Prevents concurrent fetch operations
  setOrderChanges: (changes: Map<string, SimpleOrderTracking>) => void;
  savePendingChanges: (
    orderId: string,
    options?: { silent?: boolean; maxRetries?: number }
  ) => Promise<boolean>;
  backupToLocalStorage: (orderId: string) => void;
  restoreFromLocalStorage: (orderId: string) => SimpleOrderTracking | null;
  clearLocalStorageBackup: (orderId: string) => void;

  // Real IPC implementation methods
  fetchTables: () => Promise<void>;
  selectTable: (tableId: string | Table) => Promise<void>;
  createTable: (name: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  toggleTablePayLater: (tableId: string) => Promise<void>;
  setTableTab: (tab: 'DINE_IN' | 'NOT_PAID') => void;
  getTableStatus: (tableId: string) => string;
  createOrder: (tableId: string) => Promise<void>;
  createTakeawayDeliveryOrder: (
    orderType: 'TAKEOUT' | 'DELIVERY',
    customerDetails: { name?: string; phone: string; address?: string }
  ) => Promise<void>;
  selectTakeawayDeliveryOrder: (order: Order) => Promise<void>;
  setOrderType: (type: OrderType) => void;
  // Global orders management
  fetchAllOrders: (retryCount?: number) => Promise<void>;
  refreshOrders: () => Promise<void>;
  updateOrderInStore: (updatedOrder: Order, forceUpdate?: boolean) => void;
  removeOrderFromStore: (orderId: string) => void;
  // Network and offline handling
  setOnlineStatus: (isOnline: boolean) => void;
  addPendingAction: (action: string, data: any) => void;
  processPendingActions: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  addItemToOrder: (
    menuItem: MenuItem,
    quantity: number,
    notes?: string
  ) => void;
  addOrderItem: (
    menuItemId: string,
    quantity: number,
    customizations?: Customization[],
    notes?: string
  ) => Promise<Order>;
  removeItemFromOrder: (orderItemId: string) => void;
  removeOrderItem: (orderItemId: string) => Promise<void>;
  updateOrderItemQuantity: (orderItemId: string, quantity: number) => void;
  updateOrderItem: (orderItemId: string, quantity: number) => Promise<void>;
  completeOrder: () => Promise<void>;
  cancelCurrentOrder: () => Promise<void>;
  cancelOrder: () => Promise<void>;
  clearCurrentOrder: () => void;
  switchToTables: () => void;
  switchToMenu: () => void;
  isDineIn: () => boolean;
  clearError: () => void;
}

export const usePOSStore = create<PosState>((set, get) => ({
  tables: [],
  isLoading: false,
  error: null,
  selectedTable: null,
  activeOrder: null,
  currentOrder: null,
  // Global orders state
  allOrders: [],
  isLoadingOrders: false,
  ordersError: null,
  lastOrdersRefresh: 0,
  // Network and offline state
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingActions: [],
  offlineMode: false,
  menuItems: [],
  categories: [],
  pendingItems: [],
  viewMode: 'tables',
  orderType: OrderType.DINE_IN,
  tableTab: 'DINE_IN',

  // Enhanced order change tracking with data loss prevention
  orderChanges: new Map(),
  isSaving: false,
  hasUnsavedChanges: false,
  saveRetryCount: new Map(),
  fetchInProgress: false,
  setOrderChanges: (changes: Map<string, SimpleOrderTracking>) => {
    const hasAnyChanges = Array.from(changes.values()).some(
      tracking =>
        tracking.newItems.length > 0 ||
        Object.keys(tracking.netChanges).length > 0 ||
        tracking.removedItems.length > 0
    );
    set({
      orderChanges: changes,
      hasUnsavedChanges: hasAnyChanges,
    });
  },

  savePendingChanges: async (
    orderId: string,
    options: { silent?: boolean; maxRetries?: number } = {}
  ) => {
    const { silent = false, maxRetries = 3 } = options;
    const { orderChanges, saveRetryCount, isSaving } = get();

    // Prevent concurrent saves
    if (isSaving) {
      console.log('📝 SAVE: Save already in progress, skipping');
      return false;
    }

    const tracking = orderChanges.get(orderId);
    if (!tracking) {
      console.log('📝 SAVE: No pending changes found for order', orderId);
      return true;
    }

    const { newItems, netChanges, removedItems } = tracking;
    const hasChanges =
      newItems.length > 0 ||
      Object.keys(netChanges).length > 0 ||
      removedItems.length > 0;

    if (!hasChanges) {
      console.log('📝 SAVE: No changes to save for order', orderId);
      return true;
    }

    // Backup to localStorage before attempting save
    get().backupToLocalStorage(orderId);

    const currentRetryCount = saveRetryCount.get(orderId) || 0;

    console.log('📝 SAVE: Processing pending changes for order', orderId, {
      newItems: newItems.length,
      netChanges: Object.keys(netChanges).length,
      removedItems: removedItems.length,
      retryAttempt: currentRetryCount + 1,
      maxRetries,
    });

    set({ isSaving: true });

    try {
      // Save new items
      for (const item of newItems) {
        console.log('📝 SAVE: Adding new item', item);
        await get().addOrderItem(item.menuItemId, item.quantity);
      }

      // Save quantity changes
      for (const [itemId, change] of Object.entries(netChanges)) {
        const netQuantity = change.currentQty;
        console.log('📝 SAVE: Updating item quantity', {
          itemId,
          newQuantity: netQuantity,
        });
        await orderAPI.updateItemQuantity({
          itemId,
          quantity: netQuantity,
          userId: 'system-auto-save',
        });
      }

      // Handle removals (these should already be processed immediately)
      for (const item of removedItems) {
        console.log('📝 SAVE: Removing item', item);
        await orderAPI.removeItem({
          orderId,
          itemId: item.id,
          userId: 'system-auto-save',
        });
      }

      // Clear tracking after successful save
      const updatedChanges = new Map(orderChanges);
      const updatedRetryCount = new Map(saveRetryCount);
      updatedChanges.delete(orderId);
      updatedRetryCount.delete(orderId);

      set({
        orderChanges: updatedChanges,
        saveRetryCount: updatedRetryCount,
        isSaving: false,
        hasUnsavedChanges: Array.from(updatedChanges.values()).some(
          t =>
            t.newItems.length > 0 ||
            Object.keys(t.netChanges).length > 0 ||
            t.removedItems.length > 0
        ),
      });

      // Clear localStorage backup after successful save
      get().clearLocalStorageBackup(orderId);

      console.log(
        '✅ SAVE: All pending changes saved successfully for order',
        orderId
      );
      return true;
    } catch (error) {
      set({ isSaving: false });
      console.error('❌ SAVE: Failed to save pending changes', error);

      const newRetryCount = currentRetryCount + 1;
      const updatedRetryCount = new Map(saveRetryCount);
      updatedRetryCount.set(orderId, newRetryCount);
      set({ saveRetryCount: updatedRetryCount });

      // Retry with exponential backoff if we haven't exceeded max retries
      if (newRetryCount <= maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 5000); // Max 5s delay
        console.log(
          `🔄 SAVE: Retrying save in ${delay}ms (attempt ${newRetryCount}/${maxRetries})`
        );

        return new Promise(resolve => {
          setTimeout(async () => {
            const success = await get().savePendingChanges(orderId, {
              silent,
              maxRetries,
            });
            resolve(success);
          }, delay);
        });
      }

      // All retries exhausted - notify user if not silent
      if (!silent && typeof window !== 'undefined') {
        const userConfirmed = confirm(
          `Failed to save your order changes after ${maxRetries} attempts. ` +
            'Your changes have been backed up locally. ' +
            'Do you want to continue anyway? (Changes will be lost if you proceed)'
        );

        if (!userConfirmed) {
          // User chose not to proceed - return false to prevent context switch
          return false;
        }
      }

      return false;
    }
  },

  fetchTables: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await tableAPI.getAll();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch tables');
      }

      // Backend already provides tables with active orders and correct status
      // No need to manually attach orders - the JOIN query handles this
      const tables: Table[] = (response.data as IPCTable[]).map(convertIPCTableToRendererTable);

      set({ tables, isLoading: false });
      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Fetched tables successfully', {
          tablesCount: tables.length,
          tablesWithOrders: tables.filter(t => t.activeOrder).length,
          tableStatuses: tables.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            hasActiveOrder: !!t.activeOrder,
          })),
        });
      }
    } catch (error) {
      console.error('POS Store: Failed to fetch tables', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch tables',
        isLoading: false,
      });
    }
  },

  selectTable: async (table: string | Table) => {
    const { tables, currentOrder, orderChanges } = get();

    // Auto-save pending changes before switching tables
    if (currentOrder?.id && orderChanges.has(currentOrder.id)) {
      const tracking = orderChanges.get(currentOrder.id);
      const hasChanges =
        tracking &&
        (tracking.newItems.length > 0 ||
          Object.keys(tracking.netChanges).length > 0 ||
          tracking.removedItems.length > 0);

      if (hasChanges) {
        console.log(
          '🔄 AUTO-SAVE: Saving pending changes before switching tables',
          {
            fromOrderId: currentOrder.id,
            changes: {
              newItems: tracking.newItems.length,
              netChanges: Object.keys(tracking.netChanges).length,
              removedItems: tracking.removedItems.length,
            },
          }
        );

        const saveSuccess = await get().savePendingChanges(currentOrder.id, {
          silent: false,
          maxRetries: 3,
        });

        if (!saveSuccess) {
          console.error(
            '❌ AUTO-SAVE: Failed to save pending changes, blocking table switch'
          );
          // CRITICAL FIX: Do NOT continue with table switch if save fails
          return; // Exit early - prevent context switch on save failure
        }

        console.log('✅ AUTO-SAVE: Successfully saved pending changes');
      }
    }

    if (typeof table === 'object') {
      // Verify the table still exists in the current tables array
      const tableExists = tables.find(t => t.id === table.id);
      if (tableExists) {
        // CRITICAL FIX: If there's an active order, fetch fresh data from database
        if (table.activeOrder?.id) {
          try {
            console.log(
              '🔍 POS Store: Fetching fresh order data for table',
              table.name,
              {
                activeOrderId: table.activeOrder.id,
                cachedItemsCount: table.activeOrder.items?.length || 0,
              }
            );
            const orderResp = await orderAPI.getById(table.activeOrder.id);
            const freshOrder =
              orderResp.success && orderResp.data
                ? convertIPCOrderToRendererOrder(orderResp.data as IPCOrder)
                : table.activeOrder;

            // CRITICAL FIX: Deduplicate items and create completely fresh object references to force React re-render
            const deduplicatedItems = freshOrder.items ? (() => {
              const uniqueItemsMap = new Map<string, any>();
              freshOrder.items.forEach((item: any) => {
                uniqueItemsMap.set(item.id, { ...item });
              });
              return Array.from(uniqueItemsMap.values());
            })() : [];

            const ultraFreshOrder = {
              ...freshOrder,
              items: deduplicatedItems,
            };

            if (freshOrder.items && freshOrder.items.length !== deduplicatedItems.length) {
              console.log('🔧 DEDUP (selectTable): Removed duplicate items', {
                tableId: table.id,
                tableName: table.name,
                orderId: freshOrder.id,
                originalCount: freshOrder.items.length,
                deduplicatedCount: deduplicatedItems.length,
                duplicatesRemoved: freshOrder.items.length - deduplicatedItems.length,
                timestamp: new Date().toISOString(),
              });
            }

            set({
              selectedTable: table,
              viewMode: 'tables',
              currentOrder: ultraFreshOrder,
              activeOrder: ultraFreshOrder,
            });
          } catch (error) {
            console.warn(
              '⚠️ POS Store: Failed to fetch fresh order data, using cached data',
              error
            );
            set({
              selectedTable: table,
              viewMode: 'tables',
              currentOrder: table.activeOrder || null,
              activeOrder: table.activeOrder || null,
            });
          }
        } else {
          set({
            selectedTable: table,
            viewMode: 'tables',
            currentOrder: table.activeOrder || null,
            activeOrder: table.activeOrder || null,
          });
        }
      } else {
        console.warn(
          'POS Store: Attempted to select non-existent table',
          table.name
        );
      }
    } else {
      // Handle table ID
      const foundTable = tables.find(t => t.id === table);
      if (foundTable) {
        // CRITICAL FIX: If there's an active order, fetch fresh data from database
        if (foundTable.activeOrder?.id) {
          try {
            const orderResp = await orderAPI.getById(foundTable.activeOrder.id);
            const freshOrder =
              orderResp.success && orderResp.data
                ? convertIPCOrderToRendererOrder(orderResp.data as IPCOrder)
                : foundTable.activeOrder;

            // CRITICAL FIX: Create completely fresh object references to force React re-render
            const ultraFreshOrder = {
              ...freshOrder,
              items: freshOrder.items
                ? freshOrder.items.map(item => ({ ...item }))
                : [],
            };

            set({
              selectedTable: foundTable,
              viewMode: 'tables',
              currentOrder: ultraFreshOrder,
              activeOrder: ultraFreshOrder,
            });

            // 🔍 DEBUG: Verify state was set correctly
            const { currentOrder: verifyCurrentOrder } = get();
            console.log(
              '🔍 DEBUG: After setting state (table ID) - currentOrder check:',
              {
                setCurrentOrderId: ultraFreshOrder.id,
                verifyCurrentOrderId: verifyCurrentOrder?.id,
                verifyItemsCount: verifyCurrentOrder?.items?.length || 0,
                stateSetSuccessfully:
                  verifyCurrentOrder?.id === ultraFreshOrder.id,
              }
            );

            console.log(
              '🔄 POS Store: SelectTableById - Ultra fresh order state set:',
              {
                orderId: ultraFreshOrder.id,
                itemsCount: ultraFreshOrder.items?.length || 0,
                hasItemsArray: Array.isArray(ultraFreshOrder.items),
                timestamp: new Date().toISOString(),
              }
            );
            console.log(
              '✅ POS Store: Selected table by ID with fresh order data',
              foundTable.name,
              {
                orderId: freshOrder?.id,
                itemsCount: freshOrder?.items?.length || 0,
              }
            );
          } catch (error) {
            console.warn(
              '⚠️ POS Store: Failed to fetch fresh order data, using cached data',
              error
            );
            set({
              selectedTable: foundTable,
              viewMode: 'tables',
              currentOrder: foundTable.activeOrder || null,
              activeOrder: foundTable.activeOrder || null,
            });
          }
        } else {
          set({
            selectedTable: foundTable,
            viewMode: 'tables',
            currentOrder: foundTable.activeOrder || null,
            activeOrder: foundTable.activeOrder || null,
          });
        }
      } else {
        console.warn(
          'POS Store: Attempted to select table by ID that does not exist',
          table
        );
      }
    }
  },

  createTable: async (name: string) => {
    try {
      set({ isLoading: true, error: null });
      const tableData = {
        name: name.trim(),
        status: TableStatus.AVAILABLE,
      };
      const response = await tableAPI.create(tableData);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create table');
      }
      const newTable = convertIPCTableToRendererTable(response.data as IPCTable);
      const { tables } = get();

      // Update tables in state
      const updatedTables = [...tables, newTable];

      set({
        tables: updatedTables,
        // Auto-select the newly created table
        selectedTable: newTable,
        isLoading: false,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Created table successfully', newTable);
        console.log('POS Store: Auto-selecting new table', newTable.name);
        }

        // Automatically create an order for the newly created table
        try {
          console.log('POS Store: Creating order automatically for new table:', newTable.name);
          await get().createOrder(newTable.id);
          console.log('POS Store: Order created automatically for new table');
          
          // Switch to menu view so user can start adding items
          set({ viewMode: 'menu' });
        } catch (orderError) {
          console.error('POS Store: Failed to create order for new table:', orderError);
          // Don't throw - table was created successfully, just order creation failed
          // User can manually create order later via "Start Order" button
        }
      } catch (error) {
        console.error('POS Store: Failed to create table', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to create table',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteTable: async (tableId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await tableAPI.delete(tableId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete table');
      }
      const { tables, selectedTable } = get();

      // Check if the deleted table was the currently selected one
      const shouldClearSelection = selectedTable?.id === tableId;

      set({
        tables: tables.filter(table => table.id !== tableId),
        selectedTable: shouldClearSelection ? null : selectedTable,
        isLoading: false,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Deleted table successfully', tableId);
      }
    } catch (error) {
      console.error('POS Store: Failed to delete table', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to delete table',
        isLoading: false,
      });
      throw error;
    }
  },

  toggleTablePayLater: async (tableId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await tableAPI.togglePayLater(tableId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to toggle pay later status');
      }
      const updatedTable = convertIPCTableToRendererTable(response.data as IPCTable);
      const { tables, selectedTable } = get();
      // Update the table in the tables array
      const updatedTables = tables.map(table =>
        table.id === tableId ? updatedTable : table
      );
      set({
        tables: updatedTables,
        // Update selectedTable if it's the one being toggled
        selectedTable: selectedTable?.id === tableId ? updatedTable : selectedTable,
        isLoading: false,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Toggled pay later status successfully', tableId, updatedTable.isPayLater);
      }
    } catch (error) {
      console.error('POS Store: Failed to toggle pay later status', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to toggle pay later status',
        isLoading: false,
      });
      throw error;
    }
  },

  setTableTab: (tab: 'DINE_IN' | 'NOT_PAID') => {
    set({ tableTab: tab });
  },

  getTableStatus: (tableId: string) => {
    const { tables } = get();
    const table = tables.find(t => t.id === tableId);
    if (!table) return 'available';

    // Use the actual table status from backend
    // Backend provides correct status: AVAILABLE, OCCUPIED, RESERVED, OUT_OF_ORDER
    if (table.status === 'OCCUPIED' || table.activeOrder) {
      return 'occupied';
    }
    if (table.status === 'RESERVED') {
      return 'reserved';
    }
    if (table.status === 'OUT_OF_ORDER') {
      return 'out_of_order';
    }

    return 'available';
  },

  createOrder: async (tableId: string) => {
    try {
      set({ isLoading: true, error: null });

      // Validate tableId is provided and is valid
      if (!tableId) {
        throw new Error('Table ID is required for orders');
      }

      // Validate the table exists in our current state
      const { tables } = get();
      const table = tables.find(t => t.id === tableId);
      if (!table) {
        throw new Error(
          'Selected table not found. Please refresh and try again.'
        );
      }

      // Validate user is authenticated
      const user = useAuthStore.getState().user;
      if (!user?.id) {
        throw new Error('User must be authenticated to create orders');
      }

      const orderData = {
        type: OrderType.DINE_IN,
        tableId: tableId,
        items: [], // Start with empty items - items will be added after order creation
        userId: user.id,
        notes: '',
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Creating order with data:', orderData);
      }
      const response = await orderAPI.create(orderData);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create order');
      }

      const newOrder = convertIPCOrderToRendererOrder(response.data as IPCOrder);

      // CRITICAL FIX: Force immediate state update
      set({
        currentOrder: newOrder,
        activeOrder: newOrder,
        isLoading: false,
      });

      console.log('✅ POS Store: Order created and state updated:', {
        orderId: newOrder.id,
        hasItems: !!newOrder.items,
        itemsCount: newOrder.items?.length || 0,
      });

      // Refresh tables to update table status in UI and sync activeOrder
      await get().fetchTables();

      // CRITICAL FIX: Re-fetch the fresh table data and update currentOrder
      const { tables: freshTables, selectedTable } = get();
      const updatedTable = freshTables.find(t => t.id === selectedTable?.id);
      if (updatedTable?.activeOrder) {
        // Force React re-render by creating new object reference
        const freshOrder = { ...updatedTable.activeOrder };
        set({
          currentOrder: freshOrder,
          activeOrder: freshOrder,
        });
        console.log(
          '✅ POS Store: CurrentOrder synced with fresh table data:',
          {
            orderId: freshOrder.id,
            itemsCount: freshOrder.items?.length || 0,
            itemsData: freshOrder.items?.map(item => ({
              id: item.id,
              name: item.menuItemName || item.name,
              quantity: item.quantity,
            })),
          }
        );
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Created order successfully', newOrder);
      }
    } catch (error) {
      console.error('POS Store: Failed to create order', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to create order',
        isLoading: false,
      });
      throw error;
    }
  },

  createTakeawayDeliveryOrder: async (
    orderType: 'TAKEOUT' | 'DELIVERY',
    customerDetails: { name?: string; phone: string; address?: string }
  ) => {
    try {
      set({ isLoading: true, error: null });

      // Validate user is authenticated
      const user = useAuthStore.getState().user;
      if (!user?.id) {
        throw new Error('User must be authenticated to create orders');
      }

      // Validate required fields
      if (!customerDetails.phone?.trim()) {
        throw new Error('Customer phone number is required');
      }

      // Address is optional for delivery orders

      const orderData = {
        type: orderType as any,
        items: [], // Start with empty items - items will be added after order creation
        userId: user.id,
        notes: '',
        customerName: customerDetails.name?.trim() || undefined,
        customerPhone: customerDetails.phone.trim(),
        deliveryAddress:
          orderType === 'DELIVERY' ? customerDetails.address?.trim() : undefined,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Creating takeaway/delivery order:', orderData);
      }

      const response = await orderAPI.create(orderData);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create order');
      }

      const newOrder = convertIPCOrderToRendererOrder(response.data as IPCOrder);
      set({
        currentOrder: newOrder,
        activeOrder: newOrder,
        orderType: OrderType[orderType],
        isLoading: false,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Created takeaway/delivery order successfully',
          newOrder
        );
      }
    } catch (error) {
      console.error(
        'POS Store: Failed to create takeaway/delivery order',
        error
      );
      set({
        error:
          error instanceof Error ? error.message : 'Failed to create order',
        isLoading: false,
      });
      throw error;
    }
  },

  selectTakeawayDeliveryOrder: async (order: Order) => {
    const { currentOrder, orderChanges } = get();

    // Auto-save pending changes before switching orders
    if (currentOrder?.id && orderChanges.has(currentOrder.id)) {
      const tracking = orderChanges.get(currentOrder.id);
      const hasChanges =
        tracking &&
        (tracking.newItems.length > 0 ||
          Object.keys(tracking.netChanges).length > 0 ||
          tracking.removedItems.length > 0);

      if (hasChanges) {
        console.log(
          '🔄 AUTO-SAVE: Saving pending changes before switching orders',
          {
            fromOrderId: currentOrder.id,
            toOrderId: order.id,
            changes: {
              newItems: tracking.newItems.length,
              netChanges: Object.keys(tracking.netChanges).length,
              removedItems: tracking.removedItems.length,
            },
          }
        );

        const saveSuccess = await get().savePendingChanges(currentOrder.id, {
          silent: false,
          maxRetries: 3,
        });

        if (!saveSuccess) {
          console.error(
            '❌ AUTO-SAVE: Failed to save pending changes, blocking order switch'
          );
          // CRITICAL FIX: Do NOT continue with order switch if save fails
          return; // Exit early - prevent context switch on save failure
        }

        console.log('✅ AUTO-SAVE: Successfully saved pending changes');
      }
    }

    // CRITICAL FIX: Fetch fresh order data to ensure no stale data
    try {
      console.log(
        '🔍 POS Store: Fetching fresh order data for takeaway/delivery order',
        order.id
      );
      const orderResp = await orderAPI.getById(order.id);
      const freshOrder =
        orderResp.success && orderResp.data
          ? convertIPCOrderToRendererOrder(orderResp.data as IPCOrder)
          : order;

      // CRITICAL FIX: Deduplicate items and create completely fresh object references to force React re-render
      const deduplicatedItems = freshOrder.items ? (() => {
        const uniqueItemsMap = new Map<string, any>();
        freshOrder.items.forEach((item: any) => {
          uniqueItemsMap.set(item.id, { ...item });
        });
        return Array.from(uniqueItemsMap.values());
      })() : [];

      const ultraFreshOrder = {
        ...freshOrder,
        items: deduplicatedItems,
      };

      if (freshOrder.items && freshOrder.items.length !== deduplicatedItems.length) {
        console.log('🔧 DEDUP (selectTakeaway): Removed duplicate items', {
          orderId: freshOrder.id,
          orderType: freshOrder.type,
          originalCount: freshOrder.items.length,
          deduplicatedCount: deduplicatedItems.length,
          duplicatesRemoved: freshOrder.items.length - deduplicatedItems.length,
          timestamp: new Date().toISOString(),
        });
      }

      set({
        currentOrder: ultraFreshOrder,
        activeOrder: ultraFreshOrder,
        orderType: ultraFreshOrder.type as OrderType,
        selectedTable: null, // Clear table selection since this is takeaway/delivery
      });

      console.log(
        '🔄 POS Store: SelectTakeaway - Ultra fresh order state set:',
        {
          orderId: ultraFreshOrder.id,
          itemsCount: ultraFreshOrder.items?.length || 0,
          hasItemsArray: Array.isArray(ultraFreshOrder.items),
          timestamp: new Date().toISOString(),
        }
      );

      console.log(
        '✅ POS Store: Selected takeaway/delivery order with fresh data',
        {
          orderId: freshOrder.id,
          itemsCount: freshOrder.items?.length || 0,
          type: freshOrder.type,
        }
      );
    } catch (error) {
      console.warn(
        '⚠️ POS Store: Failed to fetch fresh order data, using cached data',
        error
      );
      set({
        currentOrder: order,
        activeOrder: order,
        orderType: order.type as OrderType,
        selectedTable: null, // Clear table selection since this is takeaway/delivery
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Selected takeaway/delivery order (cached data)',
          order
        );
      }
    }
  },

  addItemToOrder: (menuItem: MenuItem, quantity: number, notes?: string) => {
    const { currentOrder } = get();
    if (!currentOrder) {
      console.warn('POS Store: No current order to add item to');
      return;
    }

    // Create order item
    const orderItem: OrderItem = {
      id: `temp-${Date.now()}`,
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      quantity,
      unitPrice: menuItem.price,
      totalPrice: menuItem.price * quantity,
      specialInstructions: notes || '',
      status: 'PENDING',
    };

    const updatedOrder = {
      ...currentOrder,
      items: [...(currentOrder.items || []), orderItem],
    };

    set({ currentOrder: updatedOrder });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Added item to order', orderItem);
    }
  },

  addOrderItem: async (
    menuItemId: string,
    quantity: number,
    customizations?: Customization[],
    notes?: string
  ): Promise<Order> => {
    try {
      set({ isLoading: true, error: null });
      const { currentOrder } = get();
      if (!currentOrder) {
        throw new Error('No active order to add items to');
      }

      // Check if there's enough stock first
      const existingItemQuantity =
        currentOrder.items?.find(item => item.menuItemId === menuItemId)
          ?.quantity || 0;

      // Calculate total quantity needed (existing + new)
      const totalQuantityNeeded = existingItemQuantity + quantity;

      // Check stock availability
      console.log('Checking stock availability for:', {
        menuItemId,
        quantity: totalQuantityNeeded,
      });

      const stockCheck = await inventoryAPI.checkStockAvailability([
        { menuItemId, quantity: totalQuantityNeeded },
      ]);

      if (!stockCheck.success || !stockCheck.data?.available) {
        const unavailableItems = stockCheck.data?.unavailableItems || [];
        let errorMessage = 'Not enough ingredients in stock for this item.';

        if (unavailableItems.length > 0) {
          // Format unavailable items details for better user feedback
          const itemDetails = unavailableItems
            .map(
              item =>
                `${item.name}: have ${item.available} ${item.unit}, need ${item.required} ${item.unit}`
            )
            .join(', ');

          errorMessage = `Insufficient stock: ${itemDetails}`;
        }

        throw new Error(errorMessage);
      }

      const userId = useAuthStore.getState().user?.id || 'owner';

      // Prepare notes with customizations
      let finalNotes = notes || '';
      if (customizations && customizations.length > 0) {
        // Format removed ingredients as "remove: ingredient1 - ingredient2"
        const removedIngredients = customizations
          .filter(c => c.type === 'remove_ingredient')
          .map(c => c.name)
          .join(' - ');

        if (removedIngredients) {
          const removeText = `remove: ${removedIngredients}`;
          finalNotes = finalNotes ? `${finalNotes}\n${removeText}` : removeText;
        }

        // Handle other customization types if any
        const otherCustomizations = customizations
          .filter(c => c.type !== 'remove_ingredient')
          .map(c => c.name)
          .join(', ');

        if (otherCustomizations) {
          finalNotes = finalNotes
            ? `${finalNotes}\n${otherCustomizations}`
            : otherCustomizations;
        }
      }

      // Use dedicated addItem endpoint to avoid nested update shape issues
      const addResp = await orderAPI.addItem({
        orderId: currentOrder.id,
        item: {
          menuItemId,
          quantity,
          ...(finalNotes ? { notes: finalNotes } : {}),
        },
        userId,
      });

      if (!addResp.success) {
        throw new Error(addResp.error || 'Failed to add item');
      }

      // CRITICAL: Store the actual item that was returned by addItem
      const actualAddedItem = addResp.data;

      // Fetch updated order by id to sync state
      const orderResp = await orderAPI.getById(currentOrder.id);
      if (!orderResp.success || !orderResp.data) {
        throw new Error(orderResp.error || 'Failed to fetch updated order');
      }
      const updatedOrder = convertIPCOrderToRendererOrder(orderResp.data as IPCOrder);

      // Preserve the delivery fee if it exists in the current order
      if (
        (currentOrder.deliveryFee ?? 0) > 0 &&
        (!updatedOrder.deliveryFee || updatedOrder.deliveryFee === 0)
      ) {
        // If the delivery fee was lost, restore it and recalculate the total
        updatedOrder.deliveryFee = currentOrder.deliveryFee;

        // Update the order in the backend to ensure delivery fee persistence
        await orderAPI.update({
          id: currentOrder.id,
          updates: {
            deliveryFee: currentOrder.deliveryFee,
          },
          userId: useAuthStore.getState().user?.id || 'owner',
        });
      }

      // CRITICAL FIX: Force React re-render by creating new object references
      const freshCurrentOrder = {
        ...updatedOrder,
        items: updatedOrder.items ? [...updatedOrder.items] : [],
      };

      set({
        currentOrder: freshCurrentOrder,
        activeOrder: freshCurrentOrder,
        isLoading: false,
      });

      console.log(
        '🔄 POS Store: AddItem state updated with fresh object references:',
        {
          orderId: freshCurrentOrder.id,
          itemsCount: freshCurrentOrder.items?.length || 0,
          lastItem:
            freshCurrentOrder.items?.[freshCurrentOrder.items.length - 1]
              ?.menuItemName || 'none',
        }
      );

      // Invalidate menu cache to ensure category counts reflect updated availability
      try {
        getMenuService().invalidateMenuCaches();
        console.log('🔄 POS Store: Menu cache invalidated after adding item');
      } catch (cacheError) {
        console.warn('⚠️ POS Store: Failed to invalidate menu cache:', cacheError);
        // Don't fail the operation if cache invalidation fails
      }

      // Refresh tables to update table status in UI
      // Only refresh if this is a table order (has tableId)
      if (updatedOrder.tableId) {
        try {
          await get().fetchTables();
        } catch (refreshError) {
          // Log but don't fail the operation for table refresh errors
          console.warn(
            'POS Store: Failed to refresh tables after adding item:',
            refreshError
          );
        }
      }

      // Don't auto-return to orders view - let the user decide when to return
      // This allows adding multiple items without interruption

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Added item to order successfully',
          updatedOrder
        );
      }

      // Return the updated order WITH the actual added item for addon attachment
      // ✅ CRITICAL FIX: Include __actualAddedItem so OrderPanel can attach addons
      return {
        ...updatedOrder,
        __actualAddedItem: actualAddedItem,
      } as any;
    } catch (error) {
      console.error('POS Store: Failed to add item to order', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to add item to order',
        isLoading: false,
      });
      throw error;
    }
  },

  removeItemFromOrder: (orderItemId: string) => {
    const { currentOrder } = get();
    if (!currentOrder) {
      console.warn('POS Store: No current order to remove item from');
      return;
    }

    const updatedOrder = {
      ...currentOrder,
      items: (currentOrder.items || []).filter(item => item.id !== orderItemId),
    };

    set({ currentOrder: updatedOrder });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Removed item from order', orderItemId);
    }
  },

  removeOrderItem: async (orderItemId: string) => {
    try {
      set({ isLoading: true, error: null });

      const { currentOrder } = get();
      if (!currentOrder) {
        throw new Error('No active order to remove item from');
      }

      const userId = useAuthStore.getState().user?.id || 'owner';

      const removeResp = await orderAPI.removeItem({
        orderId: currentOrder.id,
        itemId: orderItemId,
        userId,
      });
      if (!removeResp.success) {
        throw new Error(removeResp.error || 'Failed to remove item');
      }

      const orderResp = await orderAPI.getById(currentOrder.id);
      if (!orderResp.success || !orderResp.data) {
        throw new Error(orderResp.error || 'Failed to fetch updated order');
      }
      const updatedOrder = convertIPCOrderToRendererOrder(orderResp.data as IPCOrder);

      set({
        currentOrder: updatedOrder,
        activeOrder: updatedOrder,
        isLoading: false,
      });

      // Refresh tables to update table status in UI
      // Only refresh if this is a table order (has tableId)
      if (updatedOrder.tableId) {
        try {
          await get().fetchTables();
        } catch (refreshError) {
          // Log but don't fail the operation for table refresh errors
          console.warn(
            'POS Store: Failed to refresh tables after removing item:',
            refreshError
          );
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Removed order item successfully', orderItemId);
      }
    } catch (error) {
      console.error('POS Store: Failed to remove order item', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove order item',
        isLoading: false,
      });
      throw error;
    }
  },

  updateOrderItemQuantity: (orderItemId: string, quantity: number) => {
    const { currentOrder } = get();
    if (!currentOrder) {
      console.warn('POS Store: No current order to update item quantity');
      return;
    }

    const updatedOrder = {
      ...currentOrder,
      items: (currentOrder.items || []).map(item =>
        item.id === orderItemId
          ? {
              ...item,
              quantity,
              totalPrice: (item.unitPrice ?? 0) * quantity,
            }
          : item
      ),
    };

    set({ currentOrder: updatedOrder });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Updated order item quantity', {
        orderItemId,
        quantity,
      });
    }
  },

  updateOrderItem: async (orderItemId: string, quantity: number) => {
    try {
      set({ isLoading: true, error: null });

      const { currentOrder } = get();
      if (!currentOrder) {
        throw new Error('No active order to update item in');
      }

      // Find the target item
      const itemToUpdate = currentOrder.items?.find(
        item => item.id === orderItemId
      );
      if (!itemToUpdate) {
        throw new Error('Order item not found');
      }

      const userId = useAuthStore.getState().user?.id || 'owner';

      console.log('🔧 FIXED UPDATE: Updating existing item quantity', {
        orderItemId,
        oldQuantity: itemToUpdate.quantity,
        newQuantity: quantity,
        keepingSameId: true,
      });

      // FIXED: Use proper updateItemQuantity endpoint instead of remove+add
      const response = await orderAPI.updateItemQuantity({
        itemId: orderItemId,
        quantity: quantity,
        userId,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update item quantity');
      }

      // ✅ FIX: Use response data directly - backend now returns fresh order with updated totals
      // No need to fetch again, which eliminates race condition with recalculateOrderTotals()
      const updatedOrder = convertIPCOrderToRendererOrder(response.data as IPCOrder);

      set({
        currentOrder: updatedOrder,
        activeOrder: updatedOrder,
        isLoading: false,
      });

      // Refresh tables to update table status in UI
      // Only refresh if this is a table order (has tableId)
      if (updatedOrder.tableId) {
        try {
          await get().fetchTables();
        } catch (refreshError) {
          // Log but don't fail the operation for table refresh errors
          console.warn(
            'POS Store: Failed to refresh tables after updating item:',
            refreshError
          );
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Updated order item successfully', {
          orderItemId,
          quantity,
        });
      }
    } catch (error) {
      console.error('POS Store: Failed to update order item', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order item',
        isLoading: false,
      });
      throw error;
    }
  },

  completeOrder: async () => {
    try {
      const { currentOrder, selectedTable } = get();
      if (!currentOrder) {
        throw new Error('No order to complete');
      }

      set({ isLoading: true, error: null });

      // Use orderAPI.updateStatus to complete the order
      const response = await orderAPI.updateStatus({
        id: currentOrder.id,
        status: 'COMPLETED' as any, // Assuming this is the status for completed orders
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to complete order');
      }
      const completedOrder = response.data;

      // Clear the current order and active order
      set({
        currentOrder: null,
        activeOrder: null,
        selectedTable: null,
        isLoading: false,
      });

      // Refresh tables to update their status and remove the completed order
      try {
        await get().fetchTables();
      } catch (tableError) {
        console.warn(
          'POS Store: Failed to refresh tables after order completion',
          tableError
        );
        // Don't throw here, the order completion was successful
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Completed order successfully and freed table', {
          completedOrder,
          previousTable: selectedTable?.name,
        });
      }
    } catch (error) {
      console.error('POS Store: Failed to complete order', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to complete order',
        isLoading: false,
      });
      throw error;
    }
  },

  cancelCurrentOrder: async () => {
    try {
      const { currentOrder, selectedTable } = get();
      if (!currentOrder) {
        throw new Error('No current order to cancel');
      }

      set({ isLoading: true, error: null });

      // Use orderAPI.updateStatus to cancel the order
      const response = await orderAPI.updateStatus({
        id: currentOrder.id,
        status: 'CANCELLED' as any, // Assuming this is the status for cancelled orders
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to cancel order');
      }
      const cancelledOrder = response.data;
      const tableToDelete = selectedTable ? { ...selectedTable } : null;

      // Clear the current order and active order
      set({
        currentOrder: null,
        activeOrder: null,
        selectedTable: null,
        isLoading: false,
      });

      // Delete the table if it exists
      if (tableToDelete && tableToDelete.id) {
        try {
          console.log(
            `Deleting table ${tableToDelete.name} (${tableToDelete.id}) after order cancellation`
          );
          await tableAPI.delete(tableToDelete.id);
          console.log(`Table ${tableToDelete.name} deleted successfully`);
        } catch (tableDeleteError) {
          console.error(
            'Failed to delete table after order cancellation:',
            tableDeleteError
          );
          // Don't throw here, the order cancellation was still successful
        }
      }

      // Refresh tables to update their status and remove the cancelled order
      try {
        await get().fetchTables();
      } catch (tableError) {
        console.warn(
          'POS Store: Failed to refresh tables after order cancellation',
          tableError
        );
        // Don't throw here, the order cancellation was successful
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Cancelled current order successfully and deleted table',
          {
            cancelledOrder,
            deletedTable: tableToDelete?.name,
          }
        );
      }
    } catch (error) {
      console.error('POS Store: Failed to cancel order', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to cancel order',
        isLoading: false,
      });
      throw error;
    }
  },

  cancelOrder: async () => {
    try {
      const { currentOrder, selectedTable } = get();
      if (!currentOrder || !currentOrder.id) {
        throw new Error('No valid order to cancel');
      }

      set({ isLoading: true, error: null });

      console.log('Cancelling order with ID:', currentOrder.id);

      // Delete the order with user information to satisfy controller parameters
      await orderAPI.delete({
        id: currentOrder.id,
        userId: 'system', // Using a default user ID since we don't have user context here
        reason: 'Order cancelled by user',
      });

      // For logging purposes
      const cancelledOrder = { ...currentOrder };
      const tableToDelete = selectedTable ? { ...selectedTable } : null;

      // Clear the current order and active order
      set({
        currentOrder: null,
        activeOrder: null,
        selectedTable: null,
        isLoading: false,
      });

      // Delete the table if it exists
      if (tableToDelete && tableToDelete.id) {
        try {
          console.log(
            `Deleting table ${tableToDelete.name} (${tableToDelete.id}) after order cancellation`
          );
          await tableAPI.delete(tableToDelete.id);
          console.log(`Table ${tableToDelete.name} deleted successfully`);
        } catch (tableDeleteError) {
          console.error(
            'Failed to delete table after order cancellation:',
            tableDeleteError
          );
          // Don't throw here, the order cancellation was still successful
        }
      }

      // Refresh tables to update their status and remove the cancelled order and deleted table
      try {
        await get().fetchTables();
      } catch (tableError) {
        console.warn(
          'POS Store: Failed to refresh tables after order cancellation',
          tableError
        );
        // Don't throw here, the order cancellation was successful
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Cancelled order successfully and deleted table',
          {
            cancelledOrder,
            deletedTable: tableToDelete?.name,
          }
        );
      }
    } catch (error) {
      console.error('POS Store: Failed to cancel order', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to cancel order',
        isLoading: false,
      });
      throw error;
    }
  },

  switchToTables: () => {
    set({ viewMode: 'tables' });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Switched to tables view');
    }
  },

  switchToMenu: () => {
    set({ viewMode: 'menu' });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Switched to menu view');
    }
  },

  setOrderType: (type: OrderType) => {
    const currentState = get();
    console.log('🏪 DEBUG: setOrderType called:', {
      newType: type,
      currentType: currentState.orderType,
      beforeChange: currentState.orderType,
      timestamp: new Date().toISOString(),
    });

    set({ orderType: type });

    const updatedState = get();
    console.log('✅ DEBUG: setOrderType completed:', {
      afterChange: updatedState.orderType,
      isDineInResult: updatedState.orderType === 'DINE_IN',
      stateUpdated: updatedState.orderType === type,
      timestamp: new Date().toISOString(),
    });
  },

  isDineIn: () => {
    const currentOrderType = get().orderType;
    const result = currentOrderType === 'DINE_IN';
    console.log('🍽️ DEBUG: isDineIn called:', {
      orderType: currentOrderType,
      result,
      timestamp: new Date().toISOString(),
    });
    return result;
  },

  clearCurrentOrder: () => {
    set({
      currentOrder: null,
      activeOrder: null,
      selectedTable: null,
      pendingItems: [],
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Cleared current order for new order creation');
    }
  },

  // Global orders management methods
  fetchAllOrders: async (retryCount: number = 0) => {
    const { isLoadingOrders, lastOrdersRefresh, fetchInProgress } = get();

    // Prevent concurrent fetches
    if (fetchInProgress && retryCount === 0) {
      console.log('⏭️ FETCH: Skipping - fetch already in progress', {
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (isLoadingOrders && retryCount === 0) return; // Prevent duplicate calls unless retrying

    // Performance optimization: Skip if recently fetched (< 10 seconds ago)
    const now = Date.now();
    if (retryCount === 0 && now - lastOrdersRefresh < 10000) {
      if (process.env.NODE_ENV === 'development') {
        console.log('POS Store: Skipping fetch, data is fresh');
      }
      return;
    }

    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

    try {
      set({ isLoadingOrders: true, fetchInProgress: true, ordersError: null });

      const [takeoutResponse, deliveryResponse, dineInResponse] = await Promise.all([
        orderAPI.getByType('TAKEOUT'),
        orderAPI.getByType('DELIVERY'),
        orderAPI.getByType('DINE_IN'),
      ]);

      const allOrders: Order[] = [];

      if (takeoutResponse?.success && Array.isArray(takeoutResponse.data)) {
        const activeTakeout = (takeoutResponse.data as IPCOrder[])
          .map(convertIPCOrderToRendererOrder)
          .filter((order: Order) =>
            ['PENDING', 'READY'].includes(order.status)
          );
        allOrders.push(...activeTakeout);
      }

      if (deliveryResponse?.success && Array.isArray(deliveryResponse.data)) {
        const activeDelivery = (deliveryResponse.data as IPCOrder[])
          .map(convertIPCOrderToRendererOrder)
          .filter((order: Order) =>
            ['PENDING', 'READY'].includes(order.status)
          );
        allOrders.push(...activeDelivery);
      }

      // Process DINE_IN orders
      if (dineInResponse?.success && Array.isArray(dineInResponse.data)) {
        const activeDineIn = (dineInResponse.data as IPCOrder[])
          .map(convertIPCOrderToRendererOrder)
          .filter((order: Order) =>
            ['PENDING', 'READY'].includes(order.status)
          );
        allOrders.push(...activeDineIn);
      }

      // Deduplicate orders by ID (keep most recently updated)
      const uniqueOrdersMap = new Map<string, Order>();
      allOrders.forEach(order => {
        const existing = uniqueOrdersMap.get(order.id);
        if (!existing || new Date(order.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          uniqueOrdersMap.set(order.id, order);
        }
      });

      const deduplicatedOrders = Array.from(uniqueOrdersMap.values());

      if (allOrders.length !== deduplicatedOrders.length) {
        console.log(`📊 FETCH: Deduplicated ${allOrders.length} → ${deduplicatedOrders.length} orders`, {
          duplicatesRemoved: allOrders.length - deduplicatedOrders.length,
          timestamp: new Date().toISOString(),
        });
      }

      // Sort by status priority and creation time (immutable - create new array)
      const sortedOrders = [...deduplicatedOrders].sort((a, b) => {
        const statusPriority = { READY: 0, PENDING: 1 };
        const aPriority =
          statusPriority[a.status as keyof typeof statusPriority] ?? 2;
        const bPriority =
          statusPriority[b.status as keyof typeof statusPriority] ?? 2;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      set({
        allOrders: sortedOrders,
        isLoadingOrders: false,
        fetchInProgress: false,
        lastOrdersRefresh: Date.now(),
      });

      // 🔧 CRITICAL FIX: Reconcile tracking data with fetched orders
      // This prevents savePendingChanges from re-adding items that are already in the database
      const currentOrderChanges = get().orderChanges;
      if (currentOrderChanges.size > 0) {
        const reconciledChanges = new Map(currentOrderChanges);
        let totalReconciledItems = 0;

        sortedOrders.forEach(order => {
          const tracking = reconciledChanges.get(order.id);
          if (tracking && tracking.newItems.length > 0) {
            const itemsBeforeReconciliation = tracking.newItems.length;

            // Filter out newItems that already exist in the fetched order AND have been printed
            const reconciledNewItems = tracking.newItems.filter(newItem => {
              // ✅ FIX: Check if this specific item (by ID) has been printed
              // Don't remove items just because they exist in DB - only remove if printed!
              const matchingItem = order.items?.find(existingItem =>
                existingItem.id === newItem.id
              );

              if (matchingItem && matchingItem.printedAt) {
                console.log('🔧 RECONCILE: Removing tracked item (already printed)', {
                  orderId: order.id,
                  itemId: matchingItem.id,
                  menuItemId: newItem.menuItemId,
                  quantity: newItem.quantity,
                  printedAt: matchingItem.printedAt,
                  timestamp: new Date().toISOString(),
                });
                return false; // Remove from tracking - item has been printed
              }
              return true; // Keep in tracking - item not printed yet
            });

            const reconciledCount = itemsBeforeReconciliation - reconciledNewItems.length;
            if (reconciledCount > 0) {
              totalReconciledItems += reconciledCount;

              if (reconciledNewItems.length === 0 &&
                  Object.keys(tracking.netChanges).length === 0 &&
                  tracking.removedItems.length === 0) {
                // No more changes to track for this order
                reconciledChanges.delete(order.id);
                console.log('🔧 RECONCILE: Cleared tracking for order (no pending changes)', {
                  orderId: order.id,
                  timestamp: new Date().toISOString(),
                });
              } else {
                // Update tracking with filtered newItems
                reconciledChanges.set(order.id, {
                  ...tracking,
                  newItems: reconciledNewItems,
                });
              }
            }
          }
        });

        if (totalReconciledItems > 0) {
          console.log('✅ RECONCILE: Cleared tracked items that exist in DB', {
            totalReconciledItems,
            trackingEntriesBefore: currentOrderChanges.size,
            trackingEntriesAfter: reconciledChanges.size,
            timestamp: new Date().toISOString(),
          });
          set({ orderChanges: reconciledChanges });
        }
      }

      console.log('📊 FETCH STATS:', {
        fetchedCount: allOrders.length,
        deduplicatedCount: deduplicatedOrders.length,
        finalCount: sortedOrders.length,
        duplicatesRemoved: allOrders.length - deduplicatedOrders.length,
        breakdown: {
          takeout: takeoutResponse.data?.length || 0,
          delivery: deliveryResponse.data?.length || 0,
          dineIn: dineInResponse.data?.length || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `POS Store: Failed to fetch orders (attempt ${retryCount + 1})`,
        error
      );

      // Retry logic
      if (retryCount < maxRetries) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`POS Store: Retrying in ${retryDelay}ms...`);
        }

        setTimeout(() => {
          const { fetchAllOrders } = get();
          fetchAllOrders(retryCount + 1);
        }, retryDelay);

        // Don't set loading to false yet, we're retrying
        return;
      }

      // All retries exhausted
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch orders';
      const userFriendlyMessage =
        retryCount >= maxRetries
          ? `${errorMessage}. Please check your connection and try again.`
          : errorMessage;

      set({
        ordersError: userFriendlyMessage,
        isLoadingOrders: false,
        fetchInProgress: false,
      });
    }
  },

  refreshOrders: async () => {
    const { fetchAllOrders } = get();
    await fetchAllOrders();
  },

  updateOrderInStore: (updatedOrder: Order, forceUpdate: boolean = false) => {
    // ✅ CRITICAL FIX: Deduplicate order items by ID before storing
    const deduplicatedItems = updatedOrder.items ? (() => {
      const uniqueItemsMap = new Map<string, any>();
      updatedOrder.items.forEach((item: any) => {
        const existing = uniqueItemsMap.get(item.id);
        // Keep the most recently updated version if duplicates exist
        if (!existing || (item.updatedAt && existing.updatedAt &&
            new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime())) {
          uniqueItemsMap.set(item.id, item);
        }
      });

      const deduplicated = Array.from(uniqueItemsMap.values());

      if (updatedOrder.items.length !== deduplicated.length) {
        console.log('🔧 DEDUP: Removed duplicate items from order', {
          orderId: updatedOrder.id,
          originalCount: updatedOrder.items.length,
          deduplicatedCount: deduplicated.length,
          duplicatesRemoved: updatedOrder.items.length - deduplicated.length,
          timestamp: new Date().toISOString(),
        });
      }

      return deduplicated;
    })() : [];

    // Create order with deduplicated items
    const cleanedOrder = {
      ...updatedOrder,
      items: deduplicatedItems,
    };

    const { allOrders } = get();
    const updatedOrders = allOrders.map(order =>
      order.id === cleanedOrder.id ? cleanedOrder : order
    );

    set({ allOrders: updatedOrders });

    // If this is the current order, update it only if the fetched data is newer
    const { currentOrder } = get();
    if (currentOrder?.id === cleanedOrder.id) {
      // ✅ CRITICAL FIX: Allow forced updates (e.g., after addon assignment where ORDER updatedAt doesn't change)
      if (forceUpdate) {
        set({ currentOrder: cleanedOrder, activeOrder: cleanedOrder });
      } else {
        // ✅ SAFETY CHECK: Compare timestamps to avoid overwriting newer data with older data
        const currentTimestamp = new Date(currentOrder.updatedAt).getTime();
        const updatedTimestamp = new Date(cleanedOrder.updatedAt).getTime();

        // Only overwrite if the fetched data is NEWER than what we have
        if (updatedTimestamp > currentTimestamp) {
          set({ currentOrder: cleanedOrder, activeOrder: cleanedOrder });
        }
        // Otherwise, keep the current data (it's fresher than what database returned)
      }
    }
  },

  removeOrderFromStore: (orderId: string) => {
    const { allOrders } = get();
    const filteredOrders = allOrders.filter(order => order.id !== orderId);

    set({ allOrders: filteredOrders });

    // If this was the current order, clear it
    const { currentOrder } = get();
    if (currentOrder?.id === orderId) {
      set({ currentOrder: null, activeOrder: null });
    }
  },

  // Network and offline handling methods
  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });

    if (isOnline) {
      // When coming back online, process pending actions
      const { processPendingActions, disableOfflineMode } = get();
      disableOfflineMode();
      processPendingActions();
    } else {
      // When going offline, enable offline mode
      const { enableOfflineMode } = get();
      enableOfflineMode();
    }
  },

  addPendingAction: (action: string, data: any) => {
    const { pendingActions } = get();
    const newAction = {
      action,
      data,
      timestamp: Date.now(),
    };

    set({
      pendingActions: [...pendingActions, newAction],
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Added pending action:', newAction);
    }
  },

  processPendingActions: async () => {
    const { pendingActions, isOnline } = get();

    if (!isOnline || pendingActions.length === 0) return;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        'POS Store: Processing',
        pendingActions.length,
        'pending actions'
      );
    }

    const successfulActions: number[] = [];

    for (let i = 0; i < pendingActions.length; i++) {
      const action = pendingActions[i];

      try {
        // Process different types of pending actions
        switch (action.action) {
          case 'updateOrderStatus':
            await orderAPI.updateStatus(action.data);
            successfulActions.push(i);
            break;
          case 'createOrder':
            await orderAPI.create(action.data);
            successfulActions.push(i);
            break;
          case 'updateOrder':
            await orderAPI.update(action.data);
            successfulActions.push(i);
            break;
          default:
            console.warn('Unknown pending action type:', action.action);
            successfulActions.push(i); // Remove unknown actions
        }
      } catch (error) {
        console.error('Failed to process pending action:', action, error);
        // Don't mark as successful, will retry later
      }
    }

    // Remove successful actions
    if (successfulActions.length > 0) {
      const remainingActions = pendingActions.filter(
        (_, index) => !successfulActions.includes(index)
      );

      set({ pendingActions: remainingActions });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'POS Store: Processed',
          successfulActions.length,
          'actions,',
          remainingActions.length,
          'remaining'
        );
      }
    }
  },

  enableOfflineMode: () => {
    set({ offlineMode: true });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Offline mode enabled');
    }
  },

  disableOfflineMode: () => {
    set({ offlineMode: false });
    if (process.env.NODE_ENV === 'development') {
      console.log('POS Store: Offline mode disabled');
    }
  },

  backupToLocalStorage: (orderId: string) => {
    const { orderChanges } = get();
    const tracking = orderChanges.get(orderId);
    if (tracking) {
      try {
        localStorage.setItem(
          `orderBackup_${orderId}`,
          JSON.stringify({
            tracking,
            timestamp: Date.now(),
          })
        );
        console.log(
          '💾 BACKUP: Order changes backed up to localStorage',
          orderId
        );
      } catch (error) {
        console.warn('Failed to backup to localStorage:', error);
      }
    }
  },

  restoreFromLocalStorage: (orderId: string) => {
    try {
      const backup = localStorage.getItem(`orderBackup_${orderId}`);
      if (backup) {
        const parsed = JSON.parse(backup);
        console.log(
          '🔄 RESTORE: Restored order changes from localStorage',
          orderId
        );
        return parsed.tracking;
      }
    } catch (error) {
      console.warn('Failed to restore from localStorage:', error);
    }
    return null;
  },

  clearLocalStorageBackup: (orderId: string) => {
    try {
      localStorage.removeItem(`orderBackup_${orderId}`);
      console.log('🗑️ BACKUP: Cleared localStorage backup', orderId);
    } catch (error) {
      console.warn('Failed to clear localStorage backup:', error);
    }
  },

  clearError: () => {
    set({ error: null, ordersError: null });
  },
}));
