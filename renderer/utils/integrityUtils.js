/**
 * Integrity check utilities for ensuring data consistency
 */
/**
 * Check if a menu item is being used in active orders
 *
 * @param menuItemId The ID of the menu item to check
 * @returns True if the item is used in active orders, false otherwise
 */
export async function isMenuItemUsedInActiveOrders(menuItemId) {
    try {
        // This would be an API call to check if the menu item is used in active orders
        // For now, we'll simulate this with a local check
        // Get active orders from local storage (in a real app, this would be an API call)
        const activeOrders = JSON.parse(localStorage.getItem('active_orders') || '[]');
        // Check if any active order includes this menu item
        return activeOrders.some((order) => order.items.some((item) => item.menuItemId === menuItemId));
    }
    catch (error) {
        console.error('Failed to check if menu item is used in active orders:', error);
        return false; // Assume it's not used if we can't check
    }
}
/**
 * Check if a menu item is part of any combo or special deal
 *
 * @param menuItemId The ID of the menu item to check
 * @returns True if the item is part of any combo or special deal, false otherwise
 */
export async function isMenuItemInCombos(menuItemId) {
    try {
        // This would be an API call to check if the menu item is in any combos
        // For now, we'll simulate this with a local check
        // Get combos from local storage (in a real app, this would be an API call)
        const combos = JSON.parse(localStorage.getItem('combos') || '[]');
        // Check if any combo includes this menu item
        return combos.some((combo) => combo.items.includes(menuItemId));
    }
    catch (error) {
        console.error('Failed to check if menu item is in combos:', error);
        return false; // Assume it's not in combos if we can't check
    }
}
/**
 * Check if a menu item has sales data associated with it
 *
 * @param menuItemId The ID of the menu item to check
 * @returns True if the item has sales data, false otherwise
 */
export async function hasMenuItemSalesData(menuItemId) {
    try {
        // This would be an API call to check if the menu item has sales data
        // For now, we'll simulate this with a local check
        // Get sales data from local storage (in a real app, this would be an API call)
        const salesData = JSON.parse(localStorage.getItem('sales_data') || '{}');
        // Check if there are any sales records for this menu item
        return Boolean(salesData[menuItemId] && salesData[menuItemId].length > 0);
    }
    catch (error) {
        console.error('Failed to check if menu item has sales data:', error);
        return false; // Assume it has no sales data if we can't check
    }
}
/**
 * Perform integrity checks before deleting a menu item
 *
 * @param menuItemId The ID of the menu item to check
 * @param menuItemName The name of the menu item (for better error messages)
 * @returns The result of the integrity check
 */
export async function checkMenuItemDeletionIntegrity(menuItemId, menuItemName) {
    const errors = [];
    const warnings = [];
    // Check if the menu item is used in active orders
    const usedInOrders = await isMenuItemUsedInActiveOrders(menuItemId);
    if (usedInOrders) {
        errors.push({
            message: `Cannot delete "${menuItemName}" because it is part of active orders`,
            code: 'MENU_ITEM_IN_ACTIVE_ORDERS',
            severity: 'error',
            metadata: { menuItemId },
        });
    }
    // Check if the menu item is part of any combo or special deal
    const inCombos = await isMenuItemInCombos(menuItemId);
    if (inCombos) {
        warnings.push({
            message: `"${menuItemName}" is part of one or more combo meals or special deals`,
            code: 'MENU_ITEM_IN_COMBOS',
            severity: 'warning',
            metadata: { menuItemId },
        });
    }
    // Check if the menu item has sales data
    const hasSalesData = await hasMenuItemSalesData(menuItemId);
    if (hasSalesData) {
        warnings.push({
            message: `"${menuItemName}" has sales history data that will be orphaned`,
            code: 'MENU_ITEM_HAS_SALES_DATA',
            severity: 'warning',
            metadata: { menuItemId },
        });
    }
    // Determine if we can proceed with the deletion
    const canProceed = errors.length === 0;
    return {
        canProceed,
        errors,
        warnings,
    };
}
export default {
    checkMenuItemDeletionIntegrity,
    isMenuItemUsedInActiveOrders,
    isMenuItemInCombos,
    hasMenuItemSalesData,
};
