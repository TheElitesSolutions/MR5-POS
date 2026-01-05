/**
 * Price Utilities for the POS System
 *
 * This file provides utility functions for handling prices consistently
 * throughout the application, especially after system restart.
 */

import { MenuItem, OrderItem } from '@/types';

/**
 * Default prices for menu items based on patterns in their names.
 * This serves as a fallback when database prices are lost or corrupted.
 */
const DEFAULT_PRICES = [
  { pattern: /test menu item/i, price: 10.0 },
  { pattern: /burger/i, price: 12.99 },
  { pattern: /pizza/i, price: 14.99 },
  { pattern: /salad/i, price: 8.99 },
  { pattern: /drink/i, price: 3.99 },
  { pattern: /dessert/i, price: 6.99 },
  { pattern: /appetizer/i, price: 7.99 },
  // Add more patterns as needed
];

/**
 * Default fallback price when no other price is available
 */
const FALLBACK_PRICE = 9.99;

/**
 * Get the correct price for a menu item, handling potential null/undefined/zero prices
 * that might occur after system restarts.
 *
 * @param menuItem The menu item object
 * @returns The correct price or a reasonable default
 */
export function getMenuItemPrice(
  menuItem: MenuItem | null | undefined
): number {
  // If no menu item, return default
  if (!menuItem) return FALLBACK_PRICE;

  // Use the actual price if it's valid
  if (menuItem.price && menuItem.price > 0) {
    return menuItem.price;
  }

  // Look for pattern-based price
  const matchingDefault = DEFAULT_PRICES.find(
    def => menuItem.name && def.pattern.test(menuItem.name)
  );

  // Return matching price or fallback
  return matchingDefault ? matchingDefault.price : FALLBACK_PRICE;
}

/**
 * Get the correct unit price for an order item, handling cases where the price might be lost
 *
 * @param orderItem The order item
 * @returns The correct unit price
 */
export function getOrderItemUnitPrice(
  orderItem: OrderItem | null | undefined
): number {
  // If no order item, return default
  if (!orderItem) return FALLBACK_PRICE;

  // Try all possible price fields in order of preference
  if (orderItem.unitPrice && orderItem.unitPrice > 0) {
    return orderItem.unitPrice;
  }

  if (orderItem.price && orderItem.price > 0) {
    return orderItem.price;
  }

  // Look for pattern-based price
  const itemName = orderItem.name || orderItem.menuItemName || '';
  const matchingDefault = DEFAULT_PRICES.find(
    def => itemName && def.pattern.test(itemName)
  );

  // Return matching price or fallback
  return matchingDefault ? matchingDefault.price : FALLBACK_PRICE;
}

/**
 * Get the total price for an order item based on unit price, quantity, and addons
 *
 * @param orderItem The order item
 * @returns The calculated total price including addons
 */
export function getOrderItemTotalPrice(
  orderItem: OrderItem | null | undefined
): number {
  if (!orderItem) return 0;

  const quantity = orderItem.quantity || 1;

  // ✅ FIX: Backend stores totalPrice WITH addons already included
  // Return it directly to avoid double-counting addon prices
  if (orderItem.totalPrice && orderItem.totalPrice > 0) {
    return orderItem.totalPrice; // Already includes addons
  }

  // Fallback: Calculate from scratch if totalPrice not available
  if (orderItem.subtotal && orderItem.subtotal > 0) {
    // Check if subtotal also includes addons (return directly)
    return orderItem.subtotal;
  }

  // Manual calculation: base price + addons
  const unitPrice = getOrderItemUnitPrice(orderItem);
  const basePrice = unitPrice * quantity;

  // Add addon prices from the addons array, scaled by item quantity
  const addonTotal = (orderItem.addons || []).reduce((sum, addon) => {
    // Calculate per-item addon cost (unitPrice × addon quantity)
    const addonPerItemCost = Number(addon.unitPrice) * addon.quantity;

    // Scale by item quantity
    const scaledAddonCost = addonPerItemCost * (orderItem.quantity || 1);

    return sum + scaledAddonCost;
  }, 0);

  return basePrice + addonTotal;
}

/**
 * Format a price as a currency string
 *
 * @param price The price to format
 * @param options Formatting options
 * @returns Formatted price string
 */
export function formatPrice(
  price: number | null | undefined,
  { showCurrency = true, decimals = 2 } = {}
): string {
  const safePrice = price ?? 0;
  const formatted = safePrice.toFixed(decimals);
  return showCurrency ? `$${formatted}` : formatted;
}
