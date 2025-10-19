/**
 * Add-on Type Definitions for MR5 POS Frontend
 *
 * Integrates with existing type system and follows MR5 patterns
 * Based on Phase 1 database schema and Phase 2 backend implementation
 */

export interface AddonGroup {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  minSelections: number;
  maxSelections: number | null;
  createdAt: string;
  updatedAt: string;
  // Include addons when fetched with groups
  addons?: Addon[];
}

export interface AddonInventoryItem {
  inventoryId: string;
  quantity: number;
  inventory?: {
    id: string;
    itemName: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
  };
}

export interface Addon {
  id: string;
  name: string;
  description: string | null;
  price: number; // Already converted from Decimal to number by backend
  isActive: boolean;
  sortOrder: number;
  addonGroupId: string;
  createdAt: string;
  updatedAt: string;
  // Joined data from relationships
  addonGroup?: AddonGroup;
  inventoryItems?: AddonInventoryItem[];
}

export interface CategoryAddonGroup {
  id: string;
  categoryId: string;
  addonGroupId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Joined data
  addonGroup?: AddonGroup;
}

export interface AddonSelection {
  addonId: string;
  addon: Addon;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface OrderItemAddon {
  id: string;
  orderItemId: string;
  addonId: string;
  addonName: string; // Add addon name for easy display
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  // Joined data
  addon?: Addon;
}

// State management interfaces
export interface AddonSelectionState {
  selectedAddons: Map<string, AddonSelection[]>; // menuItemId -> addon selections
  currentCategory: string | null;
  availableGroups: AddonGroup[];
  loadingGroups: boolean;
  stockLevels: Map<string, number>; // addonId -> stock level
  priceImpact: number;
  validationErrors: ValidationError[];
  lastUpdated: Date | null;
}

export interface ValidationError {
  type: 'MIN_SELECTION' | 'MAX_SELECTION' | 'OUT_OF_STOCK' | 'INVALID_QUANTITY';
  groupId: string;
  groupName: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AddonConstraints {
  minSelections: number;
  maxSelections: number | null;
  allowQuantity: boolean;
  maxQuantityPerAddon: number;
}

// Props interfaces for components
export interface AddonSelectorProps {
  group: AddonGroup;
  addons: Addon[];
  constraints: AddonConstraints;
  selectedAddons: AddonSelection[];
  stockLevels: Map<string, number>;
  onSelectionChange: (selections: AddonSelection[]) => void;
  className?: string;
}

export interface PriceImpactProps {
  basePrice: number;
  addonTotal: number;
  finalPrice: number;
  showBreakdown?: boolean;
  className?: string;
}

// API response types (from backend)
export interface GetCategoryAddonGroupsResponse {
  success: boolean;
  data: {
    groups: AddonGroup[];
    addons: Addon[];
  };
  error?: string;
}

export interface AddonStockUpdate {
  addonId: string;
  currentStock: number;
  minimumStock: number;
  isAvailable: boolean;
  timestamp: string;
}

// Stock indicator types
export type StockStatus = 'available' | 'low' | 'insufficient' | 'out_of_stock';

export interface StockIndicatorProps {
  addonId: string;
  required: number;
  currentStock: number;
  minimumStock: number;
  showQuantity?: boolean;
  className?: string;
}
