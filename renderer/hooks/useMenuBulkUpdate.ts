/**
 * useMenuBulkUpdate Hook
 *
 * Provides functionality for bulk updating menu item properties with:
 * - Optimistic UI updates
 * - Cache invalidation
 * - Error handling
 * - Loading states
 */

import { useState, useCallback } from 'react';
import { toast } from './use-toast';
import { getMenuService } from '../services/ServiceContainer';
import { useAuthStore } from '../stores/authStore';

interface BulkUpdateOptions {
  isCustomizable?: boolean;
  isPrintableInKitchen?: boolean;
}

export interface UseMenuBulkUpdateResult {
  bulkUpdate: (itemIds: string[], updates: BulkUpdateOptions) => Promise<void>;
  isUpdating: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for bulk updating menu item properties
 */
export function useMenuBulkUpdate(): UseMenuBulkUpdateResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Guard: Get auth state with hydration check
  const _hasHydrated = useAuthStore(state => state._hasHydrated);
  const accessToken = useAuthStore(state => state.accessToken);
  const user = useAuthStore(state => state.user);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const bulkUpdate = useCallback(async (
    itemIds: string[],
    updates: BulkUpdateOptions
  ) => {
    // ✅ Guard: Check auth hydration before attempting bulk update
    if (!_hasHydrated) {
      const errMsg = 'Auth store not yet hydrated. Please wait for app initialization.';
      console.warn('[useMenuBulkUpdate] Early call prevented:', errMsg);
      setError(errMsg);
      return;
    }

    // ✅ Guard: Check token and user availability
    if (!accessToken || !user) {
      const errMsg = 'User not authenticated. Please log in first.';
      console.warn('[useMenuBulkUpdate] Auth check failed:', { accessToken: !!accessToken, user: !!user });
      setError(errMsg);
      return;
    }

    if (itemIds.length === 0) {
      setError('No items selected');
      return;
    }

    if (!updates.isCustomizable && !updates.isPrintableInKitchen &&
        updates.isCustomizable !== false && updates.isPrintableInKitchen !== false) {
      setError('No properties specified for update');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // ✅ Use user ID directly from auth store (no IPC call needed)
      const userId = user.id || 'unknown';

      console.log('[useMenuBulkUpdate] Invoking bulk update:', {
        channel: 'mr5pos:menu-items:bulk-update-properties',
        itemCount: itemIds.length,
        updates,
        userId,
      });

      // Call the bulk update API
      const response = await window.electronAPI.ipc.invoke(
        'mr5pos:menu-items:bulk-update-properties',
        {
          itemIds,
          updates,
          userId,
        }
      );

      console.log('[useMenuBulkUpdate] Bulk update response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Bulk update failed');
      }

      const result = response.data;

      // Invalidate cache for affected items and categories
      const menuService = getMenuService();

      // Invalidate entire menu cache to ensure fresh data
      await menuService.refreshMenuData();

      // Show success toast
      toast({
        title: 'Success',
        description: `Updated ${result.updatedCount} item${result.updatedCount !== 1 ? 's' : ''}`,
        variant: 'default',
      });

      // Show warning if some items failed
      if (result.failedCount > 0) {
        toast({
          title: 'Warning',
          description: `${result.failedCount} item${result.failedCount !== 1 ? 's' : ''} failed to update`,
          variant: 'destructive',
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update items';
      console.error('[useMenuBulkUpdate] Bulk update error:', {
        error: err,
        message: errorMessage,
        itemIds,
        updates,
      });
      setError(errorMessage);

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [_hasHydrated, accessToken, user]);

  return {
    bulkUpdate,
    isUpdating,
    error,
    clearError,
  };
}
