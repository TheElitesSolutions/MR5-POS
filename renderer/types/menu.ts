/**
 * Type definitions for menu items
 */
import { MenuItem, Ingredient } from '../../shared/ipc-types';

// Define the shape of menu items as used in the UI
// This is different from the IPC type as it enforces string dates
export interface UIMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  categoryId?: string; // Added to support category ID
  imageUrl?: string;
  isAvailable: boolean;
  isCustomizable: boolean;
  isVisibleOnWebsite: boolean;
  preparationTime?: number;
  ingredients?: Ingredient[];
  allergens?: string[];
  createdAt: string;
  updatedAt: string;
  isOptimistic?: boolean;
  isOptimisticallyUpdated?: boolean;
}

// Helper to convert from API format to UI format
export function convertToUIMenuItem(item: MenuItem): UIMenuItem {
  return {
    ...item,
    createdAt:
      typeof item.createdAt === 'string'
        ? item.createdAt
        : item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : new Date().toISOString(),
    updatedAt:
      typeof item.updatedAt === 'string'
        ? item.updatedAt
        : item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : new Date().toISOString(),
    isAvailable: item.isAvailable ?? true,
    isCustomizable: item.isCustomizable ?? false,
    isVisibleOnWebsite: item.isVisibleOnWebsite ?? true,
  };
}

// Helper to convert from UI format to API format
export function convertToAPIMenuItem(item: UIMenuItem): MenuItem {
  return {
    ...item,
    createdAt: item.createdAt, // Keep as string for API
    updatedAt: item.updatedAt, // Keep as string for API
  };
}

export default UIMenuItem;
