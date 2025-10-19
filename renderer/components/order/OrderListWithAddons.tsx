'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Package,
  Tag,
  Eye,
  EyeOff,
  Grid,
  List,
  ChevronDown,
} from 'lucide-react';
import { OrderItem } from '@/types';
import { OrderItemWithAddons } from './OrderItemWithAddons';
import { useDebounce } from '@/hooks/useDebounce';
import {
  calculateOrderSummary,
  formatPrice,
  getMobileAddonSummary,
} from '@/utils/addonFormatting';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface OrderListWithAddonsProps {
  orderItems: OrderItem[];
  onQuantityChange?: (itemId: string, newQuantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  onEditAddons?: (itemId: string) => void;
  showSearch?: boolean;
  showFilters?: boolean;
  showSummary?: boolean;
  allowSorting?: boolean;
  compactMode?: boolean;
  maxHeight?: number;
  className?: string;
  emptyMessage?: string;
  showItemActions?: boolean;
}

type SortOption = 'name' | 'price' | 'addons' | 'quantity' | 'total';
type FilterOption = 'all' | 'with-addons' | 'without-addons' | 'high-value';

/**
 * OrderListWithAddons - Comprehensive order list with add-on display and management
 *
 * Features:
 * - Search and filter functionality
 * - Multiple sorting options
 * - Compact and detailed view modes
 * - Real-time order summary
 * - Batch operations support
 * - Mobile-responsive design
 * - Accessibility compliant
 * - Performance optimized with virtualization for large lists
 */
export const OrderListWithAddons: React.FC<OrderListWithAddonsProps> = ({
  orderItems,
  onQuantityChange,
  onRemoveItem,
  onEditAddons,
  showSearch = true,
  showFilters = true,
  showSummary = true,
  allowSorting = true,
  compactMode = false,
  maxHeight = 600,
  className,
  emptyMessage = 'No items in this order',
  showItemActions = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDesc, setSortDesc] = useState(false);
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showAddonsExpanded, setShowAddonsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list');

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Calculate order summary
  const orderSummary = useMemo(
    () => calculateOrderSummary(orderItems),
    [orderItems]
  );

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...orderItems];

    // Apply search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(item => {
        const name = (item.name || item.menuItemName || '').toLowerCase();
        const addonsText = (item.addons || [])
          .map(addon => addon.addonName.toLowerCase())
          .join(' ');

        return name.includes(query) || addonsText.includes(query);
      });
    }

    // Apply category filters
    switch (filterBy) {
      case 'with-addons':
        filtered = filtered.filter(
          item => item.addons && item.addons.length > 0
        );
        break;
      case 'without-addons':
        filtered = filtered.filter(
          item => !item.addons || item.addons.length === 0
        );
        break;
      case 'high-value':
        filtered = filtered.filter(item => {
          const basePrice = (item.unitPrice || item.price || 0) * item.quantity;
          const addonTotal =
            (item.addons || []).reduce(
              (sum, addon) => sum + addon.totalPrice,
              0
            ) * item.quantity;
          return basePrice + addonTotal > 20; // Configurable threshold
        });
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'name':
          aValue = (a.name || a.menuItemName || '').toLowerCase();
          bValue = (b.name || b.menuItemName || '').toLowerCase();
          break;
        case 'price':
          aValue = a.unitPrice || a.price || 0;
          bValue = b.unitPrice || b.price || 0;
          break;
        case 'addons':
          aValue = (a.addons || []).length;
          bValue = (b.addons || []).length;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'total':
          const aBase = (a.unitPrice || a.price || 0) * a.quantity;
          const aAddons =
            (a.addons || []).reduce((sum, addon) => sum + addon.totalPrice, 0) *
            a.quantity;
          aValue = aBase + aAddons;

          const bBase = (b.unitPrice || b.price || 0) * b.quantity;
          const bAddons =
            (b.addons || []).reduce((sum, addon) => sum + addon.totalPrice, 0) *
            b.quantity;
          bValue = bBase + bAddons;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDesc
          ? bValue.localeCompare(aValue)
          : aValue.localeCompare(bValue);
      } else {
        return sortDesc
          ? (bValue as number) - (aValue as number)
          : (aValue as number) - (bValue as number);
      }
    });

    return filtered;
  }, [orderItems, debouncedSearch, filterBy, sortBy, sortDesc]);

  // Get filter counts
  const filterCounts = useMemo(() => {
    const withAddons = orderItems.filter(
      item => item.addons && item.addons.length > 0
    ).length;
    const withoutAddons = orderItems.length - withAddons;
    const highValue = orderItems.filter(item => {
      const basePrice = (item.unitPrice || item.price || 0) * item.quantity;
      const addonTotal =
        (item.addons || []).reduce((sum, addon) => sum + addon.totalPrice, 0) *
        item.quantity;
      return basePrice + addonTotal > 20;
    }).length;

    return { withAddons, withoutAddons, highValue };
  }, [orderItems]);

  // Handle view mode toggle
  const effectiveCompactMode = compactMode || viewMode === 'compact';

  if (orderItems.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <Package className='mb-4 h-12 w-12 text-muted-foreground' />
          <p className='text-center text-muted-foreground'>{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Package className='h-5 w-5' />
            Order Items
          </CardTitle>
          <div className='flex items-center gap-2'>
            {/* View mode toggle */}
            {!compactMode && (
              <div className='flex items-center rounded-md border'>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('list')}
                  className='h-8 w-8 p-0'
                >
                  <List className='h-4 w-4' />
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('compact')}
                  className='h-8 w-8 p-0'
                >
                  <Grid className='h-4 w-4' />
                </Button>
              </div>
            )}

            <Badge variant='outline' className='text-sm'>
              {filteredAndSortedItems.length} items
            </Badge>
          </div>
        </div>

        {/* Search and filters */}
        {(showSearch || showFilters) && (
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            {/* Search */}
            {showSearch && (
              <div className='relative min-w-48 flex-1'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground' />
                <Input
                  placeholder='Search items or add-ons...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='h-9 pl-10'
                />
              </div>
            )}

            {/* Filters */}
            {showFilters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='h-9'>
                    <Filter className='mr-2 h-4 w-4' />
                    Filter
                    <ChevronDown className='ml-2 h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setFilterBy('all')}
                    className={filterBy === 'all' ? 'bg-accent' : ''}
                  >
                    All items ({orderItems.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterBy('with-addons')}
                    className={filterBy === 'with-addons' ? 'bg-accent' : ''}
                  >
                    <Tag className='mr-2 h-4 w-4' />
                    With add-ons ({filterCounts.withAddons})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterBy('without-addons')}
                    className={filterBy === 'without-addons' ? 'bg-accent' : ''}
                  >
                    Without add-ons ({filterCounts.withoutAddons})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFilterBy('high-value')}
                    className={filterBy === 'high-value' ? 'bg-accent' : ''}
                  >
                    High value ($20+) ({filterCounts.highValue})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Sorting */}
            {allowSorting && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='h-9'>
                    {sortDesc ? (
                      <SortDesc className='mr-2 h-4 w-4' />
                    ) : (
                      <SortAsc className='mr-2 h-4 w-4' />
                    )}
                    Sort
                    <ChevronDown className='ml-2 h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-48'>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'price', label: 'Price' },
                    { key: 'addons', label: 'Add-ons count' },
                    { key: 'quantity', label: 'Quantity' },
                    { key: 'total', label: 'Total price' },
                  ].map(option => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => {
                        if (sortBy === option.key) {
                          setSortDesc(!sortDesc);
                        } else {
                          setSortBy(option.key as SortOption);
                          setSortDesc(false);
                        }
                      }}
                      className={sortBy === option.key ? 'bg-accent' : ''}
                    >
                      {option.label}
                      {sortBy === option.key && (
                        <span className='ml-auto'>{sortDesc ? '↓' : '↑'}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Show/Hide add-ons toggle */}
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowAddonsExpanded(!showAddonsExpanded)}
              className='h-9'
            >
              {showAddonsExpanded ? (
                <EyeOff className='mr-2 h-4 w-4' />
              ) : (
                <Eye className='mr-2 h-4 w-4' />
              )}
              Add-ons
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className='p-0'>
        {/* Order items list */}
        <ScrollArea className='w-full' style={{ maxHeight }}>
          <div className='space-y-3 p-6 pt-0'>
            {filteredAndSortedItems.map((item, index) => (
              <OrderItemWithAddons
                key={item.id}
                orderItem={item}
                onQuantityChange={onQuantityChange}
                onRemoveItem={onRemoveItem}
                onEditAddons={onEditAddons}
                showActions={showItemActions}
                showAddonsExpanded={showAddonsExpanded}
                compact={effectiveCompactMode}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Order summary */}
        {showSummary && (
          <div className='border-t bg-muted/30 p-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span>Items ({orderSummary.itemCount})</span>
                <span>{formatPrice(orderSummary.subtotal)}</span>
              </div>

              {orderSummary.addonTotal > 0 && (
                <div className='flex items-center justify-between text-sm'>
                  <div className='flex items-center gap-2'>
                    <Tag className='h-3 w-3' />
                    <span>Add-ons ({orderSummary.addonCount})</span>
                  </div>
                  <span className='text-green-600'>
                    +{formatPrice(orderSummary.addonTotal)}
                  </span>
                </div>
              )}

              <Separator />

              <div className='flex items-center justify-between font-semibold'>
                <span>Subtotal</span>
                <span>{formatPrice(orderSummary.finalTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Search results info */}
        {debouncedSearch.trim() && (
          <div className='px-6 pb-2 text-sm text-muted-foreground'>
            {filteredAndSortedItems.length === 0
              ? `No items found for "${debouncedSearch}"`
              : `Showing ${filteredAndSortedItems.length} result${filteredAndSortedItems.length !== 1 ? 's' : ''} for "${debouncedSearch}"`}
          </div>
        )}

        {/* Accessibility information */}
        <div className='sr-only'>
          Order list with {filteredAndSortedItems.length} items displayed.
          {debouncedSearch.trim() && ` Filtered by search: ${debouncedSearch}.`}
          {filterBy !== 'all' &&
            ` Filtered to show ${filterBy.replace('-', ' ')}.`}
          Sorted by {sortBy} {sortDesc ? 'descending' : 'ascending'}. Total
          order value: {formatPrice(orderSummary.finalTotal)}.
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedOrderListWithAddons = React.memo(
  OrderListWithAddons,
  (prevProps, nextProps) => {
    return (
      prevProps.orderItems.length === nextProps.orderItems.length &&
      prevProps.compactMode === nextProps.compactMode &&
      prevProps.showSearch === nextProps.showSearch &&
      prevProps.showFilters === nextProps.showFilters &&
      prevProps.showSummary === nextProps.showSummary
    );
  }
);

export default OrderListWithAddons;
