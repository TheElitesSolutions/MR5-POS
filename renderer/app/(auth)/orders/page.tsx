'use client';

// import DateRangeFilter from '@/components/dashboard/DateRangeFilter';
import CashboxSummary from '@/components/orders/CashboxSummary';
import OrderCard from '@/components/orders/OrderCard';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';
import POSLayout from '@/components/pos/POSLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { useOrdersStore } from '@/stores/ordersStore';
import { Order, OrderStatus } from '@/types';
import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useToast } from '@/hooks/use-toast';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
// Removed: import apiClient from "@/lib/api"; - Using stores for IPC communication
import { ipcAPI } from '@/lib/ipc-api';

function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const permissions = useUserPermissions();
  const { toast } = useToast();
  const {
    orders,
    isLoading,
    error,
    filters,
    pagination,
    cashboxSummary,
    fetchOrders,
    updateOrderStatus,
    setFilters,
    setPagination,
    getCashboxSummary,
    closeCashbox,
    exportOrders,
    clearError,
  } = useOrdersStore();

  const [ordersCount, setOrdersCount] = useState<number>(0);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('orders');

  // Enhanced date/time filtering for better shift management
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0))
      .toISOString()
      .slice(0, 16),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
      .toISOString()
      .slice(0, 16),
  });

  // Refs to prevent duplicate initial fetches
  const initialFetchPerformed = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch orders count based on current filters
  const fetchOrdersCount = useCallback(async () => {
    try {
      const countFilters: any = {};

      if (filters.status) countFilters.status = filters.status;
      if (dateRange.startDate)
        countFilters.startDate = new Date(dateRange.startDate).toISOString();
      if (dateRange.endDate) countFilters.endDate = new Date(dateRange.endDate).toISOString();

      const result = await ipcAPI.order.getOrdersCount(countFilters);

      if (result.success && result.data) {
        setOrdersCount(result.data.count);
      }
    } catch (error) {
      // Error is logged by the store
    }
  }, [filters.status, dateRange.startDate, dateRange.endDate]);

  // Initial load and permission check
  useEffect(() => {
    if (isAuthenticated && !(permissions.isManager || permissions.isAdmin)) {
      router.push('/pos');
      return;
    }

    if (
      isAuthenticated &&
      (permissions.isManager || permissions.isAdmin) &&
      !initialFetchPerformed.current
    ) {
      initialFetchPerformed.current = true;
      const initialFilters = { status: OrderStatus.COMPLETED };
      setFilters(initialFilters);
      fetchOrders(initialFilters);
      getCashboxSummary(selectedDate);
      fetchOrdersCount();
    }
  }, [isAuthenticated, permissions.isManager, permissions.isAdmin, router]);

  // Refresh cashbox summary when date changes
  useEffect(() => {
    if (
      isAuthenticated &&
      (permissions.isManager || permissions.isAdmin) &&
      initialFetchPerformed.current
    ) {
      getCashboxSummary(selectedDate);
    }
  }, [selectedDate, isAuthenticated, permissions.isManager, permissions.isAdmin]);

  // Update filters and fetch when search or date range changes
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only trigger search if initial fetch has been performed
    if (!initialFetchPerformed.current) {
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      const newFilters = {
        searchTerm: searchTerm || '',
        status: OrderStatus.COMPLETED, // Always show completed orders only
        dateRange: {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate),
        },
      };
      setFilters(newFilters);
      if (isAuthenticated && (permissions.isManager || permissions.isAdmin)) {
        fetchOrders(newFilters);
        fetchOrdersCount();
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [
    searchTerm,
    dateRange,
    isAuthenticated,
    permissions.isManager,
    permissions.isAdmin,
    fetchOrdersCount,
  ]);

  // Fetch orders when pagination changes (only after initial fetch)
  useEffect(() => {
    if (
      isAuthenticated &&
      (permissions.isManager || permissions.isAdmin) &&
      initialFetchPerformed.current
    ) {
      fetchOrders();
    }
  }, [pagination.page, pagination.limit, isAuthenticated]);

  if (!isAuthenticated || !user) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!(permissions.isManager || permissions.isAdmin)) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='mx-auto max-w-md p-6 text-center'>
          <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
          <h2 className='mb-2 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl'>
            Access Denied
          </h2>
          <p className='mb-4 text-gray-600 dark:text-gray-400'>
            You don&apos;t have permission to view orders. Contact your manager
            for access.
          </p>
          <Button
            onClick={() => router.push('/pos')}
            variant='outline'
            className='transform bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-blue-600 hover:to-blue-700'
          >
            Return to POS
          </Button>
        </div>
      </div>
    );
  }

  const handleViewOrderDetails = useCallback((order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  }, []);

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus
  ) => {
    try {
      // Update the order status
      await updateOrderStatus(orderId, status);

      // Update the orders list immediately to reflect the change
      // This avoids having to wait for fetchOrders to complete
      useOrdersStore.setState(state => ({
        ...state,
        orders: state.orders.map(order =>
          order.id === orderId ? { ...order, status } : order
        ),
      }));

      // If order was completed, automatically print receipt
      if (status === OrderStatus.COMPLETED) {
        try {
          const orderToPrint = orders.find(order => order.id === orderId);
          if (orderToPrint) {
            const user = useAuthStore.getState().user;
            if (user?.id) {
              const printerAPI = await import('@/lib/printer-api');
              const printers = await printerAPI.PrinterAPI.getPrinters();
              const defaultPrinter =
                printers.find(p => p.isDefault) || printers[0];

              if (defaultPrinter) {
                const printResult = await printerAPI.PrinterAPI.printInvoice(
                  orderId,
                  defaultPrinter.name,
                  1,
                  user.id
                );
              }
            }
          }
        } catch (printError) {
          // Printing failure shouldn't affect order completion
        }
      }

      // Refresh orders to get latest data in the background
      fetchOrders(filters).catch(() => {
        // Error is logged by the store
      });

      // If order details modal is open, update it or close it
      if (selectedOrder?.id === orderId) {
        // Update the selected order status
        setSelectedOrder(prev => (prev ? { ...prev, status } : null));
        // Close the details modal
        setShowOrderDetails(false);
      }

      // Show success toast
      toast({
        title: 'Status Updated',
        description: `Order status updated to ${status.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update order status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handlePrintReceipt = async (orderId: string) => {
    try {
      // Find the order to print
      const orderToPrint = orders.find(order => order.id === orderId);
      if (!orderToPrint) {
        toast({
          title: 'Print Failed',
          description: 'Order not found. Please refresh and try again.',
          variant: 'destructive',
        });
        return;
      }

      // Get user for printing authentication
      const user = useAuthStore.getState().user;
      if (!user?.id) {
        toast({
          title: 'Print Failed',
          description: 'User authentication required for printing.',
          variant: 'destructive',
        });
        return;
      }

      // Use PrinterAPI to print invoice using the SAME method as POS pages
      const printerAPI = await import('@/lib/printer-api');

      // Get default printer or use a specific one
      const printers = await printerAPI.PrinterAPI.getPrinters();
      const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

      if (!defaultPrinter) {
        toast({
          title: 'Print Failed',
          description:
            'No printer found. Please configure a printer in settings.',
          variant: 'destructive',
        });
        return;
      }

      // Print the invoice using the SAME method as POS pages (ultimate thermal solution)
      const result = await printerAPI.PrinterAPI.printInvoice(
        orderId,
        defaultPrinter.name,
        1,
        user.id
      );

      if (result.success) {
        toast({
          title: 'Invoice Printed',
          description: 'Invoice has been sent to the printer successfully.',
        });
      } else {
        toast({
          title: 'Print Failed',
          description:
            result.error || 'Failed to print invoice. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Print Failed',
        description: 'An error occurred while printing the invoice.',
        variant: 'destructive',
      });
    }
  };

  const handleExportOrders = async () => {
    try {
      await exportOrders(filters);
      toast({
        title: 'Export Successful',
        description: 'Orders have been exported to Excel successfully.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export orders',
        variant: 'destructive',
      });
    }
  };

  const handleCloseCashbox = async (date: Date, actualCashAmount?: number) => {
    try {
      await closeCashbox(date, actualCashAmount, user?.id);
    } catch (error) {
      // Error is logged by the store
    }
  };

  const handleRefresh = useCallback(() => {
    fetchOrders(filters);
    getCashboxSummary(selectedDate);
    fetchOrdersCount();
  }, [filters, selectedDate, fetchOrders, getCashboxSummary, fetchOrdersCount]);


  return (
    <POSLayout>
      <div className='mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-4 lg:p-6'>
        {/* Header */}
        <div className='space-y-4 sm:flex sm:items-start sm:justify-between sm:space-y-0'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl'>
              Orders Management
            </h1>
            <p className='text-sm text-gray-600 dark:text-gray-400 sm:text-base'>
              View and manage restaurant orders, track daily sales, and close
              cashbox.
            </p>
          </div>

          <div className='flex flex-col items-stretch space-y-2 sm:flex-row sm:items-center sm:space-x-3 sm:space-y-0'>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRefresh}
                disabled={isLoading}
                className='transform touch-manipulation bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-blue-600 hover:to-blue-700'
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
                <span className='hidden sm:inline'>Refresh</span>
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleExportOrders}
                disabled={isLoading}
                className='transform touch-manipulation bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-green-600 hover:to-green-700'
              >
                <Download className='mr-2 h-4 w-4' />
                <span className='hidden sm:inline'>Export</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20'>
            <div className='flex items-center space-x-2'>
              <AlertCircle className='h-5 w-5 text-red-500' />
              <span className='font-medium text-red-700 dark:text-red-400'>
                Error
              </span>
            </div>
            <p className='mt-1 text-red-600 dark:text-red-300'>{error}</p>
            <Button
              variant='outline'
              size='sm'
              onClick={clearError}
              className='mt-2 border-red-300 text-red-600 hover:bg-red-50'
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-4'
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='orders' className='flex items-center space-x-2'>
              <ShoppingBag className='h-4 w-4' />
              <span>Orders ({ordersCount})</span>
            </TabsTrigger>
            <TabsTrigger
              value='cashbox'
              className='flex items-center space-x-2'
            >
              <DollarSign className='h-4 w-4' />
              <span>Daily Cashbox</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='orders' className='space-y-4'>
            {/* Enhanced Search and Date/Time Filtering */}
            <div className='space-y-4'>
              {/* Search Bar */}
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                <Input
                  placeholder='Search orders by number, table, or customer...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='touch-manipulation pl-10'
                />
              </div>

              {/* Date/Time Range Filter for Shift Management */}
              <div className='rounded-xl border bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 dark:border-gray-700 p-4'>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                  <div className='space-y-2'>
                    <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                      <Calendar className='h-4 w-4' />
                      Start Date & Time
                    </label>
                    <input
                      type='datetime-local'
                      value={dateRange.startDate}
                      onChange={e =>
                        setDateRange(prev => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                    />
                  </div>

                  <div className='space-y-2'>
                    <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                      <Calendar className='h-4 w-4' />
                      End Date & Time
                    </label>
                    <input
                      type='datetime-local'
                      value={dateRange.endDate}
                      onChange={e =>
                        setDateRange(prev => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                    />
                  </div>

                  <div className='flex flex-col justify-end gap-2'>
                    <div className='grid grid-cols-2 gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          const now = new Date();
                          setDateRange({
                            startDate: new Date(now.setHours(0, 0, 0, 0))
                              .toISOString()
                              .slice(0, 16),
                            endDate: new Date(now.setHours(23, 59, 59, 999))
                              .toISOString()
                              .slice(0, 16),
                          });
                        }}
                        className='bg-blue-500 text-white hover:bg-blue-600 border-0'
                      >
                        Today
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          setDateRange({
                            startDate: new Date(yesterday.setHours(0, 0, 0, 0))
                              .toISOString()
                              .slice(0, 16),
                            endDate: new Date(yesterday.setHours(23, 59, 59, 999))
                              .toISOString()
                              .slice(0, 16),
                          });
                        }}
                        className='bg-purple-500 text-white hover:bg-purple-600 border-0'
                      >
                        Yesterday
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-gray-600 dark:border-green-800 dark:bg-green-900/20 dark:text-gray-400'>
                <CheckCircle className='mr-1 inline h-4 w-4 text-green-600' />
                Showing completed orders only • Supports overnight shifts (e.g.,
                shift ending at 2 AM)
              </div>
            </div>

            {/* Orders List */}
            {isLoading ? (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className='animate-pulse rounded-xl border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'
                  >
                    <div className='space-y-3'>
                      <div className='flex justify-between'>
                        <div className='h-6 w-32 rounded bg-gray-200 dark:bg-gray-700'></div>
                        <div className='h-6 w-16 rounded bg-gray-200 dark:bg-gray-700'></div>
                      </div>
                      <div className='h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700'></div>
                      <div className='h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700'></div>
                      <div className='h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700'></div>
                      <div className='h-8 w-full rounded bg-gray-200 dark:bg-gray-700'></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length > 0 ? (
              <>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
                  {orders
                    .filter(order => order.status === OrderStatus.COMPLETED)
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onViewDetails={() => handleViewOrderDetails(order)}
                        showActions={
                          permissions.isManager || permissions.isAdmin
                        }
                      />
                    ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className='flex items-center justify-center space-x-2 pt-4'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPagination(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className='transform bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 disabled:hover:scale-100'
                    >
                      Previous
                    </Button>
                    <span className='rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPagination(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className='transform bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 disabled:hover:scale-100'
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className='py-12 text-center'>
                <ShoppingBag className='mx-auto mb-4 h-12 w-12 text-gray-400' />
                <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
                  No orders found
                </h3>
                <p className='text-gray-600 dark:text-gray-400'>
                  {searchTerm
                    ? 'Try adjusting your search criteria.'
                    : 'No completed orders found.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value='cashbox' className='space-y-4'>
            {/* Date Selector for Cashbox */}
            <div className='flex items-center space-x-4'>
              <Calendar className='h-5 w-5 text-gray-500' />
              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                Select Date:
              </span>
              <input
                type='date'
                value={selectedDate.toISOString().split('T')[0]}
                onChange={e => setSelectedDate(new Date(e.target.value))}
                className='rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
              />
            </div>

            {/* Cashbox Summary */}
            <CashboxSummary
              summary={cashboxSummary}
              date={selectedDate}
              onCloseCashbox={handleCloseCashbox}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Order Details Modal */}
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={showOrderDetails}
          onClose={() => {
            setShowOrderDetails(false);
            setSelectedOrder(null);
          }}
          onUpdateStatus={
            permissions.isManager || permissions.isAdmin
              ? handleUpdateOrderStatus
              : null
          }
          onPrintReceipt={handlePrintReceipt}
          showActions={permissions.isManager || permissions.isAdmin}
        />
      </div>
    </POSLayout>
  );
}

// Memoized export to prevent unnecessary re-renders
export default memo(OrdersPage);
