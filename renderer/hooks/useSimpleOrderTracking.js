/**
 * SIMPLE NET CHANGE TRACKING SYSTEM
 *
 * Replaces the over-engineered multi-layer tracking with a simple approach:
 * - Track original quantity vs current quantity per item
 * - Calculate net difference when "Done Adding Items" pressed
 * - Kitchen sees only final net changes: "+2", "-1", "New", "Remove"
 * - No journey tracking, no complex event streams, no multiple pipelines
 */
import { useCallback } from 'react';
import { usePOSStore } from '@/stores/posStore';
export function useSimpleOrderTracking(orderId) {
    const { orderChanges, setOrderChanges, currentOrder } = usePOSStore();
    // Get tracking for current order
    const tracking = orderId ? orderChanges.get(orderId) : null;
    // Track new item addition
    const trackNewItem = useCallback((itemId, name, menuItemId, quantity) => {
        if (!orderId)
            return;
        const current = orderChanges.get(orderId) || {
            newItems: [],
            netChanges: {},
            removedItems: [],
        };
        // Remove from any existing tracking arrays (in case of duplicates)
        const cleanNewItems = current.newItems.filter(item => item.id !== itemId);
        const cleanNetChanges = { ...current.netChanges };
        delete cleanNetChanges[itemId];
        const cleanRemovedItems = current.removedItems.filter(item => item.id !== itemId);
        // Add to new items
        cleanNewItems.push({ id: itemId, name, menuItemId, quantity });
        const updated = {
            newItems: cleanNewItems,
            netChanges: cleanNetChanges,
            removedItems: cleanRemovedItems,
        };
        const newChanges = new Map(orderChanges);
        newChanges.set(orderId, updated);
        setOrderChanges(newChanges);
    }, [orderId, orderChanges, setOrderChanges]);
    // Track quantity change (net change calculation)
    const trackQuantityChange = useCallback((itemId, name, menuItemId, oldQuantity, newQuantity) => {
        if (!orderId)
            return;
        const current = orderChanges.get(orderId) || {
            newItems: [],
            netChanges: {},
            removedItems: [],
        };
        // Check if this is a newly added item
        const isNewItem = current.newItems.some(item => item.id === itemId);
        if (isNewItem) {
            // Update the new item quantity directly
            const updatedNewItems = current.newItems.map(item => item.id === itemId ? { ...item, quantity: newQuantity } : item);
            const updated = {
                ...current,
                newItems: updatedNewItems,
            };
            const newChanges = new Map(orderChanges);
            newChanges.set(orderId, updated);
            setOrderChanges(newChanges);
        }
        else {
            // Track net change for existing items
            const existingChange = current.netChanges[itemId];
            const originalQty = existingChange?.originalQty ?? oldQuantity;
            const updatedNetChanges = {
                ...current.netChanges,
                [itemId]: {
                    itemId,
                    name,
                    menuItemId,
                    originalQty,
                    currentQty: newQuantity,
                },
            };
            const updated = {
                ...current,
                netChanges: updatedNetChanges,
            };
            const newChanges = new Map(orderChanges);
            newChanges.set(orderId, updated);
            setOrderChanges(newChanges);
        }
    }, [orderId, orderChanges, setOrderChanges]);
    // Track item removal
    const trackItemRemoval = useCallback((itemId, name, menuItemId, quantity) => {
        if (!orderId)
            return;
        const current = orderChanges.get(orderId) || {
            newItems: [],
            netChanges: {},
            removedItems: [],
        };
        // Check if this was a newly added item
        const wasNewItem = current.newItems.some(item => item.id === itemId);
        if (wasNewItem) {
            // Just remove from new items (no net change needed)
            const cleanNewItems = current.newItems.filter(item => item.id !== itemId);
            const updated = {
                ...current,
                newItems: cleanNewItems,
            };
            const newChanges = new Map(orderChanges);
            newChanges.set(orderId, updated);
            setOrderChanges(newChanges);
        }
        else {
            // Track as removed item
            const cleanNetChanges = { ...current.netChanges };
            delete cleanNetChanges[itemId];
            const cleanRemovedItems = current.removedItems.filter(item => item.id !== itemId);
            cleanRemovedItems.push({ id: itemId, name, menuItemId, quantity });
            const updated = {
                ...current,
                netChanges: cleanNetChanges,
                removedItems: cleanRemovedItems,
            };
            const newChanges = new Map(orderChanges);
            newChanges.set(orderId, updated);
            setOrderChanges(newChanges);
        }
    }, [orderId, orderChanges, setOrderChanges]);
    // Clear tracking after successful print
    const clearTracking = useCallback(() => {
        if (!orderId)
            return;
        const newChanges = new Map(orderChanges);
        newChanges.delete(orderId);
        setOrderChanges(newChanges);
    }, [orderId, orderChanges, setOrderChanges]);
    // Calculate changes for kitchen printing
    const getKitchenChanges = useCallback(() => {
        if (!tracking)
            return { hasChanges: false, changesSummary: [] };
        const changes = [];
        // Add new items
        tracking.newItems.forEach(item => {
            changes.push({
                itemId: item.id,
                name: item.name,
                menuItemId: item.menuItemId,
                originalQuantity: 0,
                currentQuantity: item.quantity,
                netChange: item.quantity,
                changeType: 'NEW',
            });
        });
        // Add net quantity changes (only non-zero changes)
        Object.values(tracking.netChanges).forEach(change => {
            const netChange = change.currentQty - change.originalQty;
            if (netChange !== 0) {
                changes.push({
                    itemId: change.itemId,
                    name: change.name,
                    menuItemId: change.menuItemId,
                    originalQuantity: change.originalQty,
                    currentQuantity: change.currentQty,
                    netChange,
                    changeType: 'UPDATE',
                });
            }
        });
        // Add removed items
        tracking.removedItems.forEach(item => {
            changes.push({
                itemId: item.id,
                name: item.name,
                menuItemId: item.menuItemId,
                originalQuantity: item.quantity,
                currentQuantity: 0,
                netChange: -item.quantity,
                changeType: 'REMOVE',
            });
        });
        return {
            hasChanges: changes.length > 0,
            changesSummary: changes,
            newItemsCount: tracking.newItems.length,
            updatedItemsCount: Object.values(tracking.netChanges).filter(c => c.currentQty !== c.originalQty).length,
            removedItemsCount: tracking.removedItems.length,
        };
    }, [tracking]);
    const kitchenChanges = getKitchenChanges();
    return {
        // Tracking functions
        trackNewItem,
        trackQuantityChange,
        trackItemRemoval,
        clearTracking,
        // Current state
        tracking,
        hasChanges: kitchenChanges.hasChanges,
        changeCount: kitchenChanges.changesSummary.length,
        // Kitchen printing data
        ...kitchenChanges,
    };
}
