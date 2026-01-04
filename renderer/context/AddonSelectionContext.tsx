'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  AddonSelectionState,
  AddonSelection,
  AddonGroup,
  Addon,
  ValidationError,
  CategoryAddonGroup,
  AddonStockUpdate,
} from '@/types/addon';

interface AddonSelectionContextType {
  // State
  state: AddonSelectionState;

  // Core selection actions
  selectAddon: (menuItemId: string, addon: Addon, quantity: number) => void;
  deselectAddon: (menuItemId: string, addonId: string) => void;
  updateAddonQuantity: (
    menuItemId: string,
    addonId: string,
    quantity: number
  ) => void;
  clearAddons: (menuItemId?: string) => void;

  // Category and group management
  loadCategoryAddonGroups: (categoryId: string) => Promise<void>;

  // Stock management
  updateStockLevel: (addonId: string, stockLevel: number) => void;
  checkStockAvailability: (
    addonId: string,
    requiredQuantity: number
  ) => boolean;

  // Validation
  validateSelections: (menuItemId: string) => ValidationError[];
  getSelectionsForMenuItem: (menuItemId: string) => AddonSelection[];

  // Price calculations
  calculatePriceImpact: (menuItemId: string) => number;
  calculateTotalImpact: () => number;

  // Reset and cleanup
  resetState: () => void;
}

const AddonSelectionContext = createContext<
  AddonSelectionContextType | undefined
>(undefined);

interface AddonSelectionProviderProps {
  children: React.ReactNode;
}

export const AddonSelectionProvider: React.FC<AddonSelectionProviderProps> = ({
  children,
}) => {
  // Initialize addon selection state
  const [state, setState] = useState<AddonSelectionState>({
    selectedAddons: new Map(),
    currentCategory: null,
    availableGroups: [],
    loadingGroups: false,
    stockLevels: new Map(),
    priceImpact: 0,
    validationErrors: [],
    lastUpdated: null,
  });

  // IPC communication for fetching addon groups
  const loadCategoryAddonGroups = useCallback(async (categoryId: string) => {
    setState(prev => ({
      ...prev,
      loadingGroups: true,
      currentCategory: categoryId,
    }));

    try {
      // ✅ FIXED: Use correct IPC API path (window.electronAPI.ipc instead of window.electron.ipc)
      const response = await (window as any).electronAPI.ipc.invoke(
        'addon:getCategoryAddonGroups',
        {
          categoryId,
          includeInactive: false,
        }
      );

      if (response.success && response.data) {
        const { groups, addons } = response.data;

        // Group addons by their addonGroupId
        const addonsByGroupId = new Map<string, Addon[]>();
        addons?.forEach((addon: Addon) => {
          if (!addonsByGroupId.has(addon.addonGroupId)) {
            addonsByGroupId.set(addon.addonGroupId, []);
          }
          addonsByGroupId.get(addon.addonGroupId)!.push(addon);
        });

        // Attach addons to their groups
        const groupsWithAddons =
          groups?.map(group => ({
            ...group,
            addons: addonsByGroupId.get(group.id) || [],
          })) || [];

        // Update available groups with attached addons
        setState(prev => ({
          ...prev,
          availableGroups: groupsWithAddons,
          loadingGroups: false,
          lastUpdated: new Date(),
        }));

        // Update stock levels from addon data
        setState(prevState => {
          const stockUpdates = new Map(prevState.stockLevels);
          addons?.forEach((addon: any) => {
            // ✅ FIXED: If addon has inventory items, track stock; otherwise set to unlimited (9999)
            if (addon.inventoryItems && addon.inventoryItems.length > 0) {
              // Calculate total stock from inventory items
              const totalStock = addon.inventoryItems.reduce(
                (sum: number, item: any) => sum + (item.inventory?.currentStock || 0),
                0
              );
              stockUpdates.set(addon.id, totalStock);
            } else {
              // No inventory tracking for this addon - set to unlimited
              stockUpdates.set(addon.id, 9999);
            }
          });

          return {
            ...prevState,
            stockLevels: stockUpdates,
          };
        });

        console.log('✅ Loaded addon groups:', {
          groupsCount: groups?.length,
          addonsCount: addons?.length,
        });
      } else {
        console.error('❌ Failed to load addon groups:', response.error);
        setState(prev => ({
          ...prev,
          loadingGroups: false,
          availableGroups: [],
        }));
      }
    } catch (error) {
      console.error('❌ Error loading addon groups:', error);
      setState(prev => ({
        ...prev,
        loadingGroups: false,
        availableGroups: [],
      }));
    }
  }, []);

  // Select an addon for a menu item
  const selectAddon = useCallback(
    (menuItemId: string, addon: Addon, quantity: number) => {
      setState(prev => {
        const newSelectedAddons = new Map(prev.selectedAddons);
        const currentSelections = newSelectedAddons.get(menuItemId) || [];

        // Check if addon already selected
        const existingIndex = currentSelections.findIndex(
          s => s.addonId === addon.id
        );

        const addonSelection: AddonSelection = {
          addonId: addon.id,
          addon,
          quantity,
          unitPrice: addon.price,
          totalPrice: addon.price * quantity,
          notes: '',
        };

        // ✅ FIX: Create NEW array instead of mutating
        let newSelections: AddonSelection[];
        if (existingIndex >= 0) {
          // Update existing selection - create new array with updated item
          newSelections = [
            ...currentSelections.slice(0, existingIndex),
            addonSelection,
            ...currentSelections.slice(existingIndex + 1),
          ];
        } else {
          // Add new selection - create new array with added item
          newSelections = [...currentSelections, addonSelection];
        }

        newSelectedAddons.set(menuItemId, newSelections);

        return {
          ...prev,
          selectedAddons: newSelectedAddons,
          lastUpdated: new Date(),
        };
      });
    },
    []
  );

  // Deselect an addon
  const deselectAddon = useCallback((menuItemId: string, addonId: string) => {
    setState(prev => {
      const newSelectedAddons = new Map(prev.selectedAddons);
      const currentSelections = newSelectedAddons.get(menuItemId) || [];

      const filteredSelections = currentSelections.filter(
        s => s.addonId !== addonId
      );

      if (filteredSelections.length > 0) {
        newSelectedAddons.set(menuItemId, filteredSelections);
      } else {
        newSelectedAddons.delete(menuItemId);
      }

      return {
        ...prev,
        selectedAddons: newSelectedAddons,
        lastUpdated: new Date(),
      };
    });
  }, []);

  // Update addon quantity
  const updateAddonQuantity = useCallback(
    (menuItemId: string, addonId: string, quantity: number) => {
      setState(prev => {
        const newSelectedAddons = new Map(prev.selectedAddons);
        const currentSelections = newSelectedAddons.get(menuItemId) || [];

        const selectionIndex = currentSelections.findIndex(
          s => s.addonId === addonId
        );
        if (selectionIndex >= 0 && quantity > 0) {
          const selection = currentSelections[selectionIndex];
          if (selection) {
            // ✅ FIX: Create NEW array instead of mutating
            const updatedSelection = {
              ...selection,
              quantity,
              totalPrice: selection.unitPrice * quantity,
            };
            const newSelections = [
              ...currentSelections.slice(0, selectionIndex),
              updatedSelection,
              ...currentSelections.slice(selectionIndex + 1),
            ];
            newSelectedAddons.set(menuItemId, newSelections);
          }
        }

        return {
          ...prev,
          selectedAddons: newSelectedAddons,
          lastUpdated: new Date(),
        };
      });
    },
    []
  );

  // Clear addons for specific menu item or all
  const clearAddons = useCallback((menuItemId?: string) => {
    setState(prev => {
      if (menuItemId) {
        const newSelectedAddons = new Map(prev.selectedAddons);
        newSelectedAddons.delete(menuItemId);
        return {
          ...prev,
          selectedAddons: newSelectedAddons,
          lastUpdated: new Date(),
        };
      } else {
        return {
          ...prev,
          selectedAddons: new Map(),
          lastUpdated: new Date(),
        };
      }
    });
  }, []);

  // Update stock level
  const updateStockLevel = useCallback(
    (addonId: string, stockLevel: number) => {
      setState(prev => {
        const newStockLevels = new Map(prev.stockLevels);
        newStockLevels.set(addonId, stockLevel);
        return {
          ...prev,
          stockLevels: newStockLevels,
        };
      });
    },
    []
  );

  // Check stock availability
  const checkStockAvailability = useCallback(
    (addonId: string, requiredQuantity: number): boolean => {
      const currentStock = state.stockLevels.get(addonId) || 0;
      return currentStock >= requiredQuantity;
    },
    [state.stockLevels]
  );

  // Validate selections for a menu item
  const validateSelections = useCallback(
    (menuItemId: string): ValidationError[] => {
      const errors: ValidationError[] = [];
      const selections = state.selectedAddons.get(menuItemId) || [];

      // Group selections by addon group
      const groupSelections = new Map<string, AddonSelection[]>();
      selections.forEach(selection => {
        const groupId = selection.addon.addonGroupId;
        if (!groupSelections.has(groupId)) {
          groupSelections.set(groupId, []);
        }
        groupSelections.get(groupId)!.push(selection);
      });

      // Validate each group
      state.availableGroups.forEach(group => {
        const groupItems = groupSelections.get(group.id) || [];
        const totalQuantity = groupItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        // Check minimum selections
        if (group.minSelections > 0 && totalQuantity < group.minSelections) {
          errors.push({
            type: 'MIN_SELECTION',
            groupId: group.id,
            groupName: group.name,
            message: `${group.name} requires at least ${group.minSelections} selections`,
            severity: 'error',
          });
        }

        // Check maximum selections
        if (group.maxSelections && totalQuantity > group.maxSelections) {
          errors.push({
            type: 'MAX_SELECTION',
            groupId: group.id,
            groupName: group.name,
            message: `${group.name} allows maximum ${group.maxSelections} selections`,
            severity: 'error',
          });
        }

        // Check stock availability
        groupItems.forEach(selection => {
          if (!checkStockAvailability(selection.addonId, selection.quantity)) {
            errors.push({
              type: 'OUT_OF_STOCK',
              groupId: group.id,
              groupName: group.name,
              message: `${selection.addon.name} is out of stock`,
              severity: 'error',
            });
          }
        });
      });

      return errors;
    },
    [state.selectedAddons, state.availableGroups, checkStockAvailability]
  );

  // Get selections for specific menu item
  const getSelectionsForMenuItem = useCallback(
    (menuItemId: string): AddonSelection[] => {
      return state.selectedAddons.get(menuItemId) || [];
    },
    [state.selectedAddons]
  );

  // Calculate price impact for menu item
  const calculatePriceImpact = useCallback(
    (menuItemId: string): number => {
      const selections = state.selectedAddons.get(menuItemId) || [];
      return selections.reduce(
        (total, selection) => total + selection.totalPrice,
        0
      );
    },
    [state.selectedAddons]
  );

  // Calculate total price impact
  const calculateTotalImpact = useCallback((): number => {
    let total = 0;
    state.selectedAddons.forEach(selections => {
      total += selections.reduce(
        (sum, selection) => sum + selection.totalPrice,
        0
      );
    });
    return total;
  }, [state.selectedAddons]);

  // Reset state
  const resetState = useCallback(() => {
    setState({
      selectedAddons: new Map(),
      currentCategory: null,
      availableGroups: [],
      loadingGroups: false,
      stockLevels: new Map(),
      priceImpact: 0,
      validationErrors: [],
      lastUpdated: null,
    });
  }, []);

  // Update price impact when selections change
  useEffect(() => {
    const newPriceImpact = calculateTotalImpact();
    if (newPriceImpact !== state.priceImpact) {
      setState(prev => ({ ...prev, priceImpact: newPriceImpact }));
    }
  }, [state.selectedAddons, calculateTotalImpact, state.priceImpact]);

  const contextValue = useMemo(
    () => ({
      state,
      selectAddon,
      deselectAddon,
      updateAddonQuantity,
      clearAddons,
      loadCategoryAddonGroups,
      updateStockLevel,
      checkStockAvailability,
      validateSelections,
      getSelectionsForMenuItem,
      calculatePriceImpact,
      calculateTotalImpact,
      resetState,
    }),
    [
      state,
      selectAddon,
      deselectAddon,
      updateAddonQuantity,
      clearAddons,
      loadCategoryAddonGroups,
      updateStockLevel,
      checkStockAvailability,
      validateSelections,
      getSelectionsForMenuItem,
      calculatePriceImpact,
      calculateTotalImpact,
      resetState,
    ]
  );

  return (
    <AddonSelectionContext.Provider value={contextValue}>
      {children}
    </AddonSelectionContext.Provider>
  );
};

// Custom hook to use addon selection context
export const useAddonSelection = (): AddonSelectionContextType => {
  const context = useContext(AddonSelectionContext);
  if (context === undefined) {
    throw new Error(
      'useAddonSelection must be used within an AddonSelectionProvider'
    );
  }
  return context;
};

export default AddonSelectionContext;
