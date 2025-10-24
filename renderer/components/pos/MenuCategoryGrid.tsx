/**
 * MenuCategoryGrid Component - Uses Backend API for Accurate Category Stats
 *
 * CRITICAL FIX:
 * ✅ Uses backend API 'mr5pos:menu-items:get-category-stats' for accurate counts
 * ✅ Database-driven counts (single source of truth)
 * ✅ No client-side filtering issues
 * ✅ Matches menu management page implementation
 */
'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  UtensilsCrossed,
  Package,
  Coffee,
  Beef,
  Fish,
} from 'lucide-react';

interface MenuCategoryGridProps {
  onCategorySelect: (category: string) => void;
  selectedCategory?: string;
}

// IPC-based file logger helper
const writeLog = async (
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: any
) => {
  try {
    await window.electronAPI?.ipc.invoke('mr5pos:logs:write-log', {
      level,
      message,
      category: 'ui',
      module: 'MenuCategoryGrid',
      context,
    });
  } catch (error) {
    // Silently fail if logging fails
    console.error('Failed to write log:', error);
  }
};

const MenuCategoryGrid = ({
  onCategorySelect,
  selectedCategory,
}: MenuCategoryGridProps) => {
  const { switchToTables, viewMode } = usePOSStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [previousViewMode, setPreviousViewMode] = useState<string>(viewMode);

  // State for category statistics from backend API (like CategoryManagement)
  const [categoryStats, setCategoryStats] = useState<
    Array<{
      name: string;
      totalItems: number;
      availableItems: number;
      avgPrice: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch category statistics from backend API
  const fetchCategoryStats = async () => {
    try {
      setIsLoading(true);

      await writeLog('info', '========================================');
      await writeLog('info', '🔄 MenuCategoryGrid: Starting category stats fetch');
      await writeLog('info', 'Calling IPC: mr5pos:menu-items:get-category-stats');

      const response = await window.electronAPI?.ipc.invoke(
        'mr5pos:menu-items:get-category-stats'
      );

      await writeLog('info', '📦 Backend Response Received', {
        success: response?.success,
        hasData: !!response?.data,
        dataLength: response?.data?.length,
      });

      if (response?.success && response.data) {
        await writeLog('info', '🔍 Raw Backend Data', { data: response.data });

        // Transform backend data to match component format
        const stats = response.data.map((stat: any, index: number) => {
          const transformed = {
            name: stat.categoryName,
            totalItems: stat.totalItems,
            availableItems: stat.activeItems, // Backend returns 'activeItems'
            avgPrice: stat.avgPrice,
          };

          writeLog('info', `📊 Category ${index + 1}`, {
            categoryName: stat.categoryName,
            categoryId: stat.categoryId,
            totalItems: stat.totalItems,
            activeItems: stat.activeItems,
            avgPrice: stat.avgPrice,
            transformed: transformed,
          });

          return transformed;
        });

        const sortedStats = stats.sort((a, b) => b.totalItems - a.totalItems);

        await writeLog('info', '✅ Final Stats to Display', {
          totalCategories: sortedStats.length,
          categories: sortedStats.map(s => ({
            name: s.name,
            available: s.availableItems,
            total: s.totalItems,
          })),
        });

        setCategoryStats(sortedStats);
        await writeLog('info', '========================================');
      } else {
        await writeLog('error', '❌ Failed Response', {
          success: response?.success,
          error: response?.error,
          data: response?.data,
        });
        setCategoryStats([]);
      }
    } catch (error) {
      await writeLog('error', '❌ Exception in fetchCategoryStats', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setCategoryStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchCategoryStats();
  }, []);

  // FIX: Refresh category stats when returning to menu view
  // This ensures category counts reflect any availability changes from order operations
  useEffect(() => {
    // Detect transition TO menu view (categories)
    if (previousViewMode !== 'menu' && viewMode === 'menu') {
      writeLog('info', '🔄 View Mode Changed', {
        from: previousViewMode,
        to: viewMode,
        action: 'Refreshing category stats',
      });
      fetchCategoryStats();
    }
    setPreviousViewMode(viewMode);
  }, [viewMode, previousViewMode]);

  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (
      lowerCategory.includes('meat') ||
      lowerCategory.includes('steak') ||
      lowerCategory.includes('beef')
    ) {
      return Beef;
    } else if (
      lowerCategory.includes('seafood') ||
      lowerCategory.includes('fish')
    ) {
      return Fish;
    } else if (
      lowerCategory.includes('drink') ||
      lowerCategory.includes('beverage') ||
      lowerCategory.includes('coffee')
    ) {
      return Coffee;
    } else if (
      lowerCategory.includes('appetizer') ||
      lowerCategory.includes('starter')
    ) {
      return Package;
    }
    return UtensilsCrossed;
  };

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    return categoryStats.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categoryStats, searchTerm]);

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b border-gray-200 p-4 dark:border-gray-700'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={switchToTables}
              className='touch-manipulation'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              <span className='hidden sm:inline'>Back to Tables</span>
              <span className='sm:hidden'>Back</span>
            </Button>
            <div>
              <h2 className='text-lg font-semibold text-gray-900 dark:text-white sm:text-xl'>
                Menu Categories
              </h2>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Select a category to browse items
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
          <Input
            placeholder='Search categories...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='touch-manipulation pl-10'
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4'>
          {filteredCategories.map(category => {
            const IconComponent = getCategoryIcon(category.name);
            const isSelected = selectedCategory === category.name;

            return (
              <Card
                key={category.name}
                className={`transform cursor-pointer touch-manipulation border-2 transition-all duration-200 hover:shadow-lg active:scale-95 ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-500 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-gray-800'
                }`}
                onClick={() => onCategorySelect(category.name)}
              >
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center justify-between text-base'>
                    <div className='flex items-center space-x-2'>
                      <IconComponent className='h-5 w-5 text-blue-600' />
                      <span className='truncate'>{category.name}</span>
                    </div>
                    <Badge variant='outline' className='ml-2 text-xs'>
                      {category.availableItems}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className='pt-0'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Available
                      </span>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {category.availableItems}/{category.totalItems}
                      </span>
                    </div>

                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Avg Price
                      </span>
                      <span className='font-medium text-gray-900 dark:text-white'>
                        ${category.avgPrice.toFixed(2)}
                      </span>
                    </div>

                    {category.availableItems === 0 && (
                      <div className='mt-2 text-xs text-red-500'>
                        No items available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredCategories.length === 0 && !isLoading && (
          <div className='py-12 text-center'>
            <UtensilsCrossed className='mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600' />
            <h3 className='mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300'>
              {searchTerm ? 'No Categories Found' : 'No Menu Categories'}
            </h3>
            <p className='mx-auto max-w-md text-sm text-gray-500 dark:text-gray-400'>
              {searchTerm
                ? 'Try adjusting your search term.'
                : 'Menu categories will appear here once items are added.'}
            </p>
            {searchTerm && (
              <Button
                variant='outline'
                onClick={() => setSearchTerm('')}
                className='mt-4 touch-manipulation'
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuCategoryGrid;
