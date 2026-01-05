/**
 * Shared utility functions for OrderPanel and TakeoutOrderPanel
 * Ensures 100% consistency in addon handling, customization, and kitchen printing
 *
 * SOURCE: Extracted from OrderPanel.tsx (dine-in implementation)
 */

/**
 * Compare two addon arrays to check if they're identical
 * Compares both addon IDs AND quantities to prevent incorrect item deduplication
 *
 * Example:
 * - "Burger + 2x Cheese" vs "Burger + 2x Cheese" → TRUE (same)
 * - "Burger + 2x Cheese" vs "Burger + 1x Cheese" → FALSE (different quantities)
 *
 * @param existingAddons - Addons already attached to an order item
 * @param selectedAddons - Addons being added in current operation
 * @returns true if addons match exactly (same IDs and quantities), false otherwise
 */
export function areAddonsEqual(
  existingAddons: any[],
  selectedAddons: any[]
): boolean {
  // If lengths don't match, they're not equal
  if (existingAddons.length !== selectedAddons.length) {
    return false;
  }

  // If both are empty, they're equal
  if (existingAddons.length === 0 && selectedAddons.length === 0) {
    return true;
  }

  // Create quantity maps for exact comparison (ID → quantity)
  const existingMap = new Map<string, number>();
  existingAddons.forEach(addon => {
    existingMap.set(addon.addonId, addon.quantity || 1);
  });

  const selectedMap = new Map<string, number>();
  selectedAddons.forEach(addon => {
    selectedMap.set(addon.addonId, addon.quantity || 1);
  });

  // Verify all existing addons match selected with SAME quantities
  for (const [addonId, qty] of existingMap.entries()) {
    if (selectedMap.get(addonId) !== qty) {
      return false; // Different quantity or addon doesn't exist
    }
  }

  // Verify all selected addons match existing with SAME quantities
  for (const [addonId, qty] of selectedMap.entries()) {
    if (existingMap.get(addonId) !== qty) {
      return false; // Different quantity or addon doesn't exist
    }
  }

  return true; // All addons match with exact quantities
}

/**
 * Scale addon quantities when item quantity changes via +/- buttons
 *
 * @param orderItemId - ID of the order item whose addons need scaling
 * @param quantityChange - How much the item quantity changed (positive or negative)
 * @param currentOrderId - Current order ID (for refresh)
 * @returns Success status and refreshed order data
 */
export async function scaleAddonsForQuantityChange(
  orderItemId: string,
  quantityChange: number,
  currentOrderId: string
): Promise<{ success: boolean; order?: any; error?: string }> {
  try {
    // Call IPC to scale addon quantities
    const addonResult = await (window as any).electronAPI.ipc.invoke(
      'addon:scaleAddonQuantities',
      {
        orderItemId,
        quantityToAdd: quantityChange,
      }
    );

    if (!addonResult.success) {
      return { success: false, error: addonResult.error };
    }

    // Refresh order to show updated addon quantities
    const orderAPI = await import('@/lib/ipc-api');
    const refreshResp = await orderAPI.orderAPI.getById(currentOrderId);

    if (refreshResp.success && refreshResp.data) {
      return { success: true, order: refreshResp.data };
    }

    return { success: false, error: 'Failed to refresh order' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error scaling addons'
    };
  }
}

/**
 * Determine if kitchen ticket should be printed as STANDARD (initial) or UPDATE ticket
 *
 * STANDARD ticket: Empty updatedItemIds, shows complete order
 * UPDATE ticket: Populated updatedItemIds, shows only changes
 *
 * Logic: Initial order = has NEW items AND changes cover all items
 *
 * @param newItemsCount - Number of new items being added
 * @param updatesCount - Number of quantity increases
 * @param totalOrderItems - Total number of items in order
 * @returns true if should print as initial order (STANDARD ticket)
 */
export function shouldPrintAsInitialOrder(
  newItemsCount: number,
  updatesCount: number,
  totalOrderItems: number
): boolean {
  const totalChangedItems = newItemsCount + updatesCount;
  return newItemsCount > 0 && totalChangedItems >= totalOrderItems;
}

/**
 * Prepare kitchen printing parameters based on change summary
 * Filters out removals and quantity decreases (only prints additions/increases)
 *
 * @param changesSummary - Array of order changes from tracking system
 * @param totalOrderItems - Total number of items in current order
 * @returns Object with filtered changes and ticket type parameters
 */
export function prepareKitchenPrintData(
  changesSummary: any[],
  totalOrderItems: number
) {
  // Filter changes
  const newItems = changesSummary.filter(c => c.changeType === 'NEW');
  const updates = changesSummary.filter(c => c.changeType === 'UPDATE' && c.netChange > 0);

  // Filter out removals AND quantity decreases
  const filteredChangesSummary = changesSummary.filter(
    c => c.changeType !== 'REMOVE' && (c.changeType !== 'UPDATE' || c.netChange > 0)
  );

  // Determine ticket type
  const isInitialOrder = shouldPrintAsInitialOrder(
    newItems.length,
    updates.length,
    totalOrderItems
  );

  return {
    newItems,
    updates,
    filteredChangesSummary,
    isInitialOrder,
    // For printing: empty arrays for initial orders, populated for updates
    updatedItemIds: isInitialOrder ? [] : [...newItems, ...updates].map(item => item.itemId),
    changeDetails: isInitialOrder ? [] : filteredChangesSummary,
    shouldSkipPrint: filteredChangesSummary.length === 0, // Skip if only removals/decreases
  };
}
