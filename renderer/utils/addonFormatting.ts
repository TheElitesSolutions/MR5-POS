'use client';

import { OrderItem, OrderItemAddon } from '@/types';

interface AddonGroup {
  groupName: string;
  addons: OrderItemAddon[];
  totalPrice: number;
  totalQuantity: number;
}

interface FormattedOrderItem extends OrderItem {
  formattedAddons: AddonGroup[];
  addonSummary: {
    totalAddonPrice: number;
    totalAddonCount: number;
    hasAddons: boolean;
  };
}

export interface OrderSummary {
  subtotal: number;
  addonTotal: number;
  itemCount: number;
  addonCount: number;
  finalTotal: number;
  hasAddons: boolean;
}

// Additional types for component interfaces
export interface OrderItemDisplayProps {
  orderItem: OrderItem;
  showAddons?: boolean;
  compact?: boolean;
}

export interface OrderListDisplayProps {
  orderItems: OrderItem[];
  showAddons?: boolean;
  showActions?: boolean;
}

export interface OrderSummaryDisplayProps {
  orderSummary: OrderSummary;
  showBreakdown?: boolean;
  compact?: boolean;
}

/**
 * Comprehensive utility functions for formatting and displaying add-ons in orders
 *
 * Features:
 * - Group add-ons by type/category
 * - Calculate pricing summaries
 * - Format display text
 * - Mobile-optimized formatting
 * - Accessibility-friendly descriptions
 */

/**
 * Groups add-ons by their group/category for better display
 */
export const groupAddonsByCategory = (
  addons: OrderItemAddon[]
): AddonGroup[] => {
  if (!addons || addons.length === 0) {
    return [];
  }

  // Group addons by their group name (assuming addon has groupName property)
  const groupMap = new Map<string, OrderItemAddon[]>();

  addons.forEach(addon => {
    // If addon doesn't have a group, use 'Add-ons' as default
    const groupName = addon.addonName || 'Add-ons';

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }

    groupMap.get(groupName)!.push(addon);
  });

  // Convert to array format with totals
  return Array.from(groupMap.entries())
    .map(([groupName, groupAddons]) => {
      const totalPrice = groupAddons.reduce(
        (sum, addon) => sum + addon.totalPrice,
        0
      );
      const totalQuantity = groupAddons.reduce(
        (sum, addon) => sum + addon.quantity,
        0
      );

      return {
        groupName,
        addons: groupAddons.sort((a, b) =>
          a.addonName.localeCompare(b.addonName)
        ),
        totalPrice,
        totalQuantity,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
};

/**
 * Formats an order item with enhanced addon information
 */
export const formatOrderItemWithAddons = (
  orderItem: OrderItem
): FormattedOrderItem => {
  const addons = orderItem.addons || [];
  const formattedAddons = groupAddonsByCategory(addons);

  const totalAddonPrice = addons.reduce(
    (sum, addon) => sum + addon.totalPrice,
    0
  );
  const totalAddonCount = addons.reduce(
    (sum, addon) => sum + addon.quantity,
    0
  );

  return {
    ...orderItem,
    formattedAddons,
    addonSummary: {
      totalAddonPrice,
      totalAddonCount,
      hasAddons: addons.length > 0,
    },
  };
};

/**
 * Creates a concise addon summary text for display
 */
export const getAddonSummaryText = (
  addons: OrderItemAddon[],
  format: 'short' | 'detailed' = 'short'
): string => {
  if (!addons || addons.length === 0) {
    return '';
  }

  if (format === 'short') {
    const totalCount = addons.reduce((sum, addon) => sum + addon.quantity, 0);
    const totalPrice = addons.reduce((sum, addon) => sum + addon.totalPrice, 0);

    return `${totalCount} add-on${totalCount !== 1 ? 's' : ''} (+$${totalPrice.toFixed(2)})`;
  }

  // Detailed format
  const grouped = groupAddonsByCategory(addons);
  return grouped
    .map(
      group =>
        `${group.groupName}: ${group.addons
          .map(
            addon =>
              `${addon.addonName}${addon.quantity > 1 ? ` x${addon.quantity}` : ''}`
          )
          .join(', ')}`
    )
    .join('; ');
};

/**
 * Generates accessibility-friendly description for add-ons
 */
export const getAddonAccessibilityText = (addons: OrderItemAddon[]): string => {
  if (!addons || addons.length === 0) {
    return 'No add-ons';
  }

  const totalCount = addons.reduce((sum, addon) => sum + addon.quantity, 0);
  const totalPrice = addons.reduce((sum, addon) => sum + addon.totalPrice, 0);

  const addonList = addons
    .map(
      addon =>
        `${addon.addonName}${addon.quantity > 1 ? ` quantity ${addon.quantity}` : ''} at ${addon.unitPrice.toFixed(2)} dollars each`
    )
    .join(', ');

  return `${totalCount} add-on${totalCount !== 1 ? 's' : ''} selected: ${addonList}. Total add-on cost: ${totalPrice.toFixed(2)} dollars.`;
};

/**
 * Calculates order summary including add-on totals
 */
export const calculateOrderSummary = (
  orderItems: OrderItem[]
): OrderSummary => {
  let subtotal = 0;
  let addonTotal = 0;
  let itemCount = 0;
  let addonCount = 0;

  orderItems.forEach(item => {
    // Base item cost
    const itemPrice = (item.unitPrice || item.price || 0) * item.quantity;
    subtotal += itemPrice;
    itemCount += item.quantity;

    // Add-on costs
    if (item.addons) {
      const itemAddonTotal = item.addons.reduce(
        (sum, addon) => sum + addon.totalPrice,
        0
      );
      const itemAddonCount = item.addons.reduce(
        (sum, addon) => sum + addon.quantity,
        0
      );

      // Multiply addon total by item quantity (if item quantity > 1, addons apply to all)
      addonTotal += itemAddonTotal * item.quantity;
      addonCount += itemAddonCount * item.quantity;
    }

    // Alternative: use addonTotal field if available
    if (item.addonTotal) {
      addonTotal += item.addonTotal * item.quantity;
    }
  });

  return {
    subtotal,
    addonTotal,
    itemCount,
    addonCount,
    finalTotal: subtotal + addonTotal,
    hasAddons: addonCount > 0,
  };
};

/**
 * Formats price with proper currency formatting
 */
export const formatPrice = (
  price: number,
  includeCurrency: boolean = true
): string => {
  const formatted = price.toFixed(2);
  return includeCurrency ? `$${formatted}` : formatted;
};

/**
 * Creates a mobile-friendly short description of add-ons
 */
export const getMobileAddonSummary = (addons: OrderItemAddon[]): string => {
  if (!addons || addons.length === 0) {
    return '';
  }

  if (addons.length === 1) {
    const addon = addons[0];
    return `+${addon.addonName}${addon.quantity > 1 ? ` x${addon.quantity}` : ''}`;
  }

  const totalCount = addons.reduce((sum, addon) => sum + addon.quantity, 0);
  return `+${totalCount} add-ons`;
};

/**
 * Gets the most expensive addon for highlighting
 */
export const getHighlightAddon = (
  addons: OrderItemAddon[]
): OrderItemAddon | null => {
  if (!addons || addons.length === 0) {
    return null;
  }

  return addons.reduce((highest, current) =>
    current.totalPrice > highest.totalPrice ? current : highest
  );
};

/**
 * Validates that addon prices match expected totals
 */
export const validateAddonPricing = (
  addons: OrderItemAddon[]
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  let isValid = true;

  addons.forEach((addon, index) => {
    const expectedTotal = addon.unitPrice * addon.quantity;
    const actualTotal = addon.totalPrice;

    if (Math.abs(expectedTotal - actualTotal) > 0.01) {
      // Allow for small floating point differences
      errors.push(
        `Addon ${index + 1} (${addon.addonName}): Expected total ${expectedTotal.toFixed(2)}, got ${actualTotal.toFixed(2)}`
      );
      isValid = false;
    }

    if (addon.quantity <= 0) {
      errors.push(
        `Addon ${index + 1} (${addon.addonName}): Invalid quantity ${addon.quantity}`
      );
      isValid = false;
    }

    if (addon.unitPrice < 0) {
      errors.push(
        `Addon ${index + 1} (${addon.addonName}): Invalid unit price ${addon.unitPrice}`
      );
      isValid = false;
    }
  });

  return { isValid, errors };
};

/**
 * Sorts addons for optimal display (by price descending, then alphabetically)
 */
export const sortAddonsForDisplay = (
  addons: OrderItemAddon[]
): OrderItemAddon[] => {
  return [...addons].sort((a, b) => {
    // Sort by total price descending first
    if (b.totalPrice !== a.totalPrice) {
      return b.totalPrice - a.totalPrice;
    }
    // Then alphabetically by name
    return a.addonName.localeCompare(b.addonName);
  });
};

/**
 * Formats addon selection data for display
 */
export const formatAddonSelection = (addon: OrderItemAddon): string => {
  const name = addon.addonName;
  const qty = addon.quantity > 1 ? `${addon.quantity}x ` : '';
  const price = formatPrice(addon.totalPrice);
  return `${qty}${name} (+${price})`;
};

export default {
  groupAddonsByCategory,
  formatOrderItemWithAddons,
  getAddonSummaryText,
  getAddonAccessibilityText,
  calculateOrderSummary,
  formatPrice,
  getMobileAddonSummary,
  getHighlightAddon,
  validateAddonPricing,
  sortAddonsForDisplay,
  formatAddonSelection,
};
