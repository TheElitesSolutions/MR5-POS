'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  addonStockService,
  StockStatus,
  StockCheckResult,
  BulkStockCheckResult,
  AddonAlternative,
} from '@/services/addonStockService';
import { Addon, AddonSelection } from '@/types/addon';

interface UseAddonStockOptions {
  enableRealTimeUpdates?: boolean;
  updateInterval?: number;
  showToastWarnings?: boolean;
  autoCheckOnSelectionChange?: boolean;
}

interface UseAddonStockReturn {
  // Stock status for individual add-ons
  getStockStatus: (addon: Addon) => Promise<StockStatus>;
  stockStatuses: Map<string, StockStatus>;

  // Bulk stock checking
  checkBulkStock: (
    selections: AddonSelection[]
  ) => Promise<BulkStockCheckResult>;
  bulkStockResult: BulkStockCheckResult | null;

  // Individual stock checking
  checkStock: (
    addonId: string,
    quantity: number,
    existingSelections?: AddonSelection[]
  ) => Promise<StockCheckResult>;

  // Alternative suggestions
  getAlternatives: (
    addon: Addon,
    quantity: number
  ) => Promise<AddonAlternative[]>;
  alternatives: Map<string, AddonAlternative[]>;

  // Stock validation helpers
  canSelectQuantity: (addon: Addon, quantity: number) => boolean;
  getMaxQuantity: (addon: Addon) => number;
  hasStockWarnings: boolean;
  hasStockErrors: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Cache management
  refreshStockData: () => void;
  clearStockCache: () => void;
}

/**
 * Custom hook for addon stock management
 *
 * Features:
 * - Real-time stock status tracking
 * - Bulk stock validation
 * - Alternative suggestions for out-of-stock items
 * - Toast notifications for stock warnings
 * - Performance optimized with caching
 */
export const useAddonStock = (
  options: UseAddonStockOptions = {}
): UseAddonStockReturn => {
  const {
    enableRealTimeUpdates = true,
    updateInterval = 15000, // 15 seconds
    showToastWarnings = true,
    autoCheckOnSelectionChange = true,
  } = options;

  const { toast } = useToast();

  // State management
  const [stockStatuses, setStockStatuses] = useState<Map<string, StockStatus>>(
    new Map()
  );
  const [bulkStockResult, setBulkStockResult] =
    useState<BulkStockCheckResult | null>(null);
  const [alternatives, setAlternatives] = useState<
    Map<string, AddonAlternative[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribedAddonIds, setSubscribedAddonIds] = useState<string[]>([]);

  // Get stock status for a single add-on
  const getStockStatus = useCallback(
    async (addon: Addon): Promise<StockStatus> => {
      try {
        setError(null);
        const status = await addonStockService.getStockStatus(addon);

        // Update the cached status
        setStockStatuses(prev => new Map(prev).set(addon.id, status));

        return status;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get stock status';
        setError(errorMessage);
        console.error('Error getting stock status:', err);
        throw err;
      }
    },
    []
  );

  // Check stock for multiple selections
  const checkBulkStock = useCallback(
    async (selections: AddonSelection[]): Promise<BulkStockCheckResult> => {
      try {
        setIsLoading(true);
        setError(null);

        const request = {
          selections: selections.map(s => ({
            addonId: s.addonId,
            quantity: s.quantity,
          })),
        };

        const result = await addonStockService.checkBulkStock(request);
        setBulkStockResult(result);

        // Update individual stock statuses
        const newStatuses = new Map(stockStatuses);
        for (const checkResult of result.results) {
          newStatuses.set(checkResult.addonId, checkResult.status);
        }
        setStockStatuses(newStatuses);

        // Update alternatives
        const newAlternatives = new Map(alternatives);
        for (const alt of result.alternatives) {
          newAlternatives.set(alt.forAddonId, alt.suggestions);
        }
        setAlternatives(newAlternatives);

        // Show toast warnings if enabled
        if (showToastWarnings) {
          if (
            result.overallStatus === 'errors' &&
            result.blockedSelections.length > 0
          ) {
            toast({
              title: 'Stock Unavailable',
              description: `${result.blockedSelections.length} item${result.blockedSelections.length !== 1 ? 's are' : ' is'} out of stock`,
              variant: 'destructive',
            });
          } else if (
            result.overallStatus === 'warnings' &&
            result.warnings.length > 0
          ) {
            const highPriorityWarnings = result.warnings.filter(
              w => w.severity === 'high'
            );
            if (highPriorityWarnings.length > 0) {
              toast({
                title: 'Stock Warning',
                description: highPriorityWarnings[0].message,
                variant: 'default',
              });
            }
          }
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to check stock';
        setError(errorMessage);
        console.error('Error checking bulk stock:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [stockStatuses, alternatives, showToastWarnings, toast]
  );

  // Check stock for a single add-on
  const checkStock = useCallback(
    async (
      addonId: string,
      quantity: number,
      existingSelections?: AddonSelection[]
    ): Promise<StockCheckResult> => {
      try {
        setError(null);

        const result = await addonStockService.checkStockAvailability({
          addonId,
          requestedQuantity: quantity,
          existingSelections,
        });

        // Update cached status
        setStockStatuses(prev => new Map(prev).set(addonId, result.status));

        // Update alternatives if any
        if (result.alternatives.length > 0) {
          setAlternatives(prev =>
            new Map(prev).set(addonId, result.alternatives)
          );
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to check stock';
        setError(errorMessage);
        console.error('Error checking stock:', err);
        throw err;
      }
    },
    []
  );

  // Get alternatives for an add-on
  const getAlternatives = useCallback(
    async (addon: Addon, quantity: number): Promise<AddonAlternative[]> => {
      try {
        setError(null);

        const alternativeResults = await addonStockService.getAlternatives(
          addon,
          quantity
        );

        // Cache the alternatives
        setAlternatives(prev =>
          new Map(prev).set(addon.id, alternativeResults)
        );

        return alternativeResults;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get alternatives';
        setError(errorMessage);
        console.error('Error getting alternatives:', err);
        throw err;
      }
    },
    []
  );

  // Validation helpers
  const canSelectQuantity = useCallback(
    (addon: Addon, quantity: number): boolean => {
      const status = stockStatuses.get(addon.id);
      return status ? status.canSelect(quantity) : true; // Default to true if no status available
    },
    [stockStatuses]
  );

  const getMaxQuantity = useCallback(
    (addon: Addon): number => {
      const status = stockStatuses.get(addon.id);
      return status ? status.maxQuantity : 999; // Default max if no status available
    },
    [stockStatuses]
  );

  // Computed state
  const hasStockWarnings = useMemo(() => {
    return Array.from(stockStatuses.values()).some(
      status => status.level === 'low' || status.level === 'critical'
    );
  }, [stockStatuses]);

  const hasStockErrors = useMemo(() => {
    return Array.from(stockStatuses.values()).some(
      status => status.level === 'out_of_stock'
    );
  }, [stockStatuses]);

  // Cache management
  const refreshStockData = useCallback(() => {
    addonStockService.clearCache();
    setStockStatuses(new Map());
    setAlternatives(new Map());
    setBulkStockResult(null);
    setError(null);
  }, []);

  const clearStockCache = useCallback(() => {
    addonStockService.clearCache();
    setStockStatuses(new Map());
    setAlternatives(new Map());
  }, []);

  // Real-time updates subscription
  useEffect(() => {
    if (!enableRealTimeUpdates || subscribedAddonIds.length === 0) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    // Handle async subscription
    const subscribe = async () => {
      const unsubscribeFn = await addonStockService.subscribeToStockUpdates(
        subscribedAddonIds,
        (updates: Map<string, StockStatus>) => {
          setStockStatuses(prev => {
            const newMap = new Map(prev);
            for (const [addonId, status] of updates.entries()) {
              newMap.set(addonId, status);
            }
            return newMap;
          });
        }
      );
      unsubscribe = unsubscribeFn;
    };

    subscribe();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [enableRealTimeUpdates, subscribedAddonIds]);

  // Subscribe to stock updates for add-ons we're tracking
  const subscribeToAddon = useCallback((addonId: string) => {
    setSubscribedAddonIds(prev => {
      if (prev.includes(addonId)) return prev;
      return [...prev, addonId];
    });
  }, []);

  const unsubscribeFromAddon = useCallback((addonId: string) => {
    setSubscribedAddonIds(prev => prev.filter(id => id !== addonId));
  }, []);

  return {
    // Core functions
    getStockStatus,
    stockStatuses,
    checkBulkStock,
    bulkStockResult,
    checkStock,
    getAlternatives,
    alternatives,

    // Validation helpers
    canSelectQuantity,
    getMaxQuantity,
    hasStockWarnings,
    hasStockErrors,

    // UI state
    isLoading,
    error,

    // Cache management
    refreshStockData,
    clearStockCache,

    // Subscription management (not exposed in return type but available internally)
    subscribeToAddon,
    unsubscribeFromAddon,
  } as UseAddonStockReturn & {
    subscribeToAddon: (addonId: string) => void;
    unsubscribeFromAddon: (addonId: string) => void;
  };
};

/**
 * Hook for simplified stock checking of a single addon
 */
export const useAddonStockStatus = (addon: Addon | null) => {
  const [status, setStatus] = useState<StockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!addon) {
      setStatus(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const stockStatus = await addonStockService.getStockStatus(addon);
      setStatus(stockStatus);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get stock status';
      setError(errorMessage);
      console.error('Error getting stock status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [addon]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    refreshStatus,
    canSelect: (quantity: number) => status?.canSelect(quantity) || false,
    maxQuantity: status?.maxQuantity || 0,
    isAvailable: status?.isAvailable || false,
    level: status?.level || 'available',
    warningMessage: status?.warningMessage,
  };
};

export default useAddonStock;
