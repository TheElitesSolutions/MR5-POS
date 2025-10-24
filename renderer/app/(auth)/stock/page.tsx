'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStockStore } from '@/stores/stockStore';
import { useStockFilters } from '@/hooks/useStockFilters';
import {
  useStockItems,
  useStockCategories,
  resetStockDataFetch,
} from '@/hooks/useStockData';
import { AlertTriangle, Package } from 'lucide-react';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import StockHeader from '@/components/stock/StockHeader';
import StockStats from '@/components/stock/StockStats';
import StockFilters from '@/components/stock/StockFilters';
import StockTableView from '@/components/stock/StockTableView';
import StockItemForm from '@/components/stock/StockItemForm';
import CategoryManagement from '@/components/stock/CategoryManagement';
import POSLayout from '@/components/pos/POSLayout';

// Simplified category overview component
const CategoryOverview = memo(
  ({
    categoryStats,
    onCategoryClick,
  }: {
    categoryStats: { name: string; count: number; value: number }[];
    onCategoryClick: (category: string) => void;
  }) => {
    return (
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
        {categoryStats.map(({ name, count, value }) => (
          <div
            key={name}
            onClick={() => onCategoryClick(name)}
            className='flex cursor-pointer items-center justify-between rounded-lg border bg-white p-3 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'
          >
            <div className='flex items-center gap-3'>
              <Package className='h-4 w-4 text-gray-400' />
              <div>
                <span className='font-medium text-gray-900 dark:text-white'>
                  {name}
                </span>
                <Badge variant='outline' className='ml-2'>
                  {count} items
                </Badge>
              </div>
            </div>
            <div className='text-sm font-medium text-gray-900 dark:text-gray-200'>
              ${value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    );
  }
);

CategoryOverview.displayName = 'CategoryOverview';

export default function StockManagementPage() {
  // Reset the global fetch ref to ensure fresh data loading
  resetStockDataFetch();

  // Direct store hooks instead of context
  const { adjustStockQuantity, deleteStockItem, updateStockItem } =
    useStockStore();

  // Use data hooks directly
  const { stockItems: rawStockItems, error: stockError, clearError, refresh: refreshStockItems } = useStockItems();

  // Filter out system-generated category placeholder items
  const stockItems = useMemo(() => {
    return (rawStockItems || []).filter(item => {
      // Hide placeholder items created for categories
      const isPlaceholder = 
        item.supplier === 'System-Generated Category' ||
        (item.itemName || item.name || '').includes('Category Placeholder');
      return !isPlaceholder;
    });
  }, [rawStockItems]);

  // Debug logging
  useEffect(() => {
    console.log('Stock page - stockItems:', stockItems);
    console.log('Stock page - stockError:', stockError);
    console.log('Stock page - stockItems length:', stockItems?.length || 0);
  }, [stockItems, stockError]);
  const { categories: categoryList, error: categoryError } =
    useStockCategories();

  // Use filtering hook
  const {
    filters,
    filteredItems,
    updateFilter,
    resetFilters,
    lowStockCount,
    categoryStats,
  } = useStockFilters(stockItems || []);

  // UI state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'low-stock'>('all');

  // Get low stock items (already filtered via stockItems, but being explicit)
  const lowStockItems = (stockItems || []).filter(
    item => {
      const isLowStock = (item.currentQuantity ?? item.currentStock) <= (item.minimumQuantity ?? item.minimumStock);
      // stockItems is already filtered to exclude placeholders from the useMemo above
      return isLowStock;
    }
  );

  // Get unique categories for filters
  const categories = categoryList || [];

  // Handlers
  const handleAddItem = useCallback(() => {
    setEditingItem(null);
    setShowAddDialog(true);
  }, []);

  const handleEditItem = useCallback((itemId: string) => {
    setEditingItem(itemId);
    setShowAddDialog(true);
  }, []);

  const handleCloseAddDialog = useCallback(async () => {
    setShowAddDialog(false);
    setEditingItem(null);
    // Refresh the main page's stock items list
    await refreshStockItems();
  }, [refreshStockItems]);

  const handleCategoryClick = useCallback(
    (categoryName: string) => {
      updateFilter('categoryFilter', categoryName);
    },
    [updateFilter]
  );

  const handleQuickAdjust = useCallback(
    async (itemId: string, amount: number, type: string) => {
      try {
        await adjustStockQuantity(itemId, {
          quantity: amount,
          type: type as 'add' | 'remove',
        });
        // Refresh the list after adjustment
        await refreshStockItems();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to adjust stock:', error);
        }
      }
    },
    [adjustStockQuantity, refreshStockItems]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        await deleteStockItem(itemId);
        // Refresh the list after deletion
        await refreshStockItems();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to delete stock item:', error);
        }
      }
    },
    [deleteStockItem, refreshStockItems]
  );

  const handleQuickEdit = useCallback(
    async (itemId: string, field: string, value: any) => {
      try {
        const item = (stockItems || []).find(item => item.id === itemId);
        if (!item) return;

        const updates = { ...item, [field]: value };
        await updateStockItem(itemId, updates);
        // Refresh the list after update
        await refreshStockItems();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`Failed to update ${field}:`, error);
        }
      }
    },
    [stockItems, updateStockItem, refreshStockItems]
  );

  // Show service layer errors
  useEffect(() => {
    if (stockError && process.env.NODE_ENV === 'development') {
      console.error('Stock error:', stockError);
    }

    if (categoryError && process.env.NODE_ENV === 'development') {
      console.error('Category error:', categoryError);
    }
  }, [stockError, categoryError]);

  // Get items to display based on active tab
  const displayItems =
    activeTab === 'low-stock' ? lowStockItems : filteredItems;

  return (
    <POSLayout>
      <div className='h-full space-y-4 overflow-y-auto p-6'>
        {/* Header Section */}
        <div className='border-b pb-4 space-y-4'>
          {/* Header */}
          <StockHeader
            onAddItem={handleAddItem}
            onManageCategories={() => setShowCategoryManagement(true)}
          />

          {/* Error Display */}
          {stockError && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
              <div className='flex items-center justify-between'>
                <p className='text-red-800 dark:text-red-200'>{stockError}</p>
                <Button variant='ghost' size='sm' onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Compact Stats */}
          <StockStats stockItems={stockItems || []} />

          {/* Filters */}
          <StockFilters
            filters={filters}
            categories={categories}
            onUpdateFilter={updateFilter}
            onResetFilters={resetFilters}
            resultCount={filteredItems.length}
          />
        </div>

        {/* Content Area */}
        <div className='space-y-4'>
            {/* Category Overview - Only show when viewing all items and no specific category filter */}
            {filters.categoryFilter === 'all' && activeTab === 'all' && (
              <CategoryOverview
                categoryStats={categoryStats.map(stat => ({
                  name: stat.name,
                  count: stat.totalItems,
                  value: stat.totalValue,
                }))}
                onCategoryClick={handleCategoryClick}
              />
            )}

            {/* Main Content Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={value => setActiveTab(value as any)}
              className='space-y-4'
            >
              <div className='flex items-center justify-between'>
                <TabsList className='grid w-fit grid-cols-2'>
                  <TabsTrigger
                    value='all'
                    className='flex items-center space-x-2'
                  >
                    <Package className='h-4 w-4' />
                    <span>All Items ({filteredItems.length})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='low-stock'
                    className='flex items-center space-x-2 text-red-600'
                  >
                    <AlertTriangle className='h-4 w-4' />
                    <span>Low Stock ({lowStockItems.length})</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value='all'>
                <StockTableView
                  items={displayItems}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onQuickAdjust={handleQuickAdjust}
                  onQuickEdit={handleQuickEdit}
                  isAdjusting={false}
                />
              </TabsContent>

              <TabsContent value='low-stock'>
                {lowStockItems.length > 0 ? (
                  <div className='space-y-4'>
                    <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
                      <div className='flex items-center space-x-2'>
                        <AlertTriangle className='h-5 w-5 text-red-600' />
                        <p className='font-medium text-red-800 dark:text-red-200'>
                          {lowStockCount} item{lowStockCount !== 1 ? 's' : ''}{' '}
                          running low on stock - consider restocking soon
                        </p>
                      </div>
                    </div>

                    <StockTableView
                      items={lowStockItems}
                      onEdit={handleEditItem}
                      onDelete={handleDeleteItem}
                      onQuickAdjust={handleQuickAdjust}
                      onQuickEdit={handleQuickEdit}
                      isAdjusting={false}
                    />
                  </div>
                ) : (
                  <div className='py-12 text-center'>
                    <Package className='mx-auto mb-4 h-12 w-12 text-green-400' />
                    <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
                      All stock levels are healthy!
                    </h3>
                    <p className='text-gray-600 dark:text-gray-400'>
                      No items are currently running low on stock. Stock levels
                      are automatically updated through POS transactions.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className='max-h-[90dvh] max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Stock Item' : 'Add New Stock Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the details of the selected stock item below.'
                : 'Fill in the details to add a new item to your inventory.'}
            </DialogDescription>
          </DialogHeader>
          <StockItemForm 
            key={editingItem || 'new'} 
            itemId={editingItem} 
            onClose={handleCloseAddDialog} 
          />
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <CategoryManagement
        isOpen={showCategoryManagement}
        onClose={() => setShowCategoryManagement(false)}
        onCategoryUpdated={refreshStockItems}
      />
    </POSLayout>
  );
}
