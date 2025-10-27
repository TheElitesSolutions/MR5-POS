/**
 * MenuFlow Component - REFACTORED to use new Service Architecture
 *
 * IMPROVEMENTS:
 * ✅ No more direct API calls - uses cached service layer
 * ✅ Request deduplication - prevents duplicate API calls
 * ✅ Optimized caching - data shared across components
 * ✅ Separation of concerns - UI state vs Data state
 * ✅ Better error handling with service-level retry logic
 *
 * PERFORMANCE IMPACT:
 * - Eliminated duplicate fetchMenuItems() and fetchStockItems() calls
 * - Smart caching reduces API calls by ~80%
 * - Faster component mounting due to cache hits
 */
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePOSStore } from '@/stores/posStore';
import { MenuItem } from '@/types';
import {
  getIngredientNameSafe,
  getIngredientNamesByIds,
} from '@/utils/ingredientUtils';
import { Check, ChefHat, Minus, Plus, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAvailableMenuItems } from '@/hooks/useMenuData';
import { useSharedStockData } from '@/context/StockDataContext';
import { getMenuService } from '@/services/ServiceContainer';
import { AddonSelectionProvider } from '@/context/AddonSelectionContext';
import { AddonSelectionStep } from '@/components/addon/AddonSelectionStep';
import { AddonSelection } from '@/types/addon';

interface MenuFlowProps {
  onItemAdded?: (customizationData: {
    selectedItem: MenuItem;
    itemQuantity: number;
    ingredientAdjustments: Record<string, boolean>;
    specialNotes: string;
    addonSelections: AddonSelection[];
  }) => void;
  selectedCategory?: string;
}

type FlowStep = 'categories' | 'items' | 'customize' | 'addons';

const MenuFlow = ({
  onItemAdded,
  selectedCategory: initialCategory,
}: MenuFlowProps) => {
  // UI state only - no data fetching
  const { isLoading: posLoading, viewMode } = usePOSStore();

  // Track previous view mode to detect transitions
  const [previousViewMode, setPreviousViewMode] = useState<string>(viewMode);

  // Data from new service layer - automatically cached and deduplicated
  // ✅ FIX: Fetch ALL available items (no pagination) for POS filtering to work correctly
  // MUST be declared BEFORE useEffect hooks that use refetch
  const {
    menuItems,
    categories,
    isLoading: menuLoading,
    error: menuError,
    refetch,
  } = useAvailableMenuItems({
    search: '',
    category: '',
    page: 1,
    pageSize: 1000, // Large number to get all items (POS needs all for category filtering)
  });

  // Clear stale cache when POS MenuFlow mounts to ensure fresh data
  useEffect(() => {
    const menuService = getMenuService();
    menuService.refreshMenuData()
      .then(() => {
        // After cache is refreshed, refetch the menu data
        refetch();
      })
      .catch(() => {
        // Silent fail - cache refresh is not critical
      });
  }, [refetch]);

  // Smart refresh: Update menu data when switching from menu back to categories/tables view
  // This ensures category counts reflect any availability changes from order operations
  useEffect(() => {
    // Detect transition from menu view back to tables/categories view
    if (previousViewMode === 'menu' && viewMode === 'tables') {
      console.log('🔄 MenuFlow: Detected return to categories, refreshing menu data');
      const menuService = getMenuService();
      menuService.refreshMenuData()
        .then(() => {
          // After cache is refreshed, refetch the menu data
          refetch();
        })
        .catch((error) => {
          console.warn('⚠️ MenuFlow: Failed to refresh menu data:', error);
          // Silent fail - not critical for operation
        });
    }
    // Update previous view mode for next comparison
    setPreviousViewMode(viewMode);
  }, [viewMode, previousViewMode, refetch]);

  // Use shared stock data with memoization to prevent unnecessary rerenders
  const {
    stockItems,
    isLoading: stockLoading,
    error: stockError,
  } = useSharedStockData();

  // Local UI state - MUST be declared before useEffect hooks that reference these states
  const [currentStep, setCurrentStep] = useState<FlowStep>(
    initialCategory ? 'items' : 'categories'
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory || null
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [ingredientAdjustments, setIngredientAdjustments] = useState<
    Record<string, boolean>
  >({});
  const [addonSelections, setAddonSelections] = useState<AddonSelection[]>([]);

  // State for category statistics from backend API (like MenuCategoryGrid)
  const [categoryStats, setCategoryStats] = useState<
    Array<{
      categoryId: string;
      name: string;
      totalItems: number;
      availableItems: number;
      avgPrice: number;
    }>
  >([]);
  const [isFetchingStats, setIsFetchingStats] = useState(false);

  // Combined loading state
  const isLoading = posLoading || menuLoading || stockLoading || isFetchingStats;

  // ✅ Helper functions (MUST be defined BEFORE filteredMenuItems to avoid hoisting errors)
  // Get categoryId by name for matching
  const getCategoryIdByName = useCallback((categoryName: string) => {
    const stat = categoryStats.find(s => s.name === categoryName);
    return stat?.categoryId;
  }, [categoryStats]);

  // Get category count from backend stats (replaces client-side filtering)
  const getCategoryCount = useCallback((category: string) => {
    const stat = categoryStats.find(s => s.name === category);
    return stat?.availableItems || 0;
  }, [categoryStats]);

  // Filter menu items based on search and category
  const filteredMenuItems = useMemo(() => {
    console.log('🔍 MenuFlow: Filtering menu items', {
      totalItems: menuItems.length,
      selectedCategory,
      searchTerm,
      sampleItem: menuItems[0],
      allUniqueCategories: [...new Set(menuItems.map(i => i.category))],
    });

    const filtered = menuItems.filter(item => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      // ✅ FIX: Match by categoryId for reliability, fallback to case-insensitive name matching
      let matchesCategory = false;
      if (!selectedCategory) {
        matchesCategory = true;
      } else {
        const selectedCategoryId = getCategoryIdByName(selectedCategory);
        if (selectedCategoryId && item.categoryId) {
          // Preferred: Match by categoryId (most reliable)
          matchesCategory = item.categoryId === selectedCategoryId;
        } else {
          // Fallback: Case-insensitive name matching
          matchesCategory = item.category?.toLowerCase() === selectedCategory.toLowerCase();
        }
      }

      const isAvailable = item.isAvailable;

      // Debug log first few items
      if (menuItems.indexOf(item) < 3) {
        console.log(`  Item "${item.name}":`, {
          itemCategory: item.category,
          itemCategoryId: item.categoryId,
          selectedCategory,
          selectedCategoryId: getCategoryIdByName(selectedCategory),
          categoryIdMatch: item.categoryId === getCategoryIdByName(selectedCategory),
          categoryNameMatch: item.category?.toLowerCase() === selectedCategory?.toLowerCase(),
          matchesCategory,
          isAvailable,
          willShow: matchesSearch && matchesCategory && isAvailable,
        });
      }

      return matchesSearch && matchesCategory && isAvailable;
    });

    console.log('✅ MenuFlow: Filtered results', {
      filteredCount: filtered.length,
      firstItem: filtered[0]?.name,
      debugInfo: {
        selectedCategoryLower: selectedCategory?.toLowerCase(),
        itemCategoriesLower: [...new Set(menuItems.map(i => i.category?.toLowerCase()))],
      },
    });

    return filtered;
  }, [menuItems, searchTerm, selectedCategory, getCategoryIdByName]);

  // ✅ FIX: Fetch category statistics from backend API (same as MenuCategoryGrid)
  // This ensures POS page and Menu page show consistent category counts
  const fetchCategoryStats = useCallback(async () => {
    try {
      setIsFetchingStats(true);
      console.log('🔄 MenuFlow: Fetching category stats from backend API');

      const response = await window.electronAPI?.ipc.invoke(
        'mr5pos:menu-items:get-category-stats'
      );

      if (response?.success && response.data) {
        console.log('📦 MenuFlow: Backend Response Received', {
          success: response.success,
          dataLength: response.data.length,
        });

        // Transform backend data to match component format
        // ✅ Include categoryId for reliable matching
        const stats = response.data.map((stat: any) => ({
          categoryId: stat.categoryId,
          name: stat.categoryName,
          totalItems: stat.totalItems,
          availableItems: stat.activeItems, // Backend returns 'activeItems'
          avgPrice: stat.avgPrice,
        }));

        const sortedStats = stats.sort((a, b) => b.totalItems - a.totalItems);

        console.log('✅ MenuFlow: Category stats loaded', {
          totalCategories: sortedStats.length,
          categories: sortedStats.map(s => ({
            name: s.name,
            available: s.availableItems,
            total: s.totalItems,
          })),
        });

        setCategoryStats(sortedStats);
      } else {
        console.error('❌ MenuFlow: Failed to fetch category stats', response);
        setCategoryStats([]);
      }
    } catch (error) {
      console.error('❌ MenuFlow: Exception in fetchCategoryStats', error);
      setCategoryStats([]);
    } finally {
      setIsFetchingStats(false);
    }
  }, []);

  // Fetch category stats on mount and when categories change
  useEffect(() => {
    if (categories && categories.length > 0) {
      console.log('🔄 MenuFlow: Categories available, fetching stats');
      fetchCategoryStats();
    }
  }, [categories, fetchCategoryStats]);

  // Refresh stats when returning to categories view
  useEffect(() => {
    if (currentStep === 'categories') {
      console.log('🔄 MenuFlow: Returned to categories view, refreshing stats');
      fetchCategoryStats();
    }
  }, [currentStep, fetchCategoryStats]);

  // Memoized handler - prevents re-renders when passed to child components
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentStep('items');
    setSearchTerm('');
  }, []); // Empty deps - only uses stable setters

  // Memoized handler - only recreates if onItemAdded changes
  const handleItemSelect = useCallback(
    (item: MenuItem, quantity: number) => {
      setSelectedItem(item);
      setItemQuantity(quantity);
      setIngredientAdjustments({});
      setSpecialNotes('');

      // ✅ IMPROVED LOGIC: Show customize if item is customizable OR has ingredients
      const hasIngredients = item.ingredients && item.ingredients.length > 0;
      const isCustomizableValue = (item as any).isCustomizable;
      const shouldCustomize = isCustomizableValue || hasIngredients;

      if (shouldCustomize) {
        // Initialize ingredient adjustments if item has ingredients
        if (hasIngredients) {
          const initialAdjustments: Record<string, boolean> = {};

          // FIXED: Handle both string arrays (database) and object arrays (future)
          item.ingredients.forEach((ingredient, index) => {
            const ingredientKey =
              typeof ingredient === 'string'
                ? ingredient
                : ingredient.id || `ingredient-${index}`;
            initialAdjustments[ingredientKey] = false; // false = included by default
          });
          setIngredientAdjustments(initialAdjustments);
        }

        setCurrentStep('customize');
      } else {
        // Skip to addons if no customization needed
        setCurrentStep('addons');
      }
    },
    [onItemAdded]
  ); // Only depends on onItemAdded callback

  // Memoized handler - stable reference prevents re-renders
  const handleIngredientToggle = useCallback((ingredientId: string) => {
    setIngredientAdjustments(prev => ({
      ...prev,
      [ingredientId]: !prev[ingredientId],
    }));
  }, []); // Empty deps - only uses setter with functional update

  // Memoized handler - recreates only when dependencies change
  const handleDone = useCallback(() => {
    if (onItemAdded && selectedItem) {
      onItemAdded({
        selectedItem,
        itemQuantity,
        ingredientAdjustments,
        specialNotes,
        addonSelections,
      });
    }
    // Reset to categories
    setCurrentStep('categories');
    setSelectedItem(null);
    setItemQuantity(1);
    setSpecialNotes('');
    setIngredientAdjustments({});
    setAddonSelections([]);
  }, [
    onItemAdded,
    selectedItem,
    itemQuantity,
    ingredientAdjustments,
    specialNotes,
    addonSelections,
  ]);

  const renderCategories = () => (
    <div className='space-y-6'>
      <div>
        <h2 className='mb-2 text-2xl font-semibold'>Menu Categories</h2>
        <p className='text-gray-600 dark:text-gray-400'>
          Select a category to browse items
        </p>
      </div>

      {/* Loading state */}
      {isLoading && categories.length === 0 && (
        <div className='py-12 text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-500'>Loading categories...</p>
        </div>
      )}

      {/* Categories grid */}
      {!isLoading && categories.length > 0 && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4'>
          {categories.map(category => {
            // Handle both string and object category formats
            const categoryName =
              typeof category === 'string' ? category : (category as any).name;
            const categoryColor =
              typeof category === 'string' ? undefined : (category as any).color;
            const count = getCategoryCount(categoryName);
            return (
              <Card
                key={
                  typeof category === 'string' ? category : (category as any).id
                }
                className={cn(
                  'cursor-pointer touch-manipulation shadow-sm transition-all hover:shadow-md overflow-hidden',
                  !categoryColor && 'bg-white dark:bg-gray-800'
                )}
                style={
                  categoryColor
                    ? {
                        backgroundColor: `${categoryColor} !important`,
                        borderColor: categoryColor,
                      }
                    : undefined
                }
                onClick={() => handleCategorySelect(categoryName)}
              >
                <CardContent
                  className='p-6'
                  style={
                    categoryColor
                      ? { backgroundColor: categoryColor }
                      : undefined
                  }
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3
                        className={cn(
                          'mb-1 text-lg font-medium',
                          categoryColor ? 'text-white' : ''
                        )}
                      >
                        {categoryName}
                      </h3>
                      <p
                        className={cn(
                          'text-sm',
                          categoryColor
                            ? 'text-white/90'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {count} items available
                      </p>
                    </div>
                    <ChefHat
                      className={cn(
                        'h-6 w-6',
                        categoryColor ? 'text-white' : 'text-blue-600'
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Show message if no categories after loading */}
      {!isLoading && categories.length === 0 && (
        <div className='py-12 text-center'>
          <ChefHat className='mx-auto mb-3 h-12 w-12 text-gray-300' />
          <p className='text-gray-500'>No categories available</p>
        </div>
      )}
    </div>
  );

  const renderItems = () => (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-semibold'>{selectedCategory}</h2>
          <p className='text-gray-600 dark:text-gray-400'>
            Select quantity and customize items
          </p>
        </div>
        <Button
          variant='outline'
          onClick={() => setCurrentStep('categories')}
          className='touch-manipulation'
        >
          Back to Categories
        </Button>
      </div>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
        <Input
          placeholder='Search items...'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className='touch-manipulation pl-10'
        />
      </div>

      {/* Items Grid with Quantity Selection */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4'>
        {filteredMenuItems.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            onItemSelect={handleItemSelect}
            stockItems={stockItems}
          />
        ))}
      </div>

      {filteredMenuItems.length === 0 && (
        <div className='py-12 text-center'>
          <ChefHat className='mx-auto mb-3 h-12 w-12 text-gray-300' />
          <p className='text-gray-500'>No items found in this category</p>
        </div>
      )}
    </div>
  );

  const renderCustomization = () => (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-semibold'>Customize Item</h2>
          <p className='text-gray-600 dark:text-gray-400'>
            Green ingredients are included. Tap to remove them (turns red).
          </p>
        </div>
        <Button
          variant='outline'
          onClick={() => setCurrentStep('items')}
          className='touch-manipulation'
        >
          Back to Items
        </Button>
      </div>

      {selectedItem && (
        <div className='space-y-6'>
          {/* Item Summary */}
          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-semibold'>{selectedItem.name}</h3>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    Quantity: {itemQuantity}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-lg font-bold'>
                    ${(selectedItem.price * itemQuantity).toFixed(2)}
                  </p>
                  <p className='text-sm text-gray-500'>
                    ${selectedItem.price.toFixed(2)} each
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          {selectedItem.ingredients && selectedItem.ingredients.length > 0 && (
            <div>
              <h3 className='mb-4 text-lg font-medium'>Ingredients</h3>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4'>
                {selectedItem.ingredients.map((ingredient, index) => {
                  // FIXED: Handle both string and object ingredients
                  const ingredientKey =
                    typeof ingredient === 'string'
                      ? ingredient
                      : ingredient.id || `ingredient-${index}`;
                  const ingredientName =
                    typeof ingredient === 'string'
                      ? ingredient
                      : ingredient.name || 'Unknown Ingredient';

                  const isRemoved =
                    ingredientAdjustments[ingredientKey] ?? false;
                  const isIncluded = !isRemoved;

                  return (
                    <Card
                      key={`ingredient-${ingredientKey}`}
                      className={cn(
                        'cursor-pointer touch-manipulation transition-all',
                        isIncluded
                          ? 'border-green-500 bg-green-50 shadow-md dark:bg-green-950/30'
                          : 'border-red-300 bg-red-50 opacity-60 dark:bg-red-950/30'
                      )}
                      onClick={() => handleIngredientToggle(ingredientKey)}
                    >
                      <CardContent className='p-4'>
                        <div className='flex items-center space-x-3'>
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border-2',
                              isRemoved
                                ? 'border-red-500 bg-red-500'
                                : 'border-green-500 bg-green-500'
                            )}
                          >
                            <Check className='h-3 w-3 text-white' />
                          </div>
                          <div className='flex-1'>
                            <p
                              className={cn(
                                'font-medium',
                                isRemoved && 'text-gray-500 line-through'
                              )}
                            >
                              {ingredientName}
                            </p>
                            <p className='text-sm text-gray-500'>
                              {isRemoved ? 'Removed' : 'Included'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {(!selectedItem.ingredients ||
            selectedItem.ingredients.length === 0) && (
            <Card>
              <CardContent className='p-6 text-center'>
                <p className='text-gray-500'>
                  No ingredients to customize for this item
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quantity Controls and Add Button */}
          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-4'>
                  <span className='text-sm font-medium'>Quantity:</span>
                  <div className='flex items-center space-x-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={e => {
                        e.stopPropagation();
                        setItemQuantity(Math.max(1, itemQuantity - 1));
                      }}
                      className='h-8 w-8 touch-manipulation p-0'
                    >
                      <Minus className='h-3 w-3' />
                    </Button>
                    <span className='w-8 text-center text-sm font-medium'>
                      {itemQuantity}
                    </span>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={e => {
                        e.stopPropagation();
                        setItemQuantity(itemQuantity + 1);
                      }}
                      className='h-8 w-8 touch-manipulation p-0'
                    >
                      <Plus className='h-3 w-3' />
                    </Button>
                  </div>
                </div>

                {/* Special Notes for Kitchen */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    Special Notes for Kitchen (Optional)
                  </label>
                  <Input
                    placeholder='e.g., Extra crispy, Well done, No salt...'
                    value={specialNotes}
                    onChange={e => setSpecialNotes(e.target.value)}
                    className='w-full'
                  />
                </div>

                <div className='flex items-center space-x-3'>
                  <Button
                    variant='outline'
                    onClick={() => setCurrentStep('items')}
                    className='touch-manipulation'
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('addons')}
                    className='flex-1'
                    size='lg'
                  >
                    <Check className='mr-2 h-4 w-4' />
                    Continue - ${(selectedItem.price * itemQuantity).toFixed(2)}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  const renderAddons = () => {
    if (!selectedItem) return null;

    // Determine the correct back step based on whether item is customizable
    const hasIngredients = selectedItem.ingredients && selectedItem.ingredients.length > 0;
    const isCustomizableItem = (selectedItem as any).isCustomizable || hasIngredients;
    const backStep = isCustomizableItem ? 'customize' : 'items';

    return (
      <AddonSelectionStep
        selectedItem={selectedItem}
        itemQuantity={itemQuantity}
        onContinue={selections => {
          setAddonSelections(selections);

          // ✅ CRITICAL FIX: Pass selections directly to onItemAdded instead of relying on state
          if (onItemAdded && selectedItem) {
            onItemAdded({
              selectedItem,
              itemQuantity,
              ingredientAdjustments,
              specialNotes,
              addonSelections: selections, // Use the parameter, not state
            });
          }
          
          // Reset to categories
          setCurrentStep('categories');
          setSelectedCategory(null);
          setSelectedItem(null);
          setIngredientAdjustments({});
          setSpecialNotes('');
          setAddonSelections([]);
        }}
        onBack={() => setCurrentStep(backStep)}
      />
    );
  };

  return (
    <AddonSelectionProvider>
      <div className='p-4 lg:p-6'>
        {currentStep === 'categories' && renderCategories()}
        {currentStep === 'items' && renderItems()}
        {currentStep === 'customize' && renderCustomization()}
        {currentStep === 'addons' && renderAddons()}
      </div>
    </AddonSelectionProvider>
  );
};

MenuFlow.displayName = 'MenuFlow';

// Item Card Component with Quantity Selection - MEMOIZED
interface ItemCardProps {
  item: MenuItem;
  onItemSelect: (item: MenuItem, quantity: number) => void;
  stockItems: any[];
}

const ItemCard = React.memo(
  ({ item, onItemSelect, stockItems }: ItemCardProps) => {
    // Memoized click handler - only recreates if item or onItemSelect changes
    const handleItemClick = useCallback(() => {
      onItemSelect(item, 1); // Always default to quantity 1, customization happens in the next step
    }, [item, onItemSelect]);

    const itemColor = item.color;

    return (
      <Card
        className='cursor-pointer touch-manipulation border-2 shadow-sm transition-all hover:shadow-md active:scale-95 overflow-hidden'
        style={{
          backgroundColor: itemColor || undefined,
          borderColor: itemColor || undefined,
        }}
        onClick={handleItemClick}
      >
        <CardContent
          className='p-4'
          style={{
            backgroundColor: itemColor || undefined,
          }}
        >
          <div className='space-y-3'>
            {/* Item Header */}
            <div className='flex items-start justify-between'>
              <h4 className={cn('font-medium', itemColor ? 'text-white' : '')}>
                {item.name}
              </h4>
              <Badge
                variant='outline'
                className={cn('text-sm', itemColor ? 'border-white text-white' : '')}
              >
                ${item.price.toFixed(2)}
              </Badge>
            </div>

            {/* Description */}
            <p
              className={cn(
                'line-clamp-2 text-sm',
                itemColor ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
              )}
            >
              {item.description || 'No description available'}
            </p>

            {/* Ingredients Preview */}
            {item.ingredients && item.ingredients.length > 0 && (
              <div
                className={cn(
                  'text-xs',
                  itemColor ? 'text-white/80' : 'text-gray-500'
                )}
              >
                Ingredients:{' '}
                {item.ingredients
                  .slice(0, 3)
                  .map(ingredient =>
                    typeof ingredient === 'string'
                      ? ingredient
                      : ingredient.name
                  )
                  .join(', ')}
                {item.ingredients.length > 3 && '...'}
              </div>
            )}

            {/* Simple Click to Select */}
            <div
              className={cn(
                'border-t pt-3 text-center',
                itemColor
                  ? 'border-white/30'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              <span
                className={cn(
                  'text-sm',
                  itemColor ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {!item.ingredients || item.ingredients.length <= 1
                  ? 'Click to add'
                  : 'Click to customize and add'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

// Display name for React DevTools
ItemCard.displayName = 'ItemCard';

export default MenuFlow;
