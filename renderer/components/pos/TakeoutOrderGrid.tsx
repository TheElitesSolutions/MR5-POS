'use client';

import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShoppingBag,
  Truck,
  Plus,
  Phone,
  MapPin,
  User,
  Clock,
  RefreshCw,
  Edit,
  CheckCircle,
  Utensils,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { orderLogger } from '@/utils/logger';
import { useToast } from '@/hooks/use-toast';
import { usePOSStore } from '@/stores/posStore';
import { useAuthStore } from '@/stores/authStore';
import { orderAPI } from '@/lib/ipc-api';
import { Order } from '@/types';
import { OrderStatus } from '../../../shared/ipc-types';
import { cn } from '@/lib/utils';

// Error recovery helper function with retry logic
const useErrorRecovery = () => {
  const { toast } = useToast();

  const withRetry = async <T,>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      onSuccess?: (result: T) => void;
      onError?: (error: any) => void;
      retryCondition?: (error: any) => boolean;
      operationName?: string;
    } = {}
  ): Promise<T | null> => {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onSuccess,
      onError,
      retryCondition = () => true,
      operationName = 'Operation',
    } = options;

    let retries = 0;

    while (true) {
      try {
        const result = await operation();
        if (onSuccess) onSuccess(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        orderLogger.error(
          `${operationName} failed (attempt ${retries + 1}):`,
          error
        );

        if (onError) onError(error);

        if (retries < maxRetries && retryCondition(error)) {
          retries++;
          const backoffTime = retryDelay * Math.pow(2, retries - 1);

          toast({
            title: 'Retrying...',
            description: `Attempt ${retries}/${maxRetries} - ${operationName}`,
          });

          await new Promise(resolve => setTimeout(resolve, backoffTime));
          // Continue to next iteration for retry
        } else {
          // All retries exhausted or retry condition not met
          if (retries > 0) {
            toast({
              title: 'Operation Failed',
              description: `${operationName} failed after ${retries} retries: ${errorMessage}`,
              variant: 'destructive',
            });
          }
          return null;
        }
      }
    }
  };

  return { withRetry };
};

// Memoized order card component for better performance
interface OrderCardProps {
  order: Order;
  onClick: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  getStatusColor: (status: string) => string;
  formatTimeAgo: (dateString: string) => string;
  getOrderType: (order: Order) => 'TAKEOUT' | 'DELIVERY';
}

const OrderCard = memo(
  ({
    order,
    onClick,
    onUpdateStatus,
    getStatusColor,
    formatTimeAgo,
    getOrderType,
  }: OrderCardProps) => {
    return (
      <Card
        className={cn(
          'group cursor-pointer touch-manipulation p-3 transition-all duration-200 sm:p-4',
          'transform hover:shadow-lg active:scale-95',
          'min-h-[140px] border-2 sm:min-h-[160px]',
          'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
        )}
        onClick={() => onClick(order)}
        role='gridcell'
        tabIndex={0}
        aria-label={`Order ${order.customerDetails?.name || order.customerDetails?.phone || 'unknown'}, ${order.type?.toLowerCase() || 'unknown'}, ${order.status.toLowerCase()}, ${order.items?.length || 0} items, total $${(order.total || order.totalAmount || 0).toFixed(2)}`}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(order);
          }
        }}
      >
        <div className='flex h-full flex-col space-y-2'>
          {/* Order Header */}
          <div className='flex items-start justify-between'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-1'>
                {getOrderType(order) === 'TAKEOUT' ? (
                  <ShoppingBag className='h-4 w-4 text-amber-600' />
                ) : (
                  <Truck className='h-4 w-4 text-blue-600' />
                )}
                <h3 className='truncate text-sm font-bold text-gray-900 dark:text-white'>
                  {order.customerName || 'Guest'}
                </h3>
              </div>
              <p className='text-xs text-gray-500'>#{order.orderNumber}</p>
            </div>
            <Badge className={`text-xs ${getStatusColor(order.status)}`}>
              {order.status}
            </Badge>
          </div>

          {/* Customer Info */}
          <div className='space-y-1 text-xs text-gray-600'>
            {order.customerPhone && (
              <div className='flex items-center gap-1'>
                <Phone className='h-3 w-3' />
                <span className='truncate'>{order.customerPhone}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className='flex items-center gap-1'>
                <MapPin className='h-3 w-3' />
                <span className='truncate'>{order.deliveryAddress}</span>
              </div>
            )}
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span>{formatTimeAgo(order.createdAt)}</span>
            </div>
          </div>

          {/* Order Summary */}
          <div className='flex-1 border-t pt-2'>
            <div className='flex justify-between text-xs'>
              <span>{order.items?.length || 0} items</span>
              <span className='font-medium'>
                ${(order.totalAmount || order.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Order Status Indicator - Removed action buttons */}
          <div
            className='flex gap-1 pt-2'
            role='group'
            aria-label='Order status'
          >
            <div className='flex h-6 items-center text-xs text-gray-600'>
              <span className='mr-1'>Status:</span>
              <span
                className={`font-medium ${
                  order.status === 'PENDING'
                    ? 'text-blue-600'
                    : order.status === 'READY'
                      ? 'text-green-600'
                      : 'text-gray-600'
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }
);

// Add display name for better debugging
OrderCard.displayName = 'OrderCard';

type OrderType = 'TAKEOUT' | 'DELIVERY';

interface CustomerDetails {
  name: string;
  phone: string;
  address?: string;
}

/**
 * TakeoutOrderGrid - Follows TableGrid patterns
 * Shows existing takeout/delivery orders similar to how TableGrid shows tables
 */
const TakeoutOrderGrid = memo(() => {
  const {
    createTakeawayDeliveryOrder,
    selectTakeawayDeliveryOrder,
    switchToMenu,
    isLoading,
    orderType: globalOrderType,
    // Global orders state
    allOrders,
    isLoadingOrders,
    ordersError,
    fetchAllOrders,
    refreshOrders,
    removeOrderFromStore,
    // Network and offline handling
    isOnline,
    offlineMode,
    addPendingAction,
  } = usePOSStore();

  // Use our error recovery helper
  const { withRetry } = useErrorRecovery();

  const { toast } = useToast();

  // Performance optimization with memoization

  // New order creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('TAKEOUT');
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: '',
    phone: '',
    address: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Performance optimization - memoized filtered orders with improved filtering
  const filteredOrders = useMemo(() => {
    if (!allOrders || !Array.isArray(allOrders)) return [];

    // Filter by current order type and sort by creation date (newest first)
    return allOrders
      .filter(order => {
        // Only show orders that are TAKEOUT or DELIVERY
        return (
          (order.type === 'TAKEOUT' || order.type === 'DELIVERY') &&
          // Only show orders with valid status (not CANCELLED)
          order.status !== 'CANCELLED'
        );
      })
      .sort((a, b) => {
        // Sort by status priority first (PENDING > READY > COMPLETED)
        const statusPriority = {
          PENDING: 0,
          READY: 1,
          COMPLETED: 2,
        };

        const statusDiff =
          statusPriority[a.status as keyof typeof statusPriority] -
          statusPriority[b.status as keyof typeof statusPriority];

        if (statusDiff !== 0) return statusDiff;

        // Then sort by creation date (newest first)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [allOrders]);

  // Component mount and cleanup
  useEffect(() => {
    fetchAllOrders();

    // Optimized refresh interval - slower when offline
    const refreshInterval = setInterval(
      fetchAllOrders,
      isOnline ? 30000 : 60000
    );

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchAllOrders, isOnline]);

  // Handle order selection (similar to table selection)
  const handleOrderClick = useCallback(
    async (order: Order) => {
      try {
        await selectTakeawayDeliveryOrder(order);
        toast({
          title: 'Order Selected',
          description: `${getOrderType(order)} order selected`,
        });
      } catch (error) {
        orderLogger.error('Failed to select order:', error);
        toast({
          title: 'Error',
          description: 'Failed to select order. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [selectTakeawayDeliveryOrder, toast]
  );

  // Handle order creation with improved validation and error recovery
  const handleCreateOrder = async () => {
    // Validate phone number format (must be at least 7 digits)
    const phoneRegex = /^\d{7,}$/;
    const phoneValue = customerDetails.phone.trim().replace(/\D/g, ''); // Strip non-digits

    if (!phoneValue) {
      toast({
        title: 'Phone number required',
        description: 'Please enter a customer phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!phoneRegex.test(phoneValue)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must contain at least 7 digits',
        variant: 'destructive',
      });
      return;
    }

    // Address is optional for delivery orders, but if provided, it should be valid
    if (orderType === 'DELIVERY' && customerDetails.address?.trim()) {
      const addressValue = customerDetails.address.trim();

      // If address is provided but too short, suggest a more complete address
      if (addressValue.length < 5) {
        toast({
          title: 'Address suggestion',
          description:
            'For better delivery, please enter a more complete address',
        });
      }
    }

    setIsCreating(true);

    // Format phone number properly (strip non-digits)
    const formattedDetails = {
      ...customerDetails,
      phone: phoneValue,
      // For TAKEOUT orders, explicitly set address to empty to prevent any stale data
      ...(orderType === 'TAKEOUT' ? { address: '' } : {}),
    };

    // Try to create the order directly without using the retry mechanism
    try {
      const order = await createTakeawayDeliveryOrder(
        orderType,
        formattedDetails
      );

      // Order created successfully
      toast({
        title: 'Order Created',
        description: `${orderType === 'TAKEOUT' ? 'Takeout' : 'Delivery'} order created successfully`,
      });

      // Reset form
      setCustomerDetails({ name: '', phone: '', address: '' });
      setShowCreateForm(false);

      // Refresh orders
      await refreshOrders();

      // Switch to menu with slight delay to allow UI to update
      setTimeout(() => {
        switchToMenu();
      }, 500);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      orderLogger.error('Order creation failed:', error);

      // Check if we're offline and handle accordingly
      if (!isOnline) {
        // Queue for offline processing
        addPendingAction('createOrder', {
          orderType,
          customerDetails: formattedDetails,
          timestamp: new Date().toISOString(),
        });

        toast({
          title: 'Offline Mode',
          description: 'Order will be created when back online',
        });
      } else {
        toast({
          title: 'Order Creation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }

    setIsCreating(false);
  };

  // Helper functions
  const getOrderType = (order: Order): 'TAKEOUT' | 'DELIVERY' => {
    if (order.type) {
      return order.type === 'TAKEOUT' ? 'TAKEOUT' : 'DELIVERY';
    }
    return order.deliveryAddress ? 'DELIVERY' : 'TAKEOUT';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-blue-100 text-blue-800';
      case 'READY':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle order status updates with offline support
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    try {
      const updateData = {
        id: orderId,
        status: newStatus,
      };

      if (!isOnline) {
        // Offline mode - queue the action
        addPendingAction('updateOrderStatus', updateData);

        // Optimistically update the UI
        if (newStatus === 'COMPLETED') {
          removeOrderFromStore(orderId);
        }

        toast({
          title: offlineMode ? 'Queued for Sync' : 'Status Updated',
          description: offlineMode
            ? 'Status update will sync when connection is restored'
            : `Order status updated to ${newStatus.toLowerCase()}`,
        });

        return;
      }

      const response = await orderAPI.updateStatus(updateData);

      if (response.success) {
        // If order was completed, remove from store immediately
        if (newStatus === 'COMPLETED') {
          // Automatically print invoice for completed orders
          try {
            const orderToPrint = allOrders.find(order => order.id === orderId);
            if (orderToPrint) {
              const printerAPI = await import('@/lib/printer-api');
              const user = useAuthStore.getState().user;

              if (user?.id) {
                // Get default printer or use a specific one
                const printers = await printerAPI.PrinterAPI.getPrinters();
                const defaultPrinter =
                  printers.find(p => p.isDefault) || printers[0];

                if (defaultPrinter) {
                  const result = await printerAPI.PrinterAPI.printInvoice(
                    orderToPrint.id,
                    defaultPrinter.name,
                    1,
                    user.id
                  );

                  if (result.success) {
                    orderLogger.debug('Invoice printed automatically');
                  } else {
                    orderLogger.warn(
                      'Failed to auto-print invoice:',
                      result.error
                    );
                  }
                }
              }
            }
          } catch (printError) {
            orderLogger.warn('Invoice printing error:', printError);
            // Printing failure shouldn't affect order completion
          }

          removeOrderFromStore(orderId);
          toast({
            title: 'Order Completed',
            description:
              'Order has been completed and removed from active orders',
          });
        } else {
          // For other status updates, refresh the orders
          await refreshOrders();
          toast({
            title: 'Status Updated',
            description: `Order status updated to ${newStatus.toLowerCase()}`,
          });
        }
      } else {
        throw new Error(response.error || 'Failed to update status');
      }
    } catch (error) {
      // On error, queue the action for retry if online
      if (isOnline) {
        addPendingAction('updateOrderStatus', {
          id: orderId,
          status: newStatus,
        });
      }

      toast({
        title: 'Error',
        description: isOnline
          ? 'Failed to update status, queued for retry'
          : 'Status update queued for when connection is restored',
        variant: isOnline ? 'destructive' : 'default',
      });
    }
  };

  if (isLoadingOrders) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-500 dark:text-gray-400'>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className='space-y-4 sm:space-y-6'
      role='main'
      aria-label='Takeout and delivery orders management'
    >
      {/* Header with Create Order Button */}
      <div
        className='flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0'
        role='banner'
      >
        <div className='flex flex-wrap items-center gap-2'>
          <span
            className='text-sm font-medium text-gray-600 dark:text-gray-400'
            aria-live='polite'
            aria-label={`${filteredOrders.length} active orders currently displayed`}
          >
            {filteredOrders.length} active orders
          </span>

          {/* Network Status Indicator */}
          {!isOnline && (
            <div className='flex items-center space-x-1 rounded-md bg-yellow-100 px-2 py-1 dark:bg-yellow-900/30'>
              <div className='h-2 w-2 rounded-full bg-yellow-500' />
              <span className='text-xs text-yellow-700 dark:text-yellow-300'>
                Offline
              </span>
            </div>
          )}

          <Button
            variant='outline'
            size='sm'
            onClick={refreshOrders}
            disabled={isLoadingOrders || !isOnline}
            className='ml-auto transform bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-blue-600 hover:to-blue-700 sm:ml-0'
            aria-label={
              isLoadingOrders ? 'Refreshing orders...' : 'Refresh orders list'
            }
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`}
              aria-hidden='true'
            />
            <span className='hidden xs:inline'>Refresh</span>
            <span className='xs:hidden'>Refresh</span>
          </Button>
        </div>

        <Button
          size='sm'
          onClick={() => setShowCreateForm(true)}
          className='w-full transform touch-manipulation bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-green-600 hover:to-green-700 sm:w-auto'
          aria-label='Create new takeout or delivery order'
        >
          <Plus className='mr-1 h-4 w-4' aria-hidden='true' /> New Order
        </Button>
      </div>

      {/* Create Order Form */}
      {showCreateForm && (
        <Card
          className='border-blue-200 bg-blue-50/50'
          role='form'
          aria-labelledby='create-order-title'
        >
          <CardHeader>
            <CardTitle className='text-lg' id='create-order-title'>
              Create New Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {/* Order Type Selection */}
              <fieldset className='flex space-x-2'>
                <legend className='sr-only'>Select order type</legend>
                <Button
                  variant={orderType === 'TAKEOUT' ? 'default' : 'outline'}
                  onClick={() => {
                    // When switching to TAKEOUT, clear any delivery-specific fields
                    setOrderType('TAKEOUT');
                    if (orderType === 'DELIVERY') {
                      setCustomerDetails(prev => ({
                        ...prev,
                        address: '', // Clear address when switching from DELIVERY to TAKEOUT
                      }));
                    }
                  }}
                  className='flex-1'
                  aria-pressed={orderType === 'TAKEOUT'}
                  aria-label='Select takeout order type'
                >
                  <ShoppingBag className='mr-2 h-4 w-4' aria-hidden='true' />
                  Takeout
                </Button>
                <Button
                  variant={orderType === 'DELIVERY' ? 'default' : 'outline'}
                  onClick={() => setOrderType('DELIVERY')}
                  className='flex-1'
                  aria-pressed={orderType === 'DELIVERY'}
                  aria-label='Select delivery order type'
                >
                  <Truck className='mr-2 h-4 w-4' aria-hidden='true' />
                  Delivery
                </Button>
              </fieldset>

              {/* Customer Details - Mobile Optimized */}
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-1'>
                  <Label
                    htmlFor='customer-name'
                    className='text-sm font-medium'
                  >
                    Customer Name
                  </Label>
                  <div className='relative'>
                    <User
                      className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500'
                      aria-hidden='true'
                    />
                    <Input
                      id='customer-name'
                      placeholder='Enter name (optional)'
                      value={customerDetails.name}
                      onChange={e =>
                        setCustomerDetails(prev => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className='h-10 rounded-md pl-9'
                      aria-describedby='customer-name-hint'
                    />
                  </div>
                  <div
                    id='customer-name-hint'
                    className='text-xs text-gray-500'
                  >
                    Optional. Customer's full name.
                  </div>
                </div>
                <div className='space-y-1'>
                  <Label
                    htmlFor='customer-phone'
                    className='text-sm font-medium'
                  >
                    Phone Number *
                  </Label>
                  <div className='relative'>
                    <Phone
                      className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500'
                      aria-hidden='true'
                    />
                    <Input
                      id='customer-phone'
                      placeholder='Enter phone number'
                      value={customerDetails.phone}
                      onChange={e => {
                        // Allow only digits, spaces, dashes, parentheses, and plus sign
                        const value = e.target.value;
                        if (/^[0-9\s\-\(\)\+]*$/.test(value) || value === '') {
                          setCustomerDetails(prev => ({
                            ...prev,
                            phone: value,
                          }));
                        }
                      }}
                      className='h-10 rounded-md pl-9'
                      required
                      aria-describedby='customer-phone-hint'
                      aria-invalid={!customerDetails.phone}
                    />
                  </div>
                  <div
                    id='customer-phone-hint'
                    className='text-xs text-gray-500'
                  >
                    Required. Enter at least 7 digits.
                  </div>
                </div>
              </div>

              {orderType === 'DELIVERY' && (
                <div className='space-y-1'>
                  <Label
                    htmlFor='delivery-address'
                    className='text-sm font-medium'
                  >
                    Delivery Address *
                  </Label>
                  <div className='relative'>
                    <MapPin
                      className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500'
                      aria-hidden='true'
                    />
                    <Input
                      id='delivery-address'
                      placeholder='Enter complete delivery address'
                      value={customerDetails.address || ''}
                      onChange={e =>
                        setCustomerDetails(prev => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      className='h-10 rounded-md pl-9'
                      required
                      aria-describedby='delivery-address-hint'
                      aria-invalid={
                        (!customerDetails.address ||
                          customerDetails.address.length < 5) &&
                        orderType === 'DELIVERY'
                      }
                    />
                  </div>
                  <div
                    id='delivery-address-hint'
                    className='text-xs text-gray-500'
                  >
                    Required for delivery orders. Include street, number, and
                    area.
                  </div>
                </div>
              )}

              <div className='flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0'>
                <Button
                  variant='outline'
                  onClick={() => setShowCreateForm(false)}
                  className='h-10 w-full sm:flex-1'
                  aria-label='Cancel order creation'
                >
                  <span className='hidden xs:inline'>Cancel</span>
                  <span className='xs:hidden'>Cancel Form</span>
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  disabled={isCreating}
                  className='h-10 w-full transform bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-green-600 hover:to-green-700 sm:flex-1'
                  aria-label={
                    isCreating
                      ? 'Creating order...'
                      : `Create ${orderType.toLowerCase()} order`
                  }
                  aria-describedby='create-order-requirements'
                >
                  {isCreating ? (
                    <>
                      <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className='mr-2 h-4 w-4' />
                      <span className='hidden xs:inline'>Create Order</span>
                      <span className='xs:hidden'>
                        Create {orderType} Order
                      </span>
                    </>
                  )}
                </Button>
                <div id='create-order-requirements' className='sr-only'>
                  Phone number is required.{' '}
                  {orderType === 'DELIVERY' &&
                    'Delivery address is also required for delivery orders.'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Grid */}
      <div
        className='grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6'
        role='grid'
        aria-label={`Active ${globalOrderType.toLowerCase()} orders`}
      >
        {/* Show loading state when appropriate */}
        {isLoadingOrders && filteredOrders.length === 0 && (
          <div className='col-span-full flex h-40 w-full items-center justify-center'>
            <div className='text-center'>
              <div className='mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent'></div>
              <p className='text-sm text-gray-500'>Loading orders...</p>
            </div>
          </div>
        )}

        {/* Show empty state when appropriate */}
        {!isLoadingOrders && filteredOrders.length === 0 && (
          <div className='col-span-full flex h-40 w-full items-center justify-center'>
            <div className='text-center'>
              <ShoppingBag className='mx-auto mb-2 h-8 w-8 text-gray-400' />
              <p className='text-gray-500'>
                No {globalOrderType.toLowerCase()} orders found
              </p>
            </div>
          </div>
        )}

        {/* Order items using memoized OrderCard component */}
        {filteredOrders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={handleOrderClick}
            onUpdateStatus={handleUpdateOrderStatus}
            getStatusColor={getStatusColor}
            formatTimeAgo={formatTimeAgo}
            getOrderType={getOrderType}
          />
        ))}
      </div>

      {/* Enhanced Error State with Recovery Options */}
      {ordersError && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20'>
          <AlertCircle className='mx-auto mb-4 h-12 w-12 text-red-500' />
          <h3 className='mb-2 text-lg font-semibold text-red-700 dark:text-red-400'>
            Error Loading Orders
          </h3>
          <p className='mb-4 text-red-600 dark:text-red-300'>{ordersError}</p>
          <div className='flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0'>
            <Button
              variant='outline'
              onClick={refreshOrders}
              className='transform bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-blue-600 hover:to-blue-700'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry Loading Orders
            </Button>

            {/* Offline mode fallback */}
            {!isOnline && (
              <Button
                variant='outline'
                onClick={() => {
                  // Refresh orders to show cached orders
                  setTimeout(() => refreshOrders(), 500);
                }}
                className='transform bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-amber-600 hover:to-amber-700'
              >
                <ShoppingBag className='mr-2 h-4 w-4' />
                Show Cached Orders
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TakeoutOrderGrid.displayName = 'TakeoutOrderGrid';

export default TakeoutOrderGrid;
