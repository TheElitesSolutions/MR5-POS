'use client';

import MenuFlow from '@/components/pos/MenuFlow';
import OrderPanel from '@/components/pos/OrderPanel';
import TakeoutOrderPanel from '@/components/pos/TakeoutOrderPanel';
import POSLayout from '@/components/pos/POSLayout';
import TableGrid from '@/components/pos/TableGrid';
import TakeoutOrderGrid from '@/components/pos/TakeoutOrderGrid';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuthStore } from '@/stores/authStore';
import { usePOSStore } from '@/stores/posStore';
import { MenuItem } from '@/types';
import {
  ArrowLeft,
  ShoppingCart,
  UtensilsCrossed,
  ShoppingBag,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StockDataProvider } from '@/context/StockDataContext';
import { getMenuService } from '@/services/ServiceContainer';
import { posLogger } from '@/utils/logger';

interface CustomizationData {
  selectedItem: MenuItem;
  itemQuantity: number;
  ingredientAdjustments: Record<string, boolean>;
  specialNotes: string;
  addonSelections: any[]; // ✅ CRITICAL FIX: Add addon selections to interface
}

export default function POSPage() {
  // Clear any stale menu cache on POS page load to ensure fresh data
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear menu cache for fresh data loading
      const menuService = getMenuService();
      menuService.refreshMenuData();
    }
  }, []);

  const { isAuthenticated, user } = useAuthStore();
  const {
    fetchTables,
    selectedTable,
    currentOrder,
    viewMode,
    switchToTables,
    setOrderType,
    isDineIn,
    orderType, // Add orderType to track direct state
    tableTab,
    setTableTab,
  } = usePOSStore();

  const [mobileOrderPanelOpen, setMobileOrderPanelOpen] = useState(false);
  const [pendingCustomization, setPendingCustomization] =
    useState<CustomizationData | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize POS data using useRef to prevent duplicate calls
  const hasInitializedRef = useRef(false);

  // Initialize POS data (tables only - menu data handled by service layer)
  const initializePOSData = useCallback(async () => {
    // Use a ref to prevent duplicate calls from dependencies changing
    if (
      !isAuthenticated ||
      !user ||
      hasInitialized ||
      hasInitializedRef.current
    )
      return;

    // Mark as initialized immediately to prevent duplicate calls
    hasInitializedRef.current = true;

    try {
      // initialization start
      setInitError(null);

      // Only fetch tables - menu items and categories are automatically loaded by service layer
      await fetchTables();

      setHasInitialized(true);
      // initialization complete
    } catch (error) {
      // failed to initialize POS data
      setInitError('Failed to load POS data. Please refresh the page.');
    }
  }, [isAuthenticated, user, hasInitialized]); // Removed fetchTables from dependencies

  // Initialize POS data when authentication is ready
  useEffect(() => {
    initializePOSData();
  }, [initializePOSData]);

  // Memoize the mobile panel auto-open logic
  useEffect(() => {
    if (selectedTable && window.innerWidth < 1024) {
      setMobileOrderPanelOpen(true);
    }
  }, [selectedTable]);

  // Memoize the item added handler
  const handleItemAdded = useCallback(
    (customizationData: CustomizationData) => {
      setPendingCustomization(customizationData);
    },
    []
  );

  // Optimize customization clearing with useCallback
  const clearPendingCustomization = useCallback(() => {
    setPendingCustomization(null);
  }, []);

  // ✅ FIX: Use callback-based clearing instead of timeout
  // The TakeoutOrderPanel will call clearPendingCustomization after processing completes
  // This eliminates the timing window that caused duplicate items

  // Memoize order item count to prevent recalculation
  const orderItemCount = useMemo(() => {
    return currentOrder?.items?.length || 0;
  }, [currentOrder?.items?.length]);

  // Memoize the mobile sheet trigger button
  const mobileSheetTrigger = useMemo(
    () => (
      <Button
        variant={selectedTable ? 'default' : 'outline'}
        size='sm'
        className='relative'
        disabled={!selectedTable}
      >
        <ShoppingCart className='mr-2 h-4 w-4' />
        <span className='hidden sm:inline'>Order</span>
        {orderItemCount > 0 && (
          <span className='absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
            {orderItemCount}
          </span>
        )}
      </Button>
    ),
    [selectedTable, orderItemCount]
  );

  // Memoize the floating action button
  const floatingActionButton = useMemo(
    () => (
      <Button size='lg' className='relative rounded-full shadow-lg'>
        <ShoppingCart className='h-5 w-5' />
        {orderItemCount > 0 && (
          <span className='absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
            {orderItemCount}
          </span>
        )}
      </Button>
    ),
    [orderItemCount]
  );

  // Show loading screen if not authenticated or still initializing
  if (!isAuthenticated || !user) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>
            Loading The Elites POS...
          </p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (initError) {
    return (
      <POSLayout>
        <div className='mx-auto max-w-7xl p-6'>
          <div className='py-12 text-center'>
            <div className='mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6'>
              <h3 className='mb-2 text-lg font-semibold text-red-800'>
                POS Loading Error
              </h3>
              <p className='mb-4 text-red-600'>{initError}</p>
              <Button
                onClick={() => {
                  setInitError(null);
                  setHasInitialized(false);
                  initializePOSData();
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </POSLayout>
    );
  }

  // Show loading while initializing
  if (!hasInitialized) {
    return (
      <POSLayout>
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='text-center'>
            <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
            <p className='text-gray-600 dark:text-gray-400'>
              Initializing POS system...
            </p>
          </div>
        </div>
      </POSLayout>
    );
  }

  return (
    <StockDataProvider>
      <POSLayout>
        <div className='flex h-full flex-col overflow-hidden'>
          {/* Order Type Selector */}
          <div className='border-b border-gray-200 p-4 dark:border-gray-700'>
            <SegmentedControl
              options={[
                {
                  value: 'DINE_IN',
                  label: 'Dine In',
                  icon: <UtensilsCrossed />,
                },
                {
                  value: 'NOT_PAID',
                  label: 'Not Paid',
                  icon: <UtensilsCrossed />,
                },
                {
                  value: 'TAKEOUT',
                  label: 'Takeout/Delivery',
                  icon: <ShoppingBag />,
                },
              ]}
              value={orderType === 'TAKEOUT' ? 'TAKEOUT' : tableTab}
              onValueChange={value => {
                if (value === 'TAKEOUT') {
                  setOrderType('TAKEOUT');
                } else {
                  setOrderType('DINE_IN');
                  setTableTab(value as 'DINE_IN' | 'NOT_PAID');
                }
              }}
              fullWidth
            />
          </div>

          <div className='flex flex-1 overflow-hidden'>
            {/* Main panel - Tables or Menu Flow based on viewMode */}
            <div className='flex flex-1 flex-col overflow-hidden lg:flex-1'>
              {(() => {
                const isCurrentlyDineIn = orderType === 'DINE_IN'; // Use direct state value instead of function

                if (viewMode === 'tables' && isCurrentlyDineIn) {
                  const tabTitle = tableTab === 'NOT_PAID' ? 'Not Paid Tables' : 'Restaurant Tables';
                  const tabDescription = tableTab === 'NOT_PAID'
                    ? 'Tables with pay later orders'
                    : 'Select a table to start taking orders';

                  return (
                    <div className='flex h-full flex-col overflow-hidden'>
                      <div className='flex-none p-3 sm:p-4 lg:p-6 pb-0'>
                      <div className='mb-4 lg:mb-6'>
                        <div className='flex items-center justify-between'>
                          <div>
                            <h2 className='text-lg font-semibold text-gray-900 dark:text-white sm:text-xl lg:text-2xl'>
                              {tabTitle}
                            </h2>
                            <p className='text-sm text-gray-600 dark:text-gray-400 sm:text-base'>
                              {tabDescription}
                            </p>
                          </div>

                          {/* Mobile order panel trigger */}
                          <div className='lg:hidden'>
                            <Sheet
                              open={mobileOrderPanelOpen}
                              onOpenChange={setMobileOrderPanelOpen}
                            >
                              <SheetTrigger asChild>
                                {mobileSheetTrigger}
                              </SheetTrigger>
                              <SheetContent
                                side='right'
                                className='w-full p-0 sm:w-80 md:w-96'
                              >
                                <OrderPanel
                                  pendingCustomization={pendingCustomization}
                                />
                              </SheetContent>
                            </Sheet>
                          </div>
                        </div>
                      </div>

                      </div>
                      {/* Table Grid */}
                      <div className='flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pt-0'>
                        <TableGrid />
                      </div>
                    </div>
                  );
                } else if (viewMode === 'tables' && !isCurrentlyDineIn) {
                  return (
                    <div className='flex h-full flex-col overflow-hidden'>
                      <div className='flex-none p-3 sm:p-4 lg:p-6 pb-0'>
                      <div className='mb-4 lg:mb-6'>
                        <div className='flex items-center justify-between'>
                          <div>
                            <h2 className='text-lg font-semibold text-gray-900 dark:text-white sm:text-xl lg:text-2xl'>
                              {orderType === 'TAKEOUT'
                                ? 'Takeout/Delivery'
                                : 'Orders'}
                            </h2>
                            <p className='text-sm text-gray-600 dark:text-gray-400 sm:text-base'>
                              Manage your {orderType.toLowerCase()} orders
                            </p>
                          </div>
                        </div>
                      </div>
                      </div>
                      <div className='flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pt-0'>
                        <TakeoutOrderGrid />
                      </div>
                    </div>
                  );
                } else {
                  return (
                    /* Menu Flow View */
                    <div className='flex h-full flex-col overflow-hidden'>
                      {/* Back button for menu flow */}
                      <div className='flex-none border-b border-gray-200 p-4 dark:border-gray-700'>
                        <Button
                          variant='outline'
                          onClick={switchToTables}
                          className='mb-2'
                        >
                          <ArrowLeft className='mr-2 h-4 w-4' />
                          Back to Tables
                        </Button>
                      </div>
                      <div className='flex-1 overflow-y-auto'>
                        <MenuFlow onItemAdded={handleItemAdded} />
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Right panel - Order details (desktop only) */}
            {orderType === 'DINE_IN' ? (
              <div className='hidden w-[24rem] border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:block xl:w-[28rem]'>
                <OrderPanel
                  pendingCustomization={pendingCustomization}
                  onCustomizationProcessed={clearPendingCustomization}
                />
              </div>
            ) : (
              <div className='hidden w-[24rem] border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:block xl:w-[28rem]'>
                <TakeoutOrderPanel
                  pendingCustomization={pendingCustomization}
                  onCustomizationProcessed={clearPendingCustomization}
                />
              </div>
            )}
          </div>

          {/* Mobile floating action button for quick access */}
          {((selectedTable && orderType === 'DINE_IN') ||
            (orderType !== 'DINE_IN' && currentOrder)) &&
            viewMode === 'tables' && (
              <div className='fixed bottom-6 right-6 z-40 lg:hidden'>
                <Sheet
                  open={mobileOrderPanelOpen}
                  onOpenChange={setMobileOrderPanelOpen}
                >
                  <SheetTrigger asChild>{floatingActionButton}</SheetTrigger>
                  <SheetContent
                    side='right'
                    className='w-full p-0 sm:w-80 md:w-96'
                  >
                    {orderType === 'DINE_IN' ? (
                      <OrderPanel
                        pendingCustomization={pendingCustomization}
                        onCustomizationProcessed={clearPendingCustomization}
                      />
                    ) : (
                      <TakeoutOrderPanel
                        pendingCustomization={pendingCustomization}
                        onCustomizationProcessed={clearPendingCustomization}
                      />
                    )}
                  </SheetContent>
                </Sheet>
              </div>
            )}

        </div>
      </POSLayout>
    </StockDataProvider>
  );
}
