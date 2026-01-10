/**
 * BulkItemManagementModal Component
 *
 * Modal for bulk editing menu item properties:
 * - Select multiple items within a category
 * - Bulk enable/disable customization
 * - Bulk enable/disable kitchen printing
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, ChefHat, Printer } from 'lucide-react';
import { MenuItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface BulkItemManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  items: MenuItem[];
  onBulkUpdate: (
    itemIds: string[],
    updates: {
      isCustomizable?: boolean;
      isPrintableInKitchen?: boolean;
    }
  ) => Promise<void>;
  /** Callback fired after successful bulk update - use to refresh parent data */
  onUpdateSuccess?: () => void;
}

export function BulkItemManagementModal({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  items,
  onBulkUpdate,
  onUpdateSuccess,
}: BulkItemManagementModalProps) {
  // ✅ Guard: Check auth hydration for bulk operations
  const _hasHydrated = useAuthStore(state => state._hasHydrated);
  const accessToken = useAuthStore(state => state.accessToken);
  const isAuthReady = _hasHydrated && !!accessToken;

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Toggle individual item selection
  const handleToggleItem = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Toggle select all
  const handleSelectAll = useCallback(() => {
    if (selectedItemIds.size === filteredItems.length) {
      // Deselect all
      setSelectedItemIds(new Set());
    } else {
      // Select all filtered items
      setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
    }
  }, [selectedItemIds.size, filteredItems]);

  // Bulk action handlers
  const handleBulkAction = useCallback(async (
    updates: {
      isCustomizable?: boolean;
      isPrintableInKitchen?: boolean;
    }
  ) => {
    if (selectedItemIds.size === 0) return;

    // ✅ Guard: Check auth readiness before bulk update
    if (!isAuthReady) {
      console.warn('[BulkItemManagementModal] Auth not ready for bulk update', {
        _hasHydrated,
        hasAccessToken: !!accessToken,
      });
      return;
    }

    console.log('[BulkItemManagementModal] Starting bulk action:', {
      categoryId,
      categoryName,
      selectedCount: selectedItemIds.size,
      updates,
    });

    setIsUpdating(true);
    try {
      await onBulkUpdate(Array.from(selectedItemIds), updates);
      console.log('[BulkItemManagementModal] Bulk action completed successfully');
      // Clear selection after successful update
      setSelectedItemIds(new Set());
      // Notify parent to refresh data
      onUpdateSuccess?.();
    } catch (error) {
      console.error('[BulkItemManagementModal] Bulk action failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [selectedItemIds, onBulkUpdate, isAuthReady, _hasHydrated, accessToken, categoryId, categoryName]);

  // Close handler with cleanup
  const handleClose = useCallback(() => {
    setSelectedItemIds(new Set());
    setSearchQuery('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Items: {categoryName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select all toggle */}
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox
              id="select-all"
              checked={selectedItemIds.size === filteredItems.length && filteredItems.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer"
            >
              Select All ({filteredItems.length} items)
            </label>
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No items found
              </div>
            ) : (
              filteredItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent",
                    selectedItemIds.has(item.id) && "bg-accent border-primary"
                  )}
                  onClick={() => handleToggleItem(item.id)}
                >
                  <Checkbox
                    checked={selectedItemIds.has(item.id)}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        ${item.price.toFixed(2)}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {item.isCustomizable ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <ChefHat className="h-3 w-3" />
                          Customizable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                          <ChefHat className="h-3 w-3" />
                          Not customizable
                        </Badge>
                      )}
                      {item.isPrintableInKitchen !== false ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <Printer className="h-3 w-3" />
                          Kitchen Print
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                          <Printer className="h-3 w-3" />
                          No Kitchen Print
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bulk actions */}
          {selectedItemIds.size > 0 && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">
                Bulk Actions ({selectedItemIds.size} items selected):
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleBulkAction({ isCustomizable: true })}
                  disabled={isUpdating || !isAuthReady}
                  className="gap-2"
                >
                  <ChefHat className="h-4 w-4" />
                  Enable Customization
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction({ isCustomizable: false })}
                  disabled={isUpdating || !isAuthReady}
                  className="gap-2"
                >
                  <ChefHat className="h-4 w-4" />
                  Disable Customization
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleBulkAction({ isPrintableInKitchen: true })}
                  disabled={isUpdating || !isAuthReady}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Enable Kitchen Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction({ isPrintableInKitchen: false })}
                  disabled={isUpdating || !isAuthReady}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Disable Kitchen Print
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="secondary">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
