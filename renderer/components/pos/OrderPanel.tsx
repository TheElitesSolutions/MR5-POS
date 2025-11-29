/**
 * OrderPanel Component - REFACTORED to use new Service Architecture
 *
 * IMPROVEMENTS:
 * ✅ No more direct API calls - uses cached service layer
 * ✅ Request deduplication - prevents duplicate API calls
 * ✅ Optimized caching - data shared across components
 * ✅ Separation of concerns - UI state vs Data state
 * ✅ Better error handling with service-level retry logic
 */
'use client';

import { useState, useEffect } from 'react';
import { usePOSStore } from '@/stores/posStore';
import { useToast } from '@/hooks/use-toast';
import { orderLogger } from '@/utils/logger';
import { getIngredientNameSafe } from '@/utils/ingredientUtils';
import { useSimpleOrderTracking, type SimpleOrderChange } from '@/hooks/useSimpleOrderTracking';
import { useOrderActionQueue } from '@/hooks/useOrderActionQueue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Plus,
  Minus,
  ShoppingCart,
  Check,
  X,
  Trash2,
  Clock,
  AlertCircle,
  FileText,
  ChefHat,
} from 'lucide-react';
import { Customization, MenuItem, OrderItem, Order } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useSharedStockData } from '@/context/StockDataContext';

interface CustomizationData {
  selectedItem: MenuItem;
  itemQuantity: number;
  ingredientAdjustments: Record<string, boolean>;
  specialNotes: string;
  addonSelections: any[]; // ✅ CRITICAL FIX: Include addon selections
}

interface OrderPanelProps {
  pendingCustomization?: CustomizationData | null;
}

/**
 * Helper function to compare two addon configurations
 * Returns true if both configurations have the EXACT SAME set of addon types (IDs only)
 * Quantities are ignored - they will scale together when item quantity is updated
 */
function areAddonsEqual(
  existingAddons: any[],
  selectedAddons: any[]
): boolean {
  // If lengths don't match, they're not equal
  if (existingAddons.length !== selectedAddons.length) {
    return false;
  }

  // If both are empty, they're equal
  if (existingAddons.length === 0 && selectedAddons.length === 0) {
    return true;
  }

  // Check bidirectionally: every selected addon must exist in existing,
  // AND every existing addon must exist in selected (ensures exact match)
  const selectedHasAllExisting = existingAddons.every(existing => {
    return selectedAddons.some(selected => selected.addonId === existing.addonId);
  });
  
  const existingHasAllSelected = selectedAddons.every(selected => {
    return existingAddons.some(existing => existing.addonId === selected.addonId);
  });
  
  return selectedHasAllExisting && existingHasAllSelected;
}

const OrderPanel = ({ pendingCustomization }: OrderPanelProps) => {
  // Parse SQLite datetime as local time (not UTC)
  const parseLocalDateTime = (dateString: string): Date => {
    // SQLite format: "YYYY-MM-DD HH:MM:SS"
    // We need to parse this as local time, not UTC
    const [datePart, timePart] = dateString.replace('T', ' ').split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  };

  const {
    selectedTable,
    currentOrder,
    createOrder,
    removeOrderItem,
    completeOrder,
    cancelOrder,
    addOrderItem,
    updateOrderItem,
    isLoading,
    error,
    switchToMenu,
    switchToTables,
    viewMode,
    clearError,
  } = usePOSStore();

  // Data from shared context - prevents duplicate API calls
  const { stockItems, error: stockError } = useSharedStockData();

  const { toast } = useToast();
  const [startOrderError, setStartOrderError] = useState<string | null>(null);

  // State for tracking quantity updates and newly added items
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // ✅ Race Condition Prevention: Action queue system
  const { enqueueAction, isProcessing, queueLength } = useOrderActionQueue({
    orderId: currentOrder?.id,
  });

  // ✅ SIMPLE: Net change tracking system - replaces complex multi-layer tracking
  const {
    trackNewItem,
    trackQuantityChange,
    trackItemRemoval,
    clearTracking,
    hasChanges,
    changeCount,
    changesSummary,
    newItemsCount,
    updatedItemsCount,
    removedItemsCount,
  } = useSimpleOrderTracking(currentOrder?.id);

  // Log changes whenever they update
  useEffect(() => {
    if (hasChanges) {
      orderLogger.debug('Order changes updated', {
        changeCount,
        newItems: newItemsCount,
        updates: updatedItemsCount,
        removals: removedItemsCount,
        orderId: currentOrder?.id,
      });
    }
  }, [
    hasChanges,
    changeCount,
    newItemsCount,
    updatedItemsCount,
    removedItemsCount,
    currentOrder?.id,
  ]);


  // Log currentOrder state changes for right panel debugging
  useEffect(() => {
    orderLogger.debug('Current order state', {
      hasOrder: !!currentOrder,
      orderId: currentOrder?.id,
      itemsCount: currentOrder?.items?.length || 0,
    });
  }, [currentOrder]);

  // State for confirmation dialog
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false);

  // Show stock error if any
  useEffect(() => {
    if (stockError) {
      toast({
        title: 'Stock Error',
        description: stockError,
        variant: 'destructive',
      });
    }
  }, [stockError, toast]);

  const handleStartOrder = async () => {
    // Enhanced null safety checks
    if (!selectedTable) {
      setStartOrderError('No table selected. Please select a table first.');
      return;
    }

    if (!selectedTable.id) {
      setStartOrderError(
        'Invalid table selected. Please refresh and try again.'
      );
      return;
    }

    setStartOrderError(null);

    try {
      await createOrder(selectedTable.id);
      // Switch to menu categories view in the main panel
      switchToMenu();
    } catch (error: unknown) {
      orderLogger.error('Failed to create order:', error);
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string } };
            message?: string;
          }
        )?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Failed to create order. Please try again.';
      setStartOrderError(errorMessage);
    }
  };

  // Handle direct quantity adjustment with +/- buttons
  const handleQuantityAdjust = async (
    itemId: string,
    newQuantity: number,
    itemName: string
  ) => {
    orderLogger.debug('Quantity adjust called', {
      itemId,
      itemName,
      newQuantity,
    });

    if (newQuantity < 1) {
      orderLogger.debug('Quantity adjust rejected: newQuantity < 1');
      return;
    }

    // Find the current quantity before updating
    const currentItem = currentOrder?.items?.find(item => item.id === itemId);
    if (!currentItem) {
      orderLogger.debug('Quantity adjust failed: currentItem not found', {
        itemId,
      });
      return;
    }

    const oldQuantity = currentItem.quantity || 0;

    orderLogger.debug('Quantity adjust details', {
      itemId,
      itemName,
      oldQuantity,
      newQuantity,
      change: newQuantity - oldQuantity,
    });

    // Don't do anything if quantity didn't change
    if (oldQuantity === newQuantity) {
      orderLogger.debug('Quantity adjust skipped: No change');
      return;
    }

    // ✅ Race Condition Fix: Queue the update instead of executing immediately
    enqueueAction(
      'update',
      async () => {
        setUpdatingItemId(itemId);
        orderLogger.debug('Calling updateOrderItem', { itemId, newQuantity });
        await updateOrderItem(itemId, newQuantity);
        orderLogger.debug('updateOrderItem completed successfully');

        // ✅ FIX: Scale addon quantities when using +/- buttons
        const itemAddons = (currentItem as any).addons || [];
        if (itemAddons.length > 0 && currentOrder?.id) {
          const quantityChange = newQuantity - oldQuantity;
          orderLogger.debug('Scaling addon quantities for +/- button', {
            addonCount: itemAddons.length,
            quantityChange,
          });
          try {
            const addonResult = await (window as any).electronAPI.ipc.invoke(
              'addon:scaleAddonQuantities',
              {
                orderItemId: itemId,
                quantityToAdd: quantityChange,
              }
            );
            if (addonResult.success) {
              orderLogger.debug('Addon quantities scaled successfully');
              // Refresh order to show updated addon quantities
              const orderAPI = await import('@/lib/ipc-api');
              const refreshResp = await orderAPI.orderAPI.getById(currentOrder.id);
              if (refreshResp.success && refreshResp.data) {
                const { updateOrderInStore } = usePOSStore.getState();
                updateOrderInStore(refreshResp.data as any);
                orderLogger.debug('Order refreshed with updated addon quantities');
              }
            } else {
              orderLogger.error('Failed to scale addon quantities:', addonResult.error);
            }
          } catch (addonError) {
            orderLogger.error('Error scaling addon quantities:', addonError);
          }
        }

        return { itemId, newQuantity };
      },
      {
        onSuccess: () => {
          setUpdatingItemId(null);

          // Track the quantity change using simple net change tracking
          try {
            orderLogger.debug('Starting tracking update', {
              itemId,
              itemName,
              oldQuantity,
              newQuantity,
            });

            trackQuantityChange(
              itemId,
              itemName,
              currentItem.menuItemId,
              oldQuantity,
              newQuantity
            );

            orderLogger.debug('Tracking update completed successfully');
          } catch (trackingError) {
            orderLogger.error('Tracking update failed:', trackingError);
          }

          // Show success toast
          toast({
            title: 'Quantity Updated',
            description: `${itemName} quantity changed to ${newQuantity}`,
          });
        },
        onError: error => {
          setUpdatingItemId(null);
          orderLogger.error('Failed to update quantity:', error);
          toast({
            title: 'Update Failed',
            description: 'Failed to update item quantity. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleRemoveItem = async (orderItemId: string, itemName: string) => {
    // Find the current item before removing it to track its quantity
    const itemToRemove = currentOrder?.items?.find(
      item => item.id === orderItemId
    );
    const quantity = itemToRemove?.quantity || 0;
    const menuItemId = itemToRemove?.menuItemId || '';

    // ✅ Race Condition Fix: Queue the removal
    enqueueAction(
      'remove',
      async () => {
        await removeOrderItem(orderItemId);
        return { orderItemId, itemName, quantity, menuItemId };
      },
      {
        onSuccess: result => {
          // ✅ SIMPLE: Track the removed item using simple tracking system
          trackItemRemoval(
            result.orderItemId,
            result.itemName,
            result.menuItemId,
            result.quantity
          );

          // ❌ REMOVED: No longer print removal notifications to kitchen
          // Kitchen staff doesn't need to know about removed items
          // Only additions and increases should be printed

          toast({
            title: 'Item Removed',
            description: `${itemName} has been removed from the order`,
          });
        },
        onError: error => {
          orderLogger.error('Failed to remove item:', error);
          toast({
            title: 'Removal Failed',
            description: 'Failed to remove item. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleCompleteOrder = async () => {
    if (!currentOrder) return;

    const tableName = selectedTable?.name;
    const orderNumber = currentOrder.orderNumber;

    try {
      
      await completeOrder();

      // Automatically print invoice after order completion
      try {
        const printerAPI = await import('@/lib/printer-api');
        const user = useAuthStore.getState().user;

        if (user?.id) {
          // Get default printer or use a specific one
          const printers = await printerAPI.PrinterAPI.getPrinters();
          const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

          if (defaultPrinter) {
            const result = await printerAPI.PrinterAPI.printInvoice(
              currentOrder.id,
              defaultPrinter.name,
              1,
              user.id
            );

            if (result.success) {
              orderLogger.debug('Invoice auto-printed for completed order');
            } else {
              orderLogger.warn('Failed to auto-print invoice:', result.error);
              // Don't show error toast for printing failure - it's not critical
            }
          }
        }
      } catch (printError) {
        orderLogger.warn('Invoice printing error:', printError);
        // Printing failure shouldn't affect order completion
      }

      toast({
        title: 'Order Completed',
        description: `Order ${orderNumber} has been completed successfully${tableName ? ` and ${tableName} is now available` : ''}`,
      });
    } catch (error) {
      orderLogger.error('Failed to complete order:', error);
      toast({
        title: 'Completion Failed',
        description: 'Failed to complete order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      
    }
  };

  const handleCancelOrder = async () => {
    if (!currentOrder) return;

    const tableName = selectedTable?.name;
    const orderNumber = currentOrder.orderNumber;

    try {
      
      await cancelOrder();
      
      // Switch back to tables view after cancelling order
      switchToTables();
      
      toast({
        title: 'Order Cancelled',
        description: `Order ${orderNumber} has been cancelled${tableName ? ` and ${tableName} is now available` : ''}`,
        variant: 'destructive',
      });
    } catch (error) {
      orderLogger.error('Failed to cancel order:', error);
      toast({
        title: 'Cancellation Failed',
        description: 'Failed to cancel order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      
    }
  };

  const handleAddCustomizedItem = async (
    customizationData: CustomizationData
  ) => {
    const { selectedItem, itemQuantity, ingredientAdjustments, specialNotes, addonSelections } =
      customizationData;

    orderLogger.debug('Processing customized item', {
      item: selectedItem.name,
      quantity: itemQuantity,
      hasTable: !!selectedTable,
      hasOrder: !!currentOrder,
    });

    // Support both table-based orders (dine-in) and takeaway/delivery orders
    if (!selectedTable && !currentOrder) {
      orderLogger.error('No table selected and no current order');
      return;
    }

    // Create order if one doesn't exist and we have a table
    if (!currentOrder && selectedTable) {
      orderLogger.debug('Creating table-based order');
      try {
        await createOrder(selectedTable.id);
        orderLogger.debug('Table-based order created successfully');
      } catch (error) {
        orderLogger.error('Failed to create order:', error);
        return;
      }
    }

    // For takeaway/delivery orders, we should already have a currentOrder
    if (!currentOrder) {
      orderLogger.error('No current order available for item addition');
      return;
    }

    try {
      // Create customizations array from ingredient adjustments
      const customizations: Customization[] = [];

      // Process ingredient adjustments (removals)
      Object.entries(ingredientAdjustments).forEach(
        ([ingredientId, isRemoved]) => {
          if (isRemoved) {
            // Get the ingredient name using the safer function
            // Since ingredientId is now a string ID, we need to find the ingredient object
            const ingredient = selectedItem.ingredients.find(
              ing => ing.id === ingredientId
            );
            const ingredientName = ingredient
              ? ingredient.name // ✅ Use the name directly from ingredient object
              : getIngredientNameSafe(ingredientId, stockItems); // ✅ Fallback to ID lookup
            // Only add customization if we have a valid ingredient name
            if (ingredientName) {
              customizations.push({
                type: 'remove_ingredient',
                name: ingredientName, // Use 'name' field instead of 'value'
                priceAdjustment: 0, // No price adjustment for removing ingredients
              });
            }
          }
        }
      );

      orderLogger.debug('Created customizations', {
        count: customizations.length,
      });

      // Check if this item already exists in the order with the same notes/customizations AND addons
      const normalizedNotes = specialNotes?.trim() || '';
      const normalizedAddonSelections = addonSelections || [];
      
      const existingItem = currentOrder.items?.find(item => {
        // Check if menuItemId matches
        if (item.menuItemId !== selectedItem.id) return false;

        // Check if notes match (including customizations)
        const itemNotes = item.notes || '';
        if (itemNotes !== normalizedNotes) return false;

        // ✅ CRITICAL FIX: Check if addons match
        const itemAddons = (item as any).addons || [];
        const addonsMatch = areAddonsEqual(itemAddons, normalizedAddonSelections);

        return addonsMatch;
      });

      orderLogger.debug('Existing item search result', {
        found: !!existingItem,
        existingItemId: existingItem?.id,
        hasAddons: normalizedAddonSelections.length > 0,
        addonCount: normalizedAddonSelections.length,
        selectedAddonIds: normalizedAddonSelections.map((a: any) => a.addonId),
      });

      // Track the item ID before adding/updating (used in conditional blocks below)

      if (existingItem) {
        orderLogger.debug('Found existing item, updating quantity', {
          itemId: existingItem.id,
          oldQuantity: existingItem.quantity,
          adding: itemQuantity,
        });
        // Get the old quantity before updating
        const oldQuantity = existingItem.quantity || 0;
        const newQuantity = oldQuantity + itemQuantity;

        // Update the existing item's quantity
        await updateOrderItem(existingItem.id, newQuantity);

        // ✅ CRITICAL FIX: Scale addon quantities proportionally
        const existingAddons = (existingItem as any).addons || [];
        if (existingAddons.length > 0) {
          orderLogger.debug('Scaling addon quantities for existing item', {
            addonCount: existingAddons.length,
            quantityToAdd: itemQuantity,
          });

          try {
            const addonResult = await (window as any).electronAPI.ipc.invoke(
              'addon:scaleAddonQuantities',
              {
                orderItemId: existingItem.id,
                quantityToAdd: itemQuantity,
              }
            );

            if (addonResult.success) {
              orderLogger.debug('Addon quantities scaled successfully');
              
              // ✅ CRITICAL FIX: Refresh order to show updated addon quantities
              try {
                const orderAPI = await import('@/lib/ipc-api');
                const refreshResp = await orderAPI.orderAPI.getById(currentOrder.id);
                if (refreshResp.success && refreshResp.data) {
                  orderLogger.debug('Order refreshed after addon scaling', {
                    itemCount: refreshResp.data.items?.length,
                  });
                  // Update the posStore with refreshed order
                  const { updateOrderInStore } = usePOSStore.getState();
                  const refreshedOrder = {
                    ...refreshResp.data,
                    items: refreshResp.data.items ? [...refreshResp.data.items.map((item: any) => ({
                      ...item,
                      unitPrice: item.unitPrice,
                      totalPrice: item.totalPrice,
                      price: item.price,
                    }))] : [],
                  };
                  updateOrderInStore(refreshedOrder as any);
                  orderLogger.debug('Updated posStore with scaled addon quantities');
                }
              } catch (refreshError) {
                orderLogger.error('Failed to refresh order after addon scaling:', refreshError);
              }
            } else {
              orderLogger.error('Failed to scale addon quantities:', addonResult.error);
              toast({
                title: 'Warning',
                description: 'Item quantity updated but addon quantities may be incorrect',
                variant: 'default',
              });
            }
          } catch (addonError) {
            orderLogger.error('Error scaling addon quantities:', addonError);
            toast({
              title: 'Warning',
              description: 'Item quantity updated but addon quantities may be incorrect',
              variant: 'default',
            });
          }
        }

        // ✅ SIMPLE: Track this quantity change using simple tracking system
        trackQuantityChange(
          existingItem.id,
          existingItem.name || existingItem.menuItemName || selectedItem.name,
          selectedItem.id,
          oldQuantity,
          newQuantity
        );
      } else {
        // Add as a new item
        orderLogger.debug('Adding new item', {
          menuItemId: selectedItem.id,
          name: selectedItem.name,
          quantity: itemQuantity,
          hasCustomizations: customizations.length > 0,
        });

        const response = await addOrderItem(
          selectedItem.id,
          itemQuantity,
          customizations.length > 0 ? customizations : undefined,
          specialNotes || undefined // pass special notes for kitchen
        );

        orderLogger.debug('New item added successfully', {
          itemsCount: response?.items?.length,
        });

        // ✅ CRITICAL FIX: Add addons to the order item if any were selected
        if (addonSelections && addonSelections.length > 0 && response) {
          orderLogger.debug('Adding addons to order item', {
            addonCount: addonSelections.length,
            orderId: currentOrder.id,
          });

          try {
            // Get the actual added item ID
            const actualItem = (response as any).__actualAddedItem;

            if (actualItem && actualItem.id) {
              orderLogger.debug('Calling addon service', {
                orderItemId: actualItem.id,
                addons: addonSelections,
              });

              const addonResult = await (window as any).electronAPI.ipc.invoke(
                'addon:addToOrderItem',
                {
                  orderItemId: actualItem.id,
                  addonSelections: addonSelections,
                }
              );

              if (addonResult.success) {
                orderLogger.debug('Addons added successfully');
                
                // ✅ CRITICAL FIX: Small delay to ensure database transaction is fully committed
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // ✅ CRITICAL FIX: Refresh the order to fetch updated data with addons
                try {
                  const orderAPI = await import('@/lib/ipc-api');
                  const refreshResp = await orderAPI.orderAPI.getById(currentOrder.id);
                  if (refreshResp.success && refreshResp.data) {
                    orderLogger.debug('Order refreshed after addon addition', {
                      itemCount: refreshResp.data.items?.length,
                      items: refreshResp.data.items?.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        quantity: item.quantity,
                        hasAddons: !!item.addons,
                        addonsCount: item.addons?.length || 0,
                        addons: item.addons,
                      })),
                    });
                    // Update the posStore with the refreshed order data
                    // Force a new object reference to trigger React re-render
                    const { updateOrderInStore } = usePOSStore.getState();
                    const refreshedOrder = {
                      ...refreshResp.data,
                      items: refreshResp.data.items ? [...refreshResp.data.items.map((item: any) => ({
                        ...item,
                        // Ensure price fields are preserved
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        price: item.price,
                      }))] : [],
                    };
                    updateOrderInStore(refreshedOrder as any);
                    orderLogger.debug('Updated posStore with refreshed order (forced re-render)', {
                      refreshedItemPrices: refreshedOrder.items.map((item: any) => ({
                        id: item.id,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                      })),
                    });
                  }
                } catch (refreshError) {
                  orderLogger.error('Failed to refresh order after addons:', refreshError);
                }
              } else {
                orderLogger.error('Failed to add addons:', addonResult.error);
                toast({
                  title: 'Warning',
                  description: 'Item added but some addons failed to attach',
                  variant: 'default',
                });
              }
            } else {
              orderLogger.error('No actualAddedItem in response for addon attachment');
            }
          } catch (addonError) {
            orderLogger.error('Error adding addons:', addonError);
            toast({
              title: 'Warning',
              description: 'Item added but addons failed to attach',
              variant: 'default',
            });
          }
        }

        // CRITICAL FIX: Use the actual item returned by the backend addItem API
        if (response && (response as any).__actualAddedItem) {
          const actualItem = (response as any).__actualAddedItem;

          orderLogger.debug('Using actual returned item for tracking', {
            itemId: actualItem.id,
            name: actualItem.name || actualItem.menuItemName,
            quantity: actualItem.quantity,
          });

          // ENHANCED FIX: Always refresh the order to get the most current state
          orderLogger.debug('Refreshing order to get current state');
          try {
            const orderAPI = await import('@/lib/ipc-api');
            const orderResp = await orderAPI.orderAPI.getById(currentOrder.id);
            if (orderResp.success && orderResp.data) {
              const refreshedOrder = orderResp.data;
              orderLogger.debug('Order refreshed successfully', {
                itemCount: refreshedOrder.items?.length,
              });

              // Find the ACTUAL item in the refreshed order
              orderLogger.debug('Searching for matching item', {
                menuItemId: actualItem.menuItemId,
                quantity: actualItem.quantity,
                itemsCount: refreshedOrder.items?.length,
              });

              // Strategy 1: Find by menuItemId and quantity
              let matchingItem = refreshedOrder.items?.find(
                (item: any) =>
                  item.menuItemId === actualItem.menuItemId &&
                  item.quantity === actualItem.quantity
              ) as OrderItem | undefined;
              orderLogger.debug('Strategy 1 result', {
                found: !!matchingItem,
                matchingItemId: matchingItem?.id,
              });

              // Strategy 2: If not found, find the LATEST item with the same menuItemId
              if (!matchingItem) {
                orderLogger.debug('Strategy 1 failed, trying Strategy 2');
                const itemsWithSameMenuId = refreshedOrder.items?.filter(
                  (item: any) => item.menuItemId === actualItem.menuItemId
                );
                if (itemsWithSameMenuId && itemsWithSameMenuId.length > 0) {
                  // Get the most recently added item
                  matchingItem =
                    itemsWithSameMenuId[itemsWithSameMenuId.length - 1] as OrderItem;
                  orderLogger.debug('Strategy 2 result', {
                    found: !!matchingItem,
                    matchingItemId: matchingItem?.id,
                    itemsCount: itemsWithSameMenuId.length,
                  });
                } else {
                  orderLogger.debug('Strategy 2 failed - no matching items');
                }
              }

              // Strategy 3: If still not found, find by selectedItem.id
              if (!matchingItem) {
                orderLogger.debug('Strategy 2 failed, trying Strategy 3');
                matchingItem = refreshedOrder.items?.find(
                  (item: any) => item.menuItemId === selectedItem.id
                ) as OrderItem | undefined;
                orderLogger.debug('Strategy 3 result', {
                  found: !!matchingItem,
                  matchingItemId: matchingItem?.id,
                });
              }

              if (matchingItem) {
                orderLogger.debug('Found matching item in refreshed order', {
                  itemId: matchingItem.id,
                });

                // Track this item addition using simple tracking system
                trackNewItem(
                  matchingItem.id,
                  matchingItem.name ||
                    matchingItem.menuItemName ||
                    selectedItem.name,
                  selectedItem.id,
                  itemQuantity
                );

                orderLogger.debug('Successfully tracked refreshed item', {
                  itemId: matchingItem.id,
                });
              } else {
                orderLogger.error(
                  'All matching strategies failed - using fallback',
                  {
                    actualItemId: actualItem.id,
                    menuItemId: actualItem.menuItemId,
                    refreshedOrderItems: refreshedOrder.items?.map(
                      (item: any) => ({
                        id: item.id,
                        menuItemId: item.menuItemId,
                        name: item.name,
                        quantity: item.quantity,
                      })
                    ),
                  }
                );
                // ✅ SIMPLE: Fallback to tracking with actualItem using simple tracking
                trackNewItem(
                  actualItem.id,
                  actualItem.name ||
                    actualItem.menuItemName ||
                    selectedItem.name,
                  selectedItem.id,
                  itemQuantity
                );
                orderLogger.warn('Fallback tracking using actualItem.id');
              }
            }
          } catch (refreshError) {
            orderLogger.error('Failed to refresh order:', refreshError);
            // Fallback: Item addition was already tracked above
          }
        } else {
          orderLogger.warn('No actualAddedItem in response - using fallback');
          // FALLBACK: If no actualAddedItem, refresh order and track the latest addition
          try {
            const orderAPI = await import('@/lib/ipc-api');
            const orderResp = await orderAPI.orderAPI.getById(currentOrder.id);
            if (orderResp.success && orderResp.data && orderResp.data.items) {
              const latestItem =
                orderResp.data.items[orderResp.data.items.length - 1];
              if (latestItem) {
                orderLogger.debug('Using latest item from refreshed order', {
                  itemId: latestItem.id,
                });
                // Latest item tracking already handled above
              }
            }
          } catch (fallbackError) {
            orderLogger.error('Fallback tracking failed:', fallbackError);
          }
        }
      }

      // Show confirmation toast
      toast({
        title: existingItem ? 'Item Quantity Updated' : 'Item Added',
        description: `${selectedItem.name} ${existingItem ? 'quantity updated' : 'added to order'}`,
      });
    } catch (error) {
      orderLogger.error('Failed to add customized item:', error);
      toast({
        title: 'Failed to Add Item',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  // Process pending customization when it changes
  useEffect(() => {
    orderLogger.debug('Pending customization changed', {
      hasPending: !!pendingCustomization,
    });
    if (pendingCustomization) {
      orderLogger.debug('Calling handleAddCustomizedItem');
      handleAddCustomizedItem(pendingCustomization);
    }
  }, [pendingCustomization]);

  // Debug logging only when state changes - OPTIMIZED: Reduced logging frequency
  useEffect(() => {
    // Only log when there are actual issues, not on every state change
    if (!selectedTable && currentOrder) {
      orderLogger.warn('Order exists but no table selected');
    }
  }, [selectedTable, currentOrder]);

  // Clear any errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // No table selected
  if (!selectedTable) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <ShoppingCart className='mx-auto mb-4 h-12 w-12 text-gray-400' />
          <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
            Select a Table
          </h3>
          <p className='text-gray-600 dark:text-gray-400'>
            Choose a table to start taking orders
          </p>
        </div>
      </div>
    );
  }

  // Table selected but no active order
  if (!currentOrder) {
    return (
      <div className='flex h-full flex-col'>
        <div className='border-b border-gray-200 p-6 dark:border-gray-700'>
          <h2 className='mb-2 text-xl font-semibold text-gray-900 dark:text-white'>
            {selectedTable.name}
          </h2>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Ready to take orders
          </p>
        </div>

        <div className='flex flex-1 items-center justify-center p-6'>
          <div className='text-center'>
            <Plus className='mx-auto mb-4 h-12 w-12 text-gray-400' />
            <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
              Start New Order
            </h3>
            <p className='mb-4 text-gray-600 dark:text-gray-400'>
              Begin taking orders for this table
            </p>

            {/* Error Display */}
            {(startOrderError || error) && (
              <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3'>
                <div className='flex items-center space-x-2'>
                  <AlertCircle className='h-4 w-4 text-red-600' />
                  <span className='text-sm font-medium text-red-800'>
                    {startOrderError || error}
                  </span>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setStartOrderError(null);
                    clearError();
                  }}
                  className='mt-2 text-red-600 hover:text-red-700'
                >
                  Dismiss
                </Button>
              </div>
            )}

            <Button
              onClick={handleStartOrder}
              size='lg'
              disabled={isLoading || isProcessing}
              className='w-full transform touch-manipulation bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-green-600 hover:to-emerald-700'
            >
              <Plus className='mr-2 h-4 w-4' />
              {isProcessing ? 'Creating...' : 'Start Order'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active order view
  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b border-gray-200 p-6 dark:border-gray-700'>
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
            {selectedTable.name}
          </h2>
          <Badge variant='outline' className='text-xs'>
            Order #{currentOrder.orderNumber || 'N/A'}
          </Badge>
        </div>
        <div className='flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400'>
          <div className='flex items-center space-x-1'>
            <Clock className='h-4 w-4' />
            <span>
              {currentOrder.createdAt
                ? parseLocalDateTime(currentOrder.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </span>
          </div>
          <div className='flex items-center space-x-1'>
            <ShoppingCart className='h-4 w-4' />
            <span>{currentOrder.items?.length || 0} items</span>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className='flex-1 overflow-y-auto p-6'>
        {currentOrder.items && currentOrder.items.length > 0 ? (
          <div className='space-y-3'>
            {currentOrder.items.map(item => {
              return (
                <Card key={item.id} className='p-4'>
                  <div className='space-y-3'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='space-y-1'>
                          <h4 className='font-medium'>
                            {item.menuItemName || item.name || 'Unknown Item'}
                          </h4>
                          {/* Display removed ingredients directly under item name */}
                          {item.notes && item.notes.includes('remove:') && (
                            <div className='text-xs text-red-600 dark:text-red-400'>
                              {(() => {
                                const removeMatch = item.notes.match(
                                  /remove:\s*(.+?)(\n|$)/
                                );
                                if (removeMatch && removeMatch[1]) {
                                  return removeMatch[1];
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                        <p className='text-sm text-gray-600 dark:text-gray-400'>
                          $
                          {(typeof item.unitPrice === 'number' &&
                          !isNaN(item.unitPrice)
                            ? item.unitPrice
                            : 0
                          ).toFixed(2)}{' '}
                          each
                        </p>

                        {/* Special kitchen notes (excluding remove instructions) */}
                        {item.notes &&
                          (() => {
                            // Extract special notes by removing the "remove:" line
                            let specialNotes = item.notes;
                            if (item.notes.includes('remove:')) {
                              specialNotes = item.notes
                                .replace(/remove:[^\n]+(\n|$)/, '')
                                .trim();
                            }

                            if (specialNotes) {
                              return (
                                <div className='mt-2'>
                                  <p className='text-xs font-medium text-gray-700 dark:text-gray-300'>
                                    Kitchen Notes:
                                  </p>
                                  <p className='mt-0.5 text-xs italic text-gray-500'>
                                    {specialNotes}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()}

                        {/* ✅ CRITICAL FIX: Display addons if present */}
                        {(item as any).addons && (item as any).addons.length > 0 && (
                          <div className='mt-2'>
                            <p className='text-xs font-medium text-gray-700 dark:text-gray-300'>
                              Add-ons:
                            </p>
                            <div className='mt-1 space-y-1'>
                              {(item as any).addons.map((addon: any) => (
                                <div
                                  key={addon.id}
                                  className='flex items-center justify-between text-xs text-gray-600 dark:text-gray-400'
                                >
                                  <span>
                                    + {addon.addonName || addon.addon?.name} (×
                                    {addon.quantity})
                                  </span>
                                  <span className='font-medium'>
                                    ${Number(addon.totalPrice || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          handleRemoveItem(
                            item.id,
                            item.menuItemName || 'Unknown Item'
                          )
                        }
                        className='p-1 text-red-600 hover:text-red-700'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-1'>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() =>
                            handleQuantityAdjust(
                              item.id,
                              Math.max(1, (item.quantity || 1) - 1),
                              item.menuItemName || 'Item'
                            )
                          }
                          disabled={
                            isProcessing ||
                            updatingItemId === item.id ||
                            (item.quantity || 1) <= 1
                          }
                        >
                          <Minus className='h-3 w-3' />
                        </Button>

                        <Badge
                          variant='secondary'
                          className='px-2 py-1 text-sm'
                        >
                          {typeof item.quantity === 'number' &&
                          !isNaN(item.quantity)
                            ? item.quantity
                            : 1}
                        </Badge>

                        <Button
                          variant='outline'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() =>
                            handleQuantityAdjust(
                              item.id,
                              (item.quantity || 1) + 1,
                              item.menuItemName || 'Item'
                            )
                          }
                          disabled={isProcessing || updatingItemId === item.id}
                        >
                          <Plus className='h-3 w-3' />
                        </Button>
                      </div>
                      <span className='font-medium'>
                        $
                        {(() => {
                          // ✅ CRITICAL FIX: item.totalPrice already includes addons (calculated in backend)
                          // Don't add addon prices again or we'll double-count them
                          const total = (typeof item.totalPrice === 'number' && !isNaN(item.totalPrice))
                            ? item.totalPrice
                            : (item.unitPrice || item.price || 0) * (item.quantity || 1);
                          
                          return total.toFixed(2);
                        })()}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className='py-8 text-center'>
            <ShoppingCart className='mx-auto mb-3 h-12 w-12 text-gray-300' />
            <p className='text-gray-500'>No items in order</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='border-t border-gray-200 p-6 dark:border-gray-700'>
        {/* Total */}
        <div className='mb-4 flex items-center justify-between text-lg font-semibold'>
          <span>Total:</span>
          <span>
            $
            {(typeof currentOrder.totalAmount === 'number' &&
            !isNaN(currentOrder.totalAmount)
              ? currentOrder.totalAmount
              : typeof currentOrder.total === 'number' &&
                  !isNaN(currentOrder.total)
                ? currentOrder.total
                : 0
            ).toFixed(2)}
          </span>
        </div>

        {/* Action Buttons - Progressive Disclosure Layout for Space Efficiency */}
        <div className='space-y-3'>
          {/* PRIMARY ACTION - Context-Aware (Full Width) */}
          {viewMode === 'tables' && hasChanges && (
            <Button
              onClick={async () => {
                try {
                  // ✅ SIMPLE: Print only net changes using simple tracking system
                  let printError = null;
                  try {
                    const printerAPI = await import('@/lib/printer-api');
                    const user = useAuthStore.getState().user;

                    if (user?.id && currentOrder && changesSummary) {
                      const printers = await printerAPI.PrinterAPI.getPrinters();
                      const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

                      if (defaultPrinter) {
                        const newItems = changesSummary.filter(c => c.changeType === 'NEW');
                        // Only include quantity INCREASES (netChange > 0), not decreases
                        const updates = changesSummary.filter(c => c.changeType === 'UPDATE' && c.netChange > 0);
                        // Filter out removals AND quantity decreases
                        const filteredChangesSummary = changesSummary.filter(
                          c => c.changeType !== 'REMOVE' && (c.changeType !== 'UPDATE' || c.netChange > 0)
                        );

                        if (filteredChangesSummary.length === 0) {
                          orderLogger.debug('Skip printing: Only removals/decreases occurred');
                          clearTracking();
                          return;
                        }

                        const result = await printerAPI.PrinterAPI.printKitchenOrder(
                          currentOrder.id,
                          defaultPrinter.name,
                          1,
                          user.id,
                          false,
                          [],
                          [...newItems, ...updates].map(item => item.itemId),
                          filteredChangesSummary
                        );

                        if (result.success) {
                          orderLogger.debug('Net changes printed successfully');
                          clearTracking();
                          switchToTables();
                        }
                      }
                    }
                  } catch (error) {
                    printError = error;
                    orderLogger.error('Simple print failed:', error);
                    toast({
                      title: 'Print Failed',
                      description: 'Failed to print to kitchen. You can try again.',
                      variant: 'destructive',
                    });
                  }

                  if (!printError) {
                    toast({
                      title: 'Order Changes Sent',
                      description: 'All changes have been sent to the kitchen successfully',
                    });
                  }
                } catch (error) {
                  orderLogger.error('Failed to process updated items:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to process updated quantities',
                    variant: 'destructive',
                  });
                }
              }}
              className='w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md hover:from-green-600 hover:to-emerald-700'
              disabled={isLoading || isProcessing}
            >
              <Check className='mr-2 h-4 w-4' />
              {isProcessing ? 'Processing...' : 'Done Adding Items'}
            </Button>
          )}

          {viewMode === 'tables' && !hasChanges && (
            <Button
              onClick={() => switchToMenu()}
              variant='outline'
              className='w-full'
              disabled={isLoading || isProcessing}
            >
              <Plus className='mr-2 h-4 w-4' />
              Add Item
            </Button>
          )}

          {/* Menu view "Done Adding Items" button */}
          {viewMode === 'menu' && currentOrder.items && currentOrder.items.length > 0 && (
            <Button
              onClick={async () => {
                try {
                  // Auto-print logic for menu view
                  try {
                    const printerAPI = await import('@/lib/printer-api');
                    const user = useAuthStore.getState().user;

                    if (user?.id) {
                      const printers = await printerAPI.PrinterAPI.getPrinters();
                      const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

                      if (defaultPrinter && hasChanges && changesSummary) {
                        orderLogger.debug('Menu view - simple net changes', {
                          newItems: newItemsCount,
                          updates: updatedItemsCount,
                          removals: removedItemsCount,
                          totalChanges: changeCount,
                        });

                        const newItems = changesSummary.filter(c => c.changeType === 'NEW');
                        // Only include quantity INCREASES (netChange > 0), not decreases
                        const updates = changesSummary.filter(c => c.changeType === 'UPDATE' && c.netChange > 0);
                        const removals = changesSummary.filter(c => c.changeType === 'REMOVE');

                        const result = await printerAPI.PrinterAPI.printKitchenOrder(
                          currentOrder.id,
                          defaultPrinter.name,
                          1,
                          user.id,
                          false,
                          removals.map(item => item.itemId),
                          [...newItems, ...updates].map(item => item.itemId),
                          changesSummary
                        );

                        if (result.success) {
                          orderLogger.debug('Menu changes printed successfully');
                          clearTracking();
                        } else {
                          throw new Error(result.error || 'Print failed');
                        }
                      } else {
                        orderLogger.debug('Automatic fallback printing disabled');
                      }
                    }
                  } catch (printError) {
                    orderLogger.error('Auto-print failed:', printError);
                  }

                  switchToTables();

                  try {
                    const { fetchTables } = usePOSStore.getState();
                    await fetchTables();
                    orderLogger.debug('Tables refreshed with updated order data');
                  } catch (refreshError) {
                    orderLogger.error('Failed to refresh tables after item addition:', refreshError);
                  }

                  clearTracking();
                  orderLogger.debug('Simple tracking state cleared after completion');

                  toast({
                    title: 'Order Updated',
                    description: 'Items have been added to the order and sent to kitchen',
                  });
                } catch (error) {
                  orderLogger.error('Failed to switch to tables view:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to complete adding items',
                    variant: 'destructive',
                  });
                }
              }}
              className='w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md hover:from-green-600 hover:to-emerald-700'
              disabled={isLoading || isProcessing}
            >
              <Check className='mr-2 h-4 w-4' />
              {isProcessing ? 'Sending to Kitchen...' : 'Done Adding Items'}
            </Button>
          )}

          {/* SECONDARY ACTIONS - Compact 2-Column Grid */}
          {currentOrder.items && currentOrder.items.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {/* Print Kitchen Order Button */}
              <Button
                onClick={async () => {
                  try {
                    
                    // Use PrinterAPI to print kitchen order using ultimate thermal solution
                    const printerAPI = await import('@/lib/printer-api');
                    const user = useAuthStore.getState().user;

                    if (!user?.id) {
                      toast({
                        title: 'Error',
                        description:
                          'User authentication required for printing',
                        variant: 'destructive',
                      });
                      return;
                    }

                    // Get default printer or use a specific one
                    const printers = await printerAPI.PrinterAPI.getPrinters();
                    const defaultPrinter =
                      printers.find(p => p.isDefault) || printers[0];

                    if (!defaultPrinter) {
                      toast({
                        title: 'Error',
                        description:
                          'No printer found. Please configure a printer in settings.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    const result =
                      await printerAPI.PrinterAPI.printKitchenOrder(
                        currentOrder.id,
                        defaultPrinter.name,
                        1,
                        user.id,
                        false, // Not just unprinted items - print everything
                        [], // No cancelled items
                        [], // No specific updated items - print all items
                        [] // No specific changes - print all items
                      );

                    if (result.success) {
                      toast({
                        title: 'Kitchen Order Printed',
                        description:
                          'Order has been sent to the kitchen printer',
                      });
                    } else {
                      toast({
                        title: 'Print Failed',
                        description:
                          result.error || 'Failed to print kitchen order',
                        variant: 'destructive',
                      });
                    }
                  } catch (error) {
                    orderLogger.error('Failed to print kitchen order:', error);
                    toast({
                      title: 'Print Error',
                      description:
                        'An error occurred while printing the kitchen order',
                      variant: 'destructive',
                    });
                  } finally {
                    
                  }
                }}
                variant='outline'
                className='bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm hover:from-orange-600 hover:to-orange-700'
                size='sm'
                disabled={isLoading || isProcessing}
              >
                <ChefHat className='mr-1.5 h-3.5 w-3.5' />
                Kitchen
              </Button>

              {/* Print Invoice Button */}
              <Button
                onClick={async () => {
                  try {
                    
                    // Use PrinterAPI to print invoice using ultimate thermal solution
                    const printerAPI = await import('@/lib/printer-api');
                    const user = useAuthStore.getState().user;

                    if (!user?.id) {
                      toast({
                        title: 'Error',
                        description:
                          'User authentication required for printing',
                        variant: 'destructive',
                      });
                      return;
                    }

                    // Get default printer or use a specific one
                    const printers = await printerAPI.PrinterAPI.getPrinters();
                    const defaultPrinter =
                      printers.find(p => p.isDefault) || printers[0];

                    if (!defaultPrinter) {
                      toast({
                        title: 'Error',
                        description:
                          'No printer found. Please configure a printer in settings.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    const result = await printerAPI.PrinterAPI.printInvoice(
                      currentOrder.id,
                      defaultPrinter.name,
                      1,
                      user.id
                    );

                    if (result.success) {
                      toast({
                        title: 'Invoice Printed',
                        description: 'Invoice has been sent to the printer',
                      });
                    } else {
                      toast({
                        title: 'Print Failed',
                        description: result.error || 'Failed to print invoice',
                        variant: 'destructive',
                      });
                    }
                  } catch (error) {
                    orderLogger.error('Failed to print invoice:', error);
                    toast({
                      title: 'Print Error',
                      description:
                        'An error occurred while printing the invoice',
                      variant: 'destructive',
                    });
                  } finally {
                    
                  }
                }}
                variant='outline'
                className='bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm hover:from-purple-600 hover:to-purple-700'
                size='sm'
                disabled={isLoading || isProcessing}
              >
                <FileText className='mr-1.5 h-3.5 w-3.5' />
                Invoice
              </Button>
            </div>
          )}

          {/* Complete Order button - only show in tables view when no changes pending */}
          {viewMode === 'tables' && !hasChanges && currentOrder.items && currentOrder.items.length > 0 && (
            <Button
              onClick={handleCompleteOrder}
              className='w-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700'
              disabled={isLoading}
            >
              <Check className='mr-2 h-4 w-4' />
              {isProcessing ? 'Completing...' : 'Complete Order'}
            </Button>
          )}

          {/* TERTIARY ACTION - Cancel Button (Subtle) */}
          <Button
            onClick={() => setIsCancelDialogOpen(true)}
            variant='ghost'
            className='w-full text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400'
            size='sm'
            disabled={isLoading}
          >
            <X className='mr-1.5 h-3.5 w-3.5' />
            Cancel Order
          </Button>

          {/* Confirmation Dialog */}
          <AlertDialog
            open={isCancelDialogOpen}
            onOpenChange={setIsCancelDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel this order? This will also
                  delete the table. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, Keep Order</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOrder}
                  className='bg-red-600 hover:bg-red-700'
                >
                  Yes, Cancel Order
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default OrderPanel;
