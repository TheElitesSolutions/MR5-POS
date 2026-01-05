'use client';

import CategoryManagement from '@/components/menu/CategoryManagement';
import MenuItemCard from '@/components/menu/MenuItemCard';
import MenuItemForm from '@/components/menu/MenuItemForm';
import AddonsManager from '@/components/menu/AddonsManager';
import POSLayout from '@/components/pos/POSLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { useMenuStore } from '@/stores/menuStore';
import { getMenuService } from '@/services/ServiceContainer';
import { cache } from '@/utils/cacheUtils';
import { UIMenuItem } from '@/types/menu';
import {
  AlertCircle,
  Grid3X3,
  List,
  Package,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { menuLogger } from '@/utils/logger';

export default function MenuManagementPage() {
  // Clear any stale menu cache on page load
  React.useEffect(() => {
    // Clear the menu store cache to ensure fresh data
    if (typeof window !== 'undefined') {
      console.log('MenuManagementPage: Clearing stale menu cache');
      // Clear all menu-related cache entries with prefix to be more targeted
      const removedStoreEntries = cache.removeByPrefix('menuItems');
      const removedGeneralEntries = cache.removeByPrefix('menu');
      console.log(
        `MenuManagementPage: Cleared ${removedStoreEntries} store entries and ${removedGeneralEntries} general entries`
      );

      // Clear service layer cache
      const menuService = getMenuService();
      menuService.refreshMenuData();
      console.log('MenuManagementPage: Service cache cleared');
    }
  }, []);

  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const permissions = useUserPermissions();
  const {
    menuItems,
    categories,
    isLoading,
    error,
    clearError,
    pagination,
    setPage,
    setSearch,
    setCategory: setPaginationCategory,
    clearSearch,
    _internalFetchCategories,
    _internalFetchMenuItems,
  } = useMenuStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'items' | 'addons'>(
    'categories'
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const hasInitialized = useRef(false);

  // Use menuItems directly from store (already in correct format)
  const rendererMenuItems: UIMenuItem[] = menuItems || [];

  // Debug logging for menu data
  useEffect(() => {
    console.log('Menu page - menuItems:', menuItems);
    console.log('Menu page - categories:', categories);
    console.log('Menu page - error:', error);
    console.log('Menu page - isLoading:', isLoading);
  }, [menuItems, categories, error, isLoading]);

  useEffect(() => {
    // Check permissions and redirect if necessary
    if (isAuthenticated && !(permissions.isManager || permissions.isAdmin)) {
      router.push('/pos');
      return;
    }

    // Load initial data only once
    if (
      isAuthenticated &&
      (permissions.isManager || permissions.isAdmin) &&
      !hasInitialized.current
    ) {
      hasInitialized.current = true;

      // Force clear cache one more time before fetching to ensure absolutely fresh data
      console.log('MenuManagementPage: Final cache clear before fetch');
      const removedBeforeFetch = cache.removeByPrefix('menuItems');
      console.log(
        `MenuManagementPage: Cleared ${removedBeforeFetch} entries before fetch`
      );

      // Force fresh fetch by calling internal methods directly
      console.log('MenuManagementPage: Force refreshing menu data');
      _internalFetchMenuItems({
        page: 1,
        pageSize: 12,
        search: '',
        category: '',
      });
      _internalFetchCategories();
    }
  }, [
    isAuthenticated,
    permissions.isManager,
    permissions.isAdmin,
    router,
    _internalFetchCategories,
    _internalFetchMenuItems,
    // setPage is stable from Zustand store, no need to include in deps
  ]);

  if (!isAuthenticated || !user) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>Loading menu...</p>
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
            You don&apos;t have permission to manage the menu. Contact your
            manager for access.
          </p>
          <Button onClick={() => router.push('/pos')} variant='outline'>
            Return to POS
          </Button>
        </div>
      </div>
    );
  }

  // FIX: Don't filter on client side - store already handles category filtering via backend
  // The store's setPaginationCategory triggers a backend query with category filter
  // Double-filtering was causing only 2-3 items to show per page from paginated results
  const filteredMenuItems = rendererMenuItems || [];

  // Debug: Menu items filtering by category
  menuLogger.debug('Menu page filtering', {
    totalItems: rendererMenuItems?.length || 0,
    selectedCategory,
    paginationCategory: pagination.category,
    filteredCount: filteredMenuItems?.length || 0,
    allCategories: rendererMenuItems?.map(item => ({
      name: item.name,
      category: item.category,
      categoryId: item.categoryId,
    })),
  });

  const handleAddItem = () => {
    setEditingItem(null);
    setShowAddDialog(true);
  };

  const handleSyncToWebsite = async () => {
    if (!window.electronAPI?.ipc || isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const response = await window.electronAPI.ipc.invoke('mr5pos:sync:manual');
      if (response.success) {
        const { categoriesSynced, itemsSynced, addOnsSynced } = response.data;
        alert(`✅ Sync successful!\n${categoriesSynced} categories, ${itemsSynced} items, ${addOnsSynced} add-ons synced to website.`);
      } else {
        alert(`❌ Sync failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Sync error: ${error.message || 'Unknown error'}`);
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditItem = (itemId: string) => {
    setEditingItem(itemId);
    setShowAddDialog(true);
  };

  const handleCloseDialog = async () => {
    setShowAddDialog(false);
    setEditingItem(null);
    
    // Refresh menu items after dialog closes to show newly created/updated items
    console.log('🔄 Refreshing menu items after dialog close');
    await _internalFetchMenuItems();
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);

    // FIX: Send categoryId instead of category name for optimal backend filtering
    // Backend can filter by ID directly (indexed, faster) without looking up name
    const category = categories.find((c: any) => c.name === categoryName);

    if (category && (category as any).id) {
      setPaginationCategory((category as any).id); // Send category ID for backend filter
    } else {
      // Fallback to name if category object not found
      setPaginationCategory(categoryName);
    }

    setViewMode('items');
  };

  return (
    <POSLayout>
      <div className='h-full space-y-6 overflow-y-auto p-6'>
        {/* Header */}
        <div className='border-b pb-4'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h1 className='text-lg font-bold text-gray-900 dark:text-white'>
                Menu Management
              </h1>
              <p className='text-xs text-gray-600 dark:text-gray-400'>
                Organize your menu by categories and track ingredient costs for
                profit optimization.
              </p>
            </div>

            <div className='flex flex-col items-stretch space-y-3 sm:flex-row sm:items-center sm:space-x-3 sm:space-y-0'>
              {/* View Mode Toggle - Mobile Friendly */}
              <div className='flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800'>
                <Button
                  variant={viewMode === 'categories' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => {
                    setViewMode('categories');
                    setSelectedCategory('');
                    setPaginationCategory(''); // Clear category filter
                  }}
                  className='h-8 flex-1 touch-manipulation sm:flex-none'
                >
                  <Grid3X3 className='mr-1 h-4 w-4' />
                  <span className='text-xs sm:text-sm'>Categories</span>
                </Button>
                <Button
                  variant={viewMode === 'items' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => {
                    setViewMode('items');
                    setSelectedCategory(''); // Clear category selection to show all items
                    setPaginationCategory(''); // Clear category filter
                  }}
                  className='h-8 flex-1 touch-manipulation sm:flex-none'
                >
                  <List className='mr-1 h-4 w-4' />
                  <span className='text-xs sm:text-sm'>All Items</span>
                </Button>
                <Button
                  variant={viewMode === 'addons' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => {
                    setViewMode('addons');
                    setSelectedCategory(''); // Clear category selection
                    setPaginationCategory(''); // Clear category filter
                  }}
                  className='h-8 flex-1 touch-manipulation sm:flex-none'
                >
                  <Package className='mr-1 h-4 w-4' />
                  <span className='text-xs sm:text-sm'>Add-ons</span>
                </Button>
              </div>

              <Button
                onClick={handleSyncToWebsite}
                disabled={isSyncing}
                variant='outline'
                className='flex touch-manipulation items-center space-x-2'
                size='sm'
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className='hidden sm:inline'>{isSyncing ? 'Syncing...' : 'Sync to Website'}</span>
                <span className='sm:hidden'>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </Button>

              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => handleAddItem()}
                    className='flex touch-manipulation items-center space-x-2'
                    size='sm'
                  >
                    <Plus className='h-4 w-4' />
                    <span className='hidden sm:inline'>Add Menu Item</span>
                    <span className='sm:hidden'>Add Item</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className='mx-4 max-h-[80vh] max-w-4xl overflow-hidden flex flex-col'>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className='flex-1 overflow-y-auto px-1'>
                    <MenuItemForm
                      key={`${showAddDialog}-${editingItem || 'new'}`}
                      itemId={editingItem}
                      onClose={handleCloseDialog}
                      defaultCategory={selectedCategory || undefined}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filters - Mobile Responsive */}
          <div className='space-y-3 sm:flex sm:items-center sm:space-x-4 sm:space-y-0'>
            <div className='flex flex-1 items-center space-x-2'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                <Input
                  placeholder='Search menu items...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='touch-manipulation pl-10'
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setSearch(searchTerm);
                    }
                  }}
                />
              </div>
              <div className='flex space-x-1'>
                <Button
                  size='sm'
                  onClick={() => setSearch(searchTerm)}
                  className='whitespace-nowrap'
                >
                  Search
                </Button>
                {pagination.search && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      clearSearch();
                      setSearchTerm('');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {viewMode === 'items' && (
              <div className='flex flex-wrap items-center gap-2'>
                <span className='whitespace-nowrap text-sm text-gray-600 dark:text-gray-400'>
                  Category:
                </span>
                <Button
                  key='all-categories'
                  size='sm'
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedCategory('');
                    setPaginationCategory('');
                  }}
                  className='touch-manipulation'
                >
                  All Categories
                </Button>
                {(categories || [])
                  .filter((category: any) => category && typeof category === 'object' && category.name && category.name.trim() !== '')
                  .map((category: any) => (
                    <Button
                      key={category.id}
                      size='sm'
                      variant={selectedCategory === category.name ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedCategory(category.name);
                        if (category.id) {
                          setPaginationCategory(category.id);
                        } else {
                          setPaginationCategory(category.name);
                        }
                      }}
                      className='touch-manipulation flex items-center gap-1.5'
                      style={
                        category.color && selectedCategory === category.name
                          ? {
                              backgroundColor: category.color,
                              borderColor: category.color,
                              color: '#ffffff',
                            }
                          : category.color
                          ? {
                              borderColor: category.color,
                            }
                          : undefined
                      }
                    >
                      {category.color && (
                        <div
                          className='h-2.5 w-2.5 rounded-full flex-shrink-0'
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-3'>
                  <AlertCircle className='h-5 w-5 text-red-500' />
                  <span className='font-medium text-red-700 dark:text-red-400'>
                    Error loading data
                  </span>
                </div>
                <div className='flex space-x-3'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      clearError();
                      // Properly refetch data from store instead of page reload
                      setPage(1);
                    }}
                  >
                    Retry
                  </Button>
                  <Button variant='ghost' size='sm' onClick={clearError}>
                    Dismiss
                  </Button>
                </div>
              </div>
              <p className='mt-3 text-red-600 dark:text-red-300'>{error}</p>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className='space-y-4'>
            {/* Loading State */}
            {isLoading ? (
              <div className='flex flex-col items-center justify-center py-20'>
                <div className='mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-600'></div>
                <p className='text-gray-600 dark:text-gray-400'>
                  Loading menu data...
                </p>
              </div>
            ) : viewMode === 'categories' ? (
              /* Categories View - Enhanced Mobile Grid */
              <CategoryManagement
                categories={categories}
                menuItems={rendererMenuItems}
                onCategorySelect={handleCategorySelect}
                onCategoryUpdated={_internalFetchCategories}
              />
            ) : viewMode === 'addons' ? (
              /* Add-ons Management View */
              <AddonsManager />
            ) : (
              /* Items View - Enhanced Mobile Grid */
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center space-x-2'>
                    <List className='h-5 w-5 text-blue-600' />
                    <h2 className='text-lg font-semibold text-gray-900 dark:text-white sm:text-xl'>
                      {selectedCategory
                        ? `${selectedCategory} Items`
                        : 'All Menu Items'}
                    </h2>
                    <Badge variant='outline' className='text-xs'>
                      {filteredMenuItems.length}{' '}
                      {filteredMenuItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>

                  {selectedCategory && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        setSelectedCategory('');
                        setPaginationCategory(''); // Clear category filter
                        setViewMode('categories');
                      }}
                      className='touch-manipulation'
                    >
                      ← Back to Categories
                    </Button>
                  )}
                </div>

                {filteredMenuItems.length === 0 ? (
                  <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 dark:border-gray-700 dark:bg-gray-800/50'>
                    <Package className='mb-3 h-10 w-10 text-gray-400' />
                    <h3 className='mb-1 text-lg font-medium text-gray-900 dark:text-white'>
                      No menu items found
                    </h3>
                    <p className='mb-4 text-center text-gray-600 dark:text-gray-400'>
                      {searchTerm
                        ? `No items match your search "${searchTerm}"`
                        : selectedCategory
                          ? `No items in the "${selectedCategory}" category`
                          : 'No menu items available'}
                    </p>
                    <div className='flex space-x-3'>
                      {searchTerm && (
                        <Button
                          variant='outline'
                          onClick={() => setSearchTerm('')}
                        >
                          Clear Search
                        </Button>
                      )}
                      <Button onClick={handleAddItem}>
                        <Plus className='mr-2 h-4 w-4' />
                        Add Item
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4'>
                      {filteredMenuItems.map(item => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          onEdit={() => handleEditItem(item.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination UI */}
                    {filteredMenuItems.length > 0 && (
                      <div className='mt-6'>
                        <Pagination
                          totalItems={pagination.totalItems}
                          currentPage={pagination.page}
                          pageSize={pagination.pageSize}
                          onPageChange={setPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Loading state is already handled above */}
        </div>
      </div>
    </POSLayout>
  );
}
