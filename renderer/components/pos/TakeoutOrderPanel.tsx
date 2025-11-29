'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePOSStore } from '@/stores/posStore';
import { useToast } from '@/hooks/use-toast';
import { getIngredientNameSafe } from '@/utils/ingredientUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  User,
  Phone,
  MapPin,
  ChefHat,
  FileText,
} from 'lucide-react';
import { /* Customization, */ MenuItem, OrderItem } from '@/types';
import {
  getOrderItemUnitPrice,
  getOrderItemTotalPrice,
  formatPrice,
} from '@/utils/priceUtils';
import { useAuthStore } from '@/stores/authStore';
import { orderAPI } from '@/lib/ipc-api';
import { useSharedStockData } from '@/context/StockDataContext';
import { useSimpleOrderTracking } from '@/hooks/useSimpleOrderTracking';
import { useOrderActionQueue } from '@/hooks/useOrderActionQueue';
import { orderLogger } from '@/utils/logger';

interface TakeoutOrderPanelProps {
  pendingCustomization?: {
    selectedItem: MenuItem;
    itemQuantity: number;
    ingredientAdjustments: Record<string, boolean>;
    specialNotes: string;
    addonSelections?: any[]; // Include addon selections from menu flow
  } | null;
}

/**
 * Compare addon selections to determine if two items have the same addons
 * Used to detect if an item with the same addons already exists in the order
 * (Port from OrderPanel for feature parity)
 */
function areAddonsEqual(
  existingAddons: any[],
  selectedAddons: any[]
): boolean {
  if (existingAddons.length !== selectedAddons.length) {
    return false;
  }
  if (existingAddons.length === 0 && selectedAddons.length === 0) {
    return true;
  }
  const selectedHasAllExisting = existingAddons.every(existing => {
    return selectedAddons.some(selected => selected.addonId === existing.addonId);
  });
  const existingHasAllSelected = selectedAddons.every(selected => {
    return existingAddons.some(existing => existing.addonId === selected.addonId);
  });
  return selectedHasAllExisting && existingHasAllSelected;
}

/**
 * TakeoutOrderPanel - Follows dine-in OrderPanel patterns
 * Manages takeout/delivery order lifecycle similar to table-based orders
 */
const TakeoutOrderPanel = ({
  pendingCustomization,
}: TakeoutOrderPanelProps) => {
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
    currentOrder,
    removeOrderItem,
    updateOrderItem,
    addOrderItem,
    isLoading,
    switchToMenu,
    switchToTables,
    orderType,
    viewMode,
    clearError,
    refreshOrders, // Add refreshOrders to refresh the orders list
  } = usePOSStore();

  // Data from shared context - prevents duplicate API calls
  const { stockItems, error: stockError } = useSharedStockData();

  const { toast } = useToast();
  const [localDeliveryFee, setLocalDeliveryFee] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Track which item is currently being updated to prevent double-clicks
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

  // Refs to track order ID and delivery fee to prevent fee reset
  const orderIdRef = useRef<string | null>(null);
  const previousDeliveryFeeRef = useRef<number>(0);
  const userEnteredFeeRef = useRef<boolean>(false);

  // ✅ FIX: Track if we're currently processing a customization to prevent duplicates
  const isProcessingCustomizationRef = useRef<boolean>(false);

  // Get delivery fee from current order or default to 0
  const currentDeliveryFee = currentOrder?.deliveryFee || 0;

  // Calculate order total including delivery fee for display
  const orderTotal = useMemo(() => {
    if (!currentOrder) return 0;

    // Get subtotal from items using our price utility function
    const itemsTotal = (currentOrder.items || []).reduce((sum, item) => {
      // Get the proper item price using our utility
      const totalPrice = getOrderItemTotalPrice(item);

      return sum + totalPrice;
    }, 0);

    // For delivery fee, prioritize user input over server value
    // Parse as floating point with 2 decimal places for accuracy
    const effectiveDeliveryFee =
      userEnteredFeeRef.current && localDeliveryFee
        ? parseFloat(parseFloat(localDeliveryFee).toFixed(2)) || 0
        : parseFloat(currentDeliveryFee.toFixed(2)) || 0;

    // Log calculation details to ensure correct values
    orderLogger.debug('Order total calculation', {
      itemsTotal: itemsTotal.toFixed(2),
      effectiveDeliveryFee: effectiveDeliveryFee.toFixed(2),
      calculatedTotal: (itemsTotal + effectiveDeliveryFee).toFixed(2),
    });

    // No tax calculation - total is just items + delivery fee
    // Final total: subtotal + delivery fee (no tax)
    return itemsTotal + effectiveDeliveryFee;
  }, [currentOrder, currentDeliveryFee, localDeliveryFee]);

  // Order changes are automatically reset by useOrderTracking when order changes

  // Item tracking is now handled by the comprehensive tracking system

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

  // Initialize local delivery fee when order changes but preserve user input
  useEffect(() => {
    if (currentOrder && currentOrder.id) {
      // Only set the fee from the order if it's a newly loaded order or changed from backend
      // Check if this is the first time we're setting the fee for this order ID
      const orderIdChanged =
        !orderIdRef.current || orderIdRef.current !== currentOrder.id;
      const deliveryFeeChanged =
        previousDeliveryFeeRef.current !== currentDeliveryFee;

      if (orderIdChanged || deliveryFeeChanged) {
        // If user hasn't manually entered a fee or order changed, update from backend
        if (!userEnteredFeeRef.current || orderIdChanged) {
          // Show an empty input if the fee is 0, otherwise show the actual value
          if (currentDeliveryFee === 0) {
            setLocalDeliveryFee('');
          } else {
            setLocalDeliveryFee(currentDeliveryFee.toFixed(2));
          }
        }

        // Remember the order ID and fee to detect changes
        orderIdRef.current = currentOrder.id;
        previousDeliveryFeeRef.current = currentDeliveryFee;
      }
    }
  }, [currentOrder, currentDeliveryFee]);

  // Handle delivery fee changes with simplified validation
  const handleDeliveryFeeChange = (value: string) => {
    // Simple regex: Allow numbers and one decimal point with up to 2 decimal places
    const regex = /^(\d*\.?\d{0,2}|\.\d{1,2})$/;
    if (regex.test(value) || value === '') {
      setLocalDeliveryFee(value);
      // Mark that user has manually entered a fee
      userEnteredFeeRef.current = true;
    }
  };

  const handleDeliveryFeeSubmit = async () => {
    if (!currentOrder) return;

    // Validate fee is non-negative and properly formatted
    // Use parseFloat with 2 decimal places for consistent fee handling
    const feeValue = parseFloat(parseFloat(localDeliveryFee || '0').toFixed(2));

    // Ensure fee is non-negative (additional validation)
    if (feeValue < 0) {
      toast({
        title: 'Invalid Fee',
        description: 'Delivery fee cannot be negative',
        variant: 'destructive',
      });
      setLocalDeliveryFee(currentDeliveryFee.toFixed(2));
      return;
    }

    // Limit to reasonable maximum (e.g., $500)
    if (feeValue > 500) {
      toast({
        title: 'Invalid Fee',
        description: 'Delivery fee exceeds maximum allowed amount',
        variant: 'destructive',
      });
      setLocalDeliveryFee(currentDeliveryFee.toFixed(2));
      return;
    }

    // No need to toggle editing state in the simplified input

    try {
      // Calculate the new total amount with the updated delivery fee
      const itemsTotal = (currentOrder.items || []).reduce((sum, item) => {
        return sum + getOrderItemTotalPrice(item);
      }, 0);

      // Calculate the new total (items + delivery fee)
      const newTotalAmount = itemsTotal + feeValue;

      orderLogger.debug('Updating order with new delivery fee', {
        orderId: currentOrder.id,
        deliveryFee: feeValue.toFixed(2),
        newTotal: newTotalAmount.toFixed(2),
      });

      // Update delivery fee via backend API
      const response = await orderAPI.update({
        id: currentOrder.id,
        updates: {
          deliveryFee: feeValue,
          // Just update the delivery fee in the database
          // The total will be calculated on the server side
        },
        userId: useAuthStore.getState().user?.id || 'owner',
      });

      if (response.success) {
        // Force refresh the order to get the updated total
        const orderResp = await orderAPI.getById(currentOrder.id);
        if (orderResp.success && orderResp.data) {
          // Update the order in the POS store to reflect the updated total
          usePOSStore.setState((state: any) => ({
            ...state,
            currentOrder: {
              ...state.currentOrder,
              deliveryFee: feeValue,
              total: newTotalAmount,
              totalAmount: newTotalAmount,
            },
          }));

          // Update our reference to track the new fee value
          previousDeliveryFeeRef.current = feeValue;
        }

        toast({
          title: 'Delivery Fee Updated',
          description: `Delivery fee set to $${feeValue.toFixed(2)}`,
        });
      } else {
        throw new Error(response.error || 'Failed to update delivery fee');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      orderLogger.error('Delivery fee update failed:', errorMessage);

      toast({
        title: 'Error',
        description: `Failed to update delivery fee: ${errorMessage}`,
        variant: 'destructive',
      });

      // Reset to current value on error
      setLocalDeliveryFee(currentDeliveryFee.toFixed(2));
    } finally {
    }
  };

  // Handle quantity changes (enhanced with tracking and race condition prevention)
  const handleQuantityChange = (
    orderItemId: string,
    newQuantity: number,
    itemName: string
  ) => {
    // ✅ Prevent double-clicks by tracking which item is being updated
    if (updatingItemId === orderItemId) return;

    if (newQuantity <= 0) {
      handleRemoveItem(orderItemId, itemName);
      return;
    }

    // Find the current quantity before updating
    const currentItem = currentOrder?.items?.find(
      item => item.id === orderItemId
    );
    if (!currentItem) return;

    const oldQuantity = currentItem.quantity || 0;

    // Don't do anything if quantity didn't change
    if (oldQuantity === newQuantity) return;

    // ✅ Race Condition Fix: Queue the update instead of executing immediately
    enqueueAction(
      'update',
      async () => {
        setUpdatingItemId(orderItemId);
        await updateOrderItem(orderItemId, newQuantity);

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
                orderItemId: orderItemId,
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

        return { orderItemId, itemName, menuItemId: currentItem.menuItemId || '', oldQuantity, newQuantity };
      },
      {
        onSuccess: (result) => {
          setUpdatingItemId(null);
          // ✅ SIMPLE: Track this quantity change using simple tracking system
          trackQuantityChange(
            result.orderItemId,
            result.itemName,
            result.menuItemId,
            result.oldQuantity,
            result.newQuantity
          );
          toast({
            title: 'Quantity Updated',
            description: `${result.itemName} quantity changed to ${result.newQuantity}`,
          });
        },
        onError: (error) => {
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

  // Handle item removal (enhanced with tracking)
  const handleRemoveItem = (orderItemId: string, itemName: string) => {
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
        onSuccess: (result) => {
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
            description: `${result.itemName} has been removed from the order`,
          });
        },
        onError: (error) => {
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

  // Handle order status transitions with proper workflow
  const handleUpdateOrderStatus = async (newStatus: 'READY' | 'COMPLETED') => {
    if (!currentOrder) return;

    try {
      // Use orderAPI to update status directly
      const response = await orderAPI.updateStatus({
        id: currentOrder.id,
        status: newStatus as any,
      });

      if (!response.success) {
        throw new Error(
          response.error || `Failed to update order to ${newStatus}`
        );
      }

      // Update the local state to immediately reflect the status change
      const updatedOrder = {
        ...currentOrder,
        status: newStatus,
      };

      // Update both the current order and the order in the global order list
      usePOSStore.getState().updateOrderInStore(updatedOrder);

      // For COMPLETED status, handle automatic invoice printing and order removal
      if (newStatus === 'COMPLETED') {
        try {
          const printerAPI = await import('@/lib/printer-api');
          const user = useAuthStore.getState().user;

          if (user?.id) {
            // Get default printer or use a specific one
            const printers = await printerAPI.PrinterAPI.getPrinters();
            const defaultPrinter =
              printers.find(p => p.isDefault) || printers[0];

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
              }
            }
          }
        } catch (printError) {
          orderLogger.warn('Invoice printing error:', printError);
          // Printing failure shouldn't affect order completion
        }

        // Remove the completed order from the store and clear the panel
        const orderId = currentOrder.id;
        usePOSStore.getState().removeOrderFromStore(orderId);

        // Force refresh orders list to update the grid
        setTimeout(() => {
          refreshOrders();
        }, 300);
      } else {
        // For READY status, fetch the updated order
        const orderResp = await orderAPI.getById(currentOrder.id);
        if (orderResp.success && orderResp.data) {
          // Update the order in the POS store
          usePOSStore.getState().updateOrderInStore(orderResp.data as any);
        }
      }

      // Success message based on the new status
      toast({
        title: newStatus === 'READY' ? 'Order Ready' : 'Order Completed',
        description:
          newStatus === 'READY'
            ? `${orderType.toLowerCase()} order is ready for ${orderType === 'TAKEOUT' ? 'pickup' : 'delivery'}`
            : `${orderType.toLowerCase()} order has been completed successfully`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      orderLogger.error(
        `Failed to update order status to ${newStatus}:`,
        errorMessage
      );

      toast({
        title: 'Status Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
    }
  };

  // Handle order completion - wrapper for backward compatibility
  const handleCompleteOrder = () => handleUpdateOrderStatus('COMPLETED');

  // Handle marking order as ready
  const handleMarkReady = () => handleUpdateOrderStatus('READY');

  // Handle order cancellation
  const handleCancelOrder = async () => {
    if (!currentOrder?.id) return;

    try {
      const orderId = currentOrder.id; // Save order ID before it gets cleared
      orderLogger.debug('Cancelling order', { orderId });

      // Get the current user ID from authStore to properly log who cancelled the order
      const userId = useAuthStore.getState().user?.id || 'system';

      // IMPORTANT: First, explicitly remove the order from the global store
      // This will update the UI immediately regardless of backend success
      usePOSStore.getState().removeOrderFromStore(orderId);

      // Direct API call to change the status in the database to 'cancelled'
      const result = await orderAPI.cancel({
        id: orderId,
        userId: userId,
        reason: 'Order cancelled by user',
      });

      orderLogger.debug('Order cancellation result', {
        success: result.success,
      });

      // Clear local state using the store's method
      usePOSStore.setState(state => ({
        ...state,
        currentOrder: null,
        activeOrder: null,
        selectedTable: null,
      }));

      // Force switch back to tables view to clear the panel
      switchToTables();

      // Force a refresh to ensure lists are updated
      setTimeout(() => {
        refreshOrders();
      }, 500);

      toast({
        title: 'Order Cancelled',
        description: `${orderType.toLowerCase()} order has been cancelled`,
      });
    } catch (error) {
      orderLogger.error('Failed to cancel order:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel order',
        variant: 'destructive',
      });

      // In case of error, refresh to ensure UI is consistent
      refreshOrders();
    } finally {
    }
  };

  // Handle adding customized items - SINGLE unified implementation
  useEffect(() => {
    // Skip if no customization data or no active order
    if (
      !pendingCustomization ||
      !pendingCustomization.selectedItem ||
      !pendingCustomization.selectedItem.id ||
      !currentOrder ||
      !currentOrder.id
    ) {
      return;
    }

    // ✅ FIX: Skip if we're already processing a customization (prevents duplicate from store updates)
    if (isProcessingCustomizationRef.current) {
      orderLogger.debug('Skipping - already processing a customization');
      return;
    }

    // Mark that we're processing
    isProcessingCustomizationRef.current = true;

    // Function to process item addition
    const processItemAddition = async () => {
      try {
        // Log start of processing
        orderLogger.debug('TakeoutOrderPanel processItemAddition called', {
          item: pendingCustomization.selectedItem.name,
          orderId: currentOrder.id,
        });

        // Safely extract all required values with fallbacks
        const selectedItem = pendingCustomization.selectedItem;
        const itemQuantity = pendingCustomization.itemQuantity || 1;
        const ingredientAdjustments =
          pendingCustomization.ingredientAdjustments || {};
        const specialNotes = pendingCustomization.specialNotes || '';
        const addonSelections = pendingCustomization.addonSelections || [];

        // Create customizations array from ingredient adjustments
        const customizations: {
          type: string;
          name: string;
          priceAdjustment: number;
        }[] = [];

        // Process ingredient adjustments
        if (
          ingredientAdjustments &&
          typeof ingredientAdjustments === 'object'
        ) {
          Object.entries(ingredientAdjustments).forEach(
            ([ingredientId, isRemoved]) => {
              if (isRemoved) {
                // Get ingredient name for display
                // Since ingredientId is now a string ID, we need to find the ingredient object
                const ingredient = selectedItem.ingredients.find(
                  ing => ing.id === ingredientId
                );
                const ingredientName = ingredient
                  ? ingredient.name // ✅ Use the name directly from ingredient object
                  : getIngredientNameSafe(ingredientId, stockItems); // ✅ Fallback to ID lookup

                // Create modified notes string for proper display (don't modify specialNotes directly as it's a const)
                let notesWithIngredient = specialNotes;
                if (!notesWithIngredient.includes(`No ${ingredientName}`)) {
                  notesWithIngredient =
                    (notesWithIngredient ? notesWithIngredient + ', ' : '') +
                    `No ${ingredientName}`;
                }

                customizations.push({
                  type: 'remove_ingredient',
                  name: ingredientName || ingredientId, // Use name if available, fallback to ID
                  priceAdjustment: 0,
                });
              }
            }
          );
        }

        // Get the final notes string with ingredient customizations
        let finalNotes = specialNotes;

        // Add ingredient removal info to notes if needed
        Object.entries(ingredientAdjustments || {}).forEach(
          ([ingredientId, isRemoved]) => {
            if (isRemoved) {
              // Get ingredient name from the object directly
              const ingredient = selectedItem.ingredients.find(
                ing => ing.id === ingredientId
              );
              const ingredientName = ingredient
                ? ingredient.name // ✅ Use the name directly from ingredient object
                : getIngredientNameSafe(ingredientId, stockItems); // ✅ Fallback to ID lookup
              if (!finalNotes.includes(`No ${ingredientName}`)) {
                finalNotes =
                  (finalNotes ? finalNotes + ', ' : '') +
                  `No ${ingredientName}`;
              }
            }
          }
        );

        // ✅ Check if this item already exists with same notes AND addons (OrderPanel parity)
        const normalizedNotes = finalNotes?.trim() || '';
        const normalizedAddonSelections = addonSelections || [];

        const existingItem = currentOrder.items?.find(item => {
          // Check if menuItemId matches
          if (item.menuItemId !== selectedItem.id) return false;

          // Check if notes match (including customizations)
          const itemNotes = item.notes || '';
          if (itemNotes !== normalizedNotes) return false;

          // ✅ Check if addons match
          const itemAddons = (item as any).addons || [];
          const addonsMatch = areAddonsEqual(itemAddons, normalizedAddonSelections);

          return addonsMatch;
        });

        orderLogger.debug('Existing item search result', {
          found: !!existingItem,
          existingItemId: existingItem?.id,
          hasAddons: normalizedAddonSelections.length > 0,
          addonCount: normalizedAddonSelections.length,
        });

        // If existing item found, update quantity instead of adding new
        if (existingItem) {
          orderLogger.debug('Found existing item in takeout order, updating quantity', {
            itemId: existingItem.id,
            oldQuantity: existingItem.quantity,
            adding: itemQuantity,
          });

          const oldQuantity = existingItem.quantity || 0;
          const newQuantity = oldQuantity + itemQuantity;

          // Update the existing item's quantity
          await updateOrderItem(existingItem.id, newQuantity);

          // ✅ Scale addon quantities proportionally if existing item has addons
          const existingAddons = (existingItem as any).addons || [];
          if (existingAddons.length > 0) {
            orderLogger.debug('Scaling addon quantities for existing takeout item', {
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

                // ✅ Refresh order to show updated addon quantities
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

          // ✅ Track this quantity change
          trackQuantityChange(
            existingItem.id,
            existingItem.name || (existingItem as any).menuItemName || selectedItem.name,
            selectedItem.id,
            oldQuantity,
            newQuantity
          );

          // ✅ FIX: Don't auto-navigate - let user continue adding items (matches OrderPanel)
          toast({
            title: 'Item Updated',
            description: `Updated ${selectedItem.name} quantity to ${newQuantity}`,
          });
          return; // ✅ Exit early - don't add as new item
        }

        // Use store's addOrderItem function which handles proper state updates
        const response = await addOrderItem(
          selectedItem.id,
          itemQuantity,
          customizations,
          finalNotes
        );

        // CRITICAL FIX: Use the actual item returned by the backend addItem API
        if (response && (response as any).__actualAddedItem) {
          const actualItem = (response as any).__actualAddedItem;

          orderLogger.debug('Using actual returned item for tracking', {
            itemId: actualItem.id,
            menuItemId: actualItem.menuItemId,
          });

          // ✅ CRITICAL FIX: Add addons to the order item if any were selected
          if (addonSelections && addonSelections.length > 0 && actualItem && actualItem.id) {
            orderLogger.debug('Adding addons to takeout order item', {
              addonCount: addonSelections.length,
              orderId: currentOrder.id,
              orderItemId: actualItem.id,
            });

            try {
              const addonResult = await (window as any).electronAPI.ipc.invoke(
                'addon:addToOrderItem',
                {
                  orderItemId: actualItem.id,
                  addonSelections: addonSelections,
                }
              );

              if (addonResult.success) {
                orderLogger.debug('Addons added successfully to takeout order item');
                // Small delay to ensure database transaction is fully committed
                await new Promise(resolve => setTimeout(resolve, 100));
              } else {
                orderLogger.error('Failed to add addons to takeout order:', addonResult.error);
                toast({
                  title: 'Warning',
                  description: 'Item added but some addons failed to attach',
                  variant: 'default',
                });
              }
            } catch (addonError) {
              orderLogger.error('Error adding addons to takeout order:', addonError);
              toast({
                title: 'Warning',
                description: 'Item added but addons failed to attach',
                variant: 'default',
              });
            }
          }

          // Always refresh the order to get the most current state
          orderLogger.debug('Refreshing order to get current state');
          try {
            const orderAPI = await import('@/lib/ipc-api');
            const orderResp = await orderAPI.orderAPI.getById(currentOrder.id);
            if (orderResp.success && orderResp.data) {
              const refreshedOrder = orderResp.data;
              orderLogger.debug('Order refreshed successfully', {
                itemCount: refreshedOrder.items?.length,
              });

              // ✅ CRITICAL FIX: Update store with refreshed order (includes addons!)
              const { updateOrderInStore } = usePOSStore.getState();
              const orderWithItems = {
                ...refreshedOrder,
                items: refreshedOrder.items ? [...refreshedOrder.items.map((item: any) => ({
                  ...item,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                  price: item.price,
                }))] : [],
              };
              updateOrderInStore(orderWithItems as any);
              orderLogger.debug('Updated posStore with refreshed order (including addons)');

              // Find the ACTUAL item in the refreshed order
              orderLogger.debug('Searching for matching item', {
                menuItemId: actualItem.menuItemId,
                quantity: actualItem.quantity,
              });

              // Strategy 1: Find by menuItemId and quantity (existing logic)
              let matchingItem = refreshedOrder.items?.find(
                (item: any) =>
                  item.menuItemId === actualItem.menuItemId &&
                  item.quantity === actualItem.quantity
              ) as OrderItem | undefined;

              // Strategy 2: If not found, find the LATEST item with the same menuItemId
              if (!matchingItem) {
                orderLogger.debug('Strategy 1 failed, trying Strategy 2');
                const itemsWithSameMenuId = refreshedOrder.items?.filter(
                  (item: any) => item.menuItemId === actualItem.menuItemId
                );
                if (itemsWithSameMenuId && itemsWithSameMenuId.length > 0) {
                  matchingItem =
                    itemsWithSameMenuId[itemsWithSameMenuId.length - 1] as OrderItem;
                  orderLogger.debug('Found item using Strategy 2', {
                    itemId: matchingItem.id,
                  });
                }
              }

              // Strategy 3: If still not found, find by selectedItem.id
              if (!matchingItem) {
                orderLogger.debug('Strategy 2 failed, trying Strategy 3');
                matchingItem = refreshedOrder.items?.find(
                  (item: any) => item.menuItemId === selectedItem.id
                ) as OrderItem | undefined;
                if (matchingItem) {
                  orderLogger.debug('Found item using Strategy 3', {
                    itemId: matchingItem.id,
                  });
                }
              }

              if (matchingItem) {
                orderLogger.debug('Found matching item in refreshed order', {
                  itemId: matchingItem.id,
                });

                // Track this item addition
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
                orderLogger.warn(
                  'Could not find matching item in refreshed order'
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
              }
            }
          } catch (refreshError) {
            orderLogger.error('Failed to refresh order', refreshError);
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
            orderLogger.error('Fallback tracking failed', fallbackError);
          }
        }

        // Success notification
        toast({
          title: 'Item Added',
          description: `${selectedItem.name} added to order`,
        });

        orderLogger.debug('Item added successfully');
      } catch (error) {
        orderLogger.error('Failed to add item to order:', error);
        toast({
          title: 'Error',
          description: 'Failed to add item to order',
          variant: 'destructive',
        });
      } finally {
        // ✅ FIX: Reset processing flag when done (success or error)
        isProcessingCustomizationRef.current = false;
      }
    };

    // Execute the item addition
    processItemAddition();
  }, [
    pendingCustomization,  // ✅ Trigger on full object change (matches OrderPanel)
    // ✅ FIX: Removed currentOrder?.id - it was causing duplicate triggers on store updates
    addOrderItem,
    toast,
  ]); // Only depend on essential props to prevent re-rendering

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // No current order - show "create order" message
  if (!currentOrder) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <div className='text-center'>
          <ShoppingCart className='mx-auto mb-4 h-12 w-12 text-gray-400' />
          <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
            No Active Order
          </h3>
          <p className='text-gray-600 dark:text-gray-400'>
            Create a {orderType.toLowerCase()} order to start adding items
          </p>
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
            Order #{currentOrder.orderNumber || 'N/A'}
          </h2>
          <Badge variant='outline' className='text-xs'>
            #{currentOrder.orderNumber || 'N/A'}
          </Badge>
        </div>

        {/* Customer Info */}
        <div className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
          {currentOrder.customerName && (
            <div className='flex items-center space-x-1'>
              <User className='h-4 w-4' />
              <span>{currentOrder.customerName}</span>
            </div>
          )}
          {currentOrder.customerPhone && (
            <div className='flex items-center space-x-1'>
              <Phone className='h-4 w-4' />
              <span>{currentOrder.customerPhone}</span>
            </div>
          )}
          {currentOrder.deliveryAddress && (
            <div className='flex items-center space-x-1'>
              <MapPin className='h-4 w-4' />
              <span className='truncate'>{currentOrder.deliveryAddress}</span>
            </div>
          )}
        </div>

        <div className='mt-2 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400'>
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
            {currentOrder.items.map(item => (
              <Card key={item.id} className='p-4'>
                <div className='space-y-3'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='space-y-1'>
                        <h4 className='font-medium'>
                          {item.menuItemName || item.name || 'Menu Item'}
                        </h4>
                        {/* Display removed ingredients */}
                        {item.notes && item.notes.includes('remove:') && (
                          <div className='text-xs text-red-600 dark:text-red-400'>
                            {(() => {
                              const removeMatch = item.notes.match(
                                /remove:\s*(.+?)(\n|$)/
                              );
                              if (removeMatch && removeMatch[1]) {
                                // Parse ingredient IDs and convert to names
                                const ingredientIds = removeMatch[1]
                                  .split(',')
                                  .map(id => id.trim());
                                const ingredientNames = ingredientIds
                                  .map(id => {
                                    // Use the ID lookup utility to get ingredient name from stock items
                                    return getIngredientNameSafe(id, stockItems);
                                  })
                                  .filter(name => name.length > 0);
                                return `No ${ingredientNames.join(', ')}`;
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      <p className='text-sm text-gray-600 dark:text-gray-400'>
                        {formatPrice(getOrderItemUnitPrice(item))} each
                      </p>

                      {/* Special kitchen notes */}
                      {item.notes &&
                        (() => {
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

                      {/* Display addons if present */}
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
                        handleRemoveItem(item.id, item.menuItemName || 'Item')
                      }
                      className='p-1 text-red-600 hover:text-red-700'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          handleQuantityChange(
                            item.id,
                            (item.quantity || 1) - 1,
                            item.menuItemName || 'Item'
                          )
                        }
                        disabled={(item.quantity || 1) <= 1 || updatingItemId === item.id || isProcessing}
                        className='h-8 w-8 p-0'
                      >
                        <Minus className='h-3 w-3' />
                      </Button>
                      <span className='w-8 text-center text-sm font-medium'>
                        {item.quantity || 1}
                      </span>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          handleQuantityChange(
                            item.id,
                            (item.quantity || 1) + 1,
                            item.menuItemName || 'Item'
                          )
                        }
                        disabled={updatingItemId === item.id || isProcessing}
                        className='h-8 w-8 p-0'
                      >
                        <Plus className='h-3 w-3' />
                      </Button>
                    </div>
                    <span className='font-medium'>
                      {formatPrice(getOrderItemTotalPrice(item))}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className='py-8 text-center'>
            <ShoppingCart className='mx-auto mb-3 h-12 w-12 text-gray-300' />
            <p className='text-gray-500'>No items in order</p>
            <Button onClick={switchToMenu} variant='outline' className='mt-4'>
              <Plus className='mr-2 h-4 w-4' />
              Add Items
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='border-t border-gray-200 p-6 dark:border-gray-700'>
        {/* Delivery Fee Section - Only for delivery orders */}
        {orderType === 'DELIVERY' && (
          <div className='mb-4 space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <MapPin className='mr-1 h-4 w-4 text-blue-600' />
                <span className='text-sm font-medium'>Delivery Fee</span>
              </div>
              <div className='flex items-center space-x-2'>
                <div className='flex items-center'>
                  <span className='mr-1 text-sm font-medium'>$</span>
                  <Input
                    type='text'
                    value={localDeliveryFee}
                    onChange={e => handleDeliveryFeeChange(e.target.value)}
                    onBlur={handleDeliveryFeeSubmit}
                    onFocus={e => {
                      // Select all text when focused for easier entry
                      e.target.select();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleDeliveryFeeSubmit();
                      }
                    }}
                    className={`w-20 pl-1 text-right ${parseFloat(localDeliveryFee || '0') === 0 ? 'border-yellow-400 bg-yellow-50' : ''}`}
                    placeholder='0.00'
                  />
                </div>
                {isProcessing && (
                  <div className='h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-transparent'></div>
                )}
              </div>
            </div>
            {/* Helper text for delivery fee */}
            <div className='text-xs italic text-gray-500'>
              Delivery fee will be automatically added to the total
            </div>
          </div>
        )}

        {/* Total with detailed breakdown */}
        <div className='mb-4 flex flex-col gap-1 border-b border-t border-gray-200 py-3 dark:border-gray-700'>
          {/* Items subtotal */}
          <div className='flex items-center justify-between text-sm'>
            <span className='text-gray-600 dark:text-gray-400'>
              Items Subtotal:
            </span>
            <span>
              $
              {(currentOrder?.items || [])
                .reduce((sum, item) => sum + getOrderItemTotalPrice(item), 0)
                .toFixed(2)}
            </span>
          </div>

          {/* Delivery fee line - only for delivery orders */}
          {orderType === 'DELIVERY' && (
            <div className='flex items-center justify-between text-sm'>
              <span className='text-gray-600 dark:text-gray-400'>
                Delivery Fee:
              </span>
              <span>
                $
                {(userEnteredFeeRef.current && localDeliveryFee
                  ? parseFloat(localDeliveryFee) || 0
                  : currentDeliveryFee
                ).toFixed(2)}
              </span>
            </div>
          )}

          {/* Final total with larger font */}
          <div className='mt-2 flex items-center justify-between text-lg font-semibold'>
            <span>Total:</span>
            <span className='text-xl'>${orderTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons - Progressive Disclosure Layout for Space Efficiency */}
        <div className='space-y-3'>
          {/* PRIMARY ACTION - Context-Aware (Full Width) */}
          {viewMode === 'tables' && currentOrder.status === 'PENDING' && hasChanges && (
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
                        orderLogger.debug('Printing net changes', {
                          newItems: newItemsCount,
                          updates: updatedItemsCount,
                          removals: removedItemsCount,
                        });

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
                          switchToTables();
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
                    orderLogger.error('Takeout simple print failed:', error);
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

          {viewMode === 'tables' && currentOrder.status === 'PENDING' && !hasChanges && (
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

          {viewMode === 'tables' && currentOrder.status === 'READY' && (
            <Button
              onClick={handleCompleteOrder}
              className='w-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700'
              disabled={isLoading || isProcessing}
            >
              <Check className='mr-2 h-4 w-4' />
              {isProcessing ? 'Completing...' : 'Complete Order'}
            </Button>
          )}

          {viewMode === 'tables' && currentOrder.status === 'COMPLETED' && (
            <Button disabled={true} className='w-full cursor-not-allowed bg-gray-400'>
              <Check className='mr-2 h-4 w-4' />
              Order Completed
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

                    if (user?.id && currentOrder) {
                      const printers = await printerAPI.PrinterAPI.getPrinters();
                      const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

                      if (defaultPrinter && hasChanges && changesSummary) {
                        orderLogger.debug('Printing net changes from menu view', {
                          newItems: newItemsCount,
                          updates: updatedItemsCount,
                          removals: removedItemsCount,
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
                          orderLogger.debug('Changes printed successfully');
                          clearTracking();
                        } else {
                          throw new Error(result.error || 'Print failed');
                        }
                      }
                    }
                  } catch (printError) {
                    orderLogger.error('Auto-print failed:', printError);
                  }

                  const currentOrderId = currentOrder.id;
                  const userFee = parseFloat(localDeliveryFee) || 0;
                  const savedDeliveryFee = userEnteredFeeRef.current ? userFee : currentDeliveryFee;

                  const currentOrderFromState = usePOSStore.getState().currentOrder;
                  if (currentOrderFromState?.id === currentOrderId) {
                    try {
                      const itemsTotal = (currentOrder.items || []).reduce((sum, item) => sum + getOrderItemTotalPrice(item), 0);
                      const finalDeliveryFee = savedDeliveryFee;
                      const newTotalAmount = itemsTotal + finalDeliveryFee;

                      orderLogger.debug('Saving order with delivery fee', {
                        deliveryFee: finalDeliveryFee,
                        itemsTotal,
                        total: newTotalAmount,
                      });

                      const updateResult = await orderAPI.update({
                        id: currentOrderId,
                        updates: { deliveryFee: finalDeliveryFee },
                        userId: useAuthStore.getState().user?.id || 'owner',
                      });

                      if (!updateResult.success) {
                        throw new Error(updateResult.error || 'Failed to save delivery fee');
                      }

                      orderLogger.debug('Successfully saved delivery fee');

                      usePOSStore.setState((state: any) => ({
                        ...state,
                        currentOrder: {
                          ...state.currentOrder,
                          deliveryFee: finalDeliveryFee,
                          total: newTotalAmount,
                          totalAmount: newTotalAmount,
                        },
                      }));

                      const orderResp = await orderAPI.getById(currentOrderId);
                      if (orderResp.success && orderResp.data) {
                        usePOSStore.getState().updateOrderInStore(orderResp.data as any);
                      }
                    } catch (error) {
                      orderLogger.error('Error saving delivery fee:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to save delivery fee and update total',
                        variant: 'destructive',
                      });
                    }
                  }

                  switchToTables();

                  try {
                    const { refreshOrders } = usePOSStore.getState();
                    await refreshOrders();
                    orderLogger.debug('Orders refreshed with updated data');
                  } catch (refreshError) {
                    orderLogger.error('Failed to refresh orders:', refreshError);
                  }

                  clearTracking();
                  orderLogger.debug('Tracking state cleared after completion');

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

          {/* Status Action for Mark Ready */}
          {viewMode === 'tables' && currentOrder.status === 'PENDING' && !hasChanges && currentOrder.items && currentOrder.items.length > 0 && (
            <Button
              onClick={handleMarkReady}
              className='w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:from-blue-600 hover:to-blue-700'
              disabled={isLoading || isProcessing}
            >
              <Check className='mr-2 h-4 w-4' />
              {isProcessing ? 'Processing...' : 'Mark Ready for Pickup'}
            </Button>
          )}

          {/* SECONDARY ACTIONS - Compact 2-Column Grid */}
          {currentOrder.items && currentOrder.items.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {/* Print Kitchen Order Button */}
              <Button
                onClick={async () => {
                  const printWithRetry = async (maxRetries = 3) => {
                    let attempts = 0;
                    let success = false;
                    let lastError: unknown = null;


                    while (attempts < maxRetries && !success) {
                      try {
                        // Increment attempt counter
                        attempts++;

                        // Use PrinterAPI to print kitchen order
                        const printerAPI = await import('@/lib/printer-api');
                        const user = useAuthStore.getState().user;

                        if (!user?.id) {
                          toast({
                            title: 'Error',
                            description:
                              'User authentication required for printing',
                            variant: 'destructive',
                          });
                          return false;
                        }

                        // Get default printer or use a specific one
                        const printers =
                          await printerAPI.PrinterAPI.getPrinters();
                        const defaultPrinter =
                          printers.find(p => p.isDefault) || printers[0];

                        if (!defaultPrinter) {
                          toast({
                            title: 'Error',
                            description:
                              'No printer found. Please configure a printer in settings.',
                            variant: 'destructive',
                          });
                          return false;
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
                          success = true;
                          toast({
                            title: 'Kitchen Order Printed',
                            description:
                              'Order has been sent to the kitchen printer',
                          });
                          return true;
                        } else {
                          throw new Error(
                            result.error || 'Failed to print kitchen order'
                          );
                        }
                      } catch (error) {
                        lastError = error;
                        orderLogger.error(
                          `Print attempt ${attempts} failed:`,
                          error
                        );

                        // If not the last attempt, wait before retrying
                        if (attempts < maxRetries) {
                          const retryDelay = 1000 * Math.pow(2, attempts - 1); // Exponential backoff
                          await new Promise(resolve =>
                            setTimeout(resolve, retryDelay)
                          );

                          // Show retry toast
                          toast({
                            title: 'Retrying Print',
                            description: `Attempt ${attempts + 1} of ${maxRetries}...`,
                          });
                        }
                      }
                    }

                    // If all attempts failed
                    if (!success) {
                      toast({
                        title: 'Print Failed',
                        description:
                          lastError instanceof Error
                            ? lastError.message
                            : 'Failed to print after multiple attempts',
                        variant: 'destructive',
                      });
                    }

                    return success;
                  };

                  try {
                    await printWithRetry();
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
                  // Create a function for printing with retry capability
                  const printWithRetry = async (maxRetries = 3) => {
                    let attempts = 0;
                    let success = false;
                    let lastError: unknown = null;


                    while (attempts < maxRetries && !success) {
                      try {
                        // Increment attempt counter
                        attempts++;

                        // Use PrinterAPI to print invoice
                        const printerAPI = await import('@/lib/printer-api');
                        const user = useAuthStore.getState().user;

                        if (!user?.id) {
                          toast({
                            title: 'Error',
                            description:
                              'User authentication required for printing',
                            variant: 'destructive',
                          });
                          return false;
                        }

                        // Get default printer or use a specific one
                        const printers =
                          await printerAPI.PrinterAPI.getPrinters();
                        const defaultPrinter =
                          printers.find(p => p.isDefault) || printers[0];

                        if (!defaultPrinter) {
                          toast({
                            title: 'Error',
                            description:
                              'No printer found. Please configure a printer in settings.',
                            variant: 'destructive',
                          });
                          return false;
                        }

                        const result = await printerAPI.PrinterAPI.printInvoice(
                          currentOrder.id,
                          defaultPrinter.name,
                          1,
                          user.id
                        );

                        if (result.success) {
                          success = true;
                          toast({
                            title: 'Invoice Printed',
                            description: 'Invoice has been sent to the printer',
                          });
                          return true;
                        } else {
                          throw new Error(
                            result.error || 'Failed to print invoice'
                          );
                        }
                      } catch (error) {
                        lastError = error;
                        orderLogger.error(
                          `Invoice print attempt ${attempts} failed:`,
                          error
                        );

                        // If not the last attempt, wait before retrying
                        if (attempts < maxRetries) {
                          const retryDelay = 1000 * Math.pow(2, attempts - 1); // Exponential backoff
                          await new Promise(resolve =>
                            setTimeout(resolve, retryDelay)
                          );

                          // Show retry toast
                          toast({
                            title: 'Retrying Invoice Print',
                            description: `Attempt ${attempts + 1} of ${maxRetries}...`,
                          });
                        }
                      }
                    }

                    // If all attempts failed
                    if (!success) {
                      toast({
                        title: 'Invoice Print Failed',
                        description:
                          lastError instanceof Error
                            ? lastError.message
                            : 'Failed to print invoice after multiple attempts',
                        variant: 'destructive',
                      });
                    }

                    return success;
                  };

                  try {
                    await printWithRetry();
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

          {/* TERTIARY ACTION - Cancel Button (Subtle) */}
          <Button
            onClick={() => setShowDeleteConfirmation(true)}
            variant='ghost'
            className='w-full text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400'
            size='sm'
            disabled={isLoading || isProcessing}
          >
            <X className='mr-1.5 h-3.5 w-3.5' />
            Cancel Order
          </Button>

          {/* Delete confirmation dialog */}
          <AlertDialog
            open={showDeleteConfirmation}
            onOpenChange={setShowDeleteConfirmation}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Order Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel this {orderType.toLowerCase()}{' '}
                  order? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, Keep Order</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOrder}
                  className='bg-red-600 hover:bg-red-700 focus:ring-red-600'
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

export default TakeoutOrderPanel;