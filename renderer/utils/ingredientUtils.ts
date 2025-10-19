/**
 * Utility functions for ingredient handling across the application
 */
import type { StockItem } from '@/types';

// Define the ingredient structure as used in the application forms
export interface IngredientWithQuantity {
  stockItemId: string;
  quantityRequired: number;
  unit?: string;
}

/**
 * Calculate the cost of ingredients based on quantities and stock items
 *
 * @param ingredients The ingredients with quantities
 * @param stockItems Available stock items with cost information
 * @returns Object with total cost, inventory status and detailed breakdown
 */
export function calculateIngredientCosts(
  ingredients: IngredientWithQuantity[],
  stockItems: StockItem[]
) {
  let totalCost = 0;
  let hasLowStock = false;
  let hasOutOfStock = false;
  const breakdown: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    cost: number;
    inStock: boolean;
    isLowStock: boolean;
  }> = [];

  ingredients.forEach(ingredient => {
    const stockItem = stockItems.find(
      item => item.id === ingredient.stockItemId
    );

    if (stockItem) {
      const cost = stockItem.costPerUnit * ingredient.quantityRequired;
      totalCost += cost;

      // Check if enough inventory is available
      const inStock = stockItem.currentStock >= ingredient.quantityRequired;
      const isLowStock = stockItem.currentStock <= stockItem.minimumStock;

      if (!inStock) hasOutOfStock = true;
      if (isLowStock) hasLowStock = true;

      breakdown.push({
        id: stockItem.id,
        name: stockItem.itemName,
        quantity: ingredient.quantityRequired,
        unit: stockItem.unit,
        cost,
        inStock,
        isLowStock,
      });
    }
  });

  return {
    totalCost,
    hasLowStock,
    hasOutOfStock,
    breakdown,
  };
}

/**
 * Convert string ingredient IDs to structured ingredient objects with quantities
 *
 * @param ingredientIds Array of stock item IDs from the API
 * @param stockItems Available stock items
 * @param defaultQuantity Default quantity to use if not specified
 * @returns Array of structured ingredients with quantities and units
 */
export function convertIngredientsFromApi(
  ingredientIds: string[],
  stockItems: StockItem[],
  defaultQuantity = 1
): IngredientWithQuantity[] {
  if (!Array.isArray(ingredientIds)) return [];

  return ingredientIds.map(ingredientId => {
    const stockItem = stockItems.find(item => item.id === ingredientId);
    return {
      stockItemId: ingredientId,
      quantityRequired: defaultQuantity,
      unit: stockItem?.unit || '',
    };
  });
}

/**
 * Convert structured ingredients back to string IDs for the API
 *
 * @param ingredients Array of ingredient objects with quantities
 * @returns Array of stock item IDs for the API
 */
export function convertIngredientsForApi(
  ingredients: IngredientWithQuantity[]
): string[] {
  if (!Array.isArray(ingredients)) return [];

  return ingredients.map(ing => ing.stockItemId);
}

// Cache for ingredient names to prevent repeated lookups and improve performance
const ingredientNameCache = new Map<string, string>();

/**
 * Get ingredient name from stock item ID with improved error handling and caching
 *
 * @param ingredientId The stock item ID
 * @param stockItems Available stock items
 * @param allowUnknown Whether to return 'Unknown ingredient' (default: false for better UX)
 * @returns The name of the ingredient, cached name, or null if not found and allowUnknown is false
 */
export function getIngredientNameById(
  ingredientId: string,
  stockItems: StockItem[],
  allowUnknown: boolean = false
): string | null {
  // Return cached result if available
  if (ingredientNameCache.has(ingredientId)) {
    const cachedName = ingredientNameCache.get(ingredientId)!;
    // Don't return cached "Unknown ingredient" unless explicitly allowed
    if (cachedName !== 'Unknown ingredient' || allowUnknown) {
      return cachedName;
    }
  }

  // Early return if stock items aren't loaded yet
  if (!stockItems || stockItems.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'getIngredientNameById: Stock items not loaded yet for:',
        ingredientId
      );
    }
    return allowUnknown ? 'Loading...' : null;
  }

  // Input validation
  if (!ingredientId || typeof ingredientId !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'getIngredientNameById: Invalid ingredient ID:',
        ingredientId
      );
    }
    return allowUnknown ? 'Invalid ID' : null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('getIngredientNameById called with:', {
      ingredientId,
      stockItemsLength: stockItems.length,
      stockItemIds: stockItems.map(item => item.id),
      allowUnknown,
    });
  }

  const stockItem = stockItems.find(item => item.id === ingredientId);

  if (stockItem?.itemName) {
    // Cache the successful result
    ingredientNameCache.set(ingredientId, stockItem.itemName);

    if (process.env.NODE_ENV === 'development') {
      console.log('getIngredientNameById found:', {
        ingredientId,
        stockItemName: stockItem.itemName,
      });
    }

    return stockItem.itemName;
  }

  // Handle not found case
  if (process.env.NODE_ENV === 'development') {
    console.warn('getIngredientNameById: Ingredient not found:', {
      ingredientId,
      availableIds: stockItems.map(item => item.id),
      allowUnknown,
    });
  }

  if (allowUnknown) {
    // Cache the unknown result to prevent repeated failed lookups
    ingredientNameCache.set(ingredientId, 'Unknown ingredient');
    return 'Unknown ingredient';
  }

  return null;
}

/**
 * Clear the ingredient name cache (useful for testing or when stock data is refreshed)
 */
export function clearIngredientNameCache(): void {
  ingredientNameCache.clear();
  if (process.env.NODE_ENV === 'development') {
    console.log('Ingredient name cache cleared');
  }
}

/**
 * Get ingredient name with a safe fallback that doesn't show "Unknown ingredient"
 * unless explicitly requested. This is the recommended function for UI components.
 *
 * ENHANCED: Now supports both ingredient IDs and ingredient names for backward compatibility
 *
 * @param ingredientIdOrName The stock item ID or ingredient name
 * @param stockItems Available stock items
 * @param fallback Custom fallback text (default: empty string)
 * @returns The ingredient name or fallback
 */
export function getIngredientNameSafe(
  ingredientIdOrName: string | any,
  stockItems: StockItem[],
  fallback: string = ''
): string {
  // 🔥 CRITICAL FIX: Handle non-string inputs (Ingredient objects, null, undefined)
  if (!ingredientIdOrName) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'getIngredientNameSafe: Input is null/undefined:',
        ingredientIdOrName
      );
    }
    return fallback;
  }

  // If the input is an Ingredient object (new structure), extract the name
  if (typeof ingredientIdOrName === 'object' && ingredientIdOrName.name) {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'getIngredientNameSafe: Received Ingredient object:',
        ingredientIdOrName
      );
    }
    return ingredientIdOrName.name;
  }

  // If the input is an Ingredient object with id, try to find by ID
  if (typeof ingredientIdOrName === 'object' && ingredientIdOrName.id) {
    const resultById = getIngredientNameById(
      ingredientIdOrName.id,
      stockItems,
      false
    );
    if (resultById) {
      return resultById;
    }
    // Fallback to object's name property if ID lookup fails
    if (ingredientIdOrName.name) {
      return ingredientIdOrName.name;
    }
  }

  // Convert to string if not already (handles numbers, etc.)
  const stringInput = String(ingredientIdOrName);

  // First try to find by ID (original behavior)
  const resultById = getIngredientNameById(stringInput, stockItems, false);
  if (resultById) {
    return resultById;
  }

  // If not found by ID, check if the input is already a name that matches an inventory item
  if (stockItems && stockItems.length > 0) {
    const matchingItem = stockItems.find(
      item => item.itemName?.toLowerCase() === stringInput.toLowerCase()
    );
    if (matchingItem) {
      if (process.env.NODE_ENV === 'development') {
        console.log('getIngredientNameSafe: Found by name match:', {
          input: stringInput,
          matchedItem: matchingItem.itemName,
          itemId: matchingItem.id,
        });
      }
      return matchingItem.itemName;
    }
  }

  // If no inventory match found, but the input looks like a reasonable ingredient name,
  // return it as-is (this handles menu items with ingredient names that don't have inventory)
  if (stringInput && stringInput.trim()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'getIngredientNameSafe: Using ingredient name as-is:',
        stringInput
      );
    }
    return stringInput;
  }

  return fallback;
}

/**
 * Get multiple ingredient names from stock item IDs
 *
 * @param ingredientIds Array of stock item IDs
 * @param stockItems Available stock items
 * @param allowUnknown Whether to include "Unknown ingredient" in results
 * @returns Array of ingredient names (excludes null values unless allowUnknown is true)
 */
export function getIngredientNamesByIds(
  ingredientIds: string[],
  stockItems: StockItem[],
  allowUnknown: boolean = false
): string[] {
  if (!Array.isArray(ingredientIds)) return [];

  return ingredientIds
    .map(id => getIngredientNameById(id, stockItems, allowUnknown))
    .filter((name): name is string => name !== null);
}

/**
 * Calculate profit metrics for a menu item
 *
 * @param price The selling price of the menu item
 * @param totalIngredientCost The total cost of ingredients
 * @returns Object containing profit margin and gross profit
 */
export function calculateProfitMetrics(
  price: number,
  totalIngredientCost: number
) {
  const grossProfit = price - totalIngredientCost;
  const profitMargin = price > 0 ? (grossProfit / price) * 100 : 0;

  return {
    grossProfit,
    profitMargin,
    profitClass:
      profitMargin >= 50
        ? 'text-green-600'
        : profitMargin >= 30
          ? 'text-yellow-600'
          : 'text-red-600',
  };
}

export default {
  calculateIngredientCosts,
  convertIngredientsFromApi,
  convertIngredientsForApi,
  calculateProfitMetrics,
  getIngredientNameById,
  getIngredientNamesByIds,
  getIngredientNameSafe,
  clearIngredientNameCache,
};
