import { inventoryAPI } from '@/lib/ipc-api';
import { create } from 'zustand';
// Helper function to map InventoryItem from backend to StockItem for frontend
const mapInventoryItemToStockItem = (item) => ({
    id: item.id,
    itemName: item.itemName,
    name: item.itemName, // Alias for frontend compatibility
    unit: item.unit,
    currentStock: item.currentStock,
    currentQuantity: item.currentStock, // Alias for frontend compatibility
    minimumStock: item.minimumStock,
    minimumQuantity: item.minimumStock, // Alias for frontend compatibility
    costPerUnit: item.costPerUnit,
    category: item.category,
    supplier: item.supplier,
    lastRestocked: item.lastRestocked,
    expiryDate: item.expiryDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
});
export const useStockStore = create((set, get) => ({
    stockItems: [],
    isLoading: false,
    error: null,
    lowStockItems: [],
    hasLowStockWarning: false,
    createStockItem: async (itemData) => {
        try {
            set({ isLoading: true, error: null });
            const response = await inventoryAPI.createInventoryItem(itemData);
            if (response.success && response.data) {
                const { stockItems } = get();
                set({
                    stockItems: [...stockItems, mapInventoryItemToStockItem(response.data)],
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to create stock item');
            }
        }
        catch (error) {
            set({
                error: error instanceof Error
                    ? error.message
                    : 'Failed to create stock item',
                isLoading: false,
            });
            throw error;
        }
    },
    updateStockItem: async (id, updates) => {
        try {
            set({ isLoading: true, error: null });
            const response = await inventoryAPI.updateInventoryItem(id, updates);
            if (response.success && response.data) {
                const { stockItems } = get();
                set({
                    stockItems: stockItems.map(item => item.id === id ? mapInventoryItemToStockItem(response.data) : item),
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to update stock item');
            }
        }
        catch (error) {
            set({
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update stock item',
                isLoading: false,
            });
            throw error;
        }
    },
    adjustStockQuantity: async (id, adjustment) => {
        try {
            set({ isLoading: true, error: null });
            const response = await inventoryAPI.adjustStock(id, adjustment);
            if (response.success && response.data) {
                const { stockItems } = get();
                set({
                    stockItems: stockItems.map(item => item.id === id ? mapInventoryItemToStockItem(response.data) : item),
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to adjust stock quantity');
            }
        }
        catch (error) {
            set({
                error: error instanceof Error
                    ? error.message
                    : 'Failed to adjust stock quantity',
                isLoading: false,
            });
            throw error;
        }
    },
    deleteStockItem: async (id) => {
        try {
            set({ isLoading: true, error: null });
            const response = await inventoryAPI.deleteInventoryItem(id);
            if (response.success) {
                const { stockItems } = get();
                set({
                    stockItems: stockItems.filter(item => item.id !== id),
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to delete stock item');
            }
        }
        catch (error) {
            set({
                error: error instanceof Error
                    ? error.message
                    : 'Failed to delete stock item',
                isLoading: false,
            });
            throw error;
        }
    },
    clearError: () => {
        set({ error: null });
    },
    checkLowStock: async () => {
        try {
            set({ isLoading: true, error: null });
            const response = await inventoryAPI.getLowStockItems();
            if (response.success && response.data) {
                const mappedItems = response.data
                    .map(mapInventoryItemToStockItem)
                    // Filter out system-generated category placeholder items as additional safeguard
                    .filter(item => {
                    const isPlaceholder = item.supplier === 'System-Generated Category' ||
                        (item.itemName || item.name || '').includes('Category Placeholder');
                    return !isPlaceholder;
                });
                set({
                    lowStockItems: mappedItems,
                    hasLowStockWarning: mappedItems.length > 0,
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to check low stock items');
            }
        }
        catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to check low stock',
                isLoading: false,
            });
        }
    },
    dismissLowStockWarning: () => {
        set({ hasLowStockWarning: false });
    },
}));
